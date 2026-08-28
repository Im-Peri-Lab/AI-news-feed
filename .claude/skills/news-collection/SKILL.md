---
name: news-collection
description: AI 뉴스 수집(크롤링) 로직 가이드 — Google News RSS / Naver API 쿼리, KST 날짜 필터링, AI 관련성 게이트, 중복 제거, 태그·카테고리 매칭. 검색 쿼리 추가, 수집 누락/중복 디버깅, 날짜·타임존 처리, 태그 규칙 변경 시 참조.
---

# 뉴스 수집 로직

핵심 구현은 [lib/newsUtils.ts](../../../lib/newsUtils.ts), 호출부는 [api/news.ts](../../../api/news.ts). **저장소는 없다** — 요청마다 RSS·API를 새로 긁어 그 자리에서 태깅해 반환한다. 그래서 태그 규칙을 바꾸면 과거 기사에도 즉시 소급 적용된다.

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

## 태그·카테고리 매칭 (`matchTags`)
태그 정의(`TagSpec[]`)는 **Vercel Edge Config**에 있음(코드에 하드코딩 X). 읽는 경로가 둘이고 **일관성이 다르다**:
- `getTagsCached()` — 연결 문자열의 CDN 엔드포인트. 토큰 불필요하지만 **쓰기를 수백 ms~수 초 늦게 반영**. `api/news.ts`가 사용.
- `getTags()` — Management API 직결, 읽은 즉시 최신. 관리 핸들러(`api/tags.ts` 등)가 사용.

→ **태그를 수정하고 곧바로 피드를 새로고침하면 옛 규칙으로 태깅될 수 있다.** 관리 화면엔 반영됐는데 피드엔 안 보이는 건 버그가 아니다.

매칭은 2단계. 매치된 태그의 `name`은 `tags`에, `category`는 `categories`에 누적된다.
1. **정확 일치**(`isExactMatch`) → 채택. 이 경로는 `excludeKeywords`를 **무시한다**(의도된 안전판).
2. 정확 일치가 없을 때 **부분 매칭**(`isPartialMatch`)이 걸리고 `excludeKeywords`에 안 걸리면 → 채택.

### 경계 규칙 — 한국어 때문에 비대칭이다
- **경계는 키워드와 같은 문자 체계에서만 따진다.** 한국어는 교착어라 키워드 뒤에 조사·복합어가 그대로 붙는다(`KT가`, `구글과`, `삼성전자`). 경계 클래스에 `[a-zA-Z0-9가-힣]`을 **함께** 넣으면 영문 키워드가 조사를 만나는 순간 정확 일치가 깨진다.
- **앞 경계는 영문·숫자로 시작하는 키워드에만** 건다. 영문 약어는 앞에 글자가 붙으면 다른 뜻이지만(`SKT`≠`KT`, `LSK`≠`SK`), 한글은 뜻이 이어지는 복합어가 많다(`신한투자증권`의 증권, `클로드포스`의 클로드).
- **camelCase 예외:** 소문자 뒤 대문자 약어는 새 단어로 본다(`sLLM`·`vLLM`의 LLM, `eGPU`의 GPU). 대소문자를 구분해 검사하므로 `SKT`의 KT나 `risk`의 sk는 통과하지 못한다.
- 규칙으로 못 막는 형태: **대문자 접두사 + 대문자 약어**(`ZHBM`⊃`HBM`). `SKT`⊃`KT`와 문자 패턴이 같아 구분이 불가능하다 → 키워드 추가로 대응.

### excludeKeywords 함정
- **제목 전체를 검사한다.** 매칭된 위치가 아니다. `KT` 태그에 제외 키워드 `SKT`를 넣으면 두 회사가 함께 나오는 기사가 통째로 배제된다 — 실제로 그래서 KT 태그가 누락됐다(#38).
- 위 앞 경계 규칙이 `SKT`⊃`KT` 부류를 구조적으로 막으므로 **대부분의 제외 키워드는 애초에 불필요**하다. 넣기 전에 앞 경계로 해결되는지 먼저 확인할 것.

### 키워드를 추가할 때
일반명사를 키워드로 넣으면 무관한 기사를 잡는다. 예: `KT` 태그의 `믿음`(KT LLM 이름)이 `믿음의 엔비디아…` 기사에 KT를 붙인다. 고유명사 형태로 좁히거나(`Mi:dm`, `믿음 2.0`) 제외 키워드로 보완할 것.

## 디버깅 팁
- 응답 `stats` 객체에 단계별 카운트(rawㆍafterDateFilterㆍdroppedNonAiㆍdedup)가 있음 — "기사가 안 나온다"면 어느 단계에서 줄었는지 먼저 확인.
- **태그 매칭 규칙을 바꿀 땐 전수 대조할 것.** 라이브 `/api/tags`와 `/api/news`를 받아 수정 전/후 `matchTags` 결과를 기사 전체에 돌려 새로 붙는/사라지는 태그를 뽑는다. 회귀가 조용히 생긴다 — 앞 경계를 도입했을 때 `sLLM`이 LLM 태그를 잃은 걸 코퍼스에 해당 기사가 없어서 못 잡을 뻔했다. 코퍼스에 없는 형태는 손으로 케이스를 만들어 확인.
- Google 503/429는 `fetchWithRetry`가 백오프 재시도(USER_AGENTS 랜덤 로테이션). 빈 배열 반환 시 해당 쿼리만 조용히 skip됨.
