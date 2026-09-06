// 산 상세에 보여줄 집계. 0명이라는 문구는 만들지 않는다 — 숫자만 주고, 화면에서 0이면 줄을 숨긴다.

import { seoulDayStartMs } from '../../../src/lib/day.ts';
import { placesQueries, toPlaces, type Place } from '../../../src/lib/places.ts';
import { MOUNTAINS } from '../_shared/mountains.ts';
import { json, preflight } from '../_shared/http.ts';
import { readUserKey, serviceClient } from '../_shared/session.ts';

const HIKING_WINDOW_MS = 6 * 60 * 60 * 1000;

// 산에서 내려와 들르는 음식점. 네이버 지역 검색을 그때그때 부르고 저장하지 않는다.
// 키가 없거나 네이버가 실패하면 빈 배열 — 집계와 마찬가지로 없으면 줄을 안 그리면 그만이다.
async function nearbyPlaces(mountainId: string): Promise<Place[]> {
  const id = Deno.env.get('NAVER_CLIENT_ID');
  const secret = Deno.env.get('NAVER_CLIENT_SECRET');
  const mountain = MOUNTAINS.find((item) => item.id === mountainId);
  if (id === undefined || secret === undefined || mountain === undefined) {
    return [];
  }
  for (const query of placesQueries(mountain.name, mountain.trailheads[0]?.name)) {
    const url = `https://naverapihub.apigw.ntruss.com/search/v1/local?query=${encodeURIComponent(query)}&display=5&sort=comment`;
    try {
      const response = await fetch(url, {
        headers: { 'X-NCP-APIGW-API-KEY-ID': id, 'X-NCP-APIGW-API-KEY': secret },
      });
      if (!response.ok) {
        console.error(`네이버 지역 검색 ${response.status}`);
        continue;
      }
      const body = await response.json();
      const places = toPlaces(body.items ?? []);
      if (places.length > 0) {
        return places;
      }
    } catch (error) {
      console.error(`네이버 지역 검색 실패 · ${error instanceof Error ? error.message : error}`);
    }
  }
  return [];
}

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
  const [hiking, today, total, places] = await Promise.all([
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
    nearbyPlaces(mountainId),
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
      places,
    },
    200,
    origin,
  );
});
