import { getSchemeUri } from '@apps-in-toss/web-framework';
import { useCallback, useEffect, useState } from 'react';

import { TabBar, type TabId } from './components/TabBar.tsx';
import { fetchMyStamps, type Stamp } from './lib/api.ts';
import { restoreSession, setSessionLostHandler } from './lib/auth.ts';
import { HOME_ENTRY, parseEntry } from './lib/entry.ts';
import { MOUNTAINS } from './lib/mountains.ts';
import { groupSeasons } from './lib/seasons.ts';
import { useSystemBack } from './lib/useSystemBack.ts';
import { Home } from './screens/Home.tsx';
import { Login } from './screens/Login.tsx';
import { MountainDetail } from './screens/MountainDetail.tsx';
import { MyStamps } from './screens/MyStamps.tsx';

// 스킴 진입점(주요 기능·공유 링크). 앱을 켤 때 한 번만 읽는다. 실패하면 홈.
function readEntry() {
  try {
    return parseEntry(getSchemeUri());
  } catch {
    return HOME_ENTRY;
  }
}

function App() {
  const [entry] = useState(readEntry);
  const [session, setSession] = useState<'checking' | 'none' | 'ok'>('checking');
  const [tab, setTab] = useState<TabId>(entry.tab);
  const [detailId, setDetailId] = useState<string | null>(() =>
    MOUNTAINS.some((mountain) => mountain.id === entry.mountainId) ? entry.mountainId : null,
  );
  // 스탬프는 세 화면이 같이 본다 — 홈의 획득 배지, 컬렉션 그리드, 산 상세의 획득 여부.
  // 한 곳에서 한 번만 불러온다.
  const [stamps, setStamps] = useState<Stamp[] | null>(null);
  const [stampsFailed, setStampsFailed] = useState(false);
  const detail = MOUNTAINS.find((mountain) => mountain.id === detailId);

  // 서버가 세션을 거절하면(만료·연결 끊기) 로그인 화면으로 되돌린다.
  useEffect(() => {
    setSessionLostHandler(() => {
      setDetailId(null);
      setStamps(null);
      setSession('none');
    });
  }, []);

  // 저장된 세션이 있으면 로그인 화면을 건너뛴다. 확인에 실패해도 앱이 죽지 않고
  // 로그인 화면으로 간다.
  useEffect(() => {
    restoreSession()
      .then((token) => setSession(token === null ? 'none' : 'ok'))
      .catch(() => setSession('none'));
  }, []);

  // 이 호출이 세션 확인을 겸한다. 서버가 401을 주면 api가 로그인 화면으로 되돌린다.
  const loadStamps = useCallback(async () => {
    try {
      setStamps(await fetchMyStamps());
      setStampsFailed(false);
    } catch {
      setStampsFailed(true);
    }
  }, []);

  useEffect(() => {
    if (session === 'ok') {
      void loadStamps();
    }
  }, [session, loadStamps]);

  // 산 상세에서만 뒤로가기를 가로챈다. 탭 화면(최초 화면)에서는 구독하지 않아
  // 기본 동작인 미니앱 종료가 유지된다.
  useSystemBack(detail !== undefined, () => setDetailId(null));

  if (session === 'checking') {
    return (
      <main className="page">
        <p className="screen-notice">잠시만 기다려 주세요</p>
      </main>
    );
  }

  if (session === 'none') {
    return <Login onDone={() => setSession('ok')} />;
  }

  // 상세는 탭 위로 덮는다 — 하단 CTA가 탭바와 겹치면 안 된다.
  if (detail !== undefined) {
    return (
      <MountainDetail
        mountain={detail}
        seasons={groupSeasons(stamps ?? []).get(detail.id) ?? {}}
        collectedCount={groupSeasons(stamps ?? []).size}
        totalCount={MOUNTAINS.length}
        onVerified={() => void loadStamps()}
        onGoToStamps={() => {
          setDetailId(null);
          setTab('stamps');
        }}
      />
    );
  }

  return (
    <>
      {tab === 'home' ? (
        <Home onSelect={setDetailId} stamps={stamps} openNearestOnce={entry.verifyNearest} />
      ) : (
        <MyStamps
          mountains={MOUNTAINS}
          stamps={stamps}
          failed={stampsFailed}
          onRetry={() => void loadStamps()}
        />
      )}
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}

export default App;
