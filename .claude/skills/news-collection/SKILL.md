---
name: news-collection
description: AI 뉴스 수집(크롤링) 로직 가이드 — Google News RSS / Naver API 쿼리, KST 날짜 필터링, AI 관련성 게이트, 중복 제거, 태그·카테고리 매칭. 검색 쿼리 추가, 수집 누락/중복 디버깅, 날짜·타임존 처리, 태그 규칙 변경 시 참조.
---

# 뉴스 수집 로직

핵심 구현은 [lib/newsUtils.ts](../../../lib/newsUtils.ts), 호출부는 [api/news.ts](../../../api/news.ts)(조회)와 [api/fetch.ts](../../../api/fetch.ts)(저장).

## 데이터 소스 2개
- **Google News RSS** (`fetchWithRetry`) — 항상 사용. 쿼리당 최대 ~100건.
- **Naver News API** (`fetchNaverNews`) — `NAVER_CLIENT_ID`/`SECRET` 있을 때만. `display=100`, `sort=date`로 **최근 100건만** 반환 → **오늘 날짜에만 유효**(과거 날짜 조회 시 Naver는 건너뜀).

## 쿼리는 일부러 여러 개로 쪼갬
Google RSS와 Naver 모두 쿼리당 결과 상한(~100)이 있어서, 키워드를 여러 쿼리(`GOOGLE_QUERIES`, `NAVER_QUERIES`)로 분산해 pool을 넓힌 뒤 downstream에서 dedup으로 중복을 제거한다. **쿼리를 추가할 때는 상한을 의식해 키워드를 분산**할 것. (Naver는 쿼리 내 공백을 OR로 처리.)

## 날짜 처리 — 가장 실수하기 쉬운 부분
- 모든 날짜 비교는 **KST 기준 `YYYY-MM-DD`** (`getKstDateStr`, en-CA + Asia/Seoul).
- **오늘 조회:** Google 쿼리에 `when:1d` 추가 (트렌딩 pool이 크고 잘 채워짐).
- **과거 날짜 조회:** `after:<날짜-1일> before:<날짜+1일>` 절대 범위. `when:1d`/`7d`는 특정 과거일을 못 집고, `7d`는 100건 상한에 하루치가 희석됨.
- `after/before`는 **UTC 경계**라서 ±1일 넓게 가져온 뒤, `article.publishedDate === targetDate`(KST)로 **post-filter**해 정확한 날짜만 남긴다. → 이 ±1일 + 재필터 패턴을 깨면 KST/UTC 경계에서 기사 누락·혼입 발생.

## AI 관련성 게이트 (`isAiRelated`)
출력측 화이트리스트: 제목이 `AI_RELEVANCE_PATTERNS` 중 하나라도 매치해야 보존. 통과 못 하면 `droppedNonAi`로 집계(샘플 5건 로깅). 주의점:
- `AI` 단독은 **라틴 문자에 붙지 않을 때만** 허용(`MAIL`, `FAIR` 오탐 방지). 한글 인접은 허용.
- 새 키워드(신규 모델/회사 등)는 이 패턴 배열에 정규식으로 추가.

## 중복 제거 (`makeDeduper`)
`id`(URL의 md5) 또는 **정규화 제목 30자**(`normalizeTitle`: 태그·특수문자 제거, 소문자, 30자 컷)가 겹치면 drop. 소스 간(Google↔Naver) 중복도 이걸로 제거.

## 태그·카테고리 매칭 (`processArticle` / `processNaverItem`)
태그 정의(`TagSpec[]`)는 **Vercel Edge Config**에서 `getTags()`로 로드 (코드에 없음). 매칭 규칙:
1. `keywords`에 **정확 매치**(`isExactMatch`, 단어 경계) → 채택.
2. 정확 매치 없고 **부분 매치** 있고 `excludeKeywords`에 안 걸리면 → 채택.
3. 매치된 태그의 `name`은 `tags`에, `category`는 `categories`에 누적.

## 디버깅 팁
- 응답 `stats` 객체에 단계별 카운트(rawㆍafterDateFilterㆍdroppedNonAiㆍdedup)가 있음 — "기사가 안 나온다"면 어느 단계에서 줄었는지 먼저 확인.
- Google 503/429는 `fetchWithRetry`가 백오프 재시도(USER_AGENTS 랜덤 로테이션). 빈 배열 반환 시 해당 쿼리만 조용히 skip됨.
