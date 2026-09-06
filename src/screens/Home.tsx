import { GetCurrentLocationPermissionError } from '@apps-in-toss/web-framework';
import { useEffect, useRef, useState } from 'react';

import { ChevronRight, CollectionIcon, LocationIcon, Search } from '../components/icons.tsx';
import { Stamp } from '../components/Stamp.tsx';
import type { Stamp as StampRecord } from '../lib/api.ts';
import { formatDistance } from '../lib/format.ts';
import { haversineMeters } from '../lib/geo.ts';
import { ensureLocationPermission, readLocationOnce } from '../lib/location.ts';
import { IS_FIELD_TEST_BUILD, MOUNTAINS } from '../lib/mountains.ts';
import { regionsOf } from '../lib/region.ts';
import type { Mountain } from '../lib/verify.ts';

type NearbyMountain = { mountain: Mountain; distanceM: number };

type State =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'failed' }
  | {
      status: 'ready';
      nearby: NearbyMountain[];
      coords: { latitude: number; longitude: number; accuracy: number };
    };

type Props = {
  onSelect: (mountainId: string) => void;
  stamps: StampRecord[] | null;
  /** '정상 인증하기' 주요 기능으로 들어왔을 때. 위치를 읽자마자 가장 가까운 산을 한 번 연다. */
  openNearestOnce?: boolean;
};

export function Home({ onSelect, stamps, openNearestOnce = false }: Props) {
  const nearestOpened = useRef(!openNearestOnce);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const collected = new Set(stamps?.map((stamp) => stamp.mountainId));
  // 96곳을 한 줄로 늘어놓으면 못 찾는다. 권역으로 먼저 좁힌다.
  const [region, setRegion] = useState<string | null>(null);
  const regions = regionsOf(MOUNTAINS);
  const inRegion = (mountain: Mountain) => region === null || (mountain.region ?? '기타') === region;
  // 96곳이라 이름으로 바로 찾는 길도 둔다. 공백은 무시하고 이름·인증 지점을 본다.
  const [query, setQuery] = useState('');
  const needle = query.replace(/\s/g, '');
  const matches = (mountain: Mountain) =>
    needle === '' ||
    mountain.name.replace(/\s/g, '').includes(needle) ||
    (mountain.peakName ?? '').replace(/\s/g, '').includes(needle);
  const visible = (mountain: Mountain) => inRegion(mountain) && matches(mountain);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading' });
      try {
        if (!(await ensureLocationPermission())) {
          if (!cancelled) setState({ status: 'denied' });
          return;
        }

        const { coords } = await readLocationOnce();
        const nearby = MOUNTAINS.map((mountain) => ({
          mountain,
          distanceM: haversineMeters(
            coords.latitude,
            coords.longitude,
            mountain.summitLat,
            mountain.summitLng,
          ),
        })).sort((a, b) => a.distanceM - b.distanceM);

        if (!cancelled) setState({ status: 'ready', nearby, coords });
        if (!cancelled && !nearestOpened.current && nearby.length > 0) {
          nearestOpened.current = true;
          selectRef.current(nearby[0].mountain.id);
        }
      } catch (error) {
        // getPermission이 allowed를 주고도 실제 조회에서 권한 에러가 날 수 있다.
        // (OS 위치 서비스가 꺼져 있는 경우 — 2026-09-05 실기기 확인)
        if (!cancelled) {
          setState({
            status: error instanceof GetCurrentLocationPermissionError ? 'denied' : 'failed',
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // 위치를 못 읽어도 산 목록은 그대로 보여준다. 거리만 빠진다.
  const rows: { mountain: Mountain; distanceM?: number }[] =
    state.status === 'ready'
      ? state.nearby.filter(({ mountain }) => visible(mountain))
      : MOUNTAINS.filter(visible).map((mountain) => ({ mountain }));

  return (
    <main className="page page-tabbed">
      <header className="page-head">
        <h1>오늘 정상</h1>
        <p>가까운 산부터 보여드려요</p>
      </header>

      {collected.size > 0 && (
        <div className="list-progress">
          <CollectionIcon size={24} />
          <p>
            {MOUNTAINS.length}곳 중 {collected.size}곳을 모았어요
          </p>
        </div>
      )}

      {(state.status === 'denied' || state.status === 'failed') && (
        <section className="notice-card">
          <LocationIcon size={24} />
          <p>
            {state.status === 'denied'
              ? '위치를 허용하면 가까운 산부터 보여드려요. 아래 버튼을 누르면 권한을 다시 물어봐요.'
              : '위치를 확인하지 못해 거리를 보여드리지 못했어요. 휴대폰 설정에서 위치 서비스가 켜져 있는지 확인한 뒤 아래 버튼을 눌러주세요.'}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {state.status === 'denied' ? '위치 허용하기' : '위치 다시 확인하기'}
          </button>
        </section>
      )}

      <label className="search">
        <Search size={20} />
        <input
          type="search"
          value={query}
          placeholder="산 이름으로 찾기"
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="chips">
        <button
          type="button"
          className={region === null ? 'chip chip-active' : 'chip'}
          onClick={() => setRegion(null)}
        >
          전체
        </button>
        {regions.map((name) => (
          <button
            key={name}
            type="button"
            className={region === name ? 'chip chip-active' : 'chip'}
            onClick={() => setRegion(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {state.status === 'loading' ? (
        <div className="skeleton-list" aria-label="가까운 산을 찾고 있어요">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : rows.length === 0 ? (
        <p className="screen-notice">'{query}'에 맞는 산이 없어요.</p>
      ) : (
        <ul className="list">
          {rows.map(({ mountain, distanceM }) => (
            <li key={mountain.id}>
              <button type="button" className="mountain-row" onClick={() => onSelect(mountain.id)}>
                <Stamp mountain={mountain} collected={collected.has(mountain.id)} size={40} />
                <span className="row-copy">
                  <strong>{mountain.name}</strong>
                  <p>
                    {mountain.elevationM}m
                    {distanceM !== undefined && ` · ${formatDistance(distanceM)}`}
                  </p>
                </span>
                <span className="row-end">
                  {collected.has(mountain.id) && <span className="badge">모음</span>}
                  <ChevronRight size={20} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 실측용. 테스트 장소를 추가할 때 이 좌표를 그대로 쓴다. 출시 번들에서는 안 나온다. */}
      {IS_FIELD_TEST_BUILD && state.status === 'ready' && (
        <p className="footnote" style={{ padding: '0 var(--space-5)' }}>
          지금 내 좌표 {state.coords.latitude.toFixed(6)}, {state.coords.longitude.toFixed(6)} ·
          정확도 {Math.round(state.coords.accuracy)}m
        </p>
      )}
    </main>
  );
}
