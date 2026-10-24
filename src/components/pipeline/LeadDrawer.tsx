"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { LeadCommandHistory } from "./LeadCommandHistory";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
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
  const userRole = (
    state.user?.role ||
    state.workspaceAuth?.user?.role ||
    (typeof document !== "undefined" && document.cookie.match(/(?:^|;\s*)gx_role=([^;]+)/)?.[1]) ||
    ""
  ).toUpperCase();
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "MANAGER";
  const [draft, setDraft] = useState(lead);
  const [rawTagsInput, setRawTagsInput] = useState((lead.tags || []).join(", "));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);

  // Direct Dropdown Lead Transfer State
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferToast, setTransferToast] = useState<string | null>(null);

  const handleDirectTransfer = async (targetAgentId: string) => {
    if (!targetAgentId) return;
    setIsTransferring(true);
    setTransferToast(null);
    try {
      const selectedMember = state.teamMembers?.find((m) => m.id === targetAgentId);
      const targetName = selectedMember?.name || selectedMember?.displayName || targetAgentId;
      set("owner", targetName);
      reassignLead(lead.id, targetName, "Lead transferred from drawer");
      await aicloserApi.leads.transfer(lead.id, targetAgentId, "Lead transferred from drawer");
      setTransferToast(`✓ Transferred to ${targetName}`);
      setTimeout(() => {
        setTransferToast(null);
      }, 2500);
    } catch (err: any) {
      setTransferToast(err?.message || "Failed to transfer lead. Please try again.");
      setTimeout(() => setTransferToast(null), 3000);
    } finally {
      setIsTransferring(false);
    }
  };
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
        const r = (m.role || "").trim().toUpperCase().replace(/\s+/g, "_");
        if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN" || r === "WORKSPACE_ADMIN" || r === "OWNER") return;
        if (m.name && !list.includes(m.name)) list.push(m.name);
      });
    } else {
      if (state.user?.displayName && !list.includes(state.user.displayName)) {
        const uRole = (state.user?.role || "").trim().toUpperCase().replace(/\s+/g, "_");
        if (uRole !== "SUPER_ADMIN" && !uRole.includes("SUPER") && uRole !== "ADMIN" && uRole !== "WORKSPACE_ADMIN" && uRole !== "OWNER") {
          list.push(state.user.displayName);
        }
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
    const nextTags = (draft.tags || []).filter((t) => t !== tagToRemove);
    setDraft((d) => ({ ...d, tags: nextTags }));
    setRawTagsInput(nextTags.join(", "));
    updateLead(lead.id, { tags: nextTags });
  };

  useEffect(() => {
    setDraft(lead);
    setRawTagsInput((lead.tags || []).join(", "));
    setConfirmDelete(false);
    setSaved(false);
  }, [lead]);

  const save = () => {
    updateLead(lead.id, {
      name: draft.name?.trim() || lead.name,
      company: (draft.company || "").trim(),
      email: (draft.email || "").trim(),
      value: Number.isFinite(draft.value) ? draft.value : lead.value,
      owner: draft.owner,
      notes: typeof draft.notes === "string" ? draft.notes : JSON.stringify(draft.notes || ""),
      tags: draft.tags || [],
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
    (draft.tags || []).join(",") !== (lead.tags || []).join(",");

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
            {draft.phone && (
              <>
                <a
                  href={`/chat?leadId=${lead.id}&phone=${encodeURIComponent(draft.phone)}&channel=api`}
                  className="icon-btn"
                  title="Open Official WhatsApp API Chat"
                  aria-label="Open Official WhatsApp API Chat"
                >
                  <Icon name="bolt" size={14} />
                </a>
                <a
                  href={`/chat?leadId=${lead.id}&phone=${encodeURIComponent(draft.phone)}&channel=mine`}
                  className="icon-btn"
                  title="Open Personal WhatsApp (Companion) Chat"
                  aria-label="Open Personal WhatsApp Chat"
                >
                  <Icon name="whatsapp" size={14} />
                </a>
              </>
            )}
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
              value={draft.name || ""}
              onChange={(e) => set("name", e.target.value)}
              aria-label="Lead name"
            />
            <input
              className="drawer-sub-input"
              value={draft.company || ""}
              onChange={(e) => set("company", e.target.value)}
              aria-label="Company"
              placeholder="Company"
            />
          </div>

          <div className="drawer-quick-actions">
            {draft.owner === "Unassigned" && !isAdmin && (
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
                  href={`/chat?leadId=${lead.id}&phone=${encodeURIComponent(draft.phone)}&channel=api`}
                  className="btn"
                  data-size="sm"
                  data-variant="accent"
                  title="Open Official Meta WhatsApp Cloud API thread"
                >
                  <Icon name="bolt" size={13} /> WhatsApp API
                </a>
                <a
                  href={`/chat?leadId=${lead.id}&phone=${encodeURIComponent(draft.phone)}&channel=mine`}
                  className="btn"
                  data-size="sm"
                  data-variant="outline"
                  title="Open Personal WhatsApp (Companion Scanner) thread"
                >
                  <Icon name="whatsapp" size={13} /> Personal WA
                </a>
                <a
                  href={`https://wa.me/${draft.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  data-size="sm"
                  data-variant="ghost"
                  title="Open direct in WhatsApp Web application"
                >
                  <Icon name="external" size={13} /> WA Web
                </a>
                <a
                  href={`tel:${draft.phone}`}
                  className="btn"
                  data-size="sm"
                  data-variant="ghost"
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
            >
              <Icon name="card" size={13} /> Collect Payment
            </a>

            <div className="drawer-transfer-picker">
              <select
                className="select drawer-transfer-select"
                value=""
                onChange={(e) => handleDirectTransfer(e.target.value)}
                disabled={isTransferring}
                aria-label="Transfer lead to teammate"
                title="Transfer lead ownership to a teammate"
              >
                <option value="" disabled>
                  {isTransferring ? "Transferring..." : "⇄ Transfer Lead..."}
                </option>
                {state.teamMembers && state.teamMembers.length > 0 ? (
                  state.teamMembers
                    .filter((m) => {
                      const r = (m.role || "").trim().toUpperCase().replace(/\s+/g, "_");
                      if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN" || r === "WORKSPACE_ADMIN" || r === "OWNER") return false;
                      return true;
                    })
                    .filter((m) => m.name !== draft.owner && m.displayName !== draft.owner)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.displayName} {m.role ? `(${m.role})` : ""}
                      </option>
                    ))
                ) : (
                  <option value="" disabled>No teammates available</option>
                )}
              </select>
            </div>

            {transferToast && (
              <span
                className="chip"
                data-tone={transferToast.startsWith("✓") ? "success" : "danger"}
              >
                {transferToast}
              </span>
            )}
          </div>

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
                <Icon name={(PRIORITY_ICON[(draft.priority || "medium").toLowerCase() as Priority] || "priority-medium") as never} size={14} /> Priority
              </span>
              <select
                className="select"
                value={(draft.priority || "medium").toLowerCase()}
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
                value={draft.owner || "Unassigned"}
                onChange={async (e) => {
                  const targetVal = e.target.value;
                  if (!targetVal || targetVal === draft.owner) return;
                  const member = state.teamMembers?.find(
                    (m) => m.name === targetVal || m.displayName === targetVal || m.id === targetVal
                  );
                  const targetId = member?.id || targetVal;
                  const targetName = member?.name || member?.displayName || targetVal;
                  set("owner", targetName);
                  reassignLead(lead.id, targetName, "Reassigned via Assignee dropdown");
                  try {
                    await aicloserApi.leads.transfer(lead.id, targetId, "Reassigned via Assignee dropdown");
                  } catch (err: any) {
                    console.warn("Transfer failed:", err);
                  }
                }}
                aria-label="Assignee"
              >
                <option value={draft.owner || "Unassigned"} disabled={!draft.owner}>
                  {draft.owner || "Unassigned"}
                </option>
                {state.teamMembers && state.teamMembers.length > 0 ? (
                  state.teamMembers
                    .filter((m) => {
                      const r = (m.role || "").trim().toUpperCase().replace(/\s+/g, "_");
                      if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN" || r === "WORKSPACE_ADMIN" || r === "OWNER") return false;
                      return true;
                    })
                    .filter((m) => m.name !== draft.owner && m.displayName !== draft.owner)
                    .map((m) => (
                      <option key={m.id} value={m.name || m.displayName}>
                        {m.name || m.displayName} {m.role ? `(${m.role})` : ""}
                      </option>
                    ))
                ) : null}
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
                {(draft.tags || []).map((tag) => {
                  const match = workspaceLabels.find((l) => (l?.name || "").toLowerCase() === String(tag || "").toLowerCase());
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
                  <div className="drawer-label-box">
                    <div className="drawer-label-row">
                      <input
                        className="input"
                        data-size="sm"
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
                        autoFocus
                      />
                      {availableWorkspaceLabels.length > 0 && (
                        <select
                          className="select"
                          data-size="sm"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const found = availableWorkspaceLabels.find((l) => l.name === e.target.value);
                              addTag(e.target.value, found?.color);
                            }
                          }}
                          aria-label="Pick existing workspace label"
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
                    <div className="drawer-label-bar">
                      <div className="drawer-color-dots">
                        {["#F97316", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#EAB308", "#64748B"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            className="drawer-color-dot"
                            data-selected={selectedTagColor === c}
                            onClick={() => setSelectedTagColor(c)}
                            title={`Select color ${c}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <div className="drawer-label-row">
                        <button
                          type="button"
                          className="btn"
                          data-size="sm"
                          data-variant="ghost"
                          onClick={() => setShowAddLabel(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn"
                          data-size="sm"
                          data-variant="primary"
                          onClick={() => addTag(newLabelInput, selectedTagColor)}
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
                value={draft.email || ""}
                onChange={(e) => set("email", e.target.value)}
                aria-label="Email"
              />
            </div>

            <div className="field-row">
              <span className="field-label">
                <Icon name="phone" size={14} /> Phone
              </span>
              <div className="field-static">
                <div className="phone-static-box">
                  <span className="phone-static-text">
                    {isAdmin ? (draft.phone || "—") : maskPhone(draft.phone || "", false)}
                  </span>
                  <div className="phone-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Copy phone"
                      onClick={() => {
                        navigator.clipboard?.writeText(draft.phone || "");
                        setPhoneCopied(true);
                        setTimeout(() => setPhoneCopied(false), 1500);
                      }}
                    >
                      <Icon name={phoneCopied ? "check" : "copy"} size={12} />
                    </button>
                    {draft.phone && (
                      <a href={`tel:${draft.phone}`} className="icon-btn" title="Call">
                        <Icon name="phone" size={12} />
                      </a>
                    )}
                    {draft.phone && (
                      <a
                        href={`https://wa.me/${(draft.phone || "").replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="icon-btn"
                        title="WhatsApp"
                      >
                        <Icon name="whatsapp" size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Command History, Notes & Callbacks */}
          <ErrorBoundary fallbackTitle="Activity & Notes history temporarily unavailable">
            <LeadCommandHistory
              leadId={lead.id}
              customerName={draft.name}
              customerPhone={draft.phone}
              currentFollowUpAt={draft.followUp}
              initialNotes={typeof draft.notes === "string" ? draft.notes : (draft.notes ? JSON.stringify(draft.notes) : "")}
              onFollowUpSaved={(iso) => {
                set("followUp", iso);
                updateLead(lead.id, { followUp: iso });
              }}
            />
          </ErrorBoundary>

          <p className="hint">
            Last updated {relativeTime(lead.updatedAt)}
          </p>
        </div>

        <footer className="drawer-foot">
          {confirmDelete ? (
            <div className="drawer-danger-footer">
              <div className="field-group">
                <span className="hint">
                  Delete {lead.code} permanently?
                </span>
                {deleteError && (
                  <span className="chip" data-tone="danger" data-size="sm">
                    {deleteError}
                  </span>
                )}
              </div>
              <div className="drawer-label-row">
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
              {isAdmin && (
                <button
                  className="btn"
                  data-variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  title="Delete lead"
                >
                  <Icon name="trash" size={14} /> Delete
                </button>
              )}
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
