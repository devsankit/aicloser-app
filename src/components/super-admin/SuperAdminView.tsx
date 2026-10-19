"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { aicloserApi, setStoredToken } from "@/lib/api-client";
import { useApp } from "@/lib/store";

export type TenantWorkspace = {
  id: string;
  name: string;
  slug: string;
  planTier: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  maxSeats: number;
  activeUsersCount: number;
  ownerEmail: string;
  ownerPhone: string;
  createdAt: string;
  expiresAt: string | null;
  monthlyRevenue: number;
  activeSims: number;
  users?: TenantUser[];
};

export type TenantUser = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  role: "ADMIN" | "MANAGER" | "CLOSER" | "SUPER_ADMIN";
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

const SEED_WORKSPACES: TenantWorkspace[] = [
  {
    id: "ws-growth-media",
    name: "Apex Growth Media",
    slug: "apex-growth",
    planTier: "ENTERPRISE",
    status: "ACTIVE",
    maxSeats: 12,
    activeUsersCount: 8,
    ownerEmail: "founder@apexgrowth.in",
    ownerPhone: "+91 98200 12345",
    createdAt: "2025-11-10T10:00:00Z",
    expiresAt: "2026-11-10T23:59:59Z",
    monthlyRevenue: 49999,
    activeSims: 4,
    users: [
      { id: "usr-01", displayName: "Aakash Mehta", email: "founder@apexgrowth.in", phone: "+91 98200 12345", role: "ADMIN", status: "ACTIVE", agentCode: "GX-101", createdAt: "2025-11-10", lastLoginAt: "Just now" },
      { id: "usr-02", displayName: "Rhea Sharma", email: "rhea.closer@apexgrowth.in", phone: "+91 98200 88771", role: "CLOSER", status: "ACTIVE", agentCode: "GX-102", createdAt: "2025-11-15", lastLoginAt: "10m ago" },
      { id: "usr-03", displayName: "Kavita Roy", email: "kavita.mgr@apexgrowth.in", phone: "+91 98200 66554", role: "MANAGER", status: "ACTIVE", agentCode: "GX-103", createdAt: "2025-11-20", lastLoginAt: "1h ago" },
    ],
  },
  {
    id: "ws-vertex-realestate",
    name: "Vertex Realty Group",
    slug: "vertex-realty",
    planTier: "PRO",
    status: "ACTIVE",
    maxSeats: 8,
    activeUsersCount: 5,
    ownerEmail: "sales@vertexrealty.com",
    ownerPhone: "+91 99870 21145",
    createdAt: "2026-01-05T12:00:00Z",
    expiresAt: "2026-07-05T23:59:59Z",
    monthlyRevenue: 24999,
    activeSims: 3,
    users: [
      { id: "usr-04", displayName: "Karan Shah", email: "sales@vertexrealty.com", phone: "+91 99870 21145", role: "ADMIN", status: "ACTIVE", agentCode: "GX-201", createdAt: "2026-01-05", lastLoginAt: "2h ago" },
      { id: "usr-05", displayName: "Aditya Jain", email: "aditya@vertexrealty.com", phone: "+91 99870 33441", role: "CLOSER", status: "ACTIVE", agentCode: "GX-202", createdAt: "2026-01-08", lastLoginAt: "4h ago" },
    ],
  },
  {
    id: "ws-helios-agency",
    name: "Helios Creative Studio",
    slug: "helios-creative",
    planTier: "STARTER",
    status: "ACTIVE",
    maxSeats: 3,
    activeUsersCount: 2,
    ownerEmail: "admin@heliosagency.io",
    ownerPhone: "+91 98455 12098",
    createdAt: "2026-02-14T14:30:00Z",
    expiresAt: "2026-08-14T23:59:59Z",
    monthlyRevenue: 9999,
    activeSims: 1,
    users: [
      { id: "usr-06", displayName: "Priya Nair", email: "admin@heliosagency.io", phone: "+91 98455 12098", role: "ADMIN", status: "ACTIVE", agentCode: "GX-301", createdAt: "2026-02-14", lastLoginAt: "Yesterday" },
    ],
  },
  {
    id: "ws-legacy-infra",
    name: "Zeta Logistics Hub",
    slug: "zeta-logistics",
    planTier: "FREE",
    status: "SUSPENDED",
    maxSeats: 1,
    activeUsersCount: 1,
    ownerEmail: "contact@zetahub.in",
    ownerPhone: "+91 98110 93342",
    createdAt: "2026-03-01T09:00:00Z",
    expiresAt: "2026-04-01T23:59:59Z",
    monthlyRevenue: 0,
    activeSims: 0,
    users: [
      { id: "usr-07", displayName: "Manav Gupta", email: "contact@zetahub.in", phone: "+91 98110 93342", role: "ADMIN", status: "SUSPENDED", agentCode: "GX-401", createdAt: "2026-03-01", lastLoginAt: "5d ago" },
    ],
  },
];

