import "server-only";

import { createHash } from "node:crypto";

export type LinkedWhatsAppDelivery =
  | { ok: true; mode: "whatsapp-linked-sent"; messageId?: string }
  | { ok: false; mode: "whatsapp-linked-failed"; error: string };

function serviceKey(tenantId: string) {
  return createHash("sha256").update(tenantId).digest("hex").slice(0, 16);
}

function serviceUrl(tenantId: string) {
  const port = 3200 + (Number.parseInt(serviceKey(tenantId).slice(0, 6), 16) % 500);
  return `http://127.0.0.1:${port}`;
}

export async function sendLinkedWhatsAppText(input: {
  tenantId: string;
  to: string;
  body: string;
}): Promise<LinkedWhatsAppDelivery> {
  const recipient = input.to.replace(/\D/g, "");
  if (!recipient) return { ok: false, mode: "whatsapp-linked-failed", error: "Recipient number is missing." };
  if (!input.body.trim()) return { ok: false, mode: "whatsapp-linked-failed", error: "Message is empty." };

  try {
    const response = await fetch(`${serviceUrl(input.tenantId)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipient, body: input.body.trim() }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => ({}))) as { messageId?: string; error?: string };
    if (!response.ok || !payload.messageId) {
      return {
        ok: false,
        mode: "whatsapp-linked-failed",
        error: payload.error || "The connected WhatsApp device is not ready.",
      };
    }
    return { ok: true, mode: "whatsapp-linked-sent", messageId: payload.messageId };
  } catch (error) {
    return {
      ok: false,
      mode: "whatsapp-linked-failed",
      error: error instanceof Error ? error.message : "The connected WhatsApp device could not be reached.",
    };
  }
}
