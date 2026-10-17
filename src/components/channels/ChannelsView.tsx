"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface Connector {
  id: string;
  name: string;
  provider: string;
  category: "Messaging" | "Telephony" | "Payments" | "Productivity" | "Webhooks";
  icon: IconName;
  description: string;
  status: "connected" | "needs_auth" | "disconnected";
  latency: string;
  uptime: string;
  scopes: string[];
  lastSync: string;
  events24h: number;
  webhookUrl: string;
  rateLimit: string;
}

export interface WebhookEvent {
  id: string;
  connectorName: string;
  event: string;
  statusCode: number;
  receivedAt: string;
  durationMs: number;
  payload: Record<string, unknown>;
  replayed?: boolean;
}

export interface FieldMapping {
  id: string;
  sourceConnector: string;
  sourceKey: string;
  crmField: string;
  transformation: string;
  isActive: boolean;
}

const DEFAULT_CONNECTORS: Connector[] = [
  {
    id: "conn-wa",
    name: "WhatsApp Cloud API",
    provider: "Meta Graph API v21.0",
    category: "Messaging",
    icon: "whatsapp",
    description: "Official Cloud API integration for instant inbound customer chats, interactive templates, and delivery webhooks.",
    status: "connected",
    latency: "38ms",
    uptime: "99.98%",
    scopes: ["whatsapp_business_messaging", "whatsapp_business_management", "messages.read", "messages.write"],
    lastSync: "Just now",
    events24h: 2840,
    webhookUrl: "https://api.aicloser.in/api/webhooks/whatsapp",
    rateLimit: "80 req/sec (Tier 2 Approved)",
  },
  {
    id: "conn-ig",
    name: "Instagram Direct Inbox",
    provider: "Meta Graph API",
    category: "Messaging",
    icon: "message",
    description: "Sync Instagram DMs, story replies, and reel comment-to-lead captures directly into Closer multi-channel chat.",
    status: "connected",
    latency: "52ms",
    uptime: "99.95%",
    scopes: ["instagram_basic", "instagram_manage_messages", "pages_show_list"],
    lastSync: "3m ago",
    events24h: 820,
    webhookUrl: "https://api.aicloser.in/api/webhooks/instagram",
    rateLimit: "60 req/min (Healthy)",
  },
  {
    id: "conn-sim",
    name: "Android SIM Call Relay",
    provider: "Closer Telephony Agent",
    category: "Telephony",
    icon: "phone",
    description: "Captures inbound SIM calls, missed calls, and audio recordings from physical Android handsets directly into CRM records.",
    status: "connected",
    latency: "19ms",
    uptime: "100.0%",
    scopes: ["telephony.calls.inbound", "telephony.recordings.stream", "telephony.missed_call.alert"],
    lastSync: "1m ago",
    events24h: 342,
    webhookUrl: "https://api.aicloser.in/api/telephony/sim-stream",
    rateLimit: "Unlimited (Peer-to-peer sync)",
  },
  {
    id: "conn-rzp",
    name: "Razorpay & UPI Webhooks",
    provider: "Razorpay Payments",
    category: "Payments",
    icon: "card",
    description: "Real-time payment capture webhooks, UPI dynamic QR confirmations, and automated Close-Won status triggers.",
    status: "connected",
    latency: "34ms",
    uptime: "100.0%",
    scopes: ["payment.captured", "payment.failed", "order.paid", "refund.processed"],
    lastSync: "14m ago",
    events24h: 184,
    webhookUrl: "https://api.aicloser.in/api/webhooks/razorpay",
    rateLimit: "120 req/min",
  },
  {
    id: "conn-gdrive",
    name: "Google Drive & Calendar",
    provider: "Google Workspace API",
    category: "Productivity",
    icon: "calendar",
    description: "Automatic audio recording backup into encrypted Drive folders and two-way Google Calendar demo booking sync.",
    status: "connected",
    latency: "94ms",
    uptime: "99.90%",
    scopes: ["calendar.events", "drive.file", "userinfo.email"],
    lastSync: "25m ago",
    events24h: 96,
    webhookUrl: "https://api.aicloser.in/api/auth/google/callback",
    rateLimit: "1,000 req/100sec (Google Quota)",
  },
  {
    id: "conn-exotel",
    name: "Exotel Cloud Telephony",
    provider: "Exotel Virtual Numbers",
    category: "Telephony",
    icon: "phone",
    description: "Centralized IVR routing, virtual agent numbers, and enterprise call distribution across field closers.",
    status: "needs_auth",
    latency: "--",
    uptime: "--",
    scopes: ["exotel.call_v2", "exotel.cdr.stream"],
    lastSync: "Not configured",
    events24h: 0,
    webhookUrl: "https://api.aicloser.in/api/webhooks/exotel",
    rateLimit: "Pending API Key",
  },
  {
    id: "conn-zapier",
    name: "Zapier & Make Automation Relay",
    provider: "Closer REST Ingestion",
    category: "Webhooks",
    icon: "plug",
    description: "Two-way webhook bridge to connect 5,000+ external apps, landing pages, and lead scrapers directly into Closer.",
    status: "connected",
    latency: "44ms",
    uptime: "99.96%",
    scopes: ["lead.create", "lead.update", "stage.trigger", "activity.log"],
    lastSync: "8m ago",
    events24h: 412,
    webhookUrl: "https://api.aicloser.in/api/webhooks/relay/v1",
    rateLimit: "200 req/min (Burst 500)",
  },
  {
    id: "conn-custom",
    name: "Custom Inbound Webhook",
    provider: "Raw JSON Webhook Endpoint",
    category: "Webhooks",
    icon: "branch",
    description: "Custom HMAC-signed webhook endpoint for custom website forms, headless checkouts, and internal databases.",
    status: "connected",
    latency: "22ms",
    uptime: "100.0%",
    scopes: ["all.inbound", "custom.signature_verify"],
    lastSync: "12m ago",
    events24h: 198,
    webhookUrl: "https://api.aicloser.in/api/webhooks/custom-listener",
    rateLimit: "500 req/min",
  },
];

