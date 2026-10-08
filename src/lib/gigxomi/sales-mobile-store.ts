import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { persistRealtimeEvent } from "@/lib/realtime/event-outbox";
import { claimSalesLeadPoolItem, createSalesLead, getSalesSnapshotForRole, syncSalesAgentConversationLinks, updateSalesLeadStage } from "@/lib/gigxomi/sales-store";
import { getRolePermissionsMatrix } from "@/lib/gigxomi/role-permissions-store";
import { normalizeE164Phone, upsertMarketingContact } from "@/lib/whatsapp-marketing/contact-service";
import type { AppRole } from "@/lib/auth/types";

const RECORDING_ROOT = path.join(process.cwd(), "data", "uploads", "sales-recordings");
const MAX_RECORDING_BYTES = 50 * 1024 * 1024;
const PACK_EXPIRY_MS = 60_000;
const ACTIVE_STAGES = ["NEW", "ASSIGNED", "CONTACTED", "INTERESTED", "WEBINAR_INVITED", "WEBINAR_ATTENDED", "FOLLOW_UP", "NEGOTIATION", "QUALIFIED", "QUOTE_SENT", "PAYMENT_PENDING"] as const;

export type SalesMobileActor = { userId: string; role: AppRole };

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePhone(value: unknown) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function getSalesMobileAgent(actor: SalesMobileActor) {
  const profile = await prisma.salesAgentProfile.findUnique({ where: { userId: actor.userId }, include: { user: true } });
  if (!profile || profile.status !== "ACTIVE") throw new Error("Your sales mobile access is pending or suspended.");
  return profile;
}

export async function registerSalesMobileDevice(actor: SalesMobileActor, input: Record<string, unknown>) {
  const agent = await getSalesMobileAgent(actor);
  if (!agent.tenantId) throw new Error("Your sales profile is not assigned to a workspace.");
  const deviceId = clean(input.deviceId);
  if (!deviceId) throw new Error("deviceId is required.");

  const existing = await prisma.salesMobileDevice.findUnique({ where: { deviceId } });
  if (existing && existing.agentId !== agent.id) throw new Error("This company device is registered to another sales agent.");

  return prisma.salesMobileDevice.upsert({
    where: { deviceId },
    create: {
      tenantId: agent.tenantId,
      agentId: agent.id,
      deviceId,
      deviceName: clean(input.deviceName) || "GXClosers sales phone",
      appVersion: clean(input.appVersion) || null,
      manufacturer: clean(input.manufacturer) || null,
      model: clean(input.model) || null,
      androidVersion: clean(input.androidVersion) || null,
      simLabel: clean(input.simLabel) || null,
      officeSimNumber: clean(input.officeSimNumber) || null,
      recordingCapability: clean(input.recordingCapability) || "UNKNOWN",
      recordingEnabled: input.recordingEnabled === true,
    },
    update: {
      deviceName: clean(input.deviceName) || existing?.deviceName || "GXClosers sales phone",
      appVersion: clean(input.appVersion) || null,
      manufacturer: clean(input.manufacturer) || null,
      model: clean(input.model) || null,
      androidVersion: clean(input.androidVersion) || null,
      simLabel: clean(input.simLabel) || null,
      officeSimNumber: clean(input.officeSimNumber) || null,
      recordingCapability: clean(input.recordingCapability) || existing?.recordingCapability || "UNKNOWN",
      recordingEnabled: input.recordingEnabled === true,
      isActive: true,
      lastSeenAt: new Date(),
    },
  });
}

export async function heartbeatSalesMobileDevice(actor: SalesMobileActor, deviceId: string, input: Record<string, unknown>) {
  const agent = await getSalesMobileAgent(actor);
  const device = await prisma.salesMobileDevice.findFirst({ where: { deviceId, agentId: agent.id } });
  if (!device || !device.isActive) throw new Error("This device is not active for your account.");
  return prisma.salesMobileDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      appVersion: clean(input.appVersion) || device.appVersion,
      simLabel: clean(input.simLabel) || device.simLabel,
      officeSimNumber: clean(input.officeSimNumber) || device.officeSimNumber,
      recordingCapability: clean(input.recordingCapability) || device.recordingCapability,
    },
  });
}

