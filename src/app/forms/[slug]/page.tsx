"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, Phone, Mail, User, Sparkles } from "lucide-react";
import type { SalesFormDefinition, CustomFieldDefinition } from "@/lib/gigxomi/custom-fields-store";

export default function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [form, setForm] = useState<SalesFormDefinition | null>(null);
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [serviceInterest, setServiceInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [formsRes, fieldsRes] = await Promise.all([
          fetch("/api/sales/forms"),
          fetch("/api/sales/custom-fields"),
        ]);
        const formsJson = await formsRes.json();
        const fieldsJson = await fieldsRes.json();
        if (formsJson.ok && formsJson.forms) {
          const match = formsJson.forms.find((f: SalesFormDefinition) => f.slug === slug);
          if (match) setForm(match);
        }
        if (fieldsJson.ok && fieldsJson.fields) {
          setFields(fieldsJson.fields);
        }
      } catch (err) {
        console.error("Failed to load form metadata", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!customerPhone && !customerEmail) {
      setErrorMsg("Please provide at least a phone number or email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/forms/submit/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          serviceInterest,
          notes,
          customValues,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
        setSuccessMessage(data.successMessage || form?.successMessage || "Thank you! We received your request.");
        if (data.redirectUrl) {
          setTimeout(() => {
            window.location.href = data.redirectUrl;
          }, 2000);
        }
      } else {
        setErrorMsg(data.error || "Submission failed. Please try again.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b", color: "#fff" }}>
        Loading form...
      </div>
    );
  }

  if (!form) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#09090b", color: "#fff" }}>
        <h2>Form Not Found</h2>
        <p style={{ color: "#94a3b8" }}>The requested sales form is inactive or does not exist.</p>
      </div>
    );
  }

  const includedCustomFields = fields.filter((f) => (form.fieldIds || []).includes(f.id));

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top, #1c1917 0%, #09090b 70%)",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "2rem 1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "rgba(24, 24, 27, 0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 107, 47, 0.25)",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 107, 47, 0.15)",
        }}
      >
        {submitted ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <CheckCircle2 size={56} color="#10b981" style={{ margin: "0 auto 1.5rem" }} />
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Request Received!</h2>
            <p style={{ color: "#cbd5e1", fontSize: "0.95rem", lineHeight: 1.5 }}>
              {successMessage}
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.3rem 0.8rem",
                  borderRadius: "20px",
                  background: "rgba(255, 107, 47, 0.15)",
                  color: "#ff8c42",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                }}
              >
                <Sparkles size={12} /> AIcloser Fast Track Intake
              </div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 0.5rem", letterSpacing: "-0.02em" }}>
                {form.title}
              </h1>
              <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: 0 }}>
                {form.description}
              </p>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  fontSize: "0.85rem",
                  marginBottom: "1.25rem",
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {form.includeCustomerName && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    Your Name *
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={16} color="#64748b" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.75rem 0.65rem 2.4rem",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: "0.9rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}

              {form.includeCustomerPhone && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    WhatsApp / Phone Number *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} color="#64748b" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.75rem 0.65rem 2.4rem",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: "0.9rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}

              {form.includeCustomerEmail && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    Email Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} color="#64748b" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="email"
                      placeholder="name@company.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.75rem 0.65rem 2.4rem",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: "0.9rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}

              {form.includeServiceInterest && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    Service / Package Interest
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Video Growth Package, Lead Generation"
                    value={serviceInterest}
                    onChange={(e) => setServiceInterest(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.75rem",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#fff",
                      fontSize: "0.9rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Dynamic Custom Fields */}
              {includedCustomFields.map((field) => (
                <div key={field.id}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    {field.label} {field.required && "*"}
                  </label>
                  {field.type === "dropdown" ? (
                    <select
                      required={field.required}
                      value={customValues[field.id] || ""}
                      onChange={(e) => setCustomValues({ ...customValues, [field.id]: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.75rem",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: "0.9rem",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="">{field.placeholder || "Select option..."}</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      required={field.required}
                      placeholder={field.placeholder || "Enter details..."}
                      value={customValues[field.id] || ""}
                      onChange={(e) => setCustomValues({ ...customValues, [field.id]: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.75rem",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: "0.9rem",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>
              ))}

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "#cbd5e1", marginBottom: "0.35rem" }}>
                  Additional Notes / Requirement
                </label>
                <textarea
                  rows={2}
                  placeholder="Tell us about your team or immediate goals..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.75rem",
                    borderRadius: "8px",
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: "0.75rem",
                  padding: "0.85rem",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                  color: "#fff",
                  border: "none",
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: submitting ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(255, 107, 47, 0.4)",
                }}
              >
                {submitting ? "Submitting..." : "Submit & Request Callback"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
