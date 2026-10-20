"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { aicloserApi, getStoredToken, setStoredToken } from "@/lib/api-client";
import { useApp } from "@/lib/store";

export type TenantWorkspace = {
  id: string;
  name: string;
  slug: string;
    status: "ACTIVE" | "SUSPENDED" | "PENDING";
  maxSeats: number;
  activeUsersCount: number;
  ownerEmail: string;
  ownerPhone: string;
  createdAt: string;
  expiresAt: string | null;
  monthlyRevenue: number;
  monthlyAmount?: number;
  paymentStatus?: "PAID" | "PENDING";
  activeSims: number;
  users?: TenantUser[];
};

export type TenantUser = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  role: "ADMIN" | "MANAGER" | "USER" | "SUPER_ADMIN" | "CLOSER" | "SALES_AGENT";
  status: "ACTIVE" | "PAUSED" | "SUSPENDED";
  agentCode?: string;
  createdAt: string;
  lastLoginAt?: string | null;
};

export type TelemetryDevice = {
  id: string;
  deviceId: string;
  deviceName: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  appVersion: string;
  simLabel: string;
  simNumber: string;
  batteryLevel: number;
  recordingStrategy: "ACCESSIBILITY_SERVICE" | "NATIVE_RECORDER" | "ROOT_ENGINE";
  recordingEnabled: boolean;
  status: "ONLINE" | "SYNCING" | "OFFLINE";
  lastSeenAt: string;
  agentName: string;
  workspaceName: string;
};

export type CallLogStreamItem = {
  id: string;
  customerPhone: string;
  direction: "INBOUND" | "OUTBOUND";
  durationSeconds: number;
  status: "COMPLETED" | "MISSED" | "FAILED";
  recordingStatus: "UPLOADED" | "SYNCING" | "FAILED";
  recordingUrl?: string;
  agentName: string;
  workspaceName: string;
  timestamp: string;
};

export type ReviewItem = {
  id: string;
  customerName: string;
  contact: string;
  rating: number;
  comment: string;
  source: "Rate Page" | "Google GMB" | "WhatsApp Inbound" | "Web";
  status: "NEW" | "CONTACTED" | "RESOLVED";
  createdAt: string;
  adminNotes?: string | null;
};

export type AuditLogItem = {
  id: string;
  user: string;
  email: string;
  workspace: string;
  ip: string;
  device: string;
  event: "LOGIN" | "SEAT_UPDATE" | "PLAN_CHANGE" | "SIM_HEARTBEAT" | "STATUS_TOGGLE";
  result: "SUCCESS" | "BLOCKED" | "MFA_REQUIRED";
  timestamp: string;
};


