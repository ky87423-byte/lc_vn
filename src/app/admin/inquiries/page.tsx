"use client";

// 관리자 — 광고/제휴 문의 쪽지 조회. 확인완료 토글, 삭제.
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "lc_vn_admin_key";

interface Inquiry {
  id: string;
  ts: number;
  title: string;
  content: string;
  telegram: string;
  kakao: string;
  zalo: string;
  wechat: string;
  confirmed: boolean;
}

function fmt(ts: number): string {
  return new Date(ts + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

export default function AdminInquiriesPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<Inquiry[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (k: string) => {
    const res = await fetch("/api/admin/inquiries", { headers: { "x-admin-key": k } });
    if (res.status === 401) {
      setMsg("비밀번호가 올바르지 않습니다.");
      setAuthed(false);
      return;
    }
    const data = (await res.json()) as { inquiries: Inquiry[] };
    setItems(data.inquiries);
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

  async function toggle(it: Inquiry) {
    const res = await fetch("/api/admin/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ id: it.id, confirmed: !it.confirmed }),
    });
    if (res.ok) setItems(((await res.json()) as { inquiries: Inquiry[] }).inquiries);
  }

  async function del(id: string) {
    const res = await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-admin-key": key },
    });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  }

  if (!authed) {
    return (
      <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>문의 쪽지 관리</h1>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="관리자 비밀번호"
          style={{ width: "100%", padding: 8, margin: "8px 0" }}
        />
        <button onClick={() => load(key)} style={{ padding: "8px 16px" }}>로그인</button>
        {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      </main>
    );
  }

  const sorted = [...items].sort((a, b) => b.ts - a.ts);
  const unread = items.filter((x) => !x.confirmed).length;

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif", padding: 16 }}>
      <h1>광고/제휴 문의 ({items.length}건, 미확인 {unread})</h1>
      {sorted.length === 0 && <p style={{ color: "#666" }}>문의가 없습니다.</p>}
      {sorted.map((it) => (
        <div
          key={it.id}
          style={{
            border: "1px solid #ddd",
            borderLeft: `4px solid ${it.confirmed ? "#bbb" : "#0a7"}`,
            borderRadius: 8,
            padding: 14,
            margin: "12px 0",
            background: it.confirmed ? "#fafafa" : "#fff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong>{it.title || "(제목 없음)"}</strong>
            <span style={{ color: "#999", fontSize: 13, whiteSpace: "nowrap" }}>{fmt(it.ts)}</span>
          </div>
          {it.content && (
            <p style={{ whiteSpace: "pre-wrap", margin: "8px 0", fontSize: 14 }}>{it.content}</p>
          )}
          <div style={{ fontSize: 13, color: "#333", display: "flex", flexWrap: "wrap", gap: 12 }}>
            {it.telegram && <span>텔레그램: <b>{it.telegram}</b></span>}
            {it.kakao && <span>카카오톡: <b>{it.kakao}</b></span>}
            {it.zalo && <span>Zalo: <b>{it.zalo}</b></span>}
            {it.wechat && <span>WeChat: <b>{it.wechat}</b></span>}
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => toggle(it)}
              style={{
                padding: "6px 12px",
                marginRight: 8,
                background: it.confirmed ? "#eee" : "#0a7",
                color: it.confirmed ? "#333" : "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {it.confirmed ? "(확인완료) ↺ 되돌리기" : "확인완료로 표시"}
            </button>
            <button onClick={() => del(it.id)} style={{ color: "crimson", background: "none", border: "none", cursor: "pointer" }}>
              삭제
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
