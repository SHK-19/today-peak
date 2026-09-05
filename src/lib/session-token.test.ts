import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SESSION_TTL_MS,
  readSessionExpiry,
  signSessionToken,
  verifySessionToken,
} from './session-token.ts';

const SECRET = 'test-signing-secret';
const NOW = 1_788_530_000_000;
const USER_KEY = 443731104;

test('서명한 토큰은 같은 키로 검증되고 userKey가 그대로 나온다', async () => {
  const token = await signSessionToken(USER_KEY, SECRET, NOW);
  assert.deepEqual(await verifySessionToken(token, SECRET, NOW), {
    ok: true,
    userKey: USER_KEY,
  });
});

test('다른 서명키로 만든 토큰은 거부한다', async () => {
  const token = await signSessionToken(USER_KEY, 'attacker-secret', NOW);
  assert.deepEqual(await verifySessionToken(token, SECRET, NOW), {
    ok: false,
    reason: 'bad_signature',
  });
});

test('payload의 userKey를 바꿔치기하면 서명이 깨진다', async () => {
  const token = await signSessionToken(USER_KEY, SECRET, NOW);
  const forgedPayload = btoa(JSON.stringify({ userKey: 999, exp: 99_999_999_999 }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const forged = `${forgedPayload}.${token.split('.')[1]}`;

  assert.deepEqual(await verifySessionToken(forged, SECRET, NOW), {
    ok: false,
    reason: 'bad_signature',
  });
});

test('14일이 지나면 만료된다 (경계 포함)', async () => {
  const token = await signSessionToken(USER_KEY, SECRET, NOW);

  const justBefore = NOW + SESSION_TTL_MS - 1000;
  assert.equal((await verifySessionToken(token, SECRET, justBefore)).ok, true);

  const justAfter = NOW + SESSION_TTL_MS + 1000;
  assert.deepEqual(await verifySessionToken(token, SECRET, justAfter), {
    ok: false,
    reason: 'expired',
  });
});

test('형식이 깨진 토큰은 malformed로 거부한다', async () => {
  for (const broken of ['', 'not-a-token', 'a.b.c', '.', 'eyJ.###']) {
    const outcome = await verifySessionToken(broken, SECRET, NOW);
    assert.equal(outcome.ok, false, `${broken}이 통과했다`);
  }
});

test('readSessionExpiry는 서명 없이 만료 시각만 읽는다', async () => {
  const token = await signSessionToken(USER_KEY, SECRET, NOW);
  const expiry = readSessionExpiry(token);

  assert.notEqual(expiry, null);
  // exp는 초 단위로 내림되므로 1초 오차를 허용한다.
  assert.ok(Math.abs(expiry! - (NOW + SESSION_TTL_MS)) < 1000);
  assert.equal(readSessionExpiry('not-a-token'), null);
});
