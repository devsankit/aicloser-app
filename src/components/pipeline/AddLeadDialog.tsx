"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";
import {
  PRIORITY_LABEL,
  SEGMENTS,
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

  const [submitting, setSubmitting] = useState(false);
  const [owners, setOwners] = useState<string[]>([currentUserName, "Unassigned"]);
  const [ownerAgentMap, setOwnerAgentMap] = useState<Record<string, string>>({});

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
    followUp: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch real team members to populate owner options
  useEffect(() => {
    let mounted = true;
    aicloserApi.team
      .listMembers()
      .then((members: any) => {
        if (!mounted || !Array.isArray(members)) return;
        const map: Record<string, string> = {};
        const names = new Set<string>();
        if (currentUserName) names.add(currentUserName);

        members.forEach((m: any) => {
          const name = m.displayName || m.user?.displayName || m.name || m.email;
          const agentId = m.id || m.userId;
          if (name) {
            names.add(name);
            if (agentId) map[name] = agentId;
          }
        });
        names.add("Unassigned");

        setOwners(Array.from(names));
        setOwnerAgentMap(map);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [currentUserName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (submitting) return;
    const cleanName = form.name.trim();
    const cleanCompany = form.company.trim();
    const rawPhone = form.phone.trim();
    const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);

    if (!cleanName) return setError("Give the lead a name.");
    if (!cleanCompany) return setError("Company name or business inquiry is required.");
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      return setError("Enter a valid 10-digit Indian mobile number starting with 6–9.");
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setError("Enter a valid email address or leave it blank.");
    }

    setSubmitting(true);
    setError(null);

    const parsedFollowUp = form.followUp ? new Date(`${form.followUp}T11:00:00`) : new Date(Date.now() + 86400000);
    const followUpIso = !isNaN(parsedFollowUp.getTime())
      ? parsedFollowUp.toISOString()
      : new Date(Date.now() + 86400000).toISOString();

    const assignedAgentId = ownerAgentMap[form.owner];

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
        owner: form.owner,
        assignedAgentId,
        priority: form.priority,
        followUp: followUpIso,
        tags: [],
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
              <label htmlFor="a-company">Company / Business</label>
              <input
                id="a-company"
                className="input"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="e.g. Nimbus Interiors"
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
                {STAGES.map((s) => (
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
              <label htmlFor="a-segment">Segment</label>
              <select
                id="a-segment"
                className="select"
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value as Segment })}
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="drawer-grid">
            <div className="field">
              <label htmlFor="a-owner">Assigned Closer / Owner</label>
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
