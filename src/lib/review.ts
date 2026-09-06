import { requestReview } from '@apps-in-toss/web-framework';

// 리뷰 요청. 실제 노출 여부는 플랫폼이 정하고, 결과에 따라 앱 흐름을 바꾸지 않는다.
export function canReview(): boolean {
  try {
    return requestReview.isSupported();
  } catch {
    return false;
  }
}

export function askReview(): void {
  if (!canReview()) return;
  void requestReview().catch(() => {});
}

// 인증 성공 직후 자동 호출용. 한 세션에 한 번만.
let asked = false;
export function askReviewOnce(): void {
  if (asked) return;
  asked = true;
  askReview();
}
