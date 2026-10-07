"use client";

import { useEffect, useState } from "react";
import { Sparkles, MessageCircle, Copy, Check, ChevronDown, ChevronUp, Zap, HelpCircle } from "lucide-react";
import type { LeadIqProfile } from "@/lib/gigxomi/lead-iq-store";

type Props = {
  leadId: string;
};

export function LeadIqCard({ leadId }: Props) {
  const [profile, setProfile] = useState<LeadIqProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [expandedObjection, setExpandedObjection] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sales/leads/${leadId}/iq`);
        const data = await res.json();
        if (mounted && data.ok) {
          setProfile(data.profile);
        }
      } catch (err) {
        console.error("Failed to load Lead-IQ", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [leadId]);

  const copyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  if (loading) {
    return (
      <div style={{ padding: "0.75rem", fontSize: "0.82rem", opacity: 0.7 }}>
        Analyzing lead signals with Lead-IQ...
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1rem",
        borderRadius: "10px",
        background: "rgba(255, 107, 47, 0.04)",
        border: "1px solid rgba(255, 107, 47, 0.2)",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      {/* Header and Intent Score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <Sparkles size={16} color="var(--closer-orange, #ff6b2f)" />
          <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
            Lead-IQ Next-Best-Action
          </h4>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Intent Score:</span>
          <span
            style={{
              padding: "0.15rem 0.45rem",
              borderRadius: "4px",
              background:
                profile.intentScore > 75
                  ? "rgba(16, 185, 129, 0.2)"
                  : profile.intentScore > 50
                  ? "rgba(245, 158, 11, 0.2)"
                  : "rgba(100, 116, 139, 0.2)",
              color:
                profile.intentScore > 75
                  ? "#10b981"
                  : profile.intentScore > 50
                  ? "#f59e0b"
                  : "#94a3b8",
              fontSize: "0.76rem",
              fontWeight: 700,
            }}
          >
            {profile.intentScore}/100 ({profile.urgencyLevel})
          </span>
        </div>
      </div>

      {/* Recommended Action */}
      <div
        style={{
          padding: "0.55rem 0.75rem",
          borderRadius: "6px",
          background: "rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          fontSize: "0.8rem",
          color: "#cbd5e1",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <Zap size={14} color="var(--closer-orange, #ff6b2f)" />
        <span>Recommended Action: <strong style={{ color: "#fff" }}>{profile.recommendedAction}</strong></span>
      </div>

      {/* Script & WhatsApp Tabs */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Tailored Call Script */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.76rem", color: "#94a3b8", fontWeight: 600 }}>Tailored Opening Pitch:</span>
            <button
              type="button"
              onClick={() => copyText(profile.tailoredScript, "script")}
              style={{
                background: "none",
                border: "none",
                color: "#ff8c42",
                fontSize: "0.72rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              {copiedType === "script" ? <Check size={12} /> : <Copy size={12} />}
              {copiedType === "script" ? "Copied" : "Copy Script"}
            </button>
          </div>
          <div
            style={{
              padding: "0.6rem",
              borderRadius: "6px",
              background: "rgba(0, 0, 0, 0.35)",
              fontSize: "0.78rem",
              lineHeight: 1.5,
              color: "#cbd5e1",
              borderLeft: "2px solid var(--closer-orange, #ff6b2f)",
            }}
          >
            {profile.tailoredScript}
          </div>
        </div>

        {/* WhatsApp Pitch Draft */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.76rem", color: "#94a3b8", fontWeight: 600 }}>WhatsApp Follow-Up Draft:</span>
            <button
              type="button"
              onClick={() => copyText(profile.whatsappPitchDraft, "wa")}
              style={{
                background: "none",
                border: "none",
                color: "#10b981",
                fontSize: "0.72rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              {copiedType === "wa" ? <Check size={12} /> : <MessageCircle size={12} />}
              {copiedType === "wa" ? "Copied" : "Copy WhatsApp Draft"}
            </button>
          </div>
          <div
            style={{
              padding: "0.6rem",
              borderRadius: "6px",
              background: "rgba(0, 0, 0, 0.35)",
              fontSize: "0.78rem",
              lineHeight: 1.5,
              color: "#cbd5e1",
              whiteSpace: "pre-line",
              borderLeft: "2px solid #10b981",
            }}
          >
            {profile.whatsappPitchDraft}
          </div>
        </div>
      </div>

      {/* Objections Accordion */}
      <div>
        <span style={{ fontSize: "0.76rem", color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "0.3rem" }}>
          <Zap size={12} color="var(--closer-orange, #ff6b2f)" /> Objection Response Matrix:
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {profile.objectionCards.map((obj, idx) => {
            const isExpanded = expandedObjection === idx;
            return (
              <div
                key={obj.objection}
                style={{
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedObjection(isExpanded ? null : idx)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    background: "none",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <span>"{obj.objection}"</span>
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {isExpanded && (
                  <div
                    style={{
                      padding: "0.5rem 0.65rem",
                      fontSize: "0.75rem",
                      lineHeight: 1.45,
                      color: "#94a3b8",
                      borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                      background: "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    <strong style={{ color: "#ff8c42" }}>Recommended Response: </strong>
                    {obj.counter}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
