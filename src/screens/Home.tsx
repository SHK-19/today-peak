import { GetCurrentLocationPermissionError } from '@apps-in-toss/web-framework';
import { useEffect, useState } from 'react';

import { ChevronRight } from '../components/icons.tsx';
import { formatDistance } from '../lib/format.ts';
import { haversineMeters } from '../lib/geo.ts';
import { ensureLocationPermission, readLocationOnce } from '../lib/location.ts';
import { MOUNTAINS } from '../lib/mountains.ts';
import type { Mountain } from '../lib/verify.ts';

type NearbyMountain = { mountain: Mountain; distanceM: number };

type State =
  | { status: 'loading' }
  | { status: 'denied'; note: string }
  | { status: 'failed'; note: string }
  | { status: 'ready'; nearby: NearbyMountain[] };

type Props = { onSelect: (mountainId: string) => void };

// 세션 2 진단용. 던져진 값의 정체를 그대로 드러낸다.
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.constructor.name} · name=${error.name} · ${error.message}`;
  }
  return `${typeof error} · ${String(error)}`;
}

export function Home({ onSelect }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading' });
      try {
        const permission = await ensureLocationPermission();
        if (!permission.allowed) {
          if (!cancelled) setState({ status: 'denied', note: `getPermission=${permission.status}` });
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

        if (!cancelled) setState({ status: 'ready', nearby });
      } catch (error) {
        // getPermission이 allowed를 주고도 실제 조회에서 권한 에러가 날 수 있다.
        // (OS 위치 서비스가 꺼져 있는 경우 — 2026-09-05 실기기 확인)
        if (!cancelled) {
          const isPermissionError = error instanceof GetCurrentLocationPermissionError;
          setState({
            status: isPermissionError ? 'denied' : 'failed',
            note: `조회 에러 · instanceof=${isPermissionError} · ${describeError(error)}`,
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === 'loading') {
    return (
      <main className="screen screen-tabbed">
        <p className="notice">가까운 산을 찾고 있어요</p>
      </main>
    );
  }

  if (state.status === 'denied' || state.status === 'failed') {
    const denied = state.status === 'denied';
    return (
      <main className="screen screen-tabbed">
        <h1 className="title">{denied ? '위치 권한이 필요해요' : '위치를 확인할 수 없어요'}</h1>
        <p className="notice">
          {denied
            ? '정상에 도착했는지 확인하려면 위치 정보가 필요해요. 휴대폰 설정에서 위치 권한을 허용한 뒤 아래 버튼을 눌러주세요.'
            : '휴대폰 설정에서 위치 서비스가 켜져 있는지 확인한 뒤 아래 버튼을 눌러주세요.'}
        </p>
        <div className="cta-area">
          <button type="button" className="cta" onClick={() => setAttempt((n) => n + 1)}>
            다시 확인하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen screen-tabbed">
      <h1 className="title">오늘 정상</h1>
      <p className="subtitle">가까운 산부터 보여드려요</p>

      <ul className="list">
        {state.nearby.map(({ mountain, distanceM }) => (
          <li key={mountain.id}>
            <button type="button" className="row" onClick={() => onSelect(mountain.id)}>
              <span className="row-main">
                <span className="row-title">{mountain.name}</span>
                <span className="row-meta">
                  {mountain.elevationM}m · {formatDistance(distanceM)}
                </span>
              </span>
              <ChevronRight />
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
