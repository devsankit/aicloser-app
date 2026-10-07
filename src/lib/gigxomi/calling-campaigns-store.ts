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
const CAMPAIGNS_FILE = path.join(DATA_DIR, "calling-campaigns.json");

const DEFAULT_SCRIPT = `Hi [Customer Name], this is [Agent Name] from Gigxomi / AIcloser.

I noticed your interest in scaling your agency sales pipeline. We help high-ticket service businesses automate their WhatsApp client follow-ups and SIM calling workflows.

Do you currently have 2 minutes to see how our teams are closing 3x more deals?`;

const DEFAULT_CAMPAIGNS: CallingCampaign[] = [
  {
    id: "cmp-march-inbound",
    name: "Q1 Agency Inbound Follow-Up Blitz",
    description: "Rapid outbound calling cadence for all high-intent inbound website and Meta leads.",
    status: "ACTIVE",
    dailyTarget: 50,
    cooldownSeconds: 5,
    scriptTemplate: DEFAULT_SCRIPT,
    assignedAgentIds: [],
    totalLeads: 25,
    dialedCount: 14,
    connectedCount: 9,
    convertedCount: 3,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    leads: [],
  },
  {
    id: "cmp-cold-outreach",
    name: "E-Commerce Founders Calling Drive",
    description: "Outbound campaign targeting D2C and Shopify brand owners for marketing video growth.",
    status: "ACTIVE",
    dailyTarget: 60,
    cooldownSeconds: 4,
    scriptTemplate: DEFAULT_SCRIPT,
    assignedAgentIds: [],
    totalLeads: 40,
    dialedCount: 22,
    connectedCount: 12,
    convertedCount: 4,
    createdAt: "2026-03-15T00:00:00.000Z",
    updatedAt: "2026-03-15T00:00:00.000Z",
    leads: [],
  },
];

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function getCallingCampaigns(): Promise<CallingCampaign[]> {
  try {
    const raw = await readFile(CAMPAIGNS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_CAMPAIGNS;
}

export async function saveCallingCampaigns(campaigns: CallingCampaign[]): Promise<void> {
  await ensureDataDir();
  await writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), "utf8");
}

export async function getCampaignById(id: string): Promise<CallingCampaign | null> {
  const campaigns = await getCallingCampaigns();
  const found = campaigns.find((c) => c.id === id);
  if (!found) return null;

  // If campaign has empty leads, populate from current CRM leads
  if (!found.leads || found.leads.length === 0) {
    try {
      const dbLeads = await prisma.salesLeadAssignment.findMany({
        where: { customerPhone: { not: null } },
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
      await saveCallingCampaigns(campaigns);
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
  const campaigns = await getCallingCampaigns();
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
      await saveCallingCampaigns(campaigns);
      return updated;
    }
  }

  // Fetch initial leads for new campaign
  let initialLeads: CampaignMemberLead[] = [];
  try {
    const dbLeads = await prisma.salesLeadAssignment.findMany({
      where: { customerPhone: { not: null } },
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
  await saveCallingCampaigns(campaigns);
  return created;
}

export async function deleteCallingCampaign(id: string): Promise<void> {
  const campaigns = await getCallingCampaigns();
  await saveCallingCampaigns(campaigns.filter((c) => c.id !== id));
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
  }
): Promise<{ ok: boolean; campaign: CallingCampaign }> {
  const campaigns = await getCallingCampaigns();
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
      await prisma.salesLeadAssignment.update({
        where: { id: leadId },
        data: {
          stage: newStage,
          lastContactedAt: new Date(),
          notes: input.notes ? `[Campaign: ${campaign.name}] ${input.notes}` : undefined,
        },
      });
    }
  } catch {}

  await saveCallingCampaigns(campaigns);
  return { ok: true, campaign };
}
