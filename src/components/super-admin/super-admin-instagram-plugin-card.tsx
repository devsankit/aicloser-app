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
    const response = await fetch("/api/super-admin/plugins/instagram-inbox", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pluginEnabled: nextEnabled }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiPayload;

    if (!response.ok || payload.ok === false) {
      setStatusMessage(payload.error ?? "Unable to update Instagram Inbox plugin.");
      setIsSaving(false);
      return;
    }

    setConnection(payload.connection ?? null);
    setStatusMessage(nextEnabled ? "Instagram Inbox plugin enabled. You can connect permissions now." : "Instagram Inbox plugin disabled.");
    setIsSaving(false);
  }

  async function copySetupUrl(label: string, value: string) {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
    setStatusMessage(`${label} copied.`);
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
        <StatusPill>{instagramStatus}</StatusPill>
      </div>

      <div className="brief-grid three-up">
        <div className="brief-card">
          <PluginBrandMark brand="instagram" size="sm" />
          <strong>{getAccountLabel(connection)}</strong>
          <p className="muted-copy">
            {isSalesVariant ? "Sales inbox uses this account scope for routed Instagram conversations." : "Connected account used as the sender for Instagram Graph replies."}
          </p>
        </div>
        <div className="brief-card">
          <span className="meta-pill">Reply permission</span>
          <strong>Messages API</strong>
          <p className="muted-copy">The login asks for message and basic profile permissions needed for inbox replies.</p>
        </div>
        <div className="brief-card">
          <span className="meta-pill">Webhook remains</span>
          <strong>Existing inbox feed</strong>
          <p className="muted-copy">This does not change the webhook URL; it only refreshes the token used to reply from Gigxomi.</p>
        </div>
      </div>

      {isSalesVariant ? (
        <div className="brief-card sales-instagram-readiness">
          <span className="meta-pill">Sales inbox</span>
          <strong>WhatsApp and Instagram threads stay isolated per sales account.</strong>
          <p className="muted-copy">
            Instagram OAuth controls remain under the platform integration until sales-account Instagram login is enabled.
          </p>
        </div>
      ) : (
        <div className="brief-grid two-up">
          {[
            ["OAuth redirect URI", setupUrls.oauthRedirectUri],
            ["Deauthorize callback URL", setupUrls.deauthorizeCallbackUrl],
            ["Data deletion request URL", setupUrls.dataDeletionRequestUrl],
            ["Webhook callback URL", setupUrls.webhookCallbackUrl],
          ].map(([label, value]) => (
            <div className="brief-card" key={label}>
              <span className="meta-pill">{label}</span>
              <p className="muted-copy break-anywhere">{value}</p>
              <button className="ui-button-ghost" onClick={() => void copySetupUrl(label, value)} type="button">
                Copy
              </button>
            </div>
          ))}
        </div>
      )}

      {connection?.lastError ? <p className="form-error">{connection.lastError}</p> : null}
      {statusMessage ? <p className="helper-text">{statusMessage}</p> : null}

      {isSalesVariant ? null : (
        <div className="super-admin-access-actions">
          {pluginEnabled ? (
            <>
              <Link className="ui-button-secondary" href="/api/meta/instagram/oauth/connect">
                Connect Instagram inbox
              </Link>
              <button className="ui-button-ghost" disabled={isSaving} onClick={() => setPluginEnabled(false)} type="button">
                Disable plugin
              </button>
            </>
          ) : (
            <button className="ui-button-secondary" disabled={isSaving} onClick={() => setPluginEnabled(true)} type="button">
              Enable Instagram Inbox plugin
            </button>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}
