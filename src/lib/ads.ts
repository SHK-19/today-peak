import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

// 전면 광고. 인증 성공 화면에서 미리 불러두고, "내 스탬프"로 넘어갈 때 한 번 보여준다.
// 인증 버튼 앞에는 절대 두지 않는다 — 정상에서 신호가 약한데 광고가 인증을 막으면 안 되고,
// 광고를 봐야 스탬프를 주는 구조는 정책 위반이다. 광고가 실패하면 그냥 넘어간다.
// 콘솔 광고 그룹 ID. 테스트는 반드시 테스트용 ID로(운영 ID로 테스트하면 제재) — 그래서 env로 갈라 넣는다.
// 비어 있으면 광고를 아예 부르지 않는다.
const AD_GROUP_ID = (import.meta.env.VITE_AD_GROUP_ID as string | undefined) ?? '';

let loaded = false;
let cleanupLoad: (() => void) | null = null;

export function preloadInterstitial(): void {
  try {
    if (AD_GROUP_ID === '' || loaded || cleanupLoad !== null || !loadFullScreenAd.isSupported()) return;
    cleanupLoad = loadFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          loaded = true;
          cleanupLoad?.();
          cleanupLoad = null;
        }
      },
      onError: () => {
        cleanupLoad?.();
        cleanupLoad = null;
      },
    });
  } catch {
    cleanupLoad = null;
  }
}

// 광고가 닫히면(또는 못 보여주면) 끝난다. 준비된 광고가 없으면 바로 끝난다.
export function showInterstitial(): Promise<void> {
  if (!loaded) return Promise.resolve();
  loaded = false;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    try {
      if (!showFullScreenAd.isSupported()) {
        finish();
        return;
      }
      const cleanup = showFullScreenAd({
        options: { adGroupId: AD_GROUP_ID },
        onEvent: (event) => {
          if (event.type === 'dismissed' || event.type === 'failedToShow') {
            cleanup();
            finish();
          }
        },
        onError: () => {
          cleanup();
          finish();
        },
      });
      // 이벤트가 영영 안 오면 화면이 멈춘다. 안전장치.
      setTimeout(finish, 60_000);
    } catch {
      finish();
    }
  });
}
