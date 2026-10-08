import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { prisma } from "@/lib/prisma";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import {
  type RoundRobinSettings,
  readRoundRobinSettings,
  saveRoundRobinSettings,
} from "@/lib/gigxomi/round-robin-service";

export type { RoundRobinSettings };

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  const [settings, salesSnapshot] = await Promise.all([
    readRoundRobinSettings(tenantId),
    getSalesSnapshotForRole(auth.session),
  ]);

  const scopedAgents = auth.session.role === "ADMIN" || auth.session.role === "SUPER_ADMIN"
    ? salesSnapshot.agents
    : salesSnapshot.visibleAgents;
  const activeAgents = scopedAgents.filter((a) =>
    a.status === "ACTIVE" && (!settings.participatingGroupId || a.groupId === settings.participatingGroupId),
  );

  // If no participating agents configured yet, default to all active agents
  if (!settings.participatingAgentIds.length && activeAgents.length) {
    settings.participatingAgentIds = activeAgents.map((a) => a.id);
  }

  // Count leads currently assigned to each agent
  const leadCountByAgent: Record<string, number> = {};
  for (const lead of salesSnapshot.visibleLeads) {
    if (lead.assignedAgentId) {
      leadCountByAgent[lead.assignedAgentId] = (leadCountByAgent[lead.assignedAgentId] || 0) + 1;
    }
  }

  return NextResponse.json({
    ok: true,
    settings,
    agents: activeAgents.map((agent, index) => ({
      id: agent.id,
      displayName: agent.displayName,
      email: agent.email,
      phone: agent.phone,
      groupId: agent.groupId,
      groupName: salesSnapshot.groups.find((group) => group.id === agent.groupId)?.name ?? "Unassigned group",
      activeLeadsCount: leadCountByAgent[agent.id] || 0,
      isParticipating: settings.participatingAgentIds.includes(agent.id),
      roundRobinOrder: index + 1,
    })),
    groups: salesSnapshot.groups
      .filter((group) => group.isActive)
      .filter((group) => auth.session.role === "ADMIN" || auth.session.role === "SUPER_ADMIN" || scopedAgents.some((agent) => agent.groupId === group.id)),
    isAdmin: auth.session.role === "ADMIN" || auth.session.role === "SUPER_ADMIN",
  });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    tenantId?: string;
    action?: "save_settings" | "distribute" | "assign_single";
    settings?: Partial<RoundRobinSettings>;
    leadIds?: string[];
  };

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId);
  const currentSettings = await readRoundRobinSettings(tenantId);
  const action = body.action || "save_settings";

  // Action 1: Save settings (Admin / Manager)
  if (action === "save_settings") {
    if (auth.session.role !== "ADMIN" && auth.session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Only workspace administrators can update distribution rules and permissions." }, { status: 403 });
    }

    const nextSettings: RoundRobinSettings = {
      ...currentSettings,
      ...body.settings,
      tenantId,
      updatedAt: new Date().toISOString(),
    };

    await saveRoundRobinSettings(tenantId, nextSettings);

    return NextResponse.json({
      ok: true,
      message: "Round-Robin lead distribution rules and role permissions saved successfully.",
      settings: nextSettings,
    });
  }

  // Action 2: Distribute selected or unassigned leads via Round-Robin
  if (action === "distribute") {
    if (auth.session.role === "SALES_AGENT") {
      return NextResponse.json({ ok: false, error: "Only workspace admins and managers can distribute queued leads." }, { status: 403 });
    }
    if (!currentSettings.enabled) {
      return NextResponse.json({ ok: false, error: "Round-robin distribution is disabled. Enable it before distributing leads." }, { status: 409 });
    }
    const activeAgents = await prisma.salesAgentProfile.findMany({
      where: {
        status: "ACTIVE",
        user: { tenantId },
        ...(currentSettings.participatingGroupId ? { groupId: currentSettings.participatingGroupId } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    });

    if (!activeAgents.length) {
      return NextResponse.json({ ok: false, error: "No active sales agents found in workspace." }, { status: 400 });
    }

    const candidateAgents = currentSettings.participatingAgentIds.length
      ? activeAgents.filter((a) => currentSettings.participatingAgentIds.includes(a.id))
      : activeAgents;

    const pool = candidateAgents.length ? candidateAgents : activeAgents;

    // Find leads to distribute
    const targetLeadIds = body.leadIds?.length ? body.leadIds : [];
    const targetContacts = ((body as unknown as { contacts?: Array<{ id: string; leadId?: string; name: string; phone?: string; email?: string; tags?: string[]; source?: string }> }).contacts) || [];

    let leadsToDistribute: Array<{ id: string; customerName: string; notes: string | null; tags: string[]; stage: string }> = [];
    if (targetLeadIds.length) {
      leadsToDistribute = await prisma.salesLeadAssignment.findMany({
        where: { id: { in: targetLeadIds }, assignedAgent: { user: { tenantId } } },
      });
    }

    let nextIdx = currentSettings.lastAssignedIndex;
    const distributionLog: Array<{ leadId: string; customerName: string; assignedTo: string }> = [];
    const processedLeadIds = new Set(leadsToDistribute.map((l) => l.id));

    // Also process contacts from targetContacts
    for (const c of targetContacts) {
      if (c.leadId && processedLeadIds.has(c.leadId)) continue;
      if (c.phone) {
        const clean = c.phone.replace(/\D/g, "");
        const existing = await prisma.salesLeadAssignment.findFirst({
          where: {
            assignedAgent: { user: { tenantId } },
            OR: [
              { customerPhone: c.phone },
              ...(clean.length >= 8 ? [{ customerPhone: { contains: clean.slice(-10) } }] : []),
            ],
          },
        });
        if (existing) {
          if (!processedLeadIds.has(existing.id)) {
            leadsToDistribute.push(existing);
            processedLeadIds.add(existing.id);
          }
          continue;
        }
      }

      // If no existing lead in database, create one directly assigned via Round-Robin
      nextIdx = (nextIdx + 1) % pool.length;
      const agent = pool[nextIdx];
      const newLead = await prisma.salesLeadAssignment.create({
        data: {
          tenantId,
          assignedAgentId: agent.id,
          customerName: (c.name || "Lead").trim(),
          customerPhone: c.phone?.trim() || null,
          customerEmail: c.email?.trim() || null,
          source: c.source || "round_robin_distribution",
          serviceInterest: "Unified Contacts Directory",
          segment: "CRM Contact",
          priority: "normal",
          budgetAmount: 0,
          notes: `[Round-Robin] Auto-assigned to ${agent.user.displayName} on ${new Date().toLocaleDateString("en-IN")}.`,
          tags: Array.from(new Set([...(c.tags || []), "Round-Robin Assigned"])),
          stage: "ASSIGNED",
          createdById: auth.session.userId,
        },
      });

      distributionLog.push({
        leadId: newLead.id,
        customerName: newLead.customerName,
        assignedTo: agent.user.displayName,
      });
    }

    if (!leadsToDistribute.length && !distributionLog.length && !targetLeadIds.length && !targetContacts.length) {
      leadsToDistribute = await prisma.salesLeadAssignment.findMany({
        where: { stage: "NEW", assignedAgent: { user: { tenantId } } },
        take: 200,
      });
    }

    for (const lead of leadsToDistribute) {
      nextIdx = (nextIdx + 1) % pool.length;
      const agent = pool[nextIdx];

      await prisma.salesLeadAssignment.update({
        where: { id: lead.id },
        data: {
          assignedAgentId: agent.id,
          tags: Array.from(new Set([...(lead.tags || []), "Round-Robin Assigned"])),
          notes: `${lead.notes ? `${lead.notes}\n` : ""}[Round-Robin] Auto-assigned to ${agent.user.displayName} on ${new Date().toLocaleDateString("en-IN")}.`,
          stage: (lead.stage === "NEW" ? "ASSIGNED" : lead.stage) as any,
          updatedAt: new Date(),
        },
      });

      distributionLog.push({
        leadId: lead.id,
        customerName: lead.customerName,
        assignedTo: agent.user.displayName,
      });
    }

    if (!distributionLog.length) {
      return NextResponse.json({ ok: false, error: "No eligible leads or contacts found to distribute." }, { status: 400 });
    }

    currentSettings.lastAssignedIndex = nextIdx;
    currentSettings.updatedAt = new Date().toISOString();
    await saveRoundRobinSettings(tenantId, currentSettings);

    return NextResponse.json({
      ok: true,
      distributedCount: distributionLog.length,
      participatingAgentsCount: pool.length,
      distributionLog,
      message: `Auto-distributed ${distributionLog.length} leads across ${pool.length} sales agents in round-robin sequence!`,
    });
  }

  return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
}
