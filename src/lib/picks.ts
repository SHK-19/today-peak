// 토스쇼핑 쉐어링크로 연결하는 등산 준비물 큐레이션.
// 운영자가 고른 20~30개를 카테고리로 묶는다. 가격을 쌓아 비교·나열하지 않는다(쉐어링크 정책).
// 링크는 어드민에서 발급한 쉐어링크만 쓴다. 목록이 비면 화면 자체를 그리지 않는다.

export const PICK_CATEGORIES = ['장비', '의류', '음식', '안전'] as const;
export type PickCategory = (typeof PICK_CATEGORIES)[number];

export type Pick = {
  id: string;
  name: string;
  category: PickCategory;
  /** 토스쇼핑 쉐어링크(shortUrl). 이 링크로 들어간 구매만 수익이 잡힌다. */
  link: string;
  /** 썸네일 URL. 저장하지 않고 API/어드민이 준 주소를 그대로 쓴다. */
  imageUrl?: string;
  /** "24,900원". 없으면 화면에서 "토스쇼핑에서 확인"으로 대체한다. */
  priceText?: string;
  /** 정가 대비 할인율(%). 발급 시점 값이라 오늘 Pick 탭에서만 배지로 쓴다. 10% 이상만 기록. */
  discountRate?: number;
  /** 이 물건이 특히 어울리는 계절·상황. 산 상세에서 3개를 고를 때 쓴다. */
  seasons?: ('spring' | 'summer' | 'autumn' | 'winter')[];
  /** 고도 이 값 이상인 산에서 우선 보여준다. */
  minElevationM?: number;
  /** 하루특가 종료 시각(ISO). 지나면 화면에서 뺀다. */
  dealEndsAt?: string;
};

/** 하루특가가 끝난 항목을 뺀다. 번들이 정적이라 화면에서 걸러야 어제 특가가 남지 않는다. */
export function withoutExpired(items: Pick[], now: number): Pick[] {
  return items.filter((item) => item.dealEndsAt === undefined || Date.parse(item.dealEndsAt) > now);
}

/** 할인 배지 기준. 토스쇼핑 정가는 부풀려진 게 많아 중앙값이 38%라, 절반 이상 깎인 것만 "특가"로 본다. */
export const SALE_BADGE_MIN = 50;

/** 쉐어링크 정책상 상품 가까이에 항상 붙어야 하는 고지. */
export const PICK_DISCLOSURE = '토스쇼핑 쉐어링크 활동으로, 링크 구매 시 수수료를 지급받습니다.';

export function byCategory(items: Pick[], category: PickCategory | null): Pick[] {
  return category === null ? items : items.filter((item) => item.category === category);
}

/** 데이터에 실제로 있는 카테고리만 순서대로. */
export function pickCategories(items: Pick[]): PickCategory[] {
  return PICK_CATEGORIES.filter((category) => items.some((item) => item.category === category));
}

/**
 * 산 상세에 보여줄 몇 개. 그 산의 계절·고도에 맞는 것을 앞에 둔다.
 * 조건이 맞는 게 모자라면 나머지로 채운다 — 칸이 비면 카드가 어색하다.
 */
export function picksForMountain(
  items: Pick[],
  options: { season: 'spring' | 'summer' | 'autumn' | 'winter'; elevationM: number; count?: number },
): Pick[] {
  const { season, elevationM, count = 3 } = options;
  const score = (item: Pick) =>
    (item.seasons?.includes(season) === true ? 2 : 0) +
    (item.minElevationM !== undefined && elevationM >= item.minElevationM ? 1 : 0);
  return [...items]
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .map((entry) => entry.item);
}
