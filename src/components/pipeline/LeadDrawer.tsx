"use client";

import { useEffect, useState, useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { LeadCommandHistory } from "./LeadCommandHistory";
import { LIMITS, maskPhone, money, relativeTime, slaLabel, useApp } from "@/lib/store";
import {
  OWNERS,
  PRIORITY_ICON,
  PRIORITY_LABEL,
  SEGMENTS,
  SOURCES,
  STAGES,
  sourceMeta,
  stageMeta,
  type Lead,
  type Priority,
  type Segment,
  type Source,
  type StageId,
} from "@/lib/types";

export function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { moveLead, updateLead, deleteLead, state, setLayout, claimLead, reassignLead } = useApp();
  const [draft, setDraft] = useState(lead);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [showMaskedPhone, setShowMaskedPhone] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [targetCloser, setTargetCloser] = useState("Anshita");
  const [handoverNote, setHandoverNote] = useState("");

  const allOwners = useMemo(() => {
    const set = new Set<string>(OWNERS);
    if (state.user?.displayName) set.add(state.user.displayName);
    state.leads.forEach((l) => {
      if (l.owner && l.owner !== "Unassigned") set.add(l.owner);
    });
    return Array.from(set);
  }, [state.user, state.leads]);

  useEffect(() => {
    setDraft(lead);
    setConfirmDelete(false);
    setSaved(false);
  }, [lead]);

  const save = () => {
    updateLead(lead.id, {
      name: draft.name.trim() || lead.name,
      company: draft.company.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      value: Number.isFinite(draft.value) ? draft.value : lead.value,
      owner: draft.owner,
      notes: draft.notes,
      tags: draft.tags,
      source: draft.source,
      segment: draft.segment,
      priority: draft.priority,
      followUp: draft.followUp,
    });
    setSaved(true);
    setTimeout(onClose, 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, draft, lead.id]);

  const set = <K extends keyof Lead>(key: K, value: Lead[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const dirty =
    draft.name !== lead.name ||
    draft.company !== lead.company ||
    draft.phone !== lead.phone ||
    draft.email !== lead.email ||
    draft.value !== lead.value ||
    draft.owner !== lead.owner ||
    draft.notes !== lead.notes ||
    draft.priority !== lead.priority ||
    draft.followUp !== lead.followUp ||
    draft.tags.join(",") !== lead.tags.join(",");

  const meta = stageMeta(draft.stage);
  const dateValue = (() => {
    if (!draft.followUp) return "";
    const d = new Date(draft.followUp);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  })();

  return (
    <div className="overlay" data-kind="drawer" onClick={onClose} role="presentation">
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${lead.code} ${lead.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-head">
          <span className="list-id">{lead.code}</span>
          <div className="drawer-head-tools">
            <button
              className="icon-btn"
              title="Copy link"
              aria-label="Copy lead link"
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/contacts?lead=${lead.id}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Icon name={copied ? "check" : "link"} size={14} />
            </button>
            <button
              className="icon-btn"
              title="Copy phone"
              aria-label="Copy phone number"
              onClick={() => {
                if (draft.phone) {
                  navigator.clipboard?.writeText(draft.phone);
                  setPhoneCopied(true);
                  setTimeout(() => setPhoneCopied(false), 1500);
                }
              }}
            >
              <Icon name={phoneCopied ? "check" : "copy"} size={14} />
            </button>
            <a
              href={`/contacts?lead=${lead.id}`}
              className="icon-btn"
              title="Activity & 360 View"
              aria-label="Lead activity"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
            >
              <Icon name="branch" size={14} />
            </a>
            <button
              className="icon-btn"
              onClick={onClose}
              aria-label="Close lead"
              style={{ marginLeft: "auto" }}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        </header>

        <div className="drawer-body">
          <div className="drawer-title-block">
            <span className="stage-icon-badge" data-tone={meta.tone}><Icon name={meta.icon} size={16} /></span>
            <input
              className="drawer-title-input"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              aria-label="Lead name"
            />
            <input
              className="drawer-sub-input"
              value={draft.company}
              onChange={(e) => set("company", e.target.value)}
              aria-label="Company"
              placeholder="Company"
            />
          </div>

          <div style={{ display: "flex", gap: "8px", margin: "12px 0 16px 0", flexWrap: "wrap" }}>
            {draft.owner === "Unassigned" && (
              <button
                className="btn"
                data-size="sm"
                data-variant="accent"
                onClick={() => {
                  const closerName = state.user?.displayName || "Anshita";
                  claimLead(lead.id, closerName);
                  set("owner", closerName);
                }}
              >
                <Icon name="hand" size={13} /> Claim Lead (Grab Pool)
              </button>
            )}
            {draft.phone && (
              <>
                <a
                  href={`https://wa.me/${draft.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  data-size="sm"
                  data-variant="accent"
                  style={{ textDecoration: "none" }}
                >
                  <Icon name="whatsapp" size={13} /> WhatsApp
                </a>
                <a
                  href={`tel:${draft.phone}`}
                  className="btn"
                  data-size="sm"
                  data-variant="ghost"
                  style={{ textDecoration: "none" }}
                >
                  <Icon name="phone" size={13} /> Call
                </a>
              </>
            )}
            <a
              href={`/payments?leadId=${lead.id}&phone=${encodeURIComponent(draft.phone)}&name=${encodeURIComponent(draft.name)}`}
              className="btn"
              data-size="sm"
              data-variant="ghost"
              style={{ textDecoration: "none" }}
            >
              <Icon name="card" size={13} /> Collect Payment
            </a>
            <button
              className="btn"
              data-size="sm"
              data-variant="ghost"
              onClick={() => setReassignModalOpen((v) => !v)}
              title="Transfer or reassign to another closer with context notes"
            >
              <Icon name="branch" size={13} /> Reassign Closer
            </button>
          </div>

          {reassignModalOpen && (
            <div
              className="card"
              style={{
                margin: "0 0 16px 0",
                padding: "12px 14px",
                background: "var(--bg-soft)",
                border: "1px solid var(--accent)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Icon name="branch" size={13} /> Closer-to-Closer Handover
                </span>
                <button
                  className="icon-btn"
                  onClick={() => setReassignModalOpen(false)}
                  style={{ padding: "2px" }}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Target Closer</label>
                  <select
                    className="select"
                    value={targetCloser}
                    onChange={(e) => setTargetCloser(e.target.value)}
                    style={{ width: "100%", height: "28px", marginTop: "2px" }}
                  >
                    {allOwners.filter((o) => o !== "Unassigned" && o !== draft.owner).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Handover Context / Reason</label>
                  <input
                    className="input"
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="e.g. Lead requested product demo callback; price negotiation approved"
                    style={{ marginTop: "2px" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
                  <button className="btn" data-size="sm" onClick={() => setReassignModalOpen(false)}>Cancel</button>
                  <button
                    className="btn"
                    data-size="sm"
                    data-variant="accent"
                    onClick={() => {
                      reassignLead(lead.id, targetCloser, handoverNote);
                      set("owner", targetCloser);
                      if (handoverNote) {
                        set("notes", `${draft.notes ? draft.notes + "\n\n" : ""}[Reassigned to ${targetCloser}]: ${handoverNote}`);
                      }
                      setReassignModalOpen(false);
                    }}
                  >
                    Confirm Reassignment
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="field-rows">
            <div className="field-row">
              <span className="field-label">
                <Icon name={meta.icon} size={15} /> Status
              </span>
              <select
                className="select"
                value={draft.stage}
                onChange={(e) => {
                  const stage = e.target.value as StageId;
                  set("stage", stage);
                  moveLead(lead.id, stage);
                }}
                aria-label="Lead stage"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name={PRIORITY_ICON[draft.priority] as never} size={14} /> Priority
              </span>
              <select
                className="select"
                value={draft.priority}
                onChange={(e) => set("priority", e.target.value as Priority)}
                aria-label="Priority"
              >
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="flame" size={14} /> Follow-up
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  className="input"
                  type="date"
                  value={dateValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      set("followUp", "");
                    } else {
                      const parsed = new Date(`${val}T11:00:00`);
                      if (!isNaN(parsed.getTime())) {
                        set("followUp", parsed.toISOString());
                      }
                    }
                  }}
                  aria-label="Next follow-up"
                />
                <span className="pill">{slaLabel(draft.followUp)}</span>
              </div>
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="users" size={14} /> Assignee
              </span>
              <select
                className="select"
                value={draft.owner}
                onChange={(e) => set("owner", e.target.value)}
                aria-label="Assignee"
              >
                {allOwners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="graph" size={14} /> Estimate
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  className="input"
                  inputMode="numeric"
                  value={draft.value}
                  onChange={(e) => set("value", Number(e.target.value.replace(/\D/g, "")) || 0)}
                  aria-label="Deal value"
                />
                <span className="hint">{money(draft.value)}</span>
              </div>
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="plug" size={14} /> Source
              </span>
              <select
                className="select"
                value={draft.source}
                onChange={(e) => set("source", e.target.value as Source)}
                aria-label="Source"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {sourceMeta(s).label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="target" size={14} /> Segment
              </span>
              <select
                className="select"
                value={draft.segment}
                onChange={(e) => set("segment", e.target.value as Segment)}
                aria-label="Segment"
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="tag" size={14} /> Labels
              </span>
              <input
                className="input"
                value={draft.tags.join(", ")}
                onChange={(e) =>
                  set(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="hot, inbound"
                aria-label="Labels"
              />
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="mail" size={14} /> Email
              </span>
              <input
                className="input"
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                aria-label="Email"
              />
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="phone" size={14} /> Phone
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                <input
                  className="input"
                  inputMode="tel"
                  value={showMaskedPhone ? maskPhone(draft.phone, true) : draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  readOnly={showMaskedPhone}
                  aria-label="Phone"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="chip"
                  data-tone={showMaskedPhone ? "info" : "default"}
                  onClick={() => setShowMaskedPhone((v) => !v)}
                  title={showMaskedPhone ? "Click to view full phone number" : "Click to mask phone number (+91 98765 •••••)"}
                  style={{ cursor: "pointer", fontSize: "11px", height: "26px", border: "none" }}
                >
                  <Icon name={showMaskedPhone ? "shield" : "eye"} size={11} />
                  {showMaskedPhone ? "Masked" : "Raw"}
                </button>
              </div>
            </div>
          </div>

          {/* Unified Command History, Notes & Callbacks */}
          <LeadCommandHistory
            leadId={lead.id}
            customerName={draft.name}
            customerPhone={draft.phone}
            currentFollowUpAt={draft.followUp}
            initialNotes={draft.notes}
            onFollowUpSaved={(iso) => {
              set("followUp", iso);
              updateLead(lead.id, { followUp: iso });
            }}
            onNoteSaved={(newNote) => {
              const updated = draft.notes ? `${draft.notes}\n\n${newNote}` : newNote;
              set("notes", updated);
              updateLead(lead.id, { notes: updated });
            }}
          />

          <p className="hint">
            Last updated {relativeTime(lead.updatedAt)} · press <span className="kbd">Esc</span> to
            close, <span className="kbd">⌘</span>
            <span className="kbd">↵</span> to save.
          </p>
        </div>

        <footer className="drawer-foot">
          {confirmDelete ? (
            <>
              <span className="hint" style={{ marginRight: "auto" }}>
                Delete {lead.code} permanently?
              </span>
              <button className="btn" data-size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="btn"
                data-variant="danger"
                data-size="sm"
                onClick={() => {
                  deleteLead(lead.id);
                  onClose();
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                className="btn"
                data-variant="ghost"
                onClick={() => setConfirmDelete(true)}
                title="Delete lead"
              >
                <Icon name="trash" size={14} /> Delete
              </button>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn" onClick={onClose}>
                  Close
                </button>
                <button
                  className="btn"
                  data-variant="primary"
                  onClick={save}
                  disabled={!dirty && !saved}
                >
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
            </>
          )}
        </footer>

        <ResizeHandle
          label="Resize panel"
          resetTo={460}
          min={LIMITS.drawer[0]}
          max={LIMITS.drawer[1]}
          style={{ right: undefined, left: -3 }}
          getWidth={() => state.drawerWidth}
          setWidth={(drawerWidth) => setLayout({ drawerWidth })}
        />
      </aside>
    </div>
  );
}
