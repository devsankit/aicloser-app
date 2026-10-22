import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { applyImpersonationCookies, SUPER_ADMIN_RETURN_COOKIE_NAME } from "@/lib/auth/impersonation";
import { applySessionCookie, createSessionPayload, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createSessionToken } from "@/lib/auth/token";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = String(body.userId ?? "").trim();
    const tenantId = String(body.tenantId ?? "").trim();
    const requestedWorkspaceName = String(body.workspaceName ?? "").trim();

    let targetUser: any = null;
    let targetTenantId = tenantId;
    let workspaceName = requestedWorkspaceName;

    if (tenantId) {
      const workspace = await prisma.aicloserWorkspace.findUnique({ where: { id: tenantId } });
      if (workspace) {
        workspaceName = workspace.name || workspaceName;
        if (workspace.ownerUserId) {
          targetUser = await prisma.appAuthUser.findUnique({ where: { id: workspace.ownerUserId } });
        }
      }
      if (!targetUser) {
        targetUser = await prisma.appAuthUser.findFirst({
          where: { tenantId, role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        });
      }
      if (!targetUser) {
        targetUser = await prisma.appAuthUser.findFirst({
          where: { tenantId },
        });
      }
      if (!targetUser) {
        const ownerEmail = workspace?.ownerEmail || `admin@${workspace?.slug || tenantId}.local`;
        targetUser = await prisma.appAuthUser.upsert({
          where: { email: ownerEmail },
          update: { tenantId, role: "ADMIN", packageStatus: "ACTIVE" },
          create: {
            email: ownerEmail,
            displayName: workspaceName ? `${workspaceName} Admin` : "Workspace Admin",
            passwordHash: "$2b$10$impersonationPlaceholderHash000000000000000000000",
            role: "ADMIN",
            tenantId,
            packageStatus: "ACTIVE",
            phone: workspace?.ownerPhone || "",
          },
        });
      }
    } else if (userId) {
      targetUser = await prisma.appAuthUser.findUnique({ where: { id: userId } });
      if (!targetUser) {
        return NextResponse.json({ ok: false, error: "Target user not found." }, { status: 404 });
      }
      targetTenantId = targetUser.tenantId ?? "";
    } else {
      return NextResponse.json({ ok: false, error: "Either tenantId or userId is required." }, { status: 400 });
    }

    // Ensure SalesAgentProfile exists and is ACTIVE so dashboard at '/' and '/pipeline' works seamlessly
    let agentProfile = await prisma.salesAgentProfile.findFirst({ where: { userId: targetUser.id } });
    if (!agentProfile) {
      const sanitized = targetUser.displayName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "AGENT";
      const hex = Math.random().toString(16).slice(2, 8).toUpperCase();
      agentProfile = await prisma.salesAgentProfile.create({
        data: {
          tenantId: targetTenantId || targetUser.tenantId || "tenant-gigxomi",
          userId: targetUser.id,
          agentCode: `GX-${sanitized}-${hex}`,
          status: "ACTIVE",
          maxActiveLeads: 50,
          permissions: {
            companyName: workspaceName || `${targetUser.displayName}'s Workspace`,
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

    const targetPermissions = (agentProfile.permissions as Record<string, unknown> | null | undefined) ?? {};
    const targetWorkspaceRole = String(targetPermissions.workspaceRole ?? "").toUpperCase();
    const impersonatedRole = targetPermissions.workspaceAdmin === true || targetWorkspaceRole === "ADMIN"
      ? "ADMIN"
      : targetWorkspaceRole === "MANAGER"
        ? "MANAGER"
        : "SALES_AGENT";

    const cookieStore = await cookies();
    const superAdminToken =
      cookieStore.get(SUPER_ADMIN_RETURN_COOKIE_NAME)?.value ||
      cookieStore.get(SESSION_COOKIE_NAME)?.value ||
      cookieStore.get("aicloser_token")?.value;

    const resolvedTenantId = targetTenantId || targetUser.tenantId || `tenant-${targetUser.id.slice(-6)}`;
    const resolvedDisplayName = targetUser.displayName;
    const resolvedWorkspaceName = workspaceName || resolvedDisplayName;

    const sessionPayload = createSessionPayload({
      userId: targetUser.id,
      role: impersonatedRole,
      assignedRole: impersonatedRole,
      tenantId: resolvedTenantId,
      displayName: resolvedDisplayName,
      email: targetUser.email,
      phone: targetUser.phone ?? "",
      packageId: targetUser.packageId,
      packageName: targetUser.packageName || resolvedWorkspaceName || "Pro Workspace",
      packageAudience: targetUser.packageAudience,
      packageStatus: "ACTIVE",
      packageExpiresAt: null,
      workspaceMode: "AGENCY",
    });

    const token = await createSessionToken(sessionPayload);

    const response = NextResponse.json({
      ok: true,
      token,
      redirectUrl: "/pipeline",
      targetTenantId: resolvedTenantId,
      workspaceName: resolvedWorkspaceName,
    });

    // Store Super Admin session for return
    if (superAdminToken) {
      applyImpersonationCookies(response, {
        superAdminSessionToken: superAdminToken,
        agencyUserId: targetUser.id,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      });
    }

    // Set cookie with target user/workspace name for display
    response.cookies.set("gx_impersonating_name", encodeURIComponent(resolvedWorkspaceName), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 7200,
    });
    response.cookies.set("gx_tenant", resolvedTenantId, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 7200,
    });
    response.cookies.set("gx_role", impersonatedRole, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 7200,
    });
    response.cookies.set("gx_user_name", encodeURIComponent(resolvedDisplayName), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 7200,
    });
    if (targetUser.email) {
      response.cookies.set("gx_user_email", encodeURIComponent(targetUser.email), {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        maxAge: 7200,
      });
    }

    // Apply target user session cookies (gx_session, aicloser_token, gx_role, gx_tenant)
    await applySessionCookie(response, {
      userId: targetUser.id,
      role: impersonatedRole,
      assignedRole: impersonatedRole,
      tenantId: resolvedTenantId,
      displayName: resolvedDisplayName,
      email: targetUser.email,
      phone: targetUser.phone ?? "",
      packageId: targetUser.packageId,
      packageName: targetUser.packageName || resolvedWorkspaceName || "Pro Workspace",
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
