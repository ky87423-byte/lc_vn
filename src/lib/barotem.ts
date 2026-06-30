// 바로템 시세 조회 — 게임별 게임머니 스레드
// 팝니다(sell) + 거래가능물품(display=2) + 낮은가격순(orderby=3) + 서버별(opt1)
//
// 캐시 전략: 게임별 시세 스냅샷을 프로세스 메모리에 캐시하고,
// 만료 시에도 단 1개의 갱신만 수행(나머지 요청은 이전 데이터 반환).
// → 방문자 수와 무관하게 바로템 호출은 캐시 주기당 게임별 1회뿐.
// 할인율은 요청 시점에 적용하므로 관리자 변경이 즉시 반영됨.

import { GameInfo, SITE } from "@/data/site";
import { readSettings } from "@/lib/settings";
import {
  appendHistory,
  change24h,
  downsample,
  readHistory,
  seriesFor,
} from "@/lib/history";
import { Trade, writeTrades } from "@/lib/trades";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
};

interface BarotemRow {
  unit_price?: string; // 예: "만당 2,491원", "천만당 4,000원"
  product_name?: string;
  server?: string;
  deal_price?: string; // 거래완료 체결 총액 "800,000원"
  deal_quantity?: string; // "500만 아데나"
  reg_date?: string; // "2026-06-30 08:15:47"
}

interface BarotemResponse {
  code: number;
  rows: BarotemRow[];
  total: string;
}

export interface ServerPrice {
  serverId: string;
  nameKo: string;
  nameEn: string;
  /** 바로템 최저가 (원/단위), 매물 없으면 null */
  marketPricePerUnitKrw: number | null;
  /** 매입가 = 최저가 × (1 - discountRate), 원/단위 */
  buyPricePerUnitKrw: number | null;
  /** 매입가 VND/단위 */
  buyPricePerUnitVnd: number | null;
  listingCount: number;
  /** 24시간 전 대비 등락률(%) — 이력 부족 시 null */
  change24hPercent: number | null;
  /** 최근 24시간 매입가(VND) 스파크라인 (다운샘플) */
  spark: number[];
}

export interface PriceTableData {
  game: {
    slug: string;
    nameKo: string;
    nameEn: string;
    currency: string;
    /** 시세 단위 화폐량 (예: 10000 = 만당) */
    unitAmount: number;
  };
  updatedAt: string;
  krwToVnd: number;
  discountRate: number;
  cacheSeconds: number;
  servers: ServerPrice[];
}

/** "만당 2,491원" → { price: 2491, unit: 10000 } */
const UNIT_MAP: Record<string, number> = {
  만: 10_000,
  십만: 100_000,
  백만: 1_000_000,
  천만: 10_000_000,
  억: 100_000_000,
};

