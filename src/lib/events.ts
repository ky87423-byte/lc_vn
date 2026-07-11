// 차트 이벤트 마커 — 관리자가 등록/수정, data/chart-events.json에 저장(git 제외).
// gametick이 GAMETICK_DATA_DIR로 읽어 캔들 위 핀으로 표시. 서버별/게임전체(server="*").

import { promises as fs } from "fs";
import path from "path";

const EVENTS_PATH = path.join(process.cwd(), "data", "chart-events.json");

export interface ChartEvent {
  id: string;
  game: string; // 게임 slug
  server: string; // 서버 id, 또는 "*"(게임 전체)
  ts: number; // 이벤트 시각 (epoch ms)
  title: string;
  color: string; // #rrggbb
  position: "aboveBar" | "belowBar";
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
}

const POSITIONS = ["aboveBar", "belowBar"] as const;
const SHAPES = ["circle", "square", "arrowUp", "arrowDown"] as const;

export async function readEvents(): Promise<ChartEvent[]> {
  try {
    const raw = await fs.readFile(EVENTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as { events?: ChartEvent[] };
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

export async function writeEvents(events: ChartEvent[]): Promise<void> {
  await fs.mkdir(path.dirname(EVENTS_PATH), { recursive: true });
  await fs.writeFile(EVENTS_PATH, JSON.stringify({ events }, null, 2), "utf8");
}

/** 입력 정규화·검증 → 유효하면 ChartEvent, 아니면 null */
export function sanitizeEvent(input: unknown): ChartEvent | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const game = typeof o.game === "string" ? o.game : "";
  const server = typeof o.server === "string" ? o.server : "";
  const ts = Number(o.ts);
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 30) : "";
  if (!game || !server || !Number.isFinite(ts) || ts <= 0 || !title) return null;
  const color =
    typeof o.color === "string" && /^#[0-9a-fA-F]{6}$/.test(o.color)
      ? o.color
      : "#f59e0b";
  const position = POSITIONS.includes(o.position as never)
    ? (o.position as ChartEvent["position"])
    : "aboveBar";
  const shape = SHAPES.includes(o.shape as never)
    ? (o.shape as ChartEvent["shape"])
    : "circle";
  const id =
    typeof o.id === "string" && o.id
      ? o.id
      : `ev_${ts}_${Math.random().toString(36).slice(2, 8)}`;
  return { id, game, server, ts, title, color, position, shape };
}
