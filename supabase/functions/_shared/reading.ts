import type { Reading } from '../../../src/lib/verify.ts';

// 클라이언트가 보낸 값이므로 형태부터 확인한다.
export function parseReading(value: unknown): Reading | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { timestamp, coords } = value as { timestamp?: unknown; coords?: unknown };
  if (typeof timestamp !== 'number' || typeof coords !== 'object' || coords === null) {
    return null;
  }
  const { latitude, longitude, accuracy, altitude, altitudeAccuracy } = coords as Record<
    string,
    unknown
  >;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof accuracy !== 'number'
  ) {
    return null;
  }
  return {
    timestamp,
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: typeof altitude === 'number' ? altitude : null,
      altitudeAccuracy: typeof altitudeAccuracy === 'number' ? altitudeAccuracy : null,
    },
  };
}
