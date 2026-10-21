"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Flame,
  MessageCircle,
  MessageSquare,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import type { WhatsAppScannerSessionState } from "@/app/api/sales/whatsapp-scanner/route";
import type { SalesAgentView, SalesLeadView } from "@/lib/gigxomi/sales-store";
import { renderDeterministicQrSvg } from "@/components/sales/contacts-hub";
import { aicloserApi } from "@/lib/api-client";

type UserWhatsAppSyncCardProps = {
  tenantId?: string;
  isCloser: boolean;
  currentAgent: SalesAgentView | null;
  assignedLeads: SalesLeadView[];
  onOpenChat?: (conversationId?: string) => void;
  onOpenLead?: (leadId: string) => void;
  onNavigateTab?: (tab: string) => void;
  onRefreshSnapshot?: () => void;
};

export function UserWhatsAppSyncCard({
  tenantId,
  isCloser,
  currentAgent,
  assignedLeads,
  onOpenChat,
  onOpenLead,
  onNavigateTab,
  onRefreshSnapshot,
}: UserWhatsAppSyncCardProps) {
  const [scanner, setScanner] = useState<WhatsAppScannerSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const quota = currentAgent?.activeLeadQuota;

  const loadScanner = useCallback(async () => {
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const res = await fetch(`/api/sales/whatsapp-scanner${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && data.scanner) {
        setScanner(data.scanner);
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadScanner();
  }, [loadScanner]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const res = await fetch(`/api/sales/whatsapp-scanner${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_scan" }),
      });
      const data = await res.json();
      if (data?.ok) {
        if (data.scanner) setScanner(data.scanner);
        setFeedback({ tone: "success", text: data.message || "WhatsApp chats & contacts synced successfully!" });
        onRefreshSnapshot?.();
      } else {
        setFeedback({ tone: "error", text: data?.error || "Failed to sync WhatsApp." });
      }
    } catch {
      setFeedback({ tone: "error", text: "Network error syncing WhatsApp." });
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenScanner = async () => {
    setIsModalOpen(true);
    if (!scanner || scanner.status === "DISCONNECTED") {
      setSyncing(true);
      try {
        const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
        const res = await fetch(`/api/sales/whatsapp-scanner${qs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_qr",
            accountType: isCloser ? "WHATSAPP_PERSONAL" : "WHATSAPP_BUSINESS",
            syncMode: "FULL_INBOX_SYNC",
            visibilityMode: isCloser ? "PRIVATE" : "TEAM_SHARED",
          }),
        });
        const data = await res.json();
        if (data?.ok && data.scanner) {
          setScanner(data.scanner);
        }
      } catch {
        // best-effort
      } finally {
        setSyncing(false);
      }
    }
  };

  const isConnected = scanner?.status === "CONNECTED";
  const isQrReady = scanner?.status === "QR_READY";

  // Leads with WhatsApp or phone
  const whatsappLeads = useMemo(() => {
    return assignedLeads
      .filter((l) => Boolean(l.customerPhone || l.conversationId))
      .slice(0, 4);
  }, [assignedLeads]);

  return (
    <>
      <div
        className="sales-action-card sales-whatsapp-sync-card"
        style={{
          background: "var(--closer-surface, #ffffff)",
          border: "1px solid var(--closer-line, #cbd5e1)",
          borderRadius: "18px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "var(--shadow-card, 0 8px 24px rgba(15, 23, 42, 0.05))",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--closer-line, #cbd5e1)",
            paddingBottom: "12px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
              }}
            >
              <MessageCircle size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--closer-ink, #0f172a)",
                }}
              >
                {isCloser ? "Closer WhatsApp Business Live Sync" : "WhatsApp Communication Sync"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
                {isConnected
                  ? `Linked: ${scanner?.connectedPhone || "Device connected"} · 2-way sync active`
                  : isQrReady
                    ? "QR Code ready · Scan to link WhatsApp device"
                    : "No personal device linked · Sync disabled"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isConnected ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10b981",
                    boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.3)",
                  }}
                />
                Live Connected
              </span>
            ) : isQrReady ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#d97706",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                }}
              >
                Scan QR Required
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                Disconnected
              </span>
            )}
          </div>
        </div>

        {/* Lead Capacity / Quota Progress Bar (if configured) */}
        {quota ? (
          <div
            style={{
              background: quota.isAtCapacity
                ? "rgba(239, 68, 68, 0.08)"
                : "var(--closer-soft, rgba(148, 163, 184, 0.08))",
              border: `1px solid ${quota.isAtCapacity ? "rgba(239, 68, 68, 0.3)" : "var(--closer-line, #cbd5e1)"}`,
              borderRadius: "12px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <strong style={{ color: "var(--closer-ink, #0f172a)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Flame size={14} color={quota.isAtCapacity ? "#ef4444" : "#10b981"} />
                Active Lead Quota: {quota.current} / {quota.max} Allowed
              </strong>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: quota.isAtCapacity ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  color: quota.isAtCapacity ? "#ef4444" : "#10b981",
                  border: `1px solid ${quota.isAtCapacity ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                }}
              >
                {quota.isAtCapacity ? "Capacity Reached" : `${quota.remaining} slots available`}
              </span>
            </div>
            <div
              style={{
                height: "6px",
                background: "rgba(148, 163, 184, 0.25)",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.round((quota.current / quota.max) * 100))}%`,
                  background: quota.isAtCapacity ? "#ef4444" : "#10b981",
                  borderRadius: "999px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            {quota.isAtCapacity ? (
              <p style={{ margin: 0, fontSize: "11px", color: "#b91c1c", fontWeight: 600 }}>
                Maximum active lead capacity ({quota.max}) reached. Finish, close, or mark a lead lost before claiming new leads.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Feedback message banner */}
        {feedback ? (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: feedback.tone === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              color: feedback.tone === "success" ? "#065f46" : "#991b1b",
              border: `1px solid ${feedback.tone === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            }}
          >
            {feedback.tone === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{feedback.text}</span>
          </div>
        ) : null}

        {/* Sync Controls Toolbar */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              fontSize: "12px",
              fontWeight: 700,
              cursor: syncing ? "not-allowed" : "pointer",
              opacity: syncing ? 0.75 : 1,
            }}
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync WhatsApp Now"}
          </button>

          <button
            type="button"
            onClick={handleOpenScanner}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "8px",
              background: "var(--closer-soft, rgba(148, 163, 184, 0.12))",
              color: "var(--closer-ink, #0f172a)",
              border: "1px solid var(--closer-line, #cbd5e1)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <QrCode size={13} />
            {isConnected ? "Device Details & QR" : "Link WhatsApp Device"}
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab?.("conversations")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "8px",
              background: "rgba(56, 189, 248, 0.12)",
              color: "#0284c7",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <MessageSquare size={13} />
            Open Synced WhatsApp Chats
          </button>
        </div>

        {/* Assigned WhatsApp Leads Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--closer-muted, #64748b)" }}>
              Assigned WhatsApp Leads ({whatsappLeads.length})
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab?.("crm")}
              style={{
                fontSize: "11px",
                color: "#10b981",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              View in CRM →
            </button>
          </div>

          {whatsappLeads.length === 0 ? (
            <div
              style={{
                padding: "20px 10px",
                textAlign: "center",
                color: "var(--closer-muted, #64748b)",
                fontSize: "12px",
              }}
            >
              No active assigned leads yet. Claim from queue or wait for assignment.
            </div>
          ) : (
            whatsappLeads.map((lead) => (
              <div
                key={lead.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 12px",
                  borderRadius: "10px",
                  background: "var(--closer-soft, rgba(148, 163, 184, 0.08))",
                  border: "1px solid var(--closer-line, #cbd5e1)",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong
                      style={{
                        fontSize: "13px",
                        color: "var(--closer-ink, #0f172a)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "180px",
                      }}
                    >
                      {lead.customerName}
                    </strong>
                    <span
                      style={{
                        fontSize: "9px",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background: "rgba(148, 163, 184, 0.2)",
                        color: "var(--closer-ink, #334155)",
                        fontWeight: 700,
                      }}
                    >
                      {lead.stage}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--closer-muted, #64748b)" }}>
                    {lead.customerPhone}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onOpenLead?.(lead.id)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "rgba(148, 163, 184, 0.15)",
                      border: "1px solid var(--closer-line, #cbd5e1)",
                      color: "var(--closer-ink, #334155)",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenChat?.(lead.conversationId || undefined)}
                    title="Open WhatsApp Chat"
                    style={{
                      padding: "5px 8px",
                      borderRadius: "6px",
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      color: "#10b981",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <MessageSquare size={12} /> Chat
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal for QR Scanner & Linked Device Details */}
      {isModalOpen ? (
        <UserWhatsAppSyncModal
          isOpen={isModalOpen}
          scanner={scanner}
          tenantId={tenantId}
          isCloser={isCloser}
          onClose={() => setIsModalOpen(false)}
          onRefresh={loadScanner}
        />
      ) : null}
    </>
  );
}

function UserWhatsAppSyncModal({
  isOpen,
  scanner,
  tenantId,
  isCloser,
  onClose,
  onRefresh,
}: {
  isOpen: boolean;
  scanner: WhatsAppScannerSessionState | null;
  tenantId?: string;
  isCloser: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Auto-polling for QR link detection while modal is open
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const interval = setInterval(async () => {
      try {
        const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
        const res = await fetch(`/api/sales/whatsapp-scanner${qs}`, { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data.scanner && active) {
          if (data.scanner.status === "CONNECTED" && scanner?.status !== "CONNECTED") {
            onRefresh();
          }
        }
      } catch {}
    }, 2500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen, onRefresh, scanner?.status, tenantId]);

  const handleGenerateNewQr = async () => {
    setRefreshing(true);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      await fetch(`/api/sales/whatsapp-scanner${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_qr",
          accountType: isCloser ? "WHATSAPP_PERSONAL" : "WHATSAPP_BUSINESS",
          syncMode: "FULL_INBOX_SYNC",
          visibilityMode: isCloser ? "PRIVATE" : "TEAM_SHARED",
        }),
      });
      onRefresh();
    } catch {} finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this linked WhatsApp device?")) return;
    setDisconnecting(true);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      await fetch(`/api/sales/whatsapp-scanner${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      onRefresh();
    } catch {} finally {
      setDisconnecting(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = scanner?.status === "CONNECTED";

  return (
    <div
      className="sales-modal-backdrop"
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
        className="sales-modal-card"
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--closer-surface, #ffffff)",
          border: "1px solid var(--closer-line, #cbd5e1)",
          borderRadius: "16px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
              }}
            >
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
                {isCloser ? "Link Personal WhatsApp Device" : "WhatsApp Device Scanner"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--closer-muted, #64748b)" }}>
                {isCloser ? "Connect your personal number for direct CRM sync" : "Multi-device WhatsApp connection"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--closer-muted, #64748b)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {isConnected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center", padding: "12px 0" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto",
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
                WhatsApp Device Connected!
              </h4>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--closer-muted, #64748b)" }}>
                Active Phone: <strong>{scanner?.connectedPhone || "Linked Phone"}</strong>
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                background: "var(--closer-soft, rgba(148, 163, 184, 0.08))",
                padding: "12px",
                borderRadius: "10px",
                textAlign: "left",
                fontSize: "12px",
              }}
            >
              <div>
                <span style={{ color: "var(--closer-muted, #64748b)", display: "block" }}>Account Type</span>
                <strong style={{ color: "var(--closer-ink, #0f172a)" }}>
                  {scanner?.accountType === "WHATSAPP_BUSINESS" ? "WhatsApp Business" : "Personal WhatsApp"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--closer-muted, #64748b)", display: "block" }}>Sync Mode</span>
                <strong style={{ color: "var(--closer-ink, #0f172a)" }}>
                  {scanner?.syncMode === "CONTACTS_ONLY_SCRAPER" ? "Contacts Only" : "Full Chat & Contacts"}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "8px" }}>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: disconnecting ? "not-allowed" : "pointer",
                }}
              >
                <Trash2 size={13} />
                {disconnecting ? "Disconnecting..." : "Disconnect Device"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center" }}>
            <div
              style={{
                padding: "16px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "2px solid rgba(16, 185, 129, 0.35)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              }}
            >
              {scanner ? (
                renderDeterministicQrSvg(scanner.qrCodeToken || scanner.sessionId || "wa_closer_qr")
              ) : (
                <div style={{ width: "176px", height: "176px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RefreshCw size={24} className="animate-spin" color="#10b981" />
                </div>
              )}
            </div>

            {scanner?.pairingCode ? (
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px dashed #10b981",
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "2px",
                  color: "#065f46",
                }}
              >
                Pairing Code: {scanner.pairingCode}
              </div>
            ) : null}

            <div style={{ textAlign: "left", fontSize: "12px", color: "var(--closer-muted, #64748b)", display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
              <strong style={{ color: "var(--closer-ink, #0f172a)" }}>How to link your WhatsApp:</strong>
              <div>1. Open WhatsApp on your mobile phone</div>
              <div>2. Tap <strong>Settings</strong> (iOS) or <strong>Three Dots ⋮</strong> (Android) &gt; <strong>Linked Devices</strong></div>
              <div>3. Tap <strong>Link a Device</strong> and point your camera at this QR code</div>
            </div>

            <button
              type="button"
              onClick={handleGenerateNewQr}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "var(--closer-soft, rgba(148, 163, 184, 0.12))",
                color: "var(--closer-ink, #0f172a)",
                border: "1px solid var(--closer-line, #cbd5e1)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: refreshing ? "not-allowed" : "pointer",
              }}
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Generating..." : "Regenerate QR Code"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
