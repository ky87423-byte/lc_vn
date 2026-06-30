// 시세 이력 — 게임별로 스냅샷마다 서버별 최저가를 data/history-{game}.json에 축적
// 7일 초과분은 정리.
// 주의: Next.js는 instrumentation과 라우트 핸들러를 별도 모듈 인스턴스로 로드하므로
// 파일을 단일 진실 공급원으로 사용한다(append 시 항상 디스크에서 다시 읽어 병합).

import { promises as fs } from "fs";
import path from "path";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const MIN_POINT_GAP_MS = 15 * 1000; // 너무 촘촘한 중복 포인트 방지
const READ_TTL_MS = 15 * 1000; // 조회용 짧은 메모리 캐시

export interface HistoryPoint {
  t: number; // epoch ms
  /** serverId → 시세(원/단위), 매물 없으면 null */
  p: Record<string, number | null>;
  /** serverId → 매물 수 (거래가능물품 건수). 구버전 포인트엔 없을 수 있음 */
  c?: Record<string, number>;
}

const caches = new Map<string, { points: HistoryPoint[]; loadedAt: number }>();

// 거래소별 파일: 바로템(기본)=history-{game}.json, 그 외=history-{game}-{exchange}.json
function fileKey(gameSlug: string, exchange?: string): string {
  return exchange && exchange !== "barotem" ? `${gameSlug}-${exchange}` : gameSlug;
}

function historyPath(gameSlug: string, exchange?: string): string {
  return path.join(
    process.cwd(),
    "data",
    `history-${fileKey(gameSlug, exchange)}.json`
  );
}

async function readFromDisk(
  gameSlug: string,
  exchange?: string
): Promise<HistoryPoint[]> {
  try {
    const raw = await fs.readFile(historyPath(gameSlug, exchange), "utf8");
    const parsed = JSON.parse(raw) as { points?: HistoryPoint[] };
    return Array.isArray(parsed.points) ? parsed.points : [];
  } catch {
    return [];
  }
}

export async function readHistory(
  gameSlug: string,
  exchange?: string
): Promise<HistoryPoint[]> {
  const key = fileKey(gameSlug, exchange);
  const cached = caches.get(key);
  if (cached && Date.now() - cached.loadedAt < READ_TTL_MS)
    return cached.points;
  const points = await readFromDisk(gameSlug, exchange);
  caches.set(key, { points, loadedAt: Date.now() });
  return points;
}

export async function appendHistory(
  gameSlug: string,
  t: number,
  prices: Record<string, number | null>,
  counts?: Record<string, number>,
  exchange?: string
): Promise<void> {
  const key = fileKey(gameSlug, exchange);
  // 항상 디스크 기준으로 병합 — 다른 모듈 인스턴스의 기록을 덮어쓰지 않도록
  const points = await readFromDisk(gameSlug, exchange);
  const last = points[points.length - 1];
  if (!last || t - last.t >= MIN_POINT_GAP_MS) {
    points.push(counts ? { t, p: prices, c: counts } : { t, p: prices });
  }
  const cutoff = Date.now() - MAX_AGE_MS;
  const pruned = points.filter((pt) => pt.t >= cutoff);
  caches.set(key, { points: pruned, loadedAt: Date.now() });
  try {
    const file = historyPath(gameSlug, exchange);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ points: pruned }), "utf8");
  } catch {
    // 파일 저장 실패해도 메모리 이력은 유지
  }
}

/** 특정 서버의 (t, 시세) 시계열 — null 제외, 오래된 순 */
export function seriesFor(
  history: HistoryPoint[],
  serverId: string,
  sinceMs: number
): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  for (const pt of history) {
    if (pt.t < sinceMs) continue;
    const v = pt.p[serverId];
    if (typeof v === "number" && v > 0) out.push({ t: pt.t, v });
  }
  return out;
}

/** 24시간 전 대비 등락률(%) — 이력이 1시간 미만이면 null */
export function change24h(
  history: HistoryPoint[],
  serverId: string,
  currentPrice: number | null
): number | null {
  if (currentPrice === null) return null;
  const pts = seriesFor(history, serverId, 0);
  if (pts.length === 0) return null;
  const target = Date.now() - 24 * 60 * 60 * 1000;
  let base = pts[0];
  for (const p of pts) {
    if (Math.abs(p.t - target) < Math.abs(base.t - target)) base = p;
  }
  // 기준점이 너무 최근이면(1시간 미만) 의미 없는 0%라 표시 안 함
  if (Date.now() - base.t < 60 * 60 * 1000) return null;
  return ((currentPrice - base.v) / base.v) * 100;
}

/** 시계열을 최대 maxPoints개로 다운샘플(버킷 평균) */
export function downsample(
  pts: { t: number; v: number }[],
  maxPoints: number
): { t: number; v: number }[] {
  if (pts.length <= maxPoints) return pts;
  const bucketSize = pts.length / maxPoints;
  const out: { t: number; v: number }[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(pts.length, Math.floor((i + 1) * bucketSize));
    let sumT = 0;
    let sumV = 0;
    let n = 0;
    for (let j = start; j < end; j++) {
      sumT += pts[j].t;
      sumV += pts[j].v;
      n++;
    }
    if (n > 0) out.push({ t: Math.round(sumT / n), v: sumV / n });
  }
  return out;
}
