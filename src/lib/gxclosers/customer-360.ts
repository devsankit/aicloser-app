import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The closer can be connected to a server that has the core CRM schema but is
 * still waiting for the optional Gx journey migration. Customer 360 should
 * continue showing the lead and app account in that state instead of turning
 * the whole drawer into a 500 response.
 */
async function optionalQuery<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch {
    return fallback;
  }
}

function normalizedPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function contactConditions(email: string | null | undefined, phone: string | null | undefined) {
  const conditions: Array<Record<string, unknown>> = [];
  const normalizedEmail = email?.trim().toLowerCase();
  const normalized = normalizedPhone(phone);
  if (normalizedEmail) conditions.push({ email: { equals: normalizedEmail, mode: "insensitive" } });
  if (normalized) conditions.push({ phone: { endsWith: normalized } });
  return conditions;
}

function registrationConditions(email: string | null | undefined, phone: string | null | undefined) {
  const conditions: Array<Record<string, unknown>> = [];
  const normalizedEmail = email?.trim().toLowerCase();
  const normalized = normalizedPhone(phone);
  if (normalizedEmail) conditions.push({ email: { equals: normalizedEmail, mode: "insensitive" } });
  if (normalized) conditions.push({ whatsappNumber: { endsWith: normalized } });
  return conditions;
}

