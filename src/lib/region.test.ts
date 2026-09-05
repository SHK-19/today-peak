import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OTHER_REGION, groupByRegion, regionsOf } from './region.ts';
import type { Mountain } from './verify.ts';

function mountain(name: string, region: string | null): Mountain {
  return {
    id: name,
    name,
    summitLat: 37,
    summitLng: 127,
    elevationM: 500,
    trailheads: [],
    region,
  };
}

test('정해진 권역 순서대로 묶는다', () => {
  const groups = groupByRegion([
    mountain('한라산', '제주'),
    mountain('북한산', '수도권'),
    mountain('설악산', '강원'),
    mountain('도봉산', '수도권'),
  ]);

  assert.deepEqual(
    groups.map((group) => [group.region, group.mountains.length]),
    [
      ['수도권', 2],
      ['강원', 1],
      ['제주', 1],
    ],
  );
});

test('region이 없는 산은 기타로 맨 뒤에 모인다', () => {
  const groups = groupByRegion([mountain('[테스트] 집', null), mountain('북한산', '수도권')]);

  assert.deepEqual(groups.map((group) => group.region), ['수도권', OTHER_REGION]);
});

test('순서에 없는 권역이 생겨도 산이 사라지지 않는다', () => {
  const groups = groupByRegion([mountain('백두산', '북한'), mountain('북한산', '수도권')]);

  assert.deepEqual(groups.map((group) => group.region), ['수도권', '북한']);
  assert.equal(groups.flatMap((group) => group.mountains).length, 2);
});

test('regionsOf는 데이터에 있는 권역만 순서대로 준다', () => {
  assert.deepEqual(regionsOf([mountain('한라산', '제주'), mountain('북한산', '수도권')]), [
    '수도권',
    '제주',
  ]);
});
