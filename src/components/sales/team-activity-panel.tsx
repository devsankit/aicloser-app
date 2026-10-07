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
        <button type="button" className="sales-secondary-button compact" onClick={() => void load()}>Refresh</button>
      </div>
      {message ? <p className="error-copy">{message}</p> : null}
      {loading ? <p className="muted-copy">Loading activity…</p> : users.length === 0 ? <p className="muted-copy">No closer activity found.</p> : (
        <div style={{ overflowX: "auto" }}><table className="sales-data-table"><thead><tr><th>User</th><th>Mobile</th><th>Desktop</th></tr></thead><tbody>{users.map((user) => <tr key={user.userId}>
          <td><strong>{user.displayName}</strong><br /><small>{user.email || ""}</small></td>
          {[user.mobile, user.desktop].map((client, index) => <td key={index}><strong>{client.status}</strong><br /><small>Last login: {format(client.lastLoginAt)}</small><br /><small>Last active: {format(client.lastActiveAt)}</small>{client.deviceName ? <><br /><small>{client.deviceName}{client.appVersion ? ` · ${client.appVersion}` : ""}</small></> : null}{client.sessionId ? <><br /><button type="button" className="sales-secondary-button compact" onClick={() => void revoke(user.userId, index === 0 ? "MOBILE" : "DESKTOP")}>Revoke</button></> : null}</td>)}
        </tr>)}</tbody></table></div>
      )}
    </section>
  );
}
