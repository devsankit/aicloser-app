import "server-only";

import { redirect } from "next/navigation";

import { SUPER_ADMIN_LOGIN_ROUTE } from "@/lib/auth/super-admin-config";
import { getSessionContext } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/types";
import { getWorkspacePaymentState } from "@/lib/billing/workspace-access";

export async function requirePageRole(allowedRoles: AppRole[], path: string) {
  const session = await getSessionContext();

  if (session.role === "GUEST" || !session.userId) {
    const loginPath =
      allowedRoles.length === 1 && allowedRoles[0] === "SUPER_ADMIN"
        ? SUPER_ADMIN_LOGIN_ROUTE
        : allowedRoles.length === 1 && allowedRoles[0] === "SALES_AGENT"
          ? "/login"
          : "/login";
    redirect(`${loginPath}?redirectTo=${encodeURIComponent(path)}`);
  }

  if (!allowedRoles.includes(session.role)) {
    redirect(`/unauthorized?from=${encodeURIComponent(path)}`);
  }

  if (session.userId && session.role !== "SUPER_ADMIN") {
    const paymentState = await getWorkspacePaymentState(session.userId);
    if (paymentState.locked && path !== "/activate-plan") {
      redirect("/activate-plan");
    }
  }

  return session;
}
