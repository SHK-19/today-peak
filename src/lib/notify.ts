import { Notification } from '@apps-in-toss/web-framework';

// 기능성 정기 푸시 "산행 알림"(월·수·금·토 7시). 콘솔 스마트 발송의 템플릿 코드.
// 동의는 토스가 자체 화면으로 받고, 발송도 토스가 한다. 우리는 동의 화면을 띄우기만 한다.
const TEMPLATE_CODE = 'today-peak-hike-reminder';
const AGREED_KEY = 'hike-reminder-agreed';

export type ReminderResult = 'newAgreement' | 'alreadyAgreed' | 'agreementRejected' | 'error';

export function canAskReminder(): boolean {
  try {
    return Notification.requestAgreement.isSupported();
  } catch {
    return false;
  }
}

// 이 기기에서 동의한 적이 있으면 카드를 접는다. 해제는 토스 앱 설정에서 하므로 여기서 다시 묻지 않는다.
export function reminderAgreed(): boolean {
  try {
    return localStorage.getItem(AGREED_KEY) === '1';
  } catch {
    return false;
  }
}

export function askReminder(): Promise<ReminderResult> {
  return new Promise((resolve) => {
    let cleanup = () => {};
    const finish = (result: ReminderResult) => {
      cleanup();
      if (result === 'newAgreement' || result === 'alreadyAgreed') {
        try {
          localStorage.setItem(AGREED_KEY, '1');
        } catch {
          // 저장 못 해도 동의 자체는 됐다
        }
      }
      resolve(result);
    };
    try {
      cleanup = Notification.requestAgreement({
        options: { templateCode: TEMPLATE_CODE },
        onEvent: ({ type }) => finish(type),
        onError: () => finish('error'),
      });
    } catch {
      finish('error');
    }
  });
}
