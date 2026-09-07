// 등산 코스(서버 courses 테이블)의 화면용 규칙. 숫자는 서버가 주고 여기서는 표기만 정한다.
export type CourseSummary = {
  id: string;
  name: string;
  startName: string | null;
  peakName: string | null;
  peakEleM: number | null;
  distanceM: number;
  ascentM: number;
  minutes: number;
  kcal: number;
  difficulty: '초급' | '중급' | '상급';
  isLoop: boolean;
};

export type CoursePoi = { kind: string; name: string; lat: number; lng: number };
export type CourseDetail = CourseSummary & { descentM: number; maxEleM: number; pois: CoursePoi[] };

// 160 → "3시간 41분", 45 → "45분"
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

// 9210 → "9.2km", 850 → "850m"
export function formatKm(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}

// 지점 종류를 화면 묶음으로. GPX category → 라벨. 순서가 곧 표시 순서.
export const POI_GROUPS: { label: string; kinds: string[] }[] = [
  { label: '교통', kinds: ['TRANS'] },
  { label: '주차', kinds: ['PARK'] },
  { label: '편의', kinds: ['TOILET', 'SPRING', 'SHELTER', 'STORE', 'FOOD', 'CAMP', 'REST', 'INFO'] },
  { label: '볼거리', kinds: ['VIEW', 'SCENERY', 'CULTURAL'] },
  { label: '주의', kinds: ['DANGER'] },
];

export function groupPois(pois: CoursePoi[]): { label: string; names: string[] }[] {
  return POI_GROUPS.map(({ label, kinds }) => ({
    label,
    names: [...new Set(pois.filter((p) => kinds.includes(p.kind)).map((p) => p.name))],
  })).filter((group) => group.names.length > 0);
}
