"use client";

import { useEffect, useState, useRef } from "react";
import { Phone, PhoneOff, CheckCircle2, Clock, XCircle, AlertCircle, Play, Pause, ChevronRight, Volume2, User, FileText, Award, Zap } from "lucide-react";
import type { CallingCampaign, CampaignMemberLead, CallDisposition } from "@/lib/gigxomi/calling-campaigns-store";

type Props = {
  campaign: CallingCampaign;
  onClose: () => void;
  onCampaignUpdated: () => void;
};

export function PowerDialerModal({ campaign, onClose, onCampaignUpdated }: Props) {
  // Filter pending leads
  const pendingLeads = campaign.leads.filter((l) => !l.isCompleted);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentLead: CampaignMemberLead | undefined = pendingLeads[currentIndex] || campaign.leads[0];

  // Dialer session state
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-advance cooldown timer
  const [cooldown, setCooldown] = useState<number | null>(null);
  const [cooldownPaused, setCooldownPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Active call duration counter
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (callActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callActive]);

  // Handle countdown
  useEffect(() => {
    if (cooldown !== null && cooldown > 0 && !cooldownPaused) {
      timerRef.current = setTimeout(() => {
        setCooldown((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
      }, 1000);
    } else if (cooldown === 0) {
      setCooldown(null);
      // Auto dial or advance
      if (currentIndex < pendingLeads.length - 1) {
        setCurrentIndex((i) => i + 1);
        setNotes("");
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cooldown, cooldownPaused, currentIndex, pendingLeads.length]);

  const handleStartCall = () => {
    if (!currentLead) return;
    setCallActive(true);
    setCooldown(null);
    // Trigger native dialer protocol
    const tel = currentLead.customerPhone.replace(/\D/g, "");
    if (tel) {
      window.location.href = `tel:${tel}`;
    }
  };

  const handleEndCall = () => {
    setCallActive(false);
  };

  const handleDisposition = async (disposition: CallDisposition) => {
    if (!currentLead) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/campaigns/${campaign.id}/disposition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: currentLead.id,
          disposition,
          notes,
          durationSeconds: callDuration,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCallActive(false);
        onCampaignUpdated();
        // Start cooldown before moving to next lead
        setCooldown(campaign.cooldownSeconds || 5);
      } else {
        alert(data.error || "Failed to record disposition");
      }
    } catch (err: any) {
      alert(err.message || "Failed to record disposition");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(10px)",
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
          maxWidth: "800px",
          background: "#121214",
          border: "1px solid rgba(255, 107, 47, 0.3)",
          borderRadius: "16px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 107, 47, 0.15)",
          maxHeight: "90vh",
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            background: "rgba(255, 107, 47, 0.08)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                color: "#fff",
              }}
            >
              <Phone size={16} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
                Power Dialer Runner: {campaign.name}
              </h3>
              <span style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                Queue Progress: {campaign.dialedCount} dialed / {campaign.totalLeads} total ({pendingLeads.length} remaining)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#94a3b8",
              borderRadius: "6px",
              padding: "0.35rem 0.75rem",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Exit Runner
          </button>
        </div>

        {/* Main Dialer Content */}
        {!currentLead ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#cbd5e1" }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ margin: "0 0 0.5rem" }}>Campaign Queue Completed!</h3>
            <p style={{ color: "#94a3b8", margin: 0 }}>All leads in this campaign have been dialed and dispositioned.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "1rem", padding: "1.5rem", overflowY: "auto" }}>
            {/* Left Column: Lead Info & Call Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Prospect Card */}
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#fff" }}>
                      {currentLead.customerName}
                    </h2>
                    <span style={{ fontSize: "1rem", color: "var(--closer-orange, #ff6b2f)", fontWeight: 700, fontFamily: "monospace" }}>
                      {currentLead.customerPhone}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: "0.25rem 0.6rem",
                      borderRadius: "6px",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#60a5fa",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    Stage: {currentLead.stage}
                  </span>
                </div>

                {currentLead.customerEmail && (
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    Email: {currentLead.customerEmail}
                  </span>
                )}

                <div style={{ display: "flex", gap: "1rem", fontSize: "0.76rem", color: "#94a3b8" }}>
                  <span>Attempts: <strong>{currentLead.attempts}</strong></span>
                  {currentLead.lastAttemptAt && <span>Last Dial: {new Date(currentLead.lastAttemptAt).toLocaleTimeString()}</span>}
                </div>
              </div>

              {/* Call Status & Dial Trigger */}
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: "12px",
                  background: callActive ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.02)",
                  border: callActive ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                {callActive ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#10b981", fontWeight: 700, fontSize: "1.2rem" }}>
                      <Volume2 size={24} className="animate-pulse" />
                      <span>CALL IN PROGRESS: {formatTimer(callDuration)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleEndCall}
                      style={{
                        padding: "0.75rem 2rem",
                        borderRadius: "8px",
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
                      }}
                    >
                      <PhoneOff size={18} /> End Call & Log Disposition
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleStartCall}
                      style={{
                        width: "100%",
                        padding: "0.9rem 1.5rem",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        color: "#fff",
                        border: "none",
                        fontWeight: 800,
                        fontSize: "1.1rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.6rem",
                        boxShadow: "0 4px 20px rgba(16, 185, 129, 0.4)",
                      }}
                    >
                      <Phone size={22} /> 1-Click SIM Dial
                    </button>

                    {cooldown !== null && (
                      <div
                        style={{
                          width: "100%",
                          padding: "0.6rem",
                          borderRadius: "8px",
                          background: "rgba(255, 107, 47, 0.15)",
                          border: "1px solid rgba(255, 107, 47, 0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "0.82rem",
                        }}
                      >
                        <span style={{ color: "#ff8c42", fontWeight: 600 }}>
                          Auto-advancing to next lead in <strong>{cooldown}s</strong>...
                        </span>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => setCooldownPaused(!cooldownPaused)}
                            style={{
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              background: "rgba(255, 255, 255, 0.1)",
                              border: "none",
                              color: "#fff",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            {cooldownPaused ? <Play size={12} /> : <Pause size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCooldown(0)}
                            style={{
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              background: "rgba(255, 107, 47, 0.4)",
                              border: "none",
                              color: "#fff",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Skip & Advance
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Disposition Panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1" }}>
                  Select Call Disposition:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDisposition("CONNECTED")}
                    style={{
                      padding: "0.6rem",
                      borderRadius: "6px",
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#10b981",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <CheckCircle2 size={14} /> Connected & Pitched
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDisposition("CALL_BACK")}
                    style={{
                      padding: "0.6rem",
                      borderRadius: "6px",
                      background: "rgba(245, 158, 11, 0.15)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      color: "#f59e0b",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <Clock size={14} /> Callback Later
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDisposition("NOT_REACHABLE")}
                    style={{
                      padding: "0.6rem",
                      borderRadius: "6px",
                      background: "rgba(100, 116, 139, 0.15)",
                      border: "1px solid rgba(100, 116, 139, 0.3)",
                      color: "#94a3b8",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <AlertCircle size={14} /> Busy / Not Reachable
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDisposition("NOT_INTERESTED")}
                    style={{
                      padding: "0.6rem",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#ef4444",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <XCircle size={14} /> Not Interested
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDisposition("CLOSED_WON")}
                    style={{
                      gridColumn: "span 2",
                      padding: "0.7rem",
                      borderRadius: "6px",
                      background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                      border: "none",
                      color: "#fff",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.4rem",
                      boxShadow: "0 4px 12px rgba(255, 107, 47, 0.3)",
                    }}
                  >
                    <Award size={14} /> Deal Won / Closed
                  </button>
                </div>

                <div style={{ marginTop: "0.5rem" }}>
                  <textarea
                    rows={2}
                    placeholder="Enter call notes, objections, or next steps..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "6px",
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#fff",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Telecalling Script & Objections */}
            <div
              style={{
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileText size={16} color="var(--closer-orange, #ff6b2f)" />
                <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                  Telecalling Pitch Script
                </h4>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "8px",
                  background: "rgba(0, 0, 0, 0.3)",
                  fontSize: "0.82rem",
                  lineHeight: 1.6,
                  color: "#cbd5e1",
                  whiteSpace: "pre-line",
                  borderLeft: "3px solid var(--closer-orange, #ff6b2f)",
                }}
              >
                {campaign.scriptTemplate
                  .replace(/\[Customer Name\]/g, currentLead.customerName)
                  .replace(/\[Agent Name\]/g, "Sales Rep")}
              </div>

              <div>
                <h5 style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "5px" }}>
                  <Zap size={14} /> Quick Objection Handlers
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.78rem" }}>
                  <div style={{ padding: "0.5rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.03)" }}>
                    <strong style={{ color: "#fff" }}>"Send details on WhatsApp":</strong>
                    <p style={{ margin: "0.2rem 0 0", color: "#94a3b8" }}>
                      "I will send our deck immediately! While I pull it up, are you primarily looking for video production or client closing assistance?"
                    </p>
                  </div>
                  <div style={{ padding: "0.5rem", borderRadius: "6px", background: "rgba(255, 255, 255, 0.03)" }}>
                    <strong style={{ color: "#fff" }}>"Too expensive":</strong>
                    <p style={{ margin: "0.2rem 0 0", color: "#94a3b8" }}>
                      "We structure performance commissions so your ROI pays for the system within the first 14 days."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
