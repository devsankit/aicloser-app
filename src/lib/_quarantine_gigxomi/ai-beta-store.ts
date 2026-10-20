import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AiProvider = "openai" | "anthropic" | "gemini" | "groq" | "deepseek";

export type AiBotConfig = {
  isEnabled: boolean;
  activeProvider: AiProvider;
  openaiKey: string;
  anthropicKey: string;
  geminiKey: string;
  groqKey: string;
  deepseekKey: string;
  systemPrompt: string;
  temperature: number;
  documents: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    status: "Indexed" | "Processing";
    snippet?: string;
  }>;
  corrections: Array<{
    id: string;
    userQuery: string;
    botAnswer: string;
    correction: string;
    createdAt: string;
  }>;
};

const DEFAULT_CONFIG: AiBotConfig = {
  isEnabled: true,
  activeProvider: "openai",
  openaiKey: "",
  anthropicKey: "",
  geminiKey: "",
  groqKey: "",
  deepseekKey: "",
  systemPrompt: "You are the AI Closer Assistant. Your goal is to answer client questions about video editing and agency packages, qualify client budget and requirements, and schedule discovery calls on WhatsApp. Always maintain an encouraging, professional, and concise tone.",
  temperature: 0.7,
  documents: [
    {
      id: "doc-preset-1",
      fileName: "Gigxomi_Pricing_And_Packages_2026.pdf",
      fileSize: 248102,
      mimeType: "application/pdf",
      uploadedAt: "2026-03-01T10:00:00.000Z",
      status: "Indexed",
      snippet: "Comprehensive guide on Starter ($499/mo), Growth ($999/mo), and Enterprise video editing retainers.",
    },
    {
      id: "doc-preset-2",
      fileName: "Closer_Objection_Handling_Playbook.txt",
      fileSize: 45290,
      mimeType: "text/plain",
      uploadedAt: "2026-03-15T12:00:00.000Z",
      status: "Indexed",
      snippet: "Tactics for budget hesitation, turnaround time queries, and agency editor quality assurance.",
    },
  ],
  corrections: [
    {
      id: "corr-1",
      userQuery: "Can I get a discount if I pay for 6 months upfront?",
      botAnswer: "Sorry, our prices are strictly fixed on the website.",
      correction: "Yes, clients committing to a 6-month upfront retainer receive a 15% VIP discount plus priority editor matching. Would you like me to connect you with our senior closer on WhatsApp to arrange this invoice?",
      createdAt: "2026-03-20T14:30:00.000Z",
    },
  ],
};

const CONFIG_FILE = path.join(process.cwd(), "data", "ai-bot-config.json");

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return key.substring(0, 4) + "••••••••" + key.substring(key.length - 4);
}

export async function getAiBotConfig(): Promise<AiBotConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        documents: Array.isArray(parsed.documents) ? parsed.documents : DEFAULT_CONFIG.documents,
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections : DEFAULT_CONFIG.corrections,
      };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export async function getMaskedAiBotConfig(): Promise<Omit<AiBotConfig, "openaiKey" | "anthropicKey" | "geminiKey" | "groqKey" | "deepseekKey"> & {
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
  hasGeminiKey: boolean;
  hasGroqKey: boolean;
  hasDeepseekKey: boolean;
  maskedKeys: Record<AiProvider, string>;
}> {
  const cfg = await getAiBotConfig();
  return {
    ...cfg,
    hasOpenaiKey: Boolean(cfg.openaiKey),
    hasAnthropicKey: Boolean(cfg.anthropicKey),
    hasGeminiKey: Boolean(cfg.geminiKey),
    hasGroqKey: Boolean(cfg.groqKey),
    hasDeepseekKey: Boolean(cfg.deepseekKey),
    maskedKeys: {
      openai: maskKey(cfg.openaiKey),
      anthropic: maskKey(cfg.anthropicKey),
      gemini: maskKey(cfg.geminiKey),
      groq: maskKey(cfg.groqKey),
      deepseek: maskKey(cfg.deepseekKey),
    },
  };
}

export async function saveAiBotConfig(updates: Partial<AiBotConfig>): Promise<AiBotConfig> {
  const current = await getAiBotConfig();
  const next: AiBotConfig = {
    ...current,
    ...updates,
    // Preserve existing keys if empty masked placeholder sent
    openaiKey: updates.openaiKey !== undefined && !updates.openaiKey.includes("••••") ? updates.openaiKey : current.openaiKey,
    anthropicKey: updates.anthropicKey !== undefined && !updates.anthropicKey.includes("••••") ? updates.anthropicKey : current.anthropicKey,
    geminiKey: updates.geminiKey !== undefined && !updates.geminiKey.includes("••••") ? updates.geminiKey : current.geminiKey,
    groqKey: updates.groqKey !== undefined && !updates.groqKey.includes("••••") ? updates.groqKey : current.groqKey,
    deepseekKey: updates.deepseekKey !== undefined && !updates.deepseekKey.includes("••••") ? updates.deepseekKey : current.deepseekKey,
  };

  await mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function addTrainingDocument(doc: { fileName: string; fileSize: number; mimeType: string; snippet?: string }) {
  const current = await getAiBotConfig();
  const newDoc = {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    uploadedAt: new Date().toISOString(),
    status: "Indexed" as const,
    snippet: doc.snippet || "Training document processed and indexed for contextual grounding.",
  };
  current.documents.unshift(newDoc);
  await saveAiBotConfig(current);
  return newDoc;
}

export async function deleteTrainingDocument(id: string) {
  const current = await getAiBotConfig();
  current.documents = current.documents.filter((d) => d.id !== id);
  await saveAiBotConfig(current);
  return { ok: true };
}

export async function addCorrection(item: { userQuery: string; botAnswer: string; correction: string }) {
  const current = await getAiBotConfig();
  const newCorrection = {
    id: `corr-${Date.now()}`,
    userQuery: item.userQuery.trim(),
    botAnswer: item.botAnswer.trim(),
    correction: item.correction.trim(),
    createdAt: new Date().toISOString(),
  };
  current.corrections.unshift(newCorrection);
  await saveAiBotConfig(current);
  return newCorrection;
}

export async function generateAiPlaygroundResponse(query: string): Promise<string> {
  const config = await getAiBotConfig();
  const lower = query.toLowerCase();

  // Check if a correction matches
  const match = config.corrections.find((c) => lower.includes(c.userQuery.toLowerCase()) || c.userQuery.toLowerCase().includes(lower));
  if (match) {
    return `${match.correction} (Applied from trained correction feedback)`;
  }

  // Simulated high quality response grounded in system prompt and knowledge
  if (lower.includes("price") || lower.includes("cost") || lower.includes("pricing") || lower.includes("package")) {
    return "Our video agency retainers start at $499/month for Starter (8 short-form reels + 2 long-form videos) and $999/month for Growth (20 reels + dedicated creative director). Would you like to check out the full package comparison or book a call on WhatsApp?";
  }
  if (lower.includes("turnaround") || lower.includes("fast") || lower.includes("how long")) {
    return "Standard turnaround is 24 to 48 business hours for short-form edits and 72 hours for comprehensive long-form deliverables, including two rounds of revisions.";
  }
  if (lower.includes("whatsapp") || lower.includes("demo") || lower.includes("call")) {
    return "I would love to set that up! Our sales team is available on WhatsApp right now. You can click the WhatsApp icon or share your phone number to get connected directly.";
  }

  return `Thanks for asking: "${query}". Grounded in our ${config.documents.length} indexed documents, AI Closer automates client qualification, multi-channel conversations, and seamless booking. How can I assist you with your sales workflow today?`;
}
