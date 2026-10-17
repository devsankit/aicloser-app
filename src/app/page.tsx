import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SalesDashboard } from "@/components/sales/sales-dashboard";
import type { SalesDashboardSnapshot, SalesAgentView, SalesLeadView } from "@/lib/gigxomi/sales-store";
import { centralApiRequest } from "@/lib/central-api-server";
import type { CallLog, LeadPoolItem } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Sales Dashboard",
  robots: { index: false, follow: false },
};

type CentralUser = {
  userId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "SALES_AGENT";
  tenantId: string;
};

type CentralMe = { success: boolean; data: { user: CentralUser; tenant?: { id: string; name: string } } };
type CentralLead = {
  id: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  stage?: string;
  priority?: string;
  notes?: string;
  followUpAt?: string | null;
  assignedAgent?: { id: string; displayName?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};
type CentralTeamMember = {
  id: string;
  userId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role: CentralUser["role"];
  agentCode?: string | null;
  status?: SalesAgentView["status"];
  commissionPercent?: number | null;
  canClaimLeads?: boolean;
  maxActiveLeads?: number | null;
  permissions?: Record<string, unknown> | null;
  createdAt?: string;
};

type CentralCallsPayload = {
  calls?: Array<CallLog & {
    direction?: string;
    endedAt?: string | null;
    recordingError?: string | null;
    noteSubmitted?: boolean;
    agent?: { id?: string; agentCode?: string; user?: { displayName?: string } } | null;
    assignment?: { id?: string; customerName?: string; customerPhone?: string; stage?: string } | null;
  }>;
};

type CentralPaymentsPayload = {
  data?: Array<{ id?: string; totalAmount?: number; status?: string }>;
  summary?: {
    totalLinks?: number;
    totalAmount?: number;
    paidAmount?: number;
    pendingAmount?: number;
  };
};

function iso(value?: string | null) {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : new Date().toISOString();
}

function toLead(lead: CentralLead, user: CentralUser): SalesLeadView {
  return {
    id: lead.id,
    leadId: lead.id,
    assignedAgentId: lead.assignedAgent?.id ?? null,
    createdById: null,
    customerName: lead.customerName ?? "Unknown lead",
    customerPhone: lead.customerPhone ?? "",
    customerEmail: lead.customerEmail ?? "",
    source: "central-api",
    serviceInterest: "",
    segment: "",
    priority: lead.priority ?? "normal",
    tags: [],
    conversationId: null,
    budgetAmount: 0,
    stage: (lead.stage ?? "NEW") as SalesLeadView["stage"],
    followUpAt: lead.followUpAt ?? null,
    lastContactedAt: null,
    notes: lead.notes ?? "",
    createdAt: iso(lead.createdAt),
    updatedAt: iso(lead.updatedAt),
    lastTouch: null,
  };
}

function toLeadPoolItem(item: LeadPoolItem): SalesDashboardSnapshot["visibleLeadPool"][number] {
  return {
    id: item.id,
    assignedAgentId: item.assignedAgentId ?? null,
    claimedByAgentId: item.claimedByAgentId ?? null,
    convertedAssignmentId: item.convertedAssignmentId ?? null,
    customerName: item.customerName,
    customerPhone: item.customerPhone ?? "",
    customerEmail: item.customerEmail ?? "",
    source: item.source ?? "central-api",
    serviceInterest: item.serviceInterest ?? "",
    segment: item.segment ?? "",
    priority: item.priority ?? "normal",
    budgetAmount: Number(item.budgetAmount ?? 0),
    status: item.status,
    notes: item.notes ?? "",
    claimedAt: item.claimedAt ?? null,
    createdAt: iso(item.createdAt),
    updatedAt: iso(item.updatedAt),
  };
}

function toAgent(user: CentralUser): SalesAgentView {
  return {
    id: user.userId,
    userId: user.userId,
    tenantId: user.tenantId,
    displayName: user.displayName,
    email: user.email ?? "",
    phone: user.phone ?? "",
    packageName: null,
    packageStatus: null,
    packageExpiresAt: null,
    groupId: null,
    parentAgentId: null,
    agentCode: user.userId.slice(0, 8).toUpperCase(),
    status: "ACTIVE",
    commissionPercent: null,
    payoutInfo: null,
    canCreateSubAgents: user.role === "ADMIN",
    canClaimLeads: true,
    maxActiveLeads: null,
    activeLeadQuota: null,
    permissions: { workspaceRole: user.role },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function toTeamAgent(member: CentralTeamMember, user: CentralUser): SalesAgentView {
  return {
    id: member.id,
    userId: member.userId,
    tenantId: user.tenantId,
    displayName: member.displayName,
    email: member.email ?? "",
    phone: member.phone ?? "",
    packageName: null,
    packageStatus: null,
    packageExpiresAt: null,
    groupId: null,
    parentAgentId: null,
    agentCode: member.agentCode ?? member.userId.slice(0, 8).toUpperCase(),
    status: member.status ?? "ACTIVE",
    commissionPercent: member.commissionPercent ?? null,
    payoutInfo: null,
    canCreateSubAgents: member.role === "ADMIN",
    canClaimLeads: member.canClaimLeads !== false,
    maxActiveLeads: member.maxActiveLeads ?? null,
    permissions: { ...(member.permissions ?? {}), workspaceRole: member.role },
    createdAt: member.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function emptySnapshot(
  user: CentralUser,
  leads: SalesLeadView[],
  aggregates: Array<{ stage?: string; count?: number; totalValue?: number }>,
  mobileCalls: SalesDashboardSnapshot["mobileCalls"] = [],
): SalesDashboardSnapshot {
  const agent = toAgent(user);
  const count = (stage: string) => aggregates.find((item) => item.stage === stage)?.count ?? 0;
  return {
    settings: {
      moduleEnabled: true, signupRequiresApproval: false, defaultCommissionPercent: 0,
      closerDirectCommissionPercent: 0, closerSubCommissionPercent: 0, freelancerCommissionPercent: 0,
      agencyCommissionPercent: 0, payoutHoldDays: 0, payoutMinimum: 0, enableAnnouncements: true,
      enableMessages: true, enableReferralLinks: false, enableTeams: true, enableEarnings: true,
      enablePayouts: true, enablePackageLinks: true, dashboardPrimaryColor: "#f97316", dashboardAccentColor: "#fb923c",
    },
    groups: [], agents: [agent], currentAgent: agent, visibleAgents: [agent],
    visibleLeadPool: [], visibleLeads: leads, visibleDeals: [], visibleEarnings: [], visiblePayouts: [],
    leadPool: [], leads, deals: [], commissionRules: [], earnings: [], payouts: [], referrals: [], referralEvents: [],
    announcements: [], messages: [], packages: [], goals: [], rewards: [], mobileDevices: [], mobileDiagnostics: [], mobileCalls,
    reports: {
      assignedLeads: leads.length, openQueueLeads: 0, claimedLeads: leads.length, closedDeals: count("CLOSED_WON"),
      paidRevenue: 0, pendingRevenue: 0, conversionRate: leads.length ? (count("CLOSED_WON") / leads.length) * 100 : 0,
      approvedEarnings: 0, availableBalance: 0, pendingPayout: 0, totalAmountWithdrawn: 0, directCustomersCount: leads.length,
      directCommissionEarned: 0, networkReferralsCount: 0, networkCommissionEarned: 0,
      walletBreakdown: { inNegotiation: 0, pendingValidation: 0, pendingVesting: 0, availableForPayout: 0 },
      referralViews: 0, referralSignups: 0, referralPayments: 0, leaderboard: [], earningsSeries: [],
      funnel: aggregates.map((item) => ({ stage: (item.stage ?? "NEW") as SalesLeadView["stage"], count: item.count ?? 0, value: item.totalValue ?? 0 })),
    },
  };
}

export default async function SalesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : undefined;
  let user: CentralUser;
  let leads: SalesLeadView[];
  let aggregates: Array<{ stage?: string; count?: number; totalValue?: number }>;
  let teamMembers: CentralTeamMember[] = [];
  let mobileCalls: SalesDashboardSnapshot["mobileCalls"] = [];
  let leadPool: SalesDashboardSnapshot["visibleLeadPool"] = [];
  let paymentSummary: NonNullable<CentralPaymentsPayload["summary"]> = {};
  let me: CentralMe | null = null;
  try {
    me = await centralApiRequest<CentralMe>("/auth/me");
  } catch {
    redirect(`/login?authFailed=1&redirectTo=${encodeURIComponent(params?.tab ? `/?tab=${String(params.tab)}` : "/")}`);
  }

  user = me?.data?.user;
  if (!user || !["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"].includes(user.role)) {
    redirect(`/login?authFailed=1&redirectTo=${encodeURIComponent("/")}`);
  }

  try {
    const [leadPayload, aggregatePayload, teamPayload, callsPayload, poolPayload, paymentPayload] = await Promise.all([
      centralApiRequest<{ data: CentralLead[] | { leads?: CentralLead[] } }>("/leads?page=1&limit=100").catch(() => ({ data: [] })),
      centralApiRequest<{ data: Array<{ stage?: string; count?: number; totalValue?: number }> }>("/leads/pipeline-aggregates").catch(() => ({ data: [] })),
      ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(user.role)
        ? centralApiRequest<{ data: CentralTeamMember[] }>("/team").catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] as CentralTeamMember[] }),
      centralApiRequest<{ data: CentralCallsPayload }>("/calls?limit=100").catch(() => ({ data: { calls: [] } })),
      centralApiRequest<{ data: LeadPoolItem[] }>("/leads/pool").catch(() => ({ data: [] })),
      centralApiRequest<CentralPaymentsPayload>("/payments?page=1&limit=1").catch(() => ({ data: [], summary: {} })),
    ]);
    const leadRows = Array.isArray(leadPayload.data) ? leadPayload.data : (leadPayload.data?.leads ?? []);
    leads = leadRows.map((lead) => toLead(lead, user));
    aggregates = aggregatePayload.data ?? [];
    teamMembers = Array.isArray(teamPayload.data) ? teamPayload.data : (teamPayload.data?.members ?? []);
    leadPool = Array.isArray(poolPayload.data) ? poolPayload.data.map(toLeadPoolItem) : [];
    paymentSummary = paymentPayload.summary ?? {};
    mobileCalls = (callsPayload.data?.calls ?? []).map((call) => ({
      id: call.id,
      assignmentId: call.assignment?.id ?? "",
      agentId: call.agent?.id ?? "",
      customerName: call.assignment?.customerName ?? "Unknown lead",
      phoneNumber: call.phoneNumber,
      deviceName: "Central API",
      deviceModel: "Central API",
      direction: call.direction ?? "OUTBOUND",
      status: call.status,
      outcome: call.outcome ?? "",
      note: call.note ?? "",
      durationSeconds: call.durationSeconds ?? 0,
      recordingStatus: call.recordingStatus ?? "NONE",
      recordingError: call.recordingError ?? "",
      noteSubmitted: call.noteSubmitted ?? Boolean(call.note),
      startedAt: call.startedAt,
      endedAt: call.endedAt ?? null,
    }));
  } catch {
    leads = [];
    aggregates = [];
    teamMembers = [];
    leadPool = [];
    mobileCalls = [];
    paymentSummary = {};
  }

  const fallbackAgent = toAgent(user!);
  const cookieStore = await cookies();
  const centralToken = cookieStore.get("aicloser_token")?.value ?? null;
  const teamAgents = teamMembers.map((member) => toTeamAgent(member, user!));
  const currentAgent = teamAgents.find((agent) => agent.userId === user!.userId) ?? fallbackAgent;
  const initialSnapshot = emptySnapshot(user!, leads!, aggregates!, mobileCalls);
  initialSnapshot.agents = teamAgents.length ? teamAgents : [currentAgent];
  initialSnapshot.visibleAgents = initialSnapshot.agents;
  initialSnapshot.currentAgent = currentAgent;
  initialSnapshot.visibleLeadPool = leadPool;
  initialSnapshot.leadPool = leadPool;
  initialSnapshot.reports.openQueueLeads = leadPool.filter((item) => item.status === "OPEN").length;

  return (
    <SalesDashboard
      salesOperations={{
        tenantId: user!.tenantId,
        whatsAppConnection: null,
        whatsAppTenantOptions: [],
        instagramConnection: { pluginEnabled: false, status: "Disconnected" },
        instagramSetupUrls: {},
        chatbotFlows: [], chatbotRuns: [], chatbotAgencies: [],
      } as never}
      snapshot={initialSnapshot}
      centralAggregates={aggregates!}
      centralPaymentSummary={paymentSummary}
      canManageContacts={user!.role === "ADMIN" || user!.role === "SUPER_ADMIN"}
      sessionRole={user!.role}
      rolePermissions={{}}
      centralToken={centralToken}
    />
  );
}
