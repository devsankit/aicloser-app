"use client";

import { useEffect, useState, useTransition, useMemo, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { CURRENT_USER, useApp, useScopedLeads } from "@/lib/store";
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
  expiresAt?: string;
  isExpired?: boolean;
  remainingSeconds?: number;
}

export function PaymentsView() {
  const { state, moveLead, updateLead } = useApp();
  const isAdmin = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<"links" | "proofs" | "settings">("links");
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProofTx, setSelectedProofTx] = useState<PaymentTransaction | null>(null);
  const [enlargedProofUrl, setEnlargedProofUrl] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<PaymentTransaction | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scopedLeads = useScopedLeads();

  // Create Link Form State
  const [customerMode, setCustomerMode] = useState<"crm_lead" | "standalone">("crm_lead");
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [linkCustomerName, setLinkCustomerName] = useState("");
  const [linkCustomerPhone, setLinkCustomerPhone] = useState("");
  const [linkAmount, setLinkAmount] = useState("");
  const [linkPurpose, setLinkPurpose] = useState("");
  const [linkExpiryMinutes, setLinkExpiryMinutes] = useState<number>(30);

  // Gateway Settings State
  const [upiSettings, setUpiSettings] = useState<{
    enabled: boolean;
    upiId: string | null;
    payeeName: string | null;
    instructions: string | null;
    qrBrandName: string | null;
    qrAccentColor: string;
  }>({
    enabled: false,
    upiId: null,
    payeeName: null,
    instructions: null,
    qrBrandName: null,
    qrAccentColor: "#f4612a",
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Search & Lead Selection Helpers
  const filteredLeads = useMemo(() => {
    const q = leadSearchQuery.trim().toLowerCase();
    if (!q) {
      return scopedLeads.slice(0, 8);
    }
    return scopedLeads.filter((l) => {
      const name = (l.name || "").toLowerCase();
      const comp = (l.company || "").toLowerCase();
      const phone = (l.phone || "");
      return name.includes(q) || comp.includes(q) || phone.includes(q);
    }).slice(0, 12);
  }, [scopedLeads, leadSearchQuery]);

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return scopedLeads.find((l) => l.id === selectedLeadId) || state.leads.find((l) => l.id === selectedLeadId) || null;
  }, [selectedLeadId, scopedLeads, state.leads]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelectLead = (lead: (typeof scopedLeads)[0]) => {
    setSelectedLeadId(lead.id);
    setLinkCustomerName(lead.name || "");
    setLinkCustomerPhone(lead.phone || "");
    if (lead.value) setLinkAmount(String(lead.value));
    if (!linkPurpose) {
      setLinkPurpose(`Payment for ${lead.company || lead.name}`);
    }
    setIsSearchOpen(false);
  };

  const handleClearSelectedLead = () => {
    setSelectedLeadId("");
    setLinkCustomerName("");
    setLinkCustomerPhone("");
    setLinkAmount("");
    setLeadSearchQuery("");
  };

  const handleSwitchStandalone = () => {
    setCustomerMode("standalone");
    setSelectedLeadId("");
    setLeadSearchQuery("");
  };

  const handleSwitchCrmLead = () => {
    setCustomerMode("crm_lead");
  };

  const openCreateModal = (preselectedLeadId?: string) => {
    if (preselectedLeadId) {
      setCustomerMode("crm_lead");
      setSelectedLeadId(preselectedLeadId);
      const matched = scopedLeads.find((l) => l.id === preselectedLeadId);
      if (matched) {
        setLinkCustomerName(matched.name || "");
        setLinkCustomerPhone(matched.phone || "");
        setLinkAmount(matched.value ? String(matched.value) : "");
        setLinkPurpose(`Payment for ${matched.company || matched.name}`);
      }
    } else {
      setCustomerMode("crm_lead");
      setSelectedLeadId("");
      setLeadSearchQuery("");
      setLinkCustomerName("");
      setLinkCustomerPhone("");
      setLinkAmount("");
      setLinkPurpose("");
    }
    setIsCreateOpen(true);
  };

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const res = await aicloserApi.payments.list({ limit: 100 });
      const rawList = res?.payments || [];
      const mapped: PaymentTransaction[] = rawList.map((p: any) => {
        const rawStatus = String(p.status || "").toUpperCase();
        const isExp = p.isExpired || rawStatus === "EXPIRED" || (rawStatus === "PENDING" && p.expiresAt && new Date() > new Date(p.expiresAt));
        let normalizedStatus: PaymentTransaction["status"] = "pending";
        if (rawStatus === "PAID" || rawStatus === "SETTLED") {
          normalizedStatus = "settled";
        } else if (rawStatus === "CUSTOMER_CONFIRMED" || rawStatus === "PROOF_UPLOADED") {
          normalizedStatus = "proof_uploaded";
        } else if (rawStatus === "CANCELLED") {
          normalizedStatus = "cancelled";
        } else if (rawStatus === "REJECTED") {
          normalizedStatus = "rejected";
        } else if (isExp) {
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
          expiresAt: p.expiresAt,
          isExpired: isExp,
          remainingSeconds: p.remainingSeconds,
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
      setUpiSettings({
        enabled: Boolean(data?.enabled),
        upiId: data?.upiId ?? null,
        payeeName: data?.payeeName ?? null,
        instructions: data?.instructions ?? null,
        qrBrandName: data?.qrBrandName ?? null,
        qrAccentColor: data?.qrAccentColor || "#f4612a",
      });
      setSettingsError(null);
    } catch (err: any) {
      setSettingsError(
        err?.status === 403
          ? "Only a workspace admin can view gateway settings."
          : "Could not load gateway settings.",
      );
    } finally {
      setSettingsLoaded(true);
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
          leadId: (customerMode === "crm_lead" && selectedLeadId) ? selectedLeadId : undefined,
          expiryMinutes: linkExpiryMinutes || 30,
        });

        setIsCreateOpen(false);
        setBanner(`Dynamic UPI payment link generated for ₹${amountNum.toLocaleString("en-IN")}`);
        setTimeout(() => setBanner(null), 4000);
        await loadPayments();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aicloser:payment-updated"));
        }
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

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeRemaining = (expiresAtStr?: string) => {
    if (!expiresAtStr) return null;
    const diff = Math.floor((new Date(expiresAtStr).getTime() - Date.now()) / 1000);
    if (diff <= 0) return "Expired";
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m left`;
    return `${mins}m left`;
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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aicloser:payment-updated"));
        }
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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aicloser:payment-updated"));
        }
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

        // Auto-advance lead to Won and synchronize exact payment value in CRM store if matched
        if (tx.leadId) {
          updateLead(tx.leadId, { stage: "won", value: tx.amount });
        } else {
          const matchedLead = state.leads.find((l) => l.code === tx.leadCode || l.name === tx.customerName);
          if (matchedLead) {
            updateLead(matchedLead.id, { stage: "won", value: tx.amount });
          }
        }

        setSelectedProofTx(null);
        setBanner(`Payment of ₹${tx.amount.toLocaleString("en-IN")} verified! Deal automatically advanced to Closed Won.`);
        setTimeout(() => setBanner(null), 4500);
        await loadPayments();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aicloser:payment-updated"));
        }
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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aicloser:payment-updated"));
        }
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
          <button className="btn" data-variant="primary" onClick={() => openCreateModal()}>
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
        {isAdmin && (
          <button
            className="seg-item"
            data-on={tab === "settings"}
            onClick={() => setTab("settings")}
          >
            <Icon name="settings" size={13} /> UPI & QR Gateway Config
          </button>
        )}
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
                          onClick={() => openCreateModal()}
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
                          {tx.productName &&
                          !tx.productName.toLowerCase().includes("auto-created") &&
                          !tx.productName.toLowerCase().includes("enrich this contact") && (
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
                            <span className="chip" data-tone="danger" title={tx.expiresAt ? `Expired at ${new Date(tx.expiresAt).toLocaleTimeString()}` : "Expired"}>
                              <Icon name="clock" size={10} /> Expired
                            </span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-start" }}>
                              <span className="chip" data-tone="accent">
                                <span className="dot" style={{ background: "var(--accent)" }} /> Pending Payment
                              </span>
                              {tx.expiresAt && (
                                <span className="chip" data-tone="neutral" style={{ fontSize: "10px", padding: "1px 6px" }}>
                                  <Icon name="clock" size={9} /> {formatTimeRemaining(tx.expiresAt)}
                                </span>
                              )}
                            </div>
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
      {tab === "settings" && isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {settingsError ? (
            <div className="card">
              <div className="card-body" style={{ color: "var(--text-secondary)" }}>{settingsError}</div>
            </div>
          ) : settingsLoaded && !upiSettings.upiId ? (
            <div className="card">
              <div className="card-body">
                <strong>Gateway not configured.</strong>{" "}
                No UPI VPA has been saved for this workspace. Payment links stay in draft until one is set.
              </div>
            </div>
          ) : null}

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

                <button className="btn" data-variant="primary" type="submit" disabled={isSavingSettings || !isAdmin || !upiSettings.upiId}>
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
                  {upiSettings.upiId ? (
                    <div style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--accent)", wordBreak: "break-all" }}>
                      upi://pay?pa={upiSettings.upiId}&amp;pn={encodeURIComponent(upiSettings.payeeName || "")}&amp;cu=INR
                    </div>
                  ) : (
                    <span style={{ color: "var(--text-tertiary)", fontSize: "12px" }}>Not configured</span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                  <div>✓ <b>Zero PG Cut:</b> 100% direct bank-to-bank settlement via UPI.</div>
                  <div>✓ <b>Universal App Support:</b> PhonePe, Google Pay, Paytm, BHIM, CRED, Amazon Pay.</div>
                  <div>✓ <b>Automated Attribution:</b> Lead ID and publicToken tracked securely on customer upload.</div>
                </div>
              </div>
            </section>
          </div>
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
                {/* Customer Type Selector: Scoped CRM Lead vs Standalone */}
                <div className="seg" role="tablist" style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={customerMode === "crm_lead"}
                    data-on={customerMode === "crm_lead"}
                    onClick={handleSwitchCrmLead}
                  >
                    <Icon name="search" size={13} /> Search CRM Lead
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={customerMode === "standalone"}
                    data-on={customerMode === "standalone"}
                    onClick={handleSwitchStandalone}
                  >
                    <Icon name="user-plus" size={13} /> Standalone / New Customer
                  </button>
                </div>

                {/* CRM Lead Mode: Search bar with instant customer lookup */}
                {customerMode === "crm_lead" && (
                  <div className="field" ref={searchDropdownRef} style={{ position: "relative" }}>
                    <label>Select Customer from Your Leads ({scopedLeads.length} available in scope)</label>
                    {selectedLead ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "var(--bg-soft)",
                          border: "1px solid var(--accent)",
                          borderRadius: "var(--r-sm, 6px)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span className="chip" data-tone="accent" style={{ fontSize: "11px", padding: "1px 6px" }}>
                            Linked Lead
                          </span>
                          <strong style={{ fontSize: "var(--fs-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {selectedLead.name}
                          </strong>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                            ({selectedLead.phone || selectedLead.company})
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn"
                          data-size="sm"
                          data-variant="ghost"
                          onClick={handleClearSelectedLead}
                          style={{ padding: "2px 8px", fontSize: "11px" }}
                        >
                          ✕ Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            className="input"
                            value={leadSearchQuery}
                            onChange={(e) => {
                              setLeadSearchQuery(e.target.value);
                              setIsSearchOpen(true);
                            }}
                            onFocus={() => setIsSearchOpen(true)}
                            placeholder="Type customer name, company, or phone to search..."
                            style={{ paddingRight: "32px" }}
                          />
                          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}>
                            <Icon name="search" size={14} />
                          </span>
                        </div>

                        {/* Search Results Dropdown */}
                        {isSearchOpen && (
                          <div
                            className="card"
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: 4,
                              maxHeight: "220px",
                              overflowY: "auto",
                              zIndex: 100,
                              boxShadow: "var(--shadow-lg)",
                              border: "1px solid var(--border-strong)",
                              background: "var(--bg-surface)",
                              padding: "4px",
                            }}
                          >
                            {filteredLeads.length === 0 ? (
                              <div style={{ padding: "12px", textAlign: "center", fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                                No matching customers found in your scope.
                                <div style={{ marginTop: 6 }}>
                                  <button
                                    type="button"
                                    className="btn"
                                    data-size="sm"
                                    data-variant="ghost"
                                    onClick={handleSwitchStandalone}
                                  >
                                    Switch to Standalone Customer
                                  </button>
                                </div>
                              </div>
                            ) : (
                              filteredLeads.map((l) => (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => handleSelectLead(l)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    width: "100%",
                                    padding: "8px 10px",
                                    border: "none",
                                    background: "transparent",
                                    borderRadius: "var(--r-sm, 4px)",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    color: "var(--text)",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-soft)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>{l.name}</div>
                                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                      {l.phone} {l.company ? `· ${l.company}` : ""}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <span style={{ fontWeight: 600, color: "var(--accent)", fontSize: "12px" }}>
                                      ₹{l.value?.toLocaleString("en-IN") || 0}
                                    </span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Standalone Notice */}
                {customerMode === "standalone" && (
                  <div className="card" style={{ padding: "8px 12px", background: "var(--bg-soft)", fontSize: "12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="chip" data-tone="neutral">Standalone Mode</span>
                    <span>Creating direct payment link for an ad-hoc or walk-in client without CRM lead binding.</span>
                  </div>
                )}

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
                    placeholder="Enter amount (₹)"
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

                <div className="field">
                  <label>Link Expiry Duration</label>
                  <div className="seg" role="tablist" style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={linkExpiryMinutes === 15}
                      data-on={linkExpiryMinutes === 15}
                      onClick={() => setLinkExpiryMinutes(15)}
                      style={{ fontSize: "11px", padding: "4px 0" }}
                    >
                      15m
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={linkExpiryMinutes === 30}
                      data-on={linkExpiryMinutes === 30}
                      onClick={() => setLinkExpiryMinutes(30)}
                      style={{ fontSize: "11px", padding: "4px 0" }}
                    >
                      30m
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={linkExpiryMinutes === 60}
                      data-on={linkExpiryMinutes === 60}
                      onClick={() => setLinkExpiryMinutes(60)}
                      style={{ fontSize: "11px", padding: "4px 0" }}
                    >
                      1h
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={linkExpiryMinutes === 1440}
                      data-on={linkExpiryMinutes === 1440}
                      onClick={() => setLinkExpiryMinutes(1440)}
                      style={{ fontSize: "11px", padding: "4px 0" }}
                    >
                      24h
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={linkExpiryMinutes === 4320}
                      data-on={linkExpiryMinutes === 4320}
                      onClick={() => setLinkExpiryMinutes(4320)}
                      style={{ fontSize: "11px", padding: "4px 0" }}
                    >
                      3d
                    </button>
                  </div>
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
                    placeholder="Enter revised amount (₹)"
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

              {selectedProofTx.hasProof ? (
                <div className="proof-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/v1/payments/${selectedProofTx.id}/proof`}
                    alt={`Payment receipt for ${selectedProofTx.customerName}`}
                    className="proof-img"
                    onClick={() => setEnlargedProofUrl(`/api/v1/payments/${selectedProofTx.id}/proof`)}
                    title="Click to enlarge screenshot"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = "none";
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <div className="proof-fallback" style={{ display: "none" }}>
                    <Icon name="card" size={28} />
                    <span>UPI Transfer Proof on Record</span>
                    <span className="cell-muted">Ref #{selectedProofTx.utr || selectedProofTx.id.slice(-8)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    data-variant="outline"
                    data-size="sm"
                    onClick={() => setEnlargedProofUrl(`/api/v1/payments/${selectedProofTx.id}/proof`)}
                  >
                    <Icon name="maximize" size={13} /> Enlarge Screenshot
                  </button>
                </div>
              ) : (
                <div className="proof-fallback">
                  <Icon name="card" size={28} />
                  <span>
                    {selectedProofTx.utr ? `UTR: ${selectedProofTx.utr}` : "No Screenshot Attached"}
                  </span>
                  <span className="cell-muted">Ref #{selectedProofTx.utr || selectedProofTx.id.slice(-8)}</span>
                </div>
              )}
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

      {/* MODAL 4: Full-Screen Screenshot Lightbox Modal (ITEM-54) */}
      {enlargedProofUrl && (
        <div className="overlay" data-kind="dialog" onClick={() => setEnlargedProofUrl(null)} role="presentation">
          <div className="dialog lightbox-dialog" role="dialog" aria-modal="true" aria-labelledby="lightbox-title" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <h2 id="lightbox-title" className="card-title">Full Resolution Screenshot Proof</h2>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close screenshot preview"
                onClick={() => setEnlargedProofUrl(null)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="lightbox-body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enlargedProofUrl} alt="Full resolution payment receipt" className="lightbox-img" />
            </div>
            <div className="dialog-foot">
              <button type="button" className="btn" data-variant="primary" onClick={() => setEnlargedProofUrl(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
