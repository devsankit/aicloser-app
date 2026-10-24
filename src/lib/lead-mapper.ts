import type { Lead as BackendLead } from "./api-client";
import type { Lead as UiLead, Priority, Segment, Source, StageId } from "./types";

export function normalizeStageId(stage?: string | null): StageId {
  const s = (stage || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return "new";
  if (s.includes("new") || s === "assigned") return "new";
  if (s.includes("demo") || s.includes("webinar") || s.includes("qualif")) return "demo";
  if (s.includes("follow")) return "follow_up";
  if (s.includes("negot") || s.includes("quote")) return "negotiation";
  if (s.includes("won") || s.includes("closed_won") || s === "paid") return "won";
  if (s.includes("lost") || s.includes("closed_lost") || s.includes("not_reach") || s.includes("recycled")) return "lost";
  if (s.includes("progress")) return "in_progress";
  if (s.includes("contact") || s.includes("interest")) return "contacted";
  return s as StageId;
}

export function stageIdToBackendStage(stage: StageId): string {
  switch (stage) {
    case "new":
      return "NEW";
    case "contacted":
      return "CONTACTED";
    case "in_progress":
      return "CONTACTED";
    case "demo":
      return "QUALIFIED";
    case "follow_up":
      return "FOLLOW_UP";
    case "negotiation":
      return "NEGOTIATION";
    case "won":
      return "CLOSED_WON";
    case "lost":
      return "CLOSED_LOST";
    default:
      return stage ? String(stage).toUpperCase().replace(/[\s-]+/g, "_") : "NEW";
  }
}

export function normalizePriority(p?: string | null): Priority {
  const s = (p || "").toLowerCase();
  if (s.includes("urgent")) return "urgent";
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  return "medium";
}

export function normalizeSource(source?: string | null): Source {
  const s = (source || "").trim().toLowerCase();
  if (s.includes("qr") || s.includes("linked") || s.includes("companion")) return "WhatsApp QR";
  if (s.includes("what")) return "WhatsApp";
  if (s.includes("google") || s.includes("gsheet") || s.includes("sheet")) return "Google Sheets";
  if (s.includes("excel") || s.includes("xlsx") || s.includes("xls") || s.includes("csv")) return "Excel";
  if (s.includes("mail") || s.includes("inbound-email")) return "Email";
  if (s.includes("indiamart")) return "IndiaMART";
  if (s.includes("justdial")) return "Justdial";
  if (s.includes("form") || s.includes("survey")) return "Lead form";
  if (s === "ads" || s.startsWith("ad") || s.includes("meta") || s.includes("facebook") || s.includes("instagram") || s.includes("paid")) return "Ads";
  if (s.includes("ref")) return "Referral";
  if (s.includes("cold") || s.includes("call") || s.includes("phone") || s.includes("sim")) return "Cold call";
  if (s.includes("web") || s.includes("direct") || s.includes("organic") || s.includes("portal")) return "Website";
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
    owner: (b as any).assignedAgent?.user?.displayName || b.assignedAgent?.displayName || (b as any).owner || "Unassigned",
    followUp: b.followUpAt || "",
    tags: Array.isArray(b.tags) ? b.tags : (typeof b.tags === "string" && (b.tags as string).trim() ? [(b.tags as string).trim()] : []),
    notes: typeof b.notes === "string" ? b.notes : (typeof custom.notes === "string" ? custom.notes : (custom.notes ? JSON.stringify(custom.notes) : "")),
    updatedAt: b.updatedAt || b.createdAt || new Date().toISOString(),
    kanbanPosition: typeof (b as any).kanbanPosition === "number" ? (b as any).kanbanPosition : undefined,
  };
}

export function uiLeadToBackendPayload(u: Partial<UiLead>): Partial<BackendLead> {
  const payload: any = {};
  if (u.name !== undefined) payload.customerName = u.name;
  if (u.phone !== undefined) payload.customerPhone = u.phone;
  if (u.email !== undefined) payload.customerEmail = u.email;
  if (u.value !== undefined) payload.budgetAmount = u.value;
  if (u.stage !== undefined) payload.stage = stageIdToBackendStage(u.stage);
  if (u.kanbanPosition !== undefined) payload.kanbanPosition = u.kanbanPosition;
  if (u.source !== undefined) payload.source = u.source;
  if (u.priority !== undefined) payload.priority = u.priority.toUpperCase();
  if (u.segment !== undefined) payload.segment = u.segment;
  if (u.followUp !== undefined) payload.followUpAt = u.followUp;
  if (u.tags !== undefined) payload.tags = u.tags;
  if (u.assignedAgentId !== undefined) payload.assignedAgentId = u.assignedAgentId;
  if (u.company !== undefined) payload.serviceInterest = u.company;
  if (u.owner !== undefined) {
    payload.customFields = {
      ...(payload.customFields || {}),
      owner: u.owner,
      assignedAgentName: u.owner,
    };
  }
  if (u.notes !== undefined || u.company !== undefined) {
    payload.notes = u.notes;
    payload.customFields = {
      ...(payload.customFields || {}),
      ...(u.company ? { company: u.company } : {}),
      ...(u.notes ? { notes: u.notes } : {}),
    };
  }
  return payload;
}

/**
 * Determines whether a record represents a scanned WhatsApp conversation (personal or business).
 * Scanned WhatsApp chats belong exclusively in the Chat view (/chat) and must NEVER appear
 * as movable cards on the Kanban sales board (/pipeline) to prevent accidental cross-reassignment.
 */
export function isScannedWhatsAppLead(lead: UiLead | { rawSource?: string; source?: string; serviceInterest?: string; company?: string; tags?: string[]; notes?: string }): boolean {
  const rawSrc = (lead.rawSource || lead.source || "").toLowerCase();
  const interest = (lead.serviceInterest || "").toLowerCase();
  const comp = (lead.company || "").toLowerCase();
  const tagsStr = (lead.tags || []).join(" ").toLowerCase();
  const notes = (lead.notes || "").toLowerCase();

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
    tagsStr.includes("wa business scanner") ||
    notes.includes("wa business scanner") ||
    notes.includes("qr scanner");

  return isScannerSource || isScannerInterestOrCompany;
}

export function isTeammateScannedWhatsAppLead(lead: UiLead): boolean {
  return isScannedWhatsAppLead(lead);
}
