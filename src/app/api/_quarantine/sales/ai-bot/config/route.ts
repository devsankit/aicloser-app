import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getMaskedAiBotConfig, saveAiBotConfig, type AiBotConfig } from "@/lib/gigxomi/ai-beta-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isDev =
    process.env.NODE_ENV !== "production" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1";

  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER", "FREELANCER"]);
  if (!auth.ok && !isDev) return auth.response;

  try {
    const config = await getMaskedAiBotConfig();
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load AI config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const isDev =
    process.env.NODE_ENV !== "production" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1";

  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok && !isDev) return auth.response;

  try {
    const body = (await request.json()) as Partial<AiBotConfig>;
    const updated = await saveAiBotConfig(body);
    return NextResponse.json({ ok: true, config: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save AI config" },
      { status: 400 }
    );
  }
}
