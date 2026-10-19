"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { CURRENT_USER, useApp } from "@/lib/store";
import {
  OWNERS,
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
  const { addLead } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    value: "",
    source: "Website" as Source,
    segment: "SMB" as Segment,
    stage: defaultStage,
    owner: CURRENT_USER,
    priority: "medium" as Priority,
    followUp: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (submitting) return;
    if (!form.name.trim()) return setError("Give the lead a name.");
    if (!form.company.trim()) return setError("Company is required.");
    if (!/^[6-9]\d{9}$/.test(form.phone.trim()))
      return setError("Enter a 10-digit Indian mobile number starting with 6–9.");

    setSubmitting(true);
    const parsedFollowUp = form.followUp ? new Date(`${form.followUp}T11:00:00`) : new Date(Date.now() + 86400000);
    const followUpIso = !isNaN(parsedFollowUp.getTime())
      ? parsedFollowUp.toISOString()
      : new Date(Date.now() + 86400000).toISOString();

    addLead({
      name: form.name.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      value: Number(form.value.replace(/\D/g, "")) || 0,
      source: form.source,
      segment: form.segment,
      stage: form.stage,
      owner: form.owner,
      priority: form.priority,
      followUp: followUpIso,
      tags: [],
      notes: "",
    });
    onClose();
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
          <span className="empty-icon" style={{ width: 28, height: 28, marginBottom: 0 }}>
            <Icon name="plus" size={15} />
          </span>
          <h2 id="add-lead-title">Add a lead</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog" style={{ marginLeft: "auto" }}>
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dialog-body">
          <div className="drawer-grid">
            <div className="field">
              <label htmlFor="a-name">Name</label>
              <input
                id="a-name"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Anshita Rao"
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="a-company">Company</label>
              <input
                id="a-company"
                className="input"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Nimbus Interiors"
              />
            </div>
            <div className="field">
              <label htmlFor="a-phone">Phone</label>
              <input
                id="a-phone"
                className="input"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="98765 43210"
              />
            </div>
            <div className="field">
              <label htmlFor="a-email">Email</label>
              <input
                id="a-email"
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@company.in"
              />
            </div>
            <div className="field">
              <label htmlFor="a-value">Deal value (₹)</label>
              <input
                id="a-value"
                className="input"
                inputMode="numeric"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="75000"
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
              <label htmlFor="a-owner">Owner</label>
              <select
                id="a-owner"
                className="select"
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
              >
                {OWNERS.map((o) => (
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
              <label htmlFor="a-followup">Next follow-up</label>
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
            {submitting ? "Adding..." : "Add lead"}
          </button>
        </footer>
      </div>
    </div>
  );
}
