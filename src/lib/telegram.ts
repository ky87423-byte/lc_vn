// 텔레그램 가격 알림 (서버측). 무료 텔레그램 Bot API 사용.
//
// 흐름:
//  1) 사용자가 게임시세에서 "텔레그램 알림" → t.me/{bot}?start={slug}_{serverId}_{price}_{b|a}
//  2) 봇 [시작] → getUpdates 폴러가 /start 페이로드 + chatId를 받아 구독 저장(alerts.json)
//  3) checkAlerts()가 매 tick 최신 최저가를 보고 조건 충족 시 메시지 발송(+재무장 히스테리시스)
//
// TELEGRAM_BOT_TOKEN(.env.local) 없으면 전부 no-op. 토큰은 코드/깃에 넣지 않음.

import { promises as fs } from "fs";
import path from "path";
import { GAMES } from "@/data/site";
import { readHistory } from "@/lib/history";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = "https://gamesise.co.kr";
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : "";
const ALERTS_PATH = path.join(process.cwd(), "data", "alerts.json");

export interface AlertSub {
  id: string;
  chatId?: number; // 텔레그램 대상
  webhook?: string; // 디스코드 대상(채널 웹훅 URL)
  slug: string;
  serverId: string;
  threshold: number; // 원/단위
  dir: "below" | "above";
  armed: boolean; // true면 조건 도달 시 발송. 발송 후 false, 반대편 넘어가면 재무장.
  createdAt: number;
  lastFiredAt?: number;
}

// ---- 저장 (항상 디스크 머지) ----
async function readSubs(): Promise<AlertSub[]> {
  try {
    const raw = await fs.readFile(ALERTS_PATH, "utf8");
    const j = JSON.parse(raw) as { subs?: AlertSub[] };
    return Array.isArray(j.subs) ? j.subs : [];
  } catch {
    return [];
  }
}
async function writeSubs(subs: AlertSub[]): Promise<void> {
  await fs.mkdir(path.dirname(ALERTS_PATH), { recursive: true });
  await fs.writeFile(ALERTS_PATH, JSON.stringify({ subs }), "utf8");
}

