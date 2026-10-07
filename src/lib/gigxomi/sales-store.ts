import "server-only";

import { access } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { createInternalUser, ensureAuthStoreReady } from "@/lib/auth/store";
import type { AppRole } from "@/lib/auth/types";
import { listMobilePushTokens, sendMobilePushNotifications } from "@/lib/mobile-push-store";
import { prisma } from "@/lib/prisma";
import { buildSiteUrl } from "@/lib/seo/company-knowledge-base";
import { syncLeadStatusToMetaAndOutbox } from "@/lib/gigxomi/lead-status-meta-sync";

export type SalesAgentStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export type SalesLeadStage =
  | "NEW"
  | "ASSIGNED"
  | "CONTACTED"
  | "INTERESTED"
  | "WEBINAR_INVITED"
  | "WEBINAR_ATTENDED"
  | "FOLLOW_UP"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST"
  | "NOT_REACHABLE"
  | "RECYCLED"
  | "QUALIFIED"
  | "QUOTE_SENT"
  | "PAYMENT_PENDING"
  | "PAID"
  | "HANDOFF"
  | "CONVERTED_FREE"
  | "CLOSED"
  | "LOST";
export type SalesDealStatus = "DRAFT" | "PAYMENT_PENDING" | "PAID" | "HANDOFF" | "CLOSED" | "CANCELLED" | "REFUNDED";
export type SalesEarningStatus = "PENDING" | "APPROVED" | "PAID" | "REVERSED";
export type SalesPayoutStatus = "REQUESTED" | "APPROVED" | "PAID" | "REJECTED";
export type SalesCommissionRuleType = "FIXED" | "PERCENTAGE";
export type SalesCommissionScope = "ALL_AGENTS" | "AGENT_GROUP" | "INDIVIDUAL_AGENT";
export type SalesCommissionAppliesTo = "ALL_PACKAGES" | "PACKAGE" | "SERVICE" | "ONE_TIME_DEAL";
export type SalesLeadPoolStatus = "OPEN" | "CLAIMED" | "ARCHIVED";
export type SalesReferralEventType = "PRICING_VIEW" | "SIGNUP_STARTED" | "SIGNUP_VERIFIED" | "PAYMENT_STARTED" | "PAYMENT_SUCCESS" | "DEAL_CREATED";
export type SalesGoalMetric = "PAID_REVENUE" | "CLOSED_DEALS" | "REFERRAL_SIGNUPS" | "CONVERSION_RATE" | "LEADS_CLAIMED";
export type SalesGoalScope = "ALL_AGENTS" | "AGENT_GROUP" | "INDIVIDUAL_AGENT";

type SalesModuleSettings = {
  moduleEnabled: boolean;
  signupRequiresApproval: boolean;
  defaultCommissionPercent: number;
  closerDirectCommissionPercent: number;
  closerSubCommissionPercent: number;
  freelancerCommissionPercent: number;
  agencyCommissionPercent: number;
  payoutHoldDays: number;
  payoutMinimum: number;
  enableAnnouncements: boolean;
  enableMessages: boolean;
  enableReferralLinks: boolean;
  enableTeams: boolean;
  enableEarnings: boolean;
  enablePayouts: boolean;
  enablePackageLinks: boolean;
  dashboardPrimaryColor: string;
  dashboardAccentColor: string;
};

type SalesPackagePayload = Prisma.PackageGetPayload<{
  include: {
    featureValues: {
      include: {
        feature: true;
      };
    };
  };
}>;

