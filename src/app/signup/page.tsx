"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";

export default function SignupPage() {
  const router = useRouter();
  const { signupWorkspace } = useApp();

  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [seats, setSeats] = useState("5");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim() || !adminName.trim() || !email.trim() || !phone.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await signupWorkspace({
      companyName: companyName.trim(),
      adminName: adminName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      teamSize: seats,
    });
    setLoading(false);

    if (res.success) {
      router.push("/dashboard");
    } else {
      setError(res.error || "Failed to create workspace. Please verify your details.");
    }
  };

  const googleAuthUrl = "/api/auth/google/start?mode=signup&redirectTo=/dashboard";

  return (
    <div className="auth-page">
      <div className="auth-card" data-wide="true">
        {/* Brand / Header */}
        <div className="auth-header">
          <div className="auth-brand-badge">
            <img
              src="/assets/closer-icon.png"
              alt="AI Closer"
              width={48}
              height={48}
              className="auth-brand-logo-img"
            />
          </div>
          <h1 className="auth-title">Create Your AI Closer Workspace</h1>
          <p className="auth-subtitle">
            Deploy your dedicated sales CRM with SIM telephony, audio recording, and pipeline stages.
          </p>
        </div>

        {error && (
          <div className="chip" data-tone="danger">
            <Icon name="alert-circle" size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-grid-row">
            <div className="field">
              <label htmlFor="signup-company">Company / Agency Name</label>
              <input
                id="signup-company"
                type="text"
                className="input"
                placeholder="Acme Media Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="field">
              <label htmlFor="signup-seats">Team Seats</label>
              <select
                id="signup-seats"
                className="select"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              >
                <option value="1">1 Closer (Solo)</option>
                <option value="3">3 Closers (Small Team)</option>
                <option value="5">5 Closers (Growth)</option>
                <option value="10">10 Closers (Scale)</option>
                <option value="25">25+ Closers (Enterprise)</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="signup-admin-name">Admin Full Name</label>
            <input
              id="signup-admin-name"
              type="text"
              className="input"
              placeholder="Your full name"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
            />
          </div>

          <div className="auth-grid-row">
            <div className="field">
              <label htmlFor="signup-email">Work Email ID</label>
              <input
                id="signup-email"
                type="email"
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="signup-phone">Calling Phone / WhatsApp</label>
              <input
                id="signup-phone"
                type="tel"
                className="input"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
              />
            </div>
          </div>

          <div className="auth-grid-row">
            <div className="field">
              <label htmlFor="signup-password">Password</label>
              <div className="auth-password-wrapper">
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  className="input"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

            <div className="field">
              <label htmlFor="signup-confirm-password">Confirm Password</label>
              <input
                id="signup-confirm-password"
                type={showPassword ? "text" : "password"}
                className="input"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn"
            data-variant="accent"
            disabled={loading}
          >
            <Icon name="sparkle" size={14} />
            {loading ? "Creating workspace..." : "Create Sales Workspace"}
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
          Already have a workspace?
          <Link href="/login">Sign in →</Link>
        </div>
      </div>
    </div>
  );
}
