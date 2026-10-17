import { NextResponse } from "next/server";

import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

type CentralPayload<T> = {
  data?: T;
};

function extractList(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }

  if (record.data && record.data !== value) {
    return extractList(record.data, keys);
  }

  return [];
}

async function read<T>(path: string) {
  try {
    return await centralApiRequest<CentralPayload<T>>(path);
  } catch (error) {
    return { error } as const;
  }
}

export async function GET() {
  // Keep the workspace stage read independent from the other support resources.
  // The central API can return an incomplete stage payload when these workspace
  // reads are opened concurrently, even though /stages itself is healthy.
  const teamResult = await read<unknown[]>("/team");
  const stagesResult = await read<unknown[]>("/stages");
  const templatesResult = await read<unknown[]>("/marketing/templates");

  const team = "error" in teamResult
    ? []
    : extractList(teamResult, ["team", "members", "users", "data", "items"]);
  const stages = "error" in stagesResult
    ? []
    : extractList(stagesResult, ["stages", "data", "items"]);
  const templates = "error" in templatesResult
    ? []
    : extractList(templatesResult, ["templates", "data", "items"]);
  const errors = [teamResult, stagesResult, templatesResult]
    .filter((result): result is { error: unknown } => "error" in result)
    .map((result) => result.error)
    .filter((error): error is CentralApiError => error instanceof CentralApiError);

  if (errors.length === 3) {
    return NextResponse.json(
      { success: false, data: null, error: errors[0]?.message ?? "Chat support data unavailable." },
      { status: errors[0]?.status ?? 502 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { team, stages: { stages }, templates },
    partial: errors.length > 0,
  });
}
