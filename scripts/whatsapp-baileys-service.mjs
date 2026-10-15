import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import pino from "pino";

const PORT = process.env.WA_SERVICE_PORT || 3015;
const rawSessionKey = String(process.env.WA_SESSION_KEY || "default").trim();
const sessionKey = rawSessionKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "default";
const SESSION_DIR = path.join(process.cwd(), ".gigxomi", "wa-sessions", sessionKey);
const AUTH_DIR = path.join(SESSION_DIR, "auth");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");
const SCRAPED_CACHE_FILE = path.join(SESSION_DIR, "scraped-cache.json");

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let sessionState = {
  status: "DISCONNECTED", // DISCONNECTED | CONNECTING | QR_READY | CONNECTED
  qrCodeDataUrl: "",
  qrRaw: "",
  pairingCode: "",
  connectedPhone: "",
  connectedDisplayName: "",
  accountType: "WHATSAPP_BUSINESS",
  syncMode: "FULL_INBOX_SYNC",
  qrGeneratedAt: null,
  connectedAt: null,
  lastError: null,
  stats: {
    totalContacts: 0,
    totalChats: 0,
    totalGroups: 0,
  },
};

// In-memory data store for live scraping
const memoryStore = {
  contacts: new Map(), // jid -> { jid, phone, name, verifiedName }
  chats: new Map(),    // jid -> { jid, phone, name, unreadCount, lastMessageAt, lastMessagePreview, messages: [] }
  groups: new Map(),   // groupJid -> { groupJid, subject, participantCount, participants: [] }
};

const lidToPhoneCache = new Map();

function preloadLidMappings() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    for (const f of files) {
      if (f.startsWith("lid-mapping-") && f.endsWith("_reverse.json")) {
        const lid = f.slice(12, -13);
        try {
          const val = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, f), "utf8"));
          const digits = String(val).replace(/\D/g, "");
          if (digits) {
            lidToPhoneCache.set(lid, `+${digits}`);
          }
        } catch {}
      } else if (f.startsWith("lid-mapping-") && f.endsWith(".json")) {
        const phone = f.slice(12, -5).replace(/\D/g, "");
        try {
          const val = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, f), "utf8"));
          const lidDigits = String(val).replace(/\D/g, "");
          if (lidDigits && phone) {
            lidToPhoneCache.set(lidDigits, `+${phone}`);
          }
        } catch {}
      }
    }
    console.log(`[WA Service] Preloaded ${lidToPhoneCache.size} LID phone mappings from auth store.`);
  } catch (err) {
    console.warn("[WA Service] Error preloading LID mappings:", err);
  }
}

preloadLidMappings();

function jidToPhone(jid) {
  if (!jid) return "";
  if (jid.endsWith("@lid")) {
    const lid = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
    if (lidToPhoneCache.has(lid)) {
      return lidToPhoneCache.get(lid);
    }
    try {
      const mappingFile = path.join(AUTH_DIR, `lid-mapping-${lid}_reverse.json`);
      if (fs.existsSync(mappingFile)) {
        const mapped = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
        const clean = String(mapped).replace(/\D/g, "");
        if (clean) {
          const phone = `+${clean}`;
          lidToPhoneCache.set(lid, phone);
          return phone;
        }
      }
    } catch {}
  }
  const num = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return num ? `+${num}` : "";
}

function getContactNameForPhone(phone) {
  const jid = arguments[1] || "";
  if (!phone && !jid) return "";
  if (jid && memoryStore.contacts.has(jid)) {
    const direct = memoryStore.contacts.get(jid);
    if (direct?.name && !direct.name.startsWith("+") && !direct.name.startsWith("@") && !direct.name.includes("deviceId")) {
      return direct.name;
    }
  }

  const rawDigits = String(phone || "").replace(/\D/g, "");
  if (!rawDigits) return "";

  const resolvedDigits = (lidToPhoneCache.get(rawDigits) || "").replace(/\D/g, "") || rawDigits;
  const p10 = resolvedDigits.slice(-10);

  for (const contact of memoryStore.contacts.values()) {
    const cDigits = (contact.phone || "").replace(/\D/g, "");
    const cJidDigits = (contact.jid || "").split("@")[0].replace(/\D/g, "");
    const cName = contact.name || contact.notify || contact.verifiedName;
    if (!cName || cName.startsWith("+") || cName.startsWith("@") || cName.includes("deviceId")) continue;

    if (cDigits && (cDigits === resolvedDigits || (p10 && cDigits.endsWith(p10)))) {
      return cName;
    }
    if (cJidDigits && (cJidDigits === rawDigits || (p10 && cJidDigits.endsWith(p10)))) {
      return cName;
    }
  }
  return "";
}

