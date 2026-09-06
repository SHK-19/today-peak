import { SEASON_LABEL, SEASON_ORDER, type SeasonRecord } from '../lib/seasons.ts';

// 봄·여름·가을·겨울 점 4개. 모은 계절만 색이 찬다. 칸 하나에서 "무슨 계절이 남았나"가 읽힌다.
export function SeasonDots({ record }: { record: SeasonRecord }) {
  return (
    <span
      className="dots"
      aria-label={SEASON_ORDER.map((s) => `${SEASON_LABEL[s]} ${record[s] ? '모음' : '미모음'}`).join(', ')}
    >
      {SEASON_ORDER.map((season) => (
        <span
          key={season}
          className={record[season] !== undefined ? `dot dot-${season}` : 'dot'}
        />
      ))}
    </span>
  );
}
