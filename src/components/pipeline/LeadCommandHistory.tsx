"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import { CURRENT_USER } from "@/lib/store";
import { aicloserApi, type CallLog, type LeadHistoryEntry, type LeadTimelineEntry } from "@/lib/api-client";

export interface LeadCommandHistoryProps {
  leadId: string;
  conversationId?: string;
  customerName?: string;
  customerPhone?: string;
  currentFollowUpAt?: string | null;
  initialNotes?: string;
  onFollowUpSaved?: (iso: string) => void;
  onNoteSaved?: (note: string) => void;
  activeTab?: "history" | "note" | "callback" | "calls";
  onTabChange?: (tab: "history" | "note" | "callback" | "calls") => void;
}

interface UnifiedEvent {
  id: string;
  kind: "NOTE" | "CALLBACK" | "CALL" | "PAYMENT" | "STAGE" | "REASSIGN" | "TASK" | "SYSTEM";
  title: string;
  body?: string;
  createdAt: string;
  dueAt?: string | null;
  status?: string;
  actorName?: string | null;
  recordingUrl?: string | null;
  durationSeconds?: number;
  amount?: number | null;
  currency?: string;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "Just now";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateStr);
  }
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getTone(kind: UnifiedEvent["kind"]): "accent" | "warning" | "success" | "danger" | "default" {
  switch (kind) {
    case "NOTE":
      return "accent";
    case "CALLBACK":
      return "warning";
    case "CALL":
      return "accent";
    case "PAYMENT":
      return "success";
    case "STAGE":
      return "warning";
    case "REASSIGN":
      return "accent";
    default:
      return "default";
  }
}

function getIcon(kind: UnifiedEvent["kind"]) {
  switch (kind) {
    case "NOTE":
      return "pencil";
    case "CALLBACK":
      return "calendar-clock";
    case "CALL":
      return "phone";
    case "PAYMENT":
      return "card";
    case "STAGE":
      return "status-progress";
    case "REASSIGN":
      return "user-plus";
    case "TASK":
      return "check-circle";
    default:
      return "clock";
  }
}