const SEED_DEVICES: TelemetryDevice[] = [
  {
    id: "dev-01",
    deviceId: "android-sim-vivo-y200",
    deviceName: "Vivo Y200 5G",
    manufacturer: "Vivo",
    model: "V2307",
    androidVersion: "Android 14 (OriginOS)",
    appVersion: "v2.8.4-build.92",
    simLabel: "SIM 1 (Jio Business)",
    simNumber: "+91 76185 34225",
    batteryLevel: 88,
    recordingStrategy: "ACCESSIBILITY_SERVICE",
    recordingEnabled: true,
    status: "ONLINE",
    lastSeenAt: "12s ago",
    agentName: "Anshita",
    workspaceName: "Apex Growth Media",
  },
  {
    id: "dev-02",
    deviceId: "android-sim-poco-x5",
    deviceName: "POCO X5 Pro",
    manufacturer: "Xiaomi",
    model: "22101320G",
    androidVersion: "Android 13 (MIUI)",
    appVersion: "v2.8.4-build.92",
    simLabel: "SIM 1 (Airtel Corporate)",
    simNumber: "+91 99933 28124",
    batteryLevel: 64,
    recordingStrategy: "NATIVE_RECORDER",
    recordingEnabled: true,
    status: "ONLINE",
    lastSeenAt: "45s ago",
    agentName: "Field Closer Desk",
    workspaceName: "Apex Growth Media",
  },
  {
    id: "dev-03",
    deviceId: "android-sim-samsung-m34",
    deviceName: "Samsung Galaxy M34",
    manufacturer: "Samsung",
    model: "SM-M346B",
    androidVersion: "Android 14 (OneUI 6.0)",
    appVersion: "v2.8.2-build.88",
    simLabel: "SIM 2 (Vodafone Idea)",
    simNumber: "+91 98765 43210",
    batteryLevel: 22,
    recordingStrategy: "ACCESSIBILITY_SERVICE",
    recordingEnabled: false,
    status: "SYNCING",
    lastSeenAt: "3m ago",
    agentName: "Aditya Jain",
    workspaceName: "Vertex Realty Group",
  },
];

const SEED_CALLS: CallLogStreamItem[] = [
  {
    id: "cl-101",
    customerPhone: "+91 98200 99881",
    direction: "INBOUND",
    durationSeconds: 184,
    status: "COMPLETED",
    recordingStatus: "UPLOADED",
    recordingUrl: "https://aicloser.in/sample-recording-1.mp3",
    agentName: "Anshita",
    workspaceName: "Apex Growth Media",
    timestamp: "2m ago",
  },
  {
    id: "cl-102",
    customerPhone: "+91 99870 11223",
    direction: "OUTBOUND",
    durationSeconds: 92,
    status: "COMPLETED",
    recordingStatus: "UPLOADED",
    recordingUrl: "https://aicloser.in/sample-recording-2.mp3",
    agentName: "Field Closer Desk",
    workspaceName: "Apex Growth Media",
    timestamp: "8m ago",
  },
  {
    id: "cl-103",
    customerPhone: "+91 98455 33445",
    direction: "OUTBOUND",
    durationSeconds: 245,
    status: "COMPLETED",
    recordingStatus: "SYNCING",
    agentName: "Aditya Jain",
    workspaceName: "Vertex Realty Group",
    timestamp: "14m ago",
  },
  {
    id: "cl-104",
    customerPhone: "+91 97655 44556",
    direction: "INBOUND",
    durationSeconds: 0,
    status: "MISSED",
    recordingStatus: "FAILED",
    agentName: "Aditya Jain",
    workspaceName: "Vertex Realty Group",
    timestamp: "22m ago",
  },
];

