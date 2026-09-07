import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAP_H, MAP_W, formatKm, formatMinutes, groupPois, mapFrame } from './courses.ts';

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

test('트랙이 지도 안에 들어가는 줌을 고르고 가운데에 놓는다', () => {
  const frame = mapFrame([
    [37.6589, 126.9779],
    [37.655, 126.95],
    [37.662, 126.99],
  ]);
  assert.ok(frame !== null);
  for (const [x, y] of frame!.points) {
    assert.ok(x >= 0 && x <= MAP_W && y >= 0 && y <= MAP_H, `${x},${y}`);
  }
  assert.equal(mapFrame([[37, 127]]), null);
});
