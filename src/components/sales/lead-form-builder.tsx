"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Lock,
  Plus,
  RefreshCw,
  Share2,
  Sliders,
  Trash2,
  Unlock,
  Users,
  X,
  Code,
  Sparkles,
} from "lucide-react";

import type { SalesFormDefinition, CustomFieldDefinition } from "@/lib/gigxomi/custom-fields-store";

type LeadFormBuilderProps = {
  isAdmin?: boolean;
  onOpenMultiChannelChat?: (leadId: string) => void;
};

type LeadSubmissionItem = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceInterest: string;
  budgetAmount: number;
  stage: string;
  assignedAgentName: string;
  notes: string;
  tags: string[];
  createdAt: string;
};

export function LeadFormBuilder({ isAdmin = true, onOpenMultiChannelChat }: LeadFormBuilderProps) {
  const [forms, setForms] = useState<SalesFormDefinition[]>([]);
  const [availableFields, setAvailableFields] = useState<CustomFieldDefinition[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Active form editor view: "builder" | "preview" | "submissions"
  const [viewTab, setViewTab] = useState<"builder" | "preview" | "submissions">("builder");

  // Edit / Create Form Draft State
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [formDraft, setFormDraft] = useState<Partial<SalesFormDefinition>>({
    title: "",
    slug: "",
    description: "",
    source: "inbound_web_form",
    fieldIds: ["fld-industry", "fld-city"],
    assignedAgentId: "round_robin",
    targetStage: "NEW",
    tags: ["Inbound Web Lead"],
    successMessage: "Thank you for reaching out! A sales specialist has been assigned and will connect with you on WhatsApp shortly.",
    redirectUrl: "",
    isActive: true,
  });

  // Share / Embed Modal
  const [shareModalForm, setShareModalForm] = useState<SalesFormDefinition | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Submissions for active form
  const [submissions, setSubmissions] = useState<LeadSubmissionItem[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<LeadSubmissionItem | null>(null);
  const [isSavingLeadDetails, setIsSavingLeadDetails] = useState(false);

  // Permission: Allow Non-Admins to Modify Lead Details
  const [allowNonAdminModify, setAllowNonAdminModify] = useState(true);

  const activeForm = useMemo(() => {
    return forms.find((f) => f.id === activeFormId) || forms[0] || null;
  }, [forms, activeFormId]);

  const loadFormsAndFields = async () => {
    setLoading(true);
    try {
      const [formsRes, fieldsRes, rrRes] = await Promise.all([
        fetch("/api/sales/forms"),
        fetch("/api/sales/custom-fields"),
        fetch("/api/sales/round-robin"),
      ]);
      const formsData = await formsRes.json();
      const fieldsData = await fieldsRes.json();
      const rrData = await rrRes.json();

      if (formsData.ok && formsData.forms) {
        setForms(formsData.forms);
        if (!activeFormId && formsData.forms.length > 0) {
          setActiveFormId(formsData.forms[0].id);
        }
      }
      if (fieldsData.ok && fieldsData.fields) {
        setAvailableFields(fieldsData.fields);
      }
      if (rrData.ok && rrData.settings) {
        setAllowNonAdminModify(rrData.settings.allowNonAdminModifyLeads !== false);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFormsAndFields();
  }, []);

  // Load submissions for active form from CRM leads
  useEffect(() => {
    if (!activeForm) return;
    async function loadSubmissions() {
      try {
        const res = await fetch("/api/sales/dashboard");
        const data = await res.json();
        if (data.ok && data.snapshot?.visibleLeads) {
          const formTag = activeForm?.title;
          const matching = data.snapshot.visibleLeads.filter(
            (l: any) =>
              (l.source || "").toLowerCase().includes("form") ||
              (l.notes || "").includes(activeForm?.title || "") ||
              (l.tags || []).some((t: string) => t.toLowerCase() === formTag?.toLowerCase()),
          );
          setSubmissions(
            matching.map((l: any) => ({
              id: l.id,
              customerName: l.customerName,
              customerPhone: l.customerPhone || "",
              customerEmail: l.customerEmail || "",
              serviceInterest: l.serviceInterest || activeForm?.title || "",
              budgetAmount: l.budgetAmount || 0,
              stage: l.stage,
              assignedAgentName: l.assignedAgentName || "Round-Robin Assigned",
              notes: l.notes || "",
              tags: l.tags || [],
              createdAt: l.createdAt,
            })),
          );
        }
      } catch {}
    }
    void loadSubmissions();
  }, [activeForm]);

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDraft.title || !formDraft.slug) return;

    try {
      const res = await fetch("/api/sales/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDraft),
      });
      const data = await res.json();
      if (data.ok) {
        setBanner({ tone: "success", text: `Form "${data.form.title}" saved successfully!` });
        setIsEditingForm(false);
        await loadFormsAndFields();
        setActiveFormId(data.form.id);
      } else {
        setBanner({ tone: "error", text: data.error || "Failed to save form" });
      }
    } catch (err: any) {
      setBanner({ tone: "error", text: err.message || "Failed to save form" });
    }
  };

  const handleOpenNewForm = () => {
    const slugSuffix = Math.random().toString(36).slice(2, 6);
    setFormDraft({
      title: "New Lead Capture Form",
      slug: `lead-intake-${slugSuffix}`,
      description: "Fill out the form below to connect with our specialized team on WhatsApp.",
      source: "inbound_web_form",
      fieldIds: ["fld-industry", "fld-city"],
      assignedAgentId: "round_robin",
      targetStage: "NEW",
      tags: ["Inbound Web Lead"],
      successMessage: "Thank you for reaching out! A dedicated sales specialist will connect with you on WhatsApp shortly.",
      redirectUrl: "",
      isActive: true,
    });
    setIsEditingForm(true);
  };

  const handleEditActiveForm = () => {
    if (!activeForm) return;
    setFormDraft({ ...activeForm });
    setIsEditingForm(true);
  };

  const toggleFieldInForm = (fieldId: string) => {
    const current = formDraft.fieldIds || [];
    if (current.includes(fieldId)) {
      setFormDraft({ ...formDraft, fieldIds: current.filter((id) => id !== fieldId) });
    } else {
      setFormDraft({ ...formDraft, fieldIds: [...current, fieldId] });
    }
  };

  const handleSaveLeadDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;
    setIsSavingLeadDetails(true);
    try {
      const res = await fetch(`/api/sales/leads/${selectedSubmission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: selectedSubmission.customerName,
          customerPhone: selectedSubmission.customerPhone,
          customerEmail: selectedSubmission.customerEmail,
          serviceInterest: selectedSubmission.serviceInterest,
          budgetAmount: selectedSubmission.budgetAmount,
          stage: selectedSubmission.stage,
          notes: selectedSubmission.notes,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBanner({ tone: "success", text: `Lead details for ${selectedSubmission.customerName} updated.` });
        setSelectedSubmission(null);
        await loadFormsAndFields();
      }
    } catch {
      setBanner({ tone: "error", text: "Failed to update lead details." });
    } finally {
      setIsSavingLeadDetails(false);
    }
  };

  const canModifyLeadDetails = isAdmin || allowNonAdminModify;

  return (
    <div className="crm-lead-form-builder" style={{ display: "grid", gap: 20 }}>
      {/* Top Banner Notice */}
      {banner ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: banner.tone === "success" ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
            border: `1px solid ${banner.tone === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: banner.tone === "success" ? "#10b981" : "#ef4444",
            fontWeight: 600,
            fontSize: "0.88rem",
          }}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {/* Header Bar */}
      <div
        className="crm-panel"
        style={{
          padding: 22,
          borderRadius: 18,
          background: "var(--crm-surface)",
          border: "1px solid var(--crm-border)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "var(--crm-primary-soft)",
                  color: "var(--crm-primary)",
                }}
              >
                Lead Capture Engine
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--crm-success) 12%, var(--crm-surface))",
                  color: "var(--crm-success)",
                }}
              >
                {forms.length} Active Forms • Auto Round-Robin
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
              Drag & Drop Lead Form Builder & Submissions Space
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: "0.86rem", color: "var(--muted)", maxWidth: 740 }}>
              Create branded lead generation forms to share anywhere or embed on WordPress/Shopify. Submissions are auto-distributed to sales reps via <strong>Round-Robin</strong> and collected in a dedicated space with full lead modification controls.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="primary-button"
              onClick={handleOpenNewForm}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <Plus size={15} /> Create New Form
            </button>
          </div>
        </div>

        {/* Form Selector Tabs */}
        <div style={{ display: "flex", gap: 8, marginTop: 18, overflowX: "auto", paddingBottom: 4 }}>
          {forms.map((f) => {
            const isSelected = activeFormId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFormId(f.id);
                  setIsEditingForm(false);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 12,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: isSelected
                    ? "2px solid var(--crm-primary)"
                    : "1px solid var(--crm-border)",
                  background: isSelected ? "var(--crm-primary-soft)" : "var(--crm-surface-soft)",
                  color: isSelected ? "var(--crm-primary)" : "var(--crm-text)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                <FileText size={14} />
                <span>{f.title}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: "rgba(148, 163, 184, 0.16)",
                  }}
                >
                  {f.submissionsCount} leads
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Workspace Header */}
      {activeForm && !isEditingForm ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            padding: "12px 18px",
            borderRadius: 14,
            background: "var(--crm-surface-soft)",
            border: "1px solid var(--crm-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: "1.05rem" }}>{activeForm.title}</span>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
              /forms/{activeForm.slug}
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "color-mix(in srgb, var(--crm-success) 12%, var(--crm-surface))",
                color: "var(--crm-success)",
              }}
            >
              Auto Round-Robin Distribution
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "inline-flex", background: "var(--crm-surface)", borderRadius: 10, padding: 3, border: "1px solid var(--crm-border)" }}>
              <button
                type="button"
                onClick={() => setViewTab("builder")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: viewTab === "builder" ? "var(--crm-primary)" : "transparent",
                  color: viewTab === "builder" ? "#fff" : "var(--crm-text-secondary)",
                }}
              >
                Form Fields
              </button>
              <button
                type="button"
                onClick={() => setViewTab("preview")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: viewTab === "preview" ? "var(--crm-primary)" : "transparent",
                  color: viewTab === "preview" ? "#fff" : "var(--crm-text-secondary)",
                }}
              >
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setViewTab("submissions")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: viewTab === "submissions" ? "var(--crm-primary)" : "transparent",
                  color: viewTab === "submissions" ? "#fff" : "var(--crm-text-secondary)",
                }}
              >
                Submissions ({submissions.length})
              </button>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={handleEditActiveForm}
              style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <Edit2 size={13} /> Edit Settings
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShareModalForm(activeForm)}
              style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, color: "#3b82f6" }}
            >
              <Share2 size={13} /> Share & Embed
            </button>
          </div>
        </div>
      ) : null}

      {/* TAB 1: FORM FIELDS BUILDER VIEW */}
      {viewTab === "builder" && activeForm && !isEditingForm ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 18 }}>
          {/* Left Column: Form Configuration & Included Fields */}
          <div className="crm-panel" style={{ padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>Active Form Fields</h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--muted)" }}>
              Core fields are captured automatically for every lead. Custom fields can be enabled below.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              {/* Default Permanent Fields */}
              <div style={{ padding: 12, borderRadius: 10, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Full Customer Name</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Standard Name input</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.2)", color: "#10b981" }}>REQUIRED</span>
              </div>

              <div style={{ padding: 12, borderRadius: 10, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 13 }}>WhatsApp Phone Number</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Normalized to E.164 (+91...) for WhatsApp auto-connect</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.2)", color: "#10b981" }}>REQUIRED</span>
              </div>

              <div style={{ padding: 12, borderRadius: 10, background: "var(--surface-strong, rgba(15, 23, 42, 0.45))", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Email Address</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Enables omnichannel email enquiry threads</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.2)" }}>OPTIONAL</span>
              </div>

              <div style={{ padding: 12, borderRadius: 10, background: "var(--surface-strong, rgba(15, 23, 42, 0.45))", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Service Interest / Requirements</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Sets lead topic & sales pipeline card subtitle</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.2)" }}>OPTIONAL</span>
              </div>

              {/* Dynamic Custom Fields in this form */}
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  ENABLE ADDITIONAL CUSTOM FIELDS
                </span>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {availableFields.map((field) => {
                    const isIncluded = (activeForm.fieldIds || []).includes(field.id);
                    return (
                      <div
                        key={field.id}
                        onClick={async () => {
                          const updated = isIncluded
                            ? activeForm.fieldIds.filter((id) => id !== field.id)
                            : [...(activeForm.fieldIds || []), field.id];
                          await fetch("/api/sales/forms", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ...activeForm, fieldIds: updated }),
                          });
                          await loadFormsAndFields();
                        }}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: isIncluded
                            ? "rgba(59, 130, 246, 0.12)"
                            : "var(--surface-strong, rgba(15, 23, 42, 0.35))",
                          border: isIncluded
                            ? "1px solid #3b82f6"
                            : "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 12.5 }}>{field.label}</strong>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Type: {field.type}</div>
                        </div>
                        <input type="checkbox" checked={isIncluded} readOnly />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Mockup */}
          <div className="crm-panel" style={{ padding: 22, borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--crm-primary)" }}>
                Interactive Form Preview
              </span>
              <a
                href={`/forms/${activeForm.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--crm-info)", textDecoration: "none" }}
              >
                Open Live Form <ExternalLink size={12} />
              </a>
            </div>

            <div
              style={{
                borderRadius: 14,
                padding: 24,
                background: "var(--crm-surface-soft)",
                border: "1px solid var(--crm-primary-border)",
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "1.2rem", fontWeight: 800 }}>{activeForm.title}</h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{activeForm.description}</p>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Full Name *</label>
                  <input type="text" placeholder="e.g. Vikram Sharma" disabled style={{ width: "100%", padding: 9, borderRadius: 8, opacity: 0.8 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>WhatsApp Mobile Number *</label>
                  <input type="tel" placeholder="+91 98200 11223" disabled style={{ width: "100%", padding: 9, borderRadius: 8, opacity: 0.8 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Email Address</label>
                  <input type="email" placeholder="vikram@company.in" disabled style={{ width: "100%", padding: 9, borderRadius: 8, opacity: 0.8 }} />
                </div>

                {availableFields
                  .filter((f) => (activeForm.fieldIds || []).includes(f.id))
                  .map((field) => (
                    <div key={field.id}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{field.label}</label>
                      {field.type === "dropdown" ? (
                        <select disabled style={{ width: "100%", padding: 9, borderRadius: 8, opacity: 0.8 }}>
                          <option>{field.placeholder || "Select option"}</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" placeholder={field.placeholder || ""} disabled style={{ width: "100%", padding: 9, borderRadius: 8, opacity: 0.8 }} />
                      )}
                    </div>
                  ))}

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Notes / Message</label>
                  <textarea rows={2} placeholder="Describe your requirement..." disabled style={{ width: "100%", padding: 8, borderRadius: 8, opacity: 0.8 }} />
                </div>

                <button
                  type="button"
                  disabled
                  className="primary-button"
                  style={{ marginTop: 6, opacity: 0.85, cursor: "default" }}
                >
                  Submit & Connect on WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 2: LIVE PREVIEW IFRAME */}
      {viewTab === "preview" && activeForm && !isEditingForm ? (
        <div className="crm-panel" style={{ padding: 20, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Full Hosted Page Preview</span>
            <a
              href={`/forms/${activeForm.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, color: "#3b82f6", textDecoration: "none" }}
            >
              Open in New Window <ExternalLink size={13} />
            </a>
          </div>
          <iframe
            src={`/forms/${activeForm.slug}`}
            title="Form Preview"
            style={{ width: "100%", height: 640, borderRadius: 12, border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))" }}
          />
        </div>
      ) : null}

      {/* TAB 3: DEDICATED SUBMISSIONS SPACE & LEAD DETAILS MODIFIER */}
      {viewTab === "submissions" && activeForm && !isEditingForm ? (
        <div className="crm-panel" style={{ padding: 20, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Collected Leads for &ldquo;{activeForm.title}&rdquo;</h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                Every lead submitted through this form is recorded here. Click any lead to modify details anytime.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              {canModifyLeadDetails ? (
                <span style={{ color: "#10b981", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Unlock size={14} /> Lead Modification Enabled
                </span>
              ) : (
                <span style={{ color: "#ef4444", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Lock size={14} /> Editing Locked by Admin
                </span>
              )}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 8px" }}>Lead Name</th>
                  <th style={{ padding: "10px 8px" }}>WhatsApp Phone</th>
                  <th style={{ padding: "10px 8px" }}>Email</th>
                  <th style={{ padding: "10px 8px" }}>Assigned Closer</th>
                  <th style={{ padding: "10px 8px" }}>Stage</th>
                  <th style={{ padding: "10px 8px" }}>Submitted At</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
                      No submissions received yet for this form. Share your public link to start collecting leads!
                    </td>
                  </tr>
                ) : (
                  submissions.map((lead) => (
                    <tr
                      key={lead.id}
                      style={{ borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.16))" }}
                    >
                      <td style={{ padding: "11px 8px", fontWeight: 700 }}>{lead.customerName}</td>
                      <td style={{ padding: "11px 8px", fontFamily: "monospace" }}>{lead.customerPhone || "—"}</td>
                      <td style={{ padding: "11px 8px", color: "var(--muted)" }}>{lead.customerEmail || "—"}</td>
                      <td style={{ padding: "11px 8px" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", fontWeight: 600 }}>
                          {lead.assignedAgentName}
                        </span>
                      </td>
                      <td style={{ padding: "11px 8px" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(148, 163, 184, 0.15)", fontWeight: 700 }}>
                          {lead.stage}
                        </span>
                      </td>
                      <td style={{ padding: "11px 8px", color: "var(--muted)", fontSize: 12 }}>
                        {new Date(lead.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td style={{ padding: "11px 8px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setSelectedSubmission(lead)}
                            style={{ padding: "4px 8px", fontSize: 11.5 }}
                          >
                            <Edit2 size={12} style={{ marginRight: 4 }} />
                            {canModifyLeadDetails ? "Edit Details" : "View Details"}
                          </button>
                          {onOpenMultiChannelChat ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => onOpenMultiChannelChat(lead.id)}
                              style={{ padding: "4px 8px", fontSize: 11.5 }}
                            >
                              Chat
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* CREATE / EDIT FORM SETTINGS MODAL */}
      {isEditingForm ? (
        <div className="crm-panel" style={{ padding: 22, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
              {formDraft.id ? "Edit Form Settings" : "Create New Lead Form"}
            </h3>
            <button type="button" className="secondary-button" onClick={() => setIsEditingForm(false)}>
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSaveForm} style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Form Title *</label>
                <input
                  type="text"
                  value={formDraft.title || ""}
                  onChange={(e) => setFormDraft({ ...formDraft, title: e.target.value })}
                  placeholder="e.g. VIP Consultation Intake"
                  required
                  style={{ width: "100%", padding: 9, borderRadius: 8 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>URL Slug (/forms/[slug]) *</label>
                <input
                  type="text"
                  value={formDraft.slug || ""}
                  onChange={(e) => setFormDraft({ ...formDraft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                  placeholder="e.g. vip-consultation"
                  required
                  style={{ width: "100%", padding: 9, borderRadius: 8, fontFamily: "monospace" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Description / Subtitle</label>
              <textarea
                rows={2}
                value={formDraft.description || ""}
                onChange={(e) => setFormDraft({ ...formDraft, description: e.target.value })}
                placeholder="Brief description shown at top of the form..."
                style={{ width: "100%", padding: 8, borderRadius: 8 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Lead Distribution Rule
                </label>
                <select
                  value={formDraft.assignedAgentId || "round_robin"}
                  onChange={(e) => setFormDraft({ ...formDraft, assignedAgentId: e.target.value })}
                  style={{ width: "100%", padding: 9, borderRadius: 8 }}
                >
                  <option value="round_robin">Auto-Distribute to Sales Team (Round-Robin)</option>
                  <option value="">Pool / Queue (Manual Claim)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Initial CRM Stage</label>
                <select
                  value={formDraft.targetStage || "NEW"}
                  onChange={(e) => setFormDraft({ ...formDraft, targetStage: e.target.value })}
                  style={{ width: "100%", padding: 9, borderRadius: 8 }}
                >
                  <option value="NEW">New Leads</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="INTERESTED">Interested / Qualified</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Success Message</label>
                <input
                  type="text"
                  value={formDraft.successMessage || ""}
                  onChange={(e) => setFormDraft({ ...formDraft, successMessage: e.target.value })}
                  placeholder="Thank you! We received your request."
                  style={{ width: "100%", padding: 9, borderRadius: 8 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Optional Redirect URL</label>
                <input
                  type="url"
                  value={formDraft.redirectUrl || ""}
                  onChange={(e) => setFormDraft({ ...formDraft, redirectUrl: e.target.value })}
                  placeholder="https://yourwebsite.com/thank-you"
                  style={{ width: "100%", padding: 9, borderRadius: 8 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button type="button" className="secondary-button" onClick={() => setIsEditingForm(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button">
                Save Form
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* SHARE & EMBED MODAL */}
      {shareModalForm ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 580,
              borderRadius: 18,
              padding: 24,
              background: "var(--closer-surface, #0f172a)",
              border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "1.1rem" }}>Share & Embed: {shareModalForm.title}</strong>
              <button type="button" className="secondary-button" onClick={() => setShareModalForm(null)}>
                <X size={15} />
              </button>
            </div>

            {/* Public Link */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Hosted Form Public Link
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/forms/${shareModalForm.slug}` : `/forms/${shareModalForm.slug}`}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const url = `${window.location.origin}/forms/${shareModalForm.slug}`;
                    void navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}
                >
                  {copiedLink ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {copiedLink ? "Copied" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* Embed Code Snippet */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Embed Code (Paste into WordPress, Webflow, Shopify, or any HTML Page)
              </label>
              <div style={{ display: "grid", gap: 8 }}>
                <textarea
                  rows={3}
                  readOnly
                  value={`<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/forms/${shareModalForm.slug}" width="100%" height="680" frameborder="0" style="border:none;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,0.15)"></iframe>`}
                  style={{ padding: 10, borderRadius: 8, fontSize: 11.5, fontFamily: "monospace", width: "100%" }}
                />
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    const code = `<iframe src="${window.location.origin}/forms/${shareModalForm.slug}" width="100%" height="680" frameborder="0" style="border:none;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,0.15)"></iframe>`;
                    void navigator.clipboard.writeText(code);
                    setCopiedEmbed(true);
                    setTimeout(() => setCopiedEmbed(false), 2000);
                  }}
                  style={{ justifySelf: "start", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  {copiedEmbed ? <Check size={14} /> : <Code size={14} />}
                  {copiedEmbed ? "Copied Embed HTML" : "Copy Embed HTML"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* LEAD DETAILS & MODIFIER MODAL */}
      {selectedSubmission ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              borderRadius: 18,
              padding: 24,
              background: "var(--closer-surface, #0f172a)",
              border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "1.1rem" }}>Lead Details: {selectedSubmission.customerName}</strong>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Captured from form • Assigned to {selectedSubmission.assignedAgentName}
                </div>
              </div>
              <button type="button" className="secondary-button" onClick={() => setSelectedSubmission(null)}>
                <X size={15} />
              </button>
            </div>

            {!canModifyLeadDetails ? (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", fontSize: 12, fontWeight: 600 }}>
                Editing lead details is restricted by the workspace administrator. You can view the details below.
              </div>
            ) : null}

            <form onSubmit={handleSaveLeadDetails} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Customer Name</label>
                  <input
                    type="text"
                    disabled={!canModifyLeadDetails}
                    value={selectedSubmission.customerName}
                    onChange={(e) => setSelectedSubmission({ ...selectedSubmission, customerName: e.target.value })}
                    style={{ width: "100%", padding: 8, borderRadius: 8, fontSize: 12.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>WhatsApp Phone</label>
                  <input
                    type="tel"
                    disabled={!canModifyLeadDetails}
                    value={selectedSubmission.customerPhone}
                    onChange={(e) => setSelectedSubmission({ ...selectedSubmission, customerPhone: e.target.value })}
                    style={{ width: "100%", padding: 8, borderRadius: 8, fontSize: 12.5 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Email Address</label>
                  <input
                    type="email"
                    disabled={!canModifyLeadDetails}
                    value={selectedSubmission.customerEmail}
                    onChange={(e) => setSelectedSubmission({ ...selectedSubmission, customerEmail: e.target.value })}
                    style={{ width: "100%", padding: 8, borderRadius: 8, fontSize: 12.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>CRM Stage</label>
                  <select
                    disabled={!canModifyLeadDetails}
                    value={selectedSubmission.stage}
                    onChange={(e) => setSelectedSubmission({ ...selectedSubmission, stage: e.target.value })}
                    style={{ width: "100%", padding: 8, borderRadius: 8, fontSize: 12.5 }}
                  >
                    <option value="NEW">New Leads</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="INTERESTED">Interested / Qualified</option>
                    <option value="FOLLOW_UP">Follow-Up Needed</option>
                    <option value="CLOSED_WON">Closed Won</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Notes / Requirements</label>
                <textarea
                  rows={3}
                  disabled={!canModifyLeadDetails}
                  value={selectedSubmission.notes}
                  onChange={(e) => setSelectedSubmission({ ...selectedSubmission, notes: e.target.value })}
                  style={{ width: "100%", padding: 8, borderRadius: 8, fontSize: 12.5 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button type="button" className="secondary-button" onClick={() => setSelectedSubmission(null)}>
                  Close
                </button>
                {canModifyLeadDetails ? (
                  <button type="submit" className="primary-button" disabled={isSavingLeadDetails}>
                    {isSavingLeadDetails ? "Saving..." : "Save Changes"}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
