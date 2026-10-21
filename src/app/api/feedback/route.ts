import { NextResponse } from "next/server";
import { getStoredFeedback, saveStoredFeedback, type CustomerFeedbackItem } from "@/lib/customer-feedback";

export const dynamic = "force-dynamic";

const feedbackRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = feedbackRateLimitMap.get(key);
  if (!entry || entry.resetAt <= now) {
    feedbackRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    if (!checkRateLimit(ip, 5, 60_000)) {
      return NextResponse.json(
        { error: "Too many feedback submissions. Please wait a minute before submitting again." },
        { status: 429, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { rating, name, contact, comment, source } = body;

    const numRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
    const cleanContact = String(contact || "").trim().slice(0, 100);
    const cleanComment = String(comment || "").trim().slice(0, 2000);
    const cleanName = String(name || "Anonymous").trim().slice(0, 80);
    const cleanSource = String(source || "aicloser.in/rate").trim().slice(0, 100);

    if (!cleanContact || !cleanComment || !numRating) {
      return NextResponse.json(
        { error: "Rating (1-5), contact, and comment are required." },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const newItem: CustomerFeedbackItem = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      rating: numRating,
      name: cleanName,
      contact: cleanContact,
      comment: cleanComment,
      source: cleanSource,
      status: "NEW",
      createdAt: new Date().toISOString(),
    };

    const existing = await getStoredFeedback();
    existing.unshift(newItem);
    await saveStoredFeedback(existing);

    return NextResponse.json(
      { success: true, item: newItem },
      {
        status: 201,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error: any) {
    console.error("Failed to store feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
