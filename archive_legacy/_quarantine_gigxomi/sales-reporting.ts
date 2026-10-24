import "server-only";

import type { AppRole } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

const ACTIVE_STAGES = new Set([
  "NEW",
  "ASSIGNED",
  "CONTACTED",
  "INTERESTED",
  "WEBINAR_INVITED",
  "WEBINAR_ATTENDED",
  "FOLLOW_UP",
  "NEGOTIATION",
  "QUALIFIED",
  "QUOTE_SENT",
  "PAYMENT_PENDING",
]);

type ReportSession = { userId?: string | null; role: AppRole | "GUEST" };

export type SalesReportFilters = {
  range: "today" | "7d" | "30d" | "custom" | "all";
  attention: "all" | "due_today" | "overdue" | "untouched" | "missing_follow_up" | "paused";
  audience?: "all" | "agency" | "freelancer" | "unregistered";
  from: Date | null;
  to: Date | null;
  agentId: string | null;
  groupId: string | null;
  source: string | null;
  stage: string | null;
  view: "mine" | "team";
  page: number;
  pageSize: number;
};

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(value);
}

function dateAtIndiaMidnight(value: string) {
  return new Date(`${value}T00:00:00+05:30`);
}

function getDateRange(filters: Pick<SalesReportFilters, "range" | "from" | "to">) {
  if (filters.range === "all") return { from: null, to: null };
  if (filters.range === "custom") return { from: filters.from, to: filters.to };

  const today = dayKey(new Date());
  const todayStart = dateAtIndiaMidnight(today);
  const days = filters.range === "30d" ? 30 : filters.range === "7d" ? 7 : 1;
  const from = new Date(todayStart.getTime() - (days - 1) * 86400000);
  const to = new Date(todayStart.getTime() + 86400000);
  return { from, to };
}

function inRange(value: Date, from: Date | null, to: Date | null) {
  return (!from || value >= from) && (!to || value < to);
}

