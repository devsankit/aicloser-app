export function normalizeInstagramGraphApiVersion(value?: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "v25.0";
  }
  return normalized.startsWith("v") ? normalized : `v${normalized}`;
}

type SendInstagramTextMessageInput = {
  accessToken: string;
  recipientId: string;
  body: string;
  graphApiVersion?: string;
  instagramBusinessAccountId?: string;
};

type SendInstagramTextMessageResult =
  | { ok: true; mode: "instagram-sent"; messageId: string }
  | { ok: false; mode: "instagram-failed"; error: string };

export async function sendInstagramTextMessage(
  input: SendInstagramTextMessageInput,
): Promise<SendInstagramTextMessageResult> {
  const accessToken = input.accessToken.trim();
  const recipientId = input.recipientId.trim();
  const body = input.body.trim();
  const graphApiVersion = normalizeInstagramGraphApiVersion(input.graphApiVersion);
  const instagramBusinessAccountId = String(input.instagramBusinessAccountId ?? "").trim();

  if (!accessToken) {
    return { ok: false, mode: "instagram-failed", error: "Instagram access token is missing." };
  }
  if (!recipientId) {
    return { ok: false, mode: "instagram-failed", error: "Instagram recipient id is missing." };
  }
  if (!body) {
    return { ok: false, mode: "instagram-failed", error: "Instagram message body is empty." };
  }
  if (!instagramBusinessAccountId) {
    return { ok: false, mode: "instagram-failed", error: "Instagram business account id is missing." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`https://graph.facebook.com/${graphApiVersion}/${instagramBusinessAccountId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "instagram",
        recipient: { id: recipientId },
        message: { text: body },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      message_id?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        mode: "instagram-failed",
        error: String(payload.error?.message ?? "Instagram Graph API rejected the message send."),
      };
    }

    return {
      ok: true,
      mode: "instagram-sent",
      messageId: String(payload.message_id ?? ""),
    };
  } catch (error) {
    return {
      ok: false,
      mode: "instagram-failed",
      error: error instanceof Error ? error.message : "Unable to reach the Instagram Graph API.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
