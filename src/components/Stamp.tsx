import { useId } from 'react';

import stampArt from '../data/stamp-art.json';
import { EMPTY_INK, prepareArt, seasonOf, type Season } from '../lib/stamp-art.ts';
import type { Mountain } from '../lib/verify.ts';

// 스탬프는 두 갈래다.
//   1. 디자이너가 그린 산 (design/stamps → src/data/stamp-art.json): 실제 랜드마크·계절 그림.
//   2. 나머지: 산 데이터에서 도형을 만든다 — id로 능선 모양을, 고도로 색을 정한다.
// 링·하늘·해는 둘 다 여기서 그린다. 규칙: design/DESIGN.md "스탬프", design/stamps/docs/INTEGRATION.md.

type ArtEntry = { name: string; sun: [number, number]; seasons: Record<Season, string> };
const ART = stampArt.art as unknown as Record<string, ArtEntry>;
const SKY = stampArt.sky as Record<Season, string>;
const WINTER = stampArt.winter;
// 봄·여름·가을의 능선 그라데이션(위→아래). 겨울은 고도색 하나.
const PALETTE = stampArt.palette as Record<Exclude<Season, 'winter'>, string[]>;

function hashOf(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

type Point = [number, number];

// 기본 능선 4종. 실제 지형이 아니라 상징적인 산 모양이다.
const RIDGES: Point[][] = [
  [[20, 117], [44, 91], [60, 83], [83, 51], [96, 69], [113, 83], [127, 79], [143, 107], [162, 122]],
  [[19, 118], [38, 101], [57, 61], [72, 80], [88, 48], [107, 85], [124, 74], [145, 109], [162, 124]],
  [[18, 128], [38, 98], [57, 87], [78, 67], [97, 57], [114, 83], [134, 95], [159, 123]],
  [[19, 124], [39, 92], [57, 99], [74, 70], [89, 49], [108, 84], [124, 81], [145, 113], [161, 127]],
];

// 능선 색은 고도가 정한다. 높을수록 짙어져서 컬렉션을 훑으면 높이가 보인다.
function colorOf(elevationM: number): string {
  if (elevationM >= 1500) return WINTER.ridgeByElevation['1500andAbove'];
  if (elevationM >= 1000) return WINTER.ridgeByElevation['1000to1499'];
  if (elevationM >= 600) return WINTER.ridgeByElevation['600to999'];
  return WINTER.ridgeByElevation.under600;
}

// seed로 기본 능선을 고르고 꼭짓점을 조금씩 흔든다. 양 끝점은 고정이라 원 밖으로 안 나간다.
function ridgeOf(seed: number): Point[] {
  return RIDGES[seed % RIDGES.length].map(([x, y], index, all) => {
    const inner = index > 0 && index < all.length - 1;
    return inner ? [x + ((seed * 19 + index * 7) % 9) - 4, y + ((seed * 13 + index * 3) % 11) - 5] : [x, y];
  });
}

const PAPER = '#FCFBF7';
const SUN = '#E8622C';

type Props = {
  mountain: Pick<Mountain, 'id' | 'name' | 'elevationM'>;
  collected: boolean;
  size?: number;
  /** 인증 시각(ISO). 있으면 그 계절로 그린다. 없으면 가을. */
  verifiedAt?: string;
  className?: string;
};

// 절차적 스탬프의 그림 층. 디자이너 그림이 없는 산에 쓴다.
// 계절 규칙은 디자이너 납품과 같다: 봄·여름·가을은 팔레트 그라데이션, 겨울은 고도색.
// 눈은 겨울에만, 봄엔 1500m 이상 잔설만.
function ProceduralArt({
  mountain,
  collected,
  size,
  seed,
  season,
  gradientId,
}: {
  mountain: Props['mountain'];
  collected: boolean;
  size: number;
  seed: number;
  season: Season;
  gradientId: string;
}) {
  const ridge = ridgeOf(seed);
  const ridgePath = `${ridge.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')} L170 180 H10Z`;
  const winterColor = colorOf(mountain.elevationM);
  const stops = season === 'winter' ? null : PALETTE[season];
  const color = stops === null ? winterColor : `url(#${gradientId})`;
  const backColor = stops === null ? winterColor : stops[stops.length - 1];
  const peak = ridge.reduce((a, b) => (a[1] < b[1] ? a : b));
  const detailed = collected && size >= 76;
  const snow =
    collected &&
    (season === 'winter' ? mountain.elevationM >= 1000 : season === 'spring' && mountain.elevationM >= 1500);

  // 종이 위 잉크 입자. 큰 사이즈의 모음 스탬프에만 찍는다.
  const grains = detailed
    ? Array.from({ length: 24 }, (_, i) => {
        const angle = ((i * 137.5 + seed * 31) * Math.PI) / 180;
        const radius = 35 + ((i * 17) % 43);
        return (
          <circle
            key={i}
            cx={90 + Math.cos(angle) * radius}
            cy={90 + Math.sin(angle) * radius}
            r={i % 3 === 0 ? 1.1 : 0.65}
            fill={PAPER}
            opacity="0.3"
          />
        );
      })
    : null;

  return (
    <>
      {stops !== null && collected && (
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="45" x2="0" y2="165">
          {stops.map((stop, i) => (
            <stop key={stop} offset={i / (stops.length - 1)} stopColor={stop} />
          ))}
        </linearGradient>
      )}
      <path d={ridgePath} fill={collected ? color : EMPTY_INK} />
      {snow && (
        <path
          d={`M${peak[0] - 15} ${peak[1] + 20}L${peak[0]} ${peak[1]}L${peak[0] + 16} ${peak[1] + 22}L${peak[0] + 4} ${peak[1] + 16}L${peak[0] - 3} ${peak[1] + 22}Z`}
          fill={PAPER}
        />
      )}
      {collected && <path d="M10 148Q57 100 103 143T178 137V180H0Z" fill={backColor} opacity="0.6" />}
      {grains}
    </>
  );
}

export function Stamp({ mountain, collected, size = 76, verifiedAt, className }: Props) {
  const uid = useId();
  const seed = hashOf(mountain.id);
  const season: Season = verifiedAt === undefined ? 'autumn' : seasonOf(verifiedAt);
  const art = ART[mountain.id];
  // 미모음은 어느 계절이든 단색이라 겨울 그림(눈 없는 형태가 원본)을 쓴다.
  const artMarkup =
    art === undefined
      ? null
      : prepareArt(art.seasons[collected ? season : 'winter'], {
          prefix: `${uid.replace(/:/g, '')}-`,
          size,
          collected,
        });
  const [sunX, sunY] = art?.sun ?? [116, 57];
  const detailed = collected && size >= 76;
  const clipId = `${uid}clip`;

  // 겨울 그림과 모티프는 색 슬롯을 쓴다. 산 고도에 맞는 값을 채운다.
  const slots = {
    '--ridge': colorOf(mountain.elevationM),
    '--ridge-back': colorOf(mountain.elevationM),
    '--paper': PAPER,
    '--ink': mountain.elevationM >= 1500 ? WINTER.ink1500AndAbove : WINTER.inkBelow1500,
    '--accent': season === 'winter' ? WINTER.accent : SUN,
  } as React.CSSProperties;

  return (
    <svg
      className={['stamp', collected ? 'stamp-collected' : 'stamp-empty', className]
        .filter(Boolean)
        .join(' ')}
      width={size}
      height={size}
      viewBox="0 0 180 180"
      role="img"
      aria-label={`${mountain.name} 스탬프 ${collected ? '모음' : '미모음'}`}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="90" cy="90" r="73" />
        </clipPath>
      </defs>
      {/* 바깥 원. 40px에서는 선이 뭉개지지 않게 굵게 */}
      <circle
        cx="90"
        cy="90"
        r="85"
        fill={collected ? PAPER : '#EEEFE7'}
        stroke={collected ? SUN : '#D9DDD2'}
        strokeWidth={size <= 40 ? 7 : 4}
      />
      <circle
        cx="90"
        cy="90"
        r="77"
        fill="none"
        stroke={collected ? SUN : '#FAFAF5'}
        strokeWidth="1.5"
      />
      <g clipPath={`url(#${clipId})`}>
        <circle cx="90" cy="90" r="73" fill={collected ? SKY[season] : '#EEEFE7'} />
        {collected && <circle cx={sunX} cy={sunY} r="20" fill={SUN} />}
        {artMarkup === null ? (
          <ProceduralArt
            mountain={mountain}
            collected={collected}
            size={size}
            seed={seed}
            season={season}
            gradientId={`${uid}grad`}
          />
        ) : (
          <g style={slots} dangerouslySetInnerHTML={{ __html: artMarkup }} />
        )}
      </g>
      {detailed && <path d="M79 156h22" stroke={PAPER} strokeWidth="2" opacity="0.7" />}
    </svg>
  );
}
