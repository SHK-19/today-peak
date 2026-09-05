// "오늘"은 한국 시간 기준이다. KST는 UTC+9 고정이고 서머타임이 없어서
// 시간대 라이브러리 없이 계산한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 주어진 시각이 속한 한국 날짜의 00:00을 UTC 밀리초로 준다.
export function seoulDayStartMs(nowMs: number): number {
  const kst = new Date(nowMs + KST_OFFSET_MS);
  return (
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS
  );
}

// 스탬프 목록에 쓰는 표기. 2026년 9월 5일 → "2026.09.05"
export function formatSeoulDate(isoText: string): string {
  const kst = new Date(new Date(isoText).getTime() + KST_OFFSET_MS);
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${kst.getUTCFullYear()}.${month}.${day}`;
}
