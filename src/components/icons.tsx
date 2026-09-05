/**
 * 아이콘 6종 — assets/project/icons/*.svg와 같은 path를 쓰는 React 컴포넌트.
 * React 계열 프로젝트에서만 이 파일을 쓴다(vanilla 계열은 svg 파일을 직접
 * 참조). 색은 stroke="currentColor"로 부모 요소의 color를 상속한다 — 색을
 * 바꾸려면 감싸는 요소의 color를 바꾼다.
 */

import type { ReactNode } from 'react';

type IconProps = {
  size?: string | number;
};

export function ChevronRight({ size = '1em' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5 L16 12 L9 19" />
    </svg>
  );
}

export function ChevronLeft({ size = '1em' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5 L8 12 L15 19" />
    </svg>
  );
}

export function ChevronDown({ size = '1em' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 9 L12 16 L19 9" />
    </svg>
  );
}

export function ChevronUp({ size = '1em' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 15 L12 8 L19 15" />
    </svg>
  );
}

export function Close({ size = '1em' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </svg>
  );
}

export function Search({ size = '1em' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 L20 20" />
    </svg>
  );
}

/* 아래 6종은 design/src/stamps.js의 icon()에서 가져왔다 (stroke 1.7, round). */

type LineIconProps = IconProps & { children: ReactNode };

function LineIcon({ size = 24, children }: LineIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ size }: IconProps) {
  return (
    <LineIcon size={size}>
      <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </LineIcon>
  );
}

export function CollectionIcon({ size }: IconProps) {
  return (
    <LineIcon size={size}>
      <rect x="5" y="5" width="16" height="16" rx="4" />
      <path d="M16 2H6a4 4 0 0 0-4 4v10" />
      <circle cx="13" cy="13" r="4" />
    </LineIcon>
  );
}

export function CheckIcon({ size }: IconProps) {
  return (
    <LineIcon size={size}>
      <path d="m5 12 4 4L19 6" />
    </LineIcon>
  );
}

export function LocationIcon({ size }: IconProps) {
  return (
    <LineIcon size={size}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </LineIcon>
  );
}

export function FlagIcon({ size }: IconProps) {
  return (
    <LineIcon size={size}>
      <path d="M5 22V3m0 1c4-3 10 3 14 0v10c-5 3-10-3-14 0" />
    </LineIcon>
  );
}

export function PeopleIcon({ size }: IconProps) {
  return (
    <LineIcon size={size}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-4a6 6 0 0 1 12 0v4m3-17a3 3 0 0 1 0 6m3 11v-4a5 5 0 0 0-3-4" />
    </LineIcon>
  );
}
