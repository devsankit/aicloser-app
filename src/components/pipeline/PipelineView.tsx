"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { compactMoney, isOverdue, LIMITS, money, relativeTime, slaLabel, useApp, useScopedLeads } from "@/lib/store";
import {
  isOpenStage,
  normalizeSource,
  PRIORITY_ICON,
  SEGMENTS,
  SOURCES,
  STAGES,
  sourceMeta,
  type Lead,
  type LeadPoolItem,
  type Segment,
  type Source,
  type StageId,
} from "@/lib/types";
import { LeadDrawer } from "./LeadDrawer";
import { AddLeadDialog } from "./AddLeadDialog";

type SortKey = "recent" | "value" | "priority";

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function PipelineView() {
  const { state, moveLead, setLayout, claimLead, claimFromPool, fetchPoolLeads } = useApp();
  const scoped = useScopedLeads();
  const [viewMode, setViewMode] = useState<"board" | "pool">("board");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source | "">("");
  const [segment, setSegment] = useState<Segment | "">("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [fit, setFit] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<StageId | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [addStage, setAddStage] = useState<StageId | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Lead Grab Pool State
  const [poolQuery, setPoolQuery] = useState("");
  const [poolSource, setPoolSource] = useState<string>("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [disappearedIds, setDisappearedIds] = useState<Set<string>>(new Set());
  const [claimFeedback, setClaimFeedback] = useState<{ id?: string; status: "success" | "already_claimed" | "quota_limit"; message: string } | null>(null);

  const userRole = state.user?.role || "ADMIN";
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "MANAGER";
  const closerName = state.user?.displayName || "Calling Ankit";
  const myActiveLeads = state.leads.filter(
    (l) => l.stage !== "won" && l.stage !== "lost" && (l.owner === closerName || (!isAdmin && state.scope === "all"))
  ).length;
  const myCap = (state.user as any)?.maxActiveLeads || 25;
  const isAtQuota = !isAdmin && myActiveLeads >= myCap;
  const [isDistributing, setIsDistributing] = useState(false);

  const availableClosers = useMemo(() => {
    const list = new Set<string>();
    list.add("Anshita (Senior Closer)");
    list.add("Field Closer Desk (SIM Relay)");
    state.leads.forEach((l) => {
      if (l.owner && l.owner.trim() && l.owner !== "Admin" && l.owner !== "System") {
        list.add(l.owner);
      }
    });
    return Array.from(list);
  }, [state.leads]);

  const handleAssignLead = async (item: LeadPoolItem, targetCloser: string) => {
    if (claimingId || !targetCloser) return;
    setClaimingId(item.id);
    try {
      const cleanCloser = targetCloser.split(" (")[0];
      const res = await claimFromPool(item.id, cleanCloser);
      setClaimingId(null);
      if (res.success) {
        setDisappearedIds((prev) => new Set(prev).add(item.id));
        setClaimFeedback({
          id: item.id,
          status: "success",
          message: `✅ Lead "${item.customerName || "Customer"}" assigned to ${cleanCloser}! Added to New Leads.`,
        });
        setTimeout(() => setClaimFeedback(null), 4000);
      } else {
        setClaimFeedback({
          id: item.id,
          status: "already_claimed",
          message: res.message || "Failed to assign lead.",
        });
        setTimeout(() => setClaimFeedback(null), 4000);
      }
    } catch {
      setClaimingId(null);
    }
  };

  const handleAutoDistributeAll = async () => {
    if (isDistributing || openPoolList.length === 0) return;
    const closers = ["Anshita", "Field Closer Desk"];
    state.leads.forEach((l) => {
      if (l.owner && !closers.includes(l.owner) && l.owner !== "Admin" && l.owner !== "System") {
        closers.push(l.owner);
      }
    });
    if (closers.length === 0) return;

    setIsDistributing(true);
    let distributedCount = 0;
    for (let i = 0; i < openPoolList.length; i++) {
      const item = openPoolList[i];
      const target = closers[i % closers.length];
      try {
        await claimFromPool(item.id, target);
        setDisappearedIds((prev) => new Set(prev).add(item.id));
        distributedCount++;
      } catch {}
    }
    setIsDistributing(false);
    setClaimFeedback({
      status: "success",
      message: `⚡ Successfully distributed ${distributedCount} leads across ${closers.length} closers via Round-Robin!`,
    });
    setTimeout(() => setClaimFeedback(null), 5000);
  };

  const openPoolList = useMemo(() => {
    const q = poolQuery.trim().toLowerCase();
    return (state.poolLeads || []).filter((p) => {
      if (disappearedIds.has(p.id)) return false;
      if (p.status !== "OPEN") return false;
      if (poolSource && p.source !== poolSource) return false;
      if (!q) return true;
      return (
        (p.customerName || "").toLowerCase().includes(q) ||
        (p.customerPhone || "").includes(q) ||
        (p.customerEmail || "").toLowerCase().includes(q) ||
        (p.serviceInterest || "").toLowerCase().includes(q)
      );
    });
  }, [state.poolLeads, disappearedIds, poolQuery, poolSource]);

  const handleClaimLead = async (item: LeadPoolItem) => {
    if (claimingId || isAtQuota) return;
    setClaimingId(item.id);
    try {
      const res = await claimFromPool(item.id, closerName);
      setClaimingId(null);
      if (res.success) {
        setDisappearedIds((prev) => new Set(prev).add(item.id));
        setClaimFeedback({
          id: item.id,
          status: "success",
          message: `⚡ Lead "${item.customerName || "Customer"}" grabbed! Added to your New Leads column.`,
        });
        setTimeout(() => setClaimFeedback(null), 4000);
      } else {
        const msg = res.message || "Lead is no longer available.";
        const isQuota = msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("cap");
        if (!isQuota) {
          setDisappearedIds((prev) => new Set(prev).add(item.id));
        }
        setClaimFeedback({
          id: item.id,
          status: isQuota ? "quota_limit" : "already_claimed",
          message: isQuota
            ? `⚠️ Quota Limit: You already hold ${myActiveLeads}/${myCap} active leads. Close existing deals before grabbing more.`
            : `⚡ Lead was just grabbed by another closer!`,
        });
        setTimeout(() => setClaimFeedback(null), 4500);
      }
    } catch {
      setClaimingId(null);
      setDisappearedIds((prev) => new Set(prev).add(item.id));
      setClaimFeedback({
        id: item.id,
        status: "already_claimed",
        message: "⚡ Lead is no longer available or was grabbed by another closer.",
      });
      setTimeout(() => setClaimFeedback(null), 4500);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = scoped.filter((l) => {
      if (source) {
        const leadSrc = normalizeSource(l.source);
        if (leadSrc !== source && l.source !== source) return false;
      }
      if (segment && l.segment !== segment) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    return rows.sort((a, b) => {
      if (sort === "value") {
        return b.value - a.value || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      }
      if (sort === "priority") {
        return (
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          b.value - a.value ||
          a.id.localeCompare(b.id)
        );
      }
      const bTime = new Date(b.updatedAt).getTime() || 0;
      const aTime = new Date(a.updatedAt).getTime() || 0;
      return bTime - aTime || a.id.localeCompare(b.id);
    });
  }, [scoped, query, source, segment, sort]);

  const byStage = useMemo(() => {
    const map = new Map<StageId, Lead[]>();
    for (const stage of STAGES) map.set(stage.id, []);
    for (const lead of filtered) map.get(lead.stage)?.push(lead);
    return map;
  }, [filtered]);

  const openValue = filtered
    .filter((l) => isOpenStage(l.stage))
    .reduce((sum, l) => sum + l.value, 0);

  const active = state.leads.find((l) => l.id === selected) ?? null;
  const hasFilters = Boolean(query || source || segment);

  const clearFilters = () => {
    setQuery("");
    setSource("");
    setSegment("");
  };

  /** Move the focused card to another stage, or walk the board with arrows. */
  const onCardKeyDown = (e: React.KeyboardEvent, lead: Lead, stageIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setSelected(lead.id);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (e.shiftKey) {
        // move the lead one stage over
        const next = STAGES[stageIndex + dir];
        if (next) {
          e.preventDefault();
          moveLead(lead.id, next.id);
          // Retain focus on moved card in target column
          requestAnimationFrame(() => {
            const card = boardRef.current?.querySelector<HTMLElement>(`[data-lead="${lead.id}"]`);
            card?.focus();
          });
        }
      } else {
        // move focus to the same row in the neighbouring column
        e.preventDefault();
        const columns = boardRef.current?.querySelectorAll<HTMLElement>(".col-cards");
        const target = columns?.[stageIndex + dir];
        const card = target?.querySelector<HTMLElement>(`[data-lead="${lead.id}"]`) ??
          target?.querySelector<HTMLElement>(".card.lead");
        card?.focus();
      }
    }
  };

  return (
    <div className="pipe">
      <header className="page-head pipe-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "4px" }}>
            <h1 className="page-title">Pipeline</h1>
            <div className="seg" role="group" aria-label="Pipeline Views" style={{ display: "inline-flex" }}>
              <button
                data-on={viewMode === "board"}
                onClick={() => setViewMode("board")}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Icon name="kanban" size={13} />
                <span>Kanban Board</span>
                <span className="pill" style={{ fontSize: "10px", padding: "1px 6px" }}>{filtered.length}</span>
              </button>
              <button
                data-on={viewMode === "pool"}
                onClick={() => {
                  setViewMode("pool");
                  fetchPoolLeads().catch(() => {});
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: viewMode === "pool" ? "var(--accent)" : undefined,
                }}
              >
                <Icon name="zap" size={13} />
                <span>{isAdmin ? "Unassigned Pool" : "Lead Grab Pool"}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: "rgba(244, 97, 42, 0.15)",
                    color: "var(--accent)",
                  }}
                >
                  {openPoolList.length || state.poolCount || 0}
                </span>
              </button>
            </div>
          </div>
          <p className="page-sub">
            {viewMode === "board" ? (
              <>
                {filtered.length} leads ·{" "}
                drag a card or select it and press ⇧ ← →
              </>
            ) : (
              <>
                ⚡ <b>{isAdmin ? "Unassigned Leads Pool" : "First-Come, First-Served Pool"}</b> · {openPoolList.length} unassigned leads waiting · {isAdmin ? "Distribute leads to team closers or let closers claim them from their Lead Grab Pool." : "Grabbing a lead instantly claims it into your New Leads."}
              </>
            )}
          </p>
        </div>
        <div className="page-actions">
          {viewMode === "board" ? (
            <>
              {(openPoolList.length > 0 || state.poolCount > 0) && (
                <button
                  className="btn"
                  onClick={() => {
                    setViewMode("pool");
                    fetchPoolLeads().catch(() => {});
                  }}
                  style={{
                    borderColor: "rgba(244, 97, 42, 0.4)",
                    color: "var(--accent)",
                    background: "rgba(244, 97, 42, 0.08)",
                    fontWeight: 550,
                  }}
                >
                  <Icon name="zap" size={14} /> {isAdmin ? "Unassigned Pool" : "Open Grab Pool"} ({openPoolList.length || state.poolCount})
                </button>
              )}
              <button className="btn" onClick={() => setFit((f) => !f)} aria-pressed={fit}>
                <Icon name="panel" size={14} /> {fit ? "Fixed columns" : "Fit board"}
              </button>
              <button className="btn" data-variant="primary" onClick={() => setAddStage("new")}>
                <Icon name="pencil" size={14} /> New lead
              </button>
            </>
          ) : (
            <>
              <button
                className="btn"
                onClick={() => fetchPoolLeads().catch(() => {})}
                disabled={state.isPoolLoading}
              >
                <Icon name="refresh" size={14} /> {state.isPoolLoading ? "Refreshing..." : "Refresh Pool"}
              </button>
              <button className="btn" data-variant="primary" onClick={() => setViewMode("board")}>
                <Icon name="kanban" size={14} /> View Kanban Board
              </button>
            </>
          )}
        </div>
      </header>

      {viewMode === "pool" ? (
        <div className="pool-container">
          {/* Claim feedback banner */}
          {claimFeedback && (
            <div
              className="card"
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background:
                  claimFeedback.status === "success"
                    ? "rgba(16, 185, 129, 0.12)"
                    : claimFeedback.status === "quota_limit"
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                border:
                  claimFeedback.status === "success"
                    ? "1px solid rgba(16, 185, 129, 0.3)"
                    : claimFeedback.status === "quota_limit"
                    ? "1px solid rgba(245, 158, 11, 0.3)"
                    : "1px solid rgba(239, 68, 68, 0.3)",
                color:
                  claimFeedback.status === "success"
                    ? "#10b981"
                    : claimFeedback.status === "quota_limit"
                    ? "#f59e0b"
                    : "#ef4444",
                fontWeight: 550,
                borderRadius: "var(--r-md)",
              }}
            >
              <Icon
                name={
                  claimFeedback.status === "success"
                    ? "check-circle"
                    : claimFeedback.status === "quota_limit"
                    ? "alert-circle"
                    : "x-circle"
                }
                size={18}
              />
              <span style={{ fontSize: "var(--fs-meta)" }}>{claimFeedback.message}</span>
            </div>
          )}

          {/* Admin vs Closer Banner Card */}
          <div className="pool-banner-card">
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(244, 97, 42, 0.15)",
                    color: "var(--accent)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  <Icon name={isAdmin ? "users" : "zap"} size={12} /> {isAdmin ? "Admin Distribution Pool" : "First-Come, First-Served Pool"}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                  {isAdmin ? "Team Lead Routing" : "Realtime Atomic Claiming"}
                </span>
              </div>
              <h2 style={{ fontSize: "17px", fontWeight: 650, margin: "0 0 6px" }}>
                {openPoolList.length} Unassigned Leads Ready for {isAdmin ? "Distribution" : "Grabbing"}
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                {isAdmin
                  ? "Incoming leads imported via Google Sheets, WhatsApp relays, CSV files, and Inbound Webhooks. You can assign each lead directly to a specific closer or auto-distribute them to the team via Round-Robin."
                  : "Leads imported via Google Sheets, WhatsApp relays, CSV files, and Inbound Webhooks wait here. When you click Grab Lead Now, it is atomically assigned to your CRM pipeline in the New Lead stage."}
              </p>
            </div>

            {isAdmin ? (
              <div className="pool-quota-card" style={{ minWidth: "300px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    TEAM DISTRIBUTION
                  </span>
                  <span
                    className="pill"
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                    }}
                  >
                    Active Routing
                  </span>
                </div>
                <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", margin: "4px 0 8px", lineHeight: 1.4 }}>
                  Assign leads individually below or auto-distribute across all active closers evenly.
                </p>
                <button
                  type="button"
                  className="btn"
                  data-variant="primary"
                  onClick={handleAutoDistributeAll}
                  disabled={isDistributing || openPoolList.length === 0}
                  style={{ width: "100%", justifyContent: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}
                >
                  <Icon name={isDistributing ? "refresh" : "zap"} size={13} className={isDistributing ? "spin" : ""} />
                  {isDistributing ? "Distributing leads..." : "⚡ Auto-Distribute (Round-Robin)"}
                </button>
              </div>
            ) : (
              <div className="pool-quota-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    YOUR ACTIVE CAPACITY
                  </span>
                  <span
                    className="pill"
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      background: isAtQuota ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                      color: isAtQuota ? "#ef4444" : "#10b981",
                    }}
                  >
                    {isAtQuota ? "⚠️ Quota Full" : `✅ ${Math.max(0, myCap - myActiveLeads)} grabs left`}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ fontSize: "20px", fontWeight: 700 }}>{myActiveLeads}</span>
                  <span style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>/ {myCap} max active leads</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: "6px", width: "100%", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (myActiveLeads / myCap) * 100)}%`,
                      background: isAtQuota ? "#ef4444" : "var(--accent)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                  Admin controlled: {closerName} (Cap: {myCap} leads)
                </div>
              </div>
            )}
          </div>

          {/* Filter Toolbar for Pool */}
          <div className="pipe-toolbar">
            <div className="pipe-search">
              <Icon name="search" size={14} />
              <input
                value={poolQuery}
                onChange={(e) => setPoolQuery(e.target.value)}
                placeholder="Search open leads by customer name, phone, email, inquiry..."
                aria-label="Search pool leads"
              />
              {poolQuery ? (
                <button className="icon-btn" onClick={() => setPoolQuery("")} aria-label="Clear search">
                  <Icon name="close" size={13} />
                </button>
              ) : null}
            </div>

            <select
              className="select pipe-select"
              value={poolSource}
              onChange={(e) => setPoolSource(e.target.value)}
              aria-label="Filter pool by source"
            >
              <option value="">All Ingestion Sources</option>
              <option value="Google Sheets">Google Sheets</option>
              <option value="WhatsApp">WhatsApp API / Relays</option>
              <option value="Excel">Excel / CSV Batches</option>
              <option value="Website">Website Webhooks</option>
              <option value="IndiaMART">IndiaMART</option>
              <option value="Justdial">Justdial</option>
            </select>

            <span className="col-w-label">
              Showing {openPoolList.length} leads
            </span>
          </div>

          {/* Lead Cards Grid */}
          {openPoolList.length > 0 ? (
            <div className="pool-grid">
              {openPoolList.map((item) => {
                const src = sourceMeta(item.source || "Google Sheets");
                const isClaiming = claimingId === item.id;
                const isDisappearing = disappearedIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="pool-card"
                    data-disappearing={isDisappearing}
                  >
                    <div>
                      {/* Top Row: Source badge + Name + Arrived */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="stage-icon-badge" data-tone={src.tone}>
                            <Icon name={src.icon} size={15} />
                          </span>
                          <div>
                            <h3 style={{ fontSize: "14px", fontWeight: 650, margin: 0, color: "var(--text)" }}>
                              {item.customerName || "Customer Lead"}
                            </h3>
                            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                              {item.segment || "SMB Lead"}
                            </span>
                          </div>
                        </div>
                        <span
                          className="chip"
                          data-tone={src.tone}
                          style={{ fontSize: "10px", padding: "2px 6px" }}
                        >
                          <Icon name={src.icon} size={10} /> {src.label}
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "10px 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                        {item.customerPhone ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Icon name="phone" size={12} style={{ color: "var(--text-tertiary)" }} />
                            <span style={{ fontFamily: "monospace", fontWeight: 550 }}>
                              {item.customerPhone}
                            </span>
                            <a
                              href={`https://wa.me/${item.customerPhone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Chat on WhatsApp"
                              style={{ color: "#25D366", marginLeft: "4px", display: "inline-flex" }}
                            >
                              <Icon name="whatsapp" size={13} />
                            </a>
                          </div>
                        ) : null}

                        {item.customerEmail ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Icon name="mail" size={12} style={{ color: "var(--text-tertiary)" }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.customerEmail}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Inquiry Service Interest */}
                      <div
                        style={{
                          background: "var(--bg-soft)",
                          padding: "8px 10px",
                          borderRadius: "var(--r-sm)",
                          fontSize: "12px",
                          color: "var(--text)",
                          marginBottom: "12px",
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600, marginBottom: "2px" }}>
                          Inquiry / Requirement:
                        </div>
                        {item.serviceInterest || "Direct Enquiry imported from Google Sheet / Inbound channel"}
                      </div>
                    </div>

                    {/* Footer Row: Assign to Closer (Admin) vs Grab Lead (Closer) -- Deal Budget Removed */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid var(--border)", marginTop: "auto", gap: "10px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {item.createdAt ? `Imported ${relativeTime(item.createdAt)}` : "Unassigned"}
                      </span>

                      {isAdmin ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <select
                            className="select"
                            style={{ height: "30px", fontSize: "12px", padding: "0 8px", minWidth: "150px" }}
                            disabled={isClaiming}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignLead(item, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            aria-label="Assign lead to closer"
                          >
                            <option value="" disabled>Assign to Closer ▾</option>
                            {availableClosers.map((closer) => (
                              <option key={closer} value={closer}>
                                {closer}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <button
                          className="btn"
                          data-variant="primary"
                          disabled={isClaiming || isAtQuota}
                          onClick={() => handleClaimLead(item)}
                          style={{
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            opacity: isAtQuota ? 0.6 : 1,
                          }}
                          title={isAtQuota ? `Active lead cap reached (${myActiveLeads}/${myCap}). Resolve deals to grab more.` : "Click to claim lead into your pipeline"}
                        >
                          {isClaiming ? (
                            <>
                              <Icon name="refresh" size={13} className="spin" /> Grabbing...
                            </>
                          ) : isAtQuota ? (
                            <>
                              <Icon name="alert-circle" size={13} /> Quota Full
                            </>
                          ) : (
                            <>
                              <Icon name="zap" size={13} /> Grab Lead Now
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty" style={{ margin: "40px auto" }}>
              <span className="empty-icon">
                <Icon name="check-circle" size={24} style={{ color: "#10b981" }} />
              </span>
              <h3>All Open Leads Claimed</h3>
              <p style={{ maxWidth: "420px" }}>
                There are currently no unclaimed leads in the Grab Pool. New leads synced from Google Sheets, WhatsApp, or CSV imports will appear here automatically.
              </p>
              <button className="btn" data-variant="primary" onClick={() => setViewMode("board")}>
                <Icon name="kanban" size={14} /> View Kanban Board
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="pipe-toolbar">
            <div className="pipe-search">
              <Icon name="search" size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, company, CLO id, phone…"
                aria-label="Search leads"
              />
              {query ? (
                <button className="icon-btn" onClick={() => setQuery("")} aria-label="Clear search">
                  <Icon name="close" size={13} />
                </button>
              ) : null}
            </div>

            <select
              className="select pipe-select"
              value={source}
              onChange={(e) => setSource(e.target.value as Source | "")}
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceMeta(s).label}
                </option>
              ))}
            </select>

            <select
              className="select pipe-select"
              value={segment}
              onChange={(e) => setSegment(e.target.value as Segment | "")}
              aria-label="Filter by segment"
            >
              <option value="">All segments</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="seg pipe-sort" role="group" aria-label="Sort cards">
              <button data-on={sort === "recent"} onClick={() => setSort("recent")} aria-pressed={sort === "recent"}>
                <Icon name="clock" size={12} /> Recent
              </button>

              <button data-on={sort === "priority"} onClick={() => setSort("priority")} aria-pressed={sort === "priority"}>
                <Icon name="priority-high" size={12} /> Priority
              </button>
            </div>

            <span className="col-w-label">{state.colWidth}px columns</span>
          </div>

          <div className="chip-row">
            {source ? (
              <span className="chip-x">
                Source <b>{sourceMeta(source).label}</b>
                <button className="x" onClick={() => setSource("")} aria-label="Clear source filter">
                  <Icon name="close" size={11} />
                </button>
              </span>
            ) : null}
            {segment ? (
              <span className="chip-x">
                Segment <b>{segment}</b>
                <button className="x" onClick={() => setSegment("")} aria-label="Clear segment filter">
                  <Icon name="close" size={11} />
                </button>
              </span>
            ) : null}
            {query ? (
              <span className="chip-x">
                Text <b>{query}</b>
                <button className="x" onClick={() => setQuery("")} aria-label="Clear search">
                  <Icon name="close" size={11} />
                </button>
              </span>
            ) : null}
            {hasFilters ? (
              <button className="btn" data-size="sm" onClick={clearFilters}>
                Clear all
              </button>
            ) : (
              <span className="hint">No filters — the whole board is in view.</span>
            )}
          </div>

          <div className="board" data-fit={fit} role="list" aria-label="Lead pipeline board" ref={boardRef}>
            {STAGES.map((stage, stageIndex) => {
              const cards = byStage.get(stage.id) ?? [];
              const total = cards.reduce((s, l) => s + l.value, 0);
              return (
                <div
                  key={stage.id}
                  className="col"
                  data-over={overStage === stage.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overStage !== stage.id) setOverStage(stage.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || dragging;
                    if (id) moveLead(id, stage.id);
                    setDragging(null);
                    setOverStage(null);
                  }}
                  aria-label={`${stage.label}, ${cards.length} leads`}
                  role="listitem"
                >
                  <header className="col-head">
                    <h2 className="col-title">
                      <span className="stage-icon-badge" data-tone={stage.tone}><Icon name={stage.icon} size={15} /></span>
                      {stage.label}
                    </h2>
                    <span className="col-count">{cards.length}</span>
                    <button
                      className="icon-btn col-add"
                      onClick={() => setAddStage(stage.id)}
                      aria-label={`Add lead to ${stage.label}`}
                      title={`Add lead to ${stage.label}`}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                    <button
                      className="icon-btn col-add"
                      onClick={() => setLayout({ colWidth: state.colWidth })}
                      aria-label={`${stage.label} column options`}
                      title="Columns resize together — drag a divider"
                      style={{ opacity: 1 }}
                    >
                      <Icon name="more" size={14} />
                    </button>
                  </header>
                  

                  <div className="col-cards">
                    {cards.map((lead) => {
                      const overdue = isOverdue(lead.followUp) && lead.stage !== "won" && lead.stage !== "lost";
                      const src = sourceMeta(lead.source);
                      return (
                        <div
                          key={lead.id}
                          className="card lead"
                          data-lead={lead.id}
                          draggable
                          data-dragging={dragging === lead.id}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", lead.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragging(lead.id);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setOverStage(null);
                          }}
                          tabIndex={0}
                          role="button"
                          onClick={() => setSelected(lead.id)}
                          onKeyDown={(e) => onCardKeyDown(e, lead, stageIndex)}
                        >
                          <div className="lead-top">
                            <span className="stage-icon-badge" data-tone={src.tone} title={`Lead source: ${src.label}`}>
                              <Icon name={src.icon} size={15} />
                            </span>
                            <h3 className="lead-name">{lead.name}</h3>
                            <Icon
                              name={PRIORITY_ICON[lead.priority] as never}
                              size={13}
                              className="prio"
                              data-priority={lead.priority}
                            />
                          </div>
                          <p className="lead-company">
                            <Icon name="building" size={12} /> {lead.company}
                          </p>
                          <div className="lead-meta">
                            <span className="chip" data-tone={src.tone}>
                              <Icon name={src.icon} size={11} /> {src.label}
                            </span>
                            <span className="pill">
                              <Icon name="layers" size={11} /> {lead.segment}
                            </span>
                          </div>
                          <div className="lead-foot">
                            <span className={`mini-avatar ${lead.owner === "Unassigned" ? "is-empty" : ""}`}>
                              {lead.owner === "Unassigned" ? "?" : lead.owner.slice(0, 1)}
                            </span>
                            <span className="lead-owner">{lead.owner}</span>
                            <span className="lead-code">{lead.code}</span>
                            
                            <span className="lead-sla" data-overdue={overdue}>
                              {overdue ? <Icon name="flame" size={11} /> : null}
                              {slaLabel(lead.followUp)}
                            </span>
                          </div>
                          {lead.owner === "Unassigned" && (
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
                              <button
                                className="btn"
                                data-variant="accent"
                                data-size="sm"
                                style={{ width: "100%", height: 22, fontSize: 10, padding: "0 6px" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  claimLead(lead.id, closerName);
                                }}
                              >
                                <Icon name="zap" size={11} /> Grab Lead (SLA Pool)
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!cards.length ? (
                      <button className="col-empty" onClick={() => setAddStage(stage.id)}>
                        <Icon name="plus" size={13} /> Add a lead
                      </button>
                    ) : null}
                  </div>

                  <ResizeHandle
                    label={`Resize ${stage.label} column`}
                    resetTo={288}
                    min={LIMITS.col[0]}
                    max={LIMITS.col[1]}
                    getWidth={() => state.colWidth}
                    setWidth={(colWidth) => setLayout({ colWidth })}
                  />
                </div>
              );
            })}
          </div>

          {!filtered.length ? (
            <div className="empty">
              <span className="empty-icon">
                <Icon name="inbox" size={18} />
              </span>
              <h3>No leads match this view</h3>
              <p>Try a different search, or clear the filters to see the whole pipeline.</p>
              <button className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : null}

          <p className="hint">
            {relativeTime(new Date().toISOString())} · tip: focus a card and press ⇧ ← → to move the
            stage, Enter to open, Esc to close.
          </p>
        </>
      )}

      {active ? <LeadDrawer lead={active} onClose={() => setSelected(null)} /> : null}
      {addStage ? <AddLeadDialog defaultStage={addStage} onClose={() => setAddStage(null)} /> : null}
    </div>
  );
}
