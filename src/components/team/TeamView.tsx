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
  // CRM & Leads
  { id: "leads:view", category: "Leads & Pipeline", label: "View Leads & Pipeline", desc: "Access workspace leads and Kanban stages", admin: true, manager: true, closer: true },
  { id: "contacts:view", category: "Leads & Pipeline", label: "View Contacts Directory", desc: "Access contacts list with deduplication", admin: true, manager: true, closer: true },
  { id: "leads:create", category: "Leads & Pipeline", label: "Create Manual Leads", desc: "Add new prospective leads into pipeline", admin: true, manager: true, closer: true },
  { id: "leads:claim", category: "Leads & Pipeline", label: "Claim Pool Leads", desc: "Grab unassigned leads within 10-minute rotation slot", admin: true, manager: true, closer: true },
  { id: "leads:reassign", category: "Leads & Pipeline", label: "Reassign & Transfer Leads", desc: "Transfer lead ownership and thread context", admin: true, manager: true, closer: false },
  { id: "leads:export", category: "Leads & Pipeline", label: "Export Leads (.xlsx)", desc: "Download client contact spreadsheets", admin: true, manager: true, closer: false },
  { id: "leads:delete", category: "Leads & Pipeline", label: "Soft-Delete to Recycle Bin", desc: "Move inactive leads into recycle bin", admin: true, manager: true, closer: false },
  { id: "leads:permanent_delete", category: "Leads & Pipeline", label: "Permanently Purge Leads", desc: "Permanently remove leads from database", admin: true, manager: false, closer: false },

  // Telephony & SIM Relays
  { id: "calls:view", category: "Telephony & SIM", label: "View Calls & Logs", desc: "Inspect telephony call duration and timestamps", admin: true, manager: true, closer: true },
  { id: "calls:playback", category: "Telephony & SIM", label: "Play Audio Recordings", desc: "Stream recorded phone calls and AI transcripts", admin: true, manager: true, closer: false },
  { id: "telephony:make_call", category: "Telephony & SIM", label: "Trigger SIM Phone Calls", desc: "Initiate outbound calls via Android companion relay", admin: true, manager: true, closer: true },

  // Omnichannel Chat & WhatsApp
  { id: "chat:view", category: "Omnichannel Chat", label: "View Conversations", desc: "Read live customer WhatsApp and Instagram threads", admin: true, manager: true, closer: true },
  { id: "chat:send", category: "Omnichannel Chat", label: "Send WhatsApp Messages", desc: "Reply to client messages and send attachments", admin: true, manager: true, closer: true },
  { id: "chat:share", category: "Omnichannel Chat", label: "Share Chat with Teammates", desc: "Grant internal chat visibility to teammates", admin: true, manager: true, closer: true },
  { id: "whatsapp:marketing", category: "Omnichannel Chat", label: "Broadcast Bulk Campaigns", desc: "Send approved WhatsApp marketing templates", admin: true, manager: true, closer: false },

  // Finance & Payments
  { id: "payments:create", category: "Payments & Revenue", label: "Generate UPI Payment Links", desc: "Create dynamic QR payment links for leads", admin: true, manager: true, closer: true },
  { id: "payments:settle", category: "Payments & Revenue", label: "Approve & Settle Payments", desc: "Verify payment proofs and close deals won", admin: true, manager: true, closer: false },
  { id: "payouts:view", category: "Payments & Revenue", label: "View Own Commissions", desc: "Inspect earned commissions and payout status", admin: true, manager: true, closer: true },
  { id: "payouts:approve", category: "Payments & Revenue", label: "Approve Team Payouts", desc: "Authorize sales commission payouts", admin: true, manager: true, closer: false },

  // Workspace Governance & Integrations
  { id: "team:view", category: "Workspace Governance", label: "View Team Directory", desc: "View teammates, online status and availability", admin: true, manager: true, closer: true },
  { id: "team:manage", category: "Workspace Governance", label: "Manage Team & Roles", desc: "Invite team members and adjust permissions", admin: true, manager: false, closer: false },
  { id: "integrations:manage", category: "Workspace Governance", label: "Manage Ingestion Gateways", desc: "Configure IndiaMART, JustDial and webhooks", admin: true, manager: false, closer: false },
  { id: "customer:unmask_phone", category: "Workspace Governance", label: "Unmask Customer Numbers", desc: "View raw unmasked customer phone numbers", admin: true, manager: true, closer: false },
];

export type TeamTab = "members" | "matrix" | "routing" | "audit" | "control" | "labels";

