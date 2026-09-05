import { Storage, TossAuth } from '@apps-in-toss/web-framework';

import { readSessionExpiry } from './session-token.ts';

// 세션 토큰만 보관한다. 토스 access/refresh token은 서버 밖으로 나오지 않는다.
const STORAGE_KEY = 'today-peak.session';
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

let sessionToken: string | null = null;
let onSessionLost: (() => void) | null = null;

// 세션이 만료되거나 거절됐을 때 화면을 로그인으로 되돌리기 위한 통로.
export function setSessionLostHandler(handler: () => void): void {
  onSessionLost = handler;
}

// 서버가 401을 준 경우. 토큰을 버리고 로그인 화면으로 보낸다.
export async function expireSession(): Promise<void> {
  await clearSession();
  onSessionLost?.();
}

export function getSessionToken(): string | null {
  return sessionToken;
}

// 앱을 다시 열었을 때 저장된 토큰을 메모리로 올린다.
// 만료됐거나 토스 앱에서 로그인 연결을 끊었으면 지우고 null을 준다.
export async function restoreSession(): Promise<string | null> {
  const stored = await Storage.getItem(STORAGE_KEY);
  if (stored === null) {
    return null;
  }

  const expiry = readSessionExpiry(stored);
  if (expiry === null || expiry <= Date.now()) {
    await clearSession();
    return null;
  }

  // 연결을 끊은 사용자에게는 약관 화면부터 다시 보여줘야 한다(출시 가이드 토스 로그인 항목).
  // 구버전 토스 앱은 undefined를 주는데, 그때는 판단하지 않고 그대로 쓴다.
  if ((await TossAuth.isIntegrated()) === false) {
    await clearSession();
    return null;
  }

  sessionToken = stored;
  return stored;
}

export async function login(): Promise<string> {
  const { authorizationCode, referrer } = await TossAuth.login();

  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer }),
  });
  if (!response.ok) {
    throw new Error(`login_failed_${response.status}`);
  }

  const { token } = (await response.json()) as { token: string };
  sessionToken = token;
  await Storage.setItem(STORAGE_KEY, token);
  return token;
}

export async function clearSession(): Promise<void> {
  sessionToken = null;
  await Storage.removeItem(STORAGE_KEY);
}