export async function getSalesMobileBootstrap(actor: SalesMobileActor) {
  const agent = await getSalesMobileAgent(actor);
  // Links are populated lazily for legacy imports and for conversations that
  // arrive after a lead was assigned. This is idempotent and scoped to the
  // current agent, so CRM never broadens its inbox to unassigned threads.
  await syncSalesAgentConversationLinks(agent.id);
  const [snapshot, devices, calls, pendingNotes, pendingUploads] = await Promise.all([
    getSalesSnapshotForRole(actor),
    prisma.salesMobileDevice.findMany({ where: { agentId: agent.id, isActive: true }, orderBy: { lastSeenAt: "desc" } }),
    prisma.salesMobileCall.findMany({ where: { agentId: agent.id }, include: { assignment: true }, orderBy: { startedAt: "desc" }, take: 50 }),
    prisma.salesMobileCall.count({ where: { agentId: agent.id, noteRequired: true, noteSubmitted: false } }),
    prisma.salesMobileCall.count({ where: { agentId: agent.id, recordingStatus: { in: ["LOCAL_PENDING", "UPLOADING", "FAILED"] } } }),
  ]);
  const rolePermissions = await getRolePermissionsMatrix();
  const permissionsRole = actor.role in rolePermissions
    ? actor.role as keyof typeof rolePermissions
    : "SALES_AGENT";
  const availableLeads = snapshot.visibleLeadPool.filter((lead) => lead.status === "OPEN");
  return {
    agent: snapshot.currentAgent,
    dashboard: snapshot.reports,
    leads: snapshot.visibleLeads,
    allLeads: snapshot.leads && snapshot.leads.length > 0 ? snapshot.leads : snapshot.visibleLeads,
    availableLeads,
    availableLeadCount: availableLeads.length,
    roundRobinOptional: true,
    settings: snapshot.settings,
    permissions: rolePermissions[permissionsRole] ?? rolePermissions.SALES_AGENT,
    devices,
    calls,
    pendingNotes,
    pendingUploads,
  };
}

async function hydrateSalesMobileLeadPack<T extends { leadPoolIds: string[] }>(pack: T) {
  const records = await prisma.salesLeadPoolItem.findMany({ where: { id: { in: pack.leadPoolIds } } });
  const byId = new Map(records.map((record) => [record.id, record]));
  const leads = pack.leadPoolIds.flatMap((id) => {
    const lead = byId.get(id);
    return lead
      ? [{ id: lead.id, customerName: lead.customerName, source: lead.source, serviceInterest: lead.serviceInterest ?? "Sales enquiry", priority: lead.priority, createdAt: lead.createdAt }]
      : [];
  });
  return { ...pack, leads };
}

