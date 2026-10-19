"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";

export function WorkspaceLoginDialog({ open, onClose }: { open?: boolean; onClose: () => void }) {
  const { state, loginWorkspace, logoutWorkspace, refreshLeads } = useApp();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (open !== undefined && !open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError("Please enter your email/phone and workspace password.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const res = await loginWorkspace(identifier.trim(), password.trim());
    setIsSubmitting(false);

    if (res.success) {
      setSuccess("Authenticated! Loading real workspace data...");
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setError(res.error || "Authentication failed. Check your credentials.");
    }
  };

  const handleLogout = async () => {
    await logoutWorkspace();
    onClose();
  };

  return (
    <div className="overlay" data-kind="dialog" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <header className="dialog-head">
          <span
            className="empty-icon"
            style={{
              width: 32,
              height: 32,
              marginBottom: 0,
              background: state.apiConnected ? "rgba(34, 197, 94, 0.15)" : "rgba(244, 97, 42, 0.15)",
              color: state.apiConnected ? "#22c55e" : "var(--accent)",
            }}
          >
            <Icon name={state.apiConnected ? "check" : "target"} size={16} />
          </span>
          <div>
            <h2 id="login-dialog-title" style={{ fontSize: "16px", margin: 0 }}>
              {state.apiConnected ? "Live Cloud Connected" : "Connect Live Workspace"}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--fg-muted)", margin: "2px 0 0" }}>
              Secure Cloud Workspace
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog" style={{ marginLeft: "auto" }}>
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="dialog-body">
          {state.apiConnected ? (
            <div style={{ display: "grid", gap: "14px" }}>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "8px",
                  background: "rgba(34, 197, 94, 0.08)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#22c55e",
                      display: "inline-block",
                    }}
                  />
                  <strong style={{ fontSize: "13px", color: "#22c55e" }}>Active Session</strong>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{state.user?.displayName || "Workspace Closer"}</div>
                <div style={{ fontSize: "12px", color: "var(--fg-muted)" }}>
                  {state.user?.email || state.user?.phone || "Authorized Account"} · Role: {state.user?.role || "ADMIN"}
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "var(--fg-muted)", margin: 0, lineHeight: 1.5 }}>
                Your new UI is actively connected to the production database and pulling real leads, call recordings, and chat threads.
              </p>

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button
                  className="btn"
                  data-variant="primary"
                  onClick={() => void refreshLeads()}
                  style={{ flex: 1 }}
                >
                  <Icon name="refresh" size={14} /> Sync Real Data
                </button>
                <button
                  className="btn"
                  data-variant="danger"
                  onClick={() => void handleLogout()}
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
              <p style={{ fontSize: "13px", color: "var(--fg-muted)", margin: 0, lineHeight: 1.5 }}>
                Sign in with your AI Closer CRM account to pull real leads, audio telemetry, and chat channels into this new UI.
              </p>

              <div className="field">
                <label htmlFor="log-identifier">Email ID or Phone Number</label>
                <input
                  id="log-identifier"
                  className="input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@company.com or 9876543210"
                  autoFocus
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="log-password">Workspace Password</label>
                <input
                  id="log-password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#ef4444",
                    fontSize: "12px",
                  }}
                  role="alert"
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    color: "#22c55e",
                    fontSize: "12px",
                  }}
                  role="status"
                >
                  {success}
                </div>
              )}

              <footer className="dialog-foot" style={{ padding: "10px 0 0", borderTop: "none" }}>
                <button type="button" className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  data-variant="primary"
                  disabled={isSubmitting}
                  style={{ minWidth: 120 }}
                >
                  {isSubmitting ? "Connecting..." : "Sign In & Load Real Data"}
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
