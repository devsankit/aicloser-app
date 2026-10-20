"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { CURRENT_USER, useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";

export interface PaymentTransaction {
  id: string;
  publicToken: string;
  leadId?: string;
  leadCode: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  productName?: string;
  customerNote?: string;
  company: string;
  amount: number;
  currency: string;
  method: "UPI" | "Cards / Netbanking" | "Bank Transfer";
  closer: string;
  status: "settled" | "proof_uploaded" | "pending" | "rejected" | "expired" | "cancelled";
  rawStatus: string;
  utr?: string;
  createdAt: string;
  paidAt?: string;
  proofNote?: string;
  hasProof?: boolean;
}

export function PaymentsView() {
  const { state, moveLead } = useApp();
  const [tab, setTab] = useState<"links" | "proofs" | "settings">("links");
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProofTx, setSelectedProofTx] = useState<PaymentTransaction | null>(null);
  const [editingTx, setEditingTx] = useState<PaymentTransaction | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Create Link Form State
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [linkCustomerName, setLinkCustomerName] = useState("");
  const [linkCustomerPhone, setLinkCustomerPhone] = useState("");
  const [linkAmount, setLinkAmount] = useState("48000");
  const [linkPurpose, setLinkPurpose] = useState("CRM Onboarding & Setup Package");

  // Gateway Settings State
  const [upiSettings, setUpiSettings] = useState<{
    enabled?: boolean;
    upiId?: string | null;
    payeeName?: string | null;
    instructions?: string | null;
    qrBrandName?: string | null;
    qrAccentColor?: string;
  }>({
    enabled: true,
    upiId: "sales@aicloser",
    payeeName: "AI Closer Technologies Pvt Ltd",
    instructions: "Pay instantly using Google Pay, PhonePe, Paytm, or BHIM.",
    qrBrandName: "AI Closer",
    qrAccentColor: "#f4612a",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Auto-populate when selecting a lead for link creation
  useEffect(() => {
    if (state.leads.length > 0 && !selectedLeadId) {
      const first = state.leads[0];
      setSelectedLeadId(first.id);
      setLinkCustomerName(first.name);
      setLinkCustomerPhone(first.phone);
      if (first.value) setLinkAmount(String(first.value));
    }
  }, [state.leads, selectedLeadId]);

  const handleLeadSelectChange = (leadId: string) => {
    setSelectedLeadId(leadId);
    const matched = state.leads.find((l) => l.id === leadId);
    if (matched) {
      setLinkCustomerName(matched.name);
      setLinkCustomerPhone(matched.phone);
      if (matched.value) setLinkAmount(String(matched.value));
    }
  };

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const res = await aicloserApi.payments.list({ limit: 100 });
      const rawList = res?.payments || [];
      const mapped: PaymentTransaction[] = rawList.map((p: any) => {
        const rawStatus = String(p.status || "").toUpperCase();
        let normalizedStatus: PaymentTransaction["status"] = "pending";
        if (rawStatus === "PAID" || rawStatus === "SETTLED") {
          normalizedStatus = "settled";
        } else if (rawStatus === "CUSTOMER_CONFIRMED" || rawStatus === "PROOF_UPLOADED") {
          normalizedStatus = "proof_uploaded";
        } else if (rawStatus === "CANCELLED") {
          normalizedStatus = "cancelled";
        } else if (rawStatus === "REJECTED") {
          normalizedStatus = "rejected";
        } else if (rawStatus === "EXPIRED") {
          normalizedStatus = "expired";
        }

        return {
          id: p.id,
          publicToken: p.publicToken || p.id,
          leadId: p.customFields?.leadId || p.leadId || undefined,
          leadCode: p.lead?.leadCode || (p.leadId ? `LEAD-${String(p.leadId).slice(-4).toUpperCase()}` : `CLO-${p.id.slice(-4).toUpperCase()}`),
          customerName: p.customerName || p.lead?.customerName || "Customer",
          customerPhone: p.customerPhone || p.lead?.customerPhone,
          customerEmail: p.customerEmail || p.lead?.customerEmail,
          productName: p.productName || p.description,
          customerNote: p.customerNote || p.notes,
          company: p.lead?.company || p.lead?.customFields?.company || "Direct Client",
          amount: Number(p.totalAmount || p.baseAmount || 0),
          currency: p.currency || "INR",
          method:
            p.method === "UPI"
              ? "UPI"
              : p.method === "BANK_TRANSFER"
              ? "Bank Transfer"
              : "Cards / Netbanking",
          closer: p.createdBy?.displayName || p.agent?.displayName || CURRENT_USER,
          status: normalizedStatus,
          rawStatus,
          utr: p.utrReference,
          createdAt: p.createdAt
            ? new Date(p.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Recent",
          paidAt: p.paidAt
            ? new Date(p.paidAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
          proofNote: p.customerNote || p.notes,
          hasProof: Boolean(p.hasProof || p.proofStoragePath),
        };
      });
      setTransactions(mapped);
    } catch {
      // Fallback empty
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await aicloserApi.payments.getSettings();
      if (data) {
        setUpiSettings({
          enabled: data.enabled ?? true,
          upiId: data.upiId || "sales@aicloser",
          payeeName: data.payeeName || "AI Closer Technologies Pvt Ltd",
          instructions: data.instructions || "Pay instantly using any UPI app.",
          qrBrandName: data.qrBrandName || "AI Closer",
          qrAccentColor: data.qrAccentColor || "#f4612a",
        });
      }
    } catch {
      // Keep defaults
    }
  };

  useEffect(() => {
    void loadPayments();
    void loadSettings();
  }, []);

  const pendingProofs = transactions.filter((t) => t.status === "proof_uploaded");
  const pendingProofsTotal = pendingProofs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const settledTotal = transactions
    .filter((t) => t.status === "settled")
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const openLinks = transactions.filter((t) => t.status === "pending");
  const openLinksTotal = openLinks.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  // Generate UPI Payment Link
  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(linkAmount.replace(/[^0-9.]/g, "")) || 0;
    if (amountNum <= 0) {
      setBanner("Please enter a valid positive payment amount.");
      setTimeout(() => setBanner(null), 3000);
      return;
    }

    try {
      startTransition(async () => {
        await aicloserApi.payments.createUpiLink({
          amount: amountNum,
          customerName: linkCustomerName.trim() || "Valued Customer",
          customerPhone: linkCustomerPhone.trim(),
          purpose: linkPurpose.trim(),
          productName: linkPurpose.trim(),
          leadId: selectedLeadId || undefined,
        });

        setIsCreateOpen(false);
        setBanner(`Dynamic UPI payment link generated for ₹${amountNum.toLocaleString("en-IN")}`);
        setTimeout(() => setBanner(null), 4000);
        await loadPayments();
      });
    } catch (err: any) {
      setBanner(err?.message || "Failed to generate UPI payment link.");
      setTimeout(() => setBanner(null), 4000);
    }
  };

  // Copy Public Gateway Link
  const handleCopyLink = (tx: PaymentTransaction) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://app.aicloser.in";
    const paymentUrl = `${origin}/pay/${tx.publicToken || tx.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(paymentUrl);
      setBanner(`Payment link copied: ${paymentUrl}`);
      setTimeout(() => setBanner(null), 3500);
    }
  };

  // Open Edit Modal for PENDING items
  const handleOpenEdit = (tx: PaymentTransaction) => {
    setEditingTx(tx);
    setEditAmount(String(tx.amount));
    setEditNotes(tx.customerNote || tx.productName || "");
  };

  // Save Edit (PATCH /api/v1/payments/:id)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const amountNum = Number(editAmount.replace(/[^0-9.]/g, "")) || 0;
    if (amountNum <= 0) {
      setBanner("Amount must be greater than zero.");
      setTimeout(() => setBanner(null), 3000);
      return;
    }

    try {
      startTransition(async () => {
        await aicloserApi.payments.updatePayment(editingTx.id, {
          amount: amountNum,
          notes: editNotes.trim(),
          customerNote: editNotes.trim(),
          productName: editNotes.trim() || undefined,
        });

        setEditingTx(null);
        setBanner(`Payment link #${editingTx.id.slice(-6)} updated to ₹${amountNum.toLocaleString("en-IN")}`);
        setTimeout(() => setBanner(null), 3500);
        await loadPayments();
      });
    } catch (err: any) {
      setBanner(err?.message || "Failed to update payment link.");
      setTimeout(() => setBanner(null), 4000);
    }
  };

  // Cancel / Void Link (POST /api/v1/payments/:id/cancel)
  const handleCancelLink = async (tx: PaymentTransaction) => {
    if (!window.confirm(`Are you sure you want to cancel and void payment link for ₹${tx.amount.toLocaleString("en-IN")}?`)) {
      return;
    }

    try {
      startTransition(async () => {
        await aicloserApi.payments.cancel(tx.id, "Voided by user from CRM console");
        setBanner(`Payment link #${tx.id.slice(-6)} has been cancelled.`);
        setTimeout(() => setBanner(null), 3500);
        await loadPayments();
      });
    } catch (err: any) {
      setBanner(err?.message || "Failed to cancel payment link.");
      setTimeout(() => setBanner(null), 4000);
    }
  };

  // Review & Approve Proof
  const handleApproveProof = async (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    try {
      startTransition(async () => {
        await aicloserApi.payments.approve(txId);

        // Auto-advance lead to Won in CRM store if matched
        if (tx.leadId) {
          moveLead(tx.leadId, "won");
        } else {
          const matchedLead = state.leads.find((l) => l.code === tx.leadCode || l.name === tx.customerName);
          if (matchedLead) {
            moveLead(matchedLead.id, "won");
          }
        }

        setSelectedProofTx(null);
        setBanner(`Payment of ₹${tx.amount.toLocaleString("en-IN")} verified! Deal automatically advanced to Closed Won.`);
        setTimeout(() => setBanner(null), 4500);
        await loadPayments();
      });
    } catch (err: any) {
      setBanner(err?.message || "Failed to approve payment proof.");
      setTimeout(() => setBanner(null), 4000);
    }
  };

  // Reject Proof
  const handleRejectProof = async (txId: string) => {
    try {
      startTransition(async () => {
        await aicloserApi.payments.reject(txId, "Receipt image unreadable or invalid UTR reference.");
        setSelectedProofTx(null);
        setBanner("Payment proof rejected. Notification dispatched for re-upload.");
        setTimeout(() => setBanner(null), 4000);
        await loadPayments();
      });
    } catch (err: any) {
      setBanner(err?.message || "Failed to reject payment proof.");
      setTimeout(() => setBanner(null), 4000);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await aicloserApi.payments.updateSettings({
        enabled: upiSettings.enabled,
        upiId: upiSettings.upiId,
        payeeName: upiSettings.payeeName,
        instructions: upiSettings.instructions,
        qrBrandName: upiSettings.qrBrandName,
        qrAccentColor: upiSettings.qrAccentColor,
      });
      setBanner("UPI gateway configuration saved successfully.");
      setTimeout(() => setBanner(null), 3500);
    } catch (err: any) {
      setBanner(err?.message || "Failed to save gateway configuration.");
      setTimeout(() => setBanner(null), 4000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="page">
      {/* Page Header */}
      <header className="page-head">
        <div>
          <h1 className="page-title">Payments & Collections</h1>
          <p className="page-sub">
            Generate dynamic UPI payment links, review client screenshot proofs, verify settlements, and auto-move deals to Closed Won.
          </p>
        </div>
        <div className="page-actions">
          {banner && (
            <span className="chip" data-tone="success">
              <Icon name="check" size={13} /> {banner}
            </span>
          )}
          <button className="btn" data-variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Icon name="plus" size={13} /> Generate UPI Link
          </button>
        </div>
      </header>

      {/* Metric Cards Row */}
      <div className="stat-grid">
        <div className="stat card">
          <div className="stat-label">Settled Revenue</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            ₹{settledTotal.toLocaleString("en-IN")}
          </div>
          <div className="stat-foot" data-tone="success">
            <span className="dot" style={{ background: "var(--success)" }} /> Verified on immutable ledger
          </div>
        </div>

        <div className="stat card">
          <div className="stat-label">Pending Verification</div>
          <div className="stat-value" style={{ color: pendingProofs.length > 0 ? "var(--warning)" : "var(--text)" }}>
            {pendingProofs.length}
          </div>
          <div className="stat-foot">
            ₹{pendingProofsTotal.toLocaleString("en-IN")} awaiting proof approval
          </div>
        </div>

        <div className="stat card">
          <div className="stat-label">Open Payment Links</div>
          <div className="stat-value">
            ₹{openLinksTotal.toLocaleString("en-IN")}
          </div>
          <div className="stat-foot">
            {openLinks.length} active customer links
          </div>
        </div>

        <div className="stat card">
          <div className="stat-label">Auto-Stage Advance</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>
            Active
          </div>
          <div className="stat-foot">
            Moves linked lead to Closed Won on settlement
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="seg" style={{ marginBottom: "16px" }}>
        <button
          className="seg-item"
          data-on={tab === "links"}
          onClick={() => setTab("links")}
        >
          <Icon name="card" size={13} /> Payment Links & Ledger ({transactions.length})
        </button>
        <button
          className="seg-item"
          data-on={tab === "proofs"}
          onClick={() => setTab("proofs")}
        >
          <Icon name="sparkle" size={13} /> Proof Review Queue ({pendingProofs.length})
        </button>
        <button
          className="seg-item"
          data-on={tab === "settings"}
          onClick={() => setTab("settings")}
        >
          <Icon name="settings" size={13} /> UPI & QR Gateway Config
        </button>
      </div>

      {/* TAB 1: Links & Transactions */}
      {tab === "links" && (
        <section className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Customer & Lead</th>
                  <th>Amount</th>
                  <th>Status & Audit</th>
                  <th>Mode</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                      <span className="chip" data-tone="accent">Loading live payment ledger...</span>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty">
                        <div className="empty-icon">
                          <Icon name="card" size={20} />
                        </div>
                        <h3>No payment links generated yet</h3>
                        <p>Generate your first dynamic UPI link attached to a CRM lead to start collecting payments.</p>
                        <button
                          className="btn"
                          data-variant="primary"
                          onClick={() => setIsCreateOpen(true)}
                          style={{ marginTop: "12px" }}
                        >
                          <Icon name="plus" size={13} /> Generate UPI Link
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isPendingState = tx.status === "pending";
                    const isSettledState = tx.status === "settled";

                    return (
                      <tr key={tx.id}>
                        <td>
                          <span className="chip" data-tone="accent" style={{ fontFamily: "var(--mono)", fontSize: "11px" }}>
                            {tx.id.slice(0, 14)}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.customerName}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                            {tx.company} • {tx.leadCode}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: "var(--fs-body)", color: isSettledState ? "var(--success)" : "var(--text)" }}>
                            ₹{tx.amount.toLocaleString("en-IN")}
                          </span>
                          {tx.productName && (
                            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                              {tx.productName}
                            </div>
                          )}
                        </td>
                        <td>
                          {isSettledState ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <span className="chip" data-tone="success">
                                <Icon name="check" size={11} /> PAID
                              </span>
                              <span className="chip" data-tone="success" title={`UTR: ${tx.utr || "Verified"} • Settled: ${tx.paidAt || tx.createdAt}`}>
                                <Icon name="shield" size={10} /> Immutable Audit #{tx.utr || tx.id.slice(-6).toUpperCase()}
                              </span>
                            </div>
                          ) : tx.status === "proof_uploaded" ? (
                            <span className="chip" data-tone="warning">
                              <span className="dot" style={{ background: "var(--warning)" }} /> Proof Uploaded
                            </span>
                          ) : tx.status === "cancelled" ? (
                            <span className="chip" data-tone="danger">
                              <Icon name="close" size={10} /> Cancelled / Void
                            </span>
                          ) : tx.status === "rejected" ? (
                            <span className="chip" data-tone="danger">
                              Rejected
                            </span>
                          ) : tx.status === "expired" ? (
                            <span className="chip">
                              Expired
                            </span>
                          ) : (
                            <span className="chip" data-tone="accent">
                              <span className="dot" style={{ background: "var(--accent)" }} /> Pending Payment
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="chip" style={{ fontSize: "11px" }}>
                            <Icon name="card" size={10} /> {tx.method}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                          {tx.createdAt}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {/* Copy Link Action */}
                            <button
                              className="btn"
                              data-size="sm"
                              data-variant="ghost"
                              onClick={() => handleCopyLink(tx)}
                              title="Copy Customer Gateway Payment Link"
                            >
                              <Icon name="link" size={12} /> Copy Link
                            </button>

                            {/* PENDING Items Actions */}
                            {isPendingState && (
                              <>
                                <button
                                  className="btn"
                                  data-size="sm"
                                  data-variant="outline"
                                  onClick={() => handleOpenEdit(tx)}
                                  title="Edit payment amount or milestone note"
                                >
                                  <Icon name="pencil" size={12} /> Edit
                                </button>
                                <button
                                  className="btn"
                                  data-size="sm"
                                  data-variant="danger"
                                  onClick={() => handleCancelLink(tx)}
                                  title="Cancel and void this payment link"
                                >
                                  <Icon name="close" size={12} /> Void
                                </button>
                              </>
                            )}

                            {/* Review Proof for Uploaded Status */}
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
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: Proof Review Queue */}
      {tab === "proofs" && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Screenshot Proof Review Queue</h2>
              <p className="card-sub">
                Verify incoming customer UPI transfer receipts. Approving will record the ledger settlement and automatically advance the linked lead to Closed Won.
              </p>
            </div>
            <span className="chip" data-tone="warning">
              {pendingProofs.length} pending review
            </span>
          </div>

          <div className="card-body">
            {pendingProofs.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <Icon name="check" size={20} />
                </div>
                <h3>All payment proofs reviewed</h3>
                <p>When customers upload transfer screenshots on the payment gateway, they will appear here for 1-click verification.</p>
              </div>
            ) : (
              pendingProofs.map((p) => (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                    padding: "16px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 650, fontSize: "var(--fs-title)" }}>
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
                      UTR / Bank Ref: <b style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{p.utr || "Pending"}</b> • {p.createdAt}
                    </div>
                    {p.proofNote && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", fontStyle: "italic" }}>
                        &ldquo;{p.proofNote}&rdquo;
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn" data-variant="ghost" onClick={() => handleRejectProof(p.id)} disabled={isPending}>
                      Reject Proof
                    </button>
                    <button className="btn" data-variant="primary" onClick={() => handleApproveProof(p.id)} disabled={isPending}>
                      <Icon name="check" size={13} /> Approve & Close Won
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* TAB 3: Gateway Configuration */}
      {tab === "settings" && (
        <div className="grid-2">
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Business UPI VPA Configuration</h2>
              <p className="card-sub">Configure the receiving UPI VPA address and business name for your organization.</p>
            </div>
            <form onSubmit={handleSaveSettings} className="card-body">
              <div className="field" style={{ marginBottom: "12px" }}>
                <label htmlFor="settings-upi">Receiving UPI ID / VPA</label>
                <input
                  id="settings-upi"
                  className="input"
                  value={upiSettings.upiId || ""}
                  onChange={(e) => setUpiSettings({ ...upiSettings, upiId: e.target.value })}
                  placeholder="e.g. yourcompany@icici"
                  required
                />
              </div>

              <div className="field" style={{ marginBottom: "12px" }}>
                <label htmlFor="settings-payee">Payee Merchant Display Name</label>
                <input
                  id="settings-payee"
                  className="input"
                  value={upiSettings.payeeName || ""}
                  onChange={(e) => setUpiSettings({ ...upiSettings, payeeName: e.target.value })}
                  placeholder="e.g. Acme Corp Sales"
                  required
                />
              </div>

              <div className="field" style={{ marginBottom: "12px" }}>
                <label htmlFor="settings-brand">Brand Title on QR Card</label>
                <input
                  id="settings-brand"
                  className="input"
                  value={upiSettings.qrBrandName || ""}
                  onChange={(e) => setUpiSettings({ ...upiSettings, qrBrandName: e.target.value })}
                  placeholder="e.g. AI Closer"
                />
              </div>

              <div className="field" style={{ marginBottom: "16px" }}>
                <label htmlFor="settings-instructions">Customer Checkout Instructions</label>
                <textarea
                  id="settings-instructions"
                  className="textarea"
                  value={upiSettings.instructions || ""}
                  onChange={(e) => setUpiSettings({ ...upiSettings, instructions: e.target.value })}
                  placeholder="Instructions displayed on public /pay/[token] page"
                  rows={3}
                />
              </div>

              <button className="btn" data-variant="primary" type="submit" disabled={isSavingSettings}>
                <Icon name="check" size={13} /> {isSavingSettings ? "Saving Settings..." : "Save Gateway Settings"}
              </button>
            </form>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Dynamic Checkout QR Architecture</h2>
              <p className="card-sub">Every generated link constructs an authenticated NPCI UPI payload.</p>
            </div>
            <div className="card-body">
              <div
                style={{
                  padding: "20px",
                  borderRadius: "var(--r-md)",
                  border: "1px dashed var(--border-strong)",
                  background: "var(--bg-soft)",
                  marginBottom: "16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                  Active Protocol
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--accent)", wordBreak: "break-all" }}>
                  upi://pay?pa={upiSettings.upiId || "sales@aicloser"}&amp;pn={encodeURIComponent(upiSettings.payeeName || "AI Closer")}&amp;cu=INR
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                <div>✓ <b>Zero PG Cut:</b> 100% direct bank-to-bank settlement via UPI.</div>
                <div>✓ <b>Universal App Support:</b> PhonePe, Google Pay, Paytm, BHIM, CRED, Amazon Pay.</div>
                <div>✓ <b>Automated Attribution:</b> Lead ID and publicToken tracked securely on customer upload.</div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* MODAL 1: Generate UPI Payment Link */}
      {isCreateOpen && (
        <div className="overlay" data-kind="dialog" onClick={() => setIsCreateOpen(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="generate-link-title" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px", width: "100%" }}>
            <div className="dialog-head">
              <h2 id="generate-link-title" className="card-title">Generate Dynamic UPI Payment Link</h2>
              <button className="btn" data-variant="ghost" aria-label="Close dialog" onClick={() => setIsCreateOpen(false)} style={{ padding: "4px" }}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateLink}>
              <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="field">
                  <label htmlFor="create-lead">Select CRM Lead (Auto-Populate)</label>
                  <select
                    id="create-lead"
                    className="select"
                    value={selectedLeadId}
                    onChange={(e) => handleLeadSelectChange(e.target.value)}
                  >
                    <option value="">— Standalone / New Customer —</option>
                    {state.leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.company}) • ₹{l.value?.toLocaleString("en-IN") || 0}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="create-customer-name">Customer Name</label>
                  <input
                    id="create-customer-name"
                    className="input"
                    value={linkCustomerName}
                    onChange={(e) => setLinkCustomerName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="create-customer-phone">Customer WhatsApp / Phone</label>
                  <input
                    id="create-customer-phone"
                    className="input"
                    value={linkCustomerPhone}
                    onChange={(e) => setLinkCustomerPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="create-amount">Amount (₹ INR)</label>
                  <input
                    id="create-amount"
                    className="input"
                    value={linkAmount}
                    onChange={(e) => setLinkAmount(e.target.value)}
                    placeholder="e.g. 48000"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="create-purpose">Milestone Description / Product</label>
                  <input
                    id="create-purpose"
                    className="input"
                    value={linkPurpose}
                    onChange={(e) => setLinkPurpose(e.target.value)}
                    placeholder="e.g. 50% Advance Onboarding Deposit"
                    required
                  />
                </div>

                <div className="card" style={{ padding: "10px", background: "var(--bg-soft)", fontSize: "11px", color: "var(--text-secondary)" }}>
                  ⚡ Generated link is public at <code>/pay/[token]</code> with dynamic QR code pre-filled with the exact amount.
                </div>
              </div>
              <div className="dialog-foot">
                <button type="button" className="btn" data-variant="ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" data-variant="primary" disabled={isPending}>
                  {isPending ? "Generating..." : "Generate Payment Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit PENDING Payment Link */}
      {editingTx && (
        <div className="overlay" data-kind="dialog" onClick={() => setEditingTx(null)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-link-title" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px", width: "100%" }}>
            <div className="dialog-head">
              <h2 id="edit-link-title" className="card-title">Edit Payment Details</h2>
              <button className="btn" data-variant="ghost" aria-label="Close dialog" onClick={() => setEditingTx(null)} style={{ padding: "4px" }}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                  Modifying link for <b>{editingTx.customerName}</b> ({editingTx.leadCode}).
                </div>

                <div className="field">
                  <label htmlFor="edit-amount">Revised Amount (₹ INR)</label>
                  <input
                    id="edit-amount"
                    className="input"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="e.g. 54000"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-notes">Milestone / Deal Note</label>
                  <input
                    id="edit-notes"
                    className="input"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Revised quote after scope discussion"
                  />
                </div>
              </div>
              <div className="dialog-foot">
                <button type="button" className="btn" data-variant="ghost" onClick={() => setEditingTx(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn" data-variant="primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Proof Inspection Dialog */}
      {selectedProofTx && (
        <div className="overlay" data-kind="dialog" onClick={() => setSelectedProofTx(null)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="proof-dialog-title" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px", width: "100%" }}>
            <div className="dialog-head">
              <h2 id="proof-dialog-title" className="card-title">Review UPI Transfer Receipt</h2>
              <button className="btn" data-variant="ghost" aria-label="Close dialog" onClick={() => setSelectedProofTx(null)} style={{ padding: "4px" }}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>{selectedProofTx.customerName}</span>
                <span style={{ fontSize: "var(--fs-metric)", fontWeight: 700, color: "var(--success)" }}>
                  ₹{selectedProofTx.amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                UTR / Reference: <b style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{selectedProofTx.utr || "Attached"}</b>
              </div>

              <div
                style={{
                  height: "140px",
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
                <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>UPI Transfer Screenshot Verified</span>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Ref #{selectedProofTx.utr || selectedProofTx.id.slice(-8)}</span>
              </div>
            </div>
            <div className="dialog-foot">
              <button type="button" className="btn" data-variant="ghost" onClick={() => handleRejectProof(selectedProofTx.id)} disabled={isPending}>
                Reject Proof
              </button>
              <button type="button" className="btn" data-variant="primary" onClick={() => handleApproveProof(selectedProofTx.id)} disabled={isPending}>
                <Icon name="check" size={13} /> Approve &amp; Close Won
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
