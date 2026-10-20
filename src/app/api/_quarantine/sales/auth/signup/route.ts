import { NextResponse } from "next/server";
import { provisionSaaSCloserWorkspace } from "@/lib/gigxomi/sales-store";
import { shouldUseSecureCookies } from "@/lib/auth/cookie-security";
import { applySessionCookie } from "@/lib/auth/session";
import { acquireAppClientSession } from "@/lib/auth/client-sessions";
import { createSessionToken } from "@/lib/auth/token";

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
        const token = centralData.data.token;
        const centralUser = centralData.data.user;
        const destination = "/?tab=dashboard";

        const response = NextResponse.json({
          ok: true,
          token,
          user: centralUser,
          workspace: centralData.data.workspace,
          redirectTo: destination,
        });

        const sessionId = centralUser.sessionId || crypto.randomUUID();
        const installationId = `web-${crypto.randomUUID()}`;

        await applySessionCookie(response, {
          userId: centralUser.userId || centralUser.id,
          role: centralUser.role || "ADMIN",
          assignedRole: centralUser.role || "ADMIN",
          tenantId: centralUser.tenantId,
          displayName: centralUser.displayName,
          email: centralUser.email ?? null,
          phone: centralUser.phone ?? null,
          packageId: null,
          packageName: null,
          packageAudience: null,
          packageStatus: null,
          packageExpiresAt: null,
          workspaceMode: null,
          sessionId,
          licensedSession: false,
        });

        response.cookies.set("gx_client_installation", installationId, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: shouldUseSecureCookies(),
          maxAge: 60 * 60 * 24 * 365,
        });

        if (token) {
          response.cookies.set("aicloser_token", token, {
            path: "/",
            httpOnly: true,
            secure: shouldUseSecureCookies(),
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60,
          });
        }
        return response;
      }
    } else if (centralRes?.status === 409) {
      const errorData = await centralRes.json().catch(() => null);
      const conflictMsg = errorData?.message || errorData?.error || "An account with this email or phone number already exists.";
      return NextResponse.json({ ok: false, error: conflictMsg, message: conflictMsg }, { status: 409 });
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

  const destination = "/?tab=dashboard";
  const installationId = `web-${crypto.randomUUID()}`;
  let clientSessionId = crypto.randomUUID();
  try {
    const clientSession = await acquireAppClientSession({
      userId: result.user.id,
      tenantId: result.user.tenantId,
      channel: "DESKTOP",
      installationId,
      deviceName: "Desktop Web",
      platform: "WEB",
      replaceExisting: true,
    });
    clientSessionId = clientSession.session.sessionId;
  } catch {
    // fallback
  }

  const sessionToken = await createSessionToken({
    userId: result.user.id,
    role: result.user.role,
    assignedRole: result.user.assignedRole,
    tenantId: result.user.tenantId,
    displayName: result.user.displayName,
    email: result.user.email,
    phone: result.user.phone,
    packageId: result.user.packageId,
    packageName: result.user.packageName,
    packageAudience: result.user.packageAudience,
    packageStatus: result.user.packageStatus,
    packageExpiresAt: result.user.packageExpiresAt,
    workspaceMode: result.user.workspaceMode,
    sessionId: clientSessionId,
    licensedSession: false,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });

  const response = NextResponse.json({
    ok: true,
    token: sessionToken,
    user: result.user,
    agent: result.agent,
    workspace: result.workspace,
    redirectTo: destination,
  });

  await applySessionCookie(response, {
    userId: result.user.id,
    role: result.user.role,
    assignedRole: result.user.assignedRole,
    tenantId: result.user.tenantId,
    displayName: result.user.displayName,
    email: result.user.email,
    phone: result.user.phone,
    packageId: result.user.packageId,
    packageName: result.user.packageName,
    packageAudience: result.user.packageAudience,
    packageStatus: result.user.packageStatus,
    packageExpiresAt: result.user.packageExpiresAt,
    workspaceMode: result.user.workspaceMode,
    sessionId: clientSessionId,
    licensedSession: false,
  });

  response.cookies.set("gx_client_installation", installationId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    maxAge: 60 * 60 * 24 * 365,
  });

  response.cookies.set("aicloser_token", sessionToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
