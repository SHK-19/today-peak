# 오늘 Pick 갱신을 Lightsail로 옮기기

맥에서 돌리면 두 가지가 깨진다. 맥이 꺼져 있으면 갱신이 멈추고(Apple Silicon은 예약 부팅 불가),
집 공인 IP가 바뀌면 쉐어링크 API가 401로 막는다 — 2026-09-08 사고가 그것이다.
고정 IP 서버 한 대면 둘 다 사라진다.

## 1. 인스턴스 만들기 (콘솔에서 직접)

- 리전: **서울(ap-northeast-2)** — API가 국내에 있고 지연이 짧다
- 이미지: Linux/Unix → OS Only → **Ubuntu 24.04 LTS**
- 플랜: **$5/월** (1GB). 이 작업은 1.8초짜리라 최소 플랜으로 충분하다
- Instance name: `today-peak-picks` — **생성 후 이름을 못 바꾼다**
- Automatic snapshots: **끈다.** 상태가 전부 git + `.env`라 복구가 빠르고, 스냅샷은 용량만큼 과금된다
- Advanced settings → Launch script에 아래를 넣으면 4번의 설치 단계가 자동으로 끝난다:

      #!/bin/bash
      apt-get update
      apt-get install -y git zsh
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs

- SSH key: **Create custom key**(이름 `today-peak`)로 새로 만들고 `.pem`을 받는다.
  **다운로드는 이때 한 번뿐이다.** `~/Code/keys/today-peak.pem`에 두고 `chmod 400`
- 생성 후 **Networking → Create static IP → 인스턴스에 attach**
  고정 IP는 인스턴스에 붙어 있는 동안 무료다. 떼어두면 과금되니 반드시 붙여둘 것

## 2. 쉐어링크 어드민에 IP 등록

크리에이터 어드민 → API 연동에서 위 고정 IP를 추가한다. 최대 10개까지 등록된다.
**맥 IP는 지우지 말 것** — 로컬에서 `node scripts/build-picks.mjs`로 확인할 때 필요하다.

## 3. GitHub 배포 키 (서버가 push해야 한다)

서버에서:

    ssh-keygen -t ed25519 -C "lightsail-picks" -f ~/.ssh/id_ed25519 -N ""
    cat ~/.ssh/id_ed25519.pub

출력된 공개키를 GitHub → today-peak → Settings → Deploy keys → Add deploy key,
**Allow write access 체크**하고 저장한다.

## 4. 서버 설정

1번에서 launch script를 넣었으면 git·zsh·node는 이미 설치돼 있다(`node -v`로 확인).
없다면 수동으로:

    sudo apt update && sudo apt install -y git zsh
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs

이어서:

    git clone git@github.com:SHK-19/today-peak.git ~/today-peak
    cd ~/today-peak
    git config user.name "today-peak bot"
    git config user.email "kimsh910.sg@gmail.com"

`.env`는 커밋되지 않으니 맥에서 키 3개만 옮긴다. 맥에서:

    grep '^SHARELINK_' .env | ssh ubuntu@<고정IP> 'cat > ~/today-peak/.env'

## 5. cron 등록 (하루 4회)

**먼저 서버 시간대를 한국으로 맞춘다.** cron은 시스템 시간대로 돌아서, UTC인 채로 두면
아래 시각이 9시간 밀린다(명령 안의 `TZ=`는 스크립트 출력에만 적용된다).

    sudo timedatectl set-timezone Asia/Seoul
    sudo systemctl restart cron

그다음 `crontab -e`에 아래 한 줄:

    30 0,6,12,18 * * * cd ~/today-peak && TZ=Asia/Seoul /bin/zsh scripts/daily-picks.sh >> /tmp/todaypeak-picks.log 2>&1

## 6. 검증

    cd ~/today-peak && node scripts/build-picks.mjs

`큐레이션 123개 → 상품 123개 → 링크 125개`가 나오면 IP 등록까지 정상이다.
401이 나오면 2번(IP 등록)이 안 된 것이다.

그다음 실제 갱신·푸시까지 한 번 돌려본다:

    /bin/zsh scripts/daily-picks.sh && git log --oneline -1

## 7. 맥 작업 끄기 (중요)

양쪽이 같이 돌면 같은 파일을 서로 밀어내 push가 충돌한다. 맥에서:

    launchctl unload ~/Library/LaunchAgents/com.todaypeak.picks.plist

되돌리려면 `launchctl load` 로 다시 켜면 된다.
