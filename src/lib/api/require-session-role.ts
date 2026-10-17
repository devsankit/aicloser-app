import { NextResponse } from "next/server";

import { getSessionContext } from "@/lib/auth/session";
import type { AppRole, SessionUser } from "@/lib/auth/types";
import { getSalesAgentAccess } from "@/lib/gigxomi/sales-store";
import { getWorkspacePaymentState } from "@/lib/billing/workspace-access";

type AuthorizedSession = Omit<SessionUser, "expiresAt" | "sessionId"> & Pick<SessionUser, "expiresAt" | "sessionId">;

type AuthorizedResult =
  | {
      ok: true;
      session: AuthorizedSession;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireSessionRole(allowedRoles: AppRole[]): Promise<AuthorizedResult> {
  const session = await getSessionContext();
  const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

  if (session.role === "GUEST" || !session.userId || !session.sessionId || !session.expiresAt) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 }),
    };
  }

  let isAuthorizedRole =
    allowedRoles.includes(session.role) ||
    (allowedRoles.includes("SALES_AGENT") && session.role === "ADMIN") ||
    (allowedRoles.includes("ADMIN") && session.role === "SUPER_ADMIN");

  if (!isAuthorizedRole && hasDatabase && allowedRoles.includes("ADMIN") && session.userId) {
    const access = await getSalesAgentAccess(session.userId);
    const permissions = access.agent?.permissions as Record<string, unknown> | null | undefined;
    const isProfileWorkspaceAdmin =
      permissions?.workspaceAdmin === true ||
      String(permissions?.workspaceRole ?? "").toUpperCase() === "ADMIN";
    if (access.ok && isProfileWorkspaceAdmin) {
      isAuthorizedRole = true;
    }
  }

  if (!isAuthorizedRole) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "You do not have access to this action." }, { status: 403 }),
    };
  }

  if (hasDatabase && session.userId && session.role !== "SUPER_ADMIN") {
    const paymentState = await getWorkspacePaymentState(session.userId);
    if (paymentState.locked) {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, error: "PLAN_ACTIVATION_REQUIRED", redirectTo: "/activate-plan" }, { status: 402 }),
      };
    }
  }

  if (hasDatabase && (session.role === "SALES_AGENT" || session.role === "ADMIN")) {
    const access = await getSalesAgentAccess(session.userId);
    if (access.agent && !access.ok) {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, error: "Your sales account is not active." }, { status: 403 }),
      };
    }
  }

  return {
    ok: true,
    session: {
      userId: session.userId,
      role: session.role,
      assignedRole: session.assignedRole ?? session.role,
      tenantId: session.tenantId,
      displayName: session.displayName ?? "User",
      email: session.email,
      phone: session.phone ?? "",
      packageId: session.packageId,
      packageName: session.packageName,
      packageAudience: session.packageAudience,
      packageStatus: session.packageStatus,
      packageExpiresAt: session.packageExpiresAt,
      workspaceMode: session.workspaceMode,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    },
  };
}
