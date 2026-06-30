// 아이템매니아 시세 수집 (거래소 "부품" 모듈)
//
// 아이템매니아는 게임별 "전 서버 시세"를 XML 한 번으로 제공한다(로그인 불필요):
//   GET /_xml/gamemoney_servers.xml.php?gamecode={gamecode}
//     → <data server name multiple unit_trade denomination price amount .../> ...
//   단가(원/단위) = price / multiple  (unit_trade=만 기준). 우리 단위로는
//   price * fallbackUnit / (multiple * unitTradeAmount).
//   ※ price는 대표 "시세"값(절대 최저가 아님) — 거래소 칩으로 보여주고, 최저가는
//     gametick에서 거래소 통합 min으로 자연히 결정됨.
//
// 서버명이 우리와 동일 → 이름으로 매핑(코드 매핑 불필요). gamecode만 게임별 설정.

import { fetch as uFetch, ProxyAgent } from "undici";
import { GameInfo, SITE } from "@/data/site";
import { appendHistory } from "@/lib/history";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  Referer: "https://www.itemmania.com/game_info/money/",
};

// 아이템매니아는 한국 외 차단 → 한국 프록시(KR_PROXY_URL) 경유. 없으면 수집 skip.
const proxy = process.env.KR_PROXY_URL
  ? new ProxyAgent(process.env.KR_PROXY_URL)
  : null;

// 거래소 부품: 게임 → 아이템매니아 gamecode (gamemoney_servers.xml.php?gamecode=)
// 서버명이 우리 nameKo와 일치하면 자동 매핑. result="na"면 매니아가 시세 미제공.
const ITEMMANIA: Record<string, number> = {
  "lineage-classic": 5913,
  aion2: 5799, // 서버명 (천족)/(마족) 우리와 동일, 단위 정규화 OK
};

const UNIT_AMOUNT: Record<string, number> = {
  천: 1_000,
  만: 10_000,
  십만: 100_000,
  백만: 1_000_000,
  천만: 10_000_000,
  억: 100_000_000,
};

const lastCollect = new Map<string, number>();

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/** 게임의 아이템매니아 시세를 수집해 history-{game}-itemmania.json에 기록 */
export async function collectItemmania(game: GameInfo): Promise<void> {
  const gamecode = ITEMMANIA[game.slug];
  if (!gamecode || !proxy) return; // 프록시 없으면 수집 skip(한국 외 차단)
  const intervalMs = (game.refreshSeconds ?? SITE.priceRevalidateSeconds) * 1000;
  const last = lastCollect.get(game.slug);
  if (last && Date.now() - last < intervalMs) return;
  lastCollect.set(game.slug, Date.now()); // 선점(중복/오버랩 방지)

  let xml: string;
  try {
    const res = await uFetch(
      `https://www.itemmania.com/_xml/gamemoney_servers.xml.php?gamecode=${gamecode}`,
      { headers: HEADERS, dispatcher: proxy, signal: AbortSignal.timeout(12000) }
    );
    if (!res.ok) return;
    xml = await res.text();
  } catch {
    return;
  }
  if (!xml.includes('result="success"')) return;

  // 이름 → 우리 serverId
  const byName = new Map(game.servers.map((s) => [s.nameKo, s.id]));
  const prices: Record<string, number | null> = {};
  for (const m of xml.matchAll(/<data\b[^>]*\/>/g)) {
    const tag = m[0];
    const name = attr(tag, "name");
    const id = name ? byName.get(name) : undefined;
    if (!id) continue;
    const price = Number(attr(tag, "price"));
    const multiple = Number(attr(tag, "multiple")) || 1;
    const unit = UNIT_AMOUNT[attr(tag, "unit_trade") ?? ""] ?? game.fallbackUnit;
    if (!Number.isFinite(price) || price <= 0) {
      prices[id] = null;
      continue;
    }
    // 원/단위(game.fallbackUnit)로 정규화
    prices[id] = Math.round((price * game.fallbackUnit) / (multiple * unit));
  }
  if (Object.keys(prices).length === 0) return;
  await appendHistory(game.slug, Date.now(), prices, undefined, "itemmania");
}
