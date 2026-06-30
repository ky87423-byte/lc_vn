// POST /api/alert — 디스코드 가격 알림 구독 등록 (게임시세 폼이 서버측에서 호출)
// body: { webhook, slug, serverId, threshold, dir: "below"|"above" }

import { NextRequest, NextResponse } from "next/server";
import { addDiscordSub } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: {
    webhook?: string;
    slug?: string;
    serverId?: string;
    threshold?: number;
    dir?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const { webhook, slug, serverId } = body;
  const threshold = Number(body.threshold);
  const dir = body.dir === "above" ? "above" : "below";
  if (!webhook || !slug || !serverId) {
    return NextResponse.json(
      { ok: false, error: "필수 값 누락" },
      { status: 400 }
    );
  }
  const result = await addDiscordSub({ webhook, slug, serverId, threshold, dir });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
