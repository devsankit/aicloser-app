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

export async function getSalesAgentAssignedConversationIds(userId: string) {
  const agent = await prisma.salesAgentProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!agent || agent.status !== "ACTIVE") return new Set<string>();

  const assignments = await prisma.salesLeadAssignment.findMany({
    where: {
      assignedAgentId: agent.id,
      conversationId: { not: null },
    },
    select: { conversationId: true },
  });

  return new Set(assignments.map((assignment) => assignment.conversationId).filter((id): id is string => Boolean(id)));
}
