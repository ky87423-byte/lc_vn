"use client";

import { useCallback, useEffect, useState } from "react";
import type { PriceTableData } from "@/lib/barotem";

const nfVnd = new Intl.NumberFormat("vi-VN");
const nfKrw = new Intl.NumberFormat("ko-KR");

export default function PriceTable() {
  const [data, setData] = useState<PriceTableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/prices");
      if (!res.ok) throw new Error("failed");
      setData((await res.json()) as PriceTableData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
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
    );
  }

  if (error || !data) {
    return (
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
    );
  }

  const updated = new Date(data.updatedAt);
  const active = data.servers.filter((s) => s.buyPricePerManKrw !== null);
  const inactive = data.servers.filter((s) => s.buyPricePerManKrw === null);

  return (
    <div>
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

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-4 py-3">Máy chủ (서버)</th>
              <th className="px-4 py-3 text-right">
                Giá thu mua (VND / 10.000 Adena)
              </th>
              <th className="px-4 py-3 text-right">KRW / 10.000 Adena</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {active.map((s) => (
              <tr key={s.serverId} className="hover:bg-zinc-900/60">
                <td className="px-4 py-3 font-medium text-zinc-100">
                  {s.nameEn}{" "}
                  <span className="text-zinc-500">({s.nameKo})</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-amber-400">
                  {s.buyPricePerManVnd !== null
                    ? `${nfVnd.format(s.buyPricePerManVnd)} ₫`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-400">
                  {s.buyPricePerManKrw !== null
                    ? `₩${nfKrw.format(s.buyPricePerManKrw)}`
                    : "—"}
                </td>
              </tr>
            ))}
            {inactive.length > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-xs text-zinc-500">
                  Liên hệ để báo giá (시세 문의):{" "}
                  {inactive.map((s) => s.nameEn).join(", ")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        * Giá thu mua được tính theo giá thị trường thời gian thực trừ{" "}
        {Math.round(data.discountRate * 100)}%. Giá có thể thay đổi theo thời
        điểm giao dịch. (실시간 시세 기준 {Math.round(data.discountRate * 100)}
        % 할인 적용 매입가)
      </p>
    </div>
  );
}
