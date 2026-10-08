import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { createSalesLead, getSalesSnapshotForRole, updateSalesLead, type SalesLeadStage } from "@/lib/gigxomi/sales-store";
import { listConversationsForAudienceFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { normalizeE164Phone, upsertMarketingContact } from "@/lib/whatsapp-marketing/contact-service";

export type UnifiedContactSourceCategory =
  | "WHATSAPP_SCANNER"
  | "WHATSAPP_CLOUD_API"
  | "EMAIL_ENQUIRY"
  | "SHEETS_EXCEL"
  | "INSTAGRAM_DM"
  | "SIM_MANUAL";

export type UnifiedContactItem = {
  id: string;
  leadId?: string;
  poolItemId?: string;
  marketingContactId?: string;
  conversationId?: string;
  name: string;
  phone: string;
  email: string;
  sourceRaw: string;
  sourceLabel: string;
  sourceCategory: UnifiedContactSourceCategory;
  stage: SalesLeadStage | "CONTACT";
  tags: string[];
  assignedAgentName: string;
  hasInboxThread: boolean;
  unreadCount: number;
  notes: string;
  lastActivityAt: string;
};

function classifySource(
  sourceRaw: string,
  tags: string[],
  hasConversation?: boolean,
  isInstagram?: boolean,
): { category: UnifiedContactSourceCategory; label: string } {
  const combined = `${sourceRaw} ${tags.join(" ")}`.toLowerCase();

  if (isInstagram || combined.includes("instagram") || combined.includes("ig_")) {
    return { category: "INSTAGRAM_DM", label: "Instagram DM API" };
  }
  if (
    combined.includes("scanner") ||
    combined.includes("scraper") ||
    combined.includes("wa business") ||
    combined.includes("wa personal") ||
    combined.includes("wa group") ||
    combined.includes("qr")
  ) {
    if (combined.includes("group")) {
      return { category: "WHATSAPP_SCANNER", label: "WA Group Scraper" };
    }
    if (combined.includes("personal")) {
      return { category: "WHATSAPP_SCANNER", label: "Normal WhatsApp QR" };
    }
    return { category: "WHATSAPP_SCANNER", label: "WA Business QR" };
  }
  if (
    combined.includes("gmail") ||
    combined.includes("zoho") ||
    combined.includes("godaddy") ||
    combined.includes("imap") ||
    combined.includes("smtp") ||
    combined.includes("email") ||
    combined.includes("indiamart")
  ) {
    if (combined.includes("zoho")) return { category: "EMAIL_ENQUIRY", label: "Zoho Mail Enquiry" };
    if (combined.includes("godaddy")) return { category: "EMAIL_ENQUIRY", label: "GoDaddy Mail Enquiry" };
    if (combined.includes("gmail")) return { category: "EMAIL_ENQUIRY", label: "Gmail Enquiry" };
    return { category: "EMAIL_ENQUIRY", label: "Email / SMTP Enquiry" };
  }
  if (
    combined.includes("google_sheet") ||
    combined.includes("googlesheet") ||
    combined.includes("sheet") ||
    combined.includes("excel") ||
    combined.includes("xlsx") ||
    combined.includes("csv") ||
    combined.includes("contact_import") ||
    combined.includes("file")
  ) {
    if (combined.includes("sheet")) return { category: "SHEETS_EXCEL", label: "Google Sheets Sync" };
    return { category: "SHEETS_EXCEL", label: "Excel / CSV Import" };
  }
  if (combined.includes("whatsapp") || combined.includes("waba") || combined.includes("cloud") || hasConversation) {
    return { category: "WHATSAPP_CLOUD_API", label: "WhatsApp Cloud API" };
  }
  return { category: "SIM_MANUAL", label: "CRM / SIM Dialer" };
}

function phoneKey(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  const [salesSnapshot, marketingContacts, inboxPayload] = await Promise.all([
    getSalesSnapshotForRole(auth.session),
    prisma.marketingContact.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
    listConversationsForAudienceFromFile("sales", { tenantId, limit: 300 }).catch(() => ({
      conversations: [],
    })),
  ]);

  const agentsById = new Map(salesSnapshot.agents.map((a) => [a.id, a.displayName]));
  const unifiedMap = new Map<string, UnifiedContactItem>();
  const openPoolByPhone = new Map(
    salesSnapshot.visibleLeadPool
      .filter((item) => item.status === "OPEN")
      .map((item) => [phoneKey(item.customerPhone), item.id] as const)
      .filter(([phone]) => phone),
  );
  const openPoolByEmail = new Map(
    salesSnapshot.visibleLeadPool
      .filter((item) => item.status === "OPEN" && item.customerEmail)
      .map((item) => [item.customerEmail.trim().toLowerCase(), item.id] as const),
  );

  // 1. Seed from SalesLeadAssignment (CRM Pipeline Leads)
  for (const lead of salesSnapshot.visibleLeads) {
    const pKey = phoneKey(lead.customerPhone);
    const eKey = (lead.customerEmail || "").trim().toLowerCase();
    const mapKey = pKey ? `phone:${pKey}` : eKey ? `email:${eKey}` : `lead:${lead.id}`;
    const normPhone = normalizeE164Phone(lead.customerPhone);
    const displayPhone = normPhone.valid ? normPhone.e164 : lead.customerPhone || "";
    const { category, label } = classifySource(lead.source || "", lead.tags || []);

    unifiedMap.set(mapKey, {
      id: lead.id,
      leadId: lead.id,
      poolItemId: openPoolByPhone.get(pKey) || openPoolByEmail.get(eKey),
      conversationId: lead.conversationId || undefined,
      name: lead.customerName || displayPhone || eKey || "Unnamed Contact",
      phone: displayPhone,
      email: lead.customerEmail || "",
      sourceRaw: lead.source || "manual",
      sourceLabel: label,
      sourceCategory: category,
      stage: lead.stage,
      tags: Array.from(new Set(lead.tags || [])),
      assignedAgentName: (lead.assignedAgentId && agentsById.get(lead.assignedAgentId)) || "Assigned Rep",
      hasInboxThread: Boolean(lead.conversationId),
      unreadCount: 0,
      notes: lead.notes || "",
      lastActivityAt: lead.updatedAt || lead.createdAt,
    });
  }

  // 2. Merge from MarketingContact (WhatsApp Scraper, Bulk Imports, Opt-in Directory)
  for (const mc of marketingContacts) {
    const pKey = phoneKey(mc.e164Phone);
    const eKey = (mc.email || "").trim().toLowerCase();
    const mapKey = pKey ? `phone:${pKey}` : eKey ? `email:${eKey}` : `mc:${mc.id}`;
    const existing = unifiedMap.get(mapKey);
    const { category, label } = classifySource(mc.optInSource || "", mc.tags || []);

    if (existing) {
      existing.marketingContactId = mc.id;
      existing.poolItemId = existing.poolItemId || openPoolByPhone.get(pKey) || openPoolByEmail.get(eKey);
      if (!existing.email && mc.email) existing.email = mc.email;
      if (!existing.phone && mc.e164Phone) existing.phone = mc.e164Phone;
      existing.tags = Array.from(new Set([...existing.tags, ...(mc.tags || [])]));
      if (existing.sourceCategory === "SIM_MANUAL" && category !== "SIM_MANUAL") {
        existing.sourceCategory = category;
        existing.sourceLabel = label;
      }
    } else {
      unifiedMap.set(mapKey, {
        id: mc.id,
        marketingContactId: mc.id,
        poolItemId: openPoolByPhone.get(pKey) || openPoolByEmail.get(eKey),
        name: mc.fullName || mc.e164Phone,
        phone: mc.e164Phone,
        email: mc.email || "",
        sourceRaw: mc.optInSource || "marketing_contact",
        sourceLabel: label,
        sourceCategory: category,
        stage: "NEW",
        tags: Array.from(new Set(mc.tags || [])),
        assignedAgentName: salesSnapshot.currentAgent?.displayName || "Team Pool",
        hasInboxThread: false,
        unreadCount: 0,
        notes: "",
        lastActivityAt: mc.updatedAt.toISOString(),
      });
    }
  }

  // 3. Merge from Live Multi-Channel Chat (AppConversation)
  for (const conv of inboxPayload.conversations ?? []) {
    const rawPhone = conv.customerPhoneDisplay || "";
    const pKey = phoneKey(rawPhone);
    const mapKey = pKey ? `phone:${pKey}` : `conv:${conv.id}`;
    const isIg =
      conv.sourceChannel === "instagram" ||
      conv.serviceId === "svc-instagram-inbox" ||
      String(conv.contactId ?? "").startsWith("ig-");
    const normPhone = normalizeE164Phone(rawPhone);
    const displayPhone = normPhone.valid ? normPhone.e164 : rawPhone;
    const existing = unifiedMap.get(mapKey);
    const activityTimestamp = conv.updatedAt || conv.lastCustomerActivityAt || new Date().toISOString();

    if (existing) {
      existing.conversationId = conv.id;
      existing.hasInboxThread = true;
      existing.unreadCount = conv.unreadCount || 0;
      if (activityTimestamp > existing.lastActivityAt) {
        existing.lastActivityAt = activityTimestamp;
      }
    } else {
      const { category, label } = classifySource(conv.serviceTitle || "whatsapp", [], true, isIg);
      unifiedMap.set(mapKey, {
        id: conv.id,
        conversationId: conv.id,
        name: conv.customerDisplayName || displayPhone || "Inbox Contact",
        phone: displayPhone,
        email: "",
        sourceRaw: isIg ? "instagram_dm" : "whatsapp_inbox",
        sourceLabel: label,
        sourceCategory: category,
        stage: "CONTACTED",
        tags: [isIg ? "Instagram DM" : "WhatsApp Inbox"],
        assignedAgentName: conv.ownerName || "Inbox Queue",
        hasInboxThread: true,
        unreadCount: conv.unreadCount || 0,
        notes: conv.internalNotes || conv.summary || "",
        lastActivityAt: activityTimestamp,
      });
    }
  }

  const allContacts = Array.from(unifiedMap.values()).sort((a, b) =>
    b.lastActivityAt.localeCompare(a.lastActivityAt),
  );

  const countsByCategory: Record<UnifiedContactSourceCategory | "ALL", number> = {
    ALL: allContacts.length,
    WHATSAPP_SCANNER: 0,
    WHATSAPP_CLOUD_API: 0,
    EMAIL_ENQUIRY: 0,
    SHEETS_EXCEL: 0,
    INSTAGRAM_DM: 0,
    SIM_MANUAL: 0,
  };

  for (const c of allContacts) {
    countsByCategory[c.sourceCategory] = (countsByCategory[c.sourceCategory] || 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    total: allContacts.length,
    countsByCategory,
    contacts: allContacts,
  });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    tenantId?: string;
    contacts?: Array<{
      name?: string;
      phone?: string;
      email?: string;
      source?: string;
      stage?: SalesLeadStage;
      tags?: string[];
      notes?: string;
    }>;
    rawText?: string;
    sourceLabel?: string;
    preview?: boolean;
  };

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId);
  const snapshot = await getSalesSnapshotForRole(auth.session);
  const fallbackAgent =
    snapshot.currentAgent ??
    snapshot.agents.find((a) => a.status === "ACTIVE") ??
    snapshot.agents[0] ??
    null;

  const itemsToImport = [...(body.contacts || [])];

  // Parse rawText if provided (supports "Name, Phone, Email" or one phone per line)
  if (body.rawText?.trim()) {
    const lines = body.rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      if (/^(name|full name|phone|mobile)\b/i.test(line) && line.includes(",")) continue; // header row
      const parts = line.split(/[,\t;|]/).map((p) => p.trim());
      if (parts.length >= 2) {
        const phoneCandidate = parts.find((p) => p.replace(/\D/g, "").length >= 8) || parts[1];
        const emailCandidate = parts.find((p) => p.includes("@")) || "";
        const nameCandidate = parts.find((p) => p !== phoneCandidate && p !== emailCandidate) || phoneCandidate;
        itemsToImport.push({
          name: nameCandidate,
          phone: phoneCandidate,
          email: emailCandidate,
          source: body.sourceLabel || "bulk_paste_import",
          tags: ["Bulk Paste Import"],
        });
      } else {
        itemsToImport.push({
          name: `Contact ${parts[0].slice(-4)}`,
          phone: parts[0],
          source: body.sourceLabel || "bulk_paste_import",
          tags: ["Phone List Import"],
        });
      }
    }
  }

  if (body.preview) {
    return NextResponse.json({
      ok: true,
      preview: true,
      source: body.sourceLabel || "bulk_paste_import",
      rows: itemsToImport.slice(0, 250).map((item, index) => ({
        row: index + 1,
        customerName: String(item.name || item.phone || item.email || `Contact ${index + 1}`).trim(),
        customerPhone: String(item.phone || "").trim(),
        customerEmail: String(item.email || "").trim().toLowerCase(),
        source: String(item.source || body.sourceLabel || "bulk_paste_import"),
        tags: (item.tags || []).join(", "),
        notes: String(item.notes || ""),
      })),
      totalRows: itemsToImport.length,
      valid: itemsToImport.filter((item) => String(item.phone || "").trim() || String(item.email || "").trim()).length,
      duplicate: 0,
      skipped: itemsToImport.filter((item) => !String(item.phone || "").trim() && !String(item.email || "").trim()).length,
      invalid: 0,
    });
  }

  let imported = 0;
  let skipped = 0;

  for (const entry of itemsToImport) {
    const rawPhone = (entry.phone || "").trim();
    const rawEmail = (entry.email || "").trim().toLowerCase();
    const rawName = (entry.name || rawPhone || rawEmail || "New Contact").trim();

    if (!rawPhone && !rawEmail) {
      skipped += 1;
      continue;
    }

    if (rawPhone) {
      await upsertMarketingContact({
        tenantId,
        fullName: rawName,
        phone: rawPhone,
        email: rawEmail || undefined,
        tags: entry.tags || ["CRM Contact"],
        optInStatus: "OPTED_IN",
        optInSource: entry.source || "contacts_hub",
      });
    }

    if (fallbackAgent) {
      try {
        await createSalesLead({
          assignedAgentId: fallbackAgent.id,
          customerName: rawName,
          customerPhone: rawPhone,
          customerEmail: rawEmail,
          source: entry.source || "contacts_hub",
          serviceInterest: "Unified Contacts Directory",
          segment: "CRM Contact",
          priority: "normal",
          budgetAmount: 0,
          notes: entry.notes || "",
          tags: entry.tags || ["CRM Contact"],
          actorUserId: auth.session.userId,
        });
      } catch {
        // ignore duplicate in sales lead
      }
    }

    imported += 1;
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    message: `Successfully imported ${imported} contact${imported === 1 ? "" : "s"} into Unified Contacts & Pipeline!`,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    tenantId?: string;
    leadIds?: string[];
    marketingContactIds?: string[];
    phones?: string[];
  };
  const tenantId = resolveSessionTenantId(auth.session, body.tenantId);

  if (body.marketingContactIds?.length) {
    await prisma.marketingContact.deleteMany({
      where: { tenantId, id: { in: body.marketingContactIds } },
    });
  }
  if (body.leadIds?.length) {
    await prisma.salesLeadAssignment.deleteMany({
      where: { id: { in: body.leadIds }, assignedAgent: { user: { tenantId } } },
    });
  }

  return NextResponse.json({ ok: true, message: "Selected contacts removed." });
}

