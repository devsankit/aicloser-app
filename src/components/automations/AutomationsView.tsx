"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerIcon: IconName;
  condition: string;
  action: string;
  actionIcon: IconName;
  status: "active" | "paused";
  runsCount: number;
  lastRun: string;
  successRate: string;
}

export interface ExecutionLog {
  id: string;
  ruleName: string;
  leadName: string;
  status: "success" | "running" | "warning";
  startedAt: string;
  durationMs: number;
  steps: {
    step: string;
    detail: string;
    status: "ok" | "skipped" | "failed";
  }[];
}

const DEFAULT_WORKFLOWS: WorkflowRule[] = [
  {
    id: "wf-01",
    name: "AI SIM Call Recording & Summary Ingestion",
    description: "When an inbound or outbound SIM call ends, automatically transcribe speech, score sentiment, and attach AI action items to lead record.",
    trigger: "Call Completed on SIM",
    triggerIcon: "phone",
    condition: "Duration > 30 seconds",
    action: "AI Audio Transcribe & Post Lead Note",
    actionIcon: "bot",
    status: "active",
    runsCount: 1240,
    lastRun: "2m ago",
    successRate: "99.9%",
  },
  {
    id: "wf-02",
    name: "Instant Round-Robin Owner Assignment",
    description: "Instantly distribute newly captured website or ad leads across available active closers in round-robin order.",
    trigger: "New Lead Created",
    triggerIcon: "plus",
    condition: "Owner is Unassigned",
    action: "Round-Robin Assign Closer & Send Notification",
    actionIcon: "team",
    status: "active",
    runsCount: 980,
    lastRun: "18m ago",
    successRate: "100%",
  },
  {
    id: "wf-03",
    name: "Razorpay Payment Settle to Close-Won",
    description: "When an advance or full payment is captured on UPI/Razorpay, automatically move lead to Closed-Won and dispatch WhatsApp confirmation.",
    trigger: "Payment Captured",
    triggerIcon: "card",
    condition: "Status is CAPTURED",
    action: "Advance Stage to Closed-Won",
    actionIcon: "check",
    status: "active",
    runsCount: 184,
    lastRun: "14m ago",
    successRate: "100%",
  },
  {
    id: "wf-04",
    name: "Missed Call SLA Alert & Instant Apology",
    description: "When a customer calls and no agent answers, alert the on-duty team and trigger an immediate WhatsApp apology message.",
    trigger: "Inbound Call Missed",
    triggerIcon: "phone",
    condition: "Duration == 0s (Missed)",
    action: "Trigger Closer Callback Alert & WhatsApp Apology",
    actionIcon: "whatsapp",
    status: "active",
    runsCount: 76,
    lastRun: "1h ago",
    successRate: "98.7%",
  },
  {
    id: "wf-05",
    name: "Stalled Negotiation Auto-Nudge",
    description: "If a lead remains in 'Negotiation' stage for more than 48 hours without contact, send a personalized pricing discount reminder.",
    trigger: "Stage Inactivity Timeout",
    triggerIcon: "clock",
    condition: "Inactive in Negotiation > 48h",
    action: "Dispatch WhatsApp Retargeting Offer",
    actionIcon: "message",
    status: "active",
    runsCount: 412,
    lastRun: "3h ago",
    successRate: "99.4%",
  },
  {
    id: "wf-06",
    name: "VIP High-Ticket Deal Escalation",
    description: "When an inquiry comes in with estimated deal value > ₹1,00,000, immediately notify the Sales Director and tag as Urgent.",
    trigger: "Lead Value Exceeds Threshold",
    triggerIcon: "target",
    condition: "Estimated Deal Value >= ₹1,00,000",
    action: "Tag Urgent & Notify Leadership",
    actionIcon: "shield",
    status: "active",
    runsCount: 52,
    lastRun: "Yesterday",
    successRate: "100%",
  },
  {
    id: "wf-07",
    name: "Google Calendar Demo Auto-Sync",
    description: "When a qualified meeting is scheduled, create a Google Meet link and invite both the customer and assigned closer.",
    trigger: "Meeting Scheduled",
    triggerIcon: "calendar",
    condition: "Stage moved to Qualified",
    action: "Generate Google Meet & Send Invites",
    actionIcon: "external",
    status: "active",
    runsCount: 310,
    lastRun: "Yesterday",
    successRate: "99.1%",
  },
];

