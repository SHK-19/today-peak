import bundled from '../data/picks.json';
import type { Pick } from './picks.ts';

// 큐레이션은 매일 GitHub Pages의 picks.json으로 갱신된다(scripts/daily-picks.sh). 앱은 시작할 때
// 그걸 받고, 못 받으면 번들에 든 사본을 쓴다. 번들 사본은 번들을 올린 날의 값이다.
const REMOTE = 'https://shk-19.github.io/today-peak/picks.json';

export const PICKS: Pick[] = (bundled as { items: Pick[] }).items;

export async function loadPicks(): Promise<Pick[]> {
  try {
    const response = await fetch(`${REMOTE}?d=${new Date().toISOString().slice(0, 10)}`);
    if (!response.ok) return PICKS;
    const body = (await response.json()) as { items?: Pick[] };
    return Array.isArray(body.items) ? body.items : PICKS;
  } catch {
    return PICKS;
  }
}
