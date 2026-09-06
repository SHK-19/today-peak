import { GetCurrentLocationPermissionError, requestReview } from '@apps-in-toss/web-framework';
import { useEffect, useRef, useState } from 'react';

import {
  fetchMountainStats,
  startHike,
  suggestPeak,
  verifySummitOnServer,
  type HikeStartOutcome,
  type MountainStats,
  type SummitOutcome,
} from '../lib/api.ts';
import {
  CheckIcon,
  CollectionIcon,
  FlagIcon,
  LocationIcon,
  PeopleIcon,
} from '../components/icons.tsx';
import { FoldCard } from '../components/FoldCard.tsx';
import { SeasonDots } from '../components/SeasonDots.tsx';
import { Stamp } from '../components/Stamp.tsx';
import { formatSeoulDate } from '../lib/day.ts';
import { formatDistance } from '../lib/format.ts';
import { IS_FIELD_TEST_BUILD } from '../lib/mountains.ts';
import { SEASON_LABEL, seasonCount, type SeasonRecord } from '../lib/seasons.ts';
import { shareMountain } from '../lib/share.ts';
import { seasonOf } from '../lib/stamp-art.ts';
import {
  ensureLocationPermission,
  prefetchLocation,
  readBestLocation,
  readLocationForCheckIn,
} from '../lib/location.ts';
import { MAX_READS, verifySummit, type Mountain, type Reading } from '../lib/verify.ts';

type State =
  | { status: 'idle' }
  | { status: 'reading'; attempt: number }
  // 위치를 읽은 뒤. confirmed가 false면 서버 응답을 기다리는 중,
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

type Props = {
  mountain: Mountain;
  /** 이 산에서 모은 계절별 인증 시각 */
  seasons: SeasonRecord;
  /** 성공 티켓 절취선 아래 "96곳 중 N곳" */
  collectedCount: number;
  totalCount: number;
  onVerified: () => void;
  onGoToStamps: () => void;
};

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

// 리뷰 요청은 한 세션에 한 번. 노출 여부는 플랫폼이 정하고, 결과에 따라 흐름을 바꾸지 않는다.
let reviewAsked = false;
function askReviewOnce() {
  if (reviewAsked) return;
  reviewAsked = true;
  try {
    if (requestReview.isSupported()) void requestReview().catch(() => {});
  } catch {
    // 지원하지 않는 환경. 조용히 넘어간다.
  }
}

function ctaLabel(state: State): string {
  if (state.status !== 'reading') {
    return '오늘 정상 인증하기';
  }
  if (state.attempt === 1) {
    return '위치를 확인하고 있어요';
  }
  return `신호가 약해서 다시 확인하고 있어요 (${state.attempt}/${MAX_READS})`;
}

// 실측 빌드에서만 결과 아래 붙는 좌표 한 줄. 테스트 장소를 만들 때 이 값을 쓴다.
function FieldNote({ reading, outcome }: { reading: Reading; outcome: SummitOutcome }) {
  if (!IS_FIELD_TEST_BUILD) {
    return null;
  }
  return (
    <p className="footnote">
      내 좌표 {reading.coords.latitude.toFixed(6)}, {reading.coords.longitude.toFixed(6)} · 정확도{' '}
      {Math.round(reading.coords.accuracy)}m · 거리{' '}
      {'distanceM' in outcome ? Math.round(outcome.distanceM) : '-'}m · 고도{' '}
      {reading.coords.altitude == null ? '없음' : `${Math.round(reading.coords.altitude)}m`}
    </p>
  );
}

