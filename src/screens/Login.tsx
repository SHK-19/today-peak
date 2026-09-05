import { useState } from 'react';

import { login } from '../lib/auth.ts';

type Props = { onDone: () => void };

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
    <main className="screen">
      <h1 className="title">오늘 정상</h1>
      <p className="subtitle">100대 명산 정상 스탬프</p>
      <p className="notice">
        산 정상에 도착해 버튼을 누르면 위치를 확인하고 그 산의 스탬프를 드려요. 모은 스탬프는 토스
        로그인으로 저장돼서, 휴대폰을 바꿔도 그대로 남아요.
      </p>

      <section className="hero">
        <span className="hero-mark tf" aria-hidden="true">
          ⛰️
        </span>
      </section>

      {state === 'failed' && (
        <section className="result">
          <h2 className="result-heading">로그인이 완료되지 않았어요</h2>
          <p className="notice">아래 버튼을 눌러 다시 시도해 주세요.</p>
        </section>
      )}

      <div className="cta-area">
        <button
          type="button"
          className="cta"
          disabled={state === 'pending'}
          onClick={() => void handleLogin()}
        >
          {state === 'pending' ? '로그인하고 있어요' : '토스로 로그인하기'}
        </button>
      </div>
    </main>
  );
}