function appendWhatsAppMessage(message) {
  if (!message?.key?.remoteJid || message.key.remoteJid.endsWith("@g.us")) return;
  const jid = message.key.remoteJid;
  const body =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    (message.message?.imageMessage ? "[Photo]" : "") ||
    (message.message?.documentMessage ? "[Document]" : "");
  if (!body) return;

  const timestamp = new Date(message.messageTimestamp ? Number(message.messageTimestamp) * 1000 : Date.now()).toISOString();
  const messageId = message.key.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const resolvedPhone = jidToPhone(jid);
  const contactName = getContactNameForPhone(resolvedPhone);
  const chat = memoryStore.chats.get(jid) || {
    jid,
    phone: resolvedPhone,
    name: contactName || message.pushName || resolvedPhone,
    unreadCount: 0,
    lastMessageAt: timestamp,
    lastMessagePreview: body,
    messages: [],
  };

  chat.phone = resolvedPhone;
  chat.lastMessagePreview = body;
  chat.lastMessageAt = timestamp;
  if (contactName && (!chat.name || chat.name.startsWith("+"))) chat.name = contactName;
  else if (message.pushName && (!chat.name || chat.name.startsWith("+"))) chat.name = message.pushName;
  if (!chat.messages.some((item) => item.id === messageId)) {
    chat.messages.push({
      id: messageId,
      role: message.key.fromMe ? "sales" : "customer",
      body,
      timestamp,
    });
  }
  if (chat.messages.length > 30) chat.messages = chat.messages.slice(-30);
  memoryStore.chats.set(jid, chat);
}

function hasRegisteredCreds() {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (!fs.existsSync(credsPath)) return false;
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    return Boolean(creds?.me?.id);
  } catch {
    return false;
  }
}

function getRegisteredPhoneAndName() {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (!fs.existsSync(credsPath)) return null;
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    if (creds?.me?.id) {
      return {
        phone: jidToPhone(creds.me.id),
        name: creds.me.name || creds.me.notify || "Ominiflow",
      };
    }
  } catch {}
  return null;
}

function saveSessionState() {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionState, null, 2), "utf8");
  } catch (err) {
    console.error("[WA Service] Error saving session state:", err);
  }
}

function saveScrapedCache() {
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      connectedPhone: sessionState.connectedPhone,
      connectedDisplayName: sessionState.connectedDisplayName,
      contacts: Array.from(memoryStore.contacts.values()),
      chats: Array.from(memoryStore.chats.values()),
      groups: Array.from(memoryStore.groups.values()),
    };
    fs.writeFileSync(SCRAPED_CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.error("[WA Service] Error saving scraped cache:", err);
  }
}

function loadScrapedCache() {
  try {
    if (fs.existsSync(SCRAPED_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SCRAPED_CACHE_FILE, "utf8"));
      if (Array.isArray(data.contacts)) {
        for (const c of data.contacts) {
          if (c.jid) memoryStore.contacts.set(c.jid, c);
        }
      }
      if (Array.isArray(data.chats)) {
        for (const ch of data.chats) {
          if (ch.jid) {
            const resolved = jidToPhone(ch.jid);
            if (resolved && (!ch.phone || ch.phone.startsWith("+92642") || ch.jid.endsWith("@lid"))) {
              ch.phone = resolved;
            }
            const name = getContactNameForPhone(ch.phone, ch.jid);
            if (name && (!ch.name || ch.name.startsWith("+") || ch.name.includes("deviceId"))) ch.name = name;
            else if (!ch.name || ch.name.startsWith("+") || ch.name.length > 13) ch.name = ch.phone;
            memoryStore.chats.set(ch.jid, ch);
          }
        }
      }
      if (Array.isArray(data.groups)) {
        for (const g of data.groups) {
          if (g.groupJid) memoryStore.groups.set(g.groupJid, g);
        }
      }
      sessionState.stats.totalContacts = memoryStore.contacts.size;
      sessionState.stats.totalChats = memoryStore.chats.size;
      sessionState.stats.totalGroups = memoryStore.groups.size;
    }
  } catch {}
}

