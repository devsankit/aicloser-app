import {
  META_GRAPH_BASE_URL,
  REQUESTED_BUSINESS_PHONE,
  MAX_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  isMockMode,
} from "./config";

export type MetaPhoneDetails = {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  messaging_limit_tier?: string;
  name_status?: string;
};

export type MetaTemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: {
    header_handle?: string[];
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "OTP" | "FLOW";
    text: string;
    url?: string;
    phone_number?: string;
    example?: string[];
    flow_id?: string;
    flow_action?: string;
  }>;
};

export type MetaCreateTemplateInput = {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: MetaTemplateComponent[];
};

export type MetaApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; statusCode?: number; rawPayload?: unknown };

/**
 * Robust fetch wrapper with timeout and exponential backoff retry for transient 429/5xx errors.
 * Never logs sensitive access tokens.
 */
async function metaFetch<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    accessToken: string;
    body?: unknown;
    headers?: Record<string, string>;
    retries?: number;
  },
): Promise<MetaApiResult<T>> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${META_GRAPH_BASE_URL}/${endpoint.replace(/^\//, "")}`;

  const maxRetries = options.retries ?? MAX_RETRY_ATTEMPTS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${options.accessToken}`,
        ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      };

      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(10000), // 10s request timeout
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        const errorObj = (payload?.error as Record<string, unknown>) || {};
        const statusCode = response.status;
        const errorMessage =
          (errorObj?.error_user_msg as string) ||
          (errorObj?.message as string) ||
          (payload?.message as string) ||
          `Meta Graph API returned status ${statusCode}`;

        // Safe retry only for rate-limits (429) or transient 5xx server errors
        const isRetryable = (statusCode === 429 || statusCode >= 500) && attempt < maxRetries;

        if (isRetryable) {
          const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }

        return {
          ok: false,
          error: errorMessage,
          statusCode,
          rawPayload: payload,
        };
      }

      return {
        ok: true,
        data: payload as T,
      };
    } catch (error: unknown) {
      const isAbortOrNetwork =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError" || error.message.includes("fetch failed"));

      if (isAbortOrNetwork && attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : "Network failure communicating with Meta Graph API",
      };
    }
  }

  return {
    ok: false,
    error: "Meta request exceeded maximum retry attempts.",
  };
}

/**
 * Validates channel details against Meta Graph API and checks if the retrieved phone number
 * matches the requested business phone (9993328124).
 * In mock mode: returns verified test data without making network calls.
 */
export async function verifyChannelConnection(input: {
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
}): Promise<
  MetaApiResult<{
    phoneNumber: MetaPhoneDetails;
    matchesRequestedNumber: boolean;
    requestedNumber: string;
    wabaInfo?: Record<string, unknown>;
  }>
> {
  const cleanRequestedDigits = REQUESTED_BUSINESS_PHONE.replace(/\D/g, "");

  if (isMockMode()) {
    const isTargetId = input.phoneNumberId === "962346373625331" || !input.phoneNumberId.startsWith("invalid");
    return {
      ok: true,
      data: {
        phoneNumber: {
          id: input.phoneNumberId || "962346373625331",
          display_phone_number: isTargetId ? "+91 99933 28124" : "+91 98765 43210",
          verified_name: "Gigxomi Support",
          quality_rating: "GREEN",
          code_verification_status: "VERIFIED",
          messaging_limit_tier: "TIER_1K",
          name_status: "APPROVED",
        },
        matchesRequestedNumber: isTargetId,
        requestedNumber: REQUESTED_BUSINESS_PHONE,
        wabaInfo: {
          id: input.wabaId || "2744233995921639",
          name: "Gigxomi Agency Support",
          currency: "INR",
          timezone_id: "Asia/Kolkata",
        },
      },
    };
  }

  const phoneRes = await metaFetch<MetaPhoneDetails>(
    `${input.phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier,name_status`,
    { accessToken: input.accessToken },
  );

  if (!phoneRes.ok) {
    return phoneRes;
  }

  const phone = phoneRes.data;
  const digitsFromMeta = (phone.display_phone_number || "").replace(/\D/g, "");
  const matchesRequested = digitsFromMeta.endsWith(cleanRequestedDigits) || cleanRequestedDigits.endsWith(digitsFromMeta);

  let wabaInfo: Record<string, unknown> | undefined;
  if (input.wabaId) {
    const wabaRes = await metaFetch<Record<string, unknown>>(
      `${input.wabaId}?fields=id,name,message_template_namespace,currency,timezone_id`,
      { accessToken: input.accessToken },
    );
    if (wabaRes.ok) {
      wabaInfo = wabaRes.data;
    }
  }

  return {
    ok: true,
    data: {
      phoneNumber: phone,
      matchesRequestedNumber: matchesRequested,
      requestedNumber: REQUESTED_BUSINESS_PHONE,
      wabaInfo,
    },
  };
}

/**
 * Lists all registered phone numbers under a WABA.
 */
export async function listWabaPhoneNumbers(
  wabaId: string,
  accessToken: string,
): Promise<MetaApiResult<MetaPhoneDetails[]>> {
  if (isMockMode()) {
    return {
      ok: true,
      data: [
        {
          id: "962346373625331",
          display_phone_number: "+91 99933 28124",
          verified_name: "Gigxomi Support",
          quality_rating: "GREEN",
          code_verification_status: "VERIFIED",
          messaging_limit_tier: "TIER_1K",
          name_status: "APPROVED",
        },
      ],
    };
  }

  const result = await metaFetch<{ data: MetaPhoneDetails[] }>(
    `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier`,
    { accessToken },
  );

  if (!result.ok) return result;
  return { ok: true, data: result.data.data || [] };
}

/**
 * Upload sample media to Meta's Resumable Upload API for WhatsApp message templates.
 * Returns the media handle ('h') required for the template header example.
 */
export async function uploadTemplateSampleMedia(input: {
  appId: string;
  fileBuffer: Buffer;
  mimeType: string;
  fileName: string;
  accessToken: string;
}): Promise<MetaApiResult<{ handle: string }>> {
  if (isMockMode()) {
    return {
      ok: true,
      data: { handle: `mock_media_handle_${Date.now()}` },
    };
  }

  // Step 1: Create upload session
  const createSessionRes = await metaFetch<{ id: string }>(
    `app/uploads?file_length=${input.fileBuffer.length}&file_type=${encodeURIComponent(input.mimeType)}&file_name=${encodeURIComponent(input.fileName)}`,
    {
      method: "POST",
      accessToken: input.accessToken,
    },
  );

  if (!createSessionRes.ok) {
    return createSessionRes;
  }

  const uploadSessionId = createSessionRes.data.id;

  // Step 2: Upload file bytes
  try {
    const uploadRes = await fetch(`${META_GRAPH_BASE_URL}/${uploadSessionId}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${input.accessToken}`,
        file_offset: "0",
        "Content-Type": input.mimeType,
      },
      body: new Uint8Array(input.fileBuffer),
      signal: AbortSignal.timeout(15000),
    });

    const uploadPayload = (await uploadRes.json().catch(() => ({}))) as { h?: string; error?: { message: string } };

    if (!uploadRes.ok || !uploadPayload.h) {
      return {
        ok: false,
        error: uploadPayload.error?.message || "Failed to upload sample media binary to Meta",
      };
    }

    return {
      ok: true,
      data: { handle: uploadPayload.h },
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error transferring media binary to Meta",
    };
  }
}

/**
 * Submits a new template for Meta approval.
 */
export async function createMetaTemplate(input: {
  wabaId: string;
  accessToken: string;
  template: MetaCreateTemplateInput;
}): Promise<MetaApiResult<{ id: string; status: string; category: string }>> {
  if (isMockMode()) {
    return {
      ok: true,
      data: {
        id: `mock_meta_tpl_${Date.now()}`,
        status: "APPROVED",
        category: input.template.category,
      },
    };
  }

  return metaFetch<{ id: string; status: string; category: string }>(
    `${input.wabaId}/message_templates`,
    {
      method: "POST",
      accessToken: input.accessToken,
      body: input.template,
    },
  );
}

/**
 * Fetches all templates from Meta for a given WABA.
 */
export async function listMetaTemplates(
  wabaId: string,
  accessToken: string,
): Promise<
  MetaApiResult<
    Array<{
      id: string;
      name: string;
      status: string;
      category: string;
      language: string;
      components: MetaTemplateComponent[];
      rejected_reason?: string;
      quality_score?: { score: string };
    }>
  >
> {
  if (isMockMode()) {
    return {
      ok: true,
      data: [
        {
          id: "mock_tpl_welcome_offer",
          name: "welcome_offer_gx",
          status: "APPROVED",
          category: "MARKETING",
          language: "en_US",
          components: [
            { type: "HEADER", format: "TEXT", text: "Welcome to Gigxomi {{1}}" },
            { type: "BODY", text: "Hi {{1}}, here is your exclusive link: {{2}}." },
            { type: "FOOTER", text: "Reply STOP to unsubscribe." },
            {
              type: "BUTTONS",
              buttons: [
                { type: "URL", text: "Claim Deal", url: "https://closer.gigxomi.com?ref={{1}}" },
                { type: "QUICK_REPLY", text: "Talk to Agent" },
              ],
            },
          ],
        },
      ],
    };
  }

  const result = await metaFetch<{
    data: Array<{
      id: string;
      name: string;
      status: string;
      category: string;
      language: string;
      components: MetaTemplateComponent[];
      rejected_reason?: string;
      quality_score?: { score: string };
    }>;
  }>(
    `${wabaId}/message_templates?limit=250&fields=id,name,status,category,language,components,rejected_reason,quality_score`,
    { accessToken },
  );

  if (!result.ok) return result;
  return { ok: true, data: result.data.data || [] };
}

/**
 * Sends an approved template message to a recipient.
 */
export async function sendTemplateMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  languageCode: string;
  components?: Array<{
    type: "header" | "body" | "button";
    sub_type?: "url" | "quick_reply";
    index?: string | number;
    parameters: Array<{
      type: "text" | "image" | "document" | "video";
      text?: string;
      image?: { link: string };
      document?: { link: string; filename?: string };
    }>;
  }>;
}): Promise<
  MetaApiResult<{
    messaging_product: string;
    contacts: Array<{ input: string; wa_id: string }>;
    messages: Array<{ id: string }>;
  }>
> {
  if (isMockMode()) {
    const cleanPhone = input.to.replace(/\D/g, "");
    return {
      ok: true,
      data: {
        messaging_product: "whatsapp",
        contacts: [{ input: input.to, wa_id: cleanPhone }],
        messages: [{ id: `wamid.mock.${Date.now()}.${Math.random().toString(36).substring(2, 9)}` }],
      },
    };
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "template",
    template: {
      name: input.templateName,
      language: {
        code: input.languageCode,
      },
      components: input.components || [],
    },
  };

  return metaFetch<{
    messaging_product: string;
    contacts: Array<{ input: string; wa_id: string }>;
    messages: Array<{ id: string }>;
  }>(`${input.phoneNumberId}/messages`, {
    method: "POST",
    accessToken: input.accessToken,
    body,
  });
}

/**
 * Subscribes the application to the WABA's webhooks.
 */
export async function subscribeWabaWebhook(
  wabaId: string,
  accessToken: string,
): Promise<MetaApiResult<{ success: boolean }>> {
  if (isMockMode()) {
    return {
      ok: true,
      data: { success: true },
    };
  }

  return metaFetch<{ success: boolean }>(`${wabaId}/subscribed_apps`, {
    method: "POST",
    accessToken,
  });
}
