import { GetCurrentLocationPermissionError } from '@apps-in-toss/web-framework';
import { useEffect, useRef, useState } from 'react';

import {
  fetchMountainStats,
  startHike,
  verifySummitOnServer,
  type HikeStartOutcome,
  type MountainStats,
  type SummitOutcome,
} from '../lib/api.ts';
import { Stamp } from '../components/Stamp.tsx';
import { formatDistance } from '../lib/format.ts';
import { IS_FIELD_TEST_BUILD } from '../lib/mountains.ts';
import {
  ensureLocationPermission,
  prefetchLocation,
  readBestLocation,
  readLocationForCheckIn,
} from '../lib/location.ts';
import {
  MAX_READS,
  SUMMIT_RADIUS_M,
  verifySummit,
  type Mountain,
  type Reading,
} from '../lib/verify.ts';

type State =
  | { status: 'idle' }
  | { status: 'reading'; attempt: number }
  // 위치를 읽은 뒤. outcome이 null이면 서버 응답을 기다리는 중,
  // saveFailed면 통신이 끊긴 것이라 같은 reading으로 다시 보낼 수 있다.
  | {
      status: 'result';
      reading: Reading;
      outcome: SummitOutcome;
      confirmed: boolean;
      saveFailed: boolean;
    }
  | { status: 'denied'; askedAgain: boolean }
  | { status: 'failed' };

type HikeState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'done'; outcome: HikeStartOutcome }
  | { status: 'failed' };

type Props = { mountain: Mountain; collected: boolean; onVerified: () => void };

function hikeMessage(state: HikeState): string | null {
  switch (state.status) {
    case 'idle':
    case 'starting':
      return null;
    case 'failed':
      return '산행 시작을 기록하지 못했어요. 잠시 후 다시 눌러주세요.';
    case 'done':
      switch (state.outcome.status) {
        case 'ok':
          return `${state.outcome.trailheadName}에서 산행을 시작했어요.`;
        case 'already_today':
          return '오늘은 이미 산행 시작을 기록했어요.';
        case 'too_far':
          return `등산로 입구에서 눌러주세요. ${state.outcome.trailheadName}까지 ${formatDistance(state.outcome.distanceM)}예요.`;
        case 'stale_reading':
          return '위치 정보가 오래됐어요. 다시 눌러주세요.';
      }
  }
}

