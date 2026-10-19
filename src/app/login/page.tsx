"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const { loginWorkspace } = useApp();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Please enter your email or phone and password.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await loginWorkspace({ identifier: identifier.trim(), password });
    setLoading(false);

    if (res.success) {
      router.push("/dashboard");
    } else {
      setError(res.error || "Invalid email, phone, or password. Please try again.");
    }
  };

  const handleContinueAsDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWorkspace({ identifier: "anshitasales@gmail.com", password: "Anshita@12345" });
    } catch {}
    setLoading(false);
    router.push("/dashboard");
  };

  const googleAuthUrl = "/api/auth/google/start?redirectTo=/dashboard";

  // Display error from OAuth redirect if present
  useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const err = urlParams.get("error");
      if (err) {
        if (err === "GoogleLoginStateInvalid") {
          setError("Google sign-in expired. Please click Continue with Google again.");
        } else if (err === "GoogleLoginCancelled") {
          setError("Google sign-in was cancelled. Try again or enter your password.");
        } else if (err === "GoogleLoginNotConfigured") {
          setError("Google login is not configured for this environment.");
        } else if (err === "GoogleLoginFailed") {
          setError("Google authentication failed. Please try again.");
        } else {
          setError(err);
        }
      }
    }
  });

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand / Header */}
        <div className="auth-header">
          <div className="auth-brand-badge">
            <Icon name="sparkle" size={22} />
          </div>
          <h1 className="auth-title">Sign in to AI Closer</h1>
          <p className="auth-subtitle">
            Access your SIM calling telemetry, CRM pipelines, and multi-channel inbox.
          </p>
        </div>

        {error && (
          <div className="chip" data-tone="danger">
            <Icon name="alert-circle" size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="auth-identifier">Email ID or phone</label>
            <input
              id="auth-identifier"
              type="text"
              className="input"
              placeholder="you@company.com or +91..."
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-password-wrapper">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                className="input"
                placeholder="Enter your workspace password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn"
            data-variant="accent"
            disabled={loading}
          >
            <Icon name="phone" size={14} />
            {loading ? "Signing in..." : "Sign In to AI Closer"}
          </button>

          <div className="auth-divider">or</div>

          <a href={googleAuthUrl} className="auth-google-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </a>
        </form>

        <div className="auth-footer">
          Don&apos;t have a workspace yet?
          <Link href="/signup">Create Workspace →</Link>
        </div>

        <div style={{ textAlign: "center", marginTop: "-6px" }}>
          <button
            type="button"
            className="btn"
            data-variant="ghost"
            data-size="sm"
            onClick={handleContinueAsDemo}
          >
            Continue in Local Demo Mode &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