function loadSavedSessionState() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
      if (data && typeof data === "object") {
        sessionState = { ...sessionState, ...data };
      }
    }
  } catch {}

  const reg = getRegisteredPhoneAndName();
  if (reg || (sessionState.connectedPhone && sessionState.connectedPhone.length > 5)) {
    sessionState.status = "CONNECTED";
    sessionState.connectedPhone = reg?.phone || sessionState.connectedPhone || "";
    sessionState.connectedDisplayName = reg?.name || sessionState.connectedDisplayName || "";
    sessionState.qrCodeDataUrl = "";
    sessionState.qrRaw = "";
    sessionState.pairingCode = "";
  }
}

loadSavedSessionState();
loadScrapedCache();

let isStarting = false;
let reconnectTimer = null;

async function startWhatsAppSocket(forceNew = false) {
  const isRegistered = hasRegisteredCreds();
  if (isRegistered) {
    sessionState.status = "CONNECTED";
    const reg = getRegisteredPhoneAndName();
    if (reg?.phone) sessionState.connectedPhone = reg.phone;
    if (reg?.name) sessionState.connectedDisplayName = reg.name;
    sessionState.qrCodeDataUrl = "";
    sessionState.qrRaw = "";
  }

  if (sock && sessionState.status === "CONNECTED" && !forceNew) {
    return sessionState;
  }
  if (isStarting) {
    return sessionState;
  }
  isStarting = true;

  try {
    if (forceNew && sock) {
      try {
        sock.end(undefined);
      } catch {}
      sock = null;
    }

    if (!isRegistered) {
      sessionState.status = "CONNECTING";
    }
    sessionState.lastError = null;
    sessionState.pairingCode = "";
    saveSessionState();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));

    const logger = pino({ level: "silent" });

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: Browsers.macOS("Chrome"),
      syncFullHistory: true,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (hasRegisteredCreds()) {
          console.log("[WA Service] Skipping QR because session is already authenticated to", sessionState.connectedPhone);
          sessionState.status = "CONNECTED";
          sessionState.qrCodeDataUrl = "";
          sessionState.qrRaw = "";
          saveSessionState();
          return;
        }

        console.log("[WA Service] Live WhatsApp Multi-Device QR Code generated.");
        sessionState.status = "QR_READY";
        sessionState.qrRaw = qr;
        sessionState.qrGeneratedAt = new Date().toISOString();
        try {
          sessionState.qrCodeDataUrl = await qrcode.toDataURL(qr, {
            margin: 2,
            width: 320,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
          });
        } catch (qrErr) {
          console.error("[WA Service] QR conversion error:", qrErr);
        }
        saveSessionState();
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || "Connection closed";
        console.log(`[WA Service] Connection closed. Status: ${statusCode}, Reason: ${reason}`);

        // Never wipe AUTH_DIR on connection close. Only explicit /disconnect should do that!
        const hasAuth = hasRegisteredCreds() || Boolean(sessionState.connectedPhone);
        if (hasAuth) {
          sessionState.status = "CONNECTED"; // keep connected for the dashboard!
        } else {
          sessionState.status = "DISCONNECTED";
        }
        sessionState.lastError = reason;
        saveSessionState();
        sock = null;

        console.log("[WA Service] Auto-reconnecting WhatsApp socket in 3 seconds...");
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          startWhatsAppSocket(false).catch(console.error);
        }, 3000);
      } else if (connection === "open") {
        console.log("[WA Service] WhatsApp connected successfully!");
        sessionState.status = "CONNECTED";
        sessionState.qrCodeDataUrl = "";
        sessionState.qrRaw = "";
        sessionState.pairingCode = "";
        sessionState.connectedAt = sessionState.connectedAt || new Date().toISOString();

        const userJid = sock.user?.id || "";
        sessionState.connectedPhone = jidToPhone(userJid) || sessionState.connectedPhone || "";
        sessionState.connectedDisplayName = sock.user?.name || sock.user?.notify || sessionState.connectedDisplayName || "";

        try {
          const biz = await sock.getBusinessProfile(userJid).catch(() => null);
          if (biz?.description) {
            sessionState.connectedDisplayName = `${sock.user?.name || "Ominiflow"} (${biz.description.slice(0, 30)})`;
          }
        } catch {}

        try {
          await saveCreds();
        } catch (e) {
          console.error("[WA Service] Error saving credentials on open:", e);
        }

        saveSessionState();
        saveScrapedCache();
        fetchAndCacheGroups().catch(console.error);
      }
    });

    // Initial messaging history sync (fires on login or reconnect)
    sock.ev.on("messaging-history.set", ({ chats, contacts, messages }) => {
      console.log(`[WA Service] Received messaging history sync: ${contacts?.length || 0} contacts, ${chats?.length || 0} chats, ${messages?.length || 0} messages`);
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          if (!c.id || c.id.endsWith("@g.us")) continue;
          const phone = jidToPhone(c.id);
          const name = c.name || c.notify || c.verifiedName || phone;
          memoryStore.contacts.set(c.id, {
            jid: c.id,
            phone,
            name,
            verifiedName: c.verifiedName || null,
          });
        }
      }
      if (Array.isArray(chats)) {
        for (const ch of chats) {
          if (!ch.id || ch.id.endsWith("@g.us")) continue;
          const phone = jidToPhone(ch.id);
          const contactName = getContactNameForPhone(phone, ch.id);
          const cleanName = contactName || (ch.name && !ch.name.startsWith("+") ? ch.name : "") || phone;
          const existing = memoryStore.chats.get(ch.id) || {
            jid: ch.id,
            phone,
            name: cleanName,
            unreadCount: ch.unreadCount || 0,
            lastMessageAt: new Date(ch.conversationTimestamp ? ch.conversationTimestamp * 1000 : Date.now()).toISOString(),
            lastMessagePreview: "Recent WhatsApp message",
            messages: [],
          };
          if (contactName && (!existing.name || existing.name.startsWith("+"))) {
            existing.name = contactName;
          }
          existing.phone = phone;
          memoryStore.chats.set(ch.id, existing);
        }
      }
      if (Array.isArray(messages)) {
        for (const message of messages) appendWhatsAppMessage(message);
      }
      sessionState.stats.totalContacts = memoryStore.contacts.size;
      sessionState.stats.totalChats = memoryStore.chats.size;
      saveSessionState();
      saveScrapedCache();
    });

    // Listen to contacts upsert
    sock.ev.on("contacts.upsert", (newContacts) => {
      for (const c of newContacts) {
        if (!c.id || c.id.endsWith("@g.us")) continue;
        const phone = jidToPhone(c.id);
        const name = c.name || c.notify || c.verifiedName || phone;
        memoryStore.contacts.set(c.id, {
          jid: c.id,
          phone,
          name,
          verifiedName: c.verifiedName || null,
        });

        // Upgrade corresponding chat name in memoryStore.chats if real name
        if (name && !name.startsWith("+") && !name.startsWith("@") && !name.includes("deviceId")) {
          const chat = memoryStore.chats.get(c.id);
          if (chat && (!chat.name || chat.name.startsWith("+") || chat.name.includes("deviceId"))) {
            chat.name = name;
          }
        }
      }
      sessionState.stats.totalContacts = memoryStore.contacts.size;
      saveSessionState();
      saveScrapedCache();
    });

    // Listen to chats upsert
    sock.ev.on("chats.upsert", (newChats) => {
      for (const ch of newChats) {
        if (!ch.id || ch.id.endsWith("@g.us")) continue;
        const phone = jidToPhone(ch.id);
        const contactName = getContactNameForPhone(phone, ch.id);
        const cleanName = contactName || (ch.name && !ch.name.startsWith("+") ? ch.name : "") || phone;
        const existing = memoryStore.chats.get(ch.id) || {
          jid: ch.id,
          phone,
          name: cleanName,
          unreadCount: ch.unreadCount || 0,
          lastMessageAt: new Date(ch.conversationTimestamp ? ch.conversationTimestamp * 1000 : Date.now()).toISOString(),
          lastMessagePreview: "Recent WhatsApp message",
          messages: [],
        };
        existing.phone = phone;
        if (contactName && (!existing.name || existing.name.startsWith("+"))) {
          existing.name = contactName;
        }
        existing.unreadCount = ch.unreadCount ?? existing.unreadCount;
        memoryStore.chats.set(ch.id, existing);
      }
      sessionState.stats.totalChats = memoryStore.chats.size;
      saveSessionState();
      saveScrapedCache();
    });


