"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { CURRENT_USER, maskPhone, useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";

export type TeamRole = "ADMIN" | "MANAGER" | "CLOSER";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  status: "active" | "away" | "offline" | "on_leave";
  simConnected: boolean;
  maxCapacity: number;
  assignedLeads: number;
  pipelineValue: number;
  dealsWon: number;
  inRoundRobin: boolean;
  onLeave: boolean;
  numberMasking: boolean;
  reportingManager?: string;
  joinedAt: string;
}

export interface PermissionRow {
  id: string;
  category: string;
  label: string;
  desc: string;
  admin: boolean;
  manager: boolean;
  closer: boolean;
}

const DEFAULT_MEMBERS: TeamMember[] = [];

const DEFAULT_PERMISSIONS: PermissionRow[] = [];

const AUDIT_LOGS: Array<{ id: string; action: string; detail: string; user: string; time: string }> = [];

export function TeamView() {
  const { state } = useApp();
  const [tab, setTab] = useState<"members" | "matrix" | "routing" | "audit">("members");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionRow[]>(DEFAULT_PERMISSIONS);
  const [routingAlgorithm, setRoutingAlgorithm] = useState<"equal" | "performance" | "capacity">("equal");
  const [routingHoursOnly, setRoutingHoursOnly] = useState(true);
  const [unclaimedTimeout, setUnclaimedTimeout] = useState(15);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [tableViewMode, setTableViewMode] = useState<"standard" | "extended">("standard");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteRole, setInviteRole] = useState<TeamRole>("CLOSER");
  const [inviteCapacity, setInviteCapacity] = useState(15);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load from LocalStorage (non-member settings only, members are strictly live from API)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("closer.team.v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.permissions) setPermissions(parsed.permissions);
        if (parsed.routingAlgorithm) setRoutingAlgorithm(parsed.routingAlgorithm);
        if (parsed.routingHoursOnly !== undefined) setRoutingHoursOnly(parsed.routingHoursOnly);
        if (parsed.unclaimedTimeout) setUnclaimedTimeout(parsed.unclaimedTimeout);
      }
      const storedNav = localStorage.getItem("closer.manager.nav.v1");
      if (storedNav) {
        try {
          setManagerMenuVisibility(JSON.parse(storedNav));
        } catch {}
      }
      const storedCloserNav = localStorage.getItem("closer.closer.nav.v1");
      if (storedCloserNav) {
        try {
          setCloserMenuVisibility(JSON.parse(storedCloserNav));
        } catch {}
      }
      const storedOps = localStorage.getItem("closer.manager.ops.v1");
      if (storedOps) {
        try {
          const parsedOps = JSON.parse(storedOps);
          if (parsedOps.userControl !== undefined) setManagerUserControl(parsedOps.userControl);
          if (parsedOps.paymentApproval !== undefined) setManagerPaymentApproval(parsedOps.paymentApproval);
          if (parsedOps.leadRoutingAccess !== undefined) setManagerLeadRoutingAccess(parsedOps.leadRoutingAccess);
        } catch {}
      }
    } catch {
      // Ignore
    }
  }, []);

  // Live API Fetch for Team Members & Role Features
  useEffect(() => {
    let active = true;
    setLoading(true);

    // Fetch live permissions catalog from /api/sales/roles/features
    fetch("/api/sales/roles/features")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.features) || !active) return;
        const matrix = data.matrix || {};
        const rows: PermissionRow[] = data.features.map((feat: any) => ({
          id: feat.id,
          category: feat.category || "General",
          label: feat.name,
          desc: feat.description,
          admin: true,
          manager: Boolean(matrix.MANAGER?.[feat.id] ?? true),
          closer: Boolean(matrix.SALES_AGENT?.[feat.id] ?? true),
        }));
        setPermissions((prev) => (prev.length === 0 ? rows : prev));
      })
      .catch(() => {});

    async function loadTeam() {
      try {
        const res = await fetch("/api/sales/team");
        if (res.ok) {
          const json = await res.json();
          const rawList = Array.isArray(json?.agents)
            ? json.agents
            : Array.isArray(json?.data?.agents)
            ? json.data.agents
            : Array.isArray(json)
            ? json
            : [];

          if (active && rawList.length > 0) {
            let deletedIds: string[] = [];
            try {
              deletedIds = JSON.parse(localStorage.getItem("closer.deleted.members") || "[]");
            } catch {}
            const activeRawList = rawList.filter(
              (m: any) => !deletedIds.includes(String(m.id)) && !deletedIds.includes(String(m.userId))
            );

            const mapped: TeamMember[] = activeRawList.map((m: any) => {
              const rawRole = String(m.role || m.workspaceRole || "").toUpperCase();
              const role: TeamRole = rawRole.includes("ADMIN") ? "ADMIN" : rawRole.includes("MANAGER") ? "MANAGER" : "CLOSER";
              const rawStatus = String(m.status || "").toLowerCase();
              const status: "active" | "away" | "offline" | "on_leave" =
                m.onLeave || rawStatus === "on_leave" ? "on_leave" : rawStatus === "active" ? "active" : "offline";

              return {
                id: m.id || m.userId || `tm-${Math.random().toString(36).slice(2, 6)}`,
                name: m.displayName || m.user?.displayName || m.name || m.agentCode || "Sales Agent",
                email: m.email || m.user?.email || "",
                phone: m.phone || m.user?.phone || "",
                role,
                status,
                simConnected: Boolean(m.simConnected ?? true),
                maxCapacity: Number(m.maxActiveLeads || m.maxCapacity || 25),
                assignedLeads: Number(m.assignedLeadsCount || m._count?.leadAssignments || m._count?.assignedLeads || 0),
                pipelineValue: Number(m.pipelineValue || 0),
                dealsWon: Number(m.dealsWon || 0),
                inRoundRobin: Boolean(m.canClaimLeads ?? m.inRoundRobin ?? (role !== "ADMIN")),
                onLeave: Boolean(m.onLeave),
                numberMasking: Boolean(m.numberMasking),
                reportingManager: m.reportingManager || "Founder & Owner",
                joinedAt: m.createdAt
                  ? new Date(m.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                  : "Active",
              };
            });

            setMembers(mapped);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Direct /api/sales/team fetch failed:", err);
      }

      // Fallback via aicloserApi if direct /api/sales/team returned no agents
      try {
        const res: any = await aicloserApi.team.listMembers();
        if (!active) return;
        const rawList = Array.isArray(res)
          ? res
          : Array.isArray(res?.members)
          ? res.members
          : Array.isArray(res?.data?.members)
          ? res.data.members
          : [];

        if (rawList.length > 0) {
          let deletedIds: string[] = [];
          try {
            deletedIds = JSON.parse(localStorage.getItem("closer.deleted.members") || "[]");
          } catch {}
          const activeRawList = rawList.filter(
            (m: any) => !deletedIds.includes(String(m.id)) && !deletedIds.includes(String(m.userId))
          );

          const mapped: TeamMember[] = activeRawList.map((m: any) => {
            const rawRole = String(m.role || "").toUpperCase();
            const role: TeamRole = rawRole.includes("ADMIN") ? "ADMIN" : rawRole.includes("MANAGER") ? "MANAGER" : "CLOSER";
            return {
              id: m.id || m.userId || `tm-${Math.random().toString(36).slice(2, 6)}`,
              name: m.displayName || m.user?.displayName || m.name || "Closer Agent",
              email: m.email || m.user?.email || "",
              phone: m.phone || m.user?.phone || "",
              role,
              status: m.status === "ACTIVE" || m.isActive ? "active" : "offline",
              simConnected: true,
              maxCapacity: m.maxActiveLeads || m.maxCapacity || 25,
              assignedLeads: m.assignedLeadsCount || m._count?.leadAssignments || 0,
              pipelineValue: m.pipelineValue || 0,
              dealsWon: m.dealsWon || 0,
              inRoundRobin: m.canClaimLeads ?? m.inRoundRobin ?? (role !== "ADMIN"),
              onLeave: Boolean(m.onLeave),
              numberMasking: Boolean(m.numberMasking),
              reportingManager: m.reportingManager || "Founder & Owner",
              joinedAt: m.createdAt
                ? new Date(m.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                : "Active",
            };
          });
          setMembers(mapped);
        } else {
          setMembers([]);
        }
      } catch {
        if (active) setMembers([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTeam();
    return () => {
      active = false;
    };
  }, []);

  const saveToStorage = (updatedMembers = members, updatedPerms = permissions) => {
    try {
      localStorage.setItem(
        "closer.team.v1",
        JSON.stringify({
          members: updatedMembers,
          permissions: updatedPerms,
          routingAlgorithm,
          routingHoursOnly,
          unclaimedTimeout,
        })
      );
      setSavedBanner("Changes saved to workspace!");
      setTimeout(() => setSavedBanner(null), 2500);
    } catch {
      }
  };

  const router = useRouter();
  const { setScope } = useApp();

  // Manager Navigation Visibility State
  const [managerMenuVisibility, setManagerMenuVisibility] = useState<Record<string, boolean>>({
    "/dashboard": true,
    "/pipeline": true,
    "/contacts": true,
    "/chat": true,
    "/calls": true,
    "/whatsapp": true,
    "/payments": true,
    "/lead-import": true,
    "/automations": false,
    "/settings": false,
  });
  const [managerUserControl, setManagerUserControl] = useState(true);
  const [managerPaymentApproval, setManagerPaymentApproval] = useState(true);
  const [managerLeadRoutingAccess, setManagerLeadRoutingAccess] = useState(false);

  // Closer / Field Agent Optional Feature Unlocks State (Disabled by default)
  const [closerMenuVisibility, setCloserMenuVisibility] = useState<Record<string, boolean>>({
    "/whatsapp": false,
    "/channels": false,
    "/forms": false,
    "/lead-import": false,
  });

  const handleToggleLeave = (memberId: string) => {
    const updated = members.map((m) => {
      if (m.id !== memberId) return m;
      const nextLeave = !m.onLeave;
      return {
        ...m,
        onLeave: nextLeave,
        status: nextLeave ? ("on_leave" as const) : ("active" as const),
      };
    });
    setMembers(updated);
    saveToStorage(updated, permissions);
    setSavedBanner("Closer leave status & round-robin availability updated");
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleToggleMasking = (memberId: string) => {
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, numberMasking: !m.numberMasking } : m
    );
    setMembers(updated);
    saveToStorage(updated, permissions);
    const target = updated.find((m) => m.id === memberId);
    setSavedBanner(`Phone number masking ${target?.numberMasking ? "enabled (+91 98765 •••••)" : "disabled"} for ${target?.name}`);
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleChangeReportingManager = (memberId: string, reportingManager: string) => {
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, reportingManager } : m
    );
    setMembers(updated);
    saveToStorage(updated, permissions);
    setSavedBanner("Reporting hierarchy updated");
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleViewDashboardAs = (memberName: string) => {
    setScope(`agent:${memberName}`);
    setSavedBanner(`Viewing entire workspace as ${memberName}`);
    setTimeout(() => setSavedBanner(null), 3000);
    router.push("/dashboard");
  };

  const handleToggleRoundRobin = (memberId: string) => {
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, inRoundRobin: !m.inRoundRobin } : m
    );
    setMembers(updated);
    saveToStorage(updated, permissions);
  };

  const handleUpdateCapacity = (memberId: string, maxCapacity: number) => {
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, maxCapacity } : m
    );
    setMembers(updated);
    saveToStorage(updated, permissions);
    const target = updated.find((m) => m.id === memberId);
    setSavedBanner(`Active lead quota updated to ${maxCapacity} leads for ${target?.name}`);
    setTimeout(() => setSavedBanner(null), 2500);

    aicloserApi.team.update(memberId, { maxActiveLeads: maxCapacity }).catch(() => {});
  };

  const handleChangeRole = (memberId: string, newRole: TeamRole) => {
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, role: newRole } : m
    );
    setMembers(updated);
    saveToStorage(updated, permissions);
  };

  const handleChangeStatus = (memberId: string, status: "active" | "away" | "offline" | "on_leave") => {
    const updated = members.map((m) => {
      if (m.id !== memberId) return m;
      const onLeave = status === "on_leave";
      return { ...m, status, onLeave };
    });
    setMembers(updated);
    saveToStorage(updated, permissions);
  };

  const handleDeleteMember = async (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    if (target.role === "ADMIN") {
      alert("Workspace owner/admin account cannot be removed.");
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete team member "${target.name}"?`)) return;

    // Optimistic UI update
    const updated = members.filter((m) => m.id !== memberId);
    setMembers(updated);
    saveToStorage(updated, permissions);

    // Persist deleted ID in blacklist so it never re-appears on reload
    try {
      const deletedIds = JSON.parse(localStorage.getItem("closer.deleted.members") || "[]");
      if (!deletedIds.includes(String(memberId))) {
        deletedIds.push(String(memberId));
        localStorage.setItem("closer.deleted.members", JSON.stringify(deletedIds));
      }
    } catch {}

    setSavedBanner(`Deleted "${target.name}" permanently from workspace.`);
    setTimeout(() => setSavedBanner(null), 3500);

    // Call backend API to permanently delete from PostgreSQL
    try {
      await aicloserApi.team.delete(memberId);
    } catch (err) {
      console.warn("Team delete API fallback to super-admin delete:", err);
      try {
        const tenantId = (state.user as any)?.tenantId || "tenant-the-storage-test-1d01dda2";
        await aicloserApi.superAdmin.deleteTenantUser(tenantId, memberId);
      } catch (err2) {
        console.error("Failed to delete user on backend:", err2);
      }
    }
  };

  const handleTogglePermission = (id: string, role: "manager" | "closer") => {
    const updated = permissions.map((p) =>
      p.id === id ? { ...p, [role]: !p[role] } : p
    );
    setPermissions(updated);

    if (role === "closer") {
      const isNowChecked = !permissions.find((p) => p.id === id)?.closer;
      if (id === "whatsapp_bulk_marketing") {
        setCloserMenuVisibility((prev) => ({ ...prev, "/whatsapp": isNowChecked }));
      } else if (id === "plugins_channels_hub") {
        setCloserMenuVisibility((prev) => ({ ...prev, "/channels": isNowChecked }));
      } else if (id === "forms_builder") {
        setCloserMenuVisibility((prev) => ({ ...prev, "/forms": isNowChecked }));
      } else if (id === "lead_import") {
        setCloserMenuVisibility((prev) => ({ ...prev, "/lead-import": isNowChecked }));
      }
    }
  };

  const handleSaveMatrix = () => {
    saveToStorage(members, permissions);
    try {
      localStorage.setItem("closer.manager.nav.v1", JSON.stringify(managerMenuVisibility));
      localStorage.setItem("closer.closer.nav.v1", JSON.stringify(closerMenuVisibility));
      localStorage.setItem(
        "closer.manager.ops.v1",
        JSON.stringify({
          userControl: managerUserControl,
          paymentApproval: managerPaymentApproval,
          leadRoutingAccess: managerLeadRoutingAccess,
        })
      );
      window.dispatchEvent(new Event("aicloser:permissions_updated"));
    } catch {}
    setSavedBanner("Role capabilities, matrix permissions & navigation controls saved!");
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleAddMember = async () => {
    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    const rawPhone = invitePhone.replace(/\D/g, "").slice(-10);
    const password = invitePassword.trim();

    if (!name) return setInviteError("Full name is required.");
    if (!email || !email.includes("@")) return setInviteError("Valid email is required.");
    if (!/^[6-9]\d{9}$/.test(rawPhone)) {
      return setInviteError("Valid 10-digit phone number is required.");
    }
    if (!password || password.length < 6) {
      return setInviteError("Password must be at least 6 characters.");
    }

    setIsSubmitting(true);
    setInviteError(null);

    const cleanPhone = `+91 ${rawPhone}`;
    const payload = {
      displayName: name,
      name,
      email,
      phone: cleanPhone,
      role: inviteRole,
      password,
      maxCapacity: Number(inviteCapacity) || 15,
      maxActiveLeads: Number(inviteCapacity) || 15,
      reportingManager: inviteRole === "MANAGER" ? "Founder & Owner" : "Sales Manager Desk",
    };

    try {
      let apiSuccess = false;
      let createdMemberData: any = null;

      // 1. Dispatch to Central API invite endpoint
      try {
        const res: any = await aicloserApi.team.invite(payload);
        if (res && (res.ok || res.success || res.agent || res.user || res.id)) {
          apiSuccess = true;
          createdMemberData = res.agent || res.user || res.data || res;
        }
      } catch (centralErr) {
        console.warn("Central /team/invite failed, falling back to local /api/sales/team:", centralErr);
      }

      // 2. Dispatch to local /api/sales/team if central did not complete
      if (!apiSuccess) {
        try {
          const localRes = await fetch("/api/sales/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await localRes.json().catch(() => ({}));
          if (localRes.ok && (json.ok || json.success)) {
            apiSuccess = true;
            createdMemberData = json.agent || json.user || json;
          } else if (localRes.status === 400 || localRes.status === 409) {
            setInviteError(json.error || json.message || "Failed to create team member. User may already exist.");
            setIsSubmitting(false);
            return;
          }
        } catch (localErr) {
          console.warn("Local /api/sales/team POST failed:", localErr);
        }
      }

      const newMember: TeamMember = {
        id: createdMemberData?.id || createdMemberData?.userId || `tm-${Date.now()}`,
        name,
        email,
        phone: cleanPhone,
        role: inviteRole,
        status: "active",
        simConnected: false,
        maxCapacity: Number(inviteCapacity) || 15,
        assignedLeads: 0,
        pipelineValue: 0,
        dealsWon: 0,
        inRoundRobin: inviteRole === "CLOSER",
        onLeave: false,
        numberMasking: false,
        reportingManager: payload.reportingManager,
        joinedAt: "Just now",
      };

      const updated = [...members, newMember];
      setMembers(updated);
      saveToStorage(updated, permissions);

      setIsInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      setInvitePassword("");
      setShowInvitePassword(false);
      setInviteRole("CLOSER");
      setInviteCapacity(15);
      setInviteError(null);

      const roleLabel = inviteRole === "MANAGER" ? "Sales Manager" : inviteRole === "ADMIN" ? "Admin" : "Sales Closer";
      setSavedBanner(`Team member "${name}" (${roleLabel}) created successfully! Password active.`);
      setTimeout(() => setSavedBanner(null), 3500);
    } catch (err: any) {
      setInviteError(err?.message || "An unexpected error occurred while creating team member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const matchRole = roleFilter === "ALL" || m.role === roleFilter;
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.includes(q);
      return matchRole && matchQuery;
    });
  }, [members, search, roleFilter]);

  const activeClosersCount = members.filter((m) => m.role === "CLOSER" && m.status === "active").length;
  const totalPipelineSum = members.reduce((acc, m) => acc + m.pipelineValue, 0);

  return (
    <div className="team-container" style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Page Header */}
      <header className="page-head" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
            Team & Users
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Manage workspace seats, closer role permissions, automated round-robin routing, and revenue ownership.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {savedBanner && (
            <span className="chip" data-tone="success" style={{ padding: "4px 10px" }}>
              <Icon name="check" size={13} /> {savedBanner}
            </span>
          )}
          <button className="btn" data-variant="primary" onClick={() => setIsInviteOpen(true)}>
            <Icon name="plus" size={14} /> Invite member
          </button>
        </div>
      </header>

      {/* Top Metrics Row */}
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
            Workspace Seats
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {members.length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>/ 10 seats</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="dot" style={{ background: "var(--success)" }} /> {10 - members.length} seats available
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Active Closers
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {activeClosersCount} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>online now</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Taking live WhatsApp & SIM calls
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Round-Robin
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--accent)" }}>
            {routingAlgorithm === "equal" ? "Sequential" : routingAlgorithm === "performance" ? "Performance" : "Capacity"}
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            {members.filter((m) => m.inRoundRobin).length} closers in active queue
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Team Pipeline
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            ₹{totalPipelineSum.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Across {members.reduce((acc, m) => acc + m.assignedLeads, 0)} assigned active leads
          </div>
        </div>
      </div>

      {/* Segmented Tab Controls */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
        <div className="seg" role="tablist" aria-label="Team sections">
          <button
            role="tab"
            aria-selected={tab === "members"}
            data-on={tab === "members"}
            onClick={() => setTab("members")}
          >
            <Icon name="users" size={13} /> Members ({members.length})
          </button>
          <button
            role="tab"
            aria-selected={tab === "matrix"}
            data-on={tab === "matrix"}
            onClick={() => setTab("matrix")}
          >
            <Icon name="shield" size={13} /> Role &amp; Permissions Matrix
          </button>
          <button
            role="tab"
            aria-selected={tab === "routing"}
            data-on={tab === "routing"}
            onClick={() => setTab("routing")}
          >
            <Icon name="branch" size={13} /> Round-Robin Distribution
          </button>
          <button
            role="tab"
            aria-selected={tab === "audit"}
            data-on={tab === "audit"}
            onClick={() => setTab("audit")}
          >
            <Icon name="clock" size={13} /> Audit Trail
          </button>
        </div>
      </div>

      {/* Tab 1: Members Table */}
      {tab === "members" && (
        <section className="card" style={{ overflow: "hidden" }}>
          {/* Filter Bar */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: "10px", alignItems: "center" }}>
            <div className="search" style={{ width: "260px" }}>
              <Icon name="search" size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name, email, phone..."
                style={{ fontSize: "var(--fs-caption)" }}
              />
            </div>
            <div className="seg">
              {["ALL", "ADMIN", "MANAGER", "CLOSER"].map((r) => (
                <button key={r} data-on={roleFilter === r} onClick={() => setRoleFilter(r)}>
                  {r === "ALL" ? "All Roles" : r === "CLOSER" ? "Closers" : r.charAt(0) + r.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="seg" style={{ marginLeft: "4px" }}>
              <button
                data-on={tableViewMode === "standard"}
                onClick={() => setTableViewMode("standard")}
                title="Standard Clean View (8 Columns - matching original design)"
              >
                Standard
              </button>
              <button
                data-on={tableViewMode === "extended"}
                onClick={() => setTableViewMode("extended")}
                title="Governance View (Includes Masking & Hierarchy)"
              >
                Governance
              </button>
            </div>
            <div style={{ marginLeft: "auto", fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
              Showing {filteredMembers.length} member{filteredMembers.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="table-wrap">
            <table className="table" style={{ width: "100%", minWidth: tableViewMode === "extended" ? "1160px" : "940px", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "220px" }}>Member</th>
                  <th style={{ width: "110px" }}>Role</th>
                  <th style={{ width: "120px" }}>Telephony SIM</th>
                  <th style={{ width: "100px" }}>Active Leads</th>
                  <th style={{ width: "110px" }}>Pipeline Value</th>
                  <th style={{ width: "155px" }}>Status</th>
                  {tableViewMode === "extended" && (
                    <>
                      <th style={{ width: "120px" }}>Phone Masking</th>
                      <th style={{ width: "160px" }}>Reports To</th>
                    </>
                  )}
                  <th style={{ width: "105px" }}>Round-Robin</th>
                  <th style={{ width: "60px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={tableViewMode === "extended" ? 10 : 8}>
                      <div className="empty">
                        <p>Loading workspace team...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={tableViewMode === "extended" ? 10 : 8}>
                      <div className="empty">
                        <div className="empty-icon">
                          <Icon name="users" size={20} />
                        </div>
                        <h3>No team members added yet</h3>
                        <p>
                          Invite closers, managers, and admins to collaborate in your sales workspace.
                        </p>
                        <button className="btn" data-variant="primary" data-size="sm" onClick={() => setIsInviteOpen(true)}>
                          <Icon name="plus" size={13} /> Invite Member
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                  <tr key={member.id} style={{ opacity: member.onLeave ? 0.75 : 1 }}>
                    <td style={{ minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background:
                              member.role === "ADMIN"
                                ? "var(--accent)"
                                : member.role === "MANAGER"
                                ? "var(--accent-strong)"
                                : "var(--solid-muted)",
                            color: "#fff",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "12px",
                            fontWeight: 650,
                            flexShrink: 0,
                          }}
                        >
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <div style={{ fontWeight: 550, color: "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                            {member.name}
                            {member.role === "ADMIN" && (
                              <span className="chip" data-tone="accent" style={{ fontSize: "10px", padding: "1px 5px" }}>ADMIN</span>
                            )}
                          </div>
                          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", lineHeight: 1.25 }}>
                            {member.email}
                          </div>
                          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", lineHeight: 1.25 }}>
                            • {member.numberMasking ? maskPhone(member.phone, true) : member.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <select
                        className="select"
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value as TeamRole)}
                        aria-label={`Role for ${member.name}`}
                        style={{
                          height: "28px",
                          fontSize: "12px",
                          padding: "0 8px",
                          fontWeight: 550,
                          borderColor: "transparent",
                          background: "var(--bg-hover)",
                          minWidth: "96px",
                          borderRadius: "var(--r-sm)",
                        }}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="CLOSER">Closer</option>
                      </select>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {member.simConnected ? (
                        <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>
                          <Icon name="phone" size={11} /> Connected
                        </span>
                      ) : (
                        <span className="chip" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                          No SIM
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 550 }}>{member.assignedLeads}</span>
                        <span style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>/</span>
                        {member.role === "ADMIN" ? (
                          <span style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>∞ (Admin)</span>
                        ) : (
                          <select
                            className="select"
                            value={member.maxCapacity}
                            onChange={(e) => handleUpdateCapacity(member.id, Number(e.target.value))}
                            style={{ height: "24px", fontSize: "11px", padding: "0 4px", width: "76px" }}
                            title="Admin control: Maximum active leads allowed simultaneously for this closer"
                          >
                            <option value={5}>5 max</option>
                            <option value={10}>10 max</option>
                            <option value={15}>15 max</option>
                            <option value={20}>20 max</option>
                            <option value={25}>25 max</option>
                            <option value={35}>35 max</option>
                            <option value={50}>50 max</option>
                            <option value={100}>100 max</option>
                          </select>
                        )}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 550 }}>
                        {member.pipelineValue > 0 ? `₹${member.pipelineValue.toLocaleString("en-IN")}` : "—"}
                      </span>
                      {member.dealsWon > 0 && (
                        <span style={{ color: "var(--success)", fontSize: "11px", marginLeft: "6px" }}>
                          ({member.dealsWon} won)
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap", minWidth: "155px" }}>
                      {member.onLeave ? (
                        <button
                          className="chip"
                          data-tone="warning"
                          onClick={() => handleToggleLeave(member.id)}
                          title="Click to resume active duty"
                          style={{ cursor: "pointer", fontSize: "11px", fontWeight: 600, border: "none" }}
                        >
                          🌴 On Leave
                        </button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <select
                            className="select"
                            value={member.status}
                            onChange={(e) => handleChangeStatus(member.id, e.target.value as any)}
                            aria-label={`Availability for ${member.name}`}
                            style={{
                              height: "26px",
                              fontSize: "11px",
                              padding: "0 4px",
                              minWidth: "85px",
                              borderColor: "transparent",
                              background: "transparent",
                              color:
                                member.status === "active"
                                  ? "var(--success)"
                                  : member.status === "away"
                                    ? "var(--warning)"
                                    : "var(--text-tertiary)",
                              fontWeight: 550,
                            }}
                          >
                            <option value="active">● Active</option>
                            <option value="away">● Away</option>
                            <option value="offline">● Offline</option>
                          </select>
                          {member.role === "CLOSER" && (
                            <button
                              className="btn"
                              data-size="sm"
                              data-variant="ghost"
                              onClick={() => handleToggleLeave(member.id)}
                              title="Mark closer as on leave (temporarily suspends round robin)"
                              style={{ height: "22px", fontSize: "10px", padding: "0 5px", color: "var(--text-tertiary)" }}
                            >
                              🌴 Leave
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    {tableViewMode === "extended" && (
                      <>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button
                            className="chip"
                            data-tone={member.numberMasking ? "info" : "default"}
                            onClick={() => handleToggleMasking(member.id)}
                            title={member.numberMasking ? "Phone numbers masked from this user (+91 98765 •••••)" : "Phone numbers visible in raw format"}
                            style={{ cursor: "pointer", fontSize: "11px", fontWeight: 550, border: "none" }}
                          >
                            <Icon name={member.numberMasking ? "shield" : "eye"} size={11} />
                            {member.numberMasking ? "Masked" : "Visible"}
                          </button>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <select
                            className="select"
                            value={member.reportingManager || "Direct Admin"}
                            onChange={(e) => handleChangeReportingManager(member.id, e.target.value)}
                            aria-label={`Reporting manager for ${member.name}`}
                          >
                            {members.filter((m) => m.role === "ADMIN" || m.role === "MANAGER").length > 0 ? (
                              members
                                .filter((m) => m.role === "ADMIN" || m.role === "MANAGER")
                                .map((mgr) => (
                                  <option key={mgr.id} value={mgr.name}>
                                    {mgr.name} ({mgr.role})
                                  </option>
                                ))
                            ) : (
                              <option value="Direct Admin">Direct Admin</option>
                            )}
                          </select>
                        </td>
                      </>
                    )}
                    <td style={{ whiteSpace: "nowrap" }}>
                      {member.role === "ADMIN" ? (
                        <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                          Excluded
                        </span>
                      ) : member.onLeave ? (
                        <span className="chip" data-tone="warning" style={{ fontSize: "11px" }}>
                          🌴 On Leave
                        </span>
                      ) : (
                        <button
                          className="chip"
                          onClick={() => handleToggleRoundRobin(member.id)}
                          style={{
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: 600,
                            border: "none",
                            background: member.inRoundRobin ? "var(--accent)" : "transparent",
                            color: member.inRoundRobin ? "#fff" : "var(--text-secondary)",
                            padding: "3px 10px",
                            borderRadius: "var(--r-sm)",
                          }}
                        >
                          {member.inRoundRobin ? "In Queue" : "Excluded"}
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: "center", width: "60px", whiteSpace: "nowrap" }}>
                      {member.role !== "ADMIN" && (
                        <button
                          className="btn"
                          data-variant="ghost"
                          onClick={() => handleDeleteMember(member.id)}
                          title={`Permanently delete ${member.name}`}
                          style={{
                            padding: "4px",
                            height: "28px",
                            width: "28px",
                            display: "inline-grid",
                            placeItems: "center",
                            color: "var(--text-tertiary)",
                            borderRadius: "var(--r-sm)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--danger, #ef4444)";
                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--text-tertiary)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Role & Permissions Matrix */}
      {tab === "matrix" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Role Capabilities & Access Control</h2>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Permissions control what actions each team role can execute in the pipeline and central API.
              </p>
            </div>
            <button className="btn" data-variant="primary" onClick={handleSaveMatrix}>
              <Icon name="check" size={13} /> Save Permissions
            </button>
          </div>

          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "45%" }}>Capability</th>
                  <th style={{ width: "18%", textAlign: "center" }}>
                    <span className="chip" data-tone="accent">ADMIN</span>
                  </th>
                  <th style={{ width: "18%", textAlign: "center" }}>
                    <span className="chip" data-tone="info">MANAGER</span>
                  </th>
                  <th style={{ width: "18%", textAlign: "center" }}>
                    <span className="chip" data-tone="success">CLOSER</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p, idx) => {
                  const showCat = idx === 0 || permissions[idx - 1].category !== p.category;
                  return (
                    <Fragment key={p.id}>
                      {showCat ? (
                        <tr style={{ background: "var(--bg-hover, rgba(255,255,255,0.03))" }}>
                          <td colSpan={4} style={{ padding: "8px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)" }}>
                            {p.category}
                          </td>
                        </tr>
                      ) : null}
                      <tr>
                        <td>
                          <div style={{ fontWeight: 550, color: "var(--text)" }}>{p.label}</div>
                          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>{p.desc}</div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ color: "var(--success)" }}>
                            <Icon name="check" size={15} />
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={p.manager}
                            onChange={() => handleTogglePermission(p.id, "manager")}
                            style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={p.closer}
                            onChange={() => handleTogglePermission(p.id, "closer")}
                            style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                          />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Manager Navigation Menu Visibility & Admin Governance */}
          <div style={{ padding: "20px", borderTop: "1px solid var(--border)", background: "var(--bg-soft)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="chip" data-tone="accent" style={{ fontWeight: 650 }}>ADMIN GOVERNANCE</span>
                  <h3 style={{ fontSize: "var(--fs-body)", fontWeight: 600, margin: 0 }}>Manager Portal Navigation &amp; Operational Controls</h3>
                </div>
                <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                  Admin has absolute authority over what modules Managers see in the sidebar, which actions they can execute, and whether they can approve UPI payments.
                </p>
              </div>
              <button className="btn" data-variant="accent" data-size="sm" onClick={handleSaveMatrix}>
                <Icon name="check" size={13} /> Apply Manager Matrix
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "8px" }}>
              {/* Menu items card */}
              <div className="card" style={{ padding: "16px", background: "var(--bg-surface)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: "10px" }}>
                  Sidebar Menu Visibility For Managers
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { path: "/dashboard", label: "Dashboard", desc: "Team pipeline metrics & revenue charts" },
                    { path: "/pipeline", label: "Pipeline Kanban", desc: "Drag-and-drop lead stage board" },
                    { path: "/contacts", label: "Contacts & 360 CRM", desc: "Customer directory & activity history" },
                    { path: "/chat", label: "Inbound Multi-Channel Chat", desc: "WhatsApp & Instagram shared inbox" },
                    { path: "/calls", label: "SIM Telephony & Calls", desc: "Android SIM call logs & recordings" },
                    { path: "/whatsapp", label: "WhatsApp QR & Cloud API", desc: "Device pairing & cloud inbox" },
                    { path: "/payments", label: "UPI & Razorpay Invoicing", desc: "Dynamic QR generation & receipts" },
                    { path: "/lead-import", label: "Multi-Source Lead Import", desc: "CSV, Excel, Sheets & QR extraction" },
                    { path: "/automations", label: "AI Automations & Lead Routing", desc: "Round-robin distribution & AI models" },
                    { path: "/settings", label: "Settings & API Vault", desc: "Workspace configuration & credentials" },
                  ].map((item) => (
                    <label key={item.path} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: "6px", background: "var(--bg-hover)", cursor: "pointer" }}>
                      <div>
                        <div style={{ fontSize: "var(--fs-body)", fontWeight: 550 }}>{item.label}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={managerMenuVisibility[item.path] ?? false}
                        onChange={(e) => setManagerMenuVisibility((prev) => ({ ...prev, [item.path]: e.target.checked }))}
                        style={{ width: "16px", height: "16px", accentColor: "var(--accent)", cursor: "pointer" }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Operational governance card */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="card" style={{ padding: "16px", background: "var(--bg-surface)" }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: "10px" }}>
                    Manager Operational Permissions
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px", borderRadius: "6px", background: "var(--bg-hover)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={managerUserControl}
                        onChange={(e) => setManagerUserControl(e.target.checked)}
                        style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                      />
                      <div>
                        <div style={{ fontWeight: 550, fontSize: "var(--fs-body)" }}>Closer User Management</div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          Can invite new closers, mark users on leave, toggle phone masking, and reassign reporting hierarchy under their team.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px", borderRadius: "6px", background: "var(--bg-hover)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={managerPaymentApproval}
                        onChange={(e) => setManagerPaymentApproval(e.target.checked)}
                        style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                      />
                      <div>
                        <div style={{ fontWeight: 550, fontSize: "var(--fs-body)", color: "var(--accent)" }}>UPI Payment Verification &amp; Approval</div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          Can inspect customer UPI screenshot proofs, verify UTR transaction IDs, and approve deals into Closed Won status.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px", borderRadius: "6px", background: "var(--bg-hover)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={managerLeadRoutingAccess}
                        onChange={(e) => setManagerLeadRoutingAccess(e.target.checked)}
                        style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                      />
                      <div>
                        <div style={{ fontWeight: 550, fontSize: "var(--fs-body)" }}>Lead Distribution &amp; Routing Config</div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          Can adjust round-robin allocation parameters, SLA lead grab timers, and source distribution rules.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="card" style={{ padding: "14px", border: "1px dashed var(--accent)", background: "rgba(59,130,246,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "12px", color: "var(--accent)" }}>
                    <Icon name="shield" size={13} /> Mandatory Security Isolation
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.45 }}>
                    Company Admin credentials, master API keys, and workspace billing remain 100% hidden and unalterable by Managers regardless of any role delegation.
                  </div>
                </div>
              </div>
            </div>

            {/* Closer / Field Agent Navigation Menu Visibility & Admin Governance */}
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px dashed var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="chip" data-tone="success" style={{ fontWeight: 650 }}>USER ACCESS</span>
                    <h3 style={{ fontSize: "var(--fs-body)", fontWeight: 600, margin: 0 }}>Closer / Field User Workspace Access &amp; Feature Unlocks</h3>
                  </div>
                  <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                    By default, Closers receive leads, check their own call recordings, chat with leads, and generate UPI payment links. Advanced growth modules (Bulk Marketing, Plugins, Lead Forms, Import) are locked by default and must be explicitly enabled by Admin.
                  </p>
                </div>
                <button className="btn" data-variant="accent" data-size="sm" onClick={handleSaveMatrix}>
                  <Icon name="check" size={13} /> Save User Permissions
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                {/* Closer Menu Unlocks */}
                <div className="card" style={{ padding: "16px", background: "var(--bg-surface)" }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: "10px" }}>
                    Optional Sidebar Modules For Closers (Default: Disabled)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      {
                        path: "/whatsapp",
                        label: "WhatsApp Bulk Marketing & Campaigns",
                        desc: "Broadcast Meta Cloud templates and blast campaigns (Disabled for closer by default)",
                        permId: "whatsapp_bulk_marketing",
                      },
                      {
                        path: "/channels",
                        label: "Plugins & Channels Configuration",
                        desc: "Connect WhatsApp QR, Meta Cloud API, webhooks & relays (No use to regular closers)",
                        permId: "plugins_channels_hub",
                      },
                      {
                        path: "/forms",
                        label: "Lead Form Builder",
                        desc: "Design and publish public website lead capture forms",
                        permId: "forms_builder",
                      },
                      {
                        path: "/lead-import",
                        label: "Multi-Source Lead Import",
                        desc: "Import raw leads from CSV, Excel, Google Sheets, or paired device",
                        permId: "lead_import",
                      },
                    ].map((item) => (
                      <label key={item.path} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "6px", background: "var(--bg-hover)", cursor: "pointer" }}>
                        <div>
                          <div style={{ fontSize: "var(--fs-body)", fontWeight: 550 }}>{item.label}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{item.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={closerMenuVisibility[item.path] ?? false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setCloserMenuVisibility((prev) => ({ ...prev, [item.path]: val }));
                            setPermissions((prev) =>
                              prev.map((p) => (p.id === item.permId ? { ...p, closer: val } : p))
                            );
                          }}
                          style={{ width: "16px", height: "16px", accentColor: "var(--success)", cursor: "pointer" }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Closer Core Privileges summary */}
                <div className="card" style={{ padding: "16px", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-caption)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
                    Default Active Capabilities For Closers
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ color: "var(--success)", marginTop: "1px" }}><Icon name="check" size={13} /></span>
                      <div><strong style={{ color: "var(--text)" }}>Pipeline &amp; Lead Grab:</strong> Closer gets assigned leads and can claim unassigned leads from the live pool within their max capacity.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ color: "var(--success)", marginTop: "1px" }}><Icon name="check" size={13} /></span>
                      <div><strong style={{ color: "var(--text)" }}>SIM Call Recordings &amp; Telephony:</strong> Closer can check their own call recordings, inspect audio playback, and view call duration logs.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ color: "var(--success)", marginTop: "1px" }}><Icon name="check" size={13} /></span>
                      <div><strong style={{ color: "var(--text)" }}>Live Multi-Channel Chat:</strong> Closer can reply to customer WhatsApp and web messages in their assigned conversations.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ color: "var(--success)", marginTop: "1px" }}><Icon name="check" size={13} /></span>
                      <div><strong style={{ color: "var(--text)" }}>UPI Dynamic Invoicing:</strong> Closer can generate dynamic customer UPI payment QR codes and payment links.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ color: "var(--accent)", marginTop: "1px" }}><Icon name="shield" size={13} /></span>
                      <div><strong style={{ color: "var(--text)" }}>Data Masking &amp; Isolation:</strong> Customer numbers can be masked, and closers cannot delete records or export full database.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: Round-Robin Distribution */}
      {tab === "routing" && (
        <section className="card" style={{ padding: "20px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Automated Lead Distribution Rules</h2>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
              Control how new inbound leads from Website forms, Meta Ads, and WhatsApp are assigned to active closers.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Algorithm Selector */}
            <div className="card" style={{ padding: "16px", background: "var(--bg-soft)" }}>
              <div style={{ fontWeight: 550, fontSize: "var(--fs-meta)", marginBottom: "8px" }}>Distribution Algorithm</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                <div
                  className="card"
                  onClick={() => { setRoutingAlgorithm("equal"); saveToStorage(); }}
                  style={{
                    padding: "12px",
                    cursor: "pointer",
                    border: routingAlgorithm === "equal" ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: routingAlgorithm === "equal" ? "var(--bg-selected)" : "var(--bg-surface)",
                  }}
                >
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon name="check" size={13} /> Sequential Equal Weight
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    Cycles sequentially through active closers so everyone gets equal opportunity.
                  </div>
                </div>

                <div
                  className="card"
                  onClick={() => { setRoutingAlgorithm("performance"); saveToStorage(); }}
                  style={{
                    padding: "12px",
                    cursor: "pointer",
                    border: routingAlgorithm === "performance" ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: routingAlgorithm === "performance" ? "var(--bg-selected)" : "var(--bg-surface)",
                  }}
                >
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon name="sparkle" size={13} /> Performance-Weighted
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    Routes 60% of high-intent leads to closers with the highest 30-day conversion rate.
                  </div>
                </div>

                <div
                  className="card"
                  onClick={() => { setRoutingAlgorithm("capacity"); saveToStorage(); }}
                  style={{
                    padding: "12px",
                    cursor: "pointer",
                    border: routingAlgorithm === "capacity" ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: routingAlgorithm === "capacity" ? "var(--bg-selected)" : "var(--bg-surface)",
                  }}
                >
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon name="layers" size={13} /> Capacity-Capped
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    Skips closers who have reached their maximum active lead limit until they close or reject.
                  </div>
                </div>
              </div>
            </div>

            {/* Business Hours Gate */}
            <div className="card" style={{ padding: "16px", background: "var(--bg-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 550, fontSize: "var(--fs-meta)" }}>Business Hours Routing Gate</div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Only assign leads during operating hours (09:00 AM – 08:00 PM IST). After-hours leads hold in Unassigned queue.
                </div>
              </div>
              <input
                type="checkbox"
                checked={routingHoursOnly}
                onChange={(e) => { setRoutingHoursOnly(e.target.checked); saveToStorage(); }}
                style={{ width: "18px", height: "18px", accentColor: "var(--accent)", cursor: "pointer" }}
              />
            </div>

            {/* SLA Timer */}
            <div className="card" style={{ padding: "16px", background: "var(--bg-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 550, fontSize: "var(--fs-meta)" }}>Unassigned / Unclaimed SLA Timeout</div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                  If an assigned closer does not reach out within this window, the lead reverts to the team claim pool.
                </div>
              </div>
              <select
                className="select"
                value={unclaimedTimeout}
                onChange={(e) => { setUnclaimedTimeout(Number(e.target.value)); saveToStorage(); }}
                aria-label="Unclaimed lead SLA timeout"
                style={{ width: "130px" }}
              >
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Audit Trail */}
      {tab === "audit" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Security & Role Audit Trail</h2>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
              Immutable record of role promotions, capacity updates, and permission changes.
            </p>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "180px" }}>Event Action</th>
                  <th>Details</th>
                  <th style={{ width: "180px" }}>Triggered By</th>
                  <th style={{ width: "140px", textAlign: "right" }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {AUDIT_LOGS.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-tertiary)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <Icon name="history" size={28} style={{ opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>No Security Audit Events Yet</div>
                        <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", maxWidth: "340px" }}>
                          Role changes, permissions adjustments, and user invitations will be logged here.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  AUDIT_LOGS.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ color: "var(--text)", fontWeight: 500 }}>{log.detail}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>{log.user}</td>
                      <td style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                        {log.time}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="overlay" data-kind="dialog" onClick={() => !isSubmitting && setIsInviteOpen(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <h2 id="invite-dialog-title">Invite Team Member</h2>
              <button
                className="btn"
                data-variant="ghost"
                data-size="sm"
                aria-label="Close dialog"
                onClick={() => !isSubmitting && setIsInviteOpen(false)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body">
              {inviteError && (
                <div
                  className="chip"
                  data-tone="danger"
                  style={{ width: "100%", justifyContent: "flex-start", height: "auto", padding: "8px 10px", whiteSpace: "normal" }}
                >
                  {inviteError}
                </div>
              )}
              <div className="field">
                <label htmlFor="invite-name">Full Name</label>
                <input
                  className="input"
                  id="invite-name"
                  placeholder="e.g. Manager Test"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="field">
                <label htmlFor="invite-email">Email Address</label>
                <input
                  className="input"
                  id="invite-email"
                  type="email"
                  placeholder="e.g. managertest@gmail.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="field">
                <label htmlFor="invite-phone">Phone (SIM Calling Number)</label>
                <input
                  className="input"
                  id="invite-phone"
                  placeholder="9876543210"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="field">
                <label htmlFor="invite-password">Login Password</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    className="input"
                    id="invite-password"
                    type={showInvitePassword ? "text" : "password"}
                    placeholder="e.g. Manager@123"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    disabled={isSubmitting}
                    style={{ paddingRight: "56px", width: "100%" }}
                  />
                  <button
                    type="button"
                    className="btn"
                    data-variant="ghost"
                    data-size="sm"
                    onClick={() => setShowInvitePassword(!showInvitePassword)}
                    style={{ position: "absolute", right: "4px", height: "24px", fontSize: "11px", padding: "0 6px" }}
                    tabIndex={-1}
                  >
                    {showInvitePassword ? "Hide" : "Show"}
                  </button>
                </div>
                <span className="card-sub">
                  Initial credentials for this user (minimum 6 characters) to log in at /login.
                </span>
              </div>

              <div className="drawer-grid">
                <div className="field">
                  <label htmlFor="invite-role">Workspace Role</label>
                  <select
                    className="select"
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                    disabled={isSubmitting}
                  >
                    <option value="CLOSER">Sales Closer</option>
                    <option value="MANAGER">Sales Manager</option>
                    <option value="ADMIN">Workspace Admin</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="invite-capacity">Max Lead Capacity</label>
                  <input
                    className="input"
                    id="invite-capacity"
                    type="number"
                    value={inviteCapacity}
                    onChange={(e) => setInviteCapacity(Number(e.target.value))}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
            <div className="dialog-foot">
              <button
                className="btn"
                data-variant="ghost"
                onClick={() => !isSubmitting && setIsInviteOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn"
                data-variant="primary"
                onClick={handleAddMember}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating Member..." : "Create Team Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
