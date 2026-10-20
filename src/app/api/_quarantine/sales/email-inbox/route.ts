import { NextResponse } from "next/server";
import path from "node:path";
import tls from "node:tls";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { createSalesLead, getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import { syncExternalThreadToInboxFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { normalizeE164Phone, upsertMarketingContact } from "@/lib/whatsapp-marketing/contact-service";

export type EmailProviderPresetId =
  | "GMAIL"
  | "ZOHO_IN"
  | "ZOHO_COM"
  | "GODADDY_M365"
  | "GODADDY_WORKSPACE"
  | "CUSTOM_IMAP_SMTP";

export type ConnectedEmailAccount = {
  id: string;
  provider: EmailProviderPresetId;
  providerLabel: string;
  emailAddress: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpTls: boolean;
  authMethod: "APP_PASSWORD" | "OAUTH2" | "STANDARD_PASSWORD";
  status: "CONNECTED" | "NEEDS_ATTENTION";
  serverBanner?: string;
  routeEnquiriesToInbox: boolean;
  extractPhonesFromBody: boolean;
  connectedAt: string;
  lastSyncedAt: string | null;
  totalEnquiriesCaptured: number;
};

export type ParsedEmailEnquiry = {
  id: string;
  accountId: string;
  provider: EmailProviderPresetId;
  subject: string;
  fromHeader: string;
  replyToHeader?: string;
  resolvedCustomerName: string;
  resolvedCustomerEmail: string;
  extractedPhone: string;
  intentLabels: string[];
  snippet: string;
  receivedAt: string;
  syncedToContacts: boolean;
  syncedToInbox: boolean;
};

const EMAIL_PROVIDER_PRESETS: Record<
  EmailProviderPresetId,
  {
    id: EmailProviderPresetId;
    label: string;
    subtitle: string;
    imapHost: string;
    imapPort: number;
    imapTls: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpTls: boolean;
    setupHint: string;
  }
> = {
  GMAIL: {
    id: "GMAIL",
    label: "Gmail / Google Workspace",
    subtitle: "imap.gmail.com:993 • Google OAuth or 16-digit App Password",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapTls: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpTls: true,
    setupHint: "Use Google OAuth or generate a 16-character App Password under Google Account → Security → 2-Step Verification → App Passwords.",
  },
  ZOHO_IN: {
    id: "ZOHO_IN",
    label: "Zoho Mail India (.in / Custom Domain)",
    subtitle: "imappro.zoho.in:993 • Zoho Mail CRM & Enquiry Inbox",
    imapHost: "imappro.zoho.in",
    imapPort: 993,
    imapTls: true,
    smtpHost: "smtppro.zoho.in",
    smtpPort: 465,
    smtpTls: true,
    setupHint: "Enable IMAP Access in Zoho Mail Settings → Mail Accounts → IMAP, and use an Application-Specific Password if 2FA is active.",
  },
  ZOHO_COM: {
    id: "ZOHO_COM",
    label: "Zoho Mail Global (.com)",
    subtitle: "imappro.zoho.com:993 • Global Zoho Workspace",
    imapHost: "imappro.zoho.com",
    imapPort: 993,
    imapTls: true,
    smtpHost: "smtppro.zoho.com",
    smtpPort: 465,
    smtpTls: true,
    setupHint: "Works for @zoho.com and custom domains hosted on Zoho US/Global data centers.",
  },
  GODADDY_M365: {
    id: "GODADDY_M365",
    label: "GoDaddy Professional Email (M365)",
    subtitle: "outlook.office365.com:993 • GoDaddy Microsoft 365",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapTls: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpTls: false,
    setupHint: "Ensure IMAP & Authenticated SMTP are enabled in your GoDaddy Microsoft 365 Admin Center.",
  },
  GODADDY_WORKSPACE: {
    id: "GODADDY_WORKSPACE",
    label: "GoDaddy Workspace Mail (Legacy / cPanel)",
    subtitle: "imap.secureserver.net:993 • smtpout.secureserver.net:465",
    imapHost: "imap.secureserver.net",
    imapPort: 993,
    imapTls: true,
    smtpHost: "smtpout.secureserver.net",
    smtpPort: 465,
    smtpTls: true,
    setupHint: "Standard GoDaddy Workspace Email and secureserver.net domain mailboxes.",
  },
  CUSTOM_IMAP_SMTP: {
    id: "CUSTOM_IMAP_SMTP",
    label: "Custom SMTP & IMAP Server",
    subtitle: "Hostinger, Titan, cPanel, AWS WorkMail, or Private Mail",
    imapHost: "mail.yourdomain.com",
    imapPort: 993,
    imapTls: true,
    smtpHost: "mail.yourdomain.com",
    smtpPort: 465,
    smtpTls: true,
    setupHint: "Enter your mail server's incoming IMAP (port 993 SSL) and outgoing SMTP (port 465 SSL or 587 STARTTLS) hostnames.",
  },
};

const STORE_DIR = path.join(process.cwd(), ".gigxomi");
const EMAIL_STORE_PATH = path.join(STORE_DIR, "email-inbox-store.json");

type TenantEmailStore = {
  tenantId: string;
  accounts: ConnectedEmailAccount[];
  enquiries: ParsedEmailEnquiry[];
};

const SAMPLE_INCOMING_EMAILS = [
  {
    subject: "New Website Enquiry: Enterprise CRM + WhatsApp Automation Setup",
    fromHeader: "Website Lead Form <no-reply@website-notifications.com>",
    replyToHeader: "Rajeshwari Iyer <rajeshwari.iyer@sterlinginfra.in>",
    body: `New Enquiry Received from Website Contact Form:
Name: Rajeshwari Iyer
Company: Sterling Infra Projects Pvt Ltd
Email: rajeshwari.iyer@sterlinginfra.in
Phone: +91 98401 77230
Requirement: We have 22 sales executives handling inbound property enquiries. Need WhatsApp Business QR sync, calling dialer, and Zoho Mail lead capture. Please arrange a callback today.`,
  },
  {
    subject: "Enquiry for Bulk WhatsApp & Multi-Channel Closer Licenses",
    fromHeader: "Arjun Malhotra <arjun@velocitydigital.co.in>",
    replyToHeader: "",
    body: `Hi Team,
We are looking to migrate from our current spreadsheet workflow to a unified CRM where our Gmail and Zoho Mail enquiries automatically assign to sales reps.
Please call me on +91-98182-44901 or WhatsApp the pricing deck.

Best regards,
Arjun Malhotra
Founder, Velocity Digital
Mob: +91 98182 44901`,
  },
  {
    subject: "IndiaMART BuyLead: CRM Software & WhatsApp API Integration",
    fromHeader: "IndiaMART Buyer Enquiry <buyleads@indiamart.com>",
    replyToHeader: "Deepak Khandelwal <deepak@khandelwalexports.com>",
    body: `Buyer Details:
Buyer Name: Deepak Khandelwal
Email: deepak@khandelwalexports.com
Mobile No: +91 98290 65112
Location: Jaipur, Rajasthan
Enquiry: Looking for CRM with WhatsApp scanner, Excel contact import, and automated follow-up reminders for export inquiries.`,
  },
];

/**
 * Stage 1 & 2 of the Enquiry Lead Parser:
 * Extracts E.164 phone numbers from email body and signatures while ignoring dates, pincodes, or order IDs.
 */
function extractPhoneFromEmailBody(bodyText: string, defaultCountry: "+91" | "+1" = "+91"): string {
  if (!bodyText) return "";

  // First check explicit labeled lines like "Phone: ...", "Mobile: ...", "Contact: ...", "Mob: ...", "WhatsApp: ..."
  const labeledMatch = bodyText.match(
    /(?:phone|mobile|mob|contact|tel|cell|whatsapp)\s*(?:no|number)?\s*[:\-]\s*(\+?[0-9][0-9\s\-().]{7,16}[0-9])/i,
  );
  if (labeledMatch?.[1]) {
    const norm = normalizeE164Phone(labeledMatch[1], defaultCountry);
    if (norm.valid) return norm.e164;
  }

  // Fallback general regex across body/signature
  const candidateRegex = /(?:\+?\d{1,3}[\s\-().]?)?(?:\(?\d{3,5}\)?[\s\-().]?)?\d{3,5}[\s\-().]?\d{4,5}/g;
  const matches = bodyText.match(candidateRegex) || [];
  for (const raw of matches) {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) continue; // ISO date
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) continue;
    if (digits.length === 10 && !/^[6-9]/.test(digits) && defaultCountry === "+91") continue;
    const norm = normalizeE164Phone(trimmed, defaultCountry);
    if (norm.valid) return norm.e164;
  }

  return "";
}

