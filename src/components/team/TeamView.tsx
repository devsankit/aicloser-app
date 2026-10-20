"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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

const DEFAULT_PERMISSIONS: PermissionRow[] = [
  { id: "leads_view", category: "Leads & Contacts", label: "View Leads & Contacts", desc: "Access the CRM contacts hub and lead directory", admin: true, manager: true, closer: true },
  { id: "leads_claim", category: "Leads & Contacts", label: "Claim from Lead Grab Pool", desc: "Pick unassigned leads from the live pool", admin: true, manager: true, closer: true },
  { id: "leads_export", category: "Leads & Contacts", label: "Export Leads to Excel/CSV", desc: "Download full contact database", admin: true, manager: true, closer: false },
  { id: "telephony_calling", category: "Telephony & SIM", label: "Make SIM-Based Outbound Calls", desc: "Use closer desk SIM relays to call leads", admin: true, manager: true, closer: true },
  { id: "call_recordings_listen", category: "Telephony & SIM", label: "Listen to Call Recordings", desc: "Access full call audio vault and AI transcripts", admin: true, manager: true, closer: false },
  { id: "whatsapp_chat", category: "Omnichannel Chat", label: "Two-Way WhatsApp & Instagram Chat", desc: "Send direct replies to client messages", admin: true, manager: true, closer: true },
  { id: "whatsapp_bulk_marketing", category: "Omnichannel Chat", label: "Broadcast Bulk Marketing Campaigns", desc: "Send marketing templates to lead lists", admin: true, manager: true, closer: false },
  { id: "payment_links_create", category: "Payments & Revenue", label: "Generate UPI QR Payment Links", desc: "Create dynamic payment requests", admin: true, manager: true, closer: true },
  { id: "payment_settlement", category: "Payments & Revenue", label: "Settle & Confirm Payments", desc: "Mark payments as settled or manual approval", admin: true, manager: true, closer: false },
  { id: "team_management", category: "Workspace Governance", label: "Invite & Manage Team Members", desc: "Assign seats, edit roles and passwords", admin: true, manager: false, closer: false },
];

