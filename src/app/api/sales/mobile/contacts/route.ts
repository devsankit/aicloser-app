import { NextResponse } from "next/server";

import { requireSalesMobileSession } from "@/lib/api/require-sales-mobile-session";
import { upsertSalesMobileContact, type SalesMobileContactInput } from "@/lib/gigxomi/sales-mobile-store";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const auth = await requireSalesMobileSession();
  if (!auth.ok) return auth.response;

  try {
    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    const batch = Array.isArray(payload.contacts)
      ? payload.contacts.filter(isRecord) as SalesMobileContactInput[]
      : [isRecord(payload.contact) ? payload.contact as SalesMobileContactInput : payload as SalesMobileContactInput];

    if (!batch.length) {
      return NextResponse.json({ ok: false, error: "At least one contact is required." }, { status: 422 });
    }

    const results = [];
    for (const contact of batch.slice(0, 100)) {
      try {
        results.push({ ok: true, ...(await upsertSalesMobileContact(auth.actor, contact)) });
      } catch (error) {
        results.push({ ok: false, error: error instanceof Error ? error.message : "Contact sync failed." });
      }
    }

    const failed = results.filter((result) => !result.ok);
    const created = results.filter((result) => result.ok && "created" in result && result.created).length;
    const updated = results.filter((result) => result.ok && "updated" in result && result.updated).length;
    const status = failed.length === results.length ? 422 : 200;

    return NextResponse.json({
      ok: failed.length === 0,
      created,
      updated,
      skipped: failed.length,
      contacts: results,
    }, { status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Contact sync failed." }, { status: 400 });
  }
}
