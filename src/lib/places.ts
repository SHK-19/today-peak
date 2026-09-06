// 산 근처 음식점. 네이버 지역 검색 결과를 화면에 쓸 모양으로 다듬는다. 순수 함수.
//
// 서버(mountain-stats)가 네이버를 부르고 이 함수로 정리해서 내려준다.
// 좌표·주소를 우리 DB에 쌓지 않는다 — 매번 조회하고 화면에만 쓴다.

export type Place = { name: string; category: string; address: string };

type NaverItem = {
  title?: string;
  category?: string;
  roadAddress?: string;
  address?: string;
};

// 네이버 title에 <b>검색어</b> 강조 태그가 들어온다.
export function stripTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// "음식점>한식>백반,가정식" → "한식". 맨 앞 "음식점"은 버리고 두 번째 칸만 쓴다.
export function shortCategory(category: string): string {
  const parts = category.split('>').map((part) => part.trim()).filter(Boolean);
  const meaningful = parts.filter((part) => part !== '음식점');
  return meaningful[0] ?? parts[0] ?? '';
}

// "서울특별시 강북구 삼양로181길 142 옥류헌릴렉스" → "강북구 삼양로181길". 동네만 알면 된다.
export function shortAddress(address: string): string {
  const parts = address.split(/\s+/).filter(Boolean);
  return parts.slice(1, 3).join(' ');
}

export function toPlaces(items: NaverItem[]): Place[] {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const item of items) {
    const name = stripTags(item.title ?? '');
    if (name === '' || seen.has(name)) {
      continue;
    }
    seen.add(name);
    places.push({
      name,
      category: shortCategory(item.category ?? ''),
      address: shortAddress(item.roadAddress ?? item.address ?? ''),
    });
  }
  return places;
}

// 검색어 후보. 들머리 이름을 붙이면 사람이 실제로 내려오는 동네가 잡히지만,
// "우이령길 사전예약 입구"처럼 긴 이름은 결과가 0이라 산 이름만으로 한 번 더 찾는다.
// 앞에서부터 시도하고 결과가 있는 첫 검색어를 쓴다.
export function placesQueries(mountainName: string, trailheadName?: string): string[] {
  const base = mountainName.replace(/\(.*\)/, '').trim();
  const queries: string[] = [];
  if (trailheadName !== undefined) {
    // 들머리 이름에서 "입구·탐방지원센터·주차장" 같은 꼬리말을 떼고 앞 두 단어만 쓴다.
    const place = trailheadName
      .replace(/(입구|입출구|탐방지원센터|탐방안내소|안내소|주차장|매표소|사전예약|코스|등산로)/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(' ');
    if (place !== '') {
      queries.push(`${place} 맛집`);
    }
  }
  queries.push(`${base} 맛집`);
  return queries;
}
