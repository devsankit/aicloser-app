"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export interface WhatsAppCampaign {
  id: string;
  name: string;
  templateName: string;
  audienceName: string;
  targetCount: number;
  deliveredCount: number;
  readCount: number;
  replyCount: number;
  status: "running" | "completed" | "scheduled";
  sentAt: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: "MARKETING" | "UTILITY";
  status: "APPROVED" | "PENDING" | "REJECTED";
  language: string;
  headerType: "IMAGE" | "DOCUMENT" | "NONE";
  bodyText: string;
  buttons: string[];
  lastUpdated: string;
}

const DEFAULT_CAMPAIGNS: WhatsAppCampaign[] = [
  {
    id: "camp-01",
    name: "Q4 Closer CRM Early Bird Drip",
    templateName: "commercial_offer_v3",
    audienceName: "Negotiation Stage (18 leads)",
    targetCount: 18,
    deliveredCount: 18,
    readCount: 16,
    replyCount: 5,
    status: "completed",
    sentAt: "Today, 11:00 AM",
  },
  {
    id: "camp-02",
    name: "Webinar Broker Attendees Broadcast",
    templateName: "webinar_replay_access",
    audienceName: "Broker Playbook Downloads (65 leads)",
    targetCount: 65,
    deliveredCount: 64,
    readCount: 56,
    replyCount: 9,
    status: "completed",
    sentAt: "Yesterday, 4:00 PM",
  },
  {
    id: "camp-03",
    name: "Overdue Follow-up Re-engagement",
    templateName: "followup_checkin_direct",
    audienceName: "Stalled Leads (> 5 days inactive)",
    targetCount: 42,
    deliveredCount: 42,
    readCount: 38,
    replyCount: 7,
    status: "completed",
    sentAt: "14 Oct 2026",
  },
];

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "tmpl-01",
    name: "commercial_offer_v3",
    category: "MARKETING",
    status: "APPROVED",
    language: "en_US",
    headerType: "IMAGE",
    bodyText: "Hi {{1}}, here is the customized commercial proposal for {{2}}. Unlock unlimited SIM call recording, WhatsApp Cloud team CRM, and automated lead routing for your team.",
    buttons: ["Book Demo Walkthrough", "Chat with Closer", "Stop Promo"],
    lastUpdated: "Approved 2 days ago",
  },
  {
    id: "tmpl-02",
    name: "webinar_replay_access",
    category: "MARKETING",
    status: "APPROVED",
    language: "en_US",
    headerType: "DOCUMENT",
    bodyText: "Hello {{1}}! As requested, here is your direct copy of the 2026 High-Ticket Closer Playbook. Would you like a 10-minute demo of how our Android SIM tracker automates this?",
    buttons: ["Watch Replay", "Schedule Call"],
    lastUpdated: "Approved 1 week ago",
  },
  {
    id: "tmpl-03",
    name: "followup_checkin_direct",
    category: "UTILITY",
    status: "APPROVED",
    language: "en_US",
    headerType: "NONE",
    bodyText: "Hi {{1}}, {{2}} here from Closer AI. Following up on our discussion regarding {{3}}. Would 4:30 PM today or tomorrow work for a quick review?",
    buttons: ["Yes, today works", "Send Details Here"],
    lastUpdated: "Approved 2 weeks ago",
  },
  {
    id: "tmpl-04",
    name: "payment_receipt_instant",
    category: "UTILITY",
    status: "APPROVED",
    language: "en_US",
    headerType: "DOCUMENT",
    bodyText: "Payment Confirmed! Thank you {{1}}, your advance payment of ₹{{2}} has been verified. Your Closer workspace is now unlocked.",
    buttons: ["Download Receipt", "Open Dashboard"],
    lastUpdated: "Approved 1 month ago",
  },
];

