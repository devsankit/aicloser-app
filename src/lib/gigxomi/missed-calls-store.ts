import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type MissedCallStatus = "PENDING" | "CALLBACK_SCHEDULED" | "RESOLVED" | "EXPIRED";

export type MissedCallRecord = {
  id: string;
  callerNumber: string;
  customerName: string;
  leadId?: string | null;
  agentId?: string | null;
  missedAt: string;
  slaMinutes: number; // default 15 mins
  status: MissedCallStatus;
  autoAckSent: boolean;
  ackSentAt?: string | null;
  callbackAttempts: number;
  lastAttemptAt?: string | null;
  resolvedAt?: string | null;
  resolvedByAgentId?: string | null;
  notes?: string | null;
};

const DATA_DIR = path.join(process.cwd(), "data");
const MISSED_CALLS_FILE = path.join(DATA_DIR, "missed-calls.json");

const DEFAULT_MISSED_CALLS: MissedCallRecord[] = [
  {
    id: "mc-101",
    callerNumber: "+919820011223",
    customerName: "Vikram Malhotra",
    missedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18m ago (breached)
    slaMinutes: 15,
    status: "PENDING",
    autoAckSent: true,
    ackSentAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
    callbackAttempts: 0,
    notes: "Inbound call missed during client review meeting",
  },
  {
    id: "mc-102",
    callerNumber: "+919876543210",
    customerName: "Aman Gupta",
    missedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(), // 6m ago (within SLA)
    slaMinutes: 15,
    status: "PENDING",
    autoAckSent: false,
    callbackAttempts: 0,
    notes: "High intent inbound caller from Meta Ad campaign",
  },
];

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function getMissedCalls(): Promise<MissedCallRecord[]> {
  try {
    const raw = await readFile(MISSED_CALLS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_MISSED_CALLS;
}

export async function saveMissedCalls(calls: MissedCallRecord[]): Promise<void> {
  await ensureDataDir();
  await writeFile(MISSED_CALLS_FILE, JSON.stringify(calls, null, 2), "utf8");
}

export async function recordMissedCall(input: {
  callerNumber: string;
  customerName?: string;
  leadId?: string;
  agentId?: string;
  slaMinutes?: number;
}): Promise<MissedCallRecord> {
  const calls = await getMissedCalls();
  const now = new Date().toISOString();

  // Try matching with CRM lead if name missing
  let matchedName = input.customerName || "Inbound Caller";
  let matchedLeadId = input.leadId;
  if (!input.customerName) {
    try {
      const digits = input.callerNumber.replace(/\D/g, "");
      const suffix = digits.slice(-10);
      const lead = await prisma.salesLeadAssignment.findFirst({
        where: { customerPhone: { contains: suffix } },
      });
      if (lead) {
        matchedName = lead.customerName;
        matchedLeadId = lead.id;
      }
    } catch {}
  }

  const created: MissedCallRecord = {
    id: `mc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    callerNumber: input.callerNumber,
    customerName: matchedName,
    leadId: matchedLeadId,
    agentId: input.agentId,
    missedAt: now,
    slaMinutes: input.slaMinutes || 15,
    status: "PENDING",
    autoAckSent: false,
    callbackAttempts: 0,
  };

  calls.unshift(created);
  await saveMissedCalls(calls);
  return created;
}

export async function sendMissedCallAck(id: string): Promise<MissedCallRecord> {
  const calls = await getMissedCalls();
  const call = calls.find((c) => c.id === id);
  if (!call) throw new Error("Missed call not found");

  // In production, triggers WhatsApp Cloud API message or template
  call.autoAckSent = true;
  call.ackSentAt = new Date().toISOString();
  await saveMissedCalls(calls);
  return call;
}

export async function resolveMissedCall(id: string, agentId?: string, notes?: string): Promise<MissedCallRecord> {
  const calls = await getMissedCalls();
  const call = calls.find((c) => c.id === id);
  if (!call) throw new Error("Missed call not found");

  call.status = "RESOLVED";
  call.resolvedAt = new Date().toISOString();
  call.resolvedByAgentId = agentId;
  if (notes) call.notes = notes;
  call.callbackAttempts += 1;

  await saveMissedCalls(calls);
  return call;
}
