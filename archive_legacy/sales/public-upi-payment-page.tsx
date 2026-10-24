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
    <main className="upi-public-page">
      {!confirmed && paymentLink.expiresAt ? <div className="upi-public-countdown" style={{ borderColor: expired ? "var(--color-error, #dc2626)" : paymentLink.qrAccentColor, background: expired ? "color-mix(in srgb, var(--color-error, #dc2626) 12%, var(--color-surface))" : "color-mix(in srgb, var(--color-primary, #ff6b2f) 10%, var(--color-surface))" }}><div><div className="upi-public-countdown-label">{expired ? "Payment link expired" : "Complete payment before"}</div><strong>{expired ? "Request a new link" : countdown}</strong></div><span>{expired ? "This checkout can no longer accept payment proof." : "Keep this page open while you complete the UPI payment."}</span></div> : null}
      <div className="upi-public-layout">
        <section className="upi-public-payment-card">
          <div className="upi-public-brand" style={{ color: paymentLink.qrAccentColor }}>{paymentLink.qrBrandName}</div>
          <h1>Pay securely with UPI</h1>
          <p className="upi-public-muted">Scan this QR using Google Pay, PhonePe, Paytm, or any UPI app.</p>
          <div className="upi-public-payment-details">
            <div className="upi-public-qr">
              <img src={paymentLink.qrDataUrl} alt="UPI payment QR code" style={{ width: "100%", height: "100%" }} />
              {paymentLink.qrLogoDataUrl ? <img src={paymentLink.qrLogoDataUrl} alt="" style={{ position: "absolute", width: 48, height: 48, left: "calc(50% - 24px)", top: "calc(50% - 24px)", borderRadius: 12, background: "white", padding: 4 }} /> : null}
            </div>
            <div className="upi-public-payment-copy"><div className="upi-public-muted">Amount to pay</div><div className="upi-public-amount" style={{ color: paymentLink.qrAccentColor }}>₹{paymentLink.totalAmount.toFixed(2)}</div><div className="upi-public-payee">{paymentLink.payeeName}</div><code>{paymentLink.upiId}</code><div className="upi-public-actions"><a href={paymentLink.upiUri} style={{ background: paymentLink.qrAccentColor }}>Open UPI app</a><button type="button" onClick={copy}>Copy link</button></div></div>
          </div>
          <div className="upi-public-summary"><strong>Order summary</strong><div><span>{paymentLink.productName || "Payment"}</span><span>{paymentLink.quantity} × {paymentLink.duration} {paymentLink.durationUnit.toLowerCase()}</span></div><div><span>Total</span><span>₹{paymentLink.totalAmount.toFixed(2)}</span></div></div>
        </section>
        <section className="upi-public-checkout-card">
          <div className="upi-public-eyebrow" style={{ color: paymentLink.qrAccentColor }}>Checkout details</div>
          <h2>Submit billing details</h2>
          <p className="upi-public-checkout-copy">Your sales representative has prefilled these details. Review or correct them before processing the order, then add your UPI payment proof below.</p>
          {confirmed ? <div className="upi-public-success">Your billing details and payment confirmation have been submitted. The team will verify it shortly.</div> : <form onSubmit={submit} className="upi-public-form"><div className="upi-public-form-section">Billing information</div><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Enter your full name" /></label><label>Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone number" /></label><label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com (optional)" /></label><div className="upi-public-form-section upi-public-form-divider">Payment confirmation</div><label>Payment screenshot {paymentLink.screenshotRequired ? "(required)" : "(optional)"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setProof(e.target.files?.[0] || null)} required={paymentLink.screenshotRequired} /></label><label>Order note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" rows={3} /></label><button disabled={submitting} style={{ background: paymentLink.qrAccentColor }}>{submitting ? "Submitting…" : "Submit billing details & proof"}</button>{message ? <p className={message.startsWith("Payment proof") ? "upi-public-message-success" : "upi-public-message-error"}>{message}</p> : null}</form>}
        </section>
      </div>
      <style>{`label{display:grid;gap:6px;font-size:13px;font-weight:700;color:var(--color-text-secondary)}input,textarea{font:inherit;border:1px solid var(--color-border-strong);border-radius:9px;padding:11px;background:var(--color-surface-soft);color:var(--color-text-primary)}input::placeholder,textarea::placeholder{color:var(--color-text-muted)}button{font:inherit;cursor:pointer}.upi-public-page{min-height:100vh;background:var(--color-bg,#0d0e10);color:var(--color-text-primary,#f5f5f7);padding:32px 16px}.upi-public-layout{max-width:900px;margin:0 auto;display:grid;gap:20px;grid-template-columns:minmax(0,1fr) minmax(300px,420px)}.upi-public-payment-card,.upi-public-checkout-card{background:var(--color-surface,#18191c);border:1px solid var(--color-border,#2a2e39);border-radius:24px;box-shadow:var(--shadow-card);padding:28px}.upi-public-checkout-card{align-self:start}.upi-public-brand,.upi-public-eyebrow{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.upi-public-payment-card h1{margin:12px 0 8px;font-size:34px;line-height:1.15}.upi-public-checkout-card h2{margin:6px 0 5px;color:var(--color-text-primary);font-size:1.25rem}.upi-public-muted,.upi-public-checkout-copy{color:var(--color-text-secondary);margin-top:0}.upi-public-checkout-copy{margin-bottom:18px;font-size:13px;line-height:1.5}.upi-public-payment-details{display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin:28px 0}.upi-public-qr{position:relative;background:#fff;border-radius:18px;padding:14px;width:260px;height:260px;flex:none}.upi-public-payment-copy{min-width:0}.upi-public-amount{font-size:38px;font-weight:800}.upi-public-payee{margin-top:12px;color:var(--color-text-primary)}.upi-public-payment-copy code{color:var(--color-text-secondary);font-size:13px;word-break:break-all}.upi-public-actions{margin-top:20px;display:flex;gap:10px;flex-wrap:wrap}.upi-public-actions a,.upi-public-actions button,.upi-public-form button{color:#fff;padding:11px 16px;border-radius:10px;text-decoration:none;font-weight:700;border:0}.upi-public-actions button{background:transparent;color:var(--color-text-primary);border:1px solid var(--color-border-strong)}.upi-public-summary{background:var(--color-surface-soft);border:1px solid var(--color-border);border-radius:14px;padding:16px}.upi-public-summary>div{display:flex;justify-content:space-between;margin-top:10px;color:var(--color-text-secondary);gap:12px}.upi-public-summary>div:last-child{margin-top:8px;font-weight:800;color:var(--color-text-primary)}.upi-public-form{display:grid;gap:12px}.upi-public-form-section{font-size:12px;color:var(--color-text-secondary);font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding-bottom:2px}.upi-public-form-divider{border-top:1px solid var(--color-border);margin:4px 0 2px;padding-top:14px}.upi-public-form button{width:100%;font-weight:800}.upi-public-success{background:color-mix(in srgb,var(--color-success,#059669) 12%,var(--color-surface));color:var(--color-success,#059669);border:1px solid color-mix(in srgb,var(--color-success,#059669) 28%,transparent);padding:16px;border-radius:12px}.upi-public-message-success{margin-bottom:0;color:var(--color-success,#059669)}.upi-public-message-error{margin-bottom:0;color:var(--color-error,#dc2626)}.upi-public-countdown{max-width:900px;margin:0 auto 16px;border:1px solid;border-radius:16px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;color:var(--color-text-primary)}.upi-public-countdown-label{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary)}.upi-public-countdown strong{display:block;margin-top:4px;font-size:26px;letter-spacing:.02em}.upi-public-countdown>span{font-size:12px;color:var(--color-text-secondary);text-align:right}@media(max-width:760px){.upi-public-page{padding:16px 10px}.upi-public-layout{grid-template-columns:1fr;gap:14px}.upi-public-countdown{margin-bottom:12px;padding:12px 14px;flex-direction:column;align-items:flex-start;gap:5px}.upi-public-countdown strong{font-size:24px}.upi-public-countdown>span{font-size:12px;text-align:left}.upi-public-payment-card,.upi-public-checkout-card{padding:18px;border-radius:18px}.upi-public-payment-card h1{font-size:clamp(28px,8vw,34px)}.upi-public-payment-details{flex-direction:column;align-items:stretch;margin:20px 0;gap:16px}.upi-public-qr{width:min(100%,280px);height:auto;aspect-ratio:1;margin:0 auto}.upi-public-actions{display:grid;grid-template-columns:1fr 1fr}.upi-public-actions a,.upi-public-actions button{width:100%;box-sizing:border-box;text-align:center}.upi-public-checkout-card input[type=file]{font-size:12px;padding:10px 8px}}`}</style>
    </main>
  );
}
