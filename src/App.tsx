import { useState } from 'react';

import { TabBar, type TabId } from './components/TabBar.tsx';
import { MOUNTAINS } from './lib/mountains.ts';
import { useSystemBack } from './lib/useSystemBack.ts';
import { Home } from './screens/Home.tsx';
import { MountainDetail } from './screens/MountainDetail.tsx';
import { MyStamps } from './screens/MyStamps.tsx';

function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = MOUNTAINS.find((mountain) => mountain.id === detailId);

  // 산 상세에서만 뒤로가기를 가로챈다. 탭 화면(최초 화면)에서는 구독하지 않아
  // 기본 동작인 미니앱 종료가 유지된다.
  useSystemBack(detail !== undefined, () => setDetailId(null));

  // 상세는 탭 위로 덮는다 — 하단 CTA가 탭바와 겹치면 안 된다.
  if (detail !== undefined) {
    return <MountainDetail mountain={detail} />;
  }

  return (
    <>
      {tab === 'home' ? (
        <Home onSelect={setDetailId} />
      ) : (
        <MyStamps stamps={[]} mountains={MOUNTAINS} />
      )}
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}

export default App;
