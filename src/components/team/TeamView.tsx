"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { CURRENT_USER } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";

export type TeamRole = "ADMIN" | "MANAGER" | "CLOSER";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  status: "active" | "away" | "offline";
  simConnected: boolean;
  maxCapacity: number;
  assignedLeads: number;
  pipelineValue: number;
  dealsWon: number;
  inRoundRobin: boolean;
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

const DEFAULT_PERMISSIONS: PermissionRow[] = [
  {
    id: "lead_view_all",
    category: "Leads & Pipeline",
    label: "View all workspace leads",
    desc: "Can view unassigned and colleague leads vs only strictly assigned records.",
    admin: true,
    manager: true,
    closer: false,
  },
  {
    id: "lead_move_stages",
    category: "Leads & Pipeline",
    label: "Move deal stages",
    desc: "Permission to progress leads across Kanban columns.",
    admin: true,
    manager: true,
    closer: true,
  },
  {
    id: "lead_reassign",
    category: "Leads & Pipeline",
    label: "Bulk reassign ownership",
    desc: "Reassign individual or batch leads between closers.",
    admin: true,
    manager: true,
    closer: false,
  },
  {
    id: "lead_delete",
    category: "Leads & Pipeline",
    label: "Delete leads & contacts",
    desc: "Permanently delete lead records and linked contact data.",
    admin: true,
    manager: false,
    closer: false,
  },
  {
    id: "telephony_recordings",
    category: "Calls & Telephony",
    label: "Listen to call recordings",
    desc: "Access audio playbacks and AI transcripts of team sales calls.",
    admin: true,
    manager: true,
    closer: false,
  },
  {
    id: "chat_shared_threads",
    category: "Calls & Telephony",
    label: "Reply in shared chat threads",
    desc: "Participate and message leads in conversations shared by other closers.",
    admin: true,
    manager: true,
    closer: true,
  },
  {
    id: "payments_create",
    category: "Revenue & Payments",
    label: "Generate UPI payment links",
    desc: "Generate dynamic payment requests with customer QR codes.",
    admin: true,
    manager: true,
    closer: true,
  },
  {
    id: "payments_approve",
    category: "Revenue & Payments",
    label: "Approve payment screenshot proofs",
    desc: "Mark client payment proofs as verified and trigger Closed Won state.",
    admin: true,
    manager: true,
    closer: false,
  },
  {
    id: "export_contacts",
    category: "Administration",
    label: "Export database to CSV / JSON",
    desc: "Download complete client contact directory and revenue history.",
    admin: true,
    manager: false,
    closer: false,
  },
  {
    id: "round_robin_manage",
    category: "Administration",
    label: "Configure Round-Robin rules",
    desc: "Adjust closer allocation caps, working hours, and algorithm.",
    admin: true,
    manager: true,
    closer: false,
  },
];

const AUDIT_LOGS: Array<{ id: string; action: string; detail: string; user: string; time: string }> = [];