function resultMessage(
  outcome: SummitOutcome,
  peakName: string | undefined,
): { heading: string; body: string } {
  switch (outcome.status) {
    case 'ok':
      return { heading: '스탬프를 획득했어요', body: '정상에 도착한 걸 확인했어요.' };
    case 'already_today':
      return {
        heading: '오늘 스탬프는 이미 받았어요',
        body: '같은 산은 하루에 한 번 인증할 수 있어요.',
      };
    case 'stale_reading':
      return {
        heading: '위치 정보가 오래됐어요',
        body: '아래 버튼을 눌러 위치를 다시 확인해 주세요.',
      };
    case 'rejected':
      switch (outcome.reason) {
        case 'low_accuracy':
          return {
            heading: '위치 정확도가 낮아요',
            body: '하늘이 트인 곳에서 잠시 기다렸다가 다시 눌러주세요.',
          };
        case 'too_far':
          return {
            heading: `정상까지 ${formatDistance(outcome.distanceM)}`,
            body:
              peakName == null
                ? '정상에 도착한 뒤 다시 눌러주세요.'
                : `${peakName}에 도착한 뒤 다시 눌러주세요.`,
          };
        case 'altitude_mismatch':
          return {
            heading: '고도가 정상과 달라요',
            body: '잠시 기다렸다가 다시 눌러주세요.',
          };
        case 'ok':
          return { heading: '스탬프를 획득했어요', body: '정상에 도착한 걸 확인했어요.' };
      }
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

export function MountainDetail({ mountain, collected, onVerified }: Props) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [stats, setStats] = useState<MountainStats | null>(null);
  const [hike, setHike] = useState<HikeState>({ status: 'idle' });
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

  // 집계는 실패해도 조용히 넘어간다 — 없으면 줄을 안 그리면 그만이다.
  useEffect(() => {
    let cancelled = false;
    void loadStats();
    async function loadStats() {
      try {
        const next = await fetchMountainStats(mountain.id);
        if (!cancelled) setStats(next);
      } catch {
        if (!cancelled) setStats(null);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [mountain.id, state.status, hike.status]);

  // 정상 인증과 완전히 독립이다. 여기서 무엇이 나오든 인증 흐름은 건드리지 않는다.
  async function handleStartHike() {
    setHike({ status: 'starting' });
    try {
      if (!(await ensureLocationPermission())) {
        setState({ status: 'denied', askedAgain: true });
        setHike({ status: 'idle' });
        return;
      }
      const reading = await readLocationForCheckIn();
      setHike({ status: 'done', outcome: await startHike(mountain.id, reading) });
    } catch {
      setHike({ status: 'failed' });
    }
  }

  // 서버 판정이 최종이다. 통신이 실패하면 위치를 다시 읽지 않고 같은 reading을 다시 보낸다.
  async function save(reading: Reading, local: SummitOutcome) {
    try {
      const outcome = await verifySummitOnServer(mountain.id, reading);
      setState({ status: 'result', reading, outcome, confirmed: true, saveFailed: false });
      if (outcome.status === 'ok') {
        onVerified();
      }
    } catch {
      setState({ status: 'result', reading, outcome: local, confirmed: false, saveFailed: true });
    }
  }

  async function handleVerify() {
    // 권한이 없으면 여기서 다시 물어본다. 거부한 뒤에도 버튼을 누르면 계속 물어본다 —
    // 위치 없이는 인증 자체가 불가능한 기능이라 다른 길이 없다.
    if (!(await ensureLocationPermission())) {
      setState({ status: 'denied', askedAgain: true });
      return;
    }

    setState({ status: 'reading', attempt: 1 });

    const pending = prefetched.current;
    prefetched.current = null; // 한 번 쓰면 버린다. 다시 누르면 새로 측정한다.

    try {
      const cached = pending === null ? null : await pending;
      const reading = await readBestLocation(
        (attempt) => setState({ status: 'reading', attempt }),
        cached,
      );

      // 즉시 피드백. 같은 판정을 서버가 다시 해서 최종 결과를 준다.
      const local = verifySummit(reading, mountain);
      const shown: SummitOutcome = local.ok
        ? { status: 'ok', distanceM: local.distanceM }
        : { status: 'rejected', reason: local.reason, distanceM: local.distanceM };
      setState({ status: 'result', reading, outcome: shown, confirmed: false, saveFailed: false });

      await save(reading, shown);
    } catch (error) {
      setState(
        error instanceof GetCurrentLocationPermissionError
          ? { status: 'denied', askedAgain: false }
          : { status: 'failed' },
      );
    }
  }

  return (
    <main className="screen">
      <h1 className="title">{mountain.name}</h1>
      <p className="subtitle">
        높이 {mountain.elevationM}m
        {mountain.peakName != null && ` · 인증 지점 ${mountain.peakName}`}
      </p>

      {stats !== null && (stats.hikingNow > 0 || stats.todayStamps > 0 || stats.totalStamps > 0) && (
        <ul className="stats">
          {stats.hikingNow > 0 && <li>지금 {stats.hikingNow}명 등산 중</li>}
          {stats.todayStamps > 0 ? (
            <li>오늘 {stats.todayStamps}명이 정상을 찍었어요</li>
          ) : (
            stats.totalStamps > 0 && <li>지금까지 {stats.totalStamps}명 인증</li>
          )}
        </ul>
      )}

      {mountain.trailheads.length > 0 && (
        <>
          <button
            type="button"
            className="button-secondary"
            disabled={hike.status === 'starting'}
            onClick={() => void handleStartHike()}
          >
            {hike.status === 'starting' ? '위치를 확인하고 있어요' : '산행 시작'}
          </button>
          {hikeMessage(hike) !== null && <p className="notice">{hikeMessage(hike)}</p>}
        </>
      )}

      {(state.status === 'idle' || state.status === 'reading') && (
        <section className="hero">
          <Stamp mountain={mountain} collected={collected} size={160} />
          <p className="hero-note">
            {collected
              ? '이 산의 스탬프를 모았어요'
              : mountain.peakName == null
                ? `정상 반경 ${SUMMIT_RADIUS_M}m 안에서 인증하면 이 스탬프를 받아요`
                : `${mountain.peakName} 반경 ${SUMMIT_RADIUS_M}m 안에서 인증하면 이 스탬프를 받아요`}
          </p>
        </section>
      )}

      {state.status === 'result' && (
        <section className={state.outcome.status === 'ok' && state.confirmed ? 'result result-ok' : 'result'}>
          {state.outcome.status === 'ok' && state.confirmed && (
            <div className="celebrate">
              <Stamp mountain={mountain} collected size={140} />
            </div>
          )}
          <h2 className="result-heading">
            {state.saveFailed ? '스탬프를 저장하지 못했어요' : resultMessage(state.outcome, mountain.peakName).heading}
          </h2>
          <p className="notice">
            {state.saveFailed
              ? '인터넷 연결을 확인한 뒤 다시 저장해 주세요. 위치는 그대로 두고 저장만 다시 해요.'
              : resultMessage(state.outcome, mountain.peakName).body}
          </p>
          {IS_FIELD_TEST_BUILD && (
            <p className="footnote">
              내 좌표 {state.reading.coords.latitude.toFixed(6)},{' '}
              {state.reading.coords.longitude.toFixed(6)} · 정확도{' '}
              {Math.round(state.reading.coords.accuracy)}m · 거리{' '}
              {'distanceM' in state.outcome ? Math.round(state.outcome.distanceM) : '-'}m · 고도{' '}
              {state.reading.coords.altitude == null
                ? '없음'
                : Math.round(state.reading.coords.altitude) + 'm'}
            </p>
          )}
          {state.saveFailed && (
            <button
              type="button"
              className="cta cta-inline"
              onClick={() => void save(state.reading, state.outcome)}
            >
              다시 저장
            </button>
          )}
        </section>
      )}

      {state.status === 'denied' && (
        <section className="result">
          <h2 className="result-heading">위치 권한이 필요해요</h2>
          <p className="notice">
            정상에 도착했는지 확인하려면 위치가 필요해요. 아래 <strong>정상 인증하기</strong>를
            누르면 허용 여부를 다시 물어봐요.
            {state.askedAgain && ' 팝업이 뜨지 않으면 토스 앱 설정 > 권한에서 위치를 켜주세요.'}
          </p>
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
        <p className="footnote">
          정상에서 인터넷이 안 되면 신호가 잡히는 가까운 지점에서 시도해 주세요.
        </p>
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
