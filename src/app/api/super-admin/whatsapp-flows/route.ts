import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_SERVER_URL = process.env.API_SERVER_URL || "http://127.0.0.1:3060";

async function forward(req: Request, method: string) {
  const url = new URL(req.url);
  const targetUrl = `${API_SERVER_URL}/api/v1/whatsapp-flows${url.search}`;
  const headers = new Headers(req.headers);
  headers.set("host", new URL(API_SERVER_URL).host);

  const init: RequestInit = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(targetUrl, init).catch(() => {
    return new Response(JSON.stringify({ success: false, flows: [], runs: [], error: "API engine unreachable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  });

  const resBody = await res.text();
  return new NextResponse(resBody, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  });
}

export async function GET(req: Request) {
  return forward(req, "GET");
}

export async function POST(req: Request) {
  return forward(req, "POST");
}

export async function PATCH(req: Request) {
  return forward(req, "PATCH");
}

export async function DELETE(req: Request) {
  return forward(req, "DELETE");
}
