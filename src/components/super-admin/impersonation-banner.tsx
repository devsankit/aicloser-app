"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState(false);
  const [targetName, setTargetName] = useState("");

  useEffect(() => {
    try {
      const cookies = document.cookie.split(";").map((c) => c.trim());
      const hasReturnCookie = cookies.some((c) => c.startsWith("gx_super_admin_return="));
      const nameCookie = cookies.find((c) => c.startsWith("gx_impersonating_name="));

      if (hasReturnCookie) {
        setImpersonating(true);
        if (nameCookie) {
          const raw = nameCookie.split("=")[1];
          setTargetName(decodeURIComponent(raw || "User"));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  if (!impersonating) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: "linear-gradient(90deg, #F97316 0%, #EA580C 100%)",
        color: "#FFFFFF",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 4px 20px rgba(249, 115, 22, 0.4)",
        fontSize: "0.85rem",
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <ShieldAlert size={18} style={{ color: "#FFF" }} />
        <span>
          Super Admin Impersonation: Viewing workspace as{" "}
          <strong style={{ textDecoration: "underline", color: "#FFF" }}>{targetName || "Target User"}</strong>
        </span>
      </div>

      <a
        href="/api/super-admin/impersonate/return"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          background: "#0F172A",
          color: "#FFFFFF",
          padding: "0.35rem 0.85rem",
          borderRadius: "6px",
          textDecoration: "none",
          fontSize: "0.8rem",
          fontWeight: 700,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#1E293B";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#0F172A";
        }}
      >
        <ArrowLeft size={14} /> Return to Super Admin Panel
      </a>
    </div>
  );
}
