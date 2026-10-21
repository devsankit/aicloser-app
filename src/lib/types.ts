import type { IconName } from "@/components/ui/Icon";

export type StageId =
  | "new"
  | "contacted"
  | "in_progress"
  | "demo"
  | "follow_up"
  | "negotiation"
  | "won"
  | "lost";

export type Source =
  | "Website"
  | "WhatsApp"
  | "WhatsApp QR"
  | "Google Sheets"
  | "Excel"
  | "Email"
  | "IndiaMART"
  | "Justdial"
  | "Referral"
  | "Ads"
  | "Cold call"
  | "Lead form";
export type Segment = "SMB" | "Enterprise" | "Agency";

export type Priority = "urgent" | "high" | "medium" | "low";

/** Status shape a stage maps onto. */
export type StatusKind = "todo" | "progress" | "done" | "cancelled";

/** An icon name for the priority mark. */
export const PRIORITY_ICON: Record<Priority, string> = {
  urgent: "priority-urgent",
  high: "priority-high",
  medium: "priority-medium",
  low: "priority-low",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export interface Lead {
  id: string;
  /** Human reference shown in lists, e.g. CLO-104. */
  code: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  value: number;
  source: Source;
  rawSource?: string;
  serviceInterest?: string;
  segment: Segment;
  stage: StageId;
  rawStage?: string;
  assignedAgentId?: string;
  priority: Priority;
  owner: string;
  /** Next follow-up date, ISO — the SLA column. */
  followUp: string;
  tags: string[];
  notes: string;
  updatedAt: string; // ISO
}

export interface LeadPoolItem {
  id: string;
  tenantId?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  source?: string | null;
  serviceInterest?: string | null;
  segment?: string | null;
  priority?: string | null;
  budgetAmount?: string | number | null;
  status?: "OPEN" | "CLAIMED" | "ARCHIVED" | string;
  claimedByAgentId?: string | null;
  claimedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StageMeta {
  id: StageId;
  label: string;
  short: string;
  tone: "neutral" | "accent" | "info" | "warning" | "success" | "danger";
  status: StatusKind;
  icon: IconName;
}

export const STAGES: StageMeta[] = [
  { id: "new", label: "New Lead", short: "New", tone: "neutral", status: "todo", icon: "user-plus" },
  { id: "contacted", label: "Contacted", short: "Contacted", tone: "info", status: "progress", icon: "phone-call" },
  { id: "in_progress", label: "In Progress", short: "Progress", tone: "info", status: "progress", icon: "trending-up" },
  { id: "demo", label: "Demo Booked", short: "Demo", tone: "accent", status: "progress", icon: "calendar-check" },
  { id: "follow_up", label: "Follow Up", short: "Follow up", tone: "warning", status: "progress", icon: "calendar-clock" },
  { id: "negotiation", label: "Negotiation", short: "Negotiation", tone: "warning", status: "progress", icon: "handshake" },
  { id: "won", label: "Closed Won", short: "Won", tone: "success", status: "done", icon: "trophy" },
  { id: "lost", label: "Closed Lost", short: "Lost", tone: "danger", status: "cancelled", icon: "x-circle" },
];

export const SOURCES: Source[] = [
  "Website",
  "WhatsApp",
  "WhatsApp QR",
  "Google Sheets",
  "Excel",
  "Email",
  "IndiaMART",
  "Justdial",
  "Referral",
  "Ads",
  "Cold call",
  "Lead form",
];
export const SEGMENTS: Segment[] = ["SMB", "Enterprise", "Agency"];
export const OWNERS = ["Admin", "Unassigned"];

export const stageMeta = (id: StageId): StageMeta =>
  STAGES.find((s) => s.id === id) ?? STAGES[0];

export const isOpenStage = (stage: StageId): boolean => stage !== "won" && stage !== "lost";
export const isWonStage = (stage: StageId): boolean => stage === "won";
export const isLostStage = (stage: StageId): boolean => stage === "lost";

export type Theme = "light" | "dark";
export type Density = "comfortable" | "compact";
/** User-selectable base text size. */
export type FontScale = "sm" | "md" | "lg" | "xl";
/** User-selectable sidebar menu item vertical gap in px. */
export type NavSpacing = 1 | 2 | 4 | 6;

export interface SourceMeta {
  label: string;
  icon: IconName;
  tone: "accent" | "info" | "success" | "warning" | "neutral";
}

export function normalizeSource(source?: string | null): Source {
  const s = (source || "").trim().toLowerCase();
  if (s.includes("qr") || s.includes("linked") || s.includes("companion")) return "WhatsApp QR";
  if (s.includes("what")) return "WhatsApp";
  if (s.includes("google") || s.includes("gsheet")) return "Google Sheets";
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

export function sourceMeta(source?: string): SourceMeta {
  const norm = normalizeSource(source);
  switch (norm) {
    case "Ads":
      return { label: "Meta Ads", icon: "meta", tone: "info" };
    case "WhatsApp":
      return { label: "WhatsApp API", icon: "whatsapp", tone: "success" };
    case "WhatsApp QR":
      return { label: "WhatsApp QR", icon: "smartphone", tone: "success" };
    case "Google Sheets":
      return { label: "Google Sheets", icon: "sheet", tone: "success" };
    case "Excel":
      return { label: "Excel / CSV", icon: "sheet", tone: "accent" };
    case "Email":
      return { label: "Inbound Email", icon: "mail", tone: "info" };
    case "IndiaMART":
      return { label: "IndiaMART", icon: "globe", tone: "warning" };
    case "Justdial":
      return { label: "Justdial", icon: "phone", tone: "warning" };
    case "Referral":
      return { label: "Referral", icon: "users", tone: "accent" };
    case "Cold call":
      return { label: "Inbound Call", icon: "phone-call", tone: "accent" };
    case "Lead form":
      return { label: "Lead Form", icon: "form", tone: "warning" };
    case "Website":
    default:
      return { label: "Website", icon: "globe", tone: "neutral" };
  }
}
