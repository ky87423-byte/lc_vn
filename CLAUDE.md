@AGENTS.md

# lc_vn — 베트남 게임머니 매입 사이트

베트남 현지 유저에게서 한국 게임의 게임머니를 **매입**하는 사이트.
방문자용 UI는 **베트남어**(괄호로 한국어 병기), 관리자 페이지는 한국어.

지원 게임: 리니지클래식 · 아이온2 · 메이플스토리월드 · SOL:enchant

## 핵심 비즈니스 로직

**매입가 = 바로템(barotem.com) 최저가 × (1 − 할인율)**

- 바로템 조건: 팝니다(`sell=sell`) + 거래가능물품(`display=2`) + 낮은가격순(`orderby=3`) + 서버별(`opt1`)
- 할인율 기본 15%, `/admin`에서 1~30% 런타임 조절 (`data/settings.json`)
- VND 환산: open.er-api.com KRW→VND (1시간 캐시, 실패 시 `SITE.fallbackKrwToVnd`)

## 파일 가이드

| 파일 | 역할 |
| --- | --- |
| `src/data/site.ts` | **모든 설정의 진입점** — 브랜드/연락처/기본할인율 + `GAMES[]`(바로템 스레드 ID, 서버 opt1 목록, 화폐) |
| `src/lib/barotem.ts` | 바로템 조회 + 게임별 스냅샷 메모리 캐시 + 매입가 계산 |
| `src/lib/history.ts` | 시세 이력 (`data/history-{game}.json`, 7일 보관) |
| `src/lib/settings.ts` | 런타임 설정 읽기/쓰기 + 관리자 비밀번호 |
| `src/instrumentation.ts` | 백그라운드 시세 수집기 (60초 점검, 게임 순차) |
| `src/app/api/prices/route.ts` | `GET /api/prices?game=` 시세표 JSON |
| `src/app/api/history/route.ts` | `GET /api/history?game=&server=&range=24h\|7d` 차트 데이터 |
| `src/app/api/admin/settings/route.ts` | 관리자 설정 API (`x-admin-key` 헤더 인증) |
| `src/components/PriceTable.tsx` | 게임 탭 + 시세표 + 스파크라인 + 확장 차트 (클라이언트) |
| `src/app/admin/page.tsx` | 관리자: 할인율(1~30%) + 갱신주기(30초~30분) |

## 아키텍처 결정사항 (변경 시 주의)

1. **스냅샷 캐시는 프로세스 메모리** (`barotem.ts`의 `snapshots` Map) — stale-while-revalidate + 단일 갱신(inflight 가드).
   방문자 수와 무관하게 바로템 호출은 캐시 주기당 게임별 1회. **PM2 cluster 등 멀티 프로세스 배포 시 프로세스별 캐시가 됨.**
2. **Next.js는 instrumentation과 라우트 핸들러를 별도 모듈 인스턴스로 로드**한다.
   → 이력(history)은 메모리 캐시를 신뢰하지 말 것. append 시 항상 디스크에서 fresh read 후 병합 (15초 중복 가드).
3. **할인율은 요청 시점에 적용** — 스냅샷에는 시장가(원/단위)만 저장. 관리자 변경이 캐시와 무관하게 즉시 반영되는 이유.
4. **다크 테마 강제** (`globals.css`) — Tailwind v4에서 unlayered `body` 스타일이 유틸리티 클래스를 이기므로
   `prefers-color-scheme` 분기를 제거하고 다크 값으로 고정했음. 라이트 모드 분기를 되살리지 말 것.
5. **시세 단위 자동 감지** — 바로템 `unit_price`의 "만당/백만당/천만당" 접두어를 파싱 (`UNIT_MAP`).
   게임별 단위가 다름: 아데나 만당, 키나 천만당, 메소 백만당. 폴백은 `GAMES[].fallbackUnit`.

## 바로템 연동 메모

- 게임머니 스레드 ID: 메인 HTML의 게임 목록 JSON에서 `"type":"money","category":"2382rXXX"`
  또는 게임 lists 페이지의 게임머니 탭 `data-thread` 속성
- 서버 목록: 게임머니 lists 페이지의 `<li data-title="opt1" data-opt1="ID">서버명</li>`
- 요청 헤더 필수: `User-Agent`(브라우저 UA) + `X-Requested-With: XMLHttpRequest`
- `display`: 1=전체물품, 2=거래가능물품, 3=거래완료물품 / `orderby`: 1=최신, 2=높은가격, 3=낮은가격

## 알려진 이슈 / 주의

- **아이온2**: 게임머니 카테고리에 키나가 아닌 아이템(오드 등)을 올리는 판매자가 있어
  일부 서버 "최저가"가 실제 키나 시세보다 낮게 잡힐 수 있음. 필요 시 필터 추가.
- **SOL:enchant**: 신작이라 바로템 매물 0건(2026-06 기준). 매물이 생기면 자동으로 시세 표시.
  화폐 단위(다이아) 표기는 매물 등장 후 검증 필요.
- 연락처(Zalo/Facebook/카카오)는 placeholder — `src/data/site.ts`에서 실제 링크로 교체 필요.
- `ADMIN_PASSWORD`는 `.env.local`(git 제외) — 배포 시 환경변수로 설정.

## 명령어

```bash
npm run dev    # 개발 (주의: 3000 포트를 lc_info가 쓸 수 있음)
npm run build  # 빌드 + 타입체크
npx next start -p 3210  # 로컬 검증용 포트
```

## 문서

- `MEMORY.md` — 프로젝트 현재 상태 스냅샷 (세션 시작 시 참고)
- `docs/worklog.md` — 작업 일지 (변경 시 추가 기록)