export async function requestSalesMobileLeadPack(actor: SalesMobileActor, sizeInput: unknown) {
  const agent = await getSalesMobileAgent(actor);
  if (!agent.tenantId) throw new Error("Your sales profile is not assigned to a workspace.");
  if (!agent.canClaimLeads) throw new Error("Complete the required training before requesting leads.");
  const pendingNotes = await prisma.salesMobileCall.count({ where: { agentId: agent.id, noteRequired: true, noteSubmitted: false } });
  if (pendingNotes) throw new Error("Submit pending call notes before requesting another lead pack.");

  await prisma.salesMobileLeadPack.updateMany({ where: { agentId: agent.id, status: "OFFERED", expiresAt: { lte: new Date() } }, data: { status: "EXPIRED" } });
  const existing = await prisma.salesMobileLeadPack.findFirst({ where: { agentId: agent.id, status: "OFFERED", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (existing) return hydrateSalesMobileLeadPack(existing);

  const activeCount = await prisma.salesLeadAssignment.count({ where: { assignedAgentId: agent.id, stage: { in: [...ACTIVE_STAGES] } } });
  const maxActive = agent.maxActiveLeads ?? 5;
  if (activeCount >= maxActive) throw new Error(`You already have ${activeCount} active leads.`);
  const requested = Math.max(3, Math.min(5, Number(sizeInput) || 3, maxActive - activeCount));
  const pool = await prisma.salesLeadPoolItem.findMany({
    where: { status: "OPEN", OR: [{ assignedAgentId: null }, { assignedAgentId: agent.id }] },
    orderBy: [{ assignedAgentId: "desc" }, { createdAt: "asc" }],
    take: requested,
  });
  if (!pool.length) throw new Error("No open leads are available right now.");
  const pack = await prisma.salesMobileLeadPack.create({ data: { tenantId: agent.tenantId, agentId: agent.id, leadPoolIds: pool.map((item) => item.id), expiresAt: new Date(Date.now() + PACK_EXPIRY_MS) } });
  return hydrateSalesMobileLeadPack(pack);
}

export async function claimSalesMobileLeadPack(actor: SalesMobileActor, packId: string) {
  const agent = await getSalesMobileAgent(actor);
  const pack = await prisma.salesMobileLeadPack.findFirst({ where: { id: packId, agentId: agent.id } });
  if (!pack || pack.status !== "OFFERED") throw new Error("Lead pack is no longer claimable.");
  if (pack.expiresAt.getTime() <= Date.now()) {
    await prisma.salesMobileLeadPack.update({ where: { id: pack.id }, data: { status: "EXPIRED" } });
    throw new Error("Lead pack expired. Request another pack.");
  }
  const leads = [];
  for (const poolItemId of pack.leadPoolIds) {
    try {
      const result = await claimSalesLeadPoolItem({ poolItemId, agentId: agent.id, actorUserId: actor.userId });
      leads.push(result.lead);
    } catch {
      // A concurrent claim may consume one item; remaining items still belong to this pack.
    }
  }
  if (!leads.length) throw new Error("These leads were claimed by another agent. Request a new pack.");
  await prisma.salesMobileLeadPack.update({ where: { id: pack.id }, data: { status: "CLAIMED", claimedAt: new Date() } });
  return leads;
}

export async function startSalesMobileCall(actor: SalesMobileActor, input: Record<string, unknown>) {
  const agent = await getSalesMobileAgent(actor);
  if (!agent.tenantId) throw new Error("Your sales profile is not assigned to a workspace.");
  const pending = await prisma.salesMobileCall.count({ where: { agentId: agent.id, noteRequired: true, noteSubmitted: false } });
  if (pending) throw new Error("Submit the pending call disposition before starting another call.");
  const assignmentId = clean(input.leadId || input.assignmentId);
  const phone = normalizePhone(input.phoneNumber);
  const assignment = assignmentId
    ? await prisma.salesLeadAssignment.findFirst({ where: { id: assignmentId, assignedAgentId: agent.id } })
    : phone
      ? await prisma.salesLeadAssignment.findFirst({ where: { assignedAgentId: agent.id, customerPhone: { contains: phone } }, orderBy: { updatedAt: "desc" } })
      : null;
  let resolvedAssignment = assignment;
  if (!resolvedAssignment && input.allowUnmatched === true && phone) {
    // Calls can arrive before a CRM lead is imported or assigned. Persist the
    // caller under the current tenant and mobile agent so the call, recording,
    // notes, and future enrichment all have a stable CRM parent.
    const contactName = clean(input.contactName) || `Unknown caller · ${clean(input.phoneNumber) || phone}`;
    resolvedAssignment = await createSalesLead({
      tenantId: agent.tenantId,
      assignedAgentId: agent.id,
      actorUserId: actor.userId,
      customerName: contactName,
      customerPhone: clean(input.phoneNumber) || phone,
      source: clean(input.source) || "PHONE_CALL",
      serviceInterest: "Phone enquiry",
      segment: "Company call",
      priority: "normal",
      stage: "NEW",
      notes: clean(input.notes) || "Auto-created from a company phone call. Enrich this contact from CRM.",
    });
  }
  if (!resolvedAssignment) throw new Error("This lead is not assigned to you.");
  let device = null;
  if (clean(input.deviceId)) {
    device = await prisma.salesMobileDevice.findFirst({ where: { deviceId: clean(input.deviceId), agentId: agent.id, isActive: true } });
    if (!device) throw new Error("Registered device not found.");
  }
  const call = await prisma.salesMobileCall.create({
    data: {
      tenantId: agent.tenantId,
      assignmentId: resolvedAssignment.id,
      agentId: agent.id,
      deviceId: device?.id ?? null,
      phoneNumber: clean(input.phoneNumber) || resolvedAssignment.customerPhone || "",
      direction: clean(input.direction).toUpperCase() === "INBOUND" ? "INBOUND" : "OUTBOUND",
      recordingStatus: clean(input.recordingStatus).toUpperCase() === "RECORDING_UNAVAILABLE" ? "RECORDING_UNAVAILABLE" : "NONE",
    },
  });
  await prisma.salesActivityLog.create({
    data: {
      tenantId: agent.tenantId,
      assignmentId: resolvedAssignment.id,
      actorUserId: actor.userId,
      action: "MOBILE_CALL_STARTED",
      metadata: { callId: call.id, direction: call.direction },
    },
  });
  return call;
}

export async function endSalesMobileCall(actor: SalesMobileActor, input: Record<string, unknown>) {
  const agent = await getSalesMobileAgent(actor);
  if (!agent.tenantId) throw new Error("Your sales profile is not assigned to a workspace.");
  const callId = clean(input.callSessionId || input.callId);
  const existing = await prisma.salesMobileCall.findFirst({ where: { id: callId, agentId: agent.id } });
  if (!existing) throw new Error("Call session not found.");
  const statusInput = clean(input.status).toUpperCase();
  const status = (["MISSED", "FAILED", "CONNECTED", "RINGING"] as const).includes(statusInput as never) ? statusInput : "COMPLETED";
  const recordingInput = clean(input.recordingStatus).toUpperCase();
  const recordingStatus = (["NONE", "RECORDING_UNAVAILABLE", "LOCAL_PENDING", "UPLOADING", "UPLOADED", "FAILED"] as const).includes(recordingInput as never)
    ? recordingInput as "NONE" | "RECORDING_UNAVAILABLE" | "LOCAL_PENDING" | "UPLOADING" | "UPLOADED" | "FAILED"
    : existing.recordingStatus;
  const call = await prisma.salesMobileCall.update({
    where: { id: existing.id },
    data: {
      status: status as "MISSED" | "FAILED" | "CONNECTED" | "RINGING" | "COMPLETED",
      connectedAt: parseDate(input.connectedAt) ?? existing.connectedAt,
      endedAt: parseDate(input.endedAt) ?? new Date(),
      durationSeconds: Number.isFinite(Number(input.durationSeconds)) ? Math.max(0, Number(input.durationSeconds)) : existing.durationSeconds,
      recordingStatus,
      recordingError: clean(input.recordingError) || existing.recordingError,
    },
  });
  await prisma.salesActivityLog.create({
    data: {
      tenantId: agent.tenantId,
      assignmentId: call.assignmentId,
      actorUserId: actor.userId,
      action: "MOBILE_CALL_ENDED",
      metadata: { callId: call.id, status: call.status, durationSeconds: call.durationSeconds },
    },
  });
  await persistRealtimeEvent({
    topic: `tenant:${agent.tenantId}`,
    tenantId: agent.tenantId,
    actorUserId: actor.userId,
    audienceRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"],
    eventType: "call.ended",
    payload: { callId: call.id, status: call.status, durationSeconds: call.durationSeconds, recordingStatus: call.recordingStatus },
  }).catch(() => undefined);
  return call;
}

export async function submitSalesMobileDisposition(actor: SalesMobileActor, input: Record<string, unknown>) {
  const agent = await getSalesMobileAgent(actor);
  const callId = clean(input.callSessionId || input.callId);
  const call = await prisma.salesMobileCall.findFirst({ where: { id: callId, agentId: agent.id }, include: { assignment: true } });
  if (!call) throw new Error("Call session not found.");
  const note = clean(input.note);
  const outcome = clean(input.outcome).toUpperCase();
  if (!note) throw new Error("Call notes are required.");
  if (!outcome) throw new Error("Choose a call outcome.");
  const nextFollowUpAt = parseDate(input.nextFollowUpAt);
  const updated = await prisma.$transaction(async (tx) => {
    const savedCall = await tx.salesMobileCall.update({ where: { id: call.id }, data: { outcome, note, nextFollowUpAt, noteSubmitted: true } });
    await tx.salesLeadAssignment.update({ where: { id: call.assignmentId }, data: { notes: note, followUpAt: nextFollowUpAt, lastContactedAt: call.connectedAt ?? call.endedAt ?? new Date() } });
    await tx.salesActivityLog.create({
      data: {
        tenantId: agent.tenantId,
        assignmentId: call.assignmentId,
        actorUserId: actor.userId,
        action: "MOBILE_CALL_DISPOSITION",
        note,
        metadata: { callId: call.id, outcome, nextFollowUpAt }
      }
    });
    return savedCall;
  });
  const stage = clean(input.stageUpdate).toUpperCase();
  if (stage) await updateSalesLeadStage({ leadId: call.assignmentId, stage: stage as never, note, actorUserId: actor.userId });
  return updated;
}

export async function saveSalesMobileRecording(actor: SalesMobileActor, callId: string, file: File, recordingDurationMs = 0, clientUploadId = "") {
  const agent = await getSalesMobileAgent(actor);
  const tenantId = agent.tenantId;
  if (!tenantId) throw new Error("Your sales profile is not assigned to a workspace.");
  let call = await prisma.salesMobileCall.findFirst({ where: { id: callId, agentId: agent.id } });
  if (!call) {
    const assignment = await prisma.salesLeadAssignment.findUnique({ where: { id: callId } });
    if (assignment) {
      call = await prisma.salesMobileCall.create({
        data: {
          tenantId,
          assignmentId: assignment.id,
          agentId: agent.id,
          phoneNumber: assignment.customerPhone ?? "Voice Note",
          direction: "OUTBOUND",
          status: "COMPLETED",
          outcome: "VOICE_NOTE",
          note: "Recorded voice note / objection memo",
          durationSeconds: recordingDurationMs > 0 ? Math.round(recordingDurationMs / 1000) : 0,
          recordingStatus: "NONE",
          noteRequired: false,
          noteSubmitted: true,
        },
      });
      await prisma.salesActivityLog.create({
        data: {
          assignmentId: assignment.id,
          actorUserId: actor.userId,
          action: "VOICE_NOTE_RECORDED",
          note: "Lead voice recording uploaded from closer mobile.",
          metadata: { callId: call.id, recordingDurationMs },
        },
      });
    } else {
      throw new Error("Call session or lead assignment not found.");
    }
  }
  if (!file.size || file.size > MAX_RECORDING_BYTES) throw new Error("Recording must be between 1 byte and 50 MB.");
  const allowed = new Set(["audio/m4a", "audio/mp4", "audio/aac", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/3gpp", "application/octet-stream"]);
  if (!allowed.has(file.type || "application/octet-stream")) throw new Error("Unsupported recording format.");
  const uploadId = clean(clientUploadId) || `legacy-${call.id}-${file.size}-${recordingDurationMs}`;
  const existingUpload = await prisma.callRecordingUpload.findUnique({ where: { tenantId_clientUploadId: { tenantId, clientUploadId: uploadId } } });
  if (existingUpload?.status === "UPLOADED") return call;
  const extension = safeFileName(path.extname(file.name || "recording.m4a") || ".m4a");
  const objectKey = `${tenantId}/calls/${call.id}/${uploadId}${extension}`;
  const upload = existingUpload ?? await prisma.callRecordingUpload.create({
    data: {
      tenantId,
      callId: call.id,
      deviceId: call.deviceId,
      clientUploadId: uploadId,
      objectKey,
      status: "LOCAL_PENDING",
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      durationSeconds: recordingDurationMs > 0 ? Math.round(recordingDurationMs / 1000) : null,
    },
  });
  await mkdir(RECORDING_ROOT, { recursive: true });
  const fileName = `${safeFileName(call.id)}-${Date.now()}${extension}`;
  const storagePath = path.join(RECORDING_ROOT, fileName);
  await prisma.callRecordingUpload.update({ where: { id: upload.id }, data: { status: "UPLOADING", attemptCount: { increment: 1 }, startedAt: new Date(), lastError: null } });
  await prisma.salesMobileCall.update({ where: { id: call.id }, data: { recordingStatus: "UPLOADING", recordingError: null } });
  try {
    await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
    const callDurationMs = Math.max(0, (call.durationSeconds ?? 0) * 1000);
    const durationMismatch = callDurationMs >= 10_000 && recordingDurationMs > 0 && recordingDurationMs < callDurationMs * 0.5;
    const saved = await prisma.$transaction(async (tx) => {
      await tx.callRecordingUpload.update({ where: { id: upload.id }, data: { status: "UPLOADED", completedAt: new Date(), checksum: null, lastError: null } });
      return tx.salesMobileCall.update({
        where: { id: call.id },
        data: {
          recordingStatus: "UPLOADED",
          recordingPath: fileName,
          recordingMimeType: file.type || "application/octet-stream",
          recordingSizeBytes: file.size,
          recordingError: durationMismatch ? `Audio captured ${Math.round(recordingDurationMs / 1000)}s of a ${Math.round(callDurationMs / 1000)}s call. Check device microphone restrictions.` : null,
        },
      });
    });
    await persistRealtimeEvent({
      topic: `tenant:${tenantId}`,
      tenantId,
      actorUserId: actor.userId,
      audienceRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"],
      eventType: "recording.uploaded",
      payload: { callId: saved.id, uploadId: upload.id, status: "UPLOADED", recordingStatus: saved.recordingStatus },
    }).catch(() => undefined);
    return saved;
  } catch (error) {
    await unlink(storagePath).catch(() => undefined);
    await prisma.callRecordingUpload.update({ where: { id: upload.id }, data: { status: "FAILED", lastError: error instanceof Error ? error.message : "Recording upload failed" } }).catch(() => undefined);
    await prisma.salesMobileCall.update({ where: { id: call.id }, data: { recordingStatus: "FAILED", recordingError: error instanceof Error ? error.message : "Recording upload failed." } });
    throw error;
  }
}

export async function readSalesMobileRecording(actor: SalesMobileActor, callId: string) {
  const isPrivileged = actor.role === "SUPER_ADMIN" || actor.role === "ADMIN" || actor.role === "MANAGER";
  const agent = !isPrivileged && actor.role === "SALES_AGENT" ? await getSalesMobileAgent(actor).catch(() => null) : null;
  const call = await prisma.salesMobileCall.findFirst({
    where: isPrivileged || !agent ? { id: callId } : { id: callId, OR: [{ agentId: agent.id }, { assignment: { assignedAgent: { parentAgentId: agent.id } } }] },
  });
  if (!call?.recordingPath) throw new Error("Recording not found.");
  const fileName = safeFileName(path.basename(call.recordingPath));
  const fullPath = path.join(RECORDING_ROOT, fileName);
  return { call, bytes: await readFile(fullPath) };
}

export async function syncSalesMobileContacts(actor: SalesMobileActor, contacts: unknown[]) {
  const agent = await getSalesMobileAgent(actor);
  const leads = await prisma.salesLeadAssignment.findMany({ where: { assignedAgentId: agent.id }, select: { id: true, customerName: true, customerPhone: true, customerEmail: true } });
  const byPhone = new Map<string, (typeof leads)[number]>();
  for (const lead of leads) {
    const phone = normalizePhone(lead.customerPhone);
    if (phone) byPhone.set(phone, lead);
  }
  const matches = contacts.flatMap((value) => {
    const contact = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const phones = Array.isArray(contact.phones) ? contact.phones.map(normalizePhone) : [];
    const lead = phones.map((phone) => byPhone.get(phone)).find(Boolean);
    return lead ? [{ leadId: lead.id, displayName: clean(contact.displayName), matchedPhone: phones.find((phone) => byPhone.has(phone)) }] : [];
  });
  return { matched: matches.length, matches };
}

export type SalesMobileContactInput = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  source?: unknown;
  tags?: unknown;
  notes?: unknown;
};

function normalizeContactTags(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(values.map(clean).filter(Boolean))).slice(0, 30);
}

function toMobileContactResult(lead: {
  id: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  stage: string;
  tags: string[];
  notes: string | null;
}) {
  return {
    id: lead.id,
    leadId: lead.id,
    name: lead.customerName,
    phone: lead.customerPhone || "",
    email: lead.customerEmail || "",
    stage: lead.stage,
    tags: lead.tags,
    notes: lead.notes || "",
  };
}

export async function upsertSalesMobileContact(actor: SalesMobileActor, input: SalesMobileContactInput) {
  const agent = await getSalesMobileAgent(actor);
  if (!agent.tenantId) throw new Error("Your sales profile is not assigned to a workspace.");

  const name = clean(input.name);
  const rawPhone = clean(input.phone);
  const email = clean(input.email).toLowerCase();
  const notes = clean(input.notes);
  const source = clean(input.source) || "mobile_manual";
  const tags = Array.from(new Set(["Mobile Contact", ...normalizeContactTags(input.tags)]));

  if (!name) throw new Error("Contact name is required.");
  if (!rawPhone) throw new Error("Contact phone is required.");

  const normalizedPhone = normalizeE164Phone(rawPhone);
  if (!normalizedPhone.valid) throw new Error(normalizedPhone.error);

  const marketingResult = await upsertMarketingContact({
    tenantId: agent.tenantId,
    fullName: name,
    phone: normalizedPhone.e164,
    email: email || undefined,
    tags,
    optInSource: source,
  });
  if (!marketingResult.ok || !marketingResult.contact) throw new Error(marketingResult.error || "Contact sync failed.");

  const existingLeads = await prisma.salesLeadAssignment.findMany({
    where: { assignedAgentId: agent.id },
    select: { id: true, customerName: true, customerPhone: true, customerEmail: true, source: true, stage: true, tags: true, notes: true },
    orderBy: { updatedAt: "desc" },
  });
  const normalizedEmail = email || null;
  const existing = existingLeads.find((lead) => {
    const leadPhone = normalizeE164Phone(lead.customerPhone || "");
    const phoneMatches = leadPhone.valid && leadPhone.e164 === normalizedPhone.e164;
    const emailMatches = Boolean(normalizedEmail && lead.customerEmail?.trim().toLowerCase() === normalizedEmail);
    return phoneMatches || emailMatches;
  });

  if (existing) {
    const mergedTags = Array.from(new Set([...(existing.tags || []), ...tags]));
    const lead = await prisma.salesLeadAssignment.update({
      where: { id: existing.id },
      data: {
        customerName: name,
        customerPhone: normalizedPhone.e164,
        customerEmail: email || undefined,
        source: existing.source || source,
        tags: mergedTags,
        notes: notes || undefined,
        activityLogs: {
          create: {
            actorUserId: actor.userId,
            action: "LEAD_UPDATED",
            note: "Contact synced from mobile CRM.",
          },
        },
      },
      select: { id: true, customerName: true, customerPhone: true, customerEmail: true, stage: true, tags: true, notes: true },
    });
    return { created: false, updated: true, contact: toMobileContactResult(lead), marketingContactId: marketingResult.contact.id };
  }

  const lead = await createSalesLead({
    assignedAgentId: agent.id,
    actorUserId: actor.userId,
    customerName: name,
    customerPhone: normalizedPhone.e164,
    customerEmail: email || undefined,
    source,
    serviceInterest: "Mobile Contact",
    segment: "CRM Contact",
    priority: "normal",
    tags,
    notes,
    stage: "NEW",
  });

  return { created: true, updated: false, contact: toMobileContactResult(lead), marketingContactId: marketingResult.contact.id };
}

type OfflineEventInput = { localEventId?: unknown; idempotencyKey?: unknown; type?: unknown; payload?: unknown; deviceId?: unknown };

export async function syncSalesMobileOfflineEvents(actor: SalesMobileActor, values: unknown[]) {
  const agent = await getSalesMobileAgent(actor);
  const results = [];
  for (const value of values) {
    const event = value && typeof value === "object" ? (value as OfflineEventInput) : {};
    const idempotencyKey = clean(event.idempotencyKey || event.localEventId);
    if (!idempotencyKey) {
      results.push({ ok: false, error: "Event idempotency key is required." });
      continue;
    }
    const existing = await prisma.salesMobileOfflineEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      results.push({ ok: existing.status === "SYNCED", idempotencyKey, status: existing.status, result: existing.result, error: existing.error });
      continue;
    }
    const payload = event.payload && typeof event.payload === "object" ? (event.payload as Record<string, unknown>) : {};
    let device = null;
    if (clean(event.deviceId)) device = await prisma.salesMobileDevice.findFirst({ where: { deviceId: clean(event.deviceId), agentId: agent.id } });
    const stored = await prisma.salesMobileOfflineEvent.create({ data: { tenantId: agent.tenantId, idempotencyKey, agentId: agent.id, deviceId: device?.id ?? null, type: clean(event.type).toUpperCase(), payload: payload as Prisma.InputJsonObject } });
    try {
      let result: unknown;
      if (stored.type === "CALL_END") result = await endSalesMobileCall(actor, payload);
      else if (stored.type === "DISPOSITION") result = await submitSalesMobileDisposition(actor, payload);
      else throw new Error(`Unsupported offline event type: ${stored.type}`);
      await prisma.salesMobileOfflineEvent.update({ where: { id: stored.id }, data: { status: "SYNCED", result: result as Prisma.InputJsonObject, processedAt: new Date() } });
      results.push({ ok: true, idempotencyKey, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Event sync failed.";
      await prisma.salesMobileOfflineEvent.update({ where: { id: stored.id }, data: { status: "FAILED", error: message, retryCount: { increment: 1 } } });
      results.push({ ok: false, idempotencyKey, error: message });
    }
  }
  return results;
}
