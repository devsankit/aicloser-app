"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { LeadDrawer } from "@/components/pipeline/LeadDrawer";
import { compactMoney, relativeTime, useApp, useScopedLeads } from "@/lib/store";
import { PRIORITY_ICON, PRIORITY_LABEL, STAGES, stageMeta, type StageId } from "@/lib/types";

type SortKey = "name" | "value" | "updated";

export function ContactsView() {
  const { updateLead, deleteLead } = useApp();
  const leads = useScopedLeads();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageId | "">("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [collapsed, setCollapsed] = useState<Set<StageId>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = leads.filter((l) => {
      if (stage && l.stage !== stage) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.owner.toLowerCase().includes(q)
      );
    });
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "value") return b.value - a.value;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [leads, query, stage, sort]);

  const groups = useMemo(
    () =>
      STAGES.map((meta) => ({ meta, items: rows.filter((l) => l.stage === meta.id) })).filter(
        (g) => g.items.length > 0,
      ),
    [rows],
  );

  /** Flat order used by j/k so the cursor walks across group boundaries. */
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (selected) return; // drawer owns the keyboard while open

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, flat.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        const lead = flat[cursor];
        if (lead) {
          e.preventDefault();
          setSelected(lead.id);
        }
      } else if (e.key === "x") {
        const lead = flat[cursor];
        if (lead) {
          e.preventDefault();
          setSelection((prev) => {
            const next = new Set(prev);
            if (next.has(lead.id)) next.delete(lead.id);
            else next.add(lead.id);
            return next;
          });
        }
      } else if (e.key === "Escape") {
        setSelection(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, flat, selected]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const total = rows.reduce((s, l) => s + l.value, 0);
  const active = leads.find((l) => l.id === selected) ?? null;

  const toggleGroup = (id: StageId) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkMove = (to: StageId) => {
    for (const id of selection) updateLead(id, { stage: to });
    setSelection(new Set());
  };

  let index = -1;

  return (
    <div>
      <header className="page-head">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-sub">
            {rows.length} people · {compactMoney(total)} total value · press <span className="kbd">J</span>{" "}
            <span className="kbd">K</span> to move, <span className="kbd">X</span> to select
          </p>
        </div>
        <div className="page-actions">
          <select
            className="select pipe-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort contacts"
          >
            <option value="updated">Sort: last activity</option>
            <option value="name">Sort: name</option>
            <option value="value">Sort: deal value</option>
          </select>
          <button className="btn">
            <Icon name="download" size={14} /> Export
          </button>
        </div>
      </header>

      <div className="pipe-toolbar" style={{ marginBottom: 10 }}>
        <div className="pipe-search">
          <Icon name="search" size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, CLO id, owner…"
            aria-label="Search contacts"
          />
          {query ? (
            <button className="icon-btn" onClick={() => setQuery("")} aria-label="Clear search">
              <Icon name="close" size={13} />
            </button>
          ) : null}
        </div>
        <select
          className="select pipe-select"
          value={stage}
          onChange={(e) => setStage(e.target.value as StageId | "")}
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="chip-row" style={{ marginBottom: 10 }}>
        {stage ? (
          <span className="chip-x">
            Status <b>{stageMeta(stage).label}</b>
            <button className="x" onClick={() => setStage("")} aria-label="Clear stage filter">
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
        {!stage && !query ? <span className="hint">No filters applied.</span> : null}
      </div>

      {selection.size ? (
        <div className="bulk">
          <span>
            <b>{selection.size}</b> selected
          </span>
          <select
            className="select"
            value=""
            onChange={(e) => e.target.value && bulkMove(e.target.value as StageId)}
            aria-label="Move selected leads to stage"
          >
            <option value="">Move to…</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="btn"
            data-size="sm"
            data-variant="danger"
            onClick={() => {
              for (const id of selection) deleteLead(id);
              setSelection(new Set());
            }}
          >
            <Icon name="trash" size={13} /> Delete
          </button>
          <button className="btn" data-size="sm" onClick={() => setSelection(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="list" ref={listRef}>
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.meta.id);
          return (
            <div key={group.meta.id}>
              <button
                className="list-group-head"
                aria-expanded={!isCollapsed}
                onClick={() => toggleGroup(group.meta.id)}
              >
                <span className="sg" data-status={group.meta.status}>
                  <Icon name={`status-${group.meta.status}`} size={14} />
                </span>
                {group.meta.label}
                <span className="list-group-count">{group.items.length}</span>
                <Icon
                  name={isCollapsed ? "chevron-right" : "chevron-down"}
                  size={13}
                  className="chev"
                />
              </button>

              {!isCollapsed
                ? group.items.map((lead) => {
                    index += 1;
                    const idx = index;
                    const isSelected = selection.has(lead.id);
                    return (
                      <div
                        key={lead.id}
                        data-idx={idx}
                        data-selected={cursor === idx || isSelected}
                        className="list-row"
                        role="button"
                        tabIndex={0}
                        onMouseMove={() => setCursor(idx)}
                        onClick={() => setSelected(lead.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setSelected(lead.id);
                        }}
                      >
                        <span className="list-id">{lead.code}</span>
                        <span className="sg" data-status={group.meta.status}>
                          <Icon name={`status-${group.meta.status}`} size={14} />
                        </span>
                        <span className="list-title">
                          <strong>{lead.name}</strong>
                          <span>{lead.company}</span>
                        </span>
                        <span className="list-cell">{lead.source}</span>
                        <span className="list-cell th-num">{compactMoney(lead.value)}</span>
                        <span className="list-avatar">
                          <span
                            className={`mini-avatar ${lead.owner === "Unassigned" ? "is-empty" : ""}`}
                          >
                            {lead.owner === "Unassigned" ? "?" : lead.owner.slice(0, 1)}
                          </span>
                          <span className="list-cell">{lead.owner}</span>
                        </span>
                        <span className="list-cell hide-sm">{relativeTime(lead.updatedAt)}</span>
                        <span className="list-avatar hide-sm" style={{ marginLeft: "auto" }}>
                          <Icon
                            name={PRIORITY_ICON[lead.priority] as never}
                            size={13}
                            className="prio"
                            data-priority={lead.priority}
                            aria-label={PRIORITY_LABEL[lead.priority]}
                          />
                        </span>
                      </div>
                    );
                  })
                : null}
            </div>
          );
        })}

        {!rows.length ? (
          <div className="empty">
            <span className="empty-icon">
              <Icon name="users" size={18} />
            </span>
            <h3>No contacts found</h3>
            <p>Nothing matches the current search or status filter.</p>
            <button
              className="btn"
              onClick={() => {
                setQuery("");
                setStage("");
              }}
            >
              Reset filters
            </button>
          </div>
        ) : null}
      </div>

      {active ? <LeadDrawer lead={active} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