export async function PATCH(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    tenantId?: string;
    leadId?: string;
    marketingContactId?: string;
    name?: string;
    phone?: string;
    email?: string;
    tags?: string[];
    notes?: string;
  };
  const tenantId = resolveSessionTenantId(auth.session, body.tenantId);
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!name || (!phone && !email)) {
    return NextResponse.json({ ok: false, error: "Name and either a phone number or email are required." }, { status: 400 });
  }
  const normalizedPhone = phone ? normalizeE164Phone(phone) : null;
  if (phone && !normalizedPhone?.valid) {
    return NextResponse.json({ ok: false, error: "Enter a valid phone number with country code." }, { status: 422 });
  }
  const normalizedE164 = normalizedPhone?.valid ? normalizedPhone.e164 : undefined;

  let updatedLead = null;
  if (body.leadId) {
    const lead = await prisma.salesLeadAssignment.findFirst({
      where: { id: body.leadId, assignedAgent: { user: { tenantId } } },
    });
    if (!lead) return NextResponse.json({ ok: false, error: "Contact was not found in this workspace." }, { status: 404 });
    updatedLead = await updateSalesLead({
      leadId: lead.id,
      customerName: name,
      customerPhone: normalizedE164 ?? lead.customerPhone ?? undefined,
      customerEmail: email,
      tags: body.tags ?? lead.tags,
      notes: typeof body.notes === "string" ? body.notes.trim() : lead.notes ?? "",
      actorUserId: auth.session.userId,
    });
  }

  if (body.marketingContactId) {
    const marketingResult = await prisma.marketingContact.updateMany({
      where: { id: body.marketingContactId, tenantId },
      data: {
        fullName: name,
        ...(normalizedE164 ? { e164Phone: normalizedE164 } : {}),
        email: email || null,
        tags: body.tags ?? ["CRM Contact"],
      },
    });
    if (!marketingResult.count && !updatedLead) {
      return NextResponse.json({ ok: false, error: "Contact was not found in this workspace." }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true, message: "Contact updated successfully.", lead: updatedLead });
}
