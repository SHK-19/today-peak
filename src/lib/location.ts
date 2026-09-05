import { Accuracy, getCurrentLocation } from '@apps-in-toss/web-framework';

import {
  MAX_HORIZONTAL_ACCURACY_M,
  MAX_READS,
  READ_INTERVAL_MS,
  isReadingFresh,
  pickBestReading,
  type Reading,
} from './verify.ts';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PermissionOutcome = { allowed: boolean; status: string };

// 권한이 없으면 다이얼로그를 띄운다. 거부 상태면 다이얼로그를 다시 띄우지 않는다.
// status는 세션 2 진단용으로 화면에 그대로 찍는다.
export async function ensureLocationPermission(): Promise<PermissionOutcome> {
  const status = await getCurrentLocation.getPermission();
  if (status === 'allowed') {
    return { allowed: true, status };
  }
  if (status === 'notDetermined') {
    const next = await getCurrentLocation.openPermissionDialog();
    return { allowed: next === 'allowed', status: `notDetermined→${next}` };
  }
  return { allowed: false, status };
}

// 홈 목록 정렬용. 거리순만 필요해서 정확도를 낮게 잡는다.
export async function readLocationOnce(): Promise<Reading> {
  return await getCurrentLocation({ accuracy: Accuracy.Balanced });
}

// 산 상세 화면에 들어간 순간 미리 한 번 읽어둔다. 사용자가 화면을 보고 버튼을
// 찾는 동안 GPS가 먼저 돌기 시작한다. 실패해도 조용히 넘어간다 —
// 버튼을 누를 때 어차피 다시 읽는다.
export async function prefetchLocation(): Promise<Reading | null> {
  try {
    return await getCurrentLocation({ accuracy: Accuracy.Highest });
  } catch {
    return null;
  }
}

// 정상 인증용. 최대 MAX_READS회 읽고 accuracy가 가장 좋은 것을 채택한다.
// 정확도가 이미 기준을 넘으면 남은 회차를 기다리지 않는다.
export async function readBestLocation(
  onAttempt: (attempt: number) => void,
  prefetched: Reading | null,
): Promise<Reading> {
  // 빠른 경로: 미리 읽어둔 값이 아직 신선하고 정확도도 기준을 넘으면 그대로 쓴다.
  if (
    prefetched != null &&
    isReadingFresh(prefetched, Date.now()) &&
    prefetched.coords.accuracy <= MAX_HORIZONTAL_ACCURACY_M
  ) {
    return prefetched;
  }

  const readings: Reading[] = [];

  for (let attempt = 1; attempt <= MAX_READS; attempt += 1) {
    if (attempt > 1) {
      await delay(READ_INTERVAL_MS);
    }
    onAttempt(attempt);

    const location = await getCurrentLocation({ accuracy: Accuracy.Highest });
    readings.push(location);

    if (location.coords.accuracy <= MAX_HORIZONTAL_ACCURACY_M) {
      break;
    }
  }

  return pickBestReading(readings)!;
}
