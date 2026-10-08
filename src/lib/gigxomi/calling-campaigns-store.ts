import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";

export type CallDisposition =
  | "CONNECTED"
  | "BUSY"
  | "WRONG_NUMBER"
  | "CALL_BACK"
  | "NOT_REACHABLE"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "CLOSED_WON";

export type CampaignMemberLead = {
  id: string; // lead assignment ID or pool ID
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  stage: string;
  attempts: number;
  lastAttemptAt?: string | null;
  disposition?: CallDisposition | null;
  dispositionNotes?: string | null;
  assignedAgentId?: string | null;
  isCompleted: boolean;
};

export type CallingCampaign = {
  tenantId: string;
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  dailyTarget: number;
  cooldownSeconds: number; // Seconds between automatic dial queues (e.g. 5)
  scriptTemplate: string; // Telecalling pitch script / guide
  assignedAgentIds: string[];
  totalLeads: number;
  dialedCount: number;
  connectedCount: number;
  convertedCount: number;
  createdAt: string;
  updatedAt: string;
  leads: CampaignMemberLead[];
};

const DATA_DIR = path.join(process.cwd(), "data");

function requireTenantId(tenantId: string) {
  const normalized = tenantId?.trim();
  if (!normalized) throw new Error("TenantScopeRequired");
  return normalized;
}

function campaignsFileForTenant(tenantId: string) {
  const safeTenantId = Buffer.from(requireTenantId(tenantId)).toString("base64url");
  return path.join(DATA_DIR, `calling-campaigns-${safeTenantId}.json`);
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function getCallingCampaigns(tenantId: string): Promise<CallingCampaign[]> {
  const campaignsFile = campaignsFileForTenant(tenantId);
  try {
    const raw = await readFile(campaignsFile, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export async function saveCallingCampaigns(campaigns: CallingCampaign[], tenantId: string): Promise<void> {
  await ensureDataDir();
  await writeFile(campaignsFileForTenant(tenantId), JSON.stringify(campaigns, null, 2), "utf8");
}

export async function getCampaignById(id: string, tenantId: string): Promise<CallingCampaign | null> {
  const campaigns = await getCallingCampaigns(tenantId);
  const found = campaigns.find((c) => c.id === id);
  if (!found) return null;

  // If campaign has empty leads, populate from current CRM leads
  if (!found.leads || found.leads.length === 0) {
    try {
      const dbLeads = await prisma.salesLeadAssignment.findMany({
        where: { tenantId, customerPhone: { not: null } },
        take: 30,
        orderBy: { createdAt: "desc" },
      });
      found.leads = dbLeads.map((l) => ({
        id: l.id,
        customerName: l.customerName,
        customerPhone: l.customerPhone || "",
        customerEmail: l.customerEmail,
        stage: l.stage,
        attempts: 0,
        isCompleted: false,
        assignedAgentId: l.assignedAgentId,
      }));
      found.totalLeads = found.leads.length;
      await saveCallingCampaigns(campaigns, tenantId);
    } catch {}
  }

  return found;
}

export async function upsertCallingCampaign(
  campaign: Omit<CallingCampaign, "id" | "totalLeads" | "dialedCount" | "connectedCount" | "convertedCount" | "createdAt" | "updatedAt" | "leads"> & {
    id?: string;
    leadIds?: string[];
  }
): Promise<CallingCampaign> {
  const tenantId = requireTenantId(campaign.tenantId);
  const campaigns = await getCallingCampaigns(tenantId);
  const now = new Date().toISOString();

  if (campaign.id) {
    const idx = campaigns.findIndex((c) => c.id === campaign.id);
    if (idx >= 0) {
      const updated: CallingCampaign = {
        ...campaigns[idx],
        ...campaign,
        id: campaign.id,
        updatedAt: now,
      };
      campaigns[idx] = updated;
      await saveCallingCampaigns(campaigns, tenantId);
      return updated;
    }
  }

  // Fetch initial leads for new campaign
  let initialLeads: CampaignMemberLead[] = [];
  try {
    const dbLeads = await prisma.salesLeadAssignment.findMany({
      where: { tenantId, customerPhone: { not: null } },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    initialLeads = dbLeads.map((l) => ({
      id: l.id,
      customerName: l.customerName,
      customerPhone: l.customerPhone || "",
      customerEmail: l.customerEmail,
      stage: l.stage,
      attempts: 0,
      isCompleted: false,
      assignedAgentId: l.assignedAgentId,
    }));
  } catch {}

  const created: CallingCampaign = {
    ...campaign,
    tenantId,
    id: `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    totalLeads: initialLeads.length,
    dialedCount: 0,
    connectedCount: 0,
    convertedCount: 0,
    leads: initialLeads,
    createdAt: now,
    updatedAt: now,
  };
  campaigns.push(created);
  await saveCallingCampaigns(campaigns, tenantId);
  return created;
}

export async function deleteCallingCampaign(id: string, tenantId: string): Promise<void> {
  const campaigns = await getCallingCampaigns(tenantId);
  await saveCallingCampaigns(campaigns.filter((c) => c.id !== id), tenantId);
}

// Log a dial attempt & disposition during power dialing session
export async function submitCallDisposition(
  campaignId: string,
  leadId: string,
  input: {
    disposition: CallDisposition;
    notes?: string;
    agentId?: string;
    durationSeconds?: number;
  },
  tenantId: string
): Promise<{ ok: boolean; campaign: CallingCampaign }> {
  const campaigns = await getCallingCampaigns(tenantId);
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const member = campaign.leads.find((l) => l.id === leadId);
  if (member) {
    member.attempts += 1;
    member.lastAttemptAt = new Date().toISOString();
    member.disposition = input.disposition;
    member.dispositionNotes = input.notes || null;
    member.isCompleted = true;
  }

  campaign.dialedCount += 1;
  if (["CONNECTED", "INTERESTED", "CALL_BACK", "CLOSED_WON"].includes(input.disposition)) {
    campaign.connectedCount += 1;
  }
  if (input.disposition === "CLOSED_WON") {
    campaign.convertedCount += 1;
  }
  campaign.updatedAt = new Date().toISOString();

  // If disposition updates CRM stage directly
  try {
    let newStage: any = null;
    if (input.disposition === "CLOSED_WON") newStage = "CLOSED_WON";
    else if (input.disposition === "INTERESTED") newStage = "INTERESTED";
    else if (input.disposition === "CALL_BACK") newStage = "FOLLOW_UP";
    else if (input.disposition === "NOT_REACHABLE" || input.disposition === "BUSY") newStage = "NOT_REACHABLE";
    else if (input.disposition === "CONNECTED") newStage = "CONTACTED";

    if (newStage) {
      const lead = await prisma.salesLeadAssignment.findFirst({ where: { id: leadId, tenantId }, select: { id: true } });
      if (lead) {
        await prisma.salesLeadAssignment.update({
          where: { id: lead.id },
          data: {
            stage: newStage,
            lastContactedAt: new Date(),
            notes: input.notes ? `[Campaign: ${campaign.name}] ${input.notes}` : undefined,
          },
        });
      }
    }
  } catch {}

  await saveCallingCampaigns(campaigns, tenantId);
  return { ok: true, campaign };
}
