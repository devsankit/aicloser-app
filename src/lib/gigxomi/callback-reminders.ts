import "server-only";

import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/auth/types";
import { createAppNotification } from "@/lib/gigxomi/app-notification-service";
import { listMobilePushTokens, sendMobilePushNotifications } from "@/lib/mobile-push-store";

const REMINDER_TYPE = "CALLBACK_REMINDER";
const REMINDER_WINDOW_MS = 90_000;

type MobileReminderActor = {
  userId: string;
  role: AppRole;
};

function callbackLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function wasReminderCreated(userId: string, assignmentId: string, callbackAt: string) {
  try {
    const notifications = await prisma.appNotification.findMany({
      where: {
        userId,
        type: REMINDER_TYPE,
        entityType: "sales_lead",
        entityId: assignmentId,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { metadata: true },
    });
    return notifications.some((notification) => {
      const metadata = notification.metadata;
      return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && "callbackAt" in metadata && metadata.callbackAt === callbackAt);
    });
  } catch {
    // The notification table is optional in older installations. Push and
    // local mobile reminders must continue to work when that table is absent.
    return false;
  }
}

/**
 * Dispatches the five-minute callback reminder for the mobile agent scope.
 * This is intentionally called from mobile sync endpoints so web-scheduled
 * callbacks and mobile reminders share the same SalesLeadAssignment record.
 */
export async function dispatchDueCallbackReminders(actor: MobileReminderActor) {
  const profile = await prisma.salesAgentProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true, tenantId: true },
  });
  if (!profile) return { checked: 0, created: 0, pushed: 0 };

  const now = Date.now();
  const from = new Date(now + 4 * 60_000);
  const to = new Date(now + 5 * 60_000 + REMINDER_WINDOW_MS);
  const assignments = await prisma.salesLeadAssignment.findMany({
    where: {
      followUpAt: { gte: from, lte: to },
      assignedAgent: {
        status: "ACTIVE",
        ...(actor.role === "SALES_AGENT" ? { id: profile.id } : { user: { tenantId: profile.tenantId } }),
      },
      ...(actor.role === "SALES_AGENT" ? { assignedAgentId: profile.id } : {}),
    },
    include: {
      assignedAgent: { select: { userId: true, tenantId: true } },
    },
    orderBy: { followUpAt: "asc" },
  });

  let created = 0;
  let pushed = 0;
  for (const assignment of assignments) {
    if (!assignment.followUpAt) continue;
    const callbackAt = assignment.followUpAt.toISOString();
    const userId = assignment.assignedAgent.userId;
    if (await wasReminderCreated(userId, assignment.id, callbackAt)) continue;

    const title = "Callback in 5 minutes";
    const message = `${assignment.customerName || assignment.customerPhone || "Lead"} callback is scheduled for ${callbackLabel(assignment.followUpAt)}.`;
    const conversationId = assignment.conversationId || "";
    await createAppNotification({
      userId,
      tenantId: assignment.assignedAgent.tenantId,
      type: REMINDER_TYPE,
      title,
      message,
      entityType: "sales_lead",
      entityId: assignment.id,
      metadata: {
        assignmentId: assignment.id,
        callbackAt,
        conversationId,
        minutesBefore: 5,
        popup: true,
      },
    });
    created += 1;

    const tokens = await listMobilePushTokens({ activeOnly: true, userId });
    if (!tokens.length) continue;
    const result = await sendMobilePushNotifications(tokens, {
      title,
      body: message,
      data: {
        type: REMINDER_TYPE,
        assignmentId: assignment.id,
        conversationId,
        callbackAt,
        deepLinkUrl: conversationId
          ? `https://app.aicloser.in/?tab=conversations&conversationId=${encodeURIComponent(conversationId)}`
          : "https://app.aicloser.in/?tab=dashboard",
        notificationChannelId: "gigxomi-callback-reminders",
        notificationCategoryId: "gigxomi-callback",
      },
    });
    pushed += result.sent;
  }

  return { checked: assignments.length, created, pushed };
}
