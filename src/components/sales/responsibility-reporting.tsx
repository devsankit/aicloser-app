"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, ExternalLink, Flame, ListChecks, MessageSquare, PhoneCall, RefreshCw, Search, ShieldAlert, UserRound, Users, XCircle } from "lucide-react";

type ReportRow = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  source: string;
  stage: string;
  conversationId: string | null;
  owner: string;
  ownerAgentId: string;
  priority: string;
  lastContactedAt: string | null;
  lastActivityAt: string;
  followUpAt: string | null;
  nextAction: string;
  untouched: boolean;
  stale: boolean;
  paused: boolean;
  dueToday: boolean;
  overdue: boolean;
  missingFollowUp: boolean;
  app: {
    audience: string | null;
    agencyRegistered: boolean | null;
    freelancerRegistered: boolean | null;
    appInstalled: boolean | null;
    onboardingStage: string | null;
    billingState: string;
    paid: boolean;
    trialExpiresAt: string | null;
  };
  capi: { state: string; eventName: string | null; lastError: string | null };
};

type ReportPayload = {
  generatedAt: string;
  timezone: string;
  summary: { assigned: number; unassigned: number; dueToday: number; overdue: number; untouched: number; stale: number; missingFollowUp: number; paused: number; conversionRate: number };
  team: Array<{ agentId: string; name: string; group: string | null; assigned: number; dueToday: number; overdue: number; untouched: number; missingFollowUp: number; responseRate: number; closed: number; conversionRate: number }>;
  exceptions: Array<ReportRow & { reason: string }>;
  leads: ReportRow[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  funnel: Array<{ stage: string; count: number }>;
  sourceCounts: Array<{ source: string; count: number }>;
  trend: Array<{ date: string; count: number }>;
  billing: { paid: number; trial: number; trialExpired: number; paymentPending: number; free: number; unknown: number };
  registration?: { all: number; agency: number; freelancer: number; unregistered: number };
  capi: { sent: number; pending: number; failed: number; notSent: number };
};

type AttentionFilter = "all" | "due_today" | "overdue" | "untouched" | "missing_follow_up" | "paused";

type Props = {
  canViewTeam: boolean;
  onOpenLead: (leadId: string) => void;
  onOpenChat: (conversationId?: string | null) => void;
};

const stageLabels: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  QUALIFIED: "Qualified",
  FOLLOW_UP: "Follow-up",
  NEGOTIATION: "Negotiation",
  PAYMENT_PENDING: "Payment pending",
  PAID: "Paid",
  CLOSED_WON: "Closed won",
  CLOSED: "Closed",
  LOST: "Lost",
};

const stages = ["NEW", "ASSIGNED", "CONTACTED", "INTERESTED", "QUALIFIED", "FOLLOW_UP", "NEGOTIATION", "PAYMENT_PENDING", "PAID", "CLOSED_WON", "LOST"];

function pretty(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return `Step ${value}`;
  const text = typeof value === "string" ? value : "";
  return text ? text.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
}

function dateTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function BoolBadge({ value, label }: { value: boolean | null; label: string }) {
  const text = value === true ? "Yes" : value === false ? "No" : "Unknown";
  return <span className={`responsibility-bool ${value === true ? "yes" : value === false ? "no" : "unknown"}`} title={`${label}: ${text}`}><span aria-hidden="true">{value === true ? <CheckCircle2 size={11} /> : value === false ? <XCircle size={11} /> : <AlertTriangle size={11} />}</span>{label}: {text}</span>;
}

