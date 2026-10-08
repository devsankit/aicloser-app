"use client";

import { useEffect, useState } from "react";
import { PhoneCall, Play, Plus, Trash2, Edit2, CheckCircle2, TrendingUp, Users, Target } from "lucide-react";
import type { CallingCampaign } from "@/lib/gigxomi/calling-campaigns-store";
import { PowerDialerModal } from "@/components/sales/power-dialer-modal";

export function CallingCampaignsPanel() {
  const [campaigns, setCampaigns] = useState<CallingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDialerCampaign, setActiveDialerCampaign] = useState<CallingCampaign | null>(null);

  // New campaign modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignDesc, setNewCampaignDesc] = useState("");
  const [newDailyTarget, setNewDailyTarget] = useState(50);
  const [newCooldown, setNewCooldown] = useState(5);
  const [saving, setSaving] = useState(false);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/campaigns");
      const data = await res.json();
      if (data.ok) {
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("Failed to load campaigns", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleCreateCampaign = async () => {
    if (!newCampaignName) {
      alert("Please provide campaign name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaignName,
          description: newCampaignDesc,
          dailyTarget: newDailyTarget,
          cooldownSeconds: newCooldown,
          status: "ACTIVE",
          assignedAgentIds: [],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setModalOpen(false);
        setNewCampaignName("");
        setNewCampaignDesc("");
        await loadCampaigns();
      } else {
        alert(data.error || "Failed to create campaign");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      const res = await fetch(`/api/sales/campaigns/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) await loadCampaigns();
    } catch (err: any) {
      alert(err.message || "Failed to delete campaign");
    }
  };

  const totalDials = campaigns.reduce((acc, c) => acc + c.dialedCount, 0);
  const totalConnects = campaigns.reduce((acc, c) => acc + c.connectedCount, 0);
  const totalConverts = campaigns.reduce((acc, c) => acc + c.convertedCount, 0);
  const avgConnectRate = totalDials > 0 ? Math.round((totalConnects / totalDials) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top Banner & Stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)", display: "flex", alignItems: "center" }}>
            <PhoneCall size={20} color="var(--closer-orange, #ff6b2f)" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "8px" }} />
            Outbound Calling Campaigns &amp; Power Dialer
          </h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--closer-muted, #64748b)" }}>
            Sequential autodialer queues with automated cooldown, 1-click SIM dial, and rapid call dispositions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
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
          <Plus size={16} /> New Calling Campaign
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div
          style={{
            padding: "1rem",
            borderRadius: "12px",
            background: "var(--closer-surface, #ffffff)",
            border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--closer-muted, #64748b)", display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 600 }}>
            <PhoneCall size={14} color="#ff6b2f" /> Total Dials Logged
          </span>
          <strong style={{ fontSize: "1.5rem", color: "var(--closer-ink, #0f172a)" }}>{totalDials}</strong>
        </div>

        <div
          style={{
            padding: "1rem",
            borderRadius: "12px",
            background: "var(--closer-surface, #ffffff)",
            border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--closer-muted, #64748b)", display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 600 }}>
            <TrendingUp size={14} color="#10b981" /> Connect Rate
          </span>
          <strong style={{ fontSize: "1.5rem", color: "#059669" }}>{avgConnectRate}%</strong>
        </div>

        <div
          style={{
            padding: "1rem",
            borderRadius: "12px",
            background: "var(--closer-surface, #ffffff)",
            border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--closer-muted, #64748b)", display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 600 }}>
            <Target size={14} color="#f59e0b" /> Deals Won & Closed
          </span>
          <strong style={{ fontSize: "1.5rem", color: "#d97706" }}>{totalConverts}</strong>
        </div>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--closer-muted, #64748b)" }}>
          Loading calling campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--closer-muted, #64748b)" }}>
          No calling campaigns created yet. Click "+ New Calling Campaign" above to launch an autodialer drive.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1rem" }}>
          {campaigns.map((camp) => {
            const dialPercent = camp.totalLeads > 0 ? Math.round((camp.dialedCount / camp.totalLeads) * 100) : 0;
            return (
              <div
                key={camp.id}
                style={{
                  padding: "1.25rem",
                  borderRadius: "12px",
                  background: "var(--closer-surface, #ffffff)",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--closer-ink, #0f172a)" }}>
                      {camp.name}
                    </h3>
                    <span style={{ fontSize: "0.76rem", color: "var(--closer-muted, #64748b)" }}>
                      Daily Target: {camp.dailyTarget} calls • Cooldown: {camp.cooldownSeconds}s
                    </span>
                  </div>
                  <span
                    style={{
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      background: camp.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                      color: camp.status === "ACTIVE" ? "#059669" : "#64748b",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}
                  >
                    {camp.status}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--closer-muted, #64748b)", lineClamp: 2 }}>
                  {camp.description}
                </p>

                {/* Progress bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.3rem" }}>
                    <span style={{ color: "var(--closer-ink, #334155)", fontWeight: 600 }}>Queue Progress: {camp.dialedCount} / {camp.totalLeads}</span>
                    <span style={{ color: "#ff6b2f", fontWeight: 700 }}>{dialPercent}%</span>
                  </div>
                  <div style={{ height: "6px", width: "100%", background: "rgba(148, 163, 184, 0.2)", borderRadius: "3px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, dialPercent)}%`,
                        background: "linear-gradient(90deg, #ff6b2f, #ff8c42)",
                      }}
                    />
                  </div>
                </div>

                {/* Action controls */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <button
                    type="button"
                    onClick={() => setActiveDialerCampaign(camp)}
                    style={{
                      flex: 1,
                      padding: "0.6rem 1rem",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                      border: "none",
                      color: "#fff",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.4rem",
                      boxShadow: "0 2px 8px rgba(255, 107, 47, 0.3)",
                    }}
                  >
                    <Play size={14} fill="#fff" /> Launch Power Dialer
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(camp.id)}
                    aria-label={`Delete campaign ${camp.name}`}
                    title={`Delete campaign ${camp.name}`}
                    style={{
                      padding: "0.6rem",
                      borderRadius: "8px",
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Power Dialer Runner Modal */}
      {activeDialerCampaign && (
        <PowerDialerModal
          campaign={activeDialerCampaign}
          onClose={() => setActiveDialerCampaign(null)}
          onCampaignUpdated={async () => {
            const res = await fetch(`/api/sales/campaigns/${activeDialerCampaign.id}`);
            const data = await res.json();
            if (data.ok && data.campaign) {
              setActiveDialerCampaign(data.campaign);
              loadCampaigns();
            }
          }}
        />
      )}

      {/* Create Campaign Modal */}
      {modalOpen && (
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
              maxWidth: "480px",
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
              Create Calling Campaign
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>Campaign Name</label>
              <input
                type="text"
                placeholder="e.g. Inbound Hot Leads Blitz"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
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
              <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>Description / Objective</label>
              <textarea
                rows={2}
                placeholder="Target audience or campaign objective..."
                value={newCampaignDesc}
                onChange={(e) => setNewCampaignDesc(e.target.value)}
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>Daily Target Calls</label>
                <input
                  type="number"
                  value={newDailyTarget}
                  onChange={(e) => setNewDailyTarget(Number(e.target.value))}
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
                <label style={{ fontSize: "0.78rem", color: "var(--closer-muted, #64748b)", fontWeight: 600 }}>Cooldown (seconds)</label>
                <input
                  type="number"
                  value={newCooldown}
                  onChange={(e) => setNewCooldown(Number(e.target.value))}
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
            </div>

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
                onClick={handleCreateCampaign}
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
                {saving ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
