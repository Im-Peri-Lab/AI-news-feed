# AI/AX 뉴스 피드

한국어 AI/AX 뉴스를 매일 수집·태깅·브리핑하는 React + Vercel Functions 앱.

## 구조
- `src/` — React(Vite, TS) 프론트엔드. 컴포넌트 / hooks / services / contexts.
- `api/` — Vercel Serverless Functions (뉴스 수집, 브리핑, 태그·카테고리 CRUD).
- `lib/` — 프론트·백 공용 로직 (`newsUtils.ts` 수집, `colorPalette.ts` 색, `apiConstants.ts` 타입).
- `server.ts` — 로컬 개발용 서버(`npm run dev` → tsx).
- `public/` — **빌드 산출물.** 여기 있는 건 전부 `dist/`로 복사되어 배포된다.
- `assets/` — 빌드에 포함되지 않는 원본·작업 파일(아이콘 소스 등). Vite는 `public/`만 복사한다.
- `scripts/` — 빌드에 포함되지 않는 유틸(`generate-icons.py` 등).
- 태그/카테고리 데이터는 **Vercel Edge Config**에 저장 (코드에 하드코딩 X).

## 명령어
- `npm run dev` — 로컬 실행
- `npm run lint` — 타입체크(`tsc --noEmit`). 커밋 전 필수.
- `npm run build` — 프로덕션 빌드

## 배포 확인
- 공개 주소는 **`https://ai-news-feed-v2.vercel.app`** (짧은 도메인).
- `vercel ls`가 출력하는 긴 URL(`...-psh1219-4074s-projects.vercel.app`)은 Vercel Standard Protection에 막혀 **SSO 302**가 난다. 배포 실패가 아니다. 배포 성공 여부는 `vercel ls`의 `● Ready` 또는 `gh pr checks`로 판단.
- **SPA rewrite 주의:** `vercel.json`이 `/((?!api/).*)` → `/index.html`이라 **없는 파일도 404가 아니라 200 + `text/html`**을 반환한다. 파일 존재 확인은 status가 아니라 `content-type`으로.

## 항상 지킬 규칙
- **타임존:** 모든 날짜는 KST(Asia/Seoul) 기준. `getKstDateStr`(en-CA 포맷) 패턴을 쓰고 `new Date()`의 로컬/UTC 날짜를 직접 쓰지 말 것. 안 그러면 새벽 시간대에 날짜가 하루 어긋남.
- **브랜드 컬러:** `#ff2e98` (Tailwind 토큰 `brand` / `brand-hover` / `brand-light`). 하드코딩 hex 대신 토큰 사용.
- **폰트:** Pretendard (`--font-sans`).
- **다크모드:** `.dark` 클래스 + CSS 변수(`--background`/`--foreground`). `dark:` variant 사용.
- **커밋/PR 메시지:** 한국어. 기존 컨벤션 `feat: …` / `fix: …` 유지.

## 작업별 상세 가이드 (스킬)
- 뉴스 수집·쿼리·날짜 필터·태그 매칭 → `news-collection` 스킬
- 색·컴포넌트·다크모드 등 디자인 → `design-system` 스킬
- AI 브리핑 프롬프트 수정 → `ai-briefing` 스킬
