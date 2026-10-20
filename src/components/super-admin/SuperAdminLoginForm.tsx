"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { setStoredToken } from "@/lib/api-client";

interface SuperAdminLoginFormProps {
  redirectTo?: string;
  error?: string;
  message?: string;
}

export function SuperAdminLoginForm({
  redirectTo = "/super-admin",
  error = "",
  message = "",
}: SuperAdminLoginFormProps) {
  const [loginIdentifier, setLoginIdentifier] = useState("hello.ankitrathore@gmail.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginNotice, setLoginNotice] = useState(error);
  const [loginMessage, setLoginMessage] = useState(message);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isClientSlotOccupied =
    loginNotice.startsWith("ClientSlotOccupied:") || loginNotice === "ClientSlotOccupied";

  useEffect(() => {
    if (error) setLoginNotice(error);
    if (message) setLoginMessage(message);
  }, [error, message]);

  async function submitLogin(forceReplace = false) {
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginNotice("Platform Owner email and master password are required.");
      return;
    }

    setIsSubmitting(true);
    setLoginNotice("");
    setLoginMessage("");

    try {
      const response = await fetch("/api/auth/login/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
          loginScope: "super-admin",
          clientType: "DESKTOP",
          redirectTo,
          forceReplace: forceReplace ? "1" : "0",
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok) {
        if (data.token) {
          setStoredToken(data.token);
        }
        window.location.assign(data.redirectTo || redirectTo || "/super-admin");
        return;
      }

      if (data?.error === "ClientSlotOccupied") {
        setLoginNotice(
          "ClientSlotOccupied: " +
            (data.message || "Active session detected on another client.")
        );
      } else {
        setLoginNotice(
          data?.message || data?.error || "We could not authenticate you. Please check your credentials."
        );
      }
    } catch {
      setLoginNotice("Unable to reach authentication server. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logoutAllSessions() {
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginNotice("Email and master password are required to revoke active sessions.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/client-sessions/revoke-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok) {
        const count = Number(data.revokedSessions ?? 0);
        setLoginMessage(
          count
            ? `${count} active session${count === 1 ? "" : "s"} logged out. You can authenticate now.`
            : "All active sessions have been cleared. You can authenticate now."
        );
        setLoginNotice("");
        return;
      }

      setLoginNotice(data?.error || data?.message || "Could not revoke active sessions.");
    } catch {
      setLoginNotice("Could not revoke active sessions. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      {/* Auth Header */}
      <div className="auth-header">
        <div className="auth-brand-badge">
          <Icon name="shield" size={22} />
        </div>
        <h1 className="auth-title">Super Admin Portal</h1>
        <p className="auth-subtitle">
          Platform Owner Command Center &amp; Workspace Governance
        </p>
      </div>

      {/* Status Messages */}
      {loginMessage && (
        <div className="chip" data-tone="success">
          <Icon name="check" size={14} /> {loginMessage}
        </div>
      )}

      {loginNotice && !isClientSlotOccupied && (
        <div className="chip" data-tone="danger">
          <Icon name="alert-circle" size={14} /> {loginNotice}
        </div>
      )}

      {/* Session Concurrency Alert */}
      {isClientSlotOccupied && (
        <div className="auth-conflict-card">
          <div className="auth-conflict-title">
            <Icon name="alert-circle" size={16} /> Active session detected
          </div>
          <p className="auth-conflict-desc">
            {loginNotice.replace("ClientSlotOccupied: ", "") ||
              "An active session was detected on another client device."}
          </p>
          <div className="auth-conflict-actions">
            <button
              type="button"
              className="btn"
              data-variant="primary"
              data-size="sm"
              disabled={isSubmitting}
              onClick={() => void submitLogin(true)}
            >
              Login Here (Replace Session)
            </button>
            <button
              type="button"
              className="btn"
              data-variant="outline"
              data-size="sm"
              disabled={isSubmitting}
              onClick={() => void logoutAllSessions()}
            >
              Logout All Sessions
            </button>
          </div>
        </div>
      )}

      {/* Auth Form */}
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submitLogin(false);
        }}
      >
        <div className="field">
          <label htmlFor="superadmin-identifier">Platform Owner Email</label>
          <input
            id="superadmin-identifier"
            type="email"
            className="input"
            autoComplete="username"
            placeholder="hello.ankitrathore@gmail.com"
            value={loginIdentifier}
            onChange={(e) => setLoginIdentifier(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="superadmin-password">Master Password</label>
          <div className="auth-password-wrapper">
            <input
              id="superadmin-password"
              type={showLoginPassword ? "text" : "password"}
              className="input"
              autoComplete="current-password"
              placeholder="Enter master password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowLoginPassword((prev) => !prev)}
              aria-label={showLoginPassword ? "Hide password" : "Show password"}
            >
              <Icon name={showLoginPassword ? "eye-off" : "eye"} size={16} />
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn"
          data-variant="primary"
          data-size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Authenticating..." : "Authenticate as Super Admin"}
        </button>
      </form>

      {/* Auth Footer */}
      <div className="auth-footer">
        <Link className="btn" data-variant="ghost" href="/login">
          ← Return to Workspace Login
        </Link>
      </div>
    </div>
  );
}
