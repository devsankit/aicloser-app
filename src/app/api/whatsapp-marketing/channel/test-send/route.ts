import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { sendCampaignTestMessage } from "@/lib/whatsapp-marketing/campaign-engine";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.channelId || !body?.templateId || !body?.testPhone) {
    return NextResponse.json(
      { ok: false, error: "channelId, templateId, and testPhone are required." },
      { status: 400 },
    );
  }

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId as string);

  const result = await sendCampaignTestMessage({
    tenantId,
    channelId: String(body.channelId),
    templateId: String(body.templateId),
    testPhone: String(body.testPhone),
    variableValues: (body.variableValues as Record<string, string>) || {},
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
