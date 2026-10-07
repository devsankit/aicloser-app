"use client";

import { useEffect, useState } from "react";
import { Zap, Plus, Trash2, Edit2, Play, CheckCircle2, Copy, Check, ArrowRight, Shield, Globe, ClipboardList } from "lucide-react";
import type { WorkflowRule, WorkflowExecutionLog, TriggerType, ActionType } from "@/lib/gigxomi/automation-engine-store";

export function AutomationWorkflowsPanel() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [logs, setLogs] = useState<WorkflowExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<WorkflowRule> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, lRes] = await Promise.all([
        fetch("/api/sales/automations"),
        fetch("/api/sales/automations/logs"),
      ]);
      const [rJson, lJson] = await [await rRes.json(), await lRes.json()];
      if (rJson.ok) setRules(rJson.rules || []);
      if (lJson.ok) setLogs(lJson.logs || []);
    } catch (err) {
      console.error("Failed to load automations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleRule = async (rule: WorkflowRule) => {
    try {
      const updated = { ...rule, isActive: !rule.isActive };
      const res = await fetch(`/api/sales/automations/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (data.ok) await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRule = async () => {
    if (!editingRule || !editingRule.name || !editingRule.trigger?.type) {
      alert("Rule name and trigger are required.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingRule.id);
      const url = isEdit ? `/api/sales/automations/${editingRule.id}` : "/api/sales/automations";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRule),
      });
      const data = await res.json();
      if (data.ok) {
        setModalOpen(false);
        setEditingRule(null);
        await loadData();
      } else {
        alert(data.error || "Failed to save workflow");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow rule?")) return;
    try {
      const res = await fetch(`/api/sales/automations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete rule");
    }
  };

  const [apiKeys, setApiKeys] = useState([
    {
      id: "key-prod-1",
      name: "Production CRM & Lead Ingestion Key",
      token: "aic_live_98f2a4c7d1e8b3095a6f12d4",
      scope: "leads:write, webhooks:trigger, calls:sync",
      created: "Active • Never expires",
    },
    {
      id: "key- analytics-2",
      name: "Reporting & MCP Analytics Key",
      token: "aic_live_41b9e2d8c6a0f7318e5b90c2",
      scope: "reports:read, segments:read",
      created: "Active • Read-only",
    },
  ]);

  const handleGenerateApiKey = () => {
    const label = typeof window !== "undefined" ? window.prompt("Enter a name for the new Workspace API Key:", "External ERP / Zapier Integration") : null;
    if (!label || !label.trim()) return;
    const randomHex = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    setApiKeys((prev) => [
      ...prev,
      {
        id: `key-${Date.now()}`,
        name: label.trim(),
        token: `aic_live_${randomHex}`,
        scope: "leads:write, webhooks:trigger, reports:read",
        created: "Created just now",
      },
    ]);
  };

  const handleRevokeApiKey = (id: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const copyWebhookUrl = (key: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://closer.gigxomi.com";
    const url = `${origin}/api/sales/webhooks/incoming/${key}`;
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const copyRawToken = (id: string, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)", display: "flex", alignItems: "center" }}>
            <Zap size={20} color="var(--closer-orange, #ff6b2f)" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "8px" }} />
            Workflow Automation, Schedules, Webhooks &amp; API Keys
          </h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--closer-muted, #64748b)" }}>
            Durable Event & Schedule → Condition → Action pipeline across WhatsApp, Stage transitions, SIM calling, Webhooks, and REST APIs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingRule({
              name: "",
              description: "",
              isActive: true,
              trigger: { type: "LEAD_CREATED" },
              conditions: [{ field: "priority", operator: "EQUALS", value: "hot" }],
              actions: [{ type: "SEND_WHATSAPP", delayMinutes: 1, messageText: "Hi {{name}}, thanks for your inquiry!" }],
            });
            setModalOpen(true);
          }}
          style={{
            padding: "0.55rem 1.1rem",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: "0.84rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            boxShadow: "0 4px 14px rgba(255, 107, 47, 0.35)",
          }}
        >
          <Plus size={16} /> Create Automation Rule
        </button>
      </div>

      {/* Webhook Endpoints Strip */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderRadius: "12px",
          background: "var(--closer-surface, #ffffff)",
          border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Globe size={16} color="var(--closer-orange, #ff6b2f)" />
          <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
            Inbound Webhook Connectors (Meta Ads, Google, Zapier, IndiaMART)
          </h4>
        </div>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--closer-muted, #64748b)" }}>
          Paste these endpoint URLs into Meta Lead Ads Webhook settings or Zapier to ingest leads instantly:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.5rem", marginTop: "0.25rem" }}>
          {[
            { label: "Meta Lead Ads (Facebook / Instagram)", key: "meta-ads" },
            { label: "Google Ads Lead Form Extensions", key: "google-ads" },
            { label: "IndiaMART & JustDial Leads", key: "directory-inbound" },
            { label: "Custom Website Webhook (Zapier / Make)", key: "custom-api" },
          ].map((hook) => (
            <div
              key={hook.key}
              style={{
                padding: "0.6rem 0.85rem",
                borderRadius: "8px",
                background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.78rem", color: "var(--closer-ink, #0f172a)", display: "block" }}>{hook.label}</strong>
                <span style={{ fontSize: "0.72rem", color: "var(--closer-muted, #64748b)", fontFamily: "monospace" }}>/api/sales/webhooks/incoming/{hook.key}</span>
              </div>
              <button
                type="button"
                onClick={() => copyWebhookUrl(hook.key)}
                style={{
                  padding: "0.3rem 0.65rem",
                  borderRadius: "6px",
                  background: "var(--closer-surface, #ffffff)",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                  color: "var(--closer-ink, #0f172a)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                {copiedKey === hook.key ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copiedKey === hook.key ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* TeleCRM Item #4: Workspace REST API Keys & Scheduled Trigger Governance */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderRadius: "12px",
          background: "var(--closer-surface, #ffffff)",
          border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={16} color="var(--closer-orange, #ff6b2f)" />
            <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
              Workspace REST API Keys & Developer Tokens ({apiKeys.length})
            </h4>
          </div>
          <button
            type="button"
            onClick={handleGenerateApiKey}
            style={{
              padding: "0.38rem 0.8rem",
              borderRadius: "6px",
              background: "rgba(255, 107, 47, 0.12)",
              border: "1px solid rgba(255, 107, 47, 0.35)",
              color: "#ff6b2f",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Generate New API Key
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0.6rem" }}>
          {apiKeys.map((item) => (
            <div
              key={item.id}
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: "8px",
                background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.78rem", color: "var(--closer-ink, #0f172a)", display: "block" }}>{item.name}</strong>
                <code style={{ fontSize: "0.72rem", color: "var(--closer-orange, #ff6b2f)" }}>{item.token}</code>
                <span style={{ display: "block", fontSize: "0.68rem", color: "var(--closer-muted, #64748b)" }}>
                  Scopes: {item.scope} • {item.created}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button
                  type="button"
                  onClick={() => copyRawToken(item.id, item.token)}
                  style={{
                    padding: "0.3rem 0.55rem",
                    borderRadius: "6px",
                    background: "var(--closer-surface, #ffffff)",
                    border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                    color: "var(--closer-ink, #0f172a)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {copiedKey === item.id ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevokeApiKey(item.id)}
                  style={{
                    padding: "0.3rem 0.5rem",
                    borderRadius: "6px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "#ef4444",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                  }}
                  title="Revoke API key"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rules List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {rules.map((rule) => (
          <div
            key={rule.id}
            style={{
              padding: "1.25rem",
              borderRadius: "12px",
              background: "var(--closer-surface, #ffffff)",
              border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", maxWidth: "650px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: rule.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                  color: rule.isActive ? "#10b981" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Zap size={18} />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
                    {rule.name}
                  </h4>
                  <span
                    style={{
                      padding: "0.15rem 0.5rem",
                      borderRadius: "4px",
                      background: "rgba(255, 107, 47, 0.15)",
                      color: "#ff6b2f",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                    }}
                  >
                    Trigger: {rule.trigger.type}
                  </span>
                </div>

                <p style={{ margin: "0.25rem 0", fontSize: "0.8rem", color: "var(--closer-muted, #64748b)" }}>
                  {rule.description}
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.74rem", color: "var(--closer-muted, #64748b)", flexWrap: "wrap" }}>
                  <span>Executions: <strong>{rule.executionCount}</strong></span>
                  {rule.lastRunAt && <span>Last Run: {new Date(rule.lastRunAt).toLocaleTimeString()}</span>}
                  <span>Actions: {rule.actions.map((a) => a.type).join(", ")}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => handleToggleRule(rule)}
                style={{
                  padding: "0.35rem 0.8rem",
                  borderRadius: "20px",
                  background: rule.isActive ? "rgba(16, 185, 129, 0.16)" : "rgba(148, 163, 184, 0.16)",
                  color: rule.isActive ? "#059669" : "#64748b",
                  border: "none",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {rule.isActive ? "ACTIVE" : "PAUSED"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingRule(rule);
                  setModalOpen(true);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--closer-muted, #64748b)",
                  cursor: "pointer",
                }}
              >
                <Edit2 size={15} />
              </button>

              <button
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Execution Audit Logs */}
      {logs.length > 0 && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "1.25rem",
            borderRadius: "12px",
            background: "var(--closer-surface, #ffffff)",
            border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
          }}
        >
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)", display: "flex", alignItems: "center" }}>
            <ClipboardList size={16} color="var(--closer-orange, #ff6b2f)" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} />
            Real-Time Execution Audit Trail
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "200px", overflowY: "auto" }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.16))",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.76rem",
                }}
              >
                <div>
                  <strong style={{ color: "var(--closer-ink, #0f172a)" }}>{log.workflowName}</strong>
                  <span style={{ color: "var(--closer-muted, #64748b)", marginLeft: "0.5rem" }}>{log.details}</span>
                </div>
                <span style={{ color: "var(--closer-muted, #64748b)" }}>{new Date(log.executedAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {modalOpen && editingRule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
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
              maxWidth: "540px",
              background: "var(--closer-surface, #ffffff)",
              border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
              borderRadius: "12px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
              color: "var(--closer-ink, #0f172a)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
              {editingRule.id ? "Edit Automation Rule" : "Create Automation Rule"}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Instant WhatsApp Brochure on Lead Capture"
                value={editingRule.name || ""}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                style={{
                  padding: "0.5rem 0.65rem",
                  borderRadius: "6px",
                  background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                  color: "var(--closer-ink, #0f172a)",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>Trigger Event or Schedule</label>
              <select
                value={editingRule.trigger?.type || "LEAD_CREATED"}
                onChange={(e) =>
                  setEditingRule({
                    ...editingRule,
                    trigger: { ...editingRule.trigger, type: e.target.value as TriggerType },
                  })
                }
                style={{
                  padding: "0.5rem 0.65rem",
                  borderRadius: "6px",
                  background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                  color: "var(--closer-ink, #0f172a)",
                  fontSize: "0.85rem",
                }}
              >
                <option value="LEAD_CREATED">When a New Lead is Created</option>
                <option value="STAGE_CHANGED">When Lead Stage Changes</option>
                <option value="CALL_MISSED">When Inbound SIM / IVR Call is Missed</option>
                <option value="CALL_ENDED">When Call Ends with Disposition</option>
                <option value="FORM_SUBMITTED">When Public Sales Form is Submitted</option>
                <option value="SCHEDULED_CRON">Recurring Schedule (Hourly / Daily SLA Sweep)</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>Condition Filter (Optional)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                <input
                  type="text"
                  placeholder="Field (e.g. priority)"
                  value={editingRule.conditions?.[0]?.field || "priority"}
                  onChange={(e) =>
                    setEditingRule({
                      ...editingRule,
                      conditions: [{ field: e.target.value, operator: editingRule.conditions?.[0]?.operator || "EQUALS", value: editingRule.conditions?.[0]?.value || "hot" }],
                    })
                  }
                  style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))", fontSize: "0.8rem" }}
                />
                <select
                  value={editingRule.conditions?.[0]?.operator || "EQUALS"}
                  onChange={(e) =>
                    setEditingRule({
                      ...editingRule,
                      conditions: [{ field: editingRule.conditions?.[0]?.field || "priority", operator: e.target.value as any, value: editingRule.conditions?.[0]?.value || "hot" }],
                    })
                  }
                  style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))", fontSize: "0.8rem" }}
                >
                  <option value="EQUALS">Equals</option>
                  <option value="CONTAINS">Contains</option>
                  <option value="GREATER_THAN">Greater Than</option>
                </select>
                <input
                  type="text"
                  placeholder="Value (e.g. hot)"
                  value={editingRule.conditions?.[0]?.value || "hot"}
                  onChange={(e) =>
                    setEditingRule({
                      ...editingRule,
                      conditions: [{ field: editingRule.conditions?.[0]?.field || "priority", operator: editingRule.conditions?.[0]?.operator || "EQUALS", value: e.target.value }],
                    })
                  }
                  style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))", fontSize: "0.8rem" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>Action to Execute</label>
              <select
                value={editingRule.actions?.[0]?.type || "SEND_WHATSAPP"}
                onChange={(e) =>
                  setEditingRule({
                    ...editingRule,
                    actions: [{ type: e.target.value as ActionType, delayMinutes: 1, messageText: "Hi {{name}}!" }],
                  })
                }
                style={{
                  padding: "0.5rem 0.65rem",
                  borderRadius: "6px",
                  background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                  color: "var(--closer-ink, #0f172a)",
                  fontSize: "0.85rem",
                }}
              >
                <option value="SEND_WHATSAPP">Send Automated WhatsApp Message</option>
                <option value="UPDATE_STAGE">Advance Lead Pipeline Stage</option>
                <option value="CREATE_TASK">Schedule Follow-Up Task for Agent</option>
                <option value="CALL_WEBHOOK">Post Payload to External Webhook</option>
              </select>
            </div>

            {editingRule.actions?.[0]?.type === "SEND_WHATSAPP" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>WhatsApp Message Template</label>
                <textarea
                  rows={3}
                  placeholder="Hi {{name}}, thanks for contacting us!..."
                  value={editingRule.actions[0]?.messageText || ""}
                  onChange={(e) => {
                    const actions = [...(editingRule.actions || [])];
                    if (actions[0]) actions[0].messageText = e.target.value;
                    setEditingRule({ ...editingRule, actions });
                  }}
                  style={{
                    padding: "0.5rem 0.65rem",
                    borderRadius: "6px",
                    background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                    border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
                    color: "var(--closer-ink, #0f172a)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.35))",
                  color: "var(--closer-muted, #64748b)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveRule}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
