import data from '../data/mountains.json';

import type { Mountain } from './verify.ts';

// 실측 테스트용 장소. 거주지 좌표가 들어 있어 커밋하지 않는다(.gitignore).
// glob을 쓰면 파일이 없을 때 빈 객체가 되므로, 클론한 사람도 그대로 빌드된다.
const testModules = import.meta.glob<{ places: Mountain[] }>('../data/test-places.json', {
  eager: true,
});
const TEST_PLACES = Object.values(testModules).flatMap((module) => module.places);

// mountains.json은 샘플 경고(_note)를 담으려고 객체로 감싸져 있다.
// 실제 좌표가 들어오면 순수 배열로 펴고 이 파일만 고치면 된다.
export const MOUNTAINS: Mountain[] = [...data.mountains, ...TEST_PLACES];
