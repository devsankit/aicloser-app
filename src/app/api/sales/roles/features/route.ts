import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import {
  AVAILABLE_FEATURES,
  getRolePermissionsMatrix,
  saveRolePermissionsMatrix,
  type RolePermissionsMatrix,
} from "@/lib/gigxomi/role-permissions-store";
import { getSalesAgentAccess } from "@/lib/gigxomi/sales-store";

async function requireWorkspaceAdmin() {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth;
  if (auth.session.role === "ADMIN" || auth.session.role === "SUPER_ADMIN") return auth;

  const access = await getSalesAgentAccess(auth.session.userId);
  const permissions = access.agent?.permissions as Record<string, unknown> | null | undefined;
  const isProfileWorkspaceAdmin =
    permissions?.workspaceAdmin === true ||
    String(permissions?.workspaceRole ?? "").toUpperCase() === "ADMIN";
  if (access.ok && isProfileWorkspaceAdmin) return auth;

  return {
    ok: false as const,
    response: NextResponse.json(
      { ok: false, error: "Only the workspace owner or an Admin can change role permissions." },
      { status: 403 },
    ),
  };
}

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const matrix = await getRolePermissionsMatrix();
    return NextResponse.json({
      ok: true,
      features: AVAILABLE_FEATURES,
      matrix,
      userRole: auth.session.role,
      userPermissions: matrix[auth.session.role as keyof RolePermissionsMatrix] || matrix.SALES_AGENT,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load role permissions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const matrix = body.matrix as Partial<RolePermissionsMatrix>;
    if (!matrix || typeof matrix !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid role permissions matrix" }, { status: 400 });
    }

    const updated = await saveRolePermissionsMatrix(matrix);
    return NextResponse.json({ ok: true, matrix: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save role permissions" },
      { status: 500 }
    );
  }
}
