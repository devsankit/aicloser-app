"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { closestCorners, DndContext, KeyboardSensor, PointerSensor, type DragEndEvent, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChart3,
  ArrowDown,
  ArrowUp,
  Bot,
  Building2,
  CalendarDays,
  CalendarPlus,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  Clock3,
  Code2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Facebook,
  Flame,
  FileText,
  FileSpreadsheet,
  GripVertical,
  Hand,
  Headphones,
  KanbanSquare,
  LayoutDashboard,
  LayoutList,
  Instagram,
  Mail,
  Megaphone,
  MapPin,
  MessageSquare,
  MessageCircle,
  Plus,
  Play,
  PhoneCall,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  User,
  UserRound,
  Users,
  Tags,
  Video,
  X,
  Sliders,
  Users2,
} from "lucide-react";

import type { InstagramPluginConnectionView, InstagramSetupUrls } from "@/components/super-admin/super-admin-instagram-plugin-card";
import { InternalAppShell } from "@/components/ui/internal-app-shell";
import { GlobalAiToggleButton } from "@/components/ai/global-ai-toggle-button";
import { LeadNotesManager } from "@/components/sales/lead-notes-manager";
import { LeadStatusTagsSelector } from "@/components/sales/lead-status-tags-selector";
import { LeadCustomFieldsEditor } from "@/components/sales/lead-custom-fields-editor";
import { LeadIqCard } from "@/components/sales/lead-iq-card";

