import type { Mountain } from './verify.ts';

// 화면에 보여줄 권역 순서. 데이터에 없는 권역은 걸러진다.
export const REGION_ORDER = ['수도권', '강원', '충청', '전라', '경상', '제주'] as const;

// region이 없는 산(실측용 테스트 장소)은 맨 뒤에 따로 모은다.
export const OTHER_REGION = '기타';

export type RegionGroup = { region: string; mountains: Mountain[] };

export function groupByRegion(mountains: Mountain[]): RegionGroup[] {
  const groups = new Map<string, Mountain[]>();
  for (const mountain of mountains) {
    const region = mountain.region ?? OTHER_REGION;
    groups.set(region, [...(groups.get(region) ?? []), mountain]);
  }

  const ordered: RegionGroup[] = [];
  for (const region of REGION_ORDER) {
    const found = groups.get(region);
    if (found !== undefined) {
      ordered.push({ region, mountains: found });
      groups.delete(region);
    }
  }
  // 순서에 없는 권역이 생기면 뒤에 붙인다. 데이터가 바뀌어도 산이 사라지지 않는다.
  for (const [region, list] of groups) {
    ordered.push({ region, mountains: list });
  }
  return ordered;
}

// 홈 필터용. 데이터에 실제로 있는 권역만 순서대로 준다.
export function regionsOf(mountains: Mountain[]): string[] {
  return groupByRegion(mountains).map((group) => group.region);
}