export interface WorkspaceControlSettings {
  chatSharingScope: "REPORTING_TEAM_ONLY" | "WORKSPACE_WIDE";
  leadAssignmentScope: "REPORTING_TEAM_ONLY" | "WORKSPACE_WIDE";
  closerLeadReassignmentEnabled: boolean;
  closerChatSharingEnabled: boolean;
  managerLeadDeletionEnabled: boolean;
  phoneMaskingPolicy: "MASK_ALL" | "LAST_4" | "UNMASKED";
  companionScannerRouting: "DEDICATED" | "ROUND_ROBIN";
  leadExportProtection: boolean;
}

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceControlSettings = {
  chatSharingScope: "WORKSPACE_WIDE",
  leadAssignmentScope: "WORKSPACE_WIDE",
  closerLeadReassignmentEnabled: false,
  closerChatSharingEnabled: true,
  managerLeadDeletionEnabled: false,
  phoneMaskingPolicy: "LAST_4",
  companionScannerRouting: "DEDICATED",
  leadExportProtection: true,
};

export interface WorkspaceLabelItem {
  id?: string;
  name: string;
  color?: string;
  count?: number;
  createdAt?: string;
}

const LABEL_COLOR_OPTIONS = [
  "#F97316",
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#6B7280",
];

export function TeamView() {
  const { state, setScope } = useApp();
  const router = useRouter();

  const [tab, setTab] = useState<TeamTab>("members");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionRow[]>(DEFAULT_PERMISSIONS);
  const [routingAlgorithm, setRoutingAlgorithm] = useState<"equal" | "performance" | "capacity">("equal");
  const [routingHoursOnly, setRoutingHoursOnly] = useState(true);
  const [unclaimedTimeout, setUnclaimedTimeout] = useState(15);
  const [allowQrLeadsRoundRobin, setAllowQrLeadsRoundRobin] = useState<boolean>(false);
  const [maxVisibleToCloser, setMaxVisibleToCloser] = useState<number>(5);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState<number>(30);
  const [allowManagerLeadDeletion, setAllowManagerLeadDeletion] = useState<boolean>(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [tableViewMode, setTableViewMode] = useState<"standard" | "extended">("standard");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Live Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // Workspace Control Governance State
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceControlSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Labels & Taxonomy State
  const [labelsList, setLabelsList] = useState<WorkspaceLabelItem[]>([]);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [isAddLabelOpen, setIsAddLabelOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#F97316");
  const [addLabelError, setAddLabelError] = useState<string | null>(null);
  const [isSubmittingLabel, setIsSubmittingLabel] = useState(false);

  const [editingLabel, setEditingLabel] = useState<WorkspaceLabelItem | null>(null);
  const [editLabelName, setEditLabelName] = useState("");
  const [editLabelColor, setEditLabelColor] = useState("#F97316");
  const [editLabelError, setEditLabelError] = useState<string | null>(null);
  const [isSavingEditLabel, setIsSavingEditLabel] = useState(false);

  const [deletingLabel, setDeletingLabel] = useState<WorkspaceLabelItem | null>(null);
  const [isDeletingLabel, setIsDeletingLabel] = useState(false);

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

  // Load from LocalStorage and backend API for routing rules
  useEffect(() => {
    aicloserApi.roundRobin.get().then((data: any) => {
      if (data?.settings) {
        if (data.settings.mode === "LOAD_BALANCED") setRoutingAlgorithm("capacity");
        else setRoutingAlgorithm("equal");
        if (typeof data.settings.workingHoursOnly === "boolean") setRoutingHoursOnly(data.settings.workingHoursOnly);
        if (typeof data.settings.allowQrLeadsRoundRobin === "boolean") setAllowQrLeadsRoundRobin(data.settings.allowQrLeadsRoundRobin);
        if (typeof data.settings.allowManagerLeadDeletion === "boolean") setAllowManagerLeadDeletion(data.settings.allowManagerLeadDeletion);
        if (data.settings.maxVisibleToCloser) setMaxVisibleToCloser(Number(data.settings.maxVisibleToCloser));
        if (data.settings.breakDurationMinutes) setBreakDurationMinutes(Number(data.settings.breakDurationMinutes));
      }
    }).catch(() => null);

    try {
      const stored = localStorage.getItem("closer.team.v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.routingAlgorithm) setRoutingAlgorithm(parsed.routingAlgorithm);
        if (parsed.routingHoursOnly !== undefined) setRoutingHoursOnly(parsed.routingHoursOnly);
        if (parsed.unclaimedTimeout) setUnclaimedTimeout(parsed.unclaimedTimeout);
        if (parsed.allowQrLeadsRoundRobin !== undefined) setAllowQrLeadsRoundRobin(parsed.allowQrLeadsRoundRobin);
        if (parsed.allowManagerLeadDeletion !== undefined) setAllowManagerLeadDeletion(parsed.allowManagerLeadDeletion);
        if (parsed.maxVisibleToCloser) setMaxVisibleToCloser(Number(parsed.maxVisibleToCloser));
        if (parsed.breakDurationMinutes) setBreakDurationMinutes(Number(parsed.breakDurationMinutes));
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
      const storedSettings = localStorage.getItem("closer.workspace.settings.v1");
      if (storedSettings) {
        try {
          setWorkspaceSettings((prev) => ({ ...prev, ...JSON.parse(storedSettings) }));
        } catch {}
      }
    } catch {
      // Ignore
    }

    aicloserApi.workspace
      .getSettings()
      .then((res: any) => {
        if (res?.settings) {
          setWorkspaceSettings((prev) => ({ ...prev, ...res.settings }));
        } else if (res && typeof res === "object") {
          setWorkspaceSettings((prev) => ({ ...prev, ...res }));
        }
      })
      .catch(() => undefined);
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
        // Real workspace owner fallback if team API roster is empty
        if (state.user) {
          setMembers([{
            id: state.user.userId || "owner",
            name: state.user.displayName || "Workspace Owner",
            email: state.user.email || "",
            phone: state.user.phone || "",
            role: (state.user.role as TeamRole) || "ADMIN",
            status: "active",
            simConnected: true,
            maxCapacity: 100,
            assignedLeads: 0,
            pipelineValue: 0,
            dealsWon: 0,
            inRoundRobin: false,
            onLeave: false,
            numberMasking: false,
            reportingManager: "Founder & Owner",
            joinedAt: "Active",
          }]);
        } else {
          setMembers([]);
        }
      }
    } catch (err) {
      console.warn("Failed to load team from API:", err);
      if (state.user) {
        setMembers([{
          id: state.user.userId || "owner",
          name: state.user.displayName || "Workspace Owner",
          email: state.user.email || "",
          phone: state.user.phone || "",
          role: (state.user.role as TeamRole) || "ADMIN",
          status: "active",
          simConnected: true,
          maxCapacity: 100,
          assignedLeads: 0,
          pipelineValue: 0,
          dealsWon: 0,
          inRoundRobin: false,
          onLeave: false,
          numberMasking: false,
          reportingManager: "Founder & Owner",
          joinedAt: "Active",
        }]);
      } else {
        setMembers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [state.leads, state.user]);

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
      const errorMsg = "Failed to save permissions matrix to API: " + (err?.message || "Server error");
      setSavedBanner(errorMsg);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("aicloser:toast", {
            detail: { type: "error", message: errorMsg },
          }),
        );
      }
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

  const handleSaveWorkspaceSettings = async () => {
    setIsSavingSettings(true);
    try {
      await aicloserApi.workspace.updateSettings(workspaceSettings);
      localStorage.setItem("closer.workspace.settings.v1", JSON.stringify(workspaceSettings));
      window.dispatchEvent(new Event("aicloser:workspace_settings_updated"));
      setSavedBanner("Workspace governance controls saved successfully!");
    } catch (err: any) {
      localStorage.setItem("closer.workspace.settings.v1", JSON.stringify(workspaceSettings));
      window.dispatchEvent(new Event("aicloser:workspace_settings_updated"));
      setSavedBanner("Workspace governance controls saved locally.");
    } finally {
      setIsSavingSettings(false);
      setTimeout(() => setSavedBanner(null), 3500);
    }
  };

  const loadWorkspaceLabels = useCallback(async () => {
    setIsLoadingLabels(true);
    try {
      const res: any = await aicloserApi.labels.list();
      const raw: any[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      if (raw.length > 0) {
        setLabelsList(
          raw.map((l: any) => ({
            id: l.id || `lbl-${l.name}`,
            name: l.name,
            color: l.color || "#F97316",
            count: l.count,
            createdAt: l.createdAt,
          }))
        );
      } else {
        const tagMap = new Map<string, number>();
        state.leads.forEach((lead) => {
          if (Array.isArray(lead.tags)) {
            lead.tags.forEach((tag) => {
              tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
          }
        });
        const inferred: WorkspaceLabelItem[] = Array.from(tagMap.entries()).map(([name, count]) => ({
          id: `lbl-${name}`,
          name,
          color: "#F97316",
          count,
        }));
        setLabelsList(inferred);
      }
    } catch (err) {
      console.warn("Failed to load labels:", err);
    } finally {
      setIsLoadingLabels(false);
    }
  }, [state.leads]);

  useEffect(() => {
    loadWorkspaceLabels();
  }, [loadWorkspaceLabels]);

  const handleAddLabel = async () => {
    const name = newLabelName.trim();
    if (!name) {
      setAddLabelError("Label name is required.");
      return;
    }
    if (labelsList.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      setAddLabelError("A label with this name already exists.");
      return;
    }
    setIsSubmittingLabel(true);
    setAddLabelError(null);
    try {
      await aicloserApi.labels.create({ name, color: newLabelColor });
      setSavedBanner(`Tag "${name}" created.`);
      setTimeout(() => setSavedBanner(null), 3000);
      setIsAddLabelOpen(false);
      setNewLabelName("");
      await loadWorkspaceLabels();
    } catch (err: any) {
      setAddLabelError(err?.message || "Failed to create tag.");
    } finally {
      setIsSubmittingLabel(false);
    }
  };

  const handleStartEditLabel = (label: WorkspaceLabelItem) => {
    setEditingLabel(label);
    setEditLabelName(label.name);
    setEditLabelColor(label.color || "#F97316");
    setEditLabelError(null);
  };

  const handleSaveEditLabel = async () => {
    if (!editingLabel) return;
    const name = editLabelName.trim();
    if (!name) {
      setEditLabelError("Label name cannot be empty.");
      return;
    }
    setIsSavingEditLabel(true);
    setEditLabelError(null);
    try {
      await aicloserApi.labels.update(editingLabel.name, {
        newName: name !== editingLabel.name ? name : undefined,
        color: editLabelColor,
      });
      setSavedBanner(`Tag "${name}" updated.`);
      setTimeout(() => setSavedBanner(null), 3000);
      setEditingLabel(null);
      await loadWorkspaceLabels();
    } catch (err: any) {
      setEditLabelError(err?.message || "Failed to update tag.");
    } finally {
      setIsSavingEditLabel(false);
    }
  };

  const handleDeleteLabel = async () => {
    if (!deletingLabel) return;
    setIsDeletingLabel(true);
    try {
      await aicloserApi.labels.delete(deletingLabel.name);
      setSavedBanner(`Tag "${deletingLabel.name}" deleted.`);
      setTimeout(() => setSavedBanner(null), 3000);
      setDeletingLabel(null);
      await loadWorkspaceLabels();
    } catch (err: any) {
      setSavedBanner("Failed to delete tag: " + (err?.message || String(err)));
      setTimeout(() => setSavedBanner(null), 3500);
    } finally {
      setIsDeletingLabel(false);
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

  const closerMembers = useMemo(() => members.filter((m) => m.role !== "ADMIN"), [members]);
  const adminMembers = useMemo(() => members.filter((m) => m.role === "ADMIN"), [members]);
  const closerSeatsUsed = closerMembers.length;
  const closerSeatsTotal = 10;
  const availableCloserSeats = Math.max(0, closerSeatsTotal - closerSeatsUsed);
  const activeClosersCount = closerMembers.filter((m) => m.role === "CLOSER" && m.status === "active" && !m.onLeave).length;

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
            Workspace Closer Seats
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {closerSeatsUsed} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>/ {closerSeatsTotal} seats</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="dot" style={{ background: "var(--success)" }} /> {availableCloserSeats} seats available
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
            Admin owner separate (unmetered seat)
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
        <button
          role="tab"
          aria-selected={tab === "control"}
          data-on={tab === "control"}
          onClick={() => setTab("control")}
        >
          Workspace Governance
        </button>
        <button
          role="tab"
          aria-selected={tab === "labels"}
          data-on={tab === "labels"}
          onClick={() => setTab("labels")}
        >
          Tags & Taxonomy
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
                              {member.role === "ADMIN" ? (
                                <span className="chip" data-tone="accent" style={{ fontSize: "10px", padding: "1px 6px" }}>ADMIN · OWNER (UNMETERED)</span>
                              ) : (
                                <span className="chip" data-tone="neutral" style={{ fontSize: "10px", padding: "1px 6px" }}>CLOSER SEAT</span>
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
              <label>Grab Lead Capacity per Closer (Visible in Kanban Pool)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={50}
                value={maxVisibleToCloser}
                onChange={(e) => setMaxVisibleToCloser(Number(e.target.value))}
              />
              <span className="card-sub">
                Maximum number of grab-pool leads concurrently displayed on each closer's Kanban board. Rotates every 10 minutes.
              </span>
            </div>

            <div className="field">
              <label>Closer Break Duration (Minutes)</label>
              <input
                className="input"
                type="number"
                min={5}
                max={180}
                value={breakDurationMinutes}
                onChange={(e) => setBreakDurationMinutes(Number(e.target.value))}
              />
              <span className="card-sub">
                Authorized break duration. Pauses missed lead counts. If a closer exceeds this duration without resuming, missed leads resume counting.
              </span>
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

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "12px", padding: "12px 14px", background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
              <input
                type="checkbox"
                id="qr-round-robin-team"
                checked={allowQrLeadsRoundRobin}
                onChange={(e) => setAllowQrLeadsRoundRobin(e.target.checked)}
                style={{ accentColor: "var(--accent)", width: "16px", height: "16px", marginTop: "2px" }}
              />
              <div>
                <label htmlFor="qr-round-robin-team" style={{ fontSize: "var(--fs-meta)", fontWeight: 600, cursor: "pointer", display: "block" }}>
                  Include Team Member Scanned WhatsApp Leads in Round-Robin
                </label>
                <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px", display: "block" }}>
                  {allowQrLeadsRoundRobin
                    ? "Enabled — Inbound leads arriving on a team member's personal scanned WhatsApp line will also be distributed across all sales reps."
                    : "Disabled (Recommended) — Leads from a team member's personal scanned WhatsApp stay strictly assigned to that specific team member only."}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "12px", padding: "12px 14px", background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
              <input
                type="checkbox"
                id="manager-lead-deletion"
                checked={allowManagerLeadDeletion}
                onChange={(e) => setAllowManagerLeadDeletion(e.target.checked)}
                style={{ accentColor: "var(--accent)", width: "16px", height: "16px", marginTop: "2px" }}
              />
              <div>
                <label htmlFor="manager-lead-deletion" style={{ fontSize: "var(--fs-meta)", fontWeight: 600, cursor: "pointer", display: "block" }}>
                  Allow Sales Managers to delete leads within their reporting team
                </label>
                <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px", display: "block" }}>
                  {allowManagerLeadDeletion
                    ? "Enabled — Sales Managers can soft-delete or recycle leads assigned to team members under their direct supervision."
                    : "Disabled (Recommended) — Lead deletion is restricted strictly to workspace Super Admins and Owners."}
                </span>
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <button
                className="btn"
                data-variant="primary"
                onClick={async () => {
                  try {
                    await aicloserApi.roundRobin.update({
                      mode: routingAlgorithm === "capacity" ? "LOAD_BALANCED" : "STRICT_ROUND_ROBIN",
                      workingHoursOnly: routingHoursOnly,
                      allowQrLeadsRoundRobin,
                      allowManagerLeadDeletion,
                      maxVisibleToCloser,
                      breakDurationMinutes,
                    });
                    localStorage.setItem(
                      "closer.team.v1",
                      JSON.stringify({
                        routingAlgorithm,
                        routingHoursOnly,
                        unclaimedTimeout,
                        allowQrLeadsRoundRobin,
                        allowManagerLeadDeletion,
                        maxVisibleToCloser,
                        breakDurationMinutes,
                      })
                    );
                    setSavedBanner("Routing engine parameters saved to backend!");
                  } catch (err: any) {
                    setSavedBanner("Failed to save routing parameters: " + (err.message || String(err)));
                  }
                  setTimeout(() => setSavedBanner(null), 3000);
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

      {/* Tab 5: Workspace Control & Governance */}
      {tab === "control" && (
        <section className="settings">
          <div className="card settings-card">
            <div className="settings-head">
              <div>
                <h2 className="settings-title">Workspace Governance & Closer Safeguards</h2>
                <p className="settings-sub">
                  Enforce operational boundaries, conversation sharing scopes, lead reassignment limits, and customer data masking policies across your sales force.
                </p>
              </div>
              <span className="chip" data-tone="accent">
                Enterprise Policy
              </span>
            </div>

            <div className="settings-body">
              {/* 1. Chat Sharing Scope */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Chat Sharing Scope</div>
                  <div className="setting-desc">
                    {workspaceSettings.chatSharingScope === "REPORTING_TEAM_ONLY"
                      ? "Reporting Team Only — Closers can only share chat threads with colleagues under their direct Sales Manager."
                      : "Workspace-Wide — Closers can share conversation access with any active team member across the workspace."}
                  </div>
                </div>
                <div className="seg">
                  <button
                    type="button"
                    data-on={workspaceSettings.chatSharingScope === "REPORTING_TEAM_ONLY"}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        chatSharingScope: "REPORTING_TEAM_ONLY",
                      }))
                    }
                  >
                    Reporting Team Only
                  </button>
                  <button
                    type="button"
                    data-on={workspaceSettings.chatSharingScope === "WORKSPACE_WIDE"}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        chatSharingScope: "WORKSPACE_WIDE",
                      }))
                    }
                  >
                    Workspace-Wide
                  </button>
                </div>
              </div>

              {/* 2. Lead Assignment Scope */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Lead Assignment Scope</div>
                  <div className="setting-desc">
                    {workspaceSettings.leadAssignmentScope === "REPORTING_TEAM_ONLY"
                      ? "Reporting Team Only — Leads may only be reassigned to closers reporting to the same manager."
                      : "Workspace-Wide — Leads can be reassigned to any active sales agent across the organization."}
                  </div>
                </div>
                <div className="seg">
                  <button
                    type="button"
                    data-on={workspaceSettings.leadAssignmentScope === "REPORTING_TEAM_ONLY"}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        leadAssignmentScope: "REPORTING_TEAM_ONLY",
                      }))
                    }
                  >
                    Reporting Team Only
                  </button>
                  <button
                    type="button"
                    data-on={workspaceSettings.leadAssignmentScope === "WORKSPACE_WIDE"}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        leadAssignmentScope: "WORKSPACE_WIDE",
                      }))
                    }
                  >
                    Workspace-Wide
                  </button>
                </div>
              </div>

              {/* 3. Closer Lead Reassignment Permission */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Closer Lead Reassignment</div>
                  <div className="setting-desc">
                    {workspaceSettings.closerLeadReassignmentEnabled
                      ? "Permitted — Sales Closers have permission to transfer their leads to other team members."
                      : "Blocked — Only Workspace Admins and Sales Managers can reassign leads between closers."}
                  </div>
                </div>
                <div className="seg">
                  <button
                    type="button"
                    data-on={workspaceSettings.closerLeadReassignmentEnabled}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        closerLeadReassignmentEnabled: true,
                      }))
                    }
                  >
                    Permitted
                  </button>
                  <button
                    type="button"
                    data-on={!workspaceSettings.closerLeadReassignmentEnabled}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        closerLeadReassignmentEnabled: false,
                      }))
                    }
                  >
                    Blocked
                  </button>
                </div>
              </div>

              {/* 4. Closer Chat Sharing Permission */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Closer Chat Sharing</div>
                  <div className="setting-desc">
                    {workspaceSettings.closerChatSharingEnabled
                      ? "Permitted — Sales Closers can share customer conversation access with team members."
                      : "Restricted — Chat sharing is restricted strictly to Admins and Managers."}
                  </div>
                </div>
                <div className="seg">
                  <button
                    type="button"
                    data-on={workspaceSettings.closerChatSharingEnabled}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        closerChatSharingEnabled: true,
                      }))
                    }
                  >
                    Permitted
                  </button>
                  <button
                    type="button"
                    data-on={!workspaceSettings.closerChatSharingEnabled}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        closerChatSharingEnabled: false,
                      }))
                    }
                  >
                    Restricted
                  </button>
                </div>
              </div>

              {/* 5. Manager Lead Deletion Governance */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Manager Lead Deletion Governance</div>
                  <div className="setting-desc">
                    {workspaceSettings.managerLeadDeletionEnabled
                      ? "Authorized — Sales Managers can delete leads assigned to closers in their reporting team."
                      : "Admins Only — Lead deletion is blocked for Sales Managers and restricted to Super Admins."}
                  </div>
                </div>
                <div className="seg">
                  <button
                    type="button"
                    data-on={workspaceSettings.managerLeadDeletionEnabled}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        managerLeadDeletionEnabled: true,
                      }))
                    }
                  >
                    Authorized
                  </button>
                  <button
                    type="button"
                    data-on={!workspaceSettings.managerLeadDeletionEnabled}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        managerLeadDeletionEnabled: false,
                      }))
                    }
                  >
                    Admins Only
                  </button>
                </div>
              </div>

              {/* 6. Phone Number Masking Policy */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Phone Number Masking Policy</div>
                  <div className="setting-desc">
                    {workspaceSettings.phoneMaskingPolicy === "LAST_4"
                      ? "Show Last 4 Digits (••••••1234) — Verification visible while preventing off-platform poaching."
                      : workspaceSettings.phoneMaskingPolicy === "MASK_ALL"
                      ? "Mask All Digits (••••••••••) — Complete privacy, outbound calls strictly through SIM relays."
                      : "Unmasked (Full Visibility) — Full 10-digit phone numbers displayed to sales team."}
                  </div>
                </div>
                <div style={{ width: "230px" }}>
                  <select
                    className="select"
                    value={workspaceSettings.phoneMaskingPolicy}
                    onChange={(e) =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        phoneMaskingPolicy: e.target.value as any,
                      }))
                    }
                  >
                    <option value="LAST_4">Show Last 4 Digits</option>
                    <option value="MASK_ALL">Mask All Digits</option>
                    <option value="UNMASKED">Unmasked (Full Visibility)</option>
                  </select>
                </div>
              </div>

              {/* 7. Companion WhatsApp Scanner Lead Routing */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Companion WhatsApp Scanner Routing</div>
                  <div className="setting-desc">
                    {workspaceSettings.companionScannerRouting === "DEDICATED"
                      ? "Strictly Dedicated to Scanner Closer — Inbound chats on a personal linked line remain with that closer."
                      : "Distribute to Round-Robin Pool — Inbound chats on linked lines are auto-distributed across all closers."}
                  </div>
                </div>
                <div style={{ width: "260px" }}>
                  <select
                    className="select"
                    value={workspaceSettings.companionScannerRouting}
                    onChange={(e) =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        companionScannerRouting: e.target.value as any,
                      }))
                    }
                  >
                    <option value="DEDICATED">Dedicated to Scanner Closer</option>
                    <option value="ROUND_ROBIN">Distribute to Round-Robin Pool</option>
                  </select>
                </div>
              </div>

              {/* 8. Lead Export Protection */}
              <div className="setting-row">
                <div>
                  <div className="setting-name">Lead Export Protection</div>
                  <div className="setting-desc">
                    {workspaceSettings.leadExportProtection
                      ? "Protected (Admins Only) — Restricts CSV/Excel contact export downloads strictly to Workspace Admins."
                      : "Standard — Allows Sales Managers to export contact records."}
                  </div>
                </div>
                <div className="seg">
                  <button
                    type="button"
                    data-on={workspaceSettings.leadExportProtection}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        leadExportProtection: true,
                      }))
                    }
                  >
                    Admins Only
                  </button>
                  <button
                    type="button"
                    data-on={!workspaceSettings.leadExportProtection}
                    onClick={() =>
                      setWorkspaceSettings((prev) => ({
                        ...prev,
                        leadExportProtection: false,
                      }))
                    }
                  >
                    Managers Allowed
                  </button>
                </div>
              </div>
            </div>

            <div className="card-foot" style={{ display: "flex", justifyContent: "flex-end", padding: "14px 16px" }}>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                onClick={handleSaveWorkspaceSettings}
                disabled={isSavingSettings}
              >
                <Icon name="check" size={13} />
                {isSavingSettings ? "Saving Settings..." : "Save Workspace Governance"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Tab 6: Tags & Taxonomy */}
      {tab === "labels" && (
        <section className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Workspace Tags & Taxonomy</h2>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Manage workspace-wide label tags used across pipeline deals, contact directories, and chat threads.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                data-size="sm"
                onClick={loadWorkspaceLabels}
                disabled={isLoadingLabels}
              >
                <Icon name="refresh" size={13} /> {isLoadingLabels ? "Refreshing..." : "Refresh"}
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                data-size="sm"
                onClick={() => {
                  setNewLabelName("");
                  setNewLabelColor("#F97316");
                  setAddLabelError(null);
                  setIsAddLabelOpen(true);
                }}
              >
                <Icon name="plus" size={13} /> New Workspace Tag
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "200px" }}>Tag Name</th>
                  <th style={{ width: "140px" }}>Color Swatch</th>
                  <th style={{ width: "160px" }}>Active Leads Using Tag</th>
                  <th style={{ width: "160px" }}>Scope</th>
                  <th style={{ width: "130px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingLabels ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "32px 16px" }}>
                      <p style={{ color: "var(--text-secondary)" }}>Loading workspace tags...</p>
                    </td>
                  </tr>
                ) : labelsList.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty">
                        <div className="empty-icon">
                          <Icon name="tag" size={20} />
                        </div>
                        <h3>No Workspace Tags Defined</h3>
                        <p>
                          Create tags to categorize leads, deals, and communication stages across your sales pipeline.
                        </p>
                        <button
                          type="button"
                          className="btn"
                          data-variant="primary"
                          onClick={() => {
                            setNewLabelName("");
                            setNewLabelColor("#F97316");
                            setAddLabelError(null);
                            setIsAddLabelOpen(true);
                          }}
                        >
                          <Icon name="plus" size={13} /> Create First Tag
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  labelsList.map((lbl, idx) => {
                    const tagUsage =
                      lbl.count !== undefined
                        ? lbl.count
                        : state.leads.filter((l) => Array.isArray(l.tags) && l.tags.includes(lbl.name)).length;

                    return (
                      <tr key={lbl.id || `lbl-${idx}`}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              className="dot"
                              style={{
                                width: "9px",
                                height: "9px",
                                borderRadius: "50%",
                                background: lbl.color || "var(--accent)",
                              }}
                            />
                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{lbl.name}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "3px",
                                background: lbl.color || "#F97316",
                                border: "1px solid var(--border-strong)",
                                display: "inline-block",
                              }}
                            />
                            <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                              {lbl.color || "#F97316"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="chip" data-tone={tagUsage > 0 ? "accent" : "ghost"}>
                            {tagUsage} {tagUsage === 1 ? "lead" : "leads"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                            Workspace Global
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                            <button
                              type="button"
                              className="btn"
                              data-variant="ghost"
                              data-size="sm"
                              onClick={() => handleStartEditLabel(lbl)}
                              title="Edit tag"
                            >
                              <Icon name="pencil" size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn"
                              data-variant="danger"
                              data-size="sm"
                              onClick={() => setDeletingLabel(lbl)}
                              title="Delete tag"
                            >
                              <Icon name="trash" size={12} />
                            </button>
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

      {/* Create Label Modal */}
      {isAddLabelOpen && (
        <div
          className="overlay dialog-backdrop"
          data-kind="dialog"
          onClick={() => !isSubmittingLabel && setIsAddLabelOpen(false)}
          role="presentation"
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-label-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px", width: "100%" }}
          >
            <div className="dialog-head card-head">
              <h2 id="add-label-dialog-title" className="card-title">New Workspace Tag</h2>
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                data-size="sm"
                aria-label="Close dialog"
                onClick={() => !isSubmittingLabel && setIsAddLabelOpen(false)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body card-body">
              {addLabelError && (
                <div
                  className="chip"
                  data-tone="danger"
                  style={{ width: "100%", justifyContent: "flex-start", height: "auto", padding: "8px 10px", whiteSpace: "normal" }}
                >
                  {addLabelError}
                </div>
              )}
              <div className="field">
                <label htmlFor="new-label-name">Tag Name *</label>
                <input
                  className="input"
                  id="new-label-name"
                  placeholder="e.g. VIP Enterprise, Callback Req, High Budget"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  disabled={isSubmittingLabel}
                  autoFocus
                />
              </div>

              <div className="field" style={{ marginTop: "12px" }}>
                <label>Select Swatch Color</label>
                <div className="swatches" style={{ marginLeft: 0, marginTop: "6px" }}>
                  {LABEL_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="swatch"
                      aria-pressed={newLabelColor === c}
                      style={{ background: c }}
                      onClick={() => setNewLabelColor(c)}
                    >
                      {newLabelColor === c && <Icon name="check" size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="dialog-foot card-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => !isSubmittingLabel && setIsAddLabelOpen(false)}
                disabled={isSubmittingLabel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                onClick={handleAddLabel}
                disabled={isSubmittingLabel || !newLabelName.trim()}
              >
                {isSubmittingLabel ? "Creating..." : "Create Tag"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Label Modal */}
      {editingLabel && (
        <div
          className="overlay dialog-backdrop"
          data-kind="dialog"
          onClick={() => !isSavingEditLabel && setEditingLabel(null)}
          role="presentation"
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-label-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px", width: "100%" }}
          >
            <div className="dialog-head card-head">
              <h2 id="edit-label-dialog-title" className="card-title">Edit Tag: {editingLabel.name}</h2>
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                data-size="sm"
                aria-label="Close dialog"
                onClick={() => !isSavingEditLabel && setEditingLabel(null)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body card-body">
              {editLabelError && (
                <div
                  className="chip"
                  data-tone="danger"
                  style={{ width: "100%", justifyContent: "flex-start", height: "auto", padding: "8px 10px", whiteSpace: "normal" }}
                >
                  {editLabelError}
                </div>
              )}
              <div className="field">
                <label htmlFor="edit-label-name">Tag Name *</label>
                <input
                  className="input"
                  id="edit-label-name"
                  value={editLabelName}
                  onChange={(e) => setEditLabelName(e.target.value)}
                  disabled={isSavingEditLabel}
                />
              </div>

              <div className="field" style={{ marginTop: "12px" }}>
                <label>Select Swatch Color</label>
                <div className="swatches" style={{ marginLeft: 0, marginTop: "6px" }}>
                  {LABEL_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="swatch"
                      aria-pressed={editLabelColor === c}
                      style={{ background: c }}
                      onClick={() => setEditLabelColor(c)}
                    >
                      {editLabelColor === c && <Icon name="check" size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="dialog-foot card-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => !isSavingEditLabel && setEditingLabel(null)}
                disabled={isSavingEditLabel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                onClick={handleSaveEditLabel}
                disabled={isSavingEditLabel || !editLabelName.trim()}
              >
                {isSavingEditLabel ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Label Confirmation Dialog */}
      {deletingLabel && (
        <div
          className="overlay dialog-backdrop"
          data-kind="dialog"
          onClick={() => !isDeletingLabel && setDeletingLabel(null)}
          role="presentation"
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-label-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px", width: "100%" }}
          >
            <div className="dialog-head card-head">
              <h2 id="delete-label-dialog-title" className="card-title">Delete Workspace Tag</h2>
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                data-size="sm"
                aria-label="Close dialog"
                onClick={() => !isDeletingLabel && setDeletingLabel(null)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="dialog-body card-body">
              <p style={{ fontSize: "var(--fs-meta)", lineHeight: 1.5, color: "var(--text)" }}>
                Are you sure you want to permanently delete the workspace tag <strong>&quot;{deletingLabel.name}&quot;</strong>?
              </p>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "8px" }}>
                This tag will no longer be available in autocomplete suggestions. Existing lead tags will remain unchanged.
              </p>
            </div>
            <div className="dialog-foot card-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => !isDeletingLabel && setDeletingLabel(null)}
                disabled={isDeletingLabel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="danger"
                onClick={handleDeleteLabel}
                disabled={isDeletingLabel}
              >
                {isDeletingLabel ? "Deleting..." : "Delete Tag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
