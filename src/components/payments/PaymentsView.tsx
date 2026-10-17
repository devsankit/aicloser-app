"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { CURRENT_USER, useApp } from "@/lib/store";

export interface PaymentTransaction {
  id: string;
  leadCode: string;
  customerName: string;
  company: string;
  amount: number;
  method: "UPI" | "Cards / Netbanking" | "Bank Transfer";
  closer: string;
  status: "settled" | "proof_uploaded" | "pending" | "rejected";
  utr?: string;
  createdAt: string;
  proofNote?: string;
}

const DEFAULT_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: "PAY-911",
    leadCode: "CLO-101",
    customerName: "Anshita Rao",
    company: "Nimbus Interiors",
    amount: 96000,
    method: "UPI",
    closer: "Aarav Sharma",
    status: "proof_uploaded",
    utr: "428901289102",
    createdAt: "Today, 11:50 AM",
    proofNote: "Client completed UPI transfer via PhonePe. Screenshot attached for verification.",
  },
  {
    id: "PAY-908",
    leadCode: "CLO-104",
    customerName: "Devansh Kapoor",
    company: "Vertex Labs",
    amount: 130000,
    method: "Bank Transfer",
    closer: "Rohan Mehta",
    status: "settled",
    utr: "IMPS4901238910",
    createdAt: "Yesterday, 4:45 PM",
  },
  {
    id: "PAY-904",
    leadCode: "CLO-105",
    customerName: "Farah Khan",
    company: "Meridian Stays",
    amount: 190000,
    method: "UPI",
    closer: "Aarav Sharma",
    status: "settled",
    utr: "UPI9823901234",
    createdAt: "15 Oct 2026",
  },
  {
    id: "PAY-899",
    leadCode: "CLO-102",
    customerName: "Karan Mehta",
    company: "Ambition Realty",
    amount: 148000,
    method: "UPI",
    closer: "Aarav Sharma",
    status: "pending",
    createdAt: "16 Oct 2026",
  },
  {
    id: "PAY-892",
    leadCode: "CLO-106",
    customerName: "Rahul Deshmukh",
    company: "Skyline Motors",
    amount: 130000,
    method: "UPI",
    closer: "Meera Joshi",
    status: "proof_uploaded",
    utr: "510928391023",
    createdAt: "Yesterday, 2:30 PM",
    proofNote: "Advance payment 50% for 6 closer licenses.",
  },
];

