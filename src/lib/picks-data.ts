import data from '../data/picks.json';

import type { Pick } from './picks.ts';

// 데이터만 여기서 읽는다 — picks.ts는 순수 함수라 Node 테스트에서 그대로 부른다.
// 승인 전에는 items가 비어 있고, 그러면 '오늘 Pick' 탭과 '추천 물건' 카드가 렌더되지 않는다.
export const PICKS = data.items as Pick[];
