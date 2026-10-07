import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { createAndQueueCampaign, type VariableMapping } from "@/lib/whatsapp-marketing/campaign-engine";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  const campaigns = await prisma.whatsAppCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      template: {
        select: {
          name: true,
          category: true,
          status: true,
        },
      },
      channel: {
        select: {
          displayPhoneNumber: true,
          verifiedName: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.templateId || !body?.name) {
    return NextResponse.json(
      { ok: false, error: "templateId and name are required." },
      { status: 400 },
    );
  }

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId as string);

  // If channelId is missing, pick the active channel
  let channelId = String(body.channelId || "");
  if (!channelId) {
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    if (!channel) {
      return NextResponse.json({ ok: false, error: "Active WhatsApp Channel not found." }, { status: 400 });
    }
    channelId = channel.id;
  }

  const result = await createAndQueueCampaign({
    tenantId,
    channelId,
    templateId: String(body.templateId),
    name: String(body.name),
    groupIds: Array.isArray(body.groupIds) ? (body.groupIds as string[]) : undefined,
    contactIds: Array.isArray(body.contactIds) ? (body.contactIds as string[]) : undefined,
    variableMappings: (body.variableMappings as VariableMapping) || {},
    scheduledAt: body.scheduledAt ? String(body.scheduledAt) : null,
    timezone: body.timezone ? String(body.timezone) : "Asia/Kolkata",
    actorUserId: auth.session.userId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