async function dispatchInboundMessageToCrm(m) {
  try {
    if (!m?.key?.remoteJid || m.key.remoteJid.endsWith("@g.us")) return;
    const jid = m.key.remoteJid;
    const body =
      m.message?.conversation ||
      m.message?.extendedTextMessage?.text ||
      m.message?.imageMessage?.caption ||
      (m.message?.imageMessage ? "[Photo]" : "") ||
      (m.message?.documentMessage ? "[Document]" : "");
    if (!body) return;

    const phone = jidToPhone(jid);
    if (!phone || phone.length < 10) return;
    const name = getContactNameForPhone(phone) || m.pushName || phone;
    const timestamp = new Date(m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now()).toISOString();
    const role = m.key.fromMe ? "sales" : "customer";
    const externalMessageId = m.key.id || `wa-${Date.now()}`;

    const crmPort = process.env.CRM_PORT || 3050;
    const payload = JSON.stringify({
      action: "inbound_event",
      sessionKey,
      connectedPhone: sessionState.connectedPhone,
      message: {
        phone,
        name,
        role,
        body,
        externalMessageId,
        timestamp,
      },
    });

    const req = http.request({
      hostname: "127.0.0.1",
      port: crmPort,
      path: "/api/sales/whatsapp-scanner",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "x-internal-wa-token": sessionKey,
      },
      timeout: 3000,
    }, (res) => {
      res.resume();
    });
    req.on("error", () => {});
    req.write(payload);
    req.end();
  } catch (err) {}
}

    // Listen to messages upsert
    sock.ev.on("messages.upsert", ({ messages }) => {
      for (const m of messages) {
        appendWhatsAppMessage(m);
        dispatchInboundMessageToCrm(m).catch(() => {});
      }
      sessionState.stats.totalChats = memoryStore.chats.size;
      saveSessionState();
      saveScrapedCache();
    });

  } catch (err) {
    console.error("[WA Service] Error in startWhatsAppSocket:", err);
    if (!hasRegisteredCreds()) {
      sessionState.status = "DISCONNECTED";
    }
    sessionState.lastError = err.message || String(err);
    saveSessionState();
  } finally {
    isStarting = false;
  }

  return sessionState;
}

