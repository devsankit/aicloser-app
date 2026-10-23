import "server-only";

import { prisma } from "@/lib/prisma";

export const WORKSPACE_PAYMENT_GRACE_MS = 24 * 60 * 60 * 1000;

export async function getLatestWorkspaceSubscription(userId: string) {
  return prisma.userSubscription.findFirst({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    include: { package: true },
  });
}

export function isWorkspacePlanLocked(
  subscription: { paymentStatus: string; createdAt: Date; package?: { paymentRequired: boolean } | null } | null,
  now = Date.now(),
) {
  if (!subscription || subscription.paymentStatus !== "PENDING") return false;
  if (subscription.package && !subscription.package.paymentRequired) return false;
  return subscription.createdAt.getTime() + WORKSPACE_PAYMENT_GRACE_MS <= now;
}

export async function getWorkspacePaymentState(userId: string) {
  let subscription: Awaited<ReturnType<typeof getLatestWorkspaceSubscription>> = null;

  try {
    subscription = await getLatestWorkspaceSubscription(userId);
  } catch (error) {
    // The app talks to the remote API; this Prisma client has no reachable database.
    // Fail open so billing pages render instead of throwing a 500.
    console.error("[billing] workspace subscription lookup failed; failing open", error);
  }

  const locked = isWorkspacePlanLocked(subscription);
  return {
    subscription,
    locked,
    paymentStatus: subscription?.paymentStatus ?? "NOT_CONFIGURED",
    pendingSince: subscription?.createdAt ?? null,
    lockAt: subscription
      ? new Date(subscription.createdAt.getTime() + WORKSPACE_PAYMENT_GRACE_MS)
      : null,
  };
}
