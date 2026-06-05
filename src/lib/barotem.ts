// 바로템 시세 조회 — 리니지클래식 게임머니(2382r902)
// 팝니다(sell) + 거래가능물품(display=2) + 낮은가격순(orderby=3) + 서버별(opt1)

import { SERVERS, SITE } from "@/data/site";
import { readSettings } from "@/lib/settings";

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
}

export interface PriceTableData {
  updatedAt: string;
  krwToVnd: number;
  discountRate: number;
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

async function fetchServerLowest(
  serverId: string
): Promise<{ price: number | null; count: number }> {
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
      next: { revalidate: SITE.priceRevalidateSeconds },
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

export async function getPriceTable(): Promise<PriceTableData> {
  const [settings, krwToVnd, ...results] = await Promise.all([
    readSettings(),
    fetchKrwToVnd(),
    ...SERVERS.map((s) => fetchServerLowest(s.id)),
  ]);
  const discountRate = settings.discountPercent / 100;

  const servers: ServerPrice[] = SERVERS.map((s, i) => {
    const { price, count } = results[i];
    const buyKrw = price !== null ? price * (1 - discountRate) : null;
    return {
      serverId: s.id,
      nameKo: s.nameKo,
      nameEn: s.nameEn,
      marketPricePerManKrw: price,
      buyPricePerManKrw: buyKrw !== null ? Math.floor(buyKrw) : null,
      buyPricePerManVnd:
        buyKrw !== null ? Math.round((buyKrw * krwToVnd) / 100) * 100 : null,
      listingCount: count,
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    krwToVnd,
    discountRate,
    servers,
  };
}
