import { setClipboardText } from '@apps-in-toss/web-framework';

// 문자열 복사. 토스 SDK(권한 팝업 포함)를 먼저 쓰고, 개발 브라우저처럼 SDK가 없으면 navigator로.
// 실패해도 false만 돌려주고 화면은 조용히 넘어간다 — 복사가 안 된다고 앱이 멈추면 안 된다.
export async function copyText(text: string): Promise<boolean> {
  try {
    if ((await setClipboardText.getPermission()) !== 'allowed') {
      if ((await setClipboardText.openPermissionDialog()) !== 'allowed') return false;
    }
    await setClipboardText(text);
    return true;
  } catch {
    // SDK가 없는 브라우저(개발) 또는 실패 → 아래 navigator로 한 번 더
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
