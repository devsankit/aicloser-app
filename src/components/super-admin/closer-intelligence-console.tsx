"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Flame,
  GraduationCap,
  Headphones,
  Lightbulb,
  Mic,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

import type {
  CallAuditEntry,
  ProductFeedbackItem,
  VisualProofItem,
  FeatureTruthItem,
} from "@/lib/gigxomi/closer-intelligence-store";

export interface CloserIntelligenceData {
  calls: CallAuditEntry[];
  productFeedback: ProductFeedbackItem[];
  visualProofs: VisualProofItem[];
  featureTruths: FeatureTruthItem[];
  funnel: {
    totalLeads: number;
    contacted: number;
    qualified: number;
    trialsActive: number;
    won: number;
    contactRate: number;
    qualificationRate: number;
    trialConversionRate: number;
  };
  objectionTrends: Array<{ label: string; percent: number; count: number; recoveryRate: string }>;
  staffLeaderboard: Array<{ agentId: string; name: string; callsCount: number; avgScore: number; trialsClosed: number }>;
}

export function CloserIntelligenceConsole({
  initialData,
  onSwitchToLegacyTab,
}: {
  initialData: CloserIntelligenceData;
  onSwitchToLegacyTab?: () => void;
}) {
  const [data, setData] = useState<CloserIntelligenceData>(initialData);
  const [activeTab, setActiveTab] = useState<"calls" | "feedback" | "proofs" | "funnel">("calls");
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [auditingCallId, setAuditingCallId] = useState<string | null>(null);
  const [feedbackFilter, setFeedbackFilter] = useState<string>("ALL");
  const [showAddFeedbackModal, setShowAddFeedbackModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"FEATURE_REQUEST" | "BUG_REPORT" | "UX_FRICTION">("FEATURE_REQUEST");
  const [newSeverity, setNewSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [newQuote, setNewQuote] = useState("");

  async function reloadIntelligence() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/super-admin/intelligence");
      const json = await res.json();
      if (json?.ok && json.snapshot) {
        setData(json.snapshot);
        setStatusMessage("Intelligence data synchronized.");
      }
    } catch {
      setStatusMessage("Failed to sync intelligence data.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleAuditCall(callId: string) {
    setAuditingCallId(callId);
    setStatusMessage("Running AI audio transcription and sales playbook audit...");
    try {
      const res = await fetch("/api/super-admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "audit-call", callId }),
      });
      const json = await res.json();
      if (json?.ok && json.audit) {
        setData((prev) => ({
          ...prev,
          calls: prev.calls.map((c) => (c.callId === callId ? json.audit : c)),
        }));
        setExpandedCallId(callId);
        setStatusMessage("AI audit completed successfully.");
      } else {
        setStatusMessage(json?.error || "AI audit failed.");
      }
    } catch {
      setStatusMessage("Call audit request failed.");
    } finally {
      setAuditingCallId(null);
    }
  }

  async function handleUpdateFeedbackStatus(id: string, nextStatus: string) {
    try {
      const res = await fetch("/api/super-admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-feedback-status", id, status: nextStatus }),
      });
      const json = await res.json();
      if (json?.ok && json.item) {
        setData((prev) => ({
          ...prev,
          productFeedback: prev.productFeedback.map((item) => (item.id === id ? json.item : item)),
        }));
        setStatusMessage(`Status updated to ${nextStatus}.`);
      }
    } catch {
      setStatusMessage("Status update failed.");
    }
  }

  async function handleCreateFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch("/api/super-admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-feedback-item",
          title: newTitle,
          description: newDesc,
          type: newType,
          severity: newSeverity,
          customerQuote: newQuote,
        }),
      });
      const json = await res.json();
      if (json?.ok && json.item) {
        setData((prev) => ({
          ...prev,
          productFeedback: [json.item, ...prev.productFeedback],
        }));
        setShowAddFeedbackModal(false);
        setNewTitle("");
        setNewDesc("");
        setNewQuote("");
        setStatusMessage("Feedback / Bug item added to backlog.");
      }
    } catch {
      setStatusMessage("Failed to add feedback item.");
    }
  }

  async function handleToggleProof(id: string) {
    try {
      const res = await fetch("/api/super-admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-proof-status", id }),
      });
      const json = await res.json();
      if (json?.ok && json.proof) {
        setData((prev) => ({
          ...prev,
          visualProofs: prev.visualProofs.map((p) => (p.id === id ? json.proof : p)),
        }));
      }
    } catch {
      setStatusMessage("Failed to toggle proof status.");
    }
  }

  const filteredFeedback = data.productFeedback.filter((item) => {
    if (feedbackFilter === "ALL") return true;
    return item.type === feedbackFilter;
  });

  const avgCallScore = data.calls.length
    ? Math.round(data.calls.reduce((sum, c) => sum + c.qualityScore, 0) / data.calls.length)
    : 80;

  return (
    <div style={{ marginTop: "1rem" }}>
      {/* Top Intelligence Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          padding: "0.5rem",
          background: "rgba(10, 13, 11, 0.8)",
          borderRadius: "12px",
          border: "1px solid rgba(215, 255, 47, 0.2)",
          marginBottom: "1.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("calls")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.1rem",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            background: activeTab === "calls" ? "#D7FF2F" : "transparent",
            color: activeTab === "calls" ? "#0A0D0B" : "#A1A1AA",
            transition: "all 0.15s ease",
          }}
        >
          <Headphones size={16} /> Call Intelligence & Coaching
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("feedback")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.1rem",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            background: activeTab === "feedback" ? "#D7FF2F" : "transparent",
            color: activeTab === "feedback" ? "#0A0D0B" : "#A1A1AA",
            transition: "all 0.15s ease",
          }}
        >
          <Lightbulb size={16} /> Product Feedback & Bug Hub ({data.productFeedback.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("proofs")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.1rem",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            background: activeTab === "proofs" ? "#D7FF2F" : "transparent",
            color: activeTab === "proofs" ? "#0A0D0B" : "#A1A1AA",
            transition: "all 0.15s ease",
          }}
        >
          <Shield size={16} /> Knowledge Base & Visual Proofs ({data.visualProofs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("funnel")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.1rem",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            background: activeTab === "funnel" ? "#D7FF2F" : "transparent",
            color: activeTab === "funnel" ? "#0A0D0B" : "#A1A1AA",
            transition: "all 0.15s ease",
          }}
        >
          <TrendingUp size={16} /> Funnel & Objection Analytics
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {statusMessage && (
            <span style={{ fontSize: "0.8rem", color: "#D7FF2F", marginRight: "0.5rem" }}>{statusMessage}</span>
          )}
          <button
            type="button"
            onClick={reloadIntelligence}
            disabled={isRefreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              padding: "0.4rem 0.7rem",
              color: "#E4E4E7",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} /> Sync
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CALL INTELLIGENCE & COACHING */}
      {/* ========================================================================= */}
      {activeTab === "calls" && (
        <div>
          {/* Quick Metrics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                background: "#121714",
                padding: "1rem 1.25rem",
                borderRadius: "10px",
                border: "1px solid rgba(215, 255, 47, 0.15)",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#A1A1AA", marginBottom: "0.3rem" }}>
                Avg Closer Call Score
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#D7FF2F" }}>
                {avgCallScore} <span style={{ fontSize: "1rem", color: "#A1A1AA" }}>/ 100</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#71717A", marginTop: "0.2rem" }}>
                Target: 85+ across all sales reps
              </div>
            </div>

            <div
              style={{
                background: "#121714",
                padding: "1rem 1.25rem",
                borderRadius: "10px",
                border: "1px solid rgba(215, 255, 47, 0.15)",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#A1A1AA", marginBottom: "0.3rem" }}>
                Calls Audited Today
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#FAFAFA" }}>
                {data.calls.length}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#71717A", marginTop: "0.2rem" }}>
                Audio recorded via Closer Android app
              </div>
            </div>

            <div
              style={{
                background: "#121714",
                padding: "1rem 1.25rem",
                borderRadius: "10px",
                border: "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#F87171", marginBottom: "0.3rem" }}>
                Top Staff Mistake Detected
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#FAFAFA" }}>
                Pitched ₹2,000 before privacy proof
              </div>
              <div style={{ fontSize: "0.75rem", color: "#FCA5A5", marginTop: "0.2rem" }}>
                Occurred in 34% of recent calls
              </div>
            </div>

            <div
              style={{
                background: "#121714",
                padding: "1rem 1.25rem",
                borderRadius: "10px",
                border: "1px solid rgba(34, 197, 94, 0.2)",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#4ADE80", marginBottom: "0.3rem" }}>
                Trial Closing Rate on Calls
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#4ADE80" }}>
                58%
              </div>
              <div style={{ fontSize: "0.75rem", color: "#71717A", marginTop: "0.2rem" }}>
                When privacy proof was shown
              </div>
            </div>
          </div>

          {/* Calls List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {data.calls.map((call) => {
              const isExpanded = expandedCallId === call.callId;
              const isAuditing = auditingCallId === call.callId;
              const isAudited = call.qualityScore > 0;
              const isGoodScore = call.qualityScore >= 80;
              const isMidScore = call.qualityScore >= 65 && call.qualityScore < 80;

              return (
                <div
                  key={call.callId}
                  style={{
                    background: "#0D110E",
                    borderRadius: "10px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "1rem 1.25rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: !isAudited
                            ? "rgba(161, 161, 170, 0.12)"
                            : isGoodScore
                            ? "rgba(34, 197, 94, 0.15)"
                            : isMidScore
                            ? "rgba(234, 179, 8, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: !isAudited ? "#A1A1AA" : isGoodScore ? "#4ADE80" : isMidScore ? "#FACC15" : "#F87171",
                          fontWeight: 700,
                          fontSize: isAudited ? "0.95rem" : "0.68rem",
                          border: !isAudited ? "1px dashed rgba(255, 255, 255, 0.2)" : "none",
                        }}
                      >
                        {isAudited ? call.qualityScore : "Pending"}
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, color: "#F4F4F5", fontSize: "1rem" }}>
                          {call.customerName || "Video Agency Lead"} •{" "}
                          <span style={{ color: "#A1A1AA", fontSize: "0.85rem", fontWeight: 400 }}>
                            {call.phoneNumber}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#71717A", marginTop: "0.15rem" }}>
                          Closer: <strong style={{ color: "#E4E4E7" }}>{call.agentName}</strong> • Duration:{" "}
                          {call.durationSeconds}s • {new Date(call.startedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      {call.recordingStatus === "UPLOADED" && (
                        <a
                          href={`/api/sales/mobile/calls/${call.callId}/recording`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            background: "rgba(215, 255, 47, 0.1)",
                            border: "1px solid rgba(215, 255, 47, 0.3)",
                            color: "#D7FF2F",
                            borderRadius: "6px",
                            padding: "0.4rem 0.8rem",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          <Play size={12} /> Play Audio
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleAuditCall(call.callId)}
                        disabled={isAuditing}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          background: "#D7FF2F",
                          border: "none",
                          color: "#0A0D0B",
                          borderRadius: "6px",
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Bot size={13} /> {isAuditing ? "Auditing..." : "Audit with AI"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedCallId(isExpanded ? null : call.callId)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#A1A1AA",
                          borderRadius: "6px",
                          padding: "0.4rem 0.6rem",
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Call Details */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: "1rem",
                        paddingTop: "1rem",
                        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1fr",
                        gap: "1.25rem",
                      }}
                    >
                      {/* Left: Transcript */}
                      <div
                        style={{
                          background: "#080B09",
                          padding: "0.85rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            color: "#A1A1AA",
                            marginBottom: "0.5rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                          }}
                        >
                          <FileText size={14} /> Groq Whisper Transcript (Hinglish)
                        </div>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#D4D4D8",
                            whiteSpace: "pre-wrap",
                            lineHeight: "1.5",
                            maxHeight: "220px",
                            overflowY: "auto",
                          }}
                        >
                          {call.transcript}
                        </div>
                      </div>

                      {/* Right: AI Coaching & Mistakes Box */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {/* Mistakes detected */}
                        {call.mistakes.length > 0 && (
                          <div
                            style={{
                              background: "rgba(239, 68, 68, 0.08)",
                              border: "1px solid rgba(239, 68, 68, 0.25)",
                              borderRadius: "8px",
                              padding: "0.75rem",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                color: "#F87171",
                                marginBottom: "0.35rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                              }}
                            >
                              <AlertTriangle size={14} /> Staff Mistakes Detected
                            </div>
                            {call.mistakes.map((m, idx) => (
                              <div
                                key={idx}
                                style={{ fontSize: "0.8rem", color: "#FCA5A5", marginTop: "0.2rem" }}
                              >
                                • {m}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Positive actions */}
                        {call.positiveNotes.length > 0 && (
                          <div
                            style={{
                              background: "rgba(34, 197, 94, 0.08)",
                              border: "1px solid rgba(34, 197, 94, 0.25)",
                              borderRadius: "8px",
                              padding: "0.75rem",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                color: "#4ADE80",
                                marginBottom: "0.35rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                              }}
                            >
                              <CheckCircle2 size={14} /> What Staff Did Well
                            </div>
                            {call.positiveNotes.map((p, idx) => (
                              <div
                                key={idx}
                                style={{ fontSize: "0.8rem", color: "#86EFAC", marginTop: "0.2rem" }}
                              >
                                • {p}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Coaching tip */}
                        <div
                          style={{
                            background: "rgba(215, 255, 47, 0.08)",
                            border: "1px solid rgba(215, 255, 47, 0.25)",
                            borderRadius: "8px",
                            padding: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              color: "#D7FF2F",
                              marginBottom: "0.35rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.3rem",
                            }}
                          >
                            <Sparkles size={14} /> Actionable Coaching for Next Call
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#E4E4E7", lineHeight: "1.4" }}>
                            {call.coachingTip}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PRODUCT FEEDBACK & BUG HUB ("KYA NEW FEATURES UPDATE KARWANA HAI") */}
      {/* ========================================================================= */}
      {activeTab === "feedback" && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            {/* Filters */}
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {["ALL", "FEATURE_REQUEST", "BUG_REPORT", "UX_FRICTION", "OBJECTION_TREND"].map(
                (filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setFeedbackFilter(filter)}
                    style={{
                      background: feedbackFilter === filter ? "#D7FF2F" : "#181D1A",
                      color: feedbackFilter === filter ? "#0A0D0B" : "#A1A1AA",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "6px",
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {filter.replace("_", " ")}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAddFeedbackModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#D7FF2F",
                color: "#0A0D0B",
                border: "none",
                borderRadius: "6px",
                padding: "0.45rem 0.9rem",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <Plus size={15} /> Add Feature / Bug Item
            </button>
          </div>

          {/* Add Feedback Modal */}
          {showAddFeedbackModal && (
            <div
              style={{
                background: "#121714",
                border: "1px solid rgba(215, 255, 47, 0.3)",
                borderRadius: "10px",
                padding: "1.25rem",
                marginBottom: "1.5rem",
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.75rem" }}>
                Add New Feature Request or Bug to Roadmap
              </h3>
              <form onSubmit={handleCreateFeedback}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "#A1A1AA", display: "block", marginBottom: "0.25rem" }}>
                      Title
                    </label>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Multi-Account Instagram support"
                      required
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        background: "#080B09",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#FFF",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "#A1A1AA", display: "block", marginBottom: "0.25rem" }}>
                      Type
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as never)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        background: "#080B09",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#FFF",
                        fontSize: "0.85rem",
                      }}
                    >
                      <option value="FEATURE_REQUEST">Feature Request</option>
                      <option value="BUG_REPORT">Bug Report</option>
                      <option value="UX_FRICTION">UX Friction</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "#A1A1AA", display: "block", marginBottom: "0.25rem" }}>
                    Description & Expected Behavior
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Describe how this feature should work or how the bug occurs..."
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "6px",
                      background: "#080B09",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#FFF",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "#A1A1AA", display: "block", marginBottom: "0.25rem" }}>
                    Customer Quote / Feedback Context
                  </label>
                  <input
                    value={newQuote}
                    onChange={(e) => setNewQuote(e.target.value)}
                    placeholder="e.g. 'Mere 2 brand pages hain Instagram pe...'"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "6px",
                      background: "#080B09",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#FFF",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowAddFeedbackModal(false)}
                    style={{
                      padding: "0.4rem 0.8rem",
                      background: "transparent",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#A1A1AA",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: "0.4rem 0.9rem",
                      background: "#D7FF2F",
                      color: "#0A0D0B",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Save to Roadmap
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Feedback Cards Grid */}
          {filteredFeedback.length === 0 ? (
            <div
              style={{
                background: "#0D110E",
                border: "1px dashed rgba(255, 255, 255, 0.12)",
                borderRadius: "10px",
                padding: "2.5rem 1.5rem",
                textAlign: "center",
              }}
            >
              <Lightbulb size={32} style={{ color: "#D7FF2F", margin: "0 auto 0.75rem", opacity: 0.8 }} />
              <div style={{ fontWeight: 600, color: "#F4F4F5", fontSize: "0.95rem", marginBottom: "0.4rem" }}>
                No Customer Requirements or Bugs Logged Yet
              </div>
              <p style={{ fontSize: "0.82rem", color: "#A1A1AA", maxWidth: "450px", margin: "0 auto 1rem", lineHeight: "1.4" }}>
                This is your real product backlog. As sales calls are audited by AI or customer feedback is received, new feature requests, bugs, and friction points will appear here.
              </p>
              <button
                type="button"
                onClick={() => setShowAddFeedbackModal(true)}
                style={{
                  background: "#D7FF2F",
                  color: "#0A0D0B",
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.4rem 0.9rem",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Add Real Feature / Bug
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
              {filteredFeedback.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "#0D110E",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "1.1rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        background:
                          item.type === "BUG_REPORT"
                            ? "rgba(239, 68, 68, 0.2)"
                            : item.type === "FEATURE_REQUEST"
                            ? "rgba(215, 255, 47, 0.15)"
                            : "rgba(59, 130, 246, 0.15)",
                        color:
                          item.type === "BUG_REPORT"
                            ? "#F87171"
                            : item.type === "FEATURE_REQUEST"
                            ? "#D7FF2F"
                            : "#60A5FA",
                      }}
                    >
                      {item.type.replace("_", " ")}
                    </span>

                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#A1A1AA",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <Flame size={12} color="#D7FF2F" /> {item.frequencyCount} requests
                    </span>
                  </div>

                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F4F4F5", marginBottom: "0.4rem" }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: "0.82rem", color: "#A1A1AA", lineHeight: "1.4", marginBottom: "0.6rem" }}>
                    {item.description}
                  </p>

                  {item.customerQuote && (
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontStyle: "italic",
                        color: "#D4D4D8",
                        background: "rgba(255, 255, 255, 0.03)",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        borderLeft: "2px solid #D7FF2F",
                        marginBottom: "0.75rem",
                      }}
                    >
                      &quot;{item.customerQuote}&quot;
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#71717A" }}>
                    Status:
                  </span>
                  <select
                    value={item.status}
                    onChange={(e) => handleUpdateFeedbackStatus(item.id, e.target.value)}
                    style={{
                      background: "#181D1A",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color:
                        item.status === "RESOLVED"
                          ? "#4ADE80"
                          : item.status === "IN_DEV"
                          ? "#60A5FA"
                          : item.status === "PLANNED"
                          ? "#D7FF2F"
                          : "#A1A1AA",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      borderRadius: "4px",
                      padding: "0.25rem 0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <option value="OPEN">Open Backlog</option>
                    <option value="PLANNED">Planned for Dev</option>
                    <option value="IN_DEV">In Development</option>
                    <option value="RESOLVED">Resolved / Live</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: KNOWLEDGE BASE & VISUAL PROOFS */}
      {/* ========================================================================= */}
      {activeTab === "proofs" && (
        <div>
          {/* Section: 5 Core Visual Proofs */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.4rem" }}>
              5 Core Visual Proofs (Sanitized Real Screenshots)
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#A1A1AA", marginBottom: "1rem" }}>
              These verified product screenshots are hosted publicly and automatically shared by the WhatsApp Sales Bot
              whenever an agency lead expresses specific fears (e.g. client poaching or revision chaos).
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              {data.visualProofs.map((proof) => (
                <div
                  key={proof.id}
                  style={{
                    background: "#0D110E",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "140px",
                      background: "rgba(215, 255, 47, 0.05)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      position: "relative",
                    }}
                  >
                    <Shield size={32} color="#D7FF2F" />
                    <span style={{ fontSize: "0.75rem", color: "#A1A1AA", marginTop: "0.4rem" }}>
                      Verified at {proof.verifiedTimestamp}
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        fontSize: "0.68rem",
                        padding: "0.2rem 0.45rem",
                        borderRadius: "4px",
                        background: proof.isActive ? "rgba(34, 197, 94, 0.2)" : "rgba(113, 113, 122, 0.2)",
                        color: proof.isActive ? "#4ADE80" : "#A1A1AA",
                        fontWeight: 700,
                      }}
                    >
                      {proof.isActive ? "LIVE & SYNCED" : "DISABLED"}
                    </span>
                  </div>

                  <div style={{ padding: "1rem" }}>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.3rem" }}>
                      {proof.title}
                    </h4>
                    <p style={{ fontSize: "0.8rem", color: "#A1A1AA", lineHeight: "1.4", marginBottom: "0.8rem" }}>
                      {proof.description}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "0.6rem",
                        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <span style={{ fontSize: "0.75rem", color: "#71717A" }}>
                        WhatsApp Auto-Send:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleProof(proof.id)}
                        style={{
                          background: proof.isActive ? "rgba(215, 255, 47, 0.15)" : "#27272A",
                          border: proof.isActive ? "1px solid #D7FF2F" : "1px solid #52525B",
                          color: proof.isActive ? "#D7FF2F" : "#A1A1AA",
                          borderRadius: "4px",
                          padding: "0.25rem 0.6rem",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {proof.isActive ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Product Truth & AI Rules Switchboard */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.4rem" }}>
              Live Product Truth & AI Hallucination Guardrails
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#A1A1AA", marginBottom: "1rem" }}>
              These rules directly ground the WhatsApp sales bot and consultative agents. AI will strictly reject any
              hallucinated feature marked as banned.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.featureTruths.map((ft) => (
                <div
                  key={ft.id}
                  style={{
                    background: "#0D110E",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    padding: "0.85rem 1.1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong style={{ color: "#F4F4F5", fontSize: "0.9rem" }}>{ft.featureName}</strong>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          background:
                            ft.status === "LIVE_IN_PRODUCTION"
                              ? "rgba(34, 197, 94, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                          color: ft.status === "LIVE_IN_PRODUCTION" ? "#4ADE80" : "#F87171",
                          fontWeight: 700,
                        }}
                      >
                        {ft.status.replace("_", " ")}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#A1A1AA", marginTop: "0.2rem" }}>
                      Customer Explanation: <span style={{ color: "#E4E4E7" }}>{ft.customerExplanation}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "#71717A", maxWidth: "320px", textAlign: "right" }}>
                    Rule: {ft.ruleForAi}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CONVERSION FUNNEL & OBJECTION ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === "funnel" && (
        <div>
          {/* Funnel Progress Bars */}
          <div
            style={{
              background: "#0D110E",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.3rem" }}>
              Agency Acquisition Funnel (Live Stage Board)
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#A1A1AA", marginBottom: "1.25rem" }}>
              Tracking lead progression from initial WhatsApp inbound to ₹2,000/month Agency activation.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
              <div style={{ background: "#121714", padding: "0.85rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#A1A1AA" }}>1. Inbound Leads</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#FAFAFA" }}>{data.funnel.totalLeads}</div>
                <div style={{ fontSize: "0.7rem", color: "#71717A" }}>100% Inflow</div>
              </div>

              <div style={{ background: "#121714", padding: "0.85rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#A1A1AA" }}>2. Contacted</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#FAFAFA" }}>{data.funnel.contacted}</div>
                <div style={{ fontSize: "0.7rem", color: "#D7FF2F" }}>{data.funnel.contactRate}% reached</div>
              </div>

              <div style={{ background: "#121714", padding: "0.85rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#A1A1AA" }}>3. Qualified</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#FAFAFA" }}>{data.funnel.qualified}</div>
                <div style={{ fontSize: "0.7rem", color: "#D7FF2F" }}>{data.funnel.qualificationRate}% team owners</div>
              </div>

              <div style={{ background: "#121714", padding: "0.85rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#A1A1AA" }}>4. 7-Day Trials</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#4ADE80" }}>{data.funnel.trialsActive}</div>
                <div style={{ fontSize: "0.7rem", color: "#4ADE80" }}>{data.funnel.trialConversionRate}% started</div>
              </div>

              <div style={{ background: "#121714", padding: "0.85rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#A1A1AA" }}>5. Paid Agency</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#D7FF2F" }}>{data.funnel.won}</div>
                <div style={{ fontSize: "0.7rem", color: "#D7FF2F" }}>₹2,000/mo MRR</div>
              </div>
            </div>
          </div>

          {/* Objection Heatmap & Staff Leaderboard Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            {/* Objection Heatmap */}
            <div
              style={{
                background: "#0D110E",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "1.25rem",
              }}
            >
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.3rem" }}>
                Top Drop-Off Objections Heatmap
              </h4>
              <p style={{ fontSize: "0.8rem", color: "#A1A1AA", marginBottom: "1rem" }}>
                What questions or fears make video editors hesitate the most:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {data.objectionTrends.map((trend) => (
                  <div key={trend.label}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.82rem",
                        marginBottom: "0.3rem",
                      }}
                    >
                      <span style={{ color: "#E4E4E7", fontWeight: 600 }}>{trend.label}</span>
                      <span style={{ color: "#D7FF2F", fontWeight: 700 }}>
                        {trend.percent}% ({trend.count})
                      </span>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        background: "rgba(255, 255, 255, 0.08)",
                        borderRadius: "3px",
                        overflow: "hidden",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <div
                        style={{
                          width: `${trend.percent}%`,
                          height: "100%",
                          background: trend.percent >= 40 ? "#EF4444" : "#D7FF2F",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#71717A" }}>
                      Recovery: <strong style={{ color: "#4ADE80" }}>{trend.recoveryRate}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Leaderboard */}
            <div
              style={{
                background: "#0D110E",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "1.25rem",
              }}
            >
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.3rem" }}>
                Closer Staff Performance Leaderboard
              </h4>
              <p style={{ fontSize: "0.8rem", color: "#A1A1AA", marginBottom: "1rem" }}>
                Call quality audits combined with trial signup conversions:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {data.staffLeaderboard.map((staff, idx) => (
                  <div
                    key={staff.agentId}
                    style={{
                      background: "#121714",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          background: idx === 0 ? "#D7FF2F" : "rgba(255, 255, 255, 0.1)",
                          color: idx === 0 ? "#0A0D0B" : "#FFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, color: "#F4F4F5", fontSize: "0.88rem" }}>
                          {staff.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#71717A" }}>
                          {staff.callsCount} calls logged
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#D7FF2F" }}>
                        Score: {staff.avgScore}/100
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#4ADE80" }}>
                        {staff.trialsClosed} trials closed
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
