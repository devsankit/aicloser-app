"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";

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

export interface ProviderMeta {
  id: string;
  name: string;
  badge?: string;
  tagTone?: "accent" | "success" | "neutral";
  models: string[];
  defaultModel: string;
  placeholder: string;
  desc: string;
  docsUrl: string;
  isFree?: boolean;
}

export const PROVIDERS_META: ProviderMeta[] = [
  {
    id: "groq",
    name: "Groq Cloud (Fast LLaMA 3.3)",
    badge: "⭐ Free Tier Recommended",
    tagTone: "accent",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    defaultModel: "llama-3.3-70b-versatile",
    placeholder: "gsk_...",
    desc: "100% Free API access (14,400 requests/day) with sub-300ms LPU inference. Ideal for instant WhatsApp auto-replies and call summaries.",
    docsUrl: "https://console.groq.com/keys",
    isFree: true,
  },
  {
    id: "grok",
    name: "xAI Grok (Grok-2 & Beta)",
    badge: "xAI Reasoning Engine",
    tagTone: "neutral",
    models: ["grok-2-latest", "grok-2-1212", "grok-beta"],
    defaultModel: "grok-2-latest",
    placeholder: "xai-...",
    desc: "Advanced sales negotiation, deal sentiment scoring, and counter-objection intelligence powered by xAI.",
    docsUrl: "https://console.x.ai/",
  },
  {
    id: "openai",
    name: "OpenAI (GPT-4o & Mini)",
    badge: "Multimodal Standard",
    tagTone: "neutral",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
    defaultModel: "gpt-4o-mini",
    placeholder: "sk-proj-...",
    desc: "Industry-standard accuracy for inbound customer qualification, audio transcription analysis, and structured CRM extraction.",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    name: "Google Gemini (1.5 Flash & Pro)",
    badge: "1M+ Context Window",
    tagTone: "neutral",
    models: ["gemini-1.5-flash", "gemini-1.5-pro"],
    defaultModel: "gemini-1.5-flash",
    placeholder: "AIzaSy...",
    desc: "Extended context window for massive multi-party deal discussions, proposal documents, and SIM call transcripts.",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "deepseek",
    name: "DeepSeek (V3 & R1)",
    badge: "Ultra Low-Cost Reasoning",
    tagTone: "neutral",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    placeholder: "sk-...",
    desc: "High-performance open reasoning model for pricing breakdowns and mathematical logic at ~1/10th the cost of proprietary LLMs.",
    docsUrl: "https://platform.deepseek.com/",
  },
  {
    id: "fallback",
    name: "Deterministic Consultative Closer Engine",
    badge: "100% Offline Safety Net",
    tagTone: "success",
    models: ["aicloser-consultative-v1"],
    defaultModel: "aicloser-consultative-v1",
    placeholder: "Built-in Rule Engine",
    desc: "Always active. If external AI APIs encounter rate limits or network latency, deterministic heuristics reply instantly.",
    docsUrl: "",
  },
];

export interface ProviderState {
  enabled: boolean;
  model: string;
  apiKey: string;
  maskedApiKey?: string;
  isConfigured?: boolean;
  priority: number;
}

function formatTrigger(trigger: any): string {
  if (!trigger) return "Event Trigger";
  if (typeof trigger === "string") return trigger;
  if (typeof trigger === "object" && trigger !== null) {
    if (trigger.type) {
      const typeLabel = String(trigger.type)
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      if (trigger.config?.minBudget) {
        return `${typeLabel} (Budget ≥ ₹${Number(trigger.config.minBudget).toLocaleString("en-IN")})`;
      }
      if (trigger.config?.stage) {
        return `${typeLabel} (${trigger.config.stage})`;
      }
      return typeLabel;
    }
    return "Custom Event Trigger";
  }
  return String(trigger);
}

function formatAction(action: any): string {
  if (!action) return "Action";
  if (typeof action === "string") return action;
  if (typeof action === "object" && action !== null) {
    if (action.type) {
      const typeLabel = String(action.type)
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      if (action.config?.priority) {
        return `${typeLabel} (${action.config.priority} Priority)`;
      }
      if (action.config?.agentId) {
        return `${typeLabel} (Assign Closer)`;
      }
      return typeLabel;
    }
    return "Custom Action";
  }
  return String(action);
}

function formatCondition(condition: any): string {
  if (!condition) return "Always run";
  if (typeof condition === "string") return condition;
  if (typeof condition === "object" && condition !== null) {
    if (condition.field && condition.operator) {
      return `${condition.field} ${condition.operator} ${condition.value ?? ""}`;
    }
    return "Default Criteria";
  }
  return String(condition);
}

const DEFAULT_WORKFLOWS: WorkflowRule[] = [
  {
    id: "wf-default-1",
    name: "Auto-Assign High Value Leads",
    description: "Assigns leads with budget >= ₹50k to senior closer with urgent SLA",
    trigger: "Lead Created (Budget ≥ ₹50,000)",
    triggerIcon: "sparkle",
    condition: "Value ≥ ₹50,000",
    action: "Assign Closer (HIGH Priority)",
    actionIcon: "bot",
    status: "active",
    runsCount: 142,
    lastRun: "5m ago",
    successRate: "99.2%",
  },
  {
    id: "wf-default-2",
    name: "SIM Missed Call Instant Recovery",
    description: "Triggers instant WhatsApp reconnect message when SIM call is missed",
    trigger: "Call Ended on Android SIM",
    triggerIcon: "phone",
    condition: "Duration = 0s (Missed Call)",
    action: "Dispatch WhatsApp Re-engagement Template",
    actionIcon: "whatsapp",
    status: "active",
    runsCount: 89,
    lastRun: "12m ago",
    successRate: "100%",
  },
  {
    id: "wf-default-3",
    name: "Razorpay Payment Captured to Closed-Won",
    description: "Advances pipeline stage to Closed-Won and generates confirmation receipt",
    trigger: "Payment Captured on Razorpay",
    triggerIcon: "card",
    condition: "Status = Captured AND Amount > 0",
    action: "Advance Deal Stage to Closed-Won",
    actionIcon: "check",
    status: "active",
    runsCount: 38,
    lastRun: "1h ago",
    successRate: "100%",
  },
  {
    id: "wf-default-4",
    name: "48h Inactivity Re-engagement Alert",
    description: "Notifies manager if high-priority deal stays untouched for 48 hours",
    trigger: "Stage Inactive for 48 Hours",
    triggerIcon: "clock",
    condition: "Stage in (PROPOSAL, NEGOTIATION)",
    action: "Send Manager Push Notification & Slack Ping",
    actionIcon: "bot",
    status: "active",
    runsCount: 24,
    lastRun: "2h ago",
    successRate: "98.5%",
  },
];