export function ResponsibilityReporting({ canViewTeam, onOpenLead, onOpenChat }: Props) {
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [range, setRange] = useState("today");
  const [attention, setAttention] = useState<AttentionFilter>("all");
  const [audienceTab, setAudienceTab] = useState<"all" | "agency" | "freelancer">("all");
  const [page, setPage] = useState(1);
  const [view, setView] = useState(canViewTeam ? "team" : "mine");
  const [source, setSource] = useState("all");
  const [stage, setStage] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ range, attention, page: String(page), view: canViewTeam ? view : "mine", pageSize: "50" });
    if (source !== "all") params.set("source", source);
    if (stage !== "all") params.set("stage", stage);
    if (audienceTab !== "all") params.set("audience", audienceTab);
    fetch(`/api/sales/reports?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Unable to load responsibility report.");
        setError("");
        setReport(payload.report as ReportPayload);
      })
      .catch((reason: unknown) => {
        if ((reason as Error)?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Unable to load responsibility report.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [canViewTeam, range, attention, audienceTab, page, view, source, stage, refreshKey]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return report?.leads ?? [];
    return (report?.leads ?? []).filter((lead) => [lead.customerName, lead.customerPhone, lead.customerEmail, lead.source, lead.owner].join(" ").toLowerCase().includes(normalized));
  }, [report?.leads, query]);

  const attentionLabels: Record<AttentionFilter, string> = {
    all: "All leads",
    due_today: "Due today",
    overdue: "Overdue",
    untouched: "Never contacted",
    missing_follow_up: "Missing follow-up",
    paused: "Paused chats",
  };
  const rangeLabels: Record<string, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", custom: "Custom period", all: "All time" };
  const leadScope = attention === "all" ? `${rangeLabels[range] ?? "Selected period"}` : `${attentionLabels[attention]} · all dates`;
  const firstVisibleLead = report?.pagination.total ? (page - 1) * report.pagination.pageSize + 1 : 0;
  const lastVisibleLead = report ? Math.min(page * report.pagination.pageSize, report.pagination.total) : 0;

  function toggleAttention(next: Exclude<AttentionFilter, "all">) {
    setAttention((current) => current === next ? "all" : next);
    setPage(1);
  }

  async function changeStage(lead: ReportRow, nextStage: string) {
    if (nextStage === lead.stage) return;
    setBusyLeadId(lead.id);
    try {
      const response = await fetch("/api/sales/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stage", leadId: lead.id, stage: nextStage, followUpAt: lead.followUpAt }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Unable to update lead stage.");
      setError("");
      setRefreshKey((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update lead stage.");
    } finally {
      setBusyLeadId(null);
    }
  }

  return (
    <section className="responsibility-reporting" aria-labelledby="responsibility-report-title">
      <div className="responsibility-header">
        <div>
          <div className="responsibility-eyebrow"><ListChecks size={14} /> Operating report</div>
          <h2 id="responsibility-report-title">Responsibility desk</h2>
          <p>The date period filters the lead list. Action cards open live queues across all dates.</p>
        </div>
        <div className="responsibility-controls">
          <label className="sr-only" htmlFor="responsibility-range">Report period</label>
          <select id="responsibility-range" value={range} onChange={(event) => { setRange(event.target.value); setAttention("all"); setPage(1); }}>
            <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All time</option>
          </select>
          {canViewTeam ? <select aria-label="Responsibility scope" value={view} onChange={(event) => setView(event.target.value)}><option value="team">Team view</option><option value="mine">My leads</option></select> : null}
          <button className="responsibility-refresh" onClick={() => setRefreshKey((current) => current + 1)} type="button" title="Refresh report"><RefreshCw size={15} /></button>
        </div>
      </div>

      {error ? <div className="responsibility-error" role="alert"><ShieldAlert size={16} /> {error}</div> : null}
      <div className="responsibility-summary-grid">
        <SummaryCard active={attention === "due_today"} icon={Clock3} label="Due today" onClick={() => toggleAttention("due_today")} value={report?.summary.dueToday ?? 0} tone="warning" />
        <SummaryCard active={attention === "overdue"} icon={AlertTriangle} label="Overdue" onClick={() => toggleAttention("overdue")} value={report?.summary.overdue ?? 0} tone="danger" />
        <SummaryCard active={attention === "untouched"} icon={UserRound} label="Never contacted" onClick={() => toggleAttention("untouched")} value={report?.summary.untouched ?? 0} tone="neutral" />
        <SummaryCard active={attention === "missing_follow_up"} icon={ListChecks} label="Missing follow-up" onClick={() => toggleAttention("missing_follow_up")} value={report?.summary.missingFollowUp ?? 0} tone="neutral" />
        <SummaryCard active={attention === "paused"} icon={MessageSquare} label="Paused chats" onClick={() => toggleAttention("paused")} value={report?.summary.paused ?? 0} tone="info" />
        <SummaryCard icon={CheckCircle2} label="Conversion" value={`${report?.summary.conversionRate ?? 0}%`} tone="success" />
      </div>

      <div className="responsibility-main-grid">
        <div className="responsibility-panel responsibility-table-panel">
          <div className="responsibility-panel-heading"><div><h3>My responsibility</h3><span>{report?.pagination.total ?? 0} leads · {leadScope}</span></div><div className="responsibility-filters"><label className="responsibility-search"><Search size={14} /><input aria-label="Search responsibility leads" placeholder="Search name, phone or source" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter source" value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}><option value="all">All sources</option>{(report?.sourceCounts ?? []).map((item) => <option key={item.source} value={item.source}>{pretty(item.source)} ({item.count})</option>)}</select><select aria-label="Filter stage" value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); }}><option value="all">All stages</option>{stages.map((item) => <option key={item} value={item}>{stageLabels[item] ?? pretty(item)}</option>)}</select></div></div>
          <div className="responsibility-audience-tabs" role="tablist" aria-label="Filter by lead priority">
            <button
              type="button"
              role="tab"
              aria-selected={audienceTab === "all"}
              className={`responsibility-audience-tab${audienceTab === "all" ? " active" : ""}`}
              onClick={() => { setAudienceTab("all"); setPage(1); }}
            >
              All Leads ({report?.registration?.all ?? report?.pagination.total ?? 0})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={audienceTab === "agency"}
              className={`responsibility-audience-tab agency${audienceTab === "agency" ? " active" : ""}`}
              onClick={() => { setAudienceTab("agency"); setPage(1); }}
            >
              <Flame size={12} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} /> Hot Pipeline ({report?.registration?.agency ?? 0})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={audienceTab === "freelancer"}
              className={`responsibility-audience-tab freelancer${audienceTab === "freelancer" ? " active" : ""}`}
              onClick={() => { setAudienceTab("freelancer"); setPage(1); }}
            >
              <PhoneCall size={12} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} /> Callbacks Due ({report?.registration?.freelancer ?? 0})
            </button>
          </div>
          <div className="responsibility-table-scroll"><table className="responsibility-table"><thead><tr><th>Lead</th><th>Stage</th><th>Next action</th><th>Telecalling state</th><th>Meta</th><th aria-label="Actions" /></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="responsibility-empty">Loading live report…</td></tr> : visibleRows.length ? visibleRows.map((lead) => <tr key={lead.id} className={lead.overdue ? "is-overdue" : undefined}><td><button className="responsibility-lead-link" onClick={() => onOpenLead(lead.id)} type="button">{lead.customerName || "Unnamed lead"}</button><span className="responsibility-secondary">{lead.customerPhone || lead.customerEmail || "No contact"}</span><span className="responsibility-source">{pretty(lead.source)} · {lead.owner}</span></td><td><select aria-label={`Change stage for ${lead.customerName}`} className={`responsibility-stage-select stage-${lead.stage.toLowerCase()}`} disabled={busyLeadId === lead.id} onChange={(event) => void changeStage(lead, event.target.value)} value={lead.stage}>{stages.map((item) => <option key={item} value={item}>{stageLabels[item] ?? pretty(item)}</option>)}</select><span className="responsibility-secondary">{lead.overdue ? "Overdue" : lead.dueToday ? "Due today" : lead.followUpAt ? dateTime(lead.followUpAt) : "No follow-up"}</span></td><td><strong>{lead.nextAction}</strong><span className="responsibility-secondary">{lead.lastContactedAt ? `Last touch ${dateTime(lead.lastContactedAt)}` : "Never contacted"}</span></td><td><div className="responsibility-bool-row"><BoolBadge label="SIM" value={lead.app.agencyRegistered || lead.app.appInstalled} /><BoolBadge label="Audio" value={lead.app.appInstalled} /><BoolBadge label="Paid" value={lead.app.paid} /></div><span className="responsibility-secondary">{lead.app.billingState === "UNKNOWN" ? "Billing unknown" : pretty(lead.app.billingState)}{lead.app.onboardingStage ? ` · ${pretty(lead.app.onboardingStage)}` : ""}</span></td><td><span className={`responsibility-capi capi-${lead.capi.state.toLowerCase()}`}>{lead.capi.state === "SENT" ? <CheckCircle2 size={12} /> : lead.capi.state === "FAILED" ? <XCircle size={12} /> : <Clock3 size={12} />}{pretty(lead.capi.state)}</span><span className="responsibility-secondary">{lead.capi.eventName ?? "No event"}</span></td><td><div className="responsibility-actions"><button aria-label={`Open ${lead.customerName} in chat`} onClick={() => onOpenChat(lead.conversationId)} type="button"><MessageSquare size={14} /></button>{lead.customerPhone ? <a aria-label={`Open WhatsApp for ${lead.customerName}`} href={`https://wa.me/${lead.customerPhone.replace(/\D/g, "")}`} rel="noreferrer" target="_blank"><ExternalLink size={14} /></a> : null}<button aria-label={`Open details for ${lead.customerName}`} onClick={() => onOpenLead(lead.id)} type="button"><ArrowRight size={14} /></button></div></td></tr>) : <tr><td colSpan={6} className="responsibility-empty">No leads match these filters.</td></tr>}</tbody></table></div>
          <div className="responsibility-pagination"><span>{loading ? "Updating results…" : `Showing ${firstVisibleLead}–${lastVisibleLead} of ${report?.pagination.total ?? 0} leads`}</span><div><button aria-label="Previous page" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Previous</button><span>Page {page} of {report?.pagination.pages ?? 1}</span><button aria-label="Next page" disabled={loading || page >= (report?.pagination.pages ?? 1)} onClick={() => setPage((current) => current + 1)} type="button">Next</button></div></div>
        </div>

        <aside className="responsibility-side-column">
          <div className="responsibility-panel"><div className="responsibility-panel-heading"><div><h3>Action queue</h3><span>Highest priority exceptions</span></div><AlertTriangle size={17} /></div><div className="responsibility-exception-list">{(report?.exceptions ?? []).slice(0, 6).map((lead) => <button className="responsibility-exception" key={`${lead.id}-${lead.reason}`} onClick={() => onOpenLead(lead.id)} type="button"><span className="responsibility-exception-dot" /><span><strong>{lead.customerName}</strong><small>{pretty(lead.reason)} · {lead.owner}</small></span><ArrowRight size={14} /></button>)}{!loading && !report?.exceptions.length ? <span className="responsibility-empty">No urgent exceptions.</span> : null}</div></div>
          {canViewTeam ? <div className="responsibility-panel"><div className="responsibility-panel-heading"><div><h3>Team accountability</h3><span>Ownership hygiene</span></div><Users size={17} /></div><div className="responsibility-team-list">{(report?.team ?? []).slice(0, 8).map((agent) => <div className="responsibility-team-row" key={agent.agentId}><div><strong>{agent.name}</strong><small>{agent.group ?? "Sales"} · {agent.assigned} assigned</small></div><span className={agent.overdue ? "team-risk" : "team-ok"}>{agent.overdue} overdue</span><span className="team-rate">{agent.responseRate}% touched</span></div>)}</div></div> : null}
          <div className="responsibility-panel responsibility-signal-panel"><div className="responsibility-panel-heading"><div><h3>Live signals</h3><span>Matched app and Meta data</span></div><CheckCircle2 size={17} /></div><div className="responsibility-signal-grid"><Signal label="Paid" value={report?.billing.paid ?? 0} tone="success" /><Signal label="Trial" value={report?.billing.trial ?? 0} tone="info" /><Signal label="Trial expired" value={report?.billing.trialExpired ?? 0} tone="warning" /><Signal label="CAPI failed" value={report?.capi.failed ?? 0} tone="danger" /></div></div>
        </aside>
      </div>
      {report ? <p className="responsibility-footnote">Live data refreshed {dateTime(report.generatedAt)} · {report.timezone} · CAPI sent {report.capi.sent}, pending {report.capi.pending}, failed {report.capi.failed}</p> : null}
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value, tone, active = false, onClick }: { icon: typeof Clock3; label: string; value: number | string; tone: string; active?: boolean; onClick?: () => void }) {
  const content = <><span className="responsibility-summary-icon"><Icon size={16} /></span><span>{label}</span><strong>{value}</strong></>;
  const className = `responsibility-summary-card ${tone}${active ? " is-active" : ""}`;
  return onClick
    ? <button aria-pressed={active} className={className} onClick={onClick} title={`Filter the live queue by ${label.toLowerCase()}`} type="button">{content}</button>
    : <div className={className}>{content}</div>;
}

function Signal({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`responsibility-signal ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}
