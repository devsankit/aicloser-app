"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
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
  closerAgentId?: string;
  closerUserId?: string;
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
  const [viewMode, setViewMode] = useState<"log" | "grouped">("log");
  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});

  const toggleContactExpand = (key: string) => {
    setExpandedContacts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!isAdmin && !isManager) {
      setCallerScope("mine");
    } else if (isAdmin) {
      setCallerScope("all");
    }
  }, [isAdmin, isManager]);

  const loadData = useCallback(async () => {
    try {
      let queryAgentId: string | undefined = undefined;
      if (state.scope.startsWith("agent:")) {
        const targetAgentName = state.scope.slice(6).trim();
        const member = state.teamMembers?.find(
          (m: any) =>
            (m.name || "").trim().toLowerCase() === targetAgentName.toLowerCase() ||
            (m.displayName || "").trim().toLowerCase() === targetAgentName.toLowerCase()
        );
        queryAgentId = member?.id || (member as any)?.userId;
      } else if (state.scope === "mine" || (!isAdmin && !isManager)) {
        queryAgentId = (state.user as any)?.userId || (state.user as any)?.id;
      }

      const params: any = { limit: 250 };
      if (queryAgentId) params.agentId = queryAgentId;

      const cRes: any = await aicloserApi.calls.list(params).catch(() => null);
      if (cRes?.calls) {
        const mapped: CallRecord[] = cRes.calls.map((c: any) => ({
          id: c.id,
          leadCode: c.assignment?.id ? `CLO-${c.assignment.id.slice(-4).toUpperCase()}` : "CLO-LIVE",
          customerName: c.assignment?.customerName || c.phoneNumber || "Direct Caller",
          company: c.assignment?.stage || "Direct Line",
          phone: c.phoneNumber || c.assignment?.customerPhone || "",
          closerName: c.agent?.user?.displayName || c.agent?.agentCode || "Closer Agent",
          closerAgentId: c.agentId || c.agent?.id || "",
          closerUserId: c.agent?.userId || c.agent?.user?.id || "",
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
          aiSummary: c.note || (c.durationSeconds > 0 ? "Direct call recording logged." : "Unanswered missed call."),
          transcript: [],
          audioUrl: c.recordingUrl || (c.recordingStatus === "UPLOADED" ? `/api/v1/calls/${c.id}/recording` : undefined),
          callbackPending: c.direction === "MISSED" || c.durationSeconds === 0,
        }));
        setCalls(mapped);
      }
    } catch {
      // Non-blocking
    }
  }, [state.scope, state.teamMembers, state.user, isAdmin, isManager]);

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
          closerName: c.agent?.user?.displayName || c.agent?.agentCode || "Closer Agent",
          closerAgentId: c.agentId || c.agent?.id || "",
          closerUserId: c.agent?.userId || c.agent?.user?.id || "",
          simSlot: c.device?.deviceName || "SIM Relay",
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
      await aicloserApi.calls.resolveMissed(callId).catch(() => null);
    } catch {
      // Non-blocking
    }
  };

  // 1. Scoped Calls based on Global Topbar "Viewing" Scope (state.scope)
  const scopedCalls = useMemo(() => {
    const isCloser = (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT";
    const myName = (state.user?.displayName || "").trim().toLowerCase();
    const myId = (state.user as any)?.userId || (state.user as any)?.id;

    // Helper to test if a call matches a given target name or ID
    const matchesAgent = (c: CallRecord, targetName: string, targetId?: string) => {
      const closer = (c.closerName || "").trim().toLowerCase();
      const target = targetName.trim().toLowerCase();
      if (!closer && !c.closerAgentId && !c.closerUserId) return false;
      if (target && closer && (closer === target || closer.includes(target) || target.includes(closer))) {
        return true;
      }
      if (targetId && (c.closerUserId === targetId || c.closerAgentId === targetId)) {
        return true;
      }
      return false;
    };

    if (isCloser || state.scope === "mine") {
      return calls.filter((c) => matchesAgent(c, myName, myId));
    }

    if (state.scope === "unassigned") {
      return [];
    }

    if (state.scope.startsWith("agent:")) {
      const targetAgentName = state.scope.slice(6).trim();
      const member = state.teamMembers?.find(
        (m: any) =>
          (m.name || "").trim().toLowerCase() === targetAgentName.toLowerCase() ||
          (m.displayName || "").trim().toLowerCase() === targetAgentName.toLowerCase()
      );
      const targetMemberId = member?.id || (member as any)?.userId;

      return calls.filter((c) => matchesAgent(c, targetAgentName, targetMemberId));
    }

    // Default "all" scope (All team leads):
    if (callerScope === "mine" && myName) {
      return calls.filter((c) => matchesAgent(c, myName, myId));
    }

    return calls;
  }, [calls, state.scope, state.user, state.teamMembers, callerScope]);

  // 2. Filtered calls after Search & Direction filter
  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase();

    return scopedCalls.filter((c) => {
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
  }, [scopedCalls, directionFilter, search]);

  const groupedCalls = useMemo(() => {
    const groups: Record<
      string,
      {
        contactKey: string;
        customerName: string;
        phone: string;
        company: string;
        closerName: string;
        totalDurationSeconds: number;
        calls: CallRecord[];
        latestCall: CallRecord;
      }
    > = {};

    for (const call of filteredCalls) {
      const key = (call.phone || call.customerName || call.id).trim();
      if (!groups[key]) {
        groups[key] = {
          contactKey: key,
          customerName: call.customerName,
          phone: call.phone,
          company: call.company,
          closerName: call.closerName,
          totalDurationSeconds: 0,
          calls: [],
          latestCall: call,
        };
      }
      groups[key].calls.push(call);
      groups[key].totalDurationSeconds += call.durationSeconds;
    }

    return Object.values(groups);
  }, [filteredCalls]);

  // Scoped metrics
  const scopedMissedCalls = useMemo(() => {
    return scopedCalls.filter((c) => c.direction === "missed" && c.callbackPending);
  }, [scopedCalls]);

  const scopedTotalDuration = useMemo(() => {
    return scopedCalls.reduce((acc, c) => acc + c.durationSeconds, 0);
  }, [scopedCalls]);

  const scopedOutboundCount = useMemo(() => {
    return scopedCalls.filter((c) => c.direction === "outbound").length;
  }, [scopedCalls]);

  const scopedInboundCount = useMemo(() => {
    return scopedCalls.filter((c) => c.direction === "inbound").length;
  }, [scopedCalls]);

  const scopedDevices = useMemo(() => {
    if (!state.scope || state.scope === "all") return devices;
    if (state.scope === "mine") {
      const myName = (state.user?.displayName || "").trim().toLowerCase();
      return devices.filter((d) => (d.closer || "").trim().toLowerCase() === myName || (d.closer || "").toLowerCase().includes(myName));
    }
    if (state.scope.startsWith("agent:")) {
      const targetAgent = state.scope.slice(6).trim().toLowerCase();
      return devices.filter((d) => (d.closer || "").trim().toLowerCase() === targetAgent || (d.closer || "").toLowerCase().includes(targetAgent));
    }
    return [];
  }, [devices, state.scope, state.user]);

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <header className="page-head" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
              Call Recordings & Missed Calls
            </h1>
            {state.scope.startsWith("agent:") && (
              <span className="chip" data-tone="accent" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Icon name="users" size={12} /> Viewing: {state.scope.slice(6)}
              </span>
            )}
            {state.scope === "mine" && (
              <span className="chip" data-tone="accent" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Icon name="target" size={12} /> Viewing: My Calls ({state.user?.displayName || "Me"})
              </span>
            )}
            {state.scope === "unassigned" && (
              <span className="chip" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Icon name="target" size={12} /> Viewing: Unassigned Pool
              </span>
            )}
          </div>
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
            {scopedCalls.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>recorded</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            {scopedOutboundCount} Outbound • {scopedInboundCount} Inbound
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Missed Call Queue
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: scopedMissedCalls.length > 0 ? "var(--warning)" : "var(--success)" }}>
            {scopedMissedCalls.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>pending</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="dot" style={{ background: scopedMissedCalls.length > 0 ? "var(--warning)" : "var(--success)" }} /> Unanswered calls requiring callback
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Total Talk Time
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {Math.floor(scopedTotalDuration / 60)}m {scopedTotalDuration % 60}s
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            {scopedCalls.length > 0 ? `Avg duration: ~${Math.round(scopedTotalDuration / scopedCalls.length)}s per call` : "Live SIM call sync"}
          </div>
        </div>

        {canViewDevices && (
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              SIM Telephony Engine
            </div>
            <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: scopedDevices.length > 0 ? "var(--success)" : "var(--text-tertiary)" }}>
              {scopedDevices.filter((d) => d.recordingService === "active").length} / {scopedDevices.length} Active
            </div>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
              {scopedDevices.length > 0 ? "Direct Android audio background sync" : "No devices connected"}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
        <div className="seg">
          <button data-on={tab === "all"} onClick={() => setTab("all")}>
            <Icon name="phone" size={13} /> Call History ({scopedCalls.length})
          </button>
          <button data-on={tab === "missed"} onClick={() => setTab("missed")}>
            <Icon name="clock" size={13} /> Missed Call Queue ({scopedMissedCalls.length})
          </button>
          {canViewDevices && (
            <button data-on={tab === "devices"} onClick={() => setTab("devices")}>
              <Icon name="plug" size={13} /> Connected SIM Devices ({scopedDevices.length})
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
            <div className="seg">
              <button data-on={viewMode === "log"} onClick={() => setViewMode("log")}>
                <Icon name="clock" size={12} /> Chronological Log
              </button>
              <button data-on={viewMode === "grouped"} onClick={() => setViewMode("grouped")}>
                <Icon name="users" size={12} /> Grouped by Contact ({groupedCalls.length})
              </button>
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
                {viewMode === "grouped" ? (
                  groupedCalls.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-secondary)" }}>
                        <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "var(--bg-soft)", marginBottom: 8 }}>
                          <Icon name="phone" size={20} />
                        </div>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>No grouped call records found</div>
                      </td>
                    </tr>
                  ) : (
                    groupedCalls.map((g) => {
                      const isExpanded = Boolean(expandedContacts[g.contactKey]);
                      return (
                        <Fragment key={g.contactKey}>
                          <tr style={{ background: isExpanded ? "var(--bg-soft)" : undefined, cursor: "pointer" }} onClick={() => toggleContactExpand(g.contactKey)}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <button
                                  type="button"
                                  className="btn"
                                  data-size="sm"
                                  data-variant="ghost"
                                  style={{ width: "24px", height: "24px", padding: 0 }}
                                  aria-label={isExpanded ? "Collapse" : "Expand"}
                                >
                                  <Icon name={isExpanded ? "chevron-down" : "chevron-right"} size={13} />
                                </button>
                                <div>
                                  <div style={{ fontWeight: 600, color: "var(--text)" }}>{g.customerName}</div>
                                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                                    {g.company} • {g.phone}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 550, color: "var(--text)" }}>{g.closerName}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{g.calls.length} interaction(s)</div>
                            </td>
                            <td>
                              <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                                {g.calls.length} calls
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 550, fontFamily: "var(--mono)" }}>
                                {formatDuration(g.totalDurationSeconds)}
                              </span>
                              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Total Talk Time</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)" }}>Latest: {g.latestCall.disposition}</div>
                              <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: "3px 0 0 0", maxWidth: "340px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {g.latestCall.aiSummary}
                              </p>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn"
                                data-size="sm"
                                data-variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleContactExpand(g.contactKey);
                                }}
                              >
                                {isExpanded ? "Hide Logs" : `View ${g.calls.length} Call(s)`}
                              </button>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <a
                                href={`tel:${g.phone}`}
                                className="btn"
                                data-size="sm"
                                data-variant="primary"
                                onClick={(e) => e.stopPropagation()}
                                title={`Call ${g.customerName}`}
                              >
                                <Icon name="phone" size={11} /> Call
                              </a>
                            </td>
                          </tr>
                          {isExpanded &&
                            g.calls.map((c) => {
                              const isCurrentPlaying = activeAudioId === c.id && isPlaying;
                              return (
                                <tr key={c.id} style={{ background: "var(--bg-soft)" }}>
                                  <td style={{ paddingLeft: "42px" }}>
                                    <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                                      {c.timestamp}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{c.simSlot}</div>
                                  </td>
                                  <td>
                                    <div style={{ fontSize: "var(--fs-caption)", color: "var(--text)" }}>{c.closerName}</div>
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
                                    <span style={{ fontWeight: 550, fontFamily: "var(--mono)", fontSize: "var(--fs-caption)" }}>
                                      {formatDuration(c.durationSeconds)}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 600, fontSize: "12px" }}>{c.disposition}</span>
                                    <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: "2px 0 0 0", maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                                          aria-label={isCurrentPlaying ? "Pause recording" : "Play recording"}
                                          title={isCurrentPlaying ? "Pause recording" : "Play recording"}
                                          style={{ width: "26px", height: "26px", padding: 0, borderRadius: "50%" }}
                                        >
                                          <Icon name={isCurrentPlaying ? "pause" : "play"} size={11} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>No recording</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: "right" }}>
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
                                  </td>
                                </tr>
                              );
                            })}
                        </Fragment>
                      );
                    })
                  )
                ) : filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-secondary)" }}>
                      <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "var(--bg-soft)", marginBottom: 8 }}>
                        <Icon name="phone" size={20} />
                      </div>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>
                        {state.scope.startsWith("agent:")
                          ? `No call recordings found for ${state.scope.slice(6)}`
                          : state.scope === "mine"
                          ? "No call recordings found for your account"
                          : "No call recordings found"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: 4 }}>
                        {state.scope.startsWith("agent:")
                          ? `Calls logged by ${state.scope.slice(6)} on their connected SIM devices will appear here.`
                          : "Real inbound and outbound SIM calls from connected closer devices will appear here automatically."}
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
                          {c.company} • {c.phone ? (
                            <a href={`tel:${c.phone}`} className="tel-link">
                              {c.phone}
                            </a>
                          ) : (
                            "Direct Line"
                          )}
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
                              className="audio-waveform-wrap"
                              style={{
                                background: isCurrentPlaying ? "var(--accent-soft)" : "var(--bg-hover)",
                              }}
                            >
                              {[4, 10, 14, 8, 12, 16, 7, 11, 15, 6, 9].map((h, i) => (
                                <span
                                  key={i}
                                  className="audio-waveform-bar"
                                  style={{
                                    height: `${isCurrentPlaying ? Math.max(3, (h * (i % 2 === 0 ? 1 : 0.6))) : 4}px`,
                                    background: isCurrentPlaying ? "var(--accent)" : "var(--border-strong)",
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
              {scopedMissedCalls.length} requiring immediate attention
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
                {scopedMissedCalls.map((c) => (
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
                      <a
                        href={`tel:${c.phone}`}
                        className="btn"
                        data-size="sm"
                        data-variant="primary"
                        onClick={() => handleResolveMissed(c.id)}
                        title={`Call back ${c.phone} and resolve missed call`}
                      >
                        <Icon name="phone" size={12} /> Call Back Now
                      </a>
                    </td>
                  </tr>
                ))}
                {scopedMissedCalls.length === 0 && (
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
            {scopedDevices.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "36px 16px", color: "var(--text-tertiary)" }}>
                <Icon name="phone" size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div style={{ fontWeight: 600, color: "var(--text)" }}>No Physical SIM Android Devices Connected</div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: 4 }}>
                  Connect your field closer Android handsets running the Closer Telephony Companion APK.
                </div>
              </div>
            ) : (
              scopedDevices.map((d) => (
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
