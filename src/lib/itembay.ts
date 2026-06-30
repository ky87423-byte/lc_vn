// 아이템베이 시세 수집 (거래소 "부품" 모듈)
//
// 아이템베이는 서버별 실시간 시세를 공개 JSON으로 제공한다(로그인 불필요):
//   GET /item/api/sell/getRealTimeMarket?iGameServerSeq={seq}
//        → { iMarkePrice(시장가), iLowestPrice(최저가), cTranDate }
//   GET /api/game/server/market-info?iGameSeq={g}&iGameServerSeq={seq}
//        → { biBasePrice(단위), vcUnit, bMarketIsRunning }
//
// 우리 serverId ↔ 아이템베이 server-seq 매핑은 아래 ITEMBAY 표에 둔다(이름으로 매칭됨).
// 수집값은 우리 단위(game.fallbackUnit)로 정규화해 history-{game}-itembay.json에 기록.
// IP 보수적: 게임당 cacheSeconds 주기로만, 서버 호출 사이 딜레이.

import { GameInfo, SITE } from "@/data/site";
import { appendHistory } from "@/lib/history";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  Referer: "https://www.itembay.com/",
  "X-Requested-With": "XMLHttpRequest",
};

interface ItembayGame {
  gameSeq: number; // iGameSeq
  servers: Record<string, number>; // 우리 serverId(barotem opt1) → 아이템베이 server-seq
}

// 거래소 부품: 게임별 매핑. (서버명이 우리와 동일해 이름으로 추출함)
const ITEMBAY: Record<string, ItembayGame> = {
  "lineage-classic": {
    gameSeq: 3828,
    servers: {
      "24487": 15943, // 데포로쥬
      "24488": 15944, // 켄라우헬
      "24489": 15945, // 질리언
      "24490": 15946, // 이실로테
      "24491": 15947, // 조우
      "24492": 15948, // 하딘
      "24493": 15949, // 케레니스
      "24494": 15950, // 오웬
      "24495": 15951, // 크리스터
      "24496": 15952, // 아인하사드
      "24527": 15983, // 아툰
      "24528": 15984, // 가드리아
      "24529": 15985, // 군터
      "24530": 15986, // 아스테어
      "24531": 15987, // 듀크데필
      "24575": 15988, // 발센
      "24576": 15989, // 어레인
      "24577": 15990, // 캐스톨
      "24578": 15991, // 세바스챤
      "24579": 15992, // 데컨
      "24609": 15994, // 파아그리오
      "24610": 15995, // 에바
      "24611": 15996, // 사이하
      "24612": 15997, // 마프르
      "24613": 15998, // 린델
      "25273": 16090, // 하이네
      "25274": 16091, // 로엔그린
      "26022": 16185, // 발라카스
      "26641": 16303, // 오렌
    },
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchLowest(seq: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://www.itembay.com/item/api/sell/getRealTimeMarket?iGameServerSeq=${seq}`,
      { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { iLowestPrice?: number } };
    const p = j?.data?.iLowestPrice;
    return typeof p === "number" && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function fetchBasePrice(
  gameSeq: number,
  seq: number
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://www.itembay.com/api/game/server/market-info?iGameSeq=${gameSeq}&iGameServerSeq=${seq}`,
      { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { biBasePrice?: number } };
    const b = j?.data?.biBasePrice;
    return typeof b === "number" && b > 0 ? b : null;
  } catch {
    return null;
  }
}

const lastCollect = new Map<string, number>();

/** 게임의 아이템베이 시세를 수집해 history-{game}-itembay.json에 기록 */
export async function collectItembay(game: GameInfo): Promise<void> {
  const cfg = ITEMBAY[game.slug];
  if (!cfg) return;
  const intervalMs = SITE.priceRevalidateSeconds * 1000;
  const last = lastCollect.get(game.slug);
  if (last && Date.now() - last < intervalMs) return;
  lastCollect.set(game.slug, Date.now()); // 선점(중복/오버랩 방지)

  const ids = Object.keys(cfg.servers);
  if (ids.length === 0) return;

  // 단위 정규화: 아이템베이 base(예: 10000 만당) → 우리 단위(game.fallbackUnit)
  const base = (await fetchBasePrice(cfg.gameSeq, cfg.servers[ids[0]])) ??
    game.fallbackUnit;
  const factor = base > 0 ? game.fallbackUnit / base : 1;

  const prices: Record<string, number | null> = {};
  for (const id of ids) {
    const lowest = await fetchLowest(cfg.servers[id]);
    prices[id] = lowest !== null ? Math.round(lowest * factor) : null;
    await sleep(150);
  }
  await appendHistory(game.slug, Date.now(), prices, undefined, "itembay");
}
