import { Share } from '@apps-in-toss/web-framework';

import type { Mountain } from './verify.ts';

// 공유 링크의 미리보기 이미지. 콘솔에 올린 등록용 스크린샷(인증 성공)이라 공개 URL이다.
const OG_IMAGE = 'https://static.toss.im/appsintoss/90797/790be3ac-6d78-492f-af66-6d7ced3caed5.png';

// 스탬프 자랑. 링크를 열면 그 산 상세로 들어간다. intoss-private:// 는 쓰지 않는다(출시 가이드).
export async function shareMountain(mountain: Mountain, message: string): Promise<void> {
  const link = await Share.createLink({
    path: `intoss://today-peak?mountain=${encodeURIComponent(mountain.id)}`,
    ogImageUrl: OG_IMAGE,
  });
  await Share.sendMessage({ message: `${message}\n${link}` });
}
