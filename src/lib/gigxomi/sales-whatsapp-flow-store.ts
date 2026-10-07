import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  SuperAdminWhatsAppFlow,
  SuperAdminWhatsAppFlowEdge,
  SuperAdminWhatsAppFlowNode,
  SuperAdminWhatsAppFlowNodeButton,
  SuperAdminWhatsAppFlowRun,
} from "@/lib/gigxomi/super-admin-whatsapp-flow-store";

type SalesWhatsAppFlowSnapshot = {
  flows: SuperAdminWhatsAppFlow[];
  runs: SuperAdminWhatsAppFlowRun[];
};

type SalesWhatsAppFlowInput = Partial<SuperAdminWhatsAppFlow> &
  Pick<SuperAdminWhatsAppFlow, "name" | "summary" | "status" | "triggerMode" | "triggerKeyword" | "nodes" | "edges">;

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `plugin-${randomUUID().slice(0, 8)}`
  );
}

function emptySnapshot(): SalesWhatsAppFlowSnapshot {
  return { flows: [], runs: [] };
}

function normalizeButton(button: Partial<SuperAdminWhatsAppFlowNodeButton>, index: number): SuperAdminWhatsAppFlowNodeButton {
  const fallback = `option_${index + 1}`;
  const value = button.value?.trim() || button.id?.trim() || fallback;
  return {
    id: button.id?.trim() || value,
    label: button.label?.trim() || `Option ${index + 1}`,
    actionType: button.actionType === "URL" ? "URL" : "QUICK_REPLY",
    value,
  };
}

function normalizeNode(node: SuperAdminWhatsAppFlowNode): SuperAdminWhatsAppFlowNode {
  return {
    ...node,
    id: node.id?.trim() || `node-${randomUUID()}`,
    title: node.title?.trim() || "Untitled node",
    body: node.body?.trim() || "",
    messageFormat: node.messageFormat ?? "TEXT",
    mediaUrl: node.mediaUrl?.trim() || "",
    documentFileName: node.documentFileName?.trim() || "",
    waitSeconds: Number.isFinite(node.waitSeconds) ? Number(node.waitSeconds) : 0,
    conditionExpression: node.conditionExpression?.trim() || "",
    apiUrl: node.apiUrl?.trim() || "",
    apiMethod:
      node.apiMethod === "GET" || node.apiMethod === "POST" || node.apiMethod === "PUT" || node.apiMethod === "PATCH" || node.apiMethod === "DELETE"
        ? node.apiMethod
        : "POST",
    apiHeaders: node.apiHeaders?.trim() || "",
    apiBody: node.apiBody?.trim() || "",
    outputVariable: node.outputVariable?.trim() || "",
    aiModelName: node.aiModelName?.trim() || "",
    aiSystemPrompt: node.aiSystemPrompt?.trim() || "",
    aiUserPrompt: node.aiUserPrompt?.trim() || "",
    aiTemperature: Number.isFinite(node.aiTemperature) ? Number(node.aiTemperature) : 0.4,
    aiMaxTokens: Number.isFinite(node.aiMaxTokens) ? Number(node.aiMaxTokens) : 240,
    buttons: Array.isArray(node.buttons) ? node.buttons.map(normalizeButton).slice(0, 3) : [],
  };
}