export function TeamView() {
  const { state, setScope } = useApp();
  const router = useRouter();

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

  // Live Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

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

  // Edit Member Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<TeamRole>("CLOSER");
  const [editCapacity, setEditCapacity] = useState(25);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

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

  // Closer / Field Agent Optional Feature Unlocks State
  const [closerMenuVisibility, setCloserMenuVisibility] = useState<Record<string, boolean>>({
    "/whatsapp": false,
    "/channels": false,
    "/forms": false,
    "/lead-import": false,
  });

  // Load from LocalStorage for UI preferences only (routing & custom navigation pills)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("closer.team.v1");
      if (stored) {
        const parsed = JSON.parse(stored);
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

  // Live API Fetch for Team Members
  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await aicloserApi.team.listMembers();
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.members)
        ? res.members
        : Array.isArray(res?.data?.members)
        ? res.data.members
        : Array.isArray(res?.agents)
        ? res.agents
        : Array.isArray(res?.data?.agents)
        ? res.data.agents
        : [];

      if (rawList.length > 0) {
        const mapped: TeamMember[] = rawList.map((m: any) => {
          const rawRole = String(m.role || m.workspaceRole || "").toUpperCase();
          const role: TeamRole = rawRole.includes("ADMIN")
            ? "ADMIN"
            : rawRole.includes("MANAGER")
            ? "MANAGER"
            : "CLOSER";
          const rawStatus = String(m.status || "").toLowerCase();
          const status: "active" | "away" | "offline" | "on_leave" =
            m.onLeave || rawStatus === "on_leave"
              ? "on_leave"
              : rawStatus === "active"
              ? "active"
              : rawStatus === "away"
              ? "away"
              : "offline";

          return {
            id: String(m.id || m.userId || `tm-${Math.random().toString(36).slice(2, 6)}`),
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
            onLeave: Boolean(m.onLeave || rawStatus === "on_leave"),
            numberMasking: Boolean(m.numberMasking),
            reportingManager:
              m.reportingManager ||
              m.manager?.displayName ||
              (role === "MANAGER" ? "Founder & Owner" : "Direct Admin"),
            joinedAt: m.createdAt
              ? new Date(m.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
              : "Active",
          };
        });
        setMembers(mapped);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.warn("Failed to load team from API:", err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Live Audit Logs Fetch
  const loadAuditLogs = useCallback(async () => {
    setIsAuditLoading(true);
    try {
      const data: any = await aicloserApi.team.auditLogs();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.logs)
        ? data.logs
        : Array.isArray(data?.auditLogs)
        ? data.auditLogs
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setAuditLogs(list);
    } catch (err) {
      console.warn("Failed to fetch audit logs from API:", err);
      setAuditLogs([]);
    } finally {
      setIsAuditLoading(false);
    }
  }, []);

  // Fetch Permissions Matrix Catalog
  useEffect(() => {
    let active = true;
    aicloserApi.team
      .permissionsMatrix()
      .then((data: any) => {
        if (!active || !data) return;
        if (Array.isArray(data.catalog) && data.catalog.length > 0) {
          const roleDefs = data.roleDefaults || {};
          const rows: PermissionRow[] = data.catalog.map((cat: any) => ({
            id: cat.key,
            category: cat.category || "General",
            label: cat.label,
            desc: cat.description || "",
            admin: true,
            manager: Boolean(roleDefs.MANAGER?.[cat.key] ?? true),
            closer: Boolean(roleDefs.SALES_AGENT?.[cat.key] ?? roleDefs.CLOSER?.[cat.key] ?? true),
          }));
          setPermissions(rows);
        }
      })
      .catch(() => {});

    loadTeam();
    return () => {
      active = false;
    };
  }, [loadTeam]);

  // Load audit logs when audit tab activated
  useEffect(() => {
    if (tab === "audit") {
      loadAuditLogs();
    }
  }, [tab, loadAuditLogs]);

  // ---------------- Handlers wired to Live API ----------------

  const handleToggleLeave = async (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const nextLeave = !target.onLeave;
    const nextStatus = nextLeave ? "on_leave" : "active";

    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, onLeave: nextLeave, status: nextStatus as any } : m
      )
    );

    try {
      await aicloserApi.team.updateStatus(memberId, nextLeave ? "ON_LEAVE" : "ACTIVE");
      setSavedBanner("Closer leave status & round-robin availability updated");
    } catch (err: any) {
      console.warn("Failed to toggle leave status:", err);
    }
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleToggleMasking = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, numberMasking: !m.numberMasking } : m))
    );
    const target = members.find((m) => m.id === memberId);
    setSavedBanner(
      `Phone number masking ${target?.numberMasking ? "disabled" : "enabled (+91 98765 •••••)"} for ${target?.name}`
    );
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleChangeReportingManager = async (memberId: string, managerIdOrName: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const managerObj = members.find((m) => m.id === managerIdOrName);
    const managerProfileId = managerObj ? managerObj.id : null;
    const managerDisplayName = managerObj ? managerObj.name : "Direct Admin";

    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, reportingManager: managerDisplayName } : m
      )
    );

    try {
      await aicloserApi.team.assignManager(memberId, managerProfileId);
      setSavedBanner(`Reporting manager updated for ${target.name}.`);
    } catch (err: any) {
      console.warn("Failed to assign manager:", err);
    }
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleViewDashboardAs = (memberName: string) => {
    setScope(`agent:${memberName}`);
    setSavedBanner(`Viewing entire workspace as ${memberName}`);
    setTimeout(() => setSavedBanner(null), 3000);
    router.push("/dashboard");
  };

  const handleToggleRoundRobin = async (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const nextVal = !target.inRoundRobin;

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, inRoundRobin: nextVal } : m))
    );

    try {
      await aicloserApi.team.update(memberId, { canClaimLeads: nextVal });
      setSavedBanner(`Round-robin queue ${nextVal ? "enabled" : "disabled"} for ${target.name}`);
    } catch (err: any) {
      console.warn("Failed to update round-robin:", err);
    }
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleUpdateCapacity = async (memberId: string, maxCapacity: number) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, maxCapacity } : m))
    );

    try {
      await aicloserApi.team.update(memberId, { maxActiveLeads: maxCapacity, maxCapacity });
      setSavedBanner(`Active lead quota updated to ${maxCapacity} leads for ${target.name}`);
    } catch (err: any) {
      console.warn("Failed to update capacity:", err);
    }
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleChangeRole = async (memberId: string, newRole: TeamRole) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );

    try {
      await aicloserApi.team.update(memberId, { role: newRole });
      setSavedBanner(`Role updated to ${newRole} for ${target.name}`);
    } catch (err: any) {
      console.warn("Failed to update role:", err);
    }
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleChangeStatus = async (
    memberId: string,
    status: "active" | "away" | "offline" | "on_leave"
  ) => {
    const onLeave = status === "on_leave";
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, status, onLeave } : m))
    );

    try {
      const apiStatus = onLeave ? "ON_LEAVE" : status === "active" ? "ACTIVE" : status === "away" ? "ACTIVE" : "INACTIVE";
      await aicloserApi.team.updateStatus(memberId, apiStatus as any);
      setSavedBanner("Member availability status updated");
    } catch (err: any) {
      console.warn("Failed to update status:", err);
    }
    setTimeout(() => setSavedBanner(null), 2500);
  };

  const handleDeleteMember = async (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    if (target.role === "ADMIN") {
      setSavedBanner("Workspace owner/admin account cannot be removed.");
      setTimeout(() => setSavedBanner(null), 3000);
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete team member "${target.name}"?`)) return;

    try {
      await aicloserApi.team.deleteMember(memberId);
      setSavedBanner(`Deleted "${target.name}" permanently from workspace.`);
      setTimeout(() => setSavedBanner(null), 3500);
      await loadTeam();
    } catch (err: any) {
      const msg = err?.message || "Failed to delete team member from workspace.";
      setSavedBanner(`Error: ${msg}`);
      setTimeout(() => setSavedBanner(null), 4000);
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

  const handleSaveMatrix = async () => {
    const managerPermissions: Record<string, boolean> = {};
    const closerPermissions: Record<string, boolean> = {};

    permissions.forEach((p) => {
      managerPermissions[p.id] = p.manager;
      closerPermissions[p.id] = p.closer;
    });

    const matrixPayload = {
      roles: {
        MANAGER: managerPermissions,
        SALES_AGENT: closerPermissions,
      },
    };

    try {
      await aicloserApi.team.savePermissionsMatrix(matrixPayload as any);
      setSavedBanner("Role capabilities & matrix permissions saved to live API!");
    } catch (err: any) {
      console.warn("Failed to save permissions matrix to API:", err);
      setSavedBanner("Permissions matrix saved locally");
    }

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

    setTimeout(() => setSavedBanner(null), 3000);
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
      reportingManager: inviteRole === "MANAGER" ? "Founder & Owner" : "Direct Admin",
    };

    try {
      await aicloserApi.team.invite(payload);
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
      setSavedBanner(`Team member "${name}" (${roleLabel}) invited successfully!`);
      setTimeout(() => setSavedBanner(null), 3500);
      await loadTeam();
    } catch (err: any) {
      setInviteError(err?.message || "Failed to create team member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Member Modal Handlers
  const handleOpenEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditPhone(member.phone);
    setEditRole(member.role);
    setEditCapacity(member.maxCapacity);
    setEditPassword("");
    setShowEditPassword(false);
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleSaveEditMember = async () => {
    if (!editingMember) return;
    const name = editName.trim();
    const email = editEmail.trim().toLowerCase();
    const rawPhone = editPhone.replace(/\D/g, "").slice(-10);

    if (!name) return setEditError("Full name is required.");
    if (!email || !email.includes("@")) return setEditError("Valid email is required.");
    if (!/^[6-9]\d{9}$/.test(rawPhone) && editPhone.trim()) {
      return setEditError("Phone number must be a valid 10-digit mobile number.");
    }
    if (editPassword && editPassword.trim().length < 6) {
      return setEditError("New password must be at least 6 characters.");
    }

    setIsEditSubmitting(true);
    setEditError(null);

    const cleanPhone = editPhone.trim().startsWith("+")
      ? editPhone.trim()
      : rawPhone
      ? `+91 ${rawPhone}`
      : "";

    const payload: Record<string, unknown> = {
      displayName: name,
      email,
      phone: cleanPhone,
      role: editRole === "CLOSER" ? "SALES_AGENT" : editRole,
      maxActiveLeads: Number(editCapacity) || 15,
    };

    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    try {
      await aicloserApi.team.update(editingMember.id, payload);
      setSavedBanner(`Updated profile for "${name}" successfully.`);
      setTimeout(() => setSavedBanner(null), 3000);
      setIsEditOpen(false);
      setEditingMember(null);
      await loadTeam();
    } catch (err: any) {
      setEditError(err?.message || "Failed to update member profile.");
    } finally {
      setIsEditSubmitting(false);
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
            <span className="dot" style={{ background: "var(--success)" }} /> {Math.max(0, 10 - members.length)} seats available
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
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {members.filter((m) => m.inRoundRobin).length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>in rotation</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Equal lead intake algorithm
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            On Leave
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {members.filter((m) => m.onLeave).length} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>paused</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Auto-suspended from routing
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="seg" style={{ marginBottom: "16px" }}>
        <button
          role="tab"
          aria-selected={tab === "members"}
          data-on={tab === "members"}
          onClick={() => setTab("members")}
        >
          Team Members ({members.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === "matrix"}
          data-on={tab === "matrix"}
          onClick={() => setTab("matrix")}
        >
          Role Permissions Matrix
        </button>
        <button
          role="tab"
          aria-selected={tab === "routing"}
          data-on={tab === "routing"}
          onClick={() => setTab("routing")}
        >
          Routing & Capacity Rules
        </button>
        <button
          role="tab"
          aria-selected={tab === "audit"}
          data-on={tab === "audit"}
          onClick={() => setTab("audit")}
        >
          Security Audit Trail
        </button>
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
                title="Standard Clean View"
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
                  <th style={{ width: "80px", textAlign: "center" }}>Actions</th>
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
                        <h3>No team members found</h3>
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
                              title="Active lead capacity quota"
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
                                title="Mark closer as on leave"
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
                              data-tone={member.numberMasking ? "accent" : "default"}
                              onClick={() => handleToggleMasking(member.id)}
                              title={member.numberMasking ? "Phone numbers masked (+91 98765 •••••)" : "Phone numbers visible in raw format"}
                              style={{ cursor: "pointer", fontSize: "11px", fontWeight: 550, border: "none" }}
                            >
                              <Icon name={member.numberMasking ? "shield" : "eye"} size={11} />
                              {member.numberMasking ? "Masked" : "Visible"}
                            </button>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <select
                              className="select"
                              value={
                                members.find((mgr) => mgr.name === member.reportingManager)?.id ||
                                member.reportingManager ||
                                "Direct Admin"
                              }
                              onChange={(e) => handleChangeReportingManager(member.id, e.target.value)}
                              aria-label={`Reporting manager for ${member.name}`}
                            >
                              <option value="Direct Admin">Direct Admin (No Manager)</option>
                              {members
                                .filter((m) => (m.role === "ADMIN" || m.role === "MANAGER") && m.id !== member.id)
                                .map((mgr) => (
                                  <option key={mgr.id} value={mgr.id}>
                                    {mgr.name} ({mgr.role})
                                  </option>
                                ))}
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
                      <td style={{ textAlign: "center", width: "80px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          <button
                            type="button"
                            className="btn"
                            data-variant="ghost"
                            data-size="sm"
                            onClick={() => handleOpenEditModal(member)}
                            title={`Edit ${member.name}`}
                            aria-label={`Edit ${member.name}`}
                          >
                            <Icon name="pencil" size={13} />
                          </button>
                          {member.role !== "ADMIN" && (
                            <button
                              type="button"
                              className="btn"
                              data-variant="ghost"
                              data-size="sm"
                              onClick={() => handleDeleteMember(member.id)}
                              title={`Permanently delete ${member.name}`}
                              aria-label={`Delete ${member.name}`}
                              style={{ color: "var(--danger)" }}
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          )}
                        </div>
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
                    <span className="chip" data-tone="accent">MANAGER</span>
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
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              background: "var(--bg-soft)",
                              padding: "8px 16px",
                              fontSize: "var(--fs-caption)",
                              fontWeight: 650,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: "var(--text-tertiary)",
                              borderTop: idx > 0 ? "1px solid var(--border)" : "none",
                            }}
                          >
                            {p.category}
                          </td>
                        </tr>
                      ) : null}
                      <tr>
                        <td>
                          <div style={{ fontWeight: 550, color: "var(--text)" }}>{p.label}</div>
                          {p.desc ? (
                            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "1px" }}>
                              {p.desc}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={p.admin}
                            disabled
                            aria-label={`${p.label} for Admin`}
                            style={{ cursor: "not-allowed", accentColor: "var(--accent)" }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={p.manager}
                            onChange={() => handleTogglePermission(p.id, "manager")}
                            aria-label={`${p.label} for Manager`}
                            style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={p.closer}
                            onChange={() => handleTogglePermission(p.id, "closer")}
                            aria-label={`${p.label} for Closer`}
                            style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                          />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 3: Routing & Capacity Rules */}
      {tab === "routing" && (
        <section className="card" style={{ padding: "20px 24px" }}>
          <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600, marginBottom: "4px" }}>
            Automated Lead Routing Engine
          </h2>
          <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "20px" }}>
            Configure how new incoming WhatsApp chats, lead forms, and Google Sheets imports are distributed among closers.
          </p>

          <div style={{ display: "grid", gap: "16px", maxWidth: "680px" }}>
            <div className="field">
              <label>Distribution Algorithm</label>
              <select
                className="select"
                value={routingAlgorithm}
                onChange={(e) => setRoutingAlgorithm(e.target.value as any)}
              >
                <option value="equal">Round-Robin (Strict Equal Distribution)</option>
                <option value="capacity">Capacity-Based (Routes to closers with lowest active load)</option>
                <option value="performance">Performance-Weighted (Favours closers with highest conversion rate)</option>
              </select>
            </div>

            <div className="field">
              <label>Unclaimed Lead Timeout (Minutes before escalating to Grab Pool)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={120}
                value={unclaimedTimeout}
                onChange={(e) => setUnclaimedTimeout(Number(e.target.value))}
              />
              <span className="card-sub">
                If the assigned closer does not initiate a WhatsApp chat or SIM call within this window, the lead returns to Open Pool.
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
              <input
                type="checkbox"
                id="routing-hours"
                checked={routingHoursOnly}
                onChange={(e) => setRoutingHoursOnly(e.target.checked)}
                style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
              />
              <label htmlFor="routing-hours" style={{ fontSize: "var(--fs-meta)", cursor: "pointer" }}>
                Route leads during business hours only (9:00 AM – 8:00 PM IST)
              </label>
            </div>

            <div style={{ marginTop: "16px" }}>
              <button
                className="btn"
                data-variant="primary"
                onClick={() => {
                  try {
                    localStorage.setItem(
                      "closer.team.v1",
                      JSON.stringify({
                        routingAlgorithm,
                        routingHoursOnly,
                        unclaimedTimeout,
                      })
                    );
                  } catch {}
                  setSavedBanner("Routing engine parameters saved!");
                  setTimeout(() => setSavedBanner(null), 2500);
                }}
              >
                <Icon name="check" size={13} /> Save Routing Rules
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Security Audit Trail */}
      {tab === "audit" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Security & Role Audit Trail</h2>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Immutable record of role promotions, capacity updates, and permission changes.
              </p>
            </div>
            <button
              className="btn"
              data-variant="ghost"
              data-size="sm"
              onClick={loadAuditLogs}
              disabled={isAuditLoading}
            >
              <Icon name="refresh" size={13} /> {isAuditLoading ? "Refreshing..." : "Refresh Logs"}
            </button>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "180px" }}>Event Action</th>
                  <th>Details</th>
                  <th style={{ width: "180px" }}>Triggered By</th>
                  <th style={{ width: "160px", textAlign: "right" }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {isAuditLoading ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "32px 16px" }}>
                      <p style={{ color: "var(--text-secondary)" }}>Loading audit events from live API...</p>
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty">
                        <div className="empty-icon">
                          <Icon name="clock" size={20} />
                        </div>
                        <h3>No Security Audit Events Yet</h3>
                        <p>
                          Role changes, permissions adjustments, and user invitations will be logged here.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: any, idx: number) => {
                    const actionLabel = log.action || log.type || log.event || "SECURITY_EVENT";
                    const detailText =
                      log.detail ||
                      log.details ||
                      log.description ||
                      log.message ||
                      (log.metadata ? JSON.stringify(log.metadata) : "Configuration change");
                    const actorName =
                      log.user?.displayName ||
                      log.user?.name ||
                      log.actor ||
                      log.user ||
                      log.triggeredBy ||
                      "System Admin";
                    const timeStr = log.createdAt || log.time || log.timestamp
                      ? new Date(log.createdAt || log.time || log.timestamp).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "Recent";

                    return (
                      <tr key={log.id || `audit-${idx}`}>
                        <td>
                          <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                            {actionLabel}
                          </span>
                        </td>
                        <td style={{ color: "var(--text)", fontWeight: 500 }}>{detailText}</td>
                        <td style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>{actorName}</td>
                        <td style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>
                          {timeStr}
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

      {/* Edit Member Modal */}
      {isEditOpen && editingMember && (
        <div
          className="overlay dialog-backdrop"
          data-kind="dialog"
          onClick={() => !isEditSubmitting && setIsEditOpen(false)}
          role="presentation"
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-head card-head">
              <h2 id="edit-dialog-title" className="card-title">Edit Team Member</h2>
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                data-size="sm"
                aria-label="Close dialog"
                onClick={() => !isEditSubmitting && setIsEditOpen(false)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body card-body">
              {editError && (
                <div
                  className="chip"
                  data-tone="danger"
                  style={{ width: "100%", justifyContent: "flex-start", height: "auto", padding: "8px 10px", whiteSpace: "normal" }}
                >
                  {editError}
                </div>
              )}

              <div className="field">
                <label htmlFor="edit-name">Full Name *</label>
                <input
                  id="edit-name"
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  disabled={isEditSubmitting}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="edit-email">Email Address *</label>
                <input
                  id="edit-email"
                  type="email"
                  className="input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. rahul@company.com"
                  disabled={isEditSubmitting}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="edit-phone">Mobile Phone (WhatsApp & SIM Telephony) *</label>
                <input
                  id="edit-phone"
                  className="input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  disabled={isEditSubmitting}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="edit-role">Workspace Role</label>
                <select
                  id="edit-role"
                  className="select"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as TeamRole)}
                  disabled={isEditSubmitting}
                >
                  <option value="CLOSER">Sales Closer (Field Telecaller)</option>
                  <option value="MANAGER">Sales Manager (Lead Routing & Approvals)</option>
                  <option value="ADMIN">Workspace Admin (Full System Control)</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="edit-capacity">Active Lead Capacity (Max Active Leads)</label>
                <input
                  id="edit-capacity"
                  type="number"
                  min={1}
                  max={200}
                  className="input"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(Number(e.target.value))}
                  disabled={isEditSubmitting}
                />
              </div>

              <div className="field">
                <label htmlFor="edit-password">Reset Password (Optional, minimum 6 characters)</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    className="input"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep existing password"
                    minLength={6}
                    disabled={isEditSubmitting}
                    style={{ paddingRight: "56px", width: "100%" }}
                  />
                  <button
                    type="button"
                    className="btn"
                    data-variant="ghost"
                    data-size="sm"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{ position: "absolute", right: "4px", height: "24px", fontSize: "11px", padding: "0 6px" }}
                    tabIndex={-1}
                  >
                    {showEditPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <span className="card-sub">
                  Set a new password for this user to log in at /login.
                </span>
              </div>
            </div>
            <div className="dialog-foot card-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => setIsEditOpen(false)}
                disabled={isEditSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                onClick={handleSaveEditMember}
                disabled={isEditSubmitting}
              >
                {isEditSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div
          className="overlay dialog-backdrop"
          data-kind="dialog"
          onClick={() => !isSubmitting && setIsInviteOpen(false)}
          role="presentation"
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-head card-head">
              <h2 id="invite-dialog-title" className="card-title">Invite Team Member</h2>
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                data-size="sm"
                aria-label="Close dialog"
                onClick={() => !isSubmitting && setIsInviteOpen(false)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body card-body">
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
                  placeholder="e.g. Rahul Sharma"
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
                  placeholder="e.g. rahul@company.com"
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
                    placeholder="e.g. Closer@123"
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
            <div className="dialog-foot card-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => !isSubmitting && setIsInviteOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
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