export async function getGxCustomer360(salesLeadId: string) {
  const lead = await prisma.salesLeadAssignment.findUnique({
    where: { id: salesLeadId },
    select: {
      assignedAgentId: true,
      budgetAmount: true,
      conversationId: true,
      createdAt: true,
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      followUpAt: true,
      id: true,
      lastContactedAt: true,
      notes: true,
      priority: true,
      segment: true,
      serviceInterest: true,
      source: true,
      stage: true,
      tags: true,
      updatedAt: true,
    },
  });
  if (!lead) return null;

  const activeLink = await optionalQuery(prisma.gxLeadIdentityLink.findFirst({
    where: { isActive: true, salesLeadId },
    orderBy: { verifiedAt: "desc" },
  }), null);
  const userConditions = contactConditions(lead.customerEmail, lead.customerPhone);
  const candidateUsers = activeLink
    ? await optionalQuery(prisma.appAuthUser.findMany({ where: { id: activeLink.appUserId }, take: 1 }), [])
    : userConditions.length
      ? await optionalQuery(prisma.appAuthUser.findMany({ where: { OR: userConditions }, take: 3 }), [])
      : [];
  const uniqueUserIds = [...new Set(candidateUsers.map((user) => user.id))];
  const appUserId = activeLink?.appUserId ?? (uniqueUserIds.length === 1 ? uniqueUserIds[0] : null);
  const identityStatus = activeLink ? activeLink.conflictStatus === "NONE" ? "LINKED" : "CONFLICT" : uniqueUserIds.length > 1 ? "CONFLICT" : appUserId ? "MATCHED_NOT_LINKED" : "UNRESOLVED";

  const webinarWhere = registrationConditions(lead.customerEmail, lead.customerPhone);
  const webinars = webinarWhere.length
    ? await optionalQuery(prisma.gappWebinarRegistration.findMany({
        where: { OR: webinarWhere },
        include: {
          payments: { orderBy: { createdAt: "desc" }, select: { paidAt: true, status: true }, take: 1 },
          webinar: { select: { id: true, scheduledAt: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }), [])
    : [];
  const registrationIds = webinars.map((registration) => registration.id);
  const eventConditions: Array<Record<string, unknown>> = [{ salesLeadId }];
  if (appUserId) eventConditions.push({ appUserId });
  if (registrationIds.length) eventConditions.push({ webinarRegistrationId: { in: registrationIds } });

  const [calls, deals, journeyEvents, journeySnapshots, learning, notifications, onboarding, salesTimeline, subscriptions, tasks, activityLogs] = await Promise.all([
    optionalQuery(prisma.salesMobileCall.findMany({ where: { assignmentId: salesLeadId }, orderBy: { startedAt: "desc" }, take: 100 }), []),
    optionalQuery(prisma.salesDeal.findMany({ where: { assignmentId: salesLeadId }, orderBy: { createdAt: "desc" }, take: 50 }), []),
    optionalQuery(prisma.gxJourneyEvent.findMany({ where: { OR: eventConditions }, orderBy: { occurredAt: "desc" }, take: 250 }), []),
    optionalQuery(prisma.gxJourneySnapshot.findMany({
      where: { OR: [{ salesLeadId }, ...(appUserId ? [{ appUserId }] : []), ...(registrationIds.length ? [{ subjectId: { in: registrationIds } }] : [])] },
      orderBy: { lastEventAt: "desc" },
      take: 50,
    }), []),
    appUserId ? optionalQuery(prisma.learningWatchSession.findMany({ where: { userId: appUserId }, orderBy: { lastHeartbeatAt: "desc" }, take: 100 }), []) : Promise.resolve([]),
    appUserId ? optionalQuery(prisma.appNotification.findMany({ where: { userId: appUserId }, orderBy: { createdAt: "desc" }, take: 100 }), []) : Promise.resolve([]),
    appUserId ? optionalQuery(prisma.connectedOnboardingState.findUnique({ where: { userId: appUserId } }), null) : Promise.resolve(null),
    optionalQuery(prisma.salesLeadTimelineEntry.findMany({ where: { leadId: salesLeadId }, orderBy: { createdAt: "desc" }, take: 250 }), []),
    appUserId ? optionalQuery(prisma.userSubscription.findMany({ where: { userId: appUserId }, orderBy: { createdAt: "desc" }, take: 20 }), []) : Promise.resolve([]),
    optionalQuery(prisma.gxLeadTask.findMany({ where: { salesLeadId }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 100 }), []),
    optionalQuery(prisma.salesActivityLog.findMany({ where: { assignmentId: salesLeadId }, orderBy: { createdAt: "desc" }, take: 250 }), []),
  ]);

  const timeline = [
    ...journeyEvents.map((event) => ({ id: event.id, at: event.occurredAt, type: "JOURNEY", title: event.eventType, detail: event.source, metadata: event.metadata })),
    ...salesTimeline.map((entry) => ({ id: entry.id, at: entry.createdAt, type: "SALES", title: entry.type, detail: entry.body, metadata: entry.metadata })),
    ...activityLogs.map((entry) => ({ id: entry.id, at: entry.createdAt, type: "SALES_ACTIVITY", title: entry.action, detail: entry.note, metadata: entry.metadata })),
    ...calls.map((call) => ({ id: call.id, at: call.startedAt, type: "CALL", title: call.outcome || call.status, detail: call.note, metadata: { durationSeconds: call.durationSeconds, recordingStatus: call.recordingStatus } })),
    ...tasks.map((task) => ({ id: task.id, at: task.createdAt, type: "TASK", title: task.title, detail: task.description, metadata: { dueAt: task.dueAt, priority: task.priority, status: task.status } })),
  ]
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, 400)
    .map((entry) => ({ ...entry, at: entry.at.toISOString() }));
  const importedActivity = activityLogs.find((entry) => entry.action === "LEAD_IMPORTED");
  const stageHistory = activityLogs
    .filter((entry) => ["NEW", "CONTACTED", "INTERESTED", "WEBINAR_INVITED", "WEBINAR_ATTENDED", "CLOSED_WON", "CLOSED_LOST", "FOLLOW_UP"].includes(entry.action))
    .map((entry) => ({ action: entry.action, at: entry.createdAt.toISOString(), note: entry.note, metadata: entry.metadata }));

  return {
    app: appUserId
      ? {
          onboarding: onboarding ? { audience: onboarding.audience, completedAt: onboarding.completedAt?.toISOString() ?? null, stage: onboarding.stage, updatedAt: onboarding.updatedAt.toISOString() } : null,
          user: candidateUsers.find((user) => user.id === appUserId)
              ? {
                createdAt: candidateUsers.find((user) => user.id === appUserId)!.createdAt.toISOString(),
                displayName: candidateUsers.find((user) => user.id === appUserId)!.displayName,
                email: candidateUsers.find((user) => user.id === appUserId)!.email,
                phone: candidateUsers.find((user) => user.id === appUserId)!.phone,
                packageAudience: candidateUsers.find((user) => user.id === appUserId)!.packageAudience,
                packageName: candidateUsers.find((user) => user.id === appUserId)!.packageName,
                packageStatus: candidateUsers.find((user) => user.id === appUserId)!.packageStatus,
                role: candidateUsers.find((user) => user.id === appUserId)!.role,
                userId: appUserId,
                workspaceMode: candidateUsers.find((user) => user.id === appUserId)!.workspaceMode,
              }
            : null,
        }
      : null,
    attribution: journeySnapshots.map((snapshot) => ({ firstTouch: snapshot.firstTouch, lastTouch: snapshot.lastTouch, subjectId: snapshot.subjectId, subjectType: snapshot.subjectType })),
    calls: calls.map((call) => ({
      connectedAt: call.connectedAt?.toISOString() ?? null,
      direction: call.direction,
      durationSeconds: call.durationSeconds,
      endedAt: call.endedAt?.toISOString() ?? null,
      hasRecording: call.recordingStatus === "UPLOADED",
      id: call.id,
      nextFollowUpAt: call.nextFollowUpAt?.toISOString() ?? null,
      note: call.note,
      outcome: call.outcome,
      recordingStatus: call.recordingStatus,
      startedAt: call.startedAt.toISOString(),
      status: call.status,
    })),
    deals: deals.map((deal) => ({ agreedAmount: Number(deal.agreedAmount), createdAt: deal.createdAt.toISOString(), id: deal.id, paidAmount: Number(deal.paidAmount), status: deal.status, updatedAt: deal.updatedAt.toISOString() })),
    identity: { appUserId, method: activeLink?.method ?? null, status: identityStatus, verifiedAt: activeLink?.verifiedAt.toISOString() ?? null },
    journey: {
      snapshots: journeySnapshots.map((snapshot) => ({ commercialState: snapshot.commercialState, engagementState: snapshot.engagementState, identityStatus: snapshot.identityStatus, lastEventAt: snapshot.lastEventAt?.toISOString() ?? null, lifecycleStage: snapshot.lifecycleStage, subjectId: snapshot.subjectId, subjectType: snapshot.subjectType })),
    },
    lead: {
      ...lead,
      budgetAmount: Number(lead.budgetAmount ?? 0),
      createdAt: lead.createdAt.toISOString(),
      followUpAt: lead.followUpAt?.toISOString() ?? null,
      lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
      updatedAt: lead.updatedAt.toISOString(),
    },
    learning: learning.map((session) => ({ activeWatchedSeconds: session.activeWatchedSeconds, completedAt: session.completedAt?.toISOString() ?? null, courseId: session.courseId, durationSeconds: session.durationSeconds, lastHeartbeatAt: session.lastHeartbeatAt.toISOString(), lastPositionSeconds: session.lastPositionSeconds, lessonId: session.lessonId, progressPercent: session.durationSeconds > 0 ? Math.min(100, Math.round((session.activeWatchedSeconds / session.durationSeconds) * 100)) : 0, sessionId: session.id })),
    notificationSummary: {
      sent: notifications.length,
      unread: notifications.filter((notification) => notification.status === "UNREAD").length,
    },
    subscriptions: subscriptions.map((subscription) => ({ amount: Number(subscription.amount), autoRenew: subscription.autoRenew, createdAt: subscription.createdAt.toISOString(), expiresAt: subscription.expiresAt?.toISOString() ?? null, id: subscription.id, startsAt: subscription.startsAt?.toISOString() ?? null, status: subscription.status })),
    sourceContext: {
      imported: importedActivity ? { at: importedActivity.createdAt.toISOString(), note: importedActivity.note, metadata: importedActivity.metadata } : null,
      stageHistory,
    },
    tasks: tasks.map((task) => ({ ...task, completedAt: task.completedAt?.toISOString() ?? null, createdAt: task.createdAt.toISOString(), dueAt: task.dueAt.toISOString(), updatedAt: task.updatedAt.toISOString() })),
    timeline,
    webinars: webinars.map((registration) => ({ attribution: registration.attribution, createdAt: registration.createdAt.toISOString(), currentMonthlyProjects: registration.currentMonthlyProjects, id: registration.id, participantType: registration.participantType, paymentStatus: registration.payments[0]?.status ?? null, scheduledAt: registration.webinar.scheduledAt.toISOString(), status: registration.status, title: registration.webinar.title })),
  };
}

export async function createGxLeadTask(input: { createdById: string; description?: string; dueAt: Date; priority?: string; salesLeadId: string; title: string }) {
  const lead = await prisma.salesLeadAssignment.findUnique({ where: { id: input.salesLeadId }, select: { assignedAgentId: true } });
  if (!lead) throw new Error("Lead not found.");
  const task = await prisma.gxLeadTask.create({
    data: {
      createdById: input.createdById,
      description: input.description?.trim().slice(0, 2_000) || null,
      dueAt: input.dueAt,
      ownerAgentId: lead.assignedAgentId,
      priority: input.priority || "NORMAL",
      salesLeadId: input.salesLeadId,
      title: input.title.trim().slice(0, 160),
    },
  });
  await prisma.$transaction([
    prisma.salesLeadAssignment.update({ where: { id: input.salesLeadId }, data: { followUpAt: input.dueAt } }),
    prisma.salesLeadTimelineEntry.create({ data: { agentId: lead.assignedAgentId, body: `Follow-up scheduled: ${task.title}`, leadId: input.salesLeadId, metadata: { dueAt: input.dueAt.toISOString(), taskId: task.id }, type: "FOLLOW_UP_TASK" } }),
  ]);
  return task;
}

export async function updateGxLeadTask(input: { salesLeadId: string; status: "CANCELLED" | "DONE" | "OPEN"; taskId: string; userId: string }) {
  const task = await prisma.gxLeadTask.findFirst({ where: { id: input.taskId, salesLeadId: input.salesLeadId } });
  if (!task) return null;
  const updated = await prisma.gxLeadTask.update({
    where: { id: task.id },
    data: { completedAt: input.status === "DONE" ? new Date() : null, status: input.status },
  });
  await prisma.salesLeadTimelineEntry.create({
    data: { body: `Task ${input.status.toLowerCase()}: ${task.title}`, leadId: input.salesLeadId, metadata: { taskId: task.id }, type: "FOLLOW_UP_TASK", userId: input.userId },
  });
  return updated;
}

export async function getGxCustomer360ForConversation(conversationId: string, customerPhone?: string | null) {
  // 1. Find salesLeadAssignment by conversationId
  let lead = await prisma.salesLeadAssignment.findFirst({
    where: { conversationId },
    select: { id: true },
  });

  // 2. If not found by conversationId and phone provided, try by phone
  const normalized = normalizedPhone(customerPhone);
  if (!lead && normalized) {
    lead = await prisma.salesLeadAssignment.findFirst({
      where: { customerPhone: { endsWith: normalized } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (lead) {
      await prisma.salesLeadAssignment.update({
        where: { id: lead.id },
        data: { conversationId },
      }).catch(() => undefined);
    }
  }

  if (lead) {
    return getGxCustomer360(lead.id);
  }

  // 3. Fallback if no salesLeadAssignment exists: check calls matching phone
  if (normalized) {
    const calls = await prisma.salesMobileCall.findMany({
      where: { phoneNumber: { endsWith: normalized } },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    return {
      app: null,
      identity: { appUserId: null, method: null, status: "UNRESOLVED", verifiedAt: null },
      journey: { snapshots: [] },
      lead: null,
      calls,
      deals: [],
      salesTimeline: [],
      tasks: [],
      webinars: [],
      journeyEvents: [],
      identityStatus: "UNRESOLVED" as const,
      notifications: [],
      learning: [],
      notificationSummary: { sent: 0, unread: 0 },
      subscriptions: [],
      sourceContext: { imported: null, stageHistory: [] },
      onboarding: null,
    };
  }

  return null;
}
