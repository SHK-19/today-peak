import { useId, useState } from 'react';

import { ChevronDown, ChevronUp } from './icons.tsx';

type Props = {
  title: string;
  /** 접힌 상태에서 제목 옆에 보이는 한 줄 요약. "5곳"처럼 짧게. */
  hint?: string;
  /** 제목 오른쪽에 두는 조작(음식점·카페 전환 등). 펼쳤을 때만 보인다. */
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

// 산 상세의 정보 카드. 사진·시설·코스가 더 붙을 자리라 접어 두고 누르면 펼친다.
// 인증 버튼이 화면 아래로 밀리지 않게 하는 게 목적이다.
export function FoldCard({ title, hint, actions, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className={open ? 'fold fold-open' : 'fold'}>
      <div className="fold-head">
        <button
          type="button"
          className="fold-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          <h3>{title}</h3>
          {hint !== undefined && !open && <span className="fold-hint">{hint}</span>}
          <span className="fold-chevron">
            {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </button>
        {open && actions}
      </div>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
