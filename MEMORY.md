# lc_vn 프로젝트 메모리

> 마지막 갱신: 2026-06-05 / 커밋 `6d77286` / 작업 일지: `docs/worklog.md`

## 1. 프로젝트 목적

**베트남 현지 게이머에게서 한국 게임의 게임머니를 매입하는 사이트.**

- 타겟: 한국 서버에서 플레이하며 게임머니를 팔고 싶은 베트남 유저
- 수익 모델: 바로템(한국 거래소) 최저 판매가보다 **15% 싸게 매입** → 차익
- 방문자 UI는 베트남어(한국어 병기), 가격은 **VND 우선** 표기 (KRW 병기)
- 연락 채널: Zalo / Facebook / 카카오톡 (베트남은 Zalo가 주력)
- 지원 게임 4종: **리니지클래식 · 아이온2 · 메이플스토리월드 · SOL:enchant**
- 자매 프로젝트: `lc_info`(리니지클래식 대리육성 "데스 사관학교") — 같은 스택, 같은 계정 운영

## 2. 현재 완료된 기능 (전부 실측 검증됨)

### 방문자 페이지 `/`
- [x] 게임 탭 4개 → 서버별 매입 시세표
  - 린클 29서버 / 아이온2 44서버(천족·마족) / 메이플월드 8월드 / 솔인챈트 6서버
- [x] 매입가 자동 계산: 바로템 최저가 × (1−할인율), VND·KRW 병기
- [x] 시세 단위 자동 감지: 아데나 "만당" / 키나 "천만당" / 메소 "백만당" (`unit_price` 접두어 파싱)
- [x] 24시간 등락률 (▲초록/▼빨강, 이력 1시간 미만이면 "—")
- [x] 서버별 스파크라인(24h) + 행 클릭 시 확장 차트(24h/7d 전환, 최고·최저가)
- [x] 자동 갱신: 캐시 주기마다 폴링, 숨김 탭 중단, 탭 복귀 시 즉시 갱신, 실패 시 기존 표 유지
- [x] 매물 0건 게임(솔인챈트)은 "직접 문의" 안내
- [x] 거래 절차 4단계 / FAQ 5개 / 연락 CTA / 다크 테마 강제
- [x] 베트남어 폰트 (Be Vietnam Pro — Geist는 vietnamese subset 없음)

### 관리자 페이지 `/admin` (한국어)
- [x] 비밀번호 로그인 (sessionStorage 유지, `x-admin-key` 헤더 인증)
- [x] 할인율 1~30% 슬라이더+숫자 입력 — 저장 즉시 전 게임 반영
- [x] 시세 갱신주기 30초~30분 슬라이더+프리셋(1/3/5/10/30분)
- [x] 매입가 예시 미리보기

### 인프라/성능
- [x] 게임별 스냅샷 메모리 캐시 (stale-while-revalidate + 단일 갱신 inflight 가드)
  → 방문자 1,000명이어도 바로템 호출 = 캐시 주기당 게임별 1회. 동시 100요청 테스트 통과(전부 200, 추가 호출 0회)
- [x] 백그라운드 시세 수집기 (`src/instrumentation.ts`, 60초 점검, 4게임 순차) — 방문자 없어도 이력 축적
- [x] 시세 이력 7일 보관, 다운샘플(스파크 40pt, 차트 150pt)

## 3. 사용 중인 API (외부 의존성)

### 바로템 (barotem.com) — 비공식, 리버스 엔지니어링
```
GET https://www.barotem.com/product/productTable/{threadId}
  ?page=1&sell=sell&display=2&orderby=3&opt1={serverId}
헤더: User-Agent(브라우저 UA), X-Requested-With: XMLHttpRequest
```
- `sell=sell` 팝니다 / `display=2` 거래가능물품 / `orderby=3` 낮은가격순 / `opt1` 서버 필터
- 게임머니 스레드 ID:

| 게임 | threadId | 서버 수 | 시세 단위 |
| --- | --- | --- | --- |
| 리니지클래식 | `2382r902` | 29 | 만 아데나당 |
| 아이온2 | `2382r811` | 44 | 천만 키나당 |
| 메이플스토리월드 | `2382r977` | 8 | 백만 메소당 |
| SOL:enchant | `2382r1003` | 6 | 미확인(매물 0건) |

- 파싱: `rows[0].unit_price` 예 "만당 2,491원" → 가격+단위. `total` "165건" → 매물 수
- **비공식 API라서 바로템 개편 시 깨질 수 있음** — 깨지면 `src/lib/barotem.ts`만 수정
- 새 게임 추가법: 바로템 메인 HTML 게임목록 JSON에서 `"type":"money","category":"2382rXXX"` 찾기 → lists 페이지에서 `data-opt1` 서버 ID 추출 → `src/data/site.ts` GAMES에 추가

### 환율 (open.er-api.com) — 무료, 키 불필요
```
GET https://open.er-api.com/v6/latest/KRW  → rates.VND
```
- 1시간 캐시(`next.revalidate`), 실패 시 폴백 18.5 (실측 ~17.1)

### 내부 API
| 엔드포인트 | 용도 |
| --- | --- |
| `GET /api/prices?game={slug}` | 시세표 JSON (game 생략 시 lineage-classic) |
| `GET /api/history?game=&server=&range=24h\|7d` | 확장 차트 데이터 |
| `GET/POST /api/admin/settings` | 관리자 설정 (`x-admin-key` 인증) |

## 4. DB 상태

**DB 없음 — 파일 기반.** (의도적 선택: 단일 서버 + 낮은 쓰기 빈도라 충분)

| 파일 | 내용 | 쓰기 주체 |
| --- | --- | --- |
| `data/settings.json` | `{discountPercent, cacheSeconds}` | 관리자 저장 시 |
| `data/history-lineage-classic.json` | 시세 이력 `{points:[{t, p:{서버ID:가격}}]}` | 수집기/스냅샷 갱신 시 |
| `data/history-aion2.json` | 〃 | 〃 |
| `data/history-maplestory-world.json` | 〃 | 〃 |
| `data/history-sol-enchant.json` | 〃 | 〃 |

- `data/` 전체 git 제외 (.gitignore) — **배포 시 서버에 쓰기 가능한 디렉터리 필요**
- 이력 7일 초과분 자동 정리, 15초 내 중복 포인트 차단
- **주의**: Next instrumentation ↔ 라우트 핸들러가 별도 모듈 인스턴스 → append는 항상 디스크 fresh read 후 병합 (메모리 캐시 신뢰 금지). 이미 한 번 데이터 유실 사고 후 수정한 부분
- 향후 트래픽/데이터가 커지면 SQLite 또는 PostgreSQL 전환 후보 (vietnam-info 프로젝트에서 PostgreSQL 전환 경험 있음)

## 5. 배포 상태

**미배포 — 로컬에서만 동작 확인.**

- GitHub: https://github.com/ky87423-byte/lc_vn (private, master 브랜치, 최신 `6d77286`)
- 로컬 실행: `npx next start -p 3210` (3000 포트는 lc_info 개발 서버가 점유 중일 수 있음)
- 관리자 비번: `.env.local`의 `ADMIN_PASSWORD=lcvn2026!` (git 미포함)

### 배포 시 체크리스트 (아직 안 함)
1. 호스팅 결정 — **Vercel은 부적합** (`data/` 파일 쓰기 + instrumentation 상주 수집기 + 메모리 캐시가 서버리스와 안 맞음). VPS에 Node로 띄우는 게 맞음 (bam2용 100GB 서버 활용 후보)
2. `ADMIN_PASSWORD` 환경변수 재설정 (로컬 비번 재사용 금지)
3. `data/` 디렉터리 쓰기 권한
4. **단일 프로세스로 실행** — PM2 cluster 모드 금지 (스냅샷 캐시가 프로세스별로 갈라져 바로템 중복 호출)
5. 도메인 + HTTPS
6. 배포 후 `/admin` 접근 확인, 4게임 시세 로딩 확인

