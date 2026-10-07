"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { FeatureDefinition, RolePermissionsMatrix } from "@/lib/gigxomi/role-permissions-store";

type WorkspaceUserItem = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  phone: string;
  agentCode: string;
  status: string;
  role: "UNASSIGNED" | "ADMIN" | "MANAGER" | "SALES_AGENT";
  packageName: string;
  packageStatus: string;
  packageExpiresAt: string | null;
  groupId: string | null;
  parentAgentId: string | null;
};

type WorkspacePlanSnapshot = {
  plan: {
    name: string;
    status: string;
    expiresAt: string | null;
    seatLimit: number | null;
    isUnlimited: boolean;
  };
  usage: {
    totalUsers: number;
    activeUsers: number;
    planCounts: Record<string, number>;
  };
  entitlements?: {
    whatsappIntegration?: boolean;
    aiToolsAccess?: boolean;
    automationTools?: boolean;
    analyticsAccess?: boolean;
    apiAccess?: boolean;
    webhookAccess?: boolean;
  };
};

export function RolePermissionsPanel({
  currentRole = "ADMIN",
  onRolePreviewChange,
  canManageUsers = true,
}: {
  currentRole?: string;
  onRolePreviewChange?: (role: string) => void;
  canManageUsers?: boolean;
}) {
  const [matrix, setMatrix] = useState<RolePermissionsMatrix | null>(null);
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [users, setUsers] = useState<WorkspaceUserItem[]>([]);
  const [workspacePlan, setWorkspacePlan] = useState<WorkspacePlanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [previewRole, setPreviewRole] = useState(currentRole);

  // Create User Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userNotice, setUserNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Password Reset State
  const [resettingAgentId, setResettingAgentId] = useState<string | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [permRes, usersRes, planRes] = await Promise.all([
        fetch("/api/sales/roles/features", { cache: "no-store" }),
        fetch("/api/sales/roles/users", { cache: "no-store" }),
        fetch("/api/sales/workspace-plan", { cache: "no-store" }),
      ]);
      const permData = await permRes.json().catch(() => null);
      const usersData = await usersRes.json().catch(() => null);
      const planData = await planRes.json().catch(() => null);

      if (permData?.ok) {
        setMatrix(permData.matrix);
        setFeatures(permData.features || []);
      } else {
        setError(permData?.error || "Failed to load permissions");
      }

      if (usersData?.ok && Array.isArray(usersData.users)) {
        setUsers(usersData.users);
      }
      if (planData?.ok) {
        setWorkspacePlan(planData);
      } else if (usersData?.ok && Array.isArray(usersData.users)) {
        const workspaceUsers = usersData.users as WorkspaceUserItem[];
        const activeUsers = workspaceUsers.filter((user) => user.status === "ACTIVE").length;
        const planCounts = workspaceUsers.reduce<Record<string, number>>((counts, user) => {
          const planName = user.packageName || "Free plan";
          counts[planName] = (counts[planName] ?? 0) + 1;
          return counts;
        }, {});
        const currentPlan = workspaceUsers.find((user) => user.packageName)?.packageName || "Free plan";
        setWorkspacePlan({
          plan: { name: currentPlan, status: "ACTIVE", expiresAt: null, seatLimit: 1, isUnlimited: false },
          usage: { totalUsers: workspaceUsers.length, activeUsers, planCounts },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function refreshUsers() {
    try {
      const res = await fetch("/api/sales/roles/users", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.ok && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch {}
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    if (workspacePlan && !workspacePlan.plan.isUnlimited && workspacePlan.usage.activeUsers >= (workspacePlan.plan.seatLimit ?? 0)) {
      setUserNotice({
        text: `Your ${workspacePlan.plan.name} includes ${workspacePlan.plan.seatLimit ?? 0} active user${workspacePlan.plan.seatLimit === 1 ? "" : "s"}. Upgrade the workspace plan to add another user.`,
        type: "error",
      });
      return;
    }
    if (!newName.trim() || !newEmail.trim() || newPassword.trim().length < 8) {
      setUserNotice({
        text: "Please enter a full name, valid Email ID, and a password of at least 8 characters.",
        type: "error",
      });
      return;
    }

    setCreatingUser(true);
    setUserNotice(null);
    try {
      const res = await fetch("/api/sales/roles/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim() || "+919000000000",
          password: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setNewName("");
        setNewEmail("");
        setNewPhone("");
        setNewPassword("");
        setUserNotice({
          text: `User account created for ${data.user?.email || newEmail}. Assign a role from the team list before they sign in.`,
          type: "success",
        });
        await refreshUsers();
        void loadAll();
      } else {
        setUserNotice({
          text: data?.error || "Unable to create user account.",
          type: "error",
        });
      }
    } catch (err) {
      setUserNotice({
        text: err instanceof Error ? err.message : "Network error while creating user.",
        type: "error",
      });
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleRoleChange(agentId: string, nextRole: "UNASSIGNED" | "ADMIN" | "MANAGER" | "SALES_AGENT") {
    try {
      const res = await fetch("/api/sales/roles/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, role: nextRole }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setUsers((prev) => prev.map((u) => (u.id === agentId ? { ...u, role: nextRole, status: nextRole === "UNASSIGNED" ? "PENDING" : "ACTIVE", parentAgentId: nextRole === "SALES_AGENT" ? u.parentAgentId : null } : u)));
        setUserNotice({ text: "User role updated.", type: "success" });
        void refreshUsers();
      }
    } catch {}
  }

  async function handleManagerChange(agentId: string, managerAgentId: string) {
    try {
      const res = await fetch("/api/sales/roles/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, managerAgentId: managerAgentId || null }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setUsers((prev) => prev.map((u) => (u.id === agentId ? { ...u, parentAgentId: managerAgentId || null } : u)));
        setUserNotice({ text: "Manager assignment updated.", type: "success" });
      } else {
        setUserNotice({ text: data?.error || "Could not update manager assignment.", type: "error" });
      }
    } catch {
      setUserNotice({ text: "Could not update manager assignment.", type: "error" });
    }
  }

  async function handleStatusChange(agentId: string, nextStatus: "ACTIVE" | "SUSPENDED") {
    try {
      const res = await fetch("/api/sales/roles/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setUsers((prev) => prev.map((user) => (user.id === agentId ? { ...user, status: nextStatus } : user)));
        setUserNotice({ text: nextStatus === "ACTIVE" ? "User access unlocked." : "User access locked.", type: "success" });
        void loadAll();
      } else {
        setUserNotice({ text: data?.error || "Could not update user access.", type: "error" });
      }
    } catch {
      setUserNotice({ text: "Could not update user access.", type: "error" });
    }
  }

  async function handleResetPassword(agentId: string) {
    if (resetPasswordInput.trim().length < 8) {
      setUserNotice({ text: "New password must be at least 8 characters.", type: "error" });
      return;
    }
    setResetBusy(true);
    try {
      const res = await fetch("/api/sales/roles/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, password: resetPasswordInput.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setResettingAgentId(null);
        setResetPasswordInput("");
        setUserNotice({ text: "User login password updated successfully!", type: "success" });
      } else {
        setUserNotice({ text: data?.error || "Failed to update password.", type: "error" });
      }
    } finally {
      setResetBusy(false);
    }
  }

  async function handleDeleteUser(agentId: string, name: string) {
    if (!confirm(`Remove ${name}'s account?`)) return;
    try {
      const res = await fetch(`/api/sales/roles/users?agentId=${encodeURIComponent(agentId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setUserNotice({ text: `Removed ${name}.`, type: "success" });
        await refreshUsers();
        void loadAll();
      } else {
        setUserNotice({ text: data?.error || "Could not delete this account.", type: "error" });
      }
    } catch {}
  }

  function toggleFeature(role: "ADMIN" | "MANAGER" | "SALES_AGENT", featureId: string) {
    if (!matrix) return;
    setMatrix((prev) => {
      if (!prev) return prev;
      const currentVal = prev[role]?.[featureId] ?? true;
      return {
        ...prev,
        [role]: {
          ...prev[role],
          [featureId]: !currentVal,
        },
      };
    });
    setSaveSuccess(false);
  }

  async function handleSave() {
    if (!matrix || saving) return;
    setSaving(true);
    setError("");
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/sales/roles/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        setError(data.error || "Failed to save permissions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }

  const categories = ["Core CRM", "Telephony & Audio", "Automation & AI", "Administration"] as const;

  if (loading) {
    return (
      <div
        style={{
          minHeight: "65vh",
          width: "100%",
          gridColumn: "1 / -1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem",
          textAlign: "center",
          color: "var(--closer-muted)",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: "rgba(255, 107, 47, 0.12)",
            border: "1px solid rgba(255, 107, 47, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--closer-orange, #ff6b2f)",
            marginBottom: "14px",
          }}
        >
          <RefreshCw className="animate-spin" size={24} />
        </div>
        <strong style={{ fontSize: "1rem", color: "var(--closer-ink)", marginBottom: "4px" }}>
          Loading Roles & User Accounts…
        </strong>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--closer-muted)" }}>
          Fetching team credentials and feature access matrix
        </p>
      </div>
    );
  }

  return (
    <div
      className="role-permissions-shell"
      style={{
        display: "grid",
        gap: "24px",
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        gridColumn: "1 / -1",
      }}
    >
      {/* SECTION 0: Workspace plan and seat usage */}
      {workspacePlan ? (
        <div
          className="workspace-plan-summary"
          id="workspace-plan"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1.2fr) repeat(2, minmax(150px, 0.7fr)) minmax(220px, 1fr)",
            gap: "12px",
            padding: "16px 18px",
            background: "var(--closer-surface-soft)",
            border: "1px solid var(--closer-line)",
            borderRadius: "14px",
            alignItems: "stretch",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(255, 107, 47, 0.12)", color: "var(--closer-orange)" }}>
              <CreditCard size={18} />
            </div>
            <div>
              <span style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--closer-muted)", fontWeight: 800 }}>Workspace plan</span>
              <strong style={{ display: "block", marginTop: 3, color: "var(--closer-ink)" }}>{workspacePlan.plan.name}</strong>
              <span style={{ display: "block", marginTop: 2, fontSize: "0.74rem", color: "var(--closer-muted)" }}>{workspacePlan.plan.status}</span>
            </div>
          </div>
          <div style={{ padding: "2px 12px", borderLeft: "1px solid var(--closer-line)" }}>
            <span style={{ display: "block", fontSize: "0.7rem", color: "var(--closer-muted)", fontWeight: 700 }}>Active users</span>
            <strong style={{ display: "block", marginTop: 4, fontSize: "1.25rem", color: "var(--closer-ink)" }}>{workspacePlan.usage.activeUsers}</strong>
            <span style={{ fontSize: "0.72rem", color: "var(--closer-muted)" }}>currently onboarded</span>
          </div>
          <div style={{ padding: "2px 12px", borderLeft: "1px solid var(--closer-line)" }}>
            <span style={{ display: "block", fontSize: "0.7rem", color: "var(--closer-muted)", fontWeight: 700 }}>User seats</span>
            <strong style={{ display: "block", marginTop: 4, fontSize: "1.25rem", color: "var(--closer-ink)" }}>{workspacePlan.plan.isUnlimited ? "∞" : `${workspacePlan.usage.activeUsers}/${workspacePlan.plan.seatLimit ?? 0}`}</strong>
            <span style={{ fontSize: "0.72rem", color: "var(--closer-muted)" }}>{workspacePlan.plan.isUnlimited ? "unlimited" : "active plan allowance"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", paddingLeft: "12px", borderLeft: "1px solid var(--closer-line)" }}>
            <div>
              <strong style={{ display: "block", fontSize: "0.82rem", color: "var(--closer-ink)" }}>Need more users?</strong>
              <span style={{ display: "block", marginTop: 3, fontSize: "0.72rem", color: "var(--closer-muted)" }}>Upgrade seats and unlock more workspace capacity.</span>
            </div>
            <a href="/?tab=roles#workspace-plan" className="sales-secondary-button compact" style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", textDecoration: "none" }}>
              Manage plan <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      ) : null}

      {workspacePlan ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "12px 14px",
            borderRadius: 12,
            background: "var(--closer-surface-soft)",
            border: "1px solid var(--closer-line)",
          }}
        >
          <strong style={{ fontSize: "0.78rem", color: "var(--closer-ink)", marginRight: 4 }}>Plan feature access</strong>
          {[
            ["WhatsApp", workspacePlan.entitlements?.whatsappIntegration],
            ["AI tools", workspacePlan.entitlements?.aiToolsAccess],
            ["Automations", workspacePlan.entitlements?.automationTools],
            ["Reports", workspacePlan.entitlements?.analyticsAccess],
            ["API", workspacePlan.entitlements?.apiAccess],
            ["Webhooks", workspacePlan.entitlements?.webhookAccess],
          ].map(([label, enabled]) => (
            <span
              key={String(label)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 8px",
                borderRadius: 999,
                fontSize: "0.72rem",
                fontWeight: 700,
                color: enabled ? "#047857" : "var(--closer-muted)",
                background: enabled ? "rgba(16, 185, 129, 0.12)" : "rgba(148, 163, 184, 0.12)",
                border: `1px solid ${enabled ? "rgba(16, 185, 129, 0.3)" : "var(--closer-line)"}`,
              }}
            >
              {enabled ? <Check size={12} /> : <ShieldCheck size={12} />}
              {String(label)} {enabled ? "On" : "Locked"}
            </span>
          ))}
        </div>
      ) : null}

      {/* SECTION 1: Team Member Accounts (Email ID, Password & Role Management) */}
      <div
        style={{
          background: "var(--closer-surface)",
          border: "1px solid var(--closer-line)",
          borderRadius: "16px",
          padding: "24px",
          display: "grid",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <UserPlus size={22} color="var(--closer-orange)" />
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--closer-ink)" }}>
                Team Member Accounts & Login Credentials
              </h2>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "rgba(255, 107, 47, 0.12)",
                  color: "var(--closer-orange)",
                  border: "1px solid rgba(255, 107, 47, 0.3)",
                }}
              >
                EMAIL ID & PASSWORD
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--closer-muted)" }}>
              Create login credentials (Email ID & Password) for Admins, Sales Managers, and Closers / Telecallers, or reset existing user passwords.
            </p>
          </div>
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              padding: "6px 12px",
              borderRadius: "8px",
              background: "var(--closer-surface-soft)",
              border: "1px solid var(--closer-line)",
              color: "var(--closer-ink)",
            }}
          >
            {users.length} Workspace {users.length === 1 ? "User" : "Users"}
          </span>
        </div>

        {userNotice ? (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              fontSize: "0.85rem",
              fontWeight: 600,
              background: userNotice.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              border: userNotice.type === "success" ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(239, 68, 68, 0.35)",
              color: userNotice.type === "success" ? "#10b981" : "#ef4444",
            }}
          >
            {userNotice.text}
          </div>
        ) : null}

        {/* Create User Form */}
        {canManageUsers ? (
        <form
          onSubmit={handleCreateUser}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
            gap: "12px",
            alignItems: "end",
            padding: "18px",
            borderRadius: "12px",
            background: "var(--closer-surface-soft)",
            border: "1px solid var(--closer-line)",
          }}
        >
          <label style={{ display: "grid", gap: "6px", fontSize: "0.78rem", fontWeight: 600, color: "var(--closer-muted)" }}>
            <span>Full Name *</span>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              style={{
                minHeight: "40px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--closer-line)",
                background: "var(--closer-surface)",
                color: "var(--closer-ink)",
                fontSize: "0.86rem",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "0.78rem", fontWeight: 600, color: "var(--closer-muted)" }}>
            <span>User Email ID *</span>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@company.com"
              style={{
                minHeight: "40px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--closer-line)",
                background: "var(--closer-surface)",
                color: "var(--closer-ink)",
                fontSize: "0.86rem",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "0.78rem", fontWeight: 600, color: "var(--closer-muted)" }}>
            <span>Login Password (min 8 chars) *</span>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter user password"
                style={{
                  width: "100%",
                  minHeight: "40px",
                  padding: "0 38px 0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--closer-line)",
                  background: "var(--closer-surface)",
                  color: "var(--closer-ink)",
                  fontSize: "0.86rem",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "8px",
                  border: 0,
                  background: "transparent",
                  color: "var(--closer-muted)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  padding: "4px",
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "0.78rem", fontWeight: 600, color: "var(--closer-muted)" }}>
            <span>Phone / WhatsApp</span>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+91 98765 43210"
              style={{
                minHeight: "40px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--closer-line)",
                background: "var(--closer-surface)",
                color: "var(--closer-ink)",
                fontSize: "0.86rem",
              }}
            />
          </label>

          <div
            style={{
              minHeight: "40px",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              borderRadius: "8px",
              border: "1px solid var(--closer-line)",
              background: "var(--closer-surface)",
              color: "var(--closer-muted)",
              fontSize: "0.82rem",
            }}
          >
            Role is assigned after account creation.
          </div>

          <button
            type="submit"
            disabled={creatingUser}
            className="sales-primary-button"
            style={{
              minHeight: "40px",
              padding: "0 18px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.86rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {creatingUser ? <RefreshCw className="animate-spin" size={15} /> : <Plus size={16} />}
            {creatingUser ? "Creating…" : "Create User Account"}
          </button>
        </form>
        ) : (
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "12px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              color: "var(--closer-ink)",
              fontSize: "0.86rem",
            }}
          >
            <strong style={{ display: "block", marginBottom: "4px" }}>Team management is restricted</strong>
            Only the workspace owner or an Admin can create users, assign roles, reset passwords, or lock access. Ask your workspace owner to grant Admin access.
          </div>
        )}

        {/* Existing Users Table */}
        <div style={{ overflowX: "auto", border: "1px solid var(--closer-line)", borderRadius: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--closer-surface-soft)", borderBottom: "1px solid var(--closer-line)" }}>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--closer-ink)" }}>Team Member</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--closer-ink)" }}>Login Email ID & Phone</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--closer-ink)" }}>Plan</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--closer-ink)" }}>Assigned Role</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--closer-ink)" }}>Reports To</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--closer-ink)" }}>Status</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--closer-ink)", textAlign: "right" }}>Password & Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid var(--closer-line)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, color: "var(--closer-ink)" }}>{user.displayName}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--closer-muted)" }}>Code: {user.agentCode}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--closer-ink)", fontWeight: 500 }}>
                      <Mail size={13} color="var(--closer-orange)" />
                      <span>{user.email || "No email set"}</span>
                    </div>
                    {user.phone ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.76rem", color: "var(--closer-muted)", marginTop: "2px" }}>
                        <Phone size={12} />
                        <span>{user.phone}</span>
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, color: "var(--closer-ink)" }}>{user.packageName || "Free plan"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--closer-muted)" }}>{user.packageStatus === "ACTIVE" ? "Active" : user.packageStatus}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <select
                      value={user.role}
                      onChange={(e) => void handleRoleChange(user.id, e.target.value as "UNASSIGNED" | "ADMIN" | "MANAGER" | "SALES_AGENT")}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        border: "1px solid var(--closer-line)",
                        background: "var(--closer-surface-soft)",
                        color: "var(--closer-ink)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      <option value="UNASSIGNED">Unassigned / Pending</option>
                      <option value="ADMIN">Admin (Owner)</option>
                      <option value="MANAGER">Sales Manager</option>
                      <option value="SALES_AGENT">Closer / Telecaller</option>
                    </select>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--closer-muted)", fontSize: "0.8rem" }}>
                    {user.role === "SALES_AGENT" ? (
                      <select
                        value={user.parentAgentId || ""}
                        onChange={(e) => void handleManagerChange(user.id, e.target.value)}
                        style={{
                          padding: "5px 8px",
                          borderRadius: "8px",
                          border: "1px solid var(--closer-line)",
                          background: "var(--closer-surface-soft)",
                          color: "var(--closer-ink)",
                          fontSize: "0.78rem",
                        }}
                      >
                        <option value="">Workspace team</option>
                        {users.filter((manager) => manager.status === "ACTIVE" && manager.role === "MANAGER").map((manager) => (
                          <option key={manager.id} value={manager.id}>{manager.displayName}</option>
                        ))}
                      </select>
                    ) : user.role === "UNASSIGNED" ? "Assign a role first" : "Not applicable"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "3px 9px",
                        borderRadius: "999px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: user.status === "ACTIVE" ? "rgba(16, 185, 129, 0.14)" : "rgba(245, 158, 11, 0.14)",
                        color: user.status === "ACTIVE" ? "#10b981" : "#f59e0b",
                        border: user.status === "ACTIVE" ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(245, 158, 11, 0.35)",
                      }}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {resettingAgentId === user.id ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <input
                          type="password"
                          minLength={8}
                          value={resetPasswordInput}
                          onChange={(e) => setResetPasswordInput(e.target.value)}
                          placeholder="New password (8+ chars)"
                          style={{
                            height: "32px",
                            padding: "0 10px",
                            borderRadius: "6px",
                            border: "1px solid var(--closer-line)",
                            background: "var(--closer-surface)",
                            color: "var(--closer-ink)",
                            fontSize: "0.78rem",
                            width: "165px",
                          }}
                        />
                        <button
                          type="button"
                          disabled={resetBusy}
                          onClick={() => void handleResetPassword(user.id)}
                          className="sales-primary-button compact"
                          style={{ height: "32px", padding: "0 10px", fontSize: "0.75rem" }}
                        >
                          {resetBusy ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResettingAgentId(null);
                            setResetPasswordInput("");
                          }}
                          className="sales-secondary-button compact"
                          style={{ height: "32px", padding: "0 8px", fontSize: "0.75rem" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          disabled={user.role === "UNASSIGNED"}
                          onClick={() => void handleStatusChange(user.id, user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
                          className="sales-secondary-button compact"
                          title={user.role === "UNASSIGNED" ? "Assign a role before unlocking access" : user.status === "ACTIVE" ? "Lock user access" : "Unlock user access"}
                          style={{ fontSize: "0.76rem", color: user.status === "ACTIVE" ? "#b45309" : "#047857", opacity: user.role === "UNASSIGNED" ? 0.55 : 1 }}
                        >
                          {user.role === "UNASSIGNED" ? "Assign role first" : user.status === "ACTIVE" ? "Lock" : "Unlock"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResettingAgentId(user.id);
                            setResetPasswordInput("");
                          }}
                          className="sales-secondary-button compact"
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.76rem" }}
                        >
                          <KeyRound size={13} /> Set / Reset Password
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteUser(user.id, user.displayName)}
                          className="sales-secondary-button compact"
                          title="Remove user"
                          style={{ padding: "0 8px", color: "#ef4444" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!users.length ? (
                <tr>
                  <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--closer-muted)" }}>
                    No team accounts found yet. Use the form above to create a user with Email ID and Password.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Header Banner for Role-Based Feature Selection */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          padding: "20px 24px",
          background: "var(--closer-surface)",
          border: "1px solid var(--closer-line)",
          borderRadius: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <ShieldCheck size={22} color="var(--closer-orange)" />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--closer-ink)" }}>
              Role & Plugin Access Matrix
            </h2>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: "999px",
                background: "rgba(255, 107, 47, 0.12)",
                color: "var(--closer-orange)",
                border: "1px solid rgba(255, 107, 47, 0.3)",
              }}
            >
              ACCESS CONTROL
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--closer-muted)" }}>
            Lock or unlock CRM tools, audio, integrations, and AI modules for each workspace role. Changes apply to every user in that role.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Live Role Preview Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--closer-muted)" }}>Simulate Role:</span>
            <select
              value={previewRole}
              onChange={(e) => {
                setPreviewRole(e.target.value);
                onRolePreviewChange?.(e.target.value);
              }}
              style={{
                background: "var(--closer-surface-soft)",
                border: "1px solid var(--closer-line)",
                color: "var(--closer-ink)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              <option value="ADMIN">Admin (Full Control)</option>
              <option value="MANAGER">Sales Manager</option>
              <option value="SALES_AGENT">Closer / Telecaller</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="sales-primary-button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 18px",
              fontSize: "0.86rem",
              fontWeight: 700,
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {saving ? <RefreshCw className="animate-spin" size={16} /> : saveSuccess ? <Check size={16} /> : <Save size={16} />}
            {saving ? "Saving Changes…" : saveSuccess ? "Permissions Saved!" : "Save Role Permissions"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Permissions Matrix Table */}
      <div
        style={{
          background: "var(--closer-surface)",
          border: "1px solid var(--closer-line)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "var(--closer-surface-soft)", borderBottom: "1px solid var(--closer-line)" }}>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "var(--closer-ink)", width: "42%" }}>
                  Feature / Capability
                </th>
                <th style={{ padding: "14px 16px", fontWeight: 700, textAlign: "center", color: "var(--closer-ink)", width: "19%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span>Admin</span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        background: "rgba(255,107,47,0.15)",
                        color: "var(--closer-orange)",
                      }}
                    >
                      Owner
                    </span>
                  </div>
                </th>
                <th style={{ padding: "14px 16px", fontWeight: 700, textAlign: "center", color: "var(--closer-ink)", width: "19%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span>Manager</span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        background: "rgba(16,185,129,0.15)",
                        color: "#10b981",
                      }}
                    >
                      Team Lead
                    </span>
                  </div>
                </th>
                <th style={{ padding: "14px 16px", fontWeight: 700, textAlign: "center", color: "var(--closer-ink)", width: "20%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span>Closer / Agent</span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        background: "rgba(59,130,246,0.15)",
                        color: "#3b82f6",
                      }}
                    >
                      Telecaller
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const categoryFeatures = features.filter((f) => f.category === category);
                if (!categoryFeatures.length) return null;

                return (
                  <tr key={category} style={{ borderBottom: "1px solid var(--closer-line)" }}>
                    <td colSpan={4} style={{ padding: 0 }}>
                      <div
                        style={{
                          padding: "10px 20px",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          background: "var(--closer-surface-soft)",
                          color: "var(--closer-muted)",
                          borderBottom: "1px solid var(--closer-line)",
                        }}
                      >
                        {category}
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                          {categoryFeatures.map((feat) => {
                            const adminAllowed = matrix?.ADMIN?.[feat.id] ?? true;
                            const managerAllowed = matrix?.MANAGER?.[feat.id] ?? false;
                            const agentAllowed = matrix?.SALES_AGENT?.[feat.id] ?? false;

                            return (
                              <tr
                                key={feat.id}
                                style={{
                                  borderBottom: "1px solid var(--closer-line)",
                                  transition: "background 0.15s ease",
                                }}
                              >
                                <td style={{ padding: "12px 20px", width: "42%" }}>
                                  <div style={{ fontWeight: 600, color: "var(--closer-ink)", marginBottom: "2px" }}>
                                    {feat.name}
                                  </div>
                                  <div style={{ fontSize: "0.78rem", color: "var(--closer-muted)" }}>
                                    {feat.description}
                                  </div>
                                </td>

                                {/* Admin checkbox */}
                                <td style={{ padding: "12px 16px", textAlign: "center", width: "19%" }}>
                                  <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={adminAllowed}
                                      onChange={() => toggleFeature("ADMIN", feat.id)}
                                      style={{
                                        width: "18px",
                                        height: "18px",
                                        accentColor: "var(--closer-orange)",
                                        cursor: "pointer",
                                      }}
            />
          </label>

                                </td>

                                {/* Manager checkbox */}
                                <td style={{ padding: "12px 16px", textAlign: "center", width: "19%" }}>
                                  <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={managerAllowed}
                                      onChange={() => toggleFeature("MANAGER", feat.id)}
                                      style={{
                                        width: "18px",
                                        height: "18px",
                                        accentColor: "var(--closer-orange)",
                                        cursor: "pointer",
                                      }}
                                    />
                                  </label>
                                </td>

                                {/* Closer/Agent checkbox */}
                                <td style={{ padding: "12px 16px", textAlign: "center", width: "20%" }}>
                                  <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={agentAllowed}
                                      onChange={() => toggleFeature("SALES_AGENT", feat.id)}
                                      style={{
                                        width: "18px",
                                        height: "18px",
                                        accentColor: "var(--closer-orange)",
                                        cursor: "pointer",
                                      }}
                                    />
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