function dateParts(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = dateAtIndiaMidnight(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseSalesReportFilters(searchParams: URLSearchParams): SalesReportFilters {
  const rangeValue = searchParams.get("range") ?? "today";
  const range = new Set(["today", "7d", "30d", "custom", "all"]).has(rangeValue)
    ? (rangeValue as SalesReportFilters["range"])
    : "today";
  const from = dateParts(searchParams, "from");
  const toDate = dateParts(searchParams, "to");
  const to = toDate ? new Date(toDate.getTime() + 86400000) : null;
  const page = Math.max(1, Math.min(1000, Number(searchParams.get("page") ?? 1) || 1));
  const pageSize = Math.max(10, Math.min(100, Number(searchParams.get("pageSize") ?? 50) || 50));
  const attentionValue = searchParams.get("attention") ?? "all";
  const attention = new Set(["all", "due_today", "overdue", "untouched", "missing_follow_up", "paused"]).has(attentionValue)
    ? (attentionValue as SalesReportFilters["attention"])
    : "all";
  const audienceValue = searchParams.get("audience") ?? "all";
  const audience = new Set(["all", "agency", "freelancer", "unregistered"]).has(audienceValue)
    ? (audienceValue as SalesReportFilters["audience"])
    : "all";
  return {
    range,
    attention,
    audience,
    from,
    to,
    agentId: searchParams.get("agentId")?.trim() || null,
    groupId: searchParams.get("groupId")?.trim() || null,
    source: searchParams.get("source")?.trim() || null,
    stage: searchParams.get("stage")?.trim() || null,
    view: searchParams.get("view") === "team" ? "team" : "mine",
    page,
    pageSize,
  };
}

function isPaidSubscription(user: { subscriptions: Array<{ paymentStatus: string; amount: unknown; paymentTransactions: Array<{ status: string; amount: unknown }> }> }) {
  return user.subscriptions.some((subscription) =>
    subscription.paymentTransactions.some((transaction) => transaction.status === "SUCCESS" && Number(transaction.amount) > 0) ||
    (subscription.paymentStatus === "PAID" && Number(subscription.amount) > 0),
  );
}

function billingState(user: {
  packageStatus: string | null;
  packageExpiresAt: Date | null;
  subscriptions: Array<{ status: string; paymentStatus: string; amount: unknown; expiresAt: Date | null; paymentTransactions: Array<{ status: string; amount: unknown }> }>;
  packageId: string | null;
  packageName?: string | null;
}) {
  const subscription = user.subscriptions[0] ?? null;
  const paid = isPaidSubscription(user);
  const expiry = subscription?.expiresAt ?? user.packageExpiresAt;
  const isTrialPackage =
    user.packageId === "pkg-agency-freemium" ||
    Boolean(user.packageName?.toLowerCase().includes("freemium")) ||
    Boolean(user.packageName?.toLowerCase().includes("trial")) ||
    subscription?.status === "TRIALING" ||
    user.packageStatus === "TRIAL";

  const expired = Boolean(expiry && expiry.getTime() <= Date.now()) || user.packageStatus === "EXPIRED" || subscription?.status === "EXPIRED";
  const trial = !paid && !expired && isTrialPackage;
  const state = paid
    ? "PAID"
    : trial
      ? "TRIAL"
      : expired && isTrialPackage
        ? "TRIAL_EXPIRED"
        : subscription?.paymentStatus === "PENDING"
          ? "PAYMENT_PENDING"
          : user.packageId
            ? "FREE"
            : "UNKNOWN";
  return { state, paid, trialExpiresAt: trial || state === "TRIAL_EXPIRED" ? expiry?.toISOString() ?? null : null };
}

export async function getSalesResponsibilityReport(session: ReportSession, requested: SalesReportFilters) {
  const allAgents = await prisma.salesAgentProfile.findMany({
    where: { status: { not: "SUSPENDED" } },
    include: { user: { select: { displayName: true } }, group: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const currentAgent = session.userId ? allAgents.find((agent) => agent.userId === session.userId) ?? null : null;
  const visibleAgents = session.role === "SUPER_ADMIN" || session.role === "ADMIN" || session.role === "MANAGER"
    ? allAgents
    : currentAgent
      ? allAgents.filter((agent) => agent.id === currentAgent.id || agent.parentAgentId === currentAgent.id)
      : [];
  const visibleAgentIds = visibleAgents.map((agent) => agent.id);
  const selectedAgentIds = requested.agentId && visibleAgentIds.includes(requested.agentId) ? [requested.agentId] : visibleAgentIds;
  const scopedAgentIds = requested.view === "mine" && currentAgent && !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.role)
    ? [currentAgent.id]
    : selectedAgentIds;
  const groupAgentIds = requested.groupId ? visibleAgents.filter((agent) => agent.groupId === requested.groupId).map((agent) => agent.id) : null;
  const agentIds = groupAgentIds ? scopedAgentIds.filter((id) => groupAgentIds.includes(id)) : scopedAgentIds;
  const dateRange = getDateRange(requested);

  const assignments = await prisma.salesLeadAssignment.findMany({
    where: {
      assignedAgentId: { in: agentIds.length ? agentIds : ["__none__"] },
      ...(requested.source ? { source: { equals: requested.source, mode: "insensitive" } } : {}),
      ...(requested.stage ? { stage: requested.stage as never } : {}),
    },
    select: {
      id: true,
      assignedAgentId: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      source: true,
      segment: true,
      stage: true,
      conversationId: true,
      followUpAt: true,
      lastContactedAt: true,
      createdAt: true,
      updatedAt: true,
      priority: true,
      notes: true,
      deals: { select: { status: true, paidAmount: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const leadIds = assignments.map((lead) => lead.id);
  const conversationIds = assignments.map((lead) => lead.conversationId).filter((id): id is string => Boolean(id));
  const leadEmails = assignments.map((lead) => lead.customerEmail?.toLowerCase().trim()).filter((email): email is string => Boolean(email));
  const leadPhones = assignments.map((lead) => normalizePhone(lead.customerPhone)).filter((phone): phone is string => Boolean(phone));

  const [tasks, conversations, metaEvents, appUsers] = await Promise.all([
    leadIds.length
      ? prisma.gxLeadTask.findMany({ where: { salesLeadId: { in: leadIds }, status: "OPEN" }, orderBy: { dueAt: "asc" }, select: { salesLeadId: true, title: true, dueAt: true, priority: true, status: true } })
      : Promise.resolve([]),
    conversationIds.length
      ? prisma.appConversation.findMany({ where: { id: { in: conversationIds } }, select: { id: true, status: true } })
      : Promise.resolve([]),
    conversationIds.length
      ? prisma.metaConversionEvent.findMany({ where: { conversationId: { in: conversationIds } }, orderBy: { updatedAt: "desc" }, take: 250, select: { conversationId: true, eventName: true, status: true, lastError: true, traceId: true, updatedAt: true } })
      : Promise.resolve([]),
    (leadEmails.length > 0 || leadPhones.length > 0)
      ? prisma.appAuthUser.findMany({
          where: {
            OR: [
              ...(leadEmails.length > 0 ? [{ email: { in: leadEmails } }] : []),
              ...(leadPhones.length > 0 ? [{ phone: { in: leadPhones } }] : []),
            ],
          },
          take: 200,
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            packageAudience: true,
            packageName: true,
            packageStatus: true,
            packageId: true,
            packageExpiresAt: true,
            createdAt: true,
            subscriptions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { status: true, paymentStatus: true, amount: true, expiresAt: true, paymentTransactions: { orderBy: { createdAt: "desc" }, take: 2, select: { status: true, amount: true } } },
            },
            freelancerOnboarding: { select: { status: true, currentStep: true, completedAt: true, updatedAt: true } },
            connectedOnboarding: { select: { audience: true, stage: true, completedAt: true, updatedAt: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const taskByLead = new Map<string, (typeof tasks)[number]>();
  for (const task of tasks) if (!taskByLead.has(task.salesLeadId)) taskByLead.set(task.salesLeadId, task);
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const metaByConversation = new Map<string, (typeof metaEvents)[number]>();
  for (const event of metaEvents) if (event.conversationId && !metaByConversation.has(event.conversationId)) metaByConversation.set(event.conversationId, event);
  const userByPhone = new Map<string, (typeof appUsers)[number]>();
  const userByEmail = new Map<string, (typeof appUsers)[number]>();
  for (const user of appUsers) {
    const phone = normalizePhone(user.phone);
    if (phone && !userByPhone.has(phone)) userByPhone.set(phone, user);
    if (user.email && !userByEmail.has(user.email.toLowerCase())) userByEmail.set(user.email.toLowerCase(), user);
  }
  const agentById = new Map(visibleAgents.map((agent) => [agent.id, agent]));
  const now = Date.now();
  const today = dayKey(new Date());
  const todayStart = dateAtIndiaMidnight(today).getTime();
  const todayEnd = todayStart + 86400000;

  const rows = assignments.map((lead) => {
    const task = taskByLead.get(lead.id);
    const dueAt = task?.dueAt ?? lead.followUpAt;
    const dueTime = dueAt?.getTime() ?? null;
    const user = (lead.customerEmail && userByEmail.get(lead.customerEmail.toLowerCase())) || userByPhone.get(normalizePhone(lead.customerPhone)) || null;
    const billing = user ? billingState(user) : { state: "UNKNOWN", paid: false, trialExpiresAt: null };
    const onboarding = user?.freelancerOnboarding ?? user?.connectedOnboarding ?? null;
    const meta = lead.conversationId ? metaByConversation.get(lead.conversationId) : null;
    const metaState = meta ? (meta.status === "SENT" ? "SENT" : meta.status === "FAILED" ? "FAILED" : "PENDING") : "NOT_SENT";
    const stale = (!lead.lastContactedAt && now - lead.createdAt.getTime() > 86400000) || now - lead.updatedAt.getTime() > 3 * 86400000;
    const paused = lead.conversationId ? String(conversationById.get(lead.conversationId)?.status ?? "").toUpperCase() === "PAUSED" : false;
    const period = inRange(lead.createdAt, dateRange.from, dateRange.to) || inRange(lead.updatedAt, dateRange.from, dateRange.to);
    return {
      id: lead.id,
      customerName: lead.customerName,
      customerPhone: lead.customerPhone,
      customerEmail: lead.customerEmail,
      source: lead.source,
      segment: lead.segment,
      stage: lead.stage,
      conversationId: lead.conversationId,
      owner: agentById.get(lead.assignedAgentId)?.user.displayName ?? "Unassigned",
      ownerAgentId: lead.assignedAgentId,
      priority: lead.priority,
      lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
      lastActivityAt: lead.updatedAt.toISOString(),
      followUpAt: dueAt?.toISOString() ?? null,
      nextAction: task?.title ?? (dueAt ? "Follow up" : "Add next action"),
      taskPriority: task?.priority ?? null,
      untouched: !lead.lastContactedAt,
      stale,
      paused,
      period,
      app: user
        ? { userId: user.id, displayName: user.displayName, audience: user.packageAudience, registeredAt: user.createdAt.toISOString(), agencyRegistered: user.packageAudience === "AGENCY", freelancerRegistered: user.packageAudience === "FREELANCER", appInstalled: true, onboardingStage: onboarding && "stage" in onboarding ? onboarding.stage : onboarding && "currentStep" in onboarding ? onboarding.currentStep : null, onboardingStatus: onboarding && "status" in onboarding ? onboarding.status : null, onboardingCompletedAt: onboarding?.completedAt?.toISOString() ?? null, packageName: user.packageName, packageStatus: user.packageStatus, billingState: billing.state, paid: billing.paid, trialExpiresAt: billing.trialExpiresAt }
        : { userId: null, displayName: null, audience: null, registeredAt: null, agencyRegistered: null, freelancerRegistered: null, appInstalled: null, onboardingStage: null, onboardingStatus: null, onboardingCompletedAt: null, packageName: null, packageStatus: null, billingState: "UNKNOWN", paid: false, trialExpiresAt: null },
      capi: { state: metaState, eventName: meta?.eventName ?? null, lastError: meta?.lastError ?? null, traceId: meta?.traceId ?? null, updatedAt: meta?.updatedAt.toISOString() ?? null },
      dueToday: dueTime !== null && dueTime >= todayStart && dueTime < todayEnd,
      overdue: dueTime !== null && dueTime < now,
      missingFollowUp: ACTIVE_STAGES.has(lead.stage) && !dueAt,
    };
  });

  const periodRows = requested.range === "all" ? rows : rows.filter((row) => row.period);
  const attentionRows = requested.attention === "all"
    ? periodRows
    : rows.filter((row) => {
      if (requested.attention === "due_today") return row.dueToday;
      if (requested.attention === "overdue") return row.overdue;
      if (requested.attention === "untouched") return row.untouched;
      if (requested.attention === "missing_follow_up") return row.missingFollowUp;
      return row.paused;
    });

  const registration = {
    all: periodRows.length,
    agency: periodRows.filter((row) => row.app.agencyRegistered === true).length,
    freelancer: periodRows.filter((row) => row.app.freelancerRegistered === true).length,
    unregistered: periodRows.filter((row) => !row.app.agencyRegistered && !row.app.freelancerRegistered).length,
  };

  const audienceFilteredRows = requested.audience === "agency"
    ? attentionRows.filter((row) => row.app.agencyRegistered === true)
    : requested.audience === "freelancer"
      ? attentionRows.filter((row) => row.app.freelancerRegistered === true)
      : requested.audience === "unregistered"
        ? attentionRows.filter((row) => !row.app.agencyRegistered && !row.app.freelancerRegistered)
        : attentionRows;

  const currentRows = rows;
  const dueRows = rows.filter((row) => row.dueToday || row.overdue || row.untouched || row.missingFollowUp || row.paused || row.capi.state === "FAILED");
  const exceptions = dueRows
    .map((row) => ({ ...row, reason: row.overdue ? "OVERDUE" : row.dueToday ? "DUE_TODAY" : row.untouched ? "NEVER_CONTACTED" : row.missingFollowUp ? "MISSING_FOLLOW_UP" : row.paused ? "PAUSED_CHAT" : "CAPI_FAILED" }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || new Date(a.followUpAt ?? a.lastActivityAt).getTime() - new Date(b.followUpAt ?? b.lastActivityAt).getTime())
    .slice(0, 100);
  const pageStart = (requested.page - 1) * requested.pageSize;
  const responsibilityRows = audienceFilteredRows.slice().sort((a, b) => Number(b.overdue) - Number(a.overdue) || new Date(a.followUpAt ?? a.lastActivityAt).getTime() - new Date(b.followUpAt ?? b.lastActivityAt).getTime()).slice(pageStart, pageStart + requested.pageSize);

  const funnelStages = ["NEW", "CONTACTED", "QUALIFIED", "INTERESTED", "FOLLOW_UP", "NEGOTIATION", "PAYMENT_PENDING", "PAID", "CLOSED_WON", "LOST"];
  const funnel = funnelStages.map((stage) => ({ stage, count: periodRows.filter((row) => row.stage === stage).length }));
  const sourceMap = new Map<string, number>();
  for (const row of periodRows) sourceMap.set(row.source || "unknown", (sourceMap.get(row.source || "unknown") ?? 0) + 1);
  const sourceCounts = [...sourceMap.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count }));
  const trendMap = new Map<string, number>();
  for (const row of periodRows) { const key = dayKey(new Date(row.lastActivityAt)); trendMap.set(key, (trendMap.get(key) ?? 0) + 1); }
  const trend = [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  const team = visibleAgents.filter((agent) => agentIds.includes(agent.id)).map((agent) => {
    const agentRows = currentRows.filter((row) => row.ownerAgentId === agent.id);
    const agentPeriod = periodRows.filter((row) => row.ownerAgentId === agent.id);
    const contacted = agentRows.filter((row) => !row.untouched).length;
    const closed = agentPeriod.filter((row) => ["PAID", "CLOSED_WON", "CLOSED", "HANDOFF"].includes(row.stage)).length;
    return { agentId: agent.id, name: agent.user.displayName, group: agent.group?.name ?? null, assigned: agentRows.length, dueToday: agentRows.filter((row) => row.dueToday).length, overdue: agentRows.filter((row) => row.overdue).length, untouched: agentRows.filter((row) => row.untouched).length, missingFollowUp: agentRows.filter((row) => row.missingFollowUp).length, contacted, responseRate: agentRows.length ? Math.round((contacted / agentRows.length) * 100) : 0, closed, conversionRate: agentPeriod.length ? Math.round((closed / agentPeriod.length) * 100) : 0 };
  }).sort((a, b) => b.overdue - a.overdue || b.assigned - a.assigned);
  const openQueue = agentIds.length
    ? await prisma.salesLeadPoolItem.count({ where: { status: "OPEN", OR: [{ assignedAgentId: null }, { assignedAgentId: { in: agentIds } }] } })
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Calcutta",
    filters: { ...requested, from: dateRange.from?.toISOString() ?? null, to: dateRange.to?.toISOString() ?? null },
    summary: {
      assigned: currentRows.length,
      unassigned: openQueue,
      dueToday: currentRows.filter((row) => row.dueToday).length,
      overdue: currentRows.filter((row) => row.overdue).length,
      untouched: currentRows.filter((row) => row.untouched).length,
      stale: currentRows.filter((row) => row.stale).length,
      missingFollowUp: currentRows.filter((row) => row.missingFollowUp).length,
      paused: currentRows.filter((row) => row.paused).length,
      conversionRate: periodRows.length ? Math.round((periodRows.filter((row) => ["PAID", "CLOSED_WON", "CLOSED", "HANDOFF"].includes(row.stage)).length / periodRows.length) * 100) : 0,
    },
    registration,
    team,
    exceptions,
    leads: responsibilityRows,
    pagination: { page: requested.page, pageSize: requested.pageSize, total: audienceFilteredRows.length, pages: Math.max(1, Math.ceil(audienceFilteredRows.length / requested.pageSize)) },
    funnel,
    sourceCounts,
    trend,
    billing: { paid: periodRows.filter((row) => row.app.billingState === "PAID").length, trial: periodRows.filter((row) => row.app.billingState === "TRIAL").length, trialExpired: periodRows.filter((row) => row.app.billingState === "TRIAL_EXPIRED").length, paymentPending: periodRows.filter((row) => row.app.billingState === "PAYMENT_PENDING").length, free: periodRows.filter((row) => row.app.billingState === "FREE").length, unknown: periodRows.filter((row) => row.app.billingState === "UNKNOWN").length },
    capi: { sent: rows.filter((row) => row.capi.state === "SENT").length, pending: rows.filter((row) => row.capi.state === "PENDING").length, failed: rows.filter((row) => row.capi.state === "FAILED").length, notSent: rows.filter((row) => row.capi.state === "NOT_SENT").length },
  };
}
