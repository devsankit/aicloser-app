"use client";

import { useState, useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
  customerName: string;
  customerContact?: string;
  stageLabel: string;
  submitting?: boolean;
};

const PRESET_REASONS = [
  "Budget too low / Mismatch",
  "Not interested / No requirement",
  "Chose another competitor",
  "Invalid number / Not reachable",
  "Postponed / Bad timing",
  "Duplicate inquiry",
  "Spam / Test lead",
];

export function LeadStageReasonModal({
  isOpen,
  onClose,
  onSubmit,
  customerName,
  customerContact,
  stageLabel,
  submitting = false,
}: Props) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const isValid = trimmed.length >= 3;

  useEffect(() => {
    if (isOpen) {
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid || submitting) return;
    void onSubmit(trimmed);
  };

  return (
    <div
      className="sales-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="sales-modal-card"
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#18181b",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "14px",
          padding: "1.4rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.7)",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                display: "grid",
                placeItems: "center",
                color: "#ef4444",
                flexShrink: 0,
              }}
            >
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
                Reason for marking as {stageLabel}
              </h3>
              <p style={{ margin: "3px 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
                {customerName} {customerContact ? `· ${customerContact}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: submitting ? "not-allowed" : "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.45 }}>
          The workspace requires a reason before moving leads to <strong>{stageLabel}</strong> to maintain pipeline audits and quality analytics.
        </p>

        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>
            QUICK PRESETS (CLICK TO SELECT)
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {PRESET_REASONS.map((preset) => {
              const isSelected = reason === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    border: isSelected ? "1px solid #ff6b2f" : "1px solid #334155",
                    background: isSelected ? "rgba(255, 107, 47, 0.18)" : "#27272a",
                    color: isSelected ? "#ff6b2f" : "#e2e8f0",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px" }}>
          <div>
            <label
              htmlFor="stage-reason-input"
              style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}
            >
              DETAILED REASON / NOTE <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              id="stage-reason-input"
              rows={3}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Client budget is too low or requested services we don't offer..."
              style={{
                boxSizing: "border-box",
                width: "100%",
                background: "#09090b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                padding: "10px 12px",
                color: "#f4f4f5",
                fontSize: "0.85rem",
                lineHeight: 1.45,
                outline: "none",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "0.75rem", color: "#71717a" }}>
              <span>
                {trimmed.length < 3 ? (
                  <span style={{ color: "#f87171" }}>Min 3 characters required ({trimmed.length}/3)</span>
                ) : (
                  <span style={{ color: "#10b981" }}>✓ Ready to move</span>
                )}
              </span>
              <span>{trimmed.length}/500</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="sales-secondary-button compact"
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="sales-primary-button compact"
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                background: isValid && !submitting ? "#ef4444" : "#52525b",
                borderColor: isValid && !submitting ? "#dc2626" : "#52525b",
                color: "#fff",
                cursor: isValid && !submitting ? "pointer" : "not-allowed",
              }}
            >
              {submitting ? "Moving..." : `Confirm & Move to ${stageLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
