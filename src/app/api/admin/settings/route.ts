import { NextRequest, NextResponse } from "next/server";
import {
  clampCacheSeconds,
  clampDiscountPercent,
  getAdminPassword,
  MAX_CACHE_SECONDS,
  MAX_DISCOUNT_PERCENT,
  MIN_CACHE_SECONDS,
  MIN_DISCOUNT_PERCENT,
  readSettings,
  writeSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

const LIMITS = {
  min: MIN_DISCOUNT_PERCENT,
  max: MAX_DISCOUNT_PERCENT,
  cacheMin: MIN_CACHE_SECONDS,
  cacheMax: MAX_CACHE_SECONDS,
};

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-admin-key") === getAdminPassword();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await readSettings();
  return NextResponse.json({ ...settings, ...LIMITS });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { discountPercent?: number; cacheSeconds?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const current = await readSettings();
  const discount = Number(body.discountPercent ?? current.discountPercent);
  const cache = Number(body.cacheSeconds ?? current.cacheSeconds);

  if (
    !Number.isFinite(discount) ||
    discount < MIN_DISCOUNT_PERCENT ||
    discount > MAX_DISCOUNT_PERCENT
  ) {
    return NextResponse.json(
      {
        error: `discountPercent must be ${MIN_DISCOUNT_PERCENT}~${MAX_DISCOUNT_PERCENT}`,
      },
      { status: 400 }
    );
  }
  if (
    !Number.isFinite(cache) ||
    cache < MIN_CACHE_SECONDS ||
    cache > MAX_CACHE_SECONDS
  ) {
    return NextResponse.json(
      {
        error: `cacheSeconds must be ${MIN_CACHE_SECONDS}~${MAX_CACHE_SECONDS}`,
      },
      { status: 400 }
    );
  }

  const settings = {
    discountPercent: clampDiscountPercent(discount),
    cacheSeconds: clampCacheSeconds(cache),
  };
  await writeSettings(settings);
  return NextResponse.json({ ok: true, ...settings });
}
