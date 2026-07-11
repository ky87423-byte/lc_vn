"use client";

// 관리자 페이지 — 매입 할인율(1~30%) 설정. 한국어 UI (운영자용)
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";

const STORAGE_KEY = "lc_vn_admin_key";

function formatSeconds(s: number): string {
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m}분` : `${m}분 ${rest}초`;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [percent, setPercent] = useState(15);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(30);
  const [cacheSeconds, setCacheSeconds] = useState(300);
  const [cacheMin, setCacheMin] = useState(30);
  const [cacheMax, setCacheMax] = useState(1800);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const login = useCallback(async (key: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) {
        setMessage({ type: "err", text: "비밀번호가 올바르지 않습니다." });
        setAuthed(false);
        return;
      }
      const data = (await res.json()) as {
        discountPercent: number;
        cacheSeconds: number;
        min: number;
        max: number;
        cacheMin: number;
        cacheMax: number;
      };
      setPercent(data.discountPercent);
      setMin(data.min);
      setMax(data.max);
      setCacheSeconds(data.cacheSeconds);
      setCacheMin(data.cacheMin);
      setCacheMax(data.cacheMax);
      setAuthed(true);
      sessionStorage.setItem(STORAGE_KEY, key);
    } catch {
      setMessage({ type: "err", text: "서버에 연결할 수 없습니다." });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPassword(saved);
      void login(saved);
    }
  }, [login]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": password,
        },
        body: JSON.stringify({ discountPercent: percent, cacheSeconds }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        discountPercent?: number;
        cacheSeconds?: number;
        error?: string;
      };
      if (res.ok && data.ok) {
        setMessage({
          type: "ok",
          text: `저장 완료 — 할인율 ${data.discountPercent}%, 시세 갱신 주기 ${formatSeconds(data.cacheSeconds!)}`,
        });
      } else {
        setMessage({ type: "err", text: data.error ?? "저장 실패" });
      }
    } catch {
      setMessage({ type: "err", text: "서버에 연결할 수 없습니다." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold text-zinc-50">관리자</h1>

      {!authed ? (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void login(password);
          }}
        >
          <label className="block">
            <span className="text-sm font-medium text-zinc-300">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-amber-500"
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "확인 중…" : "로그인"}
          </button>
        </form>
      ) : (
        <>
          <AdminNav current="settings" />
          <div className="mt-2 space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div>
            <div className="flex items-end justify-between">
              <span className="text-sm font-medium text-zinc-300">
                할인율 ({min}% ~ {max}%)
              </span>
              <span className="text-3xl font-extrabold text-amber-400">
                {percent}%
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="mt-3 w-full accent-amber-500"
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={min}
                max={max}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-amber-500"
              />
              <span className="text-sm text-zinc-400">%</span>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              예: 시세가 만당 1,000원이면 매입가는{" "}
              <span className="font-semibold text-zinc-200">
                {(1000 * (1 - percent / 100)).toFixed(0)}원
              </span>
            </p>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-end justify-between">
              <span className="text-sm font-medium text-zinc-300">
                시세 갱신 주기 ({formatSeconds(cacheMin)} ~{" "}
                {formatSeconds(cacheMax)})
              </span>
              <span className="text-3xl font-extrabold text-amber-400">
                {formatSeconds(cacheSeconds)}
              </span>
            </div>
            <input
              type="range"
              min={cacheMin}
              max={cacheMax}
              step={30}
              value={cacheSeconds}
              onChange={(e) => setCacheSeconds(Number(e.target.value))}
              className="mt-3 w-full accent-amber-500"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {[60, 180, 300, 600, 1800].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCacheSeconds(s)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    cacheSeconds === s
                      ? "border-amber-500 text-amber-400"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {formatSeconds(s)}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              짧을수록 시세가 최신이지만 바로템 조회가 잦아집니다. 방문자 수와
              무관하게 주기당 1회만 조회하므로 1분까지 줄여도 안전합니다.
            </p>
          </div>

          <button
            onClick={() => void save()}
            disabled={busy || percent < min || percent > max}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "저장 중…" : "저장"}
          </button>

          <p className="text-xs text-zinc-500">
            할인율은 저장 즉시 시세표에 반영됩니다. 시세 원본은 위 갱신
            주기마다 바로템에서 새로 가져옵니다.
          </p>
          </div>
        </>
      )}

      {message && (
        <p
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border border-emerald-800 bg-emerald-950/40 text-emerald-300"
              : "border border-red-800 bg-red-950/40 text-red-300"
          }`}
        >
          {message.text}
        </p>
      )}
    </main>
  );
}