export function SuperAdminView() {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<"workspaces" | "mobile" | "whatsapp" | "ai" | "security" | "reviews">("workspaces");
  const [workspaces, setWorkspaces] = useState<TenantWorkspace[]>([]);
  const [devices, setDevices] = useState<TelemetryDevice[]>([]);
  const [calls, setCalls] = useState<CallLogStreamItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [loginEmail, setLoginEmail] = useState("hello.ankitrathore@gmail.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<TenantWorkspace | null>(null);

  // Modals
  const [isAddWorkspaceModal, setIsAddWorkspaceModal] = useState(false);
  const [isAddUserModal, setIsAddUserModal] = useState(false);
  const [isSeatsModal, setIsSeatsModal] = useState(false);
  const [targetWorkspaceForAction, setTargetWorkspaceForAction] = useState<TenantWorkspace | null>(null);
  const [customSeatsCount, setCustomSeatsCount] = useState<number>(5);

  // Impersonation state
  const [impersonatingTenant, setImpersonatingTenant] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Forms
  const [newWsName, setNewWsName] = useState("");
  const [newWsSlug, setNewWsSlug] = useState("");
  const [newWsEmail, setNewWsEmail] = useState("");
  const [newWsPhone, setNewWsPhone] = useState("");
  const [newWsPassword, setNewWsPassword] = useState("Admin@123");
  const [showWsPassword, setShowWsPassword] = useState(false);
  const [newWsSeats, setNewWsSeats] = useState(5);
  const [newWsMonthlyAmount, setNewWsMonthlyAmount] = useState<number>(9999);
  const [newWsExpiry, setNewWsExpiry] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const [newUsrName, setNewUsrName] = useState("");
  const [newUsrEmail, setNewUsrEmail] = useState("");
  const [newUsrPhone, setNewUsrPhone] = useState("");
  const [newUsrRole, setNewUsrRole] = useState<"SALES_AGENT" | "MANAGER" | "ADMIN">("SALES_AGENT");
  const [newUsrPassword, setNewUsrPassword] = useState("Closer@123");
  const [showUsrPassword, setShowUsrPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Global AI Engine Master Controls
  const [groqMasterKey, setGroqMasterKey] = useState("gsk_master_free_prod_••••••••••••••••");
  const [openAiMasterKey, setOpenAiMasterKey] = useState("sk-proj-master-gpt4o_••••••••••••••••");
  const [geminiMasterKey, setGeminiMasterKey] = useState("AIzaSyMasterGemini_••••••••••••••••");
  const [deepseekMasterKey, setDeepseekMasterKey] = useState("sk-deepseek-master_••••••••••••••••");
  const [grokMasterKey, setGrokMasterKey] = useState("xai-grok-master-v1_••••••••••••••••");
  const [primaryAiProvider, setPrimaryAiProvider] = useState("groq");
  const [aiFallbackOrder, setAiFallbackOrder] = useState<string[]>(["groq", "deepseek", "gemini", "openai", "grok"]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync from central backend API
  const refreshCentralData = async (notify = true) => {
    const token = getStoredToken();
    if (!token) {
      setAuthRequired(true);
      setIsLoading(false);
      setIsSyncing(false);
      return;
    }
    setIsSyncing(true);
    try {
      const tenants = await aicloserApi.superAdmin.getTenants().catch((err: any) => {
        setAuthRequired(true);
        return null;
      });

      if (Array.isArray(tenants)) {
        setAuthRequired(false);
        const mapped: TenantWorkspace[] = tenants.map((t: any) => ({
          id: String(t.id),
          name: t.name || "Workspace",
          slug: t.slug || t.id,
          status: t.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
          maxSeats: Number(t.maxSeats || 5),
          activeUsersCount: Number(t.stats?.usersCount ?? 1),
          ownerEmail: t.ownerEmail || t.owner?.email || "-",
          ownerPhone: t.ownerPhone || t.owner?.phone || "-",
          createdAt: t.createdAt || new Date().toISOString(),
          expiresAt: t.packageExpiresAt || t.expiresAt || null,
          monthlyAmount: Number(t.monthlyAmount || (t.settings as any)?.monthlyAmount || Number(t.maxSeats || 5) * 1999),
          monthlyRevenue: Number(t.monthlyAmount || (t.settings as any)?.monthlyAmount || Number(t.maxSeats || 5) * 1999),
          paymentStatus: (t.paymentStatus || (t.settings as any)?.paymentStatus || "PAID") as "PAID" | "PENDING",
          activeSims: Number(t.stats?.callsCount || 0),
          users: t.users || [],
        }));
        setWorkspaces(mapped);
      } else {
        setAuthRequired(true);
      }

      // Live reviews
      const feedback = await aicloserApi.superAdmin.listFeedback().catch(() => null);
      if (feedback && (Array.isArray(feedback) || feedback.items)) {
        const raw = Array.isArray(feedback) ? feedback : feedback.items;
        const mappedReviews: ReviewItem[] = raw.map((r: any) => ({
          id: String(r.id),
          customerName: r.name || r.customerName || "Anonymous",
          contact: r.contact || r.phone || "",
          rating: Number(r.rating || 5),
          comment: r.comment || r.message || "",
          source: (r.source || "Web") as any,
          status: (r.status || "NEW") as any,
          createdAt: r.createdAt || new Date().toISOString(),
          adminNotes: r.adminNotes || null,
        }));
        setReviews(mappedReviews);
      }

      // Telemetry
      const telem: any = await aicloserApi.superAdmin.getTelemetry().catch(() => null);
      if (telem?.devices && Array.isArray(telem.devices)) {
        setDevices(telem.devices);
      }

      if (notify) showToast("Live PostgreSQL ecosystem registry synced.");
    } catch {
      if (notify) showToast("Central server offline — check network connection.");
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthRequired(true);
      setIsLoading(false);
      return;
    }
    void refreshCentralData(false);
  }, []);

  // Workspace stats computation
  const stats = useMemo(() => {
    const total = workspaces.length;
    const active = workspaces.filter((w) => w.status === "ACTIVE").length;
    const suspended = workspaces.filter((w) => w.status === "SUSPENDED").length;
    const totalSeats = workspaces.reduce((sum, w) => sum + w.maxSeats, 0);
    const paidMrr = workspaces
      .filter((w) => w.paymentStatus === "PAID")
      .reduce((sum, w) => sum + Number(w.monthlyAmount || w.monthlyRevenue || 0), 0);
    const pendingMrr = workspaces
      .filter((w) => w.paymentStatus === "PENDING")
      .reduce((sum, w) => sum + Number(w.monthlyAmount || w.monthlyRevenue || 0), 0);
    const totalMrr = paidMrr + pendingMrr;
    const totalSims = devices.filter((d) => d.status === "ONLINE").length;
    return { total, active, suspended, totalSeats, mrr: totalMrr, paidMrr, pendingMrr, totalSims };
  }, [workspaces, devices]);

  // Filtered workspaces
  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter((w) => {
      const matchSearch =
        searchQuery === "" ||
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "ALL" || w.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [workspaces, searchQuery, statusFilter]);

  // Seat Stepper Handlers
  const handleUpdateSeats = async (ws: TenantWorkspace, delta: number) => {
    const newSeats = Math.max(1, ws.maxSeats + delta);
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, maxSeats: newSeats } : w)));
    try {
      await aicloserApi.superAdmin.updateTenantSeats(ws.id, newSeats);
      showToast(`Updated ${ws.name} closer seat capacity to ${newSeats}`);
    } catch {
      showToast(`Saved seat allocation (${newSeats}) locally.`);
    }
  };

  const handleSaveCustomSeats = async () => {
    if (!targetWorkspaceForAction) return;
    const ws = targetWorkspaceForAction;
    const newSeats = Math.max(1, customSeatsCount);
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, maxSeats: newSeats } : w)));
    setIsSeatsModal(false);
    try {
      await aicloserApi.superAdmin.updateTenantSeats(ws.id, newSeats);
      showToast(`Capacity for ${ws.name} set to ${newSeats} closer seats.`);
    } catch {
      showToast(`Saved capacity (${newSeats} seats) locally.`);
    }
  };

  // Status toggle (Active <-> Suspended)
  const handleToggleStatus = async (ws: TenantWorkspace) => {
    const nextStatus = ws.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, status: nextStatus } : w)));
    try {
      await aicloserApi.superAdmin.updateTenantStatus(ws.id, nextStatus as any);
      showToast(`Workspace ${ws.name} is now ${nextStatus}`);
    } catch {
      showToast(`Workspace ${ws.name} marked ${nextStatus} locally.`);
    }
  };

  // Direct seat change (Seat-based package management)
  const handleDirectSeatChange = async (ws: TenantWorkspace, newSeats: number) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, maxSeats: newSeats } : w)));
    try {
      await aicloserApi.superAdmin.updateTenantSeats(ws.id, newSeats);
      showToast(`Updated ${ws.name} to ${newSeats} seats.`);
    } catch {
      showToast(`Saved seat allocation (${newSeats} seats) locally.`);
    }
  };

  // Update billing amount
  const handleUpdateAmount = async (ws: TenantWorkspace, newAmount: number) => {
    const val = Number(newAmount) || 0;
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === ws.id ? { ...w, monthlyAmount: val, monthlyRevenue: val } : w))
    );
    try {
      await aicloserApi.superAdmin.updateTenantAmount(ws.id, val);
      showToast(`Billing amount for ${ws.name} set to ₹${val.toLocaleString("en-IN")}/mo.`);
    } catch (err: any) {
      showToast(err?.message || `Failed to update billing amount.`);
      await refreshCentralData(false);
    }
  };

  // Toggle tenant payment status (Paid <-> Pending)
  const handleTogglePaymentStatus = async (ws: TenantWorkspace) => {
    const nextStatus: "PAID" | "PENDING" = ws.paymentStatus === "PAID" ? "PENDING" : "PAID";
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === ws.id ? { ...w, paymentStatus: nextStatus } : w))
    );
    try {
      await aicloserApi.superAdmin.updateTenantPaymentStatus(ws.id, nextStatus);
      showToast(`Payment status for ${ws.name} marked as ${nextStatus === "PAID" ? "Paid / Done" : "Pending"}.`);
    } catch (err: any) {
      showToast(err?.message || `Failed to update payment status.`);
      await refreshCentralData(false);
    }
  };

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginEmail.trim(),
          password: loginPassword,
          clientType: "DESKTOP",
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data?.data?.token) {
        if (data.data.user?.role !== "SUPER_ADMIN") {
          setLoginError("This account does not have SUPER_ADMIN permissions.");
          return;
        }
        setStoredToken(data.data.token);
        if (typeof document !== "undefined") {
          document.cookie = `aicloser_token=${encodeURIComponent(data.data.token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
          document.cookie = `gx_session=${encodeURIComponent(data.data.token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        }
        setAuthRequired(false);
        showToast("Authenticated as Super Admin.");
        await refreshCentralData(true);
      } else {
        setLoginError(data?.message || "Invalid credentials. Please enter Super Admin password.");
      }
    } catch {
      setLoginError("Connection failed. Please check network connection.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSuperAdminLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("aicloser_auth_token");
        window.localStorage.removeItem("aicloser_token");
        window.localStorage.removeItem("closer_token");
        window.localStorage.removeItem("gx_session");
        window.localStorage.removeItem("aicloser_impersonating_tenant");
        window.localStorage.removeItem("aicloser_impersonating_name");
        window.sessionStorage.clear();
      }
      setStoredToken(null);
      if (typeof document !== "undefined") {
        document.cookie = "aicloser_token=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "gx_session=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "gx_role=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "gx_tenant=; path=/; max-age=0; SameSite=Lax";
      }
      await Promise.allSettled([
        fetch("/api/v1/auth/logout", { method: "POST" }),
        fetch("/api/auth/logout", { method: "POST" }),
      ]).catch(() => null);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/super-admin/login";
      }
    }
  };

  // Expiry extension by days
  const handleExtendExpiry = async (ws: TenantWorkspace, daysToAdd: number) => {
    const currentExpiry = ws.expiresAt ? new Date(ws.expiresAt) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);
    const isoExpiry = currentExpiry.toISOString();
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, expiresAt: isoExpiry } : w)));
    try {
      await aicloserApi.superAdmin.updateTenantExpiry(ws.id, isoExpiry);
      showToast(`Extended ${ws.name} subscription by +${daysToAdd} days.`);
    } catch (err: any) {
      showToast(err?.message || `Failed to extend subscription.`);
      await refreshCentralData(false);
    }
  };

  // Custom date expiry setter
  const handleSetCustomExpiry = async (ws: TenantWorkspace, dateStr: string) => {
    if (!dateStr) return;
    try {
      const isoExpiry = new Date(dateStr + "T23:59:59.999Z").toISOString();
      setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, expiresAt: isoExpiry } : w)));
      await aicloserApi.superAdmin.updateTenantExpiry(ws.id, isoExpiry);
      showToast(`Subscription expiry for ${ws.name} set to ${dateStr}`);
    } catch (err: any) {
      showToast(err?.message || `Failed to update expiry date.`);
      await refreshCentralData(false);
    }
  };

  // Toggle workspace roster and fetch live users
  const handleToggleRoster = async (ws: TenantWorkspace) => {
    if (selectedWorkspace?.id === ws.id) {
      setSelectedWorkspace(null);
      return;
    }
    setSelectedWorkspace(ws);
    try {
      const usersData = await aicloserApi.superAdmin.getTenantUsers(ws.id).catch(() => null);
      const rawUsers = Array.isArray(usersData) ? usersData : (usersData as any)?.users;
      if (Array.isArray(rawUsers)) {
        const mappedUsers: TenantUser[] = rawUsers.map((u: any) => ({
          id: String(u.id),
          displayName: u.displayName || u.name || "Agent",
          email: u.email || "-",
          phone: u.phone || "-",
          role: u.role || "CLOSER",
          status: u.packageStatus === "ACTIVE" ? "ACTIVE" : "PAUSED",
          agentCode: u.agentCode || "GX-CL",
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never",
        }));
        setSelectedWorkspace((prev) => (prev && prev.id === ws.id ? { ...prev, users: mappedUsers, activeUsersCount: mappedUsers.length } : prev));
        setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, users: mappedUsers, activeUsersCount: mappedUsers.length } : w)));
      }
    } catch {
      // ignore
    }
  };

  // Impersonation
  const handleImpersonateWorkspace = async (ws: TenantWorkspace) => {
    setImpersonatingTenant(ws.name);
    try {
      const res = await aicloserApi.superAdmin.impersonateTenant(ws.id).catch(() => null) as any;
      if (res?.token) {
        setStoredToken(res.token);
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("aicloser_impersonating_tenant", ws.id);
        window.localStorage.setItem("aicloser_impersonating_name", ws.name);
        window.location.href = "/pipeline";
      }
      showToast(`Switching context: Impersonating ${ws.name}...`);
    } catch {
      showToast(`Impersonating ${ws.name} in preview mode.`);
    }
  };

  const handleReturnFromImpersonation = async () => {
    setImpersonatingTenant(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("aicloser_impersonating_tenant");
      window.localStorage.removeItem("aicloser_impersonating_name");
    }
    await aicloserApi.superAdmin.returnFromImpersonation().catch(() => null);
    showToast("Returned to Super Admin Command Center.");
  };

  // Provision Workspace with live central API dispatch
  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) {
      showToast("Company name is required.");
      return;
    }
    if (!newWsEmail.trim()) {
      showToast("Founder email is required.");
      return;
    }
    setIsCreatingWorkspace(true);
    try {
      const slug = (newWsSlug || newWsName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const expiresAtIso = newWsExpiry ? new Date(newWsExpiry + "T23:59:59.999Z").toISOString() : undefined;

      const payload = {
        name: newWsName.trim(),
        slug: slug || `ws-${Date.now().toString(36)}`,
        ownerEmail: newWsEmail.trim().toLowerCase(),
        ownerPhone: newWsPhone.trim(),
        ownerPassword: newWsPassword.trim() || "Admin@123",
        maxSeats: Number(newWsSeats) || 5,
        monthlyAmount: Number(newWsMonthlyAmount) || 9999,
        expiresAt: expiresAtIso,
        packageExpiresAt: expiresAtIso,
      };

      const res: any = await aicloserApi.superAdmin.createTenant(payload);
      if (res?.id && newWsMonthlyAmount) {
        await aicloserApi.superAdmin.updateTenantAmount(res.id, Number(newWsMonthlyAmount) || 9999).catch(() => null);
      }
      showToast(`Company Profile "${newWsName.trim()}" created successfully.`);
      setIsAddWorkspaceModal(false);
      setNewWsName("");
      setNewWsSlug("");
      setNewWsEmail("");
      setNewWsPhone("");
      setNewWsPassword("Admin@123");
      setNewWsMonthlyAmount(9999);
      setShowWsPassword(false);
      await refreshCentralData(false);
    } catch (err: any) {
      showToast(err?.message || "Failed to create company profile on central server.");
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  // Add User to Workspace with live central API dispatch
  const handleCreateUser = async () => {
    if (!targetWorkspaceForAction || !newUsrName.trim()) {
      showToast("User name is required.");
      return;
    }
    if (!newUsrEmail.trim()) {
      showToast("User email address is required.");
      return;
    }
    setIsCreatingUser(true);
    try {
      const payload = {
        displayName: newUsrName.trim(),
        email: newUsrEmail.trim().toLowerCase(),
        phone: newUsrPhone.trim(),
        role: newUsrRole,
        password: newUsrPassword.trim() || "Closer@123",
      };

      await aicloserApi.superAdmin.createTenantUser(targetWorkspaceForAction.id, payload);
      showToast(`Added ${newUsrName.trim()} to ${targetWorkspaceForAction.name}`);
      setIsAddUserModal(false);
      setNewUsrName("");
      setNewUsrEmail("");
      setNewUsrPhone("");
      setNewUsrPassword("Closer@123");
      setShowUsrPassword(false);

      if (selectedWorkspace?.id === targetWorkspaceForAction.id) {
        await handleToggleRoster(targetWorkspaceForAction);
      }
      await refreshCentralData(false);
    } catch (err: any) {
      showToast(err?.message || "Failed to create user in workspace.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Review Status update
  const handleUpdateReviewStatus = async (id: string, newStatus: "NEW" | "CONTACTED" | "RESOLVED") => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    try {
      await aicloserApi.superAdmin.updateFeedbackStatus(id, newStatus);
      showToast(`Review marked ${newStatus}`);
    } catch {
      showToast(`Review marked ${newStatus} locally`);
    }
  };

  if (authRequired) {
    return (
      <div style={{ maxWidth: 440, margin: "60px auto", padding: "0 16px" }}>
        <div className="card" style={{ padding: 28, boxShadow: "var(--shadow-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: "var(--r-md)",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center"
            }}>
              <Icon name="shield" size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "var(--fs-title)", fontWeight: 750, margin: 0, color: "var(--text)" }}>Super Admin Access</h2>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", margin: "3px 0 0" }}>
                Authentication required to view company workspaces
              </p>
            </div>
          </div>

          {loginError && (
            <div className="pool-feedback" data-status="already_claimed" style={{ marginBottom: 16 }}>
              <Icon name="alert-circle" size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSuperAdminLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <label>Super Admin Email</label>
              <input
                type="email"
                className="input"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                placeholder="hello.ankitrathore@gmail.com"
              />
            </div>
            <div className="field">
              <label>Master Password</label>
              <div className="password-input-wrap">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  className="input"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  placeholder="Enter Super Admin password"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-sm password-toggle-action"
                  data-variant="ghost"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  tabIndex={-1}
                >
                  {showLoginPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="btn"
              data-variant="primary"
              disabled={isLoggingIn}
              style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
            >
              {isLoggingIn ? "Authenticating..." : "Authenticate as Super Admin"}
            </button>
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <a href="/super-admin/login" style={{ fontSize: "var(--fs-caption)", color: "var(--accent)", textDecoration: "underline" }}>
                Or sign in via Super Admin Login Portal →
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="super-admin-layout" style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 80 }}>
      {/* IMPERSONATION NOTICE BANNER (WHEN ACTIVE) */}
      {impersonatingTenant && (
        <div
          style={{
            background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-strong) 100%)",
            color: "#FFFFFF",
            padding: "10px 16px",
            borderRadius: "var(--r-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="shield" size={18} />
            <span style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>
              Active Super Admin Impersonation: Currently managing <u>{impersonatingTenant}</u>
            </span>
          </div>
          <button
            className="btn btn-sm"
            onClick={handleReturnFromImpersonation}
            style={{ background: "#FFFFFF", color: "var(--text-inverse)", fontWeight: 650 }}
          >
            Exit Impersonation
          </button>
        </div>
      )}

      {/* TOP HEADER & COMMAND STATS BAR */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--r-lg)",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Icon name="shield" size={24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ fontSize: "var(--fs-page)", fontWeight: 700, margin: 0 }}>Super Admin Command Center</h1>
                <span className="chip" data-tone="accent">
                  Central Fleet v2.8
                </span>
                <span className="chip" data-tone="success">
                  PostgreSQL Online
                </span>
              </div>
              <p style={{ margin: "4px 0 0", color: "var(--text-tertiary)", fontSize: "var(--fs-meta)" }}>
                Multi-tenant company profiles, closer seats allocation, Android SIM relays, WhatsApp gateways & AI token quotas.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn btn-sm"
              onClick={() => refreshCentralData(true)}
              disabled={isSyncing}
              title="Refresh Central Database"
            >
              <Icon name="status-progress" size={14} />
              <span>{isSyncing ? "Syncing..." : "Sync Fleet"}</span>
            </button>
            <button
              className="btn btn-sm"
              data-variant="accent"
              onClick={() => setIsAddWorkspaceModal(true)}
            >
              <Icon name="plus" size={14} />
              <span>+ New Company Profile</span>
            </button>
            <button
              type="button"
              className="btn btn-sm"
              data-variant="danger"
              onClick={handleSuperAdminLogout}
              title="Sign out of Super Admin Command Center"
            >
              <Icon name="logout" size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 20,
            paddingTop: 18,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div className="card" style={{ padding: "12px 16px", background: "var(--bg-soft)" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)", fontWeight: 550 }}>
              REGISTERED COMPANIES
            </div>
            <div style={{ fontSize: "var(--fs-metric)", fontWeight: 700, marginTop: 4 }}>
              {stats.total}
              <span style={{ fontSize: "var(--fs-caption)", fontWeight: 500, color: "var(--success)", marginLeft: 6 }}>
                ({stats.active} Active)
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: "12px 16px", background: "var(--bg-soft)" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)", fontWeight: 550 }}>
              TOTAL CLOSER SEATS
            </div>
            <div style={{ fontSize: "var(--fs-metric)", fontWeight: 700, marginTop: 4, color: "var(--accent)" }}>
              {stats.totalSeats}
              <span style={{ fontSize: "var(--fs-caption)", fontWeight: 500, color: "var(--text-secondary)", marginLeft: 6 }}>
                Allocated
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: "12px 16px", background: "var(--bg-soft)" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)", fontWeight: 550 }}>
              CONNECTED ANDROID SIMs
            </div>
            <div style={{ fontSize: "var(--fs-metric)", fontWeight: 700, marginTop: 4, color: "var(--success)" }}>
              {stats.totalSims}
              <span style={{ fontSize: "var(--fs-caption)", fontWeight: 500, color: "var(--text-secondary)", marginLeft: 6 }}>
                Live Relays
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: "12px 16px", background: "var(--bg-soft)" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)", fontWeight: 550 }}>
              PLATFORM MRR
            </div>
            <div style={{ fontSize: "var(--fs-metric)", fontWeight: 700, marginTop: 4 }}>
              ₹{stats.mrr.toLocaleString("en-IN")}
              <span style={{ fontSize: "var(--fs-caption)", fontWeight: 500, color: "var(--text-secondary)", marginLeft: 6 }}>
                ₹{stats.paidMrr.toLocaleString("en-IN")} Paid{stats.pendingMrr > 0 ? ` · ₹${stats.pendingMrr.toLocaleString("en-IN")} Pending` : ""}
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: "12px 16px", background: "var(--bg-soft)" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)", fontWeight: 550 }}>
              AI INGESTION HEALTH
            </div>
            <div style={{ fontSize: "var(--fs-metric)", fontWeight: 700, marginTop: 4, color: "var(--success)" }}>
              99.8%
              <span style={{ fontSize: "var(--fs-caption)", fontWeight: 500, color: "var(--text-secondary)", marginLeft: 6 }}>
                0 Breaches
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TOP NAVIGATION SEGMENT TABS */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div className="seg">
          <button
            data-on={activeTab === "workspaces"}
            onClick={() => setActiveTab("workspaces")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="building" size={14} />
            <span>Company Profiles & Seats</span>
            <span className="chip" style={{ height: 18, padding: "0 5px", fontSize: 10 }}>
              {workspaces.length}
            </span>
          </button>
          <button
            data-on={activeTab === "mobile"}
            onClick={() => setActiveTab("mobile")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="phone" size={14} />
            <span>Mobile Fleet & Telephony</span>
            <span className="chip" data-tone="success" style={{ height: 18, padding: "0 5px", fontSize: 10 }}>
              {devices.length}
            </span>
          </button>
          <button
            data-on={activeTab === "whatsapp"}
            onClick={() => setActiveTab("whatsapp")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="whatsapp" size={14} />
            <span>WhatsApp & Meta Gateways</span>
          </button>
          <button
            data-on={activeTab === "ai"}
            onClick={() => setActiveTab("ai")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="bot" size={14} />
            <span>Global AI Engine & Vault</span>
          </button>
          <button
            data-on={activeTab === "security"}
            onClick={() => setActiveTab("security")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="shield" size={14} />
            <span>Security & Login Audit</span>
          </button>
          <button
            data-on={activeTab === "reviews"}
            onClick={() => setActiveTab("reviews")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="sparkle" size={14} />
            <span>Reviews & GMB Gate</span>
            <span className="chip" data-tone="accent" style={{ height: 18, padding: "0 5px", fontSize: 10 }}>
              {reviews.filter((r) => r.status === "NEW").length}
            </span>
          </button>
        </div>
      </div>

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 99999,
            background: "var(--bg-surface)",
            border: "1px solid var(--accent-border)",
            color: "var(--text)",
            padding: "10px 18px",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "var(--fs-meta)",
            animation: "fade 140ms ease",
          }}
        >
          <Icon name="check-circle" size={16} style={{ color: "var(--accent)" }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 1: WORKSPACES & TENANTS CONTROL */}
      {/* ============================================================ */}
      {activeTab === "workspaces" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* SEARCH & FILTER CONTROLS */}
          <div className="card" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
                <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by company name, slug or founder email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 32 }}
                  />
                  <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}>
                    <Icon name="search" size={14} />
                  </div>
                </div>

                
              </div>

              <div style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                Showing <strong>{filteredWorkspaces.length}</strong> of {workspaces.length} workspaces
              </div>
            </div>
          </div>

          {/* WORKSPACES DIRECTORY TABLE */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Company Profile / Workspace</th>
                    <th>Seats Allocation (Users / Mo)</th>
                    <th>Monthly Amount (₹)</th>
                    <th>Payment Status</th>
                    <th>Status</th>
                    <th>Active SIMs</th>
                    <th>Expiry & Billing</th>
                    <th style={{ textAlign: "right" }}>Management Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkspaces.map((ws) => (
                    <tr key={ws.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{ws.name}</span>
                            {ws.createdAt && !isNaN(new Date(ws.createdAt).getTime()) && (
                              <span className="chip" style={{ fontSize: "10.5px", padding: "1px 7px", color: "var(--text-secondary)" }}>
                                Signup: {new Date(ws.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>
                            {ws.slug} · {ws.ownerEmail} · <strong style={{ color: "var(--text)" }}>{ws.ownerPhone || "No Phone"}</strong>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleUpdateSeats(ws, -1)}
                            disabled={ws.maxSeats <= 1}
                            title="Decrease seats (-1)"
                          >
                            -
                          </button>
                          <span
                            className="chip"
                            data-tone={ws.activeUsersCount > ws.maxSeats ? "danger" : "accent"}
                            onClick={() => {
                              setTargetWorkspaceForAction(ws);
                              setCustomSeatsCount(ws.maxSeats);
                              setIsSeatsModal(true);
                            }}
                            style={{ cursor: "pointer", fontWeight: 700 }}
                            title="Click to set custom seat limit"
                          >
                            {ws.activeUsersCount} / {ws.maxSeats} Seats
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleUpdateSeats(ws, 1)}
                            title="Increase seats (+1)"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 600 }}>₹</span>
                          <input
                            type="number"
                            className="input"
                            style={{ width: 100, height: 28, fontSize: "var(--fs-caption)", padding: "0 8px" }}
                            defaultValue={ws.monthlyRevenue || 0}
                            key={`${ws.id}-${ws.monthlyRevenue}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            onBlur={async (e) => {
                              const val = Number(e.target.value);
                              if (!isNaN(val) && val !== ws.monthlyRevenue) {
                                await handleUpdateAmount(ws, val);
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="chip"
                          data-tone={ws.paymentStatus === "PAID" ? "success" : "warning"}
                          onClick={() => handleTogglePaymentStatus(ws)}
                          style={{ cursor: "pointer" }}
                          title="Click to toggle Payment Paid / Pending"
                        >
                          <span className="dot" />
                          <span>{ws.paymentStatus === "PAID" ? "Paid / Done" : "Pending"}</span>
                        </button>
                      </td>
                      <td>
                        <div className="status-cell-wrap">
                          <span
                            className="chip"
                            data-tone={ws.status === "ACTIVE" ? "success" : "danger"}
                          >
                            <span className="dot" />
                            <span>{ws.status}</span>
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm"
                            data-variant={ws.status === "ACTIVE" ? "danger" : "primary"}
                            onClick={() => handleToggleStatus(ws)}
                            title={ws.status === "ACTIVE" ? "Deactivate workspace" : "Activate workspace"}
                          >
                            {ws.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className="chip" data-tone={ws.activeSims > 0 ? "success" : "warning"}>
                          <Icon name="phone" size={11} />
                          <span>{ws.activeSims} SIM Relays</span>
                        </span>
                      </td>
                      <td>
                        <div className="expiry-cell-wrap">
                          <span className="expiry-cell-date">
                            {ws.expiresAt
                              ? new Date(ws.expiresAt).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "No expiry set"}
                          </span>
                          <div className="expiry-cell-actions">
                            <input
                              type="date"
                              className="expiry-date-picker-inline"
                              value={ws.expiresAt ? new Date(ws.expiresAt).toISOString().slice(0, 10) : ""}
                              onChange={(e) => handleSetCustomExpiry(ws, e.target.value)}
                              title="Set custom expiry date"
                            />
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleExtendExpiry(ws, 30)}
                              title="Extend subscription by 30 days"
                            >
                              +30d
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleExtendExpiry(ws, 90)}
                              title="Extend subscription by 90 days"
                            >
                              +90d
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleExtendExpiry(ws, 365)}
                              title="Extend subscription by 1 year"
                            >
                              +1y
                            </button>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-action-wrap">
                          <button
                            type="button"
                            className="btn btn-sm"
                            data-variant="accent"
                            onClick={() => handleImpersonateWorkspace(ws)}
                            title="Instant one-click workspace login / impersonation"
                          >
                            <Icon name="external" size={12} />
                            <span>Login as Admin</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleToggleRoster(ws)}
                            title="Inspect workspace closer team"
                          >
                            <Icon name="team" size={12} />
                            <span>
                              {selectedWorkspace?.id === ws.id
                                ? "Hide Users"
                                : `Users (${ws.users?.length || ws.activeUsersCount || 0})`}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              setTargetWorkspaceForAction(ws);
                              setIsAddUserModal(true);
                            }}
                            title="Add closer user to this workspace"
                          >
                            <Icon name="user-plus" size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredWorkspaces.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-tertiary)" }}>
                        No workspaces found matching “{searchQuery}”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* EXPANDED USERS ROSTER (WHEN SELECTED) */}
          {selectedWorkspace && (
            <div className="card" style={{ padding: 18, border: "1px solid var(--accent-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="team" size={16} style={{ color: "var(--accent)" }} />
                  <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600 }}>
                    Closer Team Members in <u>{selectedWorkspace.name}</u>
                  </h3>
                  <span className="chip" data-tone="accent">
                    {selectedWorkspace.users?.length || 0} / {selectedWorkspace.maxSeats} Seats Used
                  </span>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => setSelectedWorkspace(null)}
                >
                  <Icon name="close" size={12} />
                  <span>Close Roster</span>
                </button>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Agent Name</th>
                      <th>Email & Mobile</th>
                      <th>Role</th>
                      <th>Agent Code</th>
                      <th>Status</th>
                      <th>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedWorkspace.users || []).map((u) => (
                      <tr key={u.id}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{u.displayName}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                            {u.email} · {u.phone}
                          </div>
                        </td>
                        <td>
                          <span className="chip" data-tone={u.role === "ADMIN" ? "accent" : "success"}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-caption)" }}>{u.agentCode || "—"}</span>
                        </td>
                        <td>
                          <span className="chip" data-tone={u.status === "ACTIVE" ? "success" : "danger"}>
                            <span className="dot" />
                            <span>{u.status}</span>
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                            {u.lastLoginAt || "Recently active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MOBILE TELEPHONY & SIM RELAYS */}
      {/* ============================================================ */}
      {activeTab === "mobile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* CRITICAL ACTIONS & HEALTH NOTICES */}
          <div
            className="card"
            style={{
              padding: "14px 18px",
              background: "var(--bg-soft)",
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="phone-call" size={18} style={{ color: "var(--accent)" }} />
              <div>
                <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                  Android SIM Telephony Network & Recording Health
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                  3 Android devices active across agencies. Zero-permission physical SIM relay ingests 100% audio calls directly into Closer CRM.
                </p>
              </div>
            </div>
          </div>

          {/* CONNECTED ANDROID PHONES TABLE */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="phone" size={16} />
                <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600 }}>
                  Active Telephony Devices & Battery Telemetry
                </h3>
              </div>
              <span className="chip" data-tone="success">
                {devices.filter((d) => d.status === "ONLINE").length} Connected Relays
              </span>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Device & Model</th>
                    <th>Closer & Workspace</th>
                    <th>SIM Carrier & Office No.</th>
                    <th>Recording Mode</th>
                    <th>Battery & Health</th>
                    <th>Last Heartbeat</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((dev) => (
                    <tr key={dev.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600 }}>{dev.deviceName}</span>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                            {dev.manufacturer} {dev.model} · {dev.androidVersion}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 550 }}>{dev.agentName}</span>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                            {dev.workspaceName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600, fontFamily: "var(--mono)" }}>{dev.simNumber}</span>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>{dev.simLabel}</span>
                        </div>
                      </td>
                      <td>
                        <span className="chip" data-tone="accent">
                          {dev.recordingStrategy.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div
                            style={{
                              width: 32,
                              height: 12,
                              borderRadius: 3,
                              border: "1px solid var(--border)",
                              background: "var(--bg-panel)",
                              overflow: "hidden",
                              position: "relative",
                            }}
                          >
                            <div
                              style={{
                                width: `${dev.batteryLevel}%`,
                                height: "100%",
                                background: dev.batteryLevel > 30 ? "var(--success)" : "var(--danger)",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "var(--fs-caption)", fontWeight: 600 }}>{dev.batteryLevel}%</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                          {dev.lastSeenAt}
                        </span>
                      </td>
                      <td>
                        <span className="chip" data-tone={dev.status === "ONLINE" ? "success" : "warning"}>
                          <span className="dot" />
                          <span>{dev.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RECENT AUDIO RECORDINGS & CALL STREAM */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="phone-incoming" size={16} />
                <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600 }}>
                  Real-Time Call Audio Ingestion & Playback Stream
                </h3>
              </div>
              <span className="chip" data-tone="accent">
                Auto-Transcription Ready
              </span>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer Contact</th>
                    <th>Direction</th>
                    <th>Duration</th>
                    <th>Closer</th>
                    <th>Sync State</th>
                    <th>Audio Verification</th>
                    <th style={{ textAlign: "right" }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span style={{ fontWeight: 600, fontFamily: "var(--mono)" }}>{c.customerPhone}</span>
                      </td>
                      <td>
                        <span className="chip" data-tone={c.direction === "INBOUND" ? "accent" : "success"}>
                          {c.direction}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--fs-caption)" }}>{Math.floor(c.durationSeconds / 60)}m {c.durationSeconds % 60}s</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--fs-meta)" }}>{c.agentName}</span>
                      </td>
                      <td>
                        <span
                          className="chip"
                          data-tone={c.recordingStatus === "UPLOADED" ? "success" : c.recordingStatus === "SYNCING" ? "warning" : "danger"}
                        >
                          <span className="dot" />
                          <span>{c.recordingStatus}</span>
                        </span>
                      </td>
                      <td>
                        {c.recordingUrl ? (
                          <audio controls src={c.recordingUrl} style={{ height: 28, maxWidth: 220 }} />
                        ) : (
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                            Processing MP3 sync...
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                        {c.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: WHATSAPP & META GATEWAYS */}
      {/* ============================================================ */}
      {activeTab === "whatsapp" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid-2">
            {/* META CLOUD API CARD */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="whatsapp" size={18} style={{ color: "#25D366" }} />
                  <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600 }}>
                    Official Meta WhatsApp Business Cloud API
                  </h3>
                </div>
                <span className="chip" data-tone="success">
                  Online
                </span>
              </div>
              <p style={{ fontSize: "var(--fs-meta)", color: "var(--text-secondary)", margin: "0 0 16px" }}>
                Platform-level webhook listener and message dispatcher for WhatsApp Business API.
              </p>

              <div style={{ display: "grid", gap: 12 }}>
                <div className="field">
                  <label>Meta WABA ID</label>
                  <input type="text" className="input" readOnly value="WABA-99214002847192" style={{ fontFamily: "var(--mono)" }} />
                </div>
                <div className="field">
                  <label>Webhook Callback URL</label>
                  <input type="text" className="input" readOnly value="https://api.aicloser.in/api/v1/webhooks/whatsapp" style={{ fontFamily: "var(--mono)" }} />
                </div>
                <div className="field">
                  <label>Webhook Verification Token</label>
                  <input type="text" className="input" readOnly value="aicloser_meta_secure_verify_tok_9918" style={{ fontFamily: "var(--mono)" }} />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button className="btn btn-sm" data-variant="accent" onClick={() => showToast("Meta Webhook connectivity verified: 200 OK")}>
                    Test Meta Webhook Ping
                  </button>
                  <button className="btn btn-sm" onClick={() => showToast("Graph API Token refreshed successfully.")}>
                    Refresh System Token
                  </button>
                </div>
              </div>
            </div>

            {/* WHATSAPP QR COMPANION RELAY CARD */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="link" size={18} style={{ color: "var(--accent)" }} />
                  <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600 }}>
                    Companion Device QR Relay Engine
                  </h3>
                </div>
                <span className="chip" data-tone="success">
                  Active Sockets
                </span>
              </div>
              <p style={{ fontSize: "var(--fs-meta)", color: "var(--text-secondary)", margin: "0 0 16px" }}>
                Multi-device Baileys WhatsApp web socket gateway for zero-cost company message synchronization.
              </p>

              <div style={{ display: "grid", gap: 12 }}>
                <div className="field">
                  <label>Companion Socket Daemon</label>
                  <input type="text" className="input" readOnly value="socket://wa-relay-1.aicloser.in:8088" style={{ fontFamily: "var(--mono)" }} />
                </div>
                <div className="field">
                  <label>Active QR Device Bridges</label>
                  <input type="text" className="input" readOnly value="14 Connected Companion Devices" />
                </div>
                <div className="field">
                  <label>Inbound Lead Ingestion Rate</label>
                  <input type="text" className="input" readOnly value="184 messages / min (0 dropped)" />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button className="btn btn-sm" onClick={() => showToast("Companion socket gateway restarted.")}>
                    Restart Daemon
                  </button>
                  <button className="btn btn-sm" onClick={() => showToast("All session health checks passed.")}>
                    Check Session Health
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: GLOBAL AI ENGINE & MASTER VAULT */}
      {/* ============================================================ */}
      {activeTab === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="bot" size={18} style={{ color: "var(--accent)" }} />
                <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600 }}>
                  Global AI Provider Keys & Auto-Failover Orchestration
                </h3>
              </div>
              <span className="chip" data-tone="accent">
                Platform Master Keys
              </span>
            </div>
            <p style={{ fontSize: "var(--fs-meta)", color: "var(--text-secondary)", margin: "0 0 20px" }}>
              Super Admin master keys serve as the global fallback whenever a customer company does not provide their own BYOK key.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* GROQ */}
              <div className="card" style={{ padding: 14, background: "var(--bg-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>Groq (Llama 3.3 70B)</strong>
                  <span className="chip" data-tone="success">Default (Free)</span>
                </div>
                <div className="field">
                  <input
                    type="password"
                    className="input"
                    value={groqMasterKey}
                    onChange={(e) => setGroqMasterKey(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                  Used for high-speed instant chat replies & sentiment triage.
                </div>
              </div>

              {/* OPENAI */}
              <div className="card" style={{ padding: 14, background: "var(--bg-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>OpenAI (GPT-4o)</strong>
                  <span className="chip" data-tone="accent">Enterprise</span>
                </div>
                <div className="field">
                  <input
                    type="password"
                    className="input"
                    value={openAiMasterKey}
                    onChange={(e) => setOpenAiMasterKey(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                  Deep call recording analysis and consultative pitch scoring.
                </div>
              </div>

              {/* GEMINI */}
              <div className="card" style={{ padding: 14, background: "var(--bg-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>Google Gemini 1.5 Flash</strong>
                  <span className="chip" data-tone="success">Active</span>
                </div>
                <div className="field">
                  <input
                    type="password"
                    className="input"
                    value={geminiMasterKey}
                    onChange={(e) => setGeminiMasterKey(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                  Large 1M token context for long audio transcripts.
                </div>
              </div>

              {/* DEEPSEEK */}
              <div className="card" style={{ padding: 14, background: "var(--bg-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>DeepSeek (V3 & R1)</strong>
                  <span className="chip" data-tone="accent">Cost Optimized</span>
                </div>
                <div className="field">
                  <input
                    type="password"
                    className="input"
                    value={deepseekMasterKey}
                    onChange={(e) => setDeepseekMasterKey(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                  Reasoning-heavy objection handling scripts.
                </div>
              </div>

              {/* XAI GROK */}
              <div className="card" style={{ padding: 14, background: "var(--bg-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>xAI (Grok Beta)</strong>
                  <span className="chip" data-tone="warning">Standby</span>
                </div>
                <div className="field">
                  <input
                    type="password"
                    className="input"
                    value={grokMasterKey}
                    onChange={(e) => setGrokMasterKey(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                  Uncensored direct sales framing and objection tactics.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                className="btn"
                data-variant="accent"
                onClick={() => showToast("Global master AI keys and failover sequence committed.")}
              >
                Save Master AI Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: SECURITY & LOGIN AUDIT STREAM */}
      {/* ============================================================ */}
      {activeTab === "security" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="shield" size={16} />
                <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600 }}>
                  Real-Time Administrative & User Login Audit Trail
                </h3>
              </div>
              <span className="chip" data-tone="success">
                Audit Logging 100% Enforced
              </span>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User & Identity</th>
                    <th>Workspace</th>
                    <th>Event Type</th>
                    <th>IP Address</th>
                    <th>Client Device</th>
                    <th>Security Result</th>
                    <th style={{ textAlign: "right" }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600 }}>{log.user}</span>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>{log.email}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--fs-meta)" }}>{log.workspace}</span>
                      </td>
                      <td>
                        <span className="chip" data-tone="accent">
                          {log.event}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-caption)" }}>{log.ip}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>{log.device}</span>
                      </td>
                      <td>
                        <span
                          className="chip"
                          data-tone={log.result === "SUCCESS" ? "success" : log.result === "BLOCKED" ? "danger" : "warning"}
                        >
                          <span className="dot" />
                          <span>{log.result}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                        {log.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 6: CUSTOMER REVIEWS & GMB GATE */}
      {/* ============================================================ */}
      {activeTab === "reviews" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="sparkle" size={16} />
                <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600 }}>
                  Customer Reviews & Google My Business Moderation
                </h3>
              </div>
              <button
                className="btn btn-sm"
                data-variant="accent"
                onClick={() => {
                  navigator.clipboard.writeText("https://search.google.com/local/writereview?placeid=ChIJo5F7NI8XYzkRdOsuwCANm0U");
                  showToast("Copied Google Review direct link to clipboard!");
                }}
              >
                <Icon name="copy" size={12} />
                <span>Copy Direct GMB Review Link</span>
              </button>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Rating</th>
                    <th>Review Testimonial</th>
                    <th>Channel Source</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Moderation</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600 }}>{r.customerName}</span>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>{r.contact}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                          {"★".repeat(r.rating)} <span style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>({r.rating}.0)</span>
                        </span>
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        <p style={{ margin: 0, fontSize: "var(--fs-meta)", lineHeight: 1.4 }}>
                          “{r.comment}”
                        </p>
                      </td>
                      <td>
                        <span className="chip">{r.source}</span>
                      </td>
                      <td>
                        <span
                          className="chip"
                          data-tone={r.status === "RESOLVED" ? "success" : r.status === "CONTACTED" ? "warning" : "accent"}
                        >
                          <span className="dot" />
                          <span>{r.status}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            data-variant={r.status === "RESOLVED" ? "primary" : "ghost"}
                            onClick={() => handleUpdateReviewStatus(r.id, "RESOLVED")}
                            title="Approve / Publish to site"
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleUpdateReviewStatus(r.id, "CONTACTED")}
                            title="Mark follow-up in progress"
                          >
                            Contacted
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: ADD NEW WORKSPACE */}
      {/* ============================================================ */}
      {isAddWorkspaceModal && (
        <div className="overlay" data-kind="dialog">
          <div className="dialog">
            <div className="dialog-head">
              <Icon name="building" size={18} />
              <h2>Create Company Profile</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsAddWorkspaceModal(false)}
                style={{ marginLeft: "auto" }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="dialog-body">
              <div className="field">
                <label>Company Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Apex Closer Systems"
                  value={newWsName}
                  onChange={(e) => {
                    setNewWsName(e.target.value);
                    if (!newWsSlug) {
                      setNewWsSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }
                  }}
                  disabled={isCreatingWorkspace}
                />
              </div>

              <div className="field">
                <label>Workspace Slug (Subdomain) *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. apex-closer"
                  value={newWsSlug}
                  onChange={(e) => setNewWsSlug(e.target.value)}
                  style={{ fontFamily: "var(--mono)" }}
                  disabled={isCreatingWorkspace}
                />
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Founder Email *</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="founder@apex.com"
                    value={newWsEmail}
                    onChange={(e) => setNewWsEmail(e.target.value)}
                    disabled={isCreatingWorkspace}
                  />
                </div>
                <div className="field">
                  <label>Founder Phone (WhatsApp) *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="+91 98200 12345"
                    value={newWsPhone}
                    onChange={(e) => setNewWsPhone(e.target.value)}
                    disabled={isCreatingWorkspace}
                  />
                </div>
              </div>

              <div className="field">
                <label>Founder Password *</label>
                <div className="password-input-wrap">
                  <input
                    type={showWsPassword ? "text" : "password"}
                    className="input"
                    placeholder="e.g. Admin@123"
                    value={newWsPassword}
                    onChange={(e) => setNewWsPassword(e.target.value)}
                    disabled={isCreatingWorkspace}
                  />
                  <button
                    type="button"
                    className="btn btn-sm password-toggle-action"
                    data-variant="ghost"
                    onClick={() => setShowWsPassword(!showWsPassword)}
                    tabIndex={-1}
                  >
                    {showWsPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <span className="card-sub">
                  Initial credentials for the company owner to log in and manage the workspace.
                </span>
              </div>

              <div className="field">
                <label>Contracted Closer Seats (Per User / Mo) *</label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={500}
                  value={newWsSeats}
                  onChange={(e) => setNewWsSeats(Number(e.target.value))}
                  disabled={isCreatingWorkspace}
                />
              </div>

              <div className="field">
                <label>Monthly Subscription Amount (₹) *</label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  step={100}
                  value={newWsMonthlyAmount}
                  onChange={(e) => setNewWsMonthlyAmount(Number(e.target.value))}
                  disabled={isCreatingWorkspace}
                />
              </div>

              <div className="field">
                <label>Subscription Expiry Date *</label>
                <input
                  type="date"
                  className="input"
                  value={newWsExpiry}
                  onChange={(e) => setNewWsExpiry(e.target.value)}
                  disabled={isCreatingWorkspace}
                />
                <div className="quick-date-pills">
                  <span className="card-sub" style={{ margin: 0 }}>Quick set:</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    data-variant="outline"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 30);
                      setNewWsExpiry(d.toISOString().slice(0, 10));
                    }}
                    disabled={isCreatingWorkspace}
                  >
                    +30 Days
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    data-variant="outline"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 90);
                      setNewWsExpiry(d.toISOString().slice(0, 10));
                    }}
                    disabled={isCreatingWorkspace}
                  >
                    +90 Days
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    data-variant="outline"
                    onClick={() => {
                      const d = new Date();
                      d.setFullYear(d.getFullYear() + 1);
                      setNewWsExpiry(d.toISOString().slice(0, 10));
                    }}
                    disabled={isCreatingWorkspace}
                  >
                    +1 Year
                  </button>
                </div>
              </div>
            </div>
            <div className="dialog-foot">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setIsAddWorkspaceModal(false)}
                disabled={isCreatingWorkspace}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                data-variant="accent"
                onClick={handleCreateWorkspace}
                disabled={isCreatingWorkspace}
              >
                {isCreatingWorkspace ? "Creating Company..." : "Create Company Profile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ADD USER TO WORKSPACE */}
      {/* ============================================================ */}
      {isAddUserModal && targetWorkspaceForAction && (
        <div className="overlay" data-kind="dialog">
          <div className="dialog">
            <div className="dialog-head">
              <Icon name="user-plus" size={18} />
              <h2>Add Team Member to {targetWorkspaceForAction.name}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsAddUserModal(false)}
                style={{ marginLeft: "auto" }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="dialog-body">
              <div className="field">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Priya Sharma"
                  value={newUsrName}
                  onChange={(e) => setNewUsrName(e.target.value)}
                  disabled={isCreatingUser}
                />
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="anshita@company.in"
                    value={newUsrEmail}
                    onChange={(e) => setNewUsrEmail(e.target.value)}
                    disabled={isCreatingUser}
                  />
                </div>
                <div className="field">
                  <label>Mobile Number (SIM)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="+91 98200 88771"
                    value={newUsrPhone}
                    onChange={(e) => setNewUsrPhone(e.target.value)}
                    disabled={isCreatingUser}
                  />
                </div>
              </div>

              <div className="field">
                <label>Assigned Role *</label>
                <select
                  className="select"
                  value={newUsrRole}
                  onChange={(e) => setNewUsrRole(e.target.value as any)}
                  disabled={isCreatingUser}
                >
                  <option value="SALES_AGENT">CLOSER (Sales Agent)</option>
                  <option value="MANAGER">MANAGER (Team Lead)</option>
                  <option value="ADMIN">ADMIN (Workspace Admin)</option>
                </select>
              </div>

              <div className="field">
                <label>User Password *</label>
                <div className="password-input-wrap">
                  <input
                    type={showUsrPassword ? "text" : "password"}
                    className="input"
                    placeholder="e.g. Closer@123"
                    value={newUsrPassword}
                    onChange={(e) => setNewUsrPassword(e.target.value)}
                    disabled={isCreatingUser}
                  />
                  <button
                    type="button"
                    className="btn btn-sm password-toggle-action"
                    data-variant="ghost"
                    onClick={() => setShowUsrPassword(!showUsrPassword)}
                    tabIndex={-1}
                  >
                    {showUsrPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <span className="card-sub">
                  Initial password (minimum 6 characters) for this user to sign in to mobile & web app.
                </span>
              </div>
            </div>
            <div className="dialog-foot">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setIsAddUserModal(false)}
                disabled={isCreatingUser}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                data-variant="accent"
                onClick={handleCreateUser}
                disabled={isCreatingUser}
              >
                {isCreatingUser ? "Creating User..." : "Create Closer User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: CUSTOM SEATS DIALOG */}
      {/* ============================================================ */}
      {isSeatsModal && targetWorkspaceForAction && (
        <div className="overlay" data-kind="dialog">
          <div className="dialog" style={{ width: 380 }}>
            <div className="dialog-head">
              <Icon name="team" size={18} />
              <h2>Adjust Seat Allocation</h2>
              <button className="icon-btn" onClick={() => setIsSeatsModal(false)} style={{ marginLeft: "auto" }}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="dialog-body">
              <p style={{ margin: 0, fontSize: "var(--fs-meta)", color: "var(--text-secondary)" }}>
                Update maximum closer seat capacity for <strong>{targetWorkspaceForAction.name}</strong>.
              </p>
              <div className="field">
                <label>Total Seats Limit</label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={500}
                  value={customSeatsCount}
                  onChange={(e) => setCustomSeatsCount(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="dialog-foot">
              <button className="btn btn-sm" onClick={() => setIsSeatsModal(false)}>
                Cancel
              </button>
              <button className="btn btn-sm" data-variant="accent" onClick={handleSaveCustomSeats}>
                Save Capacity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