export function LeadCommandHistory({
  leadId,
  conversationId,
  customerName,
  customerPhone,
  currentFollowUpAt,
  initialNotes,
  onFollowUpSaved,
  onNoteSaved,
  activeTab: controlledTab,
  onTabChange,
}: LeadCommandHistoryProps) {
  const [internalTab, setInternalTab] = useState<"history" | "note" | "callback" | "calls">("history");
  const tab = controlledTab ?? internalTab;
  const setTab = (newTab: "history" | "note" | "callback" | "calls") => {
    if (onTabChange) onTabChange(newTab);
    else setInternalTab(newTab);
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [rawHistory, setRawHistory] = useState<LeadHistoryEntry[]>([]);
  const [rawNotes, setRawNotes] = useState<LeadTimelineEntry[]>([]);
  const [rawCalls, setRawCalls] = useState<CallLog[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);

  // Form states
  const [noteBody, setNoteBody] = useState("");
  const [callbackAt, setCallbackAt] = useState(() => toDateTimeLocal(currentFollowUpAt));
  const [callbackNote, setCallbackNote] = useState("");

  const loadData = useCallback(async () => {
    if (!leadId && !conversationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    let fetchedHistory: LeadHistoryEntry[] = [];
    let fetchedNotes: LeadTimelineEntry[] = [];
    let fetchedCalls: CallLog[] = [];
    let fetchedPayments: any[] = [];
    let leadFollowUp: string | null = null;

    // 1. Fetch from Central API if valid leadId
    if (leadId && !leadId.startsWith("ld-")) {
      try {
        const [notesRes, detailsRes] = await Promise.allSettled([
          aicloserApi.leads.getNotes(leadId),
          aicloserApi.leads.get360(leadId),
        ]);

        if (notesRes.status === "fulfilled" && notesRes.value) {
          fetchedNotes = notesRes.value.timelineNotes || [];
        }
        if (detailsRes.status === "fulfilled" && detailsRes.value) {
          const d = detailsRes.value;
          fetchedHistory = d.history || [];
          fetchedCalls = d.callLogs || d.calls || [];
          fetchedPayments = d.payments || [];
          if (d.lead?.followUpAt) leadFollowUp = d.lead.followUpAt;
        }
      } catch {}
    }

    // 2. Fetch from conversation 360 if conversationId provided
    if (conversationId) {
      try {
        const c360 = await aicloserApi.conversations.get360(conversationId);
        if (c360) {
          if (Array.isArray(c360.calls) && c360.calls.length > 0 && fetchedCalls.length === 0) {
            fetchedCalls = c360.calls;
          }
          if (Array.isArray(c360.payments) && c360.payments.length > 0 && fetchedPayments.length === 0) {
            fetchedPayments = c360.payments;
          }
          if (Array.isArray(c360.history) && c360.history.length > 0 && fetchedHistory.length === 0) {
            fetchedHistory = c360.history;
          }
          if (Array.isArray(c360.timeline) && c360.timeline.length > 0 && fetchedNotes.length === 0) {
            fetchedNotes = c360.timeline;
          }
          if (c360.lead?.followUpAt && !leadFollowUp) {
            leadFollowUp = c360.lead.followUpAt;
          }
        }
      } catch {}
    }

    setRawHistory(fetchedHistory);
    setRawNotes(fetchedNotes);
    setRawCalls(fetchedCalls);
    setRawPayments(fetchedPayments);

    if (leadFollowUp) {
      setCallbackAt(toDateTimeLocal(leadFollowUp));
    } else if (currentFollowUpAt) {
      setCallbackAt(toDateTimeLocal(currentFollowUpAt));
    }

    setLoading(false);
  }, [leadId, conversationId, currentFollowUpAt]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unified Chronological Stream with Composite Signature Deduplication
  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    const list: UnifiedEvent[] = [];
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();

    const tryAddEvent = (entry: UnifiedEvent) => {
      if (seenIds.has(entry.id)) return false;

      const timeMs = new Date(entry.createdAt).getTime() || 0;
      const minuteBucket = Math.floor(timeMs / 60000);
      const cleanTitle = (entry.title || "").trim().toLowerCase();
      const cleanBody = (entry.body || "").trim().toLowerCase().slice(0, 50);
      const signature = `${entry.kind}:${cleanTitle}:${cleanBody}:${minuteBucket}`;

      if (seenSignatures.has(signature)) return false;

      seenIds.add(entry.id);
      seenSignatures.add(signature);
      list.push(entry);
      return true;
    };

    // 1. Process History Entries
    rawHistory.forEach((h) => {
      const id = `h-${h.id}`;
      const k = (h.kind || "").toUpperCase();
      let kind: UnifiedEvent["kind"] = "SYSTEM";
      if (k.includes("NOTE")) kind = "NOTE";
      else if (k.includes("FOLLOW") || k.includes("CALLBACK")) kind = "CALLBACK";
      else if (k.includes("CALL")) kind = "CALL";
      else if (k.includes("PAYMENT")) kind = "PAYMENT";
      else if (k.includes("STAGE") || k.includes("STATUS")) kind = "STAGE";
      else if (k.includes("ASSIGN") || k.includes("REASSIGN")) kind = "REASSIGN";
      else if (k.includes("TASK")) kind = "TASK";

      tryAddEvent({
        id,
        kind,
        title: h.title || "Activity logged",
        body: h.body,
        createdAt: h.createdAt,
        dueAt: h.dueAt,
        status: h.status,
        actorName: h.actorName,
      });
    });

    // 2. Process Notes (only if not already present in history)
    rawNotes.forEach((n) => {
      const existsInHistory = rawHistory.some((h) => h.id === n.id || (h as any).noteId === n.id);
      if (existsInHistory) return;

      tryAddEvent({
        id: `n-${n.id}`,
        kind: "NOTE",
        title: "Internal Note",
        body: n.body,
        createdAt: n.createdAt,
        actorName: n.author?.name || "Closer",
      });
    });

    // 3. Process Calls (only if not already present in history)
    rawCalls.forEach((c) => {
      const existsInHistory = rawHistory.some((h) => h.id === c.id || (h as any).callId === c.id);
      if (existsInHistory) return;

      const isOutbound = c.direction === "OUTBOUND";
      const recUrl = c.recordingUrl || (c as any).audioUrl || (c as any).url || null;
      tryAddEvent({
        id: `c-${c.id}`,
        kind: "CALL",
        title: `${isOutbound ? "Outbound" : "Inbound"} Call (${formatDuration(c.durationSeconds)})`,
        body: c.note || c.outcome || (c.hasRecording ? "Recording saved" : undefined),
        createdAt: c.endedAt || (c as any).createdAt || new Date().toISOString(),
        actorName: c.agent?.user?.displayName || c.agent?.agentCode || "Agent",
        recordingUrl: recUrl,
        durationSeconds: c.durationSeconds,
        status: c.status,
      });
    });

    // 4. Process Payments
    rawPayments.forEach((p) => {
      const existsInHistory = rawHistory.some((h) => h.id === p.id || (h as any).paymentId === p.id);
      if (existsInHistory) return;

      tryAddEvent({
        id: `p-${p.id}`,
        kind: "PAYMENT",
        title: `Payment ${p.status || "Record"}`,
        body: p.utrReference ? `UTR: ${p.utrReference}` : undefined,
        createdAt: p.createdAt || new Date().toISOString(),
        amount: p.totalAmount || p.amount,
        currency: p.currency || "INR",
        status: p.status,
      });
    });

    // 5. Fallback Initial Note if list is empty but initialNotes exists
    if (list.length === 0 && initialNotes) {
      tryAddEvent({
        id: "init-note",
        kind: "NOTE",
        title: "Initial Note",
        body: initialNotes,
        createdAt: new Date().toISOString(),
        actorName: CURRENT_USER,
      });
    }

    // Sort descending by timestamp
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [rawHistory, rawNotes, rawCalls, rawPayments, initialNotes]);

  // Handler: Add Note
  const handleAddNote = async () => {
    if (!noteBody.trim() || saving) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const text = noteBody.trim();
    try {
      if (leadId && !leadId.startsWith("ld-")) {
        await aicloserApi.leads.addNote(leadId, text);
      }
      if (conversationId) {
        await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: text }),
        });
      }

      try {
        onNoteSaved?.(text);
      } catch (cbErr) {
        console.warn("onNoteSaved error:", cbErr);
      }
      setNoteBody("");
      setSuccessMsg("Note saved successfully.");
      setTimeout(() => setSuccessMsg(null), 2500);

      // Optimistically insert into stream
      const optimisticNote: UnifiedEvent = {
        id: `opt-n-${Date.now()}`,
        kind: "NOTE",
        title: "Internal Note",
        body: text,
        createdAt: new Date().toISOString(),
        actorName: CURRENT_USER,
      };
      setRawNotes((prev) => [
        {
          id: `opt-${Date.now()}`,
          body: text,
          createdAt: new Date().toISOString(),
          author: { id: "me", name: CURRENT_USER },
        },
        ...prev,
      ]);
      setTab("history");
    } catch (err: any) {
      setError(err?.message || "Could not save note.");
    } finally {
      setSaving(false);
    }
  };

  // Handler: Schedule Callback
  const handleSaveCallback = async () => {
    if (!callbackAt || saving) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const iso = new Date(callbackAt).toISOString();
      if (leadId && !leadId.startsWith("ld-")) {
        await Promise.allSettled([
          aicloserApi.leads.update(leadId, { followUpAt: iso }),
          aicloserApi.leads.addTask(leadId, {
            title: callbackNote.trim() || `Scheduled Callback for ${customerName || "Lead"}`,
            dueAt: iso,
            priority: "HIGH",
          }),
        ]);
      }
      if (conversationId) {
        await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nextFollowUpAt: iso,
            notes: callbackNote.trim() ? callbackNote.trim() : undefined,
          }),
        });
      }

      try {
        onFollowUpSaved?.(iso);
      } catch (cbErr) {
        console.warn("onFollowUpSaved error:", cbErr);
      }
      setSuccessMsg("Callback scheduled successfully.");
      setTimeout(() => setSuccessMsg(null), 2500);

      // Optimistically insert
      const optCallback: LeadHistoryEntry = {
        id: `opt-cb-${Date.now()}`,
        kind: "CALLBACK",
        title: "Callback Scheduled",
        body: callbackNote.trim() || undefined,
        createdAt: new Date().toISOString(),
        dueAt: iso,
        actorName: CURRENT_USER,
        status: "SCHEDULED",
      };
      setRawHistory((prev) => [optCallback, ...prev]);
      setCallbackNote("");
      setTab("history");
    } catch (err: any) {
      setError(err?.message || "Could not schedule callback.");
    } finally {
      setSaving(false);
    }
  };

  // Handler: Cancel Callback
  const handleCancelCallback = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (leadId && !leadId.startsWith("ld-")) {
        await aicloserApi.leads.update(leadId, { followUpAt: null });
      }
      if (conversationId) {
        await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextFollowUpAt: null }),
        });
      }
      setCallbackAt("");
      setSuccessMsg("Callback canceled.");
      setTimeout(() => setSuccessMsg(null), 2500);
      setTab("history");
    } catch (err: any) {
      setError(err?.message || "Could not cancel callback.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: "12px", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Top Header & Tab Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Icon name="clock" size={13} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Command History & Notes
          </span>
        </div>
        <button
          type="button"
          className="icon-btn"
          title="Refresh history"
          onClick={loadData}
          disabled={loading}
          style={{ width: "22px", height: "22px" }}
        >
          <Icon name="refresh" size={11} />
        </button>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="seg" style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "2px" }}>
        <button
          type="button"
          data-on={tab === "history"}
          onClick={() => setTab("history")}
          style={{ fontSize: "11px", padding: "4px 2px", textAlign: "center" }}
        >
          History ({unifiedEvents.length})
        </button>
        <button
          type="button"
          data-on={tab === "note"}
          onClick={() => setTab("note")}
          style={{ fontSize: "11px", padding: "4px 2px", textAlign: "center" }}
        >
          + Note
        </button>
        <button
          type="button"
          data-on={tab === "callback"}
          onClick={() => setTab("callback")}
          style={{ fontSize: "11px", padding: "4px 2px", textAlign: "center" }}
        >
          Callback
        </button>
        <button
          type="button"
          data-on={tab === "calls"}
          onClick={() => setTab("calls")}
          style={{ fontSize: "11px", padding: "4px 2px", textAlign: "center" }}
        >
          Calls ({rawCalls.length})
        </button>
      </div>

      {/* Status Banners */}
      {error && <p className="form-error" style={{ margin: 0, fontSize: "11.5px" }}>{error}</p>}
      {successMsg && (
        <span className="pill" style={{ color: "var(--accent-strong)", background: "var(--bg-soft)", fontSize: "11px" }}>
          ✓ {successMsg}
        </span>
      )}

      {/* Tab 1: General Unified History Stream */}
      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto", paddingRight: "2px" }}>
          {loading ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: "11.5px" }}>
              Loading history...
            </div>
          ) : unifiedEvents.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: "11.5px" }}>
              No history or notes logged yet.
            </div>
          ) : (
            <div className="activity">
              {unifiedEvents.map((evt) => (
                <div key={evt.id} className="activity-row" style={{ padding: "6px 0", gap: "8px" }}>
                  <span className="dot" data-tone={getTone(evt.kind)} style={{ marginTop: "3px" }} />
                  <div className="activity-copy">
                    <div className="activity-title-line">
                      <strong style={{ fontSize: "11.5px" }}>{evt.title}</strong>
                      {evt.status && (
                        <span className="chip" data-tone={evt.status === "SUCCESS" || evt.status === "COMPLETED" ? "success" : "warning"} style={{ fontSize: "9.5px", padding: "0 4px", height: "16px" }}>
                          {evt.status}
                        </span>
                      )}
                      {evt.amount !== undefined && evt.amount !== null && (
                        <span className="chip" data-tone="success" style={{ fontSize: "10px", padding: "0 5px", height: "16px", fontWeight: 700 }}>
                          ₹{evt.amount.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                    {evt.body && (
                      <div className="activity-sub" style={{ fontSize: "11px", color: "var(--text)", whiteSpace: "pre-wrap", marginTop: "2px" }}>
                        {evt.body}
                      </div>
                    )}
                    {evt.dueAt && (
                      <div style={{ fontSize: "10.5px", color: "var(--accent-strong)", marginTop: "2px", fontWeight: 550 }}>
                        📅 Due: {formatDateTime(evt.dueAt)}
                      </div>
                    )}
                    {/* Audio Player for Call Recording */}
                    {evt.recordingUrl && (
                      <div style={{ marginTop: "4px" }}>
                        <audio controls src={evt.recordingUrl} preload="none" style={{ width: "100%", height: "26px" }} />
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                      {evt.actorName && (
                        <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 500 }}>
                          by {evt.actorName}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="activity-time" style={{ fontSize: "10px" }}>
                    {formatDateTime(evt.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Add Note */}
      {tab === "note" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label htmlFor="command-note" style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>
            New Note for {customerName || "Lead"}
          </label>
          <textarea
            id="command-note"
            className="textarea"
            rows={3}
            placeholder="Type notes on client conversation, deal negotiation, objections, or next actions..."
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            style={{ fontSize: "12px", resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
            <button
              type="button"
              className="btn"
              data-size="sm"
              onClick={() => setTab("history")}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              data-variant="primary"
              data-size="sm"
              disabled={!noteBody.trim() || saving}
              onClick={handleAddNote}
            >
              {saving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Callback Scheduling */}
      {tab === "callback" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label htmlFor="callback-datetime" style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>
            Callback Date & Time
          </label>
          <input
            id="callback-datetime"
            type="datetime-local"
            className="input"
            value={callbackAt}
            onChange={(e) => setCallbackAt(e.target.value)}
            style={{ fontSize: "12px", width: "100%" }}
          />
          <input
            className="input"
            placeholder="Callback note / agenda (e.g. Closing advance payment call)"
            value={callbackNote}
            onChange={(e) => setCallbackNote(e.target.value)}
            style={{ fontSize: "12px" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
            {callbackAt ? (
              <button
                type="button"
                className="btn"
                data-variant="danger"
                data-size="sm"
                onClick={handleCancelCallback}
                disabled={saving}
              >
                Clear
              </button>
            ) : <span />}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="btn"
                data-size="sm"
                onClick={() => setTab("history")}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="accent"
                data-size="sm"
                disabled={!callbackAt || saving}
                onClick={handleSaveCallback}
              >
                {saving ? "Saving..." : "Schedule Callback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Calls & Recordings */}
      {tab === "calls" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
          {rawCalls.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: "11.5px" }}>
              No SIM or Web phone calls logged yet.
            </div>
          ) : (
            rawCalls.map((c) => {
              const recUrl = c.recordingUrl || (c as any).audioUrl || (c as any).url || null;
              const isOutbound = c.direction === "OUTBOUND";
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "8px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--bg-soft)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Icon name="phone" size={12} />
                      <strong style={{ fontSize: "11.5px" }}>
                        {isOutbound ? "Outbound" : "Inbound"} Call • {formatDuration(c.durationSeconds)}
                      </strong>
                    </div>
                    <span className="chip" data-tone={c.status === "COMPLETED" || c.status === "ANSWERED" ? "success" : "warning"} style={{ fontSize: "9.5px", padding: "0 4px" }}>
                      {c.status}
                    </span>
                  </div>
                  {c.note && (
                    <div style={{ fontSize: "11px", color: "var(--text)" }}>{c.note}</div>
                  )}
                  {recUrl ? (
                    <div style={{ marginTop: "4px" }}>
                      <audio controls src={recUrl} preload="none" style={{ width: "100%", height: "26px" }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>No recording audio file</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                    <span>Agent: {c.agent?.user?.displayName || "Closer"}</span>
                    <span>{formatDateTime(c.endedAt || (c as any).createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
