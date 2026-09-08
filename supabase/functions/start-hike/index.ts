// 산행 시작 체크인. 정상 인증과 완전히 독립이다 — 여기서 실패해도 정상 인증에는 영향이 없다.

import { seoulDayStartMs } from '../../../src/lib/day.ts';
import { startPoint } from '../../../src/lib/trailhead.ts';
import { isReadingFresh } from '../../../src/lib/verify.ts';
import { json, preflight } from '../_shared/http.ts';
import { MOUNTAINS } from '../_shared/mountains.ts';
import { parseReading } from '../_shared/reading.ts';
import { readUserKey, serviceClient } from '../_shared/session.ts';
import { grantReward } from '../_shared/toss.ts';

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  const early = preflight(request);
  if (early !== null) {
    return early;
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  const userKey = await readUserKey(request);
  if (userKey === null) {
    return json({ error: 'unauthorized' }, 401, origin);
  }

  let body: { mountainId?: unknown; reading?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_request' }, 400, origin);
  }

  const mountain = MOUNTAINS.find((item) => item.id === body.mountainId);
  const reading = parseReading(body.reading);
  if (mountain === undefined || reading === null) {
    return json({ error: 'invalid_request' }, 400, origin);
  }

  const now = Date.now();
  if (!isReadingFresh(reading, now)) {
    return json({ status: 'stale_reading' }, 200, origin);
  }

  const start = startPoint(reading, mountain);
  if (start === null) {
    return json({ error: 'invalid_request' }, 400, origin);
  }
  if (start.distanceM > start.radiusM) {
    return json(
      { status: 'too_far', trailheadName: start.name, distanceM: start.distanceM },
      200,
      origin,
    );
  }

  const supabase = serviceClient();
  const { data: today, error: selectError } = await supabase
    .from('hike_starts')
    .select('id')
    .eq('user_id', userKey)
    .eq('mountain_id', mountain.id)
    .gte('started_at', new Date(seoulDayStartMs(now)).toISOString())
    .limit(1);
  // 첫 산행 프로모션(1인 1회)용. insert 전에 본다.
  const { count: priorStarts } = await supabase
    .from('hike_starts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userKey);

  if (selectError !== null) {
    console.error(`hike_starts 조회 실패 · ${selectError.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }
  if (today.length > 0) {
    return json({ status: 'already_today', trailheadName: start.name }, 200, origin);
  }

  const { error: insertError } = await supabase.from('hike_starts').insert({
    user_id: userKey,
    mountain_id: mountain.id,
    trailhead_name: start.name,
    distance_m: start.distanceM,
  });
  if (insertError !== null) {
    console.error(`hike_starts 저장 실패 · ${insertError.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }

  console.log(`hike start · userKey=${userKey} · ${mountain.id} · ${start.name}`);
  // 토스 포인트. 저장이 끝난 뒤에만, 실패해도 시작은 성공이다.
  const rewardP =
    (await grantReward(userKey, 'start')) +
    (priorStarts === 0 ? await grantReward(userKey, 'first') : 0);
  return json({ status: 'ok', trailheadName: start.name, rewardP }, 200, origin);
});
