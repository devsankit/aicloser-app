import { NextResponse } from "next/server";
import { getStoredFeedback, saveStoredFeedback, type CustomerFeedbackItem } from "@/lib/customer-feedback";

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
    const body = await req.json();
    const { rating, name, contact, comment, source } = body;

    if (!rating || !comment || !contact) {
      return NextResponse.json(
        { error: "Rating, contact, and comment are required." },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const newItem: CustomerFeedbackItem = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      rating: Number(rating) || 1,
      name: (name || "Anonymous").trim(),
      contact: String(contact).trim(),
      comment: String(comment).trim(),
      source: String(source || "aicloser.in/rate").trim(),
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