const DEFAULT_LOGS: ExecutionLog[] = [
  {
    id: "run-4091",
    ruleName: "AI SIM Call Recording & Summary Ingestion",
    leadName: "Vikram Malhotra",
    status: "success",
    startedAt: "2m ago",
    durationMs: 840,
    steps: [
      { step: "Verify Inbound SIM Webhook", detail: "SIM #1 (POCO X6 Pro) call audio received (245s MP3)", status: "ok" },
      { step: "DeepSeek / Whisper Speech-to-Text", detail: "Audio transcribed with 98.4% confidence score", status: "ok" },
      { step: "AI Lead Summary & Action Extraction", detail: "Detected intent: 'Wants Enterprise Plan with 5 Closers'", status: "ok" },
      { step: "Update CRM Lead Record", detail: "Attached transcript to lead Vikram Malhotra timeline", status: "ok" },
    ],
  },
  {
    id: "run-4090",
    ruleName: "Razorpay Payment Settle to Close-Won",
    leadName: "Rohit Verma",
    status: "success",
    startedAt: "14m ago",
    durationMs: 310,
    steps: [
      { step: "Webhook HMAC Signature", detail: "Razorpay signature verified via SHA256", status: "ok" },
      { step: "Evaluate Capture Status", detail: "Payment pay_Pk88291024 ₹50,000 captured via UPI", status: "ok" },
      { step: "Pipeline Transition", detail: "Moved Rohit Verma from 'Negotiation' to 'Closed-Won'", status: "ok" },
      { step: "WhatsApp Receipt Dispatch", detail: "Official GST tax receipt PDF sent to +91 98100 12345", status: "ok" },
    ],
  },
  {
    id: "run-4089",
    ruleName: "Instant Round-Robin Owner Assignment",
    leadName: "Ananya Saxena",
    status: "success",
    startedAt: "18m ago",
    durationMs: 142,
    steps: [
      { step: "Inbound Capture Event", detail: "High-ticket form submission received from /f/demo-request", status: "ok" },
      { step: "Closer Capacity Check", detail: "Evaluated 5 active closers; Rohan Mehta (1 lead below quota)", status: "ok" },
      { step: "Assign Lead Owner", detail: "Lead assigned to Rohan Mehta", status: "ok" },
      { step: "Notify Mobile Agent", detail: "Push notification dispatched to Closer Android App", status: "ok" },
    ],
  },
  {
    id: "run-4088",
    ruleName: "Missed Call SLA Alert & Instant Apology",
    leadName: "Pooja Reddy",
    status: "success",
    startedAt: "1h ago",
    durationMs: 290,
    steps: [
      { step: "SIM Missed Call Detection", detail: "Inbound call rang 28s without pickup", status: "ok" },
      { step: "SLA Queue Enqueue", detail: "Added Pooja Reddy to High-Priority Callback Queue", status: "ok" },
      { step: "WhatsApp Apology Automation", detail: "Dispatched automated WhatsApp: 'Sorry we missed you...'", status: "ok" },
    ],
  },
];

