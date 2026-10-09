import { NextResponse } from "next/server";

import { provisionSaaSCloserWorkspace } from "@/lib/gigxomi/sales-store";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Send valid sales signup details." }, { status: 400 });
  }

  const companyName = readString(body.companyName);
  const displayName = readString(body.displayName);
  const email = readString(body.email);
  const phone = readString(body.phone);
  const password = readString(body.password);
  const confirmPassword = readString(body.confirmPassword);
  const seats = Number(body.seats ?? 5);
  if (!Number.isInteger(seats) || seats < 1 || seats > 500) {
    return NextResponse.json({ ok: false, error: "Number of users must be between 1 and 500." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ ok: false, error: "Passwords do not match." }, { status: 400 });
  }

  const effectiveCompanyName = companyName || `${displayName || "Sales"} Team`;
  const result = await provisionSaaSCloserWorkspace({
    companyName: effectiveCompanyName,
    displayName,
    email,
    phone,
    password,
    seats,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    user: result.user,
    agent: result.agent,
    workspace: result.workspace,
    redirectTo: "/login",
  });

  return response;
}