async function fetchAndCacheGroups() {
  if (!sock || !sock.user?.id) return Array.from(memoryStore.groups.values());
  try {
    const groupsData = await sock.groupFetchAllParticipating();
    const result = [];
    for (const [groupJid, group] of Object.entries(groupsData)) {
      const participants = (group.participants || []).map((p) => ({
        phone: jidToPhone(p.id),
        name: p.notify || jidToPhone(p.id),
        isAdmin: p.admin === "admin" || p.admin === "superadmin",
      })).filter((p) => Boolean(p.phone));

      const groupObj = {
        groupJid,
        subject: group.subject || "WhatsApp Group",
        participantCount: participants.length,
        participants,
      };
      memoryStore.groups.set(groupJid, groupObj);
      result.push(groupObj);
    }
    sessionState.stats.totalGroups = memoryStore.groups.size;
    saveSessionState();
    saveScrapedCache();
    return result;
  } catch (err) {
    console.error("[WA Service] Error fetching groups:", err);
    return Array.from(memoryStore.groups.values());
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const sendJson = (status, payload) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  };

  const readBody = async () => {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  };

  try {
    if (pathname === "/health") {
      return sendJson(200, { ok: true, uptime: process.uptime(), status: sessionState.status });
    }

    if (pathname === "/status") {
      if (hasRegisteredCreds()) {
        sessionState.status = "CONNECTED";
        const reg = getRegisteredPhoneAndName();
        if (reg?.phone) sessionState.connectedPhone = reg.phone;
        if (reg?.name && !sessionState.connectedDisplayName) sessionState.connectedDisplayName = reg.name;
        sessionState.qrCodeDataUrl = "";
        sessionState.qrRaw = "";
      }
      return sendJson(200, { ok: true, scanner: sessionState });
    }

    if (pathname === "/start" && req.method === "POST") {
      const body = await readBody();
      if (body.accountType) sessionState.accountType = body.accountType;
      if (body.syncMode) sessionState.syncMode = body.syncMode;

      // If already registered, do not force new QR!
      if (hasRegisteredCreds()) {
        sessionState.status = "CONNECTED";
        const reg = getRegisteredPhoneAndName();
        if (reg?.phone) sessionState.connectedPhone = reg.phone;
        if (reg?.name) sessionState.connectedDisplayName = reg.name;
        sessionState.qrCodeDataUrl = "";
        sessionState.qrRaw = "";
        saveSessionState();
        if (!sock) {
          startWhatsAppSocket(false).catch(console.error);
        }
        return sendJson(200, { ok: true, scanner: sessionState });
      }

      await startWhatsAppSocket(body.forceRefresh === true);
      return sendJson(200, { ok: true, scanner: sessionState });
    }

    if (pathname === "/pairing-code" && req.method === "POST") {
      const body = await readBody();
      const phone = (body.phone || "").replace(/\D/g, "");
      if (!phone) {
        return sendJson(400, { ok: false, error: "Valid phone number required for pairing code." });
      }

      if (!sock) {
        await startWhatsAppSocket(false);
      }

      try {
        const code = await sock.requestPairingCode(phone);
        sessionState.pairingCode = code;
        saveSessionState();
        return sendJson(200, { ok: true, pairingCode: code });
      } catch (err) {
        return sendJson(500, { ok: false, error: err.message || "Failed to generate pairing code" });
      }
    }

    if (pathname === "/disconnect" && req.method === "POST") {
      if (sock) {
        try {
          await sock.logout();
        } catch {}
        try {
          sock.end(undefined);
        } catch {}
        sock = null;
      }
      try {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      } catch {}

      sessionState = {
        ...sessionState,
        status: "DISCONNECTED",
        qrCodeDataUrl: "",
        qrRaw: "",
        pairingCode: "",
        connectedPhone: "",
        connectedDisplayName: "",
        qrGeneratedAt: null,
        connectedAt: null,
      };
      saveSessionState();
      return sendJson(200, { ok: true, scanner: sessionState });
    }

    if (pathname === "/scrape") {
      if (sock && sessionState.status === "CONNECTED" && sock.user?.id && memoryStore.groups.size === 0) {
        fetchAndCacheGroups().catch(() => {});
      }

      const contacts = Array.from(memoryStore.contacts.values());
      const chats = Array.from(memoryStore.chats.values());
      const groups = Array.from(memoryStore.groups.values());

      for (const ch of chats) {
        if (!ch.phone || ch.phone.startsWith("+92642") || ch.phone.length > 13 || ch.jid.endsWith("@lid")) {
          const resolved = jidToPhone(ch.jid);
          if (resolved) ch.phone = resolved;
        }
        const name = getContactNameForPhone(ch.phone, ch.jid);
        if (name && (!ch.name || ch.name.startsWith("+") || ch.name.includes("deviceId"))) {
          ch.name = name;
        } else if (!ch.name || ch.name.startsWith("+") || ch.name.length > 13) {
          ch.name = ch.phone;
        }
      }

      return sendJson(200, {
        ok: true,
        status: hasRegisteredCreds() ? "CONNECTED" : sessionState.status,
        connectedPhone: sessionState.connectedPhone || "",
        connectedDisplayName: sessionState.connectedDisplayName || "",
        accountType: sessionState.accountType,
        totalContacts: contacts.length,
        totalChats: chats.length,
        totalGroups: groups.length,
        contacts,
        chats,
        groups,
      });
    }

    if (pathname === "/send" && req.method === "POST") {
      const body = await readBody();
      const to = String(body.to || "").replace(/\D/g, "");
      const text = String(body.body || "").trim();
      if (!to || !text) {
        return sendJson(400, { ok: false, error: "Recipient and message are required." });
      }
      if (!sock || sessionState.status !== "CONNECTED" || !sock.user?.id) {
        return sendJson(409, { ok: false, error: "The linked WhatsApp device is not connected." });
      }
      const result = await sock.sendMessage(`${to}@s.whatsapp.net`, { text });
      const messageId = result?.key?.id || "";
      if (!messageId) return sendJson(502, { ok: false, error: "WhatsApp did not return a message id." });
      appendWhatsAppMessage(result);
      saveScrapedCache();
      return sendJson(200, { ok: true, messageId });
    }

    return sendJson(404, { ok: false, error: "Endpoint not found" });
  } catch (err) {
    console.error("[WA Service] Handler error:", err);
    return sendJson(500, { ok: false, error: err.message || "Internal error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[WA Service] WhatsApp Baileys daemon running at http://127.0.0.1:${PORT}`);
  if (hasRegisteredCreds()) {
    console.log(`[WA Service] Found existing WhatsApp session for ${sessionKey}, auto-connecting socket...`);
    startWhatsAppSocket(false).catch(console.error);
  }
});
