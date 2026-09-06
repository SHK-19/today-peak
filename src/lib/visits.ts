// 한 산을 다녀온 기록. 스탬프 행이 곧 방문(산당 하루 1행)이고, 같은 산에서 인증 전 24시간
// 안에 누른 산행 시작이 있으면 걸린 시간이 붙는다. 서버(my-stamps·verify-summit)와
// 클라이언트(시트·티켓)가 같은 짝짓기 규칙을 쓴다.
import { seasonOf, type Season } from './stamp-art.ts';

// api.ts를 끌어오지 않는다 — Edge Function이 이 파일을 함께 쓰는데, api.ts는 브라우저 전용이다.
type Stamp = { mountainId: string; verifiedAt: string; hikeStartedAt?: string };

export type HikeStartRow = { mountainId: string; startedAt: string };

const PAIR_WINDOW_MS = 24 * 60 * 60 * 1000;

// 인증 전 24시간 안, 같은 산의 산행 시작 중 가장 늦은 것. 한국 날짜로 자르지 않는다 —
// 야간 산행은 자정을 넘긴다.
export function hikeStartFor(
  stamp: { mountainId: string; verifiedAt: string },
  starts: HikeStartRow[],
): string | undefined {
  const verified = Date.parse(stamp.verifiedAt);
  let best: string | undefined;
  for (const start of starts) {
    if (start.mountainId !== stamp.mountainId) continue;
    const started = Date.parse(start.startedAt);
    if (started >= verified || verified - started > PAIR_WINDOW_MS) continue;
    if (best === undefined || started > Date.parse(best)) best = start.startedAt;
  }
  return best;
}

export function durationMin(startedAt: string, verifiedAt: string): number {
  return Math.max(1, Math.round((Date.parse(verifiedAt) - Date.parse(startedAt)) / 60_000));
}

// 160 → "2시간 40분", 45 → "45분", 120 → "2시간"
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

export type Visit = { verifiedAt: string; season: Season; durationMin?: number };

// 그 산의 방문 기록, 최근순.
export function visitsOf(stamps: Stamp[], mountainId: string): Visit[] {
  return stamps
    .filter((stamp) => stamp.mountainId === mountainId)
    .sort((a, b) => (a.verifiedAt < b.verifiedAt ? 1 : -1))
    .map((stamp) => ({
      verifiedAt: stamp.verifiedAt,
      season: seasonOf(stamp.verifiedAt),
      ...(stamp.hikeStartedAt === undefined
        ? {}
        : { durationMin: durationMin(stamp.hikeStartedAt, stamp.verifiedAt) }),
    }));
}