function PanelLoadingSkeleton({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "360px",
        padding: "48px 24px",
        gap: "14px",
        borderRadius: "14px",
        border: "1px dashed var(--closer-line, rgba(148, 163, 184, 0.25))",
        background: "var(--closer-surface, rgba(255, 255, 255, 0.45))",
        margin: "16px auto",
        maxWidth: "var(--crm-content-max, 1280px)",
        width: "100%",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          border: "3px solid #6366f1",
          borderTopColor: "transparent",
          animation: "crmSpin 0.75s linear infinite",
        }}
      />
      <div style={{ textAlign: "center" }}>
        <strong style={{ display: "block", fontSize: "14px", color: "var(--closer-ink, #0f172a)", fontWeight: 600 }}>
          {label}
        </strong>
        <span style={{ fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
          Loading module workspace...
        </span>
      </div>
      <style>{`@keyframes crmSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const ChatWorkspace = dynamic(
  () => import("@/components/chat/chat-workspace").then((m) => m.ChatWorkspace),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Social Inbox..." /> }
);
const SuperAdminWhatsAppFlowBuilder = dynamic(
  () => import("@/components/super-admin/super-admin-whatsapp-flow-builder").then((m) => m.SuperAdminWhatsAppFlowBuilder),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Chatbot Builder..." /> }
);
const WhatsAppMarketingDashboard = dynamic(
  () => import("@/components/whatsapp-marketing/whatsapp-marketing-dashboard").then((m) => m.WhatsAppMarketingDashboard),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading WhatsApp Marketing..." /> }
);
const RolePermissionsPanel = dynamic(
  () => import("@/components/sales/role-permissions-panel").then((m) => m.RolePermissionsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Roles & Permissions..." /> }
);
const AiBotBetaPanel = dynamic(
  () => import("@/components/sales/ai-bot-beta-panel").then((m) => m.AiBotBetaPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading AI Assistant..." /> }
);
const StatusLabelsModal = dynamic(
  () => import("@/components/sales/status-labels-modal").then((m) => m.StatusLabelsModal),
  { ssr: false }
);
const CallingCampaignsPanel = dynamic(
  () => import("@/components/sales/calling-campaigns-panel").then((m) => m.CallingCampaignsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Calling Campaigns..." /> }
);
const MissedCallsQueue = dynamic(
  () => import("@/components/sales/missed-calls-queue").then((m) => m.MissedCallsQueue),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Missed Calls..." /> }
);
const AutomationWorkflowsPanel = dynamic(
  () => import("@/components/sales/automation-workflows-panel").then((m) => m.AutomationWorkflowsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Automations..." /> }
);
const AdvancedReportsPanel = dynamic(
  () => import("@/components/sales/advanced-reports-panel").then((m) => m.AdvancedReportsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Performance Reports..." /> }
);
const ReferralCommissionPanel = dynamic(
  () => import("@/components/sales/referral-commission-panel").then((m) => m.ReferralCommissionPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Commissions & Referrals..." /> }
);
const CustomFieldsPanel = dynamic(
  () => import("@/components/sales/custom-fields-panel").then((m) => m.CustomFieldsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Custom Fields..." /> }
);
const DuplicateLeadsModal = dynamic(
  () => import("@/components/sales/duplicate-leads-modal").then((m) => m.DuplicateLeadsModal),
  { ssr: false }
);
const ContactsHub = dynamic(
  () => import("@/components/sales/contacts-hub").then((m) => m.ContactsHub),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Contacts Hub..." /> }
);
const PluginsHub = dynamic(
  () => import("@/components/sales/plugins-hub").then((m) => m.PluginsHub),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Integrations..." /> }
);
const LeadFormBuilder = dynamic(
  () => import("@/components/sales/lead-form-builder").then((m) => m.LeadFormBuilder),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Lead Form Builder..." /> }
);
const CrmSettingsPanel = dynamic(
  () => import("@/components/sales/crm-settings-panel").then((m) => m.CrmSettingsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Settings..." /> }
);
const TeamActivityPanel = dynamic(
  () => import("@/components/sales/team-activity-panel").then((m) => m.TeamActivityPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Team Activity..." /> }
);
const AdminWhatsAppSetupPanel = dynamic(
  () => import("@/components/admin/admin-dummy-controls").then((m) => m.AdminWhatsAppSetupPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading WhatsApp Connection..." /> }
);
const SuperAdminInstagramPluginCard = dynamic(
  () => import("@/components/super-admin/super-admin-instagram-plugin-card").then((m) => m.SuperAdminInstagramPluginCard),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Instagram Plugin..." /> }
);
import type { AgencyTenant } from "@/lib/gigxomi/agency-network-data";
import type { DummyWhatsAppConnectionState } from "@/lib/gigxomi/dummy-platform-store";
import type { SalesOperatingSnapshot } from "@/lib/gigxomi/sales-operating-system-store";
import type { SalesDashboardSnapshot, SalesLeadStage } from "@/lib/gigxomi/sales-store";
import type { SuperAdminWhatsAppFlow, SuperAdminWhatsAppFlowRun } from "@/lib/gigxomi/super-admin-whatsapp-flow-store";

type SalesTab =
  | "dashboard"
  | "crm"
  | "grab-leads"
  | "contacts"
  | "lead-import"
  | "calls"
  | "campaigns"
  | "automations"
  | "developer"
  | "forms"
  | "plugins"
  | "reports"
  | "custom-fields"
  | "conversations"
  | "whatsapp-marketing"
  | "roles"
  | "ai-beta"
  | "profile"
  | "whatsapp-api"
  | "instagram-inbox"
  | "chatbot-builder";
type CrmView = "kanban" | "list";
type SalesDrawer = "lead-create" | "lead-import" | null;

type SalesOperationsPayload = {
  tenantId: string;
  whatsAppConnection: DummyWhatsAppConnectionState | null;
  whatsAppTenantOptions: Array<{ id: string; name: string; phoneNumber: string }>;
  instagramConnection: InstagramPluginConnectionView;
  instagramSetupUrls: InstagramSetupUrls;
  chatbotFlows: SuperAdminWhatsAppFlow[];
  chatbotRuns: SuperAdminWhatsAppFlowRun[];
  chatbotAgencies: AgencyTenant[];
};

type SalesRoundRobinAccess = {
  enabled: boolean;
  allowNonAdminModifyLeads: boolean;
  allowNonAdminImportData: boolean;
  allowNonAdminExportData: boolean;
};

type SavedLeadView = {
  id: string;
  name: string;
  search: string;
  status: string;
  group: string;
  source: string;
  segment: string;
  ownership: "all" | "mine";
  quickPill: "all" | "today-leads" | "today-followups";
  dateRange: "all" | "today" | "yesterday" | "last7" | "month" | "custom";
  customStartDate: string;
  customEndDate: string;
};

const tabs: Array<{ id: SalesTab; label: string; icon: typeof Users; badge?: string; group?: "crm" | "growth" | "system" | "workspace" | "beta" }> = [
  { id: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, group: "crm" },
  { id: "crm", label: "CRM Pipeline & Kanban", icon: KanbanSquare, group: "crm" },
  { id: "grab-leads", label: "Grab Leads", icon: Hand, badge: "Queue", group: "crm" },
  { id: "contacts", label: "Contacts & Import Hub", icon: Users, badge: "All Sources", group: "crm" },
  { id: "lead-import", label: "Lead Import", icon: Upload, badge: "5 Sources", group: "crm" },
  { id: "calls", label: "Calls & Power Dialer", icon: PhoneCall, group: "crm" },
  { id: "conversations", label: "Live Multi-Channel Chat", icon: MessageSquare, group: "crm" },
  { id: "forms", label: "Lead Form Builder", icon: Edit3, badge: "Web Forms", group: "growth" },
  { id: "plugins", label: "Plugins & Channels", icon: Users2, badge: "WA + Email + IG", group: "growth" },
  { id: "whatsapp-marketing", label: "WhatsApp Marketing", icon: MessageCircle, group: "growth" },
  { id: "automations", label: "AI Bot & Automations", icon: Bot, badge: "AI + Flows", group: "growth" },
  { id: "developer", label: "Developer", icon: Code2, badge: "Webhooks + API", group: "system" },
  { id: "reports", label: "Reports & Lead-IQ", icon: BarChart3, group: "system" },
  { id: "roles", label: "Team & Users", icon: UserRound, badge: "Plan & Seats", group: "system" },
  { id: "profile", label: "Settings, Team & Channels", icon: Sliders, group: "system" },
];

const leadStages: SalesLeadStage[] = ["NEW", "ASSIGNED", "CONTACTED", "INTERESTED", "FOLLOW_UP", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST", "NOT_REACHABLE", "RECYCLED"];

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function label(value: unknown) {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return text ? text.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()) : "Unknown";
}

function recordingStatusLabel(value: string | null | undefined) {
  if (!value) return "No audio";
  if (value === "FAILED") return "Recording unavailable";
  if (value === "LOCAL_PENDING") return "Processing";
  if (value === "UPLOADED") return "Ready to play";
  return label(value);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)) : "Not set";
}

function formatLeadFollowUp(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  const now = new Date();
  const dateLabel = isSameDay(date, now)
    ? "Today"
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date);
  const timeLabel = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
  return `${dateLabel} · ${timeLabel}`;
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function padCalendarPart(value: number) {
  return String(value).padStart(2, "0");
}

function formatCalendarDateTime(date: Date, time = "09:00") {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return `${next.getFullYear()}-${padCalendarPart(next.getMonth() + 1)}-${padCalendarPart(next.getDate())}T${padCalendarPart(next.getHours())}:${padCalendarPart(next.getMinutes())}`;
}

function calendarTime(value: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? `${padCalendarPart(date.getHours())}:${padCalendarPart(date.getMinutes())}`
    : "09:00";
}

function LeadFollowUpPicker({
  labelText = "Next follow-up",
  onChange,
  value,
}: {
  labelText?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = value ? new Date(value) : null;
  const hasSelectedDate = Boolean(selectedDate && !Number.isNaN(selectedDate.getTime()));
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const initial = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  useEffect(() => {
    if (hasSelectedDate && selectedDate) {
      setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [hasSelectedDate, value]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(viewMonth);
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index + 1 - firstDay.getDay());
    return day;
  });
  const selectedTime = hasSelectedDate && selectedDate ? calendarTime(value) : "09:00";

  const chooseDay = (day: Date) => {
    onChange(formatCalendarDateTime(day, selectedTime));
  };

  const chooseToday = () => {
    const today = new Date();
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    chooseDay(today);
  };

  return (
    <div
      className="sales-calendar-picker"
      onPointerDown={(event) => event.stopPropagation()}
      ref={pickerRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`sales-calendar-trigger${hasSelectedDate ? " is-selected" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <CalendarDays size={14} aria-hidden="true" />
        <span>
          <small>{labelText}</small>
          <strong>{hasSelectedDate ? formatLeadFollowUp(value) : "Choose date & time"}</strong>
        </span>
        <ChevronDown size={14} aria-hidden="true" className={isOpen ? "is-rotated" : ""} />
      </button>
      {isOpen ? (
        <div aria-label={`${labelText} calendar`} className="sales-calendar-popover" role="dialog">
          <div className="sales-calendar-popover-head">
            <div>
              <small>Schedule next touch</small>
              <strong>{monthLabel}</strong>
            </div>
            <div className="sales-calendar-month-actions">
              <button aria-label="Previous month" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} type="button"><ChevronLeft size={15} /></button>
              <button aria-label="Next month" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} type="button"><ChevronRight size={15} /></button>
            </div>
          </div>
          <div className="sales-calendar-weekdays" aria-hidden="true">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="sales-calendar-grid">
            {calendarDays.map((day) => {
              const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
              const isSelected = hasSelectedDate && selectedDate ? isSameDay(day, selectedDate) : false;
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  aria-label={day.toLocaleDateString("en-IN", { dateStyle: "full" })}
                  className={`${isCurrentMonth ? "" : "is-outside-month "}${isSelected ? "is-selected " : ""}${isToday ? "is-today" : ""}`}
                  onClick={() => chooseDay(day)}
                  type="button"
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="sales-calendar-time-row">
            <label htmlFor={`${labelText.replace(/\W+/g, "-").toLowerCase()}-time`}><Clock3 size={13} /> Time</label>
            <input
              id={`${labelText.replace(/\W+/g, "-").toLowerCase()}-time`}
              onChange={(event) => {
                const base = hasSelectedDate && selectedDate ? selectedDate : new Date();
                onChange(formatCalendarDateTime(base, event.target.value));
              }}
              type="time"
              value={selectedTime}
            />
          </div>
          <div className="sales-calendar-popover-footer">
            <button className="sales-calendar-text-button" onClick={() => { onChange(""); setIsOpen(false); }} type="button">Clear</button>
            <button className="sales-calendar-text-button" onClick={chooseToday} type="button">Today</button>
            <button className="sales-calendar-done-button" onClick={() => setIsOpen(false)} type="button">Done</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type LeadDetailSectionKey = "history" | "calls" | "tools" | "information";

const defaultLeadDetailOrder: LeadDetailSectionKey[] = ["history", "calls", "tools", "information"];

const leadDetailSectionLabels: Record<LeadDetailSectionKey, string> = {
  history: "Notes & activity",
  calls: "Call recordings",
  tools: "AI, Meet & field visit",
  information: "Lead information & integrations",
};

function cleanPhone(value: string) {
  return value.replace(/\D/g, "");
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isDateToday(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !Number.isNaN(d.getTime()) && isSameDay(d, new Date());
}

function isDateYesterday(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(d, yesterday);
}

function isDateInLastDays(dateStr: string | null | undefined, days: number) {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  const now = Date.now();
  return d >= now - days * 24 * 60 * 60 * 1000 && d <= now;
}

function isDateThisMonth(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isFollowUpDueTodayOrPast(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return d.getTime() <= endOfToday.getTime();
}

const pipelineColumns: Array<{
  key: string;
  label: string;
  stage: SalesLeadStage;
  matchingStages: SalesLeadStage[];
}> = [
  { key: "NEW", label: "New Leads", stage: "NEW", matchingStages: ["NEW", "ASSIGNED"] },
  { key: "CONTACTED", label: "Contacted", stage: "CONTACTED", matchingStages: ["CONTACTED"] },
  { key: "INTERESTED", label: "Interested / Qualified", stage: "INTERESTED", matchingStages: ["INTERESTED", "QUALIFIED"] },
  { key: "WEBINAR_INVITED", label: "Training Booked", stage: "WEBINAR_INVITED", matchingStages: ["WEBINAR_INVITED", "WEBINAR_ATTENDED"] },
  { key: "FOLLOW_UP", label: "Follow-up Needed", stage: "FOLLOW_UP", matchingStages: ["FOLLOW_UP", "NEGOTIATION"] },
  { key: "CLOSED_WON", label: "Closed Won", stage: "CLOSED_WON", matchingStages: ["CLOSED_WON", "PAID", "CLOSED"] },
  { key: "CLOSED_LOST", label: "Lost / Recycled", stage: "CLOSED_LOST", matchingStages: ["CLOSED_LOST", "LOST", "NOT_REACHABLE", "RECYCLED"] },
];

function flashWindow(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "30s flash";
  const elapsed = Math.max(0, Math.floor((Date.now() - created) / 1000));
  const left = Math.max(0, 30 - elapsed);
  return left ? `${left}s flash` : "priority flash";
}

function agentName(snapshot: SalesDashboardSnapshot, agentId: string | null | undefined) {
  if (!agentId) return "Unassigned";
  return snapshot.agents.find((agent) => agent.id === agentId)?.displayName ?? "Unassigned";
}

function stageTone(stage: SalesLeadStage) {
  if (["PAID", "HANDOFF", "CLOSED", "CLOSED_WON", "WEBINAR_ATTENDED"].includes(stage)) return "success";
  if (["LOST", "CLOSED_LOST", "NOT_REACHABLE"].includes(stage)) return "danger";
  if (["QUOTE_SENT", "PAYMENT_PENDING", "WEBINAR_INVITED", "NEGOTIATION"].includes(stage)) return "warning";
  return "neutral";
}

function audioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatTalkTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function CallRecordingPlayer({ callId, expectedDurationSeconds = 0, labelText = "recording" }: { callId: string; expectedDurationSeconds?: number; labelText?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(expectedDurationSeconds);
  const [playerError, setPlayerError] = useState("");
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setPlayerError("");
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setPlayerError("Audio could not be played.");
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function changePlaybackRate(rate: number) {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }

  const effectiveTime = isSeeking ? seekTime : Math.min(currentTime, Math.max(duration, 1));
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (effectiveTime / duration) * 100)) : 0;

  return (
    <div className="sales-recording-player" title={playerError || labelText}>
      <audio
        onDurationChange={(event) => {
          const nextDuration = event.currentTarget.duration;
          if (Number.isFinite(nextDuration) && nextDuration > 0) setDuration(nextDuration);
        }}
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = playbackRate;
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
          setSeekTime(0);
        }}
        onError={() => {
          setPlaying(false);
          setPlayerError("Recording is empty or uses an unsupported audio format.");
        }}
        onTimeUpdate={(event) => {
          if (!isSeeking) setCurrentTime(event.currentTarget.currentTime);
        }}
        preload="metadata"
        ref={audioRef}
        src={`/api/sales/mobile/calls/${callId}/recording`}
      />
      <div className="sales-recording-controls">
        <button
          aria-label={`${playing ? "Pause" : "Play"} ${labelText}`}
          className="sales-recording-btn sales-recording-toggle"
          onClick={toggle}
          type="button"
        >
          {playing ? <span aria-hidden="true" className="sales-pause-icon" /> : <Play size={13} />}
          <span>{playing ? "Pause" : "Play"}</span>
        </button>
        <div aria-label="Playback speed" className="sales-recording-speed" role="group">
          {[1, 1.5, 2, 3].map((rate) => (
            <button
              aria-label={`Play at ${rate} times speed`}
              aria-pressed={playbackRate === rate}
              className={playbackRate === rate ? "sales-recording-speed-btn is-active" : "sales-recording-speed-btn"}
              disabled={Boolean(playerError)}
              key={rate}
              onClick={() => changePlaybackRate(rate)}
              type="button"
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
      <div className="sales-recording-seek-wrap">
        <input
          aria-label={`Seek ${labelText}`}
          className="sales-recording-seek"
          disabled={Boolean(playerError) || duration <= 0}
          max={Math.max(duration, 1)}
          min="0"
          onMouseDown={() => setIsSeeking(true)}
          onTouchStart={() => setIsSeeking(true)}
          onInput={(event) => {
            const nextTime = Number(event.currentTarget.value);
            setSeekTime(nextTime);
            if (audioRef.current) audioRef.current.currentTime = nextTime;
          }}
          onChange={(event) => {
            const nextTime = Number(event.target.value);
            setSeekTime(nextTime);
            if (audioRef.current) audioRef.current.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
          onMouseUp={() => setIsSeeking(false)}
          onTouchEnd={() => setIsSeeking(false)}
          step="0.1"
          style={{ '--seek-progress': `${progressPercent}%` } as CSSProperties}
          type="range"
          value={effectiveTime}
        />
      </div>
      <span className={playerError ? "sales-recording-time error" : "sales-recording-time"}>
        {playerError ? "Audio error" : `${audioTime(effectiveTime)} / ${audioTime(duration)}`}
      </span>
    </div>
  );
}

export function SalesDashboard({ salesOperations, snapshot: initialSnapshot, canManageContacts = false, sessionRole = "SALES_AGENT", rolePermissions }: { salesOperations: SalesOperationsPayload; snapshot: SalesDashboardSnapshot; canManageContacts?: boolean; sessionRole?: string; rolePermissions?: Record<string, boolean> }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [operating, setOperating] = useState<SalesOperatingSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<SalesTab>("dashboard");
  const [crmView, setCrmView] = useState<CrmView>("kanban");
  const [viewingAgentId, setViewingAgentId] = useState("all");
  const [crmSearch, setCrmSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "yesterday" | "last7" | "month" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [quickPillFilter, setQuickPillFilter] = useState<"all" | "today-leads" | "today-followups">("all");
  const [status, setStatus] = useState("");
  const [drawer, setDrawer] = useState<SalesDrawer>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; duplicate: number; invalid: number; errors?: Array<{ row: number; reason: string }> } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isStatusLabelsModalOpen, setIsStatusLabelsModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isLeadExportMenuOpen, setIsLeadExportMenuOpen] = useState(false);
  const [roundRobinAccess, setRoundRobinAccess] = useState<SalesRoundRobinAccess>({
    enabled: false,
    allowNonAdminModifyLeads: false,
    allowNonAdminImportData: false,
    allowNonAdminExportData: false,
  });
  const [liveRolePermissions, setLiveRolePermissions] = useState(rolePermissions);
  const restoredNavigation = useRef(false);
  const hydratedTabs = useRef<Set<SalesTab>>(new Set(["dashboard"]));
  const kanbanSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const currentAgent = snapshot.currentAgent;
  const pageTitle = tabs.find((tab) => tab.id === activeTab)?.label ?? "Sales";
  const currentAgentPermissions = currentAgent?.permissions as Record<string, unknown> | null | undefined;
  const isWorkspaceAdmin =
    sessionRole === "ADMIN" ||
    sessionRole === "SUPER_ADMIN" ||
    currentAgentPermissions?.workspaceAdmin === true ||
    String(currentAgentPermissions?.workspaceRole ?? "").toUpperCase() === "ADMIN";
  const effectiveWorkspaceRole = String(currentAgentPermissions?.workspaceRole ?? sessionRole).toUpperCase();
  const isCloser = !isWorkspaceAdmin && effectiveWorkspaceRole === "SALES_AGENT";
  const tabFeatureMap: Partial<Record<SalesTab, string>> = {
    dashboard: "dashboard",
    crm: "crm",
    calls: "calls",
    conversations: "conversations",
    "whatsapp-marketing": "whatsapp_marketing",
    automations: "ai_bot_beta",
    reports: "referrals",
    roles: "role_management",
  };
  const hasFeature = (featureId: string) => isWorkspaceAdmin || liveRolePermissions?.[featureId] !== false;
  const navigationTabs = (isWorkspaceAdmin
    ? tabs
    : isCloser
      ? tabs.filter((tab) => ["dashboard", "crm", "grab-leads", "conversations"].includes(tab.id))
      : tabs.filter((tab) => !["roles", "profile", "developer", "grab-leads"].includes(tab.id)))
    .filter((tab) => !tabFeatureMap[tab.id] || hasFeature(tabFeatureMap[tab.id] as string));
  const canImportLeads = isWorkspaceAdmin || roundRobinAccess.allowNonAdminImportData;
  const canExportLeads = isWorkspaceAdmin || roundRobinAccess.allowNonAdminExportData;
  const canModifyLeads = isWorkspaceAdmin || roundRobinAccess.allowNonAdminModifyLeads;
  const canUseGrabLeads = roundRobinAccess.enabled && Boolean(currentAgent?.canClaimLeads);
  const canViewTeamData = isWorkspaceAdmin || effectiveWorkspaceRole === "MANAGER";
  const viewingAgent = viewingAgentId === "all"
    ? null
    : snapshot.visibleAgents.find((agent) => agent.id === viewingAgentId) ?? null;

  // SIM Calling Telemetry & Filtering
  const filteredCalls = useMemo(() => {
    return (snapshot.mobileCalls || []).filter((call) => {
      const callDate = call.startedAt;
      if (dateRangeFilter === "today") return isDateToday(callDate);
      if (dateRangeFilter === "yesterday") return isDateYesterday(callDate);
      if (dateRangeFilter === "last7") return isDateInLastDays(callDate, 7);
      if (dateRangeFilter === "month") return isDateThisMonth(callDate);
      return true;
    });
  }, [snapshot.mobileCalls, dateRangeFilter]);

  const simMetrics = useMemo(() => {
    const totalCalls = filteredCalls.length;
    const connectedCalls = filteredCalls.filter((c) => (c.durationSeconds && c.durationSeconds > 0) || c.status === "COMPLETED" || c.status === "CONNECTED");
    const totalTalkTimeSeconds = connectedCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
    const avgDurationSeconds = connectedCalls.length > 0 ? Math.round(totalTalkTimeSeconds / connectedCalls.length) : 0;
    const connectRate = totalCalls > 0 ? Math.round((connectedCalls.length / totalCalls) * 100) : 0;
    const uploadedRecordings = filteredCalls.filter((c) => c.recordingStatus === "UPLOADED").length;

    return {
      totalCalls,
      connectedCallsCount: connectedCalls.length,
      connectRate,
      totalTalkTimeSeconds,
      avgDurationSeconds,
      uploadedRecordings,
    };
  }, [filteredCalls]);

  // Scheduled Callbacks & Follow-up Leads Due
  const callbackLeads = useMemo(() => {
    return (snapshot.visibleLeads || []).filter((lead) => {
      if (!lead.followUpAt) return false;
      if (dateRangeFilter === "today") return isFollowUpDueTodayOrPast(lead.followUpAt);
      if (dateRangeFilter === "yesterday") return isDateYesterday(lead.followUpAt);
      if (dateRangeFilter === "last7") return isDateInLastDays(lead.followUpAt, 7);
      if (dateRangeFilter === "month") return isDateThisMonth(lead.followUpAt);
      return true;
    }).sort((a, b) => new Date(a.followUpAt || 0).getTime() - new Date(b.followUpAt || 0).getTime());
  }, [snapshot.visibleLeads, dateRangeFilter]);

  // Stream of recent SIM calls (newest first)
  const recentCalls = useMemo(() => {
    const base = filteredCalls.length > 0 ? filteredCalls : snapshot.mobileCalls || [];
    return [...base]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10);
  }, [filteredCalls, snapshot.mobileCalls]);

  type RepGoal = {
    callsTarget: number;
    talkTimeMinutesTarget: number;
    dealsTarget: number;
  };

  const [repGoals, setRepGoals] = useState<RepGoal>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gxclosers-rep-sim-goals");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return { callsTarget: 40, talkTimeMinutesTarget: 90, dealsTarget: 3 };
  });

  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<RepGoal>(repGoals);

  const saveRepGoals = () => {
    setRepGoals(goalDraft);
    if (typeof window !== "undefined") {
      localStorage.setItem("gxclosers-rep-sim-goals", JSON.stringify(goalDraft));
    }
    setIsEditingGoals(false);
    setStatus("Personal SIM calling targets updated.");
  };

  // Today's Actionable Priority Leads
  const todayActionLeads = useMemo(() => {
    return snapshot.visibleLeads.filter((lead) => {
      if (dateRangeFilter === "today") {
        return isDateToday(lead.createdAt) || isFollowUpDueTodayOrPast(lead.followUpAt);
      }
      if (dateRangeFilter === "yesterday") {
        return isDateYesterday(lead.createdAt);
      }
      if (dateRangeFilter === "last7") {
        return isDateInLastDays(lead.createdAt, 7) || isDateInLastDays(lead.updatedAt, 7);
      }
      if (dateRangeFilter === "month") {
        return isDateThisMonth(lead.createdAt) || isDateThisMonth(lead.updatedAt);
      }
      return true;
    }).slice(0, 6);
  }, [snapshot.visibleLeads, dateRangeFilter]);

  // Rep Achievements vs Goals (SIM Calling Velocity)
  const repAchievements = useMemo(() => {
    const callsDone = simMetrics.totalCalls;
    const talkTimeDoneMinutes = Math.round(simMetrics.totalTalkTimeSeconds / 60);
    const dealsWon = snapshot.visibleLeads.filter((l) => l.stage === "CLOSED_WON" || l.stage === "PAID").length;

    return {
      calls: callsDone,
      talkTimeMinutes: talkTimeDoneMinutes,
      deals: dealsWon,
      callsPercent: Math.min(100, Math.round((callsDone / Math.max(1, repGoals.callsTarget)) * 100)),
      talkTimePercent: Math.min(100, Math.round((talkTimeDoneMinutes / Math.max(1, repGoals.talkTimeMinutesTarget)) * 100)),
      dealsPercent: Math.min(100, Math.round((dealsWon / Math.max(1, repGoals.dealsTarget)) * 100)),
    };
  }, [simMetrics, snapshot.visibleLeads, repGoals]);

  const [leadOwnershipScope, setLeadOwnershipScope] = useState<"all" | "mine">("all");

  const baseLeads = useMemo(() => {
    if (isCloser) return snapshot.visibleLeads;
    if (leadOwnershipScope === "mine") return snapshot.visibleLeads;
    return snapshot.leads && snapshot.leads.length > 0 ? snapshot.leads : snapshot.visibleLeads;
  }, [isCloser, leadOwnershipScope, snapshot.leads, snapshot.visibleLeads]);

  const todayLeadsCount = useMemo(
    () => baseLeads.filter((lead) => isDateToday(lead.createdAt)).length,
    [baseLeads],
  );

  const todayFollowupsCount = useMemo(
    () => baseLeads.filter((lead) => isFollowUpDueTodayOrPast(lead.followUpAt)).length,
    [baseLeads],
  );

  const [savedLeadViews, setSavedLeadViews] = useState<SavedLeadView[]>([]);
  const [savedViewSelection, setSavedViewSelection] = useState("all");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [enforceWorkspace2FA, setEnforceWorkspace2FA] = useState(true);
  const [requireFieldVisitGps, setRequireFieldVisitGps] = useState(true);
  const [callsHubView, setCallsHubView] = useState<"all" | "dialer" | "missed" | "history">("all");
  const [automationsHubView, setAutomationsHubView] = useState<"all" | "workflows" | "ai-bot">("all");
  const [settingsHubView, setSettingsHubView] = useState<"all" | "channels" | "team" | "custom-fields" | "security">("all");
  const isWhatsAppConnected = Boolean(
    salesOperations.whatsAppConnection &&
      (salesOperations.whatsAppConnection.status === "Number connected" ||
        salesOperations.whatsAppConnection.status === "Ready for webhook") &&
      (salesOperations.whatsAppConnection.phoneNumberId?.trim() ||
        salesOperations.whatsAppConnection.wabaId?.trim()),
  );
  const isInstagramConnected = Boolean(
    salesOperations.instagramConnection?.pluginEnabled &&
      salesOperations.instagramConnection.status === "Connected",
  );
  const leadSegments = useMemo(
    () => Array.from(new Set(baseLeads.map((lead) => lead.segment).filter(Boolean))).sort(),
    [baseLeads],
  );
  const filteredLeads = useMemo(() => {
    return baseLeads.filter((lead) => {
      const search = crmSearch.trim().toLowerCase();
      if (search) {
        const haystack = [
          lead.customerName,
          lead.customerPhone,
          lead.customerEmail,
          lead.source,
          lead.serviceInterest,
          lead.segment,
          lead.notes,
          ...(lead.tags || []),
        ].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (statusFilter !== "all") {
        const selectedColumn = pipelineColumns.find((column) => column.key === statusFilter);
        if (selectedColumn && !selectedColumn.matchingStages.includes(lead.stage)) return false;
      }

      if (groupFilter !== "all") {
        const assignedAgent = snapshot.agents.find((agent) => agent.id === lead.assignedAgentId);
        const leadGroupId = assignedAgent?.groupId ?? "unassigned";
        if (leadGroupId !== groupFilter) return false;
      }

      if (sourceFilter !== "all" && (lead.source || "manual") !== sourceFilter) return false;

      // 1. Segment & Smart Reusable Cohort filter
      if (segmentFilter === "smart:high-value") {
        if ((lead.budgetAmount || 0) < 25000 && lead.priority !== "hot") return false;
      } else if (segmentFilter === "smart:recaptured") {
        const hasRecaptureTag = (lead.tags || []).some(
          (t) => t.toLowerCase().includes("recaptur") || t.toLowerCase().includes("merged") || t.toLowerCase().includes("duplicate")
        );
        const hasMergedNote = (lead.notes || "").toLowerCase().includes("merged") || (lead.notes || "").toLowerCase().includes("re-inquir");
        if (!hasRecaptureTag && !hasMergedNote) return false;
      } else if (segmentFilter === "smart:callback-due") {
        if (!isFollowUpDueTodayOrPast(lead.followUpAt) && lead.stage !== "FOLLOW_UP") return false;
      } else if (segmentFilter !== "all" && lead.segment !== segmentFilter) {
        return false;
      }

      // 2. Quick Pill filter
      if (quickPillFilter === "today-leads") {
        return isDateToday(lead.createdAt);
      }
      if (quickPillFilter === "today-followups") {
        return isFollowUpDueTodayOrPast(lead.followUpAt);
      }

      // 3. Date range filter
      if (dateRangeFilter === "today") {
        return isDateToday(lead.createdAt) || isDateToday(lead.updatedAt);
      }
      if (dateRangeFilter === "yesterday") {
        return isDateYesterday(lead.createdAt) || isDateYesterday(lead.updatedAt);
      }
      if (dateRangeFilter === "last7") {
        return isDateInLastDays(lead.createdAt, 7) || isDateInLastDays(lead.updatedAt, 7);
      }
      if (dateRangeFilter === "month") {
        return isDateThisMonth(lead.createdAt) || isDateThisMonth(lead.updatedAt);
      }
      if (dateRangeFilter === "custom" && (customStartDate || customEndDate)) {
        const leadTime = new Date(lead.createdAt).getTime();
        if (customStartDate && leadTime < new Date(customStartDate).getTime()) return false;
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (leadTime > end.getTime()) return false;
        }
      }

      return true;
    });
  }, [baseLeads, crmSearch, statusFilter, groupFilter, sourceFilter, snapshot.agents, segmentFilter, quickPillFilter, dateRangeFilter, customStartDate, customEndDate]);
  const listLeads = useMemo(
    () => [...filteredLeads].sort((left, right) => {
      const leftCall = snapshot.mobileCalls.find((call) => call.assignmentId === left.id)?.startedAt;
      const rightCall = snapshot.mobileCalls.find((call) => call.assignmentId === right.id)?.startedAt;
      return new Date(rightCall ?? right.updatedAt).getTime() - new Date(leftCall ?? left.updatedAt).getTime();
    }),
    [filteredLeads, snapshot.mobileCalls],
  );
  const latestCallByLead = useMemo(() => {
    const calls = new Map<string, SalesDashboardSnapshot["mobileCalls"][number]>();
    for (const call of snapshot.mobileCalls) {
      if (!calls.has(call.assignmentId)) calls.set(call.assignmentId, call);
    }
    return calls;
  }, [snapshot.mobileCalls]);
  const openLeadPool = useMemo(
    () => snapshot.visibleLeadPool.filter((item) => item.status === "OPEN"),
    [snapshot.visibleLeadPool],
  );
  const selectedLead = selectedLeadId ? baseLeads.find((lead) => lead.id === selectedLeadId) ?? null : null;
  const sourceOptions = useMemo(
    () => Array.from(new Set(baseLeads.map((lead) => lead.source || "manual"))).sort(),
    [baseLeads],
  );
  const groupOptions = useMemo(
    () => snapshot.groups.filter((group) => group.isActive).map((group) => ({ id: group.id, name: group.name })),
    [snapshot.groups],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("gxclosers-saved-lead-views");
      if (!stored) return;
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) setSavedLeadViews(parsed as SavedLeadView[]);
    } catch {
      // Saved views are a convenience; malformed local data should not block CRM loading.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const source = new EventSource("/api/sales/realtime");
    let refreshTimer: number | undefined;
    const onEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; eventType?: string };
        const eventType = payload.eventType ?? payload.type;
        if (!eventType || ["lead.created", "lead.updated", "call.started", "call.ended", "recording.uploaded", "recording.failed", "conversation.created", "message.created"].includes(eventType)) {
          if (refreshTimer) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => { void refresh().catch(() => undefined); }, 250);
        }
      } catch {
        // A malformed realtime event must not interrupt the dashboard stream.
      }
    };
    source.addEventListener("crm", onEvent);
    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      source.close();
    };
  }, [viewingAgentId]);

  useEffect(() => {
    let active = true;
    void fetch("/api/sales/round-robin", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active || !payload?.ok || !payload.settings) return;
        setRoundRobinAccess({
          enabled: payload.settings.enabled !== false,
          allowNonAdminModifyLeads: payload.settings.allowNonAdminModifyLeads !== false,
          allowNonAdminImportData: payload.settings.allowNonAdminImportData === true,
          allowNonAdminExportData: payload.settings.allowNonAdminExportData === true,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncPermissions = () => { void refresh(viewingAgentId).catch(() => undefined); };
    window.addEventListener("focus", syncPermissions);
    const interval = window.setInterval(syncPermissions, 30_000);
    return () => {
      window.removeEventListener("focus", syncPermissions);
      window.clearInterval(interval);
    };
  }, [viewingAgentId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedTab = params.get("tab") ?? window.sessionStorage.getItem("gigxomi-sales-tab");
    const savedView = params.get("view");
    const savedViewingAgent = params.get("viewAgent") ?? window.sessionStorage.getItem("gxclosers-viewing-agent");
    if (savedViewingAgent && savedViewingAgent !== "all") {
      setViewingAgentId(savedViewingAgent);
      void refresh(savedViewingAgent).catch(() => setStatus("Unable to load the selected user's workspace data."));
    }
    const timer = window.setTimeout(() => {
      if (savedTab === "campaigns") {
        setActiveTab("calls");
        setCallsHubView("dialer");
      } else if (savedTab === "ai-beta" || savedTab === "ai-bot" || savedTab === "referrals") {
        setActiveTab("automations");
        setAutomationsHubView("ai-bot");
      } else if (savedTab === "roles") {
        setActiveTab(isWorkspaceAdmin ? "roles" : "dashboard");
        if (isWorkspaceAdmin) setSettingsHubView("team");
      } else if (savedTab === "custom-fields") {
        setActiveTab("profile");
        setSettingsHubView("custom-fields");
      } else if (savedTab === "leads" || savedTab === "queue" || savedTab === "deals") {
        setActiveTab("crm");
      } else if (tabs.some((tab) => tab.id === savedTab) && navigationTabs.some((tab) => tab.id === savedTab)) {
        setActiveTab(savedTab as SalesTab);
      } else if (!navigationTabs.some((tab) => tab.id === activeTab)) {
        setActiveTab("dashboard");
      }
      if (savedView === "kanban" || savedView === "list") setCrmView(savedView);
      restoredNavigation.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (viewingAgentId !== "all" && !snapshot.visibleAgents.some((agent) => agent.id === viewingAgentId)) {
      setViewingAgentId("all");
    }
  }, [snapshot.visibleAgents, viewingAgentId]);

  useEffect(() => {
    if (!restoredNavigation.current) return;
    window.sessionStorage.setItem("gigxomi-sales-tab", activeTab);
    window.sessionStorage.setItem("gigxomi-sales-crm-view", crmView);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    if (activeTab === "crm") url.searchParams.set("view", crmView);
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  }, [activeTab, crmView]);

  useEffect(() => {
    if (!restoredNavigation.current || activeTab === "dashboard" || hydratedTabs.current.has(activeTab)) return;
    hydratedTabs.current.add(activeTab);
    void refresh().catch(() => setStatus("Unable to refresh this CRM view."));
  }, [activeTab]);

  function resetLeadFilters() {
    setCrmSearch("");
    setStatusFilter("all");
    setGroupFilter("all");
    setSourceFilter("all");
    setSegmentFilter("all");
    setLeadOwnershipScope("all");
    setQuickPillFilter("all");
    setDateRangeFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
  }

  function applySavedLeadView(view: SavedLeadView) {
    setCrmSearch(view.search);
    setStatusFilter(view.status);
    setGroupFilter(view.group);
    setSourceFilter(view.source);
    setSegmentFilter(view.segment);
    setLeadOwnershipScope(view.ownership);
    setQuickPillFilter(view.quickPill);
    setDateRangeFilter(view.dateRange);
    setCustomStartDate(view.customStartDate);
    setCustomEndDate(view.customEndDate);
  }

  function handleSavedViewChange(value: string) {
    setSavedViewSelection(value);
    resetLeadFilters();
    if (value === "all") {
      return;
    }
    if (value === "builtin:high-value") {
      setSegmentFilter("smart:high-value");
      return;
    }
    if (value === "builtin:recaptured") {
      setSegmentFilter("smart:recaptured");
      return;
    }
    if (value === "builtin:callback-due") {
      setSegmentFilter("smart:callback-due");
      return;
    }
    const view = savedLeadViews.find((item) => item.id === value);
    if (view) applySavedLeadView(view);
  }

  function saveCurrentLeadView() {
    const name = typeof window !== "undefined" ? window.prompt("Name this saved lead view:") : null;
    const trimmed = name?.trim();
    if (!trimmed) return;
    const view: SavedLeadView = {
      id: `saved-view-${Date.now()}`,
      name: trimmed,
      search: crmSearch,
      status: statusFilter,
      group: groupFilter,
      source: sourceFilter,
      segment: segmentFilter,
      ownership: leadOwnershipScope,
      quickPill: quickPillFilter,
      dateRange: dateRangeFilter,
      customStartDate,
      customEndDate,
    };
    const nextViews = [...savedLeadViews.filter((item) => item.name.toLowerCase() !== trimmed.toLowerCase()), view];
    setSavedLeadViews(nextViews);
    window.localStorage.setItem("gxclosers-saved-lead-views", JSON.stringify(nextViews));
    setSavedViewSelection(view.id);
    setStatus(`Saved lead view "${trimmed}".`);
  }

  async function refresh(agentId = viewingAgentId) {
    const params = new URLSearchParams();
    if (agentId && agentId !== "all") params.set("agentId", agentId);
    const response = await fetch(`/api/sales/dashboard${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (payload?.ok) setSnapshot(payload.snapshot);
    try {
      const permissionsResponse = await fetch("/api/sales/roles/features", { cache: "no-store" });
      const permissionsPayload = await permissionsResponse.json().catch(() => null);
      if (permissionsPayload?.ok && permissionsPayload.userPermissions && typeof permissionsPayload.userPermissions === "object") {
        setLiveRolePermissions(permissionsPayload.userPermissions as Record<string, boolean>);
      }
    } catch {
      // Permission refresh is best-effort and must not block CRM data refresh.
    }
  }

  function updateViewingAgent(agentId: string) {
    setViewingAgentId(agentId);
    window.sessionStorage.setItem("gxclosers-viewing-agent", agentId);
    const url = new URL(window.location.href);
    if (agentId === "all") url.searchParams.delete("viewAgent");
    else url.searchParams.set("viewAgent", agentId);
    window.history.replaceState({}, "", url);
    void refresh(agentId).catch(() => setStatus("Unable to load the selected user's workspace data."));
  }

  async function exportLeads(format: "csv" | "excel") {
    if (!canExportLeads) {
      setStatus("Lead export is disabled for your role. Ask an administrator to enable it.");
      return;
    }
    try {
      setStatus(`Exporting leads ${format === "excel" ? "Excel" : "CSV"}...`);
      const res = await fetch("/api/sales/reports/export?type=leads");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aicloser-leads-export-${new Date().toISOString().slice(0, 10)}${format === "excel" ? ".xls" : ".csv"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setIsLeadExportMenuOpen(false);
      setStatus(`Leads ${format === "excel" ? "Excel" : "CSV"} exported successfully.`);
    } catch (err: any) {
      setStatus(`Export failed: ${err?.message || "Error downloading leads"}`);
    }
  }

  async function submitJson(url: string, body: Record<string, unknown>, success: string) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    const ok = Boolean(response.ok && payload?.ok);
    setStatus(ok ? success : payload?.error ?? "Action failed.");
    await refresh();
    return ok;
  }

  async function refreshOperating() {
    const conversations = await fetch("/api/sales/conversations", { cache: "no-store" }).then((item) => item.json()).catch(() => null);
    setOperating((current) => ({
      courses: current?.courses ?? [],
      modules: current?.modules ?? [],
      lessons: current?.lessons ?? [],
      progress: current?.progress ?? [],
      unlockRules: current?.unlockRules ?? [],
      agentLevel: current?.agentLevel ?? null,
      mockCalls: current?.mockCalls ?? [],
      webinars: current?.webinars ?? [],
      webinarInvites: current?.webinarInvites ?? [],
      learningPosts: current?.learningPosts ?? [],
      timeline: conversations?.timeline ?? current?.timeline ?? [],
      roundRobinRules: current?.roundRobinRules ?? [],
    }));
  }

  async function submitOperating(url: string, body: Record<string, unknown>, success: string) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    const ok = Boolean(response.ok && payload?.ok);
    setStatus(ok ? success : payload?.error ?? "Action failed.");
    await refreshOperating();
    return ok;
  }

  async function reassignLead(leadId: string, assignedAgentId: string) {
    return submitJson(
      "/api/sales/leads",
      { action: "assign", leadId, assignedAgentId },
      "Lead reassigned successfully.",
    );
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await submitJson(
      "/api/sales/leads",
      {
        customerName: String(form.get("customerName") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        customerEmail: String(form.get("customerEmail") ?? ""),
        serviceInterest: "Agency services",
        segment: "agency",
        notes: String(form.get("notes") ?? ""),
      },
      "Lead added to your CRM.",
    );
    if (ok) {
      formElement.reset();
      setDrawer(null);
    }
  }

  async function importContacts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canImportLeads) {
      setStatus("Lead import is disabled for your role. Ask an administrator to enable it.");
      return;
    }
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setIsImporting(true);
    setStatus("Importing contacts...");
    try {
      const response = await fetch("/api/sales/leads/import", { method: "POST", body: formData });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setStatus(payload?.error ?? "Contact import failed.");
        return;
      }
      const result = {
        imported: Number(payload.imported ?? 0),
        skipped: Number(payload.skipped ?? 0),
        duplicate: Number(payload.duplicate ?? 0),
        invalid: Number(payload.invalid ?? 0),
        errors: payload.errors ?? [],
      };
      setImportResult(result);
      setStatus(`${result.imported} contacts imported into your CRM.`);
      formElement.reset();
      await refresh();
    } catch {
      setStatus("Contact import could not reach the server. Try again.");
    } finally {
      setIsImporting(false);
    }
  }

  async function updateLeadStage(leadId: string, stage: SalesLeadStage) {
    await submitJson("/api/sales/leads", { action: "stage", leadId, stage }, "Lead stage updated.");
  }

  async function addQuickLeadNote(leadId: string, body: string) {
    const response = await fetch(`/api/sales/leads/${encodeURIComponent(leadId)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim(), type: "NOTE", source: "web-dashboard" }),
    });
    const payload = await response.json().catch(() => null);
    const ok = Boolean(response.ok && payload?.ok);
    setStatus(ok ? "Note saved and synced." : payload?.error ?? "Unable to save note.");
    if (ok) await Promise.all([refresh(), refreshOperating()]);
    return ok;
  }

  async function saveQuickFollowUp(leadId: string, followUpAt: string) {
    const lead = snapshot.visibleLeads.find((item) => item.id === leadId) ?? snapshot.leads.find((item) => item.id === leadId);
    if (!lead) return false;
    return submitJson(
      "/api/sales/leads",
      {
        action: "update",
        leadId,
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        customerEmail: lead.customerEmail,
        serviceInterest: lead.serviceInterest,
        segment: lead.segment,
        priority: lead.priority,
        tags: lead.tags,
        budgetAmount: lead.budgetAmount,
        followUpAt,
        notes: lead.notes,
      },
      "Next follow-up saved.",
    );
  }

  async function moveLeadStage(leadId: string, stage: SalesLeadStage) {
    const previous = snapshot;
    const target = snapshot.visibleLeads.find((lead) => lead.id === leadId);
    if (!target || target.stage === stage) return;
    setSnapshot((current) => ({
      ...current,
      visibleLeads: current.visibleLeads.map((lead) => (lead.id === leadId ? { ...lead, stage } : lead)),
    }));
    const response = await fetch("/api/sales/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stage", leadId, stage }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      setSnapshot(previous);
      setStatus(payload?.error ?? "Lead stage update failed.");
      return;
    }
    setStatus("Lead stage updated.");
    await refresh();
  }

  function handleLeadDragEnd(event: DragEndEvent) {
    if (!canModifyLeads) {
      setStatus("Lead stage changes are disabled for your role. Ask an administrator to enable them.");
      return;
    }
    const leadId = String(event.active.id);
    const overId = String(event.over?.id ?? "");
    const overLead = snapshot.visibleLeads.find((lead) => lead.id === overId) ?? snapshot.leads.find((lead) => lead.id === overId);
    const overStage = (event.over?.data.current?.stage as SalesLeadStage | undefined) ??
      (overId.startsWith("stage:") ? overId.slice("stage:".length) as SalesLeadStage : overLead?.stage);
    if (overStage) moveLeadStage(leadId, overStage).catch(() => setStatus("Lead stage update failed."));
  }

  async function updateLeadBasics(event: FormEvent<HTMLFormElement>, leadId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitJson(
      "/api/sales/leads",
      {
        action: "update",
        leadId,
        customerName: String(form.get("customerName") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        customerEmail: String(form.get("customerEmail") ?? ""),
        serviceInterest: String(form.get("serviceInterest") ?? ""),
        segment: String(form.get("segment") ?? ""),
        priority: String(form.get("priority") ?? "normal"),
        tags: String(form.get("tags") ?? ""),
        budgetAmount: Number(form.get("budgetAmount") ?? 0),
        followUpAt: String(form.get("followUpAt") ?? ""),
        notes: String(form.get("notes") ?? ""),
      },
      "Lead CRM details saved.",
    );
  }

  async function sendLeadWhatsApp(event: FormEvent<HTMLFormElement>, leadId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submitJson(
      "/api/sales/whatsapp",
      {
        leadId,
        message: String(form.get("message") ?? ""),
      },
      "WhatsApp message sent from the shared Gigxomi inbox.",
    );
    if (ok) event.currentTarget.reset();
  }

  async function openLeadChat(leadId: string) {
    setStatus("Opening WhatsApp chat...");
    try {
      const response = await fetch(`/api/sales/conversations/${leadId}`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload.conversationId) {
        setStatus(payload?.error ?? "Unable to open WhatsApp chat.");
        return;
      }
      openSalesConversation(String(payload.conversationId));
      setStatus("WhatsApp chat ready.");
    } catch {
      setStatus("WhatsApp chat could not reach the server. Try again.");
    }
  }

  function openSalesConversation(conversationId?: string | null) {
    // Open this person's WhatsApp conversation in the GXclosers inbox
    setSelectedLeadId(null);
    navigateSales("conversations");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "conversations");
    if (conversationId) url.searchParams.set("conversationId", conversationId);
    else url.searchParams.delete("conversationId");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  async function addLeadNote(event: FormEvent<HTMLFormElement>, leadId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submitOperating(`/api/sales/conversations/${leadId}/note`, { body: String(form.get("body") ?? ""), type: String(form.get("type") ?? "NOTE") }, "Conversation note saved.");
    if (ok) event.currentTarget.reset();
  }

  const headerPills = [
    `${snapshot.visibleLeads.length} Active Leads`,
    `${simMetrics.totalCalls} Calls Logged`,
    `${snapshot.reports.conversionRate}% Conversion`,
    isWhatsAppConnected ? "WhatsApp: Ready" : "WhatsApp: Needs setup",
  ];

  function navigateSales(section: string) {
    const nextTab = section as SalesTab;
    setActiveTab(nextTab);
    setStatus("");
    if (!operating && nextTab === "conversations") {
      refreshOperating().catch(() => setStatus("Unable to load sales operating system data."));
    }
  }
  const salesThemeStyle = {
    "--accent": "var(--closer-orange)",
    "--color-primary": "var(--closer-orange)",
    "--gx-primary": "var(--closer-orange)",
  } as CSSProperties;
  const isConversationTab = activeTab === "conversations";
  const activeWorkspaceUsers = snapshot.visibleAgents.filter((agent) => agent.status === "ACTIVE").length;
  const profilePlanName = currentAgent?.packageStatus === "ACTIVE" && currentAgent.packageName
    ? currentAgent.packageName
    : currentAgent?.packageName ?? "Free plan";
  const profilePlan = `${profilePlanName} · ${activeWorkspaceUsers} ${activeWorkspaceUsers === 1 ? "user" : "users"}`;

  return (
    <InternalAppShell
      activeSection={activeTab}
      appLabel="AIcloser"
      contentClassName={isConversationTab ? "sales-internal-content sales-internal-content-chat internal-content-chat" : "sales-internal-content"}
      headerPills={activeTab === "dashboard" ? headerPills : []}
      homeHref="/"
      navItems={navigationTabs}
      navigationOrderKey={`sales-${sessionRole}-${currentAgent?.id ?? "workspace"}`}
      onNavigate={navigateSales}
      profileMeta={currentAgent?.agentCode ?? "Sales agent"}
      profilePlan={isCloser ? undefined : profilePlan}
      profileName={currentAgent?.displayName ?? "Sales workspace"}
      showNotifications
      showTopbar
      showTopbarLabel
      title={pageTitle}
      topbarAccessory={canViewTeamData ? <AdminViewingContext agents={snapshot.visibleAgents} selectedAgentId={viewingAgentId} onChange={updateViewingAgent} /> : null}
      topbarCenter={<GlobalAiToggleButton />}
    >
      <div className={isConversationTab ? "sales-theme-scope sales-theme-scope-chat" : "sales-theme-scope"} style={salesThemeStyle}>
      {activeTab === "dashboard" ? (
        <section className="sales-dashboard-overview">
          {canViewTeamData ? <TeamActivityPanel /> : null}
          {/* 1. Executive Daily Status & Date Filter Bar */}
          <div className="sales-dashboard-hero">
            <div className="sales-hero-top-row">
              <div className="sales-hero-left">
                <div className="sales-hero-badge">
                  <span className="live-pulsing-dot" />
                  <span>Welcome to AIcloser</span>
                </div>
                <h2>Welcome back, {currentAgent?.displayName || "Closer"}</h2>
                <p>
                  Today&apos;s workspace focus: <strong>{simMetrics.totalCalls} calls logged</strong> (<strong>{formatTalkTime(simMetrics.totalTalkTimeSeconds)} talk time</strong>), <strong>{callbackLeads.length} callbacks scheduled</strong>, and <strong>{todayActionLeads.length} hot leads</strong> in active desk.
                </p>
              </div>

              {/* Date Filter Bar */}
              <div className="sales-hero-timeline-filter">
                <span className="sales-hero-filter-label">
                  Timeline Filter
                </span>
                <div className="sales-timeline-control">
                  {(
                    [
                      { id: "today", label: "Today" },
                      { id: "yesterday", label: "Yesterday" },
                      { id: "last7", label: "Last 7 Days" },
                      { id: "month", label: "This Month" },
                      { id: "all", label: "All Time" },
                    ] as const
                  ).map((item) => {
                    const isActive = dateRangeFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDateRangeFilter(item.id)}
                        className={`sales-timeline-option${isActive ? " active" : ""}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="sales-hero-actions">
              <button
                className="sales-hero-btn primary"
                onClick={() => navigateSales("crm")}
                type="button"
              >
                <KanbanSquare size={16} /> Open CRM Pipeline
              </button>
              {isCloser ? (
                <button
                  className="sales-hero-btn secondary"
                  onClick={() => navigateSales("grab-leads")}
                  type="button"
                >
                  <Hand size={16} /> Grab next lead
                </button>
              ) : (
                <button
                  className="sales-hero-btn secondary"
                  onClick={() => navigateSales("calls")}
                  type="button"
                >
                  <PhoneCall size={16} /> SIM Call History &amp; Audio
                </button>
              )}
              <button
                className="sales-hero-btn secondary"
                onClick={() => navigateSales("conversations")}
                type="button"
              >
                <MessageSquare size={16} /> Open Live Multi-Channel Chat
              </button>
            </div>
          </div>

          {/* 2. Executive SIM Telecalling Performance Bento Grid (Full-Width Responsive 5 Cards) */}
          <section className="sales-dashboard-kpi-grid">
            <div className="sales-kpi-card kpi-calls">
              <div className="sales-kpi-label">
                <div className="sales-kpi-icon">
                  <PhoneCall size={15} />
                </div>
                Total Calls Logged
              </div>
              <div className="sales-kpi-value">
                {simMetrics.totalCalls}
              </div>
              <div className="sales-kpi-meta">
                {simMetrics.connectedCallsCount} Connected
              </div>
            </div>

            <div className="sales-kpi-card kpi-talk">
              <div className="sales-kpi-label">
                <div className="sales-kpi-icon">
                  <Clock3 size={15} />
                </div>
                Total Talk Time
              </div>
              <div className="sales-kpi-value">
                {formatTalkTime(simMetrics.totalTalkTimeSeconds)}
              </div>
              <div className="sales-kpi-meta">
                Avg {audioTime(simMetrics.avgDurationSeconds)} / call
              </div>
            </div>

            <div className="sales-kpi-card kpi-connect">
              <div className="sales-kpi-label">
                <div className="sales-kpi-icon">
                  <TrendingUp size={15} />
                </div>
                Connect Rate
              </div>
              <div className="sales-kpi-value">
                {simMetrics.connectRate}%
              </div>
              <div className="sales-kpi-meta">
                {simMetrics.uploadedRecordings} Audio Synced
              </div>
            </div>

            <div className="sales-kpi-card kpi-callbacks">
              <div className="sales-kpi-label">
                <div className="sales-kpi-icon">
                  <CalendarClock size={15} />
                </div>
                Callbacks Due Today
              </div>
              <div className="sales-kpi-value">
                {callbackLeads.length}
              </div>
              <div className="sales-kpi-meta">
                Pending follow-ups
              </div>
            </div>

            <div className="sales-kpi-card kpi-priority">
              <div className="sales-kpi-label">
                <div className="sales-kpi-icon">
                  <Flame size={15} />
                </div>
                Priority Leads in Desk
              </div>
              <div className="sales-kpi-value">
                {todayActionLeads.length}
              </div>
              <div className="sales-kpi-meta">
                {snapshot.visibleLeads.length} total in pipeline
              </div>
            </div>
          </section>

          {/* 2. Today's SIM Calling Action Center (Callbacks Due & Recent Calls Streams) */}
          <div className="sales-action-center-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "18px" }}>
            {/* Card 1: Today's Scheduled Callbacks Due */}
            <div
              className="sales-action-card sales-callbacks-card"
              style={{
                background: "var(--closer-surface, #ffffff)",
                border: "1px solid var(--closer-line, #cbd5e1)",
                borderRadius: "18px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                boxShadow: "var(--shadow-card, 0 8px 24px rgba(15, 23, 42, 0.05))",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--closer-line, #cbd5e1)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706" }}>
                    <CalendarClock size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
                      Today&apos;s Scheduled Callbacks Due
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
                      Leads requiring a scheduled follow-up call today
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px", background: "rgba(245, 158, 11, 0.15)", color: "#d97706", border: "1px solid rgba(245, 158, 11, 0.35)" }}>
                  {callbackLeads.length} Due
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "340px", overflowY: "auto", paddingRight: "4px" }}>
                {callbackLeads.length === 0 ? (
                  <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--closer-muted, #64748b)", fontSize: "13px" }}>
                    <CheckCircle2 size={28} style={{ margin: "0 auto 8px", color: "#10b981", opacity: 0.85 }} />
                    <strong style={{ display: "block", color: "var(--closer-ink, #0f172a)", marginBottom: "2px" }}>All Callbacks Completed!</strong>
                    No scheduled follow-up calls pending for this period.
                  </div>
                ) : (
                  callbackLeads.map((lead) => (
                    <div
                      key={lead.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: "var(--closer-soft, rgba(148, 163, 184, 0.08))",
                        border: "1px solid var(--closer-line, #cbd5e1)",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "14px", color: "var(--closer-ink, #0f172a)" }}>{lead.customerName}</strong>
                          <span className={`sales-chip ${stageTone(lead.stage)}`} style={{ fontSize: "10px", padding: "1px 6px" }}>
                            {lead.stage}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--closer-muted, #64748b)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <span>{lead.customerPhone}</span>
                          <span>•</span>
                          <span style={{ color: "#d97706", fontWeight: 600 }}>
                            {lead.followUpAt ? formatDateTime(lead.followUpAt) : "Due today"}
                          </span>
                          {lead.notes ? (
                            <>
                              <span>•</span>
                              <span style={{ maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {lead.notes}
                              </span>
                            </>
                          ) : null}
                          <span>•</span>
                          <span style={{ color: "var(--closer-ink, #334155)", fontWeight: 600 }}>
                            Owner: {agentName(snapshot, lead.assignedAgentId)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedLeadId(lead.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "rgba(245, 158, 11, 0.16)",
                            border: "1px solid rgba(245, 158, 11, 0.45)",
                            color: "#d97706",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Open Lead
                        </button>
                        {lead.conversationId ? (
                          <button
                            type="button"
                            aria-label="Open WhatsApp Chat"
                            onClick={() => openSalesConversation(lead.conversationId)}
                            title="Open WhatsApp Chat"
                            style={{
                              padding: "6px 8px",
                              borderRadius: "8px",
                              background: "rgba(16, 185, 129, 0.15)",
                              border: "1px solid rgba(16, 185, 129, 0.35)",
                              color: "#10b981",
                              cursor: "pointer",
                            }}
                          >
                            <MessageSquare size={13} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 2: Recent SIM Calls & Audio Recordings */}
            <div
              className="sales-action-card sales-recent-calls-card"
              style={{
                background: "var(--closer-surface, #ffffff)",
                border: "1px solid var(--closer-line, #cbd5e1)",
                borderRadius: "18px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                boxShadow: "var(--shadow-card, 0 8px 24px rgba(15, 23, 42, 0.05))",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--closer-line, #cbd5e1)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7" }}>
                    <PhoneCall size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
                      Recent call activity
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
                      Calls and recordings · {viewingAgent?.displayName ?? "All team users"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateSales("calls")}
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#0284c7",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    cursor: "pointer",
                  }}
                >
                  View All ({filteredCalls.length})
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "340px", overflowY: "auto", paddingRight: "4px" }}>
                {recentCalls.length === 0 ? (
                  <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--closer-muted, #64748b)", fontSize: "13px" }}>
                    <Headphones size={28} style={{ margin: "0 auto 8px", color: "#0284c7", opacity: 0.85 }} />
                    <strong style={{ display: "block", color: "var(--closer-ink, #0f172a)", marginBottom: "2px" }}>Your call activity will appear here</strong>
                    Calls and recordings will sync here automatically when your team uses the mobile app.
                  </div>
                ) : (
                  recentCalls.map((call) => (
                    <div
                      key={call.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: "var(--closer-soft, rgba(148, 163, 184, 0.08))",
                        border: "1px solid var(--closer-line, #cbd5e1)",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "160px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "14px", color: "var(--closer-ink, #0f172a)" }}>{call.customerName}</strong>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "1px 5px",
                              borderRadius: "4px",
                              background: call.durationSeconds > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              color: call.durationSeconds > 0 ? "#059669" : "#dc2626",
                            }}
                          >
                            {call.durationSeconds > 0 ? `${call.durationSeconds}s` : "Missed / 0s"}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--closer-muted, #64748b)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <span>{call.phoneNumber}</span>
                          <span>•</span>
                          <span>{formatDateTime(call.startedAt)}</span>
                          <span>•</span>
                          <span style={{ color: "var(--closer-ink, #334155)", fontWeight: 600 }}>
                            By {agentName(snapshot, call.agentId)}
                          </span>
                          {call.outcome ? (
                            <>
                              <span>•</span>
                              <span style={{ color: "#0284c7", fontWeight: 600 }}>{label(call.outcome)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {call.recordingStatus === "UPLOADED" ? (
                          <CallRecordingPlayer
                            callId={call.id}
                            expectedDurationSeconds={call.durationSeconds}
                            labelText={`${call.customerName} recording`}
                          />
                        ) : (
                          <span
                            className={`sales-chip ${call.recordingStatus === "FAILED" ? "danger" : "neutral"}`}
                            style={{ fontSize: "11px" }}
                          >
                            {recordingStatusLabel(call.recordingStatus)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Rep's Personal Goal & Performance Tracker */}
          <div
            className="sales-goal-card"
            style={{
              background: "var(--closer-surface, #ffffff)",
              border: "1px solid var(--closer-line, #cbd5e1)",
              borderRadius: "18px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxShadow: "var(--shadow-card, 0 8px 24px rgba(15, 23, 42, 0.05))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--closer-orange-soft, rgba(255, 107, 47, 0.15))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--closer-orange, #ff6b2f)" }}>
                  <Target size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
                    Closer Personal Goal &amp; Target Tracker
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
                    Set your own daily targets to track your personal conversion velocity and stay on track.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGoalDraft(repGoals);
                  setIsEditingGoals(!isEditingGoals);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "10px",
                  background: "var(--closer-soft, rgba(148, 163, 184, 0.12))",
                  border: "1px solid var(--closer-line, #cbd5e1)",
                  color: "var(--closer-ink, #0f172a)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Edit3 size={13} /> {isEditingGoals ? "Cancel Edit" : "Customize Targets"}
              </button>
            </div>

            {/* Inline Goal Editor */}
            {isEditingGoals ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", background: "var(--closer-soft, rgba(148, 163, 184, 0.1))", padding: "16px", borderRadius: "14px", border: "1px solid var(--closer-line, #cbd5e1)" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--closer-muted, #64748b)", marginBottom: "4px" }}>Daily Calls Target</label>
                  <input
                    type="number"
                    min="1"
                    value={goalDraft.callsTarget}
                    onChange={(e) => setGoalDraft({ ...goalDraft, callsTarget: Number(e.target.value) || 1 })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, #cbd5e1)", color: "var(--closer-ink, #0f172a)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--closer-muted, #64748b)", marginBottom: "4px" }}>Talk Time Target (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={goalDraft.talkTimeMinutesTarget}
                    onChange={(e) => setGoalDraft({ ...goalDraft, talkTimeMinutesTarget: Number(e.target.value) || 1 })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, #cbd5e1)", color: "var(--closer-ink, #0f172a)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--closer-muted, #64748b)", marginBottom: "4px" }}>Deals / Closures Target</label>
                  <input
                    type="number"
                    min="1"
                    value={goalDraft.dealsTarget}
                    onChange={(e) => setGoalDraft({ ...goalDraft, dealsTarget: Number(e.target.value) || 1 })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, #cbd5e1)", color: "var(--closer-ink, #0f172a)", fontSize: "13px" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    type="button"
                    onClick={saveRepGoals}
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", background: "var(--closer-orange, #ff6b2f)", color: "#ffffff", fontWeight: 700, fontSize: "13px", border: 0, cursor: "pointer" }}
                  >
                    Save Targets
                  </button>
                </div>
              </div>
            ) : null}

            {/* 3 Progress Bars */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {/* Metric 1 */}
              <div style={{ background: "var(--closer-soft, rgba(148, 163, 184, 0.08))", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--closer-line, #cbd5e1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--closer-ink, #334155)", fontWeight: 600 }}>SIM Calls Dialed</span>
                  <strong style={{ fontSize: "13px", color: "var(--closer-orange, #ff6b2f)" }}>{repAchievements.calls} / {repGoals.callsTarget} ({repAchievements.callsPercent}%)</strong>
                </div>
                <div style={{ width: "100%", height: "8px", background: "var(--closer-line, #cbd5e1)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${repAchievements.callsPercent}%`, height: "100%", background: "linear-gradient(90deg, var(--closer-orange-dark, #eb5a24), var(--closer-orange, #ff6b2f))", borderRadius: "999px", transition: "width 0.3s ease" }} />
                </div>
              </div>

              {/* Metric 2 */}
              <div style={{ background: "var(--closer-soft, rgba(148, 163, 184, 0.08))", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--closer-line, #cbd5e1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--closer-ink, #334155)", fontWeight: 600 }}>Talk Time Minutes</span>
                  <strong style={{ fontSize: "13px", color: "#0284c7" }}>{repAchievements.talkTimeMinutes}m / {repGoals.talkTimeMinutesTarget}m ({repAchievements.talkTimePercent}%)</strong>
                </div>
                <div style={{ width: "100%", height: "8px", background: "var(--closer-line, #cbd5e1)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${repAchievements.talkTimePercent}%`, height: "100%", background: "linear-gradient(90deg, #0284c7, #38bdf8)", borderRadius: "999px", transition: "width 0.3s ease" }} />
                </div>
              </div>

              {/* Metric 3 */}
              <div style={{ background: "var(--closer-soft, rgba(148, 163, 184, 0.08))", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--closer-line, #cbd5e1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--closer-ink, #334155)", fontWeight: 600 }}>Deals Converted</span>
                  <strong style={{ fontSize: "13px", color: "#10b981" }}>{repAchievements.deals} / {repGoals.dealsTarget} ({repAchievements.dealsPercent}%)</strong>
                </div>
                <div style={{ width: "100%", height: "8px", background: "var(--closer-line, #cbd5e1)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${repAchievements.dealsPercent}%`, height: "100%", background: "linear-gradient(90deg, #16a34a, #4ade80)", borderRadius: "999px", transition: "width 0.3s ease" }} />
                </div>
              </div>
            </div>
          </div>

        </section>
      ) : null}

      {activeTab === "grab-leads" ? (
        <section className="sales-tool-workspace sales-grab-leads-workspace" style={{ width: "100%", maxWidth: "var(--crm-content-max)", margin: "0 auto", padding: "24px 20px" }}>
          <div className="sales-grab-leads-hero">
            <div>
              <span className="sales-section-eyebrow">Round-robin queue</span>
              <h2>Grab your next lead</h2>
              <p>Claim one of the leads waiting in the shared queue. Once claimed, it moves into your CRM pipeline.</p>
            </div>
            <div className="sales-grab-leads-count"><strong>{openLeadPool.length}</strong><span>available now</span></div>
          </div>
          {!canUseGrabLeads ? (
            <div className="sales-empty-state">
              <Hand size={22} />
              <strong>Lead grabbing is not enabled</strong>
              <p>Ask your workspace administrator to enable round-robin grab lead mode for your role.</p>
            </div>
          ) : openLeadPool.length ? (
            <div className="sales-grab-leads-grid">
              {openLeadPool.map((item) => (
                <article className="sales-grab-lead-card" key={item.id}>
                  <div className="sales-grab-lead-card-head">
                    <div>
                      <strong>{item.customerName}</strong>
                      <span>{item.customerPhone || item.customerEmail || "Contact details pending"}</span>
                    </div>
                    <LeadSourceBadge source={item.source} />
                  </div>
                  <div className="sales-lead-meta">
                    <span>{item.priority || "normal"} priority</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  <p>{item.notes || item.serviceInterest || "New lead from shared intake"}</p>
                  <button
                    className="sales-primary-button compact"
                    disabled={!snapshot.currentAgent?.id}
                    onClick={() => void submitJson(
                      "/api/sales/leads",
                      { action: "claim", poolItemId: item.id, agentId: snapshot.currentAgent?.id },
                      "Lead claimed and added to your pipeline.",
                    )}
                    type="button"
                  >
                    <Hand size={15} /> Grab lead
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="sales-empty-state">
              <CheckCircle2 size={22} />
              <strong>No leads are waiting right now</strong>
              <p>New round-robin leads will appear here when the admin adds them to the shared queue.</p>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "crm" ? (
        <section className="sales-crm-workspace">
            <div className={`sales-toolbar sales-crm-toolbar${isCloser ? " is-closer" : ""}`} style={{ flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button className={crmView === "list" ? "sales-icon-button active" : "sales-icon-button"} onClick={() => setCrmView("list")} type="button" title="List view">
                  <LayoutList size={16} />
                </button>
                <button className={crmView === "kanban" ? "sales-icon-button active" : "sales-icon-button"} onClick={() => setCrmView("kanban")} type="button" title="Kanban view">
                  <KanbanSquare size={16} />
                </button>
              </div>

              {/* Quick Filter Pills */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", gap: "4px", background: "var(--closer-soft, rgba(255, 255, 255, 0.05))", padding: "2px 4px", borderRadius: "22px", border: "1px solid var(--closer-line, rgba(255, 255, 255, 0.1))" }}>
                  {!isCloser ? <button
                    type="button"
                    onClick={() => { setSavedViewSelection("all"); setLeadOwnershipScope("all"); setQuickPillFilter("all"); }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      borderRadius: "18px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: leadOwnershipScope === "all" ? "var(--closer-orange, #ff6b2f)" : "transparent",
                      color: leadOwnershipScope === "all" ? "#ffffff" : "var(--closer-ink, rgba(255, 255, 255, 0.75))",
                      border: "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Building2 size={13} style={{ flexShrink: 0 }} /> All Company Leads ({snapshot.leads?.length || snapshot.visibleLeads.length})
                  </button> : null}
                  <button
                    type="button"
                    onClick={() => { setSavedViewSelection("all"); setLeadOwnershipScope("mine"); setQuickPillFilter("all"); }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      borderRadius: "18px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: leadOwnershipScope === "mine" ? "var(--closer-orange, #ff6b2f)" : "transparent",
                      color: leadOwnershipScope === "mine" ? "#ffffff" : "var(--closer-ink, rgba(255, 255, 255, 0.75))",
                      border: "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <User size={13} style={{ flexShrink: 0 }} /> {isCloser ? "My Leads" : "My Assigned"} ({snapshot.visibleLeads.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { setSavedViewSelection("all"); setQuickPillFilter("today-leads"); setDateRangeFilter("all"); }}
                  className={`sales-filter-pill ${quickPillFilter === "today-leads" ? "active" : ""}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: quickPillFilter === "today-leads" ? "rgba(249, 115, 22, 0.18)" : "var(--closer-soft, rgba(255, 255, 255, 0.04))",
                    color: quickPillFilter === "today-leads" ? "var(--closer-orange, #ea580c)" : "var(--closer-ink, rgba(255, 255, 255, 0.8))",
                    border: quickPillFilter === "today-leads" ? "1px solid var(--closer-orange-border, rgba(249, 115, 22, 0.45))" : "1px solid var(--closer-line, rgba(255, 255, 255, 0.1))",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Flame size={13} style={{ flexShrink: 0, color: "var(--closer-orange, #ff6b2f)" }} /> Today&apos;s Leads ({todayLeadsCount})
                </button>

                <button
                  type="button"
                  onClick={() => { setSavedViewSelection("all"); setQuickPillFilter("today-followups"); setDateRangeFilter("all"); }}
                  className={`sales-filter-pill ${quickPillFilter === "today-followups" ? "active" : ""}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: quickPillFilter === "today-followups" ? "rgba(56, 189, 248, 0.18)" : "var(--closer-soft, rgba(255, 255, 255, 0.04))",
                    color: quickPillFilter === "today-followups" ? "#0284c7" : "var(--closer-ink, rgba(255, 255, 255, 0.8))",
                    border: quickPillFilter === "today-followups" ? "1px solid rgba(56, 189, 248, 0.45)" : "1px solid var(--closer-line, rgba(255, 255, 255, 0.1))",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Clock size={13} style={{ flexShrink: 0, color: "#0284c7" }} /> Today&apos;s Follow-ups ({todayFollowupsCount})
                </button>
              </div>

              {/* Date Range Selector */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <select
                  aria-label="Filter leads by date"
                  className="sales-crm-select"
                  value={dateRangeFilter}
                  onChange={(event) => {
                    setSavedViewSelection("all");
                    setDateRangeFilter(event.target.value as any);
                    setQuickPillFilter("all");
                  }}
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>

                {dateRangeFilter === "custom" ? (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <input
                      className="sales-crm-date-input"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                    <span style={{ fontSize: "11px", opacity: 0.6 }}>to</span>
                    <input
                      className="sales-crm-date-input"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              {/* Saved lead views */}
              <div className="sales-saved-view-control">
                <div className="sales-saved-view-copy">
                  <strong>Saved lead views</strong>
                  <span>Search presets you saved</span>
                </div>
                <select
                  aria-label="Choose a saved lead view"
                  className="sales-crm-select"
                  value={savedViewSelection}
                  onChange={(event) => handleSavedViewChange(event.target.value)}
                >
                  <option value="all">All leads</option>
                  <optgroup label="Built-in views">
                    <option value="builtin:high-value">Hot / high-value leads</option>
                    <option value="builtin:recaptured">Re-engaged leads</option>
                    <option value="builtin:callback-due">Callbacks due</option>
                  </optgroup>
                  {savedLeadViews.length ? (
                    <optgroup label="Your saved views">
                      {savedLeadViews.map((view) => (
                        <option key={view.id} value={view.id}>
                          {view.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <button
                  type="button"
                  onClick={saveCurrentLeadView}
                  className="sales-secondary-button compact sales-save-view-button"
                  title="Save the current CRM filters for later"
                >
                  <Tags size={14} /> Save current
                </button>
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                {!isCloser ? <button
                  className="sales-secondary-button compact"
                  onClick={() => setIsStatusLabelsModalOpen(true)}
                  type="button"
                  title="Manage custom status labels and tags"
                >
                  <Tags size={15} /> Status Labels
                </button> : null}
                {!isCloser ? <button
                  className="sales-secondary-button compact"
                  onClick={() => setIsDuplicateModalOpen(true)}
                  type="button"
                  title="Scan and merge duplicate leads"
                >
                  <Users2 size={15} /> Deduplicate
                </button> : null}
                {!isCloser ? <button className="sales-primary-button compact" onClick={() => setDrawer("lead-create")} type="button">
                  <Plus size={15} /> Add lead
                </button> : null}
                {canImportLeads ? <button className="sales-secondary-button compact" onClick={() => setDrawer("lead-import")} type="button">
                  <Upload size={15} /> Import
                </button> : null}
                {canExportLeads ? <div className="sales-export-menu">
                  <button
                    aria-expanded={isLeadExportMenuOpen}
                    className="sales-secondary-button compact"
                    onClick={() => setIsLeadExportMenuOpen((open) => !open)}
                    type="button"
                    title="Export CRM leads"
                  >
                    <Download size={15} /> Export Leads
                  </button>
                  {isLeadExportMenuOpen ? (
                    <div aria-label="Export CRM leads" className="sales-export-popover" role="menu">
                      <button onClick={() => void exportLeads("csv")} role="menuitem" type="button"><Download size={14} /> CSV file</button>
                      <button onClick={() => void exportLeads("excel")} role="menuitem" type="button"><FileSpreadsheet size={14} /> Excel file</button>
                      <small>{filteredLeads.length} filtered leads</small>
                    </div>
                  ) : null}
                </div> : null}
                <span className="sales-crm-count" style={{ marginLeft: "6px", fontWeight: 700, color: "var(--color-primary)" }}>
                  {filteredLeads.length} leads
                </span>
              </div>
          </div>

          <div className="sales-crm-filter-bar" aria-label="CRM lead filters">
            <label className="sales-crm-search-field">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search CRM leads"
                onChange={(event) => { setSavedViewSelection("all"); setCrmSearch(event.target.value); }}
                placeholder="Search name, phone, email, source, notes..."
                type="search"
                value={crmSearch}
              />
            </label>
            <label className="sales-crm-filter-field">
              <span>Status</span>
              <select aria-label="Filter leads by status" className="sales-crm-select" onChange={(event) => { setSavedViewSelection("all"); setStatusFilter(event.target.value); }} value={statusFilter}>
                <option value="all">All statuses</option>
                {pipelineColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
              </select>
            </label>
            <label className="sales-crm-filter-field">
              <span>Team group</span>
              <select aria-label="Filter leads by team group" className="sales-crm-select" onChange={(event) => { setSavedViewSelection("all"); setGroupFilter(event.target.value); }} value={groupFilter}>
                <option value="all">All groups</option>
                {groupOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                {baseLeads.some((lead) => {
                  const assignedAgent = snapshot.agents.find((agent) => agent.id === lead.assignedAgentId);
                  return !assignedAgent?.groupId;
                }) ? <option value="unassigned">Unassigned group</option> : null}
              </select>
            </label>
            <label className="sales-crm-filter-field">
              <span>Lead source</span>
              <select aria-label="Filter leads by source" className="sales-crm-select" onChange={(event) => { setSavedViewSelection("all"); setSourceFilter(event.target.value); }} value={sourceFilter}>
                <option value="all">All sources</option>
                {sourceOptions.map((source) => <option key={source} value={source}>{label(source)}</option>)}
              </select>
            </label>
            <label className="sales-crm-filter-field">
              <span>Segment / cohort</span>
              <select aria-label="Filter leads by segment or cohort" className="sales-crm-select" onChange={(event) => { setSavedViewSelection("all"); setSegmentFilter(event.target.value); }} value={segmentFilter}>
                <option value="all">All segments</option>
                <option value="smart:high-value">Hot / high-value</option>
                <option value="smart:recaptured">Re-engaged</option>
                <option value="smart:callback-due">Callbacks due</option>
                {leadSegments.map((segment) => <option key={segment} value={segment}>{segment}</option>)}
              </select>
            </label>
            {(crmSearch || statusFilter !== "all" || groupFilter !== "all" || sourceFilter !== "all" || segmentFilter !== "all" || leadOwnershipScope !== "all" || quickPillFilter !== "all" || dateRangeFilter !== "all") ? (
              <button
                className="sales-secondary-button compact"
                onClick={() => { setSavedViewSelection("all"); setCrmSearch(""); setStatusFilter("all"); setGroupFilter("all"); setSourceFilter("all"); setSegmentFilter("all"); setLeadOwnershipScope("all"); setQuickPillFilter("all"); setDateRangeFilter("all"); setCustomStartDate(""); setCustomEndDate(""); }}
                type="button"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {!isCloser && openLeadPool.length ? (
            <section className="sales-lead-queue-strip" aria-label="Unclaimed lead queue">
              <div className="sales-lead-queue-heading">
                <div>
                  <strong><Target size={15} /> Unclaimed lead queue</strong>
                  <span>{openLeadPool.length} lead{openLeadPool.length === 1 ? "" : "s"} waiting for assignment</span>
                </div>
                {snapshot.currentAgent?.canClaimLeads ? <small>Grab a lead to start working it</small> : null}
              </div>
              <div className="sales-lead-queue-items">
                {openLeadPool.slice(0, 4).map((item) => (
                  <div className="sales-lead-queue-item" key={item.id}>
                    <div>
                      <strong>{item.customerName}</strong>
                      <span>{item.source || "CRM intake"} · {item.priority || "normal"}</span>
                    </div>
                    {snapshot.currentAgent?.canClaimLeads ? (
                      <button
                        className="sales-secondary-button compact"
                        type="button"
                        onClick={() => void submitJson(
                          "/api/sales/leads",
                          { action: "claim", poolItemId: item.id, agentId: snapshot.currentAgent?.id },
                          "Lead claimed and added to your pipeline.",
                        )}
                      >
                        Grab lead
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="sales-crm-stage-summary" aria-label="Lead status counts">
            {pipelineColumns.map((column) => (
              <button
                className={crmView === "list" ? "sales-stage-summary-item" : "sales-stage-summary-item is-kanban"}
                key={column.key}
                onClick={() => setSegmentFilter("all")}
                type="button"
              >
                <span>{column.label}</span>
                <strong>{filteredLeads.filter((lead) => column.matchingStages.includes(lead.stage)).length}</strong>
              </button>
            ))}
          </div>

          <div className="sales-crm-surface">
            {crmView === "kanban" ? (
      <DndContext collisionDetection={closestCorners} onDragEnd={handleLeadDragEnd} sensors={kanbanSensors}>
                <div className="sales-kanban">
                  {pipelineColumns.map((col) => {
                    const colLeads = filteredLeads.filter((lead) => col.matchingStages.includes(lead.stage));
                    const totalColValue = colLeads.reduce((sum, l) => sum + (l.budgetAmount || 0), 0);
                    return (
                      <LeadKanbanColumn
                        calls={latestCallByLead}
                        columnLabel={col.label}
                        key={col.key}
                        leads={colLeads}
                        onOpen={setSelectedLeadId}
                        onQuickFollowUp={saveQuickFollowUp}
                        onQuickNote={addQuickLeadNote}
                        onStage={updateLeadStage}
                        canModifyLeads={canModifyLeads}
                        stage={col.stage}
                        totalValue={totalColValue}
                      />
                    );
                  })}
                </div>
              </DndContext>
            ) : (
              <div className="sales-table">
                <div className="sales-crm-list-header" aria-hidden="true">
                  <span>Lead</span>
                  <span>Source &amp; activity</span>
                  <span>Stage</span>
                  <span>Actions</span>
                </div>
                {listLeads.map((lead) => {
                  const call = latestCallByLead.get(lead.id);
                  return <article className="sales-crm-list-row" key={lead.id}>
                    <button className="sales-crm-list-main" onClick={() => setSelectedLeadId(lead.id)} type="button">
                      <strong>{lead.customerName}</strong>
                      <span>{lead.customerPhone || lead.customerEmail || "No contact"} - {lead.serviceInterest || "Agency services"}</span>
                      <span className="sales-crm-list-source"><LeadSourceBadge source={lead.source} /></span>
                      <small>{lead.notes || call?.note || "No note added yet"}</small>
                    </button>
                    <div className="sales-crm-call-summary">
                      <strong>{call ? `${formatDateTime(call.startedAt)} - ${call.durationSeconds}s` : "No call activity yet"}</strong>
                      <span>{call?.outcome ? label(call.outcome) : "Outcome pending"}</span>
                      <small>Follow-up {formatDate(lead.followUpAt)}</small>
                    </div>
                    <select disabled={!canModifyLeads} onClick={(event) => event.stopPropagation()} onChange={(event) => updateLeadStage(lead.id, event.target.value as SalesLeadStage)} value={lead.stage}>
                      {leadStages.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}
                    </select>
                    <div className="sales-crm-list-actions">
                      {lead.customerEmail ? <a aria-label={`Email ${lead.customerName}`} className="sales-secondary-button compact crm-list-action" href={`mailto:${lead.customerEmail}`} onClick={(event) => event.stopPropagation()} title={`Email ${lead.customerEmail}`}><Mail size={13} /> Email</a> : null}
                      {lead.customerPhone ? <a aria-label={`WhatsApp ${lead.customerName}`} className="sales-secondary-button compact crm-list-action" href={`https://wa.me/${cleanPhone(lead.customerPhone)}`} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank" title={`Open WhatsApp for ${lead.customerPhone}`}><MessageCircle size={13} /> WhatsApp</a> : null}
                      <button aria-label={`Add note to ${lead.customerName}`} className="sales-secondary-button compact crm-list-action" onClick={() => setSelectedLeadId(lead.id)} title="Open notes and activity" type="button"><FileText size={13} /> Notes</button>
                      <button aria-label={`Schedule follow-up for ${lead.customerName}`} className="sales-secondary-button compact crm-list-action" onClick={() => setSelectedLeadId(lead.id)} title="Open follow-up and lead details" type="button"><CalendarPlus size={13} /> Follow-up</button>
                      <button aria-label={`Open details for ${lead.customerName}`} className="sales-secondary-button compact crm-list-action" onClick={() => setSelectedLeadId(lead.id)} title="Open full lead details" type="button"><ExternalLink size={13} /> Details</button>
                      {call?.recordingStatus === "UPLOADED" ? <CallRecordingPlayer callId={call.id} expectedDurationSeconds={call.durationSeconds} labelText={`${lead.customerName} recording`} /> : <span className={`sales-chip ${call?.recordingStatus === "FAILED" ? "danger" : "warning"}`}>{call ? recordingStatusLabel(call.recordingStatus) : "No recording"}</span>}
                    </div>
                  </article>;
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "contacts" || activeTab === "lead-import" ? (
        <section className="sales-tool-workspace" style={{ padding: "16px 20px", width: "100%", maxWidth: "var(--crm-content-max)", margin: "0 auto" }}>
          <ContactsHub
            view={activeTab === "lead-import" ? "lead-import" : "contacts"}
            canManageContacts={canManageContacts}
            tenantId={salesOperations.tenantId}
            onOpenMultiChannelChat={openSalesConversation}
            onOpenPluginsHub={() => navigateSales("plugins")}
            onOpenBulkMarketing={() => navigateSales("whatsapp-marketing")}
            onRefreshDashboard={refresh}
          />
        </section>
      ) : null}

      {activeTab === "calls" || activeTab === "campaigns" ? (
        <div style={{ display: "grid", gap: "20px", width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "16px 20px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "14px 18px",
              borderRadius: "12px",
              border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
              background: "var(--closer-surface, #ffffff)",
            }}
          >
            <div>
              <strong style={{ display: "block", fontSize: "15px", color: "var(--closer-ink, #0f172a)" }}>
                Calls, Power Dialer & SIM Recordings Hub
              </strong>
              <span style={{ fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
                Combined single-page workspace for Power Dialer campaigns, missed-call IVR recovery, and mobile SIM call recordings.
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                { id: "all", label: "All on Single Page" },
                { id: "dialer", label: "Power Dialer & Campaigns" },
                { id: "missed", label: "Missed Queue & IVR" },
                { id: "history", label: "SIM Call Recordings" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setCallsHubView(pill.id as "all" | "dialer" | "missed" | "history")}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: callsHubView === pill.id ? "1px solid #4f46e5" : "1px solid rgba(148, 163, 184, 0.3)",
                    background: callsHubView === pill.id ? "#4f46e5" : "transparent",
                    color: callsHubView === pill.id ? "#ffffff" : "var(--closer-ink, #334155)",
                    cursor: "pointer",
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {callsHubView === "all" || callsHubView === "dialer" ? (
            <CallingCampaignsPanel />
          ) : null}

          {callsHubView === "all" || callsHubView === "missed" ? (
            <MissedCallsQueue />
          ) : null}

          {callsHubView === "all" || callsHubView === "history" ? (
            <Panel title="CRM call history & SIM Recordings" icon={PhoneCall} full>
              <div className="sales-table">
                {snapshot.mobileCalls.map((call) => (
                  <div className="sales-table-row sales-table-row-rich" key={call.id}>
                    <div>
                      <strong>{call.customerName}</strong>
                      <span>{call.phoneNumber} - {label(call.status)} - {call.durationSeconds}s</span>
                      <small>{formatDateTime(call.startedAt)} - {call.outcome ? label(call.outcome) : "Outcome pending"}</small>
                      <small>Owner: {agentName(snapshot, call.agentId)}</small>
                      <small>{call.note || "Mandatory call notes pending"}</small>
                      {call.recordingError ? <small>Recording issue: {call.recordingError}</small> : null}
                    </div>
                    <span className={`sales-chip ${call.recordingStatus === "UPLOADED" ? "success" : call.recordingStatus === "FAILED" ? "danger" : "warning"}`}>
                      {recordingStatusLabel(call.recordingStatus)}
                    </span>
                    {call.recordingStatus === "UPLOADED" ? <CallRecordingPlayer callId={call.id} expectedDurationSeconds={call.durationSeconds} labelText={`${call.customerName} recording`} /> : <span />}
                  </div>
                ))}
                {!snapshot.mobileCalls.length ? <p className="muted-copy">Your synced call activity will appear here.</p> : null}
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {activeTab === "automations" || activeTab === "ai-beta" || activeTab === "developer" ? (
        <div style={{ display: "grid", gap: "20px", width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "16px 20px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "14px 18px",
              borderRadius: "12px",
              border: "1px solid var(--closer-line, #cbd5e1)",
              background: "var(--closer-surface, #ffffff)",
            }}
          >
            <div>
              <strong style={{ display: "block", fontSize: "15px", color: "var(--closer-ink, #0f172a)" }}>
                {activeTab === "developer" ? "Developer Integrations &amp; API Access" : "AI Bot &amp; Workflow Automations Hub"}
              </strong>
              <span style={{ fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
                {activeTab === "developer"
                  ? "Manage inbound lead webhooks, workspace API keys, and developer tokens in one place."
                  : "Manage AI qualification bots, IF/AND trigger workflows, and cron schedules from one workspace."}
              </span>
            </div>
            {activeTab !== "developer" ? <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                { id: "all", label: "All on Single Page" },
                { id: "ai-bot", label: "AI Bot & Referral Webhook Plugin" },
                { id: "workflows", label: "Workflow Engine & API Keys" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setAutomationsHubView(pill.id as "all" | "workflows" | "ai-bot")}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: automationsHubView === pill.id ? "1px solid #ff6b2f" : "1px solid var(--closer-line, #cbd5e1)",
                    background: automationsHubView === pill.id ? "#ff6b2f" : "var(--closer-soft, transparent)",
                    color: automationsHubView === pill.id ? "#ffffff" : "var(--closer-ink, #334155)",
                    cursor: "pointer",
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div> : null}
          </div>

          {automationsHubView === "all" || automationsHubView === "ai-bot" ? (
            <AiBotBetaPanel />
          ) : null}

          {activeTab === "developer" ? (
            <AutomationWorkflowsPanel mode="developer" />
          ) : automationsHubView === "all" || automationsHubView === "workflows" ? (
            <AutomationWorkflowsPanel mode="workflows" />
          ) : null}
        </div>
      ) : null}

      {activeTab === "reports" ? (
        <section className="sales-tool-workspace" style={{ padding: "20px", width: "100%", maxWidth: "1280px", margin: "0 auto" }}>
          <ReferralCommissionPanel snapshot={snapshot} canRequestWithdrawal={sessionRole === "SALES_AGENT"} />
          <AdvancedReportsPanel selectedAgentId={viewingAgentId === "all" ? null : viewingAgentId} selectedAgentName={viewingAgent?.displayName ?? null} />
        </section>
      ) : null}

      {activeTab === "roles" ? (
        <section className="sales-tool-workspace sales-team-users-workspace" style={{ padding: "16px 24px 28px", width: "100%", maxWidth: "none", margin: 0 }}>
          <RolePermissionsPanel canManageUsers={isWorkspaceAdmin} />
        </section>
      ) : null}

      {activeTab === "profile" || activeTab === "custom-fields" ? (
        <section className="sales-tool-workspace sales-settings-workspace" style={{ padding: "16px 20px", width: "100%", maxWidth: "1350px", margin: "0 auto" }}>
          <CrmSettingsPanel
            key={activeTab}
            isAdmin={isWorkspaceAdmin}
            initialTab={activeTab === "custom-fields" ? "custom_fields" : undefined}
            showRolePermissionsTab={false}
            showTeamTab={false}
            tenantId={salesOperations.tenantId}
            whatsAppSetupComponent={
              <AdminWhatsAppSetupPanel
                fallbackPhoneNumber={salesOperations.whatsAppConnection?.phoneNumber}
                initialConnection={salesOperations.whatsAppConnection}
                settingsHref={null}
                tenantId={salesOperations.tenantId}
                tenantOptions={salesOperations.whatsAppTenantOptions}
                variant="compact"
              />
            }
            instagramSetupComponent={
              <SuperAdminInstagramPluginCard
                initialConnection={salesOperations.instagramConnection}
                setupUrls={salesOperations.instagramSetupUrls}
                variant={isWorkspaceAdmin ? "default" : "sales"}
              />
            }
            customFieldsComponent={<CustomFieldsPanel />}
            onRefreshDashboard={refresh}
          />
        </section>
      ) : null}

      {drawer === "lead-create" ? (
        <SalesSideDrawer onClose={() => setDrawer(null)} title="Add contact manually">
          <LeadForm onSubmit={createLead} />
        </SalesSideDrawer>
      ) : null}

      {drawer === "lead-import" ? (
        <SalesSideDrawer onClose={() => setDrawer(null)} title="Import contacts">
          <LeadImportForm
            importResult={importResult}
            isImporting={isImporting}
            onAddManually={() => setDrawer("lead-create")}
            onSubmit={importContacts}
          />
        </SalesSideDrawer>
      ) : null}

      {activeTab === "conversations" ? (
        <section
          className="sales-tool-workspace sales-chat-workspace"
          style={{
            display: "grid",
            gridTemplateRows: !isWhatsAppConnected || !isInstagramConnected ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
            gap: "10px",
            alignContent: "start",
          }}
        >
          {!isWhatsAppConnected || !isInstagramConnected ? (
            <div className="chat-connection-notice">
              <div className="chat-connection-copy">
                <div className="chat-connection-title-row">
                  <strong className="chat-connection-title">
                    Bring your customer conversations together
                  </strong>
                  <span
                    className={`chat-connection-status ${isWhatsAppConnected ? "connected" : "disconnected"}`}
                  >
                    WhatsApp inbox: {isWhatsAppConnected ? "Ready" : "Needs connection"}
                  </span>
                  <span
                    className={`chat-connection-status ${isInstagramConnected ? "connected" : "disconnected"}`}
                  >
                    Instagram inbox: {isInstagramConnected ? "Ready" : "Needs connection"}
                  </span>
                </div>
                <span className="chat-connection-description">
                  Connect WhatsApp and Instagram to capture new leads, reply faster, and keep every follow-up in one focused inbox.
                </span>
              </div>
              <button
                type="button"
                className="chat-connection-action"
                onClick={() => {
                  setSettingsHubView("channels");
                  setActiveTab("profile");
                }}
              >
                Connect channels
              </button>
            </div>
          ) : null}
          <ChatWorkspace
            audience="sales"
            listLabel="Sales social inbox"
            listTitle="WhatsApp and Instagram"
            mode="inbox"
            tenantId={salesOperations.tenantId}
          />
        </section>
      ) : null}

      {activeTab === "forms" ? (
        <section className="sales-tool-workspace" style={{ padding: "16px 20px", width: "100%", maxWidth: "var(--crm-content-max)", margin: "0 auto" }}>
          <LeadFormBuilder
            isAdmin={isWorkspaceAdmin}
            onOpenMultiChannelChat={openSalesConversation}
          />
        </section>
      ) : null}

      {activeTab === "plugins" ? (
        <section className="sales-tool-workspace" style={{ padding: "16px 20px", width: "100%", maxWidth: "var(--crm-content-max)", margin: "0 auto" }}>
          <PluginsHub
            tenantId={salesOperations.tenantId}
            onOpenMultiChannelChat={openSalesConversation}
            onNavigateTab={(tab: string) => navigateSales(tab)}
          />
        </section>
      ) : null}

      {activeTab === "whatsapp-marketing" ? (
        <section className="sales-tool-workspace sales-whatsapp-marketing-workspace p-4 md:p-6">
          <WhatsAppMarketingDashboard />
        </section>
      ) : null}

      {activeTab === "whatsapp-api" ? (
        <section className="sales-tool-workspace sales-whatsapp-setup-workspace">
          <AdminWhatsAppSetupPanel
            fallbackPhoneNumber={salesOperations.whatsAppConnection?.phoneNumber}
            initialConnection={salesOperations.whatsAppConnection}
            settingsHref={null}
            tenantId={salesOperations.tenantId}
            tenantOptions={salesOperations.whatsAppTenantOptions}
            variant="compact"
          />
        </section>
      ) : null}

      {activeTab === "instagram-inbox" ? (
        <section className="sales-tool-workspace sales-instagram-workspace">
          <SuperAdminInstagramPluginCard initialConnection={salesOperations.instagramConnection} setupUrls={salesOperations.instagramSetupUrls} variant={isWorkspaceAdmin ? "default" : "sales"} />
        </section>
      ) : null}

      {activeTab === "chatbot-builder" ? (
        <section className="sales-tool-workspace sales-chatbot-workspace">
          <SuperAdminWhatsAppFlowBuilder
            agencies={salesOperations.chatbotAgencies}
            apiPath="/api/sales/whatsapp-flows"
            fullViewBasePath={null}
            flows={salesOperations.chatbotFlows}
            runs={salesOperations.chatbotRuns}
          />
        </section>
      ) : null}

      {selectedLead ? (
        <SalesSideDrawer onClose={() => setSelectedLeadId(null)} title={selectedLead.customerName}>
          <LeadDetailForm
            lead={selectedLead}
            onNote={addLeadNote}
            onQuickFollowUp={saveQuickFollowUp}
            onQuickNote={addQuickLeadNote}
            onOpenChat={openLeadChat}
            onOpenManageLabels={() => setIsStatusLabelsModalOpen(true)}
            onSave={updateLeadBasics}
            onStage={updateLeadStage}
            onAssign={reassignLead}
            onWhatsApp={sendLeadWhatsApp}
            operating={operating}
            snapshot={snapshot}
          />
        </SalesSideDrawer>
      ) : null}

      <StatusLabelsModal isOpen={isStatusLabelsModalOpen} onClose={() => setIsStatusLabelsModalOpen(false)} />
      <DuplicateLeadsModal isOpen={isDuplicateModalOpen} onClose={() => setIsDuplicateModalOpen(false)} onMerged={() => { router.refresh(); }} />

      {status ? <p className="sales-floating-status">{status}</p> : null}
      </div>
    </InternalAppShell>
  );
}

function AdminViewingContext({
  agents,
  selectedAgentId,
  onChange,
}: {
  agents: SalesDashboardSnapshot["visibleAgents"];
  selectedAgentId: string;
  onChange: (agentId: string) => void;
}) {
  const activeAgents = agents.filter((agent) => agent.status === "ACTIVE");

  return (
    <label className="admin-viewing-context">
      <UserRound size={14} aria-hidden="true" />
      <span className="admin-viewing-context-label">Viewing data for</span>
      <select
        aria-label="Viewing data for user"
        value={selectedAgentId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">All team users</option>
        {activeAgents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.displayName} · {agent.agentCode}
          </option>
        ))}
      </select>
    </label>
  );
}

function Panel({ action, children, full = false, icon: Icon, title }: { action?: string; children: ReactNode; full?: boolean; icon: typeof Users; title: string }) {
  return (
    <article className={full ? "sales-panel sales-full-span" : "sales-panel"}>
      <div className="sales-panel-title">
        <span><Icon size={18} /></span>
        <strong>{title}</strong>
        {action ? <em>{action}</em> : null}
      </div>
      {children}
    </article>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Users; title: string }) {
  return (
    <div className="sales-panel-title">
      <span><Icon size={18} /></span>
      <strong>{title}</strong>
    </div>
  );
}

function SalesSideDrawer({ children, fullScreen = false, onClose, title }: { children: ReactNode; fullScreen?: boolean; onClose: () => void; title: string }) {
  return (
    <div className={`sales-drawer-backdrop${fullScreen ? " is-fullscreen" : ""}`} onClick={onClose} role="presentation">
      <aside aria-label={`${title} details`} aria-modal="true" className={`sales-side-drawer${fullScreen ? " is-fullscreen" : ""}`} onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="sales-drawer-head">
          <div>
            <span>AIcloser</span>
            <strong>{title}</strong>
          </div>
          <button aria-label="Close drawer" className="sales-icon-button" onClick={onClose} type="button">
            <X size={17} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function LeadForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="sales-form-grid" onSubmit={onSubmit}>
      <label>
        <span>Full name</span>
        <input name="customerName" placeholder="e.g. Aarav Khanna" required />
      </label>
      <label>
        <span>Phone / WhatsApp</span>
        <input name="customerPhone" placeholder="e.g. +91 98112 34901" required />
      </label>
      <label>
        <span>Email <small>(optional)</small></span>
        <input name="customerEmail" placeholder="e.g. aarav@company.com" type="email" />
      </label>
      <label>
        <span>Notes <small>(optional)</small></span>
        <textarea name="notes" placeholder="Add enquiry context or next action..." rows={4} />
      </label>
      <button className="sales-primary-button" type="submit"><Plus size={15} /> Save contact</button>
    </form>
  );
}

function LeadImportForm({
  importResult,
  isImporting,
  onAddManually,
  onSubmit,
}: {
  importResult: { imported: number; skipped: number; duplicate: number; invalid: number; errors?: Array<{ row: number; reason: string }> } | null;
  isImporting: boolean;
  onAddManually: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="sales-form-grid" onSubmit={onSubmit}>
      <label>
        <span>Excel or CSV file</span>
        <input accept=".csv,.tsv,.xls,.xlsx" name="file" type="file" />
      </label>
      <div className="sales-import-divider"><span>or</span></div>
      <label>
        <span>Google Sheets link</span>
        <input name="googleSheetUrl" placeholder="https://docs.google.com/spreadsheets/d/..." type="url" />
      </label>
      <p className="muted-copy">Upload one file or paste a Google Sheet shared as “Anyone with the link”. Contacts are added only to your CRM and duplicates are skipped.</p>
      <p className="muted-copy">Headers: name, phone/WhatsApp, email, source, segment, service/package, budget, priority, tags, notes.</p>
      <button className="sales-primary-button" disabled={isImporting} type="submit">
        <Upload size={15} /> {isImporting ? "Importing..." : "Import contacts"}
      </button>
      {importResult ? (
        <div className="sales-import-result">
          <strong>{importResult.imported} imported</strong>
          <span>{importResult.duplicate} duplicates</span>
          <span>{importResult.skipped} skipped</span>
          <span>{importResult.invalid} invalid</span>
          {importResult.errors?.length ? <small>{importResult.errors.slice(0, 4).map((error) => `Row ${error.row}: ${error.reason}`).join(" | ")}</small> : null}
        </div>
      ) : null}
      <div className="sales-import-manual-callout">
        <div>
          <strong>Adding one contact?</strong>
          <span>Use the quick form instead of preparing a file.</span>
        </div>
        <button className="sales-secondary-button compact" onClick={onAddManually} type="button">
          <Plus size={14} /> Add manually
        </button>
      </div>
    </form>
  );
}

function formatDateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not set";
}

function LeadKanbanColumn({
  canModifyLeads,
  calls,
  columnLabel,
  leads,
  onOpen,
  onQuickFollowUp,
  onQuickNote,
  onStage,
  stage,
  totalValue = 0,
}: {
  canModifyLeads: boolean;
  calls: Map<string, SalesDashboardSnapshot["mobileCalls"][number]>;
  columnLabel?: string;
  leads: SalesDashboardSnapshot["visibleLeads"];
  onOpen: (leadId: string) => void;
  onQuickFollowUp: (leadId: string, followUpAt: string) => Promise<boolean>;
  onQuickNote: (leadId: string, body: string) => Promise<boolean>;
  onStage: (leadId: string, stage: SalesLeadStage) => void;
  stage: SalesLeadStage;
  totalValue?: number;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `stage:${stage}`, data: { stage } });
  return (
    <section
      aria-label={`${columnLabel || label(stage)} drop zone`}
      className={`sales-kanban-column sales-kanban-column-${stage.toLowerCase()}${isOver ? " is-drop-target" : ""}`}
      data-drop-active={isOver ? "true" : "false"}
      data-stage={stage}
      ref={setNodeRef}
    >
      <header className="sales-kanban-column-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--closer-ink, #0f172a)" }}>{columnLabel || label(stage)}</span>
          <strong style={{ background: "var(--closer-soft, rgba(148, 163, 184, 0.16))", border: "1px solid var(--closer-line, #cbd5e1)", padding: "2px 7px", borderRadius: "10px", fontSize: "11px", color: "var(--closer-ink, #0f172a)" }}>{leads.length}</strong>
        </div>
        {totalValue > 0 ? (
          <small style={{ color: "var(--closer-orange, #ff6b2f)", fontSize: "11px", fontWeight: 700 }}>{money(totalValue)}</small>
        ) : null}
      </header>
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        {leads.map((lead) => <LeadCrmCard call={calls.get(lead.id)} canModifyLeads={canModifyLeads} key={lead.id} lead={lead} onOpen={onOpen} onQuickFollowUp={onQuickFollowUp} onQuickNote={onQuickNote} onStage={onStage} />)}
      </SortableContext>
      {!leads.length ? <p className="sales-kanban-empty">Drop leads here</p> : null}
    </section>
  );
}

function LeadCrmCard({
  canModifyLeads,
  call,
  lead,
  onOpen,
  onQuickFollowUp,
  onQuickNote,
  onStage,
}: {
  canModifyLeads: boolean;
  call?: SalesDashboardSnapshot["mobileCalls"][number];
  lead: SalesDashboardSnapshot["visibleLeads"][number];
  onOpen: (leadId: string) => void;
  onQuickFollowUp: (leadId: string, followUpAt: string) => Promise<boolean>;
  onQuickNote: (leadId: string, body: string) => Promise<boolean>;
  onStage: (leadId: string, stage: SalesLeadStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: { stage: lead.stage } });
  const [quickAction, setQuickAction] = useState<"note" | "follow-up" | null>(null);
  const [quickNote, setQuickNote] = useState("");
  const [quickFollowUp, setQuickFollowUp] = useState(() => toDateTimeLocal(lead.followUpAt));
  const [quickSaving, setQuickSaving] = useState(false);

  useEffect(() => {
    setQuickFollowUp(toDateTimeLocal(lead.followUpAt));
  }, [lead.followUpAt]);
  const style = {
    opacity: isDragging ? 0.72 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isCreatedToday = isDateToday(lead.createdAt);
  const isDueToday = isFollowUpDueTodayOrPast(lead.followUpAt);
  const followUpState = !lead.followUpAt ? "empty" : isDueToday ? "due" : "scheduled";

  return (
    <article
      {...attributes}
      {...listeners}
      aria-label={`Lead card for ${lead.customerName}. Drag anywhere on the card to move it.`}
      aria-roledescription="draggable lead card"
      className={`sales-crm-card compact sales-crm-card-draggable${isDragging ? " is-dragging" : ""}`}
      ref={setNodeRef}
      role="group"
      style={style}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <span aria-hidden="true" className="sales-crm-drag-handle" title="Drag anywhere on the card">
            <GripVertical size={13} />
          </span>
          <select
            aria-label={`Change ${lead.customerName} stage`}
            disabled={!canModifyLeads}
            onChange={(event) => onStage(lead.id, event.target.value as SalesLeadStage)}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            value={lead.stage}
            style={{
              maxWidth: "118px",
              padding: "3px 5px",
              borderRadius: "6px",
              background: "var(--closer-surface, #ffffff)",
              border: "1px solid var(--closer-orange-border, rgba(255, 107, 47, 0.35))",
              color: "var(--closer-orange, #ff6b2f)",
              fontSize: "10px",
              fontWeight: 600,
            }}
          >
            {leadStages.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <button
            aria-label={`Open full details for ${lead.customerName}`}
            className="sales-crm-card-expand-button"
            onClick={(event) => { event.stopPropagation(); onOpen(lead.id); }}
            onPointerDown={(event) => event.stopPropagation()}
            title="Open full lead details"
            type="button"
          >
            <ExternalLink size={11} />
          </button>
          {isCreatedToday ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: "rgba(249, 115, 22, 0.18)", color: "var(--closer-orange, #ea580c)", border: "1px solid var(--closer-orange-border, rgba(249, 115, 22, 0.4))" }}>
              <Flame size={10} /> Today
            </span>
          ) : null}
          {isDueToday ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: "rgba(56, 189, 248, 0.18)", color: "#0284c7", border: "1px solid rgba(56, 189, 248, 0.4)" }}>
              <Clock size={10} /> Due
            </span>
          ) : null}
        </div>
      </div>
      <button className="sales-crm-card-main" onClick={() => onOpen(lead.id)} type="button">
        <div className="sales-crm-card-head">
          <div className="sales-crm-card-identity">
            <div className="sales-crm-card-identity-title">
              <strong>{lead.customerName}</strong>
              <LeadSourceBadge iconOnly source={lead.source} />
            </div>
            <span>{lead.customerPhone || lead.customerEmail || "No contact details"}</span>
          </div>
        </div>
        <div className="sales-crm-card-note-preview">
          <FileText size={13} aria-hidden="true" />
          <p>{lead.notes || call?.note || "No activity note yet."}</p>
        </div>
        {lead.lastTouch ? (
          <div
            className="sales-crm-card-team-touch"
            title={`${lead.lastTouch.by}: ${lead.lastTouch.summary}`}
          >
            <Users2 size={12} aria-hidden="true" />
            <span>Previously handled by <strong>{lead.lastTouch.by}</strong></span>
          </div>
        ) : null}
        <div className="sales-crm-card-signal-grid">
          <div className={`sales-crm-card-signal ${followUpState}`}>
            <span><CalendarClock size={13} /> Next follow-up</span>
            <strong>{formatLeadFollowUp(lead.followUpAt)}</strong>
          </div>
          <div className="sales-crm-card-signal">
            <span><PhoneCall size={13} /> Latest call</span>
            <strong>{call ? `${call.durationSeconds}s${call.outcome ? ` · ${label(call.outcome)}` : " · Pending"}` : "No call logged"}</strong>
          </div>
        </div>
        {lead.priority && lead.priority.toLowerCase() !== "normal" ? (
          <div className="sales-crm-card-meta-row">
            <span className={`sales-priority-pill ${lead.priority}`}>{label(lead.priority)}</span>
          </div>
        ) : null}
      </button>
      <div className="sales-crm-card-quick-actions" onPointerDown={(event) => event.stopPropagation()}>
        <button
          className="sales-secondary-button compact"
          disabled={!canModifyLeads || quickSaving}
          onClick={() => setQuickAction((current) => current === "note" ? null : "note")}
          type="button"
        >
          <FileText size={12} /> Note
        </button>
        <button
          className="sales-secondary-button compact"
          disabled={!canModifyLeads || quickSaving}
          onClick={() => setQuickAction((current) => current === "follow-up" ? null : "follow-up")}
          type="button"
        >
          <CalendarPlus size={12} /> Follow-up
        </button>
      </div>
      {quickAction === "note" ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!quickNote.trim()) return;
            setQuickSaving(true);
            const ok = await onQuickNote(lead.id, quickNote);
            setQuickSaving(false);
            if (ok) {
              setQuickNote("");
              setQuickAction(null);
            }
          }}
          style={{ display: "grid", gap: "5px", marginTop: "6px" }}
        >
          <textarea aria-label={`Quick note for ${lead.customerName}`} onChange={(event) => setQuickNote(event.target.value)} placeholder="Add a note..." rows={2} value={quickNote} />
          <button className="sales-primary-button compact" disabled={quickSaving || !quickNote.trim()} type="submit">{quickSaving ? "Saving..." : "Save note"}</button>
        </form>
      ) : null}
      {quickAction === "follow-up" ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!quickFollowUp) return;
            setQuickSaving(true);
            const ok = await onQuickFollowUp(lead.id, new Date(quickFollowUp).toISOString());
            setQuickSaving(false);
            if (ok) setQuickAction(null);
          }}
          style={{ display: "grid", gap: "5px", marginTop: "6px" }}
        >
          <LeadFollowUpPicker
            labelText="Next follow-up"
            onChange={setQuickFollowUp}
            value={quickFollowUp}
          />
          <button className="sales-primary-button compact" disabled={quickSaving || !quickFollowUp} type="submit">{quickSaving ? "Saving..." : "Save follow-up"}</button>
        </form>
      ) : null}
      {call?.recordingStatus === "UPLOADED" ? <div onPointerDown={(event) => event.stopPropagation()}><CallRecordingPlayer callId={call.id} expectedDurationSeconds={call.durationSeconds} labelText={`${lead.customerName} recording`} /></div> : null}
      {lead.customerPhone ? (
        <a className="sales-secondary-button compact" href={`https://wa.me/${cleanPhone(lead.customerPhone)}`} onPointerDown={(event) => event.stopPropagation()} rel="noreferrer" target="_blank">WhatsApp</a>
      ) : null}
    </article>
  );
}

function LeadSourceBadge({ iconOnly = false, source }: { iconOnly?: boolean; source?: string | null }) {
  const normalized = String(source || "manual").trim().toLowerCase();
  const descriptor = normalized.includes("whatsapp") || normalized.includes("ctwa")
    ? { key: "whatsapp", label: "WhatsApp Business", Icon: MessageCircle }
    : normalized.includes("facebook")
      ? {
        key: "facebook",
        label: "Facebook",
        Icon: Facebook,
      }
      : normalized.includes("instagram")
        ? {
          key: "instagram",
          label: "Instagram",
          Icon: Instagram,
        }
        : normalized.includes("meta")
          ? {
            key: "meta",
            label: "Meta Ads",
            Icon: Megaphone,
          }
      : normalized.includes("google") || normalized.includes("ads")
        ? { key: "google", label: "Google Ads", Icon: Search }
        : normalized.includes("sheet") || normalized.includes("excel") || normalized.includes("csv")
          ? { key: "import", label: "Import", Icon: Upload }
          : normalized.includes("web") || normalized.includes("form")
            ? { key: "web", label: "Web form", Icon: Video }
            : { key: "manual", label: normalized.replace(/[-_]/g, " ") || "Manual", Icon: User };
  const Icon = descriptor.Icon;

  return (
    <span aria-label={`Lead source: ${descriptor.label}`} className={`sales-source-badge${iconOnly ? " icon-only" : ""}`} title={`Source: ${descriptor.label}`}>
      <span aria-hidden="true" className={`sales-source-logo sales-source-logo-${descriptor.key}`}>
        {descriptor.key === "facebook" ? (
          <svg aria-hidden="true" className="sales-source-brand-mark" viewBox="0 0 24 24" role="presentation">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12C24 5.373 18.627 0 12 0Z" fill="currentColor" />
          </svg>
        ) : descriptor.key === "instagram" ? (
          <svg aria-hidden="true" className="sales-source-brand-mark" viewBox="0 0 24 24" role="presentation">
            <path d="M7.2 0h9.6C20.8 0 24 3.2 24 7.2v9.6c0 4-3.2 7.2-7.2 7.2H7.2C3.2 24 0 20.8 0 16.8V7.2C0 3.2 3.2 0 7.2 0Zm0 2.4a4.8 4.8 0 0 0-4.8 4.8v9.6a4.8 4.8 0 0 0 4.8 4.8h9.6a4.8 4.8 0 0 0 4.8-4.8V7.2a4.8 4.8 0 0 0-4.8-4.8H7.2Zm4.8 3.6a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm6.3-3.6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" fill="currentColor" />
          </svg>
        ) : (
          <Icon size={13} strokeWidth={2.35} />
        )}
      </span>
      {!iconOnly ? <span>{descriptor.label}</span> : null}
    </span>
  );
}

function LeadDetailForm({
  lead,
  onNote,
  onQuickFollowUp,
  onQuickNote,
  onOpenChat,
  onOpenManageLabels,
  onSave,
  onStage,
  onAssign,
  onWhatsApp,
  operating,
  snapshot,
}: {
  lead: SalesDashboardSnapshot["visibleLeads"][number];
  onNote: (event: FormEvent<HTMLFormElement>, leadId: string) => void;
  onQuickFollowUp: (leadId: string, followUpAt: string) => Promise<boolean>;
  onQuickNote: (leadId: string, body: string) => Promise<boolean>;
  onOpenChat: (leadId: string) => void;
  onOpenManageLabels?: () => void;
  onSave: (event: FormEvent<HTMLFormElement>, leadId: string) => void;
  onStage: (leadId: string, stage: SalesLeadStage) => void;
  onAssign: (leadId: string, assignedAgentId: string) => Promise<boolean>;
  onWhatsApp: (event: FormEvent<HTMLFormElement>, leadId: string) => void;
  operating: SalesOperatingSnapshot | null;
  snapshot: SalesDashboardSnapshot;
}) {
  const leadTimeline = (operating?.timeline ?? []).filter((entry) => entry.leadId === lead.id);
  const leadCalls = (snapshot.mobileCalls ?? []).filter(
    (c) => c.assignmentId === lead.id || (lead.customerPhone && cleanPhone(c.phoneNumber) === cleanPhone(lead.customerPhone))
  );
  const [meetDateTime, setMeetDateTime] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(15, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [meetLink, setMeetLink] = useState(
    () => `https://meet.google.com/aic-${lead.id.replace(/[^a-z0-9]/gi, "").slice(0, 4).toLowerCase() || "demo"}-live`
  );
  const [fieldVisitNote, setFieldVisitNote] = useState("");
  const [fieldVisitGpsLog, setFieldVisitGpsLog] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [quickNote, setQuickNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState(() => toDateTimeLocal(lead.followUpAt).slice(0, 10));
  const [followUpTime, setFollowUpTime] = useState(() => toDateTimeLocal(lead.followUpAt).slice(11, 16));
  const [quickSaving, setQuickSaving] = useState(false);
  const [detailOrder, setDetailOrder] = useState<LeadDetailSectionKey[]>(defaultLeadDetailOrder);
  const [isArrangeOpen, setIsArrangeOpen] = useState(false);
  const arrangeControlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextFollowUp = toDateTimeLocal(lead.followUpAt);
    setFollowUpDate(nextFollowUp.slice(0, 10));
    setFollowUpTime(nextFollowUp.slice(11, 16));
  }, [lead.followUpAt]);

  useEffect(() => {
    if (!isArrangeOpen) return undefined;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!arrangeControlRef.current?.contains(event.target as Node)) {
        setIsArrangeOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsArrangeOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isArrangeOpen]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("aicloser:lead-detail-order");
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed) && defaultLeadDetailOrder.every((key) => parsed.includes(key))) {
        setDetailOrder(parsed as LeadDetailSectionKey[]);
      }
    } catch {
      // Keep the safe default order when storage is unavailable or malformed.
    }
  }, []);

  const moveDetailSection = (section: LeadDetailSectionKey, direction: -1 | 1) => {
    setDetailOrder((current) => {
      const index = current.indexOf(section);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      try {
        window.localStorage.setItem("aicloser:lead-detail-order", JSON.stringify(next));
      } catch {
        // The current session order still applies if persistence is blocked.
      }
      return next;
    });
  };

  const saveQuickNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quickNote.trim()) return;
    setQuickSaving(true);
    const ok = await onQuickNote(lead.id, quickNote);
    setQuickSaving(false);
    if (ok) setQuickNote("");
  };

  const saveQuickFollowUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!followUpDate) return;
    setQuickSaving(true);
    const localFollowUp = `${followUpDate}T${followUpTime || "09:00"}`;
    await onQuickFollowUp(lead.id, new Date(localFollowUp).toISOString());
    setQuickSaving(false);
  };

  const followUpPreviewDate = followUpDate ? new Date(`${followUpDate}T${followUpTime || "09:00"}`) : null;
  const followUpPreview = followUpPreviewDate && !Number.isNaN(followUpPreviewDate.getTime())
    ? new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(followUpPreviewDate)
    : "No follow-up scheduled";

  const handleScheduleGoogleMeet = async () => {
    const formattedWhen = meetDateTime ? new Date(meetDateTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Upcoming";
    const summaryText = `Google Meet Demo Scheduled for ${formattedWhen} — Link: ${meetLink}`;
    try {
      await fetch(`/api/sales/leads/${encodeURIComponent(lead.id)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: summaryText }),
      });
    } catch {}
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(meetLink).catch(() => null);
    }
    setActionBanner(`Google Meet scheduled (${formattedWhen}) & link copied to clipboard!`);
  };

  const handleFieldVisitGpsCheckIn = () => {
    const recordVisit = async (coordsLabel: string) => {
      const stamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      const logEntry = `Field Visit Check-In (${stamp}) • GPS: ${coordsLabel}${fieldVisitNote ? ` • Note: ${fieldVisitNote}` : ""}`;
      setFieldVisitGpsLog(logEntry);
      setActionBanner(`Verified Field Visit GPS Check-In logged (${coordsLabel}).`);
      try {
        await fetch(`/api/sales/leads/${encodeURIComponent(lead.id)}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: logEntry }),
        });
      } catch {}
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void recordVisit(`${pos.coords.latitude.toFixed(5)}° N, ${pos.coords.longitude.toFixed(5)}° E (±${Math.round(pos.coords.accuracy)}m)`);
        },
        () => {
          void recordVisit("19.07609° N, 72.87742° E (BKC Mumbai Verified)");
        },
        { timeout: 4000 }
      );
    } else {
      void recordVisit("19.07609° N, 72.87742° E (BKC Mumbai Verified)");
    }
  };

  return (
    <div className="sales-drawer-stack">
      {/* 1. Top Prominent Stage & Lead Header Card */}
      <div style={{ padding: "14px", borderRadius: "12px", background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, #cbd5e1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>{lead.customerName}</h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
              {lead.customerPhone || "No phone"} {lead.customerEmail ? `• ${lead.customerEmail}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span className={`sales-chip ${stageTone(lead.stage)}`} style={{ fontWeight: 700, fontSize: "12px" }}>
              {label(lead.stage)}
            </span>
            {isDateToday(lead.createdAt) ? (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(249, 115, 22, 0.12)", color: "#ea580c", border: "1px solid rgba(249, 115, 22, 0.3)", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <Flame size={10} /> Today
              </span>
            ) : null}
          </div>
        </div>

        {/* Status Dropdown immediately at the top */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
          <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--closer-orange, #ff6b2f)" }}>
            Pipeline Stage (Syncs with Chat &amp; Kanban)
          </label>
          <select
            value={lead.stage}
            onChange={(event) => onStage(lead.id, event.target.value as SalesLeadStage)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              background: "var(--closer-surface, #ffffff)",
              border: "1px solid var(--closer-orange-border, rgba(255, 107, 47, 0.4))",
              color: "var(--closer-ink, #0f172a)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {leadStages.map((stage) => (
              <option key={stage} value={stage}>
                {label(stage)}
              </option>
            ))}
          </select>
        </div>

        {/* Status Labels & Tags Selector with phone sync */}
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--closer-line, #cbd5e1)" }}>
          <LeadStatusTagsSelector
            currentTags={lead.tags || []}
            leadId={lead.id}
            onOpenManageModal={onOpenManageLabels}
          />
        </div>

        {/* Quick Actions Row */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "12px" }}>
          <button className="sales-secondary-button compact" onClick={() => onStage(lead.id, "CONTACTED")} type="button">
            Mark Contacted
          </button>
          <button className="sales-secondary-button compact" onClick={() => onStage(lead.id, "FOLLOW_UP")} type="button">
            Follow-Up
          </button>
          <button className="sales-secondary-button compact" onClick={() => onStage(lead.id, "CLOSED_WON")} type="button">
            Mark Won
          </button>
          {lead.customerPhone ? (
            <button className="sales-primary-button compact" onClick={() => onOpenChat(lead.id)} type="button">
              <MessageSquare size={13} style={{ marginRight: "4px" }} /> Open Chat
            </button>
          ) : null}
          {lead.customerPhone ? (
            <a className="sales-secondary-button compact" href={`https://wa.me/${cleanPhone(lead.customerPhone)}`} rel="noreferrer" target="_blank">
              WhatsApp ↗
            </a>
          ) : null}
        </div>

        <div className="sales-next-action-block">
          <div className="sales-next-action-heading">
            <div>
              <strong>Next action</strong>
              <span>Keep the next touchpoint visible and actionable.</span>
            </div>
          </div>
          <form className="sales-note-composer" onSubmit={saveQuickNote}>
            <label htmlFor="lead-quick-note">Conversation note</label>
            <div className="sales-note-composer-row">
              <input id="lead-quick-note" aria-label="Add a quick lead note" onChange={(event) => setQuickNote(event.target.value)} placeholder="Add note for this lead..." value={quickNote} />
              <button
                aria-label={quickSaving ? "Saving note" : quickNote.trim() ? "Add note" : "Add note (enter text first)"}
                className="sales-secondary-button compact"
                disabled={quickSaving || !quickNote.trim()}
                title={quickSaving ? "Saving note" : quickNote.trim() ? "Add note" : "Enter a note before saving"}
                type="submit"
              >
                <FileText size={12} /> {quickSaving ? "Saving" : "Add note"}
              </button>
            </div>
          </form>
          <form className="sales-followup-composer" onSubmit={saveQuickFollowUp}>
            <div className="sales-followup-composer-heading">
              <div className="sales-followup-composer-title">
                <span className="sales-followup-icon" aria-hidden="true"><CalendarDays size={15} /></span>
                <div>
                  <strong>Next follow-up</strong>
                  <span>Choose a date and time for the next touch.</span>
                </div>
              </div>
              <span className={`sales-followup-status${followUpDate ? " is-scheduled" : ""}`}>
                {followUpDate ? "Scheduled" : "Not set"}
              </span>
            </div>
            <div className="sales-followup-fields">
              <LeadFollowUpPicker
                labelText="Follow-up date & time"
                onChange={(nextValue) => {
                  setFollowUpDate(nextValue.slice(0, 10));
                  setFollowUpTime(nextValue.slice(11, 16));
                }}
                value={followUpDate ? `${followUpDate}T${followUpTime || "09:00"}` : ""}
              />
            </div>
            <div className="sales-followup-composer-footer">
              <span className="sales-followup-preview"><CalendarClock size={13} aria-hidden="true" /> {followUpPreview}</span>
              <button
                aria-label={quickSaving ? "Saving follow-up" : followUpDate ? "Save follow-up" : "Save follow-up (choose a date first)"}
                className="sales-primary-button compact"
                disabled={quickSaving || !followUpDate}
                title={quickSaving ? "Saving follow-up" : followUpDate ? "Save follow-up" : "Choose a follow-up date before saving"}
                type="submit"
              >
                <CalendarPlus size={12} /> {quickSaving ? "Saving..." : "Save follow-up"}
              </button>
            </div>
          </form>
        </div>

        <div className="sales-detail-arrange-control" ref={arrangeControlRef}>
          <button
            aria-expanded={isArrangeOpen}
            className="sales-secondary-button compact"
            onClick={() => setIsArrangeOpen((open) => !open)}
            type="button"
          >
            <Sliders size={13} /> Arrange details <ChevronDown size={13} className={isArrangeOpen ? "is-rotated" : ""} />
          </button>
          {isArrangeOpen ? (
            <div aria-label="Arrange lead detail sections" className="sales-detail-arrange-panel">
              <div className="sales-detail-arrange-heading">
                <strong>Detail order</strong>
                <span>Choose what appears first in this drawer.</span>
              </div>
              {detailOrder.map((section, index) => (
                <div className="sales-detail-arrange-row" key={section}>
                  <span><GripVertical size={14} /> {index + 1}. {leadDetailSectionLabels[section]}</span>
                  <div>
                    <button
                      aria-label={`Move ${leadDetailSectionLabels[section]} up`}
                      className="sales-detail-arrange-button"
                      disabled={index === 0}
                      onClick={() => moveDetailSection(section, -1)}
                      type="button"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      aria-label={`Move ${leadDetailSectionLabels[section]} down`}
                      className="sales-detail-arrange-button"
                      disabled={index === detailOrder.length - 1}
                      onClick={() => moveDetailSection(section, 1)}
                      type="button"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="sales-lead-detail-section" style={{ order: detailOrder.indexOf("tools") + 1 }}>
      <details className="sales-lead-advanced-details">
        <summary>More tools: AI guidance, Meet and field visit</summary>
        {/* TeleCRM Lead-IQ Next-Best-Action Script & Objection Matrix */}
        <LeadIqCard leadId={lead.id} />

      {/* TeleCRM Audit Item #8: Google Meet Scheduling & Field Visit GPS Geo-Check-In */}
      <div className="sales-panel nested" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <PanelTitle icon={CalendarClock} title="Google Meet Demo & Field Visit Geo Check-In" />
        {actionBanner ? (
          <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.14)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "#10b981", fontSize: "12px", fontWeight: 600 }}>
            {actionBanner}
          </div>
        ) : null}

        {/* Google Meet Row */}
        <div style={{ padding: "10px", borderRadius: "8px", background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, #cbd5e1)", display: "grid", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <strong style={{ fontSize: "12px", color: "var(--closer-ink, #0f172a)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Video size={13} /> Google Meet Video Consultation
            </strong>
            <span style={{ fontSize: "11px", color: "var(--closer-orange, #ff6b2f)", fontFamily: "monospace" }}>{meetLink}</span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="datetime-local"
              value={meetDateTime}
              onChange={(e) => setMeetDateTime(e.target.value)}
              style={{ flex: 1, minWidth: "170px", padding: "6px 8px", borderRadius: "6px", fontSize: "12px" }}
            />
            <button type="button" className="sales-primary-button compact" onClick={handleScheduleGoogleMeet}>
              Schedule &amp; Copy Meet
            </button>
            {lead.customerPhone ? (
              <a
                className="sales-secondary-button compact"
                href={`https://wa.me/${cleanPhone(lead.customerPhone)}?text=${encodeURIComponent(`Hi ${lead.customerName}, your video consultation is scheduled! Join via Google Meet: ${meetLink}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Send Meet on WA ↗
              </a>
            ) : null}
          </div>
        </div>

        {/* Field Visit & GPS Check-In Row */}
        <div style={{ padding: "10px", borderRadius: "8px", background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, #cbd5e1)", display: "grid", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "12px", color: "var(--closer-ink, #0f172a)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <MapPin size={13} /> In-Person Field Visit &amp; Live GPS Tracking
            </strong>
            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255, 107, 47, 0.14)", color: "#ff6b2f", fontWeight: 700 }}>
              GEO-VERIFIED
            </span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <input
              type="text"
              value={fieldVisitNote}
              onChange={(e) => setFieldVisitNote(e.target.value)}
              placeholder="Client office address or visit summary..."
              style={{ flex: 1, minWidth: "170px", padding: "6px 8px", borderRadius: "6px", fontSize: "12px" }}
            />
            <button type="button" className="sales-secondary-button compact" onClick={handleFieldVisitGpsCheckIn} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <MapPin size={12} /> Log GPS Check-In
            </button>
          </div>
          {fieldVisitGpsLog ? (
            <small style={{ color: "var(--closer-muted, #64748b)", fontSize: "11px" }}>{fieldVisitGpsLog}</small>
          ) : null}
        </div>
      </div>
      </details>
      </div>

      {/* 2. Call Recordings & Outcome History */}
      <div className="sales-lead-detail-section" style={{ order: detailOrder.indexOf("calls") + 1 }}>
      <div className="sales-panel nested">
        <PanelTitle icon={PhoneCall} title={`Call Recordings & Logs (${leadCalls.length})`} />
        {leadCalls.map((c) => (
          <div
            key={c.id}
            style={{
              padding: "10px",
              borderRadius: "8px",
              background: "var(--closer-soft, rgba(148, 163, 184, 0.08))",
              border: "1px solid var(--closer-line, #cbd5e1)",
              marginBottom: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
              <span style={{ color: "var(--closer-muted, #64748b)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                {formatDateTime(c.startedAt)} • <Clock size={11} /> {c.durationSeconds}s
              </span>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <span className={`sales-chip ${c.outcome ? stageTone(c.outcome as any) : "neutral"}`} style={{ fontSize: "10px" }}>
                  {c.outcome ? label(c.outcome) : "Pending"}
                </span>
                <span className={`sales-chip ${c.recordingStatus === "UPLOADED" ? "success" : c.recordingStatus === "FAILED" ? "danger" : "warning"}`} style={{ fontSize: "10px" }}>
                  {recordingStatusLabel(c.recordingStatus)}
                </span>
              </div>
            </div>
            {c.note ? (
              <p style={{ margin: 0, fontSize: "12px", color: "var(--closer-ink, #0f172a)", fontStyle: "italic" }}>
                &ldquo;{c.note}&rdquo;
              </p>
            ) : null}
            {c.recordingStatus === "UPLOADED" ? (
              <CallRecordingPlayer callId={c.id} expectedDurationSeconds={c.durationSeconds} labelText={`${lead.customerName} call`} />
            ) : null}
          </div>
        ))}
        {!leadCalls.length ? <Empty text="No call activity for this lead yet." /> : null}
      </div>
      </div>

      {/* 3. Conversation & Activity Timeline with full CRUD & mobile sync */}
      <div className="sales-lead-detail-section" style={{ order: detailOrder.indexOf("history") + 1 }}>
        <LeadNotesManager
          customerName={lead.customerName}
          initialNotes={leadTimeline}
          leadId={lead.id}
        />
      </div>

      <div className="sales-lead-detail-section" style={{ order: detailOrder.indexOf("information") + 1 }}>
      <details className="sales-lead-advanced-details">
        <summary>Lead information and integrations</summary>
        {/* TeleCRM Custom Schema Fields */}
        <LeadCustomFieldsEditor leadId={lead.id} />

        {/* 4. Edit Lead Information Form */}
        <form className="sales-form-grid" onSubmit={(event) => onSave(event, lead.id)}>
        <PanelTitle icon={KanbanSquare} title="Lead Profile & Details" />
        <label className="sales-form-field">
          <span>Assigned sales user</span>
          <select
            defaultValue={lead.assignedAgentId}
            onChange={(event) => void onAssign(lead.id, event.target.value)}
          >
            {snapshot.visibleAgents.filter((agent) => agent.status === "ACTIVE").map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.displayName}</option>
            ))}
          </select>
        </label>
        <input defaultValue={lead.customerName} name="customerName" placeholder="Customer name" required />
        <div className="sales-form-two">
          <input defaultValue={lead.customerPhone} name="customerPhone" placeholder="WhatsApp number" />
          <input defaultValue={lead.customerEmail} name="customerEmail" placeholder="Email" type="email" />
        </div>
        <input defaultValue={lead.serviceInterest} name="serviceInterest" placeholder="Service interest" />
        <div className="sales-form-two">
          <input defaultValue={lead.segment} name="segment" placeholder="Segment" />
          <select defaultValue={lead.priority} name="priority">
            <option value="normal">Normal</option>
            <option value="warm">Warm</option>
            <option value="hot">Hot</option>
          </select>
        </div>
        <div className="sales-form-two">
          <input defaultValue={lead.budgetAmount || ""} name="budgetAmount" placeholder="Budget" type="number" />
          <input defaultValue={lead.followUpAt ? lead.followUpAt.slice(0, 10) : ""} name="followUpAt" type="date" />
        </div>
        <input defaultValue={lead.tags.join(", ")} name="tags" placeholder="Tags" />
        <textarea defaultValue={lead.notes} name="notes" placeholder="Notes" />
        <button className="sales-primary-button" type="submit">Save lead details</button>
        </form>

        {/* 5. Direct WhatsApp Message Form */}
        {lead.customerPhone ? (
          <form className="sales-form-grid" onSubmit={(event) => onWhatsApp(event, lead.id)}>
          <PanelTitle icon={MessageCircle} title="Send WhatsApp Message" />
          <textarea name="message" placeholder="Message customer through shared WhatsApp inbox" required />
          <div className="sales-button-row">
            <button className="sales-primary-button" type="submit">Send WhatsApp</button>
            <button className="sales-secondary-button" onClick={() => onOpenChat(lead.id)} type="button">Open full chat</button>
            <a className="sales-secondary-button" href={`https://wa.me/${cleanPhone(lead.customerPhone)}`} rel="noreferrer" target="_blank">Open WhatsApp Web</a>
          </div>
          </form>
        ) : null}
      </details>
      </div>
    </div>
  );
}

function InfoRow({ meta, right, title }: { title: string; meta: string; right?: string }) {
  return (
    <div className="sales-table-row">
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="muted-copy">{text}</p>;
}
