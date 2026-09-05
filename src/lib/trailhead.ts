import { haversineMeters } from './geo.ts';

import type { Mountain, Reading, Trailhead } from './verify.ts';

// 실측 후 조정한다. 정상 반경과 달리 넉넉하게 잡는다 — 등산로 입구는 넓고
// 주차장·매표소 등 여러 지점이 입구로 통한다.
export const START_RADIUS_M = 500;

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
