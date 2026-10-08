"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Instagram,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  QrCode,
  ShieldCheck,
  Sparkles,
  Webhook,
} from "lucide-react";

type PluginCardId =
  | "whatsapp_scanner"
  | "whatsapp_cloud_api"
  | "instagram_api"
  | "email_smtp_imap"
  | "sheets_excel_sync"
  | "ai_bot_webhook";

type PluginsHubProps = {
  tenantId?: string;
  whatsAppCloudStatus?: string;
  instagramStatus?: string;
  onOpenContactsImportDrawer?: (
    drawer: "whatsapp_scanner" | "sheets_excel" | "email_inbox" | "manual_add",
  ) => void;
  onOpenTab?: (tab: string) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenMultiChannelChat?: (conversationId?: string | null) => void;
  whatsAppCloudPanel?: ReactNode;
  instagramPluginPanel?: ReactNode;
};

export function PluginsHub({
  tenantId,
  whatsAppCloudStatus = "Ready for webhook",
  instagramStatus = "Plugin enabled",
  onOpenContactsImportDrawer,
  onOpenTab,
  onNavigateTab,
  onOpenMultiChannelChat,
  whatsAppCloudPanel,
  instagramPluginPanel,
}: PluginsHubProps) {
  const [selectedPlugin, setSelectedPlugin] = useState<PluginCardId>("whatsapp_scanner");
  const configurationRef = useRef<HTMLDivElement>(null);

  function openPluginConfiguration(pluginId: PluginCardId) {
    setSelectedPlugin(pluginId);
  }

  useEffect(() => {
    if (selectedPlugin === "whatsapp_scanner") return;
    window.requestAnimationFrame(() => configurationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [selectedPlugin]);

  const plugins: Array<{
    id: PluginCardId;
    title: string;
    category: string;
    statusLabel: string;
    statusColor: string;
    accent: string;
    icon: typeof QrCode;
    description: string;
    highlights: string[];
    primaryCtaLabel: string;
  }> = [
    {
      id: "whatsapp_scanner",
      title: "WhatsApp QR Scanner & Contact Scraper",
      category: "WhatsApp Business & Normal WhatsApp",
      statusLabel: "Dual-Mode Ready",
      statusColor: "#10b981",
      accent: "#10b981",
      icon: QrCode,
      description:
        "Scan any WhatsApp Business or Normal Personal WhatsApp QR code. Choose between syncing full chats + contacts into the Multi-Channel Inbox OR scraping contact phone numbers only.",
      highlights: [
        "Mode A: Sync WhatsApp Business / Personal Chats + Contacts to Multi-Channel Inbox",
        "Mode B: Scrape 1:1 Chat & WhatsApp Group Phone Numbers Only (Zero Inbox Clutter)",
        "Team Shared Inbox toggle so teammates can view & reply even without their own WhatsApp linked",
      ],
      primaryCtaLabel: "Launch QR Scanner & Scraper",
    },
    {
      id: "whatsapp_cloud_api",
      title: "Official WhatsApp Cloud API (v22.0)",
      category: "Meta Business WABA & Green Tick",
      statusLabel: whatsAppCloudStatus || "Configured",
      statusColor: "#ff6b2f",
      accent: "#ff6b2f",
      icon: MessageCircle,
      description:
        "Connect your official Meta WhatsApp Business Account (WABA) for high-volume broadcast templates, interactive flows, CTWA ad attribution, and verified business messaging.",
      highlights: [
        "1-Click Meta Embedded Signup & Permanent System User Token",
        "Real-time Webhook delivery receipts (Sent, Delivered, Read) & Template Sync",
        "Supports bulk WhatsApp Marketing campaigns & automated payment links",
      ],
      primaryCtaLabel: "Configure WhatsApp Cloud API",
    },
    {
      id: "instagram_api",
      title: "Instagram DM & Lead Automation API",
      category: "Meta Graph API • DMs & Comments",
      statusLabel: instagramStatus || "Connected",
      statusColor: "#ec4899",
      accent: "#ec4899",
      icon: Instagram,
      description:
        "Route Instagram Business DMs, Story Mentions, and Comment-to-DM inquiries directly into your Live Multi-Channel Chat inbox and CRM pipeline.",
      highlights: [
        "Unified Instagram DM threads alongside WhatsApp & Email in one inbox",
        "Auto-captures Instagram lead handles & phone numbers into Contacts",
        "Supports 24/7 AI Sales Closer auto-replies on Instagram DMs",
      ],
      primaryCtaLabel: "Configure Instagram API",
    },
    {
      id: "email_smtp_imap",
      title: "Email Inbox & Enquiry Lead Sync (Gmail / Zoho / GoDaddy / SMTP)",
      category: "Universal IMAP + SMTP Enquiry Engine",
      statusLabel: "Gmail • Zoho • GoDaddy",
      statusColor: "#8b5cf6",
      accent: "#8b5cf6",
      icon: Mail,
      description:
        "Connect Gmail, Zoho Mail (.in / .com / imappro), GoDaddy Mail (M365 & Workspace), or any custom SMTP/IMAP server to capture inbound enquiry leads and reply from the CRM.",
      highlights: [
        "1-Click presets for Gmail, Zoho Mail, GoDaddy Mail & Custom IMAP/SMTP",
        "Unwraps Reply-To webforms (IndiaMART, Website Forms, JustDial) to capture the real buyer",
        "Automatically extracts E.164 phone numbers (+91...) from email bodies & signatures",
      ],
      primaryCtaLabel: "Connect Gmail / Zoho / GoDaddy / SMTP",
    },
    {
      id: "sheets_excel_sync",
      title: "Google Sheets & Excel (.xlsx / .csv) Contact Sync",
      category: "Bulk Spreadsheet & Live Sheet Importer",
      statusLabel: "Active Importer",
      statusColor: "#3b82f6",
      accent: "#3b82f6",
      icon: FileSpreadsheet,
      description:
        "Import thousands of phone numbers and leads from Google Sheets links, Excel workbooks (.xlsx / .xls), or CSV files with automatic E.164 normalization and deduplication.",
      highlights: [
        "Direct Google Sheets URL live CSV fetcher & column mapper",
        "Drag-and-drop Excel (.xlsx / .xls) & CSV uploader + raw phone paste",
        "Syncs simultaneously to Unified Contacts Directory & CRM Pipeline",
      ],
      primaryCtaLabel: "Import from Google Sheets / Excel",
    },
    {
      id: "ai_bot_webhook",
      title: "24/7 AI Sales Qualification Bot & Lead Webhooks",
      category: "Autonomous AI Closer + Inbound Webhooks",
      statusLabel: "AI Active",
      statusColor: "#f59e0b",
      accent: "#f59e0b",
      icon: Bot,
      description:
        "Let the AI Sales Closer qualify WhatsApp & Instagram leads 24/7, or push leads from WordPress, Elementor, Shopify, Typeform, and Facebook Lead Ads via webhook.",
      highlights: [
        "Per-chat Human / AI toggle directly inside Live Multi-Channel Chat",
        "Custom qualification prompts, objection handling & auto-stage progression",
        "Instant JSON Webhook endpoint for external landing pages & ad forms",
      ],
      primaryCtaLabel: "Configure AI Bot & Webhooks",
    },
  ];

  return (
    <div style={{ display: "grid", gap: 22 }}>
      {/* Top Header Banner */}
      <div
        className="crm-panel"
        style={{
          padding: 24,
          borderRadius: 18,
          background:
            "linear-gradient(135deg, rgba(255, 107, 47, 0.12) 0%, rgba(139, 92, 246, 0.08) 55%, rgba(16, 185, 129, 0.08) 100%)",
          border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.28))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(255, 107, 47, 0.16)",
                  color: "#ff6b2f",
                }}
              >
                Omnichannel Plugins & Integrations Hub
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                }}
              >
                6 Native CRM Plugins Active
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>
              Plugins, Scanners & Multi-Channel Connectors
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: "0.88rem", color: "var(--muted)", maxWidth: 780 }}>
              Connect all your communication and lead generation channels in one place: <strong>WhatsApp QR Scanner & Scraper</strong>,{" "}
              <strong>Official WhatsApp Cloud API</strong>, <strong>Instagram API</strong>, <strong>Gmail / Zoho / GoDaddy SMTP & IMAP</strong>, and{" "}
              <strong>Google Sheets / Excel Sync</strong>.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onOpenTab?.("contacts")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <Globe size={15} /> Open Unified Contacts Hub
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => onOpenTab?.("conversations")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <MessageSquare size={15} /> Open Multi-Channel Chat
            </button>
          </div>
        </div>
      </div>

      {/* 6 Plugin Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
          gap: 16,
        }}
      >
        {plugins.map((plugin) => {
          const Icon = plugin.icon;
          const isSelected = selectedPlugin === plugin.id;
          return (
            <div
              key={plugin.id}
              className="crm-panel"
              style={{
                padding: 20,
                borderRadius: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isSelected
                  ? `2px solid ${plugin.accent}`
                  : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                transition: "all 0.16s ease",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: `${plugin.accent}22`,
                        color: plugin.accent,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={21} />
                    </span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                        {plugin.category}
                      </div>
                      <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800 }}>{plugin.title}</h3>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: `${plugin.statusColor}20`,
                      color: plugin.statusColor,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {plugin.statusLabel}
                  </span>
                </div>

                <p style={{ margin: "0 0 12px", fontSize: "0.83rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  {plugin.description}
                </p>

                <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
                  {plugin.highlights.map((point) => (
                    <div
                      key={point}
                      style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: "0.79rem", lineHeight: 1.4 }}
                    >
                      <CheckCircle2 size={14} color={plugin.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--closer-line, rgba(148, 163, 184, 0.16))" }}>
                {plugin.id === "whatsapp_scanner" ? (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => onOpenContactsImportDrawer?.("whatsapp_scanner")}
                      style={{
                        flex: 1,
                        fontSize: 12.5,
                        background: "#10b981",
                        borderColor: "#10b981",
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <QrCode size={14} /> {plugin.primaryCtaLabel}
                    </button>
                  </>
                ) : null}

                {plugin.id === "whatsapp_cloud_api" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => openPluginConfiguration("whatsapp_cloud_api")}
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ShieldCheck size={14} /> {plugin.primaryCtaLabel}
                  </button>
                ) : null}

                {plugin.id === "instagram_api" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => openPluginConfiguration("instagram_api")}
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      background: "#ec4899",
                      borderColor: "#ec4899",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Instagram size={14} /> {plugin.primaryCtaLabel}
                  </button>
                ) : null}

                {plugin.id === "email_smtp_imap" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onOpenContactsImportDrawer?.("email_inbox")}
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      background: "#8b5cf6",
                      borderColor: "#8b5cf6",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Mail size={14} /> {plugin.primaryCtaLabel}
                  </button>
                ) : null}

                {plugin.id === "sheets_excel_sync" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onOpenContactsImportDrawer?.("sheets_excel")}
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      background: "#3b82f6",
                      borderColor: "#3b82f6",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <FileSpreadsheet size={14} /> {plugin.primaryCtaLabel}
                  </button>
                ) : null}

                {plugin.id === "ai_bot_webhook" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => (onNavigateTab ? onNavigateTab("automations") : onOpenTab?.("automations"))}
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Sparkles size={14} /> {plugin.primaryCtaLabel}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Embedded Plugin Configuration Section */}
      {selectedPlugin === "whatsapp_cloud_api" && whatsAppCloudPanel ? (
        <div className="crm-panel" ref={configurationRef} style={{ padding: 20, borderRadius: 18, scrollMarginTop: 20 }} tabIndex={-1}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b2f", textTransform: "uppercase" }}>
                Active Plugin Configuration
              </span>
              <h3 style={{ margin: "4px 0 0", fontSize: "1.1rem" }}>
                Official WhatsApp Cloud API (v22.0) Setup
              </h3>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(255, 107, 47, 0.08)", border: "1px solid rgba(255, 107, 47, 0.18)" }}>
            <strong style={{ fontSize: "0.86rem" }}>WhatsApp bulk marketing onboarding</strong>
            <span style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
              Connect WABA → register the phone → subscribe the webhook → sync approved templates. Bulk sends still require Meta approval, customer opt-in, and compliant marketing templates.
            </span>
          </div>
          {whatsAppCloudPanel}
        </div>
      ) : null}

      {selectedPlugin === "instagram_api" && instagramPluginPanel ? (
        <div className="crm-panel" ref={configurationRef} style={{ padding: 20, borderRadius: 18, scrollMarginTop: 20 }} tabIndex={-1}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ec4899", textTransform: "uppercase" }}>
                Active Plugin Configuration
              </span>
              <h3 style={{ margin: "4px 0 0", fontSize: "1.1rem" }}>
                Instagram DM & Lead Automation API Setup
              </h3>
            </div>
          </div>
          {instagramPluginPanel}
        </div>
      ) : null}
    </div>
  );
}
