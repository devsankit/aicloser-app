"use client";

import { useEffect, useState } from "react";
import { Zap, Plus, Trash2, Edit2, Copy, Check, ArrowRight, Shield, Globe, ClipboardList, Activity, Clock3, Database, MoreHorizontal, Workflow } from "lucide-react";
import type { WorkflowRule, WorkflowExecutionLog, TriggerType, ActionType } from "@/lib/gigxomi/automation-engine-store";
import { aicloserApi } from "@/lib/api-client";

export type AutomationWorkflowsPanelMode = "workflows" | "developer";

function normalizeAutomationRule(raw: any): WorkflowRule {
  const rawCondition = raw?.condition ?? raw?.conditions?.[0] ?? null;
  const rawAction = raw?.action ?? raw?.actions?.[0] ?? null;
  const actionConfig = rawAction?.config && typeof rawAction.config === "object" ? rawAction.config : {};
  const action = rawAction
    ? { ...actionConfig, ...rawAction, ...actionConfig, type: rawAction.type }
    : { type: "ASSIGN_AGENT" as ActionType };

  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? "Untitled automation"),
    description: String(raw?.description ?? ""),
    isActive: raw?.isActive !== false,
    trigger: {
      type: (raw?.trigger?.type ?? "LEAD_CREATED") as TriggerType,
      stageFilter: raw?.trigger?.stageFilter,
      sourceFilter: raw?.trigger?.sourceFilter,
    },
    conditions: rawCondition ? [rawCondition] : [],
    actions: [action],
    executionCount: Number(raw?.executionCount ?? 0),
    lastRunAt: raw?.lastRunAt ?? null,
    createdAt: String(raw?.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw?.updatedAt ?? new Date().toISOString()),
  };
}

function normalizeAutomationLog(raw: any): WorkflowExecutionLog {
  return {
    id: String(raw?.id ?? `log-${Date.now()}`),
    workflowId: String(raw?.workflowId ?? raw?.ruleId ?? ""),
    workflowName: String(raw?.workflowName ?? raw?.ruleName ?? "Automation"),
    leadId: raw?.leadId,
    leadName: raw?.leadName,
    triggerEvent: String(raw?.triggerEvent ?? raw?.triggerType ?? "EVENT"),
    status: raw?.status === "FAILED" ? "FAILED" : "SUCCESS",
    details: String(raw?.details ?? ""),
    executedAt: String(raw?.executedAt ?? new Date().toISOString()),
  };
}

function automationFingerprint(rule: WorkflowRule) {
  return JSON.stringify({
    name: rule.name.trim().toLowerCase(),
    description: rule.description.trim().toLowerCase(),
    isActive: rule.isActive,
    trigger: rule.trigger,
    conditions: rule.conditions,
    actions: rule.actions,
  });
}

