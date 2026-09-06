import assert from 'node:assert/strict';
import { test } from 'node:test';

import { byCategory, pickCategories, picksForMountain, type Pick } from './picks.ts';

const item = (id: string, category: Pick['category'], extra: Partial<Pick> = {}): Pick => ({
  id,
  name: id,
  category,
  link: `https://toss.im/_m/${id}`,
  ...extra,
});

const items: Pick[] = [
  item('스틱', '장비'),
  item('아이젠', '안전', { seasons: ['winter'], minElevationM: 1000 }),
  item('반팔', '의류', { seasons: ['summer'] }),
  item('에너지바', '음식'),
];

test('카테고리로 거르고, 데이터에 있는 카테고리만 준다', () => {
  assert.deepEqual(byCategory(items, '의류').map((i) => i.id), ['반팔']);
  assert.equal(byCategory(items, null).length, 4);
  assert.deepEqual(pickCategories(items), ['장비', '의류', '음식', '안전']);
  assert.deepEqual(pickCategories([item('스틱', '장비')]), ['장비']);
});

test('산 상세 추천은 계절·고도가 맞는 것을 앞에 두고 모자라면 채운다', () => {
  const winter = picksForMountain(items, { season: 'winter', elevationM: 1500 });
  assert.equal(winter[0].id, '아이젠');
  assert.equal(winter.length, 3);

  const summer = picksForMountain(items, { season: 'summer', elevationM: 300 });
  assert.equal(summer[0].id, '반팔');
});

test('목록이 비면 빈 배열', () => {
  assert.deepEqual(picksForMountain([], { season: 'spring', elevationM: 800 }), []);
  assert.deepEqual(pickCategories([]), []);
});
