import { useId } from 'react';

import type { Mountain } from '../lib/verify.ts';

// 산 하나에 그래픽 하나를 그리면 100개는 에셋 작업이 된다(v1 후보).
// 대신 산 데이터에서 도형을 만들어낸다 — id로 능선 모양을, 고도로 색을 정한다.
// 같은 산은 언제나 같은 스탬프이고, 산이 늘어나도 에셋이 늘지 않는다.
// 규칙과 수치의 출처: design/DESIGN.md "스탬프" (viewBox 180, 바깥 원 r85, 그림 r73).

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
  if (elevationM >= 1500) return '#30485A';
  if (elevationM >= 1000) return '#245744';
  if (elevationM >= 600) return '#377650';
  return '#6E955C';
}

// 인증한 계절이 하늘색으로 남는다. 계절이 바뀌어도 이미 찍힌 스탬프 색은 안 바뀐다.
function skyOf(verifiedAt: string | undefined): string {
  if (verifiedAt === undefined) {
    return '#F2D4B5'; // 계절을 모르면 가을 하늘
  }
  const month = new Date(new Date(verifiedAt).getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return '#EFDED6';
  if (month >= 6 && month <= 8) return '#DEE8DF';
  if (month >= 9 && month <= 11) return '#F2D4B5';
  return '#DAE7E9';
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
  /** 인증 시각(ISO). 있으면 그 계절의 하늘색이 들어간다. */
  verifiedAt?: string;
  className?: string;
};

export function Stamp({ mountain, collected, size = 76, verifiedAt, className }: Props) {
  const clipId = useId();
  const seed = hashOf(mountain.id);
  const ridge = ridgeOf(seed);
  const ridgePath = `${ridge.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')} L170 180 H10Z`;
  const color = colorOf(mountain.elevationM);
  const peak = ridge.reduce((a, b) => (a[1] < b[1] ? a : b));
  const detailed = collected && size >= 76;

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
        <circle cx="90" cy="90" r="73" fill={collected ? skyOf(verifiedAt) : '#EEEFE7'} />
        {collected && <circle cx="116" cy="57" r="20" fill={SUN} />}
        <path d={ridgePath} fill={collected ? color : '#D4DACE'} />
        {collected && mountain.elevationM >= 1000 && (
          <path
            d={`M${peak[0] - 15} ${peak[1] + 20}L${peak[0]} ${peak[1]}L${peak[0] + 16} ${peak[1] + 22}L${peak[0] + 4} ${peak[1] + 16}L${peak[0] - 3} ${peak[1] + 22}Z`}
            fill={PAPER}
          />
        )}
        {collected && (
          <path d="M10 148Q57 100 103 143T178 137V180H0Z" fill={color} opacity="0.6" />
        )}
        {grains}
      </g>
      {detailed && <path d="M79 156h22" stroke={PAPER} strokeWidth="2" opacity="0.7" />}
    </svg>
  );
}
