import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const CHAT_ACTIVITY_CHECK_MS = 2000;

function encodeSse(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const session = authorization.session;
  const tenantId =
    session.role === "SUPER_ADMIN"
      ? undefined
      : resolveSessionTenantId(authorization.session) || undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastSignature = "";
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const enqueue = (chunk: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };

      const cleanup = () => {
        closed = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        try {
          controller.close();
        } catch {
          // The stream may already be closed if the browser disconnected.
        }
      };

      function scheduleNextCheck() {
        if (!closed) {
          timeoutId = setTimeout(checkForConversationActivity, CHAT_ACTIVITY_CHECK_MS);
        }
      }

      async function checkForConversationActivity() {
        if (closed) {
          return;
        }

        try {
          // Query live PostgreSQL DB for recent activity
          const conversations = await prisma.appConversation.findMany({
            where: {
              ...(tenantId ? { tenantId } : {}),
            },
            select: {
              id: true,
              status: true,
              leadStatusId: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 50,
          });

          const signature = conversations
            .map((c) => [c.id, c.status, c.leadStatusId, c.updatedAt.toISOString()].join(":"))
            .join("|");

          const changed = Boolean(lastSignature && lastSignature !== signature);
          lastSignature = signature;

          enqueue(
            encodeSse(changed ? "sync" : "heartbeat", {
              ok: true,
              audience: "sales",
              signature: changed ? createHash("sha1").update(signature).digest("hex") : undefined,
              checkedAt: new Date().toISOString(),
            }),
          );
        } catch {
          enqueue(
            encodeSse("heartbeat", {
              ok: false,
              checkedAt: new Date().toISOString(),
            }),
          );
        } finally {
          scheduleNextCheck();
        }
      }

      request.signal.addEventListener("abort", cleanup, { once: true });
      enqueue("retry: 5000\n\n");
      enqueue(
        encodeSse("ready", {
          ok: true,
          audience: "sales",
          checkedAt: new Date().toISOString(),
        }),
      );

      scheduleNextCheck();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
