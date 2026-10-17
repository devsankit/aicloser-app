"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { compactMoney, money, relativeTime, useApp, useScopedLeads } from "@/lib/store";
import { STAGES, stageMeta } from "@/lib/types";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function DashboardView() {
  const { state } = useApp();
  const leads = useScopedLeads();

  const stats = useMemo(() => {
    const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
    const won = leads.filter((l) => l.stage === "won");
    const lost = leads.filter((l) => l.stage === "lost");
    const week = leads.filter(
      (l) => Date.now() - new Date(l.updatedAt).getTime() < WEEK,
    );
    const decided = won.length + lost.length;
    return {
      openValue: open.reduce((s, l) => s + l.value, 0),
      openCount: open.length,
      wonValue: won.reduce((s, l) => s + l.value, 0),
      wonCount: won.length,
      newCount: leads.filter((l) => l.stage === "new").length,
      touched: week.length,
      winRate: decided ? Math.round((won.length / decided) * 100) : 0,
    };
  }, [leads]);

  const perStage = useMemo(
    () =>
      STAGES.map((stage) => {
        const rows = leads.filter((l) => l.stage === stage.id);
        return {
          ...stage,
          count: rows.length,
          value: rows.reduce((s, l) => s + l.value, 0),
        };
      }),
    [leads],
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
    const map = new Map<string, { count: number; value: number }>();
    for (const lead of leads) {
      if (lead.stage === "lost") continue;
      const entry = map.get(lead.owner) ?? { count: 0, value: 0 };
      entry.count += 1;
      entry.value += lead.value;
      map.set(lead.owner, entry);
    }
    return [...map.entries()]
      .map(([owner, v]) => ({ owner, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [leads]);

  const maxOwner = Math.max(1, ...owners.map((o) => o.value));

  // Fixed time zone so server and client always format the same string.
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div>
      <header className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            {today} · {state.scope === "all" ? "all team leads" : state.scope === "mine" ? "your leads" : "unassigned leads"}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/pipeline" className="btn">
            Open pipeline <Icon name="arrow-right" size={14} />
          </Link>
          <Link href="/lead-import" className="btn" data-variant="primary">
            <Icon name="upload" size={14} /> Import leads
          </Link>
        </div>
      </header>

      <section className="stat-grid">
        <div className="card stat">
          <span className="stat-label">Open pipeline</span>
          <strong className="stat-value">{compactMoney(stats.openValue)}</strong>
          <span className="stat-foot">
            {stats.openCount} active deals · {compactMoney(stats.openValue / Math.max(1, stats.openCount))} avg
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">Closed won</span>
          <strong className="stat-value">{compactMoney(stats.wonValue)}</strong>
          <span className="stat-foot" data-tone="success">
            {stats.wonCount} deals · {money(stats.wonValue)}
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">New leads</span>
          <strong className="stat-value">{stats.newCount}</strong>
          <span className="stat-foot">{stats.touched} touched in the last 7 days</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Win rate</span>
          <strong className="stat-value">{stats.winRate}%</strong>
          <span className="stat-foot">
            <span className="meter">
              <span style={{ width: `${stats.winRate}%` }} />
            </span>
          </span>
        </div>
      </section>

      <div className="dash-split">
        <section className="card">
          <div className="card-head">
            <span className="card-title">Pipeline by stage</span>
            <Link href="/pipeline" className="card-link">
              Open board <Icon name="chevron-right" size={12} />
            </Link>
          </div>
          <div className="card-body">
            <ul className="funnel">
              {perStage.map((s) => (
                <li key={s.id} className="funnel-row">
                  <span className="funnel-name">
                    <span className="sg" data-status={s.status}>
                      <Icon name={`status-${s.status}`} size={13} />
                    </span>
                    {s.label}
                  </span>
                  <span className="funnel-bar">
                    <span style={{ width: `${Math.max(2, (s.value / maxStage) * 100)}%` }} />
                  </span>
                  <span className="funnel-count">{s.count}</span>
                  <span className="funnel-value">{s.value ? compactMoney(s.value) : "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="card-title">Recent activity</span>
            <Link href="/contacts" className="card-link">
              All contacts <Icon name="chevron-right" size={12} />
            </Link>
          </div>
          <div className="card-body">
            <ul className="activity">
              {activity.map((lead) => {
                const meta = stageMeta(lead.stage);
                return (
                  <li key={lead.id} className="activity-row">
                    <span className="sg" data-status={meta.status}>
                      <Icon name={`status-${meta.status}`} size={14} />
                    </span>
                    <span className="activity-copy">
                      <strong>{lead.name}</strong>
                      <span className="activity-sub">
                        {meta.label} · {lead.company}
                      </span>
                    </span>
                    <span className="activity-time">{relativeTime(lead.updatedAt)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>

      <div className="dash-split">
        <section className="card">
          <div className="card-head">
            <span className="card-title">Owner load</span>
            <span className="hint">open value</span>
          </div>
          <div className="card-body">
            <ul className="owners">
              {owners.map((o) => (
                <li key={o.owner} className="owner-row">
                  <span className={`mini-avatar ${o.owner === "Unassigned" ? "is-empty" : ""}`}>
                    {o.owner === "Unassigned" ? "?" : o.owner.slice(0, 1)}
                  </span>
                  <span className="owner-name">{o.owner}</span>
                  <span className="owner-meter">
                    <span style={{ width: `${(o.value / maxOwner) * 100}%` }} />
                  </span>
                  <span className="owner-count">{o.count}</span>
                  <span className="owner-value">{compactMoney(o.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="card-title">Jump back in</span>
          </div>
          <div className="card-body">
            <div className="quick-grid">
              <Link href="/chat" className="quick">
                <Icon name="message" size={15} />
                <span>Live chat</span>
                <small>3 open threads</small>
              </Link>
              <Link href="/calls" className="quick">
                <Icon name="phone" size={15} />
                <span>Call log</span>
                <small>12 recordings</small>
              </Link>
              <Link href="/forms" className="quick">
                <Icon name="form" size={15} />
                <span>Lead forms</span>
                <small>2 published</small>
              </Link>
              <Link href="/payments" className="quick">
                <Icon name="card" size={15} />
                <span>Payments</span>
                <small>₹1.2L pending</small>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
