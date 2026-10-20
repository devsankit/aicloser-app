"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { compactMoney, relativeTime, useApp, useScopedLeads } from "@/lib/store";
import { STAGES, stageMeta, sourceMeta, isOpenStage, isWonStage, isLostStage } from "@/lib/types";
import { aicloserApi, type DashboardSummaryResponse } from "@/lib/api-client";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function DashboardView() {
  const { state } = useApp();
  const leads = useScopedLeads();
  const [liveSummary, setLiveSummary] = useState<DashboardSummaryResponse | null>(null);

  // Attempt live API fetch with fallback to loaded state
  useEffect(() => {
    let cancelled = false;
    aicloserApi.leads.getDashboardSummary()
      .then((data) => {
        if (!cancelled && data) setLiveSummary(data);
      })
      .catch(() => {
        // Fallback quietly to locally hydrated state when offline or unauthenticated
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const open = leads.filter((l) => isOpenStage(l.stage));
    const won = leads.filter((l) => isWonStage(l.stage));
    const lost = leads.filter((l) => isLostStage(l.stage));
    const week = leads.filter(
      (l) => Date.now() - new Date(l.updatedAt).getTime() < WEEK,
    );
    const decided = won.length + lost.length;

    // SIM Telemetry calculation
    const totalCalls = (liveSummary as any)?.metrics?.totalCalls ?? 0;
    const connectedCalls = (liveSummary as any)?.metrics?.connectedCalls ?? 0;
    const connectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
    const followUpsPending = leads.filter((l) => l.stage === "follow_up" || l.tags?.includes("callback")).length;
    const newPendingLeads = (liveSummary?.stageCounts?.NEW ?? leads.filter((l) => l.stage === "new").length);

    return {
      openValue: liveSummary?.pipelineValue ?? open.reduce((s, l) => s + l.value, 0),
      openCount: open.length,
      wonValue: liveSummary?.wonAmount ?? won.reduce((s, l) => s + l.value, 0),
      wonCount: liveSummary?.wonCount ?? won.length,
      newCount: newPendingLeads,
      touched: week.length,
      winRate: liveSummary?.conversionRate ?? (decided ? Math.round((won.length / decided) * 100) : 0),
      totalCalls,
      connectedCalls,
      connectRate,
      followUpsPending,
    };
  }, [leads, liveSummary]);

  const perStage = useMemo(
    () =>
      STAGES.map((stage) => {
        const rows = leads.filter((l) => l.stage === stage.id);
        const stageUpper = stage.id.toUpperCase();
        const apiCount = liveSummary?.stageCounts?.[stageUpper];
        return {
          ...stage,
          count: apiCount ?? rows.length,
          value: rows.reduce((s, l) => s + l.value, 0),
        };
      }),
    [leads, liveSummary],
  );

  const maxStage = Math.max(1, ...perStage.map((s) => s.value));

  const activity = useMemo(
    () =>
      [...leads]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [leads],
  );

  const owners = useMemo(() => {
    const map = new Map<string, { count: number; value: number; calls: number; talkTime: string }>();

    for (const lead of leads) {
      if (lead.stage === "lost") continue;
      const prev = map.get(lead.owner) ?? {
        count: 0,
        value: 0,
        calls: 0,
        talkTime: "0m",
      };
      prev.count += 1;
      prev.value += lead.value;
      map.set(lead.owner, prev);
    }
    return [...map.entries()]
      .map(([owner, v]) => ({ owner, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [leads]);

  const maxOwner = Math.max(1, ...owners.map((o) => o.value));

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="dashboard-container">
      <header className="page-head">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-sub">
            {today} · {state.scope === "all" ? "All team leads" : state.scope === "mine" ? "Your leads" : "Unassigned leads"}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/calls" className="btn">
            <Icon name="phone-call" size={15} /> Call log
          </Link>
          <Link href="/pipeline" className="btn">
            Open pipeline <Icon name="arrow-right" size={15} />
          </Link>
          <Link href="/lead-import" className="btn" data-variant="primary">
            <Icon name="upload" size={15} /> Import leads
          </Link>
        </div>
      </header>

      {/* SIM Calling Floor Status Bar */}
      <div className="card telephony-floor-banner">
        <div className="telephony-floor-main">
          <span className="stage-icon-badge" data-tone="accent">
            <Icon name="smartphone" size={17} />
          </span>
          <div className="telephony-floor-info">
            <div className="telephony-floor-title-row">
              <strong className="telephony-floor-title">AI Closer SIM Calling Engine</strong>
              <span className="chip" data-tone="success">
                <span className="dot" /> Active Floor
              </span>
            </div>
            <span className="telephony-floor-sub">
              Auto-recording & cloud audio vault running on connected closer SIM devices
            </span>
          </div>
        </div>

        <div className="telephony-floor-actions">
          <div className="telephony-floor-status">
            <strong>SIM Telephony Relay:</strong> Ready for Android Companion APK
          </div>
          <Link href="/calls" className="btn" data-size="sm">
            <Icon name="headphones" size={13} /> Call Recording Vault
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards: SIM Calls, Follow-ups Due, New Leads, Revenue */}
      <section className="stat-grid">
        <div className="card stat">
          <div className="stat-head">
            <span className="stat-label">SIM Calls Logged Today</span>
            <span className="stat-badge accent">
              <Icon name="phone-call" size={15} />
            </span>
          </div>
          <strong className="stat-value">{stats.totalCalls}</strong>
          <span className="stat-foot">
            {stats.totalCalls > 0 ? `${stats.connectedCalls} connected (${stats.connectRate}%)` : "No calls logged yet today"}
          </span>
        </div>

        <div className="card stat">
          <div className="stat-head">
            <span className="stat-label">Follow-ups & Callbacks Due</span>
            <span className="stat-badge warning">
              <Icon name="calendar-clock" size={15} />
            </span>
          </div>
          <strong className="stat-value">{stats.followUpsPending}</strong>
          <span className="stat-foot" data-tone={stats.followUpsPending > 0 ? "warning" : undefined}>
            {stats.followUpsPending > 0 ? `${stats.followUpsPending} scheduled callbacks active` : "All follow-ups completed"}
          </span>
        </div>

        <div className="card stat">
          <div className="stat-head">
            <span className="stat-label">New Leads Pending Touch</span>
            <span className="stat-badge info">
              <Icon name="user-plus" size={15} />
            </span>
          </div>
          <strong className="stat-value">{stats.newCount}</strong>
          <span className="stat-foot">
            {stats.newCount > 0 ? "Awaiting initial closer touchpoint" : "No uncontacted leads"}
          </span>
        </div>

        <div className="card stat">
          <div className="stat-head">
            <span className="stat-label">Revenue & Active Pipeline</span>
            <span className="stat-badge success">
              <Icon name="trophy" size={15} />
            </span>
          </div>
          <strong className="stat-value">{compactMoney(stats.wonValue)}</strong>
          <span className="stat-foot" data-tone="success">
            {stats.wonCount} won · {stats.openCount} open ({compactMoney(stats.openValue)})
          </span>
        </div>
      </section>

      {/* Middle Split: Pipeline Health Funnel & Recent Activity */}
      <div className="dash-split">
        <section className="card">
          <div className="card-head">
            <div className="card-title-group">
              <span className="card-title">Pipeline by Stage</span>
              <span className="card-sub">Active deals across sales touchpoints</span>
            </div>
            <Link href="/pipeline" className="card-link">
              Open board <Icon name="chevron-right" size={14} />
            </Link>
          </div>
          <div className="card-body">
            <ul className="funnel">
              {perStage.map((s) => (
                <li key={s.id} className="funnel-row" data-tone={s.tone}>
                  <span className="funnel-name">
                    <span className="stage-icon-badge" data-tone={s.tone} title={s.label}>
                      <Icon name={s.icon} size={15} />
                    </span>
                    <span className="funnel-label-text">{s.label}</span>
                  </span>
                  <div className="funnel-bar">
                    <span style={{ width: `${Math.max(3, (s.value / maxStage) * 100)}%` }} />
                  </div>
                  <span className="funnel-count">{s.count}</span>
                  <span className="funnel-value">{s.value ? compactMoney(s.value) : "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title-group">
              <span className="card-title">Recent Activity</span>
              <span className="card-sub">Latest lead touchpoints & stage movements</span>
            </div>
            <Link href="/contacts" className="card-link">
              All contacts <Icon name="chevron-right" size={14} />
            </Link>
          </div>
          <div className="card-body">
            {activity.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">
                  <Icon name="clock" size={20} />
                </span>
                <h3>No Lead Activity Yet</h3>
                <p>Create or import leads to see touchpoints and stage progression here.</p>
              </div>
            ) : (
              <ul className="activity">
                {activity.map((lead) => {
                  const meta = stageMeta(lead.stage);
                  const src = sourceMeta(lead.source);
                  return (
                    <li key={lead.id} className="activity-row">
                      <span className="stage-icon-badge" data-tone={src.tone} title={`Lead Source: ${src.label}`}>
                        <Icon name={src.icon} size={15} />
                      </span>
                      <div className="activity-copy">
                        <div className="activity-title-line">
                          <strong>{lead.name}</strong>
                          <span className="activity-company">{lead.company}</span>
                        </div>
                        <span className="activity-sub">
                          <span className="chip" data-tone={src.tone}>
                            <Icon name={src.icon} size={10} /> {src.label}
                          </span>
                          <span className="activity-stage-tag" data-tone={meta.tone}>{meta.label}</span>
                          {lead.phone && <span className="activity-phone">· {lead.phone}</span>}
                        </span>
                      </div>
                      <span className="activity-time">{relativeTime(lead.updatedAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Bottom Split: Owner Workload & Quick Desk Actions */}
      <div className="dash-split">
        <section className="card">
          <div className="card-head">
            <div className="card-title-group">
              <span className="card-title">Closer Calling Velocity & Workload</span>
              <span className="card-sub">SIM calls, talk time & open deals across closers</span>
            </div>
            <span className="hint">Open Value</span>
          </div>
          <div className="card-body">
            {owners.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">
                  <Icon name="users" size={20} />
                </span>
                <h3>No Assigned Closers Yet</h3>
                <p>Assign deal ownership to track individual closer call volume and pipeline value.</p>
              </div>
            ) : (
              <ul className="owners">
                {owners.map((o) => (
                  <li key={o.owner} className="owner-row">
                    <span className={`mini-avatar ${o.owner === "Unassigned" ? "is-empty" : ""}`}>
                      {o.owner === "Unassigned" ? "?" : o.owner.slice(0, 1)}
                    </span>
                    <div className="owner-info">
                      <span className="owner-name">{o.owner}</span>
                      <small className="owner-sub">
                        {o.count} active deal{o.count === 1 ? "" : "s"}
                      </small>
                    </div>
                    <div className="owner-meter">
                      <span style={{ width: `${Math.max(4, (o.value / maxOwner) * 100)}%` }} />
                    </div>
                    <span className="owner-count" title={`${o.count} active deals`}>{o.count}</span>
                    <span className="owner-value">{compactMoney(o.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title-group">
              <span className="card-title">Jump Back In</span>
              <span className="card-sub">Quick actions for the active calling desk</span>
            </div>
          </div>
          <div className="card-body">
            <div className="quick-grid">
              <Link href="/calls" className="quick">
                <div className="quick-icon-wrap">
                  <Icon name="phone-call" size={18} />
                </div>
                <div className="quick-info">
                  <span>Call Recordings</span>
                  <small>Audio recordings & transcripts</small>
                </div>
                <Icon name="chevron-right" size={14} className="quick-arrow" />
              </Link>

              <Link href="/chat" className="quick">
                <div className="quick-icon-wrap">
                  <Icon name="message" size={18} />
                </div>
                <div className="quick-info">
                  <span>Social Chat</span>
                  <small>WhatsApp & Instagram chat</small>
                </div>
                <Icon name="chevron-right" size={14} className="quick-arrow" />
              </Link>

              <Link href="/forms" className="quick">
                <div className="quick-icon-wrap">
                  <Icon name="form" size={18} />
                </div>
                <div className="quick-info">
                  <span>Lead Forms</span>
                  <small>Web capture forms & embed codes</small>
                </div>
                <Icon name="chevron-right" size={14} className="quick-arrow" />
              </Link>

              <Link href="/payments" className="quick">
                <div className="quick-icon-wrap">
                  <Icon name="receipt" size={18} />
                </div>
                <div className="quick-info">
                  <span>UPI Payments</span>
                  <small>Razorpay & dynamic QR codes</small>
                </div>
                <Icon name="chevron-right" size={14} className="quick-arrow" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
