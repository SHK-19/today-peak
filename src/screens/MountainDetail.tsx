import { GetCurrentLocationPermissionError } from '@apps-in-toss/web-framework';
import { useEffect, useRef, useState } from 'react';

import { formatDistance } from '../lib/format.ts';
import { prefetchLocation, readBestLocation } from '../lib/location.ts';
import {
  MAX_READS,
  isReadingFresh,
  readingAgeMs,
  verifySummit,
  type Mountain,
  type Reading,
  type VerifyResult,
} from '../lib/verify.ts';

type State =
  | { status: 'idle' }
  | { status: 'reading'; attempt: number }
  | {
      status: 'result';
      result: VerifyResult;
      coords: Reading['coords'];
      ageMs: number;
      elapsedMs: number;
      usedPrefetch: boolean;
      prefetchNote: string;
    }
  | { status: 'denied' }
  | { status: 'failed' };

type Props = { mountain: Mountain };

// 프리페치가 왜 쓰였는지/안 쓰였는지 그대로 보여준다 (세션 2 진단용).
function describePrefetch(cached: Reading | null, nowMs: number): string {
  if (cached == null) {
    return '미리읽기 없음';
  }
  const ageMs = Math.round(readingAgeMs(cached, nowMs));
  const fresh = isReadingFresh(cached, nowMs);
  return `미리읽기 ${fresh ? '유효' : '만료'}(${ageMs}ms 전, 정확도 ${Math.round(cached.coords.accuracy)}m)`;
}

function resultMessage(result: VerifyResult): { heading: string; body: string } {
  switch (result.reason) {
    case 'ok':
      return { heading: '스탬프를 획득했어요', body: '정상에 도착한 걸 확인했어요.' };
    case 'low_accuracy':
      return {
        heading: '위치 정확도가 낮아요',
        body: '하늘이 트인 곳에서 잠시 기다렸다가 다시 눌러주세요.',
      };
    case 'too_far':
      return {
        heading: `정상까지 ${formatDistance(result.distanceM)}`,
        body: '정상에 도착한 뒤 다시 눌러주세요.',
      };
    case 'altitude_mismatch':
      return {
        heading: '고도가 정상과 달라요',
        body: '잠시 기다렸다가 다시 눌러주세요.',
      };
  }
}

function ctaLabel(state: State): string {
  if (state.status !== 'reading') {
    return '정상 인증하기';
  }
  if (state.attempt === 1) {
    return '위치를 확인하고 있어요';
  }
  return `신호가 약해서 다시 확인하고 있어요 (${state.attempt}/${MAX_READS})`;
}

export function MountainDetail({ mountain }: Props) {
  const [state, setState] = useState<State>({ status: 'idle' });
  // 진행 중인 요청 자체를 들고 있는다. 버튼을 일찍 눌러도 새 요청을 또 만들지 않고
  // 먼저 시작한 요청을 기다린다 (야외에서 한 번 읽는 데 3~10초 걸린다).
  const prefetched = useRef<Promise<Reading | null> | null>(null);

  // 화면에 들어오자마자 위치를 한 번 미리 읽어둔다.
  useEffect(() => {
    prefetched.current = prefetchLocation();
    return () => {
      prefetched.current = null;
    };
  }, [mountain.id]);

  async function handleVerify() {
    setState({ status: 'reading', attempt: 1 });

    const pending = prefetched.current;
    prefetched.current = null; // 한 번 쓰면 버린다. 다시 누르면 새로 측정한다.
    const startedAt = Date.now();

    try {
      const cached = pending === null ? null : await pending;
      const waitedMs = Date.now() - startedAt;
      const prefetchNote =
        (waitedMs > 50 ? `미리읽기 대기 ${waitedMs}ms · ` : '') +
        describePrefetch(cached, Date.now());

      const reading = await readBestLocation(
        (attempt) => setState({ status: 'reading', attempt }),
        cached,
      );
      setState({
        status: 'result',
        result: verifySummit(reading, mountain),
        coords: reading.coords,
        ageMs: Math.round(readingAgeMs(reading, Date.now())),
        elapsedMs: Date.now() - startedAt,
        usedPrefetch: reading === cached,
        prefetchNote,
      });
    } catch (error) {
      setState({
        status: error instanceof GetCurrentLocationPermissionError ? 'denied' : 'failed',
      });
    }
  }

  return (
    <main className="screen">
      <h1 className="title">{mountain.name}</h1>
      <p className="subtitle">높이 {mountain.elevationM}m</p>

      {state.status === 'result' && (
        <section className={state.result.ok ? 'result result-ok' : 'result'}>
          <h2 className="result-heading">{resultMessage(state.result).heading}</h2>
          <p className="notice">{resultMessage(state.result).body}</p>
          <p className="debug">
            디버그 · 거리 {Math.round(state.result.distanceM)}m · 정확도{' '}
            {Math.round(state.coords.accuracy)}m · reason {state.result.reason} · 저장 안 함(세션 2)
            <br />
            지금 내 좌표 {state.coords.latitude.toFixed(5)}, {state.coords.longitude.toFixed(5)} ·
            고도 {state.coords.altitude == null ? '없음' : Math.round(state.coords.altitude) + 'm'}{' '}
            (±
            {state.coords.altitudeAccuracy == null
              ? '?'
              : Math.round(state.coords.altitudeAccuracy)}
            m)
            <br />
            소요 {state.elapsedMs}ms · {state.usedPrefetch ? '미리 읽어둔 값 사용' : '즉석 측정'}
            <br />
            쓴 좌표는 {state.ageMs}ms 전 측정 · {state.prefetchNote}
          </p>
        </section>
      )}

      {state.status === 'denied' && (
        <section className="result">
          <h2 className="result-heading">위치 권한이 필요해요</h2>
          <p className="notice">휴대폰 설정에서 위치 권한을 허용한 뒤 다시 시도해 주세요.</p>
        </section>
      )}

      {state.status === 'failed' && (
        <section className="result">
          <h2 className="result-heading">위치를 확인할 수 없어요</h2>
          <p className="notice">
            휴대폰 설정에서 위치 서비스가 켜져 있는지 확인한 뒤 다시 눌러주세요.
          </p>
        </section>
      )}

      <div className="cta-area">
        <button
          type="button"
          className="cta"
          disabled={state.status === 'reading'}
          onClick={() => void handleVerify()}
        >
          {ctaLabel(state)}
        </button>
      </div>
    </main>
  );
}
