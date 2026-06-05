import { NextResponse } from "next/server";
import { getPriceTable } from "@/lib/barotem";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPriceTable();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
