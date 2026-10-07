import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";

export type RoundRobinSettings = {
  tenantId: string;
  enabled: boolean;
  strategy: "ROUND_ROBIN" | "CAPACITY_WEIGHTED";
  participatingGroupId: string | null;
  participatingAgentIds: string[];
  maxActiveLeadsPerAgent: number;
  lastAssignedIndex: number;
  allowNonAdminModifyLeads: boolean;
  allowNonAdminDeleteLeads: boolean;
  allowNonAdminImportData: boolean;
  allowNonAdminExportData: boolean;
  allowNonAdminBulkCampaigns: boolean;
  fallbackAgentId?: string | null;
  updatedAt: string;
};

const STORE_DIR = path.join(process.cwd(), ".gigxomi");
const ROUND_ROBIN_FILE = path.join(STORE_DIR, "round-robin-settings.json");

export function getDefaultRoundRobinSettings(tenantId: string): RoundRobinSettings {
  return {
    tenantId,
    enabled: true,
    strategy: "ROUND_ROBIN",
    participatingGroupId: null,
    participatingAgentIds: [],
    maxActiveLeadsPerAgent: 50,
    lastAssignedIndex: -1,
    allowNonAdminModifyLeads: true,
    allowNonAdminDeleteLeads: false,
    allowNonAdminImportData: false,
    allowNonAdminExportData: false,
    allowNonAdminBulkCampaigns: false,
    fallbackAgentId: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function readRoundRobinSettings(tenantId: string): Promise<RoundRobinSettings> {
  try {
    const raw = await readFile(ROUND_ROBIN_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, RoundRobinSettings>;
    if (parsed[tenantId]) {
      return { ...getDefaultRoundRobinSettings(tenantId), ...parsed[tenantId] };
    }
  } catch {
    // fallback
  }
  return getDefaultRoundRobinSettings(tenantId);
}

export async function saveRoundRobinSettings(tenantId: string, settings: RoundRobinSettings): Promise<void> {
  let all: Record<string, RoundRobinSettings> = {};
  try {
    const raw = await readFile(ROUND_ROBIN_FILE, "utf8");
    all = JSON.parse(raw) as Record<string, RoundRobinSettings>;
  } catch {
    all = {};
  }
  all[tenantId] = settings;
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(ROUND_ROBIN_FILE, JSON.stringify(all, null, 2), "utf8");
}

export async function getNextRoundRobinAgentId(tenantId: string): Promise<string | null> {
  const settings = await readRoundRobinSettings(tenantId);
  const activeAgents = await prisma.salesAgentProfile.findMany({
    where: {
      status: "ACTIVE",
      user: { tenantId },
      ...(settings.participatingGroupId ? { groupId: settings.participatingGroupId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (!activeAgents.length) return null;

  // Filter to participating agents if specified
  const candidateAgents = settings.participatingAgentIds.length
    ? activeAgents.filter((a) => settings.participatingAgentIds.includes(a.id))
    : activeAgents;

  const pool = candidateAgents;

  if (!settings.enabled || !pool.length) {
    return null;
  }

  if (pool.length === 1) {
    return pool[0].id;
  }

  const nextIndex = (settings.lastAssignedIndex + 1) % pool.length;
  settings.lastAssignedIndex = nextIndex;
  settings.updatedAt = new Date().toISOString();
  await saveRoundRobinSettings(tenantId, settings);

  return pool[nextIndex].id;
}
