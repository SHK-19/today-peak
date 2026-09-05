export type TabId = 'home' | 'stamps';

const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: '오늘 정상' },
  { id: 'stamps', label: '스탬프' },
];

type Props = { active: TabId; onChange: (id: TabId) => void };

// 앱인토스 UI/UX 가이드: 탭바를 쓰려면 화면 하단에 붙는 형태가 아니라
// 떠 있는(플로팅) 형태여야 한다. 토스 본체 하단 탭과 구분되어야 하기 때문.
export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === active ? 'tab tab-active' : 'tab'}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