const DEFAULT_WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    id: "wh-9812",
    connectorName: "WhatsApp Cloud API",
    event: "messages.inbound",
    statusCode: 200,
    receivedAt: "42s ago",
    durationMs: 28,
    payload: {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "309110298112",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "+91 98200 12345", phone_number_id: "10982310" },
                contacts: [{ profile: { name: "Rajesh Khanna" }, wa_id: "919820012345" }],
                messages: [{ from: "919820012345", id: "wamid.HBgLOTE5OD...", text: { body: "Interested in the enterprise plan. Can we talk?" } }],
              },
            },
          ],
        },
      ],
    },
  },
  {
    id: "wh-9811",
    connectorName: "Android SIM Call Relay",
    event: "call.completed",
    statusCode: 200,
    receivedAt: "2m ago",
    durationMs: 41,
    payload: {
      device_id: "POCO_X6_PRO_01",
      closer_id: "usr-aarav",
      customer_phone: "+91 98765 43210",
      direction: "INBOUND",
      duration_seconds: 245,
      disposition: "CONNECTED",
      audio_s3_url: "https://storage.aicloser.in/recordings/call_20261017_245s.mp3",
    },
  },
  {
    id: "wh-9810",
    connectorName: "Razorpay & UPI Webhooks",
    event: "payment.captured",
    statusCode: 200,
    receivedAt: "14m ago",
    durationMs: 36,
    payload: {
      entity: "event",
      account_id: "acc_L9z1029Kllq",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          id: "pay_Pk88291024",
          amount: 5000000,
          currency: "INR",
          status: "captured",
          method: "upi",
          vpa: "rohit.verma@okhdfcbank",
          contact: "+919810012345",
        },
      },
    },
  },
  {
    id: "wh-9809",
    connectorName: "Instagram Direct Inbox",
    event: "messaging_postbacks",
    statusCode: 200,
    receivedAt: "28m ago",
    durationMs: 52,
    payload: {
      object: "instagram",
      entry: [
        {
          id: "178414001928",
          time: 1760714800,
          messaging: [
            {
              sender: { id: "ig_user_448102" },
              recipient: { id: "178414001928" },
              postback: { title: "Get Closer Demo", payload: "IG_CAMPAIGN_REEL_REPLY" },
            },
          ],
        },
      ],
    },
  },
  {
    id: "wh-9808",
    connectorName: "Zapier & Make Automation Relay",
    event: "lead.create",
    statusCode: 200,
    receivedAt: "1h ago",
    durationMs: 31,
    payload: {
      source: "Zapier - Typeform Landing Page",
      full_name: "Sneha Kapur",
      company: "Kapur Retailers",
      phone: "+91 98220 99881",
      city: "Mumbai",
      budget_range: "₹1L - ₹2.5L",
    },
  },
];

