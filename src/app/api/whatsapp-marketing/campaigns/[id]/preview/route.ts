import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { generateCampaignPreview, type VariableMapping } from "@/lib/whatsapp-marketing/campaign-engine";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const tenantId = resolveSessionTenantId(auth.session, body?.tenantId as string);

  const templateId = String(body?.templateId || id);
  const groupIds = Array.isArray(body?.groupIds) ? (body.groupIds as string[]) : undefined;
  const variableMappings = (body?.variableMappings as VariableMapping) || {};

  const previewResult = await generateCampaignPreview({
    tenantId,
    templateId,
    groupIds,
    variableMappings,
  });

  return NextResponse.json(previewResult, { status: previewResult.ok ? 200 : 400 });
}
