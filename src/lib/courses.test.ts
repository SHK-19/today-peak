import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAP_H, MAP_W, formatKm, formatMinutes, groupPois, mapFrame, startCopyText } from './courses.ts';

test('시간·거리 표기', () => {
  assert.equal(formatMinutes(221), '3시간 41분');
  assert.equal(formatMinutes(120), '2시간');
  assert.equal(formatMinutes(45), '45분');
  assert.equal(formatKm(9210), '9.2km');
  assert.equal(formatKm(850), '850m');
});

test('지점을 교통·주차·편의·볼거리·주의로 묶고 빈 묶음은 뺀다', () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ kind: 'TOILET', name: `화장실 ${i}`, lat: 0, lng: 0 }));
  const capped = groupPois(many)[0];
  assert.equal(capped.names.length, 8);
  assert.equal(capped.more, 3);
  assert.equal(groupPois([{ kind: 'INFO', name: '안내판', lat: 0, lng: 0 }]).length, 0);
  const groups = groupPois([
    { kind: 'TRANS', name: '버스정류장', lat: 0, lng: 0 },
    { kind: 'TOILET', name: '화장실', lat: 0, lng: 0 },
    { kind: 'TOILET', name: '화장실', lat: 0, lng: 0 },
    { kind: 'DANGER', name: '낙석주의', lat: 0, lng: 0 },
    { kind: 'SIGN', name: '이정표', lat: 0, lng: 0 },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.label, g.names]),
    [
      ['교통', ['버스정류장']],
      ['편의', ['화장실']],
      ['주의', ['낙석주의']],
    ],
  );
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

test('들머리 복사 문자열은 주소 우선, 없으면 좌표', () => {
  assert.equal(startCopyText({ startAddress: '경기 고양시 덕양구 북한동 1', startLat: 37.65, startLng: 126.95 }), '경기 고양시 덕양구 북한동 1');
  assert.equal(startCopyText({ startAddress: null, startLat: 37.65, startLng: 126.95 }), '37.65, 126.95');
  assert.equal(startCopyText({ startAddress: null, startLat: null, startLng: null }), null);
});