export function MountainDetail({
  mountain,
  seasons,
  collectedCount,
  totalCount,
  onVerified,
  onGoToStamps,
}: Props) {
  const collected = seasonCount(seasons) > 0;
  const [state, setState] = useState<State>({ status: 'idle' });
  const [stats, setStats] = useState<MountainStats | null>(null);
  const [hike, setHike] = useState<HikeState>({ status: 'idle' });
  // 정상 제안. 반경 밖으로 실패했을 때만 열린다.
  const [suggesting, setSuggesting] = useState(false);
  const [suggestName, setSuggestName] = useState('');
  const [suggested, setSuggested] = useState<'no' | 'sending' | 'done' | 'failed'>('no');
  // 내려와서 카드 안 전환. 한쪽이 비면 버튼을 숨기고 있는 쪽만 보여준다.
  const [placeKind, setPlaceKind] = useState<'food' | 'cafe'>('food');
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

  async function handleSuggest(reading: Reading) {
    setSuggested('sending');
    try {
      await suggestPeak(mountain.id, reading, suggestName);
      setSuggested('done');
      setSuggesting(false);
    } catch {
      setSuggested('failed');
    }
  }

  // 서버 판정이 최종이다. 통신이 실패하면 위치를 다시 읽지 않고 같은 reading을 다시 보낸다.
  async function save(reading: Reading, local: SummitOutcome) {
    try {
      const outcome = await verifySummitOnServer(mountain.id, reading);
      setState({ status: 'result', reading, outcome, confirmed: true, saveFailed: false });
      if (outcome.status === 'ok') {
        onVerified();
        askReviewOnce();
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

  const both = (stats?.places?.food.length ?? 0) > 0 && (stats?.places?.cafe.length ?? 0) > 0;
  const nearby = both
    ? (stats?.places?.[placeKind] ?? [])
    : [...(stats?.places?.food ?? []), ...(stats?.places?.cafe ?? [])];

  const verifyButton = (
    <button
      type="button"
      className="btn"
      disabled={state.status === 'reading'}
      onClick={() => void handleVerify()}
    >
      {state.status === 'reading' && <span className="spinner" aria-hidden="true" />}
      {ctaLabel(state)}
    </button>
  );

  // ---- 인증 성공: 초록 들판 위 종이 티켓. 로컬 판정이 ok면 바로 찍고, 서버가 뒤집으면 결과 카드로 간다.
  if (state.status === 'result' && state.outcome.status === 'ok') {
    const now = new Date().toISOString();
    const season = seasonOf(now);
    // 저장 성공 전엔 아직 셈에 안 들어 있다. 절취선 아래 숫자를 미리 올려서 보여준다.
    const shownCount = collected ? collectedCount : collectedCount + (state.confirmed ? 0 : 1);
    const seasonDone = seasonCount({ ...seasons, [season]: seasons[season] ?? now });
    return (
      <main className="page success">
        <header className="success-heading">
          <h1>스탬프를 획득했어요</h1>
          <p>정상에 도착한 걸 확인했어요.</p>
        </header>

        <section className="ticket">
          <div className="ticket-main">
            <Stamp
              mountain={mountain}
              collected
              size={160}
              verifiedAt={now}
              className="stamp-impact"
            />
            <h2>{mountain.name}</h2>
            <p className="altitude">
              {mountain.elevationM}m
              {mountain.peakName != null && ` · ${mountain.peakName}`}
            </p>
            <p className="ticket-date">{formatSeoulDate(now)}</p>
            <p className="ticket-season">
              {SEASON_LABEL[season]} 스탬프 · 사계절 중 {seasonDone}
            </p>
            <FieldNote reading={state.reading} outcome={state.outcome} />
          </div>
          <div className="ticket-stub">
            <span className="seal-check">
              <CheckIcon size={20} />
            </span>
            <p>
              <strong>내 스탬프</strong>
              {totalCount}곳 중 {shownCount}곳을 모았어요
            </p>
          </div>
        </section>

        {state.saveFailed && (
          <p className="save-alert">
            <strong>스탬프를 저장하지 못했어요</strong>
            인터넷 연결을 확인한 뒤 다시 저장해 주세요. 위치는 그대로 두고 저장만 다시 해요.
          </p>
        )}

        <div className="bottom-actions">
          {state.saveFailed ? (
            <button
              type="button"
              className="btn"
              onClick={() => void save(state.reading, state.outcome)}
            >
              다시 저장
            </button>
          ) : (
            <>
              {state.confirmed && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    void shareMountain(
                      mountain,
                      `${mountain.name} 정상에서 ${SEASON_LABEL[season]} 스탬프를 모았어요 · 오늘 정상`,
                    ).catch(() => {})
                  }
                >
                  자랑하기
                </button>
              )}
              <button type="button" className="btn" disabled={!state.confirmed} onClick={onGoToStamps}>
                {state.confirmed ? '내 스탬프' : '저장하고 있어요'}
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  // ---- 정상 제안 입력
  if (state.status === 'result' && suggesting) {
    const reading = state.reading;
    return (
      <main className="page">
        <div className="form-content">
          <label htmlFor="peak-name">지금 계신 봉우리 이름을 알려주세요</label>
          <input
            id="peak-name"
            value={suggestName}
            maxLength={20}
            placeholder="예: 문수봉"
            autoComplete="off"
            onChange={(event) => setSuggestName(event.target.value)}
          />
          <p className="count">{suggestName.length} / 20</p>
          <p className="privacy">
            이름과 지금 위치만 보내요. 다른 사람에게는 보이지 않고, 정상 좌표를 고칠지 판단하는
            데만 써요. 개인정보는 적지 말아주세요.
          </p>
          {suggested === 'failed' && (
            <p className="form-error">보내지 못했어요. 잠시 후 다시 눌러주세요.</p>
          )}
        </div>
        <div className="bottom-actions">
          <button
            type="button"
            className="btn"
            disabled={suggestName.trim() === '' || suggested === 'sending'}
            onClick={() => void handleSuggest(reading)}
          >
            {suggested === 'sending' && <span className="spinner" aria-hidden="true" />}
            {suggested === 'sending' ? '보내는 중' : '보내기'}
          </button>
        </div>
      </main>
    );
  }

  // ---- 실패·중복·오래됨 결과, 제안 완료
  if (state.status === 'result') {
    const message = state.saveFailed
      ? {
          heading: '스탬프를 저장하지 못했어요',
          body: '인터넷 연결을 확인한 뒤 다시 저장해 주세요. 위치는 그대로 두고 저장만 다시 해요.',
        }
      : resultMessage(state.outcome, mountain.peakName);
    const canSuggest =
      !state.saveFailed &&
      state.outcome.status === 'rejected' &&
      state.outcome.reason === 'too_far' &&
      suggested !== 'done';
    return (
      <main className="page">
        <section className="result-card">
          <span className="state-icon">
            {suggested === 'done' ? <CheckIcon size={32} /> : <LocationIcon size={32} />}
          </span>
          <h1>{suggested === 'done' ? '알려주셔서 고마워요' : message.heading}</h1>
          <p>{suggested === 'done' ? '확인해서 반영할게요.' : message.body}</p>
          <FieldNote reading={state.reading} outcome={state.outcome} />
        </section>

        {/* 반경 밖으로 실패했을 때만. 스탬프를 주는 통로가 아니라 좌표를 고치기 위한 제보라
            메인 버튼과 확실히 다르게(밑줄 글자) 그린다. */}
        {canSuggest && (
          <div className="report-action">
            <button type="button" className="btn btn-ghost" onClick={() => setSuggesting(true)}>
              여기도 {mountain.name} 정상이에요
            </button>
          </div>
        )}

        <div className="bottom-actions">
          {state.saveFailed ? (
            <button
              type="button"
              className="btn"
              onClick={() => void save(state.reading, state.outcome)}
            >
              다시 저장
            </button>
          ) : (
            verifyButton
          )}
        </div>
      </main>
    );
  }

  // ---- 위치 권한·위치 실패. 막다른 화면이 아니라 문을 여는 화면이다.
  if (state.status === 'denied' || state.status === 'failed') {
    return (
      <main className="page">
        <section className="permission">
          <span className="state-icon">
            <LocationIcon size={32} />
          </span>
          <h1>{state.status === 'denied' ? '위치 권한이 필요해요' : '위치를 확인할 수 없어요'}</h1>
          <p>
            {state.status === 'denied'
              ? '정상에 도착했는지 확인하려면 위치가 필요해요. 아래 버튼을 누르면 허용 여부를 다시 물어봐요.'
              : '휴대폰 설정에서 위치 서비스가 켜져 있는지 확인한 뒤 다시 눌러주세요.'}
            {state.status === 'denied' &&
              state.askedAgain &&
              ' 팝업이 뜨지 않으면 토스 앱 설정 > 권한에서 위치를 켜주세요.'}
          </p>
        </section>
        <div className="bottom-actions">
          <button type="button" className="btn" onClick={() => void handleVerify()}>
            {state.status === 'denied' ? '위치 허용하기' : '오늘 정상 인증하기'}
          </button>
        </div>
      </main>
    );
  }

  // ---- 기본: 정상에서 보는 화면. 큰 글자, 큰 버튼, 한 번의 탭.
  const hikeNote = hikeMessage(hike);
  const canStartHike = mountain.trailheads.length > 0;
  // 집계 줄이 하나도 없으면 버튼 위 구분선을 그리지 않는다.
  const hasStatLines =
    stats !== null && (stats.hikingNow > 0 || stats.todayStamps > 0 || stats.totalStamps > 0);
  return (
    <main className="page">
      <section className="hero">
        <Stamp mountain={mountain} collected={collected} size={160} />
      </section>

      <div className="detail-info">
        <h1>{mountain.name}</h1>
        <p>
          높이 {mountain.elevationM}m
          {mountain.peakName != null && ` · 인증 지점 ${mountain.peakName}`}
        </p>
        {collected && (
          <span className="badge">
            {seasonCount(seasons) === 4
              ? '이 산의 사계절을 다 모았어요'
              : `${(Object.keys(SEASON_LABEL) as (keyof typeof SEASON_LABEL)[])
                  .filter((s) => seasons[s] !== undefined)
                  .map((s) => SEASON_LABEL[s])
                  .join('·')} 스탬프를 모았어요`}
          </span>
        )}
        {collected && (
          <div className="detail-dots">
            <SeasonDots record={seasons} />
          </div>
        )}
      </div>

      {(canStartHike || hasStatLines) && (
        <div className="stats">
          {stats !== null && stats.hikingNow > 0 && (
            <p>
              <PeopleIcon size={22} />
              지금 {stats.hikingNow}명 등산 중
            </p>
          )}
          {stats !== null && stats.todayStamps > 0 && (
            <p>
              <FlagIcon size={22} />
              오늘 {stats.todayStamps}명이 정상을 찍었어요
            </p>
          )}
          {stats !== null && stats.totalStamps > 0 && (
            <p>
              <CollectionIcon size={22} />
              지금까지 {stats.totalStamps}명 인증
            </p>
          )}

          {/* 산행 시작은 인증의 전제 조건이 아니다. 집계에 참여하는 버튼이라는 게 보이게
              집계 카드 안에 두고, 하단 CTA(정상 인증하기)와 섞이지 않게 한다. */}
          {canStartHike && (
            <div className={hasStatLines ? 'stats-action' : 'stats-action stats-action-only'}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={hike.status === 'starting' || hike.status === 'done'}
                onClick={() => void handleStartHike()}
              >
                {hike.status === 'starting' ? '위치를 확인하고 있어요' : '나도 등산 중이라고 알리기'}
              </button>
              <p className="footnote">
                {hikeNote ??
                  '등산로 입구에서 누르면 위 집계에 함께 잡혀요. 정상 인증과는 상관없어요.'}
              </p>
            </div>
          )}
        </div>
      )}

      {nearby.length > 0 && (
        <FoldCard
          title="내려와서"
          hint={`${(stats?.places?.food.length ?? 0) + (stats?.places?.cafe.length ?? 0)}곳`}
          actions={
            both && (
              <div className="toggle" role="tablist">
                {(['food', 'cafe'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="tab"
                    aria-selected={placeKind === kind}
                    className={placeKind === kind ? 'toggle-item toggle-active' : 'toggle-item'}
                    onClick={() => setPlaceKind(kind)}
                  >
                    {kind === 'food' ? '음식점' : '카페'}
                  </button>
                ))}
              </div>
            )
          }
        >
          <ul className="place-list">
            {nearby.map((place) => (
              <li key={place.name}>
                <strong>{place.name}</strong>
                <span>
                  {place.category}
                  {place.address !== '' && ` · ${place.address}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="footnote">네이버 검색 결과예요. 영업 여부는 달라질 수 있어요.</p>
        </FoldCard>
      )}

      <div className="bottom-actions">
        <p className="footnote">
          정상에서 인터넷이 안 되면 신호가 잡히는 가까운 지점에서 시도해 주세요.
        </p>
        {verifyButton}
      </div>
    </main>
  );
}
