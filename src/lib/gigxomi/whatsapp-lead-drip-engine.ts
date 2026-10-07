import "server-only";

import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  listConversationsForAudienceFromFile,
  getConversationByIdFromFile,
  deliverConversationMessageFromFile,
} from "@/lib/gigxomi/dummy-platform-file-store";

export type DripAudienceCategory =
  | "SOLO_EDITOR_TO_AGENCY"
  | "AGENCY_OWNER_INCOMPLETE"
  | "PRICING_INQUIRY"
  | "TRAINING_REQUESTED"
  | "GENERAL_LEAD";

export interface ConversationDripState {
  conversationId: string;
  customerPhone: string;
  customerName: string;
  audienceCategory: DripAudienceCategory;
  currentStage: number; // 0 = none sent yet, 1 = 4h, 2 = 24h, 3 = 72h, 4 = 120h
  lastDripSentAt?: string;
  nextScheduledAt?: string;
  paused: boolean;
  completed: boolean;
  history: Array<{
    stage: number;
    sentAt: string;
    body: string;
  }>;
}

const DRIP_STORE_DIR = path.join(process.cwd(), ".gigxomi");
const DRIP_STORE_FILE = path.join(DRIP_STORE_DIR, "whatsapp-lead-drips.json");

let memoryDripCache: Record<string, ConversationDripState> | null = null;

async function loadDripStore(): Promise<Record<string, ConversationDripState>> {
  if (memoryDripCache) return memoryDripCache;
  try {
    const raw = await readFile(DRIP_STORE_FILE, "utf8");
    memoryDripCache = JSON.parse(raw) as Record<string, ConversationDripState>;
    return memoryDripCache;
  } catch {
    memoryDripCache = {};
    return memoryDripCache;
  }
}

async function saveDripStore(data: Record<string, ConversationDripState>): Promise<void> {
  memoryDripCache = data;
  try {
    await mkdir(DRIP_STORE_DIR, { recursive: true });
    await writeFile(DRIP_STORE_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("[WHATSAPP_LEAD_DRIP] Failed to save drip store:", err);
  }
}

/**
 * Checks if current time is inside IST Indian working hours (10:00 AM to 7:30 PM).
 */
export function isInsideIstWorkingHours(): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTime = formatter.format(new Date()); // e.g. "14:30"
    return currentTime >= "10:00" && currentTime <= "19:30";
  } catch {
    return true; // fallback to allow if timezone format fails
  }
}

/**
 * Classifies the lead's context based on conversation text, notes, and messages.
 */
export function classifyLeadDripContext(messagesText: string, notes?: string): DripAudienceCategory {
  const combined = `${messagesText} ${notes || ""}`.toLowerCase();

  // 1. FIRST check if they are an editor / freelancer looking for work
  if (
    combined.includes("kaam chahiye") ||
    combined.includes("work chahiye") ||
    combined.includes("job") ||
    combined.includes("hire me") ||
    combined.includes("editor") ||
    combined.includes("editing") ||
    combined.includes("freelance") ||
    combined.includes("freelancer") ||
    combined.includes("portfolio") ||
    combined.includes("sample") ||
    combined.includes("vacancy") ||
    combined.includes("resume") ||
    combined.includes("cv") ||
    combined.includes("premiere") ||
    combined.includes("after effects") ||
    combined.includes("capcut") ||
    combined.includes("davinci")
  ) {
    return "SOLO_EDITOR_TO_AGENCY";
  }

  // 2. Agency Owner / Team Lead
  if (
    combined.includes("my agency") ||
    combined.includes("meri agency") ||
    combined.includes("agency owner") ||
    combined.includes("meri team") ||
    combined.includes("video editing agency") ||
    combined.includes("client management")
  ) {
    return "AGENCY_OWNER_INCOMPLETE";
  }

  // 3. Pricing Inquiry
  if (
    combined.includes("price") ||
    combined.includes("charge") ||
    combined.includes("cost") ||
    combined.includes("kitna") ||
    combined.includes("2000") ||
    combined.includes("2,000")
  ) {
    return "PRICING_INQUIRY";
  }

  // 4. Training / Demo (ONLY for agency setup walkthrough, not general meet/demo)
  if (
    combined.includes("training") ||
    combined.includes("walkthrough") ||
    combined.includes("demo schedule") ||
    combined.includes("google meet setup")
  ) {
    return "TRAINING_REQUESTED";
  }

  return "GENERAL_LEAD";
}

