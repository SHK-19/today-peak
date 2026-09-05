import assert from 'node:assert/strict';
import { test } from 'node:test';

import { START_RADIUS_M, nearestTrailhead } from './trailhead.ts';
import type { Mountain, Reading } from './verify.ts';

const BASE_LAT = 37.6589;
const BASE_LNG = 126.9779;

function mountainWith(trailheads: Mountain['trailheads']): Mountain {
  return {
    id: 'test',
    name: '테스트산',
    summitLat: BASE_LAT,
    summitLng: BASE_LNG,
    elevationM: 836,
    trailheads,
  };
}

// 위도 1° ≈ 111,195m. 0.001° ≈ 111m, 0.005° ≈ 556m.
function readingAt(latOffset: number): Reading {
  return {
    timestamp: 1_788_530_863.7,
    coords: {
      latitude: BASE_LAT + latOffset,
      longitude: BASE_LNG,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
    },
  };
}

test('trailheads가 비어 있으면 null', () => {
  assert.equal(nearestTrailhead(readingAt(0), mountainWith([])), null);
});

test('여러 입구 중 가장 가까운 것을 고른다', () => {
  const mountain = mountainWith([
    { name: '먼 입구', lat: BASE_LAT + 0.01, lng: BASE_LNG },
    { name: '가까운 입구', lat: BASE_LAT + 0.001, lng: BASE_LNG },
    { name: '중간 입구', lat: BASE_LAT + 0.004, lng: BASE_LNG },
  ]);
  const result = nearestTrailhead(readingAt(0), mountain);
  assert.equal(result?.trailhead.name, '가까운 입구');
  assert.ok(Math.abs(result!.distanceM - 111) < 2, `${result!.distanceM}m`);
});

test('입구가 하나면 그것을 돌려준다', () => {
  const mountain = mountainWith([{ name: '유일한 입구', lat: BASE_LAT + 0.001, lng: BASE_LNG }]);
  assert.equal(nearestTrailhead(readingAt(0), mountain)?.trailhead.name, '유일한 입구');
});

test('경계: 445m는 반경 안, 556m는 반경 밖', () => {
  const mountain = mountainWith([{ name: '입구', lat: BASE_LAT, lng: BASE_LNG }]);
  const inside = nearestTrailhead(readingAt(0.004), mountain);
  const outside = nearestTrailhead(readingAt(0.005), mountain);
  assert.ok(inside!.distanceM <= START_RADIUS_M, `${inside!.distanceM}m`);
  assert.ok(outside!.distanceM > START_RADIUS_M, `${outside!.distanceM}m`);
});
