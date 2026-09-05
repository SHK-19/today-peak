// 정상 인증의 최종 판정. 클라이언트 판정은 즉시 피드백일 뿐이고, DB에 남는 건 여기 결과뿐이다.

import { seoulDayStartMs } from '../../../src/lib/day.ts';
import { isReadingFresh, verifySummit } from '../../../src/lib/verify.ts';
import { json, preflight } from '../_shared/http.ts';
import { MOUNTAINS } from '../_shared/mountains.ts';
import { parseReading } from '../_shared/reading.ts';
import { readUserKey, serviceClient } from '../_shared/session.ts';

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

  // 미리 받아둔 좌표로 나중에 인증하는 것을 막는다.
  const now = Date.now();
  if (!isReadingFresh(reading, now)) {
    return json({ status: 'stale_reading' }, 200, origin);
  }

  const result = verifySummit(reading, mountain);
  if (!result.ok) {
    return json({ status: 'rejected', reason: result.reason, distanceM: result.distanceM }, 200, origin);
  }

  const supabase = serviceClient();
  const { data: today, error: selectError } = await supabase
    .from('stamps')
    .select('id')
    .eq('user_id', userKey)
    .eq('mountain_id', mountain.id)
    .gte('verified_at', new Date(seoulDayStartMs(now)).toISOString())
    .limit(1);

  if (selectError !== null) {
    console.error(`stamps 조회 실패 · ${selectError.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }
  if (today.length > 0) {
    return json({ status: 'already_today', distanceM: result.distanceM }, 200, origin);
  }

  const { error: insertError } = await supabase.from('stamps').insert({
    user_id: userKey,
    mountain_id: mountain.id,
    distance_m: result.distanceM,
    accuracy_m: reading.coords.accuracy,
  });
  if (insertError !== null) {
    console.error(`stamps 저장 실패 · ${insertError.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }

  console.log(`stamp · userKey=${userKey} · ${mountain.id} · ${Math.round(result.distanceM)}m`);
  return json({ status: 'ok', distanceM: result.distanceM }, 200, origin);
});
