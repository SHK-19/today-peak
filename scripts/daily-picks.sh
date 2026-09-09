#!/bin/zsh
# 오늘 Pick 매일 갱신. launchd가 아침에 한 번 돌린다(scripts/launchd/com.todaypeak.picks.plist).
# 쉐어링크 API는 이 Mac의 IP만 허용해서 서버가 아니라 여기서 돈다. Mac이 꺼져 있으면 그날은 건너뛴다 —
# 앱은 어제 값을 쓰고, 끝난 하루특가는 endAt으로 화면에서 빠진다.
set -e
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# 사람이 고친 큐레이션·스크립트를 먼저 받는다. 이걸 빼면 뒤처진 채로 커밋해 push가 거부되고
# 그 뒤로 계속 실패한다(서버와 맥이 같은 main에 push하기 때문).
git pull -q --rebase origin main
node scripts/build-picks.mjs --write
if ! git diff --quiet -- docs/picks.json src/data/picks.json; then
  git add docs/picks.json src/data/picks.json
  git commit -q -m "오늘 Pick 자동 갱신 $(date '+%Y-%m-%d %H:%M')"
  git push -q origin main
fi
