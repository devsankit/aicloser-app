"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { aicloserApi } from "@/lib/api-client";
import { isScannedWhatsAppLead } from "@/lib/lead-mapper";
import { Icon } from "@/components/ui/Icon";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { compactMoney, isOverdue, LIMITS, money, relativeTime, slaLabel, useApp, useScopedLeads } from "@/lib/store";
import {
  isOpenStage,
  normalizeSource,
  PRIORITY_ICON,
  PRIORITY_LABEL,
  SOURCES,
  STAGES,
  sourceMeta,
  type Lead,
  type LeadPoolItem,
  type Priority,
  type Source,
  type StageId,
} from "@/lib/types";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { LeadDrawer } from "./LeadDrawer";
import { AddLeadDialog } from "./AddLeadDialog";

type SortKey = "recent" | "value" | "priority";

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function PipelineView() {
  const { state, moveLead, updateLead, setLayout, claimLead, claimFromPool, fetchPoolLeads, autoDistributePool, refreshLeads } = useApp();
  const scoped = useScopedLeads();
  const [viewMode, setViewMode] = useState<"board" | "pool" | "recycle">("board");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const urlQ = sp.get("search") || sp.get("q");
      if (urlQ) setQuery(urlQ);
      const tab = sp.get("tab");
      if (tab === "recycle") setViewMode("recycle");
      else if (tab === "pool") setViewMode("pool");
    }
  }, []);
  const [source, setSource] = useState<Source | "">("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [fit, setFit] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<StageId | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [addStage, setAddStage] = useState<StageId | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Missed Leads & Break Mode State
  const [missedLeads, setMissedLeads] = useState<any[]>([]);
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [apiMissedCount, setApiMissedCount] = useState<number | null>(null);

  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakExpiresAt, setBreakExpiresAt] = useState<string | null>(null);
  const [breakLoading, setBreakLoading] = useState(false);
  const [breakCountdown, setBreakCountdown] = useState<string>("00:00");
  const [breakRemainingSec, setBreakRemainingSec] = useState<number>(1800);

  const fetchMissedAndBreak = async () => {
    try {
      const [missedRes, breakRes] = await Promise.all([
        aicloserApi.leads.getMissed().catch(() => null),
        aicloserApi.team.getBreakStatus().catch(() => null),
      ]);
      if (missedRes) {
        setMissedLeads(Array.isArray(missedRes.items) ? missedRes.items : []);
        setApiMissedCount(typeof missedRes.myMissed === 'number' ? missedRes.myMissed : (missedRes.totalMissed || 0));
      }
      if (breakRes) {
        setIsOnBreak(Boolean(breakRes.isOnBreak));
        setBreakExpiresAt(breakRes.breakExpiresAt || null);
        if (typeof breakRes.remainingSeconds === "number") {
          setBreakRemainingSec(breakRes.remainingSeconds);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchMissedAndBreak();
    const interval = setInterval(fetchMissedAndBreak, 15000);
    return () => clearInterval(interval);
  }, []);

  // Cross-component synchronizer for break state changes
  useEffect(() => {
    const handleBreakSync = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      if (typeof detail.isOnBreak === "boolean") {
        setIsOnBreak(detail.isOnBreak);
      }
      if (typeof detail.remainingSeconds === "number") {
        setBreakRemainingSec(detail.remainingSeconds);
      }
      if (detail.isOnBreak && detail.expiresAt) {
        setBreakExpiresAt(new Date(detail.expiresAt).toISOString());
      } else if (detail.isOnBreak === false) {
        setBreakExpiresAt(null);
      }
    };
    window.addEventListener("aicloser:break-updated", handleBreakSync);
    return () => window.removeEventListener("aicloser:break-updated", handleBreakSync);
  }, []);

  useEffect(() => {
    if (!isOnBreak || !breakExpiresAt) {
      setBreakCountdown("00:00");
      return;
    }
    const updateCd = () => {
      const remainingMs = new Date(breakExpiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setIsOnBreak(false);
        setBreakCountdown("00:00");
      } else {
        const m = Math.floor(remainingMs / 60000);
        const s = Math.floor((remainingMs % 60000) / 1000);
        setBreakCountdown(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      }
    };
    updateCd();
    const t = setInterval(updateCd, 1000);
    return () => clearInterval(t);
  }, [isOnBreak, breakExpiresAt]);

  const handleTakeBreak = async () => {
    if (breakLoading) return;
    setBreakLoading(true);
    try {
      const res: any = await aicloserApi.team.startBreak();
      const payload = res?.data || res;
      if (payload?.success || payload?.isOnBreak) {
        setIsOnBreak(true);
        const rem = typeof payload?.remainingSeconds === "number" ? payload.remainingSeconds : (breakRemainingSec || 1800);
        setBreakRemainingSec(rem);
        const expMs = Date.now() + rem * 1000;
        setBreakExpiresAt(new Date(expMs).toISOString());
        localStorage.setItem("aicloser_on_break", "true");
        localStorage.setItem("aicloser_break_expires", String(expMs));
        window.dispatchEvent(new CustomEvent("aicloser:break-updated", {
          detail: { isOnBreak: true, remainingSeconds: rem, expiresAt: expMs }
        }));
      } else if (payload?.error === "DailyBreakLimitExceeded") {
        setClaimFeedback({
          status: "quota_limit",
          message: payload.message || "Daily break limit reached for today.",
        });
        setTimeout(() => setClaimFeedback(null), 4000);
      }
    } catch (err: any) {
      setClaimFeedback({
        status: "already_claimed",
        message: err?.message || "Failed to start break mode. Please retry.",
      });
      setTimeout(() => setClaimFeedback(null), 4000);
    } finally {
      setBreakLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (breakLoading) return;
    setBreakLoading(true);
    try {
      const res: any = await aicloserApi.team.endBreak();
      const payload = res?.data || res;
      setIsOnBreak(false);
      setBreakExpiresAt(null);
      localStorage.removeItem("aicloser_on_break");
      localStorage.removeItem("aicloser_break_expires");
      const rem = typeof payload?.remainingSeconds === "number" ? payload.remainingSeconds : breakRemainingSec;
      setBreakRemainingSec(rem);
      window.dispatchEvent(new CustomEvent("aicloser:break-updated", {
        detail: { isOnBreak: false, remainingSeconds: rem }
      }));
    } catch (err: any) {
      setClaimFeedback({
        status: "already_claimed",
        message: err?.message || "Failed to end break mode. Please retry.",
      });
      setTimeout(() => setClaimFeedback(null), 4000);
    } finally {
      setBreakLoading(false);
    }
  };

  // Lead Grab Pool State
  const [poolQuery, setPoolQuery] = useState("");
  const [poolSource, setPoolSource] = useState<string>("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [disappearedIds, setDisappearedIds] = useState<Set<string>>(new Set());
  const [claimFeedback, setClaimFeedback] = useState<{ id?: string; status: "success" | "already_claimed" | "quota_limit"; message: string } | null>(null);

  // Recycle Bin State
  const [recycleLeads, setRecycleLeads] = useState<Lead[]>([]);
  const [loadingRecycle, setLoadingRecycle] = useState(false);
  const [recycleActionId, setRecycleActionId] = useState<string | null>(null);
  const [confirmPermanentDeleteId, setConfirmPermanentDeleteId] = useState<string | null>(null);
  const [recycleFeedback, setRecycleFeedback] = useState<string | null>(null);

  const userRole = state.user?.role || "ADMIN";
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "MANAGER";
  const closerName = state.user?.displayName || "Closer";

  const [poolCapacity, setPoolCapacity] = useState<number>(25);

  useEffect(() => {
    aicloserApi.roundRobin
      .get()
      .then((res: any) => {
        const cap = res?.settings?.maxActiveLeadsPerCloser || res?.settings?.leadCapacity;
        if (typeof cap === "number" && cap > 0) {
          setPoolCapacity(cap);
        }
      })
      .catch(() => {});
  }, []);

  const initialStage = STAGES[0];
  const initialStageId = initialStage?.id || "new";

  const isMyLead = useCallback(
    (l: Lead) => {
      if (isAdmin) return true;
      if (l.owner && closerName && l.owner.trim().toLowerCase() === closerName.trim().toLowerCase()) return true;
      if (
        l.assignedAgentId &&
        (l.assignedAgentId === (state.user as any)?.agentProfileId || l.assignedAgentId === state.user?.id)
      ) {
        return true;
      }
      return false;
    },
    [isAdmin, closerName, state.user]
  );

  // Local calculation as fallback if backend quota is not yet loaded
  const localInitialStageCount = useMemo(() => {
    return state.leads.filter((l) => isMyLead(l) && l.stage === initialStageId).length;
  }, [state.leads, isMyLead, initialStageId]);

  // Single Source of Truth from backend
  const backendQuota = state.poolQuota;
  const initialStageCount =
    !isAdmin && backendQuota && typeof backendQuota.initialStageCount === "number"
      ? backendQuota.initialStageCount
      : localInitialStageCount;

  const myCap =
    backendQuota && typeof backendQuota.grabCapacity === "number"
      ? backendQuota.grabCapacity
      : (state.user as any)?.maxActiveLeads || poolCapacity || 25;

  const isAtQuota =
    !isAdmin &&
    (backendQuota && typeof backendQuota.isAtQuota === "boolean"
      ? backendQuota.isAtQuota
      : initialStageCount >= myCap);

  const availableSlots =
    backendQuota && typeof backendQuota.availableSlots === "number"
      ? backendQuota.availableSlots
      : Math.max(0, myCap - initialStageCount);

  const initialStageLabel =
    backendQuota?.initialStageLabel || initialStage?.label || "New Leads";
  const [isDistributing, setIsDistributing] = useState(false);
  const [poolLimit, setPoolLimit] = useState<number>(10);
  const [activeClosers, setActiveClosers] = useState<Array<{ id: string; name: string; role?: string }>>([]);

  useEffect(() => {
    aicloserApi.team.listMembers().then((members: any) => {
      if (Array.isArray(members) && members.length > 0) {
        const closers = members
          .filter((m: any) => m.status === "ACTIVE" || !m.status)
          .map((m: any) => ({
            id: m.id || m.userId,
            name: m.displayName || m.user?.displayName || m.name || m.email || "Closer",
            role: m.role || m.user?.role,
          }));
        setActiveClosers(closers);
      }
    }).catch(() => {});
  }, []);

  const handlePoolLimitChange = async (limit: number) => {
    setPoolLimit(limit);
    await fetchPoolLeads({ maxVisibleToCloser: limit });
  };

  // Dynamically resolve actual closers from assigned leads and authenticated workspace team
  const availableClosers = useMemo(() => {
    const list = new Set<string>();
    state.leads.forEach((l) => {
      if (l.owner && l.owner.trim() && l.owner !== "Admin" && l.owner !== "System" && l.owner !== "Unassigned") {
        list.add(l.owner);
      }
    });
    if (state.user?.displayName && state.user.displayName !== "Admin" && state.user.displayName !== "System") {
      list.add(state.user.displayName);
    }
    return Array.from(list);
  }, [state.leads, state.user]);

  const handleAssignLead = async (item: LeadPoolItem, targetCloser: string, assignedAgentId?: string) => {
    if (claimingId || !targetCloser) return;
    setClaimingId(item.id);
    try {
      const cleanCloser = targetCloser.split(" (")[0];
      const res = await claimFromPool(item.id, cleanCloser, assignedAgentId);
      setClaimingId(null);
      if (res.success) {
        setDisappearedIds((prev) => new Set(prev).add(item.id));
        setClaimFeedback({
          id: item.id,
          status: "success",
          message: `Lead "${item.customerName || "Customer"}" assigned to ${cleanCloser}. Added to New Leads.`,
        });
        setTimeout(() => setClaimFeedback(null), 4000);
      } else {
        setClaimFeedback({
          id: item.id,
          status: "already_claimed",
          message: res.message || "Failed to assign lead.",
        });
        setTimeout(() => setClaimFeedback(null), 4000);
      }
    } catch {
      setClaimingId(null);
    }
  };

  const handleAutoDistributeAll = async () => {
    if (isDistributing || openPoolList.length === 0) return;
    setIsDistributing(true);
    try {
      const res = await autoDistributePool();
      setIsDistributing(false);
      const count = res?.count ?? res?.assignments?.length ?? openPoolList.length;
      setClaimFeedback({
        status: "success",
        message: `Successfully auto-distributed ${count} lead${count === 1 ? "" : "s"} across active closers via Round-Robin.`,
      });
      setTimeout(() => setClaimFeedback(null), 5000);
    } catch (e: any) {
      setIsDistributing(false);
      setClaimFeedback({
        status: "already_claimed",
        message: e?.message || "Auto-distribution failed. Check that closers are active.",
      });
      setTimeout(() => setClaimFeedback(null), 5000);
    }
  };

  // Multi-select for unassigned pool cards
  const [selectedPoolIds, setSelectedPoolIds] = useState<Set<string>>(new Set());
  const [isBulkAssigningPool, setIsBulkAssigningPool] = useState(false);

  const handleBulkAssignPool = async (targetCloser: string, assignedAgentId?: string) => {
    if (!targetCloser || selectedPoolIds.size === 0 || isBulkAssigningPool) return;
    setIsBulkAssigningPool(true);
    const poolIds = Array.from(selectedPoolIds);
    const cleanCloser = targetCloser.split(" (")[0];

    try {
      if (assignedAgentId) {
        const res = await aicloserApi.leads.bulkClaimFromPool(poolIds, assignedAgentId);
        if (res && (res as any).success) {
          poolIds.forEach((id) => setDisappearedIds((prev) => new Set(prev).add(id)));
          setSelectedPoolIds(new Set());
          setIsBulkAssigningPool(false);
          setClaimFeedback({
            status: "success",
            message: `Successfully assigned ${res.count || poolIds.length} unassigned leads to ${cleanCloser}. Added to New Leads.`,
          });
          setTimeout(() => setClaimFeedback(null), 5000);
          void refreshLeads();
          return;
        }
      }
    } catch (bulkErr) {
      console.warn("Direct bulkClaimFromPool failed, running sequential fallback:", bulkErr);
    }

    let successCount = 0;
    for (const id of poolIds) {
      try {
        const res = await claimFromPool(id, cleanCloser, assignedAgentId);
        if (res.success) {
          successCount++;
          setDisappearedIds((prev) => new Set(prev).add(id));
        }
      } catch (err) {
        console.warn("Failed to claim pool lead:", id, err);
      }
    }

    setSelectedPoolIds(new Set());
    setIsBulkAssigningPool(false);

    if (successCount > 0) {
      setClaimFeedback({
        status: "success",
        message: `Successfully assigned ${successCount} unassigned lead${successCount === 1 ? "" : "s"} to ${cleanCloser}. Added to New Leads.`,
      });
      setTimeout(() => setClaimFeedback(null), 5000);
      void refreshLeads();
    } else {
      setClaimFeedback({
        status: "already_claimed",
        message: "Failed to assign selected leads. They may have already been claimed or removed.",
      });
      setTimeout(() => setClaimFeedback(null), 4000);
    }
  };

  const loadRecycleBin = async () => {
    setLoadingRecycle(true);
    try {
      const res = await aicloserApi.leads.getRecycleBin();
      const mapped = (res || []).map((l: any) => {
        const prev = l.customFields?.previousStage || l.previousStage || l.stage;
        const normStage = normalizeStageId(prev || "new");
        if (l.code && l.name) {
          return { ...l, stage: normStage } as Lead;
        }
        return {
          id: l.id,
          code: l.leadCode || l.code || `CLO-${l.id.slice(-4)}`,
          name: l.customerName || l.name || "Unknown Lead",
          phone: l.customerPhone || l.phone || "",
          email: l.customerEmail || l.email || "",
          company: l.serviceInterest || l.company || "",
          stage: normStage,
          value: Number(l.budgetAmount || l.value || 0),
          owner: l.assignedAgent?.user?.displayName || l.owner || "Unassigned",
          source: normalizeSource(l.source),
          segment: "SMB",
          priority: "medium",
          followUp: null,
          notes: l.notes || "",
          tags: Array.isArray(l.tags) ? l.tags : [],
          updatedAt: l.updatedAt || new Date().toISOString(),
        } as Lead;
      });
      setRecycleLeads(mapped);
    } catch {
      setRecycleLeads([]);
    } finally {
      setLoadingRecycle(false);
    }
  };

  useEffect(() => {
    if (viewMode === "recycle") {
      void loadRecycleBin();
    }
  }, [viewMode]);

  const handleRestore = async (leadId: string) => {
    setRecycleActionId(leadId);
    try {
      await aicloserApi.leads.restore(leadId);
      setRecycleLeads((prev) => prev.filter((l) => l.id !== leadId));
      setRecycleFeedback("Lead restored to original stage successfully.");
      setTimeout(() => setRecycleFeedback(null), 3000);
      await refreshLeads();
    } catch (e: any) {
      setRecycleFeedback("Failed to restore lead: " + (e.message || String(e)));
      setTimeout(() => setRecycleFeedback(null), 3500);
    } finally {
      setRecycleActionId(null);
    }
  };

  const handlePermanentDelete = async (leadId: string) => {
    setRecycleActionId(leadId);
    try {
      await aicloserApi.leads.permanentDelete(leadId);
      setRecycleLeads((prev) => prev.filter((l) => l.id !== leadId));
      setConfirmPermanentDeleteId(null);
      setRecycleFeedback("Lead permanently deleted.");
      setTimeout(() => setRecycleFeedback(null), 3000);
    } catch (e: any) {
      setRecycleFeedback("Failed to permanently delete: " + (e.message || String(e)));
      setTimeout(() => setRecycleFeedback(null), 3500);
    } finally {
      setRecycleActionId(null);
    }
  };

  const handleExportXlsx = () => {
    const listToExport = filtered.length > 0 ? filtered : scoped;
    if (!listToExport.length) return;
    const data = listToExport.map((l) => ({
      "Lead Code": l.code || "",
      "Name": l.name || "",
      "Company": l.company || "",
      "Phone": l.phone || "",
      "Email": l.email || "",
      "Stage": l.stage || "",
      "Deal Value (INR)": l.value || 0,
      "Payment Status": (l as any).paymentStatus || "",
      "Assigned Closer": l.owner || "Unassigned",
      "Source Channel": l.source || "",
      "Priority": l.priority || "",
      "Next Callback": l.followUp || "",
      "Notes": l.notes || "",
      "Tags": (l.tags || []).join(", "),
      "Last Updated": l.updatedAt || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `aicloser-pipeline-leads-${dateStr}.xlsx`);
  };

  const openPoolList = useMemo(() => {
    const q = poolQuery.trim().toLowerCase();
    return (state.poolLeads || []).filter((p) => {
      if (disappearedIds.has(p.id)) return false;
      if (p.status !== "OPEN") return false;
      if (poolSource) {
        const pSrc = (p.source || "").toLowerCase();
        const targetSrc = poolSource.toLowerCase();
        const normSrc = normalizeSource(p.source).toLowerCase();
        if (pSrc !== targetSrc && normSrc !== targetSrc) return false;
      }
      if (!q) return true;
      return (
        (p.customerName || "").toLowerCase().includes(q) ||
        (p.customerPhone || "").includes(q) ||
        (p.customerEmail || "").toLowerCase().includes(q) ||
        (p.serviceInterest || "").toLowerCase().includes(q)
      );
    });
  }, [state.poolLeads, disappearedIds, poolQuery, poolSource]);

  // 1-second interval timer for Grab Pool 10-minute SLA countdown
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getRemainingSeconds = (createdAtStr?: string) => {
    if (!createdAtStr) return 600;
    const created = new Date(createdAtStr).getTime();
    if (isNaN(created)) return 600;
    const elapsed = Math.floor((now - created) / 1000);
    const remaining = 600 - elapsed;
    return Math.max(0, remaining);
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const missedCount = useMemo(() => {
    if (apiMissedCount !== null) return apiMissedCount;
    return missedLeads.length;
  }, [apiMissedCount, missedLeads]);

  const handleClaimLead = async (item: LeadPoolItem) => {
    if (claimingId || isAtQuota) return;
    setClaimingId(item.id);
    try {
      const res = await claimFromPool(item.id, closerName);
      setClaimingId(null);
      if (res.success) {
        setDisappearedIds((prev) => new Set(prev).add(item.id));
        setClaimFeedback({
          id: item.id,
          status: "success",
          message: `Lead "${item.customerName || "Customer"}" claimed. Added to your ${initialStageLabel} column.`,
        });
        setTimeout(() => setClaimFeedback(null), 4000);
      } else {
        const msg = res.message || "Lead is no longer available.";
        const isQuota = msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("cap");
        if (!isQuota) {
          setDisappearedIds((prev) => new Set(prev).add(item.id));
        }
        setClaimFeedback({
          id: item.id,
          status: isQuota ? "quota_limit" : "already_claimed",
          message: isQuota
            ? ` Quota Limit: You already hold ${initialStageCount}/${myCap} leads in ${initialStageLabel}. Advance existing leads before grabbing more.`
            : `Lead was just grabbed by another closer!`,
        });
        setTimeout(() => setClaimFeedback(null), 4500);
      }
    } catch {
      setClaimingId(null);
      setDisappearedIds((prev) => new Set(prev).add(item.id));
      setClaimFeedback({
        id: item.id,
        status: "already_claimed",
        message: "Lead is no longer available or was grabbed by another closer.",
      });
      setTimeout(() => setClaimFeedback(null), 4500);
    }
  };

  const boardLeads = scoped;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const rows = boardLeads.filter((l) => {
      if (source) {
        const leadSrc = normalizeSource(l.source);
        if (leadSrc !== source && l.source !== source) return false;
      }
      if (!q) return true;
      const leadPhoneDigits = (l.phone || "").replace(/\D/g, "");
      const phoneMatches =
        l.phone.includes(q) ||
        (qDigits.length >= 4 && leadPhoneDigits.includes(qDigits));
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        phoneMatches ||
        l.email.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    return rows.sort((a, b) => {
      if (sort === "value") {
        const isPendingPayment = (l: Lead) => {
          const status = String((l as any).paymentStatus || "").toUpperCase();
          if (status === "PENDING" || status === "PAYMENT_PENDING") return true;
          if (l.tags?.some((t) => /payment|pending|pay-link/i.test(t))) return true;
          return false;
        };
        const aPending = isPendingPayment(a) ? 1 : 0;
        const bPending = isPendingPayment(b) ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return b.value - a.value || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      }
      if (sort === "priority") {
        const aHasCallback = Boolean(a.followUp && a.stage !== "won" && a.stage !== "lost");
        const bHasCallback = Boolean(b.followUp && b.stage !== "won" && b.stage !== "lost");
        const aCallbackScore = aHasCallback ? (isOverdue(a.followUp) ? 2 : 1) : 0;
        const bCallbackScore = bHasCallback ? (isOverdue(b.followUp) ? 2 : 1) : 0;
        if (aCallbackScore !== bCallbackScore) {
          return bCallbackScore - aCallbackScore;
        }
        const getPrioWeight = (p?: string): number => {
          const norm = String(p || "").toLowerCase();
          if (norm === "urgent") return 0;
          if (norm === "high") return 1;
          if (norm === "medium") return 2;
          if (norm === "low") return 3;
          return 4;
        };
        return (
          getPrioWeight(a.priority) - getPrioWeight(b.priority) ||
          b.value - a.value ||
          a.id.localeCompare(b.id)
        );
      }
      if (a.stage === b.stage) {
        const aPos = typeof a.kanbanPosition === "number" ? a.kanbanPosition : undefined;
        const bPos = typeof b.kanbanPosition === "number" ? b.kanbanPosition : undefined;
        if (aPos !== undefined && bPos !== undefined && aPos !== bPos) {
          return aPos - bPos;
        }
        if (aPos !== undefined && bPos === undefined) return -1;
        if (aPos === undefined && bPos !== undefined) return 1;
      }
      const bTime = new Date(b.updatedAt).getTime() || 0;
      const aTime = new Date(a.updatedAt).getTime() || 0;
      return bTime - aTime || a.id.localeCompare(b.id);
    });
  }, [boardLeads, query, source, sort]);

  const byStage = useMemo(() => {
    const map = new Map<StageId, Lead[]>();
    for (const stage of STAGES) map.set(stage.id, []);
    for (const lead of filtered) map.get(lead.stage)?.push(lead);
    return map;
  }, [filtered]);

  const active = state.leads.find((l) => l.id === selected) ?? null;
  const hasFilters = Boolean(query || source);

  const clearFilters = () => {
    setQuery("");
    setSource("");
  };

  /** Move the focused card to another stage, or walk the board with arrows. */
  const onCardKeyDown = (e: React.KeyboardEvent, lead: Lead, stageIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setSelected(lead.id);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (e.shiftKey) {
        // move the lead one stage over
        const next = STAGES[stageIndex + dir];
        if (next) {
          e.preventDefault();
          moveLead(lead.id, next.id);
          // Retain focus on moved card in target column
          requestAnimationFrame(() => {
            const card = boardRef.current?.querySelector<HTMLElement>(`[data-lead="${lead.id}"]`);
            card?.focus();
          });
        }
      } else {
        // move focus to the same row in the neighbouring column
        e.preventDefault();
        const columns = boardRef.current?.querySelectorAll<HTMLElement>(".col-cards");
        const target = columns?.[stageIndex + dir];
        const card = target?.querySelector<HTMLElement>(`[data-lead="${lead.id}"]`) ??
          target?.querySelector<HTMLElement>(".card.lead");
        card?.focus();
      }
    }
  };

  return (
    <div className="pipe">
      <header className="page-head pipe-head">
        <div>
          <div className="pipe-title-row">
            <h1 className="page-title">Pipeline</h1>
            <div className="seg" role="group" aria-label="Pipeline Views">
              <button
                data-on={viewMode === "board"}
                onClick={() => setViewMode("board")}
              >
                <Icon name="kanban" size={13} />
                <span>Kanban Board</span>
                <span className="chip">{filtered.length}</span>
              </button>
              <button
                data-on={viewMode === "pool"}
                onClick={() => {
                  setViewMode("pool");
                  fetchPoolLeads().catch(() => {});
                }}
              >
                <Icon name="zap" size={13} />
                <span>{isAdmin ? "Unassigned Pool" : "Lead Grab Pool"}</span>
                <span className="chip" data-tone="accent">
                  {state.poolQuota?.totalPoolCount ?? state.poolCount ?? openPoolList.length}
                </span>
              </button>
              {isAdmin && (
                <button
                  data-on={viewMode === "recycle"}
                  onClick={() => setViewMode("recycle")}
                >
                  <Icon name="trash" size={13} />
                  <span>Recycle Bin</span>
                  {recycleLeads.length > 0 && (
                    <span className="chip" data-tone="danger">{recycleLeads.length}</span>
                  )}
                </button>
              )}
            </div>
          </div>
          <p className="page-sub">
            {viewMode === "board"
              ? `${filtered.length} active leads across pipeline stages`
              : `Unassigned pool · ${state.poolQuota?.totalPoolCount ?? state.poolCount ?? openPoolList.length} leads waiting to be claimed or distributed`}
          </p>
        </div>
        <div className="page-actions">
          {viewMode === "board" ? (
            <>
              {(openPoolList.length > 0 || state.poolCount > 0) && (
                <button
                  className="btn"
                  data-variant="accent"
                  onClick={() => {
                    setViewMode("pool");
                    fetchPoolLeads().catch(() => {});
                  }}
                >
                  <Icon name="zap" size={14} /> {isAdmin ? "Unassigned Pool" : "Open Grab Pool"} ({state.poolQuota?.totalPoolCount ?? state.poolCount ?? openPoolList.length})
                </button>
              )}
              {isAdmin && (
                <button
                  className="btn"
                  onClick={handleExportXlsx}
                  title="Export leads to Excel spreadsheet (.xlsx)"
                >
                  <Icon name="download" size={14} /> Export .xlsx
                </button>
              )}
              <button className="btn" onClick={() => setFit((f) => !f)} aria-pressed={fit}>
                <Icon name="panel" size={14} /> {fit ? "Fixed columns" : "Fit board"}
              </button>
              <button className="btn" data-variant="primary" onClick={() => setAddStage("new")}>
                <Icon name="pencil" size={14} /> New lead
              </button>
            </>
          ) : viewMode === "recycle" ? (
            <>
              <button
                className="btn"
                onClick={loadRecycleBin}
                disabled={loadingRecycle}
              >
                <Icon name="refresh" size={14} className={loadingRecycle ? "spin" : ""} /> {loadingRecycle ? "Refreshing..." : "Refresh Recycle Bin"}
              </button>
              <button className="btn" data-variant="primary" onClick={() => setViewMode("board")}>
                <Icon name="kanban" size={14} /> View Kanban Board
              </button>
            </>
          ) : (
            <>
              {isAdmin && (
                <button
                  type="button"
                  className="btn"
                  data-variant="primary"
                  onClick={handleAutoDistributeAll}
                  disabled={isDistributing || openPoolList.length === 0}
                  title="Auto-distribute open pool leads across active closers via round robin"
                >
                  <Icon name={isDistributing ? "refresh" : "zap"} size={13} className={isDistributing ? "spin" : ""} />
                  {isDistributing ? "Distributing..." : "⚡ Auto-Distribute Round Robin"}
                </button>
              )}
              <button
                className="btn"
                onClick={() => fetchPoolLeads({ maxVisibleToCloser: poolLimit }).catch(() => {})}
                disabled={state.isPoolLoading}
              >
                <Icon name="refresh" size={14} /> {state.isPoolLoading ? "Refreshing..." : "Refresh Pool"}
              </button>
              <button className="btn" data-variant="primary" onClick={() => setViewMode("board")}>
                <Icon name="kanban" size={14} /> View Kanban Board
              </button>
            </>
          )}
        </div>
      </header>

      {viewMode === "pool" ? (
        <div className="pool-container">
          {/* Claim feedback banner */}
          {claimFeedback && (
            <div
              className="card pool-feedback"
              data-status={claimFeedback.status}
            >
              <Icon
                name={
                  claimFeedback.status === "success"
                    ? "check-circle"
                    : claimFeedback.status === "quota_limit"
                    ? "alert-circle"
                    : "x-circle"
                }
                size={18}
              />
              <span>{claimFeedback.message}</span>
            </div>
          )}

          {/* Sleek Compact Linear-style Pool Bar */}
          <div className="pool-banner-card" style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span className="chip" data-tone="accent" style={{ fontWeight: 600 }}>
                <Icon name={isAdmin ? "users" : "zap"} size={13} />
                {isAdmin ? "Admin Distribution Pool" : "Lead Grab Pool"}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                {state.poolQuota?.totalPoolCount ?? state.poolCount ?? openPoolList.length} Unassigned Leads
              </span>
              <span className="chip" data-tone="neutral" style={{ fontSize: "11px", gap: "4px" }}>
                <Icon name="clock" size={11} /> 10-Min Rotation Active
              </span>
            </div>

            <div className="pool-banner-actions">
              {isAdmin ? (
                <button
                  type="button"
                  className="btn"
                  data-variant="primary"
                  data-size="sm"
                  onClick={handleAutoDistributeAll}
                  disabled={isDistributing || openPoolList.length === 0}
                >
                  <Icon name={isDistributing ? "refresh" : "zap"} size={12} className={isDistributing ? "spin" : ""} />
                  {isDistributing ? "Distributing..." : "Auto-Distribute (Round-Robin)"}
                </button>
              ) : (
                <div className="pool-capacity-wrap">
                  <span className="hint">
                    Capacity: <strong>{initialStageCount}</strong> / {myCap} in {initialStageLabel}
                  </span>
                  <span className="chip" data-tone={isAtQuota ? "danger" : "success"} data-size="sm">
                    {isAtQuota ? "Quota Full" : `${availableSlots} slots left`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Filter Toolbar for Pool */}
          <div className="pipe-toolbar">
            <div className="pipe-search">
              <Icon name="search" size={14} />
              <input
                value={poolQuery}
                onChange={(e) => setPoolQuery(e.target.value)}
                placeholder="Search open leads by customer name, phone, email, inquiry..."
                aria-label="Search pool leads"
              />
              {poolQuery ? (
                <button className="icon-btn" onClick={() => setPoolQuery("")} aria-label="Clear search">
                  <Icon name="close" size={13} />
                </button>
              ) : null}
            </div>

            <select
              className="select pipe-select"
              value={poolSource}
              onChange={(e) => setPoolSource(e.target.value)}
              aria-label="Filter pool by source"
            >
              <option value="">All Ingestion Sources</option>
              <option value="Google Sheets">Google Sheets</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="WhatsApp QR">WhatsApp QR</option>
              <option value="Excel">Excel / CSV Batches</option>
              <option value="Website">Website Webhooks</option>
              <option value="IndiaMART">IndiaMART</option>
              <option value="Justdial">Justdial</option>
              <option value="Email">Email</option>
              <option value="Ads">Ads / Meta</option>
              <option value="Cold call">Cold call</option>
              <option value="Lead form">Lead form</option>
              <option value="Referral">Referral</option>
            </select>

            <span className="col-w-label">
              Showing {openPoolList.length} of {state.poolQuota?.totalPoolCount ?? state.poolCount ?? openPoolList.length} leads
            </span>
            <button
              type="button"
              className="chip"
              data-tone={missedCount > 0 ? "danger" : "neutral"}
              title="Click to view missed pool leads audit"
              onClick={() => {
                setShowMissedModal(true);
                void fetchMissedAndBreak();
              }}
            >
              Missed: {missedCount} leads
            </button>
            <button
              type="button"
              className="btn"
              data-size="sm"
              data-variant={isOnBreak ? "accent" : "ghost"}
              onClick={isOnBreak ? handleEndBreak : handleTakeBreak}
              disabled={breakLoading || (!isOnBreak && breakRemainingSec <= 0)}
              title={
                isOnBreak
                  ? `On Break (${breakCountdown} remaining). Click to resume receiving leads.`
                  : breakRemainingSec <= 0
                  ? "Daily break quota (30m) exhausted for today."
                  : `Take a break (${Math.ceil(breakRemainingSec / 60)}m left)`
              }
            >
              <Icon name={isOnBreak ? "check" : "clock"} size={12} />
              {isOnBreak
                ? `☕ On Break (${breakCountdown}) - Resume`
                : breakRemainingSec <= 0
                ? "☕ Break Used"
                : `☕ Take Break (${Math.ceil(breakRemainingSec / 60)}m)`}
            </button>

            {isAdmin ? (
              <div className="seg" role="group" aria-label="Pool display limit">
                {[5, 10, 20].map((lim) => (
                  <button
                    key={lim}
                    type="button"
                    data-on={poolLimit === lim}
                    onClick={() => handlePoolLimitChange(lim)}
                    aria-pressed={poolLimit === lim}
                    title={`Show up to ${lim} leads in grab pool`}
                  >
                    <span>{lim} leads</span>
                  </button>
                ))}
              </div>
            ) : null}

            {isAdmin && openPoolList.length > 0 ? (
              <button
                type="button"
                className="btn"
                data-size="sm"
                data-variant={selectedPoolIds.size === openPoolList.length ? "accent" : "ghost"}
                onClick={() => {
                  if (selectedPoolIds.size === openPoolList.length) {
                    setSelectedPoolIds(new Set());
                  } else {
                    setSelectedPoolIds(new Set(openPoolList.map((p) => p.id)));
                  }
                }}
                title="Select or deselect all unassigned leads"
              >
                <Icon name="check" size={12} />
                {selectedPoolIds.size === openPoolList.length ? "Deselect All" : `Select All (${openPoolList.length})`}
              </button>
            ) : null}
          </div>

          {/* Bulk Action Bar for Unassigned Pool */}
          {isAdmin && selectedPoolIds.size > 0 && (
            <div className="bulk" style={{ marginBottom: "12px" }}>
              <span>
                <b>{selectedPoolIds.size}</b> unassigned lead{selectedPoolIds.size > 1 ? "s" : ""} selected
              </span>
              <select
                className="select"
                disabled={isBulkAssigningPool}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    const val = e.target.value;
                    const [agentId, agentName] = val.includes("::") ? val.split("::") : ["", val];
                    void handleBulkAssignPool(agentName, agentId || undefined);
                    e.target.value = "";
                  }
                }}
                aria-label="Assign selected unassigned leads to closer"
              >
                <option value="" disabled>
                  {isBulkAssigningPool ? "Assigning leads..." : "👤 Assign Selected to Closer..."}
                </option>
                {activeClosers.length > 0
                  ? activeClosers.map((closer) => (
                      <option key={closer.id} value={`${closer.id}::${closer.name}`}>
                        {closer.name} {closer.role ? `(${closer.role})` : ""}
                      </option>
                    ))
                  : availableClosers.map((closer) => (
                      <option key={closer} value={`::${closer}`}>
                        {closer}
                      </option>
                    ))}
              </select>
              <button
                type="button"
                className="btn"
                data-size="sm"
                disabled={isBulkAssigningPool}
                onClick={() => setSelectedPoolIds(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          {/* Lead Cards Grid */}
          {openPoolList.length > 0 ? (
            <div className="pool-grid">
              {openPoolList.map((item) => {
                const src = sourceMeta(item.source || "Google Sheets");
                const isClaiming = claimingId === item.id;
                const isDisappearing = disappearedIds.has(item.id);
                const remainingSec = getRemainingSeconds(item.createdAt);
                const isUrgent = remainingSec > 0 && remainingSec < 120;

                return (
                  <div
                    key={item.id}
                    className="pool-card"
                    data-disappearing={isDisappearing}
                    data-selected={selectedPoolIds.has(item.id)}
                  >
                    <div>
                      {/* Top Row: Source badge + Name + Arrived */}
                      <div className="pool-card-top">
                        <div className="pool-card-lead-info">
                          {isAdmin && (
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={selectedPoolIds.has(item.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedPoolIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              aria-label={`Select lead ${item.customerName || "Customer"}`}
                            />
                          )}
                          <span className="stage-icon-badge" data-tone={src.tone}>
                            <Icon name={src.icon} size={15} />
                          </span>
                          <div>
                            <h3 className="pool-card-name">
                              {item.customerName || "Customer Lead"}
                            </h3>
                            <span className="pool-card-sub">
                              {item.customerPhone || "Inbound Pool Lead"}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div className="pool-timer" data-urgent={isUrgent}>
                            <Icon name="clock" size={11} />
                            <span>{remainingSec > 0 ? `⏱️ ${formatCountdown(remainingSec)}` : "Missed"}</span>
                          </div>
                          <span className="chip" data-tone={src.tone}>
                            <Icon name={src.icon} size={10} /> {src.label}
                          </span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="pool-card-contacts">
                        {item.customerPhone ? (
                          <div className="pool-card-contact-row">
                            <Icon name="phone" size={12} />
                            <span className="pool-card-phone">
                              {item.customerPhone}
                            </span>
                            <a
                              href={`https://wa.me/${item.customerPhone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Chat on WhatsApp"
                              className="pool-card-wa-link"
                            >
                              <Icon name="whatsapp" size={13} />
                            </a>
                          </div>
                        ) : null}

                        {item.customerEmail ? (
                          <div className="pool-card-contact-row">
                            <Icon name="mail" size={12} />
                            <span className="pool-card-email">
                              {item.customerEmail}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Inquiry Service Interest */}
                      <div className="pool-card-inquiry">
                        <div className="pool-card-inquiry-lbl">
                          Inquiry / Requirement:
                        </div>
                        {item.serviceInterest || "Direct Enquiry imported from Google Sheet / Inbound channel"}
                      </div>
                    </div>

                    {/* Footer Row: Assign to Closer (Admin) vs Grab Lead (Closer) */}
                    <div className="pool-card-foot">
                      <span className="pool-card-time">
                        {item.createdAt ? `Imported ${relativeTime(item.createdAt)}` : "Unassigned"}
                      </span>

                      {isAdmin ? (
                        <select
                          className="select pool-card-assign-select"
                          disabled={isClaiming}
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const val = e.target.value;
                              const [agentId, agentName] = val.includes("::") ? val.split("::") : ["", val];
                              handleAssignLead(item, agentName, agentId || undefined);
                              e.target.value = "";
                            }
                          }}
                          aria-label="Assign lead to closer"
                        >
                          <option value="" disabled>Assign to Closer...</option>
                          {activeClosers.length > 0
                            ? activeClosers.map((closer) => (
                                <option key={closer.id} value={`${closer.id}::${closer.name}`}>
                                  {closer.name} {closer.role ? `(${closer.role})` : ""}
                                </option>
                              ))
                            : availableClosers.map((closer) => (
                                <option key={closer} value={`::${closer}`}>
                                  {closer}
                                </option>
                              ))}
                        </select>
                      ) : (
                        <button
                          className="btn"
                          data-variant="primary"
                          disabled={isClaiming || isAtQuota}
                          onClick={() => handleClaimLead(item)}
                          title={
                            isAtQuota
                              ? `Quota limit reached (${myCap} leads in ${initialStageLabel}). Advance leads to other stages to claim more.`
                              : "Click to claim lead into your pipeline"
                          }
                        >
                          {isClaiming ? (
                            <>
                              <Icon name="refresh" size={13} className="spin" /> Grabbing...
                            </>
                          ) : isAtQuota ? (
                            <>
                              <Icon name="alert-circle" size={13} /> Quota Full
                            </>
                          ) : (
                            <>
                              <Icon name="zap" size={13} /> Grab Lead Now
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <span className="empty-icon">
                <Icon name="check-circle" size={24} />
              </span>
              <h3>All Open Leads Claimed</h3>
              <p>
                There are currently no unclaimed leads in the Grab Pool. New leads synced from Google Sheets, WhatsApp, or CSV imports will appear here automatically.
              </p>
              <button className="btn" data-variant="primary" onClick={() => setViewMode("board")}>
                <Icon name="kanban" size={14} /> View Kanban Board
              </button>
            </div>
          )}
        </div>
      ) : viewMode === "recycle" ? (
        <div className="recycle-container card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Recycle Bin</h2>
              <p className="card-sub">
                Soft-deleted leads from this workspace. Restoring a lead moves it back to the New Leads column. Permanent deletion removes the lead record from the database.
              </p>
            </div>
            <button
              className="btn"
              data-size="sm"
              onClick={loadRecycleBin}
              disabled={loadingRecycle}
            >
              <Icon name="refresh" size={13} className={loadingRecycle ? "spin" : ""} />
              {loadingRecycle ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {recycleFeedback && (
            <div className="card-head">
              <span className="chip" data-tone="accent">{recycleFeedback}</span>
            </div>
          )}

          {recycleLeads.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Icon name="trash" size={32} />
              </div>
              <div className="empty-title">Recycle Bin is Empty</div>
              <p className="empty-desc">
                There are no soft-deleted or recycled leads. Leads deleted from the pipeline or contacts list will appear here.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lead Code</th>
                    <th>Customer Name</th>
                    <th>Original Stage</th>
                    <th>Phone</th>
                    <th>Deleted / Updated</th>
                    <th>Owner</th>
                    <th className="cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recycleLeads.map((rLead) => (
                    <tr key={rLead.id}>
                      <td>
                        <span className="cell-mono font-bold">{rLead.code}</span>
                      </td>
                      <td>
                        <div className="cell-person">
                          <div>
                            <div className="cell-name">{rLead.name}</div>
                            <span className="cell-sub">{rLead.company || "Direct inquiry"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="chip" data-tone="accent">
                          {STAGES.find((s) => s.id === rLead.stage)?.label || rLead.stage}
                        </span>
                      </td>
                      <td>
                        <span>{rLead.phone || "—"}</span>
                      </td>
                      <td>
                        <span className="cell-muted">{relativeTime(rLead.updatedAt)}</span>
                      </td>
                      <td>
                        <span className="cell-muted">{rLead.owner || "Unassigned"}</span>
                      </td>
                      <td className="cell-right">
                        <div className="chip-row">
                          <button
                            type="button"
                            className="btn"
                            data-size="sm"
                            data-variant="accent"
                            disabled={recycleActionId === rLead.id}
                            onClick={() => handleRestore(rLead.id)}
                          >
                            <Icon name="refresh" size={12} /> Restore
                          </button>
                          {confirmPermanentDeleteId === rLead.id ? (
                            <>
                              <button
                                type="button"
                                className="btn"
                                data-size="sm"
                                data-variant="danger"
                                disabled={recycleActionId === rLead.id}
                                onClick={() => handlePermanentDelete(rLead.id)}
                              >
                                Confirm Permanent Delete
                              </button>
                              <button
                                type="button"
                                className="btn"
                                data-size="sm"
                                onClick={() => setConfirmPermanentDeleteId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn"
                              data-size="sm"
                              data-variant="ghost"
                              disabled={recycleActionId === rLead.id}
                              onClick={() => setConfirmPermanentDeleteId(rLead.id)}
                            >
                              <Icon name="trash" size={12} /> Delete Permanently
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="pipe-toolbar">
            <div className="pipe-search">
              <Icon name="search" size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, company, phone, ID..."
                aria-label="Search leads"
              />
              {query ? (
                <button className="icon-btn" onClick={() => setQuery("")} aria-label="Clear search">
                  <Icon name="close" size={13} />
                </button>
              ) : null}
            </div>

            <select
              className="select pipe-select"
              value={source}
              onChange={(e) => setSource(e.target.value as Source | "")}
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceMeta(s).label}
                </option>
              ))}
            </select>



            <div className="seg pipe-sort" role="group" aria-label="Sort cards">
              <button data-on={sort === "recent"} onClick={() => setSort("recent")} aria-pressed={sort === "recent"}>
                <Icon name="clock" size={12} /> Recent
              </button>

              <button data-on={sort === "priority"} onClick={() => setSort("priority")} aria-pressed={sort === "priority"}>
                <Icon name="priority-high" size={12} /> Priority
              </button>

              <button data-on={sort === "value"} onClick={() => setSort("value")} aria-pressed={sort === "value"}>
                <Icon name="tag" size={12} /> Value
              </button>
            </div>

            <span className="col-w-label">{state.colWidth}px columns</span>
          </div>

          <div className="chip-row">
            {source ? (
              <span className="chip-x">
                Source <b>{sourceMeta(source).label}</b>
                <button className="x" onClick={() => setSource("")} aria-label="Clear source filter">
                  <Icon name="close" size={11} />
                </button>
              </span>
            ) : null}

            {query ? (
              <span className="chip-x">
                Text <b>{query}</b>
                <button className="x" onClick={() => setQuery("")} aria-label="Clear search">
                  <Icon name="close" size={11} />
                </button>
              </span>
            ) : null}
            {hasFilters ? (
              <button className="btn" data-size="sm" onClick={clearFilters}>
                Clear all
              </button>
            ) : (
              <span className="hint">Showing all leads (no filters applied)</span>
            )}
            {state.scope.startsWith("agent:") ? (
              <span className="chip" data-tone="accent">
                <Icon name="target" size={13} /> {state.scope.slice(6)}&apos;s Leads ({boardLeads.length})
              </span>
            ) : (
              <span className="chip" data-tone="neutral">
                <Icon name="shield" size={12} /> Pipeline Leads ({boardLeads.length})
              </span>
            )}
          </div>

          <div className="board" data-fit={fit} role="list" aria-label="Lead pipeline board" ref={boardRef}>
            {/* Grab Pool Column ("Lead Grab") - Strictly for Sales Closers, NOT for Admin/Manager who imports leads */}
            {!isAdmin && (
              <div
                className="col"
                aria-label={`Lead Grab Pool, ${openPoolList.length} of ${state.poolQuota?.totalPoolCount || state.poolCount || openPoolList.length} leads`}
                role="listitem"
              >
                <header className="col-head">
                  <h2 className="col-title">
                    <span className="stage-icon-badge" data-tone="accent">
                      <Icon name="zap" size={15} />
                    </span>
                    Lead Grab
                  </h2>
                  <span
                    className="col-count"
                    title={`${openPoolList.length} ready to grab of ${state.poolQuota?.totalPoolCount || state.poolCount || openPoolList.length} unassigned`}
                  >
                    {openPoolList.length}
                  </span>
                  <span
                    className="chip"
                    data-tone={missedCount > 0 ? "danger" : "neutral"}
                    title={missedCount > 0 ? `${missedCount} leads missed SLA` : "No missed leads"}
                  >
                    Missed: {missedCount}
                  </span>
                  <button
                    className="icon-btn col-add"
                    onClick={() => {
                      setViewMode("pool");
                      fetchPoolLeads().catch(() => {});
                    }}
                    aria-label="Open full Lead Grab Pool"
                    title="Open full Lead Grab Pool"
                  >
                    <Icon name="external" size={13} />
                  </button>
                </header>

                <div className="col-cards">
                  {openPoolList.map((item) => {
                    const remainingSec = getRemainingSeconds(item.createdAt);
                    const isUrgent = remainingSec > 0 && remainingSec < 120;
                    const isClaiming = claimingId === item.id;
                    const src = sourceMeta(item.source || "Website");

                    return (
                      <div
                        key={item.id}
                        className="card lead"
                      >
                        <div className="lead-top">
                          <span className="stage-icon-badge" data-tone={src.tone} title={`Lead source: ${src.label}`}>
                            <Icon name={src.icon} size={15} />
                          </span>
                          <div className="pool-timer" data-urgent={isUrgent}>
                            <Icon name="clock" size={11} />
                            <span>{remainingSec > 0 ? `⏱️ ${formatCountdown(remainingSec)}` : "Missed"}</span>
                          </div>
                        </div>
                        <h3 className="lead-name" style={{ fontSize: "13px", fontWeight: 650, marginTop: "4px" }}>
                          {item.customerName || "Customer Lead"}
                        </h3>
                        <p className="lead-company">
                          <Icon name="phone" size={12} /> {item.customerPhone || "No phone"}
                        </p>
                        {item.serviceInterest && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.3 }}>
                            {item.serviceInterest}
                          </div>
                        )}
                        <div className="lead-sla-claim" style={{ marginTop: "8px" }}>
                          <button
                            className="btn"
                            data-variant="accent"
                            data-size="sm"
                            disabled={isClaiming || isAtQuota}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClaimLead(item);
                            }}
                            style={{ width: "100%", justifyContent: "center" }}
                          >
                            {isClaiming ? (
                              <>
                                <Icon name="refresh" size={12} className="spin" /> Grabbing...
                              </>
                            ) : (
                              <>
                                <Icon name="zap" size={12} /> Grab Lead (SLA)
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {!openPoolList.length && (
                    <div className="col-empty" style={{ cursor: "default" }}>
                      <span>Pool empty</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {STAGES.map((stage, stageIndex) => {
              const cards = byStage.get(stage.id) ?? [];
              return (
                <div
                  key={stage.id}
                  className="col"
                  data-over={overStage === stage.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overStage !== stage.id) setOverStage(stage.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || dragging;
                    if (id) moveLead(id, stage.id);
                    setDragging(null);
                    setOverStage(null);
                    setDragOverCardId(null);
                  }}
                  aria-label={`${stage.label}, ${cards.length} leads`}
                  role="listitem"
                >
                  <header className="col-head">
                    <h2 className="col-title">
                      <span className="stage-icon-badge" data-tone={stage.tone}><Icon name={stage.icon} size={15} /></span>
                      {stage.label}
                    </h2>
                    <span className="col-count">{cards.length}</span>
                    {cards.reduce((sum, c) => sum + (Number(c.value) || 0), 0) > 0 && (
                      <span className="chip" data-tone="accent">
                        {money(cards.reduce((sum, c) => sum + (Number(c.value) || 0), 0))}
                      </span>
                    )}
                    <button
                      className="icon-btn col-add"
                      onClick={() => setAddStage(stage.id)}
                      aria-label={`Add lead to ${stage.label}`}
                      title={`Add lead to ${stage.label}`}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </header>

                  <div className="col-cards">
                    {cards.map((lead) => {
                      const overdue = isOverdue(lead.followUp) && lead.stage !== "won" && lead.stage !== "lost";
                      const src = sourceMeta(lead.source);
                      return (
                        <div
                          key={lead.id}
                          className="card lead"
                          data-lead={lead.id}
                          draggable
                          data-dragging={dragging === lead.id}
                          data-drag-over={dragOverCardId === lead.id}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", lead.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragging(lead.id);
                          }}
                          onDragOver={(e) => {
                            if (dragging && dragging !== lead.id) {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragOverCardId !== lead.id) {
                                setDragOverCardId(lead.id);
                              }
                            }
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              if (dragOverCardId === lead.id) setDragOverCardId(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const draggedId = e.dataTransfer.getData("text/plain") || dragging;
                            if (draggedId && draggedId !== lead.id) {
                              moveLead(draggedId, stage.id, lead.id);
                            }
                            setDragging(null);
                            setOverStage(null);
                            setDragOverCardId(null);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setOverStage(null);
                            setDragOverCardId(null);
                          }}
                          tabIndex={0}
                          role="button"
                          onClick={() => setSelected(lead.id)}
                          onKeyDown={(e) => onCardKeyDown(e, lead, stageIndex)}
                        >
                          <div className="lead-top">
                            <span className="stage-icon-badge" data-tone={src.tone} title={`Lead source: ${src.label}`}>
                              <Icon name={src.icon} size={15} />
                            </span>
                            <h3 className="lead-name">{lead.name}</h3>
                            <button
                              type="button"
                              className="icon-btn"
                              data-size="sm"
                              title={`Priority: ${PRIORITY_LABEL[lead.priority]} • Click to change`}
                              aria-label={`Change priority from ${PRIORITY_LABEL[lead.priority]}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const cycle: Record<Priority, Priority> = {
                                  low: "medium",
                                  medium: "high",
                                  high: "urgent",
                                  urgent: "low",
                                };
                                const nextPrio = cycle[lead.priority] || "medium";
                                updateLead(lead.id, { priority: nextPrio });
                              }}
                            >
                              <Icon
                                name={PRIORITY_ICON[lead.priority] as never}
                                size={13}
                                className="prio"
                                data-priority={lead.priority}
                              />
                            </button>
                          </div>
                          <p className="lead-company">
                            <Icon name="building" size={12} /> {lead.company}
                          </p>
                          <div className="lead-meta">
                            <span className="chip" data-tone={src.tone}>
                              <Icon name={src.icon} size={11} /> {src.label}
                            </span>
                            {(() => {
                              const val = Number(lead.realPaymentAmount || (lead as any).paymentAmount || lead.value || 0);
                              const pStatus = ((lead as any).paymentStatus || "").toUpperCase();
                              const isPaid = pStatus === "PAID" || pStatus === "SETTLED" || pStatus === "APPROVED" || lead.stage === "won";
                              const isPending = pStatus === "PENDING" || pStatus === "PAYMENT_PENDING";
                              const isProof = pStatus === "PROOF_UPLOADED" || pStatus === "PROOF_REVIEW";
                              if (val > 0 || isPending || isPaid || isProof) {
                                if (isPaid) return <span className="chip" data-tone="success">✓ {money(val)} Paid</span>;
                                if (isProof) return <span className="chip" data-tone="warning">⏱️ {money(val)} Review</span>;
                                if (isPending) return <span className="chip" data-tone="warning">⏱️ {money(val)} Link Sent</span>;
                                if (val > 0) return <span className="chip" data-tone="neutral">{money(val)}</span>;
                              }
                              return null;
                            })()}
                            {lead.phone && (
                              <div className="lead-quick-actions" onClick={(e) => e.stopPropagation()}>
                                <a
                                  href={`/chat?leadId=${lead.id}&phone=${encodeURIComponent(lead.phone)}&channel=api`}
                                  className="icon-btn"
                                  data-size="sm"
                                  title="Chat via Official WhatsApp Cloud API"
                                  aria-label="Chat via WhatsApp API"
                                >
                                  <Icon name="bolt" size={11} />
                                </a>
                                <a
                                  href={`/chat?leadId=${lead.id}&phone=${encodeURIComponent(lead.phone)}&channel=mine`}
                                  className="icon-btn"
                                  data-size="sm"
                                  title="Chat via Personal WhatsApp (Companion)"
                                  aria-label="Chat via Personal WhatsApp"
                                >
                                  <Icon name="whatsapp" size={11} />
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="lead-foot">
                            <span className={`mini-avatar ${lead.owner === "Unassigned" ? "is-empty" : ""}`}>
                              {lead.owner === "Unassigned" ? "?" : lead.owner.slice(0, 1)}
                            </span>
                            <span className="lead-owner">{lead.owner}</span>
                            <span className="lead-code">{lead.code}</span>

                            <span className="lead-sla" data-overdue={overdue}>
                              {overdue ? <Icon name="flame" size={11} /> : null}
                              {slaLabel(lead.followUp)}
                            </span>
                          </div>
                          {lead.owner === "Unassigned" && !isAdmin && (
                            <div className="lead-sla-claim">
                              <button
                                className="btn lead-sla-btn"
                                data-variant="accent"
                                data-size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  claimLead(lead.id, closerName);
                                }}
                              >
                                <Icon name="zap" size={11} /> Grab Lead (SLA Pool)
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!cards.length ? (
                      <button className="col-empty" onClick={() => setAddStage(stage.id)}>
                        <Icon name="plus" size={13} /> Add a lead
                      </button>
                    ) : null}
                  </div>

                  <ResizeHandle
                    label={`Resize ${stage.label} column`}
                    resetTo={288}
                    min={LIMITS.col[0]}
                    max={LIMITS.col[1]}
                    getWidth={() => state.colWidth}
                    setWidth={(colWidth) => setLayout({ colWidth })}
                  />
                </div>
              );
            })}
          </div>

          {!filtered.length ? (
            <div className="empty">
              <span className="empty-icon">
                <Icon name="inbox" size={18} />
              </span>
              <h3>No leads match this view</h3>
              <p>Try a different search, or clear the filters to see the whole pipeline.</p>
              <button className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : null}

          
        </>
      )}

      {active ? (
        <ErrorBoundary fallbackTitle="Could not load lead drawer" onReset={() => setSelected(null)}>
          <LeadDrawer lead={active} onClose={() => setSelected(null)} />
        </ErrorBoundary>
      ) : null}
      {addStage ? <AddLeadDialog defaultStage={addStage} onClose={() => setAddStage(null)} /> : null}

      {/* Missed Leads Inspection Modal */}
      {showMissedModal && (
        <div className="overlay" data-kind="dialog" onClick={() => setShowMissedModal(false)}>
          <div className="dialog" data-size="lg" onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <div className="dialog-icon" data-tone="warning">
                <Icon name="alert-circle" size={16} />
              </div>
              <h2>Missed Pool Leads Audit ({missedCount})</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowMissedModal(false)}
                aria-label="Close dialog"
              >
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body" data-scroll="true">
              {missedLeads.length === 0 ? (
                <div className="empty">
                  <span className="empty-icon">
                    <Icon name="check-circle" size={24} />
                  </span>
                  <h3>No Missed Leads</h3>
                  <p>
                    You have not missed any pool leads. Keep active and claim incoming opportunities within the 10-minute window!
                  </p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Customer Name</th>
                        <th>Phone</th>
                        <th>Missed At</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missedLeads.map((item, idx) => {
                        const isTimer =
                          item.reason?.toLowerCase().includes("timer") ||
                          item.reason?.toLowerCase().includes("expired") ||
                          item.reason?.toLowerCase().includes("10-min");
                        const isPeer =
                          item.reason?.toLowerCase().includes("teammate") ||
                          item.reason?.toLowerCase().includes("another") ||
                          item.reason?.toLowerCase().includes("closer") ||
                          item.reason?.toLowerCase().includes("peer");

                        return (
                          <tr key={item.id || item.poolItemId || idx}>
                            <td>
                              <strong className="cell-name">
                                {item.customerName || "Customer Lead"}
                              </strong>
                            </td>
                            <td>
                              <span>{item.customerPhone || "—"}</span>
                            </td>
                            <td>
                              <span className="cell-muted">
                                {item.missedAt ? new Date(item.missedAt).toLocaleString() : "Recently"}
                              </span>
                            </td>
                            <td>
                              {isTimer ? (
                                <span className="chip" data-tone="warning">
                                  ⏱️ Timer Expired
                                </span>
                              ) : isPeer ? (
                                <span className="chip" data-tone="accent">
                                  ⚡ Grabbed by teammate
                                </span>
                              ) : (
                                <span className="chip" data-tone="neutral">
                                  {item.reason || "Unclaimed"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <footer className="dialog-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={fetchMissedAndBreak}
              >
                <Icon name="refresh" size={13} /> Refresh
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                onClick={() => setShowMissedModal(false)}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
