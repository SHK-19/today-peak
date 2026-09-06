// 내 스탬프 목록. 최근에 찍은 것부터.

import { hikeStartFor } from '../../../src/lib/visits.ts';
import { json, preflight } from '../_shared/http.ts';
import { readUserKey, serviceClient } from '../_shared/session.ts';

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  const early = preflight(request);
  if (early !== null) {
    return early;
  }
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  const userKey = await readUserKey(request);
  if (userKey === null) {
    return json({ error: 'unauthorized' }, 401, origin);
  }

  const supabase = serviceClient();
  const [{ data, error }, { data: starts, error: startsError }] = await Promise.all([
    supabase
      .from('stamps')
      .select('mountain_id, verified_at')
      .eq('user_id', userKey)
      .order('verified_at', { ascending: false }),
    supabase.from('hike_starts').select('mountain_id, started_at').eq('user_id', userKey),
  ]);

  if (error !== null || startsError !== null) {
    console.error(`my-stamps 조회 실패 · ${error?.message ?? startsError?.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }

  // 산행 시작과 짝지어 걸린 시간의 재료(hikeStartedAt)를 같이 준다. 규칙은 src/lib/visits.ts.
  const startRows = starts.map((row) => ({ mountainId: row.mountain_id, startedAt: row.started_at }));
  return json(
    {
      stamps: data.map((row) => {
        const stamp = { mountainId: row.mountain_id, verifiedAt: row.verified_at };
        const hikeStartedAt = hikeStartFor(stamp, startRows);
        return hikeStartedAt === undefined ? stamp : { ...stamp, hikeStartedAt };
      }),
    },
    200,
    origin,
  );
});
