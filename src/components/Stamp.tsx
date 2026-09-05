import type { Mountain } from '../lib/verify.ts';

// 산 하나에 그래픽 하나를 그리면 100개는 에셋 작업이 된다(v1 후보).
// 대신 산 데이터에서 도형을 만들어낸다 — id로 능선 모양을, 고도로 색을 정한다.
// 같은 산은 언제나 같은 스탬프이고, 산이 늘어나도 에셋이 늘지 않는다.

function hashOf(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

// 인증한 계절. 같은 산이라도 언제 올랐는지가 남는다.
// 능선 색은 고도가 정하고, 계절은 하늘(안쪽 배경)이 맡는다 — 두 신호가 섞이지 않게.
function skyOf(verifiedAt: string | undefined): string {
  if (verifiedAt === undefined) {
    return 'transparent';
  }
  const month = new Date(new Date(verifiedAt).getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return '#FDECEF'; // 봄 · 벚꽃
  if (month >= 6 && month <= 8) return '#E9F6EC'; // 여름 · 신록
  if (month >= 9 && month <= 11) return '#FDF0E2'; // 가을 · 단풍
  return '#EDF3FA'; // 겨울 · 설산
}

// 고도 구간별 색. 높은 산일수록 짙어진다 — 컬렉션을 훑으면 높이가 보인다.
function colorOf(elevationM: number): string {
  if (elevationM >= 1500) return '#1B4965';
  if (elevationM >= 1000) return '#1D674D';
  if (elevationM >= 600) return '#2F8F5B';
  return '#5FAE7C';
}

// 봉우리 세 개의 높이와 위치를 id에서 뽑는다. 정상(가운데)이 가장 높다.
function ridgePath(mountain: Mountain): string {
  const hash = hashOf(mountain.id);
  const peakX = 42 + (hash % 17); // 40~58: 정상이 살짝 좌우로 치우친다
  const peakY = 26 + ((hash >> 5) % 8); // 26~33: 뾰족함
  const leftX = 18 + ((hash >> 9) % 8);
  const leftY = peakY + 10 + ((hash >> 13) % 9);
  const rightX = 70 + ((hash >> 17) % 10);
  const rightY = peakY + 8 + ((hash >> 21) % 11);

  return [
    'M 12 74',
    `L ${leftX} ${leftY}`,
    `L ${(leftX + peakX) / 2} ${leftY + 6}`,
    `L ${peakX} ${peakY}`,
    `L ${(peakX + rightX) / 2} ${rightY - 4}`,
    `L ${rightX} ${rightY}`,
    'L 88 74',
    'Z',
  ].join(' ');
}

// 정상에 얹는 눈/바위. 800m 이상에서만 그린다.
function capPath(mountain: Mountain): string | null {
  if (mountain.elevationM < 800) {
    return null;
  }
  const hash = hashOf(mountain.id);
  const peakX = 42 + (hash % 17);
  const peakY = 26 + ((hash >> 5) % 8);
  return `M ${peakX - 9} ${peakY + 12} L ${peakX} ${peakY} L ${peakX + 9} ${peakY + 12} L ${peakX + 3} ${peakY + 9} L ${peakX - 4} ${peakY + 13} Z`;
}

type Props = {
  mountain: Mountain;
  collected: boolean;
  size?: number;
  /** 인증 시각(ISO). 있으면 계절색이 하늘에 들어간다. */
  verifiedAt?: string;
};

export function Stamp({ mountain, collected, size = 76, verifiedAt }: Props) {
  const color = collected ? colorOf(mountain.elevationM) : 'var(--color-text-disabled)';
  const cap = capPath(mountain);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${mountain.name} 스탬프${collected ? '' : ' (아직 없음)'}`}
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        fill={collected ? skyOf(verifiedAt) : 'transparent'}
      />
      {/* 도장 테두리 두 겹. 획득한 스탬프만 바깥 테두리가 진해진다. */}
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke={collected ? 'var(--brand-accent)' : 'var(--color-text-disabled)'}
        strokeWidth={collected ? 3 : 1.5}
        strokeDasharray={collected ? undefined : '4 4'}
      />
      <circle cx="50" cy="50" r="41" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      <path d={ridgePath(mountain)} fill={color} opacity={collected ? 1 : 0.35} />
      {cap !== null && <path d={cap} fill="var(--color-bg)" opacity={collected ? 0.9 : 0.4} />}
    </svg>
  );
}
