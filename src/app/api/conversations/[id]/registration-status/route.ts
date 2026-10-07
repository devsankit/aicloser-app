import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getConversationViewForSession } from "@/lib/api/conversation-view-response";
import { normalizeRegistrationStatus } from "@/lib/gigxomi/registration-status";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const conversation = await getConversationViewForSession(auth.session, id);
  if (!conversation) return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });

  const phone = conversation.customerPhoneDisplay || "";
  if (!phone) return NextResponse.json({ ok: true, available: false, registration: null });

  try {
    let payload: Record<string, unknown> | null = null;
    const phoneDigits = phone.replace(/\D/g, "").slice(-10);

    if (process.env.DATABASE_URL?.trim() && phoneDigits) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const dbUser = await prisma.appAuthUser.findFirst({
          where: {
            OR: [
              { phone: { contains: phoneDigits } },
              { loginPhoneAliases: { has: phoneDigits } },
            ],
          },
          select: {
            id: true,
            role: true,
            assignedRole: true,
            tenantId: true,
            displayName: true,
            email: true,
            phone: true,
            packageId: true,
            packageName: true,
            packageAudience: true,
            packageStatus: true,
            packageExpiresAt: true,
            createdAt: true,
          },
        });

        if (dbUser) {
          const isAgency = dbUser.role === "ADMIN" || dbUser.packageAudience === "AGENCY";
          const isFreelancer = dbUser.role === "FREELANCER" || dbUser.packageAudience === "FREELANCER";
          const expiresAt = dbUser.packageExpiresAt ? new Date(dbUser.packageExpiresAt) : null;
          const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
          const isTrial = (dbUser.packageName || "").toLowerCase().includes("trial");

          let billingState = "FREE";
          if (dbUser.packageStatus === "ACTIVE") {
            billingState = isTrial ? "TRIAL" : "PAID";
          } else if (dbUser.packageStatus === "EXPIRED" || isExpired) {
            billingState = isTrial ? "TRIAL_EXPIRED" : "FREE";
          }

          const planDaysRemaining = expiresAt
            ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;

          // Check mobile push token for app installation
          let appInstalled = false;
          try {
            const pushToken = await prisma.devicePushToken.findFirst({
              where: { userId: dbUser.id, isActive: true },
              select: { id: true },
            });
            appInstalled = Boolean(pushToken);
          } catch {
            // non-blocking
          }

          // Check social channels
          const channels: Array<{ provider: string; status: string; connected: boolean; hasIssue: boolean; issue: string | null; phoneNumber: string | null; username: string | null; updatedAt: string | null }> = [];
          if (dbUser.id) {
            try {
              const socialConn = await prisma.appSocialConnection.findMany({
                where: { userId: dbUser.id },
              });
              for (const conn of socialConn) {
                channels.push({
                  provider: (conn as any).provider || "unknown",
                  status: (conn as any).status || "Connected",
                  connected: (conn as any).status === "Connected" || (conn as any).status === "ACTIVE",
                  hasIssue: (conn as any).status === "NEEDS_ATTENTION",
                  issue: (conn as any).issue || null,
                  phoneNumber: (conn as any).phoneNumber || null,
                  username: (conn as any).username || null,
                  updatedAt: (conn as any).updatedAt ? new Date((conn as any).updatedAt).toISOString() : null,
                });
              }
            } catch {
              // non-blocking
            }
          }

          payload = {
            registered: true,
            agencyRegistered: isAgency,
            freelancerRegistered: isFreelancer,
            appInstalled,
            billingState,
            paid: billingState === "PAID",
            planName: dbUser.packageName || (dbUser.packageStatus === "ACTIVE" ? "Pro Plan" : null),
            planExpiresAt: expiresAt ? expiresAt.toISOString() : null,
            planDaysRemaining,
            packageStatus: dbUser.packageStatus,
            channels,
            agencyWhatsAppNumber: dbUser.phone,
            leadWhatsAppNumber: phone,
            whatsappMatch: "MATCH",
            source: "database",
            registration: {
              id: dbUser.id,
              displayName: dbUser.displayName,
              email: dbUser.email,
              phone: dbUser.phone,
              role: dbUser.role,
              audience: dbUser.packageAudience,
              packageName: dbUser.packageName,
              packageStatus: dbUser.packageStatus,
              packageExpiresAt: expiresAt ? expiresAt.toISOString() : null,
            },
          };
        } else {
          payload = {
            registered: false,
            agencyRegistered: false,
            freelancerRegistered: false,
            appInstalled: false,
            billingState: "FREE",
            paid: false,
            planName: null,
            planExpiresAt: null,
            planDaysRemaining: null,
            packageStatus: null,
            channels: [],
            agencyWhatsAppNumber: null,
            leadWhatsAppNumber: phone,
            whatsappMatch: "MATCH",
            source: "database",
            registration: null,
          };
        }
      } catch (dbErr) {
        console.warn("[registration-status] Direct DB lookup failed:", dbErr);
      }
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({
        ok: true,
        available: true,
        registered: false,
        agencyRegistered: false,
        freelancerRegistered: false,
        appInstalled: false,
        billingState: "FREE",
        paid: false,
        planName: null,
        planExpiresAt: null,
        planDaysRemaining: null,
        channels: [],
        whatsappMatch: "MATCH",
      });
    }

    const normalized = normalizeRegistrationStatus(payload, phone);

    // Auto-advance lead stage if user has registered or started free trial, but stage is still "NEW"
    const isRegisteredOrTrial = Boolean(
      normalized.registered === true ||
      normalized.freelancerRegistered === true ||
      normalized.billingState === "TRIAL" ||
      normalized.billingState === "PAID" ||
      normalized.billingState === "FREE"
    );
    if (isRegisteredOrTrial && process.env.DATABASE_URL?.trim()) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const existing = await prisma.appConversation.findUnique({
          where: { id },
          select: { id: true, leadStatusId: true, customerPhone: true, payload: true },
        });
        const currentStage = String(existing?.leadStatusId || "").toLowerCase();
        if (existing && (!currentStage || currentStage === "new" || currentStage === "new-leads")) {
          const currentPayload = existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
            ? (existing.payload as Record<string, unknown>)
            : {};
          await prisma.appConversation.update({
            where: { id },
            data: {
              leadStatusId: "qualified",
              payload: { ...currentPayload, leadStatusId: "qualified", autoAdvancedAt: new Date().toISOString() },
              updatedAt: new Date(),
            },
          });
          const phoneDigits = (existing.customerPhone || phone).replace(/\D/g, "").slice(-10);
          if (phoneDigits) {
            await prisma.salesLeadAssignment.updateMany({
              where: {
                OR: [
                  { conversationId: id },
                  { customerPhone: { endsWith: phoneDigits } },
                ],
                stage: "NEW",
              },
              data: {
                stage: "INTERESTED",
                conversationId: id,
                updatedAt: new Date(),
              },
            });
          }
        }
      } catch (err) {
        console.warn("[registration-status] Auto-advance lead stage warning:", err);
      }
    }

    return NextResponse.json({ ok: true, available: true, ...normalized });
  } catch {
    return NextResponse.json({
      ok: true,
      available: true,
      registered: false,
      agencyRegistered: false,
      freelancerRegistered: false,
      appInstalled: false,
      billingState: "FREE",
      paid: false,
      planName: null,
      planExpiresAt: null,
      planDaysRemaining: null,
      channels: [],
      whatsappMatch: "MATCH",
    });
  }
}
