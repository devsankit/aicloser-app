import { NextResponse } from "next/server";

import { toMobileSession } from "@/lib/auth/mobile-session";
import { createSessionPayload } from "@/lib/auth/session";
import { authenticatePassword } from "@/lib/auth/store";
import { createSessionToken } from "@/lib/auth/token";
import { acquireAppClientSession, ClientSlotOccupiedError } from "@/lib/auth/client-sessions";
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
  if (requireManager && user.role !== "MANAGER") {
    return NextResponse.json({ ok: false, error: "This login is only for manager accounts." }, { status: 403 });
  }
  if (requireSales && user.role !== "SALES_AGENT") {
    return NextResponse.json({ ok: false, error: "This login is only for active GXClosers sales accounts." }, { status: 403 });
  }

  let clientSession;
  try {
    clientSession = await acquireAppClientSession({
      userId: user.id,
      tenantId: user.tenantId,
      channel: "MOBILE",
      installationId,
      deviceId: installationId,
      deviceName: readBodyString(body.deviceName).trim() || "Mobile App",
      platform: "ANDROID",
      appVersion: readBodyString(body.appVersion).trim() || null,
    });
  } catch (error) {
    if (error instanceof ClientSlotOccupiedError) {
      return NextResponse.json({ ok: false, error: error.code, message: "Your mobile account is already active on another device." }, { status: 409 });
    }
    throw error;
  }
  await prisma.appAuthUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const session = createSessionPayload({
    userId: user.id,
    role: user.role,
    assignedRole: user.assignedRole,
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
