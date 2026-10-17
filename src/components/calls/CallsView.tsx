"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type CallDirection = "inbound" | "outbound" | "missed";

export interface CallRecord {
  id: string;
  leadCode: string;
  customerName: string;
  company: string;
  phone: string;
  closerName: string;
  simSlot: string;
  direction: CallDirection;
  durationSeconds: number;
  timestamp: string;
  disposition: string;
  sentiment: "positive" | "neutral" | "negative";
  aiSummary: string;
  transcript: { speaker: string; text: string; time: string }[];
  audioUrl?: string;
  callbackPending?: boolean;
}

export interface SimDevice {
  id: string;
  closer: string;
  phoneModel: string;
  simCarrier: string;
  simNumber: string;
  battery: number;
  recordingService: "active" | "standby";
  lastHeartbeat: string;
}

const DEFAULT_CALLS: CallRecord[] = [
  {
    id: "call-01",
    leadCode: "CLO-101",
    customerName: "Anshita Rao",
    company: "Nimbus Interiors",
    phone: "+91 98390 47231",
    closerName: "Aarav Sharma",
    simSlot: "Jio SIM 1",
    direction: "inbound",
    durationSeconds: 382, // 6m 22s
    timestamp: "11:45 AM today",
    disposition: "Interested (Ready for Demo)",
    sentiment: "positive",
    aiSummary: "Client confirmed interest in 6 closer seats. Discussed ₹96,000 Pro package. Requested follow-up callback at 6:00 PM for commercial signoff.",
    transcript: [
      { speaker: "Customer", text: "Hello Aarav, I called to check on the CRM demo details.", time: "00:05" },
      { speaker: "Aarav", text: "Hi Anshita! Yes, we have dedicated SIM audio logging for all 6 closer phones.", time: "00:15" },
      { speaker: "Customer", text: "That sounds great. What is the annual settlement for 6 seats?", time: "01:10" },
      { speaker: "Aarav", text: "That is ₹96,000 for the full year with unlimited call recordings and WhatsApp Cloud integration.", time: "01:30" },
      { speaker: "Customer", text: "Perfect. Let us connect at 6pm to do the onboarding.", time: "05:40" },
    ],
  },
  {
    id: "call-02",
    leadCode: "CLO-103",
    customerName: "Priya Nair",
    company: "Loom & Co",
    phone: "+91 98455 12098",
    closerName: "Meera Joshi",
    simSlot: "Airtel SIM 2",
    direction: "outbound",
    durationSeconds: 245, // 4m 05s
    timestamp: "10:30 AM today",
    disposition: "Follow-up Scheduled",
    sentiment: "neutral",
    aiSummary: "Followed up on WhatsApp inquiry. Customer will review technical SIM compatibility with internal IT head.",
    transcript: [
      { speaker: "Meera", text: "Hi Priya, calling from Closer AI regarding your Airtel SIM inquiry.", time: "00:04" },
      { speaker: "Customer", text: "Hi Meera. Does your recording app run smoothly in the background without battery drainage?", time: "00:20" },
      { speaker: "Meera", text: "Yes, it uses background audio foreground service with less than 2% battery consumption per day.", time: "00:45" },
    ],
  },
  {
    id: "call-03",
    leadCode: "CLO-102",
    customerName: "Karan Mehta",
    company: "Ambition Realty",
    phone: "+91 99870 21145",
    closerName: "Aarav Sharma",
    simSlot: "Jio SIM 1",
    direction: "missed",
    durationSeconds: 0,
    timestamp: "10:12 AM today",
    disposition: "Missed Call (Unreturned)",
    sentiment: "neutral",
    aiSummary: "Customer called while line was busy on another lead. High priority callback required.",
    transcript: [],
    callbackPending: true,
  },
  {
    id: "call-04",
    leadCode: "CLO-104",
    customerName: "Devansh Kapoor",
    company: "Vertex Labs",
    phone: "+91 98111 00223",
    closerName: "Rohan Mehta",
    simSlot: "Vi SIM 1",
    direction: "outbound",
    durationSeconds: 410, // 6m 50s
    timestamp: "Yesterday, 4:20 PM",
    disposition: "Negotiation (Commercial Quote)",
    sentiment: "positive",
    aiSummary: "Discussed custom payment schedule. Client agreed to pay 50% advance via UPI link.",
    transcript: [
      { speaker: "Rohan", text: "Good afternoon Devansh! Sharing the invoice for your 12 seats.", time: "00:10" },
      { speaker: "Customer", text: "Can we split the payment into two milestone installments?", time: "00:45" },
      { speaker: "Rohan", text: "Yes, we can do ₹1.3L today and ₹1.3L after 30 days.", time: "01:20" },
    ],
  },
  {
    id: "call-05",
    leadCode: "CLO-106",
    customerName: "Rahul Deshmukh",
    company: "Skyline Motors",
    phone: "+91 98990 33441",
    closerName: "Meera Joshi",
    simSlot: "Airtel SIM 2",
    direction: "missed",
    durationSeconds: 0,
    timestamp: "Yesterday, 2:15 PM",
    disposition: "Missed Call (Unreturned)",
    sentiment: "neutral",
    aiSummary: "Inbound call missed during team review. Needs callback.",
    transcript: [],
    callbackPending: true,
  },
];

