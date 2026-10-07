import { NextResponse } from "next/server";
import { listRealtimeEvents } from "@/lib/realtime/event-outbox";
import { requireSessionRole } from "@/lib/api/require-session-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT", "FREELANCER"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.session.tenantId;
  if (!tenantId) return NextResponse.json({ ok: false, error: "Missing tenant context" }, { status: 400 });

  const encoder = new TextEncoder();
  let closed = false;
  let since = new Date(Date.now() - 5 * 60 * 1000);
  let afterId = request.headers.get("last-event-id") ?? "";
  const cursor = new URL(request.url).searchParams.get("since");
  if (cursor) {
    const parsed = new Date(cursor);
    if (!Number.isNaN(parsed.getTime())) since = parsed;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (name: string, payload: unknown, id?: string) => {
        if (closed) return;
        if (id) controller.enqueue(encoder.encode(`id: ${id}\n`));
        controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`));
      };
      send("connected", { createdAt: new Date().toISOString() });

      const poll = async () => {
        const events = await listRealtimeEvents({ topic: `tenant:${tenantId}`, since, afterId, limit: 100 });
        for (const event of events) {
          const visible = event.audienceUserIds.length === 0 || event.audienceUserIds.includes(auth.session.userId) || event.audienceRoles.length === 0 || event.audienceRoles.includes(auth.session.role);
          if (visible) send("crm", event, event.id);
          since = event.createdAt;
          afterId = event.id;
        }
      };
      await poll().catch(() => undefined);
      const interval = setInterval(() => { void poll().catch(() => undefined); }, 1000);
      const heartbeat = setInterval(() => send("ping", { createdAt: new Date().toISOString() }), 25_000);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* stream already closed */ }
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      closed = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
