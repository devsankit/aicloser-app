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
  type Segment,
  type Source,
  type StageId,
} from "@/lib/types";
import { LeadDrawer } from "./LeadDrawer";
import { AddLeadDialog } from "./AddLeadDialog";

type SortKey = "recent" | "value" | "priority";

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function PipelineView() {
  const { state, moveLead, setLayout } = useApp();
  const scoped = useScopedLeads();
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
          <h1 className="page-title">Pipeline</h1>
          <p className="page-sub">
            {filtered.length} leads ·{" "}
            <span title={`Exact open pipeline value: ${money(openValue)}`}>
              {compactMoney(openValue)}
            </span>{" "}
            open · drag a card or select it and press ⇧ ← →
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setFit((f) => !f)} aria-pressed={fit}>
            <Icon name="panel" size={14} /> {fit ? "Fixed columns" : "Fit board"}
          </button>
          <button className="btn" data-variant="primary" onClick={() => setAddStage("new")}>
            <Icon name="pencil" size={14} /> New lead
          </button>
        </div>
      </header>

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
          <button data-on={sort === "value"} onClick={() => setSort("value")} aria-pressed={sort === "value"}>
            <Icon name="graph" size={12} /> Value
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
              <p className="col-value" title={`Exact stage total: ${money(total)}`}>{total ? compactMoney(total) : "—"}</p>

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
                        <span className="lead-value" title={`Exact deal value: ${money(lead.value)}`}>{compactMoney(lead.value)}</span>
                        <span className="lead-sla" data-overdue={overdue}>
                          {overdue ? <Icon name="flame" size={11} /> : null}
                          {slaLabel(lead.followUp)}
                        </span>
                      </div>
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

      {active ? <LeadDrawer lead={active} onClose={() => setSelected(null)} /> : null}
      {addStage ? <AddLeadDialog defaultStage={addStage} onClose={() => setAddStage(null)} /> : null}
    </div>
  );
}
