"use client";

// 관리자 — 차트 이벤트 마커 등록/수정/삭제. gametick 캔들 위 핀으로 표시됨.
// 인증: /admin과 동일한 x-admin-key(sessionStorage 재사용 or 직접 입력).

import { useCallback, useEffect, useState } from "react";
import { GAMES } from "@/data/site";

const STORAGE_KEY = "lc_vn_admin_key";

interface ChartEvent {
  id: string;
  game: string;
  server: string;
  ts: number;
  title: string;
  color: string;
  position: "aboveBar" | "belowBar";
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
}

const COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#e4e4e7"];

// datetime-local 값(KST로 해석) → epoch ms
function toTs(local: string): number {
  return new Date(local + ":00+09:00").getTime();
}
// epoch ms → datetime-local 값(KST)
function toLocal(ts: number): string {
  const d = new Date(ts + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
function fmtKst(ts: number): string {
  return new Date(ts + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
}

export default function AdminEventsPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [events, setEvents] = useState<ChartEvent[]>([]);
  const [msg, setMsg] = useState("");

  // 폼 상태
  const [game, setGame] = useState(GAMES[0].slug);
  const [server, setServer] = useState("*");
  const [when, setWhen] = useState(toLocal(Date.now()));
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [position, setPosition] = useState<"aboveBar" | "belowBar">("aboveBar");
  const [shape, setShape] = useState<ChartEvent["shape"]>("circle");
  const [editId, setEditId] = useState<string | null>(null);

  const servers = GAMES.find((g) => g.slug === game)?.servers ?? [];

  const load = useCallback(async (k: string) => {
    const res = await fetch("/api/admin/events", { headers: { "x-admin-key": k } });
    if (res.status === 401) {
      setMsg("비밀번호가 올바르지 않습니다.");
      setAuthed(false);
      return;
    }
    const data = (await res.json()) as { events: ChartEvent[] };
    setEvents(data.events);
    setAuthed(true);
    setMsg("");
    sessionStorage.setItem(STORAGE_KEY, k);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, [load]);

  function resetForm() {
    setEditId(null);
    setTitle("");
    setColor(COLORS[0]);
    setPosition("aboveBar");
    setShape("circle");
    setWhen(toLocal(Date.now()));
  }

  async function save() {
    if (!title.trim()) {
      setMsg("제목을 입력하세요.");
      return;
    }
    const body = {
      id: editId ?? undefined,
      game,
      server,
      ts: toTs(when),
      title: title.trim(),
      color,
      position,
      shape,
    };
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMsg("저장 실패");
      return;
    }
    const data = (await res.json()) as { events: ChartEvent[] };
    setEvents(data.events);
    setMsg(editId ? "수정됨" : "등록됨");
    resetForm();
  }

  async function del(id: string) {
    const res = await fetch(`/api/admin/events?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-admin-key": key },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { events: ChartEvent[] };
    setEvents(data.events);
    if (editId === id) resetForm();
  }

  function edit(e: ChartEvent) {
    setEditId(e.id);
    setGame(e.game);
    setServer(e.server);
    setWhen(toLocal(e.ts));
    setTitle(e.title);
    setColor(e.color);
    setPosition(e.position);
    setShape(e.shape);
  }

  const gameName = (slug: string) => GAMES.find((g) => g.slug === slug)?.nameKo ?? slug;
  const serverName = (slug: string, sid: string) =>
    sid === "*"
      ? "전체"
      : GAMES.find((g) => g.slug === slug)?.servers.find((s) => s.id === sid)?.nameKo ?? sid;

  if (!authed) {
    return (
      <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>차트 이벤트 관리</h1>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="관리자 비밀번호"
          style={{ width: "100%", padding: 8, margin: "8px 0" }}
        />
        <button onClick={() => load(key)} style={{ padding: "8px 16px" }}>
          로그인
        </button>
        {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", fontFamily: "sans-serif", padding: 16 }}>
      <h1>차트 이벤트 마커 {editId && "(수정 중)"}</h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        gametick 서버 상세 캔들차트 위에 핀으로 표시됩니다. 서버=전체면 그 게임 모든 서버에 표시.
      </p>

      <div style={{ display: "grid", gap: 8, border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
        <label>게임
          <select value={game} onChange={(e) => { setGame(e.target.value); setServer("*"); }} style={{ marginLeft: 8 }}>
            {GAMES.map((g) => <option key={g.slug} value={g.slug}>{g.nameKo}</option>)}
          </select>
        </label>
        <label>서버
          <select value={server} onChange={(e) => setServer(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="*">전체 (게임 전 서버)</option>
            {servers.map((s) => <option key={s.id} value={s.id}>{s.nameKo}</option>)}
          </select>
        </label>
        <label>시각(KST)
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ marginLeft: 8 }} />
        </label>
        <label>제목
          <input value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} placeholder="예: 대규모 패치" style={{ marginLeft: 8, width: 260 }} />
        </label>
        <label>색
          <span style={{ marginLeft: 8 }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} title={c}
                style={{ width: 22, height: 22, background: c, border: color === c ? "3px solid #000" : "1px solid #ccc", marginRight: 4, cursor: "pointer" }} />
            ))}
          </span>
        </label>
        <label>위치
          <select value={position} onChange={(e) => setPosition(e.target.value as "aboveBar" | "belowBar")} style={{ marginLeft: 8 }}>
            <option value="aboveBar">위</option>
            <option value="belowBar">아래</option>
          </select>
        </label>
        <label>모양
          <select value={shape} onChange={(e) => setShape(e.target.value as ChartEvent["shape"])} style={{ marginLeft: 8 }}>
            <option value="circle">원</option>
            <option value="square">사각</option>
            <option value="arrowUp">화살표▲</option>
            <option value="arrowDown">화살표▼</option>
          </select>
        </label>
        <div>
          <button onClick={save} style={{ padding: "8px 16px", marginRight: 8 }}>
            {editId ? "수정 저장" : "등록"}
          </button>
          {editId && <button onClick={resetForm}>취소</button>}
          {msg && <span style={{ marginLeft: 12, color: "#0a7" }}>{msg}</span>}
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>등록된 이벤트 ({events.length})</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
            <th>시각(KST)</th><th>게임</th><th>서버</th><th>제목</th><th></th><th></th>
          </tr>
        </thead>
        <tbody>
          {[...events].sort((a, b) => b.ts - a.ts).map((e) => (
            <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{fmtKst(e.ts)}</td>
              <td>{gameName(e.game)}</td>
              <td>{serverName(e.game, e.server)}</td>
              <td><span style={{ color: e.color }}>●</span> {e.title}</td>
              <td><button onClick={() => edit(e)}>수정</button></td>
              <td><button onClick={() => del(e.id)} style={{ color: "crimson" }}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
