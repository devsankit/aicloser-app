"use client";

import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CURRENT_USER, useApp } from "@/lib/store";
import { STAGES, type StageId } from "@/lib/types";

interface ChatMessage {
  id: string;
  sender: "customer" | "closer" | "system";
  text: string;
  time: string;
  channel?: "whatsapp" | "instagram" | "website";
  status?: "sent" | "delivered" | "read";
}

interface ConversationItem {
  id: string;
  leadId: string;
  customerName: string;
  company: string;
  phone: string;
  channel: "whatsapp" | "instagram" | "website";
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  assignedTo: string;
  slaMinutesRemaining?: number;
  messages: ChatMessage[];
}

const QUICK_MACROS = [
  { label: "Book Demo", text: "Here is our instant calendar link to book a 15-minute walkthrough: https://closer.ai/demo" },
  { label: "Pricing Sheet", text: "Sharing our complete package comparison. Standard: ₹48k/mo, Pro CRM + Telephony: ₹96k/mo." },
  { label: "UPI Payment QR", text: "You can complete your onboarding advance payment securely via UPI: upi://pay?pa=sales@aicloser&pn=AICloser" },
  { label: "Follow-up", text: "Just checking in regarding our discussion earlier. Would 4:00 PM today work for a brief follow-up call?" },
];

