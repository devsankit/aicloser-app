"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";
import {
  PRIORITY_LABEL,
  SOURCES,
  STAGES,
  sourceMeta,
  type Priority,
  type Segment,
  type Source,
  type StageId,
} from "@/lib/types";

export function AddLeadDialog({
  defaultStage,
  onClose,
}: {
  defaultStage: StageId;
  onClose: () => void;
}) {
  const { addLead, state } = useApp();
  const currentUserName = state.user?.displayName || "Admin";
  const isCloserRole = state.user?.role === "SALES_AGENT" || (state.user?.role as any) === "CLOSER";

  const [submitting, setSubmitting] = useState(false);
  const [owners, setOwners] = useState<string[]>([currentUserName, "Unassigned"]);
  const [ownerAgentMap, setOwnerAgentMap] = useState<Record<string, string>>({});

  const [dynamicStages, setDynamicStages] = useState<Array<{ id: string; label: string }>>([]);
  const [workspaceLabels, setWorkspaceLabels] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    value: "",
    source: "Website" as Source,
    segment: "SMB" as Segment,
    stage: defaultStage,
    owner: currentUserName,
    priority: "medium" as Priority,
    followUp: "",
  });
  const [error, setError] = useState<string | null>(null);

  // Synchronously seed team members from store and asynchronously fetch fresh members + stages + labels
  useEffect(() => {
    let mounted = true;

    // 1. Seed owners from state.teamMembers immediately
    const initialMap: Record<string, string> = {};
    const initialNames = new Set<string>();
    if (currentUserName) initialNames.add(currentUserName);

    if (state.teamMembers && state.teamMembers.length > 0) {
      state.teamMembers.forEach((m: any) => {
        const name = m.displayName || m.name;
        const agentId = m.id || m.userId;
        if (name) {
          initialNames.add(name);
          if (agentId) initialMap[name] = agentId;
        }
      });
      initialNames.add("Unassigned");
      setOwners(Array.from(initialNames));
      setOwnerAgentMap(initialMap);
    }

    // 2. Fetch fresh team roster from real API
    aicloserApi.team
      .listMembers()
      .then((teamRes: any) => {
        if (!mounted) return;
        const rawMembers = Array.isArray(teamRes)
          ? teamRes
          : Array.isArray(teamRes?.members)
          ? teamRes.members
          : Array.isArray(teamRes?.data?.members)
          ? teamRes.data.members
          : [];

        if (rawMembers.length > 0) {
          const freshMap: Record<string, string> = {};
          const freshNames = new Set<string>();
          if (currentUserName) freshNames.add(currentUserName);

          rawMembers.forEach((m: any) => {
            const name = m.displayName || m.user?.displayName || m.name || m.email;
            const agentId = m.id || m.userId;
            if (name) {
              freshNames.add(name);
              if (agentId) freshMap[name] = agentId;
            }
          });
          freshNames.add("Unassigned");

          setOwners(Array.from(freshNames));
          setOwnerAgentMap(freshMap);
        }
      })
      .catch(() => {});

    // 3. Fetch dynamic stages from real API
    aicloserApi.stages
      .list()
      .then((stagesRes: any) => {
        if (!mounted) return;
        const list = Array.isArray(stagesRes)
          ? stagesRes
          : Array.isArray(stagesRes?.stages)
          ? stagesRes.stages
          : Array.isArray(stagesRes?.data)
          ? stagesRes.data
          : [];

        if (list.length > 0) {
          const mapped = list.map((s: any) => ({
            id: (s.key || s.id || "").toLowerCase(),
            label: s.label || s.key || s.id,
          }));
          setDynamicStages(mapped);
        }
      })
      .catch(() => {});

    // 4. Fetch existing workspace labels for autocomplete
    aicloserApi.labels
      .list()
      .then((res: any) => {
        if (!mounted) return;
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.labels)
          ? res.labels
          : [];
        if (Array.isArray(list)) setWorkspaceLabels(list);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [currentUserName, state.teamMembers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stagesList = dynamicStages.length > 0
    ? dynamicStages
    : STAGES.map((s) => ({ id: s.id, label: s.label }));

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().replace(/^#/, "");
    if (!trimmed || selectedTags.includes(trimmed)) return;
    setSelectedTags((prev) => [...prev, trimmed]);
    setTagInput("");

    // Persist new label to workspace if not already present
    const exists = workspaceLabels.some((l: any) => (l.name || l).toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      aicloserApi.labels.create({ name: trimmed }).catch(() => {});
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const submit = async () => {
    if (submitting) return;
    const cleanName = form.name.trim();
    const cleanCompany = form.company.trim() || `${cleanName}'s Venture`;
    const rawPhone = form.phone.trim();
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const cleanPhone = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

    if (!cleanName) return setError("Give the lead a name.");
    if (!cleanPhone || cleanPhone.length < 10) {
      return setError("Enter a valid mobile number (at least 10 digits).");
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setError("Enter a valid email address or leave it blank.");
    }

    setSubmitting(true);
    setError(null);

    const parsedFollowUp = form.followUp ? new Date(`${form.followUp}T11:00:00`) : null;
    const followUpIso = parsedFollowUp && !isNaN(parsedFollowUp.getTime())
      ? parsedFollowUp.toISOString()
      : undefined;

    const finalOwner = isCloserRole ? currentUserName : form.owner;
    const assignedAgentId = isCloserRole
      ? (state.user?.id || ownerAgentMap[currentUserName])
      : ownerAgentMap[form.owner];

    try {
      await addLead({
        name: cleanName,
        company: cleanCompany,
        phone: cleanPhone,
        email: form.email.trim(),
        value: Number(form.value.replace(/\D/g, "")) || 0,
        source: form.source,
        segment: form.segment,
        stage: form.stage,
        owner: finalOwner,
        assignedAgentId,
        priority: form.priority,
        followUp: followUpIso,
        tags: selectedTags,
        notes: "",
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create lead. Please check details and try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="overlay" data-kind="dialog" onClick={onClose} role="presentation">
      <div
        className="dialog"
        data-size="lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-head">
          <span className="dialog-icon">
            <Icon name="plus" size={15} />
          </span>
          <h2 id="add-lead-title">Add a lead</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dialog-body">
          <div className="drawer-grid">
            <div className="field">
              <label htmlFor="a-name">Customer Name</label>
              <input
                id="a-name"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Priya Sharma"
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="a-company">Company / Business (Optional)</label>
              <input
                id="a-company"
                className="input"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="e.g. Nimbus Interiors (or leave blank)"
              />
            </div>
            <div className="field">
              <label htmlFor="a-phone">Phone Number</label>
              <input
                id="a-phone"
                className="input"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 98765 43210"
              />
            </div>
            <div className="field">
              <label htmlFor="a-email">Email (Optional)</label>
              <input
                id="a-email"
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. name@company.in"
              />
            </div>

            <div className="field">
              <label htmlFor="a-value">Deal Value (₹)</label>
              <input
                id="a-value"
                className="input"
                inputMode="numeric"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="e.g. 50,000"
              />
            </div>

            <div className="field">
              <label htmlFor="a-stage">Stage</label>
              <select
                id="a-stage"
                className="select"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value as StageId })}
              >
                {stagesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="a-source">Source</label>
              <select
                id="a-source"
                className="select"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as Source })}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {sourceMeta(s).label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="a-priority">Priority</label>
              <select
                id="a-priority"
                className="select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
              >
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="a-owner">Assigned Closer / Owner</label>
              {isCloserRole ? (
                <div className="chip locked-owner-chip" data-tone="accent" title={`Auto-locked to creator ${currentUserName}`}>
                  <span><Icon name="user" size={12} /> {currentUserName}</span>
                  <span className="owner-locked-tag">Auto-locked</span>
                </div>
              ) : (
                <select
                  id="a-owner"
                  className="select"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                >
                  {owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="field">
              <label htmlFor="a-followup">Next Callback / Follow-up</label>
              <input
                id="a-followup"
                className="input"
                type="date"
                value={form.followUp}
                onChange={(e) => setForm({ ...form, followUp: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="a-tags">Labels &amp; Tags</label>
            <div className="tags-selector">
              {selectedTags.length > 0 && (
                <div className="chip-row">
                  {selectedTags.map((tag) => (
                    <span key={tag} className="chip-x">
                      <b>{tag}</b>
                      <button
                        type="button"
                        className="x"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove ${tag}`}
                      >
                        <Icon name="close" size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="tag-input-row">
                <input
                  id="a-tags"
                  className="input"
                  list="available-labels"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Select label from suggestions or type and press Enter..."
                />
                <datalist id="available-labels">
                  {workspaceLabels.map((lbl: any) => (
                    <option key={lbl.id || lbl.name} value={lbl.name}>
                      {lbl.name}
                    </option>
                  ))}
                </datalist>
                <button
                  type="button"
                  className="btn"
                  data-size="sm"
                  data-variant="outline"
                  onClick={() => handleAddTag(tagInput)}
                  disabled={!tagInput.trim()}
                >
                  <Icon name="plus" size={12} /> Add
                </button>
              </div>
              {workspaceLabels.length > 0 && (
                <div className="chip-row" style={{ marginTop: "6px", flexWrap: "wrap", gap: "4px" }}>
                  <span className="caption" style={{ color: "var(--text-tertiary)", fontSize: "11px", marginRight: "4px" }}>
                    Quick suggestions:
                  </span>
                  {workspaceLabels
                    .filter((l: any) => !selectedTags.includes(l.name || l))
                    .slice(0, 5)
                    .map((lbl: any) => (
                      <button
                        key={lbl.id || lbl.name}
                        type="button"
                        className="chip"
                        data-size="sm"
                        onClick={() => handleAddTag(lbl.name || lbl)}
                        title={`Add tag "${lbl.name || lbl}"`}
                        style={{ cursor: "pointer" }}
                      >
                        <Icon name="plus" size={10} /> {lbl.name || lbl}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="dialog-foot">
          <button className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn" data-variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Adding lead..." : "Add lead"}
          </button>
        </footer>
      </div>
    </div>
  );
}
