import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HOME_ENTRY, parseEntry } from './entry.ts';

test('스킴이 없거나 쿼리가 없으면 홈', () => {
  assert.deepEqual(parseEntry(undefined), HOME_ENTRY);
  assert.deepEqual(parseEntry(''), HOME_ENTRY);
  assert.deepEqual(parseEntry('intoss://today-peak'), HOME_ENTRY);
});

test('탭·산·인증 파라미터를 읽는다', () => {
  assert.equal(parseEntry('intoss://today-peak?tab=stamps').tab, 'stamps');
  assert.equal(parseEntry('intoss://today-peak?mountain=0000000047').mountainId, '0000000047');
  assert.equal(parseEntry('intoss://today-peak?verify=1').verifyNearest, true);
});

test('모르는 값은 홈으로 떨어진다', () => {
  const entry = parseEntry('intoss://today-peak?tab=whatever&mountain=&verify=yes#x');
  assert.deepEqual(entry, HOME_ENTRY);
});
