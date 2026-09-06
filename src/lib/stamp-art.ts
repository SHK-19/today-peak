// 디자이너가 그린 스탬프 그림 층(SVG 문자열)을 렌더 조건에 맞게 고친다. 순수 함수.
//
//   - id 접두사: 같은 화면에 스탬프가 96개 그려지므로 filter·gradient·symbol id가 겹친다.
//   - 40px: 잔장식(lg-only)과 질감 필터를 뺀다. 작으면 뭉개지기만 한다.
//   - 미모음: 모음 전용(collected-only)을 빼고 모든 색을 단색으로 바꿔 "빈 자리"로 만든다.
//
// 규칙의 출처: design/stamps/docs/INTEGRATION.md

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const EMPTY_INK = '#D4DACE';
// 40px(홈 목록)에서는 흐린 회색이 빈 원으로 보여서 한 단계 진하게. 컬렉션 76px은 원래 값.
export const EMPTY_INK_SMALL = '#B8C0B2';
export function emptyInkFor(size: number): string {
  return size <= 40 ? EMPTY_INK_SMALL : EMPTY_INK;
}

// 인증 시각의 한국 시간 월로 계절을 정한다. 한 번 찍힌 스탬프의 계절은 바뀌지 않는다.
export function seasonOf(verifiedAt: string): Season {
  const month = new Date(new Date(verifiedAt).getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// class에 name이 들어간 <g> 그룹을 짝이 맞는 </g>까지 통째로 지운다.
// 정규식 하나로는 중첩을 못 다루므로 여는·닫는 태그를 세면서 간다.
export function removeGroups(markup: string, className: string): string {
  let out = markup;
  for (;;) {
    const open = /<g\b[^>]*\bclass="[^"]*"[^>]*>/g;
    let match: RegExpExecArray | null;
    let start = -1;
    while ((match = open.exec(out)) !== null) {
      const cls = /class="([^"]*)"/.exec(match[0])?.[1] ?? '';
      if (cls.split(/\s+/).includes(className)) {
        start = match.index;
        break;
      }
    }
    if (start === -1) {
      return out;
    }
    // start부터 태그를 세어 짝 닫힘을 찾는다.
    const tag = /<g\b[^>]*>|<\/g>/g;
    tag.lastIndex = start;
    let depth = 0;
    let end = -1;
    let t: RegExpExecArray | null;
    while ((t = tag.exec(out)) !== null) {
      depth += t[0].startsWith('</') ? -1 : 1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    if (end === -1) {
      throw new Error(`닫히지 않은 <g class="${className}">`);
    }
    out = out.slice(0, start) + out.slice(end);
  }
}

// id="x" · url(#x) · href="#x" 세 자리에 접두사를 붙인다.
export function prefixIds(markup: string, prefix: string): string {
  return markup
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${prefix}${id})`)
    .replace(/href="#([^"]+)"/g, (_, id: string) => `href="#${prefix}${id}"`);
}

// 모든 칠·선을 한 색으로. 불투명도도 없애서 앞뒤 능선이 한 덩어리가 된다.
export function monochrome(markup: string, color: string): string {
  return markup
    .replace(/\bfill="(?!none")[^"]*"/g, `fill="${color}"`)
    .replace(/\bstroke="(?!none")[^"]*"/g, `stroke="${color}"`)
    .replace(/\s(?:fill-)?opacity="[^"]*"/g, '');
}

export function stripFilters(markup: string): string {
  return markup.replace(/\sfilter="url\(#[^"]*\)"/g, '');
}

export type PrepareOptions = { prefix: string; size: number; collected: boolean };

export function prepareArt(markup: string, { prefix, size, collected }: PrepareOptions): string {
  const ink = emptyInkFor(size);
  let out = markup;
  if (size < 76) {
    out = removeGroups(out, 'lg-only');
  }
  if (!collected) {
    out = removeGroups(out, 'collected-only');
  }
  if (size < 76 || !collected) {
    out = stripFilters(out);
  }
  if (!collected) {
    out = monochrome(out, ink);
  }
  return prefixIds(out, prefix);
}
