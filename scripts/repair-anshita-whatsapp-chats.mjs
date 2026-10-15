import fs from "node:fs";
import path from "node:path";

const SESSION_KEY = "3473ea212886cdcb";
const SESSION_DIR = path.join(process.cwd(), ".gigxomi", "wa-sessions", SESSION_KEY);
const AUTH_DIR = path.join(SESSION_DIR, "auth");
const CACHE_FILE = path.join(SESSION_DIR, "scraped-cache.json");
const SCANNER_STORE_FILE = path.join(process.cwd(), ".gigxomi", "whatsapp-scanner-store.json");
const PLATFORM_STORE_FILE = path.join(process.cwd(), ".gigxomi", "local-platform-store.json");
const TENANT_ID = "tenant-the-storage-test-1d01dda2";
const AGENT_TENANT_ID = `tenant-gigxomi-sales-agent-user-sales-agent-83d13bc5`;
const ANSHITA_USER_ID = "user-sales-agent-83d13bc5";

async function main() {
  console.log("=== Starting WhatsApp Business Chat Repair for Anshita (+91 6267605079) ===");

  if (!fs.existsSync(AUTH_DIR)) {
    throw new Error(`Auth dir not found at ${AUTH_DIR}`);
  }
  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error(`Scraped cache file not found at ${CACHE_FILE}`);
  }

  // 1. Build LID -> Phone Map
  console.log("[1/5] Building LID-to-Phone map from auth store...");
  const lidToPhone = new Map();
  const authFiles = fs.readdirSync(AUTH_DIR);
  for (const f of authFiles) {
    if (f.startsWith("lid-mapping-") && f.endsWith("_reverse.json")) {
      const lid = f.slice(12, -13);
      try {
        const val = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, f), "utf8"));
        const digits = String(val).replace(/\D/g, "");
        if (digits) lidToPhone.set(lid, `+${digits}`);
      } catch {}
    }
  }
  console.log(`Loaded ${lidToPhone.size} reverse LID mappings from disk.`);

  // 2. Load Scraped Cache & Build Contact Name Map
  console.log("[2/5] Reading scraped cache and resolving contacts...");
  const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  const phoneToName = new Map();

  for (const c of cacheData.contacts || []) {
    let p = String(c.phone || "").replace(/\D/g, "");
    if (c.jid?.endsWith("@lid")) {
      const lid = c.jid.split("@")[0];
      const mapped = lidToPhone.get(lid);
      if (mapped) {
        c.phone = mapped;
        p = mapped.replace(/\D/g, "");
      }
    }
    if (p && c.name && !c.name.startsWith("+") && !c.name.startsWith("@")) {
      phoneToName.set(p, c.name);
      if (p.length === 10) phoneToName.set("91" + p, c.name);
      if (p.startsWith("91") && p.length === 12) phoneToName.set(p.slice(2), c.name);
    }
  }

  // 3. Resolve all chats in cache
  console.log("[3/5] Resolving phone numbers and names for 1,717 chats...");
  let resolvedCount = 0;
  for (const ch of cacheData.chats || []) {
    if (ch.jid?.endsWith("@lid")) {
      const lid = ch.jid.split("@")[0];
      const mapped = lidToPhone.get(lid);
      if (mapped) {
        ch.phone = mapped;
        resolvedCount++;
      }
    }
    const cleanDigits = String(ch.phone || "").replace(/\D/g, "");
    const nameMatch = phoneToName.get(cleanDigits) || (cleanDigits.length >= 10 ? phoneToName.get(cleanDigits.slice(-10)) : null);
    if (nameMatch && (!ch.name || ch.name.startsWith("+"))) {
      ch.name = nameMatch;
    }
    ch.accountType = "WHATSAPP_BUSINESS";
  }
  console.log(`Resolved ${resolvedCount} chats to true phone numbers.`);

  // Save repaired scraped-cache.json
  cacheData.savedAt = new Date().toISOString();
  cacheData.accountType = "WHATSAPP_BUSINESS";
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), "utf8");
  console.log("Updated scraped-cache.json on disk.");

  // 4. Update whatsapp-scanner-store.json
  console.log("[4/5] Updating whatsapp-scanner-store.json...");
  let scannerStore = {};
  try {
    scannerStore = JSON.parse(fs.readFileSync(SCANNER_STORE_FILE, "utf8"));
  } catch {}

  const activeChats = (cacheData.chats || [])
    .filter((c) => Array.isArray(c.messages) && c.messages.length > 0)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const scannerState = {
    storeVersion: 2,
    tenantId: AGENT_TENANT_ID,
    status: "CONNECTED",
    accountType: "WHATSAPP_BUSINESS",
    syncMode: "FULL_INBOX_SYNC",
    visibilityMode: "PRIVATE",
    connectedPhone: "+916267605079",
    connectedDisplayName: "Ai closer (Ai Closer is a Sales CRM)",
    qrCodeToken: "",
    qrCodeDataUrl: "",
    pairingCode: "",
    isLiveService: true,
    qrGeneratedAt: null,
    connectedAt: "2026-10-15T07:04:36.427Z",
    lastSyncAt: new Date().toISOString(),
    stats: {
      totalScrapedContacts: cacheData.contacts?.length || 6136,
      totalSyncedChatThreads: activeChats.length,
      totalGroupContactsScraped: cacheData.groups?.length || 13,
    },
    discoveredChats: activeChats.slice(0, 100),
    discoveredGroups: cacheData.groups || [],
  };

  scannerStore[AGENT_TENANT_ID] = scannerState;
  fs.writeFileSync(SCANNER_STORE_FILE, JSON.stringify(scannerStore, null, 2), "utf8");
  console.log(`Updated scanner store for ${AGENT_TENANT_ID}.`);

  // 5. Hydrate into local-platform-store.json
  console.log("[5/5] Hydrating active chat threads into local-platform-store.json...");
  let platformStore = { conversations: [] };
  try {
    platformStore = JSON.parse(fs.readFileSync(PLATFORM_STORE_FILE, "utf8"));
  } catch {}
  if (!Array.isArray(platformStore.conversations)) {
    platformStore.conversations = [];
  }

  let hydratedCount = 0;
  for (const chat of activeChats.slice(0, 100)) {
    const clean10 = String(chat.phone || "").replace(/\D/g, "").slice(-10);
    if (!clean10) continue;

    let conv = platformStore.conversations.find((c) => {
      const d = String(c.customerPhone || "").replace(/\D/g, "").slice(-10);
      return c.tenantId === TENANT_ID && d === clean10;
    });

    if (!conv) {
      conv = {
        id: `conv-wab-${clean10}`,
        tenantId: TENANT_ID,
        title: chat.name || chat.phone,
        customerName: chat.name || chat.phone,
        customerPhone: chat.phone,
        serviceId: "svc-whatsapp-business",
        serviceTitle: "WhatsApp Business Inquiry",
        sourceChannel: "whatsapp",
        externalSourceType: "whatsapp_business",
        externalSourceLabel: `Closer WhatsApp • +916267605079`,
        externalSourcePhone: "+916267605079",
        status: "active",
        createdAt: chat.lastMessageAt || new Date().toISOString(),
        updatedAt: chat.lastMessageAt || new Date().toISOString(),
        lastCustomerActivityAt: chat.lastMessageAt || new Date().toISOString(),
        assignedFreelancerId: ANSHITA_USER_ID,
        assignedFreelancerName: "Anshita",
        unreadCount: chat.unreadCount || 0,
        unreadCountByLane: { customer: chat.unreadCount || 0, internal: 0 },
        messages: [],
      };
      platformStore.conversations.unshift(conv);
      hydratedCount++;
    }

    conv.externalSourceType = "whatsapp_business";
    conv.externalSourceLabel = `Closer WhatsApp • +916267605079`;
    conv.externalSourcePhone = "+916267605079";
    conv.assignedFreelancerId = ANSHITA_USER_ID;
    conv.assignedFreelancerName = "Anshita";

    const existingMsgIds = new Set((conv.messages || []).map((m) => m.id || m.externalMessageId));
    for (const m of chat.messages || []) {
      if (!m.body?.trim()) continue;
      const mId = m.id || `msg-${Date.now()}`;
      if (existingMsgIds.has(mId)) continue;
      conv.messages.push({
        id: mId,
        conversationId: conv.id,
        senderId: m.role === "sales" ? ANSHITA_USER_ID : "customer",
        senderRole: m.role === "sales" ? "sales" : "customer",
        senderName: m.role === "sales" ? "Anshita" : chat.name,
        lane: "customer",
        body: m.body.trim(),
        createdAt: m.timestamp || new Date().toISOString(),
        externalMessageId: m.id,
        deliveryStatus: "sent",
      });
      existingMsgIds.add(mId);
    }
  }

  fs.writeFileSync(PLATFORM_STORE_FILE, JSON.stringify(platformStore, null, 2), "utf8");
  console.log(`Successfully hydrated ${hydratedCount} active WhatsApp Business conversations into CRM store.`);
  console.log("=== WhatsApp Chat Repair Complete! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