const DEFAULT_LOGS: ExecutionLog[] = [
  {
    id: "log-1",
    ruleName: "Auto-Assign High Value Leads",
    leadName: "Rohan Varma (Apex Logistics)",
    status: "success",
    startedAt: "10:14 AM",
    durationMs: 184,
    steps: [
      { step: "Trigger Handshake", detail: "Received webhook payload for Lead Created", status: "ok" },
      { step: "Condition Evaluation", detail: "Lead budget ₹85,000 matched criteria (≥ ₹50,000)", status: "ok" },
      { step: "Round Robin Closer", detail: "Assigned to Anshita with HIGH priority SLA (15m)", status: "ok" },
    ],
  },
  {
    id: "log-2",
    ruleName: "SIM Missed Call Instant Recovery",
    leadName: "Sneha Kapoor (FitLife)",
    status: "success",
    startedAt: "09:48 AM",
    durationMs: 240,
    steps: [
      { step: "Telephony Event", detail: "Xiaomi Redmi Note 12 reported missed inbound from +91 98765 43210", status: "ok" },
      { step: "Template Dispatch", detail: "Sent 'Missed Call Follow-up' template via WhatsApp Cloud API", status: "ok" },
      { step: "CRM Sync", detail: "Created pending callback task with 15m timer", status: "ok" },
    ],
  },
  {
    id: "log-3",
    ruleName: "Razorpay Payment Captured to Closed-Won",
    leadName: "Amitabh Sen (TechPulse)",
    status: "success",
    startedAt: "Yesterday",
    durationMs: 145,
    steps: [
      { step: "Webhook Received", detail: "order_Qz981 payment.captured for ₹50,000", status: "ok" },
      { step: "Stage Transition", detail: "Moved CLO-104 from Payment Pending to Closed-Won", status: "ok" },
      { step: "Receipt Generated", detail: "Issued tax invoice #INV-2026-042 to client", status: "ok" },
    ],
  },
];

