"use client";

import { useEffect, useState } from "react";

type PaymentLink = {
  publicToken: string; status: string; totalAmount: number; quantity: number; duration: number; durationUnit: string;
  productName: string | null; customerName: string | null; customerPhone: string | null; customerEmail: string | null;
  payeeName: string; upiId: string; upiUri: string; qrDataUrl: string; instructions: string | null;
  screenshotRequired: boolean; utrEnabled: boolean; qrBrandName: string; qrAccentColor: string; qrLogoDataUrl: string | null; expiresAt: string | null;
};

export function PublicUpiPaymentPage({ paymentLink }: { paymentLink: PaymentLink }) {
  const [name, setName] = useState(paymentLink.customerName || "");
  const [phone, setPhone] = useState(paymentLink.customerPhone || "");
  const [email, setEmail] = useState(paymentLink.customerEmail || "");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => paymentLink.expiresAt ? Math.max(0, new Date(paymentLink.expiresAt).getTime() - Date.now()) : null);
  const confirmed = paymentLink.status === "CUSTOMER_CONFIRMED" || paymentLink.status === "PAID";
  const expired = paymentLink.status === "EXPIRED" || (remainingMs !== null && remainingMs <= 0);
  useEffect(() => {
    if (!paymentLink.expiresAt || confirmed || expired) return;
    const timer = window.setInterval(() => setRemainingMs(Math.max(0, new Date(paymentLink.expiresAt as string).getTime() - Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, [confirmed, expired, paymentLink.expiresAt]);
  const countdown = remainingMs === null ? "No expiry" : `${Math.floor(remainingMs / 86_400_000)}d ${String(Math.floor((remainingMs % 86_400_000) / 3_600_000)).padStart(2, "0")}h ${String(Math.floor((remainingMs % 3_600_000) / 60_000)).padStart(2, "0")}m ${String(Math.floor((remainingMs % 60_000) / 1000)).padStart(2, "0")}s`;
  const copy = async () => { await navigator.clipboard?.writeText(window.location.href); setMessage("Payment link copied."); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (expired) { setMessage("This payment link has expired. Please request a new link."); return; } setSubmitting(true); setMessage("");
    const form = new FormData();
    form.set("customerName", name); form.set("customerPhone", phone); form.set("customerEmail", email); form.set("confirmationNote", note);
    if (proof) form.set("proof", proof);
    const response = await fetch(`/api/payment-links/public/${encodeURIComponent(paymentLink.publicToken)}/confirm`, { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setMessage(data.ok ? "Payment proof submitted. Tenant Admin approval is pending." : data.error || "Could not submit proof.");
    if (data.ok) window.location.reload();
    setSubmitting(false);
  };
  return (
    <main className="upi-public-page" style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0d0e12,#161820)", color: "#f8fafc", padding: "32px 16px" }}>
      {!confirmed && paymentLink.expiresAt ? <div className="upi-public-countdown" style={{ borderColor: expired ? "#9f3d32" : paymentLink.qrAccentColor, background: expired ? "rgba(159,61,50,.16)" : "rgba(255,107,44,.1)" }}><div><div className="upi-public-countdown-label">{expired ? "Payment link expired" : "Complete payment before"}</div><strong>{expired ? "Request a new link" : countdown}</strong></div><span>{expired ? "This checkout can no longer accept payment proof." : "Keep this page open while you complete the UPI payment."}</span></div> : null}
      <div className="upi-public-layout" style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 20, gridTemplateColumns: "minmax(0,1fr) minmax(300px,420px)" }}>
        <section className="upi-public-payment-card" style={{ background: "#17191f", border: "1px solid #2a2e39", borderRadius: 24, padding: 28 }}>
          <div style={{ fontSize: 13, color: paymentLink.qrAccentColor, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>{paymentLink.qrBrandName}</div>
          <h1 style={{ margin: "12px 0 8px", fontSize: 34 }}>Pay securely with UPI</h1>
          <p style={{ color: "#aab1c1", marginTop: 0 }}>Scan this QR using Google Pay, PhonePe, Paytm, or any UPI app.</p>
          <div className="upi-public-payment-details" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", margin: "28px 0" }}>
            <div className="upi-public-qr" style={{ position: "relative", background: "white", borderRadius: 18, padding: 14, width: 260, height: 260 }}>
              <img src={paymentLink.qrDataUrl} alt="UPI payment QR code" style={{ width: "100%", height: "100%" }} />
              {paymentLink.qrLogoDataUrl ? <img src={paymentLink.qrLogoDataUrl} alt="" style={{ position: "absolute", width: 48, height: 48, left: "calc(50% - 24px)", top: "calc(50% - 24px)", borderRadius: 12, background: "white", padding: 4 }} /> : null}
            </div>
            <div><div style={{ color: "#aab1c1", fontSize: 14 }}>Amount to pay</div><div style={{ fontSize: 38, fontWeight: 800, color: paymentLink.qrAccentColor }}>₹{paymentLink.totalAmount.toFixed(2)}</div><div style={{ marginTop: 12, color: "#cdd2de" }}>{paymentLink.payeeName}</div><code style={{ color: "#aab1c1", fontSize: 13 }}>{paymentLink.upiId}</code><div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}><a href={paymentLink.upiUri} style={{ background: paymentLink.qrAccentColor, color: "#fff", padding: "11px 16px", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}>Open UPI app</a><button type="button" onClick={copy} style={{ background: "transparent", color: "#e7eaf0", border: "1px solid #4a5060", padding: "10px 16px", borderRadius: 10 }}>Copy link</button></div></div>
          </div>
          <div style={{ background: "#20232c", borderRadius: 14, padding: 16 }}><strong>Order summary</strong><div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, color: "#cdd2de" }}><span>{paymentLink.productName || "Payment"}</span><span>{paymentLink.quantity} × {paymentLink.duration} {paymentLink.durationUnit.toLowerCase()}</span></div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800 }}><span>Total</span><span>₹{paymentLink.totalAmount.toFixed(2)}</span></div></div>
        </section>
        <section className="upi-public-checkout-card" style={{ background: "#f8fafc", color: "#12151b", borderRadius: 24, padding: 24, alignSelf: "start" }}>
          <div style={{ fontSize: 12, color: paymentLink.qrAccentColor, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Checkout details</div>
          <h2 style={{ margin: "6px 0 5px" }}>Submit billing details</h2>
          <p style={{ margin: "0 0 18px", color: "#5f6878", fontSize: 13, lineHeight: 1.5 }}>Your sales representative has prefilled these details. Review or correct them before processing the order, then add your UPI payment proof below.</p>
          {confirmed ? <div style={{ background: "#e7f8ee", color: "#146c38", padding: 16, borderRadius: 12 }}>Your billing details and payment confirmation have been submitted. The team will verify it shortly.</div> : <form onSubmit={submit} style={{ display: "grid", gap: 12 }}><div style={{ fontSize: 12, color: "#657084", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", paddingBottom: 2 }}>Billing information</div><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Enter your full name" /></label><label>Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone number" /></label><label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com (optional)" /></label><div style={{ borderTop: "1px solid #dfe3ea", margin: "4px 0 2px", paddingTop: 14, fontSize: 12, color: "#657084", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>Payment confirmation</div><label>Payment screenshot {paymentLink.screenshotRequired ? "(required)" : "(optional)"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setProof(e.target.files?.[0] || null)} required={paymentLink.screenshotRequired} /></label><label>Order note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" rows={3} /></label><button disabled={submitting} style={{ background: paymentLink.qrAccentColor, color: "white", border: 0, padding: 13, borderRadius: 10, fontWeight: 800 }}>{submitting ? "Submitting…" : "Submit billing details & proof"}</button>{message ? <p style={{ marginBottom: 0, color: message.startsWith("Payment proof") ? "#146c38" : "#b42318" }}>{message}</p> : null}</form>}
        </section>
      </div>
      <style>{`label{display:grid;gap:6px;font-size:13px;font-weight:700}input,textarea{font:inherit;border:1px solid #d4d9e2;border-radius:9px;padding:11px;background:#fff;color:#12151b}button{font:inherit;cursor:pointer}.upi-public-countdown{max-width:900px;margin:0 auto 16px;border:1px solid;border-radius:16px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;color:#ffd2c0}.upi-public-countdown-label{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.82}.upi-public-countdown strong{display:block;margin-top:4px;font-size:26px;letter-spacing:.02em}.upi-public-countdown>span{font-size:12px;color:#cdd2de;text-align:right}.upi-public-payment-card code{word-break:break-all}@media(max-width:760px){.upi-public-page{padding:16px 10px!important}.upi-public-layout{grid-template-columns:1fr!important;gap:14px!important}.upi-public-countdown{margin-bottom:12px;padding:12px 14px;flex-direction:column;align-items:flex-start;gap:5px}.upi-public-countdown strong{font-size:24px}.upi-public-countdown>span{font-size:12px;text-align:left}.upi-public-payment-card,.upi-public-checkout-card{padding:18px!important;border-radius:18px!important}.upi-public-payment-card h1{font-size:clamp(28px,8vw,34px)!important}.upi-public-payment-details{flex-direction:column;align-items:stretch!important;margin:20px 0!important;gap:16px!important}.upi-public-qr{width:min(100%,280px)!important;height:auto!important;aspect-ratio:1;margin:0 auto}.upi-public-payment-details>div:last-child>div:last-child{display:grid!important;grid-template-columns:1fr 1fr}.upi-public-payment-details a,.upi-public-payment-details button{width:100%;box-sizing:border-box;text-align:center}.upi-public-checkout-card input[type=file]{font-size:12px;padding:10px 8px}}`}</style>
    </main>
  );
}
