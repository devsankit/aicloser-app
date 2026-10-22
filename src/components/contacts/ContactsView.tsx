"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LeadDrawer } from "@/components/pipeline/LeadDrawer";
import { AddLeadDialog } from "@/components/pipeline/AddLeadDialog";
import { compactMoney, relativeTime, useApp, useScopedLeads } from "@/lib/store";
import {
  PRIORITY_ICON,
  PRIORITY_LABEL,
  STAGES,
  stageMeta,
  sourceMeta,
  type StageId,
  type Lead,
} from "@/lib/types";

type SortKey = "name" | "value" | "updated";

export type ContactColumnId =
  | "contact"
  | "stage"
  | "phone"
  | "notes"
  | "callback"
  | "owner"
  | "value"
  | "source"
  | "email"
  | "tags"
  | "updatedAt";

export interface ContactColumnDef {
  id: ContactColumnId;
  label: string;
  description: string;
  alwaysVisible?: boolean;
}

export const CONTACT_COLUMNS: ContactColumnDef[] = [
  { id: "contact", label: "Lead / Contact", description: "Name, company, and lead code", alwaysVisible: true },
  { id: "stage", label: "Stage / Status", description: "Quick inline stage selector" },
  { id: "phone", label: "Phone", description: "Phone number with quick call" },
  { id: "notes", label: "Notes", description: "Latest notes & communication logs" },
  { id: "callback", label: "Next Callback", description: "Follow-up schedule and SLA badge" },
  { id: "owner", label: "Assigned Closer", description: "Assigned sales rep" },
  { id: "value", label: "Deal Value", description: "Estimated lead budget" },
  { id: "source", label: "Source", description: "Lead acquisition channel" },
  { id: "email", label: "Email", description: "Customer email address" },
  { id: "tags", label: "Tags", description: "Custom tags & badges" },
  { id: "updatedAt", label: "Last Activity", description: "Relative time since last update" },
];

const STORAGE_KEY = "aicloser_contacts_visible_cols_v2";
const VIEW_MODE_KEY = "aicloser_contacts_view_mode_v1";

const DEFAULT_COLUMNS: ContactColumnId[] = [
  "contact",
  "stage",
  "phone",
  "notes",
  "callback",
  "owner",
  "value",
  "updatedAt",
];

const PRIO_CYCLE: Record<Priority, Priority> = {
  low: "medium",
  medium: "high",
  high: "urgent",
  urgent: "low",
};

function formatCallbackInfo(followUpIso?: string) {
  if (!followUpIso) return null;
  const d = new Date(followUpIso);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (diffMs < 0 && !isToday) {
    return {
      text: `Overdue: ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`,
      tone: "danger" as const,
      icon: "alert-circle" as IconName,
      title: `Overdue since ${d.toLocaleString()}`,
    };
  }

  if (isToday) {
    return {
      text: `Today at ${timeStr}`,
      tone: "warning" as const,
      icon: "clock" as IconName,
      title: `Scheduled for today at ${timeStr}`,
    };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) {
    return {
      text: `Tomorrow at ${timeStr}`,
      tone: "info" as const,
      icon: "calendar-clock" as IconName,
      title: `Scheduled for tomorrow at ${timeStr}`,
    };
  }

  return {
    text: d.toLocaleDateString([], { month: "short", day: "numeric" }),
    tone: "neutral" as const,
    icon: "calendar" as IconName,
    title: `Follow-up on ${d.toLocaleString()}`,
  };
}

