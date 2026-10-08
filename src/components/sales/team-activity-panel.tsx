"use client";

import { useEffect, useState } from "react";

type ClientActivity = {
  status: string;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  sessionId: string | null;
  deviceName: string | null;
  platform: string | null;
  appVersion: string | null;
};

type UserActivity = { userId: string; displayName: string; email: string | null; mobile: ClientActivity; desktop: ClientActivity };

function format(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";
}

export function TeamActivityPanel() {
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/sales/team/activity", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || data.error || "Activity could not be loaded.");
    setUsers(data.users || []);
  };

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Activity could not be loaded.")).finally(() => setLoading(false));
    const timer = window.setInterval(() => void load().catch(() => undefined), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const revoke = async (userId: string, channel: "MOBILE" | "DESKTOP") => {
    setMessage(null);
    const response = await fetch("/api/sales/team/activity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, channel }) });
    const data = await response.json();
    if (!response.ok || !data.ok) { setMessage(data.message || data.error || "Session could not be revoked."); return; }
    await load();
  };

  return (
    <section className="crm-panel" style={{ marginTop: 20, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div><h3 style={{ margin: 0 }}>Closer device activity</h3><p className="muted-copy" style={{ margin: "5px 0 0" }}>One mobile seat and one desktop seat per closer.</p></div>
        <button type="button" className="secondary-button" onClick={() => void load().catch((error) => setMessage(error instanceof Error ? error.message : "Activity could not be loaded."))}>Refresh</button>
      </div>
      {message ? <p className="error-copy">{message}</p> : null}
      {loading ? <p className="muted-copy">Loading activity…</p> : users.length === 0 ? <p className="muted-copy">No closer activity found.</p> : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border, #dbe2ea)", borderRadius: 12 }}><table className="crm-data-table" style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", textAlign: "left" }}><thead><tr><th style={{ padding: 16 }}>Team member</th><th style={{ padding: 16 }}>Mobile device</th><th style={{ padding: 16 }}>Desktop session</th></tr></thead><tbody>{users.map((user) => <tr key={user.userId} style={{ borderTop: "1px solid var(--border, #dbe2ea)" }}>
          <td style={{ padding: 16, verticalAlign: "top" }}><strong>{user.displayName}</strong><br /><small>{user.email || ""}</small></td>
          {[user.mobile, user.desktop].map((client, index) => <td key={index} style={{ padding: 16, verticalAlign: "top", lineHeight: 1.7 }}><span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 12, background: client.status === "ONLINE" ? "rgba(16,185,129,.12)" : "rgba(148,163,184,.12)", color: client.status === "ONLINE" ? "#059669" : "var(--muted)" }}>{client.status === "NEVER_CONNECTED" ? "Not connected" : client.status === "ONLINE" ? "Online" : "Offline"}</span><br /><small>Last login: {format(client.lastLoginAt)}</small><br /><small>Last active: {format(client.lastActiveAt)}</small>{client.deviceName ? <><br /><small>{client.deviceName}{client.appVersion ? ` · ${client.appVersion}` : ""}</small></> : null}{client.sessionId ? <><br /><button type="button" className="secondary-button" onClick={() => void revoke(user.userId, index === 0 ? "MOBILE" : "DESKTOP").catch(() => setMessage("Session could not be revoked. Please retry."))}>Revoke session</button></> : null}</td>)}
        </tr>)}</tbody></table></div>
      )}
    </section>
  );
}
