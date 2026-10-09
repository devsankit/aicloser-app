"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Edit3,
  Trash2,
  LogIn,
  LogOut,
  Plus,
  Minus,
  Search,
  RefreshCw,
  ShieldCheck,
  Layers,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Shield,
  Building,
  KeyRound,
  Filter,
} from "lucide-react";

import { BrandWordmark } from "@/components/ui/brand-wordmark";

export type SuperAdminUser = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  role: string;
  companyName: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED" | string;
  seatLimit: number;
  paymentStatus?: "NOT_CONFIGURED" | "PENDING" | "PAID" | string;
  paymentPendingSince?: string | null;
  activationLocked?: boolean;
  packageExpiresAt?: string | null;
  agentCode: string | null;
  agentProfileId?: string | null;
  tenantId?: string | null;
  packageName?: string;
  createdAt: string;
  lastLoginAt: string | null;
  isSeeded: boolean;
  isSuperAdmin: boolean;
};

export type SuperAdminStats = {
  totalUsers: number;
  activeUsers: number;
  totalSeats: number;
  newUsersToday: number;
};

type Props = {
  adminUser?: {
    displayName?: string | null;
    email?: string | null;
    role?: string | null;
  };
  initialUsers: SuperAdminUser[];
  initialStats: SuperAdminStats;
};

function formatTimeAgo(isoString: string | null) {
  if (!isoString) return "Never";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Never";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPackageExpiry(isoString: string | null | undefined) {
  if (!isoString) return "No expiry set";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "No expiry set";
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const label = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  if (days < 0) return `${label} · expired`;
  if (days <= 30) return `${label} · ${days}d left`;
  return label;
}

