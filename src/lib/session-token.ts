// 우리가 직접 서명하는 세션 토큰. 토스 access/refresh token은 클라이언트에 주지 않고,
// 서버가 확인한 userKey만 이 토큰에 담아 내려준다.
//
// 형식: base64url(payload).base64url(HMAC-SHA256(payload))
//   payload = { userKey, exp }  — exp는 초 단위 UNIX 시각
//
// sign/verify는 Edge Function에서만 쓴다(서명키가 필요하다).
// 클라이언트는 서명키가 없으므로 readSessionExpiry로 만료만 본다.

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type SessionPayload = { userKey: number; exp: number };

export type VerifyOutcome =
  | { ok: true; userKey: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSessionToken(
  userKey: number,
  secret: string,
  nowMs: number,
): Promise<string> {
  const payload: SessionPayload = {
    userKey,
    exp: Math.floor((nowMs + SESSION_TTL_MS) / 1000),
  };
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(encodedPayload),
  );
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

// 서명을 먼저 보고 만료를 나중에 본다. 서명이 깨진 토큰의 exp는 믿을 값이 아니다.
export async function verifySessionToken(
  token: string,
  secret: string,
  nowMs: number,
): Promise<VerifyOutcome> {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, reason: 'malformed' };
  }
  const [encodedPayload, encodedSignature] = parts;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!valid) {
    return { ok: false, reason: 'bad_signature' };
  }

  const payload = decodePayload(encodedPayload);
  if (payload === null) {
    return { ok: false, reason: 'malformed' };
  }
  if (payload.exp * 1000 <= nowMs) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, userKey: payload.userKey };
}

function decodePayload(encodedPayload: string): SessionPayload | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as SessionPayload).userKey !== 'number' ||
      typeof (parsed as SessionPayload).exp !== 'number'
    ) {
      return null;
    }
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

// 클라이언트용. 서명은 확인하지 않는다 — 저장해둔 토큰을 서버에 보내볼 가치가 있는지만 본다.
// 최종 판단은 언제나 서버의 verifySessionToken이다.
export function readSessionExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const payload = decodePayload(parts[0]);
  return payload === null ? null : payload.exp * 1000;
}
