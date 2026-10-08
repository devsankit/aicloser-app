import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { updateInstagramConnectionStateFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { publicInstagramConnection } from "@/lib/meta/instagram-connection-view";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (typeof body?.pluginEnabled !== "boolean") return NextResponse.json({ ok: false, code: "INVALID_REQUEST", error: "Choose whether Instagram Inbox is enabled." }, { status: 400 });
    if (body.tenantId && auth.session.role !== "SUPER_ADMIN" && body.tenantId !== auth.session.tenantId) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED", error: "Workspace access denied." }, { status: 403 });
    const tenantId = resolveSessionTenantId(auth.session, body.tenantId);
    const connection = await updateInstagramConnectionStateFromFile(tenantId, { pluginEnabled: body.pluginEnabled });
    return NextResponse.json({ ok: true, connection: publicInstagramConnection(connection) });
  } catch (error) {
    return NextResponse.json({ ok: false, code: error instanceof SyntaxError ? "INVALID_REQUEST" : "INSTAGRAM_SETUP_FAILED", error: "Unable to update Instagram Inbox. Retry after checking configuration." }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}
