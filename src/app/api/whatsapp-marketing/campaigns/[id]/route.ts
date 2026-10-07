import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import {
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryFailedRecipients,
} from "@/lib/whatsapp-marketing/campaign-engine";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id, tenantId },
    include: {
      channel: true,
      template: true,
      recipients: {
        take: 100,
        orderBy: { createdAt: "desc" },
        include: {
          contact: {
            select: { fullName: true, e164Phone: true, email: true },
          },
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaign not found." }, { status: 404 });
  }

  // Calculate delivery rates
  const sent = campaign.sentCount;
  const deliveredRate = sent > 0 ? ((campaign.deliveredCount / sent) * 100).toFixed(1) : "0";
  const readRate = campaign.deliveredCount > 0 ? ((campaign.readCount / campaign.deliveredCount) * 100).toFixed(1) : "0";
  const replyRate = campaign.deliveredCount > 0 ? ((campaign.repliedCount / campaign.deliveredCount) * 100).toFixed(1) : "0";

  return NextResponse.json({
    ok: true,
    campaign,
    metrics: {
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
      repliedCount: campaign.repliedCount,
      deliveredRate: `${deliveredRate}%`,
      readRate: `${readRate}%`,
      replyRate: `${replyRate}%`,
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action as string; // 'PAUSE' | 'RESUME' | 'CANCEL' | 'RETRY_FAILED'

  const tenantId = resolveSessionTenantId(auth.session, body?.tenantId as string);

  if (action === "PAUSE") {
    const res = await pauseCampaign(tenantId, id, auth.session.userId);
    return NextResponse.json(res);
  }

  if (action === "RESUME") {
    const res = await resumeCampaign(tenantId, id, auth.session.userId);
    return NextResponse.json(res);
  }

  if (action === "CANCEL") {
    const res = await cancelCampaign(tenantId, id, auth.session.userId);
    return NextResponse.json(res);
  }

  if (action === "RETRY_FAILED") {
    const res = await retryFailedRecipients(tenantId, id, auth.session.userId);
    return NextResponse.json(res);
  }

  return NextResponse.json({ ok: false, error: `Unsupported action: ${action}` }, { status: 400 });
}
