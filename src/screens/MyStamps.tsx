import { Stamp } from '../components/Stamp.tsx';
import type { Stamp as StampRecord } from '../lib/api.ts';
import { formatSeoulDate } from '../lib/day.ts';
import type { Mountain } from '../lib/verify.ts';

type Props = {
  mountains: Mountain[];
  stamps: StampRecord[] | null;
  failed: boolean;
  onRetry: () => void;
};

// 모은 것만 보여주면 목록이지 컬렉션이 아니다. 빈 칸이 보여야 다음 목표가 생긴다.
export function MyStamps({ mountains, stamps, failed, onRetry }: Props) {
  if (failed) {
    return (
      <main className="screen screen-tabbed">
        <h1 className="title">내 스탬프</h1>
        <p className="notice">
          스탬프를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.
        </p>
        <div className="cta-area">
          <button type="button" className="cta" onClick={onRetry}>
            다시 불러오기
          </button>
        </div>
      </main>
    );
  }

  if (stamps === null) {
    return (
      <main className="screen screen-tabbed">
        <h1 className="title">내 스탬프</h1>
        <p className="notice">스탬프를 불러오고 있어요</p>
      </main>
    );
  }

  const collectedAt = new Map(stamps.map((stamp) => [stamp.mountainId, stamp.verifiedAt]));

  return (
    <main className="screen screen-tabbed">
      <h1 className="title">내 스탬프</h1>
      <p className="subtitle">
        {mountains.length}곳 중 {collectedAt.size}곳을 모았어요
      </p>

      <div
        className="progress"
        role="progressbar"
        aria-valuenow={collectedAt.size}
        aria-valuemin={0}
        aria-valuemax={mountains.length}
      >
        <span
          className="progress-fill"
          style={{ width: `${(collectedAt.size / mountains.length) * 100}%` }}
        />
      </div>

      {collectedAt.size === 0 && (
        <p className="notice">정상에 도착해서 인증하면 여기 빈 자리가 하나씩 채워져요.</p>
      )}

      <ul className="stamp-grid">
        {mountains.map((mountain) => {
          const verifiedAt = collectedAt.get(mountain.id);
          return (
            <li key={mountain.id} className="stamp-cell">
              <Stamp
                mountain={mountain}
                collected={verifiedAt !== undefined}
                verifiedAt={verifiedAt}
              />
              <span className={verifiedAt !== undefined ? 'stamp-name' : 'stamp-name stamp-name-empty'}>
                {mountain.name}
              </span>
              <span className="stamp-date">
                {verifiedAt === undefined ? `${mountain.elevationM}m` : formatSeoulDate(verifiedAt)}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
