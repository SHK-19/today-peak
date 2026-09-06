import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  placesQueries,
  shortAddress,
  shortCategory,
  splitPlaces,
  stripTags,
  toPlaces,
} from './places.ts';

test('네이버 강조 태그와 엔티티를 걷어낸다', () => {
  assert.equal(stripTags('<b>북한산</b> 손두부&amp;막걸리'), '북한산 손두부&막걸리');
});

test('카테고리는 음식점을 빼고 한 칸만', () => {
  assert.equal(shortCategory('음식점>한식>백반,가정식'), '한식');
  assert.equal(shortCategory('카페,디저트>베이커리'), '카페,디저트');
  assert.equal(shortCategory(''), '');
});

test('주소는 구·도로명까지만', () => {
  assert.equal(shortAddress('서울특별시 강북구 삼양로181길 142 옥류헌릴렉스'), '강북구 삼양로181길');
  assert.equal(shortAddress(''), '');
});

test('toPlaces는 이름이 겹치거나 빈 항목을 버린다', () => {
  const places = toPlaces([
    { title: '<b>우이동</b> 손칼국수', category: '음식점>한식', roadAddress: '서울특별시 강북구 삼양로 100' },
    { title: '우이동 손칼국수', category: '음식점>한식', roadAddress: '서울특별시 강북구 삼양로 100' },
    { title: '', category: '음식점', roadAddress: '' },
    { title: '산장카페', category: '카페,디저트', address: '경기도 고양시 덕양구 1' },
  ]);
  assert.deepEqual(places, [
    { name: '우이동 손칼국수', category: '한식', address: '강북구 삼양로' },
    { name: '산장카페', category: '카페,디저트', address: '고양시 덕양구' },
  ]);
});

test('splitPlaces는 카테고리로 음식점·카페를 나누고 5곳까지만 담는다', () => {
  const place = (name: string, category: string) => ({ name, category, address: '' });
  const { food, cafe } = splitPlaces(
    [place('손칼국수', '한식'), place('산장카페', '카페,디저트'), place('손칼국수', '한식')],
    [place('초소책방', '카페,디저트'), place('효자베이커리', '베이커리'), place('산장카페', '카페,디저트')],
  );
  assert.deepEqual(food.map((p) => p.name), ['손칼국수']);
  assert.deepEqual(cafe.map((p) => p.name), ['산장카페', '초소책방', '효자베이커리']);
});

test('검색어는 들머리 꼬리말을 떼고, 산 이름을 폴백으로 둔다', () => {
  assert.deepEqual(placesQueries('북한산', '우이령길 사전예약 입구'), ['우이령길 맛집', '북한산 맛집']);
  assert.deepEqual(placesQueries('북한산', undefined, '카페'), ['북한산 카페']);
  assert.deepEqual(placesQueries('지리산(통영)', '화엄사자연관찰로'), [
    '화엄사자연관찰로 맛집',
    '지리산 맛집',
  ]);
  assert.deepEqual(placesQueries('북한산'), ['북한산 맛집']);
  assert.deepEqual(placesQueries('설악산', '매표소'), ['설악산 맛집']);
});
