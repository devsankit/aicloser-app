"use client";

import { useEffect, useState } from "react";
import { Check, Tags } from "lucide-react";
import { aicloserApi } from "@/lib/api-client";

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
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setActiveTags(currentTags);
  }, [currentTags]);

  useEffect(() => {
    const fetchLabels = async () => {
      setLoadError("");
      try {
        const raw = await aicloserApi.labels.list().catch(() => null);
        if (Array.isArray(raw) && raw.length > 0) {
          setAvailableLabels(raw.map((l: any, idx: number) => ({
            id: l.id || l.name || `label-${idx}`,
            name: l.name,
            color: l.color || "#6366f1",
            count: l.usageCount,
          })));
        } else {
          const res = await fetch("/api/v1/labels", { cache: "no-store" });
          const data = await res.json();
          const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.labels) ? data.labels : [];
          setAvailableLabels(list.map((l: any, idx: number) => ({
            id: l.id || l.name || `label-${idx}`,
            name: l.name,
            color: l.color || "#6366f1",
            count: l.usageCount,
          })));
        }
      } catch (error) {
        setAvailableLabels([]);
        setLoadError(error instanceof Error ? error.message : "Status labels could not be loaded.");
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
      if (leadId) {
        try {
          await aicloserApi.leads.update(leadId, { tags: updatedTags });
        } catch {
          await fetch(`/api/v1/leads/${encodeURIComponent(leadId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tags: updatedTags }),
          });
        }
      }
      onTagsChanged?.(updatedTags);
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
          <Tags size={12} /> Labels & Tags
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
        {loadError ? (
          <span style={{ fontSize: "11px", color: "#b91c1c" }}>{loadError}</span>
        ) : null}
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
