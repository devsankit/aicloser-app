import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { normalizeE164Phone, isPhoneSuppressed } from "./contact-service";
import { isMockMode } from "./config";

export type ColumnMapping = {
  phone: string;
  name?: string;
  email?: string;
  group?: string;
  tags?: string;
  customFields?: string[];
};

export type ParsedRow = Record<string, string>;

/**
 * Parses raw CSV text into array of object rows.
 */
export function parseCsv(csvText: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ""));
    return result;
  };

  const headers = splitLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    const rowObj: ParsedRow = {};
    headers.forEach((h, index) => {
      rowObj[h] = values[index] || "";
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Parses XLSX / XLS buffer into array of object rows using the xlsx library.
 */
export function parseXlsxBuffer(buffer: Buffer): { headers: string[]; rows: ParsedRow[] } {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

  if (!rawRows || rawRows.length === 0) return { headers: [], rows: [] };

  const [headerRow, ...dataRows] = rawRows;
  const headers = headerRow.map((h) => String(h || "").trim());

  const rows: ParsedRow[] = dataRows
    .filter((r) => r.some((c) => String(c).trim().length > 0))
    .map((r) => {
      const obj: ParsedRow = {};
      headers.forEach((h, idx) => {
        obj[h] = String(r[idx] || "").trim();
      });
      return obj;
    });

  return { headers, rows };
}

/**
 * Autodetects probable column mappings based on common header names.
 */
export function autodetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    phone: "",
    name: "",
    email: "",
    group: "",
    tags: "",
  };

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const h of headers) {
    const c = clean(h);
    if (!mapping.phone && (c.includes("phone") || c.includes("mobile") || c.includes("whatsapp") || c.includes("contact"))) {
      mapping.phone = h;
    } else if (!mapping.name && (c === "name" || c === "fullname" || c === "customername" || c.includes("client"))) {
      mapping.name = h;
    } else if (!mapping.email && c.includes("email")) {
      mapping.email = h;
    } else if (!mapping.group && (c.includes("group") || c.includes("segment") || c.includes("audience"))) {
      mapping.group = h;
    } else if (!mapping.tags && (c.includes("tag") || c.includes("label"))) {
      mapping.tags = h;
    }
  }

  return mapping;
}

/**
 * Fetches Google Sheet data using a read-only Google OAuth Access Token.
 * In mock mode: returns simulated spreadsheet data with realistic lead columns.
 */
export async function fetchGoogleSheetData(input: {
  accessToken: string;
  spreadsheetId: string;
  range?: string; // defaults to Sheet1!A1:Z
}): Promise<{ ok: true; headers: string[]; rows: ParsedRow[] } | { ok: false; error: string }> {
  // Support mock mode for local testing without requiring active Google Cloud credentials
  if (isMockMode() || input.accessToken === "mock" || input.spreadsheetId.startsWith("mock")) {
    const headers = ["Full Name", "Phone Number", "Email Address", "Audience Group", "Notes"];
    const rows: ParsedRow[] = [
      {
        "Full Name": "Ankit Rathore",
        "Phone Number": "+91 99933 28124",
        "Email Address": "ankit@gigxomi.com",
        "Audience Group": "VIP Customers",
        Notes: "Requested product demo",
      },
      {
        "Full Name": "Priya Sharma",
        "Phone Number": "+91 98765 43210",
        "Email Address": "priya@example.com",
        "Audience Group": "Webinar Registrants",
        Notes: "Attended Closer Workshop",
      },
      {
        "Full Name": "Rahul Verma",
        "Phone Number": "+91 91234 56789",
        "Email Address": "rahul@example.com",
        "Audience Group": "Inbound Leads",
        Notes: "Reel ad conversion",
      },
    ];
    return { ok: true, headers, rows };
  }

  try {
    const range = encodeURIComponent(input.range || "Sheet1!A1:Z");
    const cleanSpreadsheetId = input.spreadsheetId.replace(/^https:\/\/docs\.google\.com\/spreadsheets\/d\//, "").split("/")[0];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/${range}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      values?: string[][];
      error?: { message: string };
    };

    if (!res.ok || !payload.values || payload.values.length === 0) {
      return {
        ok: false,
        error: payload.error?.message || "Failed to fetch spreadsheet data or sheet is empty.",
      };
    }

    const [headerRow, ...dataRows] = payload.values;
    const headers = headerRow.map((h) => String(h || "").trim());

    const rows: ParsedRow[] = dataRows.map((r) => {
      const obj: ParsedRow = {};
      headers.forEach((h, idx) => {
        obj[h] = String(r[idx] || "").trim();
      });
      return obj;
    });

    return { ok: true, headers, rows };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error connecting to Google Sheets API",
    };
  }
}

/**
 * Executes a full import of parsed rows into MarketingContact and groups with consent checks.
 */
