import assert from 'node:assert/strict';
import { test } from 'node:test';

import { durationMin, formatDuration, hikeStartFor, visitsOf } from './visits.ts';

const stamp = { mountainId: 'a', verifiedAt: '2026-09-06T03:00:00.000Z' };

test('인증 전 24시간 안의 같은 산 시작 중 가장 늦은 것을 짝짓는다', () => {
  const starts = [
    { mountainId: 'a', startedAt: '2026-09-05T02:00:00.000Z' }, // 25시간 전 — 밖
    { mountainId: 'a', startedAt: '2026-09-05T22:00:00.000Z' }, // 자정 넘긴 야간 산행
    { mountainId: 'a', startedAt: '2026-09-06T00:20:00.000Z' }, // 가장 늦음
    { mountainId: 'b', startedAt: '2026-09-06T00:30:00.000Z' }, // 다른 산
    { mountainId: 'a', startedAt: '2026-09-06T04:00:00.000Z' }, // 인증 뒤
  ];
  assert.equal(hikeStartFor(stamp, starts), '2026-09-06T00:20:00.000Z');
  assert.equal(hikeStartFor(stamp, starts.slice(0, 1)), undefined);
});

test('걸린 시간 표기', () => {
  assert.equal(durationMin('2026-09-06T00:20:00.000Z', stamp.verifiedAt), 160);
  assert.equal(formatDuration(160), '2시간 40분');
  assert.equal(formatDuration(45), '45분');
  assert.equal(formatDuration(120), '2시간');
});

test('방문 기록은 최근순이고 시작이 있을 때만 시간이 붙는다', () => {
  const visits = visitsOf(
    [
      { mountainId: 'a', verifiedAt: '2026-04-10T02:00:00.000Z' },
      { mountainId: 'b', verifiedAt: '2026-05-10T02:00:00.000Z' },
      {
        mountainId: 'a',
        verifiedAt: '2026-09-06T03:00:00.000Z',
        hikeStartedAt: '2026-09-06T00:20:00.000Z',
      },
    ],
    'a',
  );
  assert.deepEqual(
    visits.map((v) => [v.season, v.durationMin]),
    [
      ['autumn', 160],
      ['spring', undefined],
    ],
  );
});