export type SalesAgentView = {
  id: string;
  userId: string;
  tenantId: string | null;
  displayName: string;
  email: string;
  phone: string;
  packageName: string | null;
  packageStatus: string | null;
  packageExpiresAt: string | null;
  groupId: string | null;
  parentAgentId: string | null;
  agentCode: string;
  status: SalesAgentStatus;
  commissionPercent: number | null;
  payoutInfo: Record<string, unknown> | null;
  canCreateSubAgents: boolean;
  canClaimLeads: boolean;
  maxActiveLeads: number | null;
  permissions: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type SalesLeadPoolView = {
  id: string;
  assignedAgentId: string | null;
  claimedByAgentId: string | null;
  convertedAssignmentId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  source: string;
  serviceInterest: string;
  segment: string;
  priority: string;
  budgetAmount: number;
  status: SalesLeadPoolStatus;
  notes: string;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SalesLeadView = {
  id: string;
  leadId: string | null;
  assignedAgentId: string;
  createdById: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  source: string;
  serviceInterest: string;
  segment: string;
  priority: string;
  tags: string[];
  conversationId: string | null;
  budgetAmount: number;
  stage: SalesLeadStage;
  followUpAt: string | null;
  lastContactedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  metaSync?: unknown;
};

type SalesDealView = {
  id: string;
  assignmentId: string;
  agentId: string;
  packageId: string | null;
  packageName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  quoteId: string | null;
  paymentTransactionId: string | null;
  referralCodeId: string | null;
  title: string;
  agreedAmount: number;
  paidAmount: number;
  status: SalesDealStatus;
  paymentReference: string | null;
  handoffNotes: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SalesEarningView = {
  id: string;
  dealId: string;
  agentId: string;
  ruleId: string | null;
  amount: number;
  parentAmount: number;
  status: SalesEarningStatus;
  payoutId: string | null;
  createdAt: string;
  updatedAt: string;
};

type SalesPayoutView = {
  id: string;
  agentId: string;
  amount: number;
  status: SalesPayoutStatus;
  note: string;
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  updatedAt: string;
};

type SalesReferralEventView = {
  id: string;
  referralCodeId: string;
  agentId: string;
  userId: string | null;
  packageId: string | null;
  paymentTransactionId: string | null;
  dealId: string | null;
  eventType: SalesReferralEventType;
  path: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type SalesGoalView = {
  id: string;
  name: string;
  metric: SalesGoalMetric;
  scope: SalesGoalScope;
  agentId: string | null;
  groupId: string | null;
  target: number;
  currentValue: number;
  progressPercent: number;
  rewardText: string;
  startsAt: string | null;
  endsAt: string | null;
  isPinned: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type SalesRewardView = {
  id: string;
  title: string;
  body: string;
  agentId: string | null;
  groupId: string | null;
  isPinned: boolean;
  isActive: boolean;
  unlockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SalesDashboardSnapshot = {
  settings: SalesModuleSettings;
  groups: Array<{
    id: string;
    name: string;
    description: string;
    defaultCommissionPercent: number;
    parentCommissionPercent: number;
    maxDiscountPercent: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  agents: SalesAgentView[];
  currentAgent: SalesAgentView | null;
  visibleAgents: SalesAgentView[];
  visibleLeadPool: SalesLeadPoolView[];
  visibleLeads: SalesLeadView[];
  visibleDeals: SalesDealView[];
  visibleEarnings: SalesEarningView[];
  visiblePayouts: SalesPayoutView[];
  leadPool: SalesLeadPoolView[];
  leads: SalesLeadView[];
  deals: SalesDealView[];
  commissionRules: Array<{
    id: string;
    name: string;
    type: SalesCommissionRuleType;
    scope: SalesCommissionScope;
    appliesTo: SalesCommissionAppliesTo;
    groupId: string | null;
    agentId: string | null;
    packageId: string | null;
    serviceId: string | null;
    value: number;
    parentCommissionPercent: number | null;
    minOrderValue: number | null;
    maxOrderValue: number | null;
    priority: number;
    isActive: boolean;
  }>;
  earnings: SalesEarningView[];
  payouts: SalesPayoutView[];
  referrals: Array<{
    id: string;
    agentId: string;
    code: string;
    label: string;
    isActive: boolean;
    registrationUrl: string;
    pricingUrl: string;
    websiteUrl: string;
    androidAppUrl: string;
    createdAt: string;
    updatedAt: string;
  }>;
  referralEvents: SalesReferralEventView[];
  announcements: Array<{ id: string; title: string; body: string; audience: string; isActive: boolean; createdAt: string; updatedAt: string }>;
  messages: Array<{ id: string; agentId: string | null; subject: string; status: string; messages: Array<{ author: string; body: string; createdAt: string }>; createdAt: string; updatedAt: string }>;
  packages: Array<{
    id: string;
    name: string;
    slug: string;
    shortSubtitle: string;
    description: string;
    badgeText: string;
    amount: number;
    currency: string;
    priceLabel: string;
    billingLabel: string;
    audience: string;
    featureBullets: string[];
    compareHighlights: string[];
    isActive: boolean;
    isRecommended: boolean;
  }>;
  goals: SalesGoalView[];
  rewards: SalesRewardView[];
  mobileDevices: Array<{ id: string; agentId: string; deviceId: string; deviceName: string; manufacturer: string; model: string; simLabel: string; officeSimNumber: string; recordingCapability: string; recordingEnabled: boolean; lastSeenAt: string; isActive: boolean }>;
  mobileCalls: Array<{ id: string; assignmentId: string; agentId: string; customerName: string; phoneNumber: string; deviceName: string; deviceModel: string; status: string; outcome: string; note: string; durationSeconds: number; recordingStatus: string; recordingError: string; noteSubmitted: boolean; startedAt: string; endedAt: string | null }>;
  reports: {
    assignedLeads: number;
    openQueueLeads: number;
    claimedLeads: number;
    closedDeals: number;
    paidRevenue: number;
    pendingRevenue: number;
    conversionRate: number;
    approvedEarnings: number;
    availableBalance: number;
    pendingPayout: number;
    totalAmountWithdrawn: number;
    directCustomersCount: number;
    directCommissionEarned: number;
    networkReferralsCount: number;
    networkCommissionEarned: number;
    walletBreakdown: {
      inNegotiation: number;
      pendingValidation: number;
      pendingVesting: number;
      availableForPayout: number;
    };
    referralViews: number;
    referralSignups: number;
    referralPayments: number;
    leaderboard: Array<{ agentId: string; name: string; paidRevenue: number; closedDeals: number; approvedEarnings: number; claimedLeads: number; conversionRate: number; score: number }>;
    earningsSeries: Array<{ label: string; amount: number }>;
    funnel: Array<{ stage: SalesLeadStage; count: number; value: number }>;
  };
};

export function compactSalesSnapshotForInitialRender(snapshot: SalesDashboardSnapshot): SalesDashboardSnapshot {
  return {
    ...snapshot,
    groups: [],
    visibleLeadPool: [],
    visibleDeals: [],
    visibleEarnings: [],
    visiblePayouts: [],
    leadPool: [],
    leads: [],
    deals: [],
    commissionRules: [],
    earnings: [],
    payouts: [],
    referrals: [],
    referralEvents: [],
    announcements: [],
    messages: [],
    packages: [],
    goals: [],
    rewards: [],
    mobileDevices: [],
  };
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function readJsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readJsonMessages(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      return {
        author: String(record.author ?? "System"),
        body: String(record.body ?? ""),
        createdAt: String(record.createdAt ?? new Date().toISOString()),
      };
    })
    .filter((item): item is { author: string; body: string; createdAt: string } => Boolean(item?.body));
}

let cachedSalesSettings: Awaited<ReturnType<typeof prisma.salesSettings.findUnique>> | null = null;
let salesDefaultsPromise: Promise<any> | null = null;

async function ensureSalesDefaults() {
  if (cachedSalesSettings) {
    return cachedSalesSettings;
  }
  if (salesDefaultsPromise) {
    return salesDefaultsPromise;
  }

  salesDefaultsPromise = runEnsureSalesDefaults()
    .then((settings) => {
      cachedSalesSettings = settings;
      return settings;
    })
    .catch((error) => {
      salesDefaultsPromise = null;
      console.warn("[ensureSalesDefaults Warning]:", error.message);
      return null;
    });

  return salesDefaultsPromise;
}

async function runEnsureSalesDefaults() {
  const [settings] = await Promise.all([
    prisma.salesSettings.upsert({
      where: { id: "sales-settings" },
      update: {},
      create: {
        id: "sales-settings",
        closerDirectCommissionPercent: 20,
        closerSubCommissionPercent: 10,
        freelancerCommissionPercent: 10,
        agencyCommissionPercent: 10,
        payoutHoldDays: 7,
      },
    }),
    prisma.salesAgentGroup.upsert({
      where: { id: "sales-group-main" },
      update: {
        defaultCommissionPercent: 20,
        parentCommissionPercent: 10,
      },
      create: {
        id: "sales-group-main",
        name: "AI Closers",
        description: "Default commission tier for remote sales agents.",
        defaultCommissionPercent: 20,
        parentCommissionPercent: 10,
        maxDiscountPercent: 0,
      },
    }),
  ]);

  await prisma.salesCommissionRule.upsert({
    where: { id: "sales-rule-default-paid-package" },
    update: {
      value: 20,
      parentCommissionPercent: 10,
    },
    create: {
      id: "sales-rule-default-paid-package",
      name: "Default Premium plan purchase commission (20%)",
      type: "PERCENTAGE",
      scope: "ALL_AGENTS",
      appliesTo: "ALL_PACKAGES",
      value: 20,
      parentCommissionPercent: 10,
      priority: 1,
      isActive: true,
    },
  });

  await prisma.salesGoal.upsert({
    where: { id: "sales-goal-monthly-revenue" },
    update: {},
    create: {
      id: "sales-goal-monthly-revenue",
      name: "Monthly revenue sprint",
      metric: "PAID_REVENUE",
      scope: "ALL_AGENTS",
      target: 100000,
      rewardText: "Top closer gets the pinned Gigxomi revenue bonus review.",
      isPinned: true,
      isActive: true,
    },
  });

  await prisma.salesReward.upsert({
    where: { id: "sales-reward-response-streak" },
    update: {},
    create: {
      id: "sales-reward-response-streak",
      title: "Fast follow-up streak",
      body: "Keep new leads moving within the same day to protect conversion and payout velocity.",
      isPinned: true,
      isActive: true,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    const poolCount = await prisma.salesLeadPoolItem.count();
    if (poolCount === 0) {
      await prisma.salesLeadPoolItem.createMany({
        data: [
          {
            id: "sales-pool-sample-b2b-saas",
            customerName: "Aarav Sharma",
            customerPhone: "+919876543210",
            customerEmail: "aarav.sharma@techscale.io",
            source: "outbound-sim",
            serviceInterest: "AI Telecalling CRM - 10 Caller Seats",
            segment: "b2b-saas",
            priority: "hot",
            budgetAmount: 24000,
            notes: "Demo requested: Android SIM call auto-sync and recording review.",
          },
          {
            id: "sales-pool-sample-fintech-calling",
            customerName: "Rohan Verma",
            customerPhone: "+919812341111",
            customerEmail: "rohan@fintechgrowth.in",
            source: "sim-telecalling",
            serviceInterest: "SIM AI Telecalling & Call Tracker",
            segment: "fintech",
            priority: "warm",
            budgetAmount: 18000,
            notes: "Wants automated call recording and WhatsApp follow-ups for telecallers.",
          },
          {
            id: "sales-pool-sample-edtech-team",
            customerName: "Priya Nair",
            customerPhone: "+919900001234",
            customerEmail: "priya@eduleap.in",
            source: "inbound-callback",
            serviceInterest: "Sales Team SIM Tracker & Lead Pipeline",
            segment: "edtech",
            priority: "hot",
            budgetAmount: 48000,
            notes: "Managing 15 sales callers; needs daily call duration and recording analytics.",
          },
          {
            id: "sales-pool-sample-insurance-agency",
            customerName: "Vikram Malhotra",
            customerPhone: "+919700004321",
            customerEmail: "vikram@malhotrainsurance.com",
            source: "web-inquiry",
            serviceInterest: "Telecalling SIM CRM with AI Audio Transcripts",
            segment: "insurance",
            priority: "normal",
            budgetAmount: 32000,
            notes: "Evaluating SIM dialer integration for insurance advisory sales.",
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  return settings;
}

function mapSettings(settings: Awaited<ReturnType<typeof ensureSalesDefaults>>) {
  return {
    moduleEnabled: settings.moduleEnabled,
    signupRequiresApproval: settings.signupRequiresApproval,
    defaultCommissionPercent: toNumber(settings.defaultCommissionPercent),
    closerDirectCommissionPercent: toNumber(settings.closerDirectCommissionPercent ?? 20),
    closerSubCommissionPercent: toNumber(settings.closerSubCommissionPercent ?? 10),
    freelancerCommissionPercent: toNumber(settings.freelancerCommissionPercent ?? 10),
    agencyCommissionPercent: toNumber(settings.agencyCommissionPercent ?? 10),
    payoutHoldDays: settings.payoutHoldDays ?? 7,
    payoutMinimum: toNumber(settings.payoutMinimum),
    enableAnnouncements: settings.enableAnnouncements,
    enableMessages: settings.enableMessages,
    enableReferralLinks: settings.enableReferralLinks,
    enableTeams: settings.enableTeams,
    enableEarnings: settings.enableEarnings,
    enablePayouts: settings.enablePayouts,
    enablePackageLinks: settings.enablePackageLinks,
    dashboardPrimaryColor: settings.dashboardPrimaryColor,
    dashboardAccentColor: settings.dashboardAccentColor,
  };
}

function mapAgent(agent: Prisma.SalesAgentProfileGetPayload<{ include: { user: true } }>): SalesAgentView {
  return {
    id: agent.id,
    userId: agent.userId,
    tenantId: agent.user.tenantId ?? null,
    displayName: agent.user.displayName,
    email: agent.user.email ?? "",
    phone: agent.user.phone,
    packageName: agent.user.packageName ?? null,
    packageStatus: agent.user.packageStatus ?? null,
    packageExpiresAt: agent.user.packageExpiresAt?.toISOString() ?? null,
    groupId: agent.groupId,
    parentAgentId: agent.parentAgentId,
    agentCode: agent.agentCode,
    status: agent.status as SalesAgentStatus,
    commissionPercent: agent.commissionPercent === null ? null : toNumber(agent.commissionPercent),
    payoutInfo: readJsonObject(agent.payoutInfo),
    canCreateSubAgents: agent.canCreateSubAgents,
    canClaimLeads: agent.canClaimLeads,
    maxActiveLeads: agent.maxActiveLeads,
    permissions: readJsonObject(agent.permissions),
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

function mapLeadPoolItem(item: Prisma.SalesLeadPoolItemGetPayload<object>): SalesLeadPoolView {
  return {
    id: item.id,
    assignedAgentId: item.assignedAgentId,
    claimedByAgentId: item.claimedByAgentId,
    convertedAssignmentId: item.convertedAssignmentId,
    customerName: item.customerName,
    customerPhone: item.customerPhone ?? "",
    customerEmail: item.customerEmail ?? "",
    source: item.source,
    serviceInterest: item.serviceInterest ?? "",
    segment: item.segment ?? "",
    priority: item.priority,
    budgetAmount: toNumber(item.budgetAmount),
    status: item.status as SalesLeadPoolStatus,
    notes: item.notes ?? "",
    claimedAt: iso(item.claimedAt),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function maskContact(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) {
    const [name, domain] = trimmed.split("@");
    return `${name.slice(0, 2)}***@${domain ?? "hidden"}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}

function maskOpenPoolItem(item: SalesLeadPoolView) {
  return {
    ...item,
    customerPhone: item.customerPhone,
    customerEmail: item.customerEmail,
    notes: item.notes || "Available lead from queue.",
  };
}

function mapLead(lead: Prisma.SalesLeadAssignmentGetPayload<object>): SalesLeadView {
  return {
    id: lead.id,
    leadId: lead.leadId,
    assignedAgentId: lead.assignedAgentId,
    createdById: lead.createdById,
    customerName: lead.customerName,
    customerPhone: lead.customerPhone ?? "",
    customerEmail: lead.customerEmail ?? "",
    source: lead.source,
    serviceInterest: lead.serviceInterest ?? "",
    segment: lead.segment ?? "",
    priority: lead.priority,
    tags: lead.tags,
    conversationId: lead.conversationId,
    budgetAmount: toNumber(lead.budgetAmount),
    stage: lead.stage as SalesLeadStage,
    followUpAt: iso(lead.followUpAt),
    lastContactedAt: iso(lead.lastContactedAt),
    notes: lead.notes ?? "",
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function mapDeal(deal: Prisma.SalesDealGetPayload<{ include: { package: true; service: true } }>): SalesDealView {
  return {
    id: deal.id,
    assignmentId: deal.assignmentId,
    agentId: deal.agentId,
    packageId: deal.packageId,
    packageName: deal.package?.name ?? null,
    serviceId: deal.serviceId,
    serviceName: deal.service?.title ?? null,
    quoteId: deal.quoteId,
    paymentTransactionId: deal.paymentTransactionId,
    referralCodeId: deal.referralCodeId,
    title: deal.title,
    agreedAmount: toNumber(deal.agreedAmount),
    paidAmount: toNumber(deal.paidAmount),
    status: deal.status as SalesDealStatus,
    paymentReference: deal.paymentReference,
    handoffNotes: deal.handoffNotes ?? "",
    closedAt: iso(deal.closedAt),
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

function mapEarning(earning: Prisma.SalesEarningGetPayload<object>): SalesEarningView {
  return {
    id: earning.id,
    dealId: earning.dealId,
    agentId: earning.agentId,
    ruleId: earning.ruleId,
    amount: toNumber(earning.amount),
    parentAmount: toNumber(earning.parentAmount),
    status: earning.status as SalesEarningStatus,
    payoutId: earning.payoutId,
    createdAt: earning.createdAt.toISOString(),
    updatedAt: earning.updatedAt.toISOString(),
  };
}

function mapPayout(payout: Prisma.SalesPayoutGetPayload<object>): SalesPayoutView {
  return {
    id: payout.id,
    agentId: payout.agentId,
    amount: toNumber(payout.amount),
    status: payout.status as SalesPayoutStatus,
    note: payout.note ?? "",
    requestedAt: payout.requestedAt.toISOString(),
    approvedAt: iso(payout.approvedAt),
    paidAt: iso(payout.paidAt),
    updatedAt: payout.updatedAt.toISOString(),
  };
}

function formatPackageMoney(currency: string, amount: number) {
  if (currency.toUpperCase() === "INR") {
    return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
  }
  return `${currency.toUpperCase()} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;
}

function packageBillingLabel(type: string, interval: string) {
  if (type === "FREE") return "Get started";
  if (type === "ONE_TIME_PAID" || interval === "ONE_TIME") return "One-time payment";
  if (interval === "MONTHLY") return "Per month";
  if (interval === "QUARTERLY") return "Per quarter";
  if (interval === "YEARLY") return "Per year";
  return "Custom billing";
}

function mapSalesPackage(pkg: SalesPackagePayload) {
  const amount = toNumber(pkg.amount);
  const featureBullets = pkg.selectedSummaryBullets.length
    ? pkg.selectedSummaryBullets
    : pkg.featureValues
        .filter((item) => item.feature.showInSelectedSummary)
        .sort((left, right) => left.feature.sortOrder - right.feature.sortOrder)
        .map((item) => item.shortDisplayText ?? item.feature.shortDisplayText ?? item.feature.featureLabel);
  const compareHighlights = pkg.compareHighlights.length
    ? pkg.compareHighlights
    : pkg.featureValues
        .filter((item) => item.feature.showInRegistrationCompare)
        .sort((left, right) => left.feature.sortOrder - right.feature.sortOrder)
        .map((item) => item.shortDisplayText ?? item.feature.shortDisplayText ?? item.feature.featureLabel);

  return {
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    shortSubtitle: pkg.shortSubtitle ?? "",
    description: pkg.description ?? "",
    badgeText: pkg.badgeText ?? "",
    amount,
    currency: pkg.currency,
    priceLabel: formatPackageMoney(pkg.currency, amount),
    billingLabel: packageBillingLabel(pkg.billingType, pkg.billingInterval),
    audience: pkg.packageType,
    featureBullets,
    compareHighlights,
    isActive: pkg.isActive,
    isRecommended: pkg.isRecommended,
  };
}

function mapReferralEvent(event: Prisma.SalesReferralEventGetPayload<object>): SalesReferralEventView {
  return {
    id: event.id,
    referralCodeId: event.referralCodeId,
    agentId: event.agentId,
    userId: event.userId,
    packageId: event.packageId,
    paymentTransactionId: event.paymentTransactionId,
    dealId: event.dealId,
    eventType: event.eventType as SalesReferralEventType,
    path: event.path ?? "",
    metadata: readJsonObject(event.metadata),
    createdAt: event.createdAt.toISOString(),
  };
}

function metricValueForGoal(input: {
  goal: Prisma.SalesGoalGetPayload<object>;
  agents: SalesAgentView[];
  leadPool: SalesLeadPoolView[];
  leads: SalesLeadView[];
  deals: SalesDealView[];
  referralEvents: SalesReferralEventView[];
}) {
  const scopedAgents = input.agents.filter((agent) => {
    if (input.goal.scope === "INDIVIDUAL_AGENT") return agent.id === input.goal.agentId;
    if (input.goal.scope === "AGENT_GROUP") return agent.groupId === input.goal.groupId;
    return true;
  });
  const scopedAgentIds = new Set(scopedAgents.map((agent) => agent.id));
  const scopedLeads = input.leads.filter((lead) => scopedAgentIds.has(lead.assignedAgentId));
  const paidDeals = input.deals.filter((deal) => scopedAgentIds.has(deal.agentId) && ["PAID", "HANDOFF", "CLOSED"].includes(deal.status));
  if (input.goal.metric === "PAID_REVENUE") {
    return paidDeals.reduce((sum, deal) => sum + deal.paidAmount, 0);
  }
  if (input.goal.metric === "CLOSED_DEALS") {
    return paidDeals.length;
  }
  if (input.goal.metric === "REFERRAL_SIGNUPS") {
    return input.referralEvents.filter((event) => scopedAgentIds.has(event.agentId) && (event.eventType === "SIGNUP_STARTED" || event.eventType === "SIGNUP_VERIFIED")).length;
  }
  if (input.goal.metric === "CONVERSION_RATE") {
    return scopedLeads.length ? Math.round((paidDeals.length / scopedLeads.length) * 100) : 0;
  }
  return input.leadPool.filter((item) => item.claimedByAgentId && scopedAgentIds.has(item.claimedByAgentId)).length;
}

function mapGoal(
  goal: Prisma.SalesGoalGetPayload<object>,
  context: {
    agents: SalesAgentView[];
    leadPool: SalesLeadPoolView[];
    leads: SalesLeadView[];
    deals: SalesDealView[];
    referralEvents: SalesReferralEventView[];
  },
): SalesGoalView {
  const target = Math.max(toNumber(goal.target), 1);
  const currentValue = metricValueForGoal({ goal, ...context });
  return {
    id: goal.id,
    name: goal.name,
    metric: goal.metric as SalesGoalMetric,
    scope: goal.scope as SalesGoalScope,
    agentId: goal.agentId,
    groupId: goal.groupId,
    target,
    currentValue,
    progressPercent: Math.min(100, Math.round((currentValue / target) * 100)),
    rewardText: goal.rewardText ?? "",
    startsAt: iso(goal.startsAt),
    endsAt: iso(goal.endsAt),
    isPinned: goal.isPinned,
    isActive: goal.isActive,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

function mapReward(reward: Prisma.SalesRewardGetPayload<object>): SalesRewardView {
  return {
    id: reward.id,
    title: reward.title,
    body: reward.body,
    agentId: reward.agentId,
    groupId: reward.groupId,
    isPinned: reward.isPinned,
    isActive: reward.isActive,
    unlockedAt: iso(reward.unlockedAt),
    createdAt: reward.createdAt.toISOString(),
    updatedAt: reward.updatedAt.toISOString(),
  };
}

function buildReferralUrls(code: string) {
  const ref = encodeURIComponent(code);
  return {
    registrationUrl: buildSiteUrl(`/signup?ref=${ref}`),
    pricingUrl: buildSiteUrl(`/pricing?ref=${ref}`),
    websiteUrl: buildSiteUrl(`/?ref=${ref}`),
    androidAppUrl: buildSiteUrl(`/go/app?ref=${ref}`),
  };
}

function buildReports(input: {
  agents: SalesAgentView[];
  leadPool: SalesLeadPoolView[];
  leads: SalesLeadView[];
  deals: SalesDealView[];
  earnings: SalesEarningView[];
  payouts: SalesPayoutView[];
  referralEvents: SalesReferralEventView[];
  currentAgentId?: string | null;
}) {
  const visibleAgentIds = new Set(input.agents.map((agent) => agent.id));
  const scopedEarnings = input.currentAgentId
    ? input.earnings.filter((e) => e.agentId === input.currentAgentId)
    : input.earnings;
  const scopedPayouts = input.currentAgentId
    ? input.payouts.filter((p) => p.agentId === input.currentAgentId)
    : input.payouts;
  const paidDeals = input.deals.filter((deal) => ["PAID", "HANDOFF", "CLOSED"].includes(deal.status));
  const paidRevenue = paidDeals.reduce((sum, deal) => sum + deal.paidAmount, 0);
  const pendingRevenue = input.deals.filter((deal) => deal.status === "PAYMENT_PENDING").reduce((sum, deal) => sum + deal.agreedAmount, 0);
  const now = Date.now();
  const sevenDayMs = 7 * 24 * 60 * 60 * 1000;
  const approvedEarnings = scopedEarnings.filter((earning) => earning.status === "APPROVED" || earning.status === "PAID").reduce((sum, earning) => sum + earning.amount, 0);
  const totalAmountWithdrawn = scopedPayouts.filter((payout) => payout.status === "PAID").reduce((sum, payout) => sum + payout.amount, 0);
  const inNegotiation = input.leads.filter((lead) => ["CONTACTED", "QUALIFIED", "QUOTE_SENT"].includes(lead.stage)).reduce((sum, lead) => sum + lead.budgetAmount, 0);
  const pendingValidation = scopedEarnings.filter((earning) => earning.status === "PENDING").reduce((sum, earning) => sum + earning.amount, 0);
  const pendingVesting = scopedEarnings
    .filter((earning) => earning.status === "APPROVED" && !earning.payoutId && now - new Date(earning.createdAt).getTime() < sevenDayMs)
    .reduce((sum, earning) => sum + earning.amount, 0);
  const availableBalance = scopedEarnings
    .filter((earning) => earning.status === "APPROVED" && !earning.payoutId && now - new Date(earning.createdAt).getTime() >= sevenDayMs)
    .reduce((sum, earning) => sum + earning.amount, 0);
  const pendingPayout = scopedPayouts.filter((payout) => payout.status === "REQUESTED" || payout.status === "APPROVED").reduce((sum, payout) => sum + payout.amount, 0);
  const openQueueLeads = input.leadPool.filter((item) => item.status === "OPEN").length;
  const claimedLeads = input.leadPool.filter((item) => item.status === "CLAIMED").length;
  const referralViews = input.referralEvents.filter((event) => event.eventType === "PRICING_VIEW" || (event.eventType as string) === "CLICK").length;
  const referralSignups = input.referralEvents.filter((event) => event.eventType === "SIGNUP_STARTED" || event.eventType === "SIGNUP_VERIFIED").length;
  const referralPayments = input.referralEvents.filter((event) => event.eventType === "PAYMENT_SUCCESS" || event.eventType === "DEAL_CREATED").length;

  let directCustomersCount = 0;
  let directCommissionEarned = 0;
  let networkReferralsCount = 0;
  let networkCommissionEarned = 0;

  for (const earning of scopedEarnings.filter((e) => e.status === "APPROVED" || e.status === "PAID")) {
    const deal = input.deals.find((d) => d.id === earning.dealId);
    if (deal && deal.agentId !== earning.agentId) {
      networkReferralsCount += 1;
      networkCommissionEarned += earning.amount;
    } else {
      directCustomersCount += 1;
      directCommissionEarned += earning.amount;
    }
  }
  const earningsByMonth = new Map<string, number>();
  for (const earning of input.earnings.filter((item) => item.status === "APPROVED" || item.status === "PAID")) {
    const date = new Date(earning.createdAt);
    const label = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date) : "Now";
    earningsByMonth.set(label, (earningsByMonth.get(label) ?? 0) + earning.amount);
  }
  const funnel = (["NEW", "CONTACTED", "QUALIFIED", "QUOTE_SENT", "PAYMENT_PENDING", "PAID", "HANDOFF", "CONVERTED_FREE", "CLOSED", "LOST"] as SalesLeadStage[]).map((stage) => {
    const stageLeads = input.leads.filter((lead) => lead.stage === stage);
    return {
      stage,
      count: stageLeads.length,
      value: stageLeads.reduce((sum, lead) => sum + lead.budgetAmount, 0),
    };
  });

  return {
    assignedLeads: input.leads.length,
    openQueueLeads,
    claimedLeads,
    closedDeals: paidDeals.length,
    paidRevenue,
    pendingRevenue,
    conversionRate: input.leads.length ? Math.round((paidDeals.length / input.leads.length) * 100) : 0,
    approvedEarnings,
    availableBalance,
    pendingPayout,
    totalAmountWithdrawn,
    directCustomersCount,
    directCommissionEarned: Math.round(directCommissionEarned),
    networkReferralsCount,
    networkCommissionEarned: Math.round(networkCommissionEarned),
    walletBreakdown: {
      inNegotiation,
      pendingValidation,
      pendingVesting,
      availableForPayout: availableBalance,
    },
    referralViews,
    referralSignups,
    referralPayments,
    leaderboard: input.agents
      .map((agent) => {
        const agentDeals = input.deals.filter((deal) => deal.agentId === agent.id && ["PAID", "HANDOFF", "CLOSED"].includes(deal.status));
        const agentLeads = input.leads.filter((lead) => lead.assignedAgentId === agent.id);
        const agentClaimedLeads = input.leadPool.filter((item) => item.claimedByAgentId === agent.id).length;
        const agentPaidRevenue = agentDeals.reduce((sum, deal) => sum + deal.paidAmount, 0);
        const agentApprovedEarnings = input.earnings
          .filter((earning) => earning.agentId === agent.id && (earning.status === "APPROVED" || earning.status === "PAID"))
          .reduce((sum, earning) => sum + earning.amount, 0);
        const agentConversionRate = agentLeads.length ? Math.round((agentDeals.length / agentLeads.length) * 100) : 0;
        return {
          agentId: agent.id,
          name: agent.displayName,
          paidRevenue: agentPaidRevenue,
          closedDeals: agentDeals.length,
          approvedEarnings: agentApprovedEarnings,
          claimedLeads: agentClaimedLeads,
          conversionRate: agentConversionRate,
          score: Math.round(agentPaidRevenue / 100 + agentDeals.length * 120 + agentApprovedEarnings / 40 + agentConversionRate * 5 + agentClaimedLeads * 25),
        };
      })
      .filter((row) => visibleAgentIds.has(row.agentId))
      .sort((left, right) => right.score - left.score),
    earningsSeries: Array.from(earningsByMonth.entries()).slice(-6).map(([seriesLabel, amount]) => ({ label: seriesLabel, amount })),
    funnel,
  };
}

type SalesAgentWriteClient = Pick<Prisma.TransactionClient, "appAuthUser" | "salesAgentGroup" | "salesAgentProfile" | "salesReferralCode">;

async function generateAgentCode(displayName: string, database: SalesAgentWriteClient = prisma) {
  const prefix = normalizeCode(`GX-${displayName.split(/\s+/)[0] || "AGENT"}`) || "GX-AGENT";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = normalizeCode(`${prefix}-${randomBytes(3).toString("hex")}`);
    const existing = await database.salesReferralCode.findUnique({ where: { code } });
    if (!existing) return code;
  }
  return normalizeCode(`${prefix}-${Date.now().toString(36)}`);
}

export async function getSalesAgentAccess(userId: string | null | undefined) {
  if (!userId) return { ok: false as const, reason: "missing" as const, agent: null };
  await ensureSalesDefaults();
  const agent = await prisma.salesAgentProfile.findUnique({ where: { userId }, include: { user: true } });
  if (!agent) return { ok: false as const, reason: "missing" as const, agent: null };
  if (agent.status !== "ACTIVE") return { ok: false as const, reason: agent.status as "PENDING" | "SUSPENDED", agent: mapAgent(agent) };
  return { ok: true as const, reason: "ACTIVE" as const, agent: mapAgent(agent) };
}

export async function ensureAffiliateProfile(userId: string, parentAgentId?: string | null) {
  await ensureSalesDefaults();
  const user = await prisma.appAuthUser.findUnique({
    where: { id: userId },
    include: { salesAgentProfile: { include: { referralCodes: true } } },
  });
  if (!user) throw new Error("User not found.");

  let profile = user.salesAgentProfile;
  if (!profile) {
    const rawPrefix = (user.email ? user.email.split("@")[0] : user.displayName)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const prefix = rawPrefix || "GX";
    let agentCode = user.id === "user-freelancer" || rawPrefix.toLowerCase() === "creator"
      ? "creator"
      : `GX-${prefix.slice(0, 10)}-${user.id.slice(-4).toUpperCase()}`;

    const existingCode = await prisma.salesAgentProfile.findUnique({ where: { agentCode } });
    if (existingCode && agentCode !== "creator") {
      agentCode = `GX-${prefix.slice(0, 8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    const groupId = (user.role as string) === "FREELANCER"
      ? "group-affiliate-freelancer"
      : (user.role as string) === "AGENCY"
      ? "group-affiliate-agency"
      : "sales-group-main";

    profile = await prisma.salesAgentProfile.create({
      data: {
        userId: user.id,
        agentCode,
        groupId,
        parentAgentId: parentAgentId ?? null,
        status: "ACTIVE",
        canClaimLeads: user.role === "SALES_AGENT",
        canCreateSubAgents: user.role === "SALES_AGENT",
      },
      include: { referralCodes: true },
    });
  } else if (parentAgentId && !profile.parentAgentId && profile.id !== parentAgentId) {
    profile = await prisma.salesAgentProfile.update({
      where: { id: profile.id },
      data: { parentAgentId },
      include: { referralCodes: true },
    });
  }

  let refCode = profile.referralCodes?.find((c) => c.isActive);
  if (!refCode) {
    refCode = await prisma.salesReferralCode.create({
      data: {
        agentId: profile.id,
        code: profile.agentCode,
        label: `${user.displayName} referral link`,
        isActive: true,
      },
    });
  }

  if (user.id === "user-freelancer" || profile.agentCode.toLowerCase() === "creator") {
    await prisma.salesReferralCode.upsert({
      where: { code: "creator" },
      update: { agentId: profile.id, isActive: true },
      create: {
        agentId: profile.id,
        code: "creator",
        label: "Default Creator Referral Code",
        isActive: true,
      },
    }).catch(() => {});
  }

  return { profile, refCode };
}

export async function findActiveReferralCode(rawCode: string | null | undefined) {
  const code = normalizeCode(rawCode ?? "");
  if (!code) return null;
  const trimmed = rawCode?.trim() ?? "";

  // 1. Check direct referral code
  const direct = await prisma.salesReferralCode.findFirst({
    where: {
      OR: [
        { code: { equals: code, mode: "insensitive" } },
        { code: { equals: trimmed, mode: "insensitive" } },
      ],
      isActive: true,
      agent: { status: "ACTIVE" },
    },
    include: { agent: { include: { user: true, group: true } } },
  });
  if (direct) return direct;

  // 2. Check by agentCode on SalesAgentProfile
  const agent = await prisma.salesAgentProfile.findFirst({
    where: {
      OR: [
        { agentCode: { equals: code, mode: "insensitive" } },
        { agentCode: { equals: trimmed, mode: "insensitive" } },
        { id: trimmed },
      ],
      status: "ACTIVE",
    },
    include: { user: true, group: true },
  });

  if (agent) {
    const existingRef = await prisma.salesReferralCode.findFirst({
      where: { agentId: agent.id, isActive: true },
      include: { agent: { include: { user: true, group: true } } },
    });
    if (existingRef) return existingRef;

    const createdRef = await prisma.salesReferralCode.upsert({
      where: { code: agent.agentCode },
      update: { isActive: true },
      create: {
        agentId: agent.id,
        code: agent.agentCode,
        label: `${agent.user.displayName} referral link`,
        isActive: true,
      },
      include: { agent: { include: { user: true, group: true } } },
    });
    return createdRef;
  }

  // 3. Check AppAuthUser by email / id / displayName / prefix
  const user = await prisma.appAuthUser.findFirst({
    where: {
      OR: [
        { id: trimmed },
        { email: { equals: trimmed, mode: "insensitive" } },
        { email: { startsWith: `${trimmed}@`, mode: "insensitive" } },
        { email: { startsWith: `${code}@`, mode: "insensitive" } },
        { displayName: { equals: trimmed, mode: "insensitive" } },
        ...(code.toLowerCase() === "creator" || trimmed.toLowerCase() === "creator" ? [{ id: "user-freelancer" }] : []),
      ],
    },
  });

  if (user) {
    const { refCode } = await ensureAffiliateProfile(user.id);
    return prisma.salesReferralCode.findUnique({
      where: { id: refCode.id },
      include: { agent: { include: { user: true, group: true } } },
    });
  }

  // 4. Special fallback: if code is "creator", ensure default freelancer
  if (code.toLowerCase() === "creator" || trimmed.toLowerCase() === "creator") {
    const defaultUser = (await prisma.appAuthUser.findUnique({ where: { id: "user-freelancer" } })) ||
      (await prisma.appAuthUser.findFirst({ where: { role: "FREELANCER" } }));
    if (defaultUser) {
      const { refCode } = await ensureAffiliateProfile(defaultUser.id);
      return prisma.salesReferralCode.findUnique({
        where: { id: refCode.id },
        include: { agent: { include: { user: true, group: true } } },
      });
    }
  }

  return null;
}

export async function trackSalesReferralEvent(input: {
  code?: string | null;
  eventType: SalesReferralEventType;
  path?: string | null;
  packageId?: string | null;
  userId?: string | null;
  paymentTransactionId?: string | null;
  dealId?: string | null;
  eventKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await ensureSalesDefaults();
  const referral = await findActiveReferralCode(input.code);
  if (!referral) {
    return { ok: true as const, skipped: true as const };
  }
  const eventKey =
    input.eventKey?.trim() ||
    (input.eventType === "PRICING_VIEW"
      ? ""
      : [
          referral.id,
          input.eventType,
          input.userId ?? "",
          input.packageId ?? "",
          input.paymentTransactionId ?? "",
          input.dealId ?? "",
          input.path ?? "",
        ]
          .filter(Boolean)
          .join(":"));
  const createData = {
    referralCodeId: referral.id,
    agentId: referral.agentId,
    userId: input.userId?.trim() || null,
    packageId: input.packageId?.trim() || null,
    paymentTransactionId: input.paymentTransactionId?.trim() || null,
    dealId: input.dealId?.trim() || null,
    eventType: input.eventType,
    eventKey: eventKey || null,
    path: input.path?.trim() || null,
    metadata: (input.metadata ?? {}) as Prisma.InputJsonObject,
  };
  const event = eventKey
    ? await prisma.salesReferralEvent.upsert({
        where: { eventKey },
        update: {
          path: input.path?.trim() || undefined,
          metadata: input.metadata as Prisma.InputJsonObject | undefined,
        },
        create: createData,
      })
    : await prisma.salesReferralEvent.create({
        data: createData,
      });
  return { ok: true as const, event: mapReferralEvent(event) };
}

export async function getSalesSnapshotForRole(session: { userId?: string | null; role: AppRole | "GUEST"; tenantId?: string | null }) {
  const settings = await ensureSalesDefaults();
  const effectiveTenantId =
    session.tenantId?.trim() ||
    (session.userId
      ? (await prisma.appAuthUser.findUnique({ where: { id: session.userId }, select: { tenantId: true } }))?.tenantId
      : null) ||
    "tenant-gigxomi";

  // Strict tenant isolation: synchronize social conversations exclusively within this tenant's workspace
  // The dashboard must not render before inbound conversations have had a chance
  // to become CRM leads; otherwise the first response can show stale counts.
  await syncConversationLeadsIntoSales({ ...session, tenantId: effectiveTenantId });
  const isSuperAdminAll = session.role === "SUPER_ADMIN" && effectiveTenantId === "tenant-gigxomi";

  const [groups, agentsRaw, leadPoolRaw, leadsRaw, dealsRaw, rulesRaw, earningsRaw, payoutsRaw, referralsRaw, referralEventsRaw, announcementsRaw, messagesRaw, packagesRaw, goalsRaw, rewardsRaw, mobileDevicesRaw, mobileCallsRaw] = await Promise.all([
    prisma.salesAgentGroup.findMany({
      where: isSuperAdminAll
        ? undefined
        : {
            OR: [
              { id: `group-${effectiveTenantId}` },
              { agents: { some: { user: { tenantId: effectiveTenantId } } } },
            ],
          },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.salesAgentProfile.findMany({
      where: isSuperAdminAll ? undefined : { user: { tenantId: effectiveTenantId } },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.salesLeadPoolItem.findMany({
      where: isSuperAdminAll
        ? undefined
        : {
            OR: [
              { assignedAgent: { user: { tenantId: effectiveTenantId } } },
              { claimedByAgent: { user: { tenantId: effectiveTenantId } } },
              { convertedAssignment: { assignedAgent: { user: { tenantId: effectiveTenantId } } } },
              { notes: { contains: `[tenant:${effectiveTenantId}]` } },
            ],
          },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.salesLeadAssignment.findMany({
      where: isSuperAdminAll ? undefined : { assignedAgent: { user: { tenantId: effectiveTenantId } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.salesDeal.findMany({
      where: isSuperAdminAll ? undefined : { agent: { user: { tenantId: effectiveTenantId } } },
      include: { package: true, service: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.salesCommissionRule.findMany({ orderBy: [{ priority: "desc" }, { updatedAt: "desc" }] }),
    prisma.salesEarning.findMany({
      where: isSuperAdminAll ? undefined : { agent: { user: { tenantId: effectiveTenantId } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.salesPayout.findMany({
      where: isSuperAdminAll ? undefined : { agent: { user: { tenantId: effectiveTenantId } } },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.salesReferralCode.findMany({
      where: isSuperAdminAll ? undefined : { agent: { user: { tenantId: effectiveTenantId } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.salesReferralEvent.findMany({
      where: isSuperAdminAll ? undefined : { agent: { user: { tenantId: effectiveTenantId } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.salesAnnouncement.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.salesMessageThread.findMany({
      where: isSuperAdminAll ? undefined : { agent: { user: { tenantId: effectiveTenantId } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.package.findMany({ where: { isActive: true }, include: { featureValues: { include: { feature: true } } }, orderBy: { sortOrder: "asc" } }),
    prisma.salesGoal.findMany({ where: { isActive: true }, orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }] }),
    prisma.salesReward.findMany({ where: { isActive: true }, orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }] }),
    prisma.salesMobileDevice.findMany({
      where: isSuperAdminAll ? undefined : { agent: { user: { tenantId: effectiveTenantId } } },
      orderBy: { lastSeenAt: "desc" },
    }),
    prisma.salesMobileCall.findMany({
      where: isSuperAdminAll ? undefined : { agent: { user: { tenantId: effectiveTenantId } } },
      include: { assignment: true, device: true },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);

  const agents = agentsRaw.map(mapAgent);
  const currentAgent = agents.find((agent) => agent.userId === session.userId) ?? null;
  // Keep legacy workspace owners working even when their auth record still has
  // the old SALES_AGENT role. The profile is the source of truth for access
  // while the next login refreshes the session role.
  const currentAgentPermissions = currentAgent?.permissions as Record<string, unknown> | null | undefined;
  const isProfileWorkspaceAdmin =
    currentAgentPermissions?.workspaceAdmin === true ||
    String(currentAgentPermissions?.workspaceRole ?? "").toUpperCase() === "ADMIN";
  const isWorkspaceAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN" || isProfileWorkspaceAdmin;
  const isWorkspaceManager = session.role === "MANAGER";
  const visibleAgents =
    isWorkspaceAdmin
      ? agents
      : isWorkspaceManager && currentAgent
        ? agents.filter((agent) =>
            agent.id === currentAgent.id ||
            agent.parentAgentId === currentAgent.id,
          )
      : currentAgent
        ? agents.filter((agent) => agent.id === currentAgent.id || agent.parentAgentId === currentAgent.id)
        : [];
  const visibleAgentIds = new Set(visibleAgents.map((agent) => agent.id));
  const leadPool = leadPoolRaw.map(mapLeadPoolItem);
  const leads = leadsRaw.map(mapLead);
  const deals = dealsRaw.map(mapDeal);
  const earnings = earningsRaw.map(mapEarning);
  const payouts = payoutsRaw.map(mapPayout);
  const referralEvents = referralEventsRaw.map(mapReferralEvent);
  const visibleLeadPool =
    isWorkspaceAdmin
      ? leadPool
      : currentAgent
        ? leadPool.filter((item) =>
            item.status === "OPEN" ||
            visibleAgentIds.has(item.assignedAgentId ?? "") ||
            visibleAgentIds.has(item.claimedByAgentId ?? ""),
          )
        : [];
  const visibleLeads = leads.filter((lead) => visibleAgentIds.has(lead.assignedAgentId));
  const visibleDeals = deals.filter((deal) => visibleAgentIds.has(deal.agentId));
  const visibleEarnings = earnings.filter((earning) => visibleAgentIds.has(earning.agentId));
  const visiblePayouts = payouts.filter((payout) => visibleAgentIds.has(payout.agentId));
  const visibleReferralEvents = referralEvents.filter((event) => visibleAgentIds.has(event.agentId));
  const visibleGoals = goalsRaw
    .filter((goal) => {
      if (session.role === "SUPER_ADMIN") return true;
      if (!currentAgent) return false;
      if (goal.scope === "ALL_AGENTS") return true;
      if (goal.scope === "AGENT_GROUP") return goal.groupId === currentAgent.groupId;
      return goal.agentId === currentAgent.id || Boolean(goal.agentId && visibleAgentIds.has(goal.agentId));
    })
    .map((goal) => mapGoal(goal, { agents: visibleAgents, leadPool: visibleLeadPool, leads: visibleLeads, deals: visibleDeals, referralEvents: visibleReferralEvents }));
  const visibleRewards = rewardsRaw
    .filter((reward) => {
      if (session.role === "SUPER_ADMIN") return true;
      if (!currentAgent) return false;
      if (!reward.agentId && !reward.groupId) return true;
      if (reward.groupId) return reward.groupId === currentAgent.groupId;
      return reward.agentId === currentAgent.id || Boolean(reward.agentId && visibleAgentIds.has(reward.agentId));
    })
    .map(mapReward);

  const mobileCalls = await Promise.all(
    mobileCallsRaw
      .filter((call) => isWorkspaceAdmin || call.agentId === currentAgent?.id)
      .map(async (call) => {
        let recordingStatus = call.recordingStatus;
        let recordingError = call.recordingError ?? "";
        if (recordingStatus === "UPLOADED" && call.recordingPath) {
          const recordingPath = path.join(process.cwd(), "data", "uploads", "sales-recordings", path.basename(call.recordingPath));
          try {
            await access(recordingPath);
          } catch {
            recordingStatus = "FAILED";
            recordingError = "Recording file is unavailable. Upload the recording again from the sales mobile app.";
          }
        }
        return {
          id: call.id,
          assignmentId: call.assignmentId,
          agentId: call.agentId,
          customerName: call.assignment.customerName,
          phoneNumber: call.phoneNumber,
          deviceName: call.device?.deviceName ?? "",
          deviceModel: [call.device?.manufacturer, call.device?.model].filter(Boolean).join(" "),
          status: call.status,
          outcome: call.outcome ?? "",
          note: call.note ?? "",
          durationSeconds: call.durationSeconds ?? 0,
          recordingStatus,
          recordingError,
          noteSubmitted: call.noteSubmitted,
          startedAt: call.startedAt.toISOString(),
          endedAt: iso(call.endedAt),
        };
      }),
  );

  return {
    settings: mapSettings(settings),
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description ?? "",
      defaultCommissionPercent: toNumber(group.defaultCommissionPercent),
      parentCommissionPercent: toNumber(group.parentCommissionPercent),
      maxDiscountPercent: group.maxDiscountPercent === null ? null : toNumber(group.maxDiscountPercent),
      isActive: group.isActive,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    })),
    agents,
    currentAgent,
    visibleAgents,
    visibleLeadPool,
    visibleLeads,
    visibleDeals,
    visibleEarnings,
    visiblePayouts,
    leadPool,
    leads,
    deals,
    commissionRules: rulesRaw.map((rule) => ({
      id: rule.id,
      name: rule.name,
      type: rule.type as SalesCommissionRuleType,
      scope: rule.scope as SalesCommissionScope,
      appliesTo: rule.appliesTo as SalesCommissionAppliesTo,
      groupId: rule.groupId,
      agentId: rule.agentId,
      packageId: rule.packageId,
      serviceId: rule.serviceId,
      value: toNumber(rule.value),
      parentCommissionPercent: rule.parentCommissionPercent === null ? null : toNumber(rule.parentCommissionPercent),
      minOrderValue: rule.minOrderValue === null ? null : toNumber(rule.minOrderValue),
      maxOrderValue: rule.maxOrderValue === null ? null : toNumber(rule.maxOrderValue),
      priority: rule.priority,
      isActive: rule.isActive,
    })),
    earnings,
    payouts,
    referrals: referralsRaw.map((referral) => ({
      id: referral.id,
      agentId: referral.agentId,
      code: referral.code,
      label: referral.label ?? "Default referral link",
      isActive: referral.isActive,
      ...buildReferralUrls(referral.code),
      createdAt: referral.createdAt.toISOString(),
      updatedAt: referral.updatedAt.toISOString(),
    })),
    referralEvents: visibleReferralEvents,
    announcements: announcementsRaw.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      audience: announcement.audience,
      isActive: announcement.isActive,
      createdAt: announcement.createdAt.toISOString(),
      updatedAt: announcement.updatedAt.toISOString(),
    })),
    messages: messagesRaw.map((thread) => ({
      id: thread.id,
      agentId: thread.agentId,
      subject: thread.subject,
      status: thread.status,
      messages: readJsonMessages(thread.messages),
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    })),
    packages: packagesRaw.map(mapSalesPackage),
    goals: visibleGoals,
    rewards: visibleRewards,
    mobileDevices: mobileDevicesRaw
      .filter((device) => isWorkspaceAdmin || device.agentId === currentAgent?.id)
      .map((device) => ({ id: device.id, agentId: device.agentId, deviceId: device.deviceId, deviceName: device.deviceName, manufacturer: device.manufacturer ?? "", model: device.model ?? "", simLabel: device.simLabel ?? "", officeSimNumber: device.officeSimNumber ?? "", recordingCapability: device.recordingCapability, recordingEnabled: device.recordingEnabled, lastSeenAt: device.lastSeenAt.toISOString(), isActive: device.isActive })),
    mobileCalls,
    reports: buildReports({ agents: visibleAgents, leadPool: visibleLeadPool, leads: visibleLeads, deals: visibleDeals, earnings: visibleEarnings, payouts: visiblePayouts, referralEvents: visibleReferralEvents, currentAgentId: isWorkspaceAdmin ? null : currentAgent?.id }),
  } satisfies SalesDashboardSnapshot;
}

export type UpsertSalesAgentInput = {
  userId: string;
  displayName?: string;
  email?: string;
  phone?: string;
  status?: SalesAgentStatus;
  groupId?: string | null;
  parentAgentId?: string | null;
  canCreateSubAgents?: boolean;
  canClaimLeads?: boolean;
  maxActiveLeads?: number | null;
};

async function upsertSalesAgentWithDatabase(input: UpsertSalesAgentInput, database: SalesAgentWriteClient) {
  const existingUser = await database.appAuthUser.findUnique({ where: { id: input.userId } });
  if (!existingUser) throw new Error("Sales auth user was not found.");

  // A profile without a SALES_AGENT login role is an unusable CRM account: it
  // remains visible to admins (and keeps its leads) but is rejected by the
  // mobile login scope. Normalize legacy/linked accounts whenever they are
  // saved as sales agents.
  const user =
    existingUser.role === "SALES_AGENT" && existingUser.assignedRole === "SALES_AGENT" && existingUser.permissions.includes("sales_agent")
      ? existingUser
      : await database.appAuthUser.update({
          where: { id: existingUser.id },
          data: {
            role: "SALES_AGENT",
            assignedRole: "SALES_AGENT",
            permissions: Array.from(new Set([...(existingUser.permissions ?? []), "sales_agent"])),
          },
        });
  const existing = await database.salesAgentProfile.findUnique({ where: { userId: input.userId } });
  if (existing) {
    const updated = await database.salesAgentProfile.update({
      where: { id: existing.id },
      data: {
        status: input.status ?? existing.status,
        groupId: input.groupId === undefined ? existing.groupId : input.groupId?.trim() || null,
        parentAgentId: input.parentAgentId === undefined ? existing.parentAgentId : input.parentAgentId?.trim() || null,
        canCreateSubAgents: input.canCreateSubAgents ?? existing.canCreateSubAgents,
        canClaimLeads: input.canClaimLeads ?? existing.canClaimLeads,
        maxActiveLeads: input.maxActiveLeads === undefined ? existing.maxActiveLeads : input.maxActiveLeads,
      },
      include: { user: true },
    });
    return mapAgent(updated);
  }

  const code = await generateAgentCode(input.displayName || user.displayName, database);
  const created = await database.salesAgentProfile.create({
    data: {
      userId: input.userId,
      groupId: input.groupId?.trim() || "sales-group-main",
      parentAgentId: input.parentAgentId?.trim() || null,
      agentCode: code,
      status: input.status ?? "PENDING",
      canCreateSubAgents: input.canCreateSubAgents ?? false,
      canClaimLeads: input.canClaimLeads ?? true,
      maxActiveLeads: input.maxActiveLeads ?? 3,
      referralCodes: {
        create: {
          code,
          label: "Default package referral link",
        },
      },
    },
    include: { user: true },
  });
  return mapAgent(created);
}

export async function upsertSalesAgent(input: UpsertSalesAgentInput) {
  await ensureSalesDefaults();
  return upsertSalesAgentWithDatabase(input, prisma);
}

export async function createSalesAgentAccount(input: Omit<UpsertSalesAgentInput, "userId"> & { password: string; createdByUserId?: string | null; tenantId?: string | null }) {
  await ensureAuthStoreReady();
  await ensureSalesDefaults();
  const groupId = input.groupId?.trim() || "sales-group-main";
  const parentAgentId = input.parentAgentId?.trim() || null;

  return prisma.$transaction(async (transaction) => {
    const [group, parentAgent] = await Promise.all([
      transaction.salesAgentGroup.findUnique({ where: { id: groupId }, select: { id: true } }),
      parentAgentId ? transaction.salesAgentProfile.findUnique({ where: { id: parentAgentId }, select: { id: true } }) : null,
    ]);
    if (!group) return { ok: false as const, error: "Choose a valid sales group." };
    if (parentAgentId && !parentAgent) return { ok: false as const, error: "Choose a valid parent sales agent." };

    let targetTenantId = input.tenantId?.trim() || null;
    if (!targetTenantId && input.createdByUserId) {
      const creator = await transaction.appAuthUser.findUnique({
        where: { id: input.createdByUserId },
        select: { tenantId: true },
      });
      targetTenantId = creator?.tenantId || null;
    }
    if (!targetTenantId && parentAgentId) {
      const parent = await transaction.salesAgentProfile.findUnique({
        where: { id: parentAgentId },
        select: { user: { select: { tenantId: true } } },
      });
      targetTenantId = parent?.user?.tenantId || null;
    }

    const created = await createInternalUser(
      {
        role: "SALES_AGENT",
        displayName: input.displayName ?? "",
        email: input.email ?? "",
        phone: input.phone ?? "",
        password: input.password,
        createdByUserId: input.createdByUserId ?? undefined,
        tenantId: targetTenantId ?? undefined,
      },
      { transaction, skipBootstrap: true },
    );
    if (!created.ok) return created;

    const agent = await upsertSalesAgentWithDatabase(
      {
        ...input,
        userId: created.user.id,
        displayName: created.user.displayName,
        email: created.user.email ?? input.email,
        phone: created.user.phone,
        groupId,
        parentAgentId,
      },
      transaction,
    );
    return { ok: true as const, user: created.user, agent };
  });
}

export async function updateSalesAgentProfile(input: {
  agentId: string;
  status?: SalesAgentStatus;
  groupId?: string | null;
  parentAgentId?: string | null;
  commissionPercent?: number | null;
  canCreateSubAgents?: boolean;
  canClaimLeads?: boolean;
  maxActiveLeads?: number | null;
  permissions?: Record<string, unknown> | null;
}) {
  const updated = await prisma.salesAgentProfile.update({
    where: { id: input.agentId },
    data: {
      status: input.status,
      groupId: input.groupId,
      parentAgentId: input.parentAgentId,
      commissionPercent: input.commissionPercent,
      canCreateSubAgents: input.canCreateSubAgents,
      canClaimLeads: input.canClaimLeads,
      maxActiveLeads: input.maxActiveLeads,
      permissions: input.permissions === undefined ? undefined : input.permissions === null ? Prisma.JsonNull : (input.permissions as Prisma.InputJsonObject),
    },
    include: { user: true },
  });
  return mapAgent(updated);
}

export async function resetSalesAgentPasswordFromAdmin(input: { agentId: string; password: string }) {
  const agentId = input.agentId.trim();
  const password = input.password.trim();
  if (!agentId || password.length < 8) {
    return { ok: false as const, error: "Agent and an 8 character password are required." };
  }

  const agent = await prisma.salesAgentProfile.findUnique({
    where: { id: agentId },
    include: { user: true },
  });
  if (!agent) {
    return { ok: false as const, error: "Sales agent was not found." };
  }

  const salt = randomBytes(16).toString("hex");
  await prisma.appAuthUser.update({
    where: { id: agent.userId },
    data: {
      // Repair legacy profile/user mismatches in the same atomic account
      // update. This changes neither the SalesAgentProfile id nor any lead,
      // deal, referral, payout, or assignment relation.
      role: "SALES_AGENT",
      assignedRole: "SALES_AGENT",
      permissions: Array.from(new Set([...(agent.user.permissions ?? []), "sales_agent"])),
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      lastLoginAt: null,
    },
  });

  return { ok: true as const };
}

export async function deleteSalesAgentFromAdmin(input: { agentId: string }) {
  const agentId = input.agentId.trim();
  if (!agentId) {
    return { ok: false as const, error: "Agent is required." };
  }

  const agent = await prisma.salesAgentProfile.findUnique({
    where: { id: agentId },
    include: { user: true },
  });
  if (!agent || agent.user.role !== "SALES_AGENT") {
    return { ok: false as const, error: "Sales agent was not found." };
  }
  if (agent.user.isSeeded) {
    return { ok: false as const, error: "Seeded sales agents cannot be deleted from this panel." };
  }

  await prisma.$transaction([
    prisma.salesLeadPoolItem.updateMany({
      where: {
        OR: [{ assignedAgentId: agentId }, { claimedByAgentId: agentId }],
      },
      data: {
        assignedAgentId: null,
        claimedByAgentId: null,
        claimedAt: null,
        status: "OPEN",
      },
    }),
    prisma.salesAgentProfile.updateMany({
      where: { parentAgentId: agentId },
      data: { parentAgentId: null },
    }),
    prisma.salesCommissionRule.updateMany({
      where: { agentId },
      data: { agentId: null, scope: "ALL_AGENTS" },
    }),
    prisma.appAuthUser.delete({ where: { id: agent.userId } }),
  ]);

  return { ok: true as const };
}

export async function updateSalesSettings(patch: Partial<SalesModuleSettings>) {
  await ensureSalesDefaults();
  const settings = await prisma.salesSettings.update({
    where: { id: "sales-settings" },
    data: {
      moduleEnabled: patch.moduleEnabled,
      signupRequiresApproval: patch.signupRequiresApproval,
      defaultCommissionPercent: patch.defaultCommissionPercent,
      closerDirectCommissionPercent: patch.closerDirectCommissionPercent,
      closerSubCommissionPercent: patch.closerSubCommissionPercent,
      freelancerCommissionPercent: patch.freelancerCommissionPercent,
      agencyCommissionPercent: patch.agencyCommissionPercent,
      payoutHoldDays: patch.payoutHoldDays,
      payoutMinimum: patch.payoutMinimum,
      enableAnnouncements: patch.enableAnnouncements,
      enableMessages: patch.enableMessages,
      enableReferralLinks: patch.enableReferralLinks,
      enableTeams: patch.enableTeams,
      enableEarnings: patch.enableEarnings,
      enablePayouts: patch.enablePayouts,
      enablePackageLinks: patch.enablePackageLinks,
      dashboardPrimaryColor: patch.dashboardPrimaryColor,
      dashboardAccentColor: patch.dashboardAccentColor,
    },
  });
  return mapSettings(settings);
}

export async function saveSalesGroup(input: { id?: string; name: string; description?: string; defaultCommissionPercent: number; parentCommissionPercent?: number; isActive?: boolean }) {
  await ensureSalesDefaults();
  const data = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    defaultCommissionPercent: input.defaultCommissionPercent,
    parentCommissionPercent: input.parentCommissionPercent ?? 0,
    isActive: input.isActive ?? true,
  };
  if (!data.name) throw new Error("Group name is required.");
  return input.id
    ? prisma.salesAgentGroup.update({ where: { id: input.id }, data })
    : prisma.salesAgentGroup.create({ data });
}

export async function createSalesLeadPoolItem(input: {
  assignedAgentId?: string | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  source?: string;
  serviceInterest?: string;
  segment?: string;
  priority?: string;
  budgetAmount?: number;
  notes?: string;
}) {
  await ensureSalesDefaults();
  const lead = await prisma.salesLeadPoolItem.create({
    data: {
      assignedAgentId: input.assignedAgentId?.trim() || null,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone?.trim() || null,
      customerEmail: input.customerEmail?.trim() || null,
      source: input.source?.trim() || "round_robin",
      serviceInterest: input.serviceInterest?.trim() || "Editor package",
      segment: input.segment?.trim() || null,
      priority: input.priority?.trim() || "normal",
      budgetAmount: Number.isFinite(Number(input.budgetAmount)) ? Number(input.budgetAmount) : null,
      notes: input.notes?.trim() || null,
    },
  });
  return mapLeadPoolItem(lead);
}

function normalizeSalesConversationPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

async function findSalesConversationIdByPhone(phone: string | null | undefined, tenantId?: string | null) {
  const normalizedPhone = normalizeSalesConversationPhone(phone);
  if (!normalizedPhone || !tenantId) return null;

  const candidates = await prisma.appConversation.findMany({
    where: {
      tenantId: tenantId,
    },
    select: { customerPhone: true, id: true },
    orderBy: { updatedAt: "desc" },
    take: 2_000,
  });
  return candidates.find((conversation) => normalizeSalesConversationPhone(conversation.customerPhone) === normalizedPhone)?.id ?? null;
}

export async function linkSalesLeadConversation(leadId: string, explicitTenantId?: string | null) {
  const lead = await prisma.salesLeadAssignment.findUnique({
    where: { id: leadId },
    select: { conversationId: true, customerPhone: true, id: true, assignedAgent: { select: { user: { select: { tenantId: true } } } } },
  });
  if (!lead) return null;
  if (lead.conversationId) return lead.conversationId;

  const tenantId = explicitTenantId || lead.assignedAgent?.user?.tenantId || "tenant-gigxomi";
  const conversationId = await findSalesConversationIdByPhone(lead.customerPhone, tenantId);
  if (!conversationId) return null;
  await prisma.salesLeadAssignment.update({ where: { id: lead.id }, data: { conversationId } });
  return conversationId;
}

export async function syncSalesAgentConversationLinks(agentId: string) {
  const agent = await prisma.salesAgentProfile.findUnique({
    where: { id: agentId },
    select: { user: { select: { tenantId: true } } },
  });
  const tenantId = agent?.user?.tenantId || "tenant-gigxomi";

  const leads = await prisma.salesLeadAssignment.findMany({
    where: { assignedAgentId: agentId, conversationId: null },
    select: { customerPhone: true, id: true },
    take: 500,
  });
  if (!leads.length) return { linked: 0, scanned: 0 };

  const conversations = await prisma.appConversation.findMany({
    where: {
      tenantId: tenantId,
    },
    select: { customerPhone: true, id: true },
    orderBy: { updatedAt: "desc" },
    take: 2_000,
  });
  const conversationByPhone = new Map<string, string>();
  for (const conversation of conversations) {
    const phone = normalizeSalesConversationPhone(conversation.customerPhone);
    if (phone && !conversationByPhone.has(phone)) conversationByPhone.set(phone, conversation.id);
  }
  const updates = leads.flatMap((lead) => {
    const conversationId = conversationByPhone.get(normalizeSalesConversationPhone(lead.customerPhone));
    return conversationId
      ? [prisma.salesLeadAssignment.updateMany({ where: { id: lead.id, conversationId: null }, data: { conversationId } })]
      : [];
  });
  if (!updates.length) return { linked: 0, scanned: leads.length };
  const results = await prisma.$transaction(updates);
  return { linked: results.reduce((total, result) => total + result.count, 0), scanned: leads.length };
}

async function sendSalesLeadAssignmentPush(lead: { assignedAgentId: string; customerName: string; id: string; priority: string; serviceInterest: string | null }) {
  const agent = await prisma.salesAgentProfile.findUnique({ where: { id: lead.assignedAgentId }, select: { userId: true } });
  if (!agent) return { attempted: 0, sent: 0, skipped: "agent_missing" as const };
  const tokens = await listMobilePushTokens({ activeOnly: true, userId: agent.userId });
  if (!tokens.length) return { attempted: 0, sent: 0, skipped: "no_active_token" as const };
  return sendMobilePushNotifications(tokens, {
    title: "New lead assigned",
    body: `${lead.customerName} · ${lead.serviceInterest || "Sales enquiry"}`,
    data: {
      leadId: lead.id,
      notificationChannelId: "gigxomi-sales-leads",
      priority: lead.priority,
      type: "sales_lead_assigned",
    },
  });
}

export async function claimSalesLeadPoolItem(input: { poolItemId: string; agentId: string; actorUserId?: string | null }) {
  await ensureSalesDefaults();
  const agent = await prisma.salesAgentProfile.findUnique({ where: { id: input.agentId }, include: { user: true } });
  if (!agent || agent.status !== "ACTIVE" || !agent.canClaimLeads) {
    throw new Error("This sales agent cannot claim queue leads right now.");
  }
  if (agent.maxActiveLeads) {
    const activeLeadCount = await prisma.salesLeadAssignment.count({
      where: {
        assignedAgentId: agent.id,
        stage: { in: ["NEW", "CONTACTED", "QUALIFIED", "QUOTE_SENT", "PAYMENT_PENDING"] },
      },
    });
    if (activeLeadCount >= agent.maxActiveLeads) {
      throw new Error(`You already have ${activeLeadCount} active leads. Finish or close one before grabbing another.`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const poolItem = await tx.salesLeadPoolItem.findUnique({ where: { id: input.poolItemId } });
    if (!poolItem || poolItem.status !== "OPEN") {
      throw new Error("This lead has already been claimed.");
    }
    if (poolItem.assignedAgentId && poolItem.assignedAgentId !== agent.id) {
      throw new Error("This lead is reserved for another sales agent.");
    }

    const assignment = await tx.salesLeadAssignment.create({
      data: {
        assignedAgentId: agent.id,
        createdById: input.actorUserId ?? null,
        customerName: poolItem.customerName,
        customerPhone: poolItem.customerPhone,
        customerEmail: poolItem.customerEmail,
        source: poolItem.source,
        serviceInterest: poolItem.serviceInterest ?? "Editor package",
        segment: poolItem.segment,
        priority: poolItem.priority,
        budgetAmount: poolItem.budgetAmount,
        stage: "NEW",
        notes: poolItem.notes,
        activityLogs: {
          create: {
            actorUserId: input.actorUserId ?? null,
            action: "LEAD_CLAIMED",
            note: "Lead grabbed from the round-robin queue.",
          },
        },
      },
    });
    const updatedPoolItem = await tx.salesLeadPoolItem.update({
      where: { id: poolItem.id },
      data: {
        claimedByAgentId: agent.id,
        convertedAssignmentId: assignment.id,
        status: "CLAIMED",
        claimedAt: new Date(),
      },
    });
    return { poolItem: mapLeadPoolItem(updatedPoolItem), lead: mapLead(assignment) };
  });
  await linkSalesLeadConversation(result.lead.id);
  const linkedLead = await prisma.salesLeadAssignment.findUnique({ where: { id: result.lead.id } });
  void sendSalesLeadAssignmentPush(linkedLead ?? result.lead).catch(() => undefined);
  return { ...result, lead: linkedLead ? mapLead(linkedLead) : result.lead };
}

export async function createSalesLead(input: Partial<SalesLeadView> & { assignedAgentId: string; customerName: string; actorUserId?: string | null }) {
  await ensureSalesDefaults();
  const lead = await prisma.salesLeadAssignment.create({
    data: {
      assignedAgentId: input.assignedAgentId,
      createdById: input.actorUserId ?? null,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone?.trim() || null,
      customerEmail: input.customerEmail?.trim() || null,
      source: input.source?.trim() || "manual",
      serviceInterest: input.serviceInterest?.trim() || "Editor package",
      segment: input.segment?.trim() || null,
      priority: input.priority?.trim() || "normal",
      tags: input.tags ?? [],
      conversationId: input.conversationId?.trim() || null,
      budgetAmount: input.budgetAmount ?? null,
      stage: input.stage ?? "NEW",
      followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
      lastContactedAt: input.lastContactedAt ? new Date(input.lastContactedAt) : null,
      notes: input.notes?.trim() || null,
      activityLogs: {
        create: {
          actorUserId: input.actorUserId ?? null,
          action: "LEAD_CREATED",
          note: input.notes?.trim() || "Lead created.",
        },
      },
    },
  });
  await linkSalesLeadConversation(lead.id);
  const linkedLead = await prisma.salesLeadAssignment.findUnique({ where: { id: lead.id } });
  void sendSalesLeadAssignmentPush(linkedLead ?? lead).catch(() => undefined);
  return mapLead(linkedLead ?? lead);
}

export async function updateSalesLead(input: {
  leadId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceInterest?: string;
  segment?: string;
  priority?: string;
  tags?: string[];
  budgetAmount?: number | null;
  followUpAt?: string | null;
  lastContactedAt?: string | null;
  notes?: string;
  conversationId?: string | null;
  actorUserId?: string | null;
}) {
  const lead = await prisma.salesLeadAssignment.update({
    where: { id: input.leadId },
    data: {
      customerName: input.customerName?.trim() || undefined,
      customerPhone: input.customerPhone === undefined ? undefined : input.customerPhone.trim() || null,
      customerEmail: input.customerEmail === undefined ? undefined : input.customerEmail.trim() || null,
      serviceInterest: input.serviceInterest === undefined ? undefined : input.serviceInterest.trim() || null,
      segment: input.segment === undefined ? undefined : input.segment.trim() || null,
      priority: input.priority === undefined ? undefined : input.priority.trim() || "normal",
      tags: input.tags,
      budgetAmount: input.budgetAmount === undefined ? undefined : input.budgetAmount,
      followUpAt: input.followUpAt === undefined ? undefined : input.followUpAt ? new Date(input.followUpAt) : null,
      lastContactedAt: input.lastContactedAt === undefined ? undefined : input.lastContactedAt ? new Date(input.lastContactedAt) : null,
      notes: input.notes === undefined ? undefined : input.notes.trim() || null,
      conversationId: input.conversationId === undefined ? undefined : input.conversationId?.trim() || null,
      activityLogs: {
        create: {
          actorUserId: input.actorUserId ?? null,
          action: "LEAD_UPDATED",
          note: "Lead CRM fields updated.",
        },
      },
    },
  });
  return mapLead(lead);
}

export async function reassignSalesLead(input: { leadId: string; assignedAgentId: string; actorUserId?: string | null }) {
  const existing = await prisma.salesLeadAssignment.findUnique({ where: { id: input.leadId } });
  if (!existing) return null;

  const lead = await prisma.salesLeadAssignment.update({
    where: { id: input.leadId },
    data: {
      assignedAgentId: input.assignedAgentId,
      stage: existing.stage === "NEW" ? "ASSIGNED" : undefined,
      updatedAt: new Date(),
      activityLogs: {
        create: {
          actorUserId: input.actorUserId ?? null,
          action: "LEAD_REASSIGNED",
          note: "Lead reassigned from the CRM workspace.",
        },
      },
    },
  });

  await linkSalesLeadConversation(lead.id);
  void sendSalesLeadAssignmentPush(lead).catch(() => undefined);
  return mapLead(lead);
}

function mapStageToLeadStatus(stage: SalesLeadStage): string {
  switch (stage) {
    case "NEW":
    case "ASSIGNED":
      return "new";
    case "CONTACTED":
      return "contacted";
    case "INTERESTED":
    case "QUALIFIED":
      return "qualified";
    case "WEBINAR_INVITED":
    case "WEBINAR_ATTENDED":
      return "training-booked";
    case "FOLLOW_UP":
    case "NEGOTIATION":
      return "follow-up";
    case "CLOSED_WON":
    case "PAID":
    case "CLOSED":
      return "closed";
    case "CLOSED_LOST":
    case "LOST":
    case "NOT_REACHABLE":
    case "RECYCLED":
      return "lost";
    default:
      return "new";
  }
}

export async function updateSalesLeadStage(input: { leadId: string; stage: SalesLeadStage; note?: string; followUpAt?: string; actorUserId?: string | null }) {
  const lead = await prisma.salesLeadAssignment.update({
    where: { id: input.leadId },
    data: {
      stage: input.stage,
      lastContactedAt: input.stage === "CONTACTED" ? new Date() : undefined,
      followUpAt: input.followUpAt ? new Date(input.followUpAt) : undefined,
      activityLogs: {
        create: {
          actorUserId: input.actorUserId ?? null,
          action: input.stage,
          note: input.note?.trim() || null,
        },
      },
    },
    include: {
      assignedAgent: {
        include: {
          user: {
            select: { tenantId: true },
          },
        },
      },
    },
  });

  // Two-way synchronization with Chat workspace thread status
  const leadStatusId = mapStageToLeadStatus(input.stage);
  let targetConvId = lead.conversationId;
  if (targetConvId) {
    try {
      await prisma.appConversation.update({
        where: { id: targetConvId },
        data: {
          leadStatusId,
          updatedAt: new Date(),
        },
      });
    } catch {}
  } else if (lead.customerPhone) {
    const digits = lead.customerPhone.replace(/\D/g, "");
    if (digits.length >= 10) {
      const last10 = digits.slice(-10);
      const targetTenantId = lead.assignedAgent?.user?.tenantId || "tenant-gigxomi";
      const tenantWhere =
        targetTenantId === "tenant-gigxomi"
          ? {
              OR: [
                { tenantId: "tenant-gigxomi" },
                { tenantId: { startsWith: "tenant-gigxomi-sales-agent-" } },
              ],
            }
          : { tenantId: targetTenantId };
      try {
        const conv = await prisma.appConversation.findFirst({
          where: {
            customerPhone: { endsWith: last10 },
            ...tenantWhere,
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });
        if (conv) {
          targetConvId = conv.id;
          await prisma.appConversation.update({
            where: { id: conv.id },
            data: { leadStatusId, updatedAt: new Date() },
          });
          await prisma.salesLeadAssignment.update({
            where: { id: lead.id },
            data: { conversationId: conv.id },
          }).catch(() => undefined);
        }
      } catch {}
    }
  }

  // Synchronize to Meta CAPI & Realtime SSE on Kanban drag/drop
  if (targetConvId) {
    syncLeadStatusToMetaAndOutbox({
      conversationId: targetConvId,
      leadStatusId,
      notes: input.note,
      actorUserId: input.actorUserId ?? undefined,
    }).catch((err) => console.error("[sales-store] Meta CAPI sync error on stage change:", err));
  }

  return mapLead(lead);
}

function mapConversationLeadStatusToSalesStage(statusId: string | null | undefined): SalesLeadStage {
  switch (String(statusId ?? "").trim().toLowerCase()) {
    case "contacted":
      return "CONTACTED";
    case "qualified":
    case "interested":
      return "INTERESTED";
    case "training-booked":
    case "webinar-invited":
    case "webinar-attended":
      return "WEBINAR_INVITED";
    case "follow-up":
    case "follow-up needed":
      return "FOLLOW_UP";
    case "payment-pending":
      return "NEGOTIATION";
    case "closed":
    case "closed-won":
    case "paid":
      return "CLOSED_WON";
    case "lost":
    case "closed-lost":
      return "CLOSED_LOST";
    case "not-reachable":
      return "NOT_REACHABLE";
    default:
      return "NEW";
  }
}

function normalizeConversationPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : String(value ?? "").trim().toLowerCase();
}

function getConversationLeadSource(payload: unknown, sourceChannel?: string | null) {
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const explicit = String(record.source ?? record.leadSource ?? record.referralSource ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  const channel = String(sourceChannel ?? record.sourceChannel ?? "").trim().toLowerCase();
  if (channel === "instagram") return "instagram";
  if (channel === "whatsapp") return record.ctwa_clid || record.ctwaClid ? "meta_click_to_whatsapp" : "whatsapp";
  return "manual";
}

const tenantSyncPromises = new Map<string, Promise<void>>();
const tenantSyncTimes = new Map<string, number>();

async function syncConversationLeadsIntoSales(session: { userId?: string | null; role: AppRole | "GUEST"; tenantId?: string | null }) {
  if (!process.env.DATABASE_URL?.trim()) return;
  const effectiveTenantId = session.tenantId?.trim() || "tenant-gigxomi";
  const now = Date.now();
  const lastSyncAt = tenantSyncTimes.get(effectiveTenantId) || 0;
  const existingPromise = tenantSyncPromises.get(effectiveTenantId);
  if (existingPromise && now - lastSyncAt < 30_000) {
    return existingPromise;
  }
  tenantSyncTimes.set(effectiveTenantId, now);

  const syncPromise = (async () => {
    // STRICT TENANT ISOLATION: Closer CRM only ingests conversations from
    // the current tenant workspace. Legacy Gigxomi tenant also checks agent subtenants.
    const conversationTenantFilter =
      effectiveTenantId === "tenant-gigxomi"
        ? {
            OR: [
              { tenantId: "tenant-gigxomi" },
              { tenantId: { startsWith: "tenant-gigxomi-sales-agent-" } },
            ],
          }
        : { tenantId: effectiveTenantId };

    const [conversations, assignments, agents] = await Promise.all([
      prisma.appConversation.findMany({
        where: conversationTenantFilter,
        select: { id: true, customerName: true, customerPhone: true, leadStatusId: true, payload: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.salesLeadAssignment.findMany({
        where: {
          assignedAgent: {
            user: { tenantId: effectiveTenantId },
          },
        },
        select: { id: true, conversationId: true, customerPhone: true },
      }),
      prisma.salesAgentProfile.findMany({
        where: {
          status: "ACTIVE",
          user: { tenantId: effectiveTenantId },
        },
        select: { id: true, userId: true, canClaimLeads: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const currentAgentId = agents.find((agent) => agent.userId === session.userId)?.id;
    const fallbackAgentId = currentAgentId || agents.find((agent) => agent.canClaimLeads)?.id || agents[0]?.id;
    if (!fallbackAgentId) return;

    const byConversationId = new Map(assignments.filter((assignment) => assignment.conversationId).map((assignment) => [assignment.conversationId as string, assignment]));
    const byPhone = new Map<string, typeof assignments[number]>();
    for (const assignment of assignments) {
      const phone = normalizeConversationPhone(assignment.customerPhone);
      if (phone && !byPhone.has(phone)) byPhone.set(phone, assignment);
    }

    const updates: Array<ReturnType<typeof prisma.salesLeadAssignment.update>> = [];
    const creates: Prisma.SalesLeadAssignmentCreateManyInput[] = [];
    for (const conversation of conversations) {
      if (byConversationId.has(conversation.id)) continue;
      const phone = normalizeConversationPhone(conversation.customerPhone);
      const matchingAssignment = phone ? byPhone.get(phone) : undefined;
      if (matchingAssignment) {
        if (!matchingAssignment.conversationId) {
          updates.push(prisma.salesLeadAssignment.update({ where: { id: matchingAssignment.id }, data: { conversationId: conversation.id, updatedAt: conversation.updatedAt } }));
          byConversationId.set(conversation.id, { ...matchingAssignment, conversationId: conversation.id });
        }
        continue;
      }

      const record = conversation.payload && typeof conversation.payload === "object" && !Array.isArray(conversation.payload)
        ? (conversation.payload as Record<string, unknown>)
        : {};
      const sourceChannel = String(record.sourceChannel ?? "").trim();
      creates.push({
        id: `sales-conversation-${conversation.id}`,
        assignedAgentId: fallbackAgentId,
        createdById: session.userId ?? null,
        customerName: conversation.customerName || "WhatsApp Customer",
        customerPhone: conversation.customerPhone || null,
        customerEmail: typeof record.customerEmail === "string" ? record.customerEmail : null,
        source: getConversationLeadSource(conversation.payload, sourceChannel),
        serviceInterest: typeof record.serviceTitle === "string" ? record.serviceTitle : "Inbound enquiry",
        segment: sourceChannel || "inbound",
        priority: "normal",
        conversationId: conversation.id,
        stage: mapConversationLeadStatusToSalesStage(conversation.leadStatusId),
        notes: typeof record.internalNotes === "string" ? record.internalNotes : null,
      });
      byConversationId.set(conversation.id, { id: `pending:${conversation.id}`, conversationId: conversation.id, customerPhone: conversation.customerPhone });
      if (phone) byPhone.set(phone, { id: `pending:${conversation.id}`, conversationId: conversation.id, customerPhone: conversation.customerPhone });
    }

    if (creates.length) {
      await prisma.salesLeadAssignment.createMany({ data: creates, skipDuplicates: true });
    }
    if (updates.length) {
      await Promise.all(updates);
    }
  })().catch((error) => {
    console.error(`[sales-store] Conversation lead sync failed for tenant ${effectiveTenantId}:`, error);
  }).finally(() => {
    tenantSyncPromises.delete(effectiveTenantId);
  });

  tenantSyncPromises.set(effectiveTenantId, syncPromise);
  return syncPromise;
}

async function calculateCommission(input: {
  agent: Prisma.SalesAgentProfileGetPayload<{ include: { group: true } }>;
  paidAmount: number;
  packageId?: string | null;
  serviceId?: string | null;
}) {
  if (input.paidAmount <= 0) {
    return { ruleId: null, amount: 0, parentAmount: 0 };
  }

  // Freemium or Freelancer plans carry 0% referral commission
  if (input.packageId) {
    const pkg = await prisma.package.findUnique({ where: { id: input.packageId } });
    if (pkg) {
      const name = (pkg.name || "").toLowerCase();
      const slug = (pkg.slug || "").toLowerCase();
      const audience = (pkg.packageType || "").toLowerCase();
      if (
        name.includes("freemium") ||
        name.includes("freelancer") ||
        slug.includes("freemium") ||
        slug.includes("freelancer") ||
        audience === "freelancer"
      ) {
        return { ruleId: null, amount: 0, parentAmount: 0 };
      }
    }
  }

  const settings = await ensureSalesDefaults();
  const closerDirectRate = toNumber(settings.closerDirectCommissionPercent ?? 20);
  const closerSubRate = toNumber(settings.closerSubCommissionPercent ?? 10);
  const freelancerRate = toNumber(settings.freelancerCommissionPercent ?? 10);
  const agencyRate = toNumber(settings.agencyCommissionPercent ?? 10);

  const agentUser = await prisma.appAuthUser.findUnique({ where: { id: input.agent.userId } });
  const isFreelancer = (agentUser?.role as string) === "FREELANCER" || input.agent.groupId === "group-affiliate-freelancer";
  const isAgency = (agentUser?.role as string) === "AGENCY" || input.agent.groupId === "group-affiliate-agency";

  let baseRate: number;
  if (isFreelancer) {
    baseRate = freelancerRate;
  } else if (isAgency) {
    baseRate = agencyRate;
  } else {
    baseRate = input.agent.commissionPercent ? toNumber(input.agent.commissionPercent) : closerDirectRate;
  }

  const now = new Date();
  const rules = await prisma.salesCommissionRule.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  const rule =
    rules.find((item) => {
      if (item.id === "sales-rule-default-paid-package" || item.scope === "ALL_AGENTS") return false;
      if (item.minOrderValue !== null && input.paidAmount < toNumber(item.minOrderValue)) return false;
      if (item.maxOrderValue !== null && input.paidAmount > toNumber(item.maxOrderValue)) return false;
      if (item.scope === "AGENT_GROUP" && item.groupId !== input.agent.groupId) return false;
      if (item.scope === "INDIVIDUAL_AGENT" && item.agentId !== input.agent.id) return false;
      if (item.appliesTo === "PACKAGE" && item.packageId !== input.packageId) return false;
      if (item.appliesTo === "SERVICE" && item.serviceId !== input.serviceId) return false;
      return true;
    }) ?? null;

  const amount = rule
    ? rule.type === "FIXED"
      ? toNumber(rule.value)
      : (input.paidAmount * toNumber(rule.value)) / 100
    : (input.paidAmount * baseRate) / 100;

  let parentAmount = 0;
  if (input.agent.parentAgentId) {
    const parentRate = rule?.parentCommissionPercent
      ? toNumber(rule.parentCommissionPercent)
      : closerSubRate;
    parentAmount = (input.paidAmount * parentRate) / 100;
  }

  return {
    ruleId: rule?.id ?? null,
    amount: Math.round(amount * 100) / 100,
    parentAmount: Math.round(parentAmount * 100) / 100,
  };
}

export async function createSalesDeal(input: Partial<SalesDealView> & { assignmentId: string; agentId: string; title: string; agreedAmount: number }) {
  const paidAmount = Number(input.paidAmount ?? 0);
  const status = input.status ?? (paidAmount > 0 ? "PAID" : "DRAFT");
  const deal = await prisma.salesDeal.create({
    data: {
      assignmentId: input.assignmentId,
      agentId: input.agentId,
      title: input.title.trim(),
      packageId: input.packageId ?? null,
      serviceId: input.serviceId ?? null,
      quoteId: input.quoteId ?? null,
      referralCodeId: input.referralCodeId ?? null,
      paymentTransactionId: input.paymentTransactionId ?? null,
      agreedAmount: input.agreedAmount,
      paidAmount,
      status,
      paymentReference: input.paymentReference ?? null,
      handoffNotes: input.handoffNotes ?? null,
      closedAt: status === "PAID" ? new Date() : null,
    },
    include: { package: true, service: true },
  });
  if (status === "PAID") {
    await createEarningsForDeal(deal.id);
  }
  return mapDeal(deal);
}

export async function createEarningsForDeal(dealId: string) {
  const deal = await prisma.salesDeal.findUnique({
    where: { id: dealId },
    include: { agent: { include: { group: true } }, earnings: true },
  });
  if (!deal || deal.earnings.length || !["PAID", "HANDOFF", "CLOSED"].includes(deal.status)) return;
  const commission = await calculateCommission({
    agent: deal.agent,
    paidAmount: toNumber(deal.paidAmount),
    packageId: deal.packageId,
    serviceId: deal.serviceId,
  });
  const createdAt = new Date();
  const earnings: Prisma.SalesEarningCreateManyInput[] = [
    {
      dealId: deal.id,
      agentId: deal.agentId,
      ruleId: commission.ruleId,
      amount: commission.amount,
      parentAmount: commission.parentAmount,
      status: "APPROVED",
      approvedAt: createdAt,
    },
  ];
  if (deal.agent.parentAgentId && commission.parentAmount > 0) {
    earnings.push({
      dealId: deal.id,
      agentId: deal.agent.parentAgentId,
      ruleId: commission.ruleId,
      amount: commission.parentAmount,
      parentAmount: 0,
      status: "APPROVED",
      approvedAt: createdAt,
    });
  }
  await prisma.salesEarning.createMany({ data: earnings });
}

export async function saveCommissionRule(input: Partial<Prisma.SalesCommissionRuleUncheckedCreateInput> & { name: string; type: SalesCommissionRuleType; value: number }) {
  await ensureSalesDefaults();
  const data = {
    name: input.name.trim(),
    type: input.type,
    scope: (input.scope ?? "ALL_AGENTS") as SalesCommissionScope,
    appliesTo: (input.appliesTo ?? "ALL_PACKAGES") as SalesCommissionAppliesTo,
    groupId: input.groupId ?? null,
    agentId: input.agentId ?? null,
    packageId: input.packageId ?? null,
    serviceId: input.serviceId ?? null,
    value: input.value,
    parentCommissionPercent: input.parentCommissionPercent ?? null,
    minOrderValue: input.minOrderValue ?? null,
    maxOrderValue: input.maxOrderValue ?? null,
    priority: Number(input.priority ?? 0),
    isActive: input.isActive ?? true,
  };
  return input.id
    ? prisma.salesCommissionRule.update({ where: { id: input.id }, data })
    : prisma.salesCommissionRule.create({ data });
}

export async function requestSalesPayout(input: { agentId: string; amount: number; note?: string }) {
  const settings = await ensureSalesDefaults();
  const minimum = toNumber(settings.payoutMinimum);
  if (input.amount < minimum) throw new Error(`Minimum payout is ${minimum}.`);
  const earnings = await prisma.salesEarning.findMany({
    where: { agentId: input.agentId, status: "APPROVED", payoutId: null },
    orderBy: { createdAt: "asc" },
  });
  const available = earnings.reduce((sum, item) => sum + toNumber(item.amount), 0);
  if (input.amount > available) throw new Error("Requested payout is higher than available approved earnings.");
  const payout = await prisma.salesPayout.create({
    data: { agentId: input.agentId, amount: input.amount, note: input.note?.trim() || null },
  });
  let remaining = input.amount;
  for (const earning of earnings) {
    if (remaining <= 0) break;
    await prisma.salesEarning.update({ where: { id: earning.id }, data: { payoutId: payout.id } });
    remaining -= toNumber(earning.amount);
  }
  return mapPayout(payout);
}

export async function updateSalesPayoutStatus(input: { payoutId: string; status: SalesPayoutStatus; note?: string }) {
  const now = new Date();
  const payout = await prisma.salesPayout.update({
    where: { id: input.payoutId },
    data: {
      status: input.status,
      note: input.note?.trim() || undefined,
      approvedAt: input.status === "APPROVED" ? now : undefined,
      paidAt: input.status === "PAID" ? now : undefined,
      earnings: input.status === "PAID" ? { updateMany: { where: { payoutId: input.payoutId }, data: { status: "PAID", paidAt: now } } } : undefined,
    },
  });
  if (input.status === "REJECTED") {
    await prisma.salesEarning.updateMany({ where: { payoutId: payout.id, status: "APPROVED" }, data: { payoutId: null } });
  }
  return mapPayout(payout);
}

export async function saveSalesPayoutInfo(input: { agentId: string; payoutInfo: Record<string, unknown> }) {
  const updated = await prisma.salesAgentProfile.update({
    where: { id: input.agentId },
    data: { payoutInfo: input.payoutInfo as Prisma.InputJsonObject },
    include: { user: true },
  });
  return mapAgent(updated);
}

export async function createSalesMessage(input: { agentId?: string | null; subject: string; body: string; author: string }) {
  const now = new Date().toISOString();
  return prisma.salesMessageThread.create({
    data: {
      agentId: input.agentId ?? null,
      subject: input.subject.trim(),
      messages: [{ author: input.author, body: input.body.trim(), createdAt: now }],
      status: "open",
    },
  });
}

export async function replySalesMessage(input: { threadId: string; body: string; author: string; close?: boolean }) {
  const thread = await prisma.salesMessageThread.findUnique({ where: { id: input.threadId } });
  if (!thread) throw new Error("Message thread not found.");
  const messages = readJsonMessages(thread.messages);
  messages.push({ author: input.author, body: input.body.trim(), createdAt: new Date().toISOString() });
  return prisma.salesMessageThread.update({
    where: { id: input.threadId },
    data: { messages, status: input.close ? "closed" : thread.status },
  });
}

export async function saveSalesAnnouncement(input: { title: string; body: string; audience?: string; isActive?: boolean }) {
  return prisma.salesAnnouncement.create({
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      audience: input.audience?.trim() || "all",
      isActive: input.isActive ?? true,
    },
  });
}

export async function saveSalesGoal(input: {
  id?: string;
  name: string;
  metric: SalesGoalMetric;
  scope?: SalesGoalScope;
  agentId?: string | null;
  groupId?: string | null;
  target: number;
  rewardText?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isPinned?: boolean;
  isActive?: boolean;
}) {
  await ensureSalesDefaults();
  const data = {
    name: input.name.trim(),
    metric: input.metric,
    scope: input.scope ?? "INDIVIDUAL_AGENT",
    agentId: input.agentId?.trim() || null,
    groupId: input.groupId?.trim() || null,
    target: Math.max(Number(input.target ?? 0), 1),
    rewardText: input.rewardText?.trim() || null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    isPinned: input.isPinned ?? true,
    isActive: input.isActive ?? true,
  };
  if (!data.name) throw new Error("Goal name is required.");
  return input.id
    ? prisma.salesGoal.update({ where: { id: input.id }, data })
    : prisma.salesGoal.create({ data });
}

export async function saveSalesReward(input: {
  id?: string;
  title: string;
  body: string;
  agentId?: string | null;
  groupId?: string | null;
  isPinned?: boolean;
  isActive?: boolean;
}) {
  await ensureSalesDefaults();
  const data = {
    title: input.title.trim(),
    body: input.body.trim(),
    agentId: input.agentId?.trim() || null,
    groupId: input.groupId?.trim() || null,
    isPinned: input.isPinned ?? true,
    isActive: input.isActive ?? true,
  };
  if (!data.title || !data.body) throw new Error("Reward title and body are required.");
  return input.id
    ? prisma.salesReward.update({ where: { id: input.id }, data })
    : prisma.salesReward.create({ data });
}

function findStringDeep(value: unknown, keys: string[]): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }
  for (const nested of Object.values(record)) {
    const found = findStringDeep(nested, keys);
    if (found) return found;
  }
  return "";
}

export async function processSalesPaymentSuccess(transactionId: string) {
  await ensureSalesDefaults();
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
    include: { user: true, package: true, salesDeal: true },
  });
  if (!transaction || transaction.status !== "SUCCESS" || transaction.salesDeal) {
    return { ok: true as const, skipped: true };
  }
  const rawCode =
    findStringDeep(transaction.rawRequest, ["salesReferralCode", "referralCode", "ref"]) ||
    findStringDeep(transaction.rawResponse, ["salesReferralCode", "referralCode", "ref"]);
  const attributionEvent = !rawCode
    ? await prisma.salesReferralEvent.findFirst({
        where: {
          OR: [
            { paymentTransactionId: transaction.id },
            { userId: transaction.userId, packageId: transaction.packageId },
          ],
          eventType: { in: ["PAYMENT_STARTED", "SIGNUP_VERIFIED", "SIGNUP_STARTED", "PRICING_VIEW"] },
        },
        orderBy: { createdAt: "desc" },
        include: { referralCode: { include: { agent: { include: { user: true, group: true } } } } },
      })
    : null;
  const referral = rawCode ? await findActiveReferralCode(rawCode) : attributionEvent?.referralCode ?? null;
  if (!referral) {
    return { ok: true as const, skipped: true };
  }
  await trackSalesReferralEvent({
    code: referral.code,
    eventType: "PAYMENT_SUCCESS",
    packageId: transaction.packageId,
    userId: transaction.userId,
    paymentTransactionId: transaction.id,
    eventKey: `payment-success:${transaction.id}`,
    metadata: { amount: toNumber(transaction.amount), provider: transaction.provider },
  });
  const lead = await prisma.salesLeadAssignment.create({
    data: {
      assignedAgentId: referral.agentId,
      customerName: transaction.user.displayName,
      customerPhone: transaction.user.phone,
      customerEmail: transaction.user.email,
      source: "referral",
      serviceInterest: transaction.package.name,
      segment: transaction.package.packageType.toLowerCase(),
      priority: "hot",
      budgetAmount: transaction.amount,
      stage: "PAID",
      notes: `Auto-created from paid package transaction ${transaction.merchantTransactionId ?? transaction.id}.`,
    },
  });
  const deal = await prisma.salesDeal.create({
    data: {
      assignmentId: lead.id,
      agentId: referral.agentId,
      packageId: transaction.packageId,
      referralCodeId: referral.id,
      paymentTransactionId: transaction.id,
      title: `${transaction.package.name} package sale`,
      agreedAmount: transaction.amount,
      paidAmount: transaction.amount,
      status: "PAID",
      paymentReference: transaction.merchantTransactionId ?? transaction.merchantOrderId ?? transaction.id,
      closedAt: transaction.paidAt ?? new Date(),
      handoffNotes: "Created from referral-tracked package payment.",
    },
  });
  await createEarningsForDeal(deal.id);
  await trackSalesReferralEvent({
    code: referral.code,
    eventType: "DEAL_CREATED",
    packageId: transaction.packageId,
    userId: transaction.userId,
    paymentTransactionId: transaction.id,
    dealId: deal.id,
    eventKey: `deal-created:${deal.id}`,
    metadata: { amount: toNumber(transaction.amount), title: deal.title },
  });
  return { ok: true as const, dealId: deal.id };
}


export async function getFreelancerReferralOverview(userId: string) {
  const settings = await ensureSalesDefaults();
  const { profile, refCode } = await ensureAffiliateProfile(userId);

  // Find ALL active referral codes for this agent
  const allCodes = await prisma.salesReferralCode.findMany({
    where: {
      OR: [
        { agentId: profile.id },
        ...(userId === "user-freelancer" ? [{ code: "creator" }] : []),
      ],
    },
    select: { id: true },
  });
  const codeIds = Array.from(new Set([refCode.id, ...allCodes.map((c) => c.id)]));

  const [clicks, signups, earnings, payouts, deals] = await Promise.all([
    prisma.salesReferralEvent.count({
      where: {
        OR: [
          { referralCodeId: { in: codeIds } },
          { agentId: profile.id },
        ],
        eventType: "PRICING_VIEW",
      },
    }),
    prisma.salesReferralEvent.count({
      where: {
        OR: [
          { referralCodeId: { in: codeIds } },
          { agentId: profile.id },
        ],
        eventType: { in: ["SIGNUP_STARTED", "SIGNUP_VERIFIED"] },
      },
    }),
    prisma.salesEarning.findMany({
      where: { agentId: profile.id },
      include: { deal: { include: { package: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.salesPayout.findMany({
      where: { agentId: profile.id },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.salesDeal.findMany({
      where: { agentId: profile.id },
      include: { package: true, assignment: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const holdDays = settings.payoutHoldDays ?? 7;
  const holdCutoff = new Date(Date.now() - holdDays * 24 * 60 * 60 * 1000);

  let availableBalance = 0;
  let pendingHold = 0;
  for (const earn of earnings) {
    if (earn.status === "APPROVED" && !earn.payoutId) {
      const earnAmount = toNumber(earn.amount);
      if (earn.createdAt < holdCutoff) {
        availableBalance += earnAmount;
      } else {
        pendingHold += earnAmount;
      }
    }
  }

  let totalWithdrawn = 0;
  for (const payout of payouts) {
    if (payout.status === "PAID") {
      totalWithdrawn += toNumber(payout.amount);
    }
  }

  const entries = deals.map((deal) => {
    const earn = earnings.find((e) => e.dealId === deal.id);
    const commVal = earn ? toNumber(earn.amount) : 0;
    const pkgName = deal.package?.name || "Premium Plan";
    const planType = pkgName.toLowerCase().includes("premium") ? ("Premium" as const) : ("Free" as const);
    return {
      id: deal.id,
      customerName: deal.assignment?.customerName || "Referred Customer",
      customerContact: deal.assignment?.customerPhone || deal.assignment?.customerEmail || "Verified Account",
      date: deal.createdAt.toISOString().split("T")[0],
      product: pkgName,
      planType,
      amount: `₹${toNumber(deal.paidAmount).toLocaleString("en-IN")}`,
      commission: `₹${commVal.toLocaleString("en-IN")}`,
      commValue: commVal,
      status: deal.status === "PAID" ? ("Active" as const) : ("Pending" as const),
    };
  });

  const conversionRate = clicks > 0 ? `${((deals.length / clicks) * 100).toFixed(1)}%` : "0.0%";

  return {
    ok: true as const,
    code: refCode.code,
    websiteUrl: `https://www.gigxomi.com/?ref=${encodeURIComponent(refCode.code)}`,
    androidAppUrl: `https://www.gigxomi.com/go/app?ref=${encodeURIComponent(refCode.code)}`,
    clicks,
    signups,
    conversionRate,
    commissionPercent: toNumber(settings.freelancerCommissionPercent ?? 10),
    commissionRate: `${toNumber(settings.freelancerCommissionPercent ?? 10)}% on Premium`,
    availableBalance: Math.round(availableBalance),
    pendingHold: Math.round(pendingHold),
    totalWithdrawn: Math.round(totalWithdrawn),
    totalEarned: Math.round(availableBalance + pendingHold + totalWithdrawn),
    minPayout: toNumber(settings.payoutMinimum ?? 500),
    holdDays,
    entries,
  };
}

export async function intakeSalesLead(input: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  businessName?: string;
  source?: string;
  message?: string;
  priority?: string;
  tags?: string[];
}) {
  await ensureSalesDefaults();
  const phone = input.customerPhone.trim();
  const name = input.customerName.trim();
  const business = input.businessName?.trim();
  const serviceInterest = business ? `${business} (Agency Demo)` : "Agency Demo Request";
  const notes = [
    business ? `Business / Agency: ${business}` : "",
    `Contact Phone: ${phone}`,
    input.customerEmail?.trim() ? `Email: ${input.customerEmail.trim()}` : "",
    input.message?.trim() ? `Message: ${input.message.trim()}` : "",
    `Intake Source: ${input.source || "Website Demo Form"}`,
  ].filter(Boolean).join("\n");

  const tags =
    input.tags && input.tags.length > 0
      ? input.tags
      : (input.source?.toLowerCase().includes("franchise")
          ? ["digital_franchise_lead", "territory_checked", "source_ai_bot"]
          : []);

  // 1. Create the persistent lead pool item
  const poolItem = await prisma.salesLeadPoolItem.create({
    data: {
      customerName: name,
      customerPhone: phone,
      customerEmail: input.customerEmail?.trim() || null,
      source: input.source || "website_demo_form",
      serviceInterest,
      segment: "DEMO_REQUEST",
      priority: input.priority || "hot",
      notes,
      status: "OPEN",
    },
  });

  // 2. Query active sales agents who can handle leads
  const agents = await prisma.salesAgentProfile.findMany({
    where: { status: "ACTIVE", canClaimLeads: true },
    include: {
      leadAssignments: {
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Pick agent with fewest leads assigned today for fair workload distribution
  const selectedAgent = agents.length > 0
    ? [...agents].sort((a, b) => a.leadAssignments.length - b.leadAssignments.length)[0]
    : null;

  if (selectedAgent) {
    try {
      const assignment = await prisma.salesLeadAssignment.create({
        data: {
          assignedAgentId: selectedAgent.id,
          customerName: name,
          customerPhone: phone,
          customerEmail: input.customerEmail?.trim() || null,
          source: input.source || "website_demo_form",
          serviceInterest,
          segment: "DEMO_REQUEST",
          priority: input.priority || "hot",
          tags,
          stage: "NEW",
          notes,
          activityLogs: {
            create: {
              action: "AUTO_ASSIGNED",
              note: `Demo lead auto-assigned from website intake to ${selectedAgent.agentCode || "closer desk"}.`,
            },
          },
        },
      });

      // Update pool item to CLAIMED and link to assignment
      await prisma.salesLeadPoolItem.update({
        where: { id: poolItem.id },
        data: {
          convertedAssignmentId: assignment.id,
          claimedByAgentId: selectedAgent.id,
          claimedAt: new Date(),
          status: "CLAIMED",
        },
      });

      // Link any existing conversation with this customer phone
      await linkSalesLeadConversation(assignment.id);

      // Trigger mobile push notification to assigned sales agent
      const linkedAssignment = await prisma.salesLeadAssignment.findUnique({ where: { id: assignment.id } });
      void sendSalesLeadAssignmentPush(linkedAssignment ?? assignment).catch(() => undefined);

      return {
        assigned: true,
        agentId: selectedAgent.id,
        leadId: assignment.id,
        poolItemId: poolItem.id,
      };
    } catch (assignError) {
      console.error("[intakeSalesLead] Auto-assignment failed, lead kept in open queue:", assignError);
    }
  }

  return {
    assigned: false,
    agentId: null,
    leadId: poolItem.id,
    poolItemId: poolItem.id,
  };
}

export async function provisionSaaSCloserWorkspace(input: {
  companyName: string;
  displayName: string;
  email: string;
  phone: string;
  password: string;
}) {
  await ensureAuthStoreReady();
  await ensureSalesDefaults();

  const companyName = input.companyName.trim();
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  const rawPhone = input.phone.trim();
  const password = input.password.trim();

  if (!companyName) {
    return { ok: false as const, error: "Company or workspace name is required." };
  }
  if (!displayName || !email || !rawPhone || !password) {
    return { ok: false as const, error: "Name, email, phone, and password are required." };
  }
  if (!email.includes("@")) {
    return { ok: false as const, error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }

  const baseSlug =
    companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  const tenantSuffix = randomBytes(4).toString("hex");
  const tenantId = `tenant-${baseSlug}-${tenantSuffix}`;
  const groupId = `group-${tenantId}`;

  try {
    return await prisma.$transaction(async (transaction) => {
      // 1. Create dedicated SalesAgentGroup for this workspace
      const group = await transaction.salesAgentGroup.create({
        data: {
          id: groupId,
          name: `${companyName} Sales Team`,
          description: `Dedicated sales workspace for ${companyName}`,
          defaultCommissionPercent: 10,
          parentCommissionPercent: 2,
          isActive: true,
        },
      });

      // 2. Create the user with their isolated tenantId
      const createdUser = await createInternalUser(
        {
          // Every new SaaS workspace starts with its signup owner as the
          // workspace administrator. Additional closers/managers are created
          // later from Team & Users according to the active plan's seats.
          role: "ADMIN",
          displayName,
          email,
          phone: rawPhone,
          password,
          tenantId,
        },
        { transaction, skipBootstrap: true },
      );

      if (!createdUser.ok) {
        throw new Error(createdUser.error);
      }

      // 3. Create SalesAgentProfile as workspace owner/admin
      const code = await generateAgentCode(displayName, transaction);
      const agent = await transaction.salesAgentProfile.create({
        data: {
          userId: createdUser.user.id,
          groupId: group.id,
          agentCode: code,
          status: "ACTIVE",
          canCreateSubAgents: true,
          canClaimLeads: true,
          maxActiveLeads: 50,
          permissions: {
            workspaceAdmin: true,
            isWorkspaceOwner: true,
            companyName,
          },
          referralCodes: {
            create: {
              code,
              label: "Default sales referral link",
            },
          },
        },
        include: { user: true },
      });

      return {
        ok: true as const,
        user: createdUser.user,
        agent: mapAgent(agent),
        workspace: {
          tenantId,
          companyName,
          groupId: group.id,
        },
      };
    });
  } catch (error: unknown) {
    console.error("[provisionSaaSCloserWorkspace] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to provision workspace.";
    return { ok: false as const, error: message };
  }
}


