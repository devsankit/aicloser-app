import { prisma } from "@/lib/prisma";

export const DEFAULT_SHOW_ONLY_ASSIGNED_CHATS = true;

function normalizeTenantId(tenantId: string | null | undefined) {
  const normalized = tenantId?.trim();
  return normalized || null;
}

export async function showOnlyAssignedChatsForTenant(tenantId: string | null | undefined) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const settings = normalizedTenantId
    ? await prisma.salesSettings.findUnique({
        where: { tenantId: normalizedTenantId },
        select: { showOnlyAssignedChats: true },
      })
    : null;

  if (settings) return settings.showOnlyAssignedChats;

  const globalSettings = await prisma.salesSettings.findUnique({
    where: { id: "sales-settings" },
    select: { showOnlyAssignedChats: true },
  });
  return globalSettings?.showOnlyAssignedChats ?? DEFAULT_SHOW_ONLY_ASSIGNED_CHATS;
}

export async function saveShowOnlyAssignedChats(tenantId: string, enabled: boolean) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) throw new Error("TenantScopeRequired");

  return prisma.salesSettings.upsert({
    where: { tenantId: normalizedTenantId },
    update: { showOnlyAssignedChats: enabled },
    create: {
      id: `sales-settings-${normalizedTenantId}`,
      tenantId: normalizedTenantId,
      showOnlyAssignedChats: enabled,
    },
    select: { showOnlyAssignedChats: true, tenantId: true },
  });
}

export async function getSalesAgentAssignedScope(userIdOrAgentId: string) {
  let agent = await prisma.salesAgentProfile.findUnique({
    where: { userId: userIdOrAgentId },
    select: { id: true, userId: true, status: true },
  });
  if (!agent) {
    agent = await prisma.salesAgentProfile.findUnique({
      where: { id: userIdOrAgentId },
      select: { id: true, userId: true, status: true },
    });
  }
  if (!agent || agent.status !== "ACTIVE") {
    return {
      conversationIds: new Set<string>(),
      phones: new Set<string>(),
      connectedPhone: null,
    };
  }

  const assignments = await prisma.salesLeadAssignment.findMany({
    where: {
      assignedAgentId: agent.id,
    },
    select: { conversationId: true, customerPhone: true },
  });

  const conversationIds = new Set<string>();
  const phones = new Set<string>();
  for (const a of assignments) {
    if (a.conversationId) conversationIds.add(a.conversationId);
    if (a.customerPhone) {
      const last10 = a.customerPhone.replace(/\D/g, "").slice(-10);
      if (last10) phones.add(last10);
    }
  }

  let connectedPhone: string | null = null;
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const sessionPath = path.join(process.cwd(), ".gigxomi", "whatsapp-scanner-sessions.json");
    const raw = await fs.readFile(sessionPath, "utf8");
    const parsed = JSON.parse(raw);
    const personalTenantId = `tenant-gigxomi-sales-agent-${agent.userId}`;
    if (parsed[personalTenantId]?.connectedPhone) {
      connectedPhone = parsed[personalTenantId].connectedPhone.replace(/\D/g, "").slice(-10) || null;
    }
  } catch {
    // ignore
  }

  return { conversationIds, phones, connectedPhone };
}

export async function getSalesAgentAssignedConversationIds(userId: string) {
  const scope = await getSalesAgentAssignedScope(userId);
  return scope.conversationIds;
}
