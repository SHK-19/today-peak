// 스킴으로 들어온 진입점을 해석한다. 콘솔 '주요 기능'과 공유 링크가 이 형식을 쓴다.
//
//   intoss://today-peak                     홈
//   intoss://today-peak?tab=stamps          내 스탬프
//   intoss://today-peak?tab=picks           오늘 Pick
//   intoss://today-peak?verify=1            홈에서 가장 가까운 산 상세를 바로 연다
//   intoss://today-peak?mountain={id}       그 산의 상세 (공유 링크)
//
// 모르는 값은 무시하고 홈으로 간다. 진입점 때문에 앱이 죽으면 안 된다.

export type Entry = {
  tab: 'home' | 'stamps' | 'picks';
  mountainId: string | null;
  verifyNearest: boolean;
};

export const HOME_ENTRY: Entry = { tab: 'home', mountainId: null, verifyNearest: false };

export function parseEntry(schemeUri: string | null | undefined): Entry {
  if (!schemeUri) {
    return HOME_ENTRY;
  }
  const query = schemeUri.split('?')[1];
  if (query === undefined) {
    return HOME_ENTRY;
  }
  const params = new URLSearchParams(query.split('#')[0]);
  const mountainId = params.get('mountain');
  return {
    tab:
      params.get('tab') === 'stamps'
        ? 'stamps'
        : params.get('tab') === 'picks'
          ? 'picks'
          : 'home',
    mountainId: mountainId !== null && mountainId !== '' ? mountainId : null,
    verifyNearest: params.get('verify') === '1',
  };
}
