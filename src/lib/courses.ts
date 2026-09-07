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
export type CourseDetail = CourseSummary & {
  descentM: number;
  maxEleM: number;
  pois: CoursePoi[];
  /** 간략화한 트랙 [[lat, lng], …]. 지도 위에 선으로 그린다. */
  track: [number, number][];
};

// ---- 지도. 네이버 정적 지도(웹 메르카토르 256px 타일) 위에 트랙을 SVG로 겹친다.
// 정적 지도는 선을 못 그리고, 동적 지도는 SDK를 실어야 해서 이 방식이 가장 가볍다.

export const MAP_W = 360;
export const MAP_H = 220;

function project(lat: number, lng: number, zoom: number): [number, number] {
  const n = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return [x, y];
}

export type MapFrame = { centerLat: number; centerLng: number; zoom: number; points: [number, number][] };

// 트랙이 MAP_W×MAP_H 안에 여백을 두고 들어가는 가장 큰 줌을 고르고, 픽셀 좌표를 돌려준다.
export function mapFrame(track: [number, number][]): MapFrame | null {
  if (track.length < 2) return null;
  const lats = track.map((p) => p[0]);
  const lngs = track.map((p) => p[1]);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const pad = 24;
  let zoom = 16;
  for (; zoom > 8; zoom -= 1) {
    const [x0, y0] = project(Math.max(...lats), Math.min(...lngs), zoom);
    const [x1, y1] = project(Math.min(...lats), Math.max(...lngs), zoom);
    if (x1 - x0 <= MAP_W - pad * 2 && y1 - y0 <= MAP_H - pad * 2) break;
  }
  const [cx, cy] = project(centerLat, centerLng, zoom);
  const points = track.map(([lat, lng]) => {
    const [x, y] = project(lat, lng, zoom);
    return [x - cx + MAP_W / 2, y - cy + MAP_H / 2] as [number, number];
  });
  return { centerLat, centerLng, zoom, points };
}

// 네이버 정적 지도 URL. Referer 인증(raster-cors)이라 키 ID가 클라이언트에 있어도 된다 —
// 콘솔에 등록한 웹 서비스 URL에서만 동작한다. 키가 없으면 지도 없이 트랙만 그린다.
export function staticMapUrl(frame: MapFrame, keyId: string | undefined): string | null {
  if (keyId === undefined || keyId === '') return null;
  const q = new URLSearchParams({
    w: String(MAP_W),
    h: String(MAP_H),
    center: `${frame.centerLng},${frame.centerLat}`,
    level: String(frame.zoom),
    scale: '2',
    format: 'png',
    'X-NCP-APIGW-API-KEY-ID': keyId,
  });
  return `https://naveropenapi.apigw.ntruss.com/map-static/v2/raster-cors?${q.toString()}`;
}

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