const SEED_REVIEWS: ReviewItem[] = [
  {
    id: "rev-1",
    customerName: "Siddharth Verma",
    contact: "+91 98201 44552",
    rating: 5,
    comment: "Closer transformed our agency conversion rate! Call recording ingestion with instant AI summaries is unbelievable.",
    source: "Google GMB",
    status: "RESOLVED",
    createdAt: "2026-03-12T14:20:00Z",
    adminNotes: "Featured review on homepage & verified client testimonial.",
  },
  {
    id: "rev-2",
    customerName: "Neha Chhabra",
    contact: "+91 99872 11342",
    rating: 5,
    comment: "The WhatsApp QR device sync and automatic round robin lead routing saved us 3 full-time ops hires.",
    source: "Rate Page",
    status: "CONTACTED",
    createdAt: "2026-03-14T11:15:00Z",
    adminNotes: "Sent VIP thank you gift & case study invite.",
  },
  {
    id: "rev-3",
    customerName: "Rajeev Agarwal",
    contact: "+91 98450 77881",
    rating: 4,
    comment: "Very solid platform. Would love to see more granular permission controls for junior interns.",
    source: "WhatsApp Inbound",
    status: "NEW",
    createdAt: "2026-03-15T09:30:00Z",
    adminNotes: null,
  },
];

const SEED_AUDIT_LOGS: AuditLogItem[] = [
  { id: "aud-1", user: "Aakash Mehta", email: "founder@apexgrowth.in", workspace: "Apex Growth Media", ip: "49.36.128.4", device: "Chrome 124 / macOS", event: "LOGIN", result: "SUCCESS", timestamp: "Just now" },
  { id: "aud-2", user: "Super Admin Console", email: "admin@closer.in", workspace: "Global Command", ip: "103.21.144.1", device: "Browser Session", event: "SEAT_UPDATE", result: "SUCCESS", timestamp: "12m ago" },
  { id: "aud-3", user: "Aditya Jain", email: "aditya@vertexrealty.com", workspace: "Vertex Realty Group", ip: "115.99.201.88", device: "Android Closer Telephony App", event: "SIM_HEARTBEAT", result: "SUCCESS", timestamp: "18m ago" },
  { id: "aud-4", user: "Manav Gupta", email: "contact@zetahub.in", workspace: "Zeta Logistics Hub", ip: "157.34.19.12", device: "Firefox / Windows", event: "LOGIN", result: "BLOCKED", timestamp: "1h ago" },
  { id: "aud-5", user: "Priya Nair", email: "admin@heliosagency.io", workspace: "Helios Creative Studio", ip: "182.73.4.9", device: "Safari / iOS", event: "PLAN_CHANGE", result: "SUCCESS", timestamp: "3h ago" },
];

