import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatSeoulDate, seoulDayStartMs } from './day.ts';

test('한국 시간 자정을 기준으로 하루가 갈린다', () => {
  // 2026-09-05 00:30 KST = 2026-09-04 15:30 UTC
  const earlyMorning = Date.parse('2026-09-04T15:30:00Z');
  assert.equal(new Date(seoulDayStartMs(earlyMorning)).toISOString(), '2026-09-04T15:00:00.000Z');

  // 같은 날 23:30 KST도 같은 날의 시작을 가리킨다.
  const lateNight = Date.parse('2026-09-05T14:30:00Z');
  assert.equal(new Date(seoulDayStartMs(lateNight)).toISOString(), '2026-09-04T15:00:00.000Z');

  // 자정을 넘기면(00:00 KST = 15:00 UTC) 다음 날로 넘어간다.
  const nextDay = Date.parse('2026-09-05T15:00:00Z');
  assert.equal(new Date(seoulDayStartMs(nextDay)).toISOString(), '2026-09-05T15:00:00.000Z');
});

test('날짜 표기는 한국 시간으로 찍힌다', () => {
  // UTC로는 9월 4일이지만 한국은 이미 9월 5일이다.
  assert.equal(formatSeoulDate('2026-09-04T15:30:00Z'), '2026.09.05');
  assert.equal(formatSeoulDate('2026-01-01T00:00:00Z'), '2026.01.01');
});
