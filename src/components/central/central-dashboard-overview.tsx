"use client";

import { ArrowUpRight, BriefcaseBusiness, CalendarClock, ChevronRight, CircleDollarSign, MessageCircle, Phone, RefreshCw, Sparkles, Users } from "lucide-react";

import type { SalesDashboardSnapshot, SalesLeadView } from "@/lib/gigxomi/sales-store";

type PipelineAggregate = {
  stage?: string;
  count?: number;
  totalValue?: number;
  weightedValue?: number;
};

type CentralDashboardOverviewProps = {
  snapshot: SalesDashboardSnapshot;
  aggregates: PipelineAggregate[];
  paymentSummary?: {
    totalLinks?: number;
    totalAmount?: number;
    paidAmount?: number;
    pendingAmount?: number;
  };
  role: string;
  onOpen: (tab: string) => void;
};

const stageLabels: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  IN_PROGRESS: "In progress",
  DEMO_SCHEDULED: "Demo scheduled",
  FOLLOW_UP: "Follow-up",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed won",
  CLOSED_LOST: "Closed lost",
  LOST: "Lost",
  RECYCLED: "Recycled",
};

function stageLabel(stage: string) {
  return stageLabels[stage] ?? stage.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (letter) => letter.toUpperCase());
}

function formatAmount(value: number) {
  if (!value) return "₹0";
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1, style: "currency", currency: "INR" }).format(value);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function leadInitials(lead: SalesLeadView) {
  return lead.customerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "L";
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Phone; label: string; onClick: () => void }) {
  return <button className="central-dashboard-action" onClick={onClick} type="button"><Icon size={15} />{label}<ArrowUpRight size={14} /></button>;
}

export function CentralDashboardOverview({ snapshot, aggregates, paymentSummary = {}, role, onOpen }: CentralDashboardOverviewProps) {
  const leads = snapshot.visibleLeads ?? [];
  const newLeads = aggregates.find((item) => item.stage === "NEW")?.count ?? leads.filter((lead) => lead.stage === "NEW").length;
  const pipelineLeadCount = aggregates.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
  const followUps = leads.filter((lead) => Boolean(lead.followUpAt)).length;
  const paymentLinks = Number(paymentSummary.totalLinks ?? 0);
  const paymentTotal = Number(paymentSummary.totalAmount ?? 0);
  const maxStageCount = Math.max(...aggregates.map((item) => Number(item.count ?? 0)), 1);
  const recentLeads = [...leads].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()).slice(0, 5);
  const hotLeads = leads.filter((lead) => lead.priority === "hot").length;
  const stages = aggregates.length ? aggregates : [{ stage: "NEW", count: newLeads, totalValue: 0 }];

  return (
    <section aria-label="AIcloser central dashboard" className="central-dashboard">
      <header className="central-dashboard-hero">
        <div>
          <div className="central-eyebrow"><span className="central-live-dot" /> Central API workspace</div>
          <h2>Good to see you, {snapshot.currentAgent?.displayName ?? "there"}</h2>
          <p>One clean view of your leads, pipeline and next actions. Counts are permission-scoped by the API.</p>
        </div>
        <div className="central-dashboard-hero-meta">
          <span className="central-api-badge"><RefreshCw size={13} /> Live data</span>
          <span>{role.replaceAll("_", " ")}</span>
        </div>
      </header>

      <div className="central-metric-grid">
        <button className="central-metric-card central-metric-card-accent" onClick={() => onOpen("crm")} type="button">
          <span className="central-metric-icon"><BriefcaseBusiness size={17} /></span>
          <span className="central-metric-label">Leads on this page</span>
          <strong>{leads.length}</strong>
          <small>{pipelineLeadCount > leads.length ? `${pipelineLeadCount.toLocaleString("en-IN")} across pipeline` : "Open CRM pipeline"} <ChevronRight size={13} /></small>
        </button>
        <button className="central-metric-card" onClick={() => onOpen("crm")} type="button">
          <span className="central-metric-icon"><Sparkles size={17} /></span>
          <span className="central-metric-label">New leads</span>
          <strong>{newLeads}</strong>
          <small>Across all API-visible leads <ChevronRight size={13} /></small>
        </button>
        <button className="central-metric-card" onClick={() => onOpen("crm")} type="button">
          <span className="central-metric-icon"><CalendarClock size={17} /></span>
          <span className="central-metric-label">Follow-ups</span>
          <strong>{followUps}</strong>
          <small>Scheduled in loaded leads <ChevronRight size={13} /></small>
        </button>
        <button className="central-metric-card" onClick={() => onOpen("payments")} type="button">
          <span className="central-metric-icon"><CircleDollarSign size={17} /></span>
          <span className="central-metric-label">Payment links</span>
          <strong>{formatAmount(paymentTotal)}</strong>
          <small>{paymentLinks.toLocaleString("en-IN")} links created by the visible team <ChevronRight size={13} /></small>
        </button>
      </div>

      <div className="central-dashboard-grid">
        <section className="central-card central-pipeline-card">
          <div className="central-card-heading"><div><span className="central-card-kicker">Pipeline health</span><h3>Where your leads are moving</h3></div><button className="central-text-button" onClick={() => onOpen("crm")} type="button">Open pipeline <ArrowUpRight size={14} /></button></div>
          <div className="central-pipeline-list">
            {stages.map((item) => {
              const count = Number(item.count ?? 0);
              return <button className="central-pipeline-row" key={item.stage} onClick={() => onOpen("crm")} type="button"><span className="central-pipeline-name"><span className="central-pipeline-dot" />{stageLabel(item.stage ?? "NEW")}</span><span className="central-pipeline-track"><span style={{ width: `${Math.max(4, (count / maxStageCount) * 100)}%` }} /></span><strong>{count}</strong></button>;
            })}
          </div>
        </section>

        <section className="central-card central-actions-card">
          <div className="central-card-heading"><div><span className="central-card-kicker">Next best actions</span><h3>Keep the desk moving</h3></div><Sparkles size={18} className="central-heading-icon" /></div>
          <div className="central-actions-list">
            <ActionButton icon={Phone} label="Review call activity" onClick={() => onOpen("calls")} />
            <ActionButton icon={MessageCircle} label="Open live conversations" onClick={() => onOpen("conversations")} />
            <ActionButton icon={Users} label="Review team access" onClick={() => onOpen("roles")} />
          </div>
          <div className="central-action-note"><span className="central-note-dot" />{hotLeads} high-priority lead{hotLeads === 1 ? "" : "s"} in the current API response</div>
        </section>
      </div>

      <section className="central-card central-recent-card">
        <div className="central-card-heading"><div><span className="central-card-kicker">Recent activity</span><h3>Latest leads from the central API</h3></div><button className="central-text-button" onClick={() => onOpen("crm")} type="button">View all <ArrowUpRight size={14} /></button></div>
        {recentLeads.length ? <div className="central-recent-list">{recentLeads.map((lead) => <button className="central-recent-row" key={lead.id} onClick={() => onOpen("crm")} type="button"><span className="central-avatar">{leadInitials(lead)}</span><span className="central-recent-main"><strong>{lead.customerName}</strong><small>{lead.customerPhone || "No phone"} · {stageLabel(lead.stage)}</small></span><span className="central-recent-time">{formatTime(lead.updatedAt)}<ChevronRight size={14} /></span></button>)}</div> : <div className="central-empty-state">No leads are available in this permission scope yet.</div>}
      </section>
    </section>
  );
}
