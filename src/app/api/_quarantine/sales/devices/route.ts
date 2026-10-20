import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
    if (!auth.ok) return NextResponse.json({ ok: true, devices: [] });

    const url = new URL(request.url);
    const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

    const devices = await prisma.salesMobileDevice.findMany({
      where: { tenantId },
      orderBy: { lastSeenAt: "desc" },
      include: {
        agent: {
          include: {
            user: {
              select: {
                displayName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      devices: devices.map((d) => ({
        id: d.id,
        closer: d.agent?.user?.displayName || "Assigned Closer",
        phoneModel: d.deviceName || `${d.manufacturer || ""} ${d.model || ""}`.trim() || "Android Phone",
        simCarrier: d.simLabel || "Physical SIM",
        simNumber: d.officeSimNumber || d.agent?.user?.phone || "—",
        battery: 100,
        recordingService: d.isActive && d.recordingEnabled ? "active" : "standby",
        lastHeartbeat: d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("en-IN") : "Never",
        appVersion: d.appVersion,
        platform: d.platform,
        recordingCapability: d.recordingCapability,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to load devices", devices: [] }, { status: 500 });
  }
}
