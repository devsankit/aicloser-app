import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import {
  parseCsv,
  fetchGoogleSheetData,
  autodetectColumnMapping,
  processContactImport,
  type ColumnMapping,
} from "@/lib/whatsapp-marketing/google-sheets-import";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId as string);
  const action = body.action as string; // 'PREVIEW' | 'PROCESS'

  let rows: Record<string, string>[] = [];
  let headers: string[] = [];

  // Source 1: Google Sheets via OAuth token & spreadsheetId
  if (body.googleAccessToken && body.spreadsheetId) {
    const sheetRes = await fetchGoogleSheetData({
      accessToken: String(body.googleAccessToken),
      spreadsheetId: String(body.spreadsheetId),
      range: body.range ? String(body.range) : undefined,
    });

    if (!sheetRes.ok) {
      return NextResponse.json({ ok: false, error: sheetRes.error }, { status: 400 });
    }

    headers = sheetRes.headers;
    rows = sheetRes.rows;
  }
  // Source 2: Raw CSV text
  else if (body.csvText) {
    const parsed = parseCsv(String(body.csvText));
    headers = parsed.headers;
    rows = parsed.rows;
  }
  // Source 3: Pre-parsed array of rows
  else if (Array.isArray(body.rows)) {
    rows = body.rows as Record<string, string>[];
    headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  } else {
    return NextResponse.json(
      { ok: false, error: "Provide either googleAccessToken & spreadsheetId, csvText, or pre-parsed rows." },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No data rows found in source." }, { status: 400 });
  }

  const mapping: ColumnMapping =
    (body.mapping as ColumnMapping) || autodetectColumnMapping(headers);

  // If user is just requesting preview and mapping detection
  if (action === "PREVIEW") {
    return NextResponse.json({
      ok: true,
      headers,
      suggestedMapping: mapping,
      previewRows: rows.slice(0, 10),
      totalRows: rows.length,
    });
  }

  // Mandatory marketing consent enforcement
  if (!body.consentDeclared) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Explicit consent declaration is required. In accordance with WhatsApp Business messaging policies, you must confirm that contacts have opted-in to receive communications.",
      },
      { status: 400 },
    );
  }

  if (!mapping.phone) {
    return NextResponse.json({ ok: false, error: "A mapped phone column is required." }, { status: 400 });
  }

  const result = await processContactImport({
    tenantId,
    source: (["GOOGLE_SHEETS", "CSV", "XLSX", "MANUAL"].includes(String(body.source))
      ? (body.source as "GOOGLE_SHEETS" | "CSV" | "XLSX" | "MANUAL")
      : "CSV"),
    fileName: body.fileName ? String(body.fileName) : undefined,
    rows,
    mapping,
    defaultGroupId: body.defaultGroupId ? String(body.defaultGroupId) : undefined,
    consentDeclared: Boolean(body.consentDeclared),
    consentSource: body.consentSource ? String(body.consentSource) : "DASHBOARD_IMPORT_CONFIRMATION",
    defaultCountryCode: body.defaultCountryCode ? String(body.defaultCountryCode) : "+91",
    actorUserId: auth.session.userId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
