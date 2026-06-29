// 최근 거래완료 피드 — 바로템 display=3(거래완료물품)에서 수집.
// 최신 N건을 data/trades-{game}.json에 통째로 덮어씀(merge 불필요, 항상 최신).
// 게임시세(gamesise)가 이 파일을 공유해서 읽음.

import { promises as fs } from "fs";
import path from "path";

const MAX_TRADES = 40;

export interface Trade {
  server: string;
  /** 만당/천만당 등 단위당 가격(원) */
  unitPriceKrw: number | null;
  /** 단위 라벨(만/천만/백만 등) */
  unitLabel: string | null;
  /** 체결 총액(원) */
  dealPriceKrw: number | null;
  /** 표시용 수량 문자열 (예: "500만 아데나") */
  quantity: string;
  /** 등록/체결 일시 문자열 */
  regDate: string;
  /** epoch ms (파싱 가능하면) */
  t: number | null;
}

function tradesPath(gameSlug: string): string {
  return path.join(process.cwd(), "data", `trades-${gameSlug}.json`);
}

export async function writeTrades(
  gameSlug: string,
  trades: Trade[]
): Promise<void> {
  try {
    const file = tradesPath(gameSlug);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({ trades: trades.slice(0, MAX_TRADES) }),
      "utf8"
    );
  } catch {
    // 저장 실패는 무시(다음 주기에 재시도)
  }
}

export async function readTrades(gameSlug: string): Promise<Trade[]> {
  try {
    const raw = await fs.readFile(tradesPath(gameSlug), "utf8");
    const parsed = JSON.parse(raw) as { trades?: Trade[] };
    return Array.isArray(parsed.trades) ? parsed.trades : [];
  } catch {
    return [];
  }
}
