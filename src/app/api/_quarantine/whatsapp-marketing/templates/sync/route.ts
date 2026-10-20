import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { syncTemplatesFromMeta } from "@/lib/whatsapp-marketing/template-service";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const tenantId = resolveSessionTenantId(auth.session, body?.tenantId as string);

  let channelId = String(body?.channelId || "");
  if (!channelId) {
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    if (!channel) {
      return NextResponse.json({ ok: false, error: "No active WhatsApp Channel found to sync." }, { status: 400 });
    }
    channelId = channel.id;
  }

  const result = await syncTemplatesFromMeta({
    tenantId,
    channelId,
    actorUserId: auth.session.userId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
