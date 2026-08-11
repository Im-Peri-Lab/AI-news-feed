---
name: design-system
description: 표준 디자인 룰 — 브랜드 컬러/폰트, Tailwind v4 토큰, 다크모드, 카테고리·태그 색상 팔레트 규칙. 새 컴포넌트 작성, 색상 추가, 다크모드 대응, 카테고리 색 배정 시 참조.
---

# 디자인 시스템

토큰 정의는 [src/index.css](../../../src/index.css), 색 팔레트는 [lib/colorPalette.ts](../../../lib/colorPalette.ts), 카테고리 고정색은 [src/constants/tags.ts](../../../src/constants/tags.ts).

## 토큰 (Tailwind v4 `@theme`)
- **폰트:** `--font-sans` = Pretendard. (CDN import는 index.css 상단.)
- **브랜드 컬러:** `--color-brand` `#ff2e98` (LG U+ 핑크), `--color-brand-hover` `#e62083`, `--color-brand-light` `#fff0f7`. → 클래스로 `bg-brand` `text-brand` `border-brand/20` `hover:bg-brand-hover` 등 사용. **hex 하드코딩 금지.**
- Tailwind **v4** 사용(`@import "tailwindcss"` + `@theme`). v3 스타일 `tailwind.config.js`/`@tailwind base` 아님.

## 다크모드
- 방식: `<html>`/`<body>`에 **`.dark` 클래스 토글** (`useTheme` 훅이 일몰/일출 시각 기준 자동 + 수동 오버라이드).
- variant: `@variant dark (&:where(.dark, .dark *))` → 컴포넌트에서 `dark:` 접두사 사용.
- 배경/전경은 CSS 변수 `--background` / `--foreground` (라이트/다크 각각 정의). 페이지 bg는 `body`에 둠(`min-h-screen` 래퍼 쓰지 말 것 — 빈 슬래브 생김, index.css 주석 참고).

## 카테고리·태그 색상 규칙
파스텔 3종 세트로 항상 묶어서 사용:
```
bg-{color}-50  /  text-{color}-700  /  border-{color}-200
```
- **카테고리 고정 매핑** (`CATEGORY_COLORS`): 전체=brand, 글로벌=orange, 국내=emerald, 기술=purple, 모델=pink, 산업=blue, 미분류=gray. 이 매핑은 유지할 것.
- **동적 카테고리 색 배정:** `COLOR_PALETTE`(10색, 인접 색 지각 거리 최대화 순서)에서 `pickColor()`가 **현재 가장 적게 쓰인 색**을 반환. 새 카테고리에 색 줄 때 이 함수 사용 — 임의 색 직접 지정 X.
- 새 색을 추가할 땐 같은 `-50/-700/-200` 규칙을 따르고 라이트·다크 양쪽에서 읽히는 파스텔로.

## 앱 아이콘 / 파비콘

아이콘은 **아트가 두 계열**이고 관리 방식도 다르다. 원본은 둘 다 `assets/`에 두고 **`public/`에 두지 말 것** — `public/` 하위는 전부 배포된다. 원본 파일명에는 **해상도를 접미로 붙인다**(`-1254`, `-256`).

| 파일 | 크기 | 아트 | 원본 | 관리 |
|---|---|---|---|---|
| `public/apple-touch-icon.png` | 180 | 워드마크 | `assets/icon-source-1254.png` | 스크립트 생성 |
| `public/icon-192.png` | 192 | 워드마크 | 〃 | 스크립트 생성 |
| `public/icon-512.png` | 512 | 워드마크 | 〃 | 스크립트 생성 |
| `public/favicon-32.png` | 32 | 네이비 타일 + 핑크 `A` | `assets/favicon-source-256.png` (256²) | **손으로 관리** |
| `public/favicon-16.png` | 16 | 〃 | 〃 | **손으로 관리** |

워드마크 3종 생성은 **[scripts/generate-icons.py](../../../scripts/generate-icons.py)** 로만 한다 (`python3 scripts/generate-icons.py`). 의존성 없음 — 이 맥에는 ImageMagick도 PIL도 없어서 순수 Python으로 PNG를 직접 디코드/인코드한다. 손으로 리사이즈하지 말고 스크립트를 고쳐서 재생성할 것.

**파비콘 2개는 스크립트가 건드리지 않는다.** 별도 디자인이라 `TARGETS`에 넣으면 덮어써서 날아간다.

### 색
아이콘 팔레트는 메인화면 로고([src/components/Header.tsx](../../../src/components/Header.tsx) `AI/AX NEWS FEED`)와 **반드시 일치**시킨다.
- 글씨 `#111827` = `text-gray-900`
- 포인트 `#ff2e98` = `--color-brand`

원본 PNG는 raster 렌더라 색이 ±1~2 흔들리고, 실제로 포인트 색이 `#FB1476`으로 브랜드 컬러와 어긋나 있었다. 그래서 스크립트가 단순 리사이즈가 아니라 **팔레트를 위 값으로 정규화**한다(안티에일리어싱은 커버리지로 보존). 원본을 교체하면 `SRC_*` 실측값을 다시 재고 스크립트를 갱신할 것.

### 지키지 않으면 깨지는 것
- **워드마크 3종은 알파 채널 금지.** 알파가 있으면 iOS 홈 화면(`apple-touch-icon`)에서 배경이 검게 렌더링된다. 스크립트는 RGB로만 쓴다. 파비콘은 홈 화면에 안 쓰이므로 RGBA여도 무관하다(현재 투명 배경).
- **manifest 아이콘에 `purpose: "maskable"` 금지.** Android가 가장자리 약 10%를 잘라내 `NEWS FEED` 글자가 잘린다. `"any"`만 선언한다.
- **파비콘에 전체 워드마크 쓰지 말 것.** 워드마크는 3.45:1이라 16px에서 글자당 3px로 판독 불가. 그래서 파비콘만 단일 심볼(`A`) 타일로 분리했다.

### 앱 이름은 4곳
이름을 바꿀 땐 같이 고칠 것: [index.html](../../../index.html) `<title>`, [metadata.json](../../../metadata.json), [public/manifest.json](../../../public/manifest.json)의 `name`·`short_name`, `index.html`의 `apple-mobile-web-app-title`.
