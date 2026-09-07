import { useState } from 'react';

import {
  PICK_DISCLOSURE,
  SALE_BADGE_MIN,
  byCategory,
  pickCategories,
  type Pick,
  type PickCategory,
} from '../lib/picks.ts';

// 등산 준비물 큐레이션. 카테고리별 편집이지 상품 목록이 아니다 —
// 가격을 쌓아 비교·나열하는 형태는 쉐어링크 정책에서 막는다.
// PICKS가 비면 App이 이 탭 자체를 렌더하지 않는다.
export function Picks({ items, onOpen }: { items: Pick[]; onOpen: (pick: Pick) => void }) {
  const [category, setCategory] = useState<PickCategory | null>(null);
  const categories = pickCategories(items);
  const shown = byCategory(items, category);

  return (
    <main className="page page-tabbed">
      <header className="page-head">
        <h1>오늘 Pick</h1>
        <p>산에 가기 전 챙기면 좋은 것들을 골랐어요</p>
      </header>

      <p className="footnote" style={{ padding: '0 var(--space-5) var(--space-3)' }}>
        {PICK_DISCLOSURE}
      </p>

      <div className="chips">
        <button
          type="button"
          className={category === null ? 'chip chip-active' : 'chip'}
          onClick={() => setCategory(null)}
        >
          전체
        </button>
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            className={category === name ? 'chip chip-active' : 'chip'}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <ul className="pick-grid">
        {shown.map((pick) => (
          <li key={pick.id}>
            <button type="button" className="pick-card" onClick={() => onOpen(pick)}>
              {pick.imageUrl === undefined ? (
                <span className="pick-img pick-img-empty" aria-hidden="true" />
              ) : (
                <img className="pick-img" src={pick.imageUrl} alt="" loading="lazy" />
              )}
              <strong>{pick.name}</strong>
              <span>
                {pick.dealEndsAt !== undefined ? (
                  <em className="pick-sale">오늘만 특가</em>
                ) : (
                  pick.discountRate !== undefined &&
                  pick.discountRate >= SALE_BADGE_MIN && <em className="pick-sale">{pick.discountRate}% 특가</em>
                )}
                {pick.priceText ?? '토스쇼핑에서 확인'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