export function ChatView() {
  const { state, moveLead } = useApp();

  // Channel filter: all, whatsapp, instagram, website
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine" | "unassigned">("all");
  const [search, setSearch] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string>("chat-01");
  const [inputText, setInputText] = useState("");
  const [showRightDrawer, setShowRightDrawer] = useState(true);
  const [aiAutoReply, setAiAutoReply] = useState(true);

  // Conversations mapped to live leads
  const [conversations, setConversations] = useState<ConversationItem[]>([
    {
      id: "chat-01",
      leadId: "ld-01", // Anshita Rao
      customerName: "Anshita Rao",
      company: "Nimbus Interiors",
      phone: "9839047231",
      channel: "whatsapp",
      lastMessage: "Wants a callback after 6pm. Can we discuss pricing?",
      lastMessageTime: "11m ago",
      unreadCount: 1,
      assignedTo: "Aarav",
      slaMinutesRemaining: 8,
      messages: [
        { id: "m1", sender: "customer", text: "Hi, I filled the demo request on your website.", time: "11:20 AM", channel: "whatsapp" },
        { id: "m2", sender: "closer", text: "Hello Anshita! Glad to connect. I saw your request for Nimbus Interiors.", time: "11:22 AM", status: "read" },
        { id: "m3", sender: "customer", text: "We need 6 closer seats and SIM call recording. What would that cost?", time: "11:25 AM", channel: "whatsapp" },
        { id: "m4", sender: "system", text: "Lead moved to In Progress by Aarav Sharma", time: "11:26 AM" },
        { id: "m5", sender: "closer", text: "That fits our Pro tier perfectly at ₹96,000/year. All 6 SIMs get automatic call audio recording and transcription.", time: "11:28 AM", status: "read" },
        { id: "m6", sender: "customer", text: "Great. Can we do a call after 6pm to finalize?", time: "11:45 AM", channel: "whatsapp" },
      ],
    },
    {
      id: "chat-02",
      leadId: "ld-03", // Priya Nair
      customerName: "Priya Nair",
      company: "Loom & Co",
      phone: "9845512098",
      channel: "whatsapp",
      lastMessage: "Asked about SIM-based calling and call recording limits.",
      lastMessageTime: "24m ago",
      unreadCount: 0,
      assignedTo: "Meera",
      slaMinutesRemaining: 35,
      messages: [
        { id: "m1", sender: "customer", text: "Does AI Closer work with Airtel corporate postpaids?", time: "10:14 AM", channel: "whatsapp" },
        { id: "m2", sender: "closer", text: "Yes Priya! It works with Airtel, Jio and Vi without installing any proxy dialer on the phones.", time: "10:16 AM", status: "read" },
        { id: "m3", sender: "customer", text: "Understood, sending this to our IT director.", time: "10:30 AM", channel: "whatsapp" },
      ],
    },
    {
      id: "chat-03",
      leadId: "ld-02", // Karan Mehta
      customerName: "Karan Mehta",
      company: "Ambition Realty",
      phone: "9987021145",
      channel: "instagram",
      lastMessage: "Downloaded the broker playbook, need commercial quote.",
      lastMessageTime: "1h ago",
      unreadCount: 2,
      assignedTo: "Aarav",
      messages: [
        { id: "m1", sender: "customer", text: "Hey saw your reel on real estate closer tracking.", time: "09:40 AM", channel: "instagram" },
        { id: "m2", sender: "customer", text: "Do you offer WhatsApp drip automations for property leads?", time: "09:42 AM", channel: "instagram" },
      ],
    },
    {
      id: "chat-04",
      leadId: "ld-05", // Farah Khan
      customerName: "Farah Khan",
      company: "Meridian Stays",
      phone: "9820019944",
      channel: "website",
      lastMessage: "Payment link received, verifying with finance.",
      lastMessageTime: "2h ago",
      unreadCount: 0,
      assignedTo: "Rohan",
      messages: [
        { id: "m1", sender: "customer", text: "We are ready to move forward with the 12-seat annual plan.", time: "08:15 AM", channel: "website" },
        { id: "m2", sender: "closer", text: "Awesome! Here is your custom UPI payment link: https://closer.ai/pay/meridian-96k", time: "08:20 AM", status: "read" },
        { id: "m3", sender: "customer", text: "Payment link received, verifying with finance.", time: "08:35 AM", channel: "website" },
      ],
    },
  ]);

  const activeChat = conversations.find((c) => c.id === selectedChatId) || conversations[0];
  const activeLead = state.leads.find((l) => l.id === activeChat.leadId) || state.leads[0];

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchChannel = channelFilter === "all" || c.channel === channelFilter;
      const matchScope =
        scopeFilter === "all"
          ? true
          : scopeFilter === "mine"
          ? c.assignedTo === CURRENT_USER
          : c.assignedTo === "Unassigned";
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.customerName.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.phone.includes(q);
      return matchChannel && matchScope && matchSearch;
    });
  }, [conversations, channelFilter, scopeFilter, search]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "closer",
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMessage: inputText.trim(),
              lastMessageTime: "Just now",
              unreadCount: 0,
            }
          : c
      )
    );
    setInputText("");
  };

  const handleApplyMacro = (text: string) => {
    setInputText(text);
  };

  const handleStageChange = (newStage: StageId) => {
    if (activeLead) {
      moveLead(activeLead.id, newStage);
      // add system message in chat
      const sysMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: `Lead moved to ${newStage.replace("_", " ").toUpperCase()} by ${CURRENT_USER}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChat.id ? { ...c, messages: [...c.messages, sysMsg] } : c
        )
      );
    }
  };

  const channelIcon: Record<string, IconName> = {
    whatsapp: "whatsapp",
    instagram: "sparkle",
    website: "message",
  };

  return (
    <div
      className="chat-workspace"
      style={{
        display: "flex",
        height: "calc(100vh - var(--topbar-h))",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      <h1 className="sr-only">Live multi-channel chat</h1>
      {/* 1. Left Column: Conversations List */}
      <aside
        aria-label="Conversations"
        style={{
          width: "320px",
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-sidebar)",
        }}
      >
        {/* Header with Search */}
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650, margin: 0 }}>Inbox</h2>
            <div className="seg" style={{ transform: "scale(0.9)", transformOrigin: "right center" }}>
              <button data-on={scopeFilter === "all"} onClick={() => setScopeFilter("all")}>All</button>
              <button data-on={scopeFilter === "mine"} onClick={() => setScopeFilter("mine")}>Mine</button>
            </div>
          </div>

          <div className="search" style={{ width: "100%" }}>
            <Icon name="search" size={13} />
            <input
              placeholder="Search chat or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: "var(--fs-caption)" }}
            />
          </div>

          {/* Channel Filters */}
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { id: "all", label: "All" },
              { id: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
              { id: "instagram", label: "Instagram", icon: "sparkle" },
              { id: "website", label: "Web", icon: "message" },
            ].map((ch) => (
              <button
                key={ch.id}
                className="btn"
                data-size="sm"
                data-variant={channelFilter === ch.id ? "primary" : "ghost"}
                onClick={() => setChannelFilter(ch.id)}
                style={{ height: "24px", fontSize: "11px", padding: "0 7px" }}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Rows */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredConversations.map((chat) => {
            const isSelected = chat.id === activeChat.id;
            return (
              <div
                key={chat.id}
                onClick={() => {
                  setSelectedChatId(chat.id);
                  setConversations((prev) =>
                    prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
                  );
                }}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: isSelected ? "var(--bg-selected)" : "transparent",
                  transition: "background var(--speed) ease",
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                }}
              >
                {/* Avatar with Channel Icon */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "var(--bg-soft)",
                      border: "1px solid var(--border-strong)",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 600,
                      fontSize: "13px",
                      color: "var(--text)",
                    }}
                  >
                    {chat.customerName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      background: chat.channel === "whatsapp" ? "#25D366" : "var(--accent)",
                      color: "#fff",
                      borderRadius: "50%",
                      width: "16px",
                      height: "16px",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name={channelIcon[chat.channel] || "message"} size={9} />
                  </span>
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 650, fontSize: "var(--fs-meta)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {chat.customerName}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{chat.lastMessageTime}</span>
                  </div>

                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "1px" }}>
                    {chat.company}
                  </div>

                  <p
                    style={{
                      fontSize: "var(--fs-caption)",
                      color: isSelected ? "var(--text)" : "var(--text-secondary)",
                      margin: "3px 0 0 0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {chat.lastMessage}
                  </p>

                  {/* Badges / SLA */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px" }}>
                    {chat.slaMinutesRemaining && (
                      <span className="chip" data-tone="warning" style={{ fontSize: "10px", padding: "1px 5px", height: "18px" }}>
                        <Icon name="clock" size={9} /> SLA {chat.slaMinutesRemaining}m
                      </span>
                    )}
                    {chat.unreadCount > 0 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          background: "var(--accent-strong)",
                          color: "#fff",
                          borderRadius: "10px",
                          padding: "1px 6px",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. Middle Column: Active Chat Thread Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Thread Header */}
        <header
          style={{
            height: "54px",
            borderBottom: "1px solid var(--border)",
            padding: "0 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 650, fontSize: "var(--fs-body)", color: "var(--text)" }}>
                  {activeChat.customerName}
                </span>
                <span className="chip" data-tone="accent" style={{ fontSize: "11px", padding: "1px 6px" }}>
                  <Icon name={channelIcon[activeChat.channel]} size={11} /> {activeChat.channel.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                {activeChat.company} • {activeChat.phone}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* AI Assistant Toggle */}
            <button
              className="btn"
              data-size="sm"
              data-variant={aiAutoReply ? "accent" : "ghost"}
              onClick={() => setAiAutoReply(!aiAutoReply)}
              title="Toggle AI Auto-Suggestion assistant"
            >
              <Icon name="sparkle" size={12} /> AI Copilot {aiAutoReply ? "On" : "Off"}
            </button>

            {/* Direct Call Button */}
            <a href={`tel:${activeChat.phone}`} className="btn" data-size="sm" title="Initiate SIM Call">
              <Icon name="phone" size={12} /> Call SIM
            </a>

            {/* Toggle CRM Details Drawer */}
            <button
              className="btn"
              data-size="sm"
              data-variant={showRightDrawer ? "primary" : "ghost"}
              onClick={() => setShowRightDrawer(!showRightDrawer)}
              title="Toggle CRM 360 profile sidebar"
            >
              <Icon name="panel" size={13} />
            </button>
          </div>
        </header>

        {/* Message Area */}
        <div
          role="log"
          aria-label="Conversation"
          tabIndex={0}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: "var(--bg)",
          }}
        >
          {/* Day Divider */}
          <div style={{ textAlign: "center", margin: "4px 0" }}>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-tertiary)",
                background: "var(--bg-soft)",
                padding: "2px 10px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
              }}
            >
              Today
            </span>
          </div>

          {activeChat.messages.map((msg) => {
            if (msg.sender === "system") {
              return (
                <div key={msg.id} style={{ textAlign: "center", margin: "6px 0" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      background: "var(--bg-soft)",
                      padding: "3px 10px",
                      borderRadius: "var(--r-sm)",
                      border: "1px dashed var(--border-strong)",
                    }}
                  >
                    ⚡ {msg.text} • {msg.time}
                  </span>
                </div>
              );
            }

            const isCloser = msg.sender === "closer";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isCloser ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "9px 13px",
                    borderRadius: "10px",
                    background: isCloser ? "var(--accent-strong)" : "var(--bg-panel)",
                    color: isCloser ? "#ffffff" : "var(--text)",
                    border: isCloser ? "1px solid var(--accent-border)" : "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.text}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--text-tertiary)",
                    marginTop: "3px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{msg.time}</span>
                  {isCloser && msg.status && (
                    <span style={{ color: msg.status === "read" ? "#4cb782" : "inherit" }}>
                      ✓✓
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Sales Macros */}
        <div
          style={{
            padding: "8px 18px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-surface)",
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>Quick Macros:</span>
          {QUICK_MACROS.map((m) => (
            <button
              key={m.label}
              className="btn"
              data-size="sm"
              onClick={() => handleApplyMacro(m.text)}
              style={{ height: "24px", fontSize: "11px", padding: "0 8px" }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Message Input Bar */}
        <footer
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-panel)",
            display: "flex",
            gap: "10px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your reply... (Press ⌘+Enter to send)"
            style={{
              flex: 1,
              height: "46px",
              minHeight: "46px",
              maxHeight: "120px",
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border-input)",
              background: "var(--bg-surface)",
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              resize: "none",
              outline: "none",
            }}
          />
          <button
            className="btn"
            data-variant="primary"
            onClick={handleSendMessage}
            style={{ height: "46px", padding: "0 18px", fontWeight: 600 }}
          >
            Send <Icon name="arrow-right" size={14} />
          </button>
        </footer>
      </div>

      {/* 3. Right Column: CRM 360° Lead Context */}
      {showRightDrawer && activeLead && (
        <aside
          aria-label="Lead context"
          style={{
            width: "300px",
            flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-sidebar)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: "16px",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>
                Lead Profile
              </span>
              <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                {activeLead.code}
              </span>
            </div>
            <h3 style={{ fontSize: "var(--fs-title)", fontWeight: 650, margin: "6px 0 2px 0" }}>
              {activeLead.name}
            </h3>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
              {activeLead.company}
            </div>
          </div>

          {/* Stage Selector */}
          <div className="card" style={{ padding: "12px", background: "var(--bg-surface)" }}>
            <label htmlFor="chat-stage" style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Pipeline Stage
            </label>
            <select
              className="select"
              id="chat-stage"
              value={activeLead.stage}
              onChange={(e) => handleStageChange(e.target.value as StageId)}
              style={{ width: "100%", marginTop: "6px", fontWeight: 600 }}
            >
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Deal Value */}
          <div className="card" style={{ padding: "12px", background: "var(--bg-surface)" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Deal Value
            </label>
            <div style={{ fontSize: "var(--fs-metric)", fontWeight: 700, marginTop: "4px" }}>
              ₹{activeLead.value.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
              Source: {activeLead.source} • {activeLead.segment}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              className="btn"
              data-variant="accent"
              onClick={() => handleApplyMacro(`Here is your custom payment link for ₹${activeLead.value.toLocaleString("en-IN")}: https://closer.ai/pay/${activeLead.code}`)}
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <Icon name="card" size={13} /> Send UPI Payment Link
            </button>
            <button
              className="btn"
              onClick={() => handleApplyMacro("Let's lock in a demo walkthrough: https://closer.ai/demo")}
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <Icon name="calendar" size={13} /> Book Demo Walkthrough
            </button>
          </div>

          {/* Notes */}
          <div className="card" style={{ padding: "12px", background: "var(--bg-surface)" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Lead Notes
            </label>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "6px", lineHeight: 1.45 }}>
              {activeLead.notes || "No notes logged yet."}
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
