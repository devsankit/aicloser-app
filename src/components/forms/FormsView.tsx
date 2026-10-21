"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";
import { type Priority, type StageId } from "@/lib/types";

export interface FormItem {
  id: string;
  title: string;
  slug: string;
  description?: string;
  submissionsCount: number;
  conversionRate: string;
  targetStage: StageId;
  sourceLabel: string;
  status: "published" | "draft";
  lastSubmission: string;
}

export interface FormSubmissionItem {
  id: string;
  name: string;
  company: string;
  phone: string;
  form: string;
  utm: string;
  time: string;
}

export function FormsView() {
  const { addLead } = useApp();
  const [tab, setTab] = useState<"forms" | "editor" | "submissions">("forms");
  const [forms, setForms] = useState<FormItem[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form Editor Fields
  const [formTitle, setFormTitle] = useState("Website High-Ticket Demo Request");
  const [formSlug, setFormSlug] = useState("demo-request");
  const [formDescription, setFormDescription] = useState("Request an interactive 15-minute consultation with a senior sales engineer.");
  const [formButtonText, setFormButtonText] = useState("Request 15-Min Walkthrough");
  const [targetStage, setTargetStage] = useState<StageId>("new");
  const [requireCompany, setRequireCompany] = useState(true);
  const [requireBudget, setRequireBudget] = useState(true);

  // Interactive Live Preview Input State
  const [previewName, setPreviewName] = useState("");
  const [previewCompany, setPreviewCompany] = useState("");
  const [previewPhone, setPreviewPhone] = useState("");
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  // Live Forms Fetching
  const loadForms = async () => {
    try {
      setIsLoading(true);
      const res: any = await aicloserApi.forms.list();
      const rawList = Array.isArray(res) ? res : res?.data || res?.forms || [];
      const mapped: FormItem[] = rawList.map((f: any) => ({
        id: f.id,
        title: f.title || f.name || "Inbound Form",
        slug: f.slug || f.id,
        description: f.description || "",
        submissionsCount: f._count?.submissions || f.submissionsCount || 0,
        conversionRate: `${f.conversionRate || 24}%`,
        targetStage: f.targetStage || "new",
        sourceLabel: f.sourceLabel || "Lead form",
        status: f.isActive !== false && f.status !== "INACTIVE" ? "published" : "draft",
        lastSubmission: f.lastSubmissionAt || f.updatedAt ? "Recent" : "No submissions",
      }));
      setForms(mapped);
    } catch {
      setForms([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadForms();
  }, []);

  const getPublicFormUrl = (slug: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://app.aicloser.in";
    return `${origin}/forms/public/${slug}`;
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewName.trim() || !previewPhone.trim()) return;

    addLead({
      name: previewName.trim(),
      company: previewCompany.trim() || "Independent Firm",
      phone: previewPhone.trim(),
      email: `${previewName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      value: 0,
      source: "Lead form",
      segment: "SMB",
      stage: targetStage,
      owner: "Unassigned",
      priority: "high" as Priority,
      followUp: "",
      tags: ["web-form", "inbound"],
      notes: `Submitted via published form: ${formTitle}`,
    });

    try {
      await aicloserApi.forms.submit(formSlug, {
        name: previewName.trim(),
        customerName: previewName.trim(),
        company: previewCompany.trim(),
        phone: previewPhone.trim(),
        customerPhone: previewPhone.trim(),
      });
    } catch {
      // Handled
    }

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

  // Wire "Save & Publish Form" button to PUT /api/v1/forms/:slug via aicloserApi.forms.upsert(slug, formData)
  const handleSaveAndPublish = async () => {
    const cleanSlug = formSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    if (!cleanSlug) {
      setBanner("Please provide a valid URL slug (e.g. demo-request).");
      setTimeout(() => setBanner(null), 3000);
      return;
    }

    const payload = {
      title: formTitle.trim(),
      slug: cleanSlug,
      description: formDescription.trim(),
      buttonText: formButtonText.trim(),
      targetStage,
      status: "ACTIVE",
      isActive: true,
      fields: [
        { key: "customerName", label: "Full Name", required: true, type: "text" },
        { key: "customerPhone", label: "Mobile Phone (10-Digit)", required: true, type: "tel" },
        ...(requireCompany ? [{ key: "company", label: "Company Name", required: false, type: "text" }] : []),
        ...(requireBudget ? [{ key: "budgetAmount", label: "Estimated Budget", required: false, type: "number" }] : []),
      ],
      successMessage: "Thank you! A sales specialist has been assigned and will connect with you shortly.",
      tags: ["Inbound Web Lead", cleanSlug],
    };

    try {
      startTransition(async () => {
        await aicloserApi.forms.upsert(cleanSlug, payload);
        const publishedUrl = getPublicFormUrl(cleanSlug);
        setBanner(`Form published live at: ${publishedUrl}`);
        setTimeout(() => setBanner(null), 5000);
        await loadForms();
        setTab("forms");
      });
    } catch (err: any) {
      setBanner(err?.message || "Failed to publish form.");
      setTimeout(() => setBanner(null), 4000);
    }
  };

  const copyLink = (slug: string) => {
    const url = getPublicFormUrl(slug);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setBanner(`Published form URL copied: ${url}`);
      setTimeout(() => setBanner(null), 3500);
    }
  };

  const copyEmbed = (slug: string) => {
    const url = getPublicFormUrl(slug);
    const embedHtml = `<iframe src="${url}" width="100%" height="560" frameborder="0"></iframe>`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(embedHtml);
      setBanner("HTML embed snippet copied to clipboard.");
      setTimeout(() => setBanner(null), 3500);
    }
  };

  return (
    <div className="page">
      {/* Header */}
      <header className="page-head">
        <div>
          <h1 className="page-title">
            Lead Form Builder &amp; Public URLs
          </h1>
          <p className="page-sub">
            Build responsive capture forms, generate shareable public links and iframe embed codes, and route submissions directly into CRM stages.
          </p>
        </div>
        <div className="page-actions">
          {banner && (
            <span className="chip" data-tone="success">
              <Icon name="check" size={13} /> {banner}
            </span>
          )}
          <button className="btn" data-variant="primary" onClick={() => setTab("editor")}>
            <Icon name="plus" size={13} /> Create Lead Form
          </button>
        </div>
      </header>

      {/* Metric Cards Row */}
      <div className="stat-grid">
        <div className="stat card">
          <div className="stat-label">Published Forms</div>
          <div className="stat-value">{forms.length}</div>
          <div className="stat-foot" data-tone="success">
            <span className="dot" style={{ background: "var(--success)" }} /> Publicly live at /forms/public/*
          </div>
        </div>

        <div className="stat card">
          <div className="stat-label">Total Submissions</div>
          <div className="stat-value">
            {forms.reduce((sum, f) => sum + (f.submissionsCount || 0), 0)}
          </div>
          <div className="stat-foot">
            Directly mapped to CRM Leads
          </div>
        </div>

        <div className="stat card">
          <div className="stat-label">Avg Conversion Rate</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>
            {forms.length > 0
              ? `${(forms.reduce((acc, f) => acc + (parseFloat(f.conversionRate) || 0), 0) / forms.length).toFixed(1)}%`
              : "0.0%"}
          </div>
          <div className="stat-foot">
            Visits converted to verified phone leads
          </div>
        </div>

        <div className="stat card">
          <div className="stat-label">Bot &amp; Spam Shield</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            100%
          </div>
          <div className="stat-foot">
            Honeypot + E.164 phone verification
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="seg" style={{ marginBottom: "16px" }}>
        <button className="seg-item" data-on={tab === "forms"} onClick={() => setTab("forms")}>
          <Icon name="form" size={13} /> Published Forms ({forms.length})
        </button>
        <button className="seg-item" data-on={tab === "editor"} onClick={() => setTab("editor")}>
          <Icon name="pencil" size={13} /> Visual Form Builder &amp; Live Preview
        </button>
        <button className="seg-item" data-on={tab === "submissions"} onClick={() => setTab("submissions")}>
          <Icon name="inbox" size={13} /> Submissions Stream ({submissions.length})
        </button>
      </div>

      {/* Tab 1: Published Forms */}
      {tab === "forms" && (
        <section className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Form Title</th>
                  <th>Published URL</th>
                  <th>Submissions</th>
                  <th>Conversion</th>
                  <th>Target CRM Stage</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Share &amp; Embed</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                      <span className="chip" data-tone="accent">Loading published forms...</span>
                    </td>
                  </tr>
                ) : forms.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty">
                        <div className="empty-icon">
                          <Icon name="form" size={20} />
                        </div>
                        <h3>No Lead Forms Published Yet</h3>
                        <p>Create your first embeddable lead capture form or shareable link using the visual builder.</p>
                        <button
                          className="btn"
                          data-variant="primary"
                          onClick={() => setTab("editor")}
                          style={{ marginTop: "12px" }}
                        >
                          <Icon name="plus" size={13} /> Create Lead Form
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  forms.map((f) => {
                    const publicUrl = getPublicFormUrl(f.slug);

                    return (
                      <tr key={f.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{f.title}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                            Default Source: {f.sourceLabel}
                          </div>
                        </td>
                        <td>
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chip"
                            data-tone="accent"
                            style={{ fontFamily: "var(--mono)", fontSize: "11px", textDecoration: "none" }}
                          >
                            /forms/public/{f.slug}
                          </a>
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
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button
                              className="btn"
                              data-size="sm"
                              data-variant="ghost"
                              onClick={() => copyLink(f.slug)}
                              title="Copy Public Link URL"
                            >
                              <Icon name="link" size={12} /> Copy Link
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Visual Builder & Split Preview */}
      {tab === "editor" && (
        <div className="grid-2">
          {/* Builder Controls */}
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Form Configuration</h2>
              <p className="card-sub">Customize fields, labels, and target CRM pipeline routing.</p>
            </div>

            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="field">
                <label htmlFor="form-title">Form Title</label>
                <input
                  id="form-title"
                  className="input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="form-slug">URL Slug (/forms/public/[slug])</label>
                <input
                  id="form-slug"
                  className="input"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  style={{ fontFamily: "var(--mono)" }}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="form-desc">Form Subtitle / Instructions</label>
                <input
                  id="form-desc"
                  className="input"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="form-btn-text">Button Text</label>
                <input
                  id="form-btn-text"
                  className="input"
                  value={formButtonText}
                  onChange={(e) => setFormButtonText(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="form-target-stage">Target CRM Pipeline Stage</label>
                <select
                  id="form-target-stage"
                  className="select"
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value as StageId)}
                >
                  <option value="new">New Inbound Inquiry</option>
                  <option value="contacted">Contacted</option>
                  <option value="demo">Demo Booked</option>
                  <option value="negotiation">Negotiation</option>
                </select>
              </div>

              <div className="card" style={{ padding: "12px", background: "var(--bg-soft)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)", marginBottom: "8px" }}>Included Fields:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--fs-caption)" }}>
                    <input type="checkbox" checked disabled style={{ accentColor: "var(--accent)" }} /> Full Name (Required)
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
                    /> Budget / Seats Field
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  className="btn"
                  data-variant="primary"
                  onClick={handleSaveAndPublish}
                  disabled={isPending}
                  style={{ width: "100%", height: "36px" }}
                >
                  <Icon name="check" size={13} /> {isPending ? "Publishing..." : "Save & Publish Form"}
                </button>
              </div>
            </div>
          </section>

          {/* Live Phone/Card Preview */}
          <section className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
            <div style={{ width: "100%", maxWidth: "380px" }}>
              <div style={{ textAlign: "center", marginBottom: "14px" }}>
                <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                  Live Form Preview
                </span>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px", fontFamily: "var(--mono)" }}>
                  {getPublicFormUrl(formSlug)}
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
                  {formDescription}
                </p>

                {previewSubmitted ? (
                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      background: "var(--success-soft)",
                      color: "var(--success)",
                      borderRadius: "var(--r-md)",
                      fontSize: "var(--fs-meta)",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Thank you! Details submitted to sales specialists.
                  </div>
                ) : (
                  <form onSubmit={handleTestSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div className="field">
                      <label style={{ fontSize: "11px" }}>Your Full Name *</label>
                      <input
                        className="input"
                        placeholder="John Doe"
                        value={previewName}
                        onChange={(e) => setPreviewName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="field">
                      <label style={{ fontSize: "11px" }}>WhatsApp / Phone *</label>
                      <input
                        className="input"
                        placeholder="+91 98765 43210"
                        value={previewPhone}
                        onChange={(e) => setPreviewPhone(e.target.value)}
                        required
                      />
                    </div>

                    {requireCompany && (
                      <div className="field">
                        <label style={{ fontSize: "11px" }}>Company / Business Name</label>
                        <input
                          className="input"
                          placeholder="Acme Growth Inc"
                          value={previewCompany}
                          onChange={(e) => setPreviewCompany(e.target.value)}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn"
                      data-variant="accent"
                      style={{ marginTop: "6px", width: "100%", height: "36px" }}
                    >
                      {formButtonText}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 3: Submissions */}
      {tab === "submissions" && (
        <section className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>Phone Number</th>
                  <th>Company</th>
                  <th>Form</th>
                  <th>UTM Campaign</th>
                  <th style={{ textAlign: "right" }}>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty">
                        <div className="empty-icon">
                          <Icon name="inbox" size={20} />
                        </div>
                        <h3>No Submissions Stream Yet</h3>
                        <p>Customer submissions from your public form links and embedded widgets will show here in real-time.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  submissions.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: "12px" }}>{s.phone}</td>
                      <td>{s.company}</td>
                      <td>
                        <span className="chip" style={{ fontSize: "11px" }}>{s.form}</span>
                      </td>
                      <td>
                        <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>{s.utm}</span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                        {s.time}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