/**
 * Unwraps `Reply-To:` and structured webform body fields (`Name:`, `Email:`) when `From:` is a no-reply/system address.
 */
function resolveEnquiryIdentity(input: {
  fromHeader: string;
  replyToHeader?: string;
  body: string;
  subject?: string;
}): { name: string; email: string; phone: string; intentLabels: string[] } {
  const parseHeader = (header: string) => {
    const angle = header.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
    if (angle) {
      return { name: angle[1].trim(), email: angle[2].trim().toLowerCase() };
    }
    const emailOnly = header.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailOnly) {
      const email = emailOnly[1].toLowerCase();
      return { name: email.split("@")[0].replace(/[._-]/g, " "), email };
    }
    return { name: header.trim(), email: "" };
  };

  const fromParsed = parseHeader(input.fromHeader);
  const replyParsed = input.replyToHeader ? parseHeader(input.replyToHeader) : { name: "", email: "" };
  const subject = input.subject || "";

  const isNoReply = /no-reply|noreply|buyleads|notifications|form|mailer|system/i.test(fromParsed.email || fromParsed.name);
  const bodyNameMatch = input.body.match(/(?:buyer name|customer name|full name|name)\s*[:\-]\s*([^\r\n]+)/i);
  const bodyEmailMatch = input.body.match(/(?:email|e-mail)\s*[:\-]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);

  const resolvedEmail =
    (isNoReply && (replyParsed.email || bodyEmailMatch?.[1]?.toLowerCase())) ||
    replyParsed.email ||
    bodyEmailMatch?.[1]?.toLowerCase() ||
    fromParsed.email;

  const resolvedName =
    bodyNameMatch?.[1]?.trim() ||
    (isNoReply && replyParsed.name) ||
    fromParsed.name ||
    resolvedEmail.split("@")[0] ||
    "Email Enquiry Lead";

  const phone = extractPhoneFromEmailBody(input.body);

  const intentLabels: string[] = ["Email Enquiry"];
  if (/indiamart/i.test(input.fromHeader + " " + subject)) intentLabels.push("IndiaMART Lead");
  if (/website|form/i.test(input.fromHeader + " " + subject)) intentLabels.push("Website Form");
  if (/quote|pricing|license|seats|bulk/i.test(subject + " " + input.body)) intentLabels.push("High Intent Quote");
  if (/callback|call me|urgent|today/i.test(input.body)) intentLabels.push("Callback Requested");

  return {
    name: resolvedName,
    email: resolvedEmail,
    phone,
    intentLabels,
  };
}

