"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Tag, Tags } from "lucide-react";

interface StatusLabel {
  id: string;
  name: string;
  color: string;
  category?: string;
  count?: number;
}

export function LeadStatusTagsSelector({
  leadId,
  currentTags = [],
  onTagsChanged,
  onOpenManageModal,
}: {
  leadId: string;
  currentTags: string[];
  onTagsChanged?: (newTags: string[]) => void;
  onOpenManageModal?: () => void;
}) {
  const [availableLabels, setAvailableLabels] = useState<StatusLabel[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>(currentTags);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setActiveTags(currentTags);
  }, [currentTags]);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const res = await fetch("/api/sales/status-labels", { cache: "no-store" });
        const data = await res.json();
        if (data.ok && Array.isArray(data.labels)) {
          setAvailableLabels(data.labels);
        }
      } catch {
        // Fallback default labels
        setAvailableLabels([
          { id: "1", name: "Hot Prospect", color: "#ef4444" },
          { id: "2", name: "Decision Maker", color: "#3b82f6" },
          { id: "3", name: "Callback Needed", color: "#f59e0b" },
          { id: "4", name: "Budget Approved", color: "#10b981" },
        ]);
      }
    };
    void fetchLabels();
  }, []);

  const handleToggleTag = async (tagName: string) => {
    if (isUpdating) return;
    setIsUpdating(true);

    const isAlreadyActive = activeTags.includes(tagName);
    const updatedTags = isAlreadyActive
      ? activeTags.filter((t) => t !== tagName)
      : [...activeTags, tagName];

    // Optimistic UI update
    setActiveTags(updatedTags);

    try {
      const res = await fetch("/api/sales/status-labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          tags: updatedTags,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onTagsChanged?.(updatedTags);
      }
    } catch {
      // Revert on error
      setActiveTags(activeTags);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "var(--closer-orange, #ff6b2f)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Tags size={12} /> Status Labels & Tags (Tap to toggle)
        </label>
        {onOpenManageModal ? (
          <button
            type="button"
            onClick={onOpenManageModal}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--closer-orange, #ff6b2f)",
              fontSize: "11px",
              fontWeight: 600,
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Manage Labels ↗
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        {availableLabels.map((label) => {
          const isActive = activeTags.includes(label.name);
          return (
            <button
              key={label.id}
              type="button"
              onClick={() => void handleToggleTag(label.name)}
              disabled={isUpdating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 9px",
                borderRadius: "14px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: isActive ? `${label.color}20` : "var(--closer-soft, rgba(0, 0, 0, 0.04))",
                color: isActive ? label.color : "var(--closer-muted, #64748b)",
                border: isActive ? `1px solid ${label.color}80` : "1px solid var(--closer-line, rgba(0, 0, 0, 0.1))",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: label.color,
                }}
              />
              #{label.name}
              {isActive ? <Check size={11} strokeWidth={2.5} /> : null}
            </button>
          );
        })}

        {availableLabels.length === 0 ? (
          <span style={{ fontSize: "11px", color: "var(--closer-muted, #94a3b8)" }}>No labels created yet.</span>
        ) : null}
      </div>
    </div>
  );
}
