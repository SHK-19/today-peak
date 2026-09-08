import { Analytics } from '@apps-in-toss/web-framework';

// 콘솔 '분석 > 이벤트'와 '핵심 지표(전환)'에 쓰는 이벤트. 이름은 콘솔에서 그대로 보이니
// 한 번 정하면 바꾸지 않는다(바꾸면 지표가 0이 된다). 값은 전부 문자열로 정규화된다.
//   summit_verified  정상 인증 성공(서버 확정)   mountain_id, collection, reward_p
//   hike_start       산행 시작 기록              mountain_id, first, reward_p
//   ad_interstitial  전면 광고                   result: shown | dismissed | failed
//   ad_banner        배너 광고                   result: rendered | nofill | failed | clicked
//   pick_click       오늘 Pick 상품 열기          pick_id, category
//   share            자랑하기                    mountain_id, season
//   reminder         산행 알림 동의 결과          result
export type TrackEvent =
  | 'summit_verified'
  | 'hike_start'
  | 'ad_interstitial'
  | 'ad_banner'
  | 'pick_click'
  | 'share'
  | 'reminder';

// 로깅은 어떤 경우에도 화면 흐름을 막지 않는다. 브라우저·샌드박스에서는 조용히 무시된다.
export function track(name: TrackEvent, params: Record<string, string | number | boolean> = {}): void {
  try {
    void Analytics.log({ log_name: name, log_type: 'event', params }).catch(() => {});
  } catch {
    // SDK가 없는 환경
  }
}
