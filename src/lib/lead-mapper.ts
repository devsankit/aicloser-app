import type { Lead as BackendLead } from "./api-client";
import type { Lead as UiLead, Priority, Segment, Source, StageId } from "./types";

export function normalizeStageId(stage?: string | null): StageId {
  const s = (stage || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (s.includes("new") || s === "assigned") return "new";
  if (s.includes("contact")) return "contacted";
  if (s.includes("progress")) return "in_progress";
  if (s.includes("interest") || s.includes("qualif")) return "contacted";
  if (s.includes("demo") || s.includes("webinar")) return "demo";
  if (s.includes("follow")) return "follow_up";
  if (s.includes("negot") || s.includes("quote")) return "negotiation";
  if (s.includes("won") || s.includes("closed_won") || s === "paid") return "won";
  if (s.includes("lost") || s.includes("closed_lost") || s.includes("not_reach") || s.includes("recycled")) return "lost";
  return "new";
}

export function stageIdToBackendStage(stage: StageId): string {
  switch (stage) {
    case "new":
      return "NEW";
    case "contacted":
      return "CONTACTED";
    case "in_progress":
      return "IN_PROGRESS";
    case "demo":
      return "DEMO";
    case "follow_up":
      return "FOLLOW_UP";
    case "negotiation":
      return "NEGOTIATION";
    case "won":
      return "WON";
    case "lost":
      return "LOST";
    default:
      return "NEW";
  }
}

export function normalizePriority(p?: string | null): Priority {
  const s = (p || "").toLowerCase();
  if (s.includes("urgent")) return "urgent";
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  return "medium";
}

export function normalizeSource(s?: string | null): Source {
  const str = (s || "").toLowerCase();
  if (str.includes("what")) return "WhatsApp";
  if (str.includes("ad") || str.includes("meta") || str.includes("fb")) return "Ads";
  if (str.includes("ref")) return "Referral";
  if (str.includes("cold") || str.includes("call")) return "Cold call";
  if (str.includes("form") || str.includes("sheet")) return "Lead form";
  return "Website";
}

export function normalizeSegment(s?: string | null): Segment {
  const str = (s || "").toLowerCase();
  if (str.includes("enter")) return "Enterprise";
  if (str.includes("agenc")) return "Agency";
  return "SMB";
}

export function backendLeadToUiLead(b: BackendLead): UiLead {
  const custom = b.customFields || {};
  const company =
    (custom.company as string) ||
    b.serviceInterest ||
    (b.customerName ? `${b.customerName}'s Venture` : "Inquiry");

  const code = (b as any).leadCode || `CLO-${b.id ? b.id.slice(-4).toUpperCase() : "101"}`;
  const assignedAgentId = (b as any).assignedAgentId || b.assignedAgent?.id || (b as any).assignedAgent?.userId;

  return {
    id: b.id,
    code,
    name: b.customerName || "Unnamed Lead",
    company,
    phone: b.customerPhone || "",
    email: b.customerEmail || "",
    value: typeof b.budgetAmount === "number" ? b.budgetAmount : 0,
    source: normalizeSource(b.source),
    rawSource: b.source,
    serviceInterest: b.serviceInterest,
    segment: normalizeSegment(b.segment),
    stage: normalizeStageId(b.stage),
    rawStage: b.stage,
    assignedAgentId,
    priority: normalizePriority(b.priority),
    owner: (b as any).assignedAgent?.user?.displayName || b.assignedAgent?.displayName || "Unassigned",
    followUp: b.followUpAt || new Date(Date.now() + 86400000).toISOString(),
    tags: Array.isArray(b.tags) ? b.tags : [],
    notes: b.notes || (custom.notes as string) || "",
    updatedAt: b.updatedAt || b.createdAt || new Date().toISOString(),
  };
}

export function uiLeadToBackendPayload(u: Partial<UiLead>): Partial<BackendLead> {
  const payload: any = {};
  if (u.name !== undefined) payload.customerName = u.name;
  if (u.phone !== undefined) payload.customerPhone = u.phone;
  if (u.email !== undefined) payload.customerEmail = u.email;
  if (u.value !== undefined) payload.budgetAmount = u.value;
  if (u.stage !== undefined) payload.stage = stageIdToBackendStage(u.stage);
  if (u.source !== undefined) payload.source = u.source;
  if (u.priority !== undefined) payload.priority = u.priority.toUpperCase();
  if (u.segment !== undefined) payload.segment = u.segment;
  if (u.followUp !== undefined) payload.followUpAt = u.followUp;
  if (u.tags !== undefined) payload.tags = u.tags;
  if (u.notes !== undefined || u.company !== undefined) {
    payload.notes = u.notes;
    payload.customFields = {
      ...(u.company ? { company: u.company } : {}),
      ...(u.notes ? { notes: u.notes } : {}),
    };
  }
  return payload;
}

/**
 * Determines whether a lead represents a teammate's personal/business scanned WhatsApp chat.
 * Teammates' scanned chats are isolated so they never leak into the general "All team leads"
 * Kanban board/reassignment pool, and only display when specifically viewing that teammate's scope.
 */
export function isTeammateScannedWhatsAppLead(lead: UiLead): boolean {
  const owner = (lead.owner || "").trim().toLowerCase();
  // Unassigned pool leads or workspace owner leads are company leads, not private teammate chats
  if (!owner || owner === "unassigned" || owner === "admin" || owner === "ankit rathore") {
    return false;
  }

  const rawSrc = (lead.rawSource || "").toLowerCase();
  const interest = (lead.serviceInterest || "").toLowerCase();
  const comp = (lead.company || "").toLowerCase();
  const tagsStr = (lead.tags || []).join(" ").toLowerCase();

  const isScannerSource =
    rawSrc.includes("qr_scanner") ||
    rawSrc.includes("scanner") ||
    rawSrc.includes("whatsapp_business_qr") ||
    rawSrc.includes("whatsapp_personal_qr");

  const isScannerInterestOrCompany =
    interest.includes("whatsapp business lead") ||
    interest.includes("whatsapp personal lead") ||
    interest.includes("manual crm chat") ||
    interest.includes("qr scanner") ||
    comp.includes("whatsapp business lead") ||
    comp.includes("whatsapp personal lead") ||
    tagsStr.includes("scanner") ||
    tagsStr.includes("qr_scanner");

  return isScannerSource || isScannerInterestOrCompany;
}
