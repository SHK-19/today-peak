import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Mountain, Reading } from './verify.ts';
import {
  MAX_READING_AGE_MS,
  isReadingFresh,
  readingAgeMs,
  pickBestReading,
  verifySummit,
} from './verify.ts';

const MOUNTAIN: Mountain = {
  id: 'test',
  name: '테스트산',
  summitLat: 37.6589,
  summitLng: 126.9779,
  elevationM: 836,
  trailheads: [],
};

// 위도 1° ≈ 111,195m 이므로 0.0008° ≈ 89m, 0.0010° ≈ 111m.
function reading(
  latOffset: number,
  accuracy: number,
  altitude: number | null = null,
  altitudeAccuracy: number | null = null,
): Reading {
  return {
    timestamp: 1_788_530_863.7, // 초 단위 (SDK가 주는 형태)
    coords: {
      latitude: MOUNTAIN.summitLat + latOffset,
      longitude: MOUNTAIN.summitLng,
      accuracy,
      altitude,
      altitudeAccuracy,
    },
  };
}

test('정확도 낮음', () => {
  const result = verifySummit(reading(0, 60), MOUNTAIN);
  assert.deepEqual({ ok: result.ok, reason: result.reason }, { ok: false, reason: 'low_accuracy' });
});

test('반경 안', () => {
  const result = verifySummit(reading(0, 20), MOUNTAIN);
  assert.deepEqual({ ok: result.ok, reason: result.reason }, { ok: true, reason: 'ok' });
});

test('반경 밖', () => {
  const result = verifySummit(reading(0.005, 20), MOUNTAIN);
  assert.equal(result.reason, 'too_far');
  assert.ok(result.distanceM > 500, `${Math.round(result.distanceM)}m`);
});

test('경계: accuracy 50은 통과, 50.1은 실패', () => {
  assert.equal(verifySummit(reading(0, 50), MOUNTAIN).reason, 'ok');
  assert.equal(verifySummit(reading(0, 50.1), MOUNTAIN).reason, 'low_accuracy');
});

test('경계: 89m는 반경 안, 111m는 반경 밖', () => {
  assert.equal(verifySummit(reading(0.0008, 20), MOUNTAIN).reason, 'ok');
  assert.equal(verifySummit(reading(0.001, 20), MOUNTAIN).reason, 'too_far');
});

test('고도 불일치', () => {
  const result = verifySummit(reading(0, 20, 400, 10), MOUNTAIN);
  assert.deepEqual(
    { ok: result.ok, reason: result.reason },
    { ok: false, reason: 'altitude_mismatch' },
  );
});

test('altitudeAccuracy가 나쁘거나 없으면 고도를 무시한다', () => {
  assert.equal(verifySummit(reading(0, 20, 400, 80), MOUNTAIN).reason, 'ok');
  assert.equal(verifySummit(reading(0, 20, 400, null), MOUNTAIN).reason, 'ok');
});

test('altitude가 없으면 고도 게이트를 건너뛴다', () => {
  assert.equal(verifySummit(reading(0, 20, null, 10), MOUNTAIN).reason, 'ok');
});

test('pickBestReading은 accuracy가 가장 좋은 읽기를 고른다', () => {
  const best = pickBestReading([reading(0, 40), reading(0, 12), reading(0, 25)]);
  assert.equal(best?.coords.accuracy, 12);
  assert.equal(pickBestReading([]), null);
});

test('readingAgeMs: timestamp를 초로 보고 밀리초 나이를 낸다', () => {
  const r = reading(0, 20);
  const tsMs = r.timestamp * 1000;
  assert.equal(readingAgeMs(r, tsMs), 0);
  assert.equal(readingAgeMs(r, tsMs + 1500), 1500);
});

test('isReadingFresh: 경계에서 신선/만료가 갈린다', () => {
  const r = reading(0, 20);
  const tsMs = r.timestamp * 1000;
  assert.equal(isReadingFresh(r, tsMs), true);
  assert.equal(isReadingFresh(r, tsMs + MAX_READING_AGE_MS), true);
  assert.equal(isReadingFresh(r, tsMs + MAX_READING_AGE_MS + 1), false);
});