export function SuperAdminCloserControl({ adminUser, initialUsers, initialStats }: Props) {
  const [users, setUsers] = useState<SuperAdminUser[]>(initialUsers);
  const [stats, setStats] = useState<SuperAdminStats>(initialStats);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<"users" | "logins" | "health">("users");
  const [showDetailedUsers, setShowDetailedUsers] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SuperAdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SuperAdminUser | null>(null);
  const [quickSeatModalUser, setQuickSeatModalUser] = useState<SuperAdminUser | null>(null);
  const [customSeatsInput, setCustomSeatsInput] = useState<number>(5);

  const [isPending, startTransition] = useTransition();

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/super-admin/users", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
        setStats(data.stats);
        showToast("User directory refreshed successfully");
      } else {
        showToast(data.error || "Failed to refresh users", "error");
      }
    } catch {
      showToast("Network error while refreshing", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Quick seat stepper (+ / -)
  const handleUpdateSeats = async (user: SuperAdminUser, delta: number) => {
    const nextSeats = Math.max(1, user.seatLimit + delta);
    if (nextSeats === user.seatLimit) return;

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, seatLimit: nextSeats } : u))
    );
    setStats((prev) => ({
      ...prev,
      totalSeats: prev.totalSeats + delta,
    }));

    try {
      const res = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-seats",
          userId: user.id,
          seats: nextSeats,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const committedSeats = Math.max(1, Number(data.seatLimit) || nextSeats);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, seatLimit: committedSeats } : u)));
        setStats((prev) => ({ ...prev, totalSeats: prev.totalSeats + (committedSeats - nextSeats) }));
        showToast(`Updated seats to ${committedSeats} for ${user.displayName}`);
      } else {
        // Rollback
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, seatLimit: user.seatLimit } : u))
        );
        setStats((prev) => ({ ...prev, totalSeats: Math.max(0, prev.totalSeats - delta) }));
        showToast(data.error || "Failed to update seats", "error");
      }
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, seatLimit: user.seatLimit } : u))
      );
      setStats((prev) => ({ ...prev, totalSeats: Math.max(0, prev.totalSeats - delta) }));
      showToast("Network error updating seats", "error");
    }
  };

  // Save custom seats from dialog
  const handleSaveCustomSeats = async () => {
    if (!quickSeatModalUser) return;
    const nextSeats = Math.max(1, customSeatsInput);
    const previousSeats = quickSeatModalUser.seatLimit;

    setUsers((prev) =>
      prev.map((u) => (u.id === quickSeatModalUser.id ? { ...u, seatLimit: nextSeats } : u))
    );
    setStats((prev) => ({ ...prev, totalSeats: prev.totalSeats + (nextSeats - previousSeats) }));

    try {
      const res = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-seats",
          userId: quickSeatModalUser.id,
          seats: nextSeats,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const committedSeats = Math.max(1, Number(data.seatLimit) || nextSeats);
        setUsers((prev) => prev.map((u) => (u.id === quickSeatModalUser.id ? { ...u, seatLimit: committedSeats } : u)));
        setStats((prev) => ({ ...prev, totalSeats: prev.totalSeats + (committedSeats - nextSeats) }));
        showToast(`Seats set to ${committedSeats} for ${quickSeatModalUser.displayName}`);
        setQuickSeatModalUser(null);
      } else {
        setUsers((prev) => prev.map((u) => (u.id === quickSeatModalUser.id ? { ...u, seatLimit: previousSeats } : u)));
        setStats((prev) => ({ ...prev, totalSeats: Math.max(0, prev.totalSeats - (nextSeats - previousSeats)) }));
        showToast(data.error || "Failed to set seats", "error");
      }
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === quickSeatModalUser.id ? { ...u, seatLimit: previousSeats } : u)));
      setStats((prev) => ({ ...prev, totalSeats: Math.max(0, prev.totalSeats - (nextSeats - previousSeats)) }));
      showToast("Network error", "error");
    }
  };

  // Toggle user status (ACTIVE <-> SUSPENDED)
  const handleToggleStatus = async (user: SuperAdminUser) => {
    if (user.isSuperAdmin) return;
    const nextStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
    );

    try {
      const res = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-status",
          userId: user.id,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`User marked ${nextStatus.toLowerCase()}`);
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: user.status } : u))
        );
        showToast(data.error || "Failed to change status", "error");
      }
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: user.status } : u))
      );
      showToast("Network error", "error");
    }
  };

  const handleTogglePayment = async (user: SuperAdminUser) => {
    if (user.isSuperAdmin) return;
    const nextPaymentStatus = user.paymentStatus === "PAID" ? "PENDING" : "PAID";
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, paymentStatus: nextPaymentStatus, activationLocked: false } : u)));
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-payment-status", userId: user.id, paymentStatus: nextPaymentStatus }),
      });
      const data = await res.json();
      if (data.ok) showToast(`Payment marked ${nextPaymentStatus.toLowerCase()} for ${user.displayName}`);
      else throw new Error(data.error || "Failed to update payment status");
    } catch (error) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, paymentStatus: user.paymentStatus, activationLocked: user.activationLocked } : u)));
      showToast(error instanceof Error ? error.message : "Network error updating payment", "error");
    }
  };

  // 1-Click Impersonate ("Login as User")
  const handleImpersonate = async (user: SuperAdminUser) => {
    setImpersonatingUserId(user.id);
    showToast(`Logging into ${user.displayName}'s workspace...`);

    try {
      const res = await fetch("/api/super-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.ok && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        showToast(data.error || "Impersonation failed", "error");
        setImpersonatingUserId(null);
      }
    } catch {
      showToast("Network error during login", "error");
      setImpersonatingUserId(null);
    }
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      const res = await fetch(`/api/super-admin/users?userId=${deletingUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
        setStats((prev) => ({
          ...prev,
          totalUsers: Math.max(0, prev.totalUsers - 1),
          totalSeats: Math.max(0, prev.totalSeats - deletingUser.seatLimit),
        }));
        showToast(`Deleted ${deletingUser.displayName}`);
        setDeletingUser(null);
      } else {
        showToast(data.error || "Failed to delete user", "error");
      }
    } catch {
      showToast("Network error while deleting", "error");
    }
  };

  // Filtered & Searched Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        u.displayName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.phone.toLowerCase().includes(query) ||
        u.companyName.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "ALL" ||
        u.role.toUpperCase() === roleFilter.toUpperCase();

      const matchesStatus =
        statusFilter === "ALL" ||
        u.status.toUpperCase() === statusFilter.toUpperCase();

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const recentLoginUsers = useMemo(() => {
    return [...users]
      .filter((u) => u.lastLoginAt)
      .sort((a, b) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime());
  }, [users]);

  const workspaceSummaries = useMemo(() => {
    const groups = new Map<string, SuperAdminUser[]>();
    for (const user of users) {
      const key = user.tenantId || user.companyName || user.id;
      const group = groups.get(key) || [];
      group.push(user);
      groups.set(key, group);
    }

    const query = searchQuery.toLowerCase().trim();
    return [...groups.entries()]
      .map(([key, members]) => {
        const admin = members.find((member) => member.role.toUpperCase() === "ADMIN") || null;
        const teamMembers = members.filter((member) => !member.isSuperAdmin && member.role.toUpperCase() !== "ADMIN");
        const matchesSearch = !query || members.some((member) =>
          [member.displayName, member.email, member.phone, member.companyName].some((value) => value.toLowerCase().includes(query)),
        );
        const matchesRole = roleFilter === "ALL" || members.some((member) => member.role.toUpperCase() === roleFilter.toUpperCase());
        const matchesStatus = statusFilter === "ALL" || members.some((member) => member.status.toUpperCase() === statusFilter.toUpperCase());

        return {
          key,
          admin,
          companyName: admin?.companyName || members[0]?.companyName || "Workspace",
          members: teamMembers,
          total: teamMembers.length,
          active: teamMembers.filter((member) => member.status === "ACTIVE").length,
          pending: teamMembers.filter((member) => member.status === "PENDING").length,
          suspended: teamMembers.filter((member) => member.status === "SUSPENDED").length,
          seats: admin?.seatLimit || members.reduce((sum, member) => sum + (member.seatLimit || 0), 0),
          packageName: admin?.packageName || members.find((member) => member.packageName)?.packageName || "No package",
          packageExpiresAt: admin?.packageExpiresAt || members.find((member) => member.packageExpiresAt)?.packageExpiresAt || null,
          matches: matchesSearch && matchesRole && matchesStatus,
        };
      })
      .filter((summary) => summary.matches)
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [users, searchQuery, roleFilter, statusFilter]);

  const adminName = adminUser?.displayName || "Ankit Rathore";
  const adminEmail = adminUser?.email || "hello.ankitrathore@gmail.com";
  const adminInitials = adminName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AR";

  return (
    <div style={{ minHeight: "100vh", background: "#090D0B", color: "#F4F4F5", fontFamily: "var(--font-sans, system-ui)" }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 18px",
            borderRadius: "10px",
            background: toast.type === "success" ? "#10B981" : "#EF4444",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            fontSize: "0.9rem",
            fontWeight: 600,
            animation: "slideUp 0.2s ease-out",
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(10, 13, 11, 0.95)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          padding: "0.85rem 1.75rem",
        }}
      >
        <div style={{ maxWidth: "1440px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
          {/* Brand & Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <BrandWordmark />
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.25rem 0.65rem",
                borderRadius: "9999px",
                background: "rgba(249, 115, 22, 0.12)",
                border: "1px solid rgba(249, 115, 22, 0.3)",
                color: "#F97316",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
              Super Admin
            </div>
          </div>

          {/* Navigation Menu Tabs */}
          <nav style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setActiveTab("users")}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                fontSize: "0.88rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: activeTab === "users" ? "#F97316" : "transparent",
                color: activeTab === "users" ? "#FFFFFF" : "#A1A1AA",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                transition: "all 0.15s ease",
              }}
            >
              <Users size={16} /> Users & Seats
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logins")}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                fontSize: "0.88rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: activeTab === "logins" ? "#F97316" : "transparent",
                color: activeTab === "logins" ? "#FFFFFF" : "#A1A1AA",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                transition: "all 0.15s ease",
              }}
            >
              <Clock size={16} /> Recent Logins ({recentLoginUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("health")}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                fontSize: "0.88rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: activeTab === "health" ? "#F97316" : "transparent",
                color: activeTab === "health" ? "#FFFFFF" : "#A1A1AA",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                transition: "all 0.15s ease",
              }}
            >
              <ShieldCheck size={16} /> Platform Overview
            </button>
          </nav>

          {/* Right: Admin Profile & Logout */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Admin Profile Pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.35rem 0.75rem 0.35rem 0.45rem",
                borderRadius: "9999px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                  color: "#FFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                }}
              >
                {adminInitials}
              </div>
              <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#FFF" }}>{adminName}</div>
                <div style={{ fontSize: "0.7rem", color: "#A1A1AA" }}>Owner</div>
              </div>
            </div>

            {/* Logout Button */}
            <a
              href="/api/auth/logout?redirectTo=/super-admin/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.55rem 0.95rem",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#F87171",
                fontSize: "0.82rem",
                fontWeight: 600,
                textDecoration: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)";
              }}
            >
              <LogOut size={15} /> Logout
            </a>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: "1440px", margin: "0 auto", padding: "1.75rem 1.75rem 4rem 1.75rem" }}>
        {/* METRICS ROW */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            marginBottom: "1.75rem",
          }}
        >
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "12px",
              background: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                background: "rgba(249, 115, 22, 0.12)",
                color: "#F97316",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#A1A1AA", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Total Registered Users
              </div>
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#FFFFFF", marginTop: "2px" }}>
                {stats.totalUsers}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "1.25rem",
              borderRadius: "12px",
              background: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10B981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#A1A1AA", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Active Accounts
              </div>
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#FFFFFF", marginTop: "2px" }}>
                {stats.activeUsers}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "1.25rem",
              borderRadius: "12px",
              background: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.12)",
                color: "#3B82F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#A1A1AA", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Allocated Team Seats
              </div>
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#FFFFFF", marginTop: "2px" }}>
                {stats.totalSeats}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "1.25rem",
              borderRadius: "12px",
              background: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                background: "rgba(234, 179, 8, 0.12)",
                color: "#EAB308",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#A1A1AA", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                New Signups Today
              </div>
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#FFFFFF", marginTop: "2px" }}>
                {stats.newUsersToday}
              </div>
            </div>
          </div>
        </section>

        {/* TAB 1: USERS & SEATS MANAGEMENT */}
        {activeTab === "users" && (
          <div>
            {/* ACTION & SEARCH CONTROLS */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
                marginBottom: "1.25rem",
              }}
            >
              {/* Search Box */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  background: "#121714",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "10px",
                  padding: "0.55rem 0.95rem",
                  flex: "1 1 320px",
                  maxWidth: "420px",
                }}
              >
                <Search size={16} style={{ color: "#71717A" }} />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#FFFFFF",
                    fontSize: "0.88rem",
                    width: "100%",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{ background: "transparent", border: "none", color: "#71717A", cursor: "pointer" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filters & Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{
                    background: "#121714",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#D4D4D8",
                    padding: "0.55rem 0.85rem",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <option value="ALL">All Roles</option>
                  <option value="SALES_AGENT">Sales Agent</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="FREELANCER">Freelancer</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    background: "#121714",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#D4D4D8",
                    padding: "0.55rem 0.85rem",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowDetailedUsers((current) => !current)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    background: showDetailedUsers ? "rgba(249, 115, 22, 0.16)" : "#121714",
                    border: showDetailedUsers ? "1px solid rgba(249, 115, 22, 0.45)" : "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: showDetailedUsers ? "#F97316" : "#D4D4D8",
                    padding: "0.55rem 0.85rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Users size={14} /> {showDetailedUsers ? "Admin summary" : "Individual users"}
                </button>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={refreshData}
                  disabled={isRefreshing}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    background: "#121714",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "8px",
                    color: "#D4D4D8",
                    padding: "0.55rem 0.85rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={14} className={isRefreshing ? "spin" : ""} /> Refresh
                </button>

                {/* + Add New User Button */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    padding: "0.55rem 1.15rem",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(249, 115, 22, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(249, 115, 22, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 15px rgba(249, 115, 22, 0.3)";
                  }}
                >
                  <UserPlus size={16} /> Add New User
                </button>
              </div>
            </div>

            {!showDetailedUsers ? (
              <div
                style={{
                  background: "#111714",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "14px",
                  overflow: "hidden",
                  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
                }}
              >
                <div style={{ padding: "1.15rem 1.25rem", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                      <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "1.05rem" }}>Business customers</h2>
                      <p style={{ margin: "0.35rem 0 0", color: "#A1A1AA", fontSize: "0.82rem" }}>
                        Platform-level view. Team members remain inside each Admin workspace.
                      </p>
                    </div>
                    <span style={{ color: "#F97316", fontWeight: 700, fontSize: "0.82rem" }}>{workspaceSummaries.length} workspaces</span>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "#A1A1AA" }}>
                        <th style={{ padding: "0.85rem 1.25rem" }}>Business / Admin</th>
                        <th style={{ padding: "0.85rem 1rem" }}>Team users</th>
                        <th style={{ padding: "0.85rem 1rem" }}>Active</th>
                        <th style={{ padding: "0.85rem 1rem" }}>Pending / Suspended</th>
                        <th style={{ padding: "0.85rem 1rem" }}>Package</th>
                        <th style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>Control</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceSummaries.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: "2.5rem", textAlign: "center", color: "#A1A1AA" }}>No business workspaces match these filters.</td></tr>
                      ) : workspaceSummaries.map((summary) => (
                        <tr key={summary.key} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                          <td style={{ padding: "1rem 1.25rem" }}>
                            <div style={{ color: "#FFFFFF", fontWeight: 700 }}>{summary.companyName}</div>
                            <div style={{ color: "#A1A1AA", fontSize: "0.78rem", marginTop: "0.25rem" }}>{summary.admin?.displayName || "Workspace admin not assigned"}</div>
                          </td>
                          <td style={{ padding: "1rem", color: "#D4D4D8", fontWeight: 700 }}>{summary.total}</td>
                          <td style={{ padding: "1rem", color: "#34D399", fontWeight: 700 }}>{summary.active}</td>
                          <td style={{ padding: "1rem", color: "#FBBF24" }}>{summary.pending} pending · {summary.suspended} suspended</td>
                          <td style={{ padding: "1rem" }}>
                            <div style={{ color: "#D4D4D8", fontWeight: 600 }}>{summary.packageName}</div>
                            <div style={{ color: "#A1A1AA", fontSize: "0.76rem", marginTop: "0.25rem" }}>{formatPackageExpiry(summary.packageExpiresAt)}</div>
                          </td>
                          <td style={{ padding: "1rem 1.25rem", textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => { setSearchQuery(summary.companyName); setRoleFilter("ALL"); setStatusFilter("ALL"); setShowDetailedUsers(true); }}
                              style={{ border: "1px solid rgba(249, 115, 22, 0.35)", background: "rgba(249, 115, 22, 0.12)", color: "#F97316", borderRadius: "7px", padding: "0.4rem 0.7rem", fontWeight: 700, cursor: "pointer" }}
                            >
                              View team
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {showDetailedUsers ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
                  <p style={{ margin: 0, color: "#A1A1AA", fontSize: "0.82rem" }}>Individual user controls are available only when explicitly opened for platform support.</p>
                  <button type="button" onClick={() => { setShowDetailedUsers(false); setSearchQuery(""); }} style={{ border: "1px solid rgba(255, 255, 255, 0.12)", background: "#121714", color: "#D4D4D8", borderRadius: "7px", padding: "0.4rem 0.7rem", fontWeight: 600, cursor: "pointer" }}>Back to summary</button>
                </div>
                {/* USERS TABLE */}
            <div
              style={{
                background: "#111714",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "14px",
                overflow: "hidden",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "#A1A1AA" }}>
                      <th style={{ padding: "0.95rem 1.25rem", fontWeight: 700, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        User / Contact
                      </th>
                      <th style={{ padding: "0.95rem 1rem", fontWeight: 700, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Workspace
                      </th>
                      <th style={{ padding: "0.95rem 1rem", fontWeight: 700, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Role
                      </th>
                      <th style={{ padding: "0.95rem 1rem", fontWeight: 700, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Status
                      </th>
                      <th style={{ padding: "0.95rem 1rem", fontWeight: 700, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Payment
                      </th>
                      <th style={{ padding: "0.95rem 1rem", fontWeight: 700, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Last Login
                      </th>
                      <th
                        style={{
                          padding: "0.95rem 1.25rem",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          textAlign: "center",
                          background: "rgba(249, 115, 22, 0.04)",
                        }}
                      >
                        Team Seats Limit (Scale)
                      </th>
                      <th style={{ padding: "0.95rem 1.25rem", fontWeight: 700, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "#71717A" }}>
                          <Users size={36} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
                          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#D4D4D8" }}>No users found matching your filters</div>
                          <div style={{ fontSize: "0.82rem", marginTop: "4px" }}>Try clearing your search query or filters.</div>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const userInitials = user.displayName
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "U";

                        const isCurrentlyImpersonating = impersonatingUserId === user.id;

                        return (
                          <tr
                            key={user.id}
                            style={{
                              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                              transition: "background 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            {/* User Info */}
                            <td style={{ padding: "1rem 1.25rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    background: user.isSuperAdmin
                                      ? "linear-gradient(135deg, #F97316 0%, #EA580C 100%)"
                                      : "rgba(255, 255, 255, 0.08)",
                                    color: user.isSuperAdmin ? "#FFF" : "#D4D4D8",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    fontSize: "0.82rem",
                                    flexShrink: 0,
                                  }}
                                >
                                  {userInitials}
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                    <strong style={{ color: "#FFFFFF", fontSize: "0.92rem" }}>{user.displayName}</strong>
                                    {user.isSuperAdmin && (
                                      <span
                                        style={{
                                          fontSize: "0.65rem",
                                          padding: "0.1rem 0.4rem",
                                          borderRadius: "4px",
                                          background: "rgba(249, 115, 22, 0.2)",
                                          color: "#F97316",
                                          fontWeight: 700,
                                        }}
                                      >
                                        OWNER
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "0.78rem", color: "#A1A1AA", marginTop: "2px" }}>
                                    {user.email || "No email"} &bull; {user.phone || "No phone"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Workspace */}
                            <td style={{ padding: "1rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#D4D4D8", fontSize: "0.84rem" }}>
                                <Building size={14} style={{ color: "#71717A", flexShrink: 0 }} />
                                <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {user.companyName}
                                </span>
                              </div>
                            </td>

                            {/* Role */}
                            <td style={{ padding: "1rem" }}>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  padding: "0.25rem 0.6rem",
                                  borderRadius: "6px",
                                  background:
                                    user.role === "SUPER_ADMIN"
                                      ? "rgba(249, 115, 22, 0.15)"
                                      : user.role === "ADMIN"
                                        ? "rgba(59, 130, 246, 0.15)"
                                        : "rgba(16, 185, 129, 0.15)",
                                  color:
                                    user.role === "SUPER_ADMIN"
                                      ? "#F97316"
                                      : user.role === "ADMIN"
                                        ? "#60A5FA"
                                        : "#34D399",
                                }}
                              >
                                {user.role}
                              </span>
                            </td>

                            {/* Status */}
                            <td style={{ padding: "1rem" }}>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(user)}
                                disabled={user.isSuperAdmin}
                                title={user.isSuperAdmin ? "Super Admin status is locked" : "Click to toggle Active / Suspended"}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  padding: "0.25rem 0.6rem",
                                  borderRadius: "9999px",
                                  fontSize: "0.74rem",
                                  fontWeight: 700,
                                  border: "none",
                                  cursor: user.isSuperAdmin ? "default" : "pointer",
                                  background:
                                    user.status === "ACTIVE"
                                      ? "rgba(16, 185, 129, 0.15)"
                                      : user.status === "PENDING"
                                        ? "rgba(234, 179, 8, 0.15)"
                                        : "rgba(239, 68, 68, 0.15)",
                                  color:
                                    user.status === "ACTIVE"
                                      ? "#10B981"
                                      : user.status === "PENDING"
                                        ? "#EAB308"
                                        : "#EF4444",
                                }}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background:
                                      user.status === "ACTIVE"
                                        ? "#10B981"
                                        : user.status === "PENDING"
                                          ? "#EAB308"
                                          : "#EF4444",
                                  }}
                                />
                                {user.status}
                              </button>
                            </td>

                            {/* Payment */}
                            <td style={{ padding: "1rem" }}>
                              <button
                                type="button"
                                disabled={user.isSuperAdmin}
                                onClick={() => handleTogglePayment(user)}
                                title={user.activationLocked ? "Payment pending for more than 24 hours; click to mark paid" : "Click to toggle payment status"}
                                style={{ border: 0, borderRadius: "9999px", padding: "0.25rem 0.6rem", fontSize: "0.72rem", fontWeight: 700, cursor: user.isSuperAdmin ? "default" : "pointer", color: user.paymentStatus === "PAID" ? "#34D399" : "#FBBF24", background: user.paymentStatus === "PAID" ? "rgba(16,185,129,0.15)" : "rgba(234,179,8,0.15)" }}
                              >
                                {user.activationLocked ? "PENDING · LOCKED" : user.paymentStatus || "NOT CONFIGURED"}
                              </button>
                            </td>

                            {/* Last Login */}
                            <td style={{ padding: "1rem", color: "#A1A1AA", fontSize: "0.82rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                <Clock size={13} style={{ opacity: 0.6 }} />
                                <span>{formatTimeAgo(user.lastLoginAt)}</span>
                              </div>
                            </td>

                            {/* SEAT SCALING (CORE USER REQUIREMENT) */}
                            <td
                              style={{
                                padding: "1rem 1.25rem",
                                textAlign: "center",
                                background: "rgba(249, 115, 22, 0.02)",
                              }}
                            >
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                                {/* Decrement Seat Button (-) */}
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSeats(user, -1)}
                                  disabled={user.seatLimit <= 1}
                                  title="Decrease 1 seat"
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "6px",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    background: user.seatLimit <= 1 ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.08)",
                                    color: user.seatLimit <= 1 ? "#52525B" : "#FFFFFF",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: user.seatLimit <= 1 ? "not-allowed" : "pointer",
                                    transition: "all 0.1s ease",
                                  }}
                                >
                                  <Minus size={13} />
                                </button>

                                {/* Direct Clickable Seats Badge */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickSeatModalUser(user);
                                    setCustomSeatsInput(user.seatLimit);
                                  }}
                                  title="Click to type a custom seat count"
                                  style={{
                                    padding: "0.3rem 0.75rem",
                                    borderRadius: "6px",
                                    background: "rgba(249, 115, 22, 0.15)",
                                    border: "1px solid rgba(249, 115, 22, 0.35)",
                                    color: "#F97316",
                                    fontSize: "0.85rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    minWidth: "75px",
                                    textAlign: "center",
                                  }}
                                >
                                  {user.seatLimit} Seats
                                </button>

                                {/* Increment Seat Button (+) */}
                                <form action="/api/super-admin/users" method="post" style={{ display: "inline-flex" }}>
                                  <input name="action" type="hidden" value="update-seats" />
                                  <input name="userId" type="hidden" value={user.id} />
                                  <input name="seats" type="hidden" value={user.seatLimit + 1} />
                                  <button
                                    type="submit"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      void handleUpdateSeats(user, 1);
                                    }}
                                    title="Increase 1 seat"
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "6px",
                                      border: "1px solid rgba(249, 115, 22, 0.4)",
                                      background: "rgba(249, 115, 22, 0.2)",
                                      color: "#F97316",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      transition: "all 0.1s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "#F97316";
                                      e.currentTarget.style.color = "#FFF";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "rgba(249, 115, 22, 0.2)";
                                      e.currentTarget.style.color = "#F97316";
                                    }}
                                  >
                                    <Plus size={13} />
                                  </button>
                                </form>
                              </div>
                            </td>

                            {/* Actions (Login as User, Edit, Delete) */}
                            <td style={{ padding: "1rem 1.25rem", textAlign: "right" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                                {/* 1-Click "Login as User" Impersonate */}
                                <button
                                  type="button"
                                  onClick={() => handleImpersonate(user)}
                                  disabled={isCurrentlyImpersonating}
                                  title={`Log into ${user.displayName}'s panel`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.35rem",
                                    padding: "0.35rem 0.75rem",
                                    borderRadius: "6px",
                                    background: "rgba(16, 185, 129, 0.15)",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                    color: "#34D399",
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                    cursor: isCurrentlyImpersonating ? "wait" : "pointer",
                                    transition: "all 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#10B981";
                                    e.currentTarget.style.color = "#000";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(16, 185, 129, 0.15)";
                                    e.currentTarget.style.color = "#34D399";
                                  }}
                                >
                                  <LogIn size={13} /> Login as User
                                </button>

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => setEditingUser(user)}
                                  title="Edit user details"
                                  style={{
                                    width: "30px",
                                    height: "30px",
                                    borderRadius: "6px",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    color: "#D4D4D8",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                                  }}
                                >
                                  <Edit3 size={14} />
                                </button>

                                {/* Delete Button */}
                                {!user.isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingUser(user)}
                                    title="Delete user"
                                    style={{
                                      width: "30px",
                                      height: "30px",
                                      borderRadius: "6px",
                                      border: "1px solid rgba(239, 68, 68, 0.2)",
                                      background: "rgba(239, 68, 68, 0.1)",
                                      color: "#F87171",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      transition: "all 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                    }}
                                  >
                                    <Trash2 size={14} />
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
            </div>
              </>
            ) : null}
          </div>
        )}

        {/* TAB 2: RECENT LOGINS FEED */}
        {activeTab === "logins" && (
          <div
            style={{
              background: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "1.5rem",
            }}
          >
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.5rem" }}>
              Recent User Logins
            </h2>
            <p style={{ color: "#A1A1AA", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Chronological log of users who recently accessed their AI Closer workspace.
            </p>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              {recentLoginUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.85rem 1.25rem",
                    borderRadius: "10px",
                    background: "#161D19",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "rgba(249, 115, 22, 0.15)",
                        color: "#F97316",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                      }}
                    >
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#FFFFFF", fontSize: "0.9rem" }}>{user.displayName}</div>
                      <div style={{ fontSize: "0.78rem", color: "#A1A1AA" }}>
                        {user.email} &bull; {user.companyName}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#34D399" }}>
                        {formatTimeAgo(user.lastLoginAt)}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#71717A" }}>
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleImpersonate(user)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.4rem 0.8rem",
                        borderRadius: "6px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        color: "#34D399",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <LogIn size={13} /> Login
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PLATFORM OVERVIEW */}
        {activeTab === "health" && (
          <div
            style={{
              background: "#111714",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "2rem",
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.5rem" }}>
              AI Closer Platform Governance
            </h2>
            <p style={{ color: "#A1A1AA", fontSize: "0.88rem", marginBottom: "2rem" }}>
              Central administrative control for domain <strong style={{ color: "#FFF" }}>app.aicloser.in</strong>.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
              <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#161D19", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div style={{ color: "#F97316", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                  Active Database Engine
                </div>
                <div style={{ color: "#FFFFFF", fontSize: "1.1rem", fontWeight: 700 }}>PostgreSQL (Neon Cloud)</div>
                <div style={{ color: "#71717A", fontSize: "0.78rem", marginTop: "4px" }}>Multi-tenant Prisma connection pool active</div>
              </div>

              <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#161D19", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div style={{ color: "#10B981", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                  Production Host
                </div>
                <div style={{ color: "#FFFFFF", fontSize: "1.1rem", fontWeight: 700 }}>VPS Hostinger (Port 3050)</div>
                <div style={{ color: "#71717A", fontSize: "0.78rem", marginTop: "4px" }}>PM2 process: aicloser-app</div>
              </div>

              <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#161D19", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div style={{ color: "#3B82F6", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.4rem" }}>
                  Total Capacity
                </div>
                <div style={{ color: "#FFFFFF", fontSize: "1.1rem", fontWeight: 700 }}>{stats.totalSeats} Active Team Seats</div>
                <div style={{ color: "#71717A", fontSize: "0.78rem", marginTop: "4px" }}>Across {stats.totalUsers} registered organizations</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: ADD NEW USER */}
      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#121714",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(249, 115, 22, 0.15)",
                    color: "#F97316",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#FFFFFF" }}>Add New User</h3>
                  <p style={{ fontSize: "0.78rem", color: "#A1A1AA" }}>Create a workspace account and assign team seats</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "#71717A", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const payload = {
                  action: "create",
                  displayName: form.get("displayName"),
                  email: form.get("email"),
                  phone: form.get("phone"),
                  password: form.get("password"),
                  companyName: form.get("companyName"),
                  role: form.get("role"),
                  seats: Number(form.get("seats") || 5),
                  status: form.get("status") || "ACTIVE",
                };

                try {
                  const res = await fetch("/api/super-admin/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    showToast(`User ${data.user.displayName} created!`);
                    setIsAddModalOpen(false);
                    await refreshData();
                  } else {
                    showToast(data.error || "Failed to create user", "error");
                  }
                } catch {
                  showToast("Network error creating user", "error");
                }
              }}
              style={{ display: "grid", gap: "1rem" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                  Full Name *
                </label>
                <input
                  name="displayName"
                  required
                  placeholder="e.g. Rahul Sharma"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "8px",
                    background: "#18201C",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#FFFFFF",
                    fontSize: "0.88rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Email ID *
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Phone Number *
                  </label>
                  <input
                    name="phone"
                    required
                    placeholder="+919876543210"
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Password *
                  </label>
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Workspace / Company Name
                  </label>
                  <input
                    name="companyName"
                    placeholder="e.g. Acme Sales"
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Role
                  </label>
                  <select
                    name="role"
                    defaultValue="SALES_AGENT"
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  >
                    <option value="SALES_AGENT">Sales Agent</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Team Seats Limit
                  </label>
                  <input
                    name="seats"
                    type="number"
                    min={1}
                    max={500}
                    defaultValue={5}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Initial Status
                  </label>
                  <select
                    name="status"
                    defaultValue="ACTIVE"
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: "0.6rem 1.15rem",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    color: "#D4D4D8",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "0.6rem 1.35rem",
                    borderRadius: "8px",
                    background: "#F97316",
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#121714",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(249, 115, 22, 0.15)",
                    color: "#F97316",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#FFFFFF" }}>Edit User</h3>
                  <p style={{ fontSize: "0.78rem", color: "#A1A1AA" }}>Update profile, team seats, or reset password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{ background: "transparent", border: "none", color: "#71717A", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const payload = {
                  action: "update",
                  userId: editingUser.id,
                  displayName: form.get("displayName"),
                  email: form.get("email"),
                  phone: form.get("phone"),
                  companyName: form.get("companyName"),
                  role: form.get("role"),
                  status: form.get("status"),
                  seats: Number(form.get("seats") || editingUser.seatLimit),
                  password: form.get("password") || undefined,
                };

                try {
                  const res = await fetch("/api/super-admin/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    showToast(`Updated ${editingUser.displayName}`);
                    setEditingUser(null);
                    await refreshData();
                  } else {
                    showToast(data.error || "Failed to update user", "error");
                  }
                } catch {
                  showToast("Network error updating user", "error");
                }
              }}
              style={{ display: "grid", gap: "1rem" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                  Full Name
                </label>
                <input
                  name="displayName"
                  defaultValue={editingUser.displayName}
                  required
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "8px",
                    background: "#18201C",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#FFFFFF",
                    fontSize: "0.88rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Email ID
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={editingUser.email}
                    required
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Phone Number
                  </label>
                  <input
                    name="phone"
                    defaultValue={editingUser.phone}
                    required
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Workspace Name
                  </label>
                  <input
                    name="companyName"
                    defaultValue={editingUser.companyName}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Team Seats Limit
                  </label>
                  <input
                    name="seats"
                    type="number"
                    min={1}
                    max={500}
                    defaultValue={editingUser.seatLimit}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Role
                  </label>
                  <select
                    name="role"
                    defaultValue={editingUser.role}
                    disabled={editingUser.isSuperAdmin}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  >
                    <option value="SALES_AGENT">Sales Agent</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={editingUser.status}
                    disabled={editingUser.isSuperAdmin}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      background: "#18201C",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                    }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING">Pending</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "4px" }}>
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  name="password"
                  type="password"
                  placeholder="Enter new password if changing"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "8px",
                    background: "#18201C",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#FFFFFF",
                    fontSize: "0.88rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  style={{
                    padding: "0.6rem 1.15rem",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    color: "#D4D4D8",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "0.6rem 1.35rem",
                    borderRadius: "8px",
                    background: "#F97316",
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUICK SEAT INPUT */}
      {quickSeatModalUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#121714",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              padding: "1.75rem",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(249, 115, 22, 0.15)",
                    color: "#F97316",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Layers size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#FFFFFF" }}>Scale Team Seats</h3>
                  <p style={{ fontSize: "0.76rem", color: "#A1A1AA" }}>{quickSeatModalUser.displayName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickSeatModalUser(null)}
                style={{ background: "transparent", border: "none", color: "#71717A", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#A1A1AA", marginBottom: "6px" }}>
                Total Allowed Seats (Users)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={customSeatsInput}
                onChange={(e) => setCustomSeatsInput(Math.max(1, Number(e.target.value) || 1))}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  background: "#18201C",
                  border: "1px solid rgba(249, 115, 22, 0.4)",
                  color: "#FFFFFF",
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  textAlign: "center",
                }}
              />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                {[3, 5, 10, 25, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCustomSeatsInput(preset)}
                    style={{
                      flex: 1,
                      padding: "0.4rem 0.2rem",
                      borderRadius: "6px",
                      background: customSeatsInput === preset ? "#F97316" : "rgba(255, 255, 255, 0.06)",
                      border: "none",
                      color: customSeatsInput === preset ? "#FFFFFF" : "#D4D4D8",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setQuickSeatModalUser(null)}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#D4D4D8",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomSeats}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "8px",
                  background: "#F97316",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save Seats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deletingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#121714",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "16px",
              padding: "1.75rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#EF4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#FFFFFF" }}>Delete User Account</h3>
                <p style={{ fontSize: "0.78rem", color: "#A1A1AA" }}>This action cannot be undone</p>
              </div>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#D4D4D8", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              Are you sure you want to permanently delete{" "}
              <strong style={{ color: "#FFF" }}>{deletingUser.displayName}</strong> ({deletingUser.email})?
              Their sales profile and workspace configuration will be wiped.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#D4D4D8",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "8px",
                  background: "#EF4444",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
