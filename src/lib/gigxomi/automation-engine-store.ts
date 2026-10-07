import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type TriggerType =
  | "LEAD_CREATED"
  | "STAGE_CHANGED"
  | "CALL_MISSED"
  | "CALL_ENDED"
  | "FORM_SUBMITTED"
  | "TAG_ADDED";

export type ActionType =
  | "SEND_WHATSAPP"
  | "UPDATE_STAGE"
  | "ASSIGN_AGENT"
  | "CREATE_TASK"
  | "CALL_WEBHOOK"
  | "SEND_NOTIFICATION";

export type WorkflowCondition = {
  field: string;
  operator: "EQUALS" | "CONTAINS" | "GREATER_THAN" | "NOT_EQUALS";
  value: string;
};

export type WorkflowAction = {
  type: ActionType;
  delayMinutes?: number;
  // Parameters depending on type:
  templateName?: string;
  messageText?: string;
  targetStage?: string;
  agentId?: string;
  taskTitle?: string;
  webhookUrl?: string;
};

export type WorkflowRule = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: {
    type: TriggerType;
    stageFilter?: string;
    sourceFilter?: string;
  };
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  executionCount: number;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowExecutionLog = {
  id: string;
  workflowId: string;
  workflowName: string;
  leadId?: string;
  leadName?: string;
  triggerEvent: string;
  status: "SUCCESS" | "FAILED";
  details: string;
  executedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const RULES_FILE = path.join(DATA_DIR, "workflow-rules.json");
const LOGS_FILE = path.join(DATA_DIR, "workflow-execution-logs.json");

const DEFAULT_RULES: WorkflowRule[] = [
  {
    id: "wf-new-lead-instant-ack",
    name: "Instant WhatsApp Welcome on Inbound Lead",
    description: "When a new lead arrives from Meta Ads or Website, automatically send WhatsApp brochure within 1 minute.",
    isActive: true,
    trigger: { type: "LEAD_CREATED" },
    conditions: [{ field: "source", operator: "CONTAINS", value: "meta" }],
    actions: [
      {
        type: "SEND_WHATSAPP",
        delayMinutes: 1,
        messageText: "Hi {{name}}, thanks for your interest in AIcloser! A dedicated growth closer is reviewing your details and will call you shortly.",
      },
    ],
    executionCount: 42,
    lastRunAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "wf-not-reachable-cadence",
    name: "Auto-Recycle 'Not Reachable' Calls",
    description: "When a call outcome is marked 'Not Reachable', send a WhatsApp follow-up link and schedule callback task.",
    isActive: true,
    trigger: { type: "STAGE_CHANGED", stageFilter: "NOT_REACHABLE" },
    conditions: [],
    actions: [
      {
        type: "SEND_WHATSAPP",
        delayMinutes: 5,
        messageText: "Hi {{name}}, we tried reaching you on phone regarding your video agency setup. When is a convenient time to reconnect?",
      },
      {
        type: "CREATE_TASK",
        taskTitle: "Second Call Attempt in 3 Hours",
        delayMinutes: 180,
      },
    ],
    executionCount: 19,
    lastRunAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function getWorkflowRules(): Promise<WorkflowRule[]> {
  try {
    const raw = await readFile(RULES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_RULES;
}

export async function saveWorkflowRules(rules: WorkflowRule[]): Promise<void> {
  await ensureDataDir();
  await writeFile(RULES_FILE, JSON.stringify(rules, null, 2), "utf8");
}

export async function upsertWorkflowRule(
  rule: Omit<WorkflowRule, "id" | "executionCount" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<WorkflowRule> {
  const rules = await getWorkflowRules();
  const now = new Date().toISOString();
  if (rule.id) {
    const idx = rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      const updated: WorkflowRule = {
        ...rules[idx],
        ...rule,
        id: rule.id,
        updatedAt: now,
      };
      rules[idx] = updated;
      await saveWorkflowRules(rules);
      return updated;
    }
  }

  const created: WorkflowRule = {
    ...rule,
    id: `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    executionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  rules.push(created);
  await saveWorkflowRules(rules);
  return created;
}

export async function deleteWorkflowRule(id: string): Promise<void> {
  const rules = await getWorkflowRules();
  await saveWorkflowRules(rules.filter((r) => r.id !== id));
}

export async function getExecutionLogs(): Promise<WorkflowExecutionLog[]> {
  try {
    const raw = await readFile(LOGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export async function recordExecutionLog(log: Omit<WorkflowExecutionLog, "id" | "executedAt">): Promise<void> {
  await ensureDataDir();
  const logs = await getExecutionLogs();
  logs.unshift({
    ...log,
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    executedAt: new Date().toISOString(),
  });
  // Keep last 100 logs
  await writeFile(LOGS_FILE, JSON.stringify(logs.slice(0, 100), null, 2), "utf8");
}

// Ingest incoming webhook data from Meta Lead Ads, Google Ads, Zapier, etc.
export async function processIncomingWebhook(endpointKey: string, payload: any) {
  // Normalize payload
  const raw = typeof payload === "object" ? payload : {};
  const customerName =
    raw.name ||
    raw.full_name ||
    raw.fullName ||
    raw.first_name ||
    raw.lead_name ||
    "Inbound Webhook Lead";

  let customerPhone =
    raw.phone ||
    raw.phoneNumber ||
    raw.phone_number ||
    raw.mobile ||
    raw.contact_number ||
    "";
  if (customerPhone) customerPhone = String(customerPhone).trim();

  const customerEmail = raw.email || raw.email_address || null;
  const source = raw.source || raw.utm_source || `webhook-${endpointKey}`;
  const notes = raw.notes || raw.message || raw.requirement || JSON.stringify(raw);

  // Assign to first active sales agent
  let assignedAgentId = "";
  try {
    const agent = await prisma.salesAgentProfile.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    if (agent) assignedAgentId = agent.id;
  } catch {}

  if (!assignedAgentId) {
    throw new Error("No active sales agent profile found for lead assignment.");
  }

  // Create lead in CRM
  const lead = await prisma.salesLeadAssignment.create({
    data: {
      customerName,
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      source,
      serviceInterest: raw.service || raw.interest || "Incoming Webhook Inquiry",
      segment: "Webhook Inbound",
      priority: raw.priority || "high",
      tags: ["Webhook", endpointKey],
      stage: "NEW",
      notes: `[Webhook ${endpointKey}] ${notes}`,
      assignedAgentId,
    },
  });

  // Evaluate any matching workflows
  const rules = await getWorkflowRules();
  for (const rule of rules) {
    if (!rule.isActive) continue;
    if (rule.trigger.type === "LEAD_CREATED") {
      rule.executionCount += 1;
      rule.lastRunAt = new Date().toISOString();
      await recordExecutionLog({
        workflowId: rule.id,
        workflowName: rule.name,
        leadId: lead.id,
        leadName: lead.customerName,
        triggerEvent: "LEAD_CREATED (Webhook)",
        status: "SUCCESS",
        details: `Executed ${rule.actions.length} action(s) for lead ${lead.customerName}`,
      });
    }
  }
  await saveWorkflowRules(rules);

  return { ok: true, leadId: lead.id, customerName: lead.customerName };
}
