import { Share, openURL } from '@apps-in-toss/web-framework';

import { track } from './track.ts';

import type { Season } from './stamp-art.ts';
import type { Mountain } from './verify.ts';

// 미리보기 이미지는 산 × 계절로 미리 구워 둔다(scripts/build-og.mjs → docs/og, GitHub Pages).
// 파일 이름 규칙이 곧 URL이라 매핑 파일이 없다. 산이나 스탬프 그림이 바뀌면 다시 굽는다.
const OG_BASE = 'https://shk-19.github.io/today-peak/og';

// 스탬프 자랑. 링크를 열면 그 산 상세로 들어간다. intoss-private:// 는 쓰지 않는다(출시 가이드).
export async function shareMountain(
  mountain: Mountain,
  season: Season,
  message: string,
): Promise<void> {
  track('share', { mountain_id: mountain.id, season });
  const link = await Share.createLink({
    path: `intoss://today-peak?mountain=${encodeURIComponent(mountain.id)}`,
    ogImageUrl: `${OG_BASE}/${mountain.id}-${season}.png`,
  });
  await Share.sendMessage({ message: `${message}\n${link}` });
}

// 토스쇼핑 쉐어링크 열기. 이용자가 카드를 눌렀을 때만 부른다(자동 실행 금지).
export function openPick(pick: { id: string; link: string; category: string }): void {
  track('pick_click', { pick_id: pick.id, category: pick.category });
  void openURL(pick.link).catch(() => {});
}
