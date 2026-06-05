import { NextRequest, NextResponse } from "next/server";
import {
  clampDiscountPercent,
  getAdminPassword,
  MAX_DISCOUNT_PERCENT,
  MIN_DISCOUNT_PERCENT,
  readSettings,
  writeSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-admin-key") === getAdminPassword();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await readSettings();
  return NextResponse.json({
    ...settings,
    min: MIN_DISCOUNT_PERCENT,
    max: MAX_DISCOUNT_PERCENT,
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { discountPercent?: number };
  try {
    body = (await req.json()) as { discountPercent?: number };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const n = Number(body.discountPercent);
  if (
    !Number.isFinite(n) ||
    n < MIN_DISCOUNT_PERCENT ||
    n > MAX_DISCOUNT_PERCENT
  ) {
    return NextResponse.json(
      {
        error: `discountPercent must be ${MIN_DISCOUNT_PERCENT}~${MAX_DISCOUNT_PERCENT}`,
      },
      { status: 400 }
    );
  }
  const settings = { discountPercent: clampDiscountPercent(n) };
  await writeSettings(settings);
  return NextResponse.json({ ok: true, ...settings });
}