export async function processContactImport(input: {
  tenantId: string;
  source: "GOOGLE_SHEETS" | "CSV" | "XLSX" | "MANUAL";
  fileName?: string;
  rows: ParsedRow[];
  mapping: ColumnMapping;
  defaultGroupId?: string;
  consentDeclared: boolean;
  consentSource?: string;
  defaultCountryCode?: string;
  actorUserId?: string;
}) {
  const job = await prisma.contactImportJob.create({
    data: {
      tenantId: input.tenantId,
      source: input.source,
      fileName: input.fileName,
      totalRows: input.rows.length,
      status: "PROCESSING",
      consentDeclared: input.consentDeclared,
      consentSource: input.consentSource || (input.consentDeclared ? "USER_CONFIRMED_IMPORT" : null),
      createdById: input.actorUserId,
    },
  });

  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  const seenPhones = new Set<string>();

  for (let idx = 0; idx < input.rows.length; idx++) {
    const row = input.rows[idx];
    const rowNum = idx + 2; // +1 for 0-index, +1 for header
    const rawPhone = row[input.mapping.phone] || "";
    const rawName = input.mapping.name ? row[input.mapping.name] || "" : "";
    const rawEmail = input.mapping.email ? row[input.mapping.email] || "" : "";
    const rawGroup = input.mapping.group ? row[input.mapping.group] || "" : "";
    const rawTags = input.mapping.tags ? row[input.mapping.tags] || "" : "";

    if (!rawPhone.trim()) {
      invalidCount++;
      await prisma.contactImportRowError.create({
        data: {
          importJobId: job.id,
          rowNumber: rowNum,
          rawData: row as unknown as Prisma.InputJsonValue,
          errorCode: "EMPTY_PHONE",
          errorMessage: "Phone number column was empty.",
        },
      });
      continue;
    }

    const norm = normalizeE164Phone(rawPhone, input.defaultCountryCode || "+91");
    if (!norm.valid) {
      invalidCount++;
      await prisma.contactImportRowError.create({
        data: {
          importJobId: job.id,
          rowNumber: rowNum,
          rawData: row as unknown as Prisma.InputJsonValue,
          errorCode: "INVALID_PHONE_FORMAT",
          errorMessage: norm.error,
        },
      });
      continue;
    }

    const e164 = norm.e164;
    if (seenPhones.has(e164)) {
      duplicateCount++;
      continue;
    }
    seenPhones.add(e164);

    const isSuppressed = await isPhoneSuppressed(input.tenantId, e164);
    const optInStatus = isSuppressed
      ? "OPTED_OUT"
      : input.consentDeclared
      ? "OPTED_IN"
      : "UNKNOWN";

    const tags = rawTags
      ? rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const contact = await prisma.marketingContact.upsert({
      where: {
        tenantId_e164Phone: {
          tenantId: input.tenantId,
          e164Phone: e164,
        },
      },
      update: {
        fullName: rawName.trim() || undefined,
        email: rawEmail.trim() || undefined,
        optInStatus: isSuppressed ? "OPTED_OUT" : input.consentDeclared ? "OPTED_IN" : undefined,
        optInSource: input.consentSource,
        optInAt: input.consentDeclared ? new Date() : undefined,
        tags: tags.length > 0 ? { push: tags } : undefined,
      },
      create: {
        tenantId: input.tenantId,
        fullName: rawName.trim() || e164,
        e164Phone: e164,
        email: rawEmail.trim() || null,
        optInStatus,
        optInSource: input.consentSource || "FILE_IMPORT",
        optInAt: optInStatus === "OPTED_IN" ? new Date() : null,
        tags,
      },
    });

    // Handle group assignment
    const groupNamesToAssign = new Set<string>();
    if (rawGroup) {
      rawGroup.split(",").forEach((g) => {
        const cleanG = g.trim();
        if (cleanG) groupNamesToAssign.add(cleanG);
      });
    }

    for (const groupName of groupNamesToAssign) {
      const grp = await prisma.contactGroup.upsert({
        where: { tenantId_name: { tenantId: input.tenantId, name: groupName } },
        update: {},
        create: { tenantId: input.tenantId, name: groupName },
      });

      await prisma.contactGroupMembership.upsert({
        where: { groupId_contactId: { groupId: grp.id, contactId: contact.id } },
        update: {},
        create: { groupId: grp.id, contactId: contact.id },
      });
    }

    if (input.defaultGroupId) {
      await prisma.contactGroupMembership.upsert({
        where: { groupId_contactId: { groupId: input.defaultGroupId, contactId: contact.id } },
        update: {},
        create: { groupId: input.defaultGroupId, contactId: contact.id },
      });
    }

    validCount++;
  }

  // Update job summary
  const completedJob = await prisma.contactImportJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
      completedAt: new Date(),
    },
  });

  return {
    ok: true,
    jobId: completedJob.id,
    totalRows: input.rows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    duplicateRows: duplicateCount,
  };
}