export function ContactsView() {
  const { moveLead, updateLead, deleteLead } = useApp();
  const leads = useScopedLeads();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageId | "">("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [collapsed, setCollapsed] = useState<Set<StageId>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Column preferences
  const [visibleColumns, setVisibleColumns] = useState<ContactColumnId[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_COLUMNS;
  });

  // View mode: Table View (default) vs Grouped View
  const [viewMode, setViewMode] = useState<"table" | "grouped">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(VIEW_MODE_KEY);
        if (saved === "table" || saved === "grouped") return saved;
      } catch {}
    }
    return "table";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const urlQ = sp.get("search") || sp.get("q");
      if (urlQ) setQuery(urlQ);
    }
  }, []);

  // Close column popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    };
    if (showColPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showColPicker]);

  // Auto clear toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const updateVisibleColumns = (cols: ContactColumnId[]) => {
    setVisibleColumns(cols);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
      } catch {}
    }
  };

  const toggleColumn = (id: ContactColumnId) => {
    if (id === "contact") return; // Primary column cannot be disabled
    if (visibleColumns.includes(id)) {
      updateVisibleColumns(visibleColumns.filter((c) => c !== id));
    } else {
      updateVisibleColumns([...visibleColumns, id]);
    }
  };

  const resetColumns = () => {
    updateVisibleColumns(DEFAULT_COLUMNS);
  };

  const setView = (mode: "table" | "grouped") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(VIEW_MODE_KEY, mode);
      } catch {}
    }
  };

  const handleStageChange = (leadId: string, nextStage: StageId, leadName?: string) => {
    moveLead(leadId, nextStage);
    updateLead(leadId, { stage: nextStage });
    setToastMessage(`Moved ${leadName || "lead"} to ${stageMeta(nextStage).label}`);
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const filtered = leads.filter((l) => {
      if (stage && l.stage !== stage) return false;
      if (!q) return true;
      const leadPhoneDigits = (l.phone || "").replace(/\D/g, "");
      const phoneMatches =
        l.phone.includes(q) ||
        (qDigits.length >= 4 && leadPhoneDigits.includes(qDigits));
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        phoneMatches ||
        l.owner.toLowerCase().includes(q) ||
        (l.notes && l.notes.toLowerCase().includes(q))
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

  const flat = useMemo(() => (viewMode === "grouped" ? groups.flatMap((g) => g.items) : rows), [viewMode, groups, rows]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (selected) return;

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
    for (const id of selection) {
      moveLead(id, to);
      updateLead(id, { stage: to });
    }
    setToastMessage(`Moved ${selection.size} leads to ${stageMeta(to).label}`);
    setSelection(new Set());
  };

  const handleExportCsv = () => {
    if (!rows.length) return;
    const headers = [
      "Code",
      "Name",
      "Company",
      "Phone",
      "Email",
      "Stage",
      "Value",
      "Owner",
      "FollowUp",
      "Notes",
      "Tags",
      "UpdatedAt",
    ];
    const csvRows = [headers.join(",")];
    for (const r of rows) {
      csvRows.push(
        [
          `"${r.code || ""}"`,
          `"${(r.name || "").replace(/"/g, '""')}"`,
          `"${(r.company || "").replace(/"/g, '""')}"`,
          `"${r.phone || ""}"`,
          `"${r.email || ""}"`,
          `"${r.stage || ""}"`,
          r.value || 0,
          `"${(r.owner || "").replace(/"/g, '""')}"`,
          `"${r.followUp || ""}"`,
          `"${(r.notes || "").replace(/"/g, '""')}"`,
          `"${(r.tags || []).join("; ")}"`,
          `"${r.updatedAt || ""}"`,
        ].join(","),
      );
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `closer-contacts-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isColVisible = (id: ContactColumnId) => visibleColumns.includes(id);

  let flatIndex = -1;

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
          {/* View Mode Toggle */}
          <div className="seg">
            <button
              type="button"
              data-on={viewMode === "table"}
              onClick={() => setView("table")}
              title="Table View with customizable columns"
            >
              <Icon name="kanban" size={13} /> Table
            </button>
            <button
              type="button"
              data-on={viewMode === "grouped"}
              onClick={() => setView("grouped")}
              title="Grouped by stages"
            >
              <Icon name="layers" size={13} /> Grouped
            </button>
          </div>

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
          <button className="btn" onClick={handleExportCsv}>
            <Icon name="download" size={14} /> Export
          </button>
          <button className="btn" data-variant="primary" onClick={() => setShowAddLead(true)}>
            <Icon name="plus" size={14} /> Add lead
          </button>
        </div>
      </header>

      {/* Toolbar with Search, Filter & Flexible Column Selector */}
      <div className="pipe-toolbar" style={{ marginBottom: 10 }}>
        <div className="pipe-search">
          <Icon name="search" size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, CLO id, phone, notes…"
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

        {/* Flexible Column Customization Popover */}
        <div className="col-picker-wrap" ref={colPickerRef}>
          <button
            type="button"
            className="btn"
            data-size="sm"
            onClick={() => setShowColPicker((v) => !v)}
            aria-expanded={showColPicker}
            aria-haspopup="dialog"
            title="Customize which columns appear in the table view"
          >
            <Icon name="sliders" size={13} />
            <span>Columns</span>
            <span className="chip" data-tone="neutral" data-size="sm">
              {visibleColumns.length}/{CONTACT_COLUMNS.length}
            </span>
          </button>

          {showColPicker && (
            <div className="col-popover" role="dialog" aria-label="Customize columns">
              <div className="col-popover-head">
                <div>
                  <div className="col-popover-title">Table Columns</div>
                  <div className="col-popover-sub">Select information to show in table view</div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowColPicker(false)}
                  aria-label="Close column picker"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>

              <div className="col-list">
                {CONTACT_COLUMNS.map((col) => {
                  const checked = visibleColumns.includes(col.id);
                  return (
                    <label key={col.id} className="col-option">
                      <div>
                        <div className="col-option-name">{col.label}</div>
                        <div className="col-option-desc">{col.description}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={col.alwaysVisible}
                        onChange={() => toggleColumn(col.id)}
                      />
                    </label>
                  );
                })}
              </div>

              <div className="col-popover-foot">
                <button
                  type="button"
                  className="btn"
                  data-size="sm"
                  data-variant="ghost"
                  onClick={resetColumns}
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  className="btn"
                  data-size="sm"
                  data-variant="primary"
                  onClick={() => setShowColPicker(false)}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter summary chips */}
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
            Search <b>{query}</b>
            <button className="x" onClick={() => setQuery("")} aria-label="Clear search">
              <Icon name="close" size={11} />
            </button>
          </span>
        ) : null}
        {visibleColumns.length < CONTACT_COLUMNS.length ? (
          <span className="chip" data-tone="neutral" data-size="sm">
            {visibleColumns.length} of {CONTACT_COLUMNS.length} columns active
          </span>
        ) : null}
        {!stage && !query && visibleColumns.length === CONTACT_COLUMNS.length ? (
          <span className="hint">All columns visible.</span>
        ) : null}
      </div>

      {/* Bulk actions */}
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
            <option value="">Move selected to…</option>
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

      {/* View 1: Customizable Table View */}
      {viewMode === "table" ? (
        <div className="table-wrap" ref={listRef}>
          <table className="table table-full">
            <thead>
              <tr>
                <th className="table-col-check">
                  <input
                    type="checkbox"
                    aria-label="Select all contacts"
                    checked={rows.length > 0 && selection.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelection(new Set(rows.map((r) => r.id)));
                      else setSelection(new Set());
                    }}
                  />
                </th>
                <th className="table-col-prio">Prio</th>
                {isColVisible("contact") && <th className="table-col-contact">Lead / Contact</th>}
                {isColVisible("stage") && <th className="table-col-stage">Stage / Status</th>}
                {isColVisible("phone") && <th className="table-col-phone">Phone</th>}
                {isColVisible("notes") && <th style={{ minWidth: 190 }}>Notes</th>}
                {isColVisible("callback") && <th style={{ minWidth: 140 }}>Next Callback</th>}
                {isColVisible("owner") && <th className="table-col-owner">Assigned Closer</th>}
                {isColVisible("value") && <th className="table-col-value">Deal Value</th>}
                {isColVisible("source") && <th style={{ minWidth: 110 }}>Source</th>}
                {isColVisible("email") && <th style={{ minWidth: 150 }}>Email</th>}
                {isColVisible("tags") && <th style={{ minWidth: 120 }}>Tags</th>}
                {isColVisible("updatedAt") && (
                  <th style={{ minWidth: 90, textAlign: "right" }}>Last Activity</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((lead, idx) => {
                const isSelected = selection.has(lead.id);
                const src = sourceMeta(lead.source);
                const callbackInfo = formatCallbackInfo(lead.followUp);

                return (
                  <tr
                    key={lead.id}
                    data-idx={idx}
                    data-selected={cursor === idx || isSelected}
                    onClick={() => setSelected(lead.id)}
                    tabIndex={0}
                    onMouseMove={() => setCursor(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setSelected(lead.id);
                    }}
                  >
                    {/* Checkbox */}
                    <td
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 38, textAlign: "center" }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.name}`}
                        checked={isSelected}
                        onChange={() => {
                          setSelection((prev) => {
                            const next = new Set(prev);
                            if (next.has(lead.id)) next.delete(lead.id);
                            else next.add(lead.id);
                            return next;
                          });
                        }}
                      />
                    </td>

                    {/* Priority */}
                    <td style={{ width: 34, textAlign: "center" }}>
                      <button
                        type="button"
                        className="list-prio"
                        aria-label={`Change priority from ${PRIORITY_LABEL[lead.priority]}`}
                        title={`Priority: ${PRIORITY_LABEL[lead.priority]} · Click to change`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextPrio = PRIO_CYCLE[lead.priority] || "medium";
                          updateLead(lead.id, { priority: nextPrio });
                          setToastMessage(`Updated ${lead.name} priority to ${PRIORITY_LABEL[nextPrio]}`);
                        }}
                      >
                        <Icon
                          name={PRIORITY_ICON[lead.priority] as never}
                          size={14}
                          className="prio"
                          data-priority={lead.priority}
                          aria-label={PRIORITY_LABEL[lead.priority]}
                        />
                      </button>
                    </td>

                    {/* Lead / Contact */}
                    {isColVisible("contact") && (
                      <td>
                        <div className="cell-person">
                          <div>
                            <div className="cell-name">{lead.name}</div>
                            <span className="cell-sub">
                              {lead.code} · {lead.company || "Direct Inquiry"}
                            </span>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Quick Inline Stage / Status Dropdown */}
                    {isColVisible("stage") && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <label
                          className="stage-badge-select"
                          data-tone={stageMeta(lead.stage).tone}
                          title={`Stage: ${stageMeta(lead.stage).label} (Click to change)`}
                        >
                          <span className="stage-badge-dot" />
                          <select
                            value={lead.stage}
                            onChange={(e) => {
                              const nextStage = e.target.value as StageId;
                              handleStageChange(lead.id, nextStage, lead.name);
                            }}
                            aria-label={`Change stage for ${lead.name}`}
                          >
                            {STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <span className="stage-badge-chevron">
                            <Icon name="chevron-down" size={10} />
                          </span>
                        </label>
                      </td>
                    )}

                    {/* Phone */}
                    {isColVisible("phone") && (
                      <td onClick={(e) => e.stopPropagation()}>
                        {lead.phone ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <a
                              href={`tel:${lead.phone}`}
                              className="cell-muted"
                              style={{ fontFamily: "var(--mono)", textDecoration: "none" }}
                              title={`Call ${lead.phone}`}
                            >
                              {lead.phone}
                            </a>
                            <a
                              href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="icon-btn"
                              style={{ width: 20, height: 20 }}
                              title="Chat on WhatsApp"
                            >
                              <Icon name="whatsapp" size={11} />
                            </a>
                          </div>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                    )}

                    {/* Notes */}
                    {isColVisible("notes") && (
                      <td>
                        {lead.notes ? (
                          <div className="contact-note-cell" title={lead.notes}>
                            <Icon name="message" size={12} className="note-icon" />
                            <span className="note-text">{lead.notes}</span>
                          </div>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                    )}

                    {/* Next Callback / SLA */}
                    {isColVisible("callback") && (
                      <td>
                        {callbackInfo ? (
                          <span
                            className="chip"
                            data-tone={callbackInfo.tone}
                            data-size="sm"
                            title={callbackInfo.title}
                          >
                            <Icon name={callbackInfo.icon} size={11} />
                            <span>{callbackInfo.text}</span>
                          </span>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                    )}

                    {/* Assigned Closer */}
                    {isColVisible("owner") && (
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span
                            className={`mini-avatar ${lead.owner === "Unassigned" ? "is-empty" : ""}`}
                          >
                            {lead.owner === "Unassigned" ? "?" : lead.owner.slice(0, 1)}
                          </span>
                          <span className="cell-muted">{lead.owner}</span>
                        </div>
                      </td>
                    )}

                    {/* Deal Value */}
                    {isColVisible("value") && (
                      <td style={{ fontWeight: 550, fontFamily: "var(--mono)" }}>
                        {compactMoney(lead.value)}
                      </td>
                    )}

                    {/* Source Channel */}
                    {isColVisible("source") && (
                      <td>
                        <span className="linear-tag" data-tone={src.tone}>
                          <Icon name={src.icon} size={11} /> {src.label}
                        </span>
                      </td>
                    )}

                    {/* Email */}
                    {isColVisible("email") && (
                      <td onClick={(e) => e.stopPropagation()}>
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="cell-muted"
                            style={{ textDecoration: "none" }}
                            title={`Email ${lead.email}`}
                          >
                            {lead.email}
                          </a>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                    )}

                    {/* Tags */}
                    {isColVisible("tags") && (
                      <td>
                        {lead.tags && lead.tags.length > 0 ? (
                          <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                            {lead.tags.slice(0, 2).map((t, i) => (
                              <span key={i} className="chip" data-size="sm" data-tone="neutral">
                                {t}
                              </span>
                            ))}
                            {lead.tags.length > 2 && (
                              <span className="cell-muted" style={{ fontSize: 11 }}>
                                +{lead.tags.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                    )}

                    {/* Last Activity */}
                    {isColVisible("updatedAt") && (
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <span className="cell-muted">{relativeTime(lead.updatedAt)}</span>
                      </td>
                    )}
                  </tr>
                );
              })}

              {!rows.length && (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 2}
                    style={{ textAlign: "center", padding: "48px 24px" }}
                  >
                    <div className="empty">
                      <span className="empty-icon">
                        <Icon name="users" size={18} />
                      </span>
                      <h3>No contacts found</h3>
                      <p>Nothing matches the current search or stage filter.</p>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setQuery("");
                          setStage("");
                        }}
                      >
                        Reset filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* View 2: Grouped by Stage (with inline stage mover) */
        <div className="list" ref={listRef}>
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.meta.id);
            return (
              <div key={group.meta.id}>
                <button
                  type="button"
                  className="list-group-head"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(group.meta.id)}
                >
                  <span className="list-group-icon" data-tone={group.meta.tone}>
                    <Icon name={group.meta.icon} size={14} />
                  </span>
                  <span className="list-group-title">{group.meta.label}</span>
                  <span className="list-group-count">{group.items.length}</span>
                  <Icon
                    name={isCollapsed ? "chevron-right" : "chevron-down"}
                    size={13}
                    className="chev"
                  />
                </button>

                {!isCollapsed
                  ? group.items.map((lead) => {
                      flatIndex += 1;
                      const idx = flatIndex;
                      const isSelected = selection.has(lead.id);
                      const src = sourceMeta(lead.source);
                      const callbackInfo = formatCallbackInfo(lead.followUp);

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
                          <button
                            type="button"
                            className="list-prio"
                            aria-label={`Change priority from ${PRIORITY_LABEL[lead.priority]}`}
                            title={`Priority: ${PRIORITY_LABEL[lead.priority]} · Click to change`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextPrio = PRIO_CYCLE[lead.priority] || "medium";
                              updateLead(lead.id, { priority: nextPrio });
                              setToastMessage(`Updated ${lead.name} priority to ${PRIORITY_LABEL[nextPrio]}`);
                            }}
                          >
                            <Icon
                              name={PRIORITY_ICON[lead.priority] as never}
                              size={14}
                              className="prio"
                              data-priority={lead.priority}
                              aria-label={PRIORITY_LABEL[lead.priority]}
                            />
                          </button>
                          <span className="list-id">{lead.code}</span>
                          <span className="list-title">
                            <strong>{lead.name}</strong>
                            <span>{lead.company}</span>
                          </span>

                          {/* Quick Stage Selector in Grouped View */}
                          <span
                            className="list-cell"
                            onClick={(e) => e.stopPropagation()}
                            style={{ minWidth: 120 }}
                          >
                            <label
                              className="stage-badge-select"
                              data-tone={stageMeta(lead.stage).tone}
                              title={`Stage: ${stageMeta(lead.stage).label} (Click to change)`}
                            >
                              <span className="stage-badge-dot" />
                              <select
                                value={lead.stage}
                                onChange={(e) => {
                                  const nextStage = e.target.value as StageId;
                                  handleStageChange(lead.id, nextStage, lead.name);
                                }}
                                aria-label={`Change stage for ${lead.name}`}
                              >
                                {STAGES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                              <span className="stage-badge-chevron">
                                <Icon name="chevron-down" size={10} />
                              </span>
                            </label>
                          </span>

                          {isColVisible("callback") && callbackInfo && (
                            <span className="list-cell">
                              <span className="chip" data-tone={callbackInfo.tone} data-size="sm">
                                <Icon name={callbackInfo.icon} size={11} /> {callbackInfo.text}
                              </span>
                            </span>
                          )}

                          {isColVisible("notes") && lead.notes && (
                            <span className="list-cell" style={{ maxWidth: 140 }}>
                              <span className="contact-note-cell" title={lead.notes}>
                                <Icon name="message" size={11} className="note-icon" />
                                <span className="note-text">{lead.notes}</span>
                              </span>
                            </span>
                          )}

                          <span className="list-cell">
                            <span className="linear-tag" data-tone={src.tone}>
                              <Icon name={src.icon} size={11} /> {src.label}
                            </span>
                          </span>
                          <span className="list-cell th-num">{compactMoney(lead.value)}</span>
                          <span className="list-avatar">
                            <span
                              className={`mini-avatar ${lead.owner === "Unassigned" ? "is-empty" : ""}`}
                            >
                              {lead.owner === "Unassigned" ? "?" : lead.owner.slice(0, 1)}
                            </span>
                            <span className="list-cell">{lead.owner}</span>
                          </span>
                          <span className="list-cell hide-sm" style={{ textAlign: "right" }}>
                            {relativeTime(lead.updatedAt)}
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
                type="button"
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
      )}

      {/* Stage Change Feedback Toast */}
      {toastMessage && (
        <div className="contact-stage-toast" role="status">
          <Icon name="check" size={14} style={{ color: "var(--accent)" }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Full Lead Details Drawer */}
      {active ? <LeadDrawer lead={active} onClose={() => setSelected(null)} /> : null}

      {/* Add Lead Dialog */}
      {showAddLead ? <AddLeadDialog defaultStage="new" onClose={() => setShowAddLead(false)} /> : null}
    </div>
  );
}