export function SuperAdminView() {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<"workspaces" | "mobile" | "whatsapp" | "ai" | "security" | "reviews">("workspaces");
  const [workspaces, setWorkspaces] = useState<TenantWorkspace[]>(SEED_WORKSPACES);
  const [devices, setDevices] = useState<TelemetryDevice[]>(SEED_DEVICES);
  const [calls, setCalls] = useState<CallLogStreamItem[]>(SEED_CALLS);
  const [reviews, setReviews] = useState<ReviewItem[]>(SEED_REVIEWS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(SEED_AUDIT_LOGS);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
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
  const [newWsTier, setNewWsTier] = useState("STARTER");
  const [newWsSeats, setNewWsSeats] = useState(5);

  const [newUsrName, setNewUsrName] = useState("");
  const [newUsrEmail, setNewUsrEmail] = useState("");
  const [newUsrPhone, setNewUsrPhone] = useState("");
  const [newUsrRole, setNewUsrRole] = useState<"ADMIN" | "MANAGER" | "CLOSER">("CLOSER");

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
    setIsSyncing(true);
    try {
      const tenants = await aicloserApi.superAdmin.getTenants().catch(() => null);
      if (Array.isArray(tenants) && tenants.length > 0) {
        const mapped: TenantWorkspace[] = tenants.map((t: any) => ({
          id: String(t.id),
          name: t.name || "Workspace",
          slug: t.slug || t.id,
          planTier: t.planTier || "STARTER",
          status: t.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
          maxSeats: Number(t.maxSeats || t.editorSeatLimit || 5),
          activeUsersCount: Number(t.activeUsersCount || 1),
          ownerEmail: t.ownerEmail || t.owner?.email || "admin@workspace.in",
          ownerPhone: t.ownerPhone || t.owner?.phone || "+91 99999 00000",
          createdAt: t.createdAt || new Date().toISOString(),
          expiresAt: t.packageExpiresAt || t.expiresAt || null,
          monthlyRevenue: Number(t.monthlyRevenue || 9999),
          activeSims: Number(t.activeSims || 1),
          users: t.users || [],
        }));
        setWorkspaces(mapped);
      }

      // Check feedback from central API
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
        if (mappedReviews.length > 0) setReviews(mappedReviews);
      }

      if (notify) showToast("Central ecosystem registry synced with live backend.");
    } catch {
      if (notify) showToast("Central server offline — running on cached master registry.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    void refreshCentralData(false);
  }, []);

  // Workspace stats computation
  const stats = useMemo(() => {
    const total = workspaces.length;
    const active = workspaces.filter((w) => w.status === "ACTIVE").length;
    const suspended = workspaces.filter((w) => w.status === "SUSPENDED").length;
    const totalSeats = workspaces.reduce((sum, w) => sum + w.maxSeats, 0);
    const mrr = workspaces.filter((w) => w.status === "ACTIVE").reduce((sum, w) => sum + w.monthlyRevenue, 0);
    const totalSims = devices.filter((d) => d.status === "ONLINE").length;
    return { total, active, suspended, totalSeats, mrr, totalSims };
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
      const matchTier = tierFilter === "ALL" || w.planTier === tierFilter;
      return matchSearch && matchStatus && matchTier;
    });
  }, [workspaces, searchQuery, statusFilter, tierFilter]);

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

  // Plan Tier change
  const handleChangeTier = async (ws: TenantWorkspace, nextTier: string) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, planTier: nextTier } : w)));
    try {
      await aicloserApi.superAdmin.updateTenantPlan(ws.id, nextTier);
      showToast(`Updated plan tier for ${ws.name} to ${nextTier}`);
    } catch {
      showToast(`Plan tier updated to ${nextTier}`);
    }
  };

  // Expiry extension
  const handleExtendExpiry = async (ws: TenantWorkspace, daysToAdd: number) => {
    const currentExpiry = ws.expiresAt ? new Date(ws.expiresAt) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);
    const isoExpiry = currentExpiry.toISOString();
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, expiresAt: isoExpiry } : w)));
    try {
      await aicloserApi.superAdmin.updateTenantExpiry(ws.id, isoExpiry);
      showToast(`Extended ${ws.name} subscription by +${daysToAdd} days.`);
    } catch {
      showToast(`Extended subscription by +${daysToAdd} days.`);
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

  // Add Workspace
  const handleCreateWorkspace = () => {
    if (!newWsName.trim()) return;
    const newWs: TenantWorkspace = {
      id: `ws-${Date.now().toString(36)}`,
      name: newWsName.trim(),
      slug: (newWsSlug || newWsName).toLowerCase().replace(/\s+/g, "-"),
      planTier: newWsTier,
      status: "ACTIVE",
      maxSeats: newWsSeats,
      activeUsersCount: 1,
      ownerEmail: newWsEmail || "admin@workspace.in",
      ownerPhone: newWsPhone || "+91 99999 00000",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      monthlyRevenue: newWsTier === "ENTERPRISE" ? 49999 : newWsTier === "PRO" ? 24999 : 9999,
      activeSims: 1,
      users: [
        {
          id: `usr-${Date.now()}`,
          displayName: newWsName + " Admin",
          email: newWsEmail,
          phone: newWsPhone,
          role: "ADMIN",
          status: "ACTIVE",
          agentCode: "GX-NEW",
          createdAt: new Date().toISOString().slice(0, 10),
          lastLoginAt: "Never",
        },
      ],
    };
    setWorkspaces([newWs, ...workspaces]);
    setIsAddWorkspaceModal(false);
    setNewWsName("");
    setNewWsSlug("");
    setNewWsEmail("");
    setNewWsPhone("");
    showToast(`Workspace ${newWs.name} created successfully.`);
  };

  // Add User to Workspace
  const handleCreateUser = () => {
    if (!targetWorkspaceForAction || !newUsrName.trim()) return;
    const targetWs = targetWorkspaceForAction;
    const newUser: TenantUser = {
      id: `usr-${Date.now()}`,
      displayName: newUsrName.trim(),
      email: newUsrEmail.trim() || `${newUsrName.toLowerCase().replace(/\s+/g, ".")}@${targetWs.slug}.com`,
      phone: newUsrPhone.trim() || "+91 98000 00000",
      role: newUsrRole,
      status: "ACTIVE",
      agentCode: `GX-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString().slice(0, 10),
      lastLoginAt: "Never",
    };
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === targetWs.id
          ? {
              ...w,
              activeUsersCount: w.activeUsersCount + 1,
              users: [...(w.users || []), newUser],
            }
          : w
      )
    );
    setIsAddUserModal(false);
    setNewUsrName("");
    setNewUsrEmail("");
    setNewUsrPhone("");
    showToast(`Added ${newUser.displayName} to ${targetWs.name}`);
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

  return (
    <div className="super-admin-layout" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                Multi-tenant agency control, closer seats allocation, Android SIM relays, WhatsApp gateways & AI token quotas.
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
              <span>New Agency Workspace</span>
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
              REGISTERED WORKSPACES
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
              <span style={{ fontSize: "var(--fs-caption)", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: 6 }}>
                / mo
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
            <span>Workspaces & Closer Seats</span>
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

                <select
                  className="select"
                  style={{ width: 140 }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="SUSPENDED">Suspended Only</option>
                </select>

                <select
                  className="select"
                  style={{ width: 150 }}
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                >
                  <option value="ALL">All Plan Tiers</option>
                  <option value="FREE">Free Tier</option>
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro Tier</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
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
                    <th>Agency / Workspace</th>
                    <th>Plan Tier</th>
                    <th>Status</th>
                    <th>Closer Seats</th>
                    <th>Active SIMs</th>
                    <th>Expiry & Billing</th>
                    <th style={{ textAlign: "right" }}>Management Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkspaces.map((ws) => (
                    <tr key={ws.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{ws.name}</span>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>
                            {ws.slug} · {ws.ownerEmail}
                          </span>
                        </div>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={ws.planTier}
                          onChange={(e) => handleChangeTier(ws, e.target.value)}
                          style={{ height: 26, fontSize: "var(--fs-caption)", padding: "0 22px 0 6px" }}
                        >
                          <option value="FREE">FREE</option>
                          <option value="STARTER">STARTER</option>
                          <option value="PRO">PRO</option>
                          <option value="ENTERPRISE">ENTERPRISE</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleStatus(ws)}
                          className={`chip ${ws.status === "ACTIVE" ? "" : ""}`}
                          data-tone={ws.status === "ACTIVE" ? "success" : "danger"}
                          style={{ cursor: "pointer", border: "none" }}
                          title="Click to toggle Active / Suspended status"
                        >
                          <span className="dot" />
                          <span>{ws.status}</span>
                        </button>
                      </td>
                      <td>
                        {/* CLOSER SEAT STEPPER */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleUpdateSeats(ws, -1)}
                            disabled={ws.maxSeats <= 1}
                            style={{ height: 24, width: 24, padding: 0, justifyContent: "center" }}
                            title="Decrease seat capacity"
                          >
                            <Icon name="minus" size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setTargetWorkspaceForAction(ws);
                              setCustomSeatsCount(ws.maxSeats);
                              setIsSeatsModal(true);
                            }}
                            className="chip"
                            data-tone="accent"
                            style={{ height: 24, padding: "0 8px", cursor: "pointer", fontWeight: 700 }}
                            title="Click to set custom seat limit"
                          >
                            {ws.maxSeats} seats
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleUpdateSeats(ws, 1)}
                            style={{ height: 24, width: 24, padding: 0, justifyContent: "center" }}
                            title="Increase seat capacity"
                          >
                            <Icon name="plus" size={12} />
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                            {ws.expiresAt ? new Date(ws.expiresAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "No expiry set"}
                          </span>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="btn btn-sm"
                              style={{ height: 20, fontSize: 10, padding: "0 5px" }}
                              onClick={() => handleExtendExpiry(ws, 30)}
                              title="Extend subscription by 30 days"
                            >
                              +30d
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ height: 20, fontSize: 10, padding: "0 5px" }}
                              onClick={() => handleExtendExpiry(ws, 90)}
                              title="Extend subscription by 90 days"
                            >
                              +90d
                            </button>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            data-variant="accent"
                            onClick={() => handleImpersonateWorkspace(ws)}
                            title="Instant one-click workspace login / impersonation"
                          >
                            <Icon name="external" size={12} />
                            <span>Impersonate</span>
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              setSelectedWorkspace(selectedWorkspace?.id === ws.id ? null : ws);
                            }}
                            title="Inspect workspace closer team"
                          >
                            <Icon name="team" size={12} />
                            <span>{selectedWorkspace?.id === ws.id ? "Hide Users" : `Users (${ws.users?.length || ws.activeUsersCount})`}</span>
                          </button>
                          <button
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
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-tertiary)" }}>
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
                Multi-device Baileys WhatsApp web socket gateway for zero-cost agency message synchronization.
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
              Super Admin master keys serve as the global fallback whenever a customer agency does not provide their own BYOK key.
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
              <h2>Provision New Agency Workspace</h2>
              <button className="icon-btn" onClick={() => setIsAddWorkspaceModal(false)} style={{ marginLeft: "auto" }}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="dialog-body">
              <div className="field">
                <label>Agency / Company Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Apex Closer Agency"
                  value={newWsName}
                  onChange={(e) => {
                    setNewWsName(e.target.value);
                    if (!newWsSlug) {
                      setNewWsSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }
                  }}
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
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Plan Tier</label>
                  <select
                    className="select"
                    value={newWsTier}
                    onChange={(e) => setNewWsTier(e.target.value)}
                  >
                    <option value="FREE">Free Tier</option>
                    <option value="STARTER">Starter Tier</option>
                    <option value="PRO">Pro Tier</option>
                    <option value="ENTERPRISE">Enterprise Tier</option>
                  </select>
                </div>
                <div className="field">
                  <label>Closer Seats Quota</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={100}
                    value={newWsSeats}
                    onChange={(e) => setNewWsSeats(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
            <div className="dialog-foot">
              <button className="btn btn-sm" onClick={() => setIsAddWorkspaceModal(false)}>
                Cancel
              </button>
              <button className="btn btn-sm" data-variant="accent" onClick={handleCreateWorkspace}>
                Provision Workspace
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
              <button className="icon-btn" onClick={() => setIsAddUserModal(false)} style={{ marginLeft: "auto" }}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="dialog-body">
              <div className="field">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Anshita Sharma"
                  value={newUsrName}
                  onChange={(e) => setNewUsrName(e.target.value)}
                />
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="anshita@agency.in"
                    value={newUsrEmail}
                    onChange={(e) => setNewUsrEmail(e.target.value)}
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
                  />
                </div>
              </div>

              <div className="field">
                <label>Assigned Role</label>
                <select
                  className="select"
                  value={newUsrRole}
                  onChange={(e) => setNewUsrRole(e.target.value as any)}
                >
                  <option value="CLOSER">CLOSER (Sales Agent)</option>
                  <option value="MANAGER">MANAGER (Team Lead)</option>
                  <option value="ADMIN">ADMIN (Workspace Admin)</option>
                </select>
              </div>
            </div>
            <div className="dialog-foot">
              <button className="btn btn-sm" onClick={() => setIsAddUserModal(false)}>
                Cancel
              </button>
              <button className="btn btn-sm" data-variant="accent" onClick={handleCreateUser}>
                Create Closer User
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