/**
 * Cadence delays in hours.
 * Stage 1 = 4 hours
 * Stage 2 = 24 hours (1 day)
 * Stage 3 = 72 hours (3 days)
 * Stage 4 = 120 hours (5 days)
 */
export const DRIP_CADENCE_HOURS: Record<number, number> = {
  1: 4,
  2: 24,
  3: 72,
  4: 120,
};

/**
 * Generates aesthetic, conversational follow-up copy tailored to the audience context.
 */
export function getDripMessageContent(
  category: DripAudienceCategory,
  stage: number,
  firstName: string,
): string | null {
  const name = firstName.trim() || "Ji";

  if (category === "SOLO_EDITOR_TO_AGENCY") {
    switch (stage) {
      case 1:
        return `Hey ${name}! Ek quick thought share karna tha—aap abhi per-video charge karte ho ya monthly package? Just asking kyunki Gigxomi par editors client retain karke 3x zyada earn kar rahe hain. 😊`;
      case 2:
        return `Hey ${name}! Solo editing me sabse bada issue hota hai revisions aur client hunt. Agar aap 2 editors ke saath apni micro-agency start karo, toh client number hide rehta hai (koi bypass nahi). 10-minute ka live walkthrough dekhenge kal Google Meet par? 🔥`;
      case 3:
        return `${name}, kal hamare team ke saath 1-on-1 Google Meet session arrange ho sakta hai jahan hum aapko direct agency setup live dikha sakein. Kya kal 1 PM ya 4 PM aapke liye convenient rahega? 📅`;
      case 4:
        return `Hey ${name}, lagta hai abhi aap busy hain! Jab bhi aap free hon aur apna editing workflow scale karna chahein, bas yahan reply kar dijiyega. All the best! ✨`;
      default:
        return null;
    }
  }

  if (category === "AGENCY_OWNER_INCOMPLETE") {
    switch (stage) {
      case 1:
        return `Hey ${name}! Just checking in—aapke paas abhi kitne active clients hain jinka WhatsApp/Instagram content manage hota hai? Quick setup workflow share kar sakti hoon. 😊`;
      case 2:
        return `Hey ${name}! Sabse bada headache jo agency founders hume batate hain wo ye ki editor client ka number leke direct bypass kar leta hai. Gigxomi me editor ko number kabhi nahi dikhta. 7 din ka free trial try karenge? 🚀`;
      case 3:
        return `${name}, kal humare team ke saath 1-on-1 live training session arrange kar rahe hain (Google Meet par). Kya kal 1 PM ya 4 PM aapke liye sahi rahega? 📅`;
      case 4:
        return `Hey ${name}, lagta hai aap abhi busy hain! Jab bhi agency workflow automate karna ho, bas yahan 'HI' bhej dijiyega. Have a great week! ✨`;
      default:
        return null;
    }
  }

  if (category === "PRICING_INQUIRY") {
    switch (stage) {
      case 1:
        return `Hey ${name}! Pricing ke baare me koi confusion toh nahi tha? Pehle 7 din 100% free trial hai, koi card nahi lagta. Pura dashboard live chala kar dekh sakte hain! 💡`;
      case 2:
        return `Hey ${name}, agar aap ek bhi client manage karte hain toh ₹2,000/month ka software easily 10x ROI de deta hai WhatsApp API aur client privacy ke saath. Quick walkthrough chahiye kal? 🚀`;
      case 3:
        return `${name}, kal Anshita ke saath Google Meet par 10-minute live demo schedule kar lein? Time bata dijiye! 📅`;
      case 4:
        return `Hey ${name}, no worries! Jab bhi aap ready hon, bas message kijiyega. Cheers! ✨`;
      default:
        return null;
    }
  }

  if (category === "TRAINING_REQUESTED") {
    switch (stage) {
      case 1:
        return `Hey ${name}! Google Meet walkthrough ke liye aapka koi preferred time hai kal? (Hum working hours 10 AM - 7 PM ke beech call arrange karte hain) 📅`;
      case 2:
        return `Hey ${name}, humne kal ke slots open kiye hain. Kya kal 1 PM ya 3:30 PM aapke liye Google Meet connect ke liye accha rahega? 🚀`;
      case 3:
        return `${name}, agar Google Meet possible na ho toh kya main aapko 2-minute ka screen walkthrough video share karun? Batayein! 💡`;
      case 4:
        return `Hey ${name}, jab bhi aap live walkthrough ke liye free hon, bas time bhej dijiyega. Main link turant generate karwa dungi! ✨`;
      default:
        return null;
    }
  }

  // GENERAL_LEAD
  switch (stage) {
    case 1:
      return `Hello ${name}! Bas ek quick follow-up—kya aap video editing agency run karte hain ya freelance editor hain? Sahi setup guide karne ke liye puch rahi thi. 😊`;
    case 2:
      return `Hey ${name}, Gigxomi par WhatsApp Business API aur Instagram chats dono ek dashboard se manage ho jate hain. 7 din ka free trial dekhna chahenge? 🚀`;
    case 3:
      return `${name}, kal Google Meet par 10-minute ka quick walkthrough attend karenge? Time bata dijiye! 📅`;
    case 4:
      return `Hey ${name}, no pressure at all! Jab bhi aap workflow check karna chahein, bas reply kar dijiyega. Have a great day! ✨`;
    default:
      return null;
  }
}

