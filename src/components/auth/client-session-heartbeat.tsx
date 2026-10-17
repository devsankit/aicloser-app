"use client";

import { useEffect } from "react";
import { aicloserApi, getStoredToken } from "@/lib/api-client";

export function ClientSessionHeartbeat() {
  useEffect(() => {
    let timer: number | undefined;
    const send = () => {
      if (document.visibilityState !== "visible") return;
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/super-admin/login")) {
          return;
        }
      }
      if (!getStoredToken()) return;
      void aicloserApi.auth.heartbeat().catch(() => {
        void fetch("/api/auth/heartbeat", { method: "POST", credentials: "include", cache: "no-store" });
      });
    };
    send();
    timer = window.setInterval(send, 60_000);
    document.addEventListener("visibilitychange", send);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", send);
    };
  }, []);

  return null;
}
