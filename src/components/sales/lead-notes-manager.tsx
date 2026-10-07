"use client";

import { useEffect, useState } from "react";
import { Check, Edit3, MessageSquare, PhoneCall, Plus, RefreshCw, Smartphone, Trash2, X } from "lucide-react";

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
    <div className="sales-panel nested" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare size={16} style={{ color: "var(--closer-orange, #ff6b2f)" }} />
          <strong style={{ fontSize: "14px", color: "var(--color-text-primary, #fff)" }}>
            Notes & Activity Timeline ({notes.length})
          </strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "12px", background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Smartphone size={10} /> Phone Sync Active
          </span>
          <button
            type="button"
            onClick={() => void loadNotes()}
            title="Refresh notes"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--closer-muted, #888)", padding: "2px" }}
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
      <form onSubmit={handleCreateNote} className="sales-form-grid" style={{ gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          <select
            value={newNoteType}
            onChange={(e) => setNewNoteType(e.target.value)}
            style={{
              width: "140px",
              padding: "6px 8px",
              borderRadius: "6px",
              background: "var(--color-surface, #0d1410)",
              border: "1px solid var(--closer-line, rgba(255, 255, 255, 0.15))",
              color: "var(--color-text-primary, #fff)",
              fontSize: "12px",
            }}
          >
            <option value="NOTE">Conversation Note</option>
            <option value="CALL">Call Update</option>
            <option value="OBJECTION">Objection Raised</option>
            <option value="FOLLOW_UP">Follow-Up Scheduled</option>
          </select>
          <input
            type="text"
            placeholder="Add note (auto-syncs to mobile SIM app)..."
            value={newNoteBody}
            onChange={(e) => setNewNoteBody(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              background: "var(--color-surface, #0d1410)",
              border: "1px solid var(--closer-orange-border, rgba(255, 107, 47, 0.3))",
              color: "var(--color-text-primary, #fff)",
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
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
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
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background:
                        note.type === "CALL"
                          ? "rgba(56, 189, 248, 0.2)"
                          : note.type === "OBJECTION"
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(255, 107, 47, 0.15)",
                      color:
                        note.type === "CALL"
                          ? "#38bdf8"
                          : note.type === "OBJECTION"
                          ? "#f87171"
                          : "var(--closer-orange, #ff6b2f)",
                    }}
                  >
                    {note.type}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--closer-muted, rgba(255, 255, 255, 0.5))" }}>
                    {formattedDate}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(note)}
                        title="Edit note"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "rgba(255, 255, 255, 0.5)",
                          padding: "2px",
                        }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteNote(note.id)}
                        title="Delete note"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "rgba(248, 113, 113, 0.7)",
                          padding: "2px",
                        }}
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
                      background: "var(--color-surface, #0d1410)",
                      border: "1px solid var(--closer-orange, #ff6b2f)",
                      color: "#fff",
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
                <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-primary, #fff)", lineHeight: 1.4 }}>
                  {note.body}
                </p>
              )}
            </div>
          );
        })}

        {!notes.length && !isLoading ? (
          <p style={{ margin: "6px 0", fontSize: "12px", color: "var(--closer-muted, rgba(255, 255, 255, 0.5))", textAlign: "center" }}>
            No notes yet. Add one above to sync with mobile app!
          </p>
        ) : null}
      </div>
    </div>
  );
}
