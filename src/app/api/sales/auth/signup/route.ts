import { NextResponse } from "next/server";
import { provisionSaaSCloserWorkspace } from "@/lib/gigxomi/sales-store";
import { shouldUseSecureCookies } from "@/lib/auth/cookie-security";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getApiBaseUrl() {
  return (
    process.env.AICLOSER_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AICLOSER_API_URL?.trim() ||
    "https://api.aicloser.in/api/v1"
  ).replace(/\/$/, "");
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

  // 1. First attempt Central API Provisioning
  try {
    const centralRes = await fetch(`${getApiBaseUrl()}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        companyName: effectiveCompanyName,
        adminName: displayName || "Admin",
        email,
        phone,
        password,
        industry: "General",
        teamSize: String(seats),
      }),
    }).catch(() => null);

    if (centralRes?.ok) {
      const centralData = await centralRes.json().catch(() => null);
      if (centralData?.success && centralData?.data) {
        const response = NextResponse.json({
          ok: true,
          user: centralData.data.user,
          workspace: centralData.data.workspace,
          redirectTo: "/login",
        });

        if (centralData.data.token) {
          response.cookies.set("aicloser_token", centralData.data.token, {
            httpOnly: true,
            secure: shouldUseSecureCookies(),
            sameSite: "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60,
          });
        }
        return response;
      }
    } else if (centralRes?.status === 409) {
      const errorData = await centralRes.json().catch(() => null);
      return NextResponse.json({ ok: false, error: errorData?.error || "Account with this email or phone already exists." }, { status: 409 });
    }
  } catch {
    // fallback to local provision
  }

  // 2. Fallback to local store provision
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
