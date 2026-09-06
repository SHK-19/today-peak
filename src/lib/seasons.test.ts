import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Stamp } from './api.ts';
import { groupSeasons, latestSeason, seasonCount } from './seasons.ts';

function stamp(mountainId: string, verifiedAt: string): Stamp {
  return { mountainId, verifiedAt };
}

test('산별로 계절을 묶고 같은 계절은 첫 인증을 남긴다', () => {
  const grouped = groupSeasons([
    stamp('a', '2026-10-05T00:00:00Z'),
    stamp('a', '2026-09-20T00:00:00Z'),
    stamp('a', '2026-01-10T00:00:00Z'),
    stamp('b', '2026-04-01T00:00:00Z'),
  ]);
  assert.deepEqual(grouped.get('a'), { autumn: '2026-09-20T00:00:00Z', winter: '2026-01-10T00:00:00Z' });
  assert.deepEqual(grouped.get('b'), { spring: '2026-04-01T00:00:00Z' });
});

test('latestSeason은 가장 최근 계절을 준다', () => {
  const record = { autumn: '2026-09-20T00:00:00Z', winter: '2026-01-10T00:00:00Z' };
  assert.deepEqual(latestSeason(record), { season: 'autumn', verifiedAt: '2026-09-20T00:00:00Z' });
  assert.equal(latestSeason({}), undefined);
  assert.equal(seasonCount(record), 2);
});
