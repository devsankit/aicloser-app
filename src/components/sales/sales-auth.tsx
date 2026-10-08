"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, LogIn, Search, Send } from "lucide-react";
import { countryCodes } from "./country-codes";

function CountryCodePicker({ defaultValue = "+91" }: { defaultValue?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState(defaultValue);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedCountry = countryCodes.find((country) => country.dialCode === selectedCode) ?? countryCodes[0];
  const filteredCountries = countryCodes.filter((country) => {
    const normalizedQuery = query.trim().toLowerCase();
    return !normalizedQuery || country.name.toLowerCase().includes(normalizedQuery) || country.dialCode.includes(normalizedQuery);
  });

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen) window.setTimeout(() => searchRef.current?.focus(), 0);
    else setQuery("");
  }, [isOpen]);

  return (
    <div className="sales-country-picker" ref={pickerRef}>
      <input name="countryCode" type="hidden" value={selectedCountry.dialCode} />
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Country calling code, ${selectedCountry.name}`}
        className="sales-phone-code"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter") setIsOpen(true);
        }}
        type="button"
      >
        <span>{selectedCountry.dialCode}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {isOpen ? (
        <div aria-label="Country calling codes" className="sales-country-menu" role="listbox">
          <div className="sales-country-search">
            <Search aria-hidden="true" size={15} />
            <input
              aria-label="Search countries or calling codes"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsOpen(false);
              }}
              placeholder="Search country or code"
              ref={searchRef}
              type="search"
              value={query}
            />
          </div>
          <div className="sales-country-options">
            {filteredCountries.length ? filteredCountries.map((country) => (
              <button
                aria-selected={country.dialCode === selectedCode}
                className="sales-country-option"
                key={`${country.name}-${country.dialCode}`}
                onClick={() => {
                  setSelectedCode(country.dialCode);
                  setIsOpen(false);
                }}
                role="option"
                type="button"
              >
                <span>{country.name}</span>
                <span>{country.dialCode}</span>
                {country.dialCode === selectedCode ? <Check aria-hidden="true" size={14} /> : null}
              </button>
            )) : <p className="sales-country-empty">No country or code found</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
        phone: `${String(form.get("countryCode") ?? "+91").trim()}${String(form.get("phone") ?? "").replace(/[^0-9]/g, "")}`,
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
        <div className="sales-phone-input">
          <CountryCodePicker />
          <input className="sales-phone-number" inputMode="tel" name="phone" placeholder="98765 43210" required style={lightInputStyle} />
        </div>
      </label>
      <SalesPasswordField autoComplete="new-password" label="Password" name="password" placeholder="Create at least 8 characters" />
      <SalesPasswordField autoComplete="new-password" label="Confirm password" name="confirmPassword" placeholder="Enter the same password again" />
      <button className="sales-primary-button" disabled={isSubmitting} type="submit" style={primaryButtonStyle}>
        <Send size={16} />
        {isSubmitting ? "Provisioning workspace..." : "Create Sales Workspace"}
      </button>
      {status ? (
        <p className="sales-form-status" style={{ margin: 0, fontSize: "0.84rem", color: status.includes("created") ? "#10b981" : "#ef4444", fontWeight: 600 }}>
          {status}
        </p>
      ) : null}
    </form>
  );
}

export function SalesPasswordLoginForm({ redirectTo = "/", error = "", message = "", identifier = "", clientType = "DESKTOP" }: { redirectTo?: string; error?: string; message?: string; identifier?: string; clientType?: string }) {
  const [loginIdentifier, setLoginIdentifier] = useState(identifier);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginNotice, setLoginNotice] = useState(error);
  const [loginMessage, setLoginMessage] = useState(message);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const isClientSlotOccupied = loginNotice.startsWith("ClientSlotOccupied:") || loginNotice === "ClientSlotOccupied";
  const clientLabel = clientType === "MOBILE" ? "mobile" : "desktop";

  useEffect(() => {
    setLoginIdentifier(identifier);
    setLoginNotice(error);
    setLoginMessage(message);
  }, [identifier, error, message]);

  async function submitLogin(forceReplace = false) {
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginNotice("Identifier and password are required.");
      return;
    }
    setIsSubmitting(true);
    setLoginNotice("");
    setLoginMessage("");
    try {
      const response = await fetch("/api/auth/login/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
          loginScope: "sales",
          clientType: clientType === "MOBILE" ? "MOBILE" : "DESKTOP",
          redirectTo,
          forceReplace: forceReplace ? "1" : "0",
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok) {
        window.location.assign(data.redirectTo || redirectTo || "/");
        return;
      }
      if (data?.error === "ClientSlotOccupied") {
        setLoginNotice("ClientSlotOccupied: " + (data.message || `This user already has an active ${clientLabel} session.`));
      } else {
        setLoginNotice(data?.message || data?.error || "We could not sign you in right now. Please try again in a moment.");
      }
    } catch {
      setLoginNotice("We could not sign you in right now. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="sales-auth-form" onSubmit={(event) => { event.preventDefault(); void submitLogin(); }} style={{ display: "grid", gap: "14px" }}>
      <input name="loginScope" type="hidden" value="sales" />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <input name="clientType" type="hidden" value={clientType === "MOBILE" ? "MOBILE" : "DESKTOP"} />
      <label style={lightLabelStyle}>
        <span>Email ID or phone</span>
        <input autoComplete="username" name="identifier" onChange={(event) => setLoginIdentifier(event.target.value)} placeholder="you@company.com" required style={lightInputStyle} value={loginIdentifier} />
      </label>
      <label style={lightLabelStyle}>
        <span>Password</span>
        <div style={{ position: "relative" }}>
          <input autoComplete="current-password" name="password" onChange={(event) => setLoginPassword(event.target.value)} placeholder="Enter your workspace password" required style={{ ...lightInputStyle, paddingRight: "44px" }} type={showLoginPassword ? "text" : "password"} value={loginPassword} />
          <button
            aria-label={showLoginPassword ? "Hide password" : "Show password"}
            onClick={() => setShowLoginPassword((current) => !current)}
            type="button"
            style={{ position: "absolute", top: "50%", right: "8px", transform: "translateY(-50%)", width: "32px", height: "32px", border: 0, borderRadius: "8px", background: "transparent", color: "#64748b", display: "grid", placeItems: "center", cursor: "pointer" }}
          >
            {showLoginPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
          </button>
        </div>
      </label>
      <button className="sales-primary-button" disabled={isSubmitting} type="submit" style={primaryButtonStyle}>
        <LogIn size={16} />
        {isSubmitting ? "Signing in…" : "Sign In to AI Closer"}
      </button>
      {loginMessage ? <p className="sales-form-status success" style={{ margin: 0, fontSize: "0.84rem", color: "#059669", fontWeight: 600 }}>{loginMessage}</p> : null}
      {isClientSlotOccupied ? (
        <div className="sales-auth-session-conflict" role="alert">
          <p className="sales-form-status error" style={{ margin: 0, fontSize: "0.84rem", color: "#dc2626", fontWeight: 600 }}>{loginNotice.replace("ClientSlotOccupied: ", "")}</p>
          <div className="sales-auth-session-actions">
            <button className="sales-auth-session-action-primary" disabled={isSubmitting} onClick={() => void submitLogin(true)} type="button">
              <LogIn size={15} /> Login here
            </button>
            <button className="sales-auth-session-action-secondary" disabled={isSubmitting} onClick={() => setLoginNotice("To log out the other session, enter the password and use Login here.")} type="button">
              Logout from there
            </button>
          </div>
          <small>“Login here” will end the other {clientLabel} session first. Your password stays filled while this is confirmed.</small>
        </div>
      ) : loginNotice ? (
        <p className="sales-form-status" style={{ margin: 0, fontSize: "0.84rem", color: "#ef4444", fontWeight: 600 }}>
          {loginNotice}
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
