import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  const groups = await prisma.contactGroup.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, groups });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name) {
    return NextResponse.json({ ok: false, error: "Group name is required." }, { status: 400 });
  }

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId as string);
  const name = String(body.name).trim();
  const description = body.description ? String(body.description).trim() : null;

  const group = await prisma.contactGroup.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name,
      },
    },
    update: {
      description,
      updatedAt: new Date(),
    },
    create: {
      tenantId,
      name,
      description,
    },
  });

  return NextResponse.json({ ok: true, group });
}

export async function DELETE(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  if (!id) {
    return NextResponse.json({ ok: false, error: "Group id is required." }, { status: 400 });
  }

  await prisma.contactGroup.deleteMany({
    where: { id, tenantId },
  });

  return NextResponse.json({ ok: true, deletedId: id });
}
