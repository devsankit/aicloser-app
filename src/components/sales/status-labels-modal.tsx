"use client";

import { useEffect, useState } from "react";
import { Check, Edit2, Plus, RefreshCw, Tag, Trash2, X } from "lucide-react";
import type { StatusLabel } from "@/lib/gigxomi/status-labels-store";

const PRESET_COLORS = [
  "#ef4444", // Red (Hot)
  "#f59e0b", // Amber (Warm)
  "#10b981", // Emerald (High Budget)
  "#06b6d4", // Cyan (Decision Maker)
  "#3b82f6", // Blue (Cold)
  "#8b5cf6", // Purple (Price Sensitive)
  "#f43f5e", // Rose (Urgent)
  "#ff6b2f", // Brand Orange
  "#64748b", // Slate
];

export function StatusLabelsModal({
  isOpen,
  onClose,
  onLabelsUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onLabelsUpdated?: () => void;
}) {
  const [labels, setLabels] = useState<StatusLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Create form state
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newDesc, setNewDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    if (isOpen) {
      void fetchLabels();
    }
  }, [isOpen]);

  async function fetchLabels() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sales/status-labels");
      const data = await res.json();
      if (data.ok) {
        setLabels(data.labels || []);
      } else {
        setError(data.error || "Failed to load labels");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load labels");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/sales/status-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor, description: newDesc.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewName("");
        setNewDesc("");
        setIsCreating(false);
        setActionSuccess(`Label "${data.label.name}" created!`);
        setTimeout(() => setActionSuccess(""), 3000);
        await fetchLabels();
        onLabelsUpdated?.();
      } else {
        setError(data.error || "Failed to create label");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create label");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(label: StatusLabel) {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
    setEditDesc(label.description || "");
  }

  async function handleUpdate(id: string) {
    if (!editName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/sales/status-labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), color: editColor, description: editDesc.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditingId(null);
        setActionSuccess(`Label updated!`);
        setTimeout(() => setActionSuccess(""), 3000);
        await fetchLabels();
        onLabelsUpdated?.();
      } else {
        setError(data.error || "Failed to update label");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update label");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete status label "${name}"? It will be removed from all leads.`)) {
      return;
    }
    setError("");
    try {
      const res = await fetch(`/api/sales/status-labels?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setActionSuccess(`Deleted "${name}"`);
        setTimeout(() => setActionSuccess(""), 3000);
        await fetchLabels();
        onLabelsUpdated?.();
      } else {
        setError(data.error || "Failed to delete label");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete label");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          background: "var(--closer-surface)",
          border: "1px solid var(--closer-line)",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid var(--closer-line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Tag size={20} color="var(--closer-orange)" />
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--closer-ink)" }}>
                Custom Status Labels & Tags
              </h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--closer-muted)" }}>
                Full CRUD control for CRM labels. Synced bidirectionally with Closer Mobile.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--closer-muted)",
              cursor: "pointer",
              padding: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "grid", gap: "16px" }}>
          {error ? (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", fontSize: "0.85rem" }}>
              {error}
            </div>
          ) : null}

          {actionSuccess ? (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", fontSize: "0.85rem" }}>
              {actionSuccess}
            </div>
          ) : null}

          {/* "+ New Label" Toggle */}
          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px dashed var(--closer-orange-border)",
                background: "rgba(255, 107, 47, 0.05)",
                color: "var(--closer-orange)",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                justifyContent: "center",
              }}
            >
              <Plus size={16} /> Create New Status Label
            </button>
          ) : (
            <form
              onSubmit={handleCreate}
              style={{
                padding: "16px",
                background: "var(--closer-surface-soft)",
                border: "1px solid var(--closer-line)",
                borderRadius: "12px",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--closer-ink)" }}>
                Add New Status Label
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--closer-muted)", marginBottom: "4px" }}>
                  Label Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Client or Followup in 2h"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--closer-line)",
                    background: "var(--closer-surface)",
                    color: "var(--closer-ink)",
                    fontSize: "0.88rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--closer-muted)", marginBottom: "6px" }}>
                  Color Badge
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: c,
                        border: newColor === c ? "2px solid #FFF" : "1px solid transparent",
                        boxShadow: newColor === c ? "0 0 0 2px var(--closer-orange)" : "none",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    style={{ width: "28px", height: "28px", border: 0, background: "transparent", cursor: "pointer" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--closer-muted)", marginBottom: "4px" }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Short note about when to apply this label"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--closer-line)",
                    background: "var(--closer-surface)",
                    color: "var(--closer-ink)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid var(--closer-line)",
                    background: "transparent",
                    color: "var(--closer-muted)",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="sales-primary-button"
                  style={{
                    padding: "6px 16px",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isSubmitting ? "Creating…" : "Save Label"}
                </button>
              </div>
            </form>
          )}

          {/* List of Existing Labels */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--closer-muted)" }}>
              <RefreshCw className="animate-spin" size={20} style={{ margin: "0 auto 8px" }} />
              Loading labels…
            </div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {labels.map((lbl) => {
                const isEditing = editingId === lbl.id;

                if (isEditing) {
                  return (
                    <div
                      key={lbl.id}
                      style={{
                        padding: "12px 16px",
                        background: "var(--closer-surface-soft)",
                        border: "1px solid var(--closer-line)",
                        borderRadius: "10px",
                        display: "grid",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--closer-line)",
                          background: "var(--closer-surface)",
                          color: "var(--closer-ink)",
                          fontSize: "0.88rem",
                          fontWeight: 600,
                        }}
                      />
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              backgroundColor: c,
                              border: editColor === c ? "2px solid #FFF" : "1px solid transparent",
                              boxShadow: editColor === c ? "0 0 0 2px var(--closer-orange)" : "none",
                              cursor: "pointer",
                            }}
                          />
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Description"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--closer-line)",
                          background: "var(--closer-surface)",
                          color: "var(--closer-ink)",
                          fontSize: "0.82rem",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--closer-line)", background: "transparent", color: "var(--closer-muted)", fontSize: "0.8rem", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(lbl.id)}
                          disabled={isSubmitting}
                          className="sales-primary-button"
                          style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={lbl.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "var(--closer-surface-soft)",
                      border: "1px solid var(--closer-line)",
                      borderRadius: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          backgroundColor: `${lbl.color}22`,
                          color: lbl.color,
                          border: `1px solid ${lbl.color}44`,
                        }}
                      >
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: lbl.color }} />
                        {lbl.name}
                      </span>
                      {lbl.description ? (
                        <span style={{ fontSize: "0.78rem", color: "var(--closer-muted)" }}>
                          {lbl.description}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--closer-muted)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--closer-surface)",
                          border: "1px solid var(--closer-line)",
                        }}
                      >
                        {lbl.leadCount || 0} leads
                      </span>

                      <button
                        type="button"
                        onClick={() => startEdit(lbl)}
                        title="Edit label"
                        style={{
                          background: "transparent",
                          border: 0,
                          color: "var(--closer-muted)",
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(lbl.id, lbl.name)}
                        title="Delete label"
                        style={{
                          background: "transparent",
                          border: 0,
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
