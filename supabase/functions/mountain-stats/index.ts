// 산 상세에 보여줄 집계. 0명이라는 문구는 만들지 않는다 — 숫자만 주고, 화면에서 0이면 줄을 숨긴다.

import { seoulDayStartMs } from '../../../src/lib/day.ts';
import { json, preflight } from '../_shared/http.ts';
import { readUserKey, serviceClient } from '../_shared/session.ts';

const HIKING_WINDOW_MS = 6 * 60 * 60 * 1000;

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

  const mountainId = new URL(request.url).searchParams.get('mountainId');
  if (mountainId === null || mountainId === '') {
    return json({ error: 'invalid_request' }, 400, origin);
  }

  const now = Date.now();
  const supabase = serviceClient();
  const [hiking, today, total] = await Promise.all([
    supabase
      .from('hike_starts')
      .select('*', { count: 'exact', head: true })
      .eq('mountain_id', mountainId)
      .gte('started_at', new Date(now - HIKING_WINDOW_MS).toISOString()),
    supabase
      .from('stamps')
      .select('*', { count: 'exact', head: true })
      .eq('mountain_id', mountainId)
      .gte('verified_at', new Date(seoulDayStartMs(now)).toISOString()),
    supabase
      .from('stamps')
      .select('*', { count: 'exact', head: true })
      .eq('mountain_id', mountainId),
  ]);

  const failed = [hiking, today, total].find((result) => result.error !== null);
  if (failed !== undefined) {
    console.error(`mountain-stats 조회 실패 · ${failed.error?.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }

  return json(
    {
      hikingNow: hiking.count ?? 0,
      todayStamps: today.count ?? 0,
      totalStamps: total.count ?? 0,
    },
    200,
    origin,
  );
});
