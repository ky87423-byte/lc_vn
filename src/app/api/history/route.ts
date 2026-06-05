import { NextRequest, NextResponse } from "next/server";
import { SERVERS } from "@/data/site";
import { downsample, readHistory, seriesFor } from "@/lib/history";
import { getPriceTable } from "@/lib/barotem";

export const dynamic = "force-dynamic";

const RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export async function GET(req: NextRequest) {
  const serverId = req.nextUrl.searchParams.get("server") ?? "";
  const range = req.nextUrl.searchParams.get("range") ?? "24h";
  if (!SERVERS.some((s) => s.id === serverId)) {
    return NextResponse.json({ error: "unknown server" }, { status: 400 });
  }
  const rangeMs = RANGES[range] ?? RANGES["24h"];

  // 현재 할인율/환율로 매입가 환산 (getPriceTable은 캐시되어 있어 저렴)
  const table = await getPriceTable();
  const rate = 1 - table.discountRate;
  const history = await readHistory();
  const pts = downsample(
    seriesFor(history, serverId, Date.now() - rangeMs),
    150
  );

  return NextResponse.json({
    serverId,
    range,
    points: pts.map((p) => ({
      t: p.t,
      buyVnd: Math.round((p.v * rate * table.krwToVnd) / 100) * 100,
      marketKrw: Math.round(p.v),
    })),
  });
}
