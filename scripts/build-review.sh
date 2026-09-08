#!/bin/zsh
# 검수·출시용 빌드. .env의 테스트 광고 ID를 운영 ID(AD_*_LIVE_ID)로 덮어서 빌드한다.
# 테스트 번들은 그냥 `npm run build` — .env의 테스트 ID가 들어간다.
set -e
cd "$(dirname "$0")/.."
# .env를 source하지 않는다 — 값에 공백·특수문자가 있는 줄이 있다. 필요한 두 줄만 읽는다.
group=$(grep -E '^AD_GROUP_LIVE_ID=' .env | cut -d= -f2-)
banner=$(grep -E '^AD_BANNER_LIVE_ID=' .env | cut -d= -f2-)
[[ -n "$group" && -n "$banner" ]] || { echo ".env에 AD_GROUP_LIVE_ID / AD_BANNER_LIVE_ID가 없다" >&2; exit 1; }
VITE_AD_GROUP_ID="$group" VITE_AD_BANNER_ID="$banner" npm run build
# 번들에 테스트 ID가 남아 있으면 검수에 올리면 안 된다.
if grep -rq 'ait-ad-test' dist; then echo "dist에 테스트 광고 ID가 남아 있다" >&2; exit 1; fi
echo "운영 광고 ID로 빌드됨"
