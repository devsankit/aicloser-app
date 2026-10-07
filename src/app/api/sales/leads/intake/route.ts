import { NextResponse } from "next/server";
import { intakeSalesLead } from "@/lib/gigxomi/sales-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidPhone(value: string) {
  return /^[+\d][\d\s().-]{6,24}$/.test(value);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON form payload." },
      { status: 400, headers: corsHeaders },
    );
  }

  // Honeypot check for spam bots
  if (cleanText(body.website, 200)) {
    return NextResponse.json({ ok: true, leadId: "ignored" }, { headers: corsHeaders });
  }

  const name = cleanText(body.name || body.customerName, 120);
  const business = cleanText(body.business || body.businessName, 160);
  const phone = cleanText(body.contactNumber || body.phone || body.customerPhone, 32);
  const email = cleanText(body.email || body.customerEmail, 160).toLowerCase();
  const message = cleanText(body.message, 1000);
  const source = cleanText(body.source, 100) || "Website Demo Form";

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Please provide your name." },
      { status: 400, headers: corsHeaders },
    );
  }

  if (!phone || !isValidPhone(phone)) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid contact or WhatsApp phone number." },
      { status: 400, headers: corsHeaders },
    );
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid email address." },
      { status: 400, headers: corsHeaders },
    );
  }

  const rawTags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
    : [];

  const isFranchiseLead =
    source.toLowerCase().includes("franchise") ||
    business.toLowerCase().includes("franchise") ||
    message.toLowerCase().includes("franchise") ||
    rawTags.includes("digital_franchise_lead");

  const tags = isFranchiseLead
    ? Array.from(new Set([...rawTags, "digital_franchise_lead", "territory_checked", "source_ai_bot"]))
    : rawTags;

  try {
    const result = await intakeSalesLead({
      customerName: name,
      customerPhone: phone,
      customerEmail: email || undefined,
      businessName: business || undefined,
      source: isFranchiseLead && (!body.source || body.source === "Website Demo Form") ? "FRANCHISE_AI_BOT" : source,
      message: message || undefined,
      priority: "hot",
      tags,
    });

    return NextResponse.json(
      {
        ok: true,
        leadId: result.leadId,
        poolItemId: result.poolItemId,
        assigned: result.assigned,
        agentId: result.agentId,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("[leads-intake] Intake error:", error);
    return NextResponse.json(
      { ok: false, error: "We could not save your demo request right now. Please try again." },
      { status: 500, headers: corsHeaders },
    );
  }
}
