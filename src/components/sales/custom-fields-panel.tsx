"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Check, ExternalLink, Copy, Sliders, Layers, FileText } from "lucide-react";
import type { CustomFieldDefinition, CustomFieldType, StageConfig, SalesFormDefinition } from "@/lib/gigxomi/custom-fields-store";

export function CustomFieldsPanel() {
  const [activeSubTab, setActiveSubTab] = useState<"fields" | "stages" | "forms">("fields");
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [forms, setForms] = useState<SalesFormDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // Field Modal / Edit state
  const [editingField, setEditingField] = useState<Partial<CustomFieldDefinition> | null>(null);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);

  // Form Modal / Edit state
  const [editingForm, setEditingForm] = useState<Partial<SalesFormDefinition> | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, sRes, fmRes] = await Promise.all([
        fetch("/api/sales/custom-fields"),
        fetch("/api/sales/stages/config"),
        fetch("/api/sales/forms"),
      ]);
      const [fJson, sJson, fmJson] = await [await fRes.json(), await sRes.json(), await fmRes.json()];
      if (fJson.ok) setFields(fJson.fields || []);
      if (sJson.ok) setStages(sJson.stages || []);
      if (fmJson.ok) setForms(fmJson.forms || []);
    } catch (err) {
      console.error("Failed to load schema data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveField = async () => {
    if (!editingField || !editingField.name || !editingField.label || !editingField.type) {
      alert("Please provide Field Name, Label, and Type.");
      return;
    }
    try {
      const isEdit = Boolean(editingField.id);
      const url = isEdit ? `/api/sales/custom-fields/${editingField.id}` : "/api/sales/custom-fields";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingField),
      });
      const data = await res.json();
      if (data.ok) {
        setFieldModalOpen(false);
        setEditingField(null);
        await loadData();
      } else {
        alert(data.error || "Failed to save field");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save field");
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("Are you sure you want to delete this custom field? Existing values for this field will remain untouched.")) return;
    try {
      const res = await fetch(`/api/sales/custom-fields/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete field");
    }
  };

  const handleUpdateStage = async (stageKey: string, field: keyof StageConfig, val: any) => {
    const updated = stages.map((s) => (s.stageKey === stageKey ? { ...s, [field]: val } : s));
    setStages(updated);
    try {
      await fetch("/api/sales/stages/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error("Failed to save stage changes", err);
    }
  };

  const handleSaveForm = async () => {
    if (!editingForm || !editingForm.title || !editingForm.slug) {
      alert("Please provide Form Title and URL slug.");
      return;
    }
    try {
      const isEdit = Boolean(editingForm.id);
      const url = isEdit ? `/api/sales/forms/${editingForm.id}` : "/api/sales/forms";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingForm),
      });
      const data = await res.json();
      if (data.ok) {
        setFormModalOpen(false);
        setEditingForm(null);
        await loadData();
      } else {
        alert(data.error || "Failed to save sales form");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save sales form");
    }
  };

  const handleDeleteForm = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sales form?")) return;
    try {
      const res = await fetch(`/api/sales/forms/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete form");
    }
  };

  const copyEmbedSnippet = (slug: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://closer.gigxomi.com";
    const snippet = `<iframe src="${origin}/forms/${slug}" width="100%" height="650" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(snippet);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", color: "var(--closer-ink, #0f172a)" }}>
      {/* Header and Sub-tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)", display: "flex", alignItems: "center" }}>
            <Sliders size={20} color="var(--closer-orange, #ff6b2f)" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "8px" }} />
            CRM Schema, Stage SLAs, Field Permissions &amp; Sales Forms
          </h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--closer-muted, #64748b)" }}>
            TeleCRM-grade custom fields, role permissions, stage SLAs, and embeddable sales intake forms.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", background: "var(--closer-surface, #ffffff)", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))", padding: "0.25rem", borderRadius: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveSubTab("fields")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "6px",
              border: "none",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              background: activeSubTab === "fields" ? "var(--closer-orange, #ff6b2f)" : "transparent",
              color: activeSubTab === "fields" ? "#fff" : "var(--closer-muted, #64748b)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <Sliders size={14} /> Custom Fields ({fields.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("stages")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "6px",
              border: "none",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              background: activeSubTab === "stages" ? "var(--closer-orange, #ff6b2f)" : "transparent",
              color: activeSubTab === "stages" ? "#fff" : "var(--closer-muted, #64748b)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <Layers size={14} /> Stage Discipline & SLAs
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("forms")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "6px",
              border: "none",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              background: activeSubTab === "forms" ? "var(--closer-orange, #ff6b2f)" : "transparent",
              color: activeSubTab === "forms" ? "#fff" : "var(--closer-muted, #64748b)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <FileText size={14} /> Sales Forms ({forms.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--closer-muted, #64748b)" }}>
          Loading schema configurations...
        </div>
      ) : activeSubTab === "fields" ? (
        /* ================= SUB-TAB 1: CUSTOM FIELDS ================= */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                setEditingField({
                  name: "",
                  label: "",
                  type: "text",
                  required: false,
                  rolePermissions: { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_WRITE" },
                  sortOrder: fields.length + 1,
                });
                setFieldModalOpen(true);
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Plus size={15} /> Add Custom Field
            </button>
          </div>

          <div
            style={{
              borderRadius: "12px",
              background: "var(--closer-surface, #ffffff)",
              border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.84rem", color: "var(--closer-ink, #0f172a)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))", background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.03))" }}>
                  <th style={{ padding: "0.75rem 1rem" }}>Field Label</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Key</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Data Type</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Required</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Agent Permissions</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.14))" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--closer-ink, #0f172a)" }}>{f.label}</td>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "var(--closer-muted, #64748b)", fontSize: "0.78rem" }}>{f.name}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          background: "rgba(255, 107, 47, 0.15)",
                          color: "#ff6b2f",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {f.type}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>{f.required ? <span style={{ color: "#ef4444", fontWeight: 600 }}>Yes</span> : "Optional"}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          background:
                            f.rolePermissions.SALES_AGENT === "READ_WRITE"
                              ? "rgba(16, 185, 129, 0.15)"
                              : f.rolePermissions.SALES_AGENT === "READ_ONLY"
                              ? "rgba(59, 130, 246, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                          color:
                            f.rolePermissions.SALES_AGENT === "READ_WRITE"
                              ? "#059669"
                              : f.rolePermissions.SALES_AGENT === "READ_ONLY"
                              ? "#2563eb"
                              : "#dc2626",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {f.rolePermissions.SALES_AGENT}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingField(f);
                          setFieldModalOpen(true);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--closer-muted, #64748b)",
                          cursor: "pointer",
                          marginRight: "0.5rem",
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteField(f.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === "stages" ? (
        /* ================= SUB-TAB 2: STAGE DISCIPLINE & SLAS ================= */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--closer-muted, #64748b)" }}>
            Define response time SLAs (hours) and stage colors. Leads exceeding SLA thresholds are flagged on Kanban with overdue badges.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {stages.map((stage) => (
              <div
                key={stage.stageKey}
                style={{
                  padding: "1rem",
                  borderRadius: "12px",
                  background: "var(--closer-surface, #ffffff)",
                  border: `1px solid ${stage.color}55`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: stage.color,
                        boxShadow: `0 0 8px ${stage.color}`,
                      }}
                    />
                    <strong style={{ fontSize: "0.9rem", color: "var(--closer-ink, #0f172a)" }}>{stage.label}</strong>
                  </div>
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--closer-muted, #64748b)" }}>
                    {stage.stageKey}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--closer-muted, #64748b)" }}>
                    SLA Max Duration ({stage.slaHours ? `${stage.slaHours} hours` : "No limit"})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stage.slaHours || 0}
                    onChange={(e) => handleUpdateStage(stage.stageKey, "slaHours", Number(e.target.value))}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "6px",
                      background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                      border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                      color: "var(--closer-ink, #0f172a)",
                      fontSize: "0.82rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--closer-muted, #64748b)" }}>
                    Badge Color
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="color"
                      value={stage.color}
                      onChange={(e) => handleUpdateStage(stage.stageKey, "color", e.target.value)}
                      style={{
                        width: "36px",
                        height: "28px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        background: "transparent",
                      }}
                    />
                    <input
                      type="text"
                      value={stage.color}
                      onChange={(e) => handleUpdateStage(stage.stageKey, "color", e.target.value)}
                      style={{
                        padding: "0.3rem 0.5rem",
                        borderRadius: "4px",
                        background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                        border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                        color: "var(--closer-ink, #0f172a)",
                        fontSize: "0.78rem",
                        width: "90px",
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ================= SUB-TAB 3: SALES FORMS ================= */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--closer-muted, #64748b)" }}>
              Create public lead capture forms with embed code. Direct submissions feed directly into your CRM with automatic agent assignment.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingForm({
                  title: "",
                  slug: "",
                  description: "",
                  source: "website-form",
                  targetStage: "NEW",
                  fieldIds: [],
                  includeCustomerName: true,
                  includeCustomerPhone: true,
                  includeCustomerEmail: true,
                  includeServiceInterest: true,
                  tags: ["Inbound Web"],
                  successMessage: "Thank you! We will get in touch shortly.",
                  isActive: true,
                });
                setFormModalOpen(true);
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Plus size={15} /> Create Sales Form
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
            {forms.map((form) => (
              <div
                key={form.id}
                style={{
                  padding: "1.25rem",
                  borderRadius: "12px",
                  background: "var(--closer-surface, #ffffff)",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>{form.title}</h4>
                    <span style={{ fontSize: "0.76rem", color: "var(--closer-muted, #64748b)", fontFamily: "monospace" }}>/forms/{form.slug}</span>
                  </div>
                  <span
                    style={{
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      background: form.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: form.isActive ? "#059669" : "#ef4444",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}
                  >
                    {form.isActive ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--closer-muted, #64748b)", lineClamp: 2 }}>
                  {form.description}
                </p>

                <div style={{ display: "flex", gap: "1rem", fontSize: "0.76rem", color: "var(--closer-muted, #64748b)" }}>
                  <span>Source: <strong style={{ color: "var(--closer-ink, #0f172a)" }}>{form.source}</strong></span>
                  <span>Submissions: <strong style={{ color: "var(--closer-ink, #0f172a)" }}>{form.submissionsCount}</strong></span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => copyEmbedSnippet(form.slug)}
                    style={{
                      flex: 1,
                      padding: "0.45rem",
                      borderRadius: "6px",
                      background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                      border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                      color: "var(--closer-ink, #0f172a)",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                    }}
                  >
                    {copiedSlug === form.slug ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    {copiedSlug === form.slug ? "Copied!" : "Copy Embed Code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingForm(form);
                      setFormModalOpen(true);
                    }}
                    style={{
                      padding: "0.45rem 0.75rem",
                      borderRadius: "6px",
                      background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                      border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                      color: "var(--closer-ink, #0f172a)",
                      cursor: "pointer",
                    }}
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteForm(form.id)}
                    style={{
                      padding: "0.45rem 0.75rem",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT/CREATE CUSTOM FIELD ================= */}
      {fieldModalOpen && editingField && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#18181b",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "12px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
              {editingField.id ? "Edit Custom Field" : "Create New Custom Field"}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Field Label</label>
              <input
                type="text"
                placeholder="e.g. Budget Bracket, City, Headcount"
                value={editingField.label || ""}
                onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                style={{
                  padding: "0.5rem",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Field Key (snake_case identifier)</label>
              <input
                type="text"
                placeholder="e.g. budget_bracket"
                value={editingField.name || ""}
                onChange={(e) => setEditingField({ ...editingField, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                style={{
                  padding: "0.5rem",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                  fontFamily: "monospace",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Data Type</label>
              <select
                value={editingField.type || "text"}
                onChange={(e) => setEditingField({ ...editingField, type: e.target.value as CustomFieldType })}
                style={{
                  padding: "0.5rem",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              >
                <option value="text">Text (Single Line)</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="dropdown">Dropdown (Single Selection)</option>
                <option value="boolean">Boolean (Yes / No)</option>
                <option value="url">URL Link</option>
              </select>
            </div>

            {editingField.type === "dropdown" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Options (comma-separated)</label>
                <input
                  type="text"
                  placeholder="Option 1, Option 2, Option 3"
                  value={(editingField.options || []).join(", ")}
                  onChange={(e) =>
                    setEditingField({
                      ...editingField,
                      options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  style={{
                    padding: "0.5rem",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.85rem",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editingField.required || false}
                  onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })}
                />
                <span>Mandatory / Required</span>
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Sales Agent Permission</label>
              <select
                value={editingField.rolePermissions?.SALES_AGENT || "READ_WRITE"}
                onChange={(e) =>
                  setEditingField({
                    ...editingField,
                    rolePermissions: {
                      ...(editingField.rolePermissions || { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_WRITE" }),
                      SALES_AGENT: e.target.value as any,
                    },
                  })
                }
                style={{
                  padding: "0.5rem",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              >
                <option value="READ_WRITE">Read & Write (Editable by Agent)</option>
                <option value="READ_ONLY">Read Only (Visible to Agent)</option>
                <option value="HIDDEN">Hidden (Hidden from Agent)</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setFieldModalOpen(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT/CREATE SALES FORM ================= */}
      {formModalOpen && editingForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#18181b",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "12px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
              {editingForm.id ? "Edit Sales Intake Form" : "Create New Sales Form"}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Form Title</label>
              <input
                type="text"
                placeholder="e.g. Schedule Live Platform Demo"
                value={editingForm.title || ""}
                onChange={(e) => setEditingForm({ ...editingForm, title: e.target.value })}
                style={{
                  padding: "0.5rem",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>URL Slug (/forms/your-slug)</label>
              <input
                type="text"
                placeholder="book-demo"
                value={editingForm.slug || ""}
                onChange={(e) => setEditingForm({ ...editingForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                style={{
                  padding: "0.5rem",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                  fontFamily: "monospace",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Form Description</label>
              <textarea
                rows={2}
                placeholder="Describe what the prospect receives upon form submission"
                value={editingForm.description || ""}
                onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                style={{
                  padding: "0.5rem",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Select Custom Fields to Include</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", maxHeight: "150px", overflowY: "auto" }}>
                {fields.map((f) => {
                  const isChecked = (editingForm.fieldIds || []).includes(f.id);
                  return (
                    <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = editingForm.fieldIds || [];
                          const updated = e.target.checked ? [...current, f.id] : current.filter((id) => id !== f.id);
                          setEditingForm({ ...editingForm, fieldIds: updated });
                        }}
                      />
                      <span>{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Success Message</label>
              <input
                type="text"
                placeholder="Thank you! Our sales team is calling your number right away."
                value={editingForm.successMessage || ""}
                onChange={(e) => setEditingForm({ ...editingForm, successMessage: e.target.value })}
                style={{
                  padding: "0.5rem",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
