// 정상 인증의 최종 판정. 클라이언트 판정은 즉시 피드백일 뿐이고, DB에 남는 건 여기 결과뿐이다.

import { seoulDayStartMs } from '../../../src/lib/day.ts';
import { isReadingFresh, verifySummit } from '../../../src/lib/verify.ts';
import { hikeStartFor } from '../../../src/lib/visits.ts';
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

  let body: { mountainId?: unknown; reading?: unknown; suggestPeakName?: unknown };
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

  // 이용자가 "여기도 정상"이라고 알려준 경우. 인증이 아니라 제안이므로 스탬프를 주지 않는다.
  // 평소에는 좌표를 저장하지 않지만 이 요청은 이용자가 직접 누른 것이다(개인정보처리방침 제3조).
  if (typeof body.suggestPeakName === 'string') {
    const peakName = body.suggestPeakName.trim().slice(0, 20);
    if (peakName === '') {
      return json({ error: 'invalid_request' }, 400, origin);
    }
    const { error } = await serviceClient().from('peak_suggestions').insert({
      user_id: userKey,
      mountain_id: mountain.id,
      peak_name: peakName,
      lat: reading.coords.latitude,
      lng: reading.coords.longitude,
      accuracy_m: reading.coords.accuracy,
      distance_m: result.distanceM,
    });
    if (error !== null) {
      console.error(`peak_suggestions 저장 실패 · ${error.message}`);
      return json({ error: 'server_error' }, 500, origin);
    }
    console.log(
      `peak suggestion · ${mountain.id} · ${Math.round(result.distanceM)}m 떨어진 지점`,
    );
    return json({ status: 'suggested' }, 200, origin);
  }
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

  const { data: inserted, error: insertError } = await supabase
    .from('stamps')
    .insert({
      user_id: userKey,
      mountain_id: mountain.id,
      distance_m: result.distanceM,
      accuracy_m: reading.coords.accuracy,
    })
    .select('verified_at')
    .single();
  if (insertError !== null) {
    console.error(`stamps 저장 실패 · ${insertError.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }

  // 24시간 안에 이 산에서 산행 시작을 눌렀으면 걸린 시간의 재료를 돌려준다. 조회가 실패해도
  // 스탬프는 이미 저장됐으니 시간만 빼고 성공으로 답한다.
  const { data: starts } = await supabase
    .from('hike_starts')
    .select('mountain_id, started_at')
    .eq('user_id', userKey)
    .eq('mountain_id', mountain.id)
    .gte('started_at', new Date(now - 24 * 60 * 60 * 1000).toISOString());
  const hikeStartedAt = hikeStartFor(
    { mountainId: mountain.id, verifiedAt: inserted.verified_at },
    (starts ?? []).map((row) => ({ mountainId: row.mountain_id, startedAt: row.started_at })),
  );

  console.log(`stamp · userKey=${userKey} · ${mountain.id} · ${Math.round(result.distanceM)}m`);
  return json(
    hikeStartedAt === undefined
      ? { status: 'ok', distanceM: result.distanceM }
      : { status: 'ok', distanceM: result.distanceM, hikeStartedAt },
    200,
    origin,
  );
});