// ---- 텔레그램 API ----
async function tg(method: string, body: unknown): Promise<unknown> {
  if (!API) return null;
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return await res.json();
  } catch {
    return null;
  }
}
async function sendMessage(chatId: number, text: string): Promise<void> {
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

// 디스코드 채널 웹훅으로 메시지 전송(HTML 아님 → 태그 제거한 평문)
async function sendDiscord(webhook: string, text: string): Promise<boolean> {
  if (!DISCORD_WEBHOOK_RE.test(webhook)) return false;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "게임시세 알림",
        content: text.replace(/<\/?b>/g, "**"),
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 구독 대상에 맞춰 발송
async function notify(sub: AlertSub, text: string): Promise<void> {
  if (sub.webhook) await sendDiscord(sub.webhook, text);
  else if (sub.chatId) await sendMessage(sub.chatId, text);
}

// ---- 이름/시세 조회 ----
function lookup(slug: string, serverId: string) {
  const game = GAMES.find((g) => g.slug === slug);
  const server = game?.servers.find((s) => s.id === serverId);
  return { game, server };
}

// 활성 거래소(바로템+아이템베이) 최신값 중 최저가 = 게임시세 헤드라인과 일치
async function latestLowest(slug: string, serverId: string): Promise<number | null> {
  const prices: number[] = [];
  for (const ex of [undefined, "itembay"]) {
    const hist = await readHistory(slug, ex);
    for (let i = hist.length - 1; i >= 0; i--) {
      const v = hist[i].p[serverId];
      if (typeof v === "number" && v > 0) {
        prices.push(v);
        break;
      }
    }
  }
  return prices.length ? Math.min(...prices) : null;
}

// ---- 구독 등록 (/start 페이로드) ----
// 페이로드: {slug}_{serverId}_{threshold}_{b|a}  (slug엔 _ 없음)
async function registerSub(chatId: number, payload: string): Promise<void> {
  const parts = payload.split("_");
  if (parts.length !== 4) {
    await sendMessage(
      chatId,
      "알림 등록 정보를 읽지 못했어요. 게임시세 사이트의 알림 버튼으로 다시 시도해 주세요."
    );
    return;
  }
  const [slug, serverId, priceStr, d] = parts;
  const threshold = Number(priceStr);
  const dir: "below" | "above" = d === "a" ? "above" : "below";
  const { game, server } = lookup(slug, serverId);
  if (!game || !server || !Number.isFinite(threshold) || threshold <= 0) {
    await sendMessage(chatId, "알림 대상을 찾지 못했어요. 다시 시도해 주세요.");
    return;
  }
  const id = `${chatId}:${slug}:${serverId}:${dir}`;
  const subs = await readSubs();
  const existing = subs.find((s) => s.id === id);
  const sub: AlertSub = {
    id,
    chatId,
    slug,
    serverId,
    threshold,
    dir,
    armed: true,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  const next = subs.filter((s) => s.id !== id);
  next.push(sub);
  await writeSubs(next);

  const dirText = dir === "below" ? "이하" : "이상";
  await sendMessage(
    chatId,
    `✅ <b>${game.nameKo} ${server.nameKo}</b> 알림 등록 완료\n` +
      `기준: <b>${threshold.toLocaleString("ko-KR")}원 ${dirText}</b> (${game.currency} ${game.fallbackUnit >= 10000 ? game.fallbackUnit / 10000 + "만" : game.fallbackUnit}당)\n` +
      `조건에 도달하면 알려드릴게요. 해제는 /list 에서.`
  );
}

async function listSubs(chatId: number): Promise<void> {
  const subs = (await readSubs()).filter((s) => s.chatId === chatId);
  if (subs.length === 0) {
    await sendMessage(chatId, "등록된 알림이 없어요.");
    return;
  }
  const lines = subs.map((s) => {
    const { game, server } = lookup(s.slug, s.serverId);
    const dirText = s.dir === "below" ? "이하" : "이상";
    return `• ${game?.nameKo ?? s.slug} ${server?.nameKo ?? s.serverId} — ${s.threshold.toLocaleString("ko-KR")}원 ${dirText}${s.armed ? "" : " (발송됨·대기)"}`;
  });
  await sendMessage(
    chatId,
    "🔔 등록된 알림\n" + lines.join("\n") + "\n\n전체 해제: /clear"
  );
}

async function clearSubs(chatId: number): Promise<void> {
  const subs = await readSubs();
  await writeSubs(subs.filter((s) => s.chatId !== chatId));
  await sendMessage(chatId, "모든 알림을 해제했어요.");
}

// ---- 디스코드 구독 등록 (게임시세 폼 → lc_vn /api/alert) ----
export interface DiscordRegResult {
  ok: boolean;
  error?: string;
}
export async function addDiscordSub(params: {
  webhook: string;
  slug: string;
  serverId: string;
  threshold: number;
  dir: "below" | "above";
}): Promise<DiscordRegResult> {
  const { webhook, slug, serverId, threshold, dir } = params;
  if (!DISCORD_WEBHOOK_RE.test(webhook))
    return { ok: false, error: "유효한 디스코드 웹훅 URL이 아닙니다." };
  const { game, server } = lookup(slug, serverId);
  if (!game || !server || !Number.isFinite(threshold) || threshold <= 0)
    return { ok: false, error: "알림 대상을 찾지 못했습니다." };

  const webhookId = webhook.match(/webhooks\/(\d+)\//)?.[1] ?? webhook.slice(-12);
  const id = `d:${webhookId}:${slug}:${serverId}:${dir}`;
  const subs = await readSubs();
  const existing = subs.find((s) => s.id === id);
  const sub: AlertSub = {
    id,
    webhook,
    slug,
    serverId,
    threshold,
    dir,
    armed: true,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await writeSubs([...subs.filter((s) => s.id !== id), sub]);

  const dirText = dir === "below" ? "이하" : "이상";
  await sendDiscord(
    webhook,
    `✅ **${game.nameKo} ${server.nameKo}** 알림 등록 완료\n` +
      `기준: ${threshold.toLocaleString("ko-KR")}원 ${dirText} — 조건 도달 시 알려드립니다.`
  );
  return { ok: true };
}

// ---- getUpdates 폴러 ----
let polling = false;
export function startTelegramPoller(): void {
  if (!TOKEN || polling) return;
  polling = true;
  let offset = 0;
  const loop = async () => {
    while (polling) {
      const res = (await tg("getUpdates", { offset, timeout: 30 })) as {
        ok?: boolean;
        result?: Array<{
          update_id: number;
          message?: { chat?: { id?: number }; text?: string };
        }>;
      } | null;
      if (res?.ok && Array.isArray(res.result)) {
        for (const u of res.result) {
          offset = u.update_id + 1;
          const chatId = u.message?.chat?.id;
          const text = (u.message?.text ?? "").trim();
          if (!chatId) continue;
          try {
            if (text.startsWith("/start")) {
              const payload = text.slice(6).trim();
              if (payload) await registerSub(chatId, payload);
              else
                await sendMessage(
                  chatId,
                  "안녕하세요! 게임시세 가격 알림 봇이에요.\n게임시세 사이트의 서버 페이지에서 '텔레그램 알림' 버튼으로 알림을 등록할 수 있어요."
                );
            } else if (text.startsWith("/list")) {
              await listSubs(chatId);
            } else if (text.startsWith("/clear")) {
              await clearSubs(chatId);
            }
          } catch {
            // 개별 업데이트 처리 실패는 폴링 지속에 영향 없음
          }
        }
      } else {
        await new Promise((r) => setTimeout(r, 5000)); // 오류 시 잠깐 쉼
      }
    }
  };
  void loop();
}

// ---- 알림 체크 (tick에서 호출) ----
const REARM_GAP = 0.0; // 반대편으로 넘어가면 즉시 재무장
export async function checkAlerts(): Promise<void> {
  if (!TOKEN) return;
  const subs = await readSubs();
  if (subs.length === 0) return;
  let changed = false;
  for (const sub of subs) {
    const price = await latestLowest(sub.slug, sub.serverId);
    if (price === null) continue;
    const hit =
      sub.dir === "below" ? price <= sub.threshold : price >= sub.threshold;
    if (sub.armed && hit) {
      const { game, server } = lookup(sub.slug, sub.serverId);
      const dirText = sub.dir === "below" ? "이하" : "이상";
      await notify(
        sub,
        `🔔 <b>${game?.nameKo ?? sub.slug} ${server?.nameKo ?? sub.serverId}</b>\n` +
          `현재 <b>${price.toLocaleString("ko-KR")}원</b> (기준 ${sub.threshold.toLocaleString("ko-KR")}원 ${dirText} 도달)\n` +
          `${SITE_URL}/ko/${sub.slug}/${sub.serverId}`
      );
      sub.armed = false;
      sub.lastFiredAt = Date.now();
      changed = true;
    } else if (!sub.armed) {
      // 히스테리시스: 가격이 기준 반대편으로 넘어가면 재무장
      const reset =
        sub.dir === "below"
          ? price > sub.threshold * (1 + REARM_GAP)
          : price < sub.threshold * (1 - REARM_GAP);
      if (reset) {
        sub.armed = true;
        changed = true;
      }
    }
  }
  if (changed) await writeSubs(subs);
}
