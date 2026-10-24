"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarClock, Check, Clock3, FileText, History, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { aicloserApi, type LeadHistoryEntry, type LeadTimelineEntry } from "@/lib/api-client";

type ActivityMode = "history" | "note" | "follow-up";

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function eventTone(kind: string) {
  const value = kind.toUpperCase();
  if (value.includes("CALL") || value.includes("FOLLOW") || value.includes("CALLBACK")) return "#ea580c";
  if (value.includes("NOTE")) return "#2563eb";
  if (value.includes("PAYMENT")) return "#059669";
  return "#64748b";
}

export function LeadActivityModal({
  currentFollowUpAt,
  leadId,
  mode,
  onClose,
  onFollowUpCanceled,
  onFollowUpSaved,
  onNoteSaved,
  customerName,
}: {
  currentFollowUpAt?: string | null;
  leadId: string;
  mode: ActivityMode;
  onClose: () => void;
  onFollowUpCanceled?: () => Promise<void> | void;
  onFollowUpSaved?: (followUpAt: string) => Promise<void> | void;
  onNoteSaved?: (body: string) => Promise<void> | void;
  customerName: string;
}) {
  const [history, setHistory] = useState<LeadHistoryEntry[]>([]);
  const [notes, setNotes] = useState<LeadTimelineEntry[]>([]);
  const [followUpAt, setFollowUpAt] = useState(() => toDateTimeLocal(currentFollowUpAt));
  const [noteBody, setNoteBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title = mode === "history" ? "Lead history" : mode === "note" ? "Notes history" : "Follow-up history";
  const description = mode === "history"
    ? "Every recorded change, note, call, payment and follow-up for this lead."
    : mode === "note"
      ? "Review previous notes and add a new internal note."
      : "Review follow-up activity, schedule the next touch, or cancel the current one.";

  const loadActivity = async () => {
    setLoading(true);
    setError("");
    try {
      const [notesResponse, details] = await Promise.all([
        aicloserApi.leads.getNotes(leadId),
        aicloserApi.leads.get360(leadId),
      ]);
      setNotes(notesResponse.timelineNotes ?? []);
      setHistory(details.history ?? []);
      setFollowUpAt(toDateTimeLocal(details.lead?.followUpAt ?? currentFollowUpAt));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this lead history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivity();
  }, [leadId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const visibleHistory = useMemo(() => {
    const auditHistory = history.filter((entry) => {
      const kind = String(entry.kind || "").toUpperCase();
      const title = String(entry.title || "").toUpperCase();
      return kind !== "MESSAGE" && !title.includes("CUSTOMER MESSAGE") && !title.includes("TEAM MESSAGE");
    });
    if (mode === "history") return auditHistory;
    if (mode === "note") {
      const noteHistory = auditHistory.filter((entry) => entry.kind.toUpperCase().includes("NOTE"));
      return noteHistory.length ? noteHistory : notes.map((note) => ({
        id: `note:${note.id}`,
        kind: note.type || "NOTE",
        title: "Note added",
        body: note.body,
        createdAt: note.createdAt,
        actorName: note.author?.name,
        dueAt: null,
        status: undefined,
      }));
    }
    return auditHistory.filter((entry) => {
      const value = `${entry.kind} ${entry.title}`.toUpperCase();
      return value.includes("CALLBACK") || value.includes("FOLLOW") || value.includes("TASK");
    });
  }, [history, mode, notes]);

  const handleAddNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteBody.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await aicloserApi.leads.addNote(leadId, noteBody.trim());
      setNoteBody("");
      await onNoteSaved?.(saved?.body ?? noteBody.trim());
      await loadActivity();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveFollowUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!followUpAt || busy) return;
    setBusy(true);
    setError("");
    try {
      const isoValue = new Date(followUpAt).toISOString();
      await aicloserApi.leads.update(leadId, { followUpAt: isoValue });
      await onFollowUpSaved?.(isoValue);
      await loadActivity();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the follow-up.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelFollowUp = async () => {
    if (busy || !followUpAt) return;
    setBusy(true);
    setError("");
    try {
      await aicloserApi.leads.update(leadId, { followUpAt: null });
      setFollowUpAt("");
      await onFollowUpCanceled?.();
      await loadActivity();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel the follow-up.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sales-activity-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section aria-label={`${title} for ${customerName}`} aria-modal="true" className="sales-activity-modal" role="dialog">
        <header className="sales-activity-modal-header">
          <div>
            <span className="sales-section-eyebrow">{customerName}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button aria-label="Close activity modal" className="sales-icon-button" disabled={busy} onClick={onClose} type="button"><X size={17} /></button>
        </header>

        {mode === "note" ? (
          <form className="sales-activity-composer" onSubmit={handleAddNote}>
            <label htmlFor="lead-activity-note"><FileText size={15} /> New note</label>
            <textarea id="lead-activity-note" onChange={(event) => setNoteBody(event.target.value)} placeholder="Write a note for this lead..." rows={3} value={noteBody} />
            <button className="sales-primary-button compact" disabled={busy || !noteBody.trim()} type="submit"><Plus size={14} /> {busy ? "Saving..." : "Add note"}</button>
          </form>
        ) : null}

        {mode === "follow-up" ? (
          <form className="sales-activity-composer" onSubmit={handleSaveFollowUp}>
            <label htmlFor="lead-activity-follow-up"><CalendarClock size={15} /> Next follow-up</label>
            <input id="lead-activity-follow-up" onChange={(event) => setFollowUpAt(event.target.value)} type="datetime-local" value={followUpAt} />
            <div className="sales-activity-composer-actions">
              <button className="sales-primary-button compact" disabled={busy || !followUpAt} type="submit"><CalendarClock size={14} /> {busy ? "Saving..." : "Save follow-up"}</button>
              <button className="sales-secondary-button compact danger" disabled={busy || !followUpAt} onClick={() => void handleCancelFollowUp()} type="button">Cancel follow-up</button>
            </div>
          </form>
        ) : null}

        {error ? <p className="sales-activity-error">{error}</p> : null}

        <div className="sales-activity-modal-toolbar">
          <strong>{mode === "note" ? `${visibleHistory.length} notes` : mode === "follow-up" ? `${visibleHistory.length} follow-up events` : `${visibleHistory.length} history events`}</strong>
          <button aria-label="Refresh history" className="sales-history-refresh-button" disabled={loading || busy} onClick={() => void loadActivity()} type="button">{loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}</button>
        </div>

        <div className="sales-activity-modal-list">
          {loading ? <div className="sales-activity-empty"><Loader2 className="animate-spin" size={18} /> Loading history...</div> : null}
          {!loading && !visibleHistory.length ? <div className="sales-activity-empty"><History size={18} /> No history recorded yet.</div> : null}
          {!loading ? visibleHistory.map((entry) => (
            <article className="sales-activity-event" key={entry.id}>
              <span className="sales-activity-event-dot" style={{ background: eventTone(entry.kind) }} />
              <div>
                <div className="sales-activity-event-head"><strong>{entry.title}</strong><time>{formatDate(entry.createdAt)}</time></div>
                {entry.body ? <p>{entry.body}</p> : null}
                <small>{[entry.actorName, entry.dueAt ? `Due ${formatDate(entry.dueAt)}` : null, entry.status].filter(Boolean).join(" · ")}</small>
              </div>
            </article>
          )) : null}
        </div>
        <footer className="sales-activity-modal-footer"><Clock3 size={13} /> Synced from the Central lead history API</footer>
      </section>
    </div>
  );
}
