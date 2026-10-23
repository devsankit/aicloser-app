"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
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

  const [breakLogs, setBreakLogs] = useState<Array<{
    id: string;
    userId: string;
    userName: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number;
    status: string;
  }>>([]);
  const [breakSummary, setBreakSummary] = useState({
    allowedMinutes: 30,
    allowedSeconds: 1800,
    usedSeconds: 0,
    usedMinutes: 0,
    remainingSeconds: 1800,
    remainingMinutes: 30,
    isOnBreak: false,
    totalBreaksToday: 0,
  });
  const [breakLoading, setBreakLoading] = useState(false);

  const fetchBreakLogs = useCallback(async () => {
    setBreakLoading(true);
    try {
      const scope = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN" || state.user?.role === "MANAGER"
        ? "all"
        : "mine";
      const res = await aicloserApi.team.getBreakLogs(scope);
      if (res?.logs) setBreakLogs(res.logs);
      if (res?.summary) setBreakSummary(res.summary);
    } catch {} finally {
      setBreakLoading(false);
    }
  }, [state.user?.role]);

  useEffect(() => {
    fetchBreakLogs();
    const t = setInterval(fetchBreakLogs, 20000);
    return () => clearInterval(t);
  }, [fetchBreakLogs]);

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

    const calculatedOpenVal = open.reduce((s, l) => s + l.value, 0);
    const calculatedWonVal = won.reduce((s, l) => s + l.value, 0);

    return {
      openValue: typeof liveSummary?.pipelineValue === "number" ? liveSummary.pipelineValue : calculatedOpenVal,
      openCount: open.length,
      wonValue: typeof liveSummary?.wonAmount === "number" ? liveSummary.wonAmount : calculatedWonVal,
      wonCount: typeof liveSummary?.wonCount === "number" ? liveSummary.wonCount : won.length,
      newCount: newPendingLeads,
      touched: week.length,
      winRate: liveSummary?.conversionRate ?? (decided ? Math.round((won.length / decided) * 100) : 0),
      totalCalls,
      connectedCalls,
      connectRate,
      followUpsPending,
      missedCount: (liveSummary as any)?.missedCount ?? 0,
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

  const formatDurationSec = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  };

  const isAdmin = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN";
  const isManager = state.user?.role === "MANAGER";
  const canManage = isAdmin || isManager;

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
          {canManage ? (
            <Link href="/lead-import" className="btn" data-variant="primary">
              <Icon name="upload" size={15} /> Import leads
            </Link>
          ) : (
            <Link href="/pipeline" className="btn" data-variant="primary">
              <Icon name="arrow-right" size={15} /> My Pipeline
            </Link>
          )}
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
            <span className="stat-label">Missed Pool Leads</span>
            <span className="stat-badge danger">
              <Icon name="clock-alert" size={15} />
            </span>
          </div>
          <strong className="stat-value">{stats.missedCount}</strong>
          <span className="stat-foot" data-tone={stats.missedCount > 0 ? "danger" : undefined}>
            {stats.missedCount > 0 ? `${stats.missedCount} pool leads expired today` : "Zero missed pool leads today"}
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

              {canManage ? (
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
              ) : (
                <Link href="/contacts" className="quick">
                  <div className="quick-icon-wrap">
                    <Icon name="users" size={18} />
                  </div>
                  <div className="quick-info">
                    <span>Contacts Hub</span>
                    <small>Customer directory & records</small>
                  </div>
                  <Icon name="chevron-right" size={14} className="quick-arrow" />
                </Link>
              )}

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

      {/* Closer Break Activity & Daily Quota Records (Positioned at Bottom) */}
      <section className="card card-section-break">
        <div className="card-head">
          <div className="card-title-group">
            <span className="card-title">
              <Icon name="coffee" size={16} /> Closer Break Logs & Time Records
            </span>
            <span className="card-sub">
              Daily allowed break quota (30 mins), cumulative time taken, and active break sessions
            </span>
          </div>
          <div className="break-head-actions">
            <span className="chip" data-tone={breakSummary.isOnBreak ? "warning" : "success"}>
              <span className="dot" />
              {breakSummary.isOnBreak ? "Currently On Break" : "Active / Receiving Leads"}
            </span>
            <button
              type="button"
              className="btn"
              data-size="sm"
              data-variant="ghost"
              onClick={fetchBreakLogs}
              title="Refresh Break Logs"
            >
              <Icon name="refresh" size={13} className={breakLoading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* Mini Stat Pills */}
          <div className="break-quota-grid">
            <div className="break-quota-pill">
              <div className="break-quota-label">Daily Quota</div>
              <div className="break-quota-value">{breakSummary.allowedMinutes} mins</div>
            </div>

            <div className="break-quota-pill">
              <div className="break-quota-label">Time Used Today</div>
              <div className="break-quota-value" data-tone="accent">
                {formatDurationSec(breakSummary.usedSeconds)}
              </div>
            </div>

            <div className="break-quota-pill">
              <div className="break-quota-label">Remaining Quota</div>
              <div
                className="break-quota-value"
                data-tone={breakSummary.remainingSeconds > 0 ? "success" : "danger"}
              >
                {formatDurationSec(breakSummary.remainingSeconds)}
              </div>
            </div>

            <div className="break-quota-pill">
              <div className="break-quota-label">Sessions Today</div>
              <div className="break-quota-value">
                {breakSummary.totalBreaksToday} {breakSummary.totalBreaksToday === 1 ? "session" : "sessions"}
              </div>
            </div>
          </div>

          {/* Table of Break Session Logs */}
          {breakLogs.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">
                <Icon name="coffee" size={20} />
              </span>
              <h3>No Break Sessions Recorded Today</h3>
              <p>When closers take a break, their start time, elapsed duration, and remaining quota will appear here in real time.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="break-log-table">
                <thead>
                  <tr>
                    <th>Closer</th>
                    <th>Started At</th>
                    <th>Ended At</th>
                    <th>Duration Taken</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {breakLogs.map((log) => {
                    const isLive = log.status === "IN_PROGRESS";
                    return (
                      <tr key={log.id}>
                        <td>{log.userName}</td>
                        <td>
                          {new Date(log.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                        </td>
                        <td>
                          {log.endedAt ? (
                            new Date(log.endedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
                          ) : (
                            <span className="chip" data-tone="accent">Active Now...</span>
                          )}
                        </td>
                        <td>{formatDurationSec(log.durationSeconds)}</td>
                        <td>
                          <span
                            className="chip"
                            data-tone={isLive ? "warning" : log.status === "EXPIRED" ? "danger" : "success"}
                          >
                            {isLive ? "In Progress" : log.status === "EXPIRED" ? "Quota Expired" : "Completed / Paused"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
