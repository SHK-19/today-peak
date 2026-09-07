// 산 시설(숲길POI). 서버가 종류별 이름 목록을 주고, 화면은 종류 순서와 라벨만 안다.
export type FacilityKind = 'parking' | 'toilet' | 'shelter' | 'spring';
export type Facilities = Partial<Record<FacilityKind, string[]>>;

export const FACILITY_ORDER: FacilityKind[] = ['parking', 'toilet', 'shelter', 'spring'];
export const FACILITY_LABEL: Record<FacilityKind, string> = {
  parking: '주차장',
  toilet: '화장실',
  shelter: '대피소',
  spring: '약수터',
};

export function facilityCount(facilities: Facilities): number {
  return FACILITY_ORDER.reduce((sum, kind) => sum + (facilities[kind]?.length ?? 0), 0);
}

// "북한산성주차장, 우이동주차장 외 3곳". 이름이 "주차장"처럼 종류와 같으면 빼고 센다 —
// "주차장, 주차장, 주차장"은 정보가 아니다.
export function summarizeNames(names: string[], label: string, max = 3): string {
  const distinct = [...new Set(names.filter((name) => name !== label && name !== ''))];
  const shown = distinct.slice(0, max).join(', ');
  const rest = names.length - Math.min(distinct.length, max);
  if (shown === '') return `${names.length}곳`;
  return rest > 0 ? `${shown} 외 ${rest}곳` : shown;
}