const DEFAULT_MAPPINGS: FieldMapping[] = [
  { id: "map-1", sourceConnector: "WhatsApp Cloud API", sourceKey: "messages[0].from", crmField: "customerPhone", transformation: "E.164 Normalize", isActive: true },
  { id: "map-2", sourceConnector: "WhatsApp Cloud API", sourceKey: "contacts[0].profile.name", crmField: "customerName", transformation: "Trim Whitespace", isActive: true },
  { id: "map-3", sourceConnector: "Razorpay Payments", sourceKey: "payload.payment.amount", crmField: "paymentAmount (INR)", transformation: "Divide by 100", isActive: true },
  { id: "map-4", sourceConnector: "Android SIM Call Relay", sourceKey: "audio_s3_url", crmField: "recordingUrl", transformation: "Direct S3 URI", isActive: true },
  { id: "map-5", sourceConnector: "Instagram Direct Inbox", sourceKey: "sender.id", crmField: "instagramHandle", transformation: "IG Graph ID Lookup", isActive: true },
];

export function ChannelsView() {
  const [connectors, setConnectors] = useState<Connector[]>(DEFAULT_CONNECTORS);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>(DEFAULT_WEBHOOK_EVENTS);
  const [mappings, setMappings] = useState<FieldMapping[]>(DEFAULT_MAPPINGS);
  const [activeTab, setActiveTab] = useState<"connectors" | "webhooks" | "mappings" | "credentials">("connectors");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Modals state
  const [configuringConnector, setConfiguringConnector] = useState<Connector | null>(null);
  const [inspectingWebhook, setInspectingWebhook] = useState<WebhookEvent | null>(null);
  const [isNewWebhookModalOpen, setIsNewWebhookModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filtered connectors
  const filteredConnectors = connectors.filter((c) => {
    const matchesCategory = categoryFilter === "ALL" || c.category.toUpperCase() === categoryFilter.toUpperCase();
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalConnected = connectors.filter((c) => c.status === "connected").length;
  const totalEvents24h = connectors.reduce((acc, c) => acc + c.events24h, 0);

  function handleToggleConnector(id: string) {
    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === "connected" ? "disconnected" : "connected";
          return { ...c, status: nextStatus, lastSync: nextStatus === "connected" ? "Just now" : c.lastSync };
        }
        return c;
      })
    );
  }

  function handleReplayWebhook(eventItem: WebhookEvent) {
    setWebhookEvents((prev) =>
      prev.map((ev) => (ev.id === eventItem.id ? { ...ev, replayed: true, statusCode: 200 } : ev))
    );
    setBannerNotice(`✓ Replayed webhook #${eventItem.id} (${eventItem.event}) to Closer Ingestion Engine. Status 200 OK.`);
    setTimeout(() => setBannerNotice(null), 4500);
  }

  function handleTestAll() {
    setBannerNotice("⚡ Pinging all 8 connector endpoints... Latency: 32ms avg. 100% healthy.");
    setTimeout(() => setBannerNotice(null), 5000);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard?.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Top Header */}
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
            Plugins & Channels
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Connect WhatsApp Cloud API, Instagram DM, SIM Telephony, Google Calendar, and Razorpay with automated two-way CRM sync.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn" data-size="sm" onClick={handleTestAll} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <Icon name="sparkle" size={13} />
            <span>Test All Endpoints</span>
          </button>
          <button
            className="btn"
            data-size="sm"
            data-variant="primary"
            onClick={() => setIsNewWebhookModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <Icon name="plus" size={13} />
            <span>Add Custom Webhook</span>
          </button>
        </div>
      </header>

      {/* Notice Banner */}
      {bannerNotice && (
        <div
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
            color: "var(--text)",
            padding: "10px 14px",
            borderRadius: "var(--r-sm)",
            fontSize: "var(--fs-meta)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "18px",
          }}
        >
          <span>{bannerNotice}</span>
          <button
            onClick={() => setBannerNotice(null)}
            style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Top 4 Metrics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            Active Connectors
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>{totalConnected}</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>of {connectors.length} active</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "4px", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
            <span>Telephony & Messaging Healthy</span>
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            Sync Health & Latency
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>99.98%</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>avg 38ms</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Zero dropped packets in last 24h
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            Inbound Webhooks (24h)
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>{totalEvents24h.toLocaleString()}</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>events</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--accent)", marginTop: "4px" }}>
            WhatsApp & SIM Calls leading
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", fontWeight: 550 }}>
            API Quota Headroom
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, color: "var(--text)", marginTop: "4px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>14.2%</span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-tertiary)", fontWeight: 400 }}>used</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "4px" }}>
            Tier 2 Meta Graph limit verified
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="seg" style={{ marginBottom: 18, display: "inline-flex" }}>
        <button
          data-on={activeTab === "connectors"}
          onClick={() => setActiveTab("connectors")}
        >
          <Icon name="plug" size={13} />
          <span>All Connectors ({connectors.length})</span>
        </button>

        <button
          data-on={activeTab === "webhooks"}
          onClick={() => setActiveTab("webhooks")}
        >
          <Icon name="branch" size={13} />
          <span>Webhook Stream & Replay ({webhookEvents.length})</span>
        </button>

        <button
          data-on={activeTab === "mappings"}
          onClick={() => setActiveTab("mappings")}
        >
          <Icon name="layers" size={13} />
          <span>Field Mapping ({mappings.length})</span>
        </button>

        <button
          data-on={activeTab === "credentials"}
          onClick={() => setActiveTab("credentials")}
        >
          <Icon name="shield" size={13} />
          <span>Credentials & Vault</span>
        </button>
      </div>

      {/* TAB 1: CONNECTORS CATALOG */}
      {activeTab === "connectors" && (
        <div>
          {/* Subfilter & Search */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["ALL", "MESSAGING", "TELEPHONY", "PAYMENTS", "PRODUCTIVITY", "WEBHOOKS"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className="chip"
                  style={{
                    background: categoryFilter === cat ? "var(--accent-strong)" : "var(--bg-card)",
                    color: categoryFilter === cat ? "#fff" : "var(--fg-muted)",
                    borderColor: categoryFilter === cat ? "var(--accent-strong)" : "var(--border)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {cat.toLowerCase()}
                </button>
              ))}
            </div>

            <div style={{ position: "relative", minWidth: 260 }}>
              <input
                type="text"
                placeholder="Search connectors or scopes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px 6px 30px",
                  fontSize: 13,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--fg)",
                  outline: "none",
                }}
              />
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--fg-muted)", pointerEvents: "none" }}>
                <Icon name="search" size={13} />
              </span>
            </div>
          </div>

          {/* Connectors Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
            {filteredConnectors.map((connector) => {
              const isConnected = connector.status === "connected";
              const isNeedsAuth = connector.status === "needs_auth";

              return (
                <div
                  key={connector.id}
                  className="card"
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    borderRadius: 8,
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            background: "var(--bg-elevated)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--accent)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <Icon name={connector.icon} size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: 14 }}>{connector.name}</div>
                          <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{connector.provider}</div>
                        </div>
                      </div>

                      <span
                        className="chip"
                        style={{
                          fontSize: 11,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: isConnected ? "rgba(16,185,129,0.1)" : isNeedsAuth ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.05)",
                          color: isConnected ? "var(--success)" : isNeedsAuth ? "var(--warning)" : "var(--fg-muted)",
                          border: `1px solid ${isConnected ? "rgba(16,185,129,0.3)" : isNeedsAuth ? "rgba(245,158,11,0.3)" : "var(--border)"}`,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isConnected ? "var(--success)" : isNeedsAuth ? "var(--warning)" : "var(--fg-muted)",
                          }}
                        />
                        {isConnected ? "Connected" : isNeedsAuth ? "Needs Auth" : "Disconnected"}
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5, marginBottom: 14, minHeight: 36 }}>
                      {connector.description}
                    </p>

                    {/* Meta stats */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        padding: "10px 12px",
                        background: "var(--bg-elevated)",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        fontSize: 11,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--fg-muted)" }}>Latency / SLA: </span>
                        <strong style={{ color: "var(--fg)" }}>{connector.latency}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--fg-muted)" }}>Uptime: </span>
                        <strong style={{ color: "var(--success)" }}>{connector.uptime}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--fg-muted)" }}>Events (24h): </span>
                        <strong style={{ color: "var(--fg)" }}>{connector.events24h.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--fg-muted)" }}>Last Sync: </span>
                        <strong style={{ color: "var(--fg)" }}>{connector.lastSync}</strong>
                      </div>
                    </div>

                    {/* Scopes Chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                      {connector.scopes.slice(0, 3).map((scope) => (
                        <span
                          key={scope}
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono, monospace)",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid var(--border)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            color: "var(--fg-muted)",
                          }}
                        >
                          {scope}
                        </span>
                      ))}
                      {connector.scopes.length > 3 && (
                        <span style={{ fontSize: 10, color: "var(--fg-muted)", alignSelf: "center" }}>
                          +{connector.scopes.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => setConfiguringConnector(connector)}
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}
                    >
                      <Icon name="settings" size={12} />
                      <span>Configure</span>
                    </button>

                    <button
                      className={`btn btn-sm ${isConnected ? "" : "btn-primary"}`}
                      onClick={() => handleToggleConnector(connector.id)}
                      style={{
                        fontSize: 12,
                        cursor: "pointer",
                        background: isConnected ? "rgba(239, 68, 68, 0.1)" : undefined,
                        color: isConnected ? "var(--danger)" : undefined,
                        borderColor: isConnected ? "rgba(239, 68, 68, 0.3)" : undefined,
                      }}
                    >
                      {isConnected ? "Disconnect" : isNeedsAuth ? "Authenticate" : "Connect"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: WEBHOOK STREAM & REPLAY */}
      {activeTab === "webhooks" && (
        <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, overflow: "hidden" }}>
          <div className="card-head" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className="card-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                Live Inbound Webhook Payload Log
              </span>
              <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                Every event delivered to Closer with latency benchmarking, HMAC verification, and 1-click test replay.
              </p>
            </div>
            <span className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", color: "var(--success)", borderColor: "rgba(16,185,129,0.3)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
              Live Ingestion Active
            </span>
          </div>

          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--fg-muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 16px" }}>Event ID</th>
                  <th style={{ padding: "10px 16px" }}>Connector</th>
                  <th style={{ padding: "10px 16px" }}>Trigger Event</th>
                  <th style={{ padding: "10px 16px" }}>HTTP Status</th>
                  <th style={{ padding: "10px 16px" }}>Latency</th>
                  <th style={{ padding: "10px 16px" }}>Received</th>
                  <th style={{ padding: "10px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhookEvents.map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono, monospace)", color: "var(--fg-muted)", fontSize: 12 }}>
                      {ev.id}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--fg)" }}>
                      {ev.connectorName}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-mono, monospace)",
                          background: "var(--bg-elevated)",
                          padding: "3px 8px",
                          borderRadius: 4,
                          border: "1px solid var(--border)",
                          color: "var(--accent)",
                        }}
                      >
                        {ev.event}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className="chip"
                        style={{
                          fontSize: 11,
                          background: ev.statusCode === 200 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          color: ev.statusCode === 200 ? "var(--success)" : "var(--danger)",
                          borderColor: ev.statusCode === 200 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                        }}
                      >
                        {ev.statusCode} OK
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", fontSize: 12 }}>
                      {ev.durationMs}ms
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", fontSize: 12 }}>
                      {ev.receivedAt}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => setInspectingWebhook(ev)}
                          style={{ fontSize: 11, padding: "4px 8px", cursor: "pointer" }}
                        >
                          Inspect JSON
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleReplayWebhook(ev)}
                          disabled={ev.replayed}
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            cursor: ev.replayed ? "default" : "pointer",
                            background: ev.replayed ? "rgba(16,185,129,0.1)" : undefined,
                            color: ev.replayed ? "var(--success)" : undefined,
                          }}
                        >
                          {ev.replayed ? "Replayed ✓" : "Replay"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FIELD MAPPINGS */}
      {activeTab === "mappings" && (
        <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, overflow: "hidden" }}>
          <div className="card-head" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className="card-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                CRM Ingestion Field Mappings
              </span>
              <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                Route incoming JSON keys directly into canonical Closer lead profile fields.
              </p>
            </div>
            <button className="btn btn-sm btn-primary" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="plus" size={12} />
              <span>Add Custom Field Rule</span>
            </button>
          </div>

          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--fg-muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 16px" }}>Source Connector</th>
                  <th style={{ padding: "10px 16px" }}>Payload Source Key</th>
                  <th style={{ padding: "10px 16px" }}>Target CRM Field</th>
                  <th style={{ padding: "10px 16px" }}>Transformation</th>
                  <th style={{ padding: "10px 16px" }}>Status</th>
                  <th style={{ padding: "10px 16px", textAlign: "right" }}>Toggle</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--fg)" }}>
                      {m.sourceConnector}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono, monospace)", color: "var(--accent)", fontSize: 12 }}>
                      {m.sourceKey}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--fg)" }}>
                      {m.crmField}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-muted)", fontSize: 12 }}>
                      <span style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>
                        {m.transformation}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className="chip"
                        style={{
                          fontSize: 11,
                          background: m.isActive ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                          color: m.isActive ? "var(--success)" : "var(--fg-muted)",
                          borderColor: m.isActive ? "rgba(16,185,129,0.3)" : "var(--border)",
                        }}
                      >
                        {m.isActive ? "Active Sync" : "Disabled"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        className="btn btn-sm"
                        onClick={() =>
                          setMappings((prev) =>
                            prev.map((item) => (item.id === m.id ? { ...item, isActive: !item.isActive } : item))
                          )
                        }
                        style={{ fontSize: 11, cursor: "pointer" }}
                      >
                        {m.isActive ? "Deactivate" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CREDENTIALS VAULT */}
      {activeTab === "credentials" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
              Encrypted API Secrets Vault
            </h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 16 }}>
              Production tokens stored in AES-256 encrypted storage. Shared securely across webhook workers.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "META_WHATSAPP_SYSTEM_TOKEN", val: "EAAW2091...8f91", updated: "3 days ago" },
                { name: "RAZORPAY_WEBHOOK_SECRET", val: "whsec_991829...4102", updated: "12 days ago" },
                { name: "GOOGLE_WORKSPACE_CLIENT_SECRET", val: "GOCSPX-201...9218", updated: "1 month ago" },
                { name: "CLOSER_INBOUND_HMAC_KEY", val: "cls_hmac_881...2219", updated: "Just now" },
              ].map((token) => (
                <div
                  key={token.name}
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-mono, monospace)" }}>
                      {token.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                      {token.val} · Rotated {token.updated}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => copyToClipboard(token.val, token.name)}
                    style={{ fontSize: 11, cursor: "pointer" }}
                  >
                    {copiedKey === token.name ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 8, padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
              Global Webhook Ingestion URL
            </h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 14 }}>
              Use this canonical base endpoint for setting up your Meta Developers, Zapier, or custom backends.
            </p>

            <div
              style={{
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                borderRadius: 6,
                border: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 12, fontFamily: "var(--font-mono, monospace)", color: "var(--accent)" }}>
                https://api.aicloser.in/api/webhooks/v1/ingest
              </span>
              <button
                className="btn btn-sm"
                onClick={() => copyToClipboard("https://api.aicloser.in/api/webhooks/v1/ingest", "global-endpoint")}
                style={{ fontSize: 11, cursor: "pointer" }}
              >
                {copiedKey === "global-endpoint" ? "Copied ✓" : "Copy"}
              </button>
            </div>

            <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Verify Token for Handshake:</div>
              <code style={{ background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: 4, color: "var(--fg)" }}>
                aicloser_meta_webhook_verify_2026
              </code>
              <p style={{ marginTop: 12 }}>
                All incoming POST requests require valid SHA256 signature verification in the <code>X-Hub-Signature-256</code> header.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURE CONNECTOR */}
      {configuringConnector && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setConfiguringConnector(null)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connector-dialog-title"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              maxWidth: 540,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name={configuringConnector.icon} size={18} />
                <h2 id="connector-dialog-title" style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
                  Configure {configuringConnector.name}
                </h2>
              </div>
              <button
                aria-label="Close dialog"
                onClick={() => setConfiguringConnector(null)}
                style={{ background: "transparent", border: "none", color: "var(--fg-muted)", cursor: "pointer" }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="connector-webhook-url" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Webhook Callback Endpoint
                </label>
                <input
                  id="connector-webhook-url"
                  type="text"
                  readOnly
                  value={configuringConnector.webhookUrl}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 12,
                    fontFamily: "var(--font-mono, monospace)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Subscribed Permissions & Scopes
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {configuringConnector.scopes.map((s) => (
                    <span
                      key={s}
                      style={{
                        fontSize: 11,
                        background: "rgba(94, 106, 210, 0.1)",
                        border: "1px solid var(--accent)",
                        padding: "3px 8px",
                        borderRadius: 4,
                        color: "var(--fg)",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="connector-rate-limit" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Rate Limit Quota
                </label>
                <input
                  id="connector-rate-limit"
                  type="text"
                  readOnly
                  value={configuringConnector.rateLimit}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 12,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg-muted)",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setConfiguringConnector(null)}
                  style={{ cursor: "pointer" }}
                >
                  Close
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setBannerNotice(`✓ Handshake verified for ${configuringConnector.name}. 100% synchronized.`);
                    setConfiguringConnector(null);
                    setTimeout(() => setBannerNotice(null), 4000);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  Verify Handshake
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT PAYLOAD */}
      {inspectingWebhook && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setInspectingWebhook(null)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="webhook-payload-dialog-title"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              maxWidth: 620,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h2 id="webhook-payload-dialog-title" style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>
                  Webhook Payload: #{inspectingWebhook.id}
                </h2>
                <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  {inspectingWebhook.connectorName} · {inspectingWebhook.event} · {inspectingWebhook.receivedAt}
                </span>
              </div>
              <button
                aria-label="Close dialog"
                onClick={() => setInspectingWebhook(null)}
                style={{ background: "transparent", border: "none", color: "var(--fg-muted)", cursor: "pointer" }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <pre
              role="region"
              aria-label="Webhook payload JSON"
              tabIndex={0}
              style={{
                background: "var(--bg-elevated)",
                padding: 14,
                borderRadius: 6,
                border: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text-secondary)",
                maxHeight: 380,
                overflowY: "auto",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {JSON.stringify(inspectingWebhook.payload, null, 2)}
            </pre>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <button
                className="btn btn-sm"
                onClick={() => copyToClipboard(JSON.stringify(inspectingWebhook.payload, null, 2), "payload")}
                style={{ cursor: "pointer" }}
              >
                {copiedKey === "payload" ? "Copied ✓" : "Copy Raw JSON"}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  handleReplayWebhook(inspectingWebhook);
                  setInspectingWebhook(null);
                }}
                style={{ cursor: "pointer" }}
              >
                Replay to Pipeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOM WEBHOOK */}
      {isNewWebhookModalOpen && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setIsNewWebhookModalOpen(false)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-webhook-dialog-title"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              maxWidth: 500,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 id="new-webhook-dialog-title" style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
                Add Custom Inbound Webhook
              </h2>
              <button
                aria-label="Close dialog"
                onClick={() => setIsNewWebhookModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--fg-muted)", cursor: "pointer" }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="new-webhook-name" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Webhook Name
                </label>
                <input
                  id="new-webhook-name"
                  type="text"
                  placeholder="e.g. WordPress Elementor Inbound Form"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="new-webhook-stage" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  Target CRM Pipeline Stage
                </label>
                <select
                  id="new-webhook-stage"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                  }}
                >
                  <option value="new">New Lead (Inbox)</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                </select>
              </div>

              <div>
                <label htmlFor="new-webhook-hmac" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 5 }}>
                  HMAC Secret (Optional)
                </label>
                <input
                  id="new-webhook-hmac"
                  type="password"
                  placeholder="whsec_custom_••••••••"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setIsNewWebhookModalOpen(false)}
                  style={{ cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setBannerNotice("✓ Custom Webhook endpoint created! Ready for incoming POST requests.");
                    setIsNewWebhookModalOpen(false);
                    setTimeout(() => setBannerNotice(null), 4000);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  Create Endpoint
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
