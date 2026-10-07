import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, WhatsAppTemplateStatus } from "@prisma/client";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import {
  createAndSubmitTemplate,
  type TemplateButtonInput,
} from "@/lib/whatsapp-marketing/template-service";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));
  const status = url.searchParams.get("status") as WhatsAppTemplateStatus | null;

  const whereClause: Prisma.WhatsAppTemplateWhereInput = { tenantId };
  if (status) {
    whereClause.status = status;
  }

  const templates = await prisma.whatsAppTemplate.findMany({
    where: whereClause,
    orderBy: { updatedAt: "desc" },
    include: {
      channel: {
        select: {
          displayPhoneNumber: true,
          verifiedName: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, templates });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name || !body?.bodyText) {
    return NextResponse.json({ ok: false, error: "name and bodyText are required." }, { status: 400 });
  }

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId as string);

  // If channelId is not explicitly provided, find the default or first active channel
  let channelId = String(body.channelId || "");
  if (!channelId) {
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    if (!channel) {
      return NextResponse.json({ ok: false, error: "No active WhatsApp Channel found for this tenant." }, { status: 400 });
    }
    channelId = channel.id;
  }

  const validCategory = (["MARKETING", "UTILITY", "AUTHENTICATION"].includes(String(body.category))
    ? (body.category as "MARKETING" | "UTILITY" | "AUTHENTICATION")
    : "MARKETING");

  const validHeaderType = (["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(String(body.headerType))
    ? (body.headerType as "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT")
    : "NONE");

  const result = await createAndSubmitTemplate({
    tenantId,
    channelId,
    name: String(body.name),
    language: String(body.language || "en_US"),
    category: validCategory,
    headerType: validHeaderType,
    headerText: body.headerText ? String(body.headerText) : undefined,
    headerHandle: body.headerHandle ? String(body.headerHandle) : undefined,
    bodyText: String(body.bodyText),
    footerText: body.footerText ? String(body.footerText) : undefined,
    buttons: Array.isArray(body.buttons) ? (body.buttons as TemplateButtonInput[]) : undefined,
    exampleValues: (body.exampleValues as Record<string, string>) || undefined,
    actorUserId: auth.session.userId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