## 6. 해결 안 된 문제

| # | 문제 | 심각도 | 메모 |
| --- | --- | --- | --- |
| 1 | **연락처가 전부 placeholder** — zalo/facebook/kakao 링크 가짜 | 🔴 운영 불가급 | `src/data/site.ts` SITE.contact. 실제 계정 만들면 1분 수정 |
| 2 | **브랜드명 미확정** — "LC Adena VN" 임시 | 🟡 | SITE.name. 멀티게임이 됐으니 "Adena" 들어간 이름 재고 필요 |
| 3 | **아이온2 시세 왜곡 가능** — 게임머니 카테고리에 키나가 아닌 매물(찬란한 오드 등)이 섞여 최저가가 비정상적으로 낮게 잡힐 수 있음 (실례: 나니아 천만당 525원 vs 정상 ~4,000원) | 🟡 | 대책 후보: product_name에 "키나" 포함 행만 채택, 또는 하위 N개 중앙값 |
| 4 | SOL:enchant 화폐 단위 미확인 — 매물 0건이라 "만당"인지 "천당"인지 모름. fallbackUnit=만(10⁴) 임시 | 🟢 | 매물 등장하면 자동 감지로 잡힐 가능성 높음, 표기만 확인 |
| 5 | 환율 폴백값 18.5가 실세(17.1)와 괴리 | 🟢 | api 죽었을 때만 쓰임. `SITE.fallbackKrwToVnd` 17.1로 조정 권장 |
| 6 | 멀티 프로세스 배포 시 캐시/이력 동시성 미보장 | 🟢 | 단일 프로세스 운영이면 무관. 문서화로 방어 중 |
| 7 | 관리자 인증이 평문 비번 헤더 — rate limit/잠금 없음 | 🟢 | HTTPS 전제면 수용 가능 수준. 배포 후 필요 시 강화 |

## 7. 다음 작업 순서 (우선순위순)

1. **연락처 실링크 교체** (문제 #1) — Zalo 비즈니스 계정/페이스북 페이지 생성 후 `src/data/site.ts` 수정. 이거 없으면 사이트 열어도 의미 없음
2. **브랜드명 확정** (#2) + 메타데이터/OG 이미지 정리
3. **VPS 배포** — 위 배포 체크리스트 수행. 도메인 결정 포함
4. **아이온2 키나 필터** (#3) — 운영하며 왜곡 실제 발생하면 즉시. product_name 키워드 필터가 1차안
5. 환율 폴백 17.1로 조정 (#5) — 한 줄 수정, 다음 코드 작업 때 같이
6. (배포 후) SOL:enchant 매물 모니터링 — 단위 검증 (#4)
7. (선택) 운영 편의: 관리자 페이지에 게임별 시세 현황/수집기 상태 표시
8. (선택) SEO/마케팅: 베트남어 메타 키워드, 사이트맵, 베트남 커뮤니티 홍보 채널 조사

---

## 부록: 밟았던 함정 (재발 방지)

1. **Tailwind v4 레이어**: unlayered `body` CSS가 유틸리티 클래스를 이김 → 라이트모드 흰바탕/흰글자 사고. globals.css 다크 고정으로 해결
2. **Next 모듈 인스턴스 분리**: instrumentation ↔ 라우트 핸들러 메모리 불공유 → 이력 디스크 병합으로 해결
3. **gh CLI 없음**: GitHub 저장소 생성은 `git credential fill` 토큰 → API 직접 호출
4. **Geist 폰트 vietnamese subset 없음** → Be Vietnam Pro
5. **이 환경의 Bash 도구가 heredoc 내 백슬래시를 깨뜨림** → node 정규식은 `[0-9]` 등 백슬래시 없는 패턴으로
6. **포트 3000은 lc_info가 점유** → lc_vn 검증은 3210
