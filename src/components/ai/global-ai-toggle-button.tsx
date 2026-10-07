"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, BotOff, RefreshCw } from "lucide-react";

interface GlobalAiSettingsResponse {
  ok: boolean;
  settings?: {
    enabled: boolean;
    updatedAt?: string;
    updatedByName?: string | null;
  };
  error?: string;
}

export function GlobalAiToggleButton({
  className = "",
  onToggleComplete,
}: {
  className?: string;
  onToggleComplete?: (enabled: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load initial global AI status
  const loadGlobalAiStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations/ai-auto-reply/global", { cache: "no-store" });
      if (!res.ok) return;
      const data: GlobalAiSettingsResponse = await res.json();
      if (data.ok && data.settings && typeof data.settings.enabled === "boolean") {
        setEnabled(data.settings.enabled);
      }
    } catch {
      // In offline / fallback, default to true
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGlobalAiStatus();

    // Listen for cross-component sync events (e.g. from chat workspace toggle)
    const handleSyncEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled: boolean }>;
      if (typeof customEvent.detail?.enabled === "boolean") {
        setEnabled(customEvent.detail.enabled);
      }
    };

    window.addEventListener("gx-global-ai-update", handleSyncEvent);
    return () => {
      window.removeEventListener("gx-global-ai-update", handleSyncEvent);
    };
  }, [loadGlobalAiStatus]);

  const handleToggle = async () => {
    if (loading || isSaving) return;
    const nextState = !enabled;

    // Optimistic UI update
    setEnabled(nextState);
    setIsSaving(true);

    try {
      const res = await fetch("/api/conversations/ai-auto-reply/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });

      const data: GlobalAiSettingsResponse = await res.json().catch(() => ({ ok: false }));

      if (!res.ok || !data.ok || typeof data.settings?.enabled !== "boolean") {
        // Rollback on failure
        setEnabled(!nextState);
        setToastMessage(data.error || "Failed to update Global AI state");
        setTimeout(() => setToastMessage(null), 4000);
        return;
      }

      setEnabled(data.settings.enabled);

      // Dispatch cross-component event so in-chat controls update immediately
      window.dispatchEvent(
        new CustomEvent("gx-global-ai-update", { detail: { enabled: data.settings.enabled } }),
      );

      setToastMessage(
        data.settings.enabled
          ? "Global AI Bot turned ON for all conversations."
          : "Emergency Pause: Global AI Bot turned OFF. All chats are now human-handled.",
      );
      setTimeout(() => setToastMessage(null), 4000);

      onToggleComplete?.(data.settings.enabled);
    } catch {
      // Rollback on network error
      setEnabled(!nextState);
      setToastMessage("Network error updating Global AI state.");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const title = enabled
    ? "Global AI Auto-Reply Bot is ACTIVE across all conversations. Click to turn OFF globally (Emergency Pause)."
    : "Global AI Auto-Reply Bot is PAUSED. All chats are human-handled. Click to turn ON globally.";

  return (
    <div
      className={`global-ai-toggle-button relative inline-flex items-center shrink-0 ${className}`}
      style={{ whiteSpace: "nowrap", flexShrink: 0 }}
    >
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={loading || isSaving}
        title={title}
        aria-label={title}
        aria-pressed={enabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          whiteSpace: "nowrap",
          flexWrap: "nowrap",
          flexShrink: 0,
          minWidth: "max-content",
          height: "30px",
          borderRadius: "9999px",
        }}
        className={`global-ai-toggle-control group relative select-none px-2.5 sm:px-3.5 text-xs font-semibold tracking-wide transition-all duration-200 focus:ring-2 ${
          enabled ? "is-active" : "is-paused"
        } ${isSaving ? "opacity-75 cursor-wait" : "cursor-pointer"}`}
      >
        {/* State Icon */}
        {isSaving ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-current shrink-0" />
        ) : enabled ? (
          <Bot className="global-ai-toggle-icon is-active w-3.5 h-3.5 shrink-0" />
        ) : (
          <BotOff className="global-ai-toggle-icon is-paused w-3.5 h-3.5 shrink-0" />
        )}

        {/* Text Label */}
        <span
          className="global-ai-toggle-copy inline-flex items-center gap-1"
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <span className="hidden sm:inline">AI Bot:</span>
          <span className="sm:hidden">AI:</span>
          <span className={`global-ai-toggle-status font-bold ${enabled ? "is-active" : "is-paused"}`}>
            {loading ? "..." : enabled ? "ACTIVE" : "PAUSED"}
          </span>
        </span>

        {/* Visual Pill Switch */}
        <span
          className={`global-ai-toggle-switch w-7 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${enabled ? "is-active" : "is-paused"}`}
          aria-hidden="true"
        >
          <span
            className={`global-ai-toggle-thumb w-3 h-3 rounded-full shadow-sm transform transition-transform duration-200 ${
              enabled
                ? "is-active translate-x-3"
                : "is-paused translate-x-0"
            }`}
          />
        </span>

        {/* Live Pulse Beacon for Active State */}
        {enabled && !isSaving && (
          <span className="global-ai-toggle-pulse relative flex h-2 w-2 mr-0.5 shrink-0">
            <span className="global-ai-toggle-pulse-ring animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" />
            <span className="global-ai-toggle-pulse-dot relative inline-flex rounded-full h-2 w-2" />
          </span>
        )}
      </button>

      {/* Floating Status Toast Banner */}
      {toastMessage && (
        <div
          role="status"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium shadow-xl border bg-slate-900 border-slate-700 text-slate-100 animate-in fade-in slide-in-from-top-1"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
