import type { Mountain } from './verify.ts';

// 컬렉션 두 판. 100대 명산 완주의 의미가 흐려지지 않게 동네 명산은 따로 센다.
export type CollectionId = 'top100' | 'local';

export const COLLECTIONS: { id: CollectionId; label: string }[] = [
  { id: 'top100', label: '100대 명산' },
  { id: 'local', label: '동네 명산' },
];

export function collectionOf(mountain: Pick<Mountain, 'collection'>): CollectionId {
  return mountain.collection ?? 'top100';
}

export function collectionLabel(id: CollectionId): string {
  return COLLECTIONS.find((c) => c.id === id)?.label ?? '';
}