export function WhatsAppMarketingView() {
  const [tab, setTab] = useState<"campaigns" | "templates" | "audience">("campaigns");
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>(DEFAULT_CAMPAIGNS);
  const [templates] = useState<WhatsAppTemplate[]>(DEFAULT_TEMPLATES);
  const [isNewCampOpen, setIsNewCampOpen] = useState(false);

  // New Campaign Form State
  const [campName, setCampName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("commercial_offer_v3");
  const [selectedAudience, setSelectedAudience] = useState("Negotiation Stage (18 leads)");
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const handleLaunchCampaign = () => {
    if (!campName.trim()) return;

    const newCamp: WhatsAppCampaign = {
      id: `camp-${Date.now()}`,
      name: campName.trim(),
      templateName: selectedTemplate,
      audienceName: selectedAudience,
      targetCount: 18,
      deliveredCount: 18,
      readCount: 1,
      replyCount: 0,
      status: "running",
      sentAt: "Just now",
    };

    setCampaigns([newCamp, ...campaigns]);
    setIsNewCampOpen(false);
    setCampName("");
    setSuccessBanner(`Campaign "${newCamp.name}" broadcasted successfully via Meta WABA!`);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <header className="page-head" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
            WhatsApp Marketing & Campaigns
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Broadcast approved Meta Cloud API templates, segment CRM audience stages, and track read rates and client replies.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {successBanner && (
            <span className="chip" data-tone="success" style={{ padding: "4px 10px" }}>
              <Icon name="check" size={13} /> {successBanner}
            </span>
          )}
          <button className="btn" data-variant="primary" onClick={() => setIsNewCampOpen(true)}>
            <Icon name="plus" size={13} /> New Broadcast Campaign
          </button>
        </div>
      </header>

      {/* Metric Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Messages Delivered
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            14,250 <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>sent</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="dot" style={{ background: "var(--success)" }} /> 99.4% Delivery rate
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Average Read Rate
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--accent)" }}>
            86.2%
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Double blue ticks verified
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Inbound Replies
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            1,180 <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>leads</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            8.3% Direct reply-to-chat conversion
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Meta WABA Tier
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--success)" }}>
            Tier 2
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            High Quality • 10k messages/day
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
        <div className="seg">
          <button data-on={tab === "campaigns"} onClick={() => setTab("campaigns")}>
            <Icon name="whatsapp" size={13} /> Campaigns ({campaigns.length})
          </button>
          <button data-on={tab === "templates"} onClick={() => setTab("templates")}>
            <Icon name="message" size={13} /> Approved Templates ({templates.length})
          </button>
          <button data-on={tab === "audience"} onClick={() => setTab("audience")}>
            <Icon name="users" size={13} /> CRM Audiences (3)
          </button>
        </div>
      </div>

      {/* Tab 1: Campaigns */}
      {tab === "campaigns" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "260px" }}>Campaign Name</th>
                  <th>Template</th>
                  <th>Target Segment</th>
                  <th>Delivered</th>
                  <th>Read Rate</th>
                  <th>Replies</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Sent Time</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const readPct = Math.round((c.readCount / Math.max(1, c.deliveredCount)) * 100);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{c.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>ID: {c.id}</div>
                      </td>
                      <td>
                        <span className="chip" style={{ fontSize: "11px", fontFamily: "var(--mono)" }}>
                          {c.templateName}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>
                        {c.audienceName}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{c.deliveredCount}</span> / {c.targetCount}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 600, color: "var(--accent)" }}>{readPct}%</span>
                          <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>({c.readCount})</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--success)" }}>{c.replyCount}</span> replies
                      </td>
                      <td>
                        <span
                          className="chip"
                          data-tone={c.status === "completed" ? "success" : "accent"}
                          style={{ fontSize: "11px" }}
                        >
                          <span className="dot" style={{ background: c.status === "completed" ? "var(--success)" : "var(--accent)" }} />
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                        {c.sentAt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Approved Templates */}
      {tab === "templates" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          {templates.map((t) => (
            <div key={t.id} className="card" style={{ padding: "16px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>
                  <Icon name="check" size={11} /> {t.status}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  {t.category} • {t.language}
                </span>
              </div>

              <div style={{ fontWeight: 650, fontSize: "var(--fs-meta)", fontFamily: "var(--mono)", color: "var(--accent)" }}>
                {t.name}
              </div>

              {t.headerType !== "NONE" && (
                <div style={{ background: "var(--bg-soft)", padding: "6px 10px", borderRadius: "4px", fontSize: "11px", color: "var(--text-tertiary)", margin: "8px 0", border: "1px dashed var(--border)" }}>
                  📎 Header Attachment: {t.headerType}
                </div>
              )}

              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text)", lineHeight: 1.5, margin: "10px 0", background: "var(--bg-surface)", padding: "10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                {t.bodyText}
              </p>

              <div style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "6px" }}>CTA Buttons:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {t.buttons.map((b) => (
                    <span key={b} className="chip" style={{ fontSize: "11px", background: "var(--bg-hover)" }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Audience Segments */}
      {tab === "audience" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 650, fontSize: "var(--fs-meta)" }}>Negotiation & Quote Sent</span>
              <span className="chip" data-tone="accent">18 leads</span>
            </div>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "6px" }}>
              Leads who have received a commercial quote but have not completed settlement in the last 48 hours.
            </p>
            <button className="btn" data-size="sm" data-variant="primary" onClick={() => { setSelectedAudience("Negotiation Stage (18 leads)"); setIsNewCampOpen(true); }} style={{ marginTop: "12px", width: "100%" }}>
              Broadcast to this Segment
            </button>
          </div>

          <div className="card" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 650, fontSize: "var(--fs-meta)" }}>Stalled Leads (&gt; 5 Days)</span>
              <span className="chip" data-tone="warning">42 leads</span>
            </div>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "6px" }}>
              Contacts where no call or WhatsApp message has occurred in 5 days. High risk of losing interest.
            </p>
            <button className="btn" data-size="sm" data-variant="primary" onClick={() => { setSelectedAudience("Stalled Leads (42 leads)"); setIsNewCampOpen(true); }} style={{ marginTop: "12px", width: "100%" }}>
              Broadcast to this Segment
            </button>
          </div>

          <div className="card" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 650, fontSize: "var(--fs-meta)" }}>Demo Booked (Walkthrough Prep)</span>
              <span className="chip" data-tone="success">12 leads</span>
            </div>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "6px" }}>
              Upcoming booked product walkthroughs. Send preparation guide and calendar Google Meet link.
            </p>
            <button className="btn" data-size="sm" data-variant="primary" onClick={() => { setSelectedAudience("Demo Booked (12 leads)"); setIsNewCampOpen(true); }} style={{ marginTop: "12px", width: "100%" }}>
              Broadcast to this Segment
            </button>
          </div>
        </div>
      )}

      {/* New Campaign Modal */}
      {isNewCampOpen && (
        <div className="overlay" data-kind="dialog" onClick={() => setIsNewCampOpen(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="campaign-dialog-title" onClick={(e) => e.stopPropagation()} style={{ width: "460px" }}>
            <div className="dialog-head">
              <h2 id="campaign-dialog-title" style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>New WhatsApp Broadcast Campaign</h2>
              <button className="btn" data-variant="ghost" aria-label="Close dialog" onClick={() => setIsNewCampOpen(false)} style={{ padding: "4px" }}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px 20px" }}>
              <div className="field">
                <label htmlFor="camp-name" style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Campaign Name</label>
                <input
                  className="input"
                  id="camp-name"
                  placeholder="e.g. October Commercial Advance Push"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="camp-template" style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Pre-Approved Meta Template</label>
                <select
                  className="select"
                  id="camp-template"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="camp-audience" style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Audience Segment</label>
                <select
                  className="select"
                  id="camp-audience"
                  value={selectedAudience}
                  onChange={(e) => setSelectedAudience(e.target.value)}
                >
                  <option value="Negotiation Stage (18 leads)">Negotiation Stage (18 leads)</option>
                  <option value="Stalled Leads (42 leads)">Stalled Leads (42 leads)</option>
                  <option value="Demo Booked (12 leads)">Demo Booked (12 leads)</option>
                  <option value="All Active Inbounds (110 leads)">All Active Inbounds (110 leads)</option>
                </select>
              </div>

              <div className="card" style={{ padding: "10px", background: "var(--bg-soft)", fontSize: "11px", color: "var(--text-secondary)" }}>
                ⚡ Messages will dispatch through official Meta WhatsApp Cloud API with automatic rate-limit throttling (25 msg/sec).
              </div>
            </div>
            <div className="dialog-foot" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px" }}>
              <button className="btn" data-variant="ghost" onClick={() => setIsNewCampOpen(false)}>
                Cancel
              </button>
              <button className="btn" data-variant="primary" onClick={handleLaunchCampaign}>
                Send WhatsApp Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
