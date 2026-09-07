// 산 상세에 보여줄 집계. 0명이라는 문구는 만들지 않는다 — 숫자만 주고, 화면에서 0이면 줄을 숨긴다.

import { seoulDayStartMs } from '../../../src/lib/day.ts';
import {
  placesQueries,
  splitPlaces,
  toPlaces,
  type NearbyPlaces,
  type PlaceKeyword,
} from '../../../src/lib/places.ts';
import { MOUNTAINS } from '../_shared/mountains.ts';
import { json, preflight } from '../_shared/http.ts';
import { readUserKey, serviceClient } from '../_shared/session.ts';

const HIKING_WINDOW_MS = 6 * 60 * 60 * 1000;

// courses 행 → 화면 요약. 컬럼 이름만 바꾼다.
// deno-lint-ignore no-explicit-any
function courseSummary(row: any) {
  return {
    id: row.id,
    name: row.name,
    startName: row.start_name,
    startAddress: row.start_address ?? null,
    startLat: row.start_lat ?? null,
    startLng: row.start_lng ?? null,
    peakName: row.peak_name,
    peakEleM: row.peak_ele_m,
    distanceM: row.distance_m,
    ascentM: row.ascent_m,
    minutes: row.minutes,
    kcal: row.kcal,
    difficulty: row.difficulty,
    isLoop: row.is_loop,
  };
}

// 산에서 내려와 들르는 음식점. 네이버 지역 검색을 그때그때 부르고 저장하지 않는다.
// 키가 없거나 네이버가 실패하면 빈 배열 — 집계와 마찬가지로 없으면 줄을 안 그리면 그만이다.
async function nearbyPlaces(mountainId: string): Promise<NearbyPlaces> {
  const id = Deno.env.get('NAVER_CLIENT_ID');
  const secret = Deno.env.get('NAVER_CLIENT_SECRET');
  const mountain = MOUNTAINS.find((item) => item.id === mountainId);
  const empty = { food: [], cafe: [] };
  if (id === undefined || secret === undefined || mountain === undefined) {
    return empty;
  }
  // 한 번에 5건까지라 나눠 찾는다. "맛집"에는 카페가 많이 섞여서 "식당"을 한 번 더 부른다.
  const trailhead = mountain.trailheads[0]?.name;
  const [popular, diners, cafes] = await Promise.all([
    search(mountain.name, trailhead, '맛집'),
    search(mountain.name, trailhead, '식당'),
    search(mountain.name, trailhead, '카페'),
  ]);
  return splitPlaces([...popular, ...diners], cafes);

  async function search(name: string, trailhead: string | undefined, kind: PlaceKeyword) {
  for (const query of placesQueries(name, trailhead, kind)) {
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

  const params = new URL(request.url).searchParams;

  // 코스 하나의 상세(지점 포함). 코스를 눌렀을 때만 온다. 함수 6개 상한 때문에 여기 얹는다.
  const courseId = params.get('courseId');
  if (courseId !== null && courseId !== '') {
    const { data, error } = await serviceClient().from('courses').select('*').eq('id', courseId).maybeSingle();
    if (error !== null) {
      console.error(`courses 조회 실패 · ${error.message}`);
      return json({ error: 'server_error' }, 500, origin);
    }
    if (data === null) {
      return json({ error: 'not_found' }, 404, origin);
    }
    return json({ ...courseSummary(data), descentM: data.descent_m, maxEleM: data.max_ele_m, pois: data.pois, track: data.track }, 200, origin);
  }

  const mountainId = params.get('mountainId');
  if (mountainId === null || mountainId === '') {
    return json({ error: 'invalid_request' }, 400, origin);
  }

  const now = Date.now();
  const supabase = serviceClient();
  const [hiking, today, total, places, courseRows] = await Promise.all([
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
    supabase
      .from('courses')
      .select('id, name, start_name, start_address, start_lat, start_lng, peak_name, peak_ele_m, distance_m, ascent_m, minutes, kcal, difficulty, is_loop')
      .eq('mountain_id', mountainId)
      .order('distance_m'),
  ]);

  const failed = [hiking, today, total].find((result) => result.error !== null);
  if (failed !== undefined) {
    console.error(`mountain-stats 조회 실패 · ${failed.error?.message}`);
    return json({ error: 'server_error' }, 500, origin);
  }

  // 코스는 참고 정보라 조회가 실패해도 집계는 내보낸다.
  if (courseRows.error !== null) {
    console.error(`courses 조회 실패 · ${courseRows.error.message}`);
  }

  return json(
    {
      hikingNow: hiking.count ?? 0,
      todayStamps: today.count ?? 0,
      totalStamps: total.count ?? 0,
      places,
      courses: (courseRows.data ?? []).map(courseSummary),
    },
    200,
    origin,
  );
});
