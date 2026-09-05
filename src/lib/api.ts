import { expireSession, getSessionToken } from './auth.ts';
import type { Reading, VerifyReason } from './verify.ts';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export type SummitOutcome =
  | { status: 'ok'; distanceM: number }
  | { status: 'already_today'; distanceM: number }
  | { status: 'rejected'; reason: VerifyReason; distanceM: number }
  | { status: 'stale_reading' };

export type Stamp = { mountainId: string; verifiedAt: string };

export type MountainStats = { hikingNow: number; todayStamps: number; totalStamps: number };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init?.headers, authorization: `Bearer ${token}` },
  });
  // 만료·위조된 세션은 네트워크 문제가 아니다. 다시 로그인시킨다.
  if (response.status === 401) {
    await expireSession();
    throw new Error('api_401');
  }
  if (!response.ok) {
    throw new Error(`api_${response.status}`);
  }
  return (await response.json()) as T;
}

// 최종 판정. 클라이언트 판정은 즉시 피드백일 뿐이고 화면에 남는 결과는 이것이다.
export async function verifySummitOnServer(
  mountainId: string,
  reading: Reading,
): Promise<SummitOutcome> {
  return await call<SummitOutcome>('/verify-summit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mountainId, reading }),
  });
}

// 앱을 열 때 세션이 아직 살아 있는지 서버에 한 번 물어본다. 토스 앱에서 연결을 끊었으면
// 여기서 401이 오고, call()이 로그인 화면으로 되돌린다.
export async function checkSession(): Promise<void> {
  await call('/my-stamps');
}

export async function fetchMyStamps(): Promise<Stamp[]> {
  const { stamps } = await call<{ stamps: Stamp[] }>('/my-stamps');
  return stamps;
}

export type HikeStartOutcome =
  | { status: 'ok'; trailheadName: string }
  | { status: 'already_today'; trailheadName: string }
  | { status: 'too_far'; trailheadName: string; distanceM: number }
  | { status: 'stale_reading' };

export async function startHike(mountainId: string, reading: Reading): Promise<HikeStartOutcome> {
  return await call<HikeStartOutcome>('/start-hike', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mountainId, reading }),
  });
}

export async function fetchMountainStats(mountainId: string): Promise<MountainStats> {
  return await call<MountainStats>(`/mountain-stats?mountainId=${encodeURIComponent(mountainId)}`);
}
