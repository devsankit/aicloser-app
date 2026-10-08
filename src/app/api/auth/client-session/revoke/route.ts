import { createPublicRedirect } from "@/lib/auth/public-redirect";
import { authenticatePassword, findUserByIdentifier } from "@/lib/auth/store";
import { getSalesAgentAccess } from "@/lib/gigxomi/sales-store";
import { revokeActiveAppClientSession } from "@/lib/auth/client-sessions";
import { SUPER_ADMIN_LOGIN_ROUTE } from "@/lib/auth/super-admin-config";

export async function POST(request: Request) {
  let identifier = "";
  let password = "";
  let redirectTo = "";
  let loginScope = "sales";
  let clientType: "MOBILE" | "DESKTOP" = "DESKTOP";

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    identifier = String(body.identifier ?? "").trim();
    password = String(body.password ?? "").trim();
    redirectTo = String(body.redirectTo ?? "").trim();
    loginScope = String(body.loginScope ?? "sales").trim();
    clientType = body.clientType === "MOBILE" ? "MOBILE" : "DESKTOP";
  } else {
    const formData = await request.formData();
    identifier = String(formData.get("identifier") ?? "").trim();
    password = String(formData.get("password") ?? "").trim();
    redirectTo = String(formData.get("redirectTo") ?? "").trim();
    loginScope = String(formData.get("loginScope") ?? "sales").trim();
    clientType = String(formData.get("clientType") ?? "").trim().toUpperCase() === "MOBILE" ? "MOBILE" : "DESKTOP";
  }

  const loginPath = loginScope === "manager" ? "/manager-login" : loginScope === "super-admin" ? SUPER_ADMIN_LOGIN_ROUTE : "/login";
  if (!identifier || !password) {
    return createPublicRedirect(loginPath, { error: "Identifier and password are required." });
  }

  const resolvedUser = await findUserByIdentifier(identifier);
  if (resolvedUser?.role === "SUPER_ADMIN" || loginScope === "super-admin") {
    return createPublicRedirect(SUPER_ADMIN_LOGIN_ROUTE, { error: "Session replacement is not available for the super-admin account." });
  }

  const user = await authenticatePassword(identifier, password, { updateLastLogin: false });
  if (!user) {
    return createPublicRedirect(loginPath, { error: "InvalidCredentials: Invalid email/phone or password.", identifier, clientType, redirectTo });
  }

  const salesAccess = ["ADMIN", "MANAGER", "SALES_AGENT"].includes(user.role) ? await getSalesAgentAccess(user.id) : null;
  const workspaceRole = String(salesAccess?.agent?.permissions?.workspaceRole ?? "").toUpperCase();
  const effectiveRole = workspaceRole === "ADMIN" || workspaceRole === "MANAGER" || workspaceRole === "SALES_AGENT" ? workspaceRole : user.role;

  if (loginScope === "manager" && effectiveRole !== "MANAGER") {
    return createPublicRedirect(loginPath, { error: "Only manager accounts can use this login page.", identifier, clientType, redirectTo });
  }
  if (loginScope === "sales" && effectiveRole !== "SALES_AGENT" && effectiveRole !== "ADMIN") {
    return createPublicRedirect(loginPath, { error: "Only approved sales accounts can sign in here.", identifier, clientType, redirectTo });
  }
  if (loginScope === "sales" && !salesAccess?.ok) {
    return createPublicRedirect(loginPath, {
      error:
        salesAccess?.reason === "PENDING"
          ? "Your sales account is waiting for approval."
          : salesAccess?.reason === "SUSPENDED"
            ? "Your sales account is suspended. Contact support."
            : "Your sales profile was not found. Request access again or contact support.",
      identifier,
      clientType,
      redirectTo,
    });
  }

  await revokeActiveAppClientSession({
    userId: user.id,
    tenantId: user.tenantId,
    channel: clientType,
    reason: `Logged out from the login screen before signing in on another ${clientType.toLowerCase()} installation`,
  });

  return createPublicRedirect(loginPath, {
    identifier,
    clientType,
    redirectTo,
    message: `The other ${clientType.toLowerCase()} session was logged out. You can now sign in here.`,
  });
}
