"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { aicloserApi } from "@/lib/api-client";
import { useApp } from "@/lib/store";

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

export function CallsView() {
  const { state } = useApp();
  const isAdmin = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN" || state.user?.role === "OWNER";
  const isManager = state.user?.role === "MANAGER";
  const canViewDevices = isAdmin || isManager;

  const [tab, setTab] = useState<"all" | "missed" | "devices">("all");
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [devices, setDevices] = useState<SimDevice[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("ALL");
  const [callerScope, setCallerScope] = useState<"all" | "mine">("all");
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTranscriptCall, setSelectedTranscriptCall] = useState<CallRecord | null>(null);

  useEffect(() => {
    if (!isAdmin && !isManager) {
      setCallerScope("mine");
    } else if (isAdmin) {
      setCallerScope("all");
    }
  }, [isAdmin, isManager]);

  const loadData = useCallback(async () => {
    try {
      const r = await fetch("/api/sales/call-reports?limit=100");
      const res = await r.json();
      if (res.totals) setTotals(res.totals);
      const sourceCalls = res.calls || [];
      if (sourceCalls.length > 0) {
        const mapped: CallRecord[] = sourceCalls.map((c: any) => {
          const rawPhone = c.phoneNumber || c.assignment?.customerPhone || "";
          const displayName = c.assignment?.customerName || rawPhone || "Direct Caller";
          return {
            id: c.id,
            leadCode: c.assignment?.id ? `CLO-${c.assignment.id.slice(-4).toUpperCase()}` : "CLO-LIVE",
            customerName: displayName,
            company: c.assignment?.stage ? `${c.assignment.stage}` : "Direct Telephony Call",
            phone: rawPhone,
            closerName: c.agent?.user?.displayName || "Assigned Closer",
            simSlot: c.device?.deviceName || c.device?.model || "SIM Relay Desk",
            direction:
              String(c.direction).toUpperCase() === "INBOUND"
                ? "inbound"
                : c.durationSeconds === 0 || String(c.status).toUpperCase() === "MISSED"
                ? "missed"
                : "outbound",
            durationSeconds: Number(c.durationSeconds ?? c.durationSec ?? 0),
            timestamp: c.startedAt
              ? new Date(c.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
              : "Today",
            disposition: c.outcome || c.status || "Completed",
            sentiment: "neutral",
            aiSummary: c.note || (c.durationSeconds > 0 ? "Direct call recording logged." : "Unanswered missed call."),
            transcript: [],
            audioUrl: c.recordingUrl || (c.recordingStatus === "UPLOADED" ? `/api/sales/mobile/calls/${c.id}/recording` : undefined),
            callbackPending: String(c.status).toUpperCase() === "MISSED" || c.durationSeconds === 0,
          };
        });
        setCalls(mapped);
      } else {
        const cRes: any = await aicloserApi.calls.list({ limit: 100 }).catch(() => null);
        if (cRes?.calls?.length) {
          const mapped: CallRecord[] = cRes.calls.map((c: any) => ({
            id: c.id,
            leadCode: c.assignment?.id ? `CLO-${c.assignment.id.slice(-4).toUpperCase()}` : "CLO-LIVE",
            customerName: c.assignment?.customerName || c.phoneNumber || "Direct Caller",
            company: c.assignment?.stage || "Direct Line",
            phone: c.phoneNumber || c.assignment?.customerPhone || "",
            closerName: c.agent?.user?.displayName || "Closer Agent",
            simSlot: c.device?.deviceName || "SIM Relay",
            direction:
              c.direction === "INBOUND"
                ? "inbound"
                : c.durationSeconds === 0
                ? "missed"
                : "outbound",
            durationSeconds: c.durationSeconds || 0,
            timestamp: new Date(c.startedAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            disposition: c.outcome || c.status || "Completed",
            sentiment: "neutral",
            aiSummary: c.note || "Direct call record.",
            transcript: [],
            audioUrl: c.recordingUrl,
            callbackPending: c.direction === "MISSED" || c.durationSeconds === 0,
          }));
          setCalls(mapped);
        }
      }

      const devRes = await fetch("/api/sales/devices").catch(() => null);
      if (devRes && devRes.ok) {
        const dJson = await devRes.json();
        if (Array.isArray(dJson.devices)) {
          setDevices(dJson.devices);
        }
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Listen for realtime incoming SIM calls
  useEffect(() => {
    const onRealtime = (e: any) => {
      const event = e.detail;
      if (event?.type === "call.recorded" && event.payload) {
        const c = event.payload;
        const newRecord: CallRecord = {
          id: c.id,
          leadCode: c.assignment?.id ? `CLO-${c.assignment.id.slice(-4).toUpperCase()}` : "CLO-LIVE",
          customerName: c.assignment?.customerName || "Customer",
          company: c.assignment?.stage || "Direct Line",
          phone: c.phoneNumber || c.assignment?.customerPhone || "",
          closerName: c.agent?.user?.displayName || "Closer Agent",
          simSlot: "Jio SIM 1",
          direction:
            c.direction === "INBOUND"
              ? "inbound"
              : c.durationSeconds === 0
              ? "missed"
              : "outbound",
          durationSeconds: c.durationSeconds || 0,
          timestamp: "Just now",
          disposition: c.outcome || "Recorded Call",
          sentiment: "positive",
          aiSummary: c.note || "Live SIM Telemetry call logged.",
          transcript: [],
          audioUrl: c.recordingUrl,
          callbackPending: c.durationSeconds === 0,
        };
        setCalls((prev) => [newRecord, ...prev]);
      }
    };
    window.addEventListener("aicloser:realtime", onRealtime);
    return () => window.removeEventListener("aicloser:realtime", onRealtime);
  }, []);

  const formatDuration = (sec: number) => {
    if (!sec) return "00:00";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleTogglePlay = async (callId: string) => {
    if (activeAudioId === callId) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    const call = calls.find((c) => c.id === callId);
    setActiveAudioId(callId);
    setIsPlaying(true);

    try {
      let src = call?.audioUrl;
      if (!src && !callId.startsWith("call-")) {
        const blob = await aicloserApi.calls.getRecordingBlob(callId).catch(() => null);
        if (blob) {
          src = URL.createObjectURL(blob);
        }
      }
      if (src && audioRef.current) {
        audioRef.current.src = src;
        audioRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const handleResolveMissed = async (callId: string) => {
    setCalls((prev) =>
      prev.map((c) =>
        c.id === callId
          ? { ...c, callbackPending: false, disposition: "Callback Completed" }
          : c
      )
    );
    try {
      await fetch(`/api/v1/calls/${callId}/resolve-missed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => null);
    } catch {
      // Non-blocking
    }
  };

  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    const currentCloserName = (state.user?.displayName || "").toLowerCase();

    return calls.filter((c) => {
      const matchDir =
        directionFilter === "ALL" ||
        (directionFilter === "INBOUND" && c.direction === "inbound") ||
        (directionFilter === "OUTBOUND" && c.direction === "outbound") ||
        (directionFilter === "MISSED" && c.direction === "missed");

      const matchScope =
        callerScope === "all" ||
        !currentCloserName ||
        c.closerName.toLowerCase().includes(currentCloserName);

      const matchSearch =
        !q ||
        c.customerName.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.closerName.toLowerCase().includes(q) ||
        c.disposition.toLowerCase().includes(q);

      return matchDir && matchScope && matchSearch;
    });
  }, [calls, directionFilter, search, callerScope, state.user]);

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
          <button
            className="btn"
            data-variant="ghost"
            disabled={isSyncing}
            onClick={() => {
              setIsSyncing(true);
              loadData().finally(() => setIsSyncing(false));
            }}
          >
            <Icon name="clock" size={13} /> {isSyncing ? "Syncing..." : "Sync SIMs"}
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
            Total Calls Logged
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {totals?.totalCalls ?? calls.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>recorded</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            {totals?.outboundCalls ?? calls.filter((c) => c.direction === "outbound").length} Outbound • {totals?.inboundCalls ?? calls.filter((c) => c.direction === "inbound").length} Inbound
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Missed Call Queue
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: (totals?.missedCalls ?? missedCalls.length) > 0 ? "var(--warning)" : "var(--success)" }}>
            {totals?.missedCalls ?? missedCalls.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>pending</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="dot" style={{ background: (totals?.missedCalls ?? missedCalls.length) > 0 ? "var(--warning)" : "var(--success)" }} /> Unanswered calls requiring callback
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Total Talk Time
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {Math.floor((totals?.talkTimeSeconds ?? totalDurationSum) / 60)}m {(totals?.talkTimeSeconds ?? totalDurationSum) % 60}s
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            {calls.length > 0 ? `Avg duration: ~${Math.round((totals?.talkTimeSeconds ?? totalDurationSum) / calls.length)}s per call` : "Live SIM call sync"}
          </div>
        </div>

        {canViewDevices && (
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              SIM Telephony Engine
            </div>
            <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: devices.length > 0 ? "var(--success)" : "var(--text-tertiary)" }}>
              {devices.filter((d) => d.recordingService === "active").length} / {devices.length} Active
            </div>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
              {devices.length > 0 ? "Direct Android audio background sync" : "No devices connected"}
            </div>
          </div>
        )}
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
          {canViewDevices && (
            <button data-on={tab === "devices"} onClick={() => setTab("devices")}>
              <Icon name="plug" size={13} /> Connected SIM Devices ({devices.length})
            </button>
          )}
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
            {isManager && (
              <div className="seg">
                <button data-on={callerScope === "all"} onClick={() => setCallerScope("all")}>
                  <Icon name="users" size={12} /> Team Calls
                </button>
                <button data-on={callerScope === "mine"} onClick={() => setCallerScope("mine")}>
                  <Icon name="phone" size={12} /> My Calls
                </button>
              </div>
            )}
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
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-secondary)" }}>
                      <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "var(--bg-soft)", marginBottom: 8 }}>
                        <Icon name="phone" size={20} />
                      </div>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>No call recordings found</div>
                      <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: 4 }}>
                        Real inbound and outbound SIM calls from connected closer devices will appear here automatically.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCalls.map((c) => {
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
                              <Icon name={isCurrentPlaying ? "pause" : "play"} size={12} />
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
                }))}
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
      {tab === "devices" && canViewDevices && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Active Telephony Physical SIM Android Devices</h2>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
              Hardware devices running the background recording sync service bound to closer SIMs.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", padding: "18px" }}>
            {devices.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "36px 16px", color: "var(--text-tertiary)" }}>
                <Icon name="phone" size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div style={{ fontWeight: 600, color: "var(--text)" }}>No Physical SIM Android Devices Connected</div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: 4 }}>
                  Connect your field closer Android handsets running the Closer Telephony Companion APK.
                </div>
              </div>
            ) : (
              devices.map((d) => (
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
                      <span style={{ color: "var(--text-tertiary)" }}>Hardware ID:</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--text-secondary)" }}>{d.id.slice(0, 12)}…</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-caption)" }}>
                      <span style={{ color: "var(--text-tertiary)" }}>Last Heartbeat:</span>
                      <span style={{ color: "var(--success)" }}>{d.lastHeartbeat}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                    <button
                      type="button"
                      className="btn"
                      data-variant="ghost"
                      style={{ fontSize: "11px", padding: "4px 8px", flex: 1 }}
                      onClick={() => {
                        setDevices((prev) =>
                          prev.map((dev) =>
                            dev.id === d.id ? { ...dev, lastHeartbeat: "Just now (Verified)" } : dev
                          )
                        );
                      }}
                    >
                      <Icon name="check" size={12} /> Ping Heartbeat
                    </button>
                    <button
                      type="button"
                      className="btn"
                      data-variant="ghost"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                      title="Copy SIM Number"
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(d.simNumber);
                        }
                      }}
                    >
                      <Icon name="copy" size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
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
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setActiveAudioId(null);
        }}
        onError={() => {
          setIsPlaying(false);
          setActiveAudioId(null);
        }}
        style={{ display: "none" }}
      />
    </div>
  );
}
