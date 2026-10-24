const DEVANAGARI_PATTERN = /[\u0900-\u097F]/u;

export function containsDevanagari(value: string | null | undefined) {
  return DEVANAGARI_PATTERN.test(String(value ?? ""));
}

/**
 * Keeps automated Closer replies in Roman Hinglish/English. Human-authored
 * messages are never passed through this helper.
 */
export function sanitizeCloserReply(value: string | null | undefined, fallback: string) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || containsDevanagari(text)) return fallback;
  return text;
}

export type InboundAttachmentIntent = "portfolio" | "document" | "media" | "unknown";

export function classifyInboundAttachmentIntent(name?: string | null, mimeType?: string | null): InboundAttachmentIntent {
  const filename = String(name ?? "").toLowerCase();
  const mime = String(mimeType ?? "").toLowerCase();
  if (/portfolio|work|case.?study|showreel|instagram|youtube|behance|dribbble/.test(filename)) return "portfolio";
  if (/pdf|document|sheet|presentation|text\//.test(mime) || /\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/.test(filename)) return "document";
  if (mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")) return "media";
  return "unknown";
}

export function buildInboundAttachmentAcknowledgement(intent: InboundAttachmentIntent) {
  // This is only a local attachment label. It must never look like a reply
  // written by the customer or replace the exact body received from Meta.
  if (intent === "portfolio") return "Portfolio link received.";
  if (intent === "document") return "Document received from WhatsApp.";
  if (intent === "media") return "Media received from WhatsApp.";
  return "Attachment received from WhatsApp.";
}

