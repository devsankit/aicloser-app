"use client";

import { useState } from "react";
import Link from "next/link";

import { PluginBrandMark } from "@/components/ui/plugin-brand-mark";
import { StatusPill, SurfaceCard } from "@/components/ui/dashboard-primitives";

export type InstagramPluginConnectionView = {
  accountId: string;
  accountType: string;
  appId: string;
  connectedAt?: string | null;
  expiresAt?: string | null;
  lastError: string;
  pluginEnabled: boolean;
  scopes: string[];
  status: "Not connected" | "Connected" | "Needs attention";
  tenantId: string;
  updatedAt: string;
  username: string;
} | null;

export type InstagramSetupUrls = {
  dataDeletionRequestUrl: string;
  deauthorizeCallbackUrl: string;
  oauthRedirectUri: string;
  webhookCallbackUrl: string;
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  connection?: InstagramPluginConnectionView;
};

function getAccountLabel(connection: InstagramPluginConnectionView) {
  if (!connection) {
    return "No account connected yet";
  }

  if (connection.username) {
    return `@${connection.username}`;
  }

  if (connection.accountId) {
    return `Instagram ${connection.accountId}`;
  }

  return "No account connected yet";
}

export function SuperAdminInstagramPluginCard({
  initialConnection,
  setupUrls,
  variant = "default",
}: {
  initialConnection: InstagramPluginConnectionView;
  setupUrls: InstagramSetupUrls;
  variant?: "default" | "sales";
}) {
  const [connection, setConnection] = useState(initialConnection);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pluginEnabled = connection?.pluginEnabled === true;
  const instagramStatus = connection?.status ?? "Not connected";
  const isSalesVariant = variant === "sales";

  async function setPluginEnabled(nextEnabled: boolean) {
    if (isSalesVariant) {
      setStatusMessage("Sales Instagram setup is scoped per account, but OAuth connection is still managed by the platform integration.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/super-admin/plugins/instagram-inbox", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginEnabled: nextEnabled }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;

      if (!response.ok || payload.ok === false) {
        setStatusMessage(payload.error ?? "Unable to update Instagram Inbox plugin. Check your admin access and try again.");
        return;
      }

      setConnection(payload.connection ?? null);
      setStatusMessage(nextEnabled ? "Instagram Inbox plugin enabled. You can connect permissions now." : "Instagram Inbox plugin disabled.");
    } catch {
      setStatusMessage("Instagram Inbox could not be updated. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SurfaceCard className={isSalesVariant ? "sales-instagram-plugin-card" : ""}>
      <div className="control-card-header">
        <div className="plugin-card-heading">
          <PluginBrandMark brand="instagram" size="lg" />
          <div>
            <span className="meta-pill">{pluginEnabled ? "Plugin enabled" : "Plugin disabled"}</span>
            <h3>Instagram Inbox plugin</h3>
            <p className="muted-copy">
              {isSalesVariant
                ? "Instagram conversations are shown in the Sales inbox when they are routed to this sales account."
                : "Enable this internal super-admin plugin first, then connect Instagram Business permissions for inbox replies."}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusPill>{instagramStatus}</StatusPill>
          {!isSalesVariant ? (
            pluginEnabled ? (
              <Link className="ui-button-primary" href="/api/meta/instagram/oauth/connect">
                Connect Instagram
              </Link>
            ) : (
              <button className="ui-button-primary" disabled={isSaving} onClick={() => setPluginEnabled(true)} type="button">
                Enable Instagram
              </button>
            )
          ) : null}
        </div>
      </div>

      <div className="brief-card" style={{ display: "grid", gap: 6 }}>
        <span className="meta-pill">Connected Instagram account</span>
        <strong>{getAccountLabel(connection)}</strong>
        <p className="muted-copy" style={{ margin: 0 }}>
          {isSalesVariant ? "Instagram conversations routed to this sales inbox." : "Connect one Instagram Business account to receive DMs and reply from AI Closer."}
        </p>
      </div>

      {!isSalesVariant && !connection?.appId ? (
        <p className="form-error">Instagram connection is not configured yet. Add the dedicated Instagram Business app credentials on the server before OAuth can exchange a token.</p>
      ) : null}

      {connection?.lastError ? <p className="form-error">{connection.lastError}</p> : null}
      {statusMessage ? <p className="helper-text">{statusMessage}</p> : null}

      {!isSalesVariant && pluginEnabled ? (
        <div className="super-admin-access-actions">
          <button className="ui-button-ghost" disabled={isSaving} onClick={() => setPluginEnabled(false)} type="button">
            Disable plugin
          </button>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
