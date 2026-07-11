// 공개 — 광고/제휴 문의 쪽지 등록(인증 없음). gametick 폼 → 프록시 → 여기.
import { NextRequest, NextResponse } from "next/server";
import { addInquiry } from "@/lib/inquiries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const saved = await addInquiry(body);
  if (!saved)
    return NextResponse.json(
      { ok: false, error: "제목이나 내용을 입력하세요." },
      { status: 400 }
    );
  return NextResponse.json({ ok: true });
}
