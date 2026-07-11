// 관리자 — 문의 쪽지 조회/확인완료/삭제 (기존 x-admin-key 인증).
import { NextRequest, NextResponse } from "next/server";
import { getAdminPassword } from "@/lib/settings";
import { readInquiries, writeInquiries } from "@/lib/inquiries";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-admin-key") === getAdminPassword();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ inquiries: await readInquiries() });
}

// 확인완료 토글
export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: string; confirmed?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const list = await readInquiries();
  const it = list.find((x) => x.id === body.id);
  if (it) it.confirmed = body.confirmed !== false;
  await writeInquiries(list);
  return NextResponse.json({ ok: true, inquiries: list });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await writeInquiries((await readInquiries()).filter((x) => x.id !== id));
  return NextResponse.json({ ok: true });
}
