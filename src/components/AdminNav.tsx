"use client";

// 관리자 공통 상단 네비 — 세 페이지(할인율·이벤트·문의)에 고정 표시.
// 어느 페이지에서 클릭해도 목적지에도 같은 네비가 있어 박스가 사라지지 않는다.
// 문의 쪽지엔 미확인 건수 배지(세션 키로 직접 조회).

import { useEffect, useState } from "react";

const KEY = "lc_vn_admin_key";

const TABS = [
  { id: "settings", label: "gmhm365 · 할인율", href: "/admin" },
  { id: "events", label: "차트 이벤트 마커", href: "/admin/events" },
  { id: "inquiries", label: "문의 쪽지", href: "/admin/inquiries" },
];

export function AdminNav({ current }: { current: string }) {
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    const k = sessionStorage.getItem(KEY);
    if (!k) return;
    fetch("/api/admin/inquiries", { headers: { "x-admin-key": k } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d)
          setUnread(
            (d.inquiries as { confirmed: boolean }[]).filter((x) => !x.confirmed)
              .length
          );
      })
      .catch(() => {});
  }, []);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "10px 0",
        marginBottom: 16,
        background: "inherit",
        zIndex: 10,
      }}
    >
      {TABS.map((t) => {
        const active = t.id === current;
        return (
          <a
            key={t.id}
            href={t.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              background: "#18181b",
              border: `1px solid ${active ? "#f59e0b" : "#3f3f46"}`,
              color: active ? "#f59e0b" : "#e4e4e7",
              fontWeight: active ? 700 : 400,
            }}
          >
            {t.label}
            {t.id === "inquiries" && unread !== null && unread > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "1px 7px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {unread}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
