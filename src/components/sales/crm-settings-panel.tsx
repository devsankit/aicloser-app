"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  Cloud,
  FileSpreadsheet,
  Globe,
  Key,
  Layers,
  Lock,
  Mail,
  MessageCircle,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Sliders,
  Smartphone,
  Upload,
  Unlock,
  Unplug,
  UserCheck,
  Users,
} from "lucide-react";

import type { RoundRobinSettings } from "@/lib/gigxomi/round-robin-service";
import { aicloserApi, type GoogleDriveStatus } from "@/lib/api-client";

type CrmSettingsPanelProps = {
  isAdmin?: boolean;
  initialTab?: SettingsTab;
  tenantId?: string;
  profile?: {
    displayName: string;
    email: string;
    phone: string;
    companyName?: string | null;
  };
  rolePermissionsComponent?: ReactNode;
  showRolePermissionsTab?: boolean;
  showTeamTab?: boolean;
  whatsAppSetupComponent?: ReactNode;
  instagramSetupComponent?: ReactNode;
  customFieldsComponent?: ReactNode;
  onRefreshDashboard?: () => void;
};

type SettingsTab =
  | "general"
  | "payment_qr"
  | "round_robin"
  | "permissions"
  | "channels"
  | "team"
  | "storage"
  | "custom_fields";

type PaymentQrBranding = {
  enabled: boolean;
  upiId: string;
  payeeName: string;
  qrBrandName: string;
  qrAccentColor: string;
  qrLogoDataUrl: string;
  instructions: string;
};

const DEFAULT_PAYMENT_QR_BRANDING: PaymentQrBranding = {
  enabled: false,
  upiId: "",
  payeeName: "",
  qrBrandName: "",
  qrAccentColor: "#ff5a1f",
  qrLogoDataUrl: "",
  instructions: "",
};

const DEFAULT_GOOGLE_DRIVE_STATUS: GoogleDriveStatus = {
  isConnected: false,
  rootFolderName: "AI Closer CRM Vault",
  recordingsFolderName: "Call Recordings",
  backupRecordings: true,
  backupMedia: true,
};

