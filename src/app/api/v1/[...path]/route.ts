import { cookies } from "next/headers";
import { centralApiBaseUrl } from "@/lib/central-api-server";
import { verifySessionToken } from "@/lib/auth/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path.length || path.some((part) => part === "." || part === ".." || /[\\/]/.test(part))) {
    return Response.json({ success: false, error: "InvalidPath" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const cookieToken = cookieStore.get("aicloser_token")?.value || cookieStore.get("gx_session")?.value;
  const token = bearerToken || cookieToken;

  const sessionUser = token ? await verifySessionToken(token) : null;
  const isSuperAdmin = sessionUser?.role === "SUPER_ADMIN";

  const headers = new Headers();
  for (const name of ["accept", "content-type", "range", "last-event-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Only allow x-target-tenant-id header override if verified as SUPER_ADMIN
  if (isSuperAdmin) {
    const targetTenant = request.headers.get("x-target-tenant-id");
    if (targetTenant) headers.set("x-target-tenant-id", targetTenant);
  }

  if (authorization?.startsWith("Bearer ")) headers.set("authorization", authorization);
  else if (token) headers.set("authorization", `Bearer ${token}`);

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
    for (const name of ["content-type", "content-disposition", "content-range", "accept-ranges", "location", "set-cookie"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ success: false, error: "ApiUnavailable", message: "Unable to reach the workspace service. Please retry." }, { status: 502 });
  }
}

export { proxy as GET, proxy as HEAD, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
