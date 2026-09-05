import assert from 'node:assert/strict';
import { test } from 'node:test';

import { haversineMeters } from './geo.ts';

test('서울시청 ↔ 부산시청 ≈ 325km', () => {
  const distance = haversineMeters(37.5663, 126.9779, 35.1798, 129.075);
  assert.ok(Math.abs(distance - 325_000) < 5_000, `${Math.round(distance)}m`);
});

test('같은 좌표는 0m', () => {
  assert.equal(haversineMeters(37.5663, 126.9779, 37.5663, 126.9779), 0);
});
