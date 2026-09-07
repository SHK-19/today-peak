import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatKm, formatMinutes, groupPois } from './courses.ts';

test('시간·거리 표기', () => {
  assert.equal(formatMinutes(221), '3시간 41분');
  assert.equal(formatMinutes(120), '2시간');
  assert.equal(formatMinutes(45), '45분');
  assert.equal(formatKm(9210), '9.2km');
  assert.equal(formatKm(850), '850m');
});

test('지점을 교통·주차·편의·볼거리·주의로 묶고 빈 묶음은 뺀다', () => {
  const groups = groupPois([
    { kind: 'TRANS', name: '버스정류장', lat: 0, lng: 0 },
    { kind: 'TOILET', name: '화장실', lat: 0, lng: 0 },
    { kind: 'TOILET', name: '화장실', lat: 0, lng: 0 },
    { kind: 'DANGER', name: '낙석주의', lat: 0, lng: 0 },
    { kind: 'SIGN', name: '이정표', lat: 0, lng: 0 },
  ]);
  assert.deepEqual(groups, [
    { label: '교통', names: ['버스정류장'] },
    { label: '편의', names: ['화장실'] },
    { label: '주의', names: ['낙석주의'] },
  ]);
});
