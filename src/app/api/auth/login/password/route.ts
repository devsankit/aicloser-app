import { createPublicRedirect, sanitizePublicAuthError } from "@/lib/auth/public-redirect";
import { cookies } from "next/headers";
import { SUPER_ADMIN_HOME_ROUTE, SUPER_ADMIN_LOGIN_ROUTE } from "@/lib/auth/super-admin-config";
import { authenticatePassword, findUserByIdentifier } from "@/lib/auth/store";
import { applySessionCookie, getDashboardPathForIdentity, getDefaultDashboardPath, getSafeRedirectPath } from "@/lib/auth/session";
import { getSalesAgentAccess } from "@/lib/gigxomi/sales-store";
import { acquireAppClientSession, ClientSlotOccupiedError } from "@/lib/auth/client-sessions";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let loginPath = "/login";
  try {
    let identifier = "";
    let password = "";
    let redirectTo = "";
    let rawLoginScope = "";
    let clientType: "MOBILE" | "DESKTOP" = "DESKTOP";
    let installationId = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      identifier = String(body.identifier ?? "").trim();
      password = String(body.password ?? "").trim();
      redirectTo = String(body.redirectTo ?? "").trim();
      rawLoginScope = String(body.loginScope ?? "").trim();
      clientType = body.clientType === "MOBILE" ? "MOBILE" : "DESKTOP";
      installationId = String(body.installationId ?? "").trim();
    } else {
      const formData = await request.formData();
      identifier = String(formData.get("identifier") ?? "").trim();
      password = String(formData.get("password") ?? "").trim();
      redirectTo = String(formData.get("redirectTo") ?? "").trim();
      rawLoginScope = String(formData.get("loginScope") ?? "").trim();
      clientType = String(formData.get("clientType") ?? "").trim().toUpperCase() === "MOBILE" ? "MOBILE" : "DESKTOP";
      installationId = String(formData.get("installationId") ?? "").trim();
    }

    const requestCookies = await cookies();
    installationId = installationId || request.headers.get("x-installation-id")?.trim() || requestCookies.get("gx_client_installation")?.value?.trim() || (clientType === "DESKTOP" ? crypto.randomUUID() : "");

    const loginScope = rawLoginScope === "super-admin" || rawLoginScope === "manager" || rawLoginScope === "sales" ? rawLoginScope : "public";
    loginPath = loginScope === "super-admin" ? SUPER_ADMIN_LOGIN_ROUTE : loginScope === "manager" ? "/manager-login" : "/login";

    if (!identifier || !password) {
      return createPublicRedirect(loginPath, { error: "Identifier and password are required." });
    }

    const resolvedUser = await findUserByIdentifier(identifier);
    if (resolvedUser?.role === "SUPER_ADMIN" && loginScope !== "super-admin") {
      return createPublicRedirect(SUPER_ADMIN_LOGIN_ROUTE, {
        identifier,
        message: "Use the dedicated super-admin login page for the owner account.",
      });
    }

    if (loginScope === "super-admin" && resolvedUser?.role !== "SUPER_ADMIN") {
      return createPublicRedirect(SUPER_ADMIN_LOGIN_ROUTE, { error: "Only the authorized super-admin account can sign in here." });
    }

    const user = await authenticatePassword(identifier, password, { updateLastLogin: false });
    if (!user) {
      return createPublicRedirect(loginPath, { error: "InvalidCredentials: Invalid email/phone or password." });
    }

    if (!installationId) {
      return createPublicRedirect(loginPath, { error: "MissingClientIdentity: This app must provide its installation ID." });
    }
    let effectiveRole = user.role;
    let effectiveAssignedRole = user.assignedRole;
    const salesAccess = ["ADMIN", "MANAGER", "SALES_AGENT"].includes(user.role)
      ? await getSalesAgentAccess(user.id)
      : null;
    const workspaceRole = String(salesAccess?.agent?.permissions?.workspaceRole ?? "").toUpperCase();
    if (workspaceRole === "ADMIN" || workspaceRole === "MANAGER" || workspaceRole === "SALES_AGENT") {
      effectiveRole = workspaceRole;
      effectiveAssignedRole = workspaceRole;
    }

    if (loginScope === "manager" && effectiveRole !== "MANAGER") {
      return createPublicRedirect("/manager-login", { error: "Only manager accounts can sign in from the manager login page." });
    }

    if (loginScope === "sales") {
      if (effectiveRole !== "SALES_AGENT" && effectiveRole !== "ADMIN") {
        return createPublicRedirect("/login", { error: "Only approved sales accounts can sign in here." });
      }
      if (!salesAccess?.ok) {
        return createPublicRedirect("/login", {
          error:
            salesAccess?.reason === "PENDING"
              ? "Your sales account is waiting for approval."
              : salesAccess?.reason === "SUSPENDED"
                ? "Your sales account is suspended. Contact support."
                : "Your sales profile was not found. Request access again or contact support.",
        });
      }
    }

    let clientSession;
    try {
      clientSession = await acquireAppClientSession({
        userId: user.id,
        tenantId: user.tenantId,
        channel: clientType,
        installationId,
        deviceId: clientType === "MOBILE" ? installationId : null,
        deviceName: clientType === "MOBILE" ? "Mobile App" : "Desktop Web",
        platform: clientType === "MOBILE" ? "ANDROID" : "WEB",
      });
    } catch (error) {
      if (error instanceof ClientSlotOccupiedError) {
        return createPublicRedirect(loginPath, { error: `ClientSlotOccupied: This user already has an active ${clientType.toLowerCase()} session.` });
      }
      throw error;
    }
    await prisma.appAuthUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const destination =
      loginScope === "super-admin"
        ? redirectTo.trim()
          ? getSafeRedirectPath(redirectTo, effectiveRole)
          : SUPER_ADMIN_HOME_ROUTE
        : loginScope === "manager"
          ? redirectTo.trim()
            ? getSafeRedirectPath(redirectTo, effectiveRole)
            : "/manager/chat"
        : loginScope === "sales"
          ? redirectTo.trim()
            ? getSafeRedirectPath(redirectTo, effectiveRole)
            : "/"
        : redirectTo.trim()
          ? getSafeRedirectPath(redirectTo, effectiveRole)
          : getDashboardPathForIdentity({
              role: effectiveRole,
              packageAudience: user.packageAudience,
              workspaceMode: user.workspaceMode,
            });
    const response = createPublicRedirect(destination || getDefaultDashboardPath(effectiveRole));

    await applySessionCookie(response, {
      userId: user.id,
      role: effectiveRole,
      assignedRole: effectiveAssignedRole,
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
    response.cookies.set("gx_client_installation", installationId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error) {
    console.error("Password login failed", error);
    return createPublicRedirect(loginPath, {
      error: sanitizePublicAuthError(error, "We could not sign you in right now. Please try again in a moment."),
    });
  }
}