const DEFAULT_DEVICES: SimDevice[] = [
  {
    id: "dev-01",
    closer: "Aarav Sharma",
    phoneModel: "POCO X5 Pro 5G",
    simCarrier: "Jio (SIM 1)",
    simNumber: "+91 98765 43210",
    battery: 88,
    recordingService: "active",
    lastHeartbeat: "Just now",
  },
  {
    id: "dev-02",
    closer: "Meera Joshi",
    phoneModel: "Vivo V29 5G",
    simCarrier: "Airtel (SIM 2)",
    simNumber: "+91 98450 11223",
    battery: 74,
    recordingService: "active",
    lastHeartbeat: "1m ago",
  },
  {
    id: "dev-03",
    closer: "Rohan Mehta",
    phoneModel: "Samsung Galaxy M34",
    simCarrier: "Vodafone Idea (SIM 1)",
    simNumber: "+91 99123 44556",
    battery: 92,
    recordingService: "active",
    lastHeartbeat: "3m ago",
  },
  {
    id: "dev-04",
    closer: "Sneha Kapoor",
    phoneModel: "OnePlus Nord CE 3",
    simCarrier: "Jio (SIM 1)",
    simNumber: "+91 98111 22334",
    battery: 45,
    recordingService: "standby",
    lastHeartbeat: "18m ago",
  },
];

