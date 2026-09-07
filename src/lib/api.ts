import type { Facilities } from './facilities.ts';
import type { NearbyPlaces } from './places.ts';
import { expireSession, getSessionToken } from './auth.ts';
import type { Reading, VerifyReason } from './verify.ts';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export type SummitOutcome =
  // hikeStartedAt: 같은 산에서 24시간 안에 누른 산행 시작. 있으면 티켓에 걸린 시간을 적는다.
  | { status: 'ok'; distanceM: number; hikeStartedAt?: string }
  | { status: 'already_today'; distanceM: number }
  | { status: 'rejected'; reason: VerifyReason; distanceM: number }
  | { status: 'stale_reading' };

export type Stamp = { mountainId: string; verifiedAt: string; hikeStartedAt?: string };

// 인증이 반경 밖으로 실패했을 때, 이용자가 "여기도 정상"이라고 알려주는 통로.
// 스탬프를 주지 않는다 — 우리가 정상 좌표를 고칠지 판단하는 근거로만 쓴다.
export async function suggestPeak(
  mountainId: string,
  reading: Reading,
  peakName: string,
): Promise<void> {
  await call('/verify-summit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mountainId, reading, suggestPeakName: peakName }),
  });
}

export type MountainStats = {
  hikingNow: number;
  todayStamps: number;
  totalStamps: number;
  /** 산 근처 음식점·카페. 네이버 검색이 실패하면 양쪽 다 빈 배열. */
  places?: NearbyPlaces;
  /** 주차장·화장실·대피소·약수터 이름. 100대 명산만 있다. */
  facilities?: Facilities;
};

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
