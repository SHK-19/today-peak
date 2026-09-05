import { graniteEvent } from '@apps-in-toss/web-framework';
import { useEffect, useRef } from 'react';

// 토스 네비게이션 바의 뒤로가기를 가로챈다. 구독하면 기본 동작(미니앱 종료)이
// 차단되므로, 최초 화면에서는 구독하지 않아야 한다 — 비게임 출시 가이드가
// "최초 화면에서 뒤로가기를 누르면 미니앱이 종료돼요"를 요구한다.
export function useSystemBack(enabled: boolean, handler: () => void): void {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return graniteEvent.addEventListener('backEvent', {
      onEvent: () => latest.current(),
    });
  }, [enabled]);
}
