"use client";

import { useEffect } from "react";

export function ClientSessionHeartbeat() {
  useEffect(() => {
    let timer: number | undefined;
    const send = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/auth/heartbeat", { method: "POST", credentials: "include", cache: "no-store" });
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
