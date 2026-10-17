import { cookies } from "next/headers";
import { centralApiBaseUrl } from "@/lib/central-api-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This gateway transports the v1 API contract unchanged. Business logic,
// permissions and persistence belong to the dedicated backend.
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path.length || path.some((part) => part === "." || part === ".." || /[\\/]/.test(part))) {
    return Response.json({ success: false, error: "InvalidPath" }, { status: 400 });
  }
  const cookieStore = await cookies();
  const authorization = request.headers.get("authorization");
  const token = cookieStore.get("aicloser_token")?.value || cookieStore.get("gx_session")?.value;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "range", "last-event-id", "x-target-tenant-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (token) headers.set("authorization", `Bearer ${token}`);
  else if (authorization?.startsWith("Bearer ")) headers.set("authorization", authorization);
  const query = new URL(request.url).search;
  try {
    const upstream = await fetch(`${centralApiBaseUrl()}/${path.map(encodeURIComponent).join("/")}${query}`, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "content-disposition", "content-range", "accept-ranges", "location"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ success: false, error: "ApiUnavailable", message: "Unable to reach the workspace service. Please retry." }, { status: 502 });
  }
}

export { proxy as GET, proxy as HEAD, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
