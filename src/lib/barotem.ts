// 바로템 시세 조회 — 리니지클래식 게임머니(2382r902)
// 팝니다(sell) + 거래가능물품(display=2) + 낮은가격순(orderby=3) + 서버별(opt1)
//
// 캐시 전략: 시세 원본(스냅샷)을 프로세스 메모리에 캐시하고,
// 만료 시에도 단 1개의 갱신만 수행(나머지 요청은 이전 데이터 반환).
// → 방문자 수와 무관하게 바로템 호출은 캐시 주기당 1회(29 요청)뿐.
// 할인율은 요청 시점에 적용하므로 관리자 변경이 즉시 반영됨.

import { SERVERS, SITE } from "@/data/site";
import { readSettings } from "@/lib/settings";
import {
  appendHistory,
  change24h,
  downsample,
  readHistory,
  seriesFor,
} from "@/lib/history";

const BAROTEM_MONEY_URL =
  "https://www.barotem.com/product/productTable/2382r902";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
};

interface BarotemRow {
  unit_price?: string; // 예: "만당 2,491원"
  product_name?: string;
  server?: string;
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
  /** 바로템 최저가 (원/만 아데나), 매물 없으면 null */
  marketPricePerManKrw: number | null;
  /** 매입가 = 최저가 × (1 - discountRate), 원/만 아데나 */
  buyPricePerManKrw: number | null;
  /** 매입가 VND/만 아데나 */
  buyPricePerManVnd: number | null;
  listingCount: number;
  /** 24시간 전 대비 등락률(%) — 이력 부족 시 null */
  change24hPercent: number | null;
  /** 최근 24시간 매입가(VND) 스파크라인 (다운샘플) */
  spark: number[];
}

export interface PriceTableData {
  updatedAt: string;
  krwToVnd: number;
  discountRate: number;
  cacheSeconds: number;
  servers: ServerPrice[];
}

/** "만당 2,491원" → 2491 */
function parseUnitPrice(unitPrice: string | undefined): number | null {
  if (!unitPrice) return null;
  const m = unitPrice.match(/([\d,]+(?:\.\d+)?)\s*원/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "165건" → 165 */
function parseTotal(total: string | undefined): number {
  if (!total) return 0;
  const n = parseInt(total.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

interface ServerQuote {
  price: number | null;
  count: number;
}

async function fetchServerLowest(serverId: string): Promise<ServerQuote> {
  const params = new URLSearchParams({
    page: "1",
    sell: "sell",
    display: "2", // 거래가능물품
    orderby: "3", // 낮은가격순
    opt1: serverId,
  });
  try {
    const res = await fetch(`${BAROTEM_MONEY_URL}?${params}`, {
      headers: HEADERS,
      cache: "no-store", // 캐시는 아래 스냅샷 레이어에서 직접 관리
    });
    if (!res.ok) return { price: null, count: 0 };
    const data = (await res.json()) as BarotemResponse;
    if (data.code !== 200 || !Array.isArray(data.rows) || data.rows.length === 0)
      return { price: null, count: parseTotal(data.total) };
    return {
      price: parseUnitPrice(data.rows[0].unit_price),
      count: parseTotal(data.total),
    };
  } catch {
    return { price: null, count: 0 };
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

// ---- 시세 스냅샷 메모리 캐시 ----

interface MarketSnapshot {
  fetchedAt: number;
  krwToVnd: number;
  quotes: ServerQuote[]; // SERVERS와 같은 순서
}

let snapshot: MarketSnapshot | null = null;
let inflight: Promise<MarketSnapshot> | null = null;

async function fetchSnapshot(): Promise<MarketSnapshot> {
  const [krwToVnd, ...quotes] = await Promise.all([
    fetchKrwToVnd(),
    ...SERVERS.map((s) => fetchServerLowest(s.id)),
  ]);
  const snap: MarketSnapshot = { fetchedAt: Date.now(), krwToVnd, quotes };
  // 시세 이력에 기록 (차트/등락률용)
  const prices: Record<string, number | null> = {};
  SERVERS.forEach((s, i) => {
    prices[s.id] = quotes[i].price;
  });
  await appendHistory(snap.fetchedAt, prices);
  return snap;
}

async function getSnapshot(cacheSeconds: number): Promise<MarketSnapshot> {
  const fresh =
    snapshot !== null && Date.now() - snapshot.fetchedAt < cacheSeconds * 1000;
  if (fresh) return snapshot!;

  // 갱신은 동시에 1개만 — 나머지 요청은 이전 스냅샷(있으면)을 즉시 반환
  if (!inflight) {
    inflight = fetchSnapshot()
      .then((s) => {
        snapshot = s;
        return s;
      })
      .finally(() => {
        inflight = null;
      });
  }
  if (snapshot) return snapshot; // stale-while-revalidate
  return inflight; // 첫 요청(스냅샷 없음)만 대기
}

export async function getPriceTable(): Promise<PriceTableData> {
  const settings = await readSettings();
  const snap = await getSnapshot(settings.cacheSeconds);
  const discountRate = settings.discountPercent / 100;
  const history = await readHistory();
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const toBuyVnd = (marketKrw: number) =>
    Math.round((marketKrw * (1 - discountRate) * snap.krwToVnd) / 100) * 100;

  const servers: ServerPrice[] = SERVERS.map((s, i) => {
    const { price, count } = snap.quotes[i];
    const buyKrw = price !== null ? price * (1 - discountRate) : null;
    const spark = downsample(seriesFor(history, s.id, since24h), 40).map(
      (p) => toBuyVnd(p.v)
    );
    return {
      serverId: s.id,
      nameKo: s.nameKo,
      nameEn: s.nameEn,
      marketPricePerManKrw: price,
      buyPricePerManKrw: buyKrw !== null ? Math.floor(buyKrw) : null,
      buyPricePerManVnd:
        buyKrw !== null
          ? Math.round((buyKrw * snap.krwToVnd) / 100) * 100
          : null,
      listingCount: count,
      change24hPercent: change24h(history, s.id, price),
      spark,
    };
  });

  return {
    updatedAt: new Date(snap.fetchedAt).toISOString(),
    krwToVnd: snap.krwToVnd,
    discountRate,
    cacheSeconds: settings.cacheSeconds,
    servers,
  };
}
