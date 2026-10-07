"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LogIn, Send } from "lucide-react";

function SalesPasswordField({
  name,
  label,
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label style={{ display: "grid", gap: "6px", color: "#334155", fontSize: "0.8rem", fontWeight: 600 }}>
      <span>{label}</span>
      <span className="sales-password-field" style={{ position: "relative", display: "block" }}>
        <input
          autoComplete={autoComplete}
          minLength={8}
          name={name}
          placeholder={placeholder}
          required
          type={isVisible ? "text" : "password"}
          style={{
            width: "100%",
            minHeight: "44px",
            padding: "0 44px 0 13px",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            color: "#0f172a",
            fontSize: "0.9rem",
          }}
        />
        <button
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((current) => !current)}
          type="button"
          style={{
            position: "absolute",
            top: "50%",
            right: "8px",
            transform: "translateY(-50%)",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: 0,
            background: "transparent",
            color: "#64748b",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

const lightInputStyle = {
  width: "100%",
  minHeight: "44px",
  padding: "0 13px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: "0.9rem",
} as const;

const lightLabelStyle = {
  display: "grid",
  gap: "6px",
  color: "#334155",
  fontSize: "0.8rem",
  fontWeight: 600,
} as const;

const primaryButtonStyle = {
  minHeight: "46px",
  borderRadius: "10px",
  border: 0,
  background: "#ff6b2f",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "0.92rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(255, 107, 47, 0.25)",
  marginTop: "4px",
} as const;

export function SalesSignupForm() {
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setIsSubmitting(false);
      setStatus("Passwords do not match.");
      return;
    }
    const response = await fetch("/api/sales/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: String(form.get("companyName") ?? ""),
        displayName: String(form.get("displayName") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        password,
        confirmPassword,
      }),
    });
    const payload = await response.json().catch(() => null);
    setIsSubmitting(false);

    if (!response.ok || !payload?.ok) {
      setStatus(payload?.error ?? "Unable to create sales workspace.");
      return;
    }

    setStatus("Workspace created! Redirecting you to login...");
    window.location.href = payload.redirectTo || "/login";
  }

  return (
    <form className="sales-auth-form" onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
      <label style={lightLabelStyle}>
        <span>Company / Workspace name</span>
        <input name="companyName" placeholder="e.g. Apex Sales or Growth Media" required style={lightInputStyle} />
      </label>
      <label style={lightLabelStyle}>
        <span>Full name</span>
        <input name="displayName" placeholder="Your full name" required style={lightInputStyle} />
      </label>
      <label style={lightLabelStyle}>
        <span>Work Email ID</span>
        <input name="email" placeholder="you@company.com" required type="email" style={lightInputStyle} />
      </label>
      <label style={lightLabelStyle}>
        <span>Calling phone / WhatsApp</span>
        <input name="phone" placeholder="+91..." required style={lightInputStyle} />
      </label>
      <SalesPasswordField autoComplete="new-password" label="Password" name="password" placeholder="Create at least 8 characters" />
      <SalesPasswordField autoComplete="new-password" label="Confirm password" name="confirmPassword" placeholder="Enter the same password again" />
      <button className="sales-primary-button" disabled={isSubmitting} type="submit" style={primaryButtonStyle}>
        <Send size={16} />
        {isSubmitting ? "Provisioning workspace..." : "Create AI Closer Workspace"}
      </button>
      {status ? (
        <p className="sales-form-status" style={{ margin: 0, fontSize: "0.84rem", color: status.includes("created") ? "#10b981" : "#ef4444", fontWeight: 600 }}>
          {status}
        </p>
      ) : null}
    </form>
  );
}

export function SalesPasswordLoginForm({ redirectTo = "/", error = "" }: { redirectTo?: string; error?: string }) {
  return (
    <form action="/api/auth/login/password" className="sales-auth-form" method="post" style={{ display: "grid", gap: "14px" }}>
      <input name="loginScope" type="hidden" value="sales" />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <label style={lightLabelStyle}>
        <span>Email ID or phone</span>
        <input name="identifier" placeholder="you@company.com" required style={lightInputStyle} />
      </label>
      <SalesPasswordField autoComplete="current-password" label="Password" name="password" placeholder="Enter your workspace password" />
      <button className="sales-primary-button" type="submit" style={primaryButtonStyle}>
        <LogIn size={16} />
        Sign In to AI Closer
      </button>
      {error ? (
        <p className="sales-form-status" style={{ margin: 0, fontSize: "0.84rem", color: "#ef4444", fontWeight: 600 }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function SuperAdminLoginForm({ redirectTo = "/super-admin", error = "", message = "" }: { redirectTo?: string; error?: string; message?: string }) {
  return (
    <form action="/api/auth/login/password" className="sales-auth-form" method="post" style={{ display: "grid", gap: "14px" }}>
      <input name="loginScope" type="hidden" value="super-admin" />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <label style={lightLabelStyle}>
        <span>Owner email address</span>
        <input autoComplete="username" defaultValue="hello.ankitrathore@gmail.com" name="identifier" placeholder="hello.ankitrathore@gmail.com" required type="email" style={lightInputStyle} />
      </label>
      <SalesPasswordField autoComplete="current-password" label="Owner password" name="password" placeholder="Enter owner master password" />
      <button className="sales-primary-button" type="submit" style={primaryButtonStyle}>
        <LogIn size={16} />
        Authenticate as Super Admin
      </button>
      {message ? <p className="sales-form-status success" style={{ color: "#10b981", fontWeight: 600 }}>{message}</p> : null}
      {error ? <p className="sales-form-status error" style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p> : null}
    </form>
  );
}
