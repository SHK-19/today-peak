import { useState } from 'react';

import { Stamp } from '../components/Stamp.tsx';
import { login } from '../lib/auth.ts';

type Props = { onDone: () => void };

// 인트로에 보여줄 도장. 실제 산이 아니라 "이런 걸 모은다"는 표본이다.
const INTRO_STAMP = { id: 'intro', name: '오늘 정상', elevationM: 836 };

// 로그인 전에 어떤 서비스인지 알 수 있어야 한다(출시 가이드 토스 로그인 항목).
export function Login({ onDone }: Props) {
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle');

  async function handleLogin() {
    setState('pending');
    try {
      await login();
      onDone();
    } catch {
      // 로그인 창을 닫은 것과 통신 실패를 구분할 방법이 없다. 문구 하나로 둘 다 받는다.
      setState('failed');
    }
  }

  return (
    <main className="page">
      <section className="intro">
        <h1 className="brand-title">오늘 정상</h1>
        <p className="intro-sub">100대 명산 정상 스탬프</p>

        <div className="hero-mark">
          <Stamp mountain={INTRO_STAMP} collected size={160} verifiedAt="2026-10-01T00:00:00Z" />
        </div>

        <p className="state-copy" aria-live="polite">
          {state === 'failed' && (
            <>
              <strong>로그인이 완료되지 않았어요</strong>
              아래 버튼을 눌러 다시 시도해 주세요.
            </>
          )}
          {state === 'idle' &&
            '산 정상에 도착해 버튼을 누르면 위치를 확인하고 그 산의 스탬프를 드려요. 모은 스탬프는 토스 로그인으로 저장돼서, 휴대폰을 바꿔도 그대로 남아요.'}
        </p>
      </section>

      <div className="bottom-actions">
        <button
          type="button"
          className="btn"
          disabled={state === 'pending'}
          onClick={() => void handleLogin()}
        >
          {state === 'pending' && <span className="spinner" aria-hidden="true" />}
          {state === 'pending' ? '로그인하고 있어요' : '토스로 로그인하기'}
        </button>
      </div>
    </main>
  );
}
