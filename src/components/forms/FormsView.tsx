"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
import { type Priority, type StageId } from "@/lib/types";

export interface FormItem {
  id: string;
  title: string;
  slug: string;
  submissionsCount: number;
  conversionRate: string;
  targetStage: StageId;
  sourceLabel: string;
  status: "published" | "draft";
  lastSubmission: string;
}

const DEFAULT_FORMS: FormItem[] = [
  {
    id: "frm-01",
    title: "Website High-Ticket Demo Request",
    slug: "demo-request",
    submissionsCount: 248,
    conversionRate: "28.4%",
    targetStage: "new",
    sourceLabel: "Website",
    status: "published",
    lastSubmission: "18m ago",
  },
  {
    id: "frm-02",
    title: "2026 Broker CRM Playbook Download",
    slug: "broker-playbook",
    submissionsCount: 115,
    conversionRate: "34.1%",
    targetStage: "new",
    sourceLabel: "Ads",
    status: "published",
    lastSubmission: "1h ago",
  },
  {
    id: "frm-03",
    title: "Enterprise Custom Pricing Inquiry",
    slug: "enterprise-quote",
    submissionsCount: 55,
    conversionRate: "19.2%",
    targetStage: "contacted",
    sourceLabel: "Lead form",
    status: "published",
    lastSubmission: "Yesterday",
  },
];

const RECENT_SUBMISSIONS = [
  { id: "sub-1", name: "Ananya Saxena", company: "Prestige Spaces", phone: "+91 98201 99281", form: "demo-request", utm: "google / cpc", time: "18m ago" },
  { id: "sub-2", name: "Kunal Singhal", company: "Finserve Advisors", phone: "+91 99100 23114", form: "demo-request", utm: "linkedin / organic", time: "42m ago" },
  { id: "sub-3", name: "Rishabh Goel", company: "Urban Edge Realty", phone: "+91 98770 12399", form: "broker-playbook", utm: "meta / ig_reels", time: "1h ago" },
  { id: "sub-4", name: "Naveen Prasad", company: "Apex Logistics", phone: "+91 97112 34509", form: "enterprise-quote", utm: "direct", time: "3h ago" },
];

