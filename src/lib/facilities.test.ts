import assert from 'node:assert/strict';
import { test } from 'node:test';

import { facilityCount, summarizeNames } from './facilities.ts';

test('종류별 합계', () => {
  assert.equal(facilityCount({ parking: ['a', 'b'], spring: ['c'] }), 3);
  assert.equal(facilityCount({}), 0);
});

test('이름 요약 — 종류와 같은 이름은 빼고 세되 개수에는 넣는다', () => {
  assert.equal(summarizeNames(['북한산성주차장', '우이동주차장'], '주차장'), '북한산성주차장, 우이동주차장');
  assert.equal(summarizeNames(['주차장', '주차장', '일주문주차장'], '주차장'), '일주문주차장 외 2곳');
  assert.equal(summarizeNames(['화장실', '화장실'], '화장실'), '2곳');
  assert.equal(summarizeNames(['a', 'b', 'c', 'd', 'e'], '약수터'), 'a, b, c 외 2곳');
});