export function CallsView() {
  const [tab, setTab] = useState<"all" | "missed" | "devices">("all");
  const [calls, setCalls] = useState<CallRecord[]>(DEFAULT_CALLS);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("ALL");
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTranscriptCall, setSelectedTranscriptCall] = useState<CallRecord | null>(null);

  const formatDuration = (sec: number) => {
    if (!sec) return "00:00";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleTogglePlay = (callId: string) => {
    if (activeAudioId === callId) {
      setIsPlaying(!isPlaying);
    } else {
      setActiveAudioId(callId);
      setIsPlaying(true);
    }
  };

  const handleResolveMissed = (callId: string) => {
    setCalls((prev) =>
      prev.map((c) =>
        c.id === callId
          ? { ...c, callbackPending: false, disposition: "Callback Completed" }
          : c
      )
    );
  };

  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((c) => {
      const matchDir =
        directionFilter === "ALL" ||
        (directionFilter === "INBOUND" && c.direction === "inbound") ||
        (directionFilter === "OUTBOUND" && c.direction === "outbound") ||
        (directionFilter === "MISSED" && c.direction === "missed");

      const matchSearch =
        !q ||
        c.customerName.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.closerName.toLowerCase().includes(q) ||
        c.disposition.toLowerCase().includes(q);

      return matchDir && matchSearch;
    });
  }, [calls, directionFilter, search]);

  const missedCalls = calls.filter((c) => c.direction === "missed" && c.callbackPending);
  const totalDurationSum = calls.reduce((acc, c) => acc + c.durationSeconds, 0);

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <header className="page-head" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
            Call Recordings & Missed Calls
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Real-time physical SIM call logs, inline audio playback, speech-to-text AI transcripts, and missed-call SLA queue.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn" data-variant="ghost" onClick={() => window.location.reload()}>
            <Icon name="clock" size={13} /> Sync SIMs
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
            Total Calls Today
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {calls.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>logged</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            {calls.filter((c) => c.direction === "outbound").length} Outbound • {calls.filter((c) => c.direction === "inbound").length} Inbound
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Missed Call Queue
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: missedCalls.length > 0 ? "var(--warning)" : "var(--success)" }}>
            {missedCalls.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>pending</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--warning)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="dot" style={{ background: "var(--warning)" }} /> SLA: 15m callback window
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Total Talk Time
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {Math.floor(totalDurationSum / 60)}m {totalDurationSum % 60}s
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Avg duration: ~5m 12s per call
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            SIM Telephony Engine
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--success)" }}>
            4 / 4 Active
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Direct Android audio background sync
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
        <div className="seg">
          <button data-on={tab === "all"} onClick={() => setTab("all")}>
            <Icon name="phone" size={13} /> Call History ({calls.length})
          </button>
          <button data-on={tab === "missed"} onClick={() => setTab("missed")}>
            <Icon name="clock" size={13} /> Missed Call Queue ({missedCalls.length})
          </button>
          <button data-on={tab === "devices"} onClick={() => setTab("devices")}>
            <Icon name="plug" size={13} /> Connected SIM Devices (4)
          </button>
        </div>
      </div>

      {/* Tab 1: All Calls */}
      {tab === "all" && (
        <section className="card" style={{ overflow: "hidden" }}>
          {/* Filter Bar */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: "10px", alignItems: "center" }}>
            <div className="search" style={{ width: "260px" }}>
              <Icon name="search" size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by lead, company, phone..."
                style={{ fontSize: "var(--fs-caption)" }}
              />
            </div>
            <div className="seg">
              {["ALL", "INBOUND", "OUTBOUND", "MISSED"].map((d) => (
                <button key={d} data-on={directionFilter === d} onClick={() => setDirectionFilter(d)}>
                  {d === "ALL" ? "All" : d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
              {filteredCalls.length} recorded calls
            </div>
          </div>

          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "220px" }}>Lead Contact</th>
                  <th>Closer & SIM</th>
                  <th>Direction</th>
                  <th>Duration</th>
                  <th>AI Disposition & Insights</th>
                  <th>Audio Playback</th>
                  <th style={{ width: "90px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map((c) => {
                  const isCurrentPlaying = activeAudioId === c.id && isPlaying;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{c.customerName}</div>
                        <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                          {c.company} • {c.phone}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 550, color: "var(--text)" }}>{c.closerName}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{c.simSlot}</div>
                      </td>
                      <td>
                        <span
                          className="chip"
                          data-tone={c.direction === "inbound" ? "info" : c.direction === "outbound" ? "accent" : "warning"}
                          style={{ fontSize: "11px" }}
                        >
                          {c.direction === "inbound" ? "↙ Inbound" : c.direction === "outbound" ? "↗ Outbound" : "✕ Missed"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 550, fontFamily: "var(--mono)" }}>
                          {formatDuration(c.durationSeconds)}
                        </span>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{c.timestamp}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "var(--fs-caption)" }}>{c.disposition}</span>
                          <span
                            className="chip"
                            data-tone={c.sentiment === "positive" ? "success" : "neutral"}
                            style={{ fontSize: "10px", padding: "1px 5px" }}
                          >
                            {c.sentiment === "positive" ? "Bullish" : "Neutral"}
                          </span>
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: "3px 0 0 0", maxWidth: "340px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.aiSummary}
                        </p>
                      </td>
                      <td>
                        {c.durationSeconds > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                              className="btn"
                              data-size="sm"
                              data-variant={isCurrentPlaying ? "accent" : "ghost"}
                              onClick={() => handleTogglePlay(c.id)}
                              aria-label={
                                isCurrentPlaying
                                  ? `Pause recording for ${c.customerName}`
                                  : `Play recording for ${c.customerName}`
                              }
                              title={isCurrentPlaying ? "Pause recording" : "Play recording"}
                              style={{ width: "28px", height: "28px", padding: 0, borderRadius: "50%" }}
                            >
                              <Icon name={isCurrentPlaying ? "moon" : "arrow-right"} size={11} />
                            </button>
                            <div
                              style={{
                                width: "90px",
                                height: "16px",
                                background: isCurrentPlaying ? "var(--accent-soft)" : "var(--bg-hover)",
                                borderRadius: "3px",
                                display: "flex",
                                alignItems: "center",
                                gap: "2px",
                                padding: "0 4px",
                              }}
                            >
                              {[4, 10, 14, 8, 12, 16, 7, 11, 15, 6, 9].map((h, i) => (
                                <span
                                  key={i}
                                  style={{
                                    width: "4px",
                                    height: `${isCurrentPlaying ? Math.max(3, (h * (i % 2 === 0 ? 1 : 0.6))) : 4}px`,
                                    background: isCurrentPlaying ? "var(--accent)" : "var(--border-strong)",
                                    borderRadius: "1px",
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>No recording</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          {c.transcript.length > 0 && (
                            <button
                              className="btn"
                              data-size="sm"
                              data-variant="ghost"
                              onClick={() => setSelectedTranscriptCall(c)}
                              title="View AI Speech Transcript"
                            >
                              <Icon name="sparkle" size={12} />
                            </button>
                          )}
                          <a
                            href={`tel:${c.phone}`}
                            className="btn"
                            data-size="sm"
                            data-variant="primary"
                            title="Call back customer"
                          >
                            <Icon name="phone" size={11} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Missed Call Queue */}
      {tab === "missed" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Unreturned Missed Inbound Calls</h2>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Customers who called when closers were engaged. 1-click call back clears the SLA alert.
              </p>
            </div>
            <span className="chip" data-tone="warning">
              {missedCalls.length} requiring immediate attention
            </span>
          </div>

          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone Number</th>
                  <th>Missed On SIM</th>
                  <th>Time Elapsed</th>
                  <th>Assigned Closer</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {missedCalls.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{c.customerName}</div>
                      <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>{c.company}</div>
                    </td>
                    <td style={{ fontWeight: 550, fontFamily: "var(--mono)" }}>{c.phone}</td>
                    <td>{c.simSlot}</td>
                    <td>
                      <span className="chip" data-tone="danger" style={{ fontSize: "11px" }}>
                        <Icon name="clock" size={11} /> {c.timestamp}
                      </span>
                    </td>
                    <td>{c.closerName}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button
                          className="btn"
                          data-size="sm"
                          data-variant="ghost"
                          onClick={() => handleResolveMissed(c.id)}
                        >
                          Mark Done
                        </button>
                        <a
                          href={`tel:${c.phone}`}
                          className="btn"
                          data-size="sm"
                          data-variant="primary"
                          onClick={() => handleResolveMissed(c.id)}
                        >
                          <Icon name="phone" size={12} /> Call Back Now
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {missedCalls.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                      ✓ All missed calls have been resolved and returned!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 3: Connected SIM Devices */}
      {tab === "devices" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Active Telephony Physical SIM Android Devices</h2>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
              Hardware devices running the background recording sync service bound to closer SIMs.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", padding: "18px" }}>
            {DEFAULT_DEVICES.map((d) => (
              <div key={d.id} className="card" style={{ padding: "14px", background: "var(--bg-soft)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>{d.phoneModel}</div>
                    <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", marginTop: "2px" }}>
                      Owner: <b style={{ color: "var(--text)" }}>{d.closer}</b>
                    </div>
                  </div>
                  <span className="chip" data-tone={d.recordingService === "active" ? "success" : "warning"} style={{ fontSize: "11px" }}>
                    <span className="dot" style={{ background: d.recordingService === "active" ? "var(--success)" : "var(--warning)" }} />
                    {d.recordingService.toUpperCase()}
                  </span>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", margin: "10px 0", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-caption)" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>Carrier & SIM:</span>
                    <span style={{ fontWeight: 550 }}>{d.simCarrier}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-caption)" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>Phone Number:</span>
                    <span style={{ fontFamily: "var(--mono)" }}>{d.simNumber}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-caption)" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>Battery:</span>
                    <span>{d.battery}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-caption)" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>Last Heartbeat:</span>
                    <span style={{ color: "var(--success)" }}>{d.lastHeartbeat}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Speech Transcript Modal */}
      {selectedTranscriptCall && (
        <div className="overlay" data-kind="dialog" onClick={() => setSelectedTranscriptCall(null)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="transcript-dialog-title" onClick={(e) => e.stopPropagation()} style={{ width: "540px", maxHeight: "85vh" }}>
            <div className="dialog-head">
              <div>
                <h2 id="transcript-dialog-title" style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>AI Speech Transcript & Insights</h2>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {selectedTranscriptCall.customerName} ({selectedTranscriptCall.company}) • {selectedTranscriptCall.timestamp}
                </div>
              </div>
              <button className="btn" data-variant="ghost" aria-label="Close transcript" onClick={() => setSelectedTranscriptCall(null)} style={{ padding: "4px" }}>
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="dialog-body" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" }}>
              {/* Executive Summary */}
              <div className="card" style={{ padding: "12px", background: "var(--bg-soft)" }}>
                <div style={{ fontSize: "11px", fontWeight: 650, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  AI Conversation Summary
                </div>
                <p style={{ fontSize: "var(--fs-caption)", color: "var(--text)", marginTop: "4px", lineHeight: 1.5 }}>
                  {selectedTranscriptCall.aiSummary}
                </p>
              </div>

              {/* Speaker Turns */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 650, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Turn-by-Turn Audio Transcript
                </div>
                {selectedTranscriptCall.transcript.map((t, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        width: "65px",
                        color: t.speaker === "Customer" ? "var(--warning)" : "var(--accent)",
                        flexShrink: 0,
                      }}
                    >
                      {t.speaker}:
                    </span>
                    <div style={{ flex: 1, fontSize: "var(--fs-caption)", color: "var(--text)" }}>
                      {t.text}
                    </div>
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>
                      {t.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dialog-foot" style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px" }}>
              <button className="btn" data-variant="primary" onClick={() => setSelectedTranscriptCall(null)}>
                Close Transcript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