function buildLinearEdges(nodes: SuperAdminWhatsAppFlowNode[]): SuperAdminWhatsAppFlowEdge[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${nodes[index + 1]?.id}`,
    source: node.id,
    target: nodes[index + 1]?.id ?? node.id,
    label: "",
    branchKey: "default",
  }));
}

function normalizeEdges(edges: SuperAdminWhatsAppFlowEdge[], nodes: SuperAdminWhatsAppFlowNode[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return edges
    .map((edge) => ({
      id: edge.id?.trim() || `edge-${randomUUID()}`,
      source: edge.source,
      target: edge.target,
      label: edge.label?.trim() || "",
      branchKey: edge.branchKey?.trim() || "default",
    }))
    .filter((edge) => edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target));
}

function normalizeFlow(flow: SuperAdminWhatsAppFlow): SuperAdminWhatsAppFlow {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes.map(normalizeNode).filter((node) => Boolean(node.kind)) : [];
  const edges = Array.isArray(flow.edges) ? normalizeEdges(flow.edges, nodes) : [];
  return {
    ...flow,
    id: flow.id?.trim() || `flow-${randomUUID()}`,
    name: flow.name?.trim() || "New WhatsApp flow",
    summary: flow.summary?.trim() || "Private sales chatbot flow.",
    status: flow.status === "ACTIVE" || flow.status === "PAUSED" ? flow.status : "DRAFT",
    triggerMode: flow.triggerMode === "ANY_INCOMING" ? "ANY_INCOMING" : "KEYWORD",
    triggerKeyword: flow.triggerKeyword?.trim() || "Get OTP",
    channel: "OFFICIAL_GIGXOMI",
    pluginKey: flow.pluginKey?.trim() || slugify(flow.name || "sales-flow"),
    pluginVersion: Number.isFinite(flow.pluginVersion) && flow.pluginVersion > 0 ? flow.pluginVersion : 1,
    pluginStatus: flow.pluginStatus || (flow.status === "ACTIVE" ? "READY_TO_DEPLOY" : "INTERNAL_ONLY"),
    testedAt: flow.testedAt || null,
    deployments: [],
    nodes,
    edges: edges.length ? edges : buildLinearEdges(nodes),
    createdAt: flow.createdAt || nowIso(),
    updatedAt: flow.updatedAt || nowIso(),
  };
}

async function readStore(scopeId: string): Promise<SalesWhatsAppFlowSnapshot> {
  const [flowRows, runRows, runFlowRows] = await Promise.all([
    prisma.whatsAppFlow.findMany({
      where: { platformScope: "sales", agencyId: scopeId, channel: "whatsapp" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.whatsAppFlowRun.findMany({
      where: { agencyId: scopeId, channel: "whatsapp" },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.whatsAppFlow.findMany({
      where: { platformScope: "sales", agencyId: scopeId, channel: "whatsapp" },
      select: { id: true, name: true },
    }),
  ]);
  const flowNames = new Map(runFlowRows.map((flow) => [flow.id, flow.name]));

  return {
    flows: flowRows.map((row) => flowFromDatabase(row)),
    // Only persisted workflow runs are returned. The old file store created a
    // synthetic run every time a flow was saved, which made an empty account
    // look active on first login.
    runs: runRows.map((row) => ({
      id: row.id,
      flowId: row.flowId,
      flowName: flowNames.get(row.flowId) ?? "WhatsApp flow",
      status: row.status === "WAITING" ? "WAITING" : row.status === "FAILED" ? "FAILED" : "SUCCESS",
      summary: row.errorMessage ?? "Persisted WhatsApp flow run.",
      createdAt: row.startedAt.toISOString(),
    })),
  };
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function flowFromDatabase(row: {
  id: string;
  name: string;
  description: string;
  status: string;
  nodesJson: unknown;
  edgesJson: unknown;
  settingsJson: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}): SuperAdminWhatsAppFlow {
  const settings = jsonObject(row.settingsJson);
  const status = row.status.toUpperCase();
  return normalizeFlow({
    id: row.id,
    name: row.name,
    summary: row.description,
    status: status === "ACTIVE" || status === "PAUSED" ? status : "DRAFT",
    triggerMode: settings.triggerMode === "ANY_INCOMING" ? "ANY_INCOMING" : "KEYWORD",
    triggerKeyword: String(settings.triggerKeyword ?? ""),
    channel: "OFFICIAL_GIGXOMI",
    pluginKey: String(settings.pluginKey ?? ""),
    pluginVersion: Number(settings.pluginVersion ?? row.version),
    pluginStatus: settings.pluginStatus === "DEPLOYED" || settings.pluginStatus === "READY_TO_DEPLOY" ? settings.pluginStatus : "INTERNAL_ONLY",
    testedAt: typeof settings.testedAt === "string" ? settings.testedAt : row.publishedAt?.toISOString() ?? null,
    deployments: [],
    nodes: Array.isArray(row.nodesJson) ? (row.nodesJson as SuperAdminWhatsAppFlowNode[]) : [],
    edges: Array.isArray(row.edgesJson) ? (row.edgesJson as SuperAdminWhatsAppFlowEdge[]) : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

async function writeStore(scopeId: string, snapshot: SalesWhatsAppFlowSnapshot) {
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.whatsAppFlow.findMany({
      where: { platformScope: "sales", agencyId: scopeId, channel: "whatsapp" },
      select: { id: true },
    });
    const nextIds = snapshot.flows.map((flow) => flow.id);
    if (current.length && nextIds.length) {
      await transaction.whatsAppFlow.deleteMany({
        where: { platformScope: "sales", agencyId: scopeId, channel: "whatsapp", id: { notIn: nextIds } },
      });
    } else if (current.length && !nextIds.length) {
      await transaction.whatsAppFlow.deleteMany({ where: { platformScope: "sales", agencyId: scopeId, channel: "whatsapp" } });
    }

    for (const flow of snapshot.flows) {
      await transaction.whatsAppFlow.upsert({
        where: { id: flow.id },
        update: {
          agencyId: scopeId,
          name: flow.name,
          description: flow.summary,
          status: flow.status.toLowerCase(),
          nodesJson: flow.nodes as unknown as Prisma.InputJsonValue,
          edgesJson: flow.edges as unknown as Prisma.InputJsonValue,
          settingsJson: {
            triggerMode: flow.triggerMode,
            triggerKeyword: flow.triggerKeyword,
            channel: flow.channel,
            pluginKey: flow.pluginKey,
            pluginVersion: flow.pluginVersion,
            pluginStatus: flow.pluginStatus,
            testedAt: flow.testedAt,
          } as Prisma.InputJsonObject,
          updatedAt: new Date(flow.updatedAt),
        },
        create: {
          id: flow.id,
          platformScope: "sales",
          agencyId: scopeId,
          name: flow.name,
          description: flow.summary,
          status: flow.status.toLowerCase(),
          channel: "whatsapp",
          nodesJson: flow.nodes as unknown as Prisma.InputJsonValue,
          edgesJson: flow.edges as unknown as Prisma.InputJsonValue,
          settingsJson: {
            triggerMode: flow.triggerMode,
            triggerKeyword: flow.triggerKeyword,
            channel: flow.channel,
            pluginKey: flow.pluginKey,
            pluginVersion: flow.pluginVersion,
            pluginStatus: flow.pluginStatus,
            testedAt: flow.testedAt,
          } as Prisma.InputJsonObject,
          createdAt: new Date(flow.createdAt),
          updatedAt: new Date(flow.updatedAt),
        },
      });
    }
  });
}

export async function listSalesWhatsAppFlows(scopeId: string) {
  const snapshot = await readStore(scopeId);
  return snapshot.flows.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listSalesWhatsAppFlowRuns(scopeId: string, limit = 12) {
  const snapshot = await readStore(scopeId);
  return snapshot.runs.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, Math.max(limit, 0));
}

export async function saveSalesWhatsAppFlow(scopeId: string, input: SalesWhatsAppFlowInput) {
  const snapshot = await readStore(scopeId);
  const existing = input.id ? snapshot.flows.find((flow) => flow.id === input.id) ?? null : null;
  const timestamp = nowIso();
  const flow = normalizeFlow({
    ...input,
    id: existing?.id ?? input.id ?? `flow-${randomUUID()}`,
    channel: "OFFICIAL_GIGXOMI",
    pluginKey: input.pluginKey || existing?.pluginKey || slugify(input.name),
    pluginVersion: existing ? existing.pluginVersion + 1 : 1,
    pluginStatus: input.pluginStatus || (input.status === "ACTIVE" ? "READY_TO_DEPLOY" : existing?.pluginStatus) || "INTERNAL_ONLY",
    testedAt: input.status === "ACTIVE" ? timestamp : existing?.testedAt || null,
    deployments: [],
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });

  snapshot.flows = existing ? snapshot.flows.map((item) => (item.id === flow.id ? flow : item)) : [flow, ...snapshot.flows];
  const runStatus: SuperAdminWhatsAppFlowRun["status"] = flow.status === "ACTIVE" ? "SUCCESS" : flow.status === "PAUSED" ? "WAITING" : "FAILED";

  snapshot.runs = [
    {
      id: `run-${randomUUID()}`,
      flowId: flow.id,
      flowName: flow.name,
      status: runStatus,
      summary: "Private sales chatbot flow saved for this account only.",
      createdAt: timestamp,
    },
    ...snapshot.runs,
  ].slice(0, 40);

  await writeStore(scopeId, snapshot);
  return flow;
}

export async function updateSalesWhatsAppFlowMeta(scopeId: string, input: { flowId: string; name?: string; summary?: string }) {
  const snapshot = await readStore(scopeId);
  const timestamp = nowIso();
  const existing = snapshot.flows.find((flow) => flow.id === input.flowId) ?? null;
  if (!existing) {
    throw new Error("The selected private sales flow no longer exists.");
  }

  const flow = normalizeFlow({
    ...existing,
    name: input.name?.trim() || existing.name,
    summary: input.summary?.trim() || existing.summary,
    updatedAt: timestamp,
  });
  snapshot.flows = snapshot.flows.map((item) => (item.id === flow.id ? flow : item));
  await writeStore(scopeId, snapshot);
  return flow;
}

export async function deleteSalesWhatsAppFlow(scopeId: string, flowId: string) {
  const snapshot = await readStore(scopeId);
  const existing = snapshot.flows.find((flow) => flow.id === flowId) ?? null;
  if (!existing) {
    throw new Error("The selected private sales flow no longer exists.");
  }

  snapshot.flows = snapshot.flows.filter((flow) => flow.id !== flowId);
  snapshot.runs = snapshot.runs.filter((run) => run.flowId !== flowId);
  await writeStore(scopeId, snapshot);
  return existing;
}

export async function listAllActiveSalesWhatsAppFlows(): Promise<SuperAdminWhatsAppFlow[]> {
  const rows = await prisma.whatsAppFlow.findMany({
    where: { platformScope: "sales", channel: "whatsapp", status: { in: ["active", "draft"] } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => flowFromDatabase(row));
}

