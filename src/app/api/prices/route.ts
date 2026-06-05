import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_GAME_SLUG, findGame } from "@/data/site";
import { getPriceTable } from "@/lib/barotem";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("game") ?? DEFAULT_GAME_SLUG;
  const game = findGame(slug);
  if (!game) {
    return NextResponse.json({ error: "unknown game" }, { status: 400 });
  }
  const data = await getPriceTable(game);
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
