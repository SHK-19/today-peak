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

// 권한이 없으면 다이얼로그를 띄운다. **거부 상태에서도 다시 띄운다** —
// 공식 예제가 denied에서 openPermissionDialog를 여는 방식이고, 이 권한은 미니앱 단위라
// 토스 앱 자체 위치 권한이 켜져 있어도 여기서만 거부돼 있을 수 있다.
// (2026-09-05 새 기기 실기기 확인. 사용자는 설정 어디를 봐야 할지 알 수 없는 상태가 된다.)
let pendingDialog: Promise<boolean> | null = null;

export async function ensureLocationPermission(): Promise<boolean> {
  if ((await getCurrentLocation.getPermission()) === 'allowed') {
    return true;
  }

  // 버튼을 연타하면 다이얼로그가 이미 떠 있는 상태에서 또 호출돼 denied가 돌아온다
  // (2026-09-05 실기기: 허용돼 있는데도 "위치 권한이 필요해요"가 떴다).
  // 요청은 하나만 보내고, 결과도 dialog 답이 아니라 실제 권한 상태로 확정한다.
  pendingDialog ??= (async () => {
    try {
      if ((await getCurrentLocation.openPermissionDialog()) === 'allowed') {
        return true;
      }
      return (await getCurrentLocation.getPermission()) === 'allowed';
    } finally {
      pendingDialog = null;
    }
  })();

  return await pendingDialog;
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

// 산행 시작 체크인용. 반경이 500m라 반복 읽기는 하지 않는다.
// 다만 서버가 30초 만료를 검사하므로 캐시가 덜 끼도록 Highest로 읽는다.
export async function readLocationForCheckIn(): Promise<Reading> {
  return await getCurrentLocation({ accuracy: Accuracy.Highest });
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