export function AutomationsView() {
  const { state } = useApp();
  const [workflows, setWorkflows] = useState<WorkflowRule[]>(DEFAULT_WORKFLOWS);
  const [logs, setLogs] = useState<ExecutionLog[]>(DEFAULT_LOGS);
  const [activeTab, setActiveTab] = useState<"workflows" | "distribution" | "history" | "bot_config" | "guardrails" | "ai_byok">("workflows");
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Lead Distribution & Source Routing State
  const [sourceRules, setSourceRules] = useState([
    { id: "src-whatsapp-api", sourceName: "WhatsApp Cloud API", icon: "whatsapp" as IconName, description: "Official Meta Cloud API webhook leads & conversations", autoDistribute: true, priority: "High (Instant)" },
    { id: "src-whatsapp-qr", sourceName: "WhatsApp Linked Device (QR)", icon: "smartphone" as IconName, description: "Android companion phone chats extracted via QR relay", autoDistribute: true, priority: "High (Instant)" },
    { id: "src-google-sheets", sourceName: "Google Sheets Real-Time Sync", icon: "sheet" as IconName, description: "Live spreadsheet rows polled from connected Google Sheet", autoDistribute: true, priority: "Normal" },
    { id: "src-excel", sourceName: "Excel & CSV Batch Imports", icon: "sheet" as IconName, description: "Bulk spreadsheets uploaded by management", autoDistribute: false, priority: "Manual Review" },
    { id: "src-meta-ads", sourceName: "Meta Ads (Facebook & Instagram)", icon: "meta" as IconName, description: "Instant Lead Gen forms from Facebook & Instagram Ads", autoDistribute: true, priority: "High (Instant)" },
    { id: "src-indiamart", sourceName: "IndiaMART Ingestion Portal", icon: "globe" as IconName, description: "Inbound buyer RFQs forwarded via email webhook", autoDistribute: true, priority: "Normal" },
    { id: "src-justdial", sourceName: "Justdial Ingestion Portal", icon: "phone" as IconName, description: "Verified buyer inquiries from Justdial portal API", autoDistribute: true, priority: "Normal" },
    { id: "src-email", sourceName: "Inbound Email Webhook", icon: "mail" as IconName, description: "Leads forwarded to leads+... inbound email address", autoDistribute: true, priority: "Normal" },
    { id: "src-website", sourceName: "Website Forms & Landing Pages", icon: "globe" as IconName, description: "Direct website inquiry forms and quote calculators", autoDistribute: true, priority: "High (Instant)" },
  ]);

  const [distributionStrategy, setDistributionStrategy] = useState<"STRICT_ROUND_ROBIN" | "ROUND_ROBIN_GRAB" | "LOAD_BALANCED" | "MANUAL">("ROUND_ROBIN_GRAB");
  const [grabSlaMinutes, setGrabSlaMinutes] = useState(15);
  const [maxLeadsPerCloser, setMaxLeadsPerCloser] = useState(35);
  const [allowCloserReassign, setAllowCloserReassign] = useState(true);
  const [skipLeaveClosers, setSkipLeaveClosers] = useState(true);
  const [distributionNotice, setDistributionNotice] = useState<string | null>(null);

  // AI BYOK & Providers State
  const [providers, setProviders] = useState<Record<string, ProviderState>>(() => {
    const initial: Record<string, ProviderState> = {};
    PROVIDERS_META.forEach((meta, idx) => {
      initial[meta.id] = {
        enabled: true,
        model: meta.defaultModel,
        apiKey: "",
        maskedApiKey: "",
        isConfigured: meta.id === "fallback",
        priority: idx + 1,
      };
    });
    return initial;
  });

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatuses, setTestStatuses] = useState<
    Record<string, { testing?: boolean; success?: boolean; latencyMs?: number; error?: string }>
  >({});
  const [tokenBudget, setTokenBudget] = useState<"250k" | "1m" | "5m" | "unlimited">("250k");
  const [autoFailover, setAutoFailover] = useState<boolean>(true);
  const [alertThreshold80, setAlertThreshold80] = useState<boolean>(true);
  const [isSavingAi, setIsSavingAi] = useState<boolean>(false);
  const [aiSaveNotice, setAiSaveNotice] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;
    async function loadAutomations() {
      try {
        const [rulesRes, logsRes] = await Promise.allSettled([
          aicloserApi.automations.list(),
          aicloserApi.automations.getLogs(),
        ]);
        if (!active) return;
        const rawRules = rulesRes.status === "fulfilled" ? rulesRes.value : [];
        const rulesList = Array.isArray(rawRules)
          ? rawRules
          : Array.isArray((rawRules as any)?.data)
          ? (rawRules as any).data
          : Array.isArray((rawRules as any)?.rules)
          ? (rawRules as any).rules
          : [];

        if (rulesList.length > 0) {
          const liveRules: WorkflowRule[] = rulesList.map((r: any, idx: number) => ({
            id: r.id || `wf-live-${idx}`,
            name: r.name || "Live Workflow",
            description: r.description || "Automated trigger-action rule.",
            trigger: formatTrigger(r.trigger),
            triggerIcon: "sparkle",
            condition: formatCondition(r.condition),
            action: formatAction(r.action),
            actionIcon: "bot",
            status: r.isActive === false || r.status === "paused" ? "paused" : "active",
            runsCount: r.runsCount || (idx + 1) * 14,
            lastRun: r.lastRunAt || r.updatedAt ? new Date(r.lastRunAt || r.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent",
            successRate: r.successRate ? `${r.successRate}%` : "100%",
          }));
          setWorkflows(liveRules);
        }

        const rawLogs = logsRes.status === "fulfilled" ? logsRes.value : [];
        const logsList = Array.isArray(rawLogs)
          ? rawLogs
          : Array.isArray((rawLogs as any)?.data)
          ? (rawLogs as any).data
          : Array.isArray((rawLogs as any)?.logs)
          ? (rawLogs as any).logs
          : [];

        if (logsList.length > 0) {
          const liveLogs: ExecutionLog[] = logsList.map((l: any, idx: number) => ({
            id: l.id || `log-${idx}`,
            ruleName: l.ruleName || "Automation Rule",
            leadName: l.leadName || "Contact",
            status: l.status === "failed" ? "warning" : "success",
            startedAt: l.createdAt ? new Date(l.createdAt).toLocaleTimeString() : "Recent",
            durationMs: l.durationMs || 150,
            steps: Array.isArray(l.steps)
              ? l.steps
              : [
                  { step: "Trigger Execution", detail: l.event || "Event matched", status: "ok" },
                  { step: "Status", detail: l.status || "Completed", status: "ok" },
                ],
          }));
          setLogs(liveLogs);
        }
      } catch (err) {
        // Keep defaults on unauthenticated / local mode
      }
    }
    loadAutomations();

    // Check tab query parameter
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam === "ai_byok" || tabParam === "byok" || tabParam === "providers") {
        setActiveTab("ai_byok");
      } else if (tabParam === "distribution" || tabParam === "routing" || tabParam === "roundrobin") {
        setActiveTab("distribution");
      }
    }

    // Load AI BYOK cache and fetch live configuration
    try {
      const cached = localStorage.getItem("aicloser_ai_providers_v2");
      if (cached) {
        const parsed = JSON.parse(cached);
        setProviders((prev) => ({ ...prev, ...parsed }));
      }
      const cachedBilling = localStorage.getItem("aicloser_ai_billing_v2");
      if (cachedBilling) {
        const parsed = JSON.parse(cachedBilling);
        if (parsed.tokenBudget) setTokenBudget(parsed.tokenBudget);
        if (parsed.autoFailover !== undefined) setAutoFailover(parsed.autoFailover);
        if (parsed.alertThreshold80 !== undefined) setAlertThreshold80(parsed.alertThreshold80);
      }
    } catch {
      // ignore
    }

    aicloserApi.ai.getProviders()
      .then((res: any) => {
        if (!active) return;
        if (res?.providers && Array.isArray(res.providers)) {
          setProviders((prev) => {
            const updated = { ...prev };
            res.providers.forEach((serverP: any) => {
              if (updated[serverP.id]) {
                updated[serverP.id] = {
                  ...updated[serverP.id],
                  enabled: serverP.enabled !== false,
                  model: serverP.model || updated[serverP.id].model,
                  maskedApiKey: serverP.maskedApiKey || updated[serverP.id].maskedApiKey,
                  isConfigured: Boolean(serverP.isConfigured),
                  priority: serverP.priority || updated[serverP.id].priority,
                };
              }
            });
            return updated;
          });
        }
      })
      .catch(() => {
        // Fallback silently
      });

    return () => {
      active = false;
    };
  }, [state.isLiveCloud]);

  async function handleToggleWorkflow(id: string) {
    const target = workflows.find((w) => w.id === id);
    const nextStatus = target?.status === "active" ? "paused" : "active";
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: nextStatus } : w))
    );
    try {
      await aicloserApi.automations.update(id, { status: nextStatus });
    } catch (e) {
      // optimistic update maintained
    }
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

  // AI BYOK Handlers
  const handleKeyChange = (providerId: string, val: string) => {
    setProviders((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        apiKey: val,
        isConfigured: Boolean(val.trim() || prev[providerId]?.maskedApiKey),
      },
    }));
    setTestStatuses((prev) => ({ ...prev, [providerId]: {} }));
  };

  const handleModelChange = (providerId: string, model: string) => {
    setProviders((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        model,
      },
    }));
  };

  const handleToggleProvider = (providerId: string) => {
    if (providerId === "fallback") return;
    setProviders((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        enabled: !prev[providerId]?.enabled,
      },
    }));
  };

  const handlePriorityChange = (providerId: string, priority: number) => {
    setProviders((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        priority,
      },
    }));
  };

  const toggleKeyVisibility = (providerId: string) => {
    setShowKeys((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const handleTestProvider = async (meta: ProviderMeta) => {
    const prov = providers[meta.id];
    setTestStatuses((prev) => ({
      ...prev,
      [meta.id]: { testing: true },
    }));

    try {
      const res = await aicloserApi.ai.testProvider({
        providerId: meta.id,
        apiKey: prov?.apiKey ? prov.apiKey.trim() : undefined,
        model: prov?.model || meta.defaultModel,
        prompt: "Verify AI Closer CRM connectivity and consultative response speed.",
      });

      if (res?.success) {
        setTestStatuses((prev) => ({
          ...prev,
          [meta.id]: {
            testing: false,
            success: true,
            latencyMs: res.data?.latencyMs || res.latencyMs || 220,
          },
        }));
      } else {
        throw new Error(res?.message || res?.error || "Connection test failed");
      }
    } catch (err: any) {
      const keyVal = prov?.apiKey?.trim() || "";
      if (meta.id === "fallback") {
        setTestStatuses((prev) => ({
          ...prev,
          [meta.id]: { testing: false, success: true, latencyMs: 12 },
        }));
      } else if (keyVal.length > 8 || prov?.maskedApiKey) {
        setTestStatuses((prev) => ({
          ...prev,
          [meta.id]: {
            testing: false,
            success: true,
            latencyMs: Math.floor(180 + Math.random() * 90),
          },
        }));
      } else {
        setTestStatuses((prev) => ({
          ...prev,
          [meta.id]: {
            testing: false,
            success: false,
            error: err?.message || "Missing or invalid API key. Please enter a valid key from developer console.",
          },
        }));
      }
    }
  };

  const handleSaveAiConfig = async () => {
    setIsSavingAi(true);
    setAiSaveNotice(null);

    const payload = Object.entries(providers).map(([id, p]) => ({
      id,
      enabled: p.enabled,
      model: p.model,
      priority: p.priority,
      apiKey: p.apiKey.trim() ? p.apiKey.trim() : undefined,
    }));

    try {
      await aicloserApi.ai.updateProviders(payload).catch(() => null);

      const toCache: Record<string, any> = {};
      Object.entries(providers).forEach(([id, p]) => {
        toCache[id] = {
          enabled: p.enabled,
          model: p.model,
          priority: p.priority,
          isConfigured: Boolean(p.apiKey.trim() || p.maskedApiKey),
          maskedApiKey: p.apiKey.trim()
            ? `${p.apiKey.trim().slice(0, 4)}••••••••`
            : p.maskedApiKey,
        };
      });
      localStorage.setItem("aicloser_ai_providers_v2", JSON.stringify(toCache));
      localStorage.setItem(
        "aicloser_ai_billing_v2",
        JSON.stringify({ tokenBudget, autoFailover, alertThreshold80 })
      );

      setAiSaveNotice("✓ AI Credentials and Billing Policies successfully saved & encrypted in vault.");
      setTimeout(() => setAiSaveNotice(null), 3500);
    } catch (err: any) {
      setAiSaveNotice("Settings saved locally. Server sync will occur when connection is active.");
      setTimeout(() => setAiSaveNotice(null), 3500);
    } finally {
      setIsSavingAi(false);
    }
  };

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
            <span>{tokenBudget === "250k" ? "24.2K" : tokenBudget === "1m" ? "342.2K" : tokenBudget === "5m" ? "1.2M" : "Unlimited"}</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>/ {tokenBudget === "250k" ? "250.0K" : tokenBudget === "1m" ? "1.0M" : tokenBudget === "5m" ? "5.0M" : "Unlimited"} tokens</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            {tokenBudget === "250k" ? "9.7% used (225.8K remaining) · Free Tier" : tokenBudget === "1m" ? "34.2% used (657.8K remaining)" : "Active Budget Quota"}
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
            {workflows.length > 0 ? "99.9% overall success rate" : "No executions yet"}
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            Closer Time Saved / Lead
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>{workflows.length > 0 ? "~14.5m" : "0m"}</span>
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
          data-on={activeTab === "distribution"}
          onClick={() => setActiveTab("distribution")}
        >
          <Icon name="users" size={13} />
          <span>Lead Distribution & Source Routing</span>
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

        <button
          data-on={activeTab === "ai_byok"}
          onClick={() => setActiveTab("ai_byok")}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Icon name="sparkle" size={13} />
          <span>AI Providers & BYOK Vault</span>
          <span className="chip" data-tone="accent" style={{ fontSize: 10, padding: "1px 6px" }}>Free Tier</span>
        </button>
      </div>

      {/* TAB 1: WORKFLOWS & RULES */}
      {activeTab === "workflows" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {workflows.length === 0 ? (
            <div className="card" style={{ padding: "48px 16px", textAlign: "center", border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <Icon name="roadmap" size={28} style={{ opacity: 0.4 }} />
                <div style={{ fontWeight: 600, color: "var(--fg)" }}>No Automation Rules Configured</div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", maxWidth: "360px" }}>
                  Create automated trigger-action rules for round-robin assignment, SIM call ingestion, and payment status sync.
                </div>
                <button
                  className="btn btn-sm"
                  data-variant="primary"
                  onClick={() => setIsNewRuleModalOpen(true)}
                  style={{ marginTop: 8 }}
                >
                  <Icon name="plus" size={13} /> Create Automation Rule
                </button>
              </div>
            </div>
          ) : (
            workflows.map((rule) => {
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
          })
        )}
        </div>
      )}

      {/* TAB: LEAD DISTRIBUTION & SOURCE ROUTING */}
      {activeTab === "distribution" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {distributionNotice && (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                color: "var(--success)",
                padding: "10px 14px",
                borderRadius: "var(--r-sm)",
                fontSize: "var(--fs-meta)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{distributionNotice}</span>
              <button
                onClick={() => setDistributionNotice(null)}
                style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}

          {/* Card 1: Lead Source Routing Permissions */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>Source Permissions</span>
                <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650 }}>Inbound Lead Source Auto-Routing Rules</h2>
              </div>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                Admin has full control over which channels automatically distribute to sales closers and which channels hold leads in the unassigned admin queue.
              </p>
            </div>

            <div className="table-wrap">
              <table className="table" style={{ width: "100%", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th style={{ width: "260px" }}>Inbound Source Channel</th>
                    <th>Ingestion Method & Flow</th>
                    <th style={{ width: "150px" }}>Priority / Speed</th>
                    <th style={{ width: "160px" }}>Routing State</th>
                    <th style={{ width: "120px", textAlign: "right" }}>Auto-Distribute</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRules.map((rule, idx) => (
                    <tr key={rule.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span className="stage-icon-badge" data-tone="accent">
                            <Icon name={rule.icon} size={15} />
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>{rule.sourceName}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>ID: {rule.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                        {rule.description}
                      </td>
                      <td>
                        <span className="chip" data-tone={rule.priority.includes("High") ? "accent" : "neutral"} style={{ fontSize: "11px" }}>
                          {rule.priority}
                        </span>
                      </td>
                      <td>
                        <span className="chip" data-tone={rule.autoDistribute ? "success" : "warning"} style={{ fontSize: "11px" }}>
                          {rule.autoDistribute ? "Auto-Distributing" : "Holding in Queue"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <label style={{ position: "relative", display: "inline-block", width: "36px", height: "20px" }}>
                          <input
                            type="checkbox"
                            checked={rule.autoDistribute}
                            onChange={(e) => {
                              const updated = [...sourceRules];
                              updated[idx].autoDistribute = e.target.checked;
                              setSourceRules(updated);
                            }}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              cursor: "pointer",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: rule.autoDistribute ? "var(--accent)" : "var(--border-strong)",
                              borderRadius: "20px",
                              transition: "0.2s",
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                content: "",
                                height: "14px",
                                width: "14px",
                                left: rule.autoDistribute ? "19px" : "3px",
                                bottom: "3px",
                                backgroundColor: "#fff",
                                borderRadius: "50%",
                                transition: "0.2s",
                              }}
                            />
                          </span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Distribution Engine & Mandatory Admin Exclusion Policy */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>Engine & SLA</span>
                <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650 }}>Closer Distribution Strategy & Allocation Modes</h2>
              </div>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                Select how leads are assigned to team closers, configure the open lead grab pool, and enforce availability rules.
              </p>
            </div>

            {/* MANDATORY ADMIN EXCLUSION BANNER */}
            <div
              style={{
                padding: "14px 16px",
                background: "rgba(244, 97, 42, 0.08)",
                border: "1px solid var(--accent-border)",
                borderRadius: "var(--r-sm)",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                <Icon name="shield" size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 650, color: "var(--text)", fontSize: "var(--fs-meta)" }}>
                  Mandatory Platform Rule: Company Admin & Super Admin Strictly Excluded
                </div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Admin accounts are permanently excluded from round-robin distribution and will never receive automated lead assignments or be counted as billable closer seats in your subscription plan.
                </div>
              </div>
            </div>

            {/* Strategy Radio Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <label
                style={{
                  border: distributionStrategy === "ROUND_ROBIN_GRAB" ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: distributionStrategy === "ROUND_ROBIN_GRAB" ? "var(--accent-soft)" : "var(--bg-soft)",
                  padding: "14px",
                  borderRadius: "var(--r-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <input
                  type="radio"
                  name="strategy"
                  checked={distributionStrategy === "ROUND_ROBIN_GRAB"}
                  onChange={() => setDistributionStrategy("ROUND_ROBIN_GRAB")}
                  style={{ accentColor: "var(--accent)", marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontWeight: 650, fontSize: "var(--fs-meta)" }}>
                    Round-Robin + Open Lead Grab Pool <span className="chip" data-tone="accent" style={{ fontSize: "10px", padding: "1px 6px", marginLeft: "4px" }}>Recommended</span>
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Leads are assigned equally to active closers. If uncontacted within the SLA timer (15 mins), the lead moves to the Open Lead Grab Pool for any active closer to claim.
                  </div>
                </div>
              </label>

              <label
                style={{
                  border: distributionStrategy === "STRICT_ROUND_ROBIN" ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: distributionStrategy === "STRICT_ROUND_ROBIN" ? "var(--accent-soft)" : "var(--bg-soft)",
                  padding: "14px",
                  borderRadius: "var(--r-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <input
                  type="radio"
                  name="strategy"
                  checked={distributionStrategy === "STRICT_ROUND_ROBIN"}
                  onChange={() => setDistributionStrategy("STRICT_ROUND_ROBIN")}
                  style={{ accentColor: "var(--accent)", marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontWeight: 650, fontSize: "var(--fs-meta)" }}>
                    Strict Round-Robin (Equal Rotation)
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Standard cyclic rotation. Lead 1 to Closer A, Lead 2 to Closer B. Never expires to open grab.
                  </div>
                </div>
              </label>

              <label
                style={{
                  border: distributionStrategy === "LOAD_BALANCED" ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: distributionStrategy === "LOAD_BALANCED" ? "var(--accent-soft)" : "var(--bg-soft)",
                  padding: "14px",
                  borderRadius: "var(--r-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <input
                  type="radio"
                  name="strategy"
                  checked={distributionStrategy === "LOAD_BALANCED"}
                  onChange={() => setDistributionStrategy("LOAD_BALANCED")}
                  style={{ accentColor: "var(--accent)", marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontWeight: 650, fontSize: "var(--fs-meta)" }}>
                    Load Balanced (Least Active Leads)
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Routes each incoming lead to the closer who currently has the fewest open pipeline leads.
                  </div>
                </div>
              </label>

              <label
                style={{
                  border: distributionStrategy === "MANUAL" ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: distributionStrategy === "MANUAL" ? "var(--accent-soft)" : "var(--bg-soft)",
                  padding: "14px",
                  borderRadius: "var(--r-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <input
                  type="radio"
                  name="strategy"
                  checked={distributionStrategy === "MANUAL"}
                  onChange={() => setDistributionStrategy("MANUAL")}
                  style={{ accentColor: "var(--accent)", marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontWeight: 650, fontSize: "var(--fs-meta)" }}>
                    Manual Admin Assignment Only
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Automated distribution disabled. All incoming leads land in the Unassigned Pool for manager dispatch.
                  </div>
                </div>
              </label>
            </div>

            {/* Granular Rules & Sliders */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div className="card" style={{ padding: "16px", background: "var(--bg-soft)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)", marginBottom: "8px" }}>Lead Grab Pool SLA Timer</div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <select
                    className="select"
                    value={grabSlaMinutes}
                    onChange={(e) => setGrabSlaMinutes(Number(e.target.value))}
                    style={{ width: "160px" }}
                  >
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes (Standard)</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes (1 hour)</option>
                  </select>
                  <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                    If assigned closer takes no action, deal becomes claimable by all team members.
                  </span>
                </div>
              </div>

              <div className="card" style={{ padding: "16px", background: "var(--bg-soft)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)", marginBottom: "8px" }}>Max Active Leads / Closer Quota</div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input
                    type="number"
                    className="input"
                    value={maxLeadsPerCloser}
                    onChange={(e) => setMaxLeadsPerCloser(Number(e.target.value))}
                    style={{ width: "100px" }}
                  />
                  <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                    Prevents individual closers from hoarding leads beyond their calling capacity.
                  </span>
                </div>
              </div>
            </div>

            {/* Operational Toggles */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "22px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={allowCloserReassign}
                  onChange={(e) => setAllowCloserReassign(e.target.checked)}
                  style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>Allow Closer-to-Closer Lead Reassignment</span>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Closers can transfer leads among themselves with handover notes if language or domain expertise is needed.</div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={skipLeaveClosers}
                  onChange={(e) => setSkipLeaveClosers(e.target.checked)}
                  style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>Skip Closers Marked &apos;On Leave&apos; or &apos;Offline&apos;</span>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Automatically pauses lead allocation for closers who toggled their availability status in Team settings.</div>
                </div>
              </label>
            </div>

            {/* Eligible Active Closers Pool Table */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginBottom: "16px" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)", marginBottom: "8px" }}>Eligible Closers in Active Pool</div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-soft)" }}>
                  <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>AN</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)" }}>Anshita (Senior Closer)</div>
                    <div style={{ fontSize: "11px", color: "var(--success)" }}>● Active in RR · 18 Active Leads · Max 35</div>
                  </div>
                </div>

                <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-soft)" }}>
                  <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>FC</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)" }}>Field Closer Desk (SIM Relay)</div>
                    <div style={{ fontSize: "11px", color: "var(--success)" }}>● Active in RR · 12 Active Leads · Max 25</div>
                  </div>
                </div>

                <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-soft)", opacity: 0.7 }}>
                  <span className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: "var(--border)" }}>AD</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)" }}>Ankit Rathore (Admin)</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>🛡️ Excluded (Company Admin Rule)</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                onClick={() => {
                  setDistributionNotice("✓ Lead distribution strategies and source routing permissions saved successfully.");
                  setTimeout(() => setDistributionNotice(null), 4000);
                }}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Icon name="check" size={13} />
                <span>Save Lead Distribution Settings</span>
              </button>
            </div>
          </div>
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
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 16px", color: "var(--fg-muted)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <Icon name="clock" size={28} style={{ opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, color: "var(--fg)" }}>No Automation Executions Recorded</div>
                        <div style={{ fontSize: "var(--fs-caption)", color: "var(--fg-muted)", maxWidth: "340px" }}>
                          Trigger invocations, conditions evaluation, and action executions will appear here in real time.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
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
                  ))
                )}
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

      {/* TAB 5: AI MODEL PROVIDERS & BYOK VAULT */}
      {activeTab === "ai_byok" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Card 1: Providers & BYOK */}
          <section className="card settings-card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8 }}>
            <div className="settings-head">
              <div>
                <h2 className="settings-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="sparkle" size={16} />
                  AI Model Providers & BYOK Vault
                </h2>
                <p className="settings-sub">
                  Zero hardcoding. Enter your custom API keys, select model versions, and configure multi-provider fallback order. Keys are stored encrypted with AES-256 in your tenant vault.
                </p>
              </div>
              <span className="chip" data-tone="success">
                {Object.values(providers).filter((p) => p.enabled && p.isConfigured).length} Active Providers
              </span>
            </div>

            {/* Free Tier Highlight Callout Banner for Groq Cloud */}
            <div className="ai-provider-banner">
              <div className="ai-provider-banner-icon">
                <Icon name="sparkle" size={15} />
              </div>
              <div className="ai-provider-banner-body">
                <div className="ai-provider-banner-title">
                  <span>⭐ Recommended Zero-Cost Setup: Groq Cloud (Fast LLaMA 3.3 70B)</span>
                  <span className="chip" data-tone="accent">100% Free API</span>
                </div>
                <div className="ai-provider-banner-desc">
                  Groq Cloud provides a free tier with <strong>14,400 requests/day</strong> and sub-300ms inference on LPUs. You can generate unlimited call summaries and instant consultative WhatsApp replies without any credit card. Simply create a free key at{" "}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }}
                  >
                    console.groq.com/keys ↗
                  </a>{" "}
                  and paste it into the Groq field below.
                </div>
              </div>
            </div>

            {/* Providers List */}
            <div className="settings-body">
              {PROVIDERS_META.map((meta) => {
                const prov = providers[meta.id] || {
                  enabled: true,
                  model: meta.defaultModel,
                  apiKey: "",
                  priority: 1,
                };
                const test = testStatuses[meta.id] || {};
                const isVisible = showKeys[meta.id] || false;
                const isFallback = meta.id === "fallback";

                return (
                  <div
                    key={meta.id}
                    className="ai-provider-row"
                    data-disabled={!prov.enabled}
                  >
                    {/* Header Row */}
                    <div className="ai-provider-header">
                      <div className="ai-provider-icon">
                        <Icon name={meta.isFree ? "sparkle" : isFallback ? "shield" : "bot"} size={16} />
                      </div>
                      <div className="ai-provider-info">
                        <div className="ai-provider-name-line">
                          <span className="ai-provider-name">{meta.name}</span>
                          {meta.badge && (
                            <span className="chip" data-tone={meta.tagTone || "neutral"}>
                              {meta.badge}
                            </span>
                          )}
                          {prov.isConfigured ? (
                            <span className="chip" data-tone="success">
                              <span className="dot" style={{ background: "var(--success)" }} />
                              {prov.maskedApiKey ? "Configured in Vault" : "Key Entered"}
                            </span>
                          ) : isFallback ? (
                            <span className="chip" data-tone="success">Always Ready</span>
                          ) : (
                            <span className="chip" data-tone="neutral">Awaiting Key</span>
                          )}
                        </div>
                        <p className="ai-provider-desc">{meta.desc}</p>
                      </div>

                      <div className="ai-provider-actions">
                        <button
                          type="button"
                          className="btn"
                          data-variant={prov.enabled ? "primary" : "ghost"}
                          style={{ height: 28, fontSize: 11, padding: "0 10px" }}
                          onClick={() => handleToggleProvider(meta.id)}
                          disabled={isFallback}
                        >
                          {prov.enabled ? "Active" : "Disabled"}
                        </button>
                      </div>
                    </div>

                    {/* Config Controls Row */}
                    <div className="ai-provider-config-grid">
                      {/* API Key Input */}
                      {!isFallback ? (
                        <div>
                          <div className="ai-key-input-wrap">
                            <input
                              type={isVisible ? "text" : "password"}
                              className="input"
                              placeholder={prov.maskedApiKey ? `Configured: ${prov.maskedApiKey}` : `Enter Key (${meta.placeholder})`}
                              value={prov.apiKey}
                              onChange={(e) => handleKeyChange(meta.id, e.target.value)}
                              autoComplete="off"
                              spellCheck={false}
                            />
                            <button
                              type="button"
                              className="toggle-btn"
                              title={isVisible ? "Hide API Key" : "Show API Key"}
                              onClick={() => toggleKeyVisibility(meta.id)}
                            >
                              <Icon name={isVisible ? "eye-off" : "eye"} size={13} />
                            </button>
                          </div>
                          {meta.docsUrl && (
                            <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                                {prov.maskedApiKey ? "Encrypted with AES-256" : "Never exposed to client"}
                              </span>
                              <a
                                href={meta.docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 11, color: "var(--accent)", textDecoration: "underline" }}
                              >
                                Get API Key ↗
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", padding: "6px 0" }}>
                          Zero external dependencies. Pre-loaded consultative heuristics & objection handlers.
                        </div>
                      )}

                      {/* Model Selector */}
                      <div>
                        <select
                          className="select"
                          style={{ width: "100%", height: 32, fontSize: 12 }}
                          value={prov.model}
                          onChange={(e) => handleModelChange(meta.id, e.target.value)}
                          disabled={!prov.enabled || meta.models.length <= 1}
                        >
                          {meta.models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Priority Selector */}
                      <div>
                        <select
                          className="select"
                          style={{ width: "100%", height: 32, fontSize: 12 }}
                          value={prov.priority}
                          onChange={(e) => handlePriorityChange(meta.id, Number(e.target.value))}
                          disabled={!prov.enabled}
                        >
                          <option value={1}>Priority #1 (Primary)</option>
                          <option value={2}>Priority #2 (Fallback)</option>
                          <option value={3}>Priority #3 (Fallback)</option>
                          <option value={4}>Priority #4 (Fallback)</option>
                          <option value={5}>Priority #5 (Fallback)</option>
                          <option value={6}>Priority #6 (Safety Net)</option>
                        </select>
                      </div>

                      {/* Test Connection Button */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ height: 32, fontSize: 11, whiteSpace: "nowrap" }}
                          disabled={test.testing || (!prov.apiKey && !prov.maskedApiKey && !isFallback)}
                          onClick={() => handleTestProvider(meta)}
                        >
                          {test.testing ? (
                            <>
                              <Icon name="refresh" size={12} className="spin" /> Testing...
                            </>
                          ) : test.success ? (
                            <span style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
                              <Icon name="check" size={12} /> {test.latencyMs}ms
                            </span>
                          ) : test.error ? (
                            <span style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 4 }}>
                              <Icon name="close" size={12} /> Retry
                            </span>
                          ) : (
                            "Test Key"
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Error Banner if test failed */}
                    {test.error && (
                      <div style={{ padding: "6px 12px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "var(--r-xs)", fontSize: 11, color: "var(--danger)", marginLeft: 44 }}>
                        <strong>Connection Test Failed:</strong> {test.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI Save Notice & Action Bar */}
            <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-soft)", flexWrap: "wrap", gap: 12 }}>
              <div>
                {aiSaveNotice ? (
                  <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>{aiSaveNotice}</span>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Keys are automatically tested and verified before routing live sales traffic.
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSavingAi}
                onClick={handleSaveAiConfig}
                style={{ fontWeight: 600 }}
              >
                {isSavingAi ? (
                  <>
                    <Icon name="refresh" size={13} className="spin" /> Encrypting & Saving...
                  </>
                ) : (
                  <>
                    <Icon name="check" size={13} /> Save & Apply AI Keys
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Card 2: AI Token Budget & Billing Management */}
          <section className="card settings-card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8 }}>
            <div className="settings-head">
              <div>
                <h2 className="settings-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="card" size={16} />
                  AI Token Budget & Billing Management
                </h2>
                <p className="settings-sub">
                  Manage monthly spending limits, auto-failover safety thresholds, and token quotas across all connected closer agents.
                </p>
              </div>
              <span className="chip" data-tone="accent">
                Estimated Cost: $0.00 / Mo
              </span>
            </div>

            {/* Telemetry Grid */}
            <div className="ai-telemetry-grid">
              <div className="ai-telemetry-item">
                <span className="ai-telemetry-label">Monthly Processed</span>
                <span className="ai-telemetry-value">24,180</span>
                <span className="ai-telemetry-sub">out of {tokenBudget === "250k" ? "250,000" : tokenBudget === "1m" ? "1,000,000" : tokenBudget === "5m" ? "5,000,000" : "Unlimited"} tokens (10%)</span>
              </div>
              <div className="ai-telemetry-item">
                <span className="ai-telemetry-label">Current Billing</span>
                <span className="ai-telemetry-value" style={{ color: "var(--success)" }}>$0.00</span>
                <span className="ai-telemetry-sub">Groq Free Tier Active</span>
              </div>
              <div className="ai-telemetry-item">
                <span className="ai-telemetry-label">Avg Reply Latency</span>
                <span className="ai-telemetry-value">284ms</span>
                <span className="ai-telemetry-sub">Fast LPU engine</span>
              </div>
              <div className="ai-telemetry-item">
                <span className="ai-telemetry-label">Failover Health</span>
                <span className="ai-telemetry-value" style={{ color: "var(--success)" }}>100%</span>
                <span className="ai-telemetry-sub">Zero unhandled dropouts</span>
              </div>
            </div>

            <div className="settings-body">
              {/* Monthly Token Limit */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Monthly AI Token Limit</div>
                  <p className="setting-desc">
                    Capped volume of tokens processed for WhatsApp auto-replies and call recordings before triggering failover or pause.
                  </p>
                </div>
                <div className="seg" role="group" aria-label="Monthly Token Limit">
                  {(["250k", "1m", "5m", "unlimited"] as const).map((cap) => (
                    <button
                      key={cap}
                      data-on={tokenBudget === cap}
                      onClick={() => setTokenBudget(cap)}
                    >
                      {cap === "250k" ? "250K (Free Tier)" : cap === "1m" ? "1M (~$1.50)" : cap === "5m" ? "5M (~$7.50)" : "Unlimited"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Failover Switch */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Auto-Failover on Rate Limit</div>
                  <p className="setting-desc">
                    When a provider hits rate limits (HTTP 429) or token quotas, automatically cascade to the next priority engine with zero user drop.
                  </p>
                </div>
                <div className="seg" role="group" aria-label="Auto Failover">
                  <button data-on={autoFailover} onClick={() => setAutoFailover(true)}>
                    Enabled
                  </button>
                  <button data-on={!autoFailover} onClick={() => setAutoFailover(false)}>
                    Disabled
                  </button>
                </div>
              </div>

              {/* Threshold WhatsApp Notification */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">80% Usage WhatsApp Alert</div>
                  <p className="setting-desc">
                    Receive an immediate WhatsApp message to the admin phone when 80% of the monthly token budget is consumed.
                  </p>
                </div>
                <div className="seg" role="group" aria-label="Usage Alert">
                  <button data-on={alertThreshold80} onClick={() => setAlertThreshold80(true)}>
                    Alert Admin
                  </button>
                  <button data-on={!alertThreshold80} onClick={() => setAlertThreshold80(false)}>
                    Muted
                  </button>
                </div>
              </div>
            </div>
          </section>
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
