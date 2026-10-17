import "server-only";

import { cookies } from "next/headers";

const CENTRAL_API_BASE = (
  process.env.AICLOSER_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_AICLOSER_API_URL?.trim() ||
  "https://api.aicloser.in/api/v1"
).replace(/\/$/, "");

export class CentralApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CentralApiError";
    this.status = status;
  }
}

export async function centralApiRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("aicloser_token")?.value?.trim();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${CENTRAL_API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = payload?.error || payload?.message || `Central API request failed (${response.status})`;
    throw new CentralApiError(String(error), response.status);
  }
  return payload as T;
}

export function centralApiBaseUrl() {
  return CENTRAL_API_BASE;
}