export function FormsView() {
  const { addLead } = useApp();
  const [tab, setTab] = useState<"forms" | "editor" | "submissions">("forms");
  const [forms] = useState<FormItem[]>(DEFAULT_FORMS);
  const [banner, setBanner] = useState<string | null>(null);

  // Form Editor Fields
  const [formTitle, setFormTitle] = useState("Website High-Ticket Demo Request");
  const [formSlug, setFormSlug] = useState("demo-request");
  const [formButtonText, setFormButtonText] = useState("Request 15-Min Walkthrough");
  const [requireCompany, setRequireCompany] = useState(true);
  const [requireBudget, setRequireBudget] = useState(true);

  // Interactive Live Preview Input State
  const [previewName, setPreviewName] = useState("");
  const [previewCompany, setPreviewCompany] = useState("");
  const [previewPhone, setPreviewPhone] = useState("");
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  const handleTestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewName.trim() || !previewPhone.trim()) return;

    addLead({
      name: previewName.trim(),
      company: previewCompany.trim() || "Independent Firm",
      phone: previewPhone.trim(),
      email: `${previewName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      value: 96000,
      source: "Lead form",
      segment: "SMB",
      stage: "new",
      owner: "Aarav",
      priority: "high" as Priority,
      followUp: new Date(Date.now() + 86400000).toISOString(),
      tags: ["web-form", "inbound"],
      notes: `Submitted via published form: ${formTitle}`,
    });

    setPreviewSubmitted(true);
    setTimeout(() => {
      setPreviewSubmitted(false);
      setPreviewName("");
      setPreviewCompany("");
      setPreviewPhone("");
      setBanner("Test submission created! Lead added to CRM Kanban pipeline.");
      setTimeout(() => setBanner(null), 4000);
    }, 2500);
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`https://closer.ai/f/${slug}`);
    setBanner(`Public form URL copied: https://closer.ai/f/${slug}`);
    setTimeout(() => setBanner(null), 3000);
  };

  const copyEmbed = (slug: string) => {
    navigator.clipboard.writeText(`<iframe src="https://closer.ai/f/${slug}" width="100%" height="450" frameborder="0"></iframe>`);
    setBanner("HTML embed code copied to clipboard!");
    setTimeout(() => setBanner(null), 3000);
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <header className="page-head" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
            Lead Form Builder & Public URLs
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Build responsive capture forms, generate shareable public links and iframe embed codes, and route submissions to CRM stages.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {banner && (
            <span className="chip" data-tone="success" style={{ padding: "4px 10px" }}>
              <Icon name="check" size={13} /> {banner}
            </span>
          )}
          <button className="btn" data-variant="primary" onClick={() => setTab("editor")}>
            <Icon name="plus" size={13} /> Create Lead Form
          </button>
        </div>
      </header>

      {/* Metric Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Published Forms
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {forms.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>active</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="dot" style={{ background: "var(--success)" }} /> Publicly live on closer.ai/f/*
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Total Submissions
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            418 <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>inbound leads</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            All routed to CRM Pipeline
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Avg Conversion Rate
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--accent)" }}>
            27.8%
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Visits converted to verified phone leads
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Bot & Spam Shield
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--success)" }}>
            99.2%
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Honeypot + 10-digit regex check
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
        <div className="seg">
          <button data-on={tab === "forms"} onClick={() => setTab("forms")}>
            <Icon name="form" size={13} /> Published Forms ({forms.length})
          </button>
          <button data-on={tab === "editor"} onClick={() => setTab("editor")}>
            <Icon name="pencil" size={13} /> Visual Form Builder & Live Preview
          </button>
          <button data-on={tab === "submissions"} onClick={() => setTab("submissions")}>
            <Icon name="inbox" size={13} /> Submissions Stream ({RECENT_SUBMISSIONS.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Published Forms */}
      {tab === "forms" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "260px" }}>Form Title</th>
                  <th>Public Slug URL</th>
                  <th>Submissions</th>
                  <th>Conversion Rate</th>
                  <th>Target CRM Stage</th>
                  <th>Status</th>
                  <th>Last Lead</th>
                  <th style={{ textAlign: "right" }}>Share & Embed</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{f.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Default Source: {f.sourceLabel}</div>
                    </td>
                    <td>
                      <span className="chip" style={{ fontSize: "11px", fontFamily: "var(--mono)" }}>
                        /f/{f.slug}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{f.submissionsCount}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--accent)" }}>{f.conversionRate}</span>
                    </td>
                    <td>
                      <span className="chip" data-tone="info" style={{ fontSize: "11px" }}>
                        {f.targetStage.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>
                        <span className="dot" style={{ background: "var(--success)" }} /> {f.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>{f.lastSubmission}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          className="btn"
                          data-size="sm"
                          data-variant="ghost"
                          onClick={() => copyLink(f.slug)}
                          title="Copy Public Link"
                        >
                          <Icon name="link" size={12} /> Link
                        </button>
                        <button
                          className="btn"
                          data-size="sm"
                          data-variant="ghost"
                          onClick={() => copyEmbed(f.slug)}
                          title="Copy HTML Embed Iframe"
                        >
                          &lt;/&gt; Embed
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Visual Builder & Split Preview */}
      {tab === "editor" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Builder Controls */}
          <section className="card" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650, marginBottom: "4px" }}>Form Configuration</h2>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "16px" }}>
              Customize fields, labels, and target CRM pipeline routing.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="field">
                <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Form Title</label>
                <input
                  className="input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>URL Slug (/f/...)</label>
                <input
                  className="input"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  style={{ fontFamily: "var(--mono)" }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Button Text</label>
                <input
                  className="input"
                  value={formButtonText}
                  onChange={(e) => setFormButtonText(e.target.value)}
                />
              </div>

              <div className="card" style={{ padding: "12px", background: "var(--bg-soft)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)", marginBottom: "8px" }}>Included Fields:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--fs-caption)" }}>
                    <input type="checkbox" checked disabled style={{ accentColor: "var(--accent)" }} /> Full Name (Always Required)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--fs-caption)" }}>
                    <input type="checkbox" checked disabled style={{ accentColor: "var(--accent)" }} /> Mobile Phone (10-Digit WhatsApp Verified)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--fs-caption)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={requireCompany}
                      onChange={(e) => setRequireCompany(e.target.checked)}
                      style={{ accentColor: "var(--accent)" }}
                    /> Company Name Field
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--fs-caption)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={requireBudget}
                      onChange={(e) => setRequireBudget(e.target.checked)}
                      style={{ accentColor: "var(--accent)" }}
                    /> Closer Seats / Budget Dropdown
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn"
                  data-variant="primary"
                  onClick={() => {
                    setBanner("Form changes saved and published to public endpoint!");
                    setTimeout(() => setBanner(null), 3000);
                  }}
                  style={{ flex: 1 }}
                >
                  Save & Publish Form
                </button>
              </div>
            </div>
          </section>

          {/* Live Phone/Card Preview */}
          <section
            className="card"
            style={{
              padding: "24px",
              background: "var(--bg-panel)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "100%", maxWidth: "380px" }}>
              <div style={{ textAlign: "center", marginBottom: "14px" }}>
                <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                  Live Form Preview
                </span>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                  closer.ai/f/{formSlug}
                </div>
              </div>

              <div
                className="card"
                style={{
                  padding: "24px",
                  background: "var(--bg-surface)",
                  boxShadow: "var(--shadow-md)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--r-lg)",
                }}
              >
                <h3 style={{ fontSize: "var(--fs-title)", fontWeight: 650, marginBottom: "4px" }}>{formTitle}</h3>
                <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Leave your contact details and our team will connect within 15 minutes.
                </p>

                {previewSubmitted ? (
                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      background: "var(--success-soft)",
                      color: "var(--success)",
                      borderRadius: "var(--r-md)",
                    }}
                  >
                    <Icon name="check" size={24} />
                    <div style={{ fontWeight: 650, marginTop: "8px" }}>Thank You!</div>
                    <div style={{ fontSize: "var(--fs-caption)", color: "var(--text)", marginTop: "2px" }}>
                      Your demo request was received. An automated WhatsApp message was dispatched.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleTestSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div className="field">
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Your Full Name *</label>
                      <input
                        className="input"
                        placeholder="e.g. Ramesh Kulkarni"
                        value={previewName}
                        onChange={(e) => setPreviewName(e.target.value)}
                        required
                      />
                    </div>

                    {requireCompany && (
                      <div className="field">
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Company / Agency Name</label>
                        <input
                          className="input"
                          placeholder="e.g. Kulkarni & Associates"
                          value={previewCompany}
                          onChange={(e) => setPreviewCompany(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="field">
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>WhatsApp Mobile Number *</label>
                      <input
                        className="input"
                        placeholder="9876543210"
                        value={previewPhone}
                        onChange={(e) => setPreviewPhone(e.target.value)}
                        required
                      />
                    </div>

                    {requireBudget && (
                      <div className="field">
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Team Seats Needed</label>
                        <select className="select">
                          <option>1–3 Closers (SMB)</option>
                          <option>4–10 Closers (Growth)</option>
                          <option>10+ Closers (Enterprise)</option>
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn"
                      data-variant="primary"
                      style={{ marginTop: "8px", height: "38px", fontWeight: 600 }}
                    >
                      {formButtonText} <Icon name="arrow-right" size={13} />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 3: Submissions Log */}
      {tab === "submissions" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "220px" }}>Lead Contact</th>
                  <th>Phone Number</th>
                  <th>Form Submitted</th>
                  <th>UTM Traffic Source</th>
                  <th style={{ textAlign: "right" }}>Received</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_SUBMISSIONS.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{s.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{s.company}</div>
                    </td>
                    <td style={{ fontWeight: 550, fontFamily: "var(--mono)" }}>{s.phone}</td>
                    <td>
                      <span className="chip" style={{ fontSize: "11px", fontFamily: "var(--mono)" }}>
                        /f/{s.form}
                      </span>
                    </td>
                    <td>
                      <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                        {s.utm}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                      {s.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
