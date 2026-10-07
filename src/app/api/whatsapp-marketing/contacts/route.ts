import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, MarketingContactOptInStatus } from "@prisma/client";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import {
  upsertMarketingContact,
  suppressPhone,
  unsuppressPhone,
} from "@/lib/whatsapp-marketing/contact-service";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));
  const query = url.searchParams.get("q")?.trim() || "";
  const groupId = url.searchParams.get("groupId");
  const optInStatus = url.searchParams.get("optInStatus") as MarketingContactOptInStatus | null;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.MarketingContactWhereInput = { tenantId };

  if (query) {
    whereClause.OR = [
      { fullName: { contains: query, mode: "insensitive" } },
      { e164Phone: { contains: query } },
      { email: { contains: query, mode: "insensitive" } },
      { tags: { has: query } },
    ];
  }

  if (groupId) {
    whereClause.groupMemberships = {
      some: { groupId },
    };
  }

  if (optInStatus) {
    whereClause.optInStatus = optInStatus;
  }

  const [contacts, total] = await Promise.all([
    prisma.marketingContact.findMany({
      where: whereClause,
      include: {
        groupMemberships: {
          include: { group: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.marketingContact.count({ where: whereClause }),
  ]);

  return NextResponse.json({
    ok: true,
    contacts: contacts.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.e164Phone,
      email: c.email,
      tags: c.tags,
      optInStatus: c.optInStatus,
      optInSource: c.optInSource,
      isBlocked: c.isBlocked,
      groups: c.groupMemberships.map((m) => ({ id: m.group.id, name: m.group.name })),
      lastDeliveredAt: c.lastDeliveredAt,
      lastReadAt: c.lastReadAt,
      lastRepliedAt: c.lastRepliedAt,
      createdAt: c.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId as string);

  // Check action: 'suppress' | 'unsuppress' | 'upsert'
  const action = String(body.action || "upsert");

  if (action === "suppress") {
    if (!body.phone) {
      return NextResponse.json({ ok: false, error: "Phone number is required to suppress." }, { status: 400 });
    }
    await suppressPhone({
      tenantId,
      e164Phone: String(body.phone),
      reason: "MANUAL_BLOCK",
      actorUserId: auth.session.userId,
    });
    return NextResponse.json({ ok: true, suppressed: true });
  }

  if (action === "unsuppress") {
    if (!body.phone) {
      return NextResponse.json({ ok: false, error: "Phone number is required to unsuppress." }, { status: 400 });
    }
    await unsuppressPhone({
      tenantId,
      e164Phone: String(body.phone),
      actorUserId: auth.session.userId,
    });
    return NextResponse.json({ ok: true, suppressed: false });
  }

  const optInStatusVal: MarketingContactOptInStatus =
    body.optInStatus === "OPTED_OUT" || body.optInStatus === "UNKNOWN"
      ? (body.optInStatus as MarketingContactOptInStatus)
      : "OPTED_IN";

  const result = await upsertMarketingContact({
    tenantId,
    fullName: String(body.fullName),
    phone: String(body.phone),
    email: body.email ? String(body.email) : undefined,
    groupIds: Array.isArray(body.groupIds) ? (body.groupIds as string[]) : undefined,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    optInStatus: optInStatusVal,
    optInSource: (body.optInSource as string) || "DASHBOARD_ENTRY",
    defaultCountryCode: (body.defaultCountryCode as string) || "+91",
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
