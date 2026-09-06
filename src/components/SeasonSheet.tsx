import { Close } from './icons.tsx';
import { Stamp } from './Stamp.tsx';
import { formatSeoulDate } from '../lib/day.ts';
import {
  SEASON_LABEL,
  SEASON_ORDER,
  latestSeason,
  seasonCount,
  type SeasonRecord,
} from '../lib/seasons.ts';
import { shareMountain } from '../lib/share.ts';
import { useSystemBack } from '../lib/useSystemBack.ts';
import type { Mountain } from '../lib/verify.ts';

type Props = { mountain: Mountain; record: SeasonRecord; onClose: () => void };

// 산 하나의 사계절. 컬렉션 칸을 누르면 뜬다. "다음엔 겨울에 오자"가 생기는 자리.
export function SeasonSheet({ mountain, record, onClose }: Props) {
  useSystemBack(true, onClose);
  const done = seasonCount(record);
  // 미리보기 카드는 가장 최근에 찍은 계절로 만든다.
  const latest = latestSeason(record);

  return (
    <div className="sheet-dim" onClick={onClose} role="presentation">
      <section
        className="sheet"
        role="dialog"
        aria-label={`${mountain.name} 사계절`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <div>
            <h2>{mountain.name}</h2>
            <p>
              {done === 4 ? '사계절을 다 모았어요' : `사계절 중 ${done}곳을 모았어요`}
              {mountain.peakName != null && ` · ${mountain.peakName}`}
            </p>
          </div>
          <button type="button" className="sheet-close" aria-label="닫기" onClick={onClose}>
            <Close size={22} />
          </button>
        </header>

        <ul className="season-row">
          {SEASON_ORDER.map((season) => {
            const at = record[season];
            return (
              <li key={season} className={at === undefined ? 'season-cell season-cell-empty' : 'season-cell'}>
                <Stamp mountain={mountain} collected={at !== undefined} size={76} verifiedAt={at} />
                <strong>{SEASON_LABEL[season]}</strong>
                <span className="caption">{at === undefined ? '아직' : formatSeoulDate(at)}</span>
              </li>
            );
          })}
        </ul>

        {latest !== undefined && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 'var(--space-5)' }}
            onClick={() =>
              void shareMountain(
                mountain,
                latest.season,
                done === 4
                  ? `${mountain.name} 사계절 스탬프를 다 모았어요`
                  : `${mountain.name} ${SEASON_LABEL[latest.season]} 스탬프를 모았어요`,
              ).catch(() => {})
            }
          >
            자랑하기
          </button>
        )}
      </section>
    </div>
  );
}
