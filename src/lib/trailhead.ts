import { collectionOf } from './collection.ts';
import { haversineMeters } from './geo.ts';

import type { Mountain, Reading, Trailhead } from './verify.ts';

// 실측 후 조정한다. 정상 반경과 달리 넉넉하게 잡는다 — 등산로 입구는 넓고
// 주차장·매표소 등 여러 지점이 입구로 통한다.
export const START_RADIUS_M = 500;

// 동네 명산은 들머리 좌표가 없다 — OSM에서 정상만 가져왔다. 대신 정상 반경을 쓴다.
// 100대 명산에는 쓰지 않는다: 큰 산은 입구가 정상에서 3~5km라 어떤 반경도 안 맞는다.
// 동네 명산은 최고 683m, 대부분 400m 이하라 산 전체가 이 반경 안에 들어온다.
export const LOCAL_START_RADIUS_M = 800;

export type NearestTrailhead = { trailhead: Trailhead; distanceM: number };

// 가장 가까운 등산로 입구와 그 거리를 돌려준다. trailheads가 비어 있으면 null.
// 반경 판정은 하지 않는다 — 호출부가 START_RADIUS_M과 비교한다.
export function nearestTrailhead(reading: Reading, mountain: Mountain): NearestTrailhead | null {
  let nearest: NearestTrailhead | null = null;

  for (const trailhead of mountain.trailheads) {
    const distanceM = haversineMeters(
      reading.coords.latitude,
      reading.coords.longitude,
      trailhead.lat,
      trailhead.lng,
    );
    if (nearest === null || distanceM < nearest.distanceM) {
      nearest = { trailhead, distanceM };
    }
  }

  return nearest;
}

/** 산행 시작을 판정할 기준점. 들머리가 있으면 가장 가까운 입구, 동네 명산은 정상. */
export type StartPoint = { name: string; distanceM: number; radiusM: number };

// 시작 지점이 없는 산(들머리도 없고 동네 명산도 아닌)은 null. 화면은 버튼을 그리지 않고
// 서버는 요청을 거절한다. 폴백을 더 만들지 않는다.
export function startPoint(reading: Reading, mountain: Mountain): StartPoint | null {
  const nearest = nearestTrailhead(reading, mountain);
  if (nearest !== null) {
    return {
      name: nearest.trailhead.name,
      distanceM: nearest.distanceM,
      radiusM: START_RADIUS_M,
    };
  }
  if (collectionOf(mountain) !== 'local') {
    return null;
  }
  return {
    name: mountain.name,
    distanceM: haversineMeters(
      reading.coords.latitude,
      reading.coords.longitude,
      mountain.summitLat,
      mountain.summitLng,
    ),
    radiusM: LOCAL_START_RADIUS_M,
  };
}

// 화면이 '나도 등산 중이라고 알리기'를 그릴지 정한다. 서버 판정과 같은 규칙을 봐야 해서
// 여기 둔다.
export function canCheckIn(mountain: Mountain): boolean {
  return mountain.trailheads.length > 0 || collectionOf(mountain) === 'local';
}
