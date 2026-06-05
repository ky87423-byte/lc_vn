# lc_vn 작업 일지

## 2026-06-05 — 프로젝트 생성 ~ 멀티게임 확장 (커밋 `a4c36bf` → `ec3e5d7`)

하루 만에 0 → 운영 가능한 상태까지. 시간순 기록.

### 1. 초기 구축 (`4331334`)

- create-next-app 16.2.7 (TS, Tailwind v4, App Router, src 디렉터리)
- **바로템 리버스 엔지니어링**:
  - 목록은 AJAX 렌더링 — `product.js` 분석으로 `GET /product/productTable/{thread}` JSON API 발견
  - 리니지클래식 게임머니 스레드 = `2382r902` (계정 3931과 별개)
  - 파라미터 확정: `sell=sell`(팝니다) + `display=2`(거래가능물품) + `orderby=3`(낮은가격순) + `opt1=서버ID`
  - 서버 30개 opt1 ID 추출 (데포로쥬 24487 ~ 오렌 26641, 기타 제외 29개 사용)
  - 응답 `rows[0].unit_price`("만당 2,491원") 파싱으로 최저가 확보
- 매입가 = 최저가 × 0.85 (15% 할인), VND 환산(open.er-api.com, 폴백 18.5)
- 베트남어 메인 페이지: Hero / 시세표 / 거래절차 4단계 / FAQ / 연락 CTA
- Geist 폰트가 vietnamese subset 미지원 → **Be Vietnam Pro**로 교체
- GitHub: `gh` CLI 부재 → `git credential fill` 토큰으로 API 호출. `lc_vn` 저장소가 이미 존재(빈 상태)해서 그대로 푸시

### 2. 가시성 버그 + 관리자 페이지 (`f7be044`)

- **버그**: 사용자 시스템이 라이트 모드면 흰바탕+흰글자.
  원인 = Tailwind v4에서 unlayered `body { background: var(--background) }`가 레이어된 유틸리티(`bg-zinc-950`)를 이김.
  → globals.css에서 prefers-color-scheme 분기 제거, 다크 고정
- `/admin`: 비밀번호 로그인(sessionStorage 유지) + 할인율 슬라이더 1~30%
- `/api/admin/settings`: `x-admin-key` 헤더 인증, `data/settings.json` 저장 (git 제외)
- 검증: 401/400 거부, 22% 설정 시 매입가 정확 반영(2,500→1,950) 확인

### 3. 갱신주기 설정 + 동시접속 대비 (`51444f5`)

- 질문 "100~1000명 와도 괜찮나" → 구조 개선으로 응답
- **스냅샷 메모리 캐시**: stale-while-revalidate + inflight 가드(단일 갱신)
  → 방문자 수와 무관하게 바로템 호출 = 캐시 주기당 1회
- 할인율은 요청 시점 적용 (스냅샷에 시장가만 저장) → 관리자 변경 즉시 반영 유지
- `/admin`에 갱신주기 30초~30분 슬라이더 + 프리셋(1/3/5/10/30분)
- 부하 테스트: 동시 100요청 전부 200, 총 1.4초, 바로템 추가 호출 0회 (updatedAt 불변으로 증명)

### 4. 시세표 자동 갱신 (`e955869`)

- 캐시 주기(cacheSeconds)에 맞춰 클라이언트 폴링 — 스켈레톤 없이 조용히 교체
- `document.hidden`이면 중단, visibilitychange 복귀 시 즉시 재조회
- 자동 갱신 실패는 무시하고 기존 표 유지

### 5. 차트 + 등락률 (`ab79d9a`) — gamebit.co.kr/cas 참고

- 시세 이력: `data/history.json` 7일 보관, `src/instrumentation.ts` 수집기(60초 점검)
  → 방문자 없어도 이력 축적
- 시세표에 24h 등락률(▲초록/▼빨강) + 서버별 스파크라인(SVG 자체 구현)
- 행 클릭 → 확장 차트 (24시간/7일 전환, 최고·최저가 표시), `/api/history`
- **함정 발견·수정**: Next가 instrumentation과 라우트 핸들러를 별도 모듈 인스턴스로 로드
  → 양쪽 메모리 캐시가 서로의 이력을 덮어씀.
  해결: append 시 항상 디스크 fresh read 후 병합 + 15초 중복 가드 + 조회용 15초 TTL 캐시
- 검증: 60초 간격 9포인트 정확히 기록, 파일·API 일치

### 6. 멀티게임 확장 (`ec3e5d7`)

- 게임 추가: **아이온2, 메이플스토리월드, SOL:enchant**
- 바로템에서 발굴: 게임 목록 JSON의 `"type":"money","category":"..."` →
  아이온2 `2382r811`(44서버, 천족/마족), 메이플월드 `2382r977`(8월드), 솔 `2382r1003`(6서버)
- 단위가 게임마다 다름을 발견: 아데나 "만당" / 키나 "천만당" / 메소 "백만당"
  → `unit_price` 접두어 자동 감지(`UNIT_MAP`), `GAMES[].fallbackUnit` 폴백
- 구조 일반화: `GAMES[]` 정의(site.ts), 게임별 스냅샷 Map, 게임별 이력 파일(`history-{slug}.json`),
  `/api/prices?game=` `/api/history?game=`, 메인 페이지 게임 탭
- 기존 history.json → history-lineage-classic.json 마이그레이션
- 검증: 린클 29/29, 아이온2 44/44, 메이플 7/8 시세 확보. 솔은 매물 0건 → "문의" 안내 표시
- 알려진 리스크 기록: 아이온2 게임머니 카테고리의 비키나 매물(오드)이 최저가 왜곡 가능

### 운영 메모

- 로컬 검증: `npx next start -p 3210` (3000은 lc_info 개발 서버 점유)
- 관리자: http://localhost:3210/admin (비번 `.env.local`)
- 남은 일: 연락처 placeholder 교체, 브랜드명 확정, 실서버 배포

---

<!-- 새 작업은 위 형식으로 날짜 섹션을 추가해서 기록 -->
