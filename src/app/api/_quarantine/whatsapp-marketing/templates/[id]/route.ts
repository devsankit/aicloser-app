import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id, tenantId },
    include: {
      channel: true,
      versions: { orderBy: { versionNumber: "desc" } },
    },
  });

  if (!template) {
    return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, template });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id, tenantId },
  });

  if (!template) {
    return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
  }

  await prisma.whatsAppTemplate.delete({ where: { id: template.id } });

  await prisma.whatsAppAuditLog.create({
    data: {
      tenantId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      action: "TEMPLATE_DELETED",
      entityType: "WhatsAppTemplate",
      entityId: template.id,
      details: { name: template.name },
    },
  });

  return NextResponse.json({ ok: true, deletedId: id });
}