function formatRunTime(value?: string | null) {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not run yet";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function humanizeToken(value?: string | null) {
  return String(value || "—")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toCentralAutomationPayload(rule: Partial<WorkflowRule>) {
  const action = rule.actions?.[0];
  const condition = rule.conditions?.[0] ?? null;
  if (!action) {
    return { ...rule, condition, action: { type: "ASSIGN_AGENT", config: {} }, conditions: undefined, actions: undefined };
  }
  const { type, delayMinutes, templateName, messageText, targetStage, agentId, taskTitle, webhookUrl } = action;
  return {
    name: rule.name,
    description: rule.description ?? "",
    isActive: rule.isActive !== false,
    trigger: rule.trigger,
    condition,
    action: {
      type,
      config: { delayMinutes, templateName, messageText, targetStage, agentId, taskTitle, webhookUrl },
    },
  };
}

export function AutomationWorkflowsPanel({ mode = "workflows" }: { mode?: AutomationWorkflowsPanelMode }) {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [logs, setLogs] = useState<WorkflowExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<WorkflowRule> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [rules, logs] = await Promise.all([
        aicloserApi.automations.list(),
        aicloserApi.automations.getLogs(),
      ]);
      const normalizedRules = (rules || []).map(normalizeAutomationRule);
      const normalizedLogs = (logs || []).map(normalizeAutomationLog);
      // Protect the UI from an API page repeating the same semantic rule.
      // Keep same-name rules when their trigger, conditions, actions, or status differ.
      setRules(Array.from(new Map(normalizedRules.map((rule) => [automationFingerprint(rule), rule])).values()));
      setLogs(Array.from(new Map(normalizedLogs.map((log, index) => [log.id || `log-row-${index}`, log])).values()));
    } catch (err) {
      console.error("Failed to load automations", err);
      setLoadError(err instanceof Error ? err.message : "Unable to load automation data");
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
      await aicloserApi.automations.update(rule.id, toCentralAutomationPayload(updated));
      await loadData();
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
      const saved = editingRule.id
        ? await aicloserApi.automations.update(editingRule.id, toCentralAutomationPayload(editingRule))
        : await aicloserApi.automations.create(toCentralAutomationPayload(editingRule));
      if (saved) {
        setModalOpen(false);
        setEditingRule(null);
        await loadData();
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
      await aicloserApi.automations.remove(id);
      await loadData();
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

  const activeRules = rules.filter((rule) => rule.isActive).length;
  const totalExecutions = rules.reduce((total, rule) => total + rule.executionCount, 0);
  const successfulRuns = logs.filter((log) => log.status === "SUCCESS").length;
  const successRate = logs.length ? Math.round((successfulRuns / logs.length) * 100) : 0;
  const latestRun = logs[0]?.executedAt ?? rules.find((rule) => rule.lastRunAt)?.lastRunAt ?? null;

  return (
    <div className="automation-workspace">
      {/* Header */}
      <div className="automation-workspace-header">
        <div className="automation-workspace-heading">
          <span className="automation-eyebrow"><Zap size={13} /> {mode === "developer" ? "DEVELOPER WORKSPACE" : "AUTOMATION WORKSPACE"}</span>
          <h2>
            {mode === "developer" ? "Developer webhooks & API access" : "Workflow automation & schedules"}
          </h2>
          <p>
            {mode === "developer"
              ? "Inbound lead connectors, workspace API keys, and developer tokens for integrations."
              : "Build durable event → condition → action flows across leads, WhatsApp, calls, stages, and follow-ups."}
          </p>
        </div>

        {mode === "workflows" ? <button
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
          className="automation-primary-action"
        >
          <Plus size={16} /> Create Automation Rule
        </button> : null}
      </div>

      {mode === "workflows" ? <div className="automation-metric-grid" aria-label="Automation summary">
        <div className="automation-metric-card"><span className="automation-metric-icon orange"><Workflow size={16} /></span><span className="automation-metric-label">Total workflows</span><strong>{rules.length}</strong><small>{activeRules} active now</small></div>
        <div className="automation-metric-card"><span className="automation-metric-icon green"><Activity size={16} /></span><span className="automation-metric-label">Successful runs</span><strong>{successRate}%</strong><small>{successfulRuns} of {logs.length || 0} audit events</small></div>
        <div className="automation-metric-card"><span className="automation-metric-icon blue"><Database size={16} /></span><span className="automation-metric-label">Total executions</span><strong>{totalExecutions}</strong><small>Across all workflows</small></div>
        <div className="automation-metric-card"><span className="automation-metric-icon violet"><Clock3 size={16} /></span><span className="automation-metric-label">Last activity</span><strong>{latestRun ? formatRunTime(latestRun) : "—"}</strong><small>{latestRun ? "Central automation runtime" : "No execution yet"}</small></div>
      </div> : null}

      {loadError ? <div className="automation-error-state" role="alert"><div><strong>Automation data unavailable</strong><span>{loadError}</span></div><button type="button" className="automation-secondary-action" onClick={loadData}>Retry</button></div> : null}

      {mode === "developer" ? <>
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
      </> : null}

      {mode === "workflows" ? <>
      {/* Rules List */}
      {loading ? <div className="automation-rules-grid" aria-label="Loading automation workflows">
        {[1, 2, 3].map((item) => <div className="automation-skeleton-card" key={item}><span /><span /><span /><span /></div>)}
      </div> : rules.length === 0 ? <div className="automation-empty-state"><Workflow size={24} /><strong>No workflows yet</strong><span>Create your first event → condition → action automation to get started.</span><button type="button" className="automation-primary-action" onClick={() => setEditingRule({ name: "", description: "", isActive: true, trigger: { type: "LEAD_CREATED" }, conditions: [], actions: [{ type: "SEND_WHATSAPP", delayMinutes: 1, messageText: "Hi {{name}}, thanks for your inquiry!" }] })}>Create first workflow</button></div> : <div className="automation-rules-grid">
        {rules.map((rule) => {
          const condition = rule.conditions[0];
          const action = rule.actions[0];
          return <article className="automation-rule-card" key={rule.id}>
            <div className="automation-rule-card-header">
              <div className="automation-rule-title-wrap">
                <span className={`automation-rule-icon ${rule.isActive ? "is-active" : ""}`}><Zap size={17} /></span>
                <div><h3>{rule.name}</h3><p>{rule.description || "No description added"}</p></div>
              </div>
              <div className="automation-rule-actions">
                <button type="button" className={`automation-status-pill ${rule.isActive ? "is-active" : ""}`} onClick={() => handleToggleRule(rule)}>{rule.isActive ? "Active" : "Paused"}</button>
                <button type="button" className="automation-icon-button" aria-label={`More actions for ${rule.name}`} title="More actions"><MoreHorizontal size={17} /></button>
              </div>
            </div>
            <div className="automation-flow" aria-label="Automation flow">
              <div className="automation-flow-step"><span className="automation-flow-label">When</span><strong>{humanizeToken(rule.trigger.type)}</strong></div>
              <ArrowRight className="automation-flow-arrow" size={15} />
              <div className="automation-flow-step"><span className="automation-flow-label">If</span><strong>{condition ? `${humanizeToken(condition.field)} ${humanizeToken(condition.operator)} ${condition.value}` : "Every matching lead"}</strong></div>
              <ArrowRight className="automation-flow-arrow" size={15} />
              <div className="automation-flow-step"><span className="automation-flow-label">Then</span><strong>{humanizeToken(action?.type)}</strong></div>
            </div>
            <div className="automation-rule-footer">
              <div className="automation-rule-stats"><span><Activity size={13} /> {rule.executionCount} executions</span><span><Clock3 size={13} /> {formatRunTime(rule.lastRunAt)}</span></div>
              <div className="automation-rule-footer-actions"><button type="button" className="automation-text-button" onClick={() => { setEditingRule(rule); setModalOpen(true); }}><Edit2 size={13} /> Edit</button><button type="button" className="automation-danger-button" onClick={() => handleDeleteRule(rule.id)}><Trash2 size={13} /> Delete</button></div>
            </div>
          </article>;
        })}
      </div>}

      {/* Execution Audit Logs */}
      {logs.length > 0 && (
        <div className="automation-audit-card">
          <div className="automation-section-heading"><div><span className="automation-eyebrow"><ClipboardList size={13} /> EXECUTION MONITOR</span><h3>Recent automation activity</h3></div><span className="automation-live-dot">LIVE</span></div>
          <div className="automation-audit-list">
            {logs.map((log) => (
              <div className="automation-audit-row" key={log.id}>
                <span className={`automation-audit-status ${log.status === "SUCCESS" ? "is-success" : "is-failed"}`}>{log.status === "SUCCESS" ? <Check size={13} /> : "!"}</span>
                <div className="automation-audit-copy"><strong>{log.workflowName}</strong><span>{log.details || `${humanizeToken(log.triggerEvent)} completed`}</span></div>
                <time>{formatRunTime(log.executedAt)}</time>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {modalOpen && editingRule && (
        <div
          className="sales-modal-backdrop"
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
            className="sales-modal-card"
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
      </> : null}
    </div>
  );
}
