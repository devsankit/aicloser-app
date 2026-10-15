"use client";

import { useState, useEffect } from "react";
import {
  Smartphone,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Play,
  Volume2,
  HardDrive,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";

type ActionItem = {
  id: string;
  level: "critical" | "warning" | "info" | "success";
  title: string;
  deviceOrUser: string;
  details: string;
  recommendation: string;
};

type MobileDevice = {
  id: string;
  deviceId: string;
  deviceName: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  appVersion: string;
  simLabel: string;
  officeSimNumber: string;
  dialerPackage: string;
  recordingCapability: string;
  recordingEnabled: boolean;
  recordingProfile: {
    title: string;
    automationMode: string;
    requiresAccessibility: boolean;
    userActionRequired: boolean;
    limitations: string | null;
  } | null;
  lastSeenAt: string;
  agentName: string;
  agentEmail: string;
};

type MobileCall = {
  id: string;
  phoneNumber: string;
  direction: "INBOUND" | "OUTBOUND";
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  recordingStatus: string;
  recordingPath: string | null;
  recordingError: string | null;
  recordingSizeBytes: number | null;
  agentName: string;
  deviceModel: string;
  deviceManufacturer: string;
  dialerPackage: string;
  uploadAttempts: number;
};

type DiagnosticEvent = {
  id: string;
  createdAt: string;
  deviceName: string;
  payload: any;
};

type TelemetryData = {
  summary: {
    totalDevices: number;
    totalCalls: number;
    uploadedRecordings: number;
    failedRecordings: number;
    pendingRecordings: number;
    healthyRate: number;
  };
  actionItems: ActionItem[];
  devices: MobileDevice[];
  calls: MobileCall[];
  diagnosticEvents: DiagnosticEvent[];
};

function formatTimeAgo(isoString: string | null) {
  if (!isoString) return "Never";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function MobileDiagnosticsPanel() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCallAudio, setActiveCallAudio] = useState<string | null>(null);
  const [showRawEvents, setShowRawEvents] = useState(false);

  async function fetchTelemetry() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/super-admin/mobile-telemetry", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load telemetry");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to connect to telemetry API");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTelemetry();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#FFFFFF", display: "flex", alignItems: "center", gap: "0.6rem", margin: 0 }}>
            <Smartphone style={{ width: "24px", height: "24px", color: "#F97316" }} />
            Mobile Telemetry & Call Recording Diagnostics
          </h2>
          <p style={{ color: "#A1A1AA", fontSize: "0.88rem", marginTop: "0.3rem", margin: 0 }}>
            Real-time fleet health, hardware capabilities, recording pipeline errors, and action items.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTelemetry}
          disabled={loading}
          style={{
            background: "#18201C",
            color: "#FFFFFF",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "10px",
            padding: "0.55rem 1rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <RefreshCw style={{ width: "15px", height: "15px", animation: loading ? "spin 1s linear infinite" : "none" }} />
          {loading ? "Scanning Fleet..." : "Refresh Diagnostics"}
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "12px", padding: "1rem", color: "#FCA5A5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700 }}>
            <AlertCircle style={{ width: "18px", height: "18px" }} />
            Telemetry Connection Error
          </div>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>{error}</p>
        </div>
      )}

      {/* Top 4 Summary Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <div style={{ background: "#111714", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#A1A1AA", fontSize: "0.82rem", fontWeight: 600 }}>
            <span>REGISTERED PHONES</span>
            <Smartphone style={{ width: "18px", height: "18px", color: "#F97316" }} />
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#FFFFFF", marginTop: "0.4rem" }}>
            {data?.summary.totalDevices ?? 0}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#4ADE80", marginTop: "0.3rem" }}>
            Active agent devices reporting
          </div>
        </div>

        <div style={{ background: "#111714", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#A1A1AA", fontSize: "0.82rem", fontWeight: 600 }}>
            <span>TRACKED CALLS</span>
            <PhoneCall style={{ width: "18px", height: "18px", color: "#38BDF8" }} />
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#FFFFFF", marginTop: "0.4rem" }}>
            {data?.summary.totalCalls ?? 0}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#A1A1AA", marginTop: "0.3rem" }}>
            Total CRM phone calls logged
          </div>
        </div>

        <div style={{ background: "#111714", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#A1A1AA", fontSize: "0.82rem", fontWeight: 600 }}>
            <span>RECORDINGS SYNCED</span>
            <CheckCircle2 style={{ width: "18px", height: "18px", color: "#4ADE80" }} />
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#FFFFFF", marginTop: "0.4rem" }}>
            {data?.summary.uploadedRecordings ?? 0}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#4ADE80", marginTop: "0.3rem" }}>
            {data?.summary.healthyRate ?? 100}% playback ready on cloud
          </div>
        </div>

        <div style={{ background: "#111714", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#A1A1AA", fontSize: "0.82rem", fontWeight: 600 }}>
            <span>RECORDING FAILURES</span>
            <AlertTriangle style={{ width: "18px", height: "18px", color: (data?.summary.failedRecordings ?? 0) > 0 ? "#EF4444" : "#A1A1AA" }} />
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: (data?.summary.failedRecordings ?? 0) > 0 ? "#EF4444" : "#FFFFFF", marginTop: "0.4rem" }}>
            {data?.summary.failedRecordings ?? 0}
          </div>
          <div style={{ fontSize: "0.78rem", color: (data?.summary.failedRecordings ?? 0) > 0 ? "#EF4444" : "#4ADE80", marginTop: "0.3rem" }}>
            {(data?.summary.failedRecordings ?? 0) > 0 ? "Requires attention below" : "Zero active sync errors"}
          </div>
        </div>
      </div>

      {/* SECTION 1: WHAT NEEDS WORK RIGHT NOW (PLAIN-LANGUAGE ACTION ITEMS) */}
      <div style={{ background: "#111714", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "1.4rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
          <Activity style={{ width: "20px", height: "20px", color: "#F97316" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
            Active Action Items & Exact Error Explanations
          </h3>
        </div>

        {data?.actionItems && data.actionItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {data.actionItems.map((item) => {
              const border =
                item.level === "critical"
                  ? "rgba(239, 68, 68, 0.35)"
                  : item.level === "warning"
                  ? "rgba(245, 158, 11, 0.35)"
                  : item.level === "success"
                  ? "rgba(34, 197, 94, 0.35)"
                  : "rgba(56, 189, 248, 0.35)";
              const bg =
                item.level === "critical"
                  ? "rgba(239, 68, 68, 0.07)"
                  : item.level === "warning"
                  ? "rgba(245, 158, 11, 0.07)"
                  : item.level === "success"
                  ? "rgba(34, 197, 94, 0.07)"
                  : "rgba(56, 189, 248, 0.07)";
              const textColor =
                item.level === "critical" ? "#F87171" : item.level === "warning" ? "#FBBF24" : item.level === "success" ? "#4ADE80" : "#38BDF8";

              return (
                <div
                  key={item.id}
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: "12px",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, color: textColor, fontSize: "0.95rem" }}>
                      {item.level === "critical" ? (
                        <AlertCircle style={{ width: "18px", height: "18px" }} />
                      ) : item.level === "warning" ? (
                        <AlertTriangle style={{ width: "18px", height: "18px" }} />
                      ) : (
                        <CheckCircle2 style={{ width: "18px", height: "18px" }} />
                      )}
                      {item.title}
                    </div>
                    <span style={{ fontSize: "0.75rem", background: "rgba(255, 255, 255, 0.08)", padding: "0.2rem 0.6rem", borderRadius: "99px", color: "#E4E4E7" }}>
                      {item.deviceOrUser}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.85rem", color: "#D4D4D8", lineHeight: 1.5 }}>
                    <strong>Kyun hua (Root Cause):</strong> {item.details}
                  </div>

                  <div style={{ fontSize: "0.85rem", color: "#67E8F9", background: "rgba(0, 0, 0, 0.25)", padding: "0.6rem 0.8rem", borderRadius: "8px", borderLeft: `3px solid ${textColor}` }}>
                    <strong>Abhi kya karna hai (Fix):</strong> {item.recommendation}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "2rem", color: "#A1A1AA", fontSize: "0.9rem" }}>
            Zero active errors! All devices are operating in verified state.
          </div>
        )}
      </div>

      {/* SECTION 2: CONNECTED DEVICE FLEET TABLE */}
      <div style={{ background: "#111714", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "1.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Layers style={{ width: "20px", height: "20px", color: "#38BDF8" }} />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
              Device Fleet & Telephony Capabilities
            </h3>
          </div>
          <span style={{ color: "#A1A1AA", fontSize: "0.82rem" }}>
            Total: {data?.devices.length ?? 0} devices
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.12)", color: "#71717A" }}>
                <th style={{ padding: "0.75rem 0.6rem" }}>AGENT</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>DEVICE MODEL</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>ANDROID & APK</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>RECORDING CAPABILITY</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>SIM DETAILS</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>LAST SEEN</th>
              </tr>
            </thead>
            <tbody>
              {data?.devices && data.devices.length > 0 ? (
                data.devices.map((device) => {
                  const cap = device.recordingCapability;
                  const isAuto = cap === "SYSTEM_FOLDER_OR_MEDIASTORE";
                  const isShare = cap === "DIALER_SHARE";
                  const isMic = cap === "MICROPHONE_FALLBACK";

                  return (
                    <tr key={device.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "0.75rem 0.6rem", fontWeight: 600, color: "#FFFFFF" }}>
                        <div>{device.agentName}</div>
                        <div style={{ fontSize: "0.72rem", color: "#71717A" }}>{device.agentEmail}</div>
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem", color: "#E4E4E7" }}>
                        <div style={{ fontWeight: 600 }}>{device.manufacturer} {device.model || device.deviceName}</div>
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem", color: "#A1A1AA" }}>
                        <div>Android {device.androidVersion || "N/A"}</div>
                        <div style={{ fontSize: "0.72rem", color: "#F97316" }}>v{device.appVersion || "1.0.22"}</div>
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem" }}>
                        {isAuto ? (
                          <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ADE80", padding: "0.25rem 0.65rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 700 }}>
                            ● Automatic Scrape (Ready)
                          </span>
                        ) : isShare ? (
                          <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#FBBF24", padding: "0.25rem 0.65rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 700 }}>
                            ● Manual Dialer Share
                          </span>
                        ) : isMic ? (
                          <span style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38BDF8", padding: "0.25rem 0.65rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 700 }}>
                            ● Microphone Fallback
                          </span>
                        ) : (
                          <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#F87171", padding: "0.25rem 0.65rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 700 }}>
                            ● Setup Incomplete
                          </span>
                        )}
                        <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#A1A1AA" }}>
                          {device.recordingProfile?.title || device.dialerPackage || "Profile not resolved"}
                          {device.recordingProfile?.requiresAccessibility ? " · Accessibility" : ""}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem", color: "#A1A1AA" }}>
                        {device.simLabel || device.officeSimNumber || "Default SIM"}
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem", color: "#71717A", fontSize: "0.78rem" }}>
                        {formatTimeAgo(device.lastSeenAt)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#71717A" }}>
                    No devices registered yet. Log in to AI Closer mobile APK to register a device.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: RECENT CALL RECORDINGS & AUDIO INSPECTOR */}
      <div style={{ background: "#111714", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "1.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Volume2 style={{ width: "20px", height: "20px", color: "#4ADE80" }} />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
              Recent Calls & Audio Playback Inspector
            </h3>
          </div>
          <span style={{ color: "#A1A1AA", fontSize: "0.82rem" }}>
            Showing latest {data?.calls.length ?? 0} calls
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.12)", color: "#71717A" }}>
                <th style={{ padding: "0.75rem 0.6rem" }}>PHONE & AGENT</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>DIRECTION</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>DURATION</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>DEVICE</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>SYNC STATUS</th>
                <th style={{ padding: "0.75rem 0.6rem" }}>AUDIO PLAYBACK</th>
              </tr>
            </thead>
            <tbody>
              {data?.calls && data.calls.length > 0 ? (
                data.calls.map((call) => {
                  const isUploaded = call.recordingStatus === "UPLOADED";
                  const isFailed = call.recordingStatus === "FAILED";

                  return (
                    <tr key={call.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "0.75rem 0.6rem" }}>
                        <div style={{ fontWeight: 700, color: "#FFFFFF" }}>{call.phoneNumber}</div>
                        <div style={{ fontSize: "0.75rem", color: "#71717A" }}>{call.agentName} · {formatTimeAgo(call.startedAt)}</div>
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: call.direction === "OUTBOUND" ? "#38BDF8" : "#4ADE80" }}>
                          {call.direction}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem", color: "#E4E4E7" }}>
                        {call.durationSeconds}s
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem", color: "#A1A1AA" }}>
                        {call.deviceManufacturer} {call.deviceModel}
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem" }}>
                        {isUploaded ? (
                          <span style={{ color: "#4ADE80", fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <CheckCircle2 style={{ width: "14px", height: "14px" }} />
                            UPLOADED
                          </span>
                        ) : isFailed ? (
                          <div>
                            <span style={{ color: "#EF4444", fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <AlertCircle style={{ width: "14px", height: "14px" }} />
                              FAILED
                            </span>
                            {call.recordingError && (
                              <div style={{ fontSize: "0.72rem", color: "#FCA5A5", maxWidth: "200px" }}>{call.recordingError}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#FBBF24", fontWeight: 700, fontSize: "0.8rem" }}>
                            {call.recordingStatus || "PENDING"}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem" }}>
                        {isUploaded ? (
                          <audio
                            controls
                            preload="none"
                            src={`/api/sales/mobile/calls/${call.id}/recording`}
                            style={{ height: "32px", width: "180px" }}
                          />
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#71717A" }}>No audio</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#71717A" }}>
                    No call sessions recorded yet. Make a call from AI Closer to start tracking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: RAW DIAGNOSTIC EVENT STREAM */}
      <div style={{ background: "#111714", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "1.4rem" }}>
        <button
          type="button"
          onClick={() => setShowRawEvents(!showRawEvents)}
          style={{
            background: "transparent",
            border: "none",
            color: "#A1A1AA",
            cursor: "pointer",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "#FFFFFF", fontWeight: 700 }}>
            <HardDrive style={{ width: "18px", height: "18px", color: "#F97316" }} />
            Raw Device Telemetry Events Feed ({data?.diagnosticEvents.length ?? 0})
          </div>
          {showRawEvents ? <ChevronUp style={{ width: "18px", height: "18px" }} /> : <ChevronDown style={{ width: "18px", height: "18px" }} />}
        </button>

        {showRawEvents && (
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {data?.diagnosticEvents && data.diagnosticEvents.length > 0 ? (
              data.diagnosticEvents.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    background: "#090D0B",
                    borderRadius: "8px",
                    padding: "0.8rem",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    fontFamily: "monospace",
                    fontSize: "0.78rem",
                    color: "#A1A1AA",
                  }}
                >
                  <div style={{ color: "#38BDF8", marginBottom: "0.3rem", fontWeight: 600 }}>
                    [{formatTimeAgo(evt.createdAt)}] {evt.deviceName}
                  </div>
                  <pre style={{ margin: 0, overflowX: "auto", whiteSpace: "pre-wrap", color: "#E4E4E7" }}>
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </div>
              ))
            ) : (
              <div style={{ color: "#71717A", fontSize: "0.85rem", padding: "1rem 0" }}>
                No telemetry events stored yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
