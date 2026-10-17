"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  Edit3,
  FileText,
  Key,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sliders,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { aicloserApi } from "@/lib/api-client";

export function AiBotBetaPanel() {
  const [activeSubTab, setActiveSubTab] = useState<"plugins" | "training" | "playground">("plugins");
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // Key form inputs
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [botEnabled, setBotEnabled] = useState(true);

  // Training state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [customSnippet, setCustomSnippet] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  // Chat playground state
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; id: string }>>([
    {
      id: "msg-welcome",
      role: "assistant",
      content: "Hello! I am your AI Closer bot. Ask me anything about our video editing packages, pricing, or qualification playbook. If I get something wrong, click 'Correct AI' below my message to train me!",
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  // Correction state
  const [correctingMessage, setCorrectingMessage] = useState<{ query: string; answer: string } | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  useEffect(() => {
    void fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    setError("");
    try {
      const [botConfig, training, corrections] = await Promise.all([
        aicloserApi.ai.getBotConfig() as Promise<Record<string, any>>,
        aicloserApi.ai.getBotTraining() as Promise<Record<string, any>>,
        aicloserApi.ai.getBotCorrections() as Promise<Record<string, any>>,
      ]);
      const documents = Array.isArray(training?.documents)
        ? training.documents.map((doc: any, index: number) => ({
            ...doc,
            id: doc.id || `central-doc-${index}-${doc.title || "document"}`,
            fileName: doc.fileName || doc.title || "Training document",
            status: doc.status || "Indexed",
          }))
        : [];
      const normalizedCorrections = Array.isArray(corrections?.corrections)
        ? corrections.corrections.map((item: any, index: number) => ({
            ...item,
            id: item.id || `central-correction-${index}`,
            userQuery: item.userQuery || item.originalQuery || "Question",
            correction: item.correction || item.correctedResponse || "",
          }))
        : [];
      setConfig({
        ...botConfig,
        ...training,
        documents,
        corrections: normalizedCorrections,
      });
      setSystemPrompt(botConfig?.customKnowledgeBaseContext || "");
      setBotEnabled(botConfig?.enabled ?? true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI configuration");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveKeys(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");
    setSaveSuccess(false);
    try {
      const providerKeyEntered = [openaiKey, anthropicKey, geminiKey, groqKey, deepseekKey].some((key) => key.trim());
      if (providerKeyEntered) {
        setError("Central AI API manages provider credentials on the server. The current API does not expose a client-side key-save endpoint, so no key was sent.");
        return;
      }
      await aicloserApi.ai.updateBotConfig({
        enabled: botEnabled,
        customKnowledgeBaseContext: systemPrompt,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setError("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["txt", "csv", "md", "json"].includes(extension)) {
        setError("Central AI training currently accepts text-based documents (.txt, .csv, .md, .json). PDF/DOCX ingestion needs a backend parser endpoint.");
        return;
      }
      const content = await file.text();
      await aicloserApi.ai.trainBot({ documents: [{ title: file.name, content }] });
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  }

  async function handleAddTextKnowledge() {
    if (!customTitle.trim() || !customSnippet.trim()) return;
    setUploadingDoc(true);
    setError("");
    try {
      await aicloserApi.ai.trainBot({
        documents: [{ title: customTitle.trim(), content: customSnippet.trim() }],
      });
      setCustomTitle("");
      setCustomSnippet("");
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add knowledge item");
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleDeleteDoc(id: string) {
    if (!confirm("Are you sure you want to remove this document from AI training memory?")) return;
    void id;
    setError("Central AI training does not expose document deletion yet. Nothing was removed.");
  }

  async function handleSendPlayground(e: React.FormEvent) {
    e.preventDefault();
    const prompt = inputPrompt.trim();
    if (!prompt || isThinking) return;

    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now()}`;

    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: prompt }]);
    setInputPrompt("");
    setIsThinking(true);

    try {
      const data = await aicloserApi.ai.botChat({ message: prompt, channel: "WEB" }) as { reply?: string };
      setMessages((prev) => [...prev, { id: botMsgId, role: "assistant", content: data?.reply || "The AI bot did not return a reply." }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: botMsgId, role: "assistant", content: "Connection error while reaching AI bot." },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  async function handleSaveCorrection() {
    if (!correctingMessage || !correctionText.trim()) return;
    try {
      await aicloserApi.ai.correctBot({
        originalQuery: correctingMessage.query,
        botResponse: correctingMessage.answer,
        correctedResponse: correctionText.trim(),
        reason: "Sales agent correction",
      });
      setCorrectionSuccess(true);
      setTimeout(() => {
        setCorrectionSuccess(false);
        setCorrectingMessage(null);
        setCorrectionText("");
      }, 2000);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save correction");
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "65vh",
          width: "100%",
          gridColumn: "1 / -1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem",
          textAlign: "center",
          color: "var(--closer-muted)",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: "rgba(255, 107, 47, 0.12)",
            border: "1px solid rgba(255, 107, 47, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--closer-orange, #ff6b2f)",
            marginBottom: "14px",
          }}
        >
          <RefreshCw className="animate-spin" size={24} />
        </div>
        <strong style={{ fontSize: "1rem", color: "var(--closer-ink)", marginBottom: "4px" }}>
          Loading AI Bot Studio…
        </strong>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--closer-muted)" }}>
          Syncing LLM provider keys, knowledge base, and plugins
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "24px", width: "100%", maxWidth: "1280px", margin: "0 auto", gridColumn: "1 / -1" }}>
      {/* Top Header Card */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          padding: "20px 24px",
          background: "var(--closer-surface)",
          border: "1px solid var(--closer-line)",
          borderRadius: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "rgba(255, 107, 47, 0.15)",
              border: "1px solid rgba(255, 107, 47, 0.35)",
              display: "grid",
              placeItems: "center",
              color: "var(--closer-orange)",
            }}
          >
            <Bot size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--closer-ink)" }}>
                AI Bot Studio
              </h2>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: "rgba(255, 107, 47, 0.18)",
                  color: "var(--closer-orange)",
                  border: "1px solid rgba(255, 107, 47, 0.35)",
                  letterSpacing: "0.06em",
                }}
              >
                BETA
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--closer-muted)" }}>
              Central API bot configuration, text knowledge training, and live response correction feedback loop.
            </p>
          </div>
        </div>

        {/* Master AI Bot Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--closer-muted)" }}>
            AI Assistant:
          </span>
          <button
            type="button"
            onClick={async () => {
              const next = !botEnabled;
              setBotEnabled(next);
              try {
                await aicloserApi.ai.updateBotConfig({ enabled: next });
              } catch (err) {
                setBotEnabled(!next);
                setError(err instanceof Error ? err.message : "Failed to update AI bot status");
              }
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              border: botEnabled ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
              background: botEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: botEnabled ? "#10b981" : "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: botEnabled ? "#10b981" : "#ef4444",
              }}
            />
            {botEnabled ? "ACTIVE" : "PAUSED"}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", fontSize: "0.85rem" }}>
          {error}
        </div>
      ) : null}

      {/* Sub Tabs Bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--closer-line)",
          paddingBottom: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSubTab("plugins")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: "pointer",
            border: activeSubTab === "plugins" ? "1px solid var(--closer-orange-border)" : "1px solid transparent",
            background: activeSubTab === "plugins" ? "rgba(255, 107, 47, 0.12)" : "transparent",
            color: activeSubTab === "plugins" ? "var(--closer-orange)" : "var(--closer-muted)",
          }}
        >
          <Key size={16} /> Plugins & API Keys
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("training")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: "pointer",
            border: activeSubTab === "training" ? "1px solid var(--closer-orange-border)" : "1px solid transparent",
            background: activeSubTab === "training" ? "rgba(255, 107, 47, 0.12)" : "transparent",
            color: activeSubTab === "training" ? "var(--closer-orange)" : "var(--closer-muted)",
          }}
        >
          <FileText size={16} /> Knowledge & Training ({config?.documents?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("playground")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: "pointer",
            border: activeSubTab === "playground" ? "1px solid var(--closer-orange-border)" : "1px solid transparent",
            background: activeSubTab === "playground" ? "rgba(255, 107, 47, 0.12)" : "transparent",
            color: activeSubTab === "playground" ? "var(--closer-orange)" : "var(--closer-muted)",
          }}
        >
          <MessageSquare size={16} /> Test Chat & Correction ({config?.corrections?.length || 0})
        </button>
      </div>

      {/* 1. PLUGINS & API KEYS SUB-TAB */}
      {activeSubTab === "plugins" ? (
        <form onSubmit={handleSaveKeys} style={{ display: "grid", gap: "20px" }}>
          {/* Active Model Selector */}
          <div
            style={{
              padding: "20px 24px",
              background: "var(--closer-surface)",
              border: "1px solid var(--closer-line)",
              borderRadius: "14px",
              display: "grid",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--closer-ink)" }}>
              <Cpu size={18} color="var(--closer-orange)" /> Central AI Runtime
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--closer-muted)" }}>
              The new API owns provider routing and credentials. This UI only manages the bot behavior that is exposed by the central service.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 16px", borderRadius: "10px", border: "1px solid rgba(16, 185, 129, 0.28)", background: "rgba(16, 185, 129, 0.08)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--closer-ink)" }}>Central routing active</div>
                <div style={{ fontSize: "0.75rem", color: "var(--closer-muted)" }}>Fallback and model selection stay server-side.</div>
              </div>
              <span style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 800 }}>CONNECTED</span>
            </div>
          </div>

          {/* Multiple API Keys Grid */}
          <div
            style={{
              padding: "20px 24px",
              background: "var(--closer-surface)",
              border: "1px solid var(--closer-line)",
              borderRadius: "14px",
              display: "grid",
              gap: "16px",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--closer-ink)", fontSize: "1rem" }}>
              Server-managed provider access
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--closer-muted)" }}>
              Provider keys are intentionally not collected in the browser. The central API manages secrets and fallback routing, so no legacy key endpoint is used here.
            </p>

            <div style={{ display: "grid", gap: "14px" }}>
              {/* OpenAI */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "var(--closer-ink)", marginBottom: "4px" }}>
                  <span>OpenAI API Key (sk-...)</span>
                  <span style={{ color: config?.hasOpenaiKey ? "#10b981" : "var(--closer-muted)", fontWeight: 500 }}>
                    {config?.maskedKeys?.openai || "Not set"}
                  </span>
                </label>
                <input
                  type="password"
                  disabled
                  placeholder={config?.hasOpenaiKey ? "Paste new key to replace" : "sk-..."}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--closer-line)", background: "var(--closer-surface-soft)", color: "var(--closer-ink)", fontSize: "0.88rem" }}
                />
              </div>

              {/* Anthropic */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "var(--closer-ink)", marginBottom: "4px" }}>
                  <span>Anthropic Claude API Key (sk-ant-...)</span>
                  <span style={{ color: config?.hasAnthropicKey ? "#10b981" : "var(--closer-muted)", fontWeight: 500 }}>
                    {config?.maskedKeys?.anthropic || "Not set"}
                  </span>
                </label>
                <input
                  type="password"
                  disabled
                  placeholder={config?.hasAnthropicKey ? "Paste new key to replace" : "sk-ant-..."}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--closer-line)", background: "var(--closer-surface-soft)", color: "var(--closer-ink)", fontSize: "0.88rem" }}
                />
              </div>

              {/* Google Gemini */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "var(--closer-ink)", marginBottom: "4px" }}>
                  <span>Google Gemini API Key (AIza...)</span>
                  <span style={{ color: config?.hasGeminiKey ? "#10b981" : "var(--closer-muted)", fontWeight: 500 }}>
                    {config?.maskedKeys?.gemini || "Not set"}
                  </span>
                </label>
                <input
                  type="password"
                  disabled
                  placeholder={config?.hasGeminiKey ? "Paste new key to replace" : "AIza..."}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--closer-line)", background: "var(--closer-surface-soft)", color: "var(--closer-ink)", fontSize: "0.88rem" }}
                />
              </div>

              {/* Groq Cloud */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "var(--closer-ink)", marginBottom: "4px" }}>
                  <span>Groq Cloud API Key (gsk_...)</span>
                  <span style={{ color: config?.hasGroqKey ? "#10b981" : "var(--closer-muted)", fontWeight: 500 }}>
                    {config?.maskedKeys?.groq || "Not set"}
                  </span>
                </label>
                <input
                  type="password"
                  disabled
                  placeholder={config?.hasGroqKey ? "Paste new key to replace" : "gsk_..."}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--closer-line)", background: "var(--closer-surface-soft)", color: "var(--closer-ink)", fontSize: "0.88rem" }}
                />
              </div>

              {/* DeepSeek */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "var(--closer-ink)", marginBottom: "4px" }}>
                  <span>DeepSeek API Key (sk-...)</span>
                  <span style={{ color: config?.hasDeepseekKey ? "#10b981" : "var(--closer-muted)", fontWeight: 500 }}>
                    {config?.maskedKeys?.deepseek || "Not set"}
                  </span>
                </label>
                <input
                  type="password"
                  disabled
                  placeholder={config?.hasDeepseekKey ? "Paste new key to replace" : "sk-..."}
                  value={deepseekKey}
                  onChange={(e) => setDeepseekKey(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--closer-line)", background: "var(--closer-surface-soft)", color: "var(--closer-ink)", fontSize: "0.88rem" }}
                />
              </div>
            </div>

            {/* System Prompt Customizer */}
            <div style={{ marginTop: "10px" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--closer-ink)", marginBottom: "4px" }}>
                System Prompt & Sales Guardrails
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--closer-line)", background: "var(--closer-surface-soft)", color: "var(--closer-ink)", fontSize: "0.85rem", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={saving}
                className="sales-primary-button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                }}
              >
                {saving ? <RefreshCw className="animate-spin" size={16} /> : saveSuccess ? <Check size={16} /> : <Zap size={16} />}
                {saving ? "Saving…" : saveSuccess ? "Bot settings saved!" : "Save bot behavior"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* 2. KNOWLEDGE & TRAINING SUB-TAB */}
      {activeSubTab === "training" ? (
        <div style={{ display: "grid", gap: "20px" }}>
          {/* Document Upload Card */}
          <div
            style={{
              padding: "24px",
              background: "var(--closer-surface)",
              border: "1px solid var(--closer-line)",
              borderRadius: "14px",
              display: "grid",
              gap: "16px",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--closer-ink)", fontSize: "1rem" }}>
              Upload Training Knowledge
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--closer-muted)" }}>
              Text knowledge is stored by the central AI training API and used for pricing, delivery turnaround, and objection handling.
            </p>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "28px",
                borderRadius: "12px",
                border: "2px dashed var(--closer-orange-border)",
                background: "rgba(255, 107, 47, 0.04)",
                cursor: "pointer",
                gap: "8px",
              }}
            >
              <UploadCloud size={32} color="var(--closer-orange)" />
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--closer-ink)" }}>
                {uploadingDoc ? "Processing & Indexing Document…" : "Click or Drag & Drop a text playbook"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--closer-muted)" }}>
                Supports .txt, .csv, .md, and .json. PDF/DOCX parsing will be added through the backend contract.
              </div>
              <input
                type="file"
                accept=".txt,.csv,.md,.json"
                onChange={handleFileUpload}
                disabled={uploadingDoc}
                style={{ display: "none" }}
              />
            </label>

            {/* Direct Text Knowledge Entry */}
            <div style={{ marginTop: "10px", padding: "16px", background: "var(--closer-surface-soft)", borderRadius: "10px", border: "1px solid var(--closer-line)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--closer-ink)", marginBottom: "8px" }}>
                Or Add Custom Training Guidelines / FAQ
              </div>
              <input
                type="text"
                placeholder="Topic / Title (e.g. Refund Policy or Agency Retainer Rules)"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--closer-line)", background: "var(--closer-surface)", color: "var(--closer-ink)", fontSize: "0.85rem", marginBottom: "8px" }}
              />
              <textarea
                rows={2}
                placeholder="Write specific instructions or answers you want the AI to remember..."
                value={customSnippet}
                onChange={(e) => setCustomSnippet(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--closer-line)", background: "var(--closer-surface)", color: "var(--closer-ink)", fontSize: "0.85rem", resize: "vertical", marginBottom: "8px" }}
              />
              <button
                type="button"
                onClick={handleAddTextKnowledge}
                disabled={uploadingDoc || !customTitle.trim()}
                className="sales-primary-button"
                style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
              >
                Save Knowledge Guideline
              </button>
            </div>
          </div>

          {/* List of Indexed Training Documents */}
          <div
            style={{
              padding: "20px 24px",
              background: "var(--closer-surface)",
              border: "1px solid var(--closer-line)",
              borderRadius: "14px",
              display: "grid",
              gap: "12px",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--closer-ink)", fontSize: "0.95rem" }}>
              Indexed Documents & Sources ({config?.documents?.length || 0})
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              {config?.documents?.map((doc: any) => (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "var(--closer-surface-soft)",
                    border: "1px solid var(--closer-line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <FileText size={20} color="var(--closer-orange)" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--closer-ink)" }}>
                        {doc.fileName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--closer-muted)" }}>
                        {Math.round((doc.fileSize || 1024) / 1024)} KB · {doc.status || "Indexed"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "#10b981",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      READY
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.id)}
                      title="Delete from training"
                      style={{ background: "transparent", border: 0, color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* 3. TEST CHAT & CORRECTION SUB-TAB */}
      {activeSubTab === "playground" ? (
        <div style={{ display: "grid", gap: "20px" }}>
          <div
            style={{
              padding: "20px 24px",
              background: "var(--closer-surface)",
              border: "1px solid var(--closer-line)",
              borderRadius: "14px",
              display: "grid",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "var(--closer-ink)", fontSize: "1rem" }}>
                AI Chat Simulation & Correction
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--closer-muted)" }}>
                Test how the AI answers customer questions. If the bot gives an inaccurate answer, click <strong>&quot;Correct AI&quot;</strong> to teach it the ideal answer.
              </p>
            </div>

            {/* Chat Messages Frame */}
            <div
              style={{
                height: "360px",
                overflowY: "auto",
                border: "1px solid var(--closer-line)",
                borderRadius: "12px",
                background: "var(--closer-surface-soft)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {messages.map((m, idx) => {
                const isUser = m.role === "user";
                const prevUserQuery = !isUser && idx > 0 && messages[idx - 1].role === "user" ? messages[idx - 1].content : "";

                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                      display: "grid",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                        background: isUser ? "var(--closer-orange)" : "var(--closer-surface)",
                        color: isUser ? "#FFF" : "var(--closer-ink)",
                        border: isUser ? "0" : "1px solid var(--closer-line)",
                        fontSize: "0.88rem",
                        lineHeight: "1.4",
                      }}
                    >
                      {m.content}
                    </div>

                    {!isUser && idx !== 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCorrectingMessage({ query: prevUserQuery || "Question", answer: m.content });
                          setCorrectionText("");
                        }}
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--closer-orange)",
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          padding: "2px 6px",
                          textAlign: "left",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Edit3 size={11} /> Correct AI Response
                      </button>
                    ) : null}
                  </div>
                );
              })}

              {isThinking ? (
                <div style={{ alignSelf: "flex-start", color: "var(--closer-muted)", fontSize: "0.82rem", fontStyle: "italic" }}>
                  AI bot is thinking…
                </div>
              ) : null}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendPlayground} style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Ask a question as a prospect (e.g. How much for 10 reels? Can I pay weekly?)..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--closer-line)",
                  background: "var(--closer-surface-soft)",
                  color: "var(--closer-ink)",
                  fontSize: "0.88rem",
                }}
              />
              <button
                type="submit"
                disabled={isThinking || !inputPrompt.trim()}
                className="sales-primary-button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Send size={16} /> Send
              </button>
            </form>
          </div>

          {/* Correction Dialog / Box */}
          {correctingMessage ? (
            <div
              style={{
                padding: "20px 24px",
                background: "var(--closer-surface)",
                border: "1px solid var(--closer-orange-border)",
                borderRadius: "14px",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: "var(--closer-orange)", fontSize: "0.95rem" }}>
                  Teach AI: Submit Ideal Correction
                </div>
                <button
                  type="button"
                  onClick={() => setCorrectingMessage(null)}
                  style={{ background: "transparent", border: 0, color: "var(--closer-muted)", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: "0.82rem", color: "var(--closer-muted)" }}>
                <strong>Client Asked:</strong> {correctingMessage.query}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--closer-muted)" }}>
                <strong>Bot Replied:</strong> {correctingMessage.answer}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--closer-ink)", marginBottom: "4px" }}>
                  How should the bot have answered? (Your Correction)
                </label>
                <textarea
                  rows={3}
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="Provide the exact playbook response you want the AI to memorize..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--closer-line)",
                    background: "var(--closer-surface-soft)",
                    color: "var(--closer-ink)",
                    fontSize: "0.85rem",
                    resize: "vertical",
                  }}
                />
              </div>

              {correctionSuccess ? (
                <div style={{ color: "#10b981", fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
                  <CheckCircle2 size={14} /> Correction saved and trained into AI memory!
                </div>
              ) : null}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setCorrectingMessage(null)}
                  style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--closer-line)", background: "transparent", color: "var(--closer-muted)", fontSize: "0.82rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCorrection}
                  disabled={!correctionText.trim()}
                  className="sales-primary-button"
                  style={{ padding: "6px 16px", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Save Correction
                </button>
              </div>
            </div>
          ) : null}

          {/* List of Trained Corrections */}
          {config?.corrections?.length > 0 ? (
            <div
              style={{
                padding: "20px 24px",
                background: "var(--closer-surface)",
                border: "1px solid var(--closer-line)",
                borderRadius: "14px",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--closer-ink)", fontSize: "0.95rem" }}>
                Trained Human Corrections ({config.corrections.length})
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                {config.corrections.map((c: any) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "var(--closer-surface-soft)",
                      border: "1px solid var(--closer-line)",
                      fontSize: "0.82rem",
                      display: "grid",
                      gap: "4px",
                    }}
                  >
                    <div style={{ color: "var(--closer-ink)", fontWeight: 600 }}>
                      Q: &ldquo;{c.userQuery}&rdquo;
                    </div>
                    <div style={{ color: "var(--closer-orange)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Check size={13} /> Trained Answer: &ldquo;{c.correction}&rdquo;
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
