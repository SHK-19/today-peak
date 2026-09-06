import type { Stamp } from './api.ts';
import { seasonOf, type Season } from './stamp-art.ts';

export const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_LABEL: Record<Season, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};

/** 산 하나의 계절별 인증 시각. 같은 계절을 여러 번 찍으면 첫 인증을 남긴다. */
export type SeasonRecord = Partial<Record<Season, string>>;

// 스탬프 행을 산별 → 계절별로 접는다. 컬렉션 칸 하나가 이 레코드 하나를 본다.
export function groupSeasons(stamps: Stamp[]): Map<string, SeasonRecord> {
  const byMountain = new Map<string, SeasonRecord>();
  for (const stamp of stamps) {
    const record = byMountain.get(stamp.mountainId) ?? {};
    const season = seasonOf(stamp.verifiedAt);
    const existing = record[season];
    if (existing === undefined || stamp.verifiedAt < existing) {
      record[season] = stamp.verifiedAt;
    }
    byMountain.set(stamp.mountainId, record);
  }
  return byMountain;
}

// 칸에 그릴 계절 = 가장 최근에 찍은 계절. 없으면 undefined.
export function latestSeason(record: SeasonRecord): { season: Season; verifiedAt: string } | undefined {
  let latest: { season: Season; verifiedAt: string } | undefined;
  for (const season of SEASON_ORDER) {
    const at = record[season];
    if (at !== undefined && (latest === undefined || at > latest.verifiedAt)) {
      latest = { season, verifiedAt: at };
    }
  }
  return latest;
}

export function seasonCount(record: SeasonRecord): number {
  return SEASON_ORDER.filter((season) => record[season] !== undefined).length;
}
