"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Edit3, MessageSquare, PhoneCall, Plus, RefreshCw, Smartphone, Trash2, X } from "lucide-react";

interface TimelineNote {
  id: string;
  type: string;
  body: string;
  createdAt: string;
  metadata?: any;
}

export function LeadNotesManager({
  leadId,
  customerName,
  initialNotes = [],
  onNotesUpdated,
}: {
  leadId: string;
  customerName: string;
  initialNotes?: any[];
  onNotesUpdated?: () => void;
}) {
  const [notes, setNotes] = useState<TimelineNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [newNoteType, setNewNoteType] = useState("NOTE");
  const [isSaving, setIsSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef<HTMLDivElement | null>(null);
  const noteTypes = [
    { value: "NOTE", label: "Conversation Note" },
    { value: "CALL", label: "Call Update" },
    { value: "OBJECTION", label: "Objection Raised" },
    { value: "FOLLOW_UP", label: "Follow-Up Scheduled" },
  ];

  useEffect(() => {
    if (!isTypeMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target as Node)) {
        setIsTypeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isTypeMenuOpen]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sales/leads/${leadId}/notes`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok && Array.isArray(data.timelineNotes)) {
        setNotes(data.timelineNotes);
      }
    } catch {
      // fallback to initial notes if available
      if (initialNotes.length > 0) {
        setNotes(initialNotes as TimelineNote[]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, [leadId]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteBody.trim() || isSaving) return;

    setIsSaving(true);
    setStatusMessage("");
    try {
      const res = await fetch(`/api/sales/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: newNoteBody.trim(),
          type: newNoteType,
          source: "web-dashboard",
        }),
      });
      const data = await res.json();
      if (data.ok && data.note) {
        setNotes((prev) => [data.note, ...prev]);
        setNewNoteBody("");
        setStatusMessage("Note saved and synced with mobile app.");
        setTimeout(() => setStatusMessage(""), 3500);
        onNotesUpdated?.();
      } else {
        setStatusMessage(data.error || "Failed to save note");
      }
    } catch {
      setStatusMessage("Network error saving note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (note: TimelineNote) => {
    setEditingNoteId(note.id);
    setEditText(note.body);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editText.trim() || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/sales/leads/${leadId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId,
          body: editText.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, body: editText.trim() } : n))
        );
        setEditingNoteId(null);
        setEditText("");
        setStatusMessage("Note updated!");
        setTimeout(() => setStatusMessage(""), 3000);
        onNotesUpdated?.();
      } else {
        setStatusMessage(data.error || "Failed to update note");
      }
    } catch {
      setStatusMessage("Network error updating note");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      const res = await fetch(`/api/sales/leads/${leadId}/notes?noteId=${encodeURIComponent(noteId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        setStatusMessage("Note deleted");
        setTimeout(() => setStatusMessage(""), 3000);
        onNotesUpdated?.();
      } else {
        setStatusMessage(data.error || "Failed to delete note");
      }
    } catch {
      setStatusMessage("Network error deleting note");
    }
  };

  return (
    <div className="sales-panel nested sales-lead-history">
      <div className="sales-lead-history-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare size={16} style={{ color: "var(--closer-orange, #ff6b2f)" }} />
          <strong>
            Notes & Activity Timeline ({notes.length})
          </strong>
        </div>
        <div className="sales-lead-history-tools">
          <span className="sales-lead-history-sync-badge">
            <Smartphone size={10} /> Phone Sync Active
          </span>
          <button
            type="button"
            onClick={() => void loadNotes()}
            title="Refresh notes"
            className="sales-lead-history-refresh"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: "var(--closer-orange, #ff6b2f)" }}>
          {statusMessage}
        </p>
      ) : null}

      {/* Add New Note Box */}
      <form onSubmit={handleCreateNote} className="sales-form-grid sales-lead-history-composer">
        <div className="sales-lead-history-composer-row">
          <div className="sales-glass-select-menu" ref={typeMenuRef}>
            <button
              aria-expanded={isTypeMenuOpen}
              aria-haspopup="listbox"
              className="sales-glass-select-trigger"
              onClick={() => setIsTypeMenuOpen((open) => !open)}
              type="button"
            >
              <span>{noteTypes.find((type) => type.value === newNoteType)?.label ?? "Conversation Note"}</span>
              <ChevronDown size={14} className={isTypeMenuOpen ? "is-rotated" : ""} />
            </button>
            {isTypeMenuOpen ? (
              <div className="sales-glass-select-options" role="listbox" aria-label="Note type">
                {noteTypes.map((type) => (
                  <button
                    aria-selected={newNoteType === type.value}
                    className={newNoteType === type.value ? "is-selected" : ""}
                    key={type.value}
                    onClick={() => {
                      setNewNoteType(type.value);
                      setIsTypeMenuOpen(false);
                    }}
                    role="option"
                    type="button"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <input
            type="text"
            placeholder="Add note (auto-syncs to mobile SIM app)..."
            value={newNoteBody}
            onChange={(e) => setNewNoteBody(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              background: "var(--color-surface, #ffffff)",
              border: "1px solid var(--closer-orange-border, rgba(255, 107, 47, 0.3))",
              color: "var(--foreground, #0f172a)",
              fontSize: "12px",
            }}
          />
          <button
            type="submit"
            disabled={isSaving || !newNoteBody.trim()}
            className="sales-primary-button compact"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", whiteSpace: "nowrap" }}
          >
            <Plus size={13} /> {isSaving ? "Saving..." : "Add"}
          </button>
        </div>
      </form>

      {/* Notes List with Inline Edit & Delete */}
      <div className="sales-lead-history-list">
        {notes.map((note) => {
          const isEditing = editingNoteId === note.id;
          const formattedDate = new Date(note.createdAt).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={note.id}
              className="sales-lead-history-item"
            >
              <div className="sales-lead-history-item-head">
                <div className="sales-lead-history-item-meta">
                  <span
                    className={`sales-lead-history-type ${note.type === "CALL" ? "is-call" : note.type === "OBJECTION" ? "is-objection" : ""}`}
                  >
                    {note.type}
                  </span>
                  <span className="sales-lead-history-date">
                    {formattedDate}
                  </span>
                </div>
                <div className="sales-lead-history-actions">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(note)}
                        title="Edit note"
                        className="sales-lead-history-action"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteNote(note.id)}
                        title="Delete note"
                        className="sales-lead-history-action danger"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      background: "var(--color-surface, #ffffff)",
                      border: "1px solid var(--closer-orange, #ff6b2f)",
                      color: "var(--foreground, #0f172a)",
                      fontSize: "12px",
                    }}
                  />
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setEditingNoteId(null)}
                      className="sales-secondary-button compact"
                      style={{ padding: "3px 8px", fontSize: "11px" }}
                    >
                      <X size={11} /> Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit(note.id)}
                      disabled={isUpdating}
                      className="sales-primary-button compact"
                      style={{ padding: "3px 8px", fontSize: "11px" }}
                    >
                      <Check size={11} /> {isUpdating ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="sales-lead-history-body">
                  {note.body}
                </p>
              )}
            </div>
          );
        })}

        {!notes.length && !isLoading ? (
          <p className="sales-lead-history-empty">
            No notes yet. Add one above to sync with mobile app!
          </p>
        ) : null}
      </div>
    </div>
  );
}
