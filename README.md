# lc_vn — Thu mua Adena Lineage Classic

베트남 리니지클래식 유저 대상 **게임머니(아데나) 매입** 사이트.

## 매입 시세 로직

- 데이터 소스: [바로템](https://www.barotem.com) 리니지클래식 게임머니 (`/product/productTable/2382r902`)
- 조건: **팝니다(sell) + 거래가능물품(display=2) + 낮은가격순(orderby=3)**, 서버별(`opt1`) 최저가 조회
- **매입가 = 바로템 최저가 × (1 − 할인율)** — 기본 15%, **`/admin` 페이지에서 1~30% 조절** (`data/settings.json`에 저장)
- VND 환산: [open.er-api.com](https://open.er-api.com) KRW→VND 환율 (1시간 캐시, 실패 시 폴백값)
- 시세 캐시: 5분 (`priceRevalidateSeconds`)

## 구조

| 파일 | 역할 |
| --- | --- |
| `src/data/site.ts` | 사이트 설정 — 브랜드명, 기본 할인율, 연락처(Zalo/Facebook/카카오), 서버 목록(opt1 ID) |
| `src/lib/barotem.ts` | 바로템 시세 조회 + 매입가 계산 |
| `src/lib/settings.ts` | 런타임 설정 읽기/쓰기 (`data/settings.json`) |
| `src/app/api/prices/route.ts` | `/api/prices` JSON API |
| `src/app/api/admin/settings/route.ts` | 관리자 설정 API (`x-admin-key` 헤더 인증) |
| `src/app/admin/page.tsx` | 관리자 페이지 — 할인율 1~30% 슬라이더 |
| `src/components/PriceTable.tsx` | 시세 표 (클라이언트, 새로고침 버튼) |
| `src/app/page.tsx` | 메인 페이지 (베트남어, Hero / 시세표 / 절차 / FAQ / CTA) |

## 관리자 페이지

- `/admin` 접속 → 비밀번호 입력 → 할인율 슬라이더(1~30%) → 저장
- 비밀번호: `.env.local`의 `ADMIN_PASSWORD` (`.env.example` 참고, 미설정 시 기본값 `lcvn-admin`)
- 저장 즉시 `/api/prices` 매입가에 반영 (시세 캐시 최대 5분)

## TODO

- [ ] `src/data/site.ts`의 Zalo / Facebook / KakaoTalk 링크를 실제 링크로 교체
- [ ] 브랜드명(`SITE.name`) 확정

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
npm run build
```