export function PaymentsView() {
  const { state, moveLead } = useApp();
  const [tab, setTab] = useState<"links" | "proofs" | "settings">("links");
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(DEFAULT_TRANSACTIONS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProofTx, setSelectedProofTx] = useState<PaymentTransaction | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Create Link State
  const [selectedLeadId, setSelectedLeadId] = useState(state.leads[0]?.id || "");
  const [linkAmount, setLinkAmount] = useState("96000");
  const [linkDescription, setLinkDescription] = useState("Annual Closer CRM Onboarding License");

  const pendingProofs = transactions.filter((t) => t.status === "proof_uploaded");
  const settledTotal = transactions
    .filter((t) => t.status === "settled")
    .reduce((acc, t) => acc + t.amount, 0);

  const handleApproveProof = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    // Update transaction
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: "settled" } : t))
    );

    // Auto-advance lead to Won in CRM
    const matchedLead = state.leads.find((l) => l.code === tx.leadCode);
    if (matchedLead) {
      moveLead(matchedLead.id, "won");
    }

    setSelectedProofTx(null);
    setBanner(`Payment of ₹${tx.amount.toLocaleString("en-IN")} verified! Deal automatically moved to Closed Won.`);
    setTimeout(() => setBanner(null), 4000);
  };

  const handleRejectProof = (txId: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: "rejected" } : t))
    );
    setSelectedProofTx(null);
    setBanner("Payment proof rejected. Notification sent to customer for re-upload.");
    setTimeout(() => setBanner(null), 4000);
  };

  const handleCreateLink = () => {
    const lead = state.leads.find((l) => l.id === selectedLeadId) || state.leads[0];
    const newTx: PaymentTransaction = {
      id: `PAY-${Math.floor(100 + Math.random() * 900)}`,
      leadCode: lead.code,
      customerName: lead.name,
      company: lead.company,
      amount: Number(linkAmount.replace(/\D/g, "")) || 48000,
      method: "UPI",
      closer: CURRENT_USER,
      status: "pending",
      createdAt: "Just now",
    };

    setTransactions([newTx, ...transactions]);
    setIsCreateOpen(false);
    setBanner(`Dynamic payment link created for ${lead.name} (₹${newTx.amount.toLocaleString("en-IN")})`);
    setTimeout(() => setBanner(null), 4000);
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <header className="page-head" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
            Payments & Collections
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Generate dynamic UPI payment links, review client screenshot proofs, verify settlements, and auto-move deals to Closed Won.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {banner && (
            <span className="chip" data-tone="success" style={{ padding: "4px 10px" }}>
              <Icon name="check" size={13} /> {banner}
            </span>
          )}
          <button className="btn" data-variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Icon name="plus" size={13} /> Create UPI Payment Link
          </button>
        </div>
      </header>

      {/* Metric Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Settled Revenue (Month)
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--success)" }}>
            ₹{(settledTotal / 100000).toFixed(2)}L
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Verified settlements across CRM deals
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Pending Verification
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: pendingProofs.length > 0 ? "var(--warning)" : "var(--text)" }}>
            {pendingProofs.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>proofs</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--warning)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="dot" style={{ background: "var(--warning)" }} /> ₹{(pendingProofs.reduce((acc, t) => acc + t.amount, 0) / 1000).toFixed(0)}k awaiting approval
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Open Payment Links
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {transactions.filter((t) => t.status === "pending").length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>active</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Shared via WhatsApp & SMS
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Auto-Stage Advance
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--accent)" }}>
            Active
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Moves lead to Won on confirmation
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
        <div className="seg">
          <button data-on={tab === "links"} onClick={() => setTab("links")}>
            <Icon name="card" size={13} /> Transactions & Links ({transactions.length})
          </button>
          <button data-on={tab === "proofs"} onClick={() => setTab("proofs")}>
            <Icon name="sparkle" size={13} /> Proof Review Queue ({pendingProofs.length})
          </button>
          <button data-on={tab === "settings"} onClick={() => setTab("settings")}>
            <Icon name="settings" size={13} /> UPI & QR Gateway Config
          </button>
        </div>
      </div>

      {/* Tab 1: Links & Transactions */}
      {tab === "links" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "130px" }}>Transaction ID</th>
                  <th>Customer & Lead</th>
                  <th>Deal Value</th>
                  <th>Payment Mode</th>
                  <th>Closer</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className="chip" data-tone="accent" style={{ fontSize: "11px", fontFamily: "var(--mono)" }}>
                        {tx.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{tx.customerName}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {tx.company} • {tx.leadCode}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: "var(--fs-body)", color: "var(--text)" }}>
                        ₹{tx.amount.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td>
                      <span className="chip" style={{ fontSize: "11px" }}>
                        <Icon name="card" size={10} /> {tx.method}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{tx.closer}</td>
                    <td>
                      <span
                        className="chip"
                        data-tone={
                          tx.status === "settled"
                            ? "success"
                            : tx.status === "proof_uploaded"
                            ? "warning"
                            : tx.status === "rejected"
                            ? "danger"
                            : "accent"
                        }
                        style={{ fontSize: "11px" }}
                      >
                        <span className="dot" style={{ background: tx.status === "settled" ? "var(--success)" : tx.status === "proof_uploaded" ? "var(--warning)" : "var(--accent)" }} />
                        {tx.status === "proof_uploaded" ? "Proof Uploaded" : tx.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>{tx.createdAt}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        {tx.status === "proof_uploaded" && (
                          <button
                            className="btn"
                            data-size="sm"
                            data-variant="primary"
                            onClick={() => setSelectedProofTx(tx)}
                          >
                            Review Proof
                          </button>
                        )}
                        <button
                          className="btn"
                          data-size="sm"
                          data-variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(`https://closer.ai/pay/${tx.id}`);
                            setBanner(`Payment link copied for ${tx.customerName}!`);
                            setTimeout(() => setBanner(null), 2500);
                          }}
                          title="Copy Customer Payment Link"
                        >
                          <Icon name="link" size={12} /> Copy Link
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Proof Review Queue */}
      {tab === "proofs" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Screenshot Proof Approval Queue</h2>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Verify incoming UPI transfer receipts. Approving will automatically move the linked lead to Closed Won.
              </p>
            </div>
            <span className="chip" data-tone="warning">
              {pendingProofs.length} pending verification
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {pendingProofs.map((p) => (
              <div key={p.id} style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 650, fontSize: "var(--fs-title)", color: "var(--text)" }}>
                      {p.customerName}
                    </span>
                    <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                      {p.leadCode}
                    </span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>• {p.company}</span>
                  </div>
                  <div style={{ fontSize: "var(--fs-body)", fontWeight: 700, color: "var(--success)", marginTop: "4px" }}>
                    ₹{p.amount.toLocaleString("en-IN")} via UPI
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                    UTR / Ref ID: <b style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{p.utr}</b> • {p.createdAt}
                  </div>
                  {p.proofNote && (
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px", fontStyle: "italic" }}>
                      &ldquo;{p.proofNote}&rdquo;
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button className="btn" data-variant="ghost" onClick={() => handleRejectProof(p.id)}>
                    Reject Proof
                  </button>
                  <button className="btn" data-variant="primary" onClick={() => handleApproveProof(p.id)}>
                    <Icon name="check" size={13} /> Approve & Close Won
                  </button>
                </div>
              </div>
            ))}
            {pendingProofs.length === 0 && (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>
                ✓ All client payment proofs have been reviewed!
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 3: UPI Gateway Settings */}
      {tab === "settings" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <section className="card" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650, marginBottom: "12px" }}>Business UPI VPA Configuration</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="field">
                <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Company UPI ID / VPA</label>
                <input className="input" defaultValue="sales@aicloser" readOnly />
              </div>
              <div className="field">
                <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Merchant Display Name</label>
                <input className="input" defaultValue="AI Closer Technologies Pvt Ltd" readOnly />
              </div>
              <div className="field">
                <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>GST Number</label>
                <input className="input" defaultValue="27AAACX9812A1Z5" readOnly />
              </div>
            </div>
          </section>

          <section className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650, marginBottom: "6px" }}>Dynamic QR Code Preview</h2>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                Customers see this customized QR generated dynamically with deal amount and lead reference.
              </p>
              <div
                style={{
                  width: "140px",
                  height: "140px",
                  margin: "18px auto",
                  background: "#ffffff",
                  padding: "10px",
                  borderRadius: "8px",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {/* Simulated QR Pattern */}
                <div style={{ width: "120px", height: "120px", border: "2px solid #000", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "2px", padding: "4px" }}>
                  {Array.from({ length: 36 }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        background: (i * 7) % 3 === 0 ? "#000" : "transparent",
                        borderRadius: "1px",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-tertiary)" }}>
              Accepts PhonePe, Google Pay, Paytm, BHIM & all UPI apps.
            </div>
          </section>
        </div>
      )}

      {/* Create Payment Link Modal */}
      {isCreateOpen && (
        <div className="overlay" data-kind="dialog" onClick={() => setIsCreateOpen(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="payment-link-dialog-title" onClick={(e) => e.stopPropagation()} style={{ width: "440px" }}>
            <div className="dialog-head">
              <h2 id="payment-link-dialog-title" style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>Create Dynamic UPI Payment Link</h2>
              <button className="btn" data-variant="ghost" aria-label="Close dialog" onClick={() => setIsCreateOpen(false)} style={{ padding: "4px" }}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px 20px" }}>
              <div className="field">
                <label htmlFor="pay-lead" style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Select CRM Lead</label>
                <select
                  className="select"
                  id="pay-lead"
                  value={selectedLeadId}
                  onChange={(e) => {
                    setSelectedLeadId(e.target.value);
                    const l = state.leads.find((lead) => lead.id === e.target.value);
                    if (l) setLinkAmount(String(l.value));
                  }}
                >
                  {state.leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.company}) • ₹{l.value.toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="pay-amount" style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Amount (₹)</label>
                <input
                  className="input"
                  id="pay-amount"
                  value={linkAmount}
                  onChange={(e) => setLinkAmount(e.target.value)}
                  placeholder="e.g. 96000"
                />
              </div>

              <div className="field">
                <label htmlFor="pay-desc" style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>Milestone Description</label>
                <input
                  className="input"
                  id="pay-desc"
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                />
              </div>

              <div className="card" style={{ padding: "10px", background: "var(--bg-soft)", fontSize: "11px", color: "var(--text-secondary)" }}>
                ⚡ The generated payment link embeds a dynamic UPI QR code with amount pre-filled and attaches to this lead record.
              </div>
            </div>
            <div className="dialog-foot" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px" }}>
              <button className="btn" data-variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </button>
              <button className="btn" data-variant="primary" onClick={handleCreateLink}>
                Generate Payment Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Inspection Modal */}
      {selectedProofTx && (
        <div className="overlay" data-kind="dialog" onClick={() => setSelectedProofTx(null)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="proof-dialog-title" onClick={(e) => e.stopPropagation()} style={{ width: "460px" }}>
            <div className="dialog-head">
              <h2 id="proof-dialog-title" style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>Review UPI Transfer Receipt</h2>
              <button className="btn" data-variant="ghost" aria-label="Close dialog" onClick={() => setSelectedProofTx(null)} style={{ padding: "4px" }}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>{selectedProofTx.customerName}</span>
                <span style={{ fontSize: "var(--fs-metric)", fontWeight: 700, color: "var(--success)" }}>
                  ₹{selectedProofTx.amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                UTR Reference: <b style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{selectedProofTx.utr}</b>
              </div>

              {/* Simulated Receipt Preview Box */}
              <div
                style={{
                  height: "160px",
                  background: "var(--bg-soft)",
                  borderRadius: "var(--r-md)",
                  border: "1px dashed var(--border-strong)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Icon name="card" size={28} />
                <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>UPI Payment Screenshot Verified</span>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Transferred via Google Pay • Bank Ref: {selectedProofTx.utr}</span>
              </div>
            </div>
            <div className="dialog-foot" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px" }}>
              <button className="btn" data-variant="ghost" onClick={() => handleRejectProof(selectedProofTx.id)}>
                Reject
              </button>
              <button className="btn" data-variant="primary" onClick={() => handleApproveProof(selectedProofTx.id)}>
                <Icon name="check" size={13} /> Approve & Close Won
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
