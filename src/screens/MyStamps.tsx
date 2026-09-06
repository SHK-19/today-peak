import { useState } from 'react';

import { SeasonDots } from '../components/SeasonDots.tsx';
import { SeasonSheet } from '../components/SeasonSheet.tsx';
import { Stamp } from '../components/Stamp.tsx';
import type { Stamp as StampRecord } from '../lib/api.ts';
import { COLLECTIONS, collectionOf, type CollectionId } from '../lib/collection.ts';
import { formatSeoulDate } from '../lib/day.ts';
import { groupByRegion } from '../lib/region.ts';
import { askReview, canReview } from '../lib/review.ts';
import { groupSeasons, latestSeason, seasonCount } from '../lib/seasons.ts';
import type { Mountain } from '../lib/verify.ts';

type Props = {
  mountains: Mountain[];
  stamps: StampRecord[] | null;
  failed: boolean;
  onRetry: () => void;
};

// 모은 것만 보여주면 목록이지 컬렉션이 아니다. 빈 칸이 보여야 다음 목표가 생긴다.
// 96곳을 한 판에 늘어놓으면 훑기 어려워서 권역으로 접는다. 접기 기능은 두지 않는다.
// 칸은 산당 하나. 계절은 칸 안의 점 4개로 보여주고, 누르면 사계절 시트가 뜬다.
export function MyStamps({ mountains: allMountains, stamps, failed, onRetry }: Props) {
  // 컬렉션 두 판을 따로 센다. 100대 명산 96곳에 동네 산을 섞으면 완주의 의미가 흐려진다.
  const [collection, setCollection] = useState<CollectionId>('top100');
  const mountains = allMountains.filter((mountain) => collectionOf(mountain) === collection);
  const inThis = new Set(mountains.map((mountain) => mountain.id));
  const seasons = new Map(
    [...groupSeasons(stamps ?? [])].filter(([mountainId]) => inThis.has(mountainId)),
  );
  const count = stamps === null ? 0 : seasons.size;
  const fourSeasons = [...seasons.values()].filter((record) => seasonCount(record) === 4).length;
  const [open, setOpen] = useState<Mountain | null>(null);

  return (
    <main className="page page-tabbed">
      <header className="collection-head">
        <h1>내 스탬프</h1>
        <div className="segment" role="tablist">
          {COLLECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === collection}
              className={item.id === collection ? 'segment-item segment-active' : 'segment-item'}
              onClick={() => setCollection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p>
          {stamps === null
            ? failed
              ? '스탬프를 불러오지 못했어요'
              : '스탬프를 불러오고 있어요'
            : `${mountains.length}곳 중 ${count}곳을 모았어요${fourSeasons > 0 ? ` · 사계절 완성 ${fourSeasons}곳` : ''}`}
        </p>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={count}
          aria-valuemin={0}
          aria-valuemax={mountains.length}
        >
          <span className="progress-fill" style={{ width: `${(count / mountains.length) * 100}%` }} />
        </div>

        {failed && stamps === null && (
          <div className="empty-intro">
            인터넷 연결을 확인한 뒤 다시 시도해 주세요.
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 'var(--space-3)' }}
              onClick={onRetry}
            >
              다시 불러오기
            </button>
          </div>
        )}
        {stamps !== null && count === 0 && (
          <p className="empty-intro">정상에 도착해서 인증하면 여기 빈 자리가 하나씩 채워져요.</p>
        )}
      </header>

      <div className="collection-main">
        {groupByRegion(mountains).map(({ region, mountains: inRegion }) => {
          const done = inRegion.filter((mountain) => seasons.has(mountain.id)).length;
          return (
            <section key={region} className="region">
              <h3 className="section-title">
                {region}
                <span>
                  {done} / {inRegion.length}
                </span>
              </h3>

              <ul className="grid">
                {inRegion.map((mountain) => {
                  const record = seasons.get(mountain.id) ?? {};
                  const latest = latestSeason(record);
                  return (
                    <li key={mountain.id}>
                      <button
                        type="button"
                        className={latest === undefined ? 'stamp-cell stamp-cell-empty' : 'stamp-cell'}
                        onClick={() => setOpen(mountain)}
                      >
                        <Stamp
                          mountain={mountain}
                          collected={latest !== undefined}
                          verifiedAt={latest?.verifiedAt}
                        />
                        <strong>{mountain.name}</strong>
                        <span className="caption">
                          {latest === undefined ? `${mountain.elevationM}m` : formatSeoulDate(latest.verifiedAt)}
                        </span>
                        <SeasonDots record={record} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* 리뷰는 여기서만 직접 물어본다. 스탬프를 보고 있을 때가 가장 기분 좋은 순간이다. */}
      {canReview() && (
        <section className="review-ask">
          <p>오늘 정상, 쓸 만한가요?</p>
          <button type="button" className="btn btn-secondary" onClick={askReview}>
            앱 평가하기
          </button>
        </section>
      )}

      {open !== null && (
        <SeasonSheet mountain={open} record={seasons.get(open.id) ?? {}} onClose={() => setOpen(null)} />
      )}
    </main>
  );
}
