import { TossAds } from '@apps-in-toss/web-framework';
import { useEffect, useRef, useState } from 'react';

// 산 상세 중간의 배너 광고. SDK가 "Ad" 표기·디자인을 그리고 우리는 자리만 준다.
// 광고가 없거나(NoFill) 실패하면 자리를 접는다 — 빈 칸을 남기지 않는다.
// 정책: 같은 화면에 같은 포맷 2개 금지, 버튼과 붙여 두지 않기(위아래 여백), 스크롤 화면에만.
const AD_BANNER_ID = (import.meta.env.VITE_AD_BANNER_ID as string | undefined) ?? '';

let initialized = false;
let initializing = false;
const waiters: (() => void)[] = [];

// SDK 초기화는 앱에서 한 번만. 여러 화면에서 불러도 두 번 초기화하지 않는다.
function whenReady(callback: () => void): void {
  if (initialized) {
    callback();
    return;
  }
  waiters.push(callback);
  if (initializing) return;
  initializing = true;
  try {
    if (!TossAds.initialize.isSupported()) return;
    TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          initialized = true;
          for (const waiter of waiters.splice(0)) waiter();
        },
        onInitializationFailed: () => {
          initializing = false;
          waiters.splice(0);
        },
      },
    });
  } catch {
    initializing = false;
  }
}

export function AdBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (AD_BANNER_ID === '') {
      setShown(false);
      return;
    }
    let attached: { destroy: () => void } | undefined;
    let cancelled = false;
    whenReady(() => {
      if (cancelled || ref.current === null) return;
      try {
        if (!TossAds.attachBanner.isSupported()) {
          setShown(false);
          return;
        }
        attached = TossAds.attachBanner(AD_BANNER_ID, ref.current, {
          theme: 'light',
          tone: 'grey',
          variant: 'card',
          callbacks: {
            onNoFill: () => setShown(false),
            onAdFailedToRender: () => setShown(false),
          },
        });
      } catch {
        setShown(false);
      }
    });
    return () => {
      cancelled = true;
      attached?.destroy();
    };
  }, []);

  if (!shown) return null;
  // 컨테이너 안은 비워 둔다(SDK가 채운다). 너비는 화면과 같아야 한다.
  return <div ref={ref} className="ad-banner" />;
}
