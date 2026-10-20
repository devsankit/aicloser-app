import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { normalizePhone } from "@/lib/auth/normalize";
import { createSalesLead, createSalesLeadPoolItem, getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import { prisma } from "@/lib/prisma";
import { readRoundRobinSettings } from "@/lib/gigxomi/round-robin-service";
import { upsertMarketingContact } from "@/lib/whatsapp-marketing/contact-service";

type ImportMode = "add_to_round_robin_queue" | "assign_to_selected_agent" | "add_directly_to_crm";
type ImportRow = Record<string, string>;

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5_000;

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row: ImportRow, keys: string[]) {
  for (const key of keys) {
    const normalized = normalizeKey(key);
    const value = row[normalized];
    if (value) return value.trim();
  }
  return "";
}

function parseDelimited(text: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (character === "\"") {
      quoted = !quoted;
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

async function readRows(file: File) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Contact files must be 5 MB or smaller.");
  const lowerName = file.name.toLowerCase();
  if (![".csv", ".tsv", ".xls", ".xlsx"].some((extension) => lowerName.endsWith(extension))) {
    throw new Error("Use a CSV, TSV, XLS, or XLSX contact file.");
  }
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, raw: false, defval: "" });
  }
  const text = await file.text();
  return parseDelimited(text, lowerName.endsWith(".tsv") ? "\t" : ",");
}

