"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { PriceTableData } from "@/lib/barotem";
import { DEFAULT_GAME_SLUG, GAMES } from "@/data/site";

const nfVnd = new Intl.NumberFormat("vi-VN");
const nfKrw = new Intl.NumberFormat("ko-KR");

// ---- 등락률 뱃지 ----
function ChangeBadge({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="text-xs text-zinc-600">—</span>;
  }
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0) {
    return <span className="text-sm text-zinc-400">0%</span>;
  }
  const up = rounded > 0;
  return (
    <span
      className={`text-sm font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(rounded)}%
    </span>
  );
}

// ---- 스파크라인 (의존성 없는 SVG) ----
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <span className="text-xs text-zinc-600">수집 중…</span>;
  }
  const w = 96;
  const h = 28;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  const color = up ? "#34d399" : "#f87171";
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---- 확장 차트 ----
interface HistoryPointDto {
  t: number;
  buyVnd: number;
  marketKrw: number;
}

function ExpandedChart({
  game,
  serverId,
  unitLabel,
}: {
  game: string;
  serverId: string;
  unitLabel: string;
}) {
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const [points, setPoints] = useState<HistoryPointDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setFailed(false);
    fetch(`/api/history?game=${game}&server=${serverId}&range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { points: HistoryPointDto[] }) => {
        if (!cancelled) setPoints(d.points);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [game, serverId, range]);

  const w = 720;
  const h = 180;
  const padX = 8;
  const padY = 14;

  let body: React.ReactNode;
  if (failed) {
    body = (
      <p className="py-10 text-center text-sm text-zinc-500">
        Không thể tải biểu đồ.
      </p>
    );
  } else if (points === null) {
    body = (
      <div className="h-[180px] animate-pulse rounded-lg bg-zinc-800/60" />
    );
  } else if (points.length < 2) {
    body = (
      <p className="py-10 text-center text-sm text-zinc-500">
        Chưa đủ dữ liệu — đang thu thập giá. (이력 수집 중)
      </p>
    );
  } else {
    const vals = points.map((p) => p.buyVnd);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const xy = points.map((p, i) => {
      const x = padX + (i / (points.length - 1)) * (w - padX * 2);
      const y = padY + (1 - (p.buyVnd - min) / span) * (h - padY * 2);
      return { x, y };
    });
    const line = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${padX},${h - padY} ${line} ${(w - padX).toFixed(1)},${h - padY}`;
    const up = vals[vals.length - 1] >= vals[0];
    const color = up ? "#34d399" : "#f87171";
    const fmtTime = (t: number) =>
      new Date(t).toLocaleString("vi-VN", {
        ...(range === "24h"
          ? { hour: "2-digit", minute: "2-digit" }
          : { day: "2-digit", month: "2-digit" }),
      });
    body = (
      <div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>
            Cao nhất:{" "}
            <span className="text-zinc-300">{nfVnd.format(max)} ₫</span>
          </span>
          <span>
            Thấp nhất:{" "}
            <span className="text-zinc-300">{nfVnd.format(min)} ₫</span>
          </span>
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="mt-1 w-full"
          preserveAspectRatio="none"
        >
          <polygon points={area} fill={color} opacity="0.08" />
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{fmtTime(points[0].t)}</span>
          <span>{fmtTime(points[points.length - 1].t)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-300">
          Giá thu mua (VND / {unitLabel})
        </span>
        <div className="ml-auto flex gap-1">
          {(["24h", "7d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md border px-3 py-1 text-xs ${
                range === r
                  ? "border-amber-500 text-amber-400"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {r === "24h" ? "24 giờ" : "7 ngày"}
            </button>
          ))}
        </div>
      </div>
      {body}
    </div>
  );
}

// ---- 시세 표 ----
export default function PriceTable() {
  const [gameSlug, setGameSlug] = useState(DEFAULT_GAME_SLUG);
  const [data, setData] = useState<PriceTableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/prices?game=${gameSlug}`);
        if (!res.ok) throw new Error("failed");
        setData((await res.json()) as PriceTableData);
      } catch {
        // 자동 갱신 실패는 조용히 무시하고 기존 표 유지
        if (!silent) setError(true);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [gameSlug]
  );

  // 게임 변경 시 표 초기화 후 다시 로드
  useEffect(() => {
    setData(null);
    setExpanded(null);
    void load();
  }, [load]);

  // 자동 갱신 — 서버 캐시 주기에 맞춰 폴링, 탭이 보일 때만
  const pollMs = Math.max(30, data?.cacheSeconds ?? 300) * 1000;
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void load(true);
    };
    const timer = setInterval(tick, pollMs);
    // 탭으로 돌아오면 즉시 최신화
    const onVisible = () => {
      if (!document.hidden) void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, pollMs]);

  const unitLabel = data
    ? `${nfVnd.format(data.game.unitAmount)} ${data.game.currency}`
    : "";

  const gameTabs = (
    <div className="mb-4 flex flex-wrap gap-2">
      {GAMES.map((g) => (
        <button
          key={g.slug}
          onClick={() => setGameSlug(g.slug)}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
            gameSlug === g.slug
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
          }`}
        >
          {g.nameEn}
        </button>
      ))}
    </div>
  );

  if (loading && !data) {
    return (
      <div>
        {gameTabs}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-zinc-800/60"
            />
          ))}
          <p className="pt-2 text-center text-sm text-zinc-400">
            Đang tải bảng giá… / 시세 불러오는 중…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        {gameTabs}
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-6 text-center">
          <p className="text-red-300">
            Không thể tải bảng giá. Vui lòng thử lại.
          </p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
          >
            Thử lại / 다시 시도
          </button>
        </div>
      </div>
    );
  }

  const updated = new Date(data.updatedAt);
  const active = data.servers.filter((s) => s.buyPricePerUnitKrw !== null);
  const inactive = data.servers.filter((s) => s.buyPricePerUnitKrw === null);

  return (
    <div>
      {gameTabs}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-400">
        <span>
          Cập nhật: {updated.toLocaleString("vi-VN")} · 1 KRW ≈{" "}
          {data.krwToVnd.toFixed(2)} VND
        </span>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-zinc-700 px-3 py-1.5 font-medium text-zinc-200 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
        >
          {loading ? "Đang tải…" : "↻ Làm mới / 새로고침"}
        </button>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-400">
          Hiện chưa có niêm yết {data.game.currency} trên thị trường cho{" "}
          {data.game.nameEn}. Liên hệ trực tiếp để báo giá!
          <span className="mt-1 block text-xs text-zinc-500">
            (현재 매물 없음 — 직접 문의)
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-4 py-3">Máy chủ (서버)</th>
                <th className="px-4 py-3 text-right">
                  Giá thu mua (VND / {unitLabel})
                </th>
                <th className="px-4 py-3 text-right">KRW</th>
                <th className="px-4 py-3 text-right">24h</th>
                <th className="px-4 py-3 text-center">Biểu đồ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {active.map((s) => (
                <Fragment key={s.serverId}>
                  <tr
                    onClick={() =>
                      setExpanded(expanded === s.serverId ? null : s.serverId)
                    }
                    className={`cursor-pointer hover:bg-zinc-900/60 ${
                      expanded === s.serverId ? "bg-zinc-900/60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-100">
                      {s.nameEn}{" "}
                      <span className="text-zinc-500">({s.nameKo})</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-400">
                      {s.buyPricePerUnitVnd !== null
                        ? `${nfVnd.format(s.buyPricePerUnitVnd)} ₫`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {s.buyPricePerUnitKrw !== null
                        ? `₩${nfKrw.format(s.buyPricePerUnitKrw)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChangeBadge percent={s.change24hPercent} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Sparkline values={s.spark} />
                    </td>
                  </tr>
                  {expanded === s.serverId && (
                    <tr className="bg-zinc-950/60">
                      <td colSpan={5}>
                        <ExpandedChart
                          game={data.game.slug}
                          serverId={s.serverId}
                          unitLabel={unitLabel}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {inactive.length > 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-xs text-zinc-500">
                    Liên hệ để báo giá (시세 문의):{" "}
                    {inactive.map((s) => s.nameEn).join(", ")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        * Giá thu mua được tính theo giá thị trường thời gian thực trừ{" "}
        {Math.round(data.discountRate * 100)}%. Nhấn vào máy chủ để xem biểu
        đồ. (실시간 시세 기준 {Math.round(data.discountRate * 100)}% 할인 적용
        매입가 — 행을 클릭하면 차트)
      </p>
    </div>
  );
}
