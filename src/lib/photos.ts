import data from '../data/photos.json';

// 산 사진. 파일은 docs/photos/{id}.jpg로 GitHub Pages가 서빙한다(공유 카드와 같은 방식).
// 원본은 한국관광공사 관광사진(공공누리 1유형, 출처 표시 필수) — 화면에 credit을 꼭 붙인다.
// 정상에서 인터넷이 안 되면 못 불러오는데, 그때는 배경색만 남고 스탬프는 그대로 보인다.
const PHOTO_BASE = 'https://shk-19.github.io/today-peak/photos';

// JSON의 url은 원본 출처(관광공사)라 화면에는 쓰지 않는다 — 우리가 줄여 올린 파일을 쓴다.
type Entry = { url: string; title: string; credit: string };
const PHOTOS = data.photos as Record<string, Entry>;

export type Photo = { url: string; title: string; credit: string };

export function photoOf(mountainId: string): Photo | null {
  const entry = PHOTOS[mountainId];
  return entry === undefined
    ? null
    : { title: entry.title, credit: entry.credit, url: `${PHOTO_BASE}/${mountainId}.jpg` };
}
