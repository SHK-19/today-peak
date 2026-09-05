# design/ — 디자인 납품물 (2026-09-05)

`docs/design-brief.md` 의뢰서로 받은 결과물. 원본은 앱빌더 출력이고 여기 복사본이 정본이다.

- `DESIGN.md` — 명세. 토큰·타이포·스탬프 규칙·화면별 수치. **구현할 때 이 파일을 본다.**
- `screens/*.png|svg` — 375px 화면 24종. PNG는 SVG 렌더라 브라우저 스크린샷이 아니다.
- `index.html` — 화면 보드. 브라우저로 열면 분류해서 볼 수 있다.
- `app.html` + `src/` — 시연용 HTML/CSS/JS. **운영 코드가 아니다.** `src/screens.js`의 `act()`는 시뮬레이션이라 가져다 쓰지 않는다.
  `src/styles/tokens.css`와 `src/stamps.js`는 값과 규칙의 참고 원본.
- `validation.json` — 파일 규격·대비 계산 결과.

원본 폴더의 AGENTS.md·CLAUDE.md는 프로젝트 것과 달라서 복사하지 않았다.
