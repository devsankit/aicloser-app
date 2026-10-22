"use client";

import { useEffect, useState, useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { LeadCommandHistory } from "./LeadCommandHistory";
import { LIMITS, maskPhone, money, relativeTime, slaLabel, useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";
import {
  OWNERS,
  PRIORITY_ICON,
  PRIORITY_LABEL,
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
  const isAdmin = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN";
  const [draft, setDraft] = useState(lead);
  const [rawTagsInput, setRawTagsInput] = useState(lead.tags.join(", "));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [targetCloser, setTargetCloser] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [workspaceLabels, setWorkspaceLabels] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [newLabelInput, setNewLabelInput] = useState("");
  const [selectedTagColor, setSelectedTagColor] = useState("#F97316");

  const loadWorkspaceLabels = useCallback(async () => {
    try {
      const res: any = await aicloserApi.labels.list();
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.labels)
        ? res.labels
        : [];
      setWorkspaceLabels(items);
    } catch {
      setWorkspaceLabels([]);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceLabels();
  }, [loadWorkspaceLabels]);

  const allOwners = useMemo(() => {
    const list: string[] = [];
    if (isAdmin) {
      list.push("Unassigned");
    }
    if (state.teamMembers && state.teamMembers.length > 0) {
      state.teamMembers.forEach((m) => {
        if (m.name && !list.includes(m.name)) list.push(m.name);
      });
    } else {
      if (state.user?.displayName && !list.includes(state.user.displayName)) {
        list.push(state.user.displayName);
      }
      state.leads.forEach((l) => {
        if (l.owner && l.owner !== "Unassigned" && !list.includes(l.owner)) {
          list.push(l.owner);
        }
      });
    }
    if (draft.owner && !list.includes(draft.owner) && (isAdmin || draft.owner !== "Unassigned")) {
      list.push(draft.owner);
    }
    return list;
  }, [state.teamMembers, state.user, state.leads, isAdmin, draft.owner]);

  const availableOwners = useMemo(() => {
    return allOwners.filter((o) => o !== "Unassigned" && o !== draft.owner);
  }, [allOwners, draft.owner]);

  const availableWorkspaceLabels = useMemo(() => {
    const currentTags = new Set((draft.tags || []).filter(Boolean).map((t) => String(t).toLowerCase()));
    return workspaceLabels.filter((l) => l?.name && !currentTags.has(l.name.toLowerCase()));
  }, [workspaceLabels, draft.tags]);

  const addTag = (tagName: string, color?: string) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    const finalColor = color || selectedTagColor;
    const safeTags = draft.tags || [];
    if (!safeTags.some((t) => String(t || "").toLowerCase() === trimmed.toLowerCase())) {
      const nextTags = [...safeTags, trimmed];
      setDraft((d) => ({ ...d, tags: nextTags }));
      setRawTagsInput(nextTags.join(", "));
      updateLead(lead.id, { tags: nextTags });
      if (!workspaceLabels.some((l) => (l?.name || "").toLowerCase() === trimmed.toLowerCase())) {
        aicloserApi.labels.create({ name: trimmed, color: finalColor }).then(() => {
          loadWorkspaceLabels();
        }).catch(() => {});
      }
    }
    setNewLabelInput("");
    setShowAddLabel(false);
  };

  const removeTag = (tagToRemove: string) => {
    const nextTags = draft.tags.filter((t) => t !== tagToRemove);
    setDraft((d) => ({ ...d, tags: nextTags }));
    setRawTagsInput(nextTags.join(", "));
    updateLead(lead.id, { tags: nextTags });
  };

  useEffect(() => {
    if (availableOwners.length > 0 && (!targetCloser || !availableOwners.includes(targetCloser))) {
      setTargetCloser(availableOwners[0]);
    }
  }, [availableOwners, targetCloser]);

  useEffect(() => {
    setDraft(lead);
    setRawTagsInput(lead.tags.join(", "));
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

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteLead(lead.id);
      onClose();
    } catch (err: any) {
      console.error("Failed to delete lead:", err);
      setDeleteError(err?.message || "Failed to delete lead. Check permissions.");
    } finally {
      setIsDeleting(false);
    }
  };

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
            >
              <Icon name="branch" size={14} />
            </a>
            <button
              className="icon-btn ml-auto"
              onClick={onClose}
              aria-label="Close lead"
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

          <div className="drawer-quick-actions">
            {draft.owner === "Unassigned" && (
              <button
                className="btn"
                data-size="sm"
                data-variant="accent"
                onClick={() => {
                  const closerName = state.user?.displayName || "Admin";
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
            <div className="drawer-reassign-card">
              <div className="drawer-reassign-head">
                <span className="drawer-reassign-title">
                  <Icon name="branch" size={13} /> Closer-to-Closer Handover
                </span>
                <button
                  className="icon-btn"
                  onClick={() => setReassignModalOpen(false)}
                  aria-label="Close handover panel"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
              <div className="drawer-reassign-body">
                <div className="field">
                  <label className="field-label">Target Closer</label>
                  <select
                    className="select"
                    value={targetCloser}
                    onChange={(e) => setTargetCloser(e.target.value)}
                  >
                    {availableOwners.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Handover Context / Reason</label>
                  <input
                    className="input"
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="e.g. Lead requested product demo callback; price negotiation approved"
                  />
                </div>
                <div className="drawer-reassign-actions">
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
                <Icon name="plug" size={14} /> Source
              </span>
              <div className="field-static">
                <span className="chip" data-tone="accent">
                  <Icon name="plug" size={12} /> {sourceMeta(draft.source).label}
                </span>
              </div>
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="tag" size={14} /> Labels
              </span>
              <div className="chip-row" style={{ flexWrap: "wrap", gap: "6px" }}>
                {draft.tags.map((tag) => {
                  const match = workspaceLabels.find((l) => l.name.toLowerCase() === tag.toLowerCase());
                  const dotColor = match?.color || "var(--accent)";
                  return (
                    <span key={tag} className="chip" style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "2px 8px" }}>
                      <span className="dot" style={{ background: dotColor }} />
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove label ${tag}`}
                        title={`Remove ${tag}`}
                        style={{ background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", padding: 0, color: "var(--text-tertiary)" }}
                      >
                        <Icon name="close" size={10} />
                      </button>
                    </span>
                  );
                })}
                {showAddLabel ? (
                  <div className="card" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", marginTop: "4px" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <input
                        className="input"
                        value={newLabelInput}
                        onChange={(e) => setNewLabelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag(newLabelInput, selectedTagColor);
                          } else if (e.key === "Escape") {
                            setShowAddLabel(false);
                          }
                        }}
                        placeholder="Label name..."
                        style={{ height: "28px", fontSize: "12px", flex: 1 }}
                        autoFocus
                      />
                      {availableWorkspaceLabels.length > 0 && (
                        <select
                          className="select"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const found = availableWorkspaceLabels.find((l) => l.name === e.target.value);
                              addTag(e.target.value, found?.color);
                            }
                          }}
                          aria-label="Pick existing workspace label"
                          style={{ height: "28px", fontSize: "11px", maxWidth: "120px" }}
                        >
                          <option value="">Existing…</option>
                          {availableWorkspaceLabels.map((l) => (
                            <option key={l.id || l.name} value={l.name}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        {["#F97316", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#EAB308", "#64748B"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSelectedTagColor(c)}
                            title={`Select color ${c}`}
                            style={{
                              width: "16px",
                              height: "16px",
                              borderRadius: "50%",
                              background: c,
                              border: selectedTagColor === c ? "2px solid var(--text)" : "1px solid transparent",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          className="btn"
                          data-size="sm"
                          data-variant="ghost"
                          onClick={() => setShowAddLabel(false)}
                          style={{ height: "24px", fontSize: "11px", padding: "0 6px" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn"
                          data-size="sm"
                          data-variant="primary"
                          onClick={() => addTag(newLabelInput, selectedTagColor)}
                          style={{ height: "24px", fontSize: "11px", padding: "0 8px" }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    data-size="sm"
                    data-variant="ghost"
                    onClick={() => setShowAddLabel(true)}
                    style={{ height: "24px", fontSize: "11px", padding: "0 6px" }}
                  >
                    <Icon name="plus" size={11} /> Add label
                  </button>
                )}
              </div>
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
              <div className="field-static">
                <input
                  className="input"
                  inputMode="tel"
                  value={isAdmin ? draft.phone : maskPhone(draft.phone, true)}
                  onChange={(e) => {
                    if (isAdmin) set("phone", e.target.value);
                  }}
                  readOnly={!isAdmin}
                  aria-label="Phone"
                  title={!isAdmin ? "Phone number locked for closer isolation" : "Client phone number"}
                />
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
            }}
          />

          <p className="hint">
            Last updated {relativeTime(lead.updatedAt)}
          </p>
        </div>

        <footer className="drawer-foot">
          {confirmDelete ? (
            <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="hint">
                  Delete {lead.code} permanently?
                </span>
                {deleteError && (
                  <span className="chip" data-tone="danger" style={{ fontSize: "11px" }}>
                    {deleteError}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  className="btn"
                  data-size="sm"
                  disabled={isDeleting}
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  data-variant="danger"
                  data-size="sm"
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
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
              <div className="drawer-foot-end">
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