function googleSheetExportUrl(value: string, tabName?: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Paste a valid Google Sheets link.");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "docs.google.com") {
    throw new Error("Only docs.google.com Google Sheets links are supported.");
  }
  const match = url.pathname.match(/^\/spreadsheets\/d\/(e\/)?([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("Paste a valid Google Sheets spreadsheet link.");
  const published = Boolean(match[1]);
  const spreadsheetId = match[2];
  const gid = url.searchParams.get("gid") || url.hash.match(/(?:^#|[?&])gid=(\d+)/)?.[1] || "0";
  const sheetParam = tabName ? `&sheet=${encodeURIComponent(tabName)}` : "";
  return published
    ? `https://docs.google.com/spreadsheets/d/e/${spreadsheetId}/pub?output=csv&gid=${encodeURIComponent(gid)}`
    : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}${sheetParam}`;
}

async function readGoogleSheetRows(value: string, tabName?: string) {
  const primaryUrl = googleSheetExportUrl(value, tabName);
  let response = await fetch(primaryUrl, {
    cache: "no-store",
    headers: { Accept: "text/csv,text/plain", "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!response || !response.ok) {
    try {
      const match = value.match(/\/spreadsheets\/d\/(e\/)?([a-zA-Z0-9_-]+)/);
      if (match) {
        const id = match[2];
        const altUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${tabName ? `&sheet=${encodeURIComponent(tabName)}` : ""}`;
        const altRes = await fetch(altUrl, {
          cache: "no-store",
          headers: { Accept: "text/csv,text/plain", "User-Agent": "Mozilla/5.0" },
          redirect: "follow",
          signal: AbortSignal.timeout(15_000),
        }).catch(() => null);
        if (altRes && altRes.ok) {
          response = altRes;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!response || !response.ok) {
    throw new Error("Unable to read Google Sheet. Please ensure the sheet is shared as ‘Anyone with the link’ (Viewer) or published to web.");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMPORT_BYTES) throw new Error("Google Sheet export must be 5 MB or smaller.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error("Google Sheet export must be 5 MB or smaller.");
  const text = new TextDecoder().decode(buffer);
  if (/<!doctype html|<html/i.test(text.slice(0, 500))) {
    throw new Error("Google returned a sign-in page. Please share the sheet as ‘Anyone with the link’ (Viewer) or use File > Share > Publish to web.");
  }
  return parseDelimited(text, ",");
}

function normalizeRows(rows: string[][]) {
  const [headerRow, ...bodyRows] = rows;
  const headers = (headerRow ?? []).map((header) => normalizeKey(String(header)));
  return bodyRows.map((row) =>
    row.reduce<ImportRow>((record, value, index) => {
      const key = headers[index];
      if (key) record[key] = String(value ?? "");
      return record;
    }, {}),
  );
}

function contactKeys(input: { customerEmail?: string; customerName?: string; customerPhone?: string }) {
  const phone = normalizePhone(input.customerPhone ?? "");
  const email = String(input.customerEmail ?? "").trim().toLowerCase();
  const fallbackName = String(input.customerName ?? "").trim().toLowerCase();
  const keys = [phone ? `phone:${phone}` : "", email ? `email:${email}` : ""].filter(Boolean);
  return keys.length ? keys : fallbackName ? [`name:${fallbackName}`] : [];
}

function parseImportPayload(row: ImportRow, index: number, sourceTag: string) {
  const customerName =
    pick(row, ["name", "full name", "customer name", "contact name", "customer"]) ||
    [pick(row, ["first name", "firstname", "given name"]), pick(row, ["last name", "lastname", "family name"])].filter(Boolean).join(" ");
  const customerPhone = pick(row, ["phone", "phone number", "phone 1 - value", "phone 2 - value", "cell phone", "contact no", "contact number", "mobile", "mobile number", "whatsapp", "whatsapp no", "whatsapp number"]);
  const customerEmail = pick(row, ["email", "e-mail", "email id", "email address", "e-mail 1 - value", "email 1 - value"]);
  return {
    row: index + 2,
    customerName: customerName || customerPhone || customerEmail || `Imported lead ${index + 1}`,
    customerPhone,
    customerEmail,
    source: pick(row, ["source"]) || sourceTag,
    serviceInterest: pick(row, ["service", "package", "interest", "service interest"]) || "Imported contact",
    segment: pick(row, ["segment"]),
    priority: pick(row, ["priority"]) || "normal",
    budgetAmount: Number(pick(row, ["budget", "amount"])) || 0,
    notes: pick(row, ["notes", "note"]),
    tags: pick(row, ["tags", "tag"]),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || (url.searchParams.has("googleSheetUrl") ? "preview_google_sheet" : "");

  if (action === "preview_google_sheet") {
    const googleSheetUrl = String(url.searchParams.get("googleSheetUrl") ?? "").trim();
    const sheetTab = String(url.searchParams.get("sheetTab") ?? "").trim();
    if (!googleSheetUrl) {
      return NextResponse.json({ ok: false, error: "Paste a valid Google Sheets URL." }, { status: 400 });
    }
    try {
      const rawRows = await readGoogleSheetRows(googleSheetUrl, sheetTab);
      if (!rawRows || rawRows.length < 2) {
        return NextResponse.json({ ok: false, error: "The Google Sheet contains no data rows. Please ensure it has a header row and at least one contact row." }, { status: 400 });
      }
      const headers = (rawRows[0] || []).map((h) => String(h || "").trim()).filter(Boolean);
      if (!headers.length) {
        return NextResponse.json({ ok: false, error: "No valid column headers were found in row 1 of the sheet." }, { status: 400 });
      }
      const dataRows = rawRows.slice(1).filter((r) => r.some((cell) => String(cell || "").trim()));
      const sampleRecords = dataRows.slice(0, 50).map((row) => {
        const record: Record<string, string> = {};
        headers.forEach((header, idx) => {
          record[header] = String(row[idx] ?? "").trim();
        });
        return record;
      });

      return NextResponse.json({
        ok: true,
        headers,
        rows: sampleRecords,
        totalRows: dataRows.length,
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        error: err instanceof Error ? err.message : "Unable to load Google Sheet.",
      }, { status: 400 });
    }
  }

  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  return NextResponse.json({ ok: true, status: "ready" });
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  if (authorization.session.role !== "ADMIN" && authorization.session.role !== "SUPER_ADMIN") {
    const settings = await readRoundRobinSettings(resolveSessionTenantId(authorization.session));
    if (!settings.allowNonAdminImportData) {
      return NextResponse.json({ ok: false, error: "Lead import is disabled for your role. Ask a workspace administrator to enable it." }, { status: 403 });
    }
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const googleSheetUrl = String(form?.get("googleSheetUrl") ?? "").trim();
  const uploadedFile = file instanceof File && file.size > 0 ? file : null;
  const hasFile = Boolean(uploadedFile);
  if (hasFile && googleSheetUrl) {
    return NextResponse.json({ ok: false, error: "Choose one source: a contact file or a Google Sheets link." }, { status: 400 });
  }
  if (!hasFile && !googleSheetUrl) {
    return NextResponse.json({ ok: false, error: "Upload a CSV, TSV, XLS, or XLSX file, or paste a Google Sheets link." }, { status: 400 });
  }

  const requestedMode = String(form?.get("mode") ?? "add_to_round_robin_queue") as ImportMode;
  const validModes: ImportMode[] = ["add_to_round_robin_queue", "assign_to_selected_agent", "add_directly_to_crm"];
  if (!validModes.includes(requestedMode)) {
    return NextResponse.json({ ok: false, error: "Choose a valid contact import destination." }, { status: 400 });
  }
  const isSalesAgent = authorization.session.role === "SALES_AGENT";
  const mode: ImportMode = isSalesAgent ? "add_directly_to_crm" : requestedMode;
  const assignedAgentId = String(form?.get("assignedAgentId") ?? "").trim();
  const snapshot = await getSalesSnapshotForRole(authorization.session);
  const scopedAgents = snapshot.visibleAgents;
  const selectedAgent = isSalesAgent
    ? snapshot.currentAgent
    : assignedAgentId
      ? scopedAgents.find((agent) => agent.id === assignedAgentId)
      : null;
  const fallbackAgent = scopedAgents.find((agent) => agent.status === "ACTIVE") ?? scopedAgents[0] ?? null;

  if (isSalesAgent && !selectedAgent) {
    return NextResponse.json({ ok: false, error: "Your sales agent profile was not found." }, { status: 400 });
  }
  if (mode === "assign_to_selected_agent" && !selectedAgent) {
    return NextResponse.json({ ok: false, error: "Choose a sales agent for this import." }, { status: 400 });
  }
  if (mode === "add_directly_to_crm" && !selectedAgent && !fallbackAgent) {
    return NextResponse.json({ ok: false, error: "Create or select a sales agent before importing directly to CRM." }, { status: 400 });
  }

  let rawRows: string[][];
  try {
    rawRows = uploadedFile ? await readRows(uploadedFile) : await readGoogleSheetRows(googleSheetUrl);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to read the contact source." }, { status: 400 });
  }
  if (rawRows.length > MAX_IMPORT_ROWS + 1) {
    return NextResponse.json({ ok: false, error: `Import up to ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} contacts at a time.` }, { status: 400 });
  }
  if (rawRows.length < 2 || !rawRows[0]?.some((value) => String(value).trim())) {
    return NextResponse.json({ ok: false, error: "No contacts were found. Include a header row and at least one contact." }, { status: 400 });
  }
  const rows = normalizeRows(rawRows);
  const tenantScopeId = resolveSessionTenantId(authorization.session);
  const seen = new Set<string>();

  // Tenant-wide deduplication: fetch all existing lead assignments and pool items
  const [existingAssignments, existingPoolItems] = await Promise.all([
    prisma.salesLeadAssignment.findMany({
      where: { tenantId: tenantScopeId },
      select: { customerEmail: true, customerName: true, customerPhone: true },
    }),
    prisma.salesLeadPoolItem.findMany({
      where: { tenantId: tenantScopeId },
      select: { customerEmail: true, customerName: true, customerPhone: true },
    }),
  ]);

  for (const item of [...existingAssignments, ...existingPoolItems]) {
    for (const key of contactKeys({
      customerEmail: item.customerEmail ?? undefined,
      customerName: item.customerName ?? undefined,
      customerPhone: item.customerPhone ?? undefined,
    })) {
      seen.add(key);
    }
  }
  const errors: Array<{ row: number; reason: string }> = [];
  let imported = 0;
  let duplicate = 0;
  let skipped = 0;
  const previewRows: Array<ReturnType<typeof parseImportPayload>> = [];
  const isPreview = String(form?.get("preview") ?? "") === "true";
  const importBatchId = crypto.randomUUID();
  const poolItemIds: string[] = [];
  const sourceTag = hasFile ? "excel_csv_import" : "google_sheets_sync";

  for (const [index, row] of rows.entries()) {
    const parsed = parseImportPayload(row, index, sourceTag);
    const dedupeKeys = contactKeys(parsed);
    if (!parsed.customerPhone && !parsed.customerEmail) {
      skipped += 1;
      errors.push({ row: index + 2, reason: "Add a phone number or email address. Email is optional for phone contacts." });
      continue;
    }
    if (dedupeKeys.some((key) => seen.has(key))) {
      duplicate += 1;
      continue;
    }

    const payload = {
      tenantId: resolveSessionTenantId(authorization.session),
      assignedAgentId: mode === "add_to_round_robin_queue" ? selectedAgent?.id ?? null : selectedAgent?.id ?? fallbackAgent?.id ?? null,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone,
      customerEmail: parsed.customerEmail,
      source: parsed.source,
      serviceInterest: parsed.serviceInterest,
      segment: parsed.segment,
      priority: parsed.priority,
      budgetAmount: parsed.budgetAmount,
      notes: parsed.notes,
      tags: parsed.tags,
    };

    if (isPreview) {
      previewRows.push(parsed);
      for (const key of dedupeKeys) seen.add(key);
      continue;
    }

    try {
      const parsedTags = payload.tags ? payload.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
      const tenantId = resolveSessionTenantId(authorization.session);
      if (parsed.customerPhone) {
        await upsertMarketingContact({
          tenantId,
          fullName: payload.customerName,
          phone: parsed.customerPhone,
          email: parsed.customerEmail || undefined,
          tags: Array.from(new Set([hasFile ? "Excel / CSV Import" : "Google Sheets Sync", ...parsedTags])),
          optInStatus: "OPTED_IN",
          optInSource: payload.source,
        });
      }
      if (mode === "add_directly_to_crm" || mode === "assign_to_selected_agent") {
        await createSalesLead({
          ...payload,
          assignedAgentId: payload.assignedAgentId ?? fallbackAgent?.id ?? "",
          tags: Array.from(new Set([hasFile ? "Excel / CSV Import" : "Google Sheets Sync", ...parsedTags])),
          actorUserId: authorization.session.userId,
        });
      } else {
        const poolItem = await createSalesLeadPoolItem(payload);
        poolItemIds.push(poolItem.id);
      }
      imported += 1;
      for (const key of dedupeKeys) seen.add(key);
    } catch (error) {
      skipped += 1;
      errors.push({ row: index + 2, reason: error instanceof Error ? error.message : "Import failed." });
    }
  }

  if (isPreview) {
    return NextResponse.json({
      ok: true,
      preview: true,
      source: hasFile ? "file" : "google_sheets",
      rows: previewRows.slice(0, 250),
      totalRows: rows.length,
      valid: previewRows.length,
      duplicate,
      skipped,
      invalid: errors.length,
      errors: errors.slice(0, 25),
    });
  }

  return NextResponse.json({
    ok: true,
    imported,
    importBatchId,
    poolItemIds,
    skipped,
    duplicate,
    invalid: errors.length,
    source: hasFile ? "file" : "google_sheets",
    errors: errors.slice(0, 25),
  });
}
