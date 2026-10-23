"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/ui/Icon";

export interface PublicPaymentData {
  id: string;
  publicToken: string;
  status: string;
  amount: number;
  totalAmount: number;
  currency: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  productName?: string;
  description?: string;
  customerNote?: string;
  upiId: string;
  payeeName: string;
  upiUri: string;
  payUrl: string;
  hasProof?: boolean;
  utrReference?: string;
  paidAt?: string;
  createdAt: string;
  creatorName?: string;
  expiresAt?: string;
  isExpired?: boolean;
  remainingSeconds?: number;
  expiryMinutes?: number;
  leadId?: string;
}

export function PublicPayGateway({ token }: { token: string }) {
  const [payment, setPayment] = useState<PublicPaymentData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [vpaCopied, setVpaCopied] = useState(false);

  // Live countdown timer state
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Proof submission state
  const [utrNumber, setUtrNumber] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [, startTransition] = useTransition();

  const loadPaymentDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/payments/public/${encodeURIComponent(token)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        setError(json?.message || "Payment request not found or expired.");
        return;
      }

      const paymentData: PublicPaymentData = json.payment || json.data;
      setPayment(paymentData);

      // Compute initial remaining seconds
      let initialSecs = 0;
      if (typeof paymentData.remainingSeconds === "number") {
        initialSecs = paymentData.remainingSeconds;
      } else if (paymentData.expiresAt) {
        initialSecs = Math.max(0, Math.floor((new Date(paymentData.expiresAt).getTime() - Date.now()) / 1000));
      } else {
        initialSecs = 1800; // default 30 mins
      }
      setSecondsLeft(initialSecs);

      // Generate dynamic QR code data URL from NPCI upiUri
      if (paymentData.upiUri) {
        try {
          const qrData = await QRCode.toDataURL(paymentData.upiUri, {
            width: 320,
            margin: 1,
            color: {
              dark: "#08090a",
              light: "#ffffff",
            },
          });
          setQrCodeUrl(qrData);
        } catch {
          // Ignore QR generation fallback
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load payment details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void loadPaymentDetails();
    }
  }, [token]);

  // Live 1-second interval ticking down
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const formatCountdown = (totalSeconds: number | null) => {
    if (totalSeconds === null) return "--:--";
    if (totalSeconds <= 0) return "00:00 (Expired)";
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setBanner("Payment link copied to clipboard.");
      setTimeout(() => setBanner(null), 3000);
    }
  };

  const handleCopyVpa = () => {
    if (!payment?.upiId) return;
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(payment.upiId);
      setVpaCopied(true);
      setTimeout(() => setVpaCopied(false), 2000);
    }
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    setIsSubmittingProof(true);
    setBanner(null);

    try {
      const formData = new FormData();
      if (proofFile) formData.append("proof", proofFile);
      if (utrNumber.trim()) formData.append("utrReference", utrNumber.trim());
      if (proofNote.trim()) formData.append("note", proofNote.trim());
      formData.append("customerName", payment.customerName);
      if (payment.customerPhone) formData.append("customerPhone", payment.customerPhone);

      const targetId = payment.publicToken || payment.id;
      // First attempt public confirm endpoint (unauthenticated for customers), fallback to /proof endpoint
      let res = await fetch(`/api/v1/payments/public/${encodeURIComponent(targetId)}/confirm`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        res = await fetch(`/api/v1/payments/${encodeURIComponent(payment.id)}/proof`, {
          method: "POST",
          body: formData,
        });
      }

      const resData = await res.json().catch(() => null);
      if (!res.ok || resData?.success === false) {
        throw new Error(resData?.message || "Could not submit payment confirmation.");
      }

      setProofSubmitted(true);
      setBanner("Payment confirmation submitted successfully. Verification in progress.");
      startTransition(() => {
        void loadPaymentDetails();
      });
    } catch (err: any) {
      setBanner(err?.message || "Failed to submit payment proof.");
    } finally {
      setIsSubmittingProof(false);
    }
  };

  if (isLoading) {
    return (
      <main className="pay-gateway-wrap">
        <div className="card" style={{ padding: "40px 32px", textAlign: "center", maxWidth: "420px" }}>
          <div className="empty-icon" style={{ margin: "0 auto 12px" }}>
            <Icon name="card" size={24} />
          </div>
          <h2 className="card-title">Securing Payment Channel...</h2>
          <p className="card-sub">Fetching verified merchant credentials from AI Closer.</p>
        </div>
      </main>
    );
  }

  if (error || !payment) {
    return (
      <main className="pay-gateway-wrap">
        <div className="card" style={{ padding: "40px 32px", textAlign: "center", maxWidth: "440px" }}>
          <div className="empty-icon" style={{ margin: "0 auto 12px", background: "var(--danger-soft)", color: "var(--danger)" }}>
            <Icon name="close" size={24} />
          </div>
          <h2 className="card-title">Payment Link Unavailable</h2>
          <p className="card-sub">
            {error || "This payment link is invalid, expired, or has already been fulfilled."}
          </p>
        </div>
      </main>
    );
  }

  const isExpired = payment.status === "EXPIRED" || (secondsLeft !== null && secondsLeft <= 0) || Boolean(payment.isExpired);
  const isPaid = payment.status === "PAID" || payment.status === "SETTLED";
  const isCancelled = payment.status === "CANCELLED" || payment.status === "VOIDED";

  return (
    <main className="pay-gateway-wrap">
      {/* Top Verified Brand Bar */}
      <header className="pay-brand-header">
        <div className="pay-brand-logo">
          <span className="pay-brand-badge">
            <Icon name="sparkle" size={15} /> AI Closer
          </span>
          <span className="pay-security-pill">
            <Icon name="check" size={11} /> 256-Bit Encrypted UPI Portal
          </span>
        </div>
        <div className="pay-support-tag">Verified Merchant Checkout</div>
      </header>

      {banner && (
        <div style={{ marginBottom: "16px", maxWidth: "860px", width: "100%" }}>
          <span className="chip" data-tone="success" style={{ width: "100%", justifyContent: "center", padding: "8px 12px" }}>
            <Icon name="check" size={13} /> {banner}
          </span>
        </div>
      )}

      <div className="pay-gateway-container">
        {/* Left Column: QR Code & Immediate UPI App Pay */}
        <section className="card pay-qr-card">
          {/* Expiry Countdown Timer Banner */}
          {!isPaid && !isCancelled && (
            <div className="pay-countdown-banner" data-state={isExpired ? "expired" : "active"}>
              {!isExpired && <div className="pay-countdown-pulse" />}
              {isExpired ? (
                <>
                  <Icon name="clock" size={13} />
                  <span>Payment Session Expired</span>
                </>
              ) : (
                <>
                  <span>Link Expires In:</span>
                  <strong className="pay-countdown-digits">{formatCountdown(secondsLeft)}</strong>
                </>
              )}
            </div>
          )}

          <div className="card-head" style={{ borderBottom: "none", padding: 0, textAlign: "center", width: "100%" }}>
            <span className="chip" data-tone="accent" style={{ marginBottom: "8px" }}>
              Secure UPI Payment
            </span>
            <h1 className="card-title" style={{ fontSize: "var(--fs-page)" }}>
              {payment.payeeName}
            </h1>
            <p className="card-sub">
              Scan with Google Pay, PhonePe, Paytm, BHIM, or any UPI app.
            </p>
          </div>

          <div className="pay-amount-display">
            ₹{payment.totalAmount.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
            NPCI UPI Protocol • Direct Bank Transfer
          </div>

          {/* QR Code Container */}
          <div className={`pay-qr-frame ${isExpired ? "is-expired" : ""}`}>
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="UPI Payment QR Code" className="pay-qr-img" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <Icon name="card" size={32} />
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Generating QR...</span>
              </div>
            )}

            {isExpired && (
              <div className="pay-qr-expired-overlay">
                <Icon name="close" size={24} />
                <span>Link Expired</span>
                <span style={{ fontSize: "10.5px", opacity: 0.85, fontWeight: 400 }}>
                  QR code deactivated
                </span>
              </div>
            )}
          </div>

          {/* VPA Row with 1-Click Copy */}
          <div className="pay-vpa-row">
            <span>VPA: <b>{payment.upiId}</b></span>
            <button
              type="button"
              className="pay-vpa-copy-btn"
              onClick={handleCopyVpa}
              title="Copy VPA to clipboard"
            >
              <Icon name={vpaCopied ? "check" : "copy"} size={11} />
              {vpaCopied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pay-app-actions">
            {!isPaid && !isCancelled && !isExpired && (
              <a
                href={payment.upiUri}
                className="btn"
                data-variant="accent"
                style={{ height: "40px", fontSize: "14px", fontWeight: 600, width: "100%", justifyContent: "center" }}
              >
                <Icon name="sparkle" size={14} /> Open in UPI App
              </a>
            )}

            {!isPaid && !isCancelled && isExpired && (
              <button
                type="button"
                className="btn"
                data-variant="outline"
                disabled
                style={{ height: "40px", width: "100%", justifyContent: "center", opacity: 0.65 }}
              >
                <Icon name="clock" size={14} /> Link Expired — Request New Link
              </button>
            )}

            <button
              type="button"
              className="btn"
              data-variant="ghost"
              onClick={handleCopyLink}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Icon name="link" size={13} /> Copy Payment Link
            </button>
          </div>

          {isPaid && (
            <div style={{ marginTop: "16px" }}>
              <span className="chip" data-tone="success">
                <Icon name="check" size={12} /> Payment Verified & Settled
              </span>
            </div>
          )}

          {isCancelled && (
            <div style={{ marginTop: "16px" }}>
              <span className="chip" data-tone="danger">
                <Icon name="close" size={12} /> Payment Link Voided
              </span>
            </div>
          )}
        </section>

        {/* Right Column: Order Details & Payment Proof Submission */}
        <section className="card pay-details-card">
          <div className="card-head" style={{ padding: "0 0 16px 0" }}>
            <h2 className="card-title">Order & Billing Summary</h2>
            <p className="card-sub">Review invoice details and submit transfer reference.</p>
          </div>

          <div className="card-body" style={{ padding: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="card" style={{ padding: "12px 14px", background: "var(--bg-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>Billed To:</span>
                <span style={{ fontWeight: 600 }}>{payment.customerName}</span>
              </div>
              {payment.customerPhone && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>Phone:</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "12px" }}>{payment.customerPhone}</span>
                </div>
              )}
              {payment.productName && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>Product / Milestone:</span>
                  <span style={{ fontWeight: 550 }}>{payment.productName}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontWeight: 600 }}>Total Payable:</span>
                <span style={{ fontWeight: 700, color: "var(--accent)" }}>₹{payment.totalAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Expired Banner Notice */}
            {isExpired && !isPaid && !isCancelled && (
              <div className="card" style={{ padding: "16px", background: "var(--danger-soft)", border: "1px solid var(--danger)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)", fontWeight: 600 }}>
                  <Icon name="clock" size={16} /> Payment Session Expired
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  For security, this payment session has expired. To complete your transaction, please reach out to your sales closer or specialist to issue a fresh payment link.
                </div>
              </div>
            )}

            {/* Confirmation & Proof Form */}
            {!isPaid && !isCancelled && !isExpired && (
              <form onSubmit={handleProofSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
                <div style={{ fontSize: "var(--fs-meta)", fontWeight: 600 }}>
                  Confirm Payment Completion
                </div>

                <div className="field">
                  <label htmlFor="utr-ref">Bank UTR / UPI Reference Number (Optional)</label>
                  <input
                    id="utr-ref"
                    className="input"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="12-digit UTR if available (e.g. 429381029482)"
                  />
                </div>

                <div className="field">
                  <label htmlFor="proof-file">Payment Screenshot (Optional)</label>
                  <input
                    id="proof-file"
                    type="file"
                    className="input"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    style={{ padding: "4px 8px" }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="proof-note">Notes / Comments (Optional)</label>
                  <input
                    id="proof-note"
                    className="input"
                    value={proofNote}
                    onChange={(e) => setProofNote(e.target.value)}
                    placeholder="e.g. Transferred via Google Pay"
                  />
                </div>

                <button
                  type="submit"
                  className="btn"
                  data-variant="primary"
                  disabled={isSubmittingProof || proofSubmitted}
                  style={{ width: "100%", height: "38px" }}
                >
                  <Icon name="check" size={13} /> {isSubmittingProof ? "Submitting Confirmation..." : proofSubmitted ? "Payment Confirmed ✓" : "I Have Made This Payment"}
                </button>
              </form>
            )}

            {isPaid && (
              <div className="card" style={{ padding: "16px", background: "var(--success-soft)", border: "1px solid var(--success)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--success)", fontWeight: 600 }}>
                  <Icon name="check" size={16} /> Payment Completed
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  This transaction has been settled and verified on the company ledger. Reference #{payment.utrReference || payment.id.slice(-8)}.
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