export function CrmSettingsPanel({
  isAdmin = true,
  initialTab = "round_robin",
  tenantId,
  profile,
  rolePermissionsComponent,
  showRolePermissionsTab = true,
  showTeamTab = true,
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
  const [profileName, setProfileName] = useState(profile?.displayName ?? "");
  const [profileEmail, setProfileEmail] = useState(profile?.email ?? "");
  const [profilePhone, setProfilePhone] = useState(profile?.phone ?? "");
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [paymentQrBranding, setPaymentQrBranding] = useState<PaymentQrBranding>(DEFAULT_PAYMENT_QR_BRANDING);
  const [paymentQrSaving, setPaymentQrSaving] = useState(false);
  const [googleDrive, setGoogleDrive] = useState<GoogleDriveStatus>(DEFAULT_GOOGLE_DRIVE_STATUS);
  const [googleDriveLoading, setGoogleDriveLoading] = useState(true);
  const [googleDriveSaving, setGoogleDriveSaving] = useState(false);
  const [googleDriveAction, setGoogleDriveAction] = useState<"connect" | "test" | "disconnect" | null>(null);

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
    allowNonAdminImportData: true,
    allowNonAdminExportData: false,
    allowNonAdminBulkCampaigns: false,
    fallbackAgentId: null,
    updatedAt: new Date().toISOString(),
  });
  const [showOnlyAssignedChats, setShowOnlyAssignedChats] = useState(true);
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

  const mapCentralRoundRobin = (payload: Awaited<ReturnType<typeof aicloserApi.roundRobin.get>>) => {
    const settings = payload?.settings || {};
    const closers = Array.isArray(payload?.closers) ? payload.closers : [];
    const strategy = settings.mode === "LOAD_BALANCED" ? "CAPACITY_WEIGHTED" : "ROUND_ROBIN";
    const currentAgentIds = rrSettings.participatingAgentIds || [];
    const centralAgentIds = closers
      .filter((closer) => closer.status === "ACTIVE" || closer.isAvailable)
      .map((closer) => String(closer.agentId || closer.userId))
      .filter(Boolean);

    return {
      ...rrSettings,
      enabled: Boolean(settings.enabled),
      strategy,
      maxActiveLeadsPerAgent: Number(settings.maxActiveLeadsPerCloser ?? rrSettings.maxActiveLeadsPerAgent),
      lastAssignedIndex: -1,
      participatingAgentIds: currentAgentIds.length > 0 ? currentAgentIds : centralAgentIds,
      updatedAt: new Date().toISOString(),
    } as RoundRobinSettings;
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [roundRobinResult, visibilityResult, paymentSettingsResult] = await Promise.allSettled([
        aicloserApi.roundRobin.get(),
        aicloserApi.conversations.getChatVisibility(),
        aicloserApi.payments.getSettings(),
      ]);
      const centralRoundRobin = roundRobinResult.status === "fulfilled" ? roundRobinResult.value : null;
      const centralVisibility = visibilityResult.status === "fulfilled" ? visibilityResult.value : null;
      const centralPaymentSettings = paymentSettingsResult.status === "fulfilled" ? paymentSettingsResult.value : null;

      if (centralRoundRobin) {
        setRrSettings(mapCentralRoundRobin(centralRoundRobin));
        setAgentsList((centralRoundRobin.closers || []).map((closer) => ({
          id: String(closer.agentId || closer.userId),
          displayName: String(closer.name || "Sales user"),
          email: String(closer.email || ""),
          phone: closer.phone ? String(closer.phone) : undefined,
          activeLeadsCount: Number(closer.activeLeads || 0),
          isParticipating: Boolean(closer.status === "ACTIVE" || closer.isAvailable),
          roundRobinOrder: 0,
          groupId: null,
          groupName: "All active sales users",
        })));
      }
      if (centralVisibility) setShowOnlyAssignedChats(centralVisibility.visibilityMode === "ASSIGNED_ONLY");
      if (centralPaymentSettings) {
        const settings = centralPaymentSettings;
        setPaymentQrBranding({
          ...DEFAULT_PAYMENT_QR_BRANDING,
          enabled: settings.enabled === true,
          upiId: settings.upiId ?? "",
          payeeName: settings.payeeName ?? "",
          qrBrandName: settings.qrBrandName ?? "",
          qrAccentColor: settings.qrAccentColor || DEFAULT_PAYMENT_QR_BRANDING.qrAccentColor,
          instructions: settings.instructions ?? "",
          qrLogoDataUrl: typeof settings.qrLogoDataUrl === "string" ? settings.qrLogoDataUrl : "",
        });
      }
      try {
        const driveStatus = await aicloserApi.integrations.googleDrive.getStatus();
        setGoogleDrive({ ...DEFAULT_GOOGLE_DRIVE_STATUS, ...driveStatus });
      } catch {
        // Google Drive is optional; keep the disconnected state when the integration is unavailable.
      } finally {
        setGoogleDriveLoading(false);
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

  useEffect(() => {
    if (!profile) return;
    setProfileName(profile.displayName);
    setProfileEmail(profile.email);
    setProfilePhone(profile.phone);
    if (profile.companyName) setWorkspaceName(profile.companyName);
  }, [profile]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const [roundRobinData, visibilityData] = await Promise.all([
        aicloserApi.roundRobin.update({
          enabled: rrSettings.enabled,
          mode: rrSettings.strategy === "CAPACITY_WEIGHTED" ? "LOAD_BALANCED" : "STRICT_ROUND_ROBIN",
          maxActiveLeadsPerCloser: rrSettings.maxActiveLeadsPerAgent,
        }),
        // Sync with central API and legacy /api/sales/chat-visibility
        aicloserApi.conversations.updateChatVisibility({
          visibilityMode: showOnlyAssignedChats ? "ASSIGNED_ONLY" : "COMPANY_WIDE",
        }),
      ]);
      setRrSettings((current) => ({
        ...current,
        enabled: Boolean(roundRobinData.enabled),
        strategy: roundRobinData.mode === "LOAD_BALANCED" ? "CAPACITY_WEIGHTED" : "ROUND_ROBIN",
        maxActiveLeadsPerAgent: Number(roundRobinData.maxActiveLeadsPerCloser ?? current.maxActiveLeadsPerAgent),
        updatedAt: new Date().toISOString(),
      }));
      setShowOnlyAssignedChats(visibilityData.visibilityMode === "ASSIGNED_ONLY");
      setBanner({
        tone: "success",
        text: "Round-robin and chat visibility settings saved.",
      });
      onRefreshDashboard?.();
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

  const handleSavePassword = async () => {
    setPasswordSaving(true);
    setBanner(null);
    try {
      if (passwordDraft !== passwordConfirmation) {
        setBanner({ tone: "error", text: "Passwords do not match." });
        return;
      }
      let saved = false;
      try {
        await aicloserApi.auth.changePassword(passwordDraft);
        saved = true;
      } catch {
        const response = await fetch("/api/auth/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword: currentPasswordDraft, password: passwordDraft, confirmPassword: passwordConfirmation }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          setBanner({ tone: "error", text: data.error || "Could not save password." });
          return;
        }
        saved = true;
      }
      if (saved) {
        setCurrentPasswordDraft("");
        setPasswordDraft("");
        setPasswordConfirmation("");
        setBanner({ tone: "success", text: "Workspace password saved. You can now sign in with email and password." });
      }
    } catch {
      setBanner({ tone: "error", text: "Could not save password. Please try again." });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSavePaymentQrBranding = async () => {
    setPaymentQrSaving(true);
    setBanner(null);
    try {
      const saved = await aicloserApi.payments.updateSettings({
        enabled: paymentQrBranding.enabled,
        upiId: paymentQrBranding.upiId || null,
        payeeName: paymentQrBranding.payeeName || null,
        qrBrandName: paymentQrBranding.qrBrandName || null,
        qrAccentColor: paymentQrBranding.qrAccentColor,
        qrLogoDataUrl: paymentQrBranding.qrLogoDataUrl || null,
        instructions: paymentQrBranding.instructions || null,
      });
      setPaymentQrBranding((current) => ({
        ...current,
        enabled: saved.enabled === true,
        upiId: saved.upiId ?? "",
        payeeName: saved.payeeName ?? "",
        qrBrandName: saved.qrBrandName ?? "",
        qrAccentColor: saved.qrAccentColor || current.qrAccentColor,
        instructions: saved.instructions ?? "",
        qrLogoDataUrl: typeof saved?.qrLogoDataUrl === "string" ? saved.qrLogoDataUrl : "",
      }));
      setBanner({ tone: "success", text: "UPI QR branding saved to the live workspace." });
    } catch (err: any) {
      setBanner({ tone: "error", text: err.message || "Could not save UPI QR branding." });
    } finally {
      setPaymentQrSaving(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    setGoogleDriveAction("connect");
    setBanner(null);
    try {
      const { authUrl } = await aicloserApi.integrations.googleDrive.getAuthUrl();
      window.location.assign(authUrl);
    } catch (err: any) {
      setBanner({ tone: "error", text: err.message || "Could not start Google Drive connection." });
      setGoogleDriveAction(null);
    }
  };

  const handleSaveGoogleDrive = async () => {
    setGoogleDriveSaving(true);
    setBanner(null);
    try {
      const saved = await aicloserApi.integrations.googleDrive.updateSettings({
        backupRecordings: googleDrive.backupRecordings,
        backupMedia: googleDrive.backupMedia,
      });
      setGoogleDrive({ ...DEFAULT_GOOGLE_DRIVE_STATUS, ...saved });
      setBanner({ tone: "success", text: "Google Drive recording backup settings saved." });
    } catch (err: any) {
      setBanner({ tone: "error", text: err.message || "Could not save Google Drive settings." });
    } finally {
      setGoogleDriveSaving(false);
    }
  };

  const handleTestGoogleDrive = async () => {
    setGoogleDriveAction("test");
    setBanner(null);
    try {
      const result = await aicloserApi.integrations.googleDrive.testSync();
      setGoogleDrive((current) => ({ ...current, lastSyncAt: result.timestamp, lastSyncError: undefined }));
      setBanner({ tone: "success", text: result.status === "MOCKED" ? "Google Drive demo connection is active; no external file was written." : `Google Drive verified. Test file saved in ${result.targetFolder || "Call Recordings"}.` });
    } catch (err: any) {
      setBanner({ tone: "error", text: err.message || "Google Drive verification failed." });
    } finally {
      setGoogleDriveAction(null);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    setGoogleDriveAction("disconnect");
    setBanner(null);
    try {
      await aicloserApi.integrations.googleDrive.disconnect();
      setGoogleDrive({ ...DEFAULT_GOOGLE_DRIVE_STATUS });
      setBanner({ tone: "success", text: "Google Drive disconnected. New recordings will stay in the configured recording storage." });
    } catch (err: any) {
      setBanner({ tone: "error", text: err.message || "Could not disconnect Google Drive." });
    } finally {
      setGoogleDriveAction(null);
    }
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

              {showRolePermissionsTab ? <button
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
              </button> : null}

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

              {showTeamTab ? <button
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
                <span>Team &amp; Users</span>
              </button> : null}

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
                onClick={() => setActiveTab("payment_qr")}
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
                  background: activeTab === "payment_qr" ? "rgba(255, 107, 47, 0.16)" : "transparent",
                  color: activeTab === "payment_qr" ? "#ff6b2f" : "inherit",
                }}
              >
                <QrCode size={16} />
                <span>Payment QR Branding</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("storage")}
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
                  background: activeTab === "storage" ? "rgba(255, 107, 47, 0.16)" : "transparent",
                  color: activeTab === "storage" ? "#ff6b2f" : "inherit",
                }}
              >
                <Cloud size={16} />
                <span>Google Drive Storage</span>
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
              disabled={saving || paymentQrSaving || googleDriveSaving}
              onClick={() => activeTab === "payment_qr" ? void handleSavePaymentQrBranding() : activeTab === "storage" ? void handleSaveGoogleDrive() : void handleSaveSettings()}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, marginTop: 20 }}
            >
              <Save size={15} />
              {saving || paymentQrSaving || googleDriveSaving ? "Saving..." : activeTab === "payment_qr" ? "Save QR Branding" : activeTab === "storage" ? "Save Drive Settings" : "Save Settings"}
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

              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: showOnlyAssignedChats ? "rgba(16, 185, 129, 0.1)" : "var(--closer-surface-soft)",
                  border: showOnlyAssignedChats ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.95rem", display: "block" }}>Show only assigned chats to sales users</strong>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                    Sales users see only conversations linked to their own lead assignments. Admins and managers keep workspace-wide visibility.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showOnlyAssignedChats}
                  disabled={!isAdmin}
                  onChange={(event) => setShowOnlyAssignedChats(event.target.checked)}
                  aria-label="Show only assigned chats to sales users"
                  style={{ width: 20, height: 20, flex: "0 0 auto" }}
                />
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
                    style={{ width: "100%", boxSizing: "border-box", padding: 9, borderRadius: 8, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }}
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
                    style={{ width: "100%", boxSizing: "border-box", padding: 9, borderRadius: 8, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 2: ROLES & GRANULAR PERMISSIONS */}
          {activeTab === "permissions" && showRolePermissionsTab ? (
            <div style={{ display: "grid", gap: 20 }}>
              {rolePermissionsComponent ? <div>{rolePermissionsComponent}</div> : <>
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
                    <strong style={{ fontSize: "0.95rem" }}>Allow Sales Users to Import Leads, Contacts &amp; Personal WhatsApp</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Enabled by default so each closer can import contacts and scan their own WhatsApp. Turn it off to restrict these sources to administrators.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={rrSettings.allowNonAdminImportData}
                    onChange={(e) => setRrSettings({ ...rrSettings, allowNonAdminImportData: e.target.checked })}
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

              </>}
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
          {activeTab === "team" && showTeamTab ? (
            <div style={{ display: "grid", gap: 16 }}>
              {rolePermissionsComponent ? <div>{rolePermissionsComponent}</div> : null}
              {!rolePermissionsComponent ? <>
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
              </> : null}
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

              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", background: "var(--closer-surface-soft)" }}>
                  <strong style={{ display: "block", marginBottom: 10 }}>Account details</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Full name<input value={profileName} readOnly style={{ width: "100%", boxSizing: "border-box", padding: 9, borderRadius: 8, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }} /></label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Work email<input value={profileEmail} readOnly style={{ width: "100%", boxSizing: "border-box", padding: 9, borderRadius: 8, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }} /></label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Calling phone<input value={profilePhone} readOnly style={{ width: "100%", boxSizing: "border-box", padding: 9, borderRadius: 8, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }} /></label>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Workspace Name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: 9, borderRadius: 8, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }}
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

              <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", background: "var(--closer-surface-soft)", display: "grid", gap: 10 }}>
                <div>
                  <strong style={{ display: "block" }}>Workspace password</strong>
                  <span style={{ display: "block", marginTop: 4, color: "var(--muted)", fontSize: 12 }}>Google-signup users can set a password here and use email/password login any time.</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Current password<input type="password" value={currentPasswordDraft} onChange={(event) => setCurrentPasswordDraft(event.target.value)} placeholder="Required if changing" style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }} /></label>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>New password<input minLength={8} type="password" value={passwordDraft} onChange={(event) => setPasswordDraft(event.target.value)} placeholder="At least 8 characters" style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }} /></label>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Confirm password<input minLength={8} type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Repeat password" style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 13 }} /></label>
                  <button className="sales-primary-button compact" type="button" disabled={passwordSaving || !passwordDraft || !passwordConfirmation} onClick={() => void handleSavePassword()}>{passwordSaving ? "Saving…" : "Save password"}</button>
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 6: PAYMENT QR BRANDING */}
          {activeTab === "payment_qr" ? (
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                  Payments &amp; Confirmations
                </span>
                <h3 style={{ margin: "4px 0 6px", fontSize: "1.25rem", fontWeight: 800 }}>
                  UPI QR branding
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  Set the identity customers see on payment QR checkouts. These values are saved against this live workspace and used by new payment links.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(240px, 0.75fr)", gap: 16, alignItems: "start" }}>
                <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", background: "var(--closer-surface-soft)", display: "grid", gap: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 11, background: paymentQrBranding.enabled ? "rgba(16, 185, 129, 0.1)" : "rgba(148, 163, 184, 0.08)", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))", fontSize: 13, fontWeight: 700 }}>
                    <span>
                      Enable UPI payment collection
                      <small style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 11, fontWeight: 500 }}>New QR payment links will use this workspace identity.</small>
                    </span>
                    <input type="checkbox" checked={paymentQrBranding.enabled} onChange={(event) => setPaymentQrBranding({ ...paymentQrBranding, enabled: event.target.checked })} style={{ width: 20, height: 20, accentColor: "#ff6b2f" }} />
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>UPI ID<input value={paymentQrBranding.upiId} onChange={(event) => setPaymentQrBranding({ ...paymentQrBranding, upiId: event.target.value })} placeholder="business@upi" style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 9, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }} /></label>
                    <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>Payee / business name<input value={paymentQrBranding.payeeName} onChange={(event) => setPaymentQrBranding({ ...paymentQrBranding, payeeName: event.target.value })} placeholder="Your business name" style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 9, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }} /></label>
                    <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>QR brand name<input value={paymentQrBranding.qrBrandName} onChange={(event) => setPaymentQrBranding({ ...paymentQrBranding, qrBrandName: event.target.value })} placeholder="Shown above the QR" style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 9, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13 }} /></label>
                    <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>QR accent color<input type="color" value={paymentQrBranding.qrAccentColor} onChange={(event) => setPaymentQrBranding({ ...paymentQrBranding, qrAccentColor: event.target.value })} style={{ width: "100%", minHeight: 40, padding: 3, borderRadius: 9, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)" }} /></label>
                  </div>

                  <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>
                    Brand logo
                    <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 9, border: "1px dashed var(--closer-line, #64748b)", background: "var(--closer-surface, #111827)", color: "var(--muted)", fontWeight: 600 }}>
                      <Upload size={15} />
                      <span>{paymentQrBranding.qrLogoDataUrl ? "Replace logo" : "Upload PNG, JPG or WebP"}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setPaymentQrBranding({ ...paymentQrBranding, qrLogoDataUrl: String(reader.result || "") }); reader.readAsDataURL(file); }} style={{ display: "none" }} />
                    </span>
                    <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500 }}>The logo is stored with the workspace QR branding and shown in the payment preview.</small>
                  </label>

                  <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>Payment instructions<textarea rows={3} value={paymentQrBranding.instructions} onChange={(event) => setPaymentQrBranding({ ...paymentQrBranding, instructions: event.target.value })} placeholder="Optional message shown to customers" style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 9, border: "1px solid var(--closer-line, #475569)", background: "var(--closer-surface, #111827)", color: "var(--closer-ink, #f8fafc)", fontSize: 13, resize: "vertical" }} /></label>
                </div>

                <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", background: "var(--closer-surface-soft)", display: "grid", gap: 12 }}>
                  <div>
                    <strong style={{ display: "block", fontSize: 14 }}>Customer preview</strong>
                    <span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 11 }}>How your branded payment card will look.</span>
                  </div>
                  <div style={{ padding: 14, borderRadius: 14, background: "var(--closer-surface, #111827)", border: `1px solid ${paymentQrBranding.qrAccentColor}55`, display: "grid", gap: 12, textAlign: "center" }}>
                    <div style={{ color: paymentQrBranding.qrAccentColor, fontSize: 12, fontWeight: 800, letterSpacing: "0.04em" }}>{paymentQrBranding.qrBrandName || paymentQrBranding.payeeName || "Your brand"}</div>
                    <div style={{ width: 150, height: 150, margin: "0 auto", borderRadius: 12, background: "#fff", display: "grid", placeItems: "center", position: "relative", overflow: "hidden" }}>
                      <QrCode size={112} color="#20242d" strokeWidth={1.25} />
                      {paymentQrBranding.qrLogoDataUrl ? <img src={paymentQrBranding.qrLogoDataUrl} alt="Brand logo preview" style={{ position: "absolute", width: 36, height: 36, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 3 }} /> : null}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{paymentQrBranding.payeeName || "Payee name"}</div>
                    <code style={{ color: "var(--muted)", fontSize: 11 }}>{paymentQrBranding.upiId || "business@upi"}</code>
                  </div>
                  <button className="primary-button" type="button" disabled={paymentQrSaving} onClick={() => void handleSavePaymentQrBranding()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>{paymentQrSaving ? "Saving..." : "Save QR Branding"}</button>
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 7: GOOGLE DRIVE STORAGE */}
          {activeTab === "storage" ? (
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                  Storage &amp; backups
                </span>
                <h3 style={{ margin: "4px 0 6px", fontSize: "1.25rem", fontWeight: 800 }}>
                  Google Drive call recording vault
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  Connect one Google Drive workspace. AI Closer will create a vault and a <strong>Call Recordings</strong> folder, then copy completed mobile call recordings there automatically.
                </p>
              </div>

              {googleDriveLoading ? (
                <div style={{ padding: 18, borderRadius: 14, border: "1px dashed var(--closer-line, rgba(148, 163, 184, 0.3))", color: "var(--muted)", fontSize: 13 }}>
                  Loading Google Drive connection…
                </div>
              ) : (
                <>
                  <div style={{ padding: 16, borderRadius: 14, border: `1px solid ${googleDrive.isConnected ? "rgba(16, 185, 129, 0.35)" : "var(--closer-line, rgba(148, 163, 184, 0.2))"}`, background: googleDrive.isConnected ? "rgba(16, 185, 129, 0.07)" : "var(--closer-surface-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: googleDrive.isConnected ? "rgba(16, 185, 129, 0.14)" : "rgba(148, 163, 184, 0.13)", color: googleDrive.isConnected ? "#059669" : "var(--muted)" }}>
                        {googleDrive.isConnected ? <CheckCircle2 size={21} /> : <Cloud size={21} />}
                      </div>
                      <div>
                        <strong style={{ display: "block", fontSize: 14 }}>{googleDrive.isConnected ? "Google Drive connected" : "Google Drive not connected"}</strong>
                        <span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 12 }}>{googleDrive.connectedEmail || "Connect a workspace account to enable automatic backups."}</span>
                      </div>
                    </div>
                    {googleDrive.isConnected ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="sales-secondary-button compact" disabled={googleDriveAction !== null} onClick={() => void handleTestGoogleDrive()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <RefreshCw size={14} /> {googleDriveAction === "test" ? "Testing…" : "Test folder"}
                        </button>
                        <button type="button" className="sales-secondary-button compact" disabled={googleDriveAction !== null} onClick={() => void handleDisconnectGoogleDrive()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Unplug size={14} /> {googleDriveAction === "disconnect" ? "Disconnecting…" : "Disconnect"}
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="sales-primary-button compact" disabled={googleDriveAction !== null} onClick={() => void handleConnectGoogleDrive()} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <Cloud size={15} /> {googleDriveAction === "connect" ? "Opening Google…" : "Connect Google Drive"}
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 12, padding: 16, borderRadius: 14, border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", background: "var(--closer-surface-soft)" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: 14 }}>Backup destinations</strong>
                      <span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 11 }}>Folders are created automatically after the Google account is connected.</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 11, border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.18))", background: "var(--closer-surface, rgba(255,255,255,0.4))" }}>
                        <span style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Vault folder</span>
                        <strong style={{ display: "block", marginTop: 5, fontSize: 13 }}>{googleDrive.rootFolderName}</strong>
                      </div>
                      <div style={{ padding: 12, borderRadius: 11, border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.18))", background: "var(--closer-surface, rgba(255,255,255,0.4))" }}>
                        <span style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Recordings folder</span>
                        <strong style={{ display: "block", marginTop: 5, fontSize: 13 }}>{googleDrive.recordingsFolderName || "Call Recordings"}</strong>
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 11, background: googleDrive.backupRecordings ? "rgba(16, 185, 129, 0.08)" : "rgba(148, 163, 184, 0.08)", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", fontSize: 13, fontWeight: 700 }}>
                      <span>Automatically save call recordings<small style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 11, fontWeight: 500 }}>Completed recordings from the mobile calling flow will be copied to the recordings folder.</small></span>
                      <input type="checkbox" checked={googleDrive.backupRecordings} onChange={(event) => setGoogleDrive((current) => ({ ...current, backupRecordings: event.target.checked }))} style={{ width: 20, height: 20, accentColor: "#ff6b2f" }} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 11, background: googleDrive.backupMedia ? "rgba(16, 185, 129, 0.08)" : "rgba(148, 163, 184, 0.08)", border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.2))", fontSize: 13, fontWeight: 700 }}>
                      <span>Save other CRM media<small style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 11, fontWeight: 500 }}>Keeps the existing media-backup preference ready for document and attachment sync.</small></span>
                      <input type="checkbox" checked={googleDrive.backupMedia} onChange={(event) => setGoogleDrive((current) => ({ ...current, backupMedia: event.target.checked }))} style={{ width: 20, height: 20, accentColor: "#ff6b2f" }} />
                    </label>
                  </div>

                  {googleDrive.isMockDemo ? <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#a16207", fontSize: 12 }}>Demo connection is active because Google OAuth credentials are not configured on the API. Real Drive files will be written after production OAuth credentials are added.</div> : null}
                  {googleDrive.lastSyncError ? <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#b91c1c", fontSize: 12 }}>Last backup error: {googleDrive.lastSyncError}</div> : null}
                </>
              )}
            </div>
          ) : null}

          {/* TAB 8: CUSTOM SCHEMA & FIELDS */}
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
