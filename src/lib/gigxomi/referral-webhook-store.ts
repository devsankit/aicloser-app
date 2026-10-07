import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ReferralWebhookEvent =
  | "referral.clicked"
  | "referral.signup"
  | "referral.converted"
  | "commission.approved";

export type ReferralWebhookConfig = {
  pluginEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
  webhookSecret: string;
  events: ReferralWebhookEvent[];
  lastTriggeredAt: string | null;
  lastStatus: string | null;
};

const CONFIG_FILE = path.join(process.cwd(), "data", "referral-webhook-config.json");

const DEFAULT_CONFIG: ReferralWebhookConfig = {
  pluginEnabled: true,
  webhookEnabled: false,
  webhookUrl: "",
  webhookSecret: `whsec_aicloser_${randomBytes(12).toString("hex")}`,
  events: ["referral.clicked", "referral.signup", "referral.converted", "commission.approved"],
  lastTriggeredAt: null,
  lastStatus: null,
};

export async function getReferralWebhookConfig(): Promise<ReferralWebhookConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ReferralWebhookConfig>;
    return {
      pluginEnabled: parsed.pluginEnabled ?? DEFAULT_CONFIG.pluginEnabled,
      webhookEnabled: parsed.webhookEnabled ?? DEFAULT_CONFIG.webhookEnabled,
      webhookUrl: parsed.webhookUrl ?? "",
      webhookSecret: parsed.webhookSecret || DEFAULT_CONFIG.webhookSecret,
      events: Array.isArray(parsed.events) && parsed.events.length ? parsed.events : DEFAULT_CONFIG.events,
      lastTriggeredAt: parsed.lastTriggeredAt ?? null,
      lastStatus: parsed.lastStatus ?? null,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveReferralWebhookConfig(
  patch: Partial<ReferralWebhookConfig>,
): Promise<ReferralWebhookConfig> {
  const current = await getReferralWebhookConfig();
  const next: ReferralWebhookConfig = {
    pluginEnabled: patch.pluginEnabled ?? current.pluginEnabled,
    webhookEnabled: patch.webhookEnabled ?? current.webhookEnabled,
    webhookUrl: patch.webhookUrl !== undefined ? patch.webhookUrl.trim() : current.webhookUrl,
    webhookSecret:
      patch.webhookSecret !== undefined && patch.webhookSecret.trim()
        ? patch.webhookSecret.trim()
        : current.webhookSecret,
    events: Array.isArray(patch.events) ? patch.events : current.events,
    lastTriggeredAt: patch.lastTriggeredAt !== undefined ? patch.lastTriggeredAt : current.lastTriggeredAt,
    lastStatus: patch.lastStatus !== undefined ? patch.lastStatus : current.lastStatus,
  };

  await mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function dispatchReferralWebhookTest(agentCode: string): Promise<{
  ok: boolean;
  statusText: string;
  config: ReferralWebhookConfig;
}> {
  const config = await getReferralWebhookConfig();
  const payload = {
    id: `evt_ref_${Date.now()}`,
    event: "referral.converted",
    timestamp: new Date().toISOString(),
    workspace: "AIcloser",
    data: {
      agentCode,
      customerName: "Sample Referred Client",
      customerEmail: "client@example.com",
      plan: "AI Closer Pro Plan",
      amountPaid: 4999,
      currency: "INR",
      commissionEarned: 999.8,
      attributionSource: "webhook_test",
    },
  };

  const bodyString = JSON.stringify(payload);
  const signature = createHmac("sha256", config.webhookSecret).update(bodyString).digest("hex");

  if (!config.webhookUrl) {
    const updated = await saveReferralWebhookConfig({
      lastTriggeredAt: new Date().toISOString(),
      lastStatus: "Simulated locally (no external URL set)",
    });
    return {
      ok: true,
      statusText: "Sample referral webhook event simulated locally. Add an endpoint URL to dispatch over HTTP.",
      config: updated,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AIcloser-Event": "referral.converted",
        "X-AIcloser-Signature": `sha256=${signature}`,
      },
      body: bodyString,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const statusLabel = `HTTP ${response.status} ${response.statusText || (response.ok ? "OK" : "Error")}`;
    const updated = await saveReferralWebhookConfig({
      lastTriggeredAt: new Date().toISOString(),
      lastStatus: statusLabel,
    });

    return {
      ok: response.ok,
      statusText: response.ok
        ? `Webhook delivered successfully (${statusLabel}).`
        : `Endpoint responded with ${statusLabel}.`,
      config: updated,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    const updated = await saveReferralWebhookConfig({
      lastTriggeredAt: new Date().toISOString(),
      lastStatus: `Failed: ${msg}`,
    });
    return {
      ok: false,
      statusText: `Could not reach webhook URL (${msg}).`,
      config: updated,
    };
  }
}
