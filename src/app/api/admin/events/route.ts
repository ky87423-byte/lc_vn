import { NextRequest, NextResponse } from "next/server";
import { getAdminPassword } from "@/lib/settings";
import { readEvents, writeEvents, sanitizeEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-admin-key") === getAdminPassword();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ events: await readEvents() });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ev = sanitizeEvent(body);
  if (!ev)
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  const events = await readEvents();
  const idx = events.findIndex((e) => e.id === ev.id);
  if (idx >= 0) events[idx] = ev;
  else events.push(ev);
  await writeEvents(events);
  return NextResponse.json({ ok: true, events });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const events = (await readEvents()).filter((e) => e.id !== id);
  await writeEvents(events);
  return NextResponse.json({ ok: true, events });
}
