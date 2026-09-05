// 내 스탬프 목록. 최근에 찍은 것부터.

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

  const { data, error } = await serviceClient()
    .from('stamps')
    .select('mountain_id, verified_at')
    .eq('user_id', userKey)
    .order('verified_at', { ascending: false });

  if (error !== null) {
    console.error(`my-stamps 조회 실패 · ${error.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }

  return json(
    {
      stamps: data.map((row) => ({ mountainId: row.mountain_id, verifiedAt: row.verified_at })),
    },
    200,
    origin,
  );
});
