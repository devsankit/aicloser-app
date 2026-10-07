"use client";

import { Check, Copy, WalletCards } from "lucide-react";
import { useState } from "react";

import type { SalesDashboardSnapshot } from "@/lib/gigxomi/sales-store";

export function ReferralCommissionPanel({
  snapshot,
  canRequestWithdrawal,
}: {
  snapshot: SalesDashboardSnapshot;
  canRequestWithdrawal: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const primaryReferral = snapshot.referrals.find((referral) => referral.isActive) ?? snapshot.referrals[0] ?? null;
  const commissionRule = snapshot.commissionRules.find((rule) => rule.isActive && rule.type === "PERCENTAGE") ?? null;

  async function copyLink(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setStatus("Copy is unavailable in this browser. Select the link and copy it manually.");
    }
  }

  async function requestWithdrawal() {
    if (!snapshot.currentAgent || snapshot.reports.availableBalance <= 0) return;
    setRequesting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/sales/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: snapshot.currentAgent.id,
          amount: snapshot.reports.availableBalance,
          note: "Requested from the Referral & Commission dashboard.",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Unable to request withdrawal.");
      setStatus("Withdrawal request submitted for review.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to request withdrawal.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <section
      aria-label="Referrals & Commission"
      style={{
        padding: "1.25rem",
        borderRadius: "12px",
        background: "var(--closer-surface, #ffffff)",
        border: "1px solid rgba(255, 107, 47, 0.28)",
        display: "grid",
        gap: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--closer-ink, #0f172a)" }}>Referrals &amp; Commission</h3>
          <p style={{ margin: "0.3rem 0 0", color: "var(--closer-muted, #64748b)", fontSize: "0.8rem" }}>
            Live referral links and earnings from the current workspace data.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#ff6b2f", fontWeight: 700, fontSize: "0.82rem" }}>
          <WalletCards size={16} /> Available for Withdrawal: ₹{Math.round(snapshot.reports.availableBalance).toLocaleString("en-IN")}
        </div>
      </div>

      {primaryReferral ? (
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <ReferralLink label="Website Referral Link" value={primaryReferral.websiteUrl} copied={copied === "website"} onCopy={() => void copyLink("website", primaryReferral.websiteUrl)} />
          <ReferralLink label="Android App Referral Link" value={primaryReferral.androidAppUrl} copied={copied === "android"} onCopy={() => void copyLink("android", primaryReferral.androidAppUrl)} />
        </div>
      ) : (
        <p style={{ margin: 0, color: "var(--closer-muted, #64748b)", fontSize: "0.82rem" }}>No referral link has been created for this workspace yet.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.65rem" }}>
        <Metric label="Direct Client Sale" value={snapshot.reports.directCustomersCount} />
        <Metric label="Commission Earned" value={`₹${Math.round(snapshot.reports.directCommissionEarned).toLocaleString("en-IN")}`} />
        <Metric label="Pending Maturation" value={`₹${Math.round(snapshot.reports.walletBreakdown.pendingVesting).toLocaleString("en-IN")}`} />
        <Metric label="Total Amount Withdrawn" value={`₹${Math.round(snapshot.reports.totalAmountWithdrawn).toLocaleString("en-IN")}`} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <span style={{ color: "var(--closer-muted, #64748b)", fontSize: "0.78rem" }}>
          {commissionRule ? `${commissionRule.value}% commission rule: ${commissionRule.name}` : "Commission rules are configured by the workspace administrator."}
        </span>
        {canRequestWithdrawal ? (
          <button
            type="button"
            onClick={() => void requestWithdrawal()}
            disabled={requesting || snapshot.reports.availableBalance <= 0}
            style={{ border: 0, borderRadius: "8px", padding: "0.55rem 0.85rem", background: "#ff6b2f", color: "#fff", fontWeight: 700, cursor: requesting ? "wait" : "pointer", opacity: requesting ? 0.7 : 1 }}
          >
            {requesting ? "Submitting..." : "Request Withdrawal"}
          </button>
        ) : null}
      </div>
      {status ? <p role="status" style={{ margin: 0, color: status.includes("submitted") ? "#059669" : "#b45309", fontSize: "0.8rem" }}>{status}</p> : null}
    </section>
  );
}

function ReferralLink({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "0.5rem", alignItems: "center" }}>
      <label style={{ minWidth: 0, display: "grid", gap: "0.25rem" }}>
        <span style={{ color: "var(--closer-muted, #64748b)", fontSize: "0.72rem", fontWeight: 700 }}>{label}</span>
        <input readOnly value={value} aria-label={label} style={{ width: "100%", minWidth: 0, border: "1px solid rgba(148, 163, 184, 0.3)", borderRadius: "7px", padding: "0.48rem 0.6rem", color: "var(--closer-ink, #0f172a)", background: "rgba(15, 23, 42, 0.03)", fontSize: "0.78rem" }} />
      </label>
      <button type="button" onClick={onCopy} aria-label={`Copy ${label}`} style={{ alignSelf: "end", border: "1px solid rgba(255, 107, 47, 0.35)", borderRadius: "7px", background: "rgba(255, 107, 47, 0.08)", color: "#ea580c", padding: "0.48rem 0.62rem", cursor: "pointer" }}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: "0.75rem", borderRadius: "9px", background: "rgba(15, 23, 42, 0.035)" }}>
      <span style={{ display: "block", color: "var(--closer-muted, #64748b)", fontSize: "0.7rem", fontWeight: 700 }}>{label}</span>
      <strong style={{ display: "block", marginTop: "0.25rem", color: "var(--closer-ink, #0f172a)", fontSize: "0.95rem" }}>{value}</strong>
    </div>
  );
}