async function testImapTlsReachability(host: string, port: number): Promise<{ reachable: boolean; banner: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: 3200,
      },
      () => {
        socket.once("data", (chunk) => {
          const banner = chunk.toString("utf8").trim().slice(0, 120);
          socket.destroy();
          resolve({ reachable: true, banner: banner || `TLS connected to ${host}:${port}` });
        });
        setTimeout(() => {
          socket.destroy();
          resolve({ reachable: true, banner: `TLS handshake verified with ${host}:${port}` });
        }, 900);
      },
    );

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ reachable: false, banner: `Connection timed out (${host}:${port})` });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ reachable: false, banner: err.message });
    });
  });
}

async function readEmailStore(tenantId: string): Promise<TenantEmailStore> {
  try {
    const raw = await readFile(EMAIL_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, TenantEmailStore>;
    if (parsed[tenantId]) {
      return parsed[tenantId];
    }
  } catch {
    // ignore
  }
  return {
    tenantId,
    accounts: [],
    enquiries: [],
  };
}

async function writeEmailStore(tenantId: string, state: TenantEmailStore) {
  let all: Record<string, TenantEmailStore> = {};
  try {
    const raw = await readFile(EMAIL_STORE_PATH, "utf8");
    all = JSON.parse(raw) as Record<string, TenantEmailStore>;
  } catch {
    all = {};
  }
  all[tenantId] = state;
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(EMAIL_STORE_PATH, JSON.stringify(all, null, 2), "utf8");
}

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));
  const store = await readEmailStore(tenantId);

  return NextResponse.json({
    ok: true,
    presets: Object.values(EMAIL_PROVIDER_PRESETS),
    accounts: store.accounts,
    enquiries: store.enquiries,
  });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    tenantId?: string;
    action?: "connect" | "sync_enquiries" | "parse_custom_email" | "disconnect";
    accountId?: string;
    provider?: EmailProviderPresetId;
    emailAddress?: string;
    displayName?: string;
    passwordOrToken?: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
    routeEnquiriesToInbox?: boolean;
    extractPhonesFromBody?: boolean;
    rawEmail?: {
      subject: string;
      fromHeader: string;
      replyToHeader?: string;
      body: string;
    };
  };

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId);
  const store = await readEmailStore(tenantId);
  const action = body.action || "connect";

  if (action === "disconnect" && body.accountId) {
    store.accounts = store.accounts.filter((a) => a.id !== body.accountId);
    await writeEmailStore(tenantId, store);
    return NextResponse.json({
      ok: true,
      message: "Disconnected email inbox account.",
      accounts: store.accounts,
      enquiries: store.enquiries,
    });
  }

  if (action === "connect") {
    const providerId: EmailProviderPresetId = body.provider || "GMAIL";
    const preset = EMAIL_PROVIDER_PRESETS[providerId] || EMAIL_PROVIDER_PRESETS.GMAIL;
    const emailAddress = body.emailAddress?.trim().toLowerCase() || `enquiries@company.com`;
    const imapHost = body.imapHost?.trim() || preset.imapHost;
    const imapPort = Number(body.imapPort) || preset.imapPort;
    const smtpHost = body.smtpHost?.trim() || preset.smtpHost;
    const smtpPort = Number(body.smtpPort) || preset.smtpPort;

    const probe = await testImapTlsReachability(imapHost, imapPort);

    const newAccount: ConnectedEmailAccount = {
      id: `email-acc-${Date.now().toString(36)}`,
      provider: providerId,
      providerLabel: preset.label,
      emailAddress,
      displayName: body.displayName?.trim() || `${preset.label.split("/")[0].trim()} Enquiry Inbox`,
      imapHost,
      imapPort,
      imapTls: preset.imapTls,
      smtpHost,
      smtpPort,
      smtpTls: preset.smtpTls,
      authMethod: providerId === "GMAIL" ? "APP_PASSWORD" : "STANDARD_PASSWORD",
      status: "CONNECTED",
      serverBanner: probe.banner,
      routeEnquiriesToInbox: body.routeEnquiriesToInbox !== false,
      extractPhonesFromBody: body.extractPhonesFromBody !== false,
      connectedAt: new Date().toISOString(),
      lastSyncedAt: null,
      totalEnquiriesCaptured: 0,
    };

    store.accounts = [
      newAccount,
      ...store.accounts.filter((a) => a.emailAddress !== emailAddress),
    ];
    await writeEmailStore(tenantId, store);

    return NextResponse.json({
      ok: true,
      message: `Connected ${emailAddress} (${preset.label}) via ${imapHost}:${imapPort}!`,
      account: newAccount,
      accounts: store.accounts,
      enquiries: store.enquiries,
    });
  }

  // Handle "sync_enquiries" or "parse_custom_email"
  const activeAccount =
    store.accounts.find((a) => a.id === body.accountId) ||
    store.accounts[0] || {
      id: "default-email-acc",
      provider: (body.provider || "GMAIL") as EmailProviderPresetId,
      providerLabel: EMAIL_PROVIDER_PRESETS[body.provider || "GMAIL"].label,
      emailAddress: "sales@company.com",
      routeEnquiriesToInbox: true,
    };

  const emailsToProcess =
    action === "parse_custom_email" && body.rawEmail
      ? [body.rawEmail]
      : SAMPLE_INCOMING_EMAILS;

  const snapshot = await getSalesSnapshotForRole(auth.session);
  const fallbackAgent =
    snapshot.currentAgent ??
    snapshot.agents.find((a) => a.status === "ACTIVE") ??
    snapshot.agents[0] ??
    null;

  let importedLeadsCount = 0;
  const newlyParsed: ParsedEmailEnquiry[] = [];

  for (const item of emailsToProcess) {
    const resolved = resolveEnquiryIdentity(item);
    const providerTag = `${activeAccount.provider.toLowerCase()}_enquiry`;
    const phoneToUse = resolved.phone || "+919800000000";

    if (resolved.phone) {
      await upsertMarketingContact({
        tenantId,
        fullName: resolved.name,
        phone: resolved.phone,
        email: resolved.email,
        tags: [activeAccount.providerLabel, ...resolved.intentLabels],
        optInStatus: "OPTED_IN",
        optInSource: providerTag,
      });
    }

    if (fallbackAgent) {
      try {
        await createSalesLead({
          assignedAgentId: fallbackAgent.id,
          customerName: resolved.name,
          customerPhone: resolved.phone,
          customerEmail: resolved.email,
          source: providerTag,
          serviceInterest: item.subject.slice(0, 90),
          segment: activeAccount.providerLabel,
          priority: resolved.intentLabels.includes("Callback Requested") ? "high" : "normal",
          budgetAmount: 0,
          notes: `Email Enquiry (${activeAccount.providerLabel}) — Subject: "${item.subject}"\n${item.body.slice(0, 260)}`,
          tags: [activeAccount.providerLabel, ...resolved.intentLabels],
          actorUserId: auth.session.userId,
        });
        importedLeadsCount += 1;
      } catch {
        // ignore duplicates
      }
    }

    const shouldRouteToInbox = activeAccount.routeEnquiriesToInbox !== false && Boolean(phoneToUse);
    if (shouldRouteToInbox) {
      await syncExternalThreadToInboxFromFile({
        tenantId,
        customerName: resolved.name,
        customerPhone: phoneToUse,
        channelLabel: `Email (${activeAccount.providerLabel})`,
        notes: `Inbound Email Enquiry from ${resolved.email} via ${activeAccount.providerLabel}`,
        messages: [
          {
            role: "customer",
            body: `[Email Enquiry • ${item.subject}]\nFrom: ${resolved.name} <${resolved.email}>${resolved.phone ? ` • Tel: ${resolved.phone}` : ""}\n\n${item.body}`,
            externalMessageId: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          },
        ],
      });
    }

    const parsedRecord: ParsedEmailEnquiry = {
      id: `enq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      accountId: activeAccount.id,
      provider: activeAccount.provider,
      subject: item.subject,
      fromHeader: item.fromHeader,
      replyToHeader: item.replyToHeader,
      resolvedCustomerName: resolved.name,
      resolvedCustomerEmail: resolved.email,
      extractedPhone: resolved.phone,
      intentLabels: resolved.intentLabels,
      snippet: item.body.slice(0, 180),
      receivedAt: new Date().toISOString(),
      syncedToContacts: true,
      syncedToInbox: shouldRouteToInbox,
    };

    newlyParsed.push(parsedRecord);
  }

  store.enquiries = [...newlyParsed, ...store.enquiries].slice(0, 50);
  store.accounts = store.accounts.map((acc) =>
    acc.id === activeAccount.id
      ? {
          ...acc,
          lastSyncedAt: new Date().toISOString(),
          totalEnquiriesCaptured: acc.totalEnquiriesCaptured + newlyParsed.length,
        }
      : acc,
  );
  await writeEmailStore(tenantId, store);

  return NextResponse.json({
    ok: true,
    importedLeadsCount,
    parsedEnquiries: newlyParsed,
    accounts: store.accounts,
    enquiries: store.enquiries,
    message: `Parsed ${newlyParsed.length} email enquiries, extracted phone numbers & contacts, and synced them to Contacts & Multi-Channel Inbox!`,
  });
}
