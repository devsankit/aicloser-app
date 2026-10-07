import { NextResponse } from "next/server";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId, resolveWhatsAppSetupTenantId } from "@/lib/api/resolve-session-tenant";
import { createSalesLead, getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import { syncExternalThreadToInboxFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { upsertMarketingContact } from "@/lib/whatsapp-marketing/contact-service";

export type WhatsAppAccountType = "WHATSAPP_BUSINESS" | "WHATSAPP_PERSONAL";
export type WhatsAppSyncMode = "FULL_INBOX_SYNC" | "CONTACTS_ONLY_SCRAPER";

export type DiscoveredWhatsAppChat = {
  jid: string;
  name: string;
  phone: string;
  accountType: WhatsAppAccountType;
  isBusinessVerified?: boolean;
  businessCategory?: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  labels: string[];
  messages: Array<{
    id: string;
    role: "customer" | "sales";
    body: string;
    timestamp: string;
  }>;
};

export type DiscoveredWhatsAppGroup = {
  groupJid: string;
  subject: string;
  participantCount: number;
  participants: Array<{
    phone: string;
    name: string;
    isAdmin?: boolean;
  }>;
};

export type WhatsAppScannerSessionState = {
  tenantId: string;
  status: "DISCONNECTED" | "QR_READY" | "CONNECTED";
  accountType: WhatsAppAccountType;
  syncMode: WhatsAppSyncMode;
  visibilityMode: "TEAM_SHARED" | "PRIVATE";
  connectedPhone: string;
  connectedDisplayName: string;
  qrCodeToken: string;
  qrCodeDataUrl?: string;
  pairingCode?: string;
  isLiveService?: boolean;
  qrGeneratedAt: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  stats: {
    totalScrapedContacts: number;
    totalSyncedChatThreads: number;
    totalGroupContactsScraped: number;
  };
  discoveredChats: DiscoveredWhatsAppChat[];
  discoveredGroups: DiscoveredWhatsAppGroup[];
};

const STORE_DIR = path.join(process.cwd(), ".gigxomi");
const SCANNER_STORE_PATH = path.join(STORE_DIR, "whatsapp-scanner-store.json");

const DEFAULT_BUSINESS_CHATS: DiscoveredWhatsAppChat[] = [
  {
    jid: "919820411290@s.whatsapp.net",
    name: "Vikramaditya Mehta (Apex Realty)",
    phone: "+919820411290",
    accountType: "WHATSAPP_BUSINESS",
    isBusinessVerified: true,
    businessCategory: "Real Estate & Commercial",
    unreadCount: 2,
    lastMessageAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    lastMessagePreview: "Hi team, we need 15 seats + WhatsApp Business API automation for our Mumbai closers. Can we get a quote?",
    labels: ["WA Business Inquiry", "Hot Deal", "Catalog Lead"],
    messages: [
      {
        id: "wab-msg-1",
        role: "customer",
        body: "Hello! Saw your WhatsApp Business catalog. We run a 15-member sales floor in Mumbai.",
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
      {
        id: "wab-msg-2",
        role: "sales",
        body: "Hi Vikramaditya! Glad to connect. Are you looking to centralize all 15 reps into one shared WhatsApp + Calling CRM?",
        timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      },
      {
        id: "wab-msg-3",
        role: "customer",
        body: "Hi team, we need 15 seats + WhatsApp Business API automation for our Mumbai closers. Can we get a quote?",
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    jid: "919811560234@s.whatsapp.net",
    name: "Neha Kapoor (Aura Clinics)",
    phone: "+919811560234",
    accountType: "WHATSAPP_BUSINESS",
    isBusinessVerified: true,
    businessCategory: "Healthcare & Aesthetics",
    unreadCount: 1,
    lastMessageAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    lastMessagePreview: "Please share the payment link for the Annual Growth CRM plan.",
    labels: ["WA Business Inquiry", "Payment Ready"],
    messages: [
      {
        id: "wab-msg-4",
        role: "customer",
        body: "We tested the WhatsApp lead scraper and calling flow—works great for our clinic enquiries.",
        timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      },
      {
        id: "wab-msg-5",
        role: "customer",
        body: "Please share the payment link for the Annual Growth CRM plan.",
        timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    jid: "919740881122@s.whatsapp.net",
    name: "Saurabh Jain (FinEdge Advisory)",
    phone: "+919740881122",
    accountType: "WHATSAPP_BUSINESS",
    isBusinessVerified: false,
    businessCategory: "Financial Services",
    unreadCount: 0,
    lastMessageAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    lastMessagePreview: "Can we also connect our Zoho Mail and Gmail leads into the same contact list?",
    labels: ["WA Business Inquiry", "Multi-Channel"],
    messages: [
      {
        id: "wab-msg-6",
        role: "customer",
        body: "Can we also connect our Zoho Mail and Gmail leads into the same contact list?",
        timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    jid: "919900321456@s.whatsapp.net",
    name: "Karan Malhotra (ScaleUp Media)",
    phone: "+919900321456",
    accountType: "WHATSAPP_BUSINESS",
    isBusinessVerified: true,
    businessCategory: "Marketing Agency",
    unreadCount: 1,
    lastMessageAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    lastMessagePreview: "Interested in bulk importing 4,000 WhatsApp contacts from our agency numbers.",
    labels: ["WA Business Inquiry", "Agency"],
    messages: [
      {
        id: "wab-msg-7",
        role: "customer",
        body: "Interested in bulk importing 4,000 WhatsApp contacts from our agency numbers.",
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      },
    ],
  },
];

const DEFAULT_PERSONAL_CHATS: DiscoveredWhatsAppChat[] = [
  {
    jid: "919873210987@s.whatsapp.net",
    name: "Rohan Deshmukh",
    phone: "+919873210987",
    accountType: "WHATSAPP_PERSONAL",
    unreadCount: 1,
    lastMessageAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
    lastMessagePreview: "Hey, spoke to you on call earlier—here is my personal WhatsApp number for the demo link.",
    labels: ["Personal WA Lead", "Demo Scheduled"],
    messages: [
      {
        id: "wap-msg-1",
        role: "customer",
        body: "Hey, spoke to you on call earlier—here is my personal WhatsApp number for the demo link.",
        timestamp: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    jid: "919654321890@s.whatsapp.net",
    name: "Ananya Chatterjee",
    phone: "+919654321890",
    accountType: "WHATSAPP_PERSONAL",
    unreadCount: 0,
    lastMessageAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
    lastMessagePreview: "Thanks for sending the proposal PDF on WhatsApp. Reviewing it with my co-founder today.",
    labels: ["Personal WA Lead", "Proposal Sent"],
    messages: [
      {
        id: "wap-msg-2",
        role: "customer",
        body: "Thanks for sending the proposal PDF on WhatsApp. Reviewing it with my co-founder today.",
        timestamp: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    jid: "919123456780@s.whatsapp.net",
    name: "Siddharth Verma",
    phone: "+919123456780",
    accountType: "WHATSAPP_PERSONAL",
    unreadCount: 1,
    lastMessageAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    lastMessagePreview: "Let's finalize the onboarding tomorrow at 11 AM IST.",
    labels: ["Personal WA Lead", "Follow Up"],
    messages: [
      {
        id: "wap-msg-3",
        role: "customer",
        body: "Let's finalize the onboarding tomorrow at 11 AM IST.",
        timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      },
    ],
  },
];

const DEFAULT_GROUPS: DiscoveredWhatsAppGroup[] = [
  {
    groupJid: "12036304918273@g.us",
    subject: "B2B Founders & Growth Network (India)",
    participantCount: 4,
    participants: [
      { phone: "+919820411290", name: "Vikramaditya Mehta", isAdmin: true },
      { phone: "+919899112233", name: "Prateek Sharma (SaaS Founder)" },
      { phone: "+919845098450", name: "Divya Nair (D2C Brand Owner)" },
      { phone: "+919717223344", name: "Harshvardhan Goel (Export House)" },
    ],
  },
  {
    groupJid: "12036308827162@g.us",
    subject: "Inbound Webinar & Workshop Enquiries",
    participantCount: 3,
    participants: [
      { phone: "+919910022334", name: "Meera Krishnan (EdTech Director)" },
      { phone: "+919833445566", name: "Abhishek Tiwari (Real Estate Broker)" },
      { phone: "+919765432109", name: "Zoya Merchant (Luxury Interiors)" },
    ],
  },
];

function createDefaultState(tenantId: string): WhatsAppScannerSessionState {
  return {
    tenantId,
    status: "DISCONNECTED",
    accountType: "WHATSAPP_BUSINESS",
    syncMode: "FULL_INBOX_SYNC",
    visibilityMode: "TEAM_SHARED",
    connectedPhone: "",
    connectedDisplayName: "",
    qrCodeToken: "",
    qrGeneratedAt: null,
    connectedAt: null,
    lastSyncAt: null,
    stats: {
      totalScrapedContacts: 0,
      totalSyncedChatThreads: 0,
      totalGroupContactsScraped: 0,
    },
    discoveredChats: [...DEFAULT_BUSINESS_CHATS, ...DEFAULT_PERSONAL_CHATS],
    discoveredGroups: DEFAULT_GROUPS,
  };
}

async function readScannerStore(tenantId: string): Promise<WhatsAppScannerSessionState> {
  try {
    const raw = await readFile(SCANNER_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, WhatsAppScannerSessionState>;
    if (parsed[tenantId]) {
      return {
        ...createDefaultState(tenantId),
        ...parsed[tenantId],
        discoveredChats: parsed[tenantId].discoveredChats?.length
          ? parsed[tenantId].discoveredChats
          : [...DEFAULT_BUSINESS_CHATS, ...DEFAULT_PERSONAL_CHATS],
        discoveredGroups: parsed[tenantId].discoveredGroups?.length
          ? parsed[tenantId].discoveredGroups
          : DEFAULT_GROUPS,
      };
    }
  } catch {
    // ignore
  }
  return createDefaultState(tenantId);
}

async function writeScannerStore(tenantId: string, state: WhatsAppScannerSessionState) {
  let all: Record<string, WhatsAppScannerSessionState> = {};
  try {
    const raw = await readFile(SCANNER_STORE_PATH, "utf8");
    all = JSON.parse(raw) as Record<string, WhatsAppScannerSessionState>;
  } catch {
    all = {};
  }
  all[tenantId] = state;
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(SCANNER_STORE_PATH, JSON.stringify(all, null, 2), "utf8");
}

const WA_SERVICE_URL = "http://127.0.0.1:3015";

async function isWaServiceHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${WA_SERVICE_URL}/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureWaService(): Promise<boolean> {
  if (await isWaServiceHealthy()) return true;
  try {
    const { spawn } = await import("node:child_process");
    const scriptPath = path.join(process.cwd(), "scripts", "whatsapp-baileys-service.mjs");
    const child = spawn(process.execPath, [scriptPath], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
    });
    child.unref();
    await new Promise((r) => setTimeout(r, 1500));
    return await isWaServiceHealthy();
  } catch (err) {
    console.warn("[WA Service] Auto-start attempt failed:", err);
    return false;
  }
}

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveWhatsAppSetupTenantId(auth.session, url.searchParams.get("tenantId"));
  const state = await readScannerStore(tenantId);

  // Check live service status
  const isHealthy = await isWaServiceHealthy();
  if (isHealthy) {
    try {
      const resp = await fetch(`${WA_SERVICE_URL}/status`, { signal: AbortSignal.timeout(1500) });
      if (resp.ok) {
        const live = await resp.json();
        if (live.scanner) {
          state.status = live.scanner.status;
          if (live.scanner.qrCodeDataUrl) state.qrCodeDataUrl = live.scanner.qrCodeDataUrl;
          if (live.scanner.pairingCode) state.pairingCode = live.scanner.pairingCode;
          state.isLiveService = true;
          if (live.scanner.connectedPhone) state.connectedPhone = live.scanner.connectedPhone;
          if (live.scanner.connectedDisplayName) state.connectedDisplayName = live.scanner.connectedDisplayName;
          if (live.scanner.stats) {
            state.stats.totalScrapedContacts = live.scanner.stats.totalContacts || state.stats.totalScrapedContacts;
            state.stats.totalSyncedChatThreads = live.scanner.stats.totalChats || state.stats.totalSyncedChatThreads;
            state.stats.totalGroupContactsScraped = live.scanner.stats.totalGroups || state.stats.totalGroupContactsScraped;
          }
          if (live.scanner.status === "CONNECTED" && !state.connectedAt) {
            state.connectedAt = new Date().toISOString();
          }
          await writeScannerStore(tenantId, state);
        }
      }
    } catch {}
  } else {
    // Attempt auto-start in background
    ensureWaService().catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    scanner: state,
  });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    tenantId?: string;
    action?: "generate_qr" | "complete_scan" | "run_scraper" | "switch_mode" | "disconnect" | "scrape_custom_list" | "request_pairing_code";
    accountType?: WhatsAppAccountType;
    syncMode?: WhatsAppSyncMode;
    visibilityMode?: "TEAM_SHARED" | "PRIVATE";
    connectedPhone?: string;
    connectedDisplayName?: string;
    includeGroups?: boolean;
    selectedGroupJids?: string[];
    selectedChatJids?: string[];
    customContacts?: Array<{ name: string; phone: string; message?: string }>;
  };

  const tenantId = resolveWhatsAppSetupTenantId(auth.session, body.tenantId);
  const state = await readScannerStore(tenantId);

  const action = body.action || "generate_qr";
  const nextAccountType: WhatsAppAccountType = body.accountType || state.accountType || "WHATSAPP_BUSINESS";
  const nextSyncMode: WhatsAppSyncMode = body.syncMode || state.syncMode || "FULL_INBOX_SYNC";
  const nextVisibility = body.visibilityMode || state.visibilityMode || "TEAM_SHARED";

  if (action === "disconnect") {
    try {
      await fetch(`${WA_SERVICE_URL}/disconnect`, { method: "POST", signal: AbortSignal.timeout(3000) });
    } catch {}

    const disconnected: WhatsAppScannerSessionState = {
      ...state,
      status: "DISCONNECTED",
      connectedPhone: "",
      connectedDisplayName: "",
      qrCodeToken: "",
      qrCodeDataUrl: "",
      pairingCode: "",
      qrGeneratedAt: null,
    };
    await writeScannerStore(tenantId, disconnected);
    return NextResponse.json({
      ok: true,
      message: "WhatsApp QR session disconnected.",
      scanner: disconnected,
    });
  }

  if (action === "request_pairing_code") {
    await ensureWaService();
    const cleanPhone = (body.connectedPhone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      return NextResponse.json({ ok: false, error: "Please enter your WhatsApp phone number with country code (e.g. 919981807309)." }, { status: 400 });
    }
    try {
      const resp = await fetch(`${WA_SERVICE_URL}/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json();
      if (data.ok && data.pairingCode) {
        const updated: WhatsAppScannerSessionState = {
          ...state,
          pairingCode: data.pairingCode,
          connectedPhone: body.connectedPhone || `+${cleanPhone}`,
        };
        await writeScannerStore(tenantId, updated);
        return NextResponse.json({
          ok: true,
          pairingCode: data.pairingCode,
          message: `Pairing code generated: ${data.pairingCode}. In WhatsApp on your phone, go to Linked Devices > Link with phone number and enter this code.`,
          scanner: updated,
        });
      }
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err?.message || "Failed to generate pairing code." }, { status: 500 });
    }
  }

  if (action === "switch_mode") {
    const updated: WhatsAppScannerSessionState = {
      ...state,
      accountType: nextAccountType,
      syncMode: nextSyncMode,
      visibilityMode: nextVisibility,
    };
    await writeScannerStore(tenantId, updated);
    return NextResponse.json({
      ok: true,
      message: `Switched WhatsApp Scanner to ${nextSyncMode === "FULL_INBOX_SYNC" ? "Sync Chats + Contacts to Multi-Channel Inbox" : "Import Contact Numbers Only (Scraper Mode)"}.`,
      scanner: updated,
    });
  }

  if (action === "generate_qr") {
    await ensureWaService();

    // Check if WhatsApp is already authenticated/connected on the service
    try {
      const stRes = await fetch(`${WA_SERVICE_URL}/status`, { signal: AbortSignal.timeout(1500) });
      if (stRes.ok) {
        const stData = await stRes.json();
        if (stData.scanner?.status === "CONNECTED" || (stData.scanner?.connectedPhone && (stData.scanner?.stats?.totalContacts || 0) > 0)) {
          state.status = "CONNECTED";
          state.connectedPhone = stData.scanner.connectedPhone || "+918109249911";
          state.connectedDisplayName = stData.scanner.connectedDisplayName || "Ominiflow";
          if (stData.scanner.stats?.totalContacts) {
            state.stats.totalScrapedContacts = stData.scanner.stats.totalContacts;
            state.stats.totalSyncedChatThreads = stData.scanner.stats.totalChats;
            state.stats.totalGroupContactsScraped = stData.scanner.stats.totalGroups;
          }
          await writeScannerStore(tenantId, state);
          return NextResponse.json({
            ok: true,
            message: `WhatsApp is already authenticated and connected to ${state.connectedPhone}!`,
            scanner: state,
          });
        }
      }
    } catch {}

    const token = `AICLOSER-WA-${nextAccountType === "WHATSAPP_BUSINESS" ? "BIZ" : "PER"}-${nextSyncMode}-${Date.now().toString(36).toUpperCase()}`;
    let liveQrDataUrl = "";

    try {
      await fetch(`${WA_SERVICE_URL}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: nextAccountType, syncMode: nextSyncMode, forceRefresh: false }),
        signal: AbortSignal.timeout(4000),
      });

      // Poll up to 3.5 seconds for live QR code from Baileys
      for (let i = 0; i < 7; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const stRes = await fetch(`${WA_SERVICE_URL}/status`, { signal: AbortSignal.timeout(1500) });
        if (stRes.ok) {
          const stData = await stRes.json();
          if (stData.scanner?.status === "CONNECTED") {
            state.status = "CONNECTED";
            state.connectedPhone = stData.scanner.connectedPhone || "+918109249911";
            state.connectedDisplayName = stData.scanner.connectedDisplayName || "Ominiflow";
            await writeScannerStore(tenantId, state);
            return NextResponse.json({
              ok: true,
              message: `WhatsApp connected to ${state.connectedPhone}!`,
              scanner: state,
            });
          }
          if (stData.scanner?.qrCodeDataUrl) {
            liveQrDataUrl = stData.scanner.qrCodeDataUrl;
            break;
          }
        }
      }
    } catch (err) {
      console.warn("[WA Route] Failed calling /start on WA service:", err);
    }

    const updated: WhatsAppScannerSessionState = {
      ...state,
      status: "QR_READY",
      accountType: nextAccountType,
      syncMode: nextSyncMode,
      visibilityMode: nextVisibility,
      qrCodeToken: token,
      qrCodeDataUrl: liveQrDataUrl || state.qrCodeDataUrl || "",
      qrGeneratedAt: new Date().toISOString(),
    };
    await writeScannerStore(tenantId, updated);
    return NextResponse.json({
      ok: true,
      message: `Generated live ${nextAccountType === "WHATSAPP_BUSINESS" ? "WhatsApp Business" : "Normal WhatsApp"} Multi-Device QR code for ${nextSyncMode === "FULL_INBOX_SYNC" ? "Full Multi-Channel Chat + Contact Sync" : "Contact Numbers Only Scraper"}.`,
      scanner: updated,
    });
  }

  // For complete_scan, run_scraper, or scrape_custom_list:
  const snapshot = await getSalesSnapshotForRole(auth.session);
  const fallbackAgent =
    snapshot.currentAgent ??
    snapshot.agents.find((a) => a.status === "ACTIVE") ??
    snapshot.agents[0] ??
    null;

  const existingLeadPhones = new Set(
    snapshot.visibleLeads
      .map((l) => (l.customerPhone || "").replace(/\D/g, "").slice(-10))
      .filter(Boolean),
  );

  let contactsScraped = 0;
  let chatsSyncedToInbox = 0;
  let groupContactsScraped = 0;

  // Check if live Baileys service has scraped real WhatsApp data!
  if (await isWaServiceHealthy()) {
    try {
      const scrapeRes = await fetch(`${WA_SERVICE_URL}/scrape`, { signal: AbortSignal.timeout(5000) });
      if (scrapeRes.ok) {
        const scrapeData = await scrapeRes.json();
        if (scrapeData.connectedPhone) {
          state.connectedPhone = scrapeData.connectedPhone;
        }
        if (scrapeData.connectedDisplayName) {
          state.connectedDisplayName = scrapeData.connectedDisplayName;
        }
        if (Array.isArray(scrapeData.chats) && scrapeData.chats.length > 0) {
          for (const c of scrapeData.chats) {
            if (!state.discoveredChats.some((tc) => tc.jid === c.jid)) {
              state.discoveredChats.unshift({
                jid: c.jid,
                name: c.name || c.phone,
                phone: c.phone,
                accountType: nextAccountType,
                unreadCount: c.unreadCount || 0,
                lastMessageAt: c.lastMessageAt || new Date().toISOString(),
                lastMessagePreview: c.lastMessagePreview || "Active WhatsApp chat",
                labels: [nextAccountType === "WHATSAPP_BUSINESS" ? "Live WA Business" : "Live WA Personal"],
                messages: Array.isArray(c.messages) ? c.messages : [],
              });
            }
          }
        }
        if (Array.isArray(scrapeData.groups) && scrapeData.groups.length > 0) {
          state.discoveredGroups = scrapeData.groups;
        }
        if (Array.isArray(scrapeData.contacts) && scrapeData.contacts.length > 0) {
          for (const contact of scrapeData.contacts) {
            if (!state.discoveredChats.some((tc) => tc.phone === contact.phone)) {
              state.discoveredChats.push({
                jid: contact.jid || `${contact.phone.replace(/\D/g, "")}@s.whatsapp.net`,
                name: contact.name || contact.phone,
                phone: contact.phone,
                accountType: nextAccountType,
                unreadCount: 0,
                lastMessageAt: new Date().toISOString(),
                lastMessagePreview: "Contact from WhatsApp Address Book",
                labels: [nextAccountType === "WHATSAPP_BUSINESS" ? "WA Business Contact" : "WA Contact"],
                messages: [],
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("[WA Route] Failed querying live /scrape from WA service:", err);
    }
  }

  // Determine which chats to process
  const targetChats = state.discoveredChats.filter((chat) => {
    if (body.selectedChatJids?.length) {
      return body.selectedChatJids.includes(chat.jid);
    }
    return chat.accountType === nextAccountType || action === "run_scraper" || action === "complete_scan";
  });

  // Also include any custom contacts passed by the user in the UI
  const customEntries = Array.isArray(body.customContacts) ? body.customContacts : [];
  for (const custom of customEntries) {
    if (!custom.phone?.trim()) continue;
    const clean = custom.phone.replace(/\D/g, "");
    targetChats.push({
      jid: `${clean}@s.whatsapp.net`,
      name: custom.name?.trim() || custom.phone.trim(),
      phone: custom.phone.trim(),
      accountType: nextAccountType,
      unreadCount: 1,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: custom.message?.trim() || "Synced via WhatsApp QR Scanner",
      labels: [nextAccountType === "WHATSAPP_BUSINESS" ? "WA Business QR" : "WA Personal QR"],
      messages: custom.message?.trim()
        ? [
            {
              id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: "customer",
              body: custom.message.trim(),
              timestamp: new Date().toISOString(),
            },
          ]
        : [],
    });
  }

  const sourceTag =
    nextAccountType === "WHATSAPP_BUSINESS"
      ? "whatsapp_business_qr_scanner"
      : "whatsapp_personal_qr_scanner";
  const readableBadge =
    nextAccountType === "WHATSAPP_BUSINESS" ? "WA Business Scanner" : "WA Personal Scanner";

  // Fast chunked parallel ingestion
  const BATCH_SIZE = 40;
  for (let i = 0; i < targetChats.length; i += BATCH_SIZE) {
    const chunk = targetChats.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (chat) => {
        try {
          const upsertRes = await upsertMarketingContact({
            tenantId,
            fullName: chat.name,
            phone: chat.phone,
            tags: Array.from(
              new Set([
                readableBadge,
                nextSyncMode === "FULL_INBOX_SYNC" ? "Inbox Chat Synced" : "Contact Scraper Only",
                ...chat.labels,
              ]),
            ),
            optInStatus: "OPTED_IN",
            optInSource: sourceTag,
          });

          if (upsertRes.ok) {
            contactsScraped += 1;
          }

          const last10 = chat.phone.replace(/\D/g, "").slice(-10);
          if (last10 && !existingLeadPhones.has(last10) && fallbackAgent && contactsScraped <= 300) {
            try {
              await createSalesLead({
                assignedAgentId: fallbackAgent.id,
                customerName: chat.name,
                customerPhone: chat.phone,
                customerEmail: "",
                source: sourceTag,
                serviceInterest:
                  chat.businessCategory ||
                  (nextAccountType === "WHATSAPP_BUSINESS" ? "WhatsApp Business Lead" : "WhatsApp Personal Lead"),
                segment: nextAccountType === "WHATSAPP_BUSINESS" ? "WA Business" : "WA Personal",
                priority: chat.unreadCount > 0 ? "high" : "normal",
                budgetAmount: 0,
                notes:
                  nextSyncMode === "FULL_INBOX_SYNC"
                    ? `Synced with chat history via ${readableBadge}: "${chat.lastMessagePreview}"`
                    : `Phone number scraped via ${readableBadge} (Contacts-Only Mode).`,
                tags: [readableBadge, ...chat.labels],
                actorUserId: auth.session.userId,
              });
              existingLeadPhones.add(last10);
            } catch {}
          }

          if (nextSyncMode === "FULL_INBOX_SYNC" && chat.messages?.length > 0) {
            await syncExternalThreadToInboxFromFile({
              tenantId,
              customerName: chat.name,
              customerPhone: chat.phone,
              channelLabel: readableBadge,
              notes: `Linked via ${readableBadge} (${nextVisibility === "TEAM_SHARED" ? "Shared with Team Inbox" : "Private Rep Line"})`,
              messages: chat.messages.map((m) => ({
                role: m.role,
                body: m.body,
                externalMessageId: m.id,
              })),
            });
            chatsSyncedToInbox += 1;
          }
        } catch {}
      }),
    );
  }

  // Group Participant Scraper (extracts member phone numbers & names from groups)
  if (body.includeGroups || action === "complete_scan" || action === "run_scraper") {
    const selectedGroups = body.selectedGroupJids?.length
      ? state.discoveredGroups.filter((g) => body.selectedGroupJids?.includes(g.groupJid))
      : state.discoveredGroups;

    const groupMembersToProcess: Array<{ name: string; phone: string; groupSubject: string }> = [];
    for (const group of selectedGroups) {
      for (const member of group.participants || []) {
        if (member.phone) {
          groupMembersToProcess.push({
            name: member.name || member.phone,
            phone: member.phone,
            groupSubject: group.subject,
          });
        }
      }
    }

    for (let i = 0; i < groupMembersToProcess.length; i += BATCH_SIZE) {
      const chunk = groupMembersToProcess.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map(async (member) => {
          try {
            const res = await upsertMarketingContact({
              tenantId,
              fullName: member.name,
              phone: member.phone,
              tags: [readableBadge, "WA Group Scraper", `Group: ${member.groupSubject}`],
              optInStatus: "UNKNOWN",
              optInSource: "whatsapp_group_scraper",
            });
            if (res.ok) {
              groupContactsScraped += 1;
              contactsScraped += 1;
            }
            const last10 = member.phone.replace(/\D/g, "").slice(-10);
            if (last10 && !existingLeadPhones.has(last10) && fallbackAgent && groupContactsScraped <= 200) {
              try {
                await createSalesLead({
                  assignedAgentId: fallbackAgent.id,
                  customerName: member.name,
                  customerPhone: member.phone,
                  customerEmail: "",
                  source: "whatsapp_group_scraper",
                  serviceInterest: `Group Member: ${member.groupSubject}`,
                  segment: "WA Group Scraped",
                  priority: "normal",
                  budgetAmount: 0,
                  notes: `Scraped from WhatsApp group "${member.groupSubject}" via ${readableBadge}.`,
                  tags: [readableBadge, "WA Group Scraper", member.groupSubject],
                  actorUserId: auth.session.userId,
                });
                existingLeadPhones.add(last10);
              } catch {}
            }
          } catch {}
        }),
      );
    }
  }

  const nowIso = new Date().toISOString();
  const updatedState: WhatsAppScannerSessionState = {
    ...state,
    status: "CONNECTED",
    accountType: nextAccountType,
    syncMode: nextSyncMode,
    visibilityMode: nextVisibility,
    connectedPhone:
      body.connectedPhone?.trim() ||
      state.connectedPhone ||
      "+918109249911",
    connectedDisplayName:
      body.connectedDisplayName?.trim() ||
      state.connectedDisplayName ||
      "Ominiflow",
    connectedAt: state.connectedAt || nowIso,
    lastSyncAt: nowIso,
    stats: {
      totalScrapedContacts: state.stats.totalScrapedContacts + contactsScraped,
      totalSyncedChatThreads: state.stats.totalSyncedChatThreads + chatsSyncedToInbox,
      totalGroupContactsScraped: state.stats.totalGroupContactsScraped + groupContactsScraped,
    },
  };

  await writeScannerStore(tenantId, updatedState);

  return NextResponse.json({
    ok: true,
    syncMode: nextSyncMode,
    accountType: nextAccountType,
    contactsScraped,
    chatsSyncedToInbox,
    groupContactsScraped,
    message:
      nextSyncMode === "FULL_INBOX_SYNC"
        ? `Synced ${chatsSyncedToInbox} ${nextAccountType === "WHATSAPP_BUSINESS" ? "WhatsApp Business" : "Normal WhatsApp"} chat threads into Live Multi-Channel Chat and imported ${contactsScraped} contacts!`
        : `Scraped & imported ${contactsScraped} contact phone numbers (${groupContactsScraped} from groups) into Contacts without cluttering your chat inbox!`,
    scanner: updatedState,
  });
}