export function AutomationsView() {
  const { state } = useApp();
  const [workflows, setWorkflows] = useState<WorkflowRule[]>(DEFAULT_WORKFLOWS);
  const [logs, setLogs] = useState<ExecutionLog[]>(DEFAULT_LOGS);
  const [activeTab, setActiveTab] = useState<"workflows" | "history" | "bot_config" | "guardrails">("workflows");
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Modals & inspect
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);

  // Bot Prompt settings state
  const [aiModel, setAiModel] = useState("gpt-4o-closer-v2");
  const [temperature, setTemperature] = useState(0.3);
  const [systemPrompt, setSystemPrompt] = useState(
    `You are Closer AI, an elite B2B sales development representative for high-ticket Indian businesses.
Your objective:
1. Instantly qualify inbound leads asking about CRM, calling solutions, or pricing.
2. Maintain a professional, consultative, and concise tone (under 3 sentences per WhatsApp message).
3. If the prospect asks for custom pricing or asks to speak with a human, book a 15-minute demo or transfer immediately to an on-duty closer.`
  );
  const [savedPromptNotice, setSavedPromptNotice] = useState(false);

  function handleToggleWorkflow(id: string) {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: w.status === "active" ? "paused" : "active" } : w))
    );
  }

  function handleTestWorkflow(rule: WorkflowRule) {
    const newLog: ExecutionLog = {
      id: `run-${Math.floor(1000 + Math.random() * 9000)}`,
      ruleName: rule.name,
      leadName: state.leads[0]?.name || "Test Lead",
      status: "success",
      startedAt: "Just now",
      durationMs: 220,
      steps: [
        { step: "Trigger Handshake", detail: `Triggered '${rule.trigger}' successfully`, status: "ok" },
        { step: "Condition Evaluation", detail: `Evaluated rule criteria '${rule.condition}' -> TRUE`, status: "ok" },
        { step: "Action Execution", detail: `Executed '${rule.action}' with 0 errors`, status: "ok" },
      ],
    };

    setLogs((prev) => [newLog, ...prev]);
    setBannerNotice(`⚡ Test executed for "${rule.name}" on lead ${newLog.leadName}. Execution took 220ms (HTTP 200 OK).`);
    setTimeout(() => setBannerNotice(null), 5000);
  }

  function handleSavePrompt() {
    setSavedPromptNotice(true);
    setBannerNotice("✓ Closer AI Persona and system instructions updated across all conversational channels.");
    setTimeout(() => {
      setSavedPromptNotice(false);
      setBannerNotice(null);
    }, 4000);
  }

  const activeWorkflowsCount = workflows.filter((w) => w.status === "active").length;
  const totalRuns = workflows.reduce((acc, w) => acc + w.runsCount, 0);

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Top Header */}
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
            AI Bot & Automations
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Autonomous trigger-action rules, call summarization, round-robin lead distribution, and closer assistance.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            className="btn"
            data-size="sm"
            onClick={() => {
              setBannerNotice("⚡ Testing all 7 active automation rules... 7/7 rules responded in 184ms avg.");
              setTimeout(() => setBannerNotice(null), 4500);
            }}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <Icon name="sparkle" size={13} />
            <span>Test All Rules</span>
          </button>
          <button
            className="btn"
            data-size="sm"
            data-variant="primary"
            onClick={() => setIsNewRuleModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <Icon name="plus" size={13} />
            <span>Create Automation Rule</span>
          </button>
        </div>
      </header>

      {/* Notice Banner */}
      {bannerNotice && (
        <div
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
            color: "var(--text)",
            padding: "10px 14px",
            borderRadius: "var(--r-sm)",
            fontSize: "var(--fs-meta)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "18px",
          }}
        >
          <span>{bannerNotice}</span>
          <button
            onClick={() => setBannerNotice(null)}
            style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Top 4 Metrics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            Active Workflows
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>{activeWorkflowsCount}</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>of {workflows.length} rules live</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "4px", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
            <span>Real-time Ingestion Healthy</span>
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            Monthly AI Token Budget
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>342.2K</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>/ 1.0M tokens</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            34.2% used (657.8K remaining)
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            Total Triggers Executed
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>{totalRuns.toLocaleString()}</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>triggers</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "4px" }}>
            99.9% overall success rate
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            Closer Time Saved / Lead
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>~14.5m</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>per lead</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--accent)", marginTop: "4px" }}>
            Instant AI transcripts & auto-nudges
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="seg" style={{ marginBottom: 18, display: "inline-flex" }}>
        <button
          data-on={activeTab === "workflows"}
          onClick={() => setActiveTab("workflows")}
        >
          <Icon name="roadmap" size={13} />
          <span>Workflows & Rules ({workflows.length})</span>
        </button>

        <button
          data-on={activeTab === "history"}
          onClick={() => setActiveTab("history")}
        >
          <Icon name="clock" size={13} />
          <span>Execution Run History ({logs.length})</span>
        </button>

        <button
          data-on={activeTab === "bot_config"}
          onClick={() => setActiveTab("bot_config")}
        >
          <Icon name="bot" size={13} />
          <span>AI Sales Agent & Prompts</span>
        </button>

        <button
          data-on={activeTab === "guardrails"}
          onClick={() => setActiveTab("guardrails")}
        >
          <Icon name="shield" size={13} />
          <span>Safety Guardrails & Velocity</span>
        </button>
      </div>

      {/* TAB 1: WORKFLOWS & RULES */}
      {activeTab === "workflows" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {workflows.map((rule) => {
            const isActive = rule.status === "active";
            return (
              <div
                key={rule.id}
                className="card"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  borderRadius: 8,
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Top Info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ maxWidth: 800 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: "var(--fg)" }}>{rule.name}</span>
                      <span
                        className="chip"
                        style={{
                          fontSize: 10,
                          background: isActive ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                          color: isActive ? "var(--success)" : "var(--fg-muted)",
                          borderColor: isActive ? "rgba(16,185,129,0.3)" : "var(--border)",
                        }}
                      >
                        {isActive ? "Active Rule" : "Paused"}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4, lineHeight: 1.5 }}>
                      {rule.description}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleTestWorkflow(rule)}
                      style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                    >
                      <Icon name="sparkle" size={12} />
                      <span>Test Trigger</span>
                    </button>

                    <button
                      className="btn btn-sm"
                      onClick={() => handleToggleWorkflow(rule.id)}
                      style={{
                        fontSize: 11,
                        cursor: "pointer",
                        background: isActive ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                        color: isActive ? "var(--danger)" : "var(--success)",
                        borderColor: isActive ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      {isActive ? "Pause" : "Activate"}
                    </button>
                  </div>
                </div>

                {/* Visual Trigger -> Condition -> Action Chain */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "var(--bg-elevated)",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Trigger Pill */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--fg-muted)", fontSize: 10, textTransform: "uppercase", fontWeight: 600 }}>
                      WHEN:
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 8px",
                        background: "rgba(94, 106, 210, 0.12)",
                        border: "1px solid var(--accent)",
                        borderRadius: 4,
                        color: "var(--fg)",
                        fontWeight: 500,
                      }}
                    >
                      <Icon name={rule.triggerIcon} size={12} />
                      <span>{rule.trigger}</span>
                    </span>
                  </div>

                  <span style={{ color: "var(--fg-muted)" }}>→</span>

                  {/* Condition Pill */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--fg-muted)", fontSize: 10, textTransform: "uppercase", fontWeight: 600 }}>
                      IF:
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 8px",
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        borderRadius: 4,
                        color: "var(--warning)",
                        fontWeight: 500,
                      }}
                    >
                      <span>{rule.condition}</span>
                    </span>
                  </div>

                  <span style={{ color: "var(--fg-muted)" }}>→</span>

                  {/* Action Pill */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--fg-muted)", fontSize: 10, textTransform: "uppercase", fontWeight: 600 }}>
                      THEN:
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 8px",
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        borderRadius: 4,
                        color: "var(--success)",
                        fontWeight: 500,
                      }}
                    >
                      <Icon name={rule.actionIcon} size={12} />
                      <span>{rule.action}</span>
                    </span>
                  </div>
                </div>

                {/* Footer Stats */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--fg-muted)", paddingTop: 4 }}>
                  <span>{rule.runsCount} executions total · Last triggered {rule.lastRun}</span>
                  <span>Reliability: <strong style={{ color: "var(--success)" }}>{rule.successRate}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: EXECUTION RUN HISTORY */}
      {activeTab === "history" && (
        <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, overflow: "hidden" }}>
          <div className="card-head" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className="card-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                Step-by-Step Automation Execution Log
              </span>
              <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                Audit every trigger invocation, evaluate conditions, and inspect dispatched external actions.
              </p>
            </div>
            <span className="chip" style={{ background: "rgba(16,185,129,0.1)", color: "var(--success)", borderColor: "rgba(16,185,129,0.3)" }}>
              All Systems Operational
            </span>
          </div>

          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--fg-muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 16px" }}>Run ID</th>
                  <th style={{ padding: "10px 16px" }}>Rule Triggered</th>
                  <th style={{ padding: "10px 16px" }}>Target Lead</th>
                  <th style={{ padding: "10px 16px" }}>Outcome</th>
                  <th style={{ padding: "10px 16px" }}>Latency</th>
                  <th style={{ padding: "10px 16px" }}>Triggered</th>
                  <th style={{ padding: "10px 16px", textAlign: "right" }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono, monospace)", color: "var(--fg-muted)", fontSize: 12 }}>
                      {log.id}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--fg)" }}>
                      {log.ruleName}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg)" }}>
                      {log.leadName}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className="chip"
                        style={{
                          fontSize: 11,
                          background: log.status === "success" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                          color: log.status === "success" ? "var(--success)" : "var(--warning)",
                          borderColor: log.status === "success" ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                        }}
                      >
                        {log.status === "success" ? "Completed (4/4)" : "Processing"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", fontSize: 12 }}>
                      {log.durationMs}ms
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", fontSize: 12 }}>
                      {log.startedAt}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => setSelectedLog(log)}
                        style={{ fontSize: 11, padding: "4px 8px", cursor: "pointer" }}
                      >
                        View Steps ({log.steps.length})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AI BOT CONFIGURATION & PROMPT PLAYGROUND */}
      {activeTab === "bot_config" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
          {/* Left: System Prompt Editor */}
          <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
              Closer AI Autonomous SDR Persona
            </h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 16 }}>
              Defines how the conversational AI bot engages prospects on WhatsApp, Instagram DMs, and website chat.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                    Underlying LLM Engine
                  </label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: 13,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--fg)",
                    }}
                  >
                    <option value="gpt-4o-closer-v2">Closer Fine-Tuned GPT-4o (Recommended)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Best Reasoning)</option>
                    <option value="deepseek-r1-distill">DeepSeek R1 Speed Engine (Lowest Latency)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                    Sampling Temperature ({temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    style={{ width: "100%", marginTop: 8 }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>
                    System Instructions & Objection Handling Framework
                  </label>
                  <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{systemPrompt.length} characters</span>
                </div>
                <textarea
                  rows={9}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 12,
                    fontSize: 13,
                    lineHeight: 1.6,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                    fontFamily: "var(--font-mono, monospace)",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: savedPromptNotice ? "var(--success)" : "var(--fg-muted)" }}>
                  {savedPromptNotice ? "✓ Prompt changes deployed live to runtime" : "Changes take effect on next inbound conversation"}
                </span>
                <button className="btn btn-sm btn-primary" onClick={handleSavePrompt} style={{ cursor: "pointer" }}>
                  Save & Deploy Persona
                </button>
              </div>
            </div>
          </div>

          {/* Right: Knowledge Base & Handover triggers */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
                Active Vector Knowledge Sources
              </h3>
              <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 12 }}>
                Documents referenced by the AI to answer pricing, packages, and technical queries.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { name: "2026_Closer_Pricing_Matrix.pdf", size: "240 KB", chunks: 18 },
                  { name: "SIM_Telephony_Android_Setup_FAQ.md", size: "84 KB", chunks: 9 },
                  { name: "High_Ticket_Objection_Handling_Scripts.txt", size: "115 KB", chunks: 22 },
                ].map((doc) => (
                  <div
                    key={doc.name}
                    style={{
                      padding: "8px 10px",
                      background: "var(--bg-elevated)",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="tag" size={13} />
                      <span style={{ color: "var(--fg)", fontWeight: 500 }}>{doc.name}</span>
                    </div>
                    <span style={{ color: "var(--fg-muted)", fontSize: 11 }}>{doc.chunks} vectors</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
                Human Closer Handover Triggers
              </h3>
              <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 12 }}>
                Keywords that instantly pause the AI bot and ring the designated sales agent.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["speak to human", "talk to founder", "call me now", "bank transfer details", "urgent complaint", "discount coupon"].map(
                  (trigger) => (
                    <span
                      key={trigger}
                      style={{
                        fontSize: 11,
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "var(--danger)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        padding: "3px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {trigger}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SAFETY GUARDRAILS & VELOCITY */}
      {activeTab === "guardrails" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
              Message Velocity & Anti-Spam Throttling
            </h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 16 }}>
              Protects official WhatsApp Business Tier 2 quality rating and prevents customer inbox spam.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>Max Auto-Replies per Conversation</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Stops AI after continuous unreplied messages</div>
                </div>
                <strong style={{ color: "var(--fg)", fontSize: 14 }}>3 messages</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>Night Quiet Hours Restriction</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Queues messages till morning 08:00 AM IST</div>
                </div>
                <strong style={{ color: "var(--success)", fontSize: 13 }}>10:00 PM – 08:00 AM (Active)</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>Meta Quality Rating Guardrail</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Auto-pauses marketing broadcast if quality turns RED</div>
                </div>
                <strong style={{ color: "var(--success)", fontSize: 13 }}>Tier 2 Healthy</strong>
              </div>
            </div>
          </div>

          <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
              Spend Limits & Budget Alerts
            </h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 16 }}>
              Hard caps on LLM inference and Meta Cloud messaging charges.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>Daily AI Spend Cap</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Current burn: ₹142 today</div>
                </div>
                <strong style={{ color: "var(--fg)", fontSize: 14 }}>₹1,500 / day</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>Slack / Email Budget Alerts</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Sends alert at 80% quota utilization</div>
                </div>
                <strong style={{ color: "var(--success)", fontSize: 13 }}>Enabled</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>Hallucination Confidence Threshold</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Requires 85%+ semantic match against knowledge docs</div>
                </div>
                <strong style={{ color: "var(--fg)", fontSize: 14 }}>0.85 Minimum</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT EXECUTION STEPS */}
      {selectedLog && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="execution-dialog-title"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              maxWidth: 580,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h2 id="execution-dialog-title" style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>
                  Execution Details: #{selectedLog.id}
                </h2>
                <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                  {selectedLog.ruleName} · {selectedLog.leadName} · {selectedLog.durationMs}ms
                </span>
              </div>
              <button
                aria-label="Close dialog"
                onClick={() => setSelectedLog(null)}
                style={{ background: "transparent", border: "none", color: "var(--fg-muted)", cursor: "pointer" }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
              {selectedLog.steps.map((st, i) => (
                <div
                  key={st.step}
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "rgba(16,185,129,0.15)",
                      color: "var(--success)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{st.step}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>{st.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-sm" onClick={() => setSelectedLog(null)} style={{ cursor: "pointer" }}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE AUTOMATION RULE */}
      {isNewRuleModalOpen && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setIsNewRuleModalOpen(false)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-rule-dialog-title"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              maxWidth: 520,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 id="new-rule-dialog-title" style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
                Create New Automation Rule
              </h2>
              <button
                aria-label="Close dialog"
                onClick={() => setIsNewRuleModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--fg-muted)", cursor: "pointer" }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="new-rule-name" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Workflow Name
                </label>
                <input
                  id="new-rule-name"
                  type="text"
                  placeholder="e.g. Inbound Demo Request to Closer Alert"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="new-rule-trigger" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Trigger Event (WHEN)
                </label>
                <select
                  id="new-rule-trigger"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                  }}
                >
                  <option>New Inbound Lead Created</option>
                  <option>Call Ended on Android SIM</option>
                  <option>Payment Captured on Razorpay</option>
                  <option>Stage Inactive for 48 Hours</option>
                  <option>Missed Call Detected</option>
                </select>
              </div>

              <div>
                <label htmlFor="new-rule-condition" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Rule Condition (IF)
                </label>
                <input
                  id="new-rule-condition"
                  type="text"
                  defaultValue="Stage is New AND Owner is Unassigned"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="new-rule-action" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Automated Action (THEN)
                </label>
                <select
                  id="new-rule-action"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                  }}
                >
                  <option>Assign Round-Robin Closer & Send Push Notification</option>
                  <option>Generate AI Speech-to-Text & Lead Summary</option>
                  <option>Advance Deal Stage to Closed-Won</option>
                  <option>Dispatch WhatsApp Re-engagement Template</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setIsNewRuleModalOpen(false)}
                  style={{ cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setBannerNotice("✓ Automation rule created and compiled into Closer real-time event runner.");
                    setIsNewRuleModalOpen(false);
                    setTimeout(() => setBannerNotice(null), 4000);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  Save & Activate Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
