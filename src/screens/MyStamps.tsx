import { Stamp } from '../components/Stamp.tsx';
import type { Stamp as StampRecord } from '../lib/api.ts';
import { formatSeoulDate } from '../lib/day.ts';
import { groupByRegion } from '../lib/region.ts';
import type { Mountain } from '../lib/verify.ts';

type Props = {
  mountains: Mountain[];
  stamps: StampRecord[] | null;
  failed: boolean;
  onRetry: () => void;
};

// 모은 것만 보여주면 목록이지 컬렉션이 아니다. 빈 칸이 보여야 다음 목표가 생긴다.
// 96곳을 한 판에 늘어놓으면 훑기 어려워서 권역으로 접는다. 접기 기능은 두지 않는다.
export function MyStamps({ mountains, stamps, failed, onRetry }: Props) {
  const collectedAt = new Map(stamps?.map((stamp) => [stamp.mountainId, stamp.verifiedAt]));
  const count = stamps === null ? 0 : collectedAt.size;

  return (
    <main className="page page-tabbed">
      <header className="collection-head">
        <h1>내 스탬프</h1>
        <p>
          {stamps === null
            ? failed
              ? '스탬프를 불러오지 못했어요'
              : '스탬프를 불러오고 있어요'
            : `${mountains.length}곳 중 ${count}곳을 모았어요`}
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
          const done = inRegion.filter((mountain) => collectedAt.has(mountain.id)).length;
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
                  const verifiedAt = collectedAt.get(mountain.id);
                  const isCollected = verifiedAt !== undefined;
                  return (
                    <li
                      key={mountain.id}
                      className={isCollected ? 'stamp-cell' : 'stamp-cell stamp-cell-empty'}
                    >
                      <Stamp mountain={mountain} collected={isCollected} verifiedAt={verifiedAt} />
                      <strong>{mountain.name}</strong>
                      <span className="caption">
                        {isCollected ? formatSeoulDate(verifiedAt) : `${mountain.elevationM}m`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
