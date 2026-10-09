import { NextResponse } from "next/server";

import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";

function isWorkspaceAdmin(permissions: unknown) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return false;
  const value = permissions as Record<string, unknown>;
  return value.workspaceAdmin === true || String(value.workspaceRole ?? "").toUpperCase() === "ADMIN";
}

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));
    const requestedAgentId = url.searchParams.get("agentId")?.trim() || "all";
    const profiles = await prisma.salesAgentProfile.findMany({
      where: { user: { tenantId } },
      select: {
        id: true,
        userId: true,
        parentAgentId: true,
        permissions: true,
        status: true,
        user: { select: { displayName: true, email: true } },
      },
    });

    const activeProfiles = profiles.filter((profile) => profile.status === "ACTIVE" && !isWorkspaceAdmin(profile.permissions));
    const currentProfile = profiles.find((profile) => profile.userId === auth.session.userId);
    const currentIsWorkspaceAdmin = auth.session.role === "ADMIN" || auth.session.role === "SUPER_ADMIN" || isWorkspaceAdmin(currentProfile?.permissions);
    const visibleProfiles = currentIsWorkspaceAdmin
      ? activeProfiles
      : auth.session.role === "MANAGER" && currentProfile
        ? activeProfiles.filter((profile) => profile.id === currentProfile.id || profile.parentAgentId === currentProfile.id)
        : activeProfiles.filter((profile) => profile.id === currentProfile?.id);
    const visibleAgentIds = visibleProfiles.map((profile) => profile.id);
    const selectedAgentId = requestedAgentId === "all" ? null : requestedAgentId;
    if (selectedAgentId && !visibleAgentIds.includes(selectedAgentId)) {
      return NextResponse.json({ ok: false, error: "That user is outside your reporting scope." }, { status: 403 });
    }
    const agentFilter = selectedAgentId
      ? { tenantId, agentId: selectedAgentId }
      : { tenantId, agentId: { in: visibleAgentIds } };
    const [totalCalls, inboundCalls, outboundCalls, missedCalls, uploadedRecordings, duration, rows] = await Promise.all([
      prisma.salesMobileCall.count({ where: agentFilter }),
      prisma.salesMobileCall.count({ where: { ...agentFilter, direction: "INBOUND" } }),
      prisma.salesMobileCall.count({ where: { ...agentFilter, direction: "OUTBOUND" } }),
      prisma.salesMobileCall.count({ where: { ...agentFilter, status: "MISSED" } }),
      prisma.salesMobileCall.count({ where: { ...agentFilter, recordingStatus: "UPLOADED" } }),
      prisma.salesMobileCall.aggregate({ where: agentFilter, _sum: { durationSeconds: true } }),
      prisma.salesMobileCall.findMany({
        where: agentFilter,
        include: {
          assignment: { select: { customerName: true } },
          agent: { include: { user: { select: { displayName: true, email: true } } } },
        },
        orderBy: { startedAt: "desc" },
        take: 100,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      totals: {
        totalCalls,
        inboundCalls,
        outboundCalls,
        missedCalls,
        talkTimeSeconds: duration._sum.durationSeconds ?? 0,
        uploadedRecordings,
      },
      calls: rows.map((call) => ({
        id: call.id,
        agentId: call.agentId,
        agentName: call.agent.user.displayName || call.agent.user.email || "Sales user",
        customerName: call.assignment.customerName,
        phoneNumber: call.phoneNumber,
        direction: call.direction,
        status: call.status,
        durationSeconds: call.durationSeconds ?? 0,
        recordingStatus: call.recordingStatus,
        recordingError: call.recordingError ?? "",
        outcome: call.outcome ?? "",
        note: call.note ?? "",
        startedAt: call.startedAt.toISOString(),
        endedAt: call.endedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[call-reports] failed", error);
    return NextResponse.json({ ok: false, error: "Call reports are temporarily unavailable." }, { status: 500 });
  }
}
