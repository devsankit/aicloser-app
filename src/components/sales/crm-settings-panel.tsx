"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Globe,
  Key,
  Layers,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Sliders,
  Smartphone,
  Unlock,
  UserCheck,
  Users,
} from "lucide-react";

import type { RoundRobinSettings } from "@/lib/gigxomi/round-robin-service";

type CrmSettingsPanelProps = {
  isAdmin?: boolean;
  initialTab?: SettingsTab;
  tenantId?: string;
  rolePermissionsComponent?: ReactNode;
  whatsAppSetupComponent?: ReactNode;
  instagramSetupComponent?: ReactNode;
  customFieldsComponent?: ReactNode;
  onRefreshDashboard?: () => void;
};

type SettingsTab =
  | "general"
  | "round_robin"
  | "permissions"
  | "channels"
  | "team"
  | "custom_fields";

export function CrmSettingsPanel({
  isAdmin = true,
  initialTab = "round_robin",
  tenantId,
  rolePermissionsComponent,
  whatsAppSetupComponent,
  instagramSetupComponent,
  customFieldsComponent,
  onRefreshDashboard,
}: CrmSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // General Settings
  const [workspaceName, setWorkspaceName] = useState("AIcloser Digital Agency");
  const [defaultCountryCode, setDefaultCountryCode] = useState("+91");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [primaryBrandColor, setPrimaryBrandColor] = useState("#ff6b2f");

  // Round-Robin & Distribution Settings
  const [rrSettings, setRrSettings] = useState<RoundRobinSettings>({
    tenantId: "tenant-gigxomi",
    enabled: true,
    strategy: "ROUND_ROBIN",
    participatingGroupId: null,
    participatingAgentIds: [],
    maxActiveLeadsPerAgent: 50,
    lastAssignedIndex: -1,
    allowNonAdminModifyLeads: true,
    allowNonAdminDeleteLeads: false,
    allowNonAdminExportData: false,
    allowNonAdminBulkCampaigns: false,
    fallbackAgentId: null,
    updatedAt: new Date().toISOString(),
  });
  const [agentsList, setAgentsList] = useState<
    Array<{
      id: string;
      displayName: string;
      email: string;
      phone?: string;
      activeLeadsCount: number;
      isParticipating: boolean;
      roundRobinOrder: number;
      groupId: string | null;
      groupName: string;
    }>
  >([]);
  const [groupsList, setGroupsList] = useState<Array<{ id: string; name: string }>>([]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/round-robin");
      const data = await res.json();
      if (data.ok) {
        if (data.settings) setRrSettings(data.settings);
        if (data.agents) setAgentsList(data.agents);
        if (data.groups) setGroupsList(data.groups);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/sales/round-robin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "save_settings",
          settings: rrSettings,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBanner({ tone: "success", text: data.message || "Settings saved successfully." });
        onRefreshDashboard?.();
      } else {
        setBanner({ tone: "error", text: data.error || "Failed to save settings." });
      }
    } catch (err: any) {
      setBanner({ tone: "error", text: err.message || "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAgentParticipation = (agentId: string) => {
    const current = rrSettings.participatingAgentIds || [];
    const next = current.includes(agentId)
      ? current.filter((id) => id !== agentId)
      : [...current, agentId];
    setRrSettings({ ...rrSettings, participatingAgentIds: next });
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Top Banner Notice */}
      {banner ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: banner.tone === "success" ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
            border: `1px solid ${banner.tone === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: banner.tone === "success" ? "#10b981" : "#ef4444",
            fontWeight: 600,
            fontSize: "0.88rem",
          }}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Main Settings Shell (Perfex / Bitrix24 organized tabs) */}
      <div
        className="crm-panel"
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.28))",
          minHeight: 620,
        }}
      >
        {/* Left Settings Sidebar Navigation */}
        <div
          style={{
            background: "var(--closer-surface-soft)",
            borderRight: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))",
            padding: "20px 14px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 10px 12px" }}>
              CRM Control Center
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <button
                type="button"
                onClick={() => setActiveTab("round_robin")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "none",
                  background: activeTab === "round_robin" ? "rgba(255, 107, 47, 0.16)" : "transparent",
                  color: activeTab === "round_robin" ? "#ff6b2f" : "inherit",
                }}
              >
                <Users size={16} />
                <span>Lead Round-Robin</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("permissions")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "none",
                  background: activeTab === "permissions" ? "rgba(255, 107, 47, 0.16)" : "transparent",
                  color: activeTab === "permissions" ? "#ff6b2f" : "inherit",
                }}
              >
                <ShieldCheck size={16} />
                <span>Role Permissions</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("channels")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "none",
                  background: activeTab === "channels" ? "rgba(255, 107, 47, 0.16)" : "transparent",
                  color: activeTab === "channels" ? "#ff6b2f" : "inherit",
                }}
              >
                <Key size={16} />
                <span>Channel Credentials</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("team")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "none",
                  background: activeTab === "team" ? "rgba(255, 107, 47, 0.16)" : "transparent",
                  color: activeTab === "team" ? "#ff6b2f" : "inherit",
                }}
              >
                <UserCheck size={16} />
                <span>Team & Sales Agents</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("general")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "none",
                  background: activeTab === "general" ? "rgba(255, 107, 47, 0.16)" : "transparent",
                  color: activeTab === "general" ? "#ff6b2f" : "inherit",
                }}
              >
                <Sliders size={16} />
                <span>General Workspace</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("custom_fields")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "none",
                  background: activeTab === "custom_fields" ? "rgba(255, 107, 47, 0.16)" : "transparent",
                  color: activeTab === "custom_fields" ? "#ff6b2f" : "inherit",
                }}
              >
                <FileSpreadsheet size={16} />
                <span>Custom Schema & Fields</span>
              </button>
            </div>
          </div>

          {isAdmin ? (
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={handleSaveSettings}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, marginTop: 20 }}
            >
              <Save size={15} />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          ) : null}
        </div>

        {/* Right Settings Content Area */}
        <div style={{ padding: 26, overflowY: "auto" }}>
          {/* TAB 1: LEAD DISTRIBUTION & ROUND-ROBIN */}
          {activeTab === "round_robin" ? (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                  Automated Lead Distribution Engine
                </span>
                <h3 style={{ margin: "4px 0 6px", fontSize: "1.25rem", fontWeight: 800 }}>
                  Sales Team Round-Robin Assignment Rules
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                  When leads arrive from WhatsApp Scanners, Google Sheets, Excel imports, or Lead Forms, they are automatically distributed in equal rotation across the participating sales reps.
                </p>
              </div>

              {/* Master Toggle */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: rrSettings.enabled ? "rgba(16, 185, 129, 0.1)" : "rgba(148, 163, 184, 0.08)",
                  border: rrSettings.enabled ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>Auto Round-Robin Distribution</strong>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {rrSettings.enabled
                      ? "Active — New leads rotate automatically to the next sales agent in queue."
                      : "Disabled — Inbound leads remain in the unassigned pool until claimed."}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={rrSettings.enabled}
                    onChange={(e) => setRrSettings({ ...rrSettings, enabled: e.target.checked })}
                    style={{ width: 20, height: 20 }}
                  />
                </label>
              </div>

              {/* Participating Sales Agents Checklist */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    Participating Sales Agents ({agentsList.length})
                  </label>
                  <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>
                    {rrSettings.participatingAgentIds.length} Agents in Rotation Pool
                  </span>
                </div>

                <label style={{ display: "grid", gap: 6, marginBottom: 12, maxWidth: 360 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    Rotation scope
                  </span>
                  <select
                    value={rrSettings.participatingGroupId ?? ""}
                    onChange={(event) => setRrSettings({ ...rrSettings, participatingGroupId: event.target.value || null })}
                    style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }}
                  >
                    <option value="">All active sales users</option>
                    {groupsList.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Choose a team group or keep the rotation workspace-wide.
                  </span>
                </label>

                <div style={{ display: "grid", gap: 10 }}>
                  {agentsList.map((agent, idx) => {
                    const isParticipating = rrSettings.participatingAgentIds.includes(agent.id);
                    return (
                      <div
                        key={agent.id}
                        onClick={() => handleToggleAgentParticipation(agent.id)}
                        style={{
                          padding: "12px 16px",
                          borderRadius: 12,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: isParticipating
                            ? "rgba(255, 107, 47, 0.1)"
                            : "var(--closer-surface-soft)",
                          border: isParticipating
                            ? "1px solid #ff6b2f"
                            : "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              background: isParticipating ? "#ff6b2f" : "rgba(148, 163, 184, 0.2)",
                              color: "#fff",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <strong style={{ fontSize: 13 }}>{agent.displayName}</strong>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              {agent.email} • {agent.phone || "No phone"}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                            {agent.activeLeadsCount} active leads
                          </span>
                          <input type="checkbox" checked={isParticipating} readOnly />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strategy & Capacity Limits */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Distribution Algorithm
                  </label>
                  <select
                    value={rrSettings.strategy}
                    onChange={(e) => setRrSettings({ ...rrSettings, strategy: e.target.value as any })}
                    style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }}
                  >
                    <option value="ROUND_ROBIN">Pure Sequential Round-Robin (Equal Leads)</option>
                    <option value="CAPACITY_WEIGHTED">Capacity-Weighted (Give to Rep with lowest active leads)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Max Active Leads per Rep (Cap)
                  </label>
                  <input
                    type="number"
                    value={rrSettings.maxActiveLeadsPerAgent}
                    onChange={(e) => setRrSettings({ ...rrSettings, maxActiveLeadsPerAgent: Number(e.target.value) })}
                    style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 2: ROLES & GRANULAR PERMISSIONS */}
          {activeTab === "permissions" ? (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                  Access Governance & Security
                </span>
                <h3 style={{ margin: "4px 0 6px", fontSize: "1.25rem", fontWeight: 800 }}>
                  Role Permissions Matrix (Admin vs Manager vs Closer)
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                  Configure what managers and sales users can modify, view, or export within the workspace.
                </p>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {/* User Request Requirement: Can modify lead details permission */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "var(--closer-surface-soft)",
                    border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8 }}>
                      {rrSettings.allowNonAdminModifyLeads ? <Unlock size={16} color="#10b981" /> : <Lock size={16} color="#ef4444" />}
                      Allow Managers & Sales Users to Modify Lead Details
                    </strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      When turned OFF, only workspace Administrators can edit customer name, phone, email, custom fields, and requirements.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={rrSettings.allowNonAdminModifyLeads}
                    onChange={(e) => setRrSettings({ ...rrSettings, allowNonAdminModifyLeads: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "var(--closer-surface-soft)",
                    border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.95rem" }}>Allow Sales Users to Delete Leads & Contacts</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Prevent accidental data loss by restricting lead deletion to administrators.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={rrSettings.allowNonAdminDeleteLeads}
                    onChange={(e) => setRrSettings({ ...rrSettings, allowNonAdminDeleteLeads: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "var(--closer-surface-soft)",
                    border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.95rem" }}>Allow Non-Admins to Export Contact Lists (CSV / Excel)</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Protects proprietary prospect database against unauthorized offline downloads.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={rrSettings.allowNonAdminExportData}
                    onChange={(e) => setRrSettings({ ...rrSettings, allowNonAdminExportData: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "var(--closer-surface-soft)",
                    border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.95rem" }}>Allow Sales Users to Trigger Bulk WhatsApp Broadcasts</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Controls access to sending high-volume marketing templates.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={rrSettings.allowNonAdminBulkCampaigns}
                    onChange={(e) => setRrSettings({ ...rrSettings, allowNonAdminBulkCampaigns: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                </div>
              </div>

              {rolePermissionsComponent ? <div style={{ marginTop: 16 }}>{rolePermissionsComponent}</div> : null}
            </div>
          ) : null}

          {/* TAB 3: CHANNELS & CREDENTIALS */}
          {activeTab === "channels" ? (
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                  Channel Integrations
                </span>
                <h3 style={{ margin: "4px 0 6px", fontSize: "1.25rem", fontWeight: 800 }}>
                  Connected Social, Messaging & Email Channels
                </h3>
              </div>

              {whatsAppSetupComponent ? (
                <div style={{ padding: 16, borderRadius: 14, background: "var(--closer-surface-soft)", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))" }}>
                  <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: 10 }}>Official WhatsApp Cloud API</strong>
                  {whatsAppSetupComponent}
                </div>
              ) : null}

              {instagramSetupComponent ? (
                <div style={{ padding: 16, borderRadius: 14, background: "var(--closer-surface-soft)", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))" }}>
                  <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: 10 }}>Instagram DM & Lead API</strong>
                  {instagramSetupComponent}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* TAB 4: TEAM & USERS */}
          {activeTab === "team" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                  Sales Roster
                </span>
                <h3 style={{ margin: "4px 0 6px", fontSize: "1.25rem", fontWeight: 800 }}>
                  Active Team Members ({agentsList.length})
                </h3>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {agentsList.map((agent) => (
                  <div
                    key={agent.id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      background: "var(--closer-surface-soft)",
                      border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13 }}>{agent.displayName}</strong>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{agent.email}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 700 }}>
                      Active Sales Rep
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* TAB 5: GENERAL WORKSPACE */}
          {activeTab === "general" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                  General Configuration
                </span>
                <h3 style={{ margin: "4px 0 6px", fontSize: "1.25rem", fontWeight: 800 }}>
                  Workspace Brand & Regional Preferences
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Workspace Name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Default Country Code</label>
                  <input
                    type="text"
                    value={defaultCountryCode}
                    onChange={(e) => setDefaultCountryCode(e.target.value)}
                    style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 6: CUSTOM SCHEMA & FIELDS */}
          {activeTab === "custom_fields" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                  Schema Customization
                </span>
                <h3 style={{ margin: "4px 0 6px", fontSize: "1.25rem", fontWeight: 800 }}>
                  Custom Lead Fields, Stage SLAs &amp; Validation
                </h3>
              </div>
              {customFieldsComponent ? (
                <div>{customFieldsComponent}</div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Custom fields component loaded.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