function parseUnitPrice(
  unitPrice: string | undefined
): { price: number; unit: number | null } | null {
  if (!unitPrice) return null;
  const m = unitPrice.match(/(?:([가-힣]+)당)?\s*([\d,]+(?:\.\d+)?)\s*원/);
  if (!m) return null;
  const n = parseFloat(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return { price: n, unit: m[1] ? (UNIT_MAP[m[1]] ?? null) : null };
}

/** "165건" → 165 */
function parseTotal(total: string | undefined): number {
  if (!total) return 0;
  const n = parseInt(total.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

interface ServerQuote {
  price: number | null;
  unit: number | null;
  count: number;
}

async function fetchServerLowest(
  threadId: string,
  serverId: string,
  serverParam: "opt1" | "opt2" = "opt1"
): Promise<ServerQuote> {
  const params = new URLSearchParams({
    page: "1",
    sell: "sell",
    display: "2", // 거래가능물품
    orderby: "3", // 낮은가격순
    [serverParam]: serverId, // 게임마다 서버 필터가 opt1/opt2로 다름
  });
  try {
    const res = await fetch(
      `https://www.barotem.com/product/productTable/${threadId}?${params}`,
      {
        headers: {
          ...HEADERS,
          // 바로템이 2026-06경부터 Referer 검사를 추가함.
          // 없으면 {"code":0,"msg":"Undefined variable $common"} 에러로 rows가 비어 옴.
          Referer: `https://www.barotem.com/product/lists/${threadId}`,
        },
        cache: "no-store", // 캐시는 아래 스냅샷 레이어에서 직접 관리
      }
    );
    if (!res.ok) return { price: null, unit: null, count: 0 };
    const data = (await res.json()) as BarotemResponse;
    if (data.code !== 200 || !Array.isArray(data.rows) || data.rows.length === 0)
      return { price: null, unit: null, count: parseTotal(data.total) };
    const parsed = parseUnitPrice(data.rows[0].unit_price);
    return {
      price: parsed?.price ?? null,
      unit: parsed?.unit ?? null,
      count: parseTotal(data.total),
    };
  } catch {
    return { price: null, unit: null, count: 0 };
  }
}

/** 최근 거래완료(display=3) 수집 — 게임당 1회 요청, 최신순 */
async function fetchCompletedTrades(threadId: string): Promise<Trade[]> {
  const params = new URLSearchParams({
    page: "1",
    sell: "sell",
    display: "3", // 거래완료물품
    orderby: "1", // 최신
  });
  try {
    const res = await fetch(
      `https://www.barotem.com/product/productTable/${threadId}?${params}`,
      {
        headers: {
          ...HEADERS,
          Referer: `https://www.barotem.com/product/lists/${threadId}`,
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as BarotemResponse;
    if (data.code !== 200 || !Array.isArray(data.rows)) return [];
    return data.rows.slice(0, 40).map((r) => {
      const up = parseUnitPrice(r.unit_price);
      const labelMatch = r.unit_price?.match(/([가-힣]+)당/);
      const deal = r.deal_price
        ? parseInt(r.deal_price.replace(/[^\d]/g, ""), 10)
        : NaN;
      const t = r.reg_date ? Date.parse(r.reg_date.replace(" ", "T")) : NaN;
      return {
        server: r.server ?? "",
        unitPriceKrw: up?.price ?? null,
        unitLabel: labelMatch ? labelMatch[1] : null,
        dealPriceKrw: Number.isFinite(deal) ? deal : null,
        quantity: r.deal_quantity ?? "",
        regDate: r.reg_date ?? "",
        t: Number.isFinite(t) ? t : null,
      } as Trade;
    });
  } catch {
    return [];
  }
}

async function fetchKrwToVnd(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/KRW", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return SITE.fallbackKrwToVnd;
    const data = (await res.json()) as {
      result?: string;
      rates?: { VND?: number };
    };
    const rate = data.rates?.VND;
    return data.result === "success" && rate && rate > 0
      ? rate
      : SITE.fallbackKrwToVnd;
  } catch {
    return SITE.fallbackKrwToVnd;
  }
}

// ---- 게임별 시세 스냅샷 메모리 캐시 ----

interface MarketSnapshot {
  fetchedAt: number;
  krwToVnd: number;
  quotes: ServerQuote[]; // game.servers와 같은 순서
  unitAmount: number; // 바로템에서 감지한 시세 단위 (폴백: game.fallbackUnit)
}

const snapshots = new Map<string, MarketSnapshot>();
const inflights = new Map<string, Promise<MarketSnapshot>>();

async function fetchSnapshot(game: GameInfo): Promise<MarketSnapshot> {
  const [krwToVnd, ...quotes] = await Promise.all([
    fetchKrwToVnd(),
    ...game.servers.map((s) =>
      fetchServerLowest(game.threadId, s.id, game.serverParam ?? "opt1")
    ),
  ]);
  const unitAmount =
    quotes.find((q) => q.unit !== null)?.unit ?? game.fallbackUnit;
  const snap: MarketSnapshot = {
    fetchedAt: Date.now(),
    krwToVnd,
    quotes,
    unitAmount,
  };
  // 시세 이력에 기록 (차트/등락률/매물수용)
  const prices: Record<string, number | null> = {};
  const counts: Record<string, number> = {};
  game.servers.forEach((s, i) => {
    prices[s.id] = quotes[i].price;
    counts[s.id] = quotes[i].count;
  });
  await appendHistory(game.slug, snap.fetchedAt, prices, counts);
  // 최근 거래완료 피드도 함께 수집(게임당 1회 추가 요청)
  try {
    await writeTrades(game.slug, await fetchCompletedTrades(game.threadId));
  } catch {
    // 거래완료 수집 실패는 시세 수집에 영향 주지 않음
  }
  return snap;
}

async function getSnapshot(
  game: GameInfo,
  cacheSeconds: number
): Promise<MarketSnapshot> {
  const cached = snapshots.get(game.slug);
  if (cached && Date.now() - cached.fetchedAt < cacheSeconds * 1000)
    return cached;

  // 갱신은 게임당 동시에 1개만 — 나머지 요청은 이전 스냅샷(있으면)을 즉시 반환
  let inflight = inflights.get(game.slug);
  if (!inflight) {
    inflight = fetchSnapshot(game)
      .then((s) => {
        snapshots.set(game.slug, s);
        return s;
      })
      .finally(() => {
        inflights.delete(game.slug);
      });
    inflights.set(game.slug, inflight);
  }
  if (cached) return cached; // stale-while-revalidate
  return inflight; // 첫 요청(스냅샷 없음)만 대기
}

export async function getPriceTable(game: GameInfo): Promise<PriceTableData> {
  const settings = await readSettings();
  const snap = await getSnapshot(game, game.refreshSeconds ?? settings.cacheSeconds);
  const discountRate = settings.discountPercent / 100;
  const history = await readHistory(game.slug);
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const toBuyVnd = (marketKrw: number) =>
    Math.round((marketKrw * (1 - discountRate) * snap.krwToVnd) / 100) * 100;

  const servers: ServerPrice[] = game.servers.map((s, i) => {
    const { price, count } = snap.quotes[i];
    const buyKrw = price !== null ? price * (1 - discountRate) : null;
    const spark = downsample(seriesFor(history, s.id, since24h), 40).map(
      (p) => toBuyVnd(p.v)
    );
    return {
      serverId: s.id,
      nameKo: s.nameKo,
      nameEn: s.nameEn,
      marketPricePerUnitKrw: price,
      buyPricePerUnitKrw: buyKrw !== null ? Math.floor(buyKrw) : null,
      buyPricePerUnitVnd:
        buyKrw !== null
          ? Math.round((buyKrw * snap.krwToVnd) / 100) * 100
          : null,
      listingCount: count,
      change24hPercent: change24h(history, s.id, price),
      spark,
    };
  });

  return {
    game: {
      slug: game.slug,
      nameKo: game.nameKo,
      nameEn: game.nameEn,
      currency: game.currency,
      unitAmount: snap.unitAmount,
    },
    updatedAt: new Date(snap.fetchedAt).toISOString(),
    krwToVnd: snap.krwToVnd,
    discountRate,
    cacheSeconds: settings.cacheSeconds,
    servers,
  };
}