export function TeamView() {
  const [tab, setTab] = useState<"members" | "matrix" | "routing" | "audit">("members");
  const [members, setMembers] = useState<TeamMember[]>(DEFAULT_MEMBERS);
  const [permissions, setPermissions] = useState<PermissionRow[]>(DEFAULT_PERMISSIONS);
  const [routingAlgorithm, setRoutingAlgorithm] = useState<"equal" | "performance" | "capacity">("equal");
  const [routingHoursOnly, setRoutingHoursOnly] = useState(true);
  const [unclaimedTimeout, setUnclaimedTimeout] = useState(15);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("CLOSER");
  const [inviteCapacity, setInviteCapacity] = useState(15);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Load from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("closer.team.v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.members && Array.isArray(parsed.members)) {
          const clean = parsed.members.filter((m: any) => !m.id?.startsWith("tm-"));
          setMembers(clean);
        }
        if (parsed.permissions) setPermissions(parsed.permissions);
        if (parsed.routingAlgorithm) setRoutingAlgorithm(parsed.routingAlgorithm);
        if (parsed.routingHoursOnly !== undefined) setRoutingHoursOnly(parsed.routingHoursOnly);
        if (parsed.unclaimedTimeout) setUnclaimedTimeout(parsed.unclaimedTimeout);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Live API Fetch for Team Closers
  useEffect(() => {
    let active = true;
    aicloserApi.team
      .listMembers()
      .then((res: any) => {
        if (!active || !res?.length) return;
        const mapped: TeamMember[] = res.map((m: any) => ({
          id: m.id,
          name: m.user?.displayName || m.displayName || "Closer Agent",
          email: m.user?.email || m.email || "",
          phone: m.user?.phone || m.phone || "",
          role: m.role === "ADMIN" ? "ADMIN" : m.role === "MANAGER" ? "MANAGER" : "CLOSER",
          status: m.isActive ? "active" : "offline",
          simConnected: true,
          maxCapacity: m.maxCapacity || 15,
          assignedLeads: m._count?.assignedLeads || 0,
          pipelineValue: m.pipelineValue || 0,
          dealsWon: m.dealsWon || 0,
          inRoundRobin: m.inRoundRobin ?? true,
          joinedAt: m.createdAt
            ? new Date(m.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
            : "Jan 2026",
        }));
        setMembers(mapped);
      })
      .catch(async () => {
        try {
          const me: any = await aicloserApi.team.me();
          if (active && me?.id) {
            setMembers([
              {
                id: me.id,
                name: me.displayName || "Closer Agent",
                email: me.email || "",
                phone: me.phone || "",
                role: me.role === "ADMIN" ? "ADMIN" : me.role === "MANAGER" ? "MANAGER" : "CLOSER",
                status: me.status === "ACTIVE" ? "active" : "offline",
                simConnected: true,
                maxCapacity: me.maxActiveLeads || 25,
                assignedLeads: me.assignedLeadsCount || 0,
                pipelineValue: 0,
                dealsWon: 0,
                inRoundRobin: true,
                joinedAt: me.createdAt
                  ? new Date(me.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                  : "Jan 2026",
              },
            ]);
          }
        } catch {
          // Ignore
        }
      });
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
      // Ignore
    }
  };

  const handleToggleRoundRobin = (memberId: string) => {
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, inRoundRobin: !m.inRoundRobin } : m
    );
    setMembers(updated);
    saveToStorage(updated, permissions);
  };

  const handleChangeRole = (memberId: string, newRole: TeamRole) => {
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, role: newRole } : m
    );
    setMembers(updated);
    saveToStorage(updated, permissions);
  };

  const handleChangeStatus = (memberId: string, status: "active" | "away" | "offline") => {
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, status } : m
    );
    setMembers(updated);
    saveToStorage(updated, permissions);
  };

  const handleDeleteMember = (memberId: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    const updated = members.filter((m) => m.id !== memberId);
    setMembers(updated);
    saveToStorage(updated, permissions);
  };

  const handleTogglePermission = (id: string, role: "manager" | "closer") => {
    const updated = permissions.map((p) =>
      p.id === id ? { ...p, [role]: !p[role] } : p
    );
    setPermissions(updated);
  };

  const handleSaveMatrix = () => {
    saveToStorage(members, permissions);
  };

  const handleAddMember = () => {
    if (!inviteName.trim()) return setInviteError("Full name is required.");
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) return setInviteError("Valid email is required.");
    if (!/^[6-9]\d{9}$/.test(invitePhone.replace(/\D/g, "").slice(-10))) {
      return setInviteError("Valid 10-digit phone number is required.");
    }

    const newMember: TeamMember = {
      id: `tm-${Date.now()}`,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      phone: `+91 ${invitePhone.replace(/\D/g, "").slice(-10)}`,
      role: inviteRole,
      status: "active",
      simConnected: false,
      maxCapacity: Number(inviteCapacity) || 12,
      assignedLeads: 0,
      pipelineValue: 0,
      dealsWon: 0,
      inRoundRobin: inviteRole === "CLOSER",
      joinedAt: "Just now",
    };

    const updated = [...members, newMember];
    setMembers(updated);
    saveToStorage(updated, permissions);

    // Live API invite dispatch
    aicloserApi.team
      .invite({ email: newMember.email, role: newMember.role })
      .catch(() => {});

    setIsInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInvitePhone("");
    setInviteError(null);
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
            ₹{(totalPipelineSum / 100000).toFixed(1)}L
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
            <div style={{ marginLeft: "auto", fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
              Showing {filteredMembers.length} member{filteredMembers.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "260px" }}>Member</th>
                  <th>Role</th>
                  <th>Telephony SIM</th>
                  <th>Active Leads</th>
                  <th>Pipeline Value</th>
                  <th>Status</th>
                  <th>Round-Robin</th>
                  <th style={{ width: "70px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-tertiary)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <Icon name="users" size={28} style={{ opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>No Team Members Found</div>
                        <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", maxWidth: "340px" }}>
                          Invite closers, managers, and admins to collaborate in your sales workspace.
                        </div>
                        <button className="btn" data-variant="primary" data-size="sm" style={{ marginTop: "8px" }} onClick={() => setIsInviteOpen(true)}>
                          <Icon name="plus" size={13} /> Invite Member
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background:
                              member.role === "ADMIN" || member.role === "MANAGER"
                                ? "var(--accent-strong)"
                                : "var(--solid-muted)",
                            color: "#fff",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "12px",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <div style={{ fontWeight: 550, color: "var(--text)" }}>{member.name}</div>
                          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                            {member.email} • {member.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="select"
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value as TeamRole)}
                        aria-label={`Role for ${member.name}`}
                        style={{
                          height: "26px",
                          fontSize: "var(--fs-caption)",
                          padding: "0 6px",
                          fontWeight: 550,
                          borderColor: "transparent",
                          background: "var(--bg-hover)",
                        }}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="CLOSER">Closer</option>
                      </select>
                    </td>
                    <td>
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
                    <td>
                      <span style={{ fontWeight: 550 }}>{member.assignedLeads}</span>
                      <span style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}> / {member.maxCapacity}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 550 }}>
                        {member.pipelineValue > 0 ? `₹${(member.pipelineValue / 1000).toFixed(0)}k` : "—"}
                      </span>
                      {member.dealsWon > 0 && (
                        <span style={{ color: "var(--success)", fontSize: "11px", marginLeft: "6px" }}>
                          ({member.dealsWon} won)
                        </span>
                      )}
                    </td>
                    <td>
                      <select
                        className="select"
                        value={member.status}
                        onChange={(e) => handleChangeStatus(member.id, e.target.value as "active" | "away" | "offline")}
                        aria-label={`Availability for ${member.name}`}
                        style={{
                          height: "26px",
                          fontSize: "var(--fs-caption)",
                          padding: "0 6px",
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
                    </td>
                    <td>
                      <button
                        className="btn"
                        data-size="sm"
                        data-variant={member.inRoundRobin ? "accent" : "ghost"}
                        onClick={() => handleToggleRoundRobin(member.id)}
                        style={{ height: "24px", fontSize: "11px" }}
                      >
                        {member.inRoundRobin ? "In Queue" : "Excluded"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {member.name !== CURRENT_USER && (
                        <button
                          className="btn"
                          data-variant="ghost"
                          onClick={() => handleDeleteMember(member.id)}
                          title="Remove user"
                          style={{ padding: "4px" }}
                        >
                          <Icon name="trash" size={13} />
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
                {permissions.map((p) => (
                  <tr key={p.id}>
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
                ))}
              </tbody>
            </table>
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
        <div className="overlay" data-kind="dialog" onClick={() => setIsInviteOpen(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" onClick={(e) => e.stopPropagation()} style={{ width: "440px" }}>
            <div className="dialog-head">
              <h2 id="invite-dialog-title" style={{ fontSize: "var(--fs-title)", fontWeight: 600 }}>Invite Team Member</h2>
              <button className="btn" data-variant="ghost" aria-label="Close dialog" onClick={() => setIsInviteOpen(false)} style={{ padding: "4px" }}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px 20px" }}>
              {inviteError && (
                <div style={{ color: "var(--danger)", fontSize: "var(--fs-caption)", background: "var(--danger-soft)", padding: "6px 10px", borderRadius: "var(--r-sm)" }}>
                  {inviteError}
                </div>
              )}
              <div className="field">
                <label htmlFor="invite-name" style={{ fontSize: "var(--fs-caption)", fontWeight: 550, color: "var(--text-secondary)" }}>Full Name</label>
                <input
                  className="input"
                  id="invite-name"
                  placeholder="e.g. Varun Chawla"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="invite-email" style={{ fontSize: "var(--fs-caption)", fontWeight: 550, color: "var(--text-secondary)" }}>Email Address</label>
                <input
                  className="input"
                  id="invite-email"
                  type="email"
                  placeholder="varun@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="invite-phone" style={{ fontSize: "var(--fs-caption)", fontWeight: 550, color: "var(--text-secondary)" }}>Phone (SIM Calling Number)</label>
                <input
                  className="input"
                  id="invite-phone"
                  placeholder="9876543210"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="field">
                  <label htmlFor="invite-role" style={{ fontSize: "var(--fs-caption)", fontWeight: 550, color: "var(--text-secondary)" }}>Workspace Role</label>
                  <select
                    className="select"
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                  >
                    <option value="CLOSER">Sales Closer</option>
                    <option value="MANAGER">Sales Manager</option>
                    <option value="ADMIN">Workspace Admin</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="invite-capacity" style={{ fontSize: "var(--fs-caption)", fontWeight: 550, color: "var(--text-secondary)" }}>Max Lead Capacity</label>
                  <input
                    className="input"
                    id="invite-capacity"
                    type="number"
                    value={inviteCapacity}
                    onChange={(e) => setInviteCapacity(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
            <div className="dialog-foot" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px" }}>
              <button className="btn" data-variant="ghost" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </button>
              <button className="btn" data-variant="primary" onClick={handleAddMember}>
                Send Workspace Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
