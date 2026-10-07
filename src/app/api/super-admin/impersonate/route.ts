import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { applyImpersonationCookies } from "@/lib/auth/impersonation";
import { applySessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = String(body.userId ?? "").trim();

    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID is required." }, { status: 400 });
    }

    const targetUser = await prisma.appAuthUser.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "Target user not found." }, { status: 404 });
    }

    // Ensure SalesAgentProfile exists and is ACTIVE so dashboard at '/' works seamlessly
    let agentProfile = await prisma.salesAgentProfile.findFirst({ where: { userId } });
    if (!agentProfile) {
      const sanitized = targetUser.displayName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "AGENT";
      const hex = Math.random().toString(16).slice(2, 8).toUpperCase();
      agentProfile = await prisma.salesAgentProfile.create({
        data: {
          userId,
          agentCode: `GX-${sanitized}-${hex}`,
          status: "ACTIVE",
          maxActiveLeads: 50,
          permissions: {
            companyName: `${targetUser.displayName}'s Workspace`,
            workspaceRole: "ADMIN",
            workspaceAdmin: true,
            isWorkspaceOwner: true,
            seatLimit: 5,
            maxUsers: 5,
            seats: 5,
          },
        },
      });
    } else if (agentProfile.status !== "ACTIVE") {
      agentProfile = await prisma.salesAgentProfile.update({
        where: { id: agentProfile.id },
        data: { status: "ACTIVE" },
      });
    }

    const cookieStore = await cookies();
    const superAdminToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!superAdminToken) {
      return NextResponse.json({ ok: false, error: "Super Admin session token missing." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, redirectUrl: "/" });

    // Store Super Admin session for return
    applyImpersonationCookies(response, {
      superAdminSessionToken: superAdminToken,
      agencyUserId: targetUser.id,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    // Set cookie with target user name for display
    response.cookies.set("gx_impersonating_name", encodeURIComponent(targetUser.displayName), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 3600,
    });

    // Apply target user session
    await applySessionCookie(response, {
      userId: targetUser.id,
      role: "SALES_AGENT",
      assignedRole: "SALES_AGENT",
      tenantId: targetUser.tenantId || `tenant-${targetUser.id.slice(-6)}`,
      displayName: targetUser.displayName,
      email: targetUser.email,
      phone: targetUser.phone,
      packageId: targetUser.packageId,
      packageName: targetUser.packageName || "Pro Workspace",
      packageAudience: targetUser.packageAudience,
      packageStatus: "ACTIVE",
      packageExpiresAt: null,
      workspaceMode: "AGENCY",
    });

    return response;
  } catch (error) {
    console.error("Super Admin Impersonate error:", error);
    return NextResponse.json({ ok: false, error: "Failed to impersonate user." }, { status: 500 });
  }
}
