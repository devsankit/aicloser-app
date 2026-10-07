"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import "@/app/legacy.css";

type SiteShellProps = {
  markup: string;
  sessionUser?: { displayName?: string } | null;
};

export function SiteShell({ markup, sessionUser }: SiteShellProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const runtime = document.createElement("script");
    runtime.src = "/site-runtime.js?v=20261006";
    runtime.async = true;
    document.body.appendChild(runtime);
  }, []);

  return (
    <>
      {sessionUser ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: "#161b16",
            borderBottom: "1px solid rgba(185, 247, 25, 0.3)",
            padding: "8px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "13px",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#B9F719",
                display: "inline-block",
              }}
            />
            <span>
              Signed in as <strong>{sessionUser.displayName || "Sales Workspace"}</strong>
            </span>
          </div>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "8px",
              backgroundColor: "#B9F719",
              color: "#0a0f0a",
              fontWeight: 700,
              fontSize: "12px",
              textDecoration: "none",
            }}
          >
            Go to CRM Dashboard &rarr;
          </Link>
        </div>
      ) : null}
      <div
        className="next-page-shell"
        style={sessionUser ? { paddingTop: "40px" } : undefined}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </>
  );
}
