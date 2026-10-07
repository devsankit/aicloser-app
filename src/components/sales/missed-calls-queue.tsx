"use client";

import { useEffect, useState } from "react";
import { PhoneMissed, PhoneCall, MessageCircle, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import type { MissedCallRecord } from "@/lib/gigxomi/missed-calls-store";

export function MissedCallsQueue() {
  const [calls, setCalls] = useState<MissedCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadCalls = async () => {
    try {
      const res = await fetch("/api/sales/missed-calls");
      const data = await res.json();
      if (data.ok) setCalls(data.calls || []);
    } catch (err) {
      console.error("Failed to load missed calls", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();
    const interval = setInterval(loadCalls, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const handleSendAck = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/sales/missed-calls/${id}/ack`, { method: "POST" });
      const data = await res.json();
      if (data.ok) await loadCalls();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/sales/missed-calls/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Callback completed via SIM dialer" }),
      });
      const data = await res.json();
      if (data.ok) await loadCalls();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCalls = calls.filter((c) => c.status === "PENDING");

  const getSlaStatus = (call: MissedCallRecord) => {
    const elapsedMinutes = Math.floor((Date.now() - new Date(call.missedAt).getTime()) / 60000);
    const remaining = call.slaMinutes - elapsedMinutes;
    if (remaining <= 0) {
      return {
        breached: true,
        text: `SLA Breached (${Math.abs(remaining)}m overdue)`,
        color: "#ef4444",
        bg: "rgba(239, 68, 68, 0.15)",
      };
    }
    return {
      breached: false,
      text: `SLA Active (${remaining}m left)`,
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.15)",
    };
  };

  const [ivrProvider, setIvrProvider] = useState("HYBRID_SIM_EXOTEL");
  const [autoCallbackEnabled, setAutoCallbackEnabled] = useState(true);
  const [dtmfMenuEnabled, setDtmfMenuEnabled] = useState(true);
  const [ivrSavedToast, setIvrSavedToast] = useState<string | null>(null);

  if (loading) {
    return <div style={{ padding: "1.5rem", fontSize: "0.85rem", opacity: 0.7 }}>Loading missed-call queue & IVR bridge...</div>;
  }

  return (
    <div
      style={{
        padding: "1.25rem",
        borderRadius: "12px",
        background: "var(--closer-surface, #ffffff)",
        border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "rgba(239, 68, 68, 0.16)",
              color: "#ef4444",
            }}
          >
            <PhoneMissed size={16} />
          </span>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
            IVR / VoIP Routing, Missed-Call Queue & Callback Automation ({pendingCalls.length})
          </h3>
        </div>

        <span style={{ fontSize: "0.75rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>
          Target SLA: 15-Minute Callback Response
        </span>
      </div>

      {/* TeleCRM Item #3: IVR / Cloud VoIP Bridge & Callback Automation Controls */}
      <div
        style={{
          padding: "0.95rem 1.1rem",
          borderRadius: "10px",
          background: "var(--closer-bg-soft, rgba(255, 107, 47, 0.04))",
          border: "1px solid var(--closer-line, rgba(255, 107, 47, 0.22))",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "0.85rem",
          alignItems: "center",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--closer-orange, #ff6b2f)", marginBottom: "4px" }}>
            Telephony & IVR Bridge Mode
          </label>
          <select
            value={ivrProvider}
            onChange={(e) => {
              setIvrProvider(e.target.value);
              setIvrSavedToast("IVR / VoIP routing provider updated.");
              setTimeout(() => setIvrSavedToast(null), 3000);
            }}
            style={{
              width: "100%",
              padding: "0.45rem 0.65rem",
              borderRadius: "8px",
              background: "var(--closer-surface, #ffffff)",
              border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.3))",
              color: "var(--closer-ink, #0f172a)",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            <option value="HYBRID_SIM_EXOTEL">Hybrid Android SIM + Cloud IVR Bridge</option>
            <option value="EXOTEL_CLOUD_IVR">Exotel Virtual Number & Multi-Level IVR</option>
            <option value="KNOWLARITY_MYOPERATOR">Knowlarity / MyOperator Cloud VoIP</option>
            <option value="TWILIO_SIP">Twilio Programmable Voice / SIP</option>
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.78rem", color: "var(--closer-ink, #0f172a)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={dtmfMenuEnabled}
            onChange={(e) => setDtmfMenuEnabled(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          <span>
            <strong>IVR DTMF Menu Routing</strong>
            <small style={{ display: "block", color: "var(--closer-muted, #64748b)", fontSize: "0.72rem" }}>
              1 → Sales Closer • 2 → Account Setup • 3 → Auto-Send WhatsApp Deck
            </small>
          </span>
        </label>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.78rem", color: "var(--closer-ink, #0f172a)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoCallbackEnabled}
            onChange={(e) => setAutoCallbackEnabled(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          <span>
            <strong>Automated Callback & WA Recovery</strong>
            <small style={{ display: "block", color: "var(--closer-muted, #64748b)", fontSize: "0.72rem" }}>
              Auto-trigger SIM callback queue + instant WhatsApp Ack on missed calls
            </small>
          </span>
        </label>
      </div>

      {ivrSavedToast ? (
        <div style={{ fontSize: "0.78rem", color: "#10b981", fontWeight: 600 }}>{ivrSavedToast}</div>
      ) : null}

      {pendingCalls.length === 0 ? (
        <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--closer-muted, #64748b)", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <CheckCircle size={15} color="#10b981" /> Zero pending missed calls. All incoming calls are answered or resolved!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {pendingCalls.map((call) => {
            const sla = getSlaStatus(call);
            return (
              <div
                key={call.id}
                style={{
                  padding: "0.9rem 1.1rem",
                  borderRadius: "8px",
                  background: "var(--closer-bg-soft, rgba(15, 23, 42, 0.04))",
                  border: sla.breached ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.92rem", color: "var(--closer-ink, #0f172a)" }}>{call.customerName}</strong>
                    <span style={{ fontSize: "0.82rem", color: "var(--closer-orange, #ff6b2f)", fontFamily: "monospace", fontWeight: 600 }}>
                      {call.callerNumber}
                    </span>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        background: sla.bg,
                        color: sla.color,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      {sla.text}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--closer-muted, #64748b)", marginTop: "0.2rem", display: "block" }}>
                    Missed {new Date(call.missedAt).toLocaleTimeString()} • {call.notes || "Inbound SIM / IVR call"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  {/* WhatsApp Ack */}
                  <button
                    type="button"
                    disabled={call.autoAckSent || actionLoading === call.id}
                    onClick={() => handleSendAck(call.id)}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: "6px",
                      background: call.autoAckSent ? "rgba(16, 185, 129, 0.14)" : "rgba(255, 107, 47, 0.12)",
                      border: call.autoAckSent ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(255, 107, 47, 0.35)",
                      color: call.autoAckSent ? "#059669" : "#ff6b2f",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: call.autoAckSent ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <MessageCircle size={13} />
                    {call.autoAckSent ? "WhatsApp Ack Sent" : "Send WhatsApp Ack"}
                  </button>

                  {/* 1-Click Callback */}
                  <a
                    href={`tel:${call.callerNumber.replace(/\D/g, "")}`}
                    onClick={() => handleResolve(call.id)}
                    style={{
                      padding: "0.4rem 0.85rem",
                      borderRadius: "6px",
                      background: "linear-gradient(135deg, #ff6b2f, #ea580c)",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      boxShadow: "0 2px 8px rgba(255, 107, 47, 0.28)",
                    }}
                  >
                    <PhoneCall size={13} /> Call Back Now
                  </a>

                  {/* Resolve */}
                  <button
                    type="button"
                    disabled={actionLoading === call.id}
                    onClick={() => handleResolve(call.id)}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "6px",
                      background: "var(--closer-surface, rgba(148, 163, 184, 0.12))",
                      border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                      color: "var(--closer-ink, #475569)",
                      fontSize: "0.76rem",
                      cursor: "pointer",
                    }}
                    title="Mark resolved"
                  >
                    <CheckCircle size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
