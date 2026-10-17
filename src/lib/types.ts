export type StageId =
  | "new"
  | "contacted"
  | "in_progress"
  | "demo"
  | "follow_up"
  | "negotiation"
  | "won"
  | "lost";

export type Source = "Website" | "WhatsApp" | "Referral" | "Ads" | "Cold call" | "Lead form";
export type Segment = "SMB" | "Enterprise" | "Agency";

export type Priority = "urgent" | "high" | "medium" | "low";

/** Linear-style status shape a stage maps onto. */
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
  segment: Segment;
  stage: StageId;
  priority: Priority;
  owner: string;
  /** Next follow-up date, ISO — the SLA column. */
  followUp: string;
  tags: string[];
  notes: string;
  updatedAt: string; // ISO
}

export interface StageMeta {
  id: StageId;
  label: string;
  short: string;
  tone: "neutral" | "accent" | "info" | "warning" | "success" | "danger";
  status: StatusKind;
}

export const STAGES: StageMeta[] = [
  { id: "new", label: "New Lead", short: "New", tone: "neutral", status: "todo" },
  { id: "contacted", label: "Contacted", short: "Contacted", tone: "info", status: "progress" },
  { id: "in_progress", label: "In Progress", short: "Progress", tone: "info", status: "progress" },
  { id: "demo", label: "Demo Booked", short: "Demo", tone: "accent", status: "progress" },
  { id: "follow_up", label: "Follow Up", short: "Follow up", tone: "warning", status: "progress" },
  { id: "negotiation", label: "Negotiation", short: "Negotiation", tone: "warning", status: "progress" },
  { id: "won", label: "Closed Won", short: "Won", tone: "success", status: "done" },
  { id: "lost", label: "Closed Lost", short: "Lost", tone: "danger", status: "cancelled" },
];

export const SOURCES: Source[] = ["Website", "WhatsApp", "Referral", "Ads", "Cold call", "Lead form"];
export const SEGMENTS: Segment[] = ["SMB", "Enterprise", "Agency"];
export const OWNERS = ["Aarav", "Meera", "Rohan", "Unassigned"];

export const stageMeta = (id: StageId): StageMeta =>
  STAGES.find((s) => s.id === id) ?? STAGES[0];

export type Theme = "light" | "dark";
export type Density = "comfortable" | "compact";
/** User-selectable base text size. */
export type FontScale = "sm" | "md" | "lg" | "xl";
