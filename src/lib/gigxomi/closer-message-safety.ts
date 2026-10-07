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
  if (intent === "portfolio") {
    return "Got it, maine aapka portfolio/work link receive kar liya. Aap kis type ke video editing projects par focus karte ho?";
  }
  if (intent === "document") {
    return "Got it, file receive ho gayi. Main is context ke saath aage help karti hoon. Aap abhi kitne projects handle kar rahe ho?";
  }
  if (intent === "media") {
    return "Got it, media receive ho gaya. Main aapke work context ke saath aage badhti hoon. Aapka current editing setup kya hai?";
  }
  return "Got it, aapka message receive ho gaya. Main aapki requirement samajhne ke liye kuch quick questions poochti hoon.";
}