/**
 * Runs the automated follow-up evaluation cycle across all eligible conversations.
 */
export async function evaluateAndDispatchLeadDrips(): Promise<{
  evaluated: number;
  dispatched: number;
  skipped: number;
  outsideHours: boolean;
}> {
  const insideHours = isInsideIstWorkingHours();
  const summary = { evaluated: 0, dispatched: 0, skipped: 0, outsideHours: !insideHours };

  if (!insideHours) {
    return summary;
  }

  const dripStore = await loadDripStore();
  const payload = await listConversationsForAudienceFromFile("sales", { tenantId: "tenant-gigxomi", limit: 200 });
  const allConversations = (payload && Array.isArray((payload as any).conversations))
    ? ((payload as any).conversations as any[])
    : [];

  const now = Date.now();

  for (const conv of allConversations) {
    // Only process inbound customer conversations
    if (!conv || !conv.id || !conv.customerPhone) continue;

    summary.evaluated++;

    // 1. Skip closed, paid, training-booked, registered, or trial-active leads
    const statusId = String(conv.leadStatusId || "new").toLowerCase();
    const isConvertedOrOnboarded =
      statusId === "closed" ||
      statusId === "paid" ||
      statusId === "training-booked" ||
      statusId === "training_booked" ||
      statusId === "registered" ||
      statusId === "trial_active" ||
      statusId === "onboarded" ||
      statusId === "converted";

    // 2. Check registration status: if they created an account / signed up for free trial
    const regStatus = (conv as any).registrationStatus;
    const isAccountCreatedOrTrial =
      Boolean(regStatus?.registered) ||
      Boolean(regStatus?.freelancerRegistered) ||
      Boolean(regStatus?.appInstalled) ||
      regStatus?.billingState === "TRIAL" ||
      regStatus?.billingState === "PAID" ||
      regStatus?.billingState === "FREE";

    if (isConvertedOrOnboarded || isAccountCreatedOrTrial) {
      summary.skipped++;
      let state = dripStore[conv.id];
      if (state) {
        state.paused = true;
        state.completed = true;
      }
      continue;
    }

    // Check last messages
    const messages = conv.messages || [];
    if (messages.length === 0) {
      summary.skipped++;
      continue;
    }

    const lastMessage = messages[messages.length - 1];

    // If customer was the LAST one to speak, AI or human will reply in normal flow; don't trigger drip
    if (lastMessage.role === "customer") {
      summary.skipped++;
      continue;
    }

    // Time since last customer message
    const lastCustomerMsg = [...messages].reverse().find((m) => m.role === "customer");
    if (!lastCustomerMsg || !lastCustomerMsg.createdAt) {
      summary.skipped++;
      continue;
    }

    const lastCustomerTime = new Date(lastCustomerMsg.createdAt).getTime();
    const hoursSinceCustomerSpoke = (now - lastCustomerTime) / (1000 * 60 * 60);

    // Get or initialize drip state
    let state = dripStore[conv.id];
    if (!state) {
      const messagesCombined = messages.map((m: any) => m.body).join(" ");
      const category = classifyLeadDripContext(messagesCombined, conv.internalNotes);
      state = {
        conversationId: conv.id,
        customerPhone: conv.customerPhone,
        customerName: conv.customerName || "Customer",
        audienceCategory: category,
        currentStage: 0,
        paused: false,
        completed: false,
        history: [],
      };
      dripStore[conv.id] = state;
    }

    if (state.paused || state.completed) {
      summary.skipped++;
      continue;
    }

    const nextStage = state.currentStage + 1;
    if (nextStage > 4) {
      state.completed = true;
      summary.skipped++;
      continue;
    }

    const requiredDelayHours = DRIP_CADENCE_HOURS[nextStage];
    if (hoursSinceCustomerSpoke < requiredDelayHours) {
      summary.skipped++;
      continue;
    }

    // Cooldown check: must be at least 3.5 hours since the last drip was sent
    if (state.lastDripSentAt) {
      const hoursSinceLastDrip = (now - new Date(state.lastDripSentAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastDrip < 3.5) {
        summary.skipped++;
        continue;
      }
    }

    // Generate message
    const firstName = (conv.customerName || "").split(/\s+/)[0] || "";
    const content = getDripMessageContent(state.audienceCategory, nextStage, firstName);

    if (!content) {
      summary.skipped++;
      continue;
    }

    try {
      // Deliver message to conversation and dispatch to customer's WhatsApp
      await deliverConversationMessageFromFile(conv.id, {
        role: "admin",
        body: content,
        lane: "customer",
      });

      state.currentStage = nextStage;
      state.lastDripSentAt = new Date().toISOString();
      state.history.push({
        stage: nextStage,
        sentAt: new Date().toISOString(),
        body: content,
      });

      if (nextStage >= 4) {
        state.completed = true;
      }

      summary.dispatched++;
      console.log(`[WHATSAPP_LEAD_DRIP] Dispatched Stage ${nextStage} to ${conv.customerPhone} (${conv.id})`);
    } catch (err) {
      console.error(`[WHATSAPP_LEAD_DRIP] Failed to dispatch stage ${nextStage} for ${conv.id}:`, err);
    }
  }

  await saveDripStore(dripStore);
  return summary;
}

/**
 * Gets the current drip state for a specific conversation.
 */
export async function getConversationDripStatus(conversationId: string): Promise<ConversationDripState | null> {
  const dripStore = await loadDripStore();
  let state = dripStore[conversationId];
  if (!state) {
    const conv = await getConversationByIdFromFile(conversationId);
    if (!conv) return null;
    const text = (conv.messages || []).map((m) => m.body).join(" ");
    const category = classifyLeadDripContext(text, conv.internalNotes);
    state = {
      conversationId: conv.id,
      customerPhone: conv.customerPhone,
      customerName: conv.customerName || "Lead",
      audienceCategory: category,
      currentStage: 0,
      paused: false,
      completed: false,
      history: [],
    };
    dripStore[conversationId] = state;
    await saveDripStore(dripStore);
  }
  return state;
}

/**
 * Pauses or resumes the drip sequence for a specific conversation.
 */
export async function setConversationDripPaused(
  conversationId: string,
  paused: boolean,
): Promise<ConversationDripState | null> {
  const dripStore = await loadDripStore();
  let state = dripStore[conversationId];
  if (!state) {
    const conv = await getConversationByIdFromFile(conversationId);
    if (!conv) return null;
    const text = (conv.messages || []).map((m) => m.body).join(" ");
    const category = classifyLeadDripContext(text, conv.internalNotes);
    state = {
      conversationId: conv.id,
      customerPhone: conv.customerPhone,
      customerName: conv.customerName || "Lead",
      audienceCategory: category,
      currentStage: 0,
      paused,
      completed: false,
      history: [],
    };
  } else {
    state.paused = paused;
  }
  dripStore[conversationId] = state;
  await saveDripStore(dripStore);
  return state;
}
