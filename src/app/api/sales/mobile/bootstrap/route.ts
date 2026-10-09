import { NextResponse } from "next/server";
import { requireSalesMobileSession } from "@/lib/api/require-sales-mobile-session";
import { dispatchDueCallbackReminders } from "@/lib/gigxomi/callback-reminders";
import { getSalesMobileBootstrap } from "@/lib/gigxomi/sales-mobile-store";

export async function GET() {
  const auth = await requireSalesMobileSession();
  if (!auth.ok) return auth.response;
  try {
    const callbackReminders = await dispatchDueCallbackReminders(auth.actor);
    return NextResponse.json({ ok: true, callbackReminders, ...(await getSalesMobileBootstrap(auth.actor)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load CRM." }, { status: 400 });
  }
}
