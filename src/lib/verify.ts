import { haversineMeters } from './geo.ts';

// 실측 후 조정한다.
export const MAX_HORIZONTAL_ACCURACY_M = 50;
export const SUMMIT_RADIUS_M = 100;
export const ALTITUDE_TOLERANCE_M = 200;
export const MAX_ALTITUDE_ACCURACY_M = 50;
export const MAX_READS = 3;
export const READ_INTERVAL_MS = 5000;
// 미리 읽어둔 위치를 재사용할 수 있는 최대 나이. 스탬프는 "지금 여기"의 증명이라
// 오래된 읽기는 쓰지 않는다. 서버(세션 3b)도 같은 값으로 검사한다.
export const MAX_READING_AGE_MS = 30_000;

export type Reading = {
  // 초 단위다 (소수점 포함). 공식 문서와 SDK 타입 선언에 단위가 없어
  // 실기기로 확인했다 — 2026-09-04, 값 1788530863.7258692.
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
  };
};

export type Trailhead = { name: string; lat: number; lng: number };

export type Mountain = {
  id: string;
  name: string;
  summitLat: number;
  summitLng: number;
  elevationM: number;
  trailheads: Trailhead[];
};

export type VerifyReason = 'ok' | 'low_accuracy' | 'too_far' | 'altitude_mismatch';

export type VerifyResult = {
  ok: boolean;
  reason: VerifyReason;
  distanceM: number;
};

export function readingAgeMs(reading: Reading, nowMs: number): number {
  return nowMs - reading.timestamp * 1000;
}

export function isReadingFresh(reading: Reading, nowMs: number): boolean {
  return readingAgeMs(reading, nowMs) <= MAX_READING_AGE_MS;
}

// accuracy가 가장 좋은(작은) 읽기를 고른다. 빈 배열이면 null.
export function pickBestReading(readings: Reading[]): Reading | null {
  let best: Reading | null = null;
  for (const reading of readings) {
    if (best === null || reading.coords.accuracy < best.coords.accuracy) {
      best = reading;
    }
  }
  return best;
}

export function verifySummit(reading: Reading, mountain: Mountain): VerifyResult {
  const { latitude, longitude, accuracy, altitude, altitudeAccuracy } = reading.coords;
  const distanceM = haversineMeters(latitude, longitude, mountain.summitLat, mountain.summitLng);

  if (accuracy > MAX_HORIZONTAL_ACCURACY_M) {
    return { ok: false, reason: 'low_accuracy', distanceM };
  }
  if (distanceM > SUMMIT_RADIUS_M) {
    return { ok: false, reason: 'too_far', distanceM };
  }
  if (
    altitude != null &&
    altitudeAccuracy != null &&
    altitudeAccuracy <= MAX_ALTITUDE_ACCURACY_M &&
    Math.abs(altitude - mountain.elevationM) > ALTITUDE_TOLERANCE_M
  ) {
    return { ok: false, reason: 'altitude_mismatch', distanceM };
  }
  return { ok: true, reason: 'ok', distanceM };
}
