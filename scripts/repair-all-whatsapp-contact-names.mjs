import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const sessionKey = "3473ea212886cdcb";
const sessionDir = path.join(process.cwd(), ".gigxomi", "wa-sessions", sessionKey);
const cachePath = path.join(sessionDir, "scraped-cache.json");
const authDir = path.join(sessionDir, "auth");
const scannerStorePath = path.join(process.cwd(), ".gigxomi", "whatsapp-scanner-store.json");
const platformStorePath = path.join(process.cwd(), ".gigxomi", "local-platform-store.json");

const pool = new pg.Pool({
  connectionString: "postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public",
});

function isGoodName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (trimmed.startsWith("+") || trimmed.startsWith("@")) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (trimmed.includes("deviceId") || trimmed.includes("WhatsApp Contact")) return false;
  return true;
}

function cleanPhoneDisplay(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "WhatsApp Contact";
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.startsWith("91") && digits.length === 12) {
    const d = digits.slice(2);
    return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  }
  return `+${digits}`;
}

async function main() {
  console.log("=== COMPREHENSIVE WHATSAPP CONTACT & NAME REPAIR ===");

  if (!fs.existsSync(cachePath)) {
    throw new Error(`Cache not found at ${cachePath}`);
  }

  // 1. Build LID <-> Phone Map
  console.log("[1/6] Loading LID <-> Phone mappings from auth store...");
  const lidToPhone = new Map();
  const phoneToLid = new Map();
  if (fs.existsSync(authDir)) {
    const files = fs.readdirSync(authDir);
    for (const f of files) {
      if (f.startsWith("lid-mapping-") && f.endsWith("_reverse.json")) {
        const lid = f.slice(12, -13);
        try {
          const val = JSON.parse(fs.readFileSync(path.join(authDir, f), "utf8"));
          const digits = String(val).replace(/\D/g, "");
          if (digits) {
            lidToPhone.set(lid, `+${digits}`);
            phoneToLid.set(digits.slice(-10), lid);
          }
        } catch {}
      } else if (f.startsWith("lid-mapping-") && f.endsWith(".json")) {
        const phone = f.slice(12, -5).replace(/\D/g, "");
        try {
          const val = JSON.parse(fs.readFileSync(path.join(authDir, f), "utf8"));
          const lidDigits = String(val).replace(/\D/g, "");
          if (lidDigits && phone) {
            lidToPhone.set(lidDigits, `+${phone}`);
            phoneToLid.set(phone.slice(-10), lidDigits);
          }
        } catch {}
      }
    }
  }
  console.log(`Loaded ${lidToPhone.size} bidirectional LID mappings.`);

  // 2. Load Scraped Cache and Build Master Contact Name Index
  console.log("[2/6] Building Master Contact Name Index from scraped cache...");
  const cacheData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  const nameByPhone10 = new Map();
  const nameByLid = new Map();

  for (const c of cacheData.contacts || []) {
    // Resolve LID phone if needed
    if (c.jid?.endsWith("@lid")) {
      const lid = c.jid.split("@")[0].replace(/\D/g, "");
      const mapped = lidToPhone.get(lid);
      if (mapped) c.phone = mapped;
    }
    const name = c.name || c.notify || c.verifiedName;
    if (isGoodName(name)) {
      if (c.phone) {
        const p10 = c.phone.replace(/\D/g, "").slice(-10);
        if (p10) nameByPhone10.set(p10, name);
      }
      if (c.jid) {
        const jDigits = c.jid.split("@")[0].replace(/\D/g, "");
        if (c.jid.endsWith("@lid")) {
          nameByLid.set(jDigits, name);
          const mapped = lidToPhone.get(jDigits);
          if (mapped) {
            const p10 = mapped.replace(/\D/g, "").slice(-10);
            if (p10 && !nameByPhone10.has(p10)) nameByPhone10.set(p10, name);
          }
        } else if (jDigits.length >= 10) {
          nameByPhone10.set(jDigits.slice(-10), name);
        }
      }
    }
  }

  // Also index from chats
  for (const ch of cacheData.chats || []) {
    if (ch.jid?.endsWith("@lid")) {
      const lid = ch.jid.split("@")[0].replace(/\D/g, "");
      const mapped = lidToPhone.get(lid);
      if (mapped) ch.phone = mapped;
    }
    if (isGoodName(ch.name)) {
      if (ch.phone) {
        const p10 = ch.phone.replace(/\D/g, "").slice(-10);
        if (p10 && !nameByPhone10.has(p10)) nameByPhone10.set(p10, ch.name);
      }
      if (ch.jid?.endsWith("@lid")) {
        const jDigits = ch.jid.split("@")[0].replace(/\D/g, "");
        if (!nameByLid.has(jDigits)) nameByLid.set(jDigits, ch.name);
      }
    }
    // Check pushName in messages
    for (const m of ch.messages || []) {
      if (m.pushName && isGoodName(m.pushName)) {
        if (ch.phone) {
          const p10 = ch.phone.replace(/\D/g, "").slice(-10);
          if (p10 && !nameByPhone10.has(p10)) nameByPhone10.set(p10, m.pushName);
        }
      }
    }
  }

  console.log(`Master index has ${nameByPhone10.size} phone names and ${nameByLid.size} LID names.`);

  // Resolve helper
  function resolveContactName(phone, jidOrLid, currentName) {
    if (isGoodName(currentName)) return currentName;

    const p10 = (phone || "").replace(/\D/g, "").slice(-10);
    const lid = (jidOrLid || "").split("@")[0].replace(/\D/g, "");

    if (p10 && nameByPhone10.has(p10)) return nameByPhone10.get(p10);
    if (lid && nameByLid.has(lid)) return nameByLid.get(lid);
    if (lid && lidToPhone.has(lid)) {
      const mappedP10 = lidToPhone.get(lid).replace(/\D/g, "").slice(-10);
      if (mappedP10 && nameByPhone10.has(mappedP10)) return nameByPhone10.get(mappedP10);
    }
    if (p10 && phoneToLid.has(p10)) {
      const pLid = phoneToLid.get(p10);
      if (nameByLid.has(pLid)) return nameByLid.get(pLid);
    }
    return null;
  }

  // 3. Update scraped-cache.json
  console.log("[3/6] Updating scraped-cache.json...");
  let cacheChatsUpdated = 0;
  for (const ch of cacheData.chats || []) {
    if (ch.jid?.endsWith("@lid")) {
      const lid = ch.jid.split("@")[0].replace(/\D/g, "");
      const mapped = lidToPhone.get(lid);
      if (mapped) ch.phone = mapped;
    }
    const resolved = resolveContactName(ch.phone, ch.jid, ch.name);
    if (resolved) {
      ch.name = resolved;
      cacheChatsUpdated++;
    } else if (!ch.name || ch.name.startsWith("+") || ch.name.length > 13) {
      ch.name = ch.phone || "WhatsApp Contact";
    }
  }
  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf8");
  console.log(`Updated scraped-cache.json: ${cacheChatsUpdated} chats assigned real names.`);

  // 4. Update whatsapp-scanner-store.json
  console.log("[4/6] Updating whatsapp-scanner-store.json...");
  if (fs.existsSync(scannerStorePath)) {
    const scannerStore = JSON.parse(fs.readFileSync(scannerStorePath, "utf8"));
    for (const tenantKey of Object.keys(scannerStore)) {
      const st = scannerStore[tenantKey];
      if (Array.isArray(st.discoveredChats)) {
        for (const ch of st.discoveredChats) {
          if (ch.jid?.endsWith("@lid")) {
            const lid = ch.jid.split("@")[0].replace(/\D/g, "");
            const mapped = lidToPhone.get(lid);
            if (mapped) ch.phone = mapped;
          }
          const resolved = resolveContactName(ch.phone, ch.jid, ch.name);
          if (resolved) ch.name = resolved;
          else if (!ch.name || ch.name.startsWith("+") || ch.name.length > 13) {
            ch.name = ch.phone || "WhatsApp Contact";
          }
        }
      }
    }
    fs.writeFileSync(scannerStorePath, JSON.stringify(scannerStore, null, 2), "utf8");
    console.log("Updated whatsapp-scanner-store.json on disk.");
  }

  // 5. Update local-platform-store.json (Conversations)
  console.log("[5/6] Updating local-platform-store.json conversations...");
  let platformStoreUpdated = 0;
  if (fs.existsSync(platformStorePath)) {
    const platformStore = JSON.parse(fs.readFileSync(platformStorePath, "utf8"));
    for (const conv of platformStore.conversations || []) {
      // Resolve phone if it was a raw LID
      const cleanDigits = (conv.customerPhone || "").replace(/\D/g, "");
      if (cleanDigits.length > 12 && lidToPhone.has(cleanDigits)) {
        conv.customerPhone = lidToPhone.get(cleanDigits);
      }

      const resolved = resolveContactName(conv.customerPhone, conv.customerName, conv.customerName);
      if (resolved) {
        conv.customerName = resolved;
        conv.title = resolved;
        platformStoreUpdated++;
      } else if (!conv.customerName || conv.customerName.startsWith("+") || conv.customerName.includes("deviceId")) {
        // Format as clean phone number instead of raw LID
        const cleanDisplay = cleanPhoneDisplay(conv.customerPhone);
        conv.customerName = cleanDisplay;
        conv.title = cleanDisplay;
      }

      // Update message sender names if customer
      for (const m of conv.messages || []) {
        if (m.senderRole === "customer" && (!m.senderName || m.senderName.startsWith("+") || m.senderName.includes("deviceId"))) {
          m.senderName = conv.customerName;
        }
      }
    }
    fs.writeFileSync(platformStorePath, JSON.stringify(platformStore, null, 2), "utf8");
    console.log(`Updated local-platform-store.json: ${platformStoreUpdated} conversations now have human names.`);
  }

  // 6. Update PostgreSQL Database (MarketingContact, Lead)
  console.log("[6/6] Updating PostgreSQL database records...");
  const mcRows = await pool.query(`SELECT id, "tenantId", "fullName", "e164Phone" FROM "MarketingContact"`);
  let dbMcNameUpdated = 0;
  let dbMcPhoneUpdated = 0;

  for (const mc of mcRows.rows) {
    let currentPhone = mc.e164Phone;
    const phoneDigits = (currentPhone || "").replace(/\D/g, "");
    let phoneUpdated = false;

    // Check if e164Phone is actually an LID
    if (phoneDigits.length > 12 && lidToPhone.has(phoneDigits)) {
      const realPhone = lidToPhone.get(phoneDigits);
      // Check if realPhone already exists for this tenant
      const existing = await pool.query(
        `SELECT id FROM "MarketingContact" WHERE "tenantId" = $1 AND "e164Phone" = $2 AND id != $3`,
        [mc.tenantId, realPhone, mc.id]
      );
      if (existing.rows.length === 0) {
        await pool.query(`UPDATE "MarketingContact" SET "e164Phone" = $1 WHERE id = $2`, [realPhone, mc.id]);
        currentPhone = realPhone;
        dbMcPhoneUpdated++;
        phoneUpdated = true;
      }
    }

    const resolved = resolveContactName(currentPhone, mc.fullName, mc.fullName);
    if (resolved && resolved !== mc.fullName) {
      await pool.query(`UPDATE "MarketingContact" SET "fullName" = $1 WHERE id = $2`, [resolved, mc.id]);
      dbMcNameUpdated++;
    } else if (!mc.fullName || mc.fullName.startsWith("+")) {
      const cleanDisplay = cleanPhoneDisplay(currentPhone);
      if (cleanDisplay !== mc.fullName) {
        await pool.query(`UPDATE "MarketingContact" SET "fullName" = $1 WHERE id = $2`, [cleanDisplay, mc.id]);
      }
    }
  }

  console.log(`Database MarketingContacts updated: ${dbMcNameUpdated} names updated, ${dbMcPhoneUpdated} phone numbers reversed from LID.`);

  await pool.end();
  console.log("=== COMPREHENSIVE REPAIR COMPLETE ===");
}

main().catch(console.error);
