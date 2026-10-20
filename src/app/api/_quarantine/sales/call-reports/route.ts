import { NextResponse } from "next/server";

import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { centralApiRequest } from "@/lib/central-api-server";

function isWorkspaceAdmin(permissions: unknown) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return false;
  const value = permissions as Record<string, unknown>;
  return value.workspaceAdmin === true || String(value.workspaceRole ?? "").toUpperCase() === "ADMIN";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = new URLSearchParams({
      page: String(Math.max(1, Number(url.searchParams.get("page")) || 1)),
      limit: String(Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || url.searchParams.get("limit")) || 50))),
    });
    for (const key of ["outcome", "recordingStatus"]) {
      const value = url.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const payload = await centralApiRequest<{ data?: Array<Record<string, unknown>>; pagination?: { total?: number; page?: number; limit?: number; totalPages?: number } }>(`/calls?${query.toString()}`);
    const calls = payload.data ?? [];
    const totals = {
      totalCalls: payload.pagination?.total ?? calls.length,
      inboundCalls: calls.filter((call) => String(call.direction).toUpperCase() === "INBOUND").length,
      outboundCalls: calls.filter((call) => String(call.direction).toUpperCase() === "OUTBOUND").length,
      missedCalls: calls.filter((call) => String(call.status).toUpperCase() === "MISSED").length,
      talkTimeSeconds: calls.reduce((sum, call) => sum + Number(call.durationSeconds ?? call.durationSec ?? 0), 0),
      uploadedRecordings: calls.filter((call) => String(call.recordingStatus).toUpperCase() === "UPLOADED").length,
    };
    return NextResponse.json({ ok: true, page: payload.pagination?.page ?? 1, pageSize: payload.pagination?.limit ?? calls.length, totalCount: payload.pagination?.total ?? calls.length, totalPages: payload.pagination?.totalPages ?? 1, totals, calls });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Central calls API unavailable." }, { status: 502 });
  }

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

    const activeProfiles = profiles.filter((profile) => profile.status === "ACTIVE" );
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
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize") || url.searchParams.get("limit")) || 100));
    const skip = (page - 1) * pageSize;
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const dateFilter = startDateParam || endDateParam ? {
      startedAt: {
        ...(startDateParam ? { gte: new Date(startDateParam) } : {}),
        ...(endDateParam ? { lte: new Date(endDateParam) } : {}),
      },
    } : {};

    const agentFilter = selectedAgentId
      ? { tenantId, agentId: selectedAgentId, ...dateFilter }
      : currentIsWorkspaceAdmin ? { tenantId, ...dateFilter } : { tenantId, agentId: { in: visibleAgentIds }, ...dateFilter };
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
          device: {
            select: {
              manufacturer: true,
              model: true,
              recordingCapability: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      totalCount: totalCalls,
      totalPages: Math.ceil(totalCalls / pageSize),
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
        deviceModel: call.device?.model ?? "",
        deviceManufacturer: call.device?.manufacturer ?? "",
        recordingCapability: call.device?.recordingCapability ?? "",
      })),
    });
  } catch (error) {
    console.error("[call-reports] failed", error);
    return NextResponse.json({ ok: false, error: "Call reports are temporarily unavailable." }, { status: 500 });
  }
}
