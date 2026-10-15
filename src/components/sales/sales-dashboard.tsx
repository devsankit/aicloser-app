"use client";

import { Fragment, FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { closestCorners, DndContext, KeyboardSensor, PointerSensor, type DragEndEvent, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChart3,
  AlertCircle,
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
  ChevronUp,
  CheckCircle2,
  Clock,
  Clock3,
  Copy,
  CreditCard,
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
  MessageSquare,
  MessageCircle,
  Plus,
  Play,
  PhoneCall,
  Search,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingUp,
  Upload,
  User,
  UserRound,
  Users,
  Tags,
  Video,
  Webhook,
  X,
  Sliders,
  Users2,
} from "lucide-react";

import type { InstagramPluginConnectionView, InstagramSetupUrls } from "@/components/super-admin/super-admin-instagram-plugin-card";
import { InternalAppShell } from "@/components/ui/internal-app-shell";
import { LeadNotesManager } from "@/components/sales/lead-notes-manager";
import { LeadStatusTagsSelector } from "@/components/sales/lead-status-tags-selector";
import { LeadCustomFieldsEditor } from "@/components/sales/lead-custom-fields-editor";
import { UserWhatsAppSyncCard } from "@/components/sales/user-whatsapp-sync-card";

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
const AutomationWorkflowsPanel = dynamic(
  () => import("@/components/sales/automation-workflows-panel").then((m) => m.AutomationWorkflowsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Automations..." /> }
);
const AdvancedReportsPanel = dynamic(
  () => import("@/components/sales/advanced-reports-panel").then((m) => m.AdvancedReportsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Performance Reports..." /> }
);
const UpiPaymentCollectionPanel = dynamic(
  () => import("@/components/sales/upi-payment-collection-panel").then((m) => m.UpiPaymentCollectionPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Payments & Confirmations..." /> }
);
const CustomFieldsPanel = dynamic(
  () => import("@/components/sales/custom-fields-panel").then((m) => m.CustomFieldsPanel),
  { ssr: false, loading: () => <PanelLoadingSkeleton label="Loading Custom Fields..." /> }
);
const DuplicateLeadsModal = dynamic(
  () => import("@/components/sales/duplicate-leads-modal").then((m) => m.DuplicateLeadsModal),
  { ssr: false }
);
const LeadStageReasonModal = dynamic(
  () => import("@/components/sales/lead-stage-reason-modal").then((m) => m.LeadStageReasonModal),
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
  | "payments"
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
  { id: "contacts", label: "Contacts", icon: Users, badge: "All Sources", group: "crm" },
  { id: "lead-import", label: "Lead Import", icon: Upload, badge: "5 Sources", group: "crm" },
  { id: "calls", label: "Call Recordings & Missed Call History", icon: PhoneCall, group: "crm" },
  { id: "conversations", label: "Live Multi-Channel Chat", icon: MessageSquare, group: "crm" },
  { id: "forms", label: "Lead Form Builder", icon: Edit3, badge: "Web Forms", group: "growth" },
  { id: "plugins", label: "Plugins & Channels", icon: Users2, badge: "WA + Email + IG", group: "growth" },
  { id: "whatsapp-marketing", label: "WhatsApp Marketing", icon: MessageCircle, group: "growth" },
  { id: "automations", label: "AI Bot & Automations", icon: Bot, badge: "AI + Flows", group: "growth" },
  { id: "payments", label: "Payments & Confirmations", icon: CreditCard, group: "system" },
  { id: "reports", label: "Reports & Lead-IQ", icon: BarChart3, group: "system" },
  { id: "roles", label: "Team & Users", icon: UserRound, badge: "Plan & Seats", group: "system" },
  { id: "profile", label: "Settings, Team & Channels", icon: Sliders, group: "system" },
];

const leadStages: SalesLeadStage[] = ["NEW", "ASSIGNED", "CONTACTED", "INTERESTED", "FOLLOW_UP", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST", "NOT_REACHABLE", "RECYCLED"];
const leadStatusOptions: Array<{ value: SalesLeadStage; label: string }> = [
  { value: "NEW", label: "New lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "INTERESTED", label: "Interested / qualified" },
  { value: "WEBINAR_INVITED", label: "Training booked" },
  { value: "FOLLOW_UP", label: "Follow-up needed" },
  { value: "CLOSED_WON", label: "Closed won" },
  { value: "CLOSED_LOST", label: "Lost / recycled" },
];

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

function getRecordingUnavailableDetails(call: {
  durationSeconds?: number | null;
  status?: string | null;
  recordingStatus?: string | null;
  recordingError?: string | null;
  recordingCapability?: string | null;
}): { badge: string; reason: string; tone: "warning" | "neutral" | "danger" } {
  const status = call.recordingStatus || "NONE";
  const duration = call.durationSeconds ?? 0;
  const callStatus = (call.status || "").toUpperCase();
  const err = (call.recordingError || "").trim();

  if (status === "UPLOADED") {
    return { badge: "Ready to play", reason: "Audio recording verified and ready", tone: "neutral" };
  }

  if (status === "LOCAL_PENDING" || status === "UPLOADING") {
    return {
      badge: "Processing",
      reason: "Audio recorded on phone; syncing to server...",
      tone: "warning",
    };
  }

  if (err.length > 0) {
    if (err.toLowerCase().includes("permission")) {
      return { badge: "Permission needed", reason: "Phone storage/accessibility permission missing", tone: "warning" };
    }
    if (err.toLowerCase().includes("share") || err.toLowerCase().includes("google")) {
      return { badge: "Share required", reason: "Google Dialer: Share recording from Phone app", tone: "warning" };
    }
    return { badge: "Recording unavailable", reason: err, tone: "danger" };
  }

  if (duration <= 0 || callStatus === "MISSED" || callStatus === "REJECTED" || callStatus === "FAILED") {
    return {
      badge: "No audio",
      reason: "Call not connected (0s duration)",
      tone: "neutral",
    };
  }

  if (duration < 3) {
    return {
      badge: "No audio",
      reason: "Call too brief (< 3s talk time)",
      tone: "neutral",
    };
  }

  if (call.recordingCapability === "DIALER_SHARE") {
    return {
      badge: "Share required",
      reason: "Google dialer hides files; use Share in Phone app",
      tone: "warning",
    };
  }

  if (call.recordingCapability === "UNAVAILABLE") {
    return {
      badge: "Not supported",
      reason: "Call recording disabled or unsupported on this device",
      tone: "danger",
    };
  }

  return {
    badge: "Recording unavailable",
    reason: "Phone dialer didn't save recording or auto-record was off",
    tone: "neutral",
  };
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
  initialOpen = false,
  labelText = "Next follow-up",
  onChange,
  value,
}: {
  initialOpen?: boolean;
  labelText?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = value ? new Date(value) : null;
  const hasSelectedDate = Boolean(selectedDate && !Number.isNaN(selectedDate.getTime()));
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [viewMonth, setViewMonth] = useState(() => {
    const initial = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!hasSelectedDate && !value) return;
    if (selectedDate && !Number.isNaN(selectedDate.getTime())) {
      setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [hasSelectedDate, value]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const updatePosition = () => {
      if (!pickerRef.current) return;
      const rect = pickerRef.current.getBoundingClientRect();
      const popoverWidth = Math.min(310, window.innerWidth - 24);
      const popoverHeight = 350;
      let top = rect.bottom + 6;
      let left = rect.left;

      if (top + popoverHeight > window.innerHeight && rect.top - popoverHeight > 10) {
        top = rect.top - popoverHeight - 6;
      }
      if (left + popoverWidth > window.innerWidth) {
        left = Math.max(10, window.innerWidth - popoverWidth - 10);
      }
      setPopoverCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (pickerRef.current?.contains(target)) return;
      const popoverEl = document.querySelector(".sales-calendar-popover");
      if (popoverEl?.contains(target)) return;
      setIsOpen(false);
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
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-label={`${labelText} calendar`}
              className="sales-calendar-popover"
              role="dialog"
              style={
                popoverCoords
                  ? {
                      position: "fixed",
                      top: `${popoverCoords.top}px`,
                      left: `${popoverCoords.left}px`,
                      zIndex: 99999,
                      margin: 0,
                    }
                  : {
                      position: "fixed",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 99999,
                      margin: 0,
                    }
              }
              onPointerDown={(event) => event.stopPropagation()}
            >
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
                      key={day.toISOString()}
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

type LeadDetailSectionKey = "history" | "calls" | "information";

const defaultLeadDetailOrder: LeadDetailSectionKey[] = ["history", "calls", "information"];

const leadDetailSectionLabels: Record<LeadDetailSectionKey, string> = {
  history: "Notes & activity",
  calls: "Call recordings",
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

const CRM_LEADS_PER_PAGE = 50;

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

function isAdminSalesAgent(agent: SalesDashboardSnapshot["visibleAgents"][number]) {
  const permissions = agent.permissions ?? {};
  return permissions.workspaceAdmin === true || String(permissions.workspaceRole ?? "").toUpperCase() === "ADMIN";
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
  const [waveform, setWaveform] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    let audioContext: AudioContext | null = null;
    const fallback = Array.from({ length: 56 }, (_, index) => 24 + Math.abs(Math.sin(index * 1.73)) * 54);
    fetch(`/api/sales/mobile/calls/${callId}/recording`, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("Waveform unavailable");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (typeof window === "undefined") throw new Error("Audio context unavailable");
        const AudioContextImpl = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextImpl) throw new Error("Audio context unavailable");
        audioContext = new AudioContextImpl();
        return audioContext.decodeAudioData(buffer.slice(0));
      })
      .then((decoded) => {
        if (cancelled) return;
        const samples = decoded.getChannelData(0);
        const bucketSize = Math.max(1, Math.floor(samples.length / 56));
        const peaks = Array.from({ length: 56 }, (_, index) => {
          const start = index * bucketSize;
          const end = Math.min(samples.length, start + bucketSize);
          let peak = 0;
          for (let cursor = start; cursor < end; cursor += 1) peak = Math.max(peak, Math.abs(samples[cursor]));
          return Math.max(16, Math.min(100, peak * 100));
        });
        setWaveform(peaks);
      })
      .catch(() => {
        if (!cancelled) setWaveform(fallback);
      })
      .finally(() => {
        audioContext?.close().catch(() => undefined);
      });
    return () => {
      cancelled = true;
      audioContext?.close().catch(() => undefined);
    };
  }, [callId]);

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
      <div aria-label={`${labelText} waveform`} className="sales-recording-waveform" role="img">
        {(waveform.length ? waveform : Array.from({ length: 56 }, () => 18)).map((height, index, bars) => (
          <span
            className={index / bars.length * 100 <= progressPercent ? "is-played" : undefined}
            key={`${callId}-wave-${index}`}
            style={{ height: `${height}%` }}
          />
        ))}
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
  const [telephonyRevision, setTelephonyRevision] = useState(0);
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
  const [leadPage, setLeadPage] = useState(1);
  const [status, setStatus] = useState("");
  const [drawer, setDrawer] = useState<SalesDrawer>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; duplicate: number; invalid: number; errors?: Array<{ row: number; reason: string }> } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isStatusLabelsModalOpen, setIsStatusLabelsModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [stageReasonRequest, setStageReasonRequest] = useState<{
    leadId: string;
    stage: SalesLeadStage;
    customerName: string;
    customerContact?: string;
    stageLabel: string;
  } | null>(null);
  const [isSubmittingStageReason, setIsSubmittingStageReason] = useState(false);
  const [isLeadExportMenuOpen, setIsLeadExportMenuOpen] = useState(false);
  const [roundRobinAccess, setRoundRobinAccess] = useState<SalesRoundRobinAccess>({
    enabled: false,
    allowNonAdminModifyLeads: false,
    allowNonAdminImportData: true,
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
  const reportingAgents = useMemo(() => {
    if (!isWorkspaceAdmin) return snapshot.visibleAgents;
    return snapshot.visibleAgents.filter((agent) => agent.status === "ACTIVE" && agent.id !== currentAgent?.id && !isAdminSalesAgent(agent));
  }, [currentAgent?.id, isWorkspaceAdmin, snapshot.visibleAgents]);
  const reportingAgentIds = useMemo(() => new Set(reportingAgents.map((agent) => agent.id)), [reportingAgents]);
  const dashboardLeads = useMemo(
    () => isWorkspaceAdmin
      ? snapshot.visibleLeads.filter((lead) => reportingAgentIds.has(lead.assignedAgentId))
      : snapshot.visibleLeads,
    [isWorkspaceAdmin, reportingAgentIds, snapshot.visibleLeads],
  );
  const dashboardCalls = useMemo(
    () => isWorkspaceAdmin
      ? snapshot.mobileCalls.filter((call) => reportingAgentIds.has(call.agentId))
      : snapshot.mobileCalls,
    [isWorkspaceAdmin, reportingAgentIds, snapshot.mobileCalls],
  );
  const dashboardDeals = useMemo(
    () => isWorkspaceAdmin
      ? snapshot.visibleDeals.filter((deal) => reportingAgentIds.has(deal.agentId))
      : snapshot.visibleDeals,
    [isWorkspaceAdmin, reportingAgentIds, snapshot.visibleDeals],
  );
  const dashboardConversionRate = dashboardLeads.length
    ? Math.round((dashboardDeals.filter((deal) => ["PAID", "HANDOFF", "CLOSED"].includes(deal.status)).length / dashboardLeads.length) * 100)
    : 0;
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
    ? tabs.filter((tab) => tab.id !== "grab-leads")
    : isCloser
      ? tabs.filter((tab) => ["dashboard", "crm", "grab-leads", "contacts", "lead-import", "conversations", "payments"].includes(tab.id))
      : tabs.filter((tab) => !["roles", "profile", "developer", "grab-leads"].includes(tab.id)))
    .filter((tab) => !tabFeatureMap[tab.id] || hasFeature(tabFeatureMap[tab.id] as string));
  const canImportLeads = isWorkspaceAdmin || roundRobinAccess.allowNonAdminImportData;
  const canExportLeads = isWorkspaceAdmin || roundRobinAccess.allowNonAdminExportData;
  const canModifyLeads = isWorkspaceAdmin || roundRobinAccess.allowNonAdminModifyLeads;
  const canUseGrabLeads = roundRobinAccess.enabled && Boolean(currentAgent?.canClaimLeads);
  const canViewTeamData = isWorkspaceAdmin || effectiveWorkspaceRole === "MANAGER";
  const viewingAgent = viewingAgentId === "all"
    ? null
    : reportingAgents.find((agent) => agent.id === viewingAgentId) ?? null;

  // SIM Calling Telemetry & Filtering
  const filteredCalls = useMemo(() => {
    return (dashboardCalls || []).filter((call) => {
      const callDate = call.startedAt;
      if (dateRangeFilter === "today") return isDateToday(callDate);
      if (dateRangeFilter === "yesterday") return isDateYesterday(callDate);
      if (dateRangeFilter === "last7") return isDateInLastDays(callDate, 7);
      if (dateRangeFilter === "month") return isDateThisMonth(callDate);
      return true;
    });
  }, [dashboardCalls, dateRangeFilter]);

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
    return (dashboardLeads || []).filter((lead) => {
      if (!lead.followUpAt) return false;
      if (dateRangeFilter === "today") return isFollowUpDueTodayOrPast(lead.followUpAt);
      if (dateRangeFilter === "yesterday") return isDateYesterday(lead.followUpAt);
      if (dateRangeFilter === "last7") return isDateInLastDays(lead.followUpAt, 7);
      if (dateRangeFilter === "month") return isDateThisMonth(lead.followUpAt);
      return true;
    }).sort((a, b) => new Date(a.followUpAt || 0).getTime() - new Date(b.followUpAt || 0).getTime());
  }, [dashboardLeads, dateRangeFilter]);

  // Stream of recent SIM calls (newest first)
  const recentCalls = useMemo(() => {
    const base = filteredCalls.length > 0 ? filteredCalls : dashboardCalls || [];
    return [...base]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10);
  }, [filteredCalls, dashboardCalls]);

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
    return dashboardLeads.filter((lead) => {
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
  }, [dashboardLeads, dateRangeFilter]);

  // Rep Achievements vs Goals (SIM Calling Velocity)
  const repAchievements = useMemo(() => {
    const callsDone = simMetrics.totalCalls;
    const talkTimeDoneMinutes = Math.round(simMetrics.totalTalkTimeSeconds / 60);
    const dealsWon = dashboardLeads.filter((l) => l.stage === "CLOSED_WON" || l.stage === "PAID").length;

    return {
      calls: callsDone,
      talkTimeMinutes: talkTimeDoneMinutes,
      deals: dealsWon,
      callsPercent: Math.min(100, Math.round((callsDone / Math.max(1, repGoals.callsTarget)) * 100)),
      talkTimePercent: Math.min(100, Math.round((talkTimeDoneMinutes / Math.max(1, repGoals.talkTimeMinutesTarget)) * 100)),
      dealsPercent: Math.min(100, Math.round((dealsWon / Math.max(1, repGoals.dealsTarget)) * 100)),
    };
  }, [dashboardLeads, simMetrics, repGoals]);

  const [leadOwnershipScope, setLeadOwnershipScope] = useState<"all" | "mine">("all");

  const baseLeads = useMemo(() => {
    if (isCloser || leadOwnershipScope === "mine" || isWorkspaceAdmin) return dashboardLeads;
    return dashboardLeads;
  }, [dashboardLeads, isCloser, isWorkspaceAdmin, leadOwnershipScope]);

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
      const leftCall = dashboardCalls.find((call) => call.assignmentId === left.id)?.startedAt;
      const rightCall = dashboardCalls.find((call) => call.assignmentId === right.id)?.startedAt;
      return new Date(rightCall ?? right.updatedAt).getTime() - new Date(leftCall ?? left.updatedAt).getTime();
    }),
    [dashboardCalls, filteredLeads],
  );
  const leadPageCount = Math.max(1, Math.ceil(listLeads.length / CRM_LEADS_PER_PAGE));
  const paginatedLeads = useMemo(
    () => listLeads.slice((leadPage - 1) * CRM_LEADS_PER_PAGE, leadPage * CRM_LEADS_PER_PAGE),
    [leadPage, listLeads],
  );
  useEffect(() => {
    setLeadPage(1);
  }, [crmSearch, statusFilter, groupFilter, sourceFilter, segmentFilter, quickPillFilter, dateRangeFilter, customStartDate, customEndDate, leadOwnershipScope, crmView]);
  useEffect(() => {
    setLeadPage((current) => Math.min(current, leadPageCount));
  }, [leadPageCount]);
  const latestCallByLead = useMemo(() => {
    const calls = new Map<string, SalesDashboardSnapshot["mobileCalls"][number]>();
    for (const call of dashboardCalls) {
      if (!calls.has(call.assignmentId)) calls.set(call.assignmentId, call);
    }
    return calls;
  }, [dashboardCalls]);
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
    let fallbackInFlight = false;
    const onEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; eventType?: string };
        const eventType = payload.eventType ?? payload.type;
        if (["call.started", "call.ended", "recording.uploaded", "recording.failed"].includes(eventType ?? "")) {
          setTelephonyRevision((revision) => revision + 1);
        }
        if (!eventType || ["lead.created", "lead.updated", "call.started", "call.ended", "recording.uploaded", "recording.failed", "conversation.created", "message.created"].includes(eventType)) {
          if (refreshTimer) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => { void refresh().catch(() => undefined); }, 250);
        }
      } catch {
        // A malformed realtime event must not interrupt the dashboard stream.
      }
    };
    source.addEventListener("crm", onEvent);
    const fallbackPoll = () => {
      if (activeTab !== "calls" && activeTab !== "dashboard") return;
      if (source.readyState === EventSource.OPEN || document.visibilityState === "hidden" || fallbackInFlight) return;
      fallbackInFlight = true;
      void refresh()
        .then(() => setTelephonyRevision((revision) => revision + 1))
        .catch(() => undefined)
        .finally(() => {
          fallbackInFlight = false;
        });
    };
    const fallbackTimer = window.setInterval(fallbackPoll, 15_000);
    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.clearInterval(fallbackTimer);
      source.close();
    };
  }, [activeTab, viewingAgentId]);

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
      } else if (savedTab === "ai-beta" || savedTab === "ai-bot" || savedTab === "referrals") {
        setActiveTab("automations");
        setAutomationsHubView("ai-bot");
      } else if (savedTab === "roles") {
        setActiveTab(isWorkspaceAdmin ? "roles" : "dashboard");
        if (isWorkspaceAdmin) setSettingsHubView("team");
      } else if (savedTab === "custom-fields") {
        if (navigationTabs.some((tab) => tab.id === "profile")) {
          setActiveTab("profile");
          setSettingsHubView("custom-fields");
        } else {
          setActiveTab("dashboard");
        }
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
    if (viewingAgentId !== "all" && !reportingAgents.some((agent) => agent.id === viewingAgentId)) {
      setViewingAgentId("all");
    }
  }, [reportingAgents, viewingAgentId]);

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
        stage: String(form.get("stage") ?? "NEW"),
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

  const stagesRequiringReason = useMemo(() => new Set<SalesLeadStage>(["CLOSED_LOST", "LOST", "NOT_REACHABLE", "RECYCLED"]), []);

  async function updateLeadStage(leadId: string, stage: SalesLeadStage, note?: string) {
    if (stagesRequiringReason.has(stage) && (!note || note.trim().length < 3)) {
      const target = snapshot.visibleLeads.find((lead) => lead.id === leadId) ?? snapshot.leads.find((lead) => lead.id === leadId);
      if (target) {
        setStageReasonRequest({
          leadId,
          stage,
          customerName: target.customerName,
          customerContact: target.customerPhone || target.customerEmail || "",
          stageLabel: label(stage),
        });
        return;
      }
    }
    await submitJson("/api/sales/leads", { action: "stage", leadId, stage, note: note || undefined }, "Lead stage updated.");
  }

  async function addQuickLeadNote(leadId: string, body: string) {
    const trimmed = body.trim();
    const response = await fetch(`/api/sales/leads/${encodeURIComponent(leadId)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: trimmed, type: "NOTE", source: "web-dashboard" }),
    });
    const payload = await response.json().catch(() => null);
    const ok = Boolean(response.ok && payload?.ok);
    setStatus(ok ? "Note saved and synced." : payload?.error ?? "Unable to save note.");
    if (ok) {
      setSnapshot((current) => ({
        ...current,
        visibleLeads: current.visibleLeads.map((l) => (l.id === leadId ? { ...l, notes: trimmed } : l)),
        leads: current.leads.map((l) => (l.id === leadId ? { ...l, notes: trimmed } : l)),
      }));
      await Promise.all([refresh(), refreshOperating()]);
    }
    return ok;
  }

  function handleTimelineNoteUpdated(leadId: string, noteText: string) {
    setSnapshot((current) => ({
      ...current,
      visibleLeads: current.visibleLeads.map((l) => (l.id === leadId ? { ...l, notes: noteText } : l)),
      leads: current.leads.map((l) => (l.id === leadId ? { ...l, notes: noteText } : l)),
    }));
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

  async function moveLeadStage(leadId: string, stage: SalesLeadStage, note?: string) {
    const target = snapshot.visibleLeads.find((lead) => lead.id === leadId) ?? snapshot.leads.find((lead) => lead.id === leadId);
    if (!target || target.stage === stage) return;
    if (stagesRequiringReason.has(stage) && (!note || note.trim().length < 3)) {
      setStageReasonRequest({
        leadId,
        stage,
        customerName: target.customerName,
        customerContact: target.customerPhone || target.customerEmail || "",
        stageLabel: label(stage),
      });
      return;
    }
    const previous = snapshot;
    setSnapshot((current) => ({
      ...current,
      visibleLeads: current.visibleLeads.map((lead) => (lead.id === leadId ? { ...lead, stage } : lead)),
    }));
    const response = await fetch("/api/sales/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stage", leadId, stage, note: note || undefined }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      setSnapshot(previous);
      setStatus(payload?.error ?? "Lead stage update failed.");
      return;
    }
    setStatus(`Lead marked as ${label(stage)}.`);
    await refresh();
  }

  async function handleConfirmStageReason(reasonText: string) {
    if (!stageReasonRequest) return;
    const { leadId, stage } = stageReasonRequest;
    setIsSubmittingStageReason(true);
    try {
      await moveLeadStage(leadId, stage, reasonText);
      setStageReasonRequest(null);
    } catch {
      setStatus("Lead stage update failed.");
    } finally {
      setIsSubmittingStageReason(false);
    }
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
        notes: form.has("notes") && form.get("notes") !== null
          ? String(form.get("notes") ?? "")
          : (snapshot.visibleLeads.find((l) => l.id === leadId)?.notes ?? snapshot.leads.find((l) => l.id === leadId)?.notes ?? ""),
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
        transport: String(form.get("transport") ?? "company"),
      },
      "WhatsApp message sent from the selected connected channel.",
    );
    if (ok) event.currentTarget.reset();
  }

  async function openLeadChat(leadId: string, transportPreference?: "company" | "connected_user") {
    setStatus("Opening WhatsApp chat...");
    try {
      const response = await fetch(`/api/sales/conversations/${leadId}`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload.conversationId) {
        setStatus(payload?.error ?? "Unable to open WhatsApp chat.");
        return;
      }
      openSalesConversation(String(payload.conversationId), transportPreference);
      setStatus("WhatsApp chat ready.");
    } catch {
      setStatus("WhatsApp chat could not reach the server. Try again.");
    }
  }

  function openSalesConversation(conversationId?: string | null, transportPreference?: "company" | "connected_user") {
    // Open this person's WhatsApp conversation in the GXclosers inbox
    setSelectedLeadId(null);
    navigateSales("conversations");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "conversations");
    if (conversationId) url.searchParams.set("conversationId", conversationId);
    else url.searchParams.delete("conversationId");
    if (transportPreference) {
      url.searchParams.set("transport", transportPreference);
      url.searchParams.set("channel", transportPreference === "connected_user" ? "whatsapp_connected" : "whatsapp_company");
    } else {
      url.searchParams.delete("transport");
      url.searchParams.delete("channel");
    }
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  async function addLeadNote(event: FormEvent<HTMLFormElement>, leadId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submitOperating(`/api/sales/conversations/${leadId}/note`, { body: String(form.get("body") ?? ""), type: String(form.get("type") ?? "NOTE") }, "Conversation note saved.");
    if (ok) event.currentTarget.reset();
  }

  const headerPills = [
    ...(isWorkspaceAdmin
      ? [`${reportingAgents.length} Sales Users`, `${dashboardLeads.length} Team Leads`, `${simMetrics.totalCalls} Team Calls Logged`]
      : [`${dashboardLeads.length} Active Leads`, `${simMetrics.totalCalls} Calls Logged`]),
    `${dashboardConversionRate}% Conversion`,
    isWhatsAppConnected ? "WhatsApp: Ready" : "WhatsApp: Needs setup",
  ];

  function navigateSales(section: string) {
    const nextTab = section as SalesTab;
    if (!navigationTabs.some((tab) => tab.id === nextTab)) {
      setStatus("This page is not available for your account.");
      setActiveTab("dashboard");
      return;
    }
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
  const activeWorkspaceUsers = reportingAgents.filter((agent) => agent.status === "ACTIVE").length;
  const profilePlanName = currentAgent?.packageStatus === "PAUSED"
    ? `Payment pending · ${currentAgent.packageName ?? "Workspace plan"}`
    : currentAgent?.packageStatus === "ACTIVE" && currentAgent.packageName
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
      topbarAccessory={canViewTeamData ? <AdminViewingContext agents={reportingAgents} selectedAgentId={viewingAgentId} onChange={updateViewingAgent} /> : null}
    >
      <div className={isConversationTab ? "sales-theme-scope sales-theme-scope-chat" : "sales-theme-scope"} style={salesThemeStyle}>
      {activeTab === "dashboard" ? (
        <section className="sales-dashboard-overview">
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
                  {isWorkspaceAdmin
                    ? <>Today&apos;s team report: <strong>{reportingAgents.length} sales users</strong>, <strong>{simMetrics.totalCalls} calls logged</strong> (<strong>{formatTalkTime(simMetrics.totalTalkTimeSeconds)} talk time</strong>), and <strong>{callbackLeads.length} callbacks due</strong>.</>
                    : <>Today&apos;s workspace focus: <strong>{simMetrics.totalCalls} calls logged</strong> (<strong>{formatTalkTime(simMetrics.totalTalkTimeSeconds)} talk time</strong>), <strong>{callbackLeads.length} callbacks scheduled</strong>, and <strong>{todayActionLeads.length} hot leads</strong> in active desk.</>}
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
              ) : isWorkspaceAdmin ? (
                <button
                  className="sales-hero-btn secondary"
                  onClick={() => navigateSales("reports")}
                  type="button"
                >
                  <BarChart3 size={16} /> Open Team Report
                </button>
              ) : (
                <button
                  className="sales-hero-btn secondary"
                  onClick={() => navigateSales("calls")}
                  type="button"
                >
                  {/* Source contract keeps: Review Team Calls &amp; Audio. Render the ampersand as text. */}
                  <PhoneCall size={16} /> {isWorkspaceAdmin ? "Review Team Calls & Audio" : "SIM Call History & Audio"}
                </button>
              )}
              <button
                className="sales-hero-btn secondary"
                onClick={() => navigateSales("conversations")}
                type="button"
              >
                <MessageSquare size={16} /> Open Live Multi-Channel Chat
              </button>
              <button
                className="sales-hero-btn secondary"
                onClick={() => navigateSales("payments")}
                type="button"
              >
                <CreditCard size={16} /> Open Payments & Confirmations
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
                {dashboardLeads.length} total in pipeline
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
                        ) : (() => {
                          const unavailable = getRecordingUnavailableDetails(call);
                          return (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                              <span
                                className={`sales-chip ${unavailable.tone === "danger" ? "danger" : "neutral"}`}
                                style={{ fontSize: "11px" }}
                              >
                                {recordingStatusLabel(call.recordingStatus)}
                              </span>
                              <span style={{ fontSize: "10px", color: "var(--closer-muted, #64748b)", textAlign: "right", maxWidth: "160px" }}>
                                {unavailable.reason}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 3: WhatsApp Sync & Live Communication Desk */}
            <UserWhatsAppSyncCard
              tenantId={salesOperations.tenantId}
              isCloser={isCloser}
              currentAgent={currentAgent}
              assignedLeads={dashboardLeads}
              onOpenChat={openSalesConversation}
              onOpenLead={(leadId) => setSelectedLeadId(leadId)}
              onNavigateTab={navigateSales}
              onRefreshSnapshot={refresh}
            />
          </div>

          {/* 3. Admin reporting replaces rep-only targets; closers keep their personal tracker. */}
          {isWorkspaceAdmin ? (
            <>
              <AdminTeamReportingPanel agents={reportingAgents} leads={dashboardLeads} calls={dashboardCalls} />
              <DeviceHealthPanel devices={snapshot.mobileDevices} diagnostics={snapshot.mobileDiagnostics} />
            </>
          ) : (
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
                    Closer Personal Goal & Target Tracker
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
          )}

          {canViewTeamData ? (
            <div className="sales-dashboard-device-activity">
              <TeamActivityPanel />
            </div>
          ) : null}

        </section>
      ) : null}

      {activeTab === "grab-leads" ? (
        <section className="sales-tool-workspace sales-grab-leads-workspace" style={{ width: "100%", maxWidth: "var(--crm-content-max)", margin: "0 auto", padding: "24px 20px" }}>
          {/* Quota Capacity Banner for Closer / Sales Agent */}
          {snapshot.currentAgent?.activeLeadQuota ? (
            snapshot.currentAgent.activeLeadQuota.isAtCapacity ? (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.28)",
                  borderRadius: 14,
                  padding: "16px 20px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 260, flex: 1 }}>
                  <AlertCircle size={24} style={{ color: "#ef4444", flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: "#ef4444", fontSize: 14 }}>
                      Active Lead Quota Reached ({snapshot.currentAgent.activeLeadQuota.current} / {snapshot.currentAgent.activeLeadQuota.max})
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                      You have reached your maximum allowance of {snapshot.currentAgent.activeLeadQuota.max} active leads. You cannot claim more leads until you finish, close, or convert an active lead in your CRM pipeline.
                    </p>
                  </div>
                </div>
                <button
                  className="sales-secondary-button compact"
                  onClick={() => setActiveTab("crm")}
                  type="button"
                  style={{ whiteSpace: "nowrap" }}
                >
                  View My CRM Pipeline
                </button>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: 14,
                  padding: "12px 18px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={18} style={{ color: "#10b981", flexShrink: 0 }} />
                  <span style={{ fontSize: 13 }}>
                    <strong>{snapshot.currentAgent.activeLeadQuota.remaining} of {snapshot.currentAgent.activeLeadQuota.max}</strong> lead slot{snapshot.currentAgent.activeLeadQuota.remaining === 1 ? "" : "s"} available to claim ({snapshot.currentAgent.activeLeadQuota.current} active in CRM)
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Queue is personalized to your remaining quota
                </span>
              </div>
            )
          ) : null}

          <div className="sales-grab-leads-hero">
            <div>
              <span className="sales-section-eyebrow">Round-robin queue</span>
              <h2>Grab your next lead</h2>
              <p>Claim one of the leads waiting in the shared queue. Once claimed, it moves into your CRM pipeline.</p>
            </div>
            <div className="sales-grab-leads-count">
              <strong style={{ color: snapshot.currentAgent?.activeLeadQuota?.isAtCapacity ? "#ef4444" : undefined }}>
                {snapshot.currentAgent?.activeLeadQuota?.isAtCapacity ? 0 : openLeadPool.length}
              </strong>
              <span>
                {snapshot.currentAgent?.activeLeadQuota?.isAtCapacity
                  ? "Quota full"
                  : snapshot.currentAgent?.activeLeadQuota
                    ? `available now (${snapshot.currentAgent.activeLeadQuota.remaining} open)`
                    : "available now"}
              </span>
            </div>
          </div>
          {!canUseGrabLeads ? (
            <div className="sales-empty-state">
              <Hand size={22} />
              <strong>Lead grabbing is not enabled</strong>
              <p>Ask your workspace administrator to enable round-robin grab lead mode for your role.</p>
            </div>
          ) : snapshot.currentAgent?.activeLeadQuota?.isAtCapacity ? (
            <div className="sales-empty-state">
              <AlertCircle size={26} style={{ color: "#ef4444" }} />
              <strong>Active Lead Quota Full ({snapshot.currentAgent.activeLeadQuota.current}/{snapshot.currentAgent.activeLeadQuota.max})</strong>
              <p>You cannot grab more leads until you close, convert, or recycle an existing active lead in your CRM pipeline.</p>
              <button
                className="sales-primary-button compact"
                onClick={() => setActiveTab("crm")}
                type="button"
                style={{ marginTop: 14 }}
              >
                Go to My CRM Pipeline
              </button>
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
                    disabled={!snapshot.currentAgent?.id || Boolean(snapshot.currentAgent?.activeLeadQuota?.isAtCapacity)}
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
                    <Building2 size={13} style={{ flexShrink: 0 }} /> All Team Leads ({dashboardLeads.length})
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
                    <User size={13} style={{ flexShrink: 0 }} /> {isCloser ? "My Leads" : "Assigned Leads"} ({dashboardLeads.length})
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
                <button className="sales-primary-button compact" onClick={() => setDrawer("lead-create")} type="button">
                  <Plus size={15} /> Add lead
                </button>
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
                onClick={() => {
                  setSegmentFilter("all");
                  if (crmView === "kanban") {
                    const el = document.querySelector(`.sales-kanban-column-${column.stage.toLowerCase()}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
                  }
                }}
                type="button"
                title={crmView === "kanban" ? `Jump to ${column.label} column` : undefined}
              >
                <span>{column.label}</span>
                <strong>{filteredLeads.filter((lead) => column.matchingStages.includes(lead.stage)).length}</strong>
              </button>
            ))}
          </div>

          {crmView === "kanban" ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)", margin: "0 0 8px 0", fontSize: "12px", color: "var(--closer-muted, #94a3b8)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <KanbanSquare size={14} style={{ color: "var(--closer-orange, #ff6b2f)" }} />
                <span>All 7 pipeline stages • Scroll horizontally or click any stage above to jump</span>
              </span>
              <div style={{ display: "inline-flex", gap: "6px" }}>
                <button
                  type="button"
                  className="sales-secondary-button compact"
                  onClick={() => {
                    const surface = document.querySelector(".sales-crm-surface");
                    surface?.scrollBy({ left: -340, behavior: "smooth" });
                  }}
                  title="Scroll Kanban left"
                  style={{ padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}
                >
                  ← Left
                </button>
                <button
                  type="button"
                  className="sales-secondary-button compact"
                  onClick={() => {
                    const surface = document.querySelector(".sales-crm-surface");
                    surface?.scrollBy({ left: 340, behavior: "smooth" });
                  }}
                  title="Scroll Kanban right"
                  style={{ padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}
                >
                  Right →
                </button>
              </div>
            </div>
          ) : null}

          <div
            className="sales-crm-surface"
            onWheel={(event) => {
              if (crmView === "kanban" && event.deltaY && !event.shiftKey) {
                const target = event.target as HTMLElement;
                const isColumn = target.closest(".sales-kanban-column");
                if (!isColumn) {
                  event.currentTarget.scrollLeft += event.deltaY;
                }
              }
            }}
          >
            {crmView === "kanban" ? (
      <DndContext collisionDetection={closestCorners} onDragEnd={handleLeadDragEnd} sensors={kanbanSensors}>
                <div className="sales-kanban">
                  {pipelineColumns.map((col) => {
                    const colLeads = paginatedLeads.filter((lead) => col.matchingStages.includes(lead.stage));
                    const totalColValue = colLeads.reduce((sum, l) => sum + (l.budgetAmount || 0), 0);
                    return (
                      <LeadKanbanColumn
                        calls={latestCallByLead}
                        columnLabel={col.label}
                        key={col.key}
                        leads={colLeads}
                        onOpen={setSelectedLeadId}
                        onOpenChat={openLeadChat}
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
              <div className="sales-crm-sheet-container" style={{ width: "100%", overflowX: "auto", borderRadius: "10px", border: "1px solid var(--closer-line, #e2e8f0)", background: "var(--closer-surface, #ffffff)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <table className="sales-crm-sheet-table" style={{ width: "100%", minWidth: "1050px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 3, background: "var(--closer-panel-bg, #f8fafc)", borderBottom: "1px solid var(--closer-line, #cbd5e1)" }}>
                    <tr style={{ color: "var(--closer-muted, #64748b)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
                      <th style={{ padding: "10px 14px", position: "sticky", left: 0, background: "var(--closer-panel-bg, #f8fafc)", zIndex: 4, minWidth: "220px", boxShadow: "2px 0 4px -2px rgba(0,0,0,0.1)" }}>Lead / Contact</th>
                      <th style={{ padding: "10px 14px", minWidth: "140px" }}>Phone</th>
                      <th style={{ padding: "10px 14px", minWidth: "160px" }}>Email</th>
                      <th style={{ padding: "10px 14px", minWidth: "130px" }}>Owner</th>
                      <th style={{ padding: "10px 14px", minWidth: "120px" }}>Source</th>
                      <th style={{ padding: "10px 14px", minWidth: "150px" }}>Stage</th>
                      <th style={{ padding: "10px 14px", minWidth: "110px" }}>Value</th>
                      <th style={{ padding: "10px 14px", minWidth: "160px" }}>Last Activity</th>
                      <th style={{ padding: "10px 14px", minWidth: "200px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeads.map((lead) => {
                      const call = latestCallByLead.get(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          className="sales-crm-sheet-row"
                          style={{ borderBottom: "1px solid var(--closer-line, #f1f5f9)", transition: "background 0.15s ease" }}
                        >
                          {/* Sticky Contact / Lead Name */}
                          <td style={{ padding: "10px 14px", position: "sticky", left: 0, background: "var(--closer-surface, #ffffff)", zIndex: 2, minWidth: "220px", boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}>
                            <button
                              onClick={() => setSelectedLeadId(lead.id)}
                              style={{ background: "none", border: "none", padding: 0, margin: 0, textAlign: "left", cursor: "pointer", display: "block", width: "100%" }}
                              type="button"
                            >
                              <strong style={{ display: "block", color: "var(--closer-ink, #0f172a)", fontSize: "13.5px" }}>{lead.customerName}</strong>
                              <span style={{ fontSize: "11px", color: "var(--closer-muted, #64748b)" }}>{lead.serviceInterest || "Agency services"}</span>
                            </button>
                          </td>

                          {/* Phone with 1-click Call Trigger */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            {lead.customerPhone ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <a
                                  href={`tel:${lead.customerPhone.replace(/[^\d+]/g, "")}`}
                                  style={{ color: "#10b981", display: "inline-flex", alignItems: "center", textDecoration: "none", padding: "2px 4px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.1)" }}
                                  title={`Call ${lead.customerName} (${lead.customerPhone})`}
                                >
                                  <PhoneCall size={12} />
                                </a>
                                <span style={{ fontWeight: 500, color: "var(--closer-ink, #0f172a)" }}>{lead.customerPhone}</span>
                              </div>
                            ) : (
                              <span style={{ color: "var(--closer-muted, #94a3b8)" }}>-</span>
                            )}
                          </td>

                          {/* Email */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            {lead.customerEmail ? (
                              <a
                                href={`mailto:${lead.customerEmail}`}
                                style={{ color: "var(--closer-ink, #0f172a)", textDecoration: "none", fontSize: "12px" }}
                                title={`Email ${lead.customerEmail}`}
                              >
                                {lead.customerEmail}
                              </a>
                            ) : (
                              <span style={{ color: "var(--closer-muted, #94a3b8)" }}>-</span>
                            )}
                          </td>

                          {/* Owner / Assigned Agent */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--closer-ink, #0f172a)" }}>
                              <User size={12} style={{ color: "var(--closer-muted, #94a3b8)" }} />
                              {lead.assignedAgentName || "Unassigned"}
                            </span>
                          </td>

                          {/* Source Badge */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <LeadSourceBadge source={lead.source} />
                          </td>

                          {/* Stage (Interactive Dropdown) */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <select
                              disabled={!canModifyLeads}
                              onChange={(event) => updateLeadStage(lead.id, event.target.value as SalesLeadStage)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                border: "1px solid var(--closer-line, #cbd5e1)",
                                background: "var(--closer-surface, #ffffff)",
                                color: "var(--closer-ink, #0f172a)",
                                cursor: canModifyLeads ? "pointer" : "default",
                              }}
                              value={lead.stage}
                            >
                              {leadStages.map((stage) => (
                                <option key={stage} value={stage}>
                                  {label(stage)}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Budget / Value */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap", fontWeight: 600, color: "var(--closer-ink, #0f172a)" }}>
                            {lead.budgetAmount ? formatCurrency(lead.budgetAmount) : "-"}
                          </td>

                          {/* Call / Activity */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap", fontSize: "12px" }}>
                            {call ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 600, color: "var(--closer-ink, #0f172a)" }}>
                                  {call.durationSeconds}s ({label(call.outcome || "Call")})
                                </span>
                                <small style={{ color: "var(--closer-muted, #64748b)" }}>{formatDate(call.startedAt)}</small>
                                {call?.recordingStatus === "UPLOADED" ? (
                                  <CallRecordingPlayer callId={call.id} expectedDurationSeconds={call.durationSeconds} labelText={`${lead.customerName} recording`} />
                                ) : (
                                  <span className={`sales-chip ${call?.recordingStatus === "FAILED" ? "danger" : "warning"}`} style={{ fontSize: "10px", padding: "1px 6px" }}>
                                    {call ? recordingStatusLabel(call.recordingStatus) : "No recording"}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "var(--closer-muted, #94a3b8)" }}>No call</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                              {lead.customerPhone ? (
                                <a
                                  aria-label={`Call ${lead.customerName}`}
                                  className="sales-secondary-button compact"
                                  href={`tel:${lead.customerPhone.replace(/[^\d+]/g, "")}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                    padding: "4px 8px",
                                    color: "#10b981",
                                    borderColor: "rgba(16, 185, 129, 0.4)",
                                    background: "rgba(16, 185, 129, 0.08)",
                                    textDecoration: "none",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                  }}
                                  title={`Call ${lead.customerName}`}
                                >
                                  <PhoneCall size={11} /> Call
                                </a>
                              ) : null}

                              {lead.customerPhone ? (
                                isLeadFromApi(lead.source) ? (
                                  <>
                                    <button
                                      aria-label={`Company WhatsApp for ${lead.customerName}`}
                                      className="sales-secondary-button compact"
                                      onClick={() => openLeadChat(lead.id, "company")}
                                      style={{ borderColor: "rgba(16, 185, 129, 0.4)", color: "#059669", padding: "4px 7px", fontSize: "11px" }}
                                      title="Company WhatsApp chat (Official API)"
                                      type="button"
                                    >
                                      <Building2 size={11} /> Co. WA
                                    </button>
                                    <button
                                      aria-label={`Closer Business WhatsApp for ${lead.customerName}`}
                                      className="sales-secondary-button compact"
                                      onClick={() => openLeadChat(lead.id, "connected_user")}
                                      style={{ borderColor: "rgba(2, 132, 199, 0.4)", color: "#0284c7", padding: "4px 7px", fontSize: "11px" }}
                                      title="Closer Business WhatsApp chat (Synced Device)"
                                      type="button"
                                    >
                                      <Smartphone size={11} /> Rep WA
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    aria-label={`Open WhatsApp chat for ${lead.customerName}`}
                                    className="sales-secondary-button compact"
                                    onClick={() => openLeadChat(lead.id)}
                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                    title="Open WhatsApp chat"
                                    type="button"
                                  >
                                    <MessageCircle size={11} /> WhatsApp
                                  </button>
                                )
                              ) : null}

                              <button
                                aria-label={`Open details for ${lead.customerName}`}
                                className="sales-secondary-button compact"
                                onClick={() => setSelectedLeadId(lead.id)}
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                title="Open full lead details and notes"
                                type="button"
                              >
                                <ExternalLink size={11} /> Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {leadPageCount > 1 ? (
            <nav aria-label="CRM lead pages" className="sales-crm-pagination">
              <span>
                Showing {(leadPage - 1) * CRM_LEADS_PER_PAGE + 1}-{Math.min(leadPage * CRM_LEADS_PER_PAGE, listLeads.length)} of {listLeads.length} filtered leads
              </span>
              <div className="sales-crm-pagination-actions">
                <button className="sales-secondary-button compact" disabled={leadPage === 1} onClick={() => setLeadPage((page) => Math.max(1, page - 1))} type="button">Previous</button>
                <strong>Page {leadPage} of {leadPageCount}</strong>
                <button className="sales-secondary-button compact" disabled={leadPage === leadPageCount} onClick={() => setLeadPage((page) => Math.min(leadPageCount, page + 1))} type="button">Next</button>
              </div>
            </nav>
          ) : null}
        </section>
      ) : null}

      {activeTab === "contacts" || activeTab === "lead-import" ? (
        <section className="sales-tool-workspace" style={{ padding: "16px 20px", width: "100%", maxWidth: "var(--crm-content-max)", margin: "0 auto" }}>
          <ContactsHub
            view={activeTab === "lead-import" ? "lead-import" : "contacts"}
            canManageContacts={canManageContacts}
            canImportData={canImportLeads}
            personalWhatsAppOnly={isCloser}
            tenantId={salesOperations.tenantId}
            onOpenMultiChannelChat={openSalesConversation}
            onOpenPluginsHub={() => navigateSales("plugins")}
            onOpenBulkMarketing={() => navigateSales("whatsapp-marketing")}
            onRefreshDashboard={refresh}
          />
        </section>
      ) : null}

      {activeTab === "calls" || activeTab === "campaigns" ? (
        <CallReportsPanel
          agents={isWorkspaceAdmin ? snapshot.visibleAgents.filter((a) => a.status === "ACTIVE") : reportingAgents}
          isAdmin={isWorkspaceAdmin}
          selectedAgentId={viewingAgentId}
          refreshSignal={telephonyRevision}
          onAgentChange={updateViewingAgent}
        />
      ) : null}

      {activeTab === "automations" || activeTab === "ai-beta" || activeTab === "developer" ? (
        <div className="sales-automation-workspace" style={{ display: "grid", gap: "20px", width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "16px 20px" }}>
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
                {activeTab === "developer" ? "Developer Integrations & API Access" : "AI Bot & Workflow Automations Hub"}
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

      {activeTab === "payments" ? (
        <section className="sales-tool-workspace sales-payments-workspace" style={{ padding: "16px 20px 28px", width: "100%", maxWidth: "none", margin: 0 }}>
          <UpiPaymentCollectionPanel
            embedded
            sessionRole={(isWorkspaceAdmin ? "ADMIN" : (effectiveWorkspaceRole as "SALES_AGENT" | "MANAGER")) as "SALES_AGENT" | "MANAGER" | "ADMIN" | "SUPER_ADMIN"}
            tenantId={salesOperations.tenantId}
          />
        </section>
      ) : null}

      {activeTab === "reports" ? (
        <section className="sales-tool-workspace" style={{ padding: "20px", width: "100%", maxWidth: "1280px", margin: "0 auto" }}>
          <AdvancedReportsPanel selectedAgentId={viewingAgentId === "all" ? null : viewingAgentId} selectedAgentName={viewingAgent?.displayName ?? null} />
        </section>
      ) : null}

      {activeTab === "roles" ? (
        <section className="sales-tool-workspace sales-team-users-workspace" style={{ padding: "16px 24px 28px", width: "100%", maxWidth: "none", margin: 0 }}>
          <RolePermissionsPanel canManageUsers={isWorkspaceAdmin} />
        </section>
      ) : null}

      {isWorkspaceAdmin && (activeTab === "profile" || activeTab === "custom-fields") ? (
        <section className="sales-tool-workspace sales-settings-workspace" style={{ padding: "16px 20px", width: "100%", maxWidth: "1350px", margin: "0 auto" }}>
          <CrmSettingsPanel
            key={activeTab}
            isAdmin={isWorkspaceAdmin}
            initialTab={activeTab === "custom-fields" ? "custom_fields" : undefined}
            profile={currentAgent ? {
              displayName: currentAgent.displayName,
              email: currentAgent.email,
              phone: currentAgent.phone,
              companyName: typeof currentAgentPermissions?.companyName === "string" ? currentAgentPermissions.companyName : null,
            } : undefined}
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
            gridTemplateRows: !isWhatsAppConnected && !isInstagramConnected ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
            gap: "10px",
            alignContent: "start",
          }}
        >
          {!isWhatsAppConnected && !isInstagramConnected ? (
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
              {navigationTabs.some((tab) => tab.id === "profile") ? (
                <button
                  type="button"
                  className="chat-connection-action"
                  onClick={() => {
                    setSettingsHubView("channels");
                    navigateSales("profile");
                  }}
                >
                  Connect channels
                </button>
              ) : null}
            </div>
          ) : null}
          <Suspense
            fallback={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: "#94a3b8" }}>
                Loading social inbox...
              </div>
            }
          >
            <ChatWorkspace
              audience="sales"
              listLabel="Sales social inbox"
              listTitle="WhatsApp and Instagram"
              mode="inbox"
              selectedAgentId={viewingAgentId}
              tenantId={salesOperations.tenantId}
            />
          </Suspense>
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
            whatsAppCloudStatus={salesOperations.whatsAppConnection?.status || "Needs setup"}
            instagramStatus={salesOperations.instagramConnection?.pluginEnabled ? "Plugin enabled" : "Needs setup"}
            onOpenMultiChannelChat={openSalesConversation}
            onNavigateTab={(tab: string) => navigateSales(tab)}
            onOpenPluginSettings={() => {
              setSettingsHubView("channels");
              navigateSales("profile");
            }}
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
            onTimelineNoteUpdated={handleTimelineNoteUpdated}
            onOpenChat={openLeadChat}
            onOpenManageLabels={() => setIsStatusLabelsModalOpen(true)}
            onSave={updateLeadBasics}
            onStage={updateLeadStage}
            onAssign={reassignLead}
            onWhatsApp={sendLeadWhatsApp}
            operating={operating}
            snapshot={snapshot}
            calls={dashboardCalls}
            assignableAgents={reportingAgents}
          />
        </SalesSideDrawer>
      ) : null}

      <StatusLabelsModal isOpen={isStatusLabelsModalOpen} onClose={() => setIsStatusLabelsModalOpen(false)} />
      <DuplicateLeadsModal isOpen={isDuplicateModalOpen} onClose={() => setIsDuplicateModalOpen(false)} onMerged={() => { router.refresh(); }} />
      {stageReasonRequest ? (
        <LeadStageReasonModal
          isOpen={Boolean(stageReasonRequest)}
          onClose={() => setStageReasonRequest(null)}
          onSubmit={handleConfirmStageReason}
          customerName={stageReasonRequest.customerName}
          customerContact={stageReasonRequest.customerContact}
          stageLabel={stageReasonRequest.stageLabel}
          submitting={isSubmittingStageReason}
        />
      ) : null}

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
    <div className={`sales-drawer-backdrop${fullScreen ? " is-fullscreen" : ""}`} role="presentation">
      <button aria-label="Close drawer backdrop" className="sales-drawer-backdrop-hit-area" onClick={onClose} type="button" />
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
        <span>Lead status</span>
        <select defaultValue="NEW" name="stage">
          {leadStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
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
      <div className="sales-import-template-row">
        <div>
          <strong>Need the right Excel columns?</strong>
          <span>Download the template, replace the example row, then upload it here.</span>
        </div>
        <a className="sales-secondary-button compact" download href="/templates/aicloser-lead-import-template.csv">
          <FileSpreadsheet size={14} /> Download Excel sample
        </a>
      </div>
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

function isLeadFromApi(source?: string | null): boolean {
  if (!source) return false;
  const s = String(source).toLowerCase().trim();
  return (
    s.includes("api") ||
    s.includes("webhook") ||
    s.includes("zapier") ||
    s.includes("pabbly") ||
    s.includes("make") ||
    s.includes("endpoint") ||
    s.includes("crm_import") ||
    s.includes("meta") ||
    s.includes("facebook") ||
    s.includes("lead_gen")
  );
}

function LeadKanbanColumn({
  canModifyLeads,
  calls,
  columnLabel,
  leads,
  onOpen,
  onOpenChat,
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
  onOpenChat?: (leadId: string, transportPreference?: "company" | "connected_user") => void;
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
      <header className="sales-kanban-column-header">
        <div className="sales-kanban-column-title">
          <span>{columnLabel || label(stage)}</span>
          <strong>{leads.length}</strong>
        </div>
        {totalValue > 0 ? (
          <small className="sales-kanban-column-value">{money(totalValue)}</small>
        ) : null}
      </header>
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        {leads.map((lead) => (
          <LeadCrmCard
            call={calls.get(lead.id)}
            canModifyLeads={canModifyLeads}
            key={lead.id}
            lead={lead}
            onOpen={onOpen}
            onOpenChat={onOpenChat}
            onQuickFollowUp={onQuickFollowUp}
            onQuickNote={onQuickNote}
            onStage={onStage}
          />
        ))}
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
  onOpenChat,
  onQuickFollowUp,
  onQuickNote,
  onStage,
}: {
  canModifyLeads: boolean;
  call?: SalesDashboardSnapshot["mobileCalls"][number];
  lead: SalesDashboardSnapshot["visibleLeads"][number];
  onOpen: (leadId: string) => void;
  onOpenChat?: (leadId: string, transportPreference?: "company" | "connected_user") => void;
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
      <div className="sales-crm-card-topbar">
        <div className="sales-crm-card-controls">
          <span aria-hidden="true" className="sales-crm-drag-handle" title="Drag anywhere on the card">
            <GripVertical size={13} />
          </span>
          <select
            aria-label={`Change ${lead.customerName} stage`}
            className="sales-crm-card-stage-select"
            disabled={!canModifyLeads}
            onChange={(event) => onStage(lead.id, event.target.value as SalesLeadStage)}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            value={lead.stage}
          >
            {leadStages.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}
          </select>
        </div>
        <div className="sales-crm-card-topbar-actions">
          {isCreatedToday ? (
            <span className="sales-crm-card-status-badge is-today">
              <Flame size={10} /> Today
            </span>
          ) : null}
          {isDueToday ? (
            <span className="sales-crm-card-status-badge is-due">
              <Clock size={10} /> Due
            </span>
          ) : null}
          <button
            aria-label={`Open full details for ${lead.customerName}`}
            className="sales-crm-card-expand-button"
            onClick={(event) => {
              event.stopPropagation();
              if (event.ctrlKey || event.metaKey) {
                window.open(`/leads?selected=${encodeURIComponent(lead.id)}`, "_blank");
              } else {
                onOpen(lead.id);
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            title="Open lead details (or Ctrl+Click for new tab)"
            type="button"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>
      <button className="sales-crm-card-main" onClick={() => onOpen(lead.id)} type="button">
        <div className="sales-crm-card-head">
          <div className="sales-crm-card-identity">
            <div className="sales-crm-card-identity-title">
              <strong>{lead.customerName}</strong>
              <LeadSourceBadge iconOnly source={lead.source} />
              {isLeadFromApi(lead.source) ? (
                <span style={{ display: "inline-flex", gap: "4px", alignItems: "center", marginLeft: "auto" }}>
                  <span title="Company WhatsApp available" style={{ color: "#059669", display: "inline-flex", alignItems: "center" }}><Building2 size={11} /></span>
                  <span title="Personal WhatsApp available" style={{ color: "#0284c7", display: "inline-flex", alignItems: "center" }}><Smartphone size={11} /></span>
                </span>
              ) : null}
            </div>
            <span>{lead.customerPhone || lead.customerEmail || "No contact details"}</span>
          </div>
        </div>
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
          className="sales-crm-card-note-form"
          onPointerDown={(event) => event.stopPropagation()}
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
          style={{ display: "grid", gap: "6px", marginTop: "6px" }}
        >
          <textarea aria-label={`Quick note for ${lead.customerName}`} onChange={(event) => setQuickNote(event.target.value)} placeholder="Add a note..." rows={2} value={quickNote} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button className="sales-secondary-button compact" onClick={() => setQuickAction(null)} type="button">Cancel</button>
            <button className="sales-primary-button compact" disabled={quickSaving || !quickNote.trim()} type="submit">{quickSaving ? "Saving..." : "Save note"}</button>
          </div>
        </form>
      ) : null}
      {quickAction === "follow-up" ? (
        <form
          className="sales-crm-card-followup-form"
          onPointerDown={(event) => event.stopPropagation()}
          onSubmit={async (event) => {
            event.preventDefault();
            if (!quickFollowUp) return;
            setQuickSaving(true);
            const ok = await onQuickFollowUp(lead.id, new Date(quickFollowUp).toISOString());
            setQuickSaving(false);
            if (ok) setQuickAction(null);
          }}
          style={{ display: "grid", gap: "6px", marginTop: "6px" }}
        >
          <LeadFollowUpPicker
            initialOpen={true}
            labelText="Next follow-up"
            onChange={setQuickFollowUp}
            value={quickFollowUp}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button className="sales-secondary-button compact" onClick={() => setQuickAction(null)} type="button">Cancel</button>
            <button className="sales-primary-button compact" disabled={quickSaving || !quickFollowUp} type="submit">{quickSaving ? "Saving..." : "Save follow-up"}</button>
          </div>
        </form>
      ) : null}
      {call?.recordingStatus === "UPLOADED" ? <div onPointerDown={(event) => event.stopPropagation()}><CallRecordingPlayer callId={call.id} expectedDurationSeconds={call.durationSeconds} labelText={`${lead.customerName} recording`} /></div> : null}
      {lead.customerPhone ? (
        <div style={{ display: "flex", gap: "6px", width: "100%", alignItems: "center" }} onPointerDown={(event) => event.stopPropagation()}>
          <a
            aria-label={`Call ${lead.customerName}`}
            className="sales-secondary-button compact"
            href={`tel:${lead.customerPhone.replace(/[^\d+]/g, "")}`}
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              padding: "5px 9px",
              color: "#10b981",
              borderColor: "rgba(16, 185, 129, 0.4)",
              background: "rgba(16, 185, 129, 0.08)",
              textDecoration: "none",
              fontWeight: 600,
            }}
            title={`Call ${lead.customerName} (${lead.customerPhone})`}
          >
            <PhoneCall size={12} /> Call
          </a>
          {isLeadFromApi(lead.source) ? (
            <div style={{ display: "flex", gap: "4px", flex: 1 }}>
              <button
                className="sales-secondary-button compact"
                onClick={() => (onOpenChat ? onOpenChat(lead.id, "company") : onOpen(lead.id))}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "3px", fontSize: "11px", borderColor: "rgba(16, 185, 129, 0.4)", color: "#059669" }}
                title="Open CRM chat (Company WhatsApp)"
                type="button"
              >
                <Building2 size={11} /> Co. WA
              </button>
              <button
                className="sales-secondary-button compact"
                onClick={() => (onOpenChat ? onOpenChat(lead.id, "connected_user") : onOpen(lead.id))}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "3px", fontSize: "11px", borderColor: "rgba(2, 132, 199, 0.4)", color: "#0284c7" }}
                title="Open CRM chat (Closer Business WhatsApp - Synced Device)"
                type="button"
              >
                <Smartphone size={11} /> Rep WA
              </button>
            </div>
          ) : (
            <button
              className="sales-secondary-button compact"
              onClick={() => (onOpenChat ? onOpenChat(lead.id) : onOpen(lead.id))}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              type="button"
            >
              <MessageCircle size={12} /> WhatsApp
            </button>
          )}
        </div>
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
      : normalized.includes("sheet") || normalized.includes("spreadsheet") || normalized.includes("excel") || normalized.includes("csv") || normalized.includes("import")
        ? { key: "import", label: normalized.includes("sheet") || normalized.includes("spreadsheet") ? "Google Sheets" : "Import", Icon: FileSpreadsheet }
        : normalized.includes("google") || normalized.includes("ads")
          ? { key: "google", label: "Google Ads", Icon: Search }
          : normalized.includes("web") || normalized.includes("form")
            ? { key: "web", label: "Web form", Icon: Video }
            : normalized.includes("api") || normalized.includes("webhook")
              ? { key: "api", label: "API Lead", Icon: Webhook }
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
  assignableAgents,
  calls,
  lead,
  onNote,
  onQuickFollowUp,
  onQuickNote,
  onTimelineNoteUpdated,
  onOpenChat,
  onOpenManageLabels,
  onSave,
  onStage,
  onAssign,
  onWhatsApp,
  operating,
  snapshot,
}: {
  assignableAgents: SalesDashboardSnapshot["visibleAgents"];
  calls: SalesDashboardSnapshot["mobileCalls"];
  lead: SalesDashboardSnapshot["visibleLeads"][number];
  onNote: (event: FormEvent<HTMLFormElement>, leadId: string) => void;
  onQuickFollowUp: (leadId: string, followUpAt: string) => Promise<boolean>;
  onQuickNote: (leadId: string, body: string) => Promise<boolean>;
  onTimelineNoteUpdated?: (leadId: string, noteText: string) => void;
  onOpenChat: (leadId: string, transportPreference?: "company" | "connected_user") => void;
  onOpenManageLabels?: () => void;
  onSave: (event: FormEvent<HTMLFormElement>, leadId: string) => void;
  onStage: (leadId: string, stage: SalesLeadStage) => void;
  onAssign: (leadId: string, assignedAgentId: string) => Promise<boolean>;
  onWhatsApp: (event: FormEvent<HTMLFormElement>, leadId: string) => void;
  operating: SalesOperatingSnapshot | null;
  snapshot: SalesDashboardSnapshot;
}) {
  const leadTimeline = (operating?.timeline ?? []).filter((entry) => entry.leadId === lead.id);
  const leadCalls = calls.filter(
    (c) => c.assignmentId === lead.id || (lead.customerPhone && cleanPhone(c.phoneNumber) === cleanPhone(lead.customerPhone))
  );
  const [notesRevision, setNotesRevision] = useState(0);
  const [followUpDate, setFollowUpDate] = useState(() => toDateTimeLocal(lead.followUpAt).slice(0, 10));
  const [followUpTime, setFollowUpTime] = useState(() => toDateTimeLocal(lead.followUpAt).slice(11, 16));
  const [quickSaving, setQuickSaving] = useState(false);
  const [detailOrder, setDetailOrder] = useState<LeadDetailSectionKey[]>(defaultLeadDetailOrder);
  const [isArrangeOpen, setIsArrangeOpen] = useState(false);
  const arrangeControlRef = useRef<HTMLDivElement | null>(null);
  const leadSource = String(lead.source ?? "").toLowerCase();
  const isLinkedWhatsAppLead = leadSource.includes("qr_scanner") || leadSource.includes("whatsapp_personal") || leadSource.includes("whatsapp_business");
  const isCompanyWhatsAppLead = leadSource.includes("whatsapp") && !isLinkedWhatsAppLead;
  const isApiLead = isLeadFromApi(lead.source);

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
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: "6px" }}>
              <LeadSourceBadge source={lead.source} />
              {(isApiLead || isCompanyWhatsAppLead || isLinkedWhatsAppLead || lead.customerPhone) ? (
                <>
                  <span
                    className="sales-chip"
                    title="Company WhatsApp (Official Cloud API)"
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.12)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.3)" }}
                  >
                    <Building2 size={12} /> Company WhatsApp
                  </span>
                  <span
                    className="sales-chip"
                    title="Personal WhatsApp (Connected QR Scanner)"
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: "rgba(2, 132, 199, 0.12)", color: "#0284c7", border: "1px solid rgba(2, 132, 199, 0.3)" }}
                  >
                    <Smartphone size={12} /> Personal WhatsApp
                  </span>
                </>
              ) : null}
            </div>
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
            <a
              aria-label={`Call ${lead.customerName}`}
              className="sales-secondary-button compact"
              href={`tel:${lead.customerPhone.replace(/[^\d+]/g, "")}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                color: "#10b981",
                borderColor: "rgba(16, 185, 129, 0.4)",
                background: "rgba(16, 185, 129, 0.08)",
                textDecoration: "none",
                fontWeight: 600,
              }}
              title={`Call ${lead.customerName} (${lead.customerPhone})`}
            >
              <PhoneCall size={13} /> Call Customer
            </a>
          ) : null}
          {lead.customerPhone ? (
            isApiLead ? (
              <>
                <button
                  className="sales-secondary-button compact"
                  onClick={() => onOpenChat(lead.id, "company")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderColor: "rgba(16, 185, 129, 0.4)", color: "#059669" }}
                  title="Open chat via Company WhatsApp (Official API)"
                  type="button"
                >
                  <Building2 size={12} /> Company WA
                </button>
                <button
                  className="sales-secondary-button compact"
                  onClick={() => onOpenChat(lead.id, "connected_user")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderColor: "rgba(2, 132, 199, 0.4)", color: "#0284c7" }}
                  title="Open chat via Closer Business WhatsApp (Synced Device)"
                  type="button"
                >
                  <Smartphone size={12} /> Closer Business WA
                </button>
              </>
            ) : (
              <button className="sales-primary-button compact" onClick={() => onOpenChat(lead.id)} type="button">
                <MessageSquare size={13} style={{ marginRight: "4px" }} /> Open Chat
              </button>
            )
          ) : null}
        </div>

        <div className="sales-next-action-block">
          <div className="sales-next-action-heading">
            <div>
              <strong>Next action</strong>
              <span>Keep the next touchpoint visible and actionable.</span>
            </div>
          </div>
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
          refreshTrigger={notesRevision}
          onNotesUpdated={(updatedNoteText?: string) => {
            setNotesRevision((v) => v + 1);
            if (updatedNoteText) {
              onTimelineNoteUpdated?.(lead.id, updatedNoteText);
            }
          }}
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
            {assignableAgents.filter((agent) => agent.status === "ACTIVE").map((agent) => (
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
        <button className="sales-primary-button" type="submit">Save lead details</button>
        </form>

        {/* 5. Direct WhatsApp Message Form */}
        {lead.customerPhone ? (
          <form className="sales-form-grid" onSubmit={(event) => onWhatsApp(event, lead.id)}>
          <PanelTitle icon={MessageCircle} title="Send WhatsApp Message" />
          <label htmlFor="lead-whatsapp-transport">Send from</label>
          <select defaultValue={isLinkedWhatsAppLead ? "connected_user" : "company"} id="lead-whatsapp-transport" name="transport">
            <option value="company">🏢 Company WhatsApp (Official API)</option>
            <option value="connected_user">📱 Closer Business WhatsApp (Synced Device)</option>
          </select>
          <textarea name="message" placeholder="Message customer through shared WhatsApp inbox" required />
          <div className="sales-button-row">
            <button className="sales-primary-button" type="submit">Send WhatsApp</button>
            <button className="sales-secondary-button" onClick={() => onOpenChat(lead.id)} type="button">Open full chat</button>
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

function AdminTeamReportingPanel({
  agents,
  calls,
  leads,
}: {
  agents: SalesDashboardSnapshot["visibleAgents"];
  calls: SalesDashboardSnapshot["mobileCalls"];
  leads: SalesDashboardSnapshot["visibleLeads"];
}) {
  const rows = agents.map((agent) => {
    const assignedLeads = leads.filter((lead) => lead.assignedAgentId === agent.id);
    const agentCalls = calls.filter((call) => call.agentId === agent.id);
    const connectedCalls = agentCalls.filter((call) => call.durationSeconds > 0 || call.status === "COMPLETED" || call.status === "CONNECTED");
    return {
      agent,
      activeLeads: assignedLeads.filter((lead) => !["CLOSED_WON", "CLOSED_LOST", "CLOSED", "PAID"].includes(lead.stage)).length,
      callbacks: assignedLeads.filter((lead) => Boolean(lead.followUpAt)).length,
      calls: agentCalls.length,
      connected: connectedCalls.length,
      recordings: agentCalls.filter((call) => call.recordingStatus === "UPLOADED").length,
    };
  });

  return (
    <section aria-label="Team performance reporting" className="sales-goal-card" style={{ background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, #cbd5e1)", borderRadius: "18px", padding: "20px 24px", boxShadow: "var(--shadow-card, 0 8px 24px rgba(15, 23, 42, 0.05))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>Team performance &amp; ownership</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>Admin reporting view. Admin accounts are excluded; each row belongs to a sales or manager user.</p>
        </div>
        <span className="sales-chip neutral">{rows.length} reporting users</span>
      </div>
      {rows.length ? (
        <div style={{ overflowX: "auto", border: "1px solid var(--closer-line, #cbd5e1)", borderRadius: "12px" }}>
          <table className="crm-data-table" style={{ width: "100%", minWidth: "760px", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr>
                <th style={{ padding: "11px 14px" }}>Sales user</th>
                <th style={{ padding: "11px 14px" }}>Active leads</th>
                <th style={{ padding: "11px 14px" }}>Calls</th>
                <th style={{ padding: "11px 14px" }}>Connected</th>
                <th style={{ padding: "11px 14px" }}>Callbacks</th>
                <th style={{ padding: "11px 14px" }}>Recordings ready</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agent.id} style={{ borderTop: "1px solid var(--closer-line, #cbd5e1)" }}>
                  <td style={{ padding: "11px 14px" }}><strong>{row.agent.displayName}</strong><br /><small>{row.agent.email}</small></td>
                  <td style={{ padding: "11px 14px" }}>{row.activeLeads}</td>
                  <td style={{ padding: "11px 14px" }}>{row.calls}</td>
                  <td style={{ padding: "11px 14px" }}>{row.connected}</td>
                  <td style={{ padding: "11px 14px" }}>{row.callbacks}</td>
                  <td style={{ padding: "11px 14px" }}>{row.recordings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted-copy">No active sales users are available for reporting.</p>}
    </section>
  );
}

function DeviceHealthPanel({
  devices,
  diagnostics,
}: {
  devices: SalesDashboardSnapshot["mobileDevices"];
  diagnostics: SalesDashboardSnapshot["mobileDiagnostics"];
}) {
  const safeDevices = devices ?? [];
  const recentDiagnostics = (diagnostics ?? []).slice(0, 30);
  return (
    <section aria-label="Mobile device health and recording diagnostics" className="sales-goal-card" style={{ background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, #cbd5e1)", borderRadius: "18px", padding: "20px 24px", boxShadow: "var(--shadow-card, 0 8px 24px rgba(15, 23, 42, 0.05))", marginTop: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>Mobile device health</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>Every signed-in phone reports its model, dialer, recording route and failure points. Phone numbers and audio are not stored here.</p>
        </div>
        <span className="sales-chip neutral">{safeDevices.length} registered device{safeDevices.length === 1 ? "" : "s"}</span>
      </div>
      {safeDevices.length ? (
        <div style={{ overflowX: "auto", border: "1px solid var(--closer-line, #cbd5e1)", borderRadius: "12px" }}>
          <table className="crm-data-table" style={{ width: "100%", minWidth: "920px", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr>
                <th style={{ padding: "11px 14px" }}>Sales user</th>
                <th style={{ padding: "11px 14px" }}>Device</th>
                <th style={{ padding: "11px 14px" }}>Android / app</th>
                <th style={{ padding: "11px 14px" }}>Access health</th>
                <th style={{ padding: "11px 14px" }}>Recording capability</th>
                <th style={{ padding: "11px 14px" }}>Last seen</th>
              </tr>
            </thead>
            <tbody>
            {safeDevices.map((device) => {
                const latest = recentDiagnostics.find((item) => item.deviceId === device.deviceId);
                const owner = latest?.agentName ?? "Assigned sales user";
                const accessOk = latest ? latest.permissionCallLog && latest.permissionMicrophone : device.recordingEnabled;
                return (
                  <tr key={device.id} style={{ borderTop: "1px solid var(--closer-line, #cbd5e1)" }}>
                    <td style={{ padding: "11px 14px" }}><strong>{owner}</strong><small style={{ display: "block", color: "var(--closer-muted, #64748b)" }}>{device.simLabel || "SIM not reported"}</small></td>
                    <td style={{ padding: "11px 14px" }}><strong>{[device.manufacturer, device.model].filter(Boolean).join(" ") || device.deviceName}</strong><small style={{ display: "block", color: "var(--closer-muted, #64748b)" }}>{device.deviceName}</small></td>
                    <td style={{ padding: "11px 14px" }}><strong>{latest?.appVersion || "—"}</strong><small style={{ display: "block", color: "var(--closer-muted, #64748b)" }}>{latest?.androidVersion ? `Android ${latest.androidVersion}${latest.androidApi ? ` / API ${latest.androidApi}` : ""}` : "No snapshot yet"}<br />{latest?.defaultDialer || "Dialer not reported"}</small></td>
                    <td style={{ padding: "11px 14px" }}><span className={`sales-chip ${accessOk ? "success" : "danger"}`}>{accessOk ? "Core access OK" : "Action needed"}</span><small style={{ display: "block", color: "var(--closer-muted, #64748b)" }}>{latest ? `${latest.sharedAudioAccess ? "Storage" : "Storage off"} · ${latest.miuiRecordingFolderPresent ? "MIUI folder" : latest.accessibilityShareEnabled ? "Share route" : "No audio route"}` : "Waiting for diagnostics"}</small></td>
                    <td style={{ padding: "11px 14px" }}><span className={`sales-chip ${device.recordingEnabled ? "success" : "danger"}`}>{latest?.recordingCapability || device.recordingCapability}</span></td>
                    <td style={{ padding: "11px 14px" }}>{formatDateTime(device.lastSeenAt)}<small style={{ display: "block", color: device.isActive ? "#059669" : "var(--closer-muted, #64748b)" }}>{device.isActive ? "Active" : "Inactive"}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="muted-copy">No mobile devices have reported capability data yet.</p>}
      <div style={{ marginTop: "18px" }}>
        <strong style={{ display: "block", marginBottom: "8px", fontSize: "13px" }}>Recent diagnostics</strong>
        {recentDiagnostics.length ? (
          <div style={{ display: "grid", gap: "6px" }}>
            {recentDiagnostics.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", padding: "8px 10px", borderRadius: "8px", background: "var(--closer-soft, #f8fafc)", fontSize: "12px" }}>
                <span><strong>{item.agentName}</strong> · {item.deviceModel || "Unknown device"} · {item.kind.replaceAll("_", " ")}</span>
                <span style={{ color: item.status.includes("FAIL") || item.kind.includes("MISSING") ? "#dc2626" : "var(--closer-muted, #64748b)" }}>{[item.stage, item.route, item.errorCode].filter(Boolean).join(" · ") || "snapshot"} · {formatDateTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : <p className="muted-copy">No diagnostic events received yet.</p>}
      </div>
    </section>
  );
}

type CallReportRow = {
  id: string;
  agentId: string;
  agentName: string;
  customerName: string;
  phoneNumber: string;
  direction: string;
  status: string;
  durationSeconds: number;
  recordingStatus: string;
  recordingError: string;
  outcome: string;
  note: string;
  startedAt: string;
  endedAt: string | null;
  deviceModel?: string;
  deviceManufacturer?: string;
  recordingCapability?: string;
};

type CallReportTotals = {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  talkTimeSeconds: number;
  uploadedRecordings: number;
};

function CallReportsPanel({
  agents,
  isAdmin,
  selectedAgentId,
  refreshSignal,
  onAgentChange,
}: {
  agents: SalesDashboardSnapshot["visibleAgents"];
  isAdmin: boolean;
  selectedAgentId: string;
  refreshSignal: number;
  onAgentChange: (agentId: string) => void;
}) {
  const [totals, setTotals] = useState<CallReportTotals>({
    totalCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    missedCalls: 0,
    talkTimeSeconds: 0,
    uploadedRecordings: 0,
  });
  const [calls, setCalls] = useState<CallReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"nested" | "flat">("nested");
  const [activityTab, setActivityTab] = useState<"ALL" | "INBOUND" | "OUTBOUND" | "MISSED">("ALL");
  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCalls = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return calls.filter((call) => {
      const matchesTab =
        activityTab === "ALL" ||
        (activityTab === "MISSED" ? call.status === "MISSED" : call.direction === activityTab);
      if (!matchesTab) return false;
      if (!query) return true;
      return (
        (call.customerName || "").toLowerCase().includes(query) ||
        (call.phoneNumber || "").includes(query) ||
        (call.agentName || "").toLowerCase().includes(query)
      );
    });
  }, [calls, activityTab, searchQuery]);

  const contactGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        customerName: string;
        phoneNumber: string;
        totalCalls: number;
        inboundCount: number;
        outboundCount: number;
        missedCount: number;
        totalDurationSeconds: number;
        latestCallAt: string;
        agents: Set<string>;
        uploadedRecordingsCount: number;
        calls: CallReportRow[];
      }
    >();

    for (const call of filteredCalls) {
      const cleaned = (call.phoneNumber || "").replace(/[^\d]/g, "");
      const normalizedKey = cleaned.length >= 10 ? cleaned.slice(-10) : (cleaned || call.phoneNumber || call.customerName);
      const groupKey = normalizedKey || call.id;

      let group = map.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          customerName: call.customerName || "Unknown Contact",
          phoneNumber: call.phoneNumber || "No number",
          totalCalls: 0,
          inboundCount: 0,
          outboundCount: 0,
          missedCount: 0,
          totalDurationSeconds: 0,
          latestCallAt: call.startedAt,
          agents: new Set<string>(),
          uploadedRecordingsCount: 0,
          calls: [],
        };
        map.set(groupKey, group);
      }

      group.totalCalls += 1;
      if (call.direction === "INBOUND") group.inboundCount += 1;
      if (call.direction === "OUTBOUND") group.outboundCount += 1;
      if (call.status === "MISSED") group.missedCount += 1;
      group.totalDurationSeconds += call.durationSeconds ?? 0;
      if (new Date(call.startedAt).getTime() >= new Date(group.latestCallAt).getTime()) {
        group.latestCallAt = call.startedAt;
        if (call.customerName && call.customerName.trim() && call.customerName !== call.phoneNumber) {
          group.customerName = call.customerName;
        }
      }
      if (call.agentName) group.agents.add(call.agentName);
      if (call.recordingStatus === "UPLOADED") group.uploadedRecordingsCount += 1;
      group.calls.push(call);
    }

    return Array.from(map.values())
      .map((g) => ({
        ...g,
        agentsList: Array.from(g.agents),
        calls: g.calls.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
      }))
      .sort((a, b) => new Date(b.latestCallAt).getTime() - new Date(a.latestCallAt).getTime());
  }, [filteredCalls]);

  const filteredFlatCalls = filteredCalls;

  const activityTabs = [
    { key: "ALL" as const, label: "All", count: totals.totalCalls },
    { key: "INBOUND" as const, label: "Inbound", count: totals.inboundCalls },
    { key: "OUTBOUND" as const, label: "Outbound", count: totals.outboundCalls },
    { key: "MISSED" as const, label: "Missed", count: totals.missedCalls },
  ];

  async function loadReports(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const query = selectedAgentId !== "all" ? `?agentId=${encodeURIComponent(selectedAgentId)}` : "";
      const response = await fetch(`/api/sales/call-reports${query}`, { cache: "no-store", signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Call reports are temporarily unavailable.");
      setTotals(payload.totals ?? {});
      setCalls(Array.isArray(payload.calls) ? payload.calls : []);
      setLastUpdated(new Date().toISOString());
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Call reports are temporarily unavailable.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadReports(controller.signal);
    return () => {
      controller.abort();
    };
  }, [selectedAgentId, refreshSignal]);

  const cards = [
    { label: "Total calls", value: totals.totalCalls, tone: "var(--closer-ink, #0f172a)" },
    { label: "Incoming calls", value: totals.inboundCalls, tone: "#0284c7" },
    { label: "Outgoing calls", value: totals.outboundCalls, tone: "var(--closer-orange, #ff6b2f)" },
    { label: "Missed calls", value: totals.missedCalls, tone: "#dc2626" },
    { label: "Talk time", value: formatTalkTime(totals.talkTimeSeconds), tone: "#059669" },
    { label: "Recordings", value: totals.uploadedRecordings, tone: "#7c3aed" },
  ];

  return (
    <section aria-label="Call reports and recordings" style={{ display: "grid", gap: "18px", width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px", padding: "18px 20px", borderRadius: "14px", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))", background: "var(--closer-surface, #ffffff)" }}>
        <div>
          <span style={{ display: "block", color: "var(--closer-orange, #ff6b2f)", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Live telephony reporting</span>
          <h2 style={{ margin: "5px 0 4px", fontSize: "22px", color: "var(--closer-ink, #0f172a)" }}>Calls &amp; recordings</h2>
          <p style={{ margin: 0, color: "var(--closer-muted, #64748b)", fontSize: "13px" }}>Counts and recordings are read from the connected mobile call records. Live events update this view; a 15-second fallback sync runs only if the live stream is unavailable.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {isAdmin ? (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
              User
              <select value={selectedAgentId} onChange={(event) => onAgentChange(event.target.value)} style={{ minWidth: "180px", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.35))", background: "var(--closer-surface, #ffffff)", color: "var(--closer-ink, #0f172a)" }}>
                <option value="all">All reporting users</option>
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" onClick={() => void loadReports()} disabled={loading} className="sales-secondary-button compact">{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>

      {error ? <div role="alert" style={{ padding: "14px 16px", borderRadius: "10px", color: "#b91c1c", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.22)" }}>{error} <button type="button" onClick={() => void loadReports()} style={{ marginLeft: "8px", cursor: "pointer" }}>Retry</button></div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
        {cards.map((card) => (
          <div key={card.label} style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))", background: "var(--closer-surface, #ffffff)" }}>
            <span style={{ display: "block", fontSize: "12px", color: "var(--closer-muted, #64748b)", marginBottom: "8px" }}>{card.label}</span>
            <strong style={{ fontSize: "24px", color: card.tone }}>{loading ? "—" : card.value}</strong>
          </div>
        ))}
      </div>

      <section aria-label="Call goal and recording progress" style={{ padding: "18px 20px", borderRadius: "14px", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))", background: "var(--closer-surface, #ffffff)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--closer-ink, #0f172a)" }}>Call goal &amp; recording progress</h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>A live view of calls, talk time, missed-call follow-up, and uploaded recordings.</p>
          </div>
          <span className="sales-chip neutral">Mobile call feed</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
          {[
            { label: "Calls logged", value: loading ? "—" : totals.totalCalls, detail: "All live call records", tone: "var(--closer-orange, #ff6b2f)" },
            { label: "Talk time", value: loading ? "—" : formatTalkTime(totals.talkTimeSeconds), detail: "Connected call duration", tone: "#059669" },
            { label: "Missed follow-up", value: loading ? "—" : totals.missedCalls, detail: "Review them in the Missed tab", tone: "#dc2626" },
            { label: "Recordings ready", value: loading ? "—" : `${totals.uploadedRecordings} / ${totals.totalCalls}`, detail: totals.totalCalls ? `${Math.round((totals.uploadedRecordings / totals.totalCalls) * 100)}% of calls uploaded` : "No call records yet", tone: "#7c3aed" },
          ].map((item) => (
            <div key={item.label} style={{ padding: "13px 14px", borderRadius: "10px", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.18))", background: "var(--closer-soft, rgba(148, 163, 184, 0.06))" }}>
              <span style={{ display: "block", fontSize: "11px", color: "var(--closer-muted, #64748b)", marginBottom: "6px" }}>{item.label}</span>
              <strong style={{ display: "block", fontSize: "21px", color: item.tone }}>{item.value}</strong>
              <span style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--closer-muted, #64748b)" }}>{item.detail}</span>
            </div>
          ))}
        </div>
        {!loading && totals.totalCalls === 0 ? <p className="muted-copy" style={{ margin: "14px 0 0" }}>No live call data yet. This tracker fills automatically after a mobile call or missed call is synced; no sample data is inserted.</p> : null}
      </section>

      <div style={{ border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))", borderRadius: "14px", background: "var(--closer-surface, #ffffff)", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.18))", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--closer-ink, #0f172a)", fontWeight: 700 }}>
              Recent call activity
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
              {viewMode === "nested"
                ? "Lead contact history with nested call recordings."
                : "Flat stream of all individual call attempts."}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Call direction filter"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              padding: "3px",
              borderRadius: "9px",
              background: "var(--closer-soft, rgba(148, 163, 184, 0.12))",
              border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
              flexWrap: "wrap",
            }}
          >
            {activityTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activityTab === tab.key}
                onClick={() => setActivityTab(tab.key)}
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  background: activityTab === tab.key ? "var(--closer-surface, #ffffff)" : "transparent",
                  color: activityTab === tab.key
                    ? tab.key === "MISSED" ? "#dc2626" : "var(--closer-orange, #ff6b2f)"
                    : "var(--closer-muted, #64748b)",
                  boxShadow: activityTab === tab.key ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Search Filter */}
            <div style={{ position: "relative", minWidth: "170px" }}>
              <input
                type="text"
                placeholder="Search contact / phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  fontSize: "12px",
                  padding: "6px 10px 6px 28px",
                  borderRadius: "8px",
                  border: "1px solid var(--closer-line, #cbd5e1)",
                  background: "var(--closer-soft, rgba(148, 163, 184, 0.08))",
                  color: "var(--closer-ink, #0f172a)",
                  outline: "none",
                }}
              />
              <Search size={13} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "var(--closer-muted, #94a3b8)" }} />
            </div>

            {/* Toggle: Grouped by Contact vs Flat Stream */}
            <div style={{ display: "inline-flex", padding: "3px", borderRadius: "8px", background: "var(--closer-soft, rgba(148, 163, 184, 0.12))", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))" }}>
              <button
                type="button"
                onClick={() => setViewMode("nested")}
                style={{
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: viewMode === "nested" ? "var(--closer-surface, #ffffff)" : "transparent",
                  color: viewMode === "nested" ? "var(--closer-orange, #ff6b2f)" : "var(--closer-muted, #64748b)",
                  boxShadow: viewMode === "nested" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Users size={13} />
                Grouped by Contact ({contactGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("flat")}
                style={{
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: viewMode === "flat" ? "var(--closer-surface, #ffffff)" : "transparent",
                  color: viewMode === "flat" ? "var(--closer-orange, #ff6b2f)" : "var(--closer-muted, #64748b)",
                  boxShadow: viewMode === "flat" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <LayoutList size={13} />
                All Calls Stream ({calls.length})
              </button>
            </div>

            {lastUpdated ? <span style={{ fontSize: "11px", color: "var(--closer-muted, #64748b)", whiteSpace: "nowrap" }}>Updated {formatDateTime(lastUpdated)}</span> : null}
          </div>
        </div>

        {loading ? (
          <p className="muted-copy" style={{ padding: "24px" }}>Loading live call activity…</p>
        ) : calls.length === 0 ? (
          <p className="muted-copy" style={{ padding: "24px" }}>No call activity is available for this selection yet.</p>
        ) : viewMode === "nested" ? (
          /* NESTED / GROUPED TABLE */
          <div style={{ overflowX: "auto" }}>
            <table className="crm-data-table" style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ padding: "11px 10px", width: "36px" }}></th>
                  <th style={{ padding: "11px 14px" }}>Contact / Lead</th>
                  <th style={{ padding: "11px 14px" }}>Handled By</th>
                  <th style={{ padding: "11px 14px" }}>Call Activity</th>
                  <th style={{ padding: "11px 14px" }}>Total Talk Time</th>
                  <th style={{ padding: "11px 14px" }}>Last Contacted</th>
                  <th style={{ padding: "11px 14px" }}>Recordings</th>
                  <th style={{ padding: "11px 14px", textAlign: "right" }}>History</th>
                </tr>
              </thead>
              <tbody>
                {contactGroups.map((group) => {
                  const isExpanded = !!expandedContacts[group.key];
                  return (
                    <Fragment key={group.key}>
                      <tr
                        onClick={() => setExpandedContacts((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                        style={{
                          borderTop: "1px solid var(--closer-line, rgba(148, 163, 184, 0.18))",
                          cursor: "pointer",
                          background: isExpanded ? "var(--closer-soft, rgba(148, 163, 184, 0.05))" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "12px 6px 12px 14px", textAlign: "center" }}>
                          <button
                            type="button"
                            aria-label={isExpanded ? "Collapse calls" : "Expand calls"}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "2px",
                              color: "var(--closer-muted, #64748b)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <strong style={{ fontSize: "14px", color: "var(--closer-ink, #0f172a)" }}>
                            {group.customerName || "Unknown Contact"}
                          </strong>
                          <small style={{ display: "block", color: "var(--closer-muted, #64748b)", fontSize: "12px" }}>
                            {group.phoneNumber}
                          </small>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {group.agentsList.map((ag) => (
                              <span
                                key={ag}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "var(--closer-soft, rgba(148, 163, 184, 0.12))",
                                  color: "var(--closer-ink, #1e293b)",
                                }}
                              >
                                {ag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: "rgba(56, 189, 248, 0.12)",
                                color: "#0284c7",
                              }}
                            >
                              {group.totalCalls} {group.totalCalls === 1 ? "call" : "calls"}
                            </span>
                            {group.outboundCount > 0 ? (
                              <span style={{ fontSize: "11px", color: "var(--closer-orange, #ff6b2f)" }}>
                                {group.outboundCount} ↗
                              </span>
                            ) : null}
                            {group.inboundCount > 0 ? (
                              <span style={{ fontSize: "11px", color: "#0284c7" }}>
                                {group.inboundCount} ↙
                              </span>
                            ) : null}
                            {group.missedCount > 0 ? (
                              <span style={{ fontSize: "11px", color: "#dc2626" }}>
                                {group.missedCount} missed
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <strong style={{ fontSize: "13px", color: group.totalDurationSeconds > 0 ? "#059669" : "var(--closer-muted, #64748b)" }}>
                            {formatTalkTime(group.totalDurationSeconds)}
                          </strong>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: "12px", color: "var(--closer-ink, #334155)" }}>
                          {formatDateTime(group.latestCallAt)}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {group.uploadedRecordingsCount > 0 ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: "rgba(124, 58, 237, 0.12)",
                                color: "#7c3aed",
                              }}
                            >
                              <Play size={10} fill="#7c3aed" /> {group.uploadedRecordingsCount} ready
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--closer-muted, #94a3b8)" }}>
                              No audio available
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedContacts((prev) => ({ ...prev, [group.key]: !prev[group.key] }));
                            }}
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid var(--closer-line, #cbd5e1)",
                              background: isExpanded ? "var(--closer-orange, #ff6b2f)" : "var(--closer-surface, #ffffff)",
                              color: isExpanded ? "#ffffff" : "var(--closer-ink, #0f172a)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {isExpanded ? "Hide" : "Timeline"} ({group.totalCalls})
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                      </tr>

                      {/* Nested Drawer */}
                      {isExpanded ? (
                        <tr>
                          <td colSpan={8} style={{ padding: "0 0 16px", background: "var(--closer-soft, rgba(148, 163, 184, 0.04))" }}>
                            <div
                              style={{
                                margin: "0 14px 8px 36px",
                                padding: "14px 16px",
                                borderRadius: "10px",
                                border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
                                background: "var(--closer-surface, #ffffff)",
                                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.14))", paddingBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--closer-ink, #0f172a)", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Clock3 size={14} color="var(--closer-orange, #ff6b2f)" />
                                  Call History with {group.customerName} ({group.phoneNumber}) — {group.totalCalls} attempts
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--closer-muted, #64748b)" }}>
                                  Total talk time: {formatTalkTime(group.totalDurationSeconds)}
                                </span>
                              </div>

                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                                <thead>
                                  <tr style={{ color: "var(--closer-muted, #64748b)", borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.16))" }}>
                                    <th style={{ padding: "8px 10px" }}># Attempt</th>
                                    <th style={{ padding: "8px 10px" }}>Direction</th>
                                    <th style={{ padding: "8px 10px" }}>Agent</th>
                                    <th style={{ padding: "8px 10px" }}>Status / Dispo</th>
                                    <th style={{ padding: "8px 10px" }}>Talk Time</th>
                                    <th style={{ padding: "8px 10px" }}>When</th>
                                    <th style={{ padding: "8px 10px" }}>Recording</th>
                                    <th style={{ padding: "8px 10px" }}>Note</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.calls.map((c, idx) => {
                                    const unavailable = getRecordingUnavailableDetails(c);
                                    const attemptNum = group.calls.length - idx;
                                    return (
                                      <tr key={c.id} style={{ borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.1))" }}>
                                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--closer-ink, #334155)" }}>
                                          Call #{attemptNum} {idx === 0 ? <span style={{ fontSize: "10px", color: "var(--closer-orange, #ff6b2f)", fontWeight: 700 }}>(Latest)</span> : null}
                                        </td>
                                        <td style={{ padding: "8px 10px" }}>
                                          <span
                                            style={{
                                              fontSize: "11px",
                                              fontWeight: 700,
                                              padding: "1px 6px",
                                              borderRadius: "4px",
                                              background: c.direction === "INBOUND" ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 107, 47, 0.12)",
                                              color: c.direction === "INBOUND" ? "#0284c7" : "var(--closer-orange, #ff6b2f)",
                                            }}
                                          >
                                            {c.direction === "INBOUND" ? "↙ Inbound" : "↗ Outbound"}
                                          </span>
                                        </td>
                                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--closer-ink, #0f172a)" }}>
                                          {c.agentName}
                                        </td>
                                        <td style={{ padding: "8px 10px" }}>
                                          <div>
                                            <span>{label(c.status)}</span>
                                            {c.outcome ? (
                                              <span style={{ display: "block", fontSize: "11px", color: "#0284c7", fontWeight: 600 }}>
                                                {label(c.outcome)}
                                              </span>
                                            ) : null}
                                          </div>
                                        </td>
                                        <td style={{ padding: "8px 10px", fontWeight: 600, color: c.durationSeconds > 0 ? "#059669" : "var(--closer-muted, #64748b)" }}>
                                          {formatTalkTime(c.durationSeconds)}
                                        </td>
                                        <td style={{ padding: "8px 10px", color: "var(--closer-ink, #334155)" }}>
                                          {formatDateTime(c.startedAt)}
                                        </td>
                                        <td style={{ padding: "8px 10px" }}>
                                          {c.recordingStatus === "UPLOADED" ? (
                                            <div>
                                              <CallRecordingPlayer callId={c.id} expectedDurationSeconds={c.durationSeconds} labelText={`${group.customerName} call recording`} />
                                              <small style={{ display: "block", marginTop: "3px", color: "var(--closer-muted, #64748b)", fontSize: "10px" }}>
                                                Duration: {formatTalkTime(c.durationSeconds)}
                                              </small>
                                            </div>
                                          ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                              <span className={`sales-chip ${unavailable.tone === "danger" ? "danger" : "neutral"}`} style={{ fontSize: "11px", width: "fit-content" }}>
                                                {unavailable.badge}
                                              </span>
                                              <span style={{ fontSize: "11px", color: "var(--closer-muted, #64748b)", lineHeight: "1.25" }}>
                                                {unavailable.reason}
                                              </span>
                                            </div>
                                          )}
                                        </td>
                                        <td style={{ padding: "8px 10px", color: "var(--closer-muted, #64748b)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {c.note || "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* FLAT STREAM TABLE */
          <div style={{ overflowX: "auto" }}>
            <table className="crm-data-table" style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr><th style={{ padding: "11px 14px" }}>User</th><th style={{ padding: "11px 14px" }}>Contact</th><th style={{ padding: "11px 14px" }}>Direction</th><th style={{ padding: "11px 14px" }}>Status</th><th style={{ padding: "11px 14px" }}>Talk time</th><th style={{ padding: "11px 14px" }}>When</th><th style={{ padding: "11px 14px" }}>Recording</th></tr></thead>
              <tbody>{filteredFlatCalls.map((call) => {
                const unavailable = getRecordingUnavailableDetails(call);
                return (
                  <tr key={call.id} style={{ borderTop: "1px solid var(--closer-line, rgba(148, 163, 184, 0.18))" }}>
                    <td style={{ padding: "11px 14px" }}><strong>{call.agentName}</strong></td>
                    <td style={{ padding: "11px 14px" }}><strong>{call.customerName}</strong><small style={{ display: "block", color: "var(--closer-muted, #64748b)" }}>{call.phoneNumber}</small></td>
                    <td style={{ padding: "11px 14px" }}>{label(call.direction)}</td>
                    <td style={{ padding: "11px 14px" }}>{label(call.status)}{call.outcome ? <small style={{ display: "block", color: "var(--closer-muted, #64748b)" }}>{label(call.outcome)}</small> : null}</td>
                    <td style={{ padding: "11px 14px" }}>{formatTalkTime(call.durationSeconds)}</td>
                    <td style={{ padding: "11px 14px" }}>{formatDateTime(call.startedAt)}</td>
                    <td style={{ padding: "11px 14px" }}>
                      {call.recordingStatus === "UPLOADED" ? (
                        <div>
                          <CallRecordingPlayer callId={call.id} expectedDurationSeconds={call.durationSeconds} labelText={`${call.customerName} recording`} />
                          <small style={{ display: "block", marginTop: "5px", color: "var(--closer-muted, #64748b)", whiteSpace: "nowrap" }}>
                            Call time: {formatDateTime(call.startedAt)} · Call duration: {formatTalkTime(call.durationSeconds)}
                          </small>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span className={`sales-chip ${unavailable.tone === "danger" ? "danger" : "neutral"}`} style={{ width: "fit-content" }}>
                            {unavailable.badge}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--closer-muted, #64748b)", lineHeight: "1.25" }}>
                            {unavailable.reason}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="muted-copy">{text}</p>;
}
