import { NextResponse } from "next/server";

import { toMobileSession } from "@/lib/auth/mobile-session";
import { createSessionPayload } from "@/lib/auth/session";
import { authenticatePassword } from "@/lib/auth/store";
import { createSessionToken } from "@/lib/auth/token";
import { acquireAppClientSession, ClientSlotOccupiedError } from "@/lib/auth/client-sessions";
import { getSalesAgentAccess } from "@/lib/gigxomi/sales-store";
import { prisma } from "@/lib/prisma";

type MobileLoginBody = {
  identifier?: unknown;
  email?: unknown;
  password?: unknown;
  loginScope?: unknown;
  role?: unknown;
  installationId?: unknown;
  deviceName?: unknown;
  appVersion?: unknown;
  replaceExisting?: unknown;
  forceReplace?: unknown;
  force?: unknown;
};

function readBodyString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  let body: MobileLoginBody;

  try {
    body = (await request.json()) as MobileLoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON login body." }, { status: 400 });
  }

  const identifier = (readBodyString(body.identifier) || readBodyString(body.email)).trim();
  const password = readBodyString(body.password);
  const rawScope = (readBodyString(body.loginScope) || readBodyString(body.role)).trim().toLowerCase();
  const requireManager = rawScope === "manager";
  const requireSales = rawScope === "sales" || rawScope === "sales_agent";
  const installationId = readBodyString(body.installationId).trim();

  if (!identifier || !password) {
    return NextResponse.json({ ok: false, error: "Email or phone and password are required." }, { status: 400 });
  }

  const user = await authenticatePassword(identifier, password, { updateLastLogin: false });
  if (!user) {
    return NextResponse.json({ ok: false, error: "InvalidCredentials", message: "Invalid email/phone or password" }, { status: 401 });
  }
  if (!installationId) {
    return NextResponse.json({ ok: false, error: "MissingClientIdentity", message: "installationId is required for mobile login" }, { status: 400 });
  }
  const salesAccess = ["ADMIN", "MANAGER", "SALES_AGENT"].includes(user.role)
    ? await getSalesAgentAccess(user.id)
    : null;
  const workspaceRole = String(salesAccess?.agent?.permissions?.workspaceRole ?? "").toUpperCase();
  const effectiveRole = workspaceRole === "ADMIN" || workspaceRole === "MANAGER" || workspaceRole === "SALES_AGENT"
    ? workspaceRole
    : user.role;

  if (requireManager && effectiveRole !== "MANAGER") {
    return NextResponse.json({ ok: false, error: "This login is only for manager accounts." }, { status: 403 });
  }
  if (requireSales && !["ADMIN", "MANAGER", "SALES_AGENT"].includes(effectiveRole)) {
    return NextResponse.json({ ok: false, error: "This login is only for active GXClosers sales accounts." }, { status: 403 });
  }
  if (requireSales && !salesAccess?.ok) {
    const message = salesAccess?.reason === "PENDING"
      ? "Your sales account is waiting for approval."
      : salesAccess?.reason === "SUSPENDED"
        ? "Your sales account is suspended. Contact support."
        : "Your sales profile was not found. Contact your workspace admin.";
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }

  let clientSession;
  try {
    const replaceExisting = body.replaceExisting === true || body.forceReplace === true || body.force === true;
    clientSession = await acquireAppClientSession({
      userId: user.id,
      tenantId: user.tenantId,
      channel: "MOBILE",
      installationId,
      deviceId: installationId,
      deviceName: readBodyString(body.deviceName).trim() || "Mobile App",
      platform: "ANDROID",
      appVersion: readBodyString(body.appVersion).trim() || null,
      replaceExisting,
    });
  } catch (error) {
    if (error instanceof ClientSlotOccupiedError) {
      return NextResponse.json({
        ok: false,
        error: error.code,
        message: "Your mobile account is already active on another device.",
        deviceName: error.deviceName,
        lastActiveAt: error.lastActiveAt?.toISOString() ?? null,
      }, { status: 409 });
    }
    throw error;
  }
  await prisma.appAuthUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const session = createSessionPayload({
    userId: user.id,
    role: effectiveRole,
    assignedRole: effectiveRole,
    tenantId: user.tenantId,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    packageId: user.packageId,
    packageName: user.packageName,
    packageAudience: user.packageAudience,
    packageStatus: user.packageStatus,
    packageExpiresAt: user.packageExpiresAt,
    workspaceMode: user.workspaceMode,
    sessionId: clientSession.session.sessionId,
    licensedSession: true,
  });
  const token = await createSessionToken(session);

  return NextResponse.json({
    ok: true,
    token,
    session: toMobileSession(session),
  });
}
