"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Copy,
  Maximize2,
  Play,
  Plus,
  Save,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

import type { AgencyTenant } from "@/lib/gigxomi/agency-network-data";
import type {
  SuperAdminWhatsAppFlow,
  SuperAdminWhatsAppFlowEdge,
  SuperAdminWhatsAppFlowNode,
  SuperAdminWhatsAppFlowNodeButton,
  SuperAdminWhatsAppFlowNodeKind,
  SuperAdminWhatsAppFlowRun,
  SuperAdminWhatsAppFlowStatus,
} from "@/lib/gigxomi/super-admin-whatsapp-flow-store";

type Props = {
  agencies: AgencyTenant[];
  flows: SuperAdminWhatsAppFlow[];
  runs: SuperAdminWhatsAppFlowRun[];
  fullScreen?: boolean;
  initialFlowId?: string;
  apiPath?: string;
  fullViewBasePath?: string | null;
  backHref?: string;
};

type BuilderChannel = "whatsapp" | "instagram" | "messenger" | "website";
type BuilderTab = "inspector" | "validation" | "test" | "analytics";
type BuilderView = "list" | "builder";
type IssueSeverity = "error" | "warning" | "info";
type NodeCapabilityStatus =
  | "ready"
  | "builder_only"
  | "integration_required"
  | "template_approval_required"
  | "configuration_required"
  | "unsupported_in_runtime";
type NodeQuickAction = "edit" | "duplicate" | "delete" | "copy-id" | "add-next";
type NodeButtonAction =
  | "add-button"
  | "add-next-for-button"
  | "delete-button"
  | "update-button-label"
  | "update-button-payload"
  | "update-button-type"
  | "update-button-url";

type ValidationIssue = {
  code: string;
  severity: IssueSeverity;
  message: string;
  nodeId?: string;
};

type NodeDefinition = {
  type: SuperAdminWhatsAppFlowNodeKind;
  label: string;
  category: string;
  icon: string;
  description: string;
  channelSupport: Record<BuilderChannel, boolean>;
  defaultData: Partial<SuperAdminWhatsAppFlowNode>;
  baseCapability: NodeCapabilityStatus;
};

type NodeCapability = {
  status: NodeCapabilityStatus;
  label: string;
  helper: string;
};

type FlowCanvasNodeData = {
  node: SuperAdminWhatsAppFlowNode;
  definition: NodeDefinition;
  issues: ValidationIssue[];
  capability: NodeCapability;
  actionMenuOpen?: boolean;
};

type FlowCanvasNode = Node<FlowCanvasNodeData, "gigxomiNode">;
type FlowCanvasEdge = Edge<{ branchKey?: string }>;

type FlowApiResponse = {
  ok?: boolean;
  error?: string;
  errors?: Array<{ code: string; message: string; nodeId?: string }>;
  flow?: SuperAdminWhatsAppFlow;
  flows?: SuperAdminWhatsAppFlow[];
  runs?: SuperAdminWhatsAppFlowRun[];
};

const CHANNEL_LABELS: Record<BuilderChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram DM future",
  messenger: "Messenger future",
  website: "Website Chat future",
};

const NODE_REGISTRY: NodeDefinition[] = [
  {
    type: "trigger-on-message",
    label: "On Message",
    category: "Triggers",
    icon: "IN",
    description: "Start when a WhatsApp user sends any inbound message.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { body: "Any incoming WhatsApp message" },
    baseCapability: "ready",
  },
  {
    type: "keyword-trigger",
    label: "On Keyword",
    category: "Triggers",
    icon: "KW",
    description: "Start when a keyword or phrase is detected.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { body: "hello" },
    baseCapability: "ready",
  },
  {
    type: "trigger-button-reply",
    label: "On Button Reply",
    category: "Triggers",
    icon: "BT",
    description: "Start from a stable WhatsApp button reply payload.",
    channelSupport: { whatsapp: true, instagram: false, messenger: false, website: false },
    defaultData: { body: "button_payload" },
    baseCapability: "ready",
  },
  {
    type: "trigger-list-reply",
    label: "On List Reply",
    category: "Triggers",
    icon: "LS",
    description: "Start from a selected WhatsApp list row payload.",
    channelSupport: { whatsapp: true, instagram: false, messenger: false, website: false },
    defaultData: { body: "list_row_payload" },
    baseCapability: "ready",
  },
  {
    type: "message-text",
    label: "Text Message",
    category: "Messages",
    icon: "TX",
    description: "Send a plain text WhatsApp response.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { body: "Thanks for messaging Gigxomi. How can we help?" },
    baseCapability: "ready",
  },
  {
    type: "message-button",
    label: "Buttons",
    category: "Interactive",
    icon: "QB",
    description: "Send up to three WhatsApp quick reply buttons.",
    channelSupport: { whatsapp: true, instagram: false, messenger: false, website: false },
    defaultData: {
      body: "Choose an option",
      buttons: [
        { id: "option_1", label: "Option 1", actionType: "QUICK_REPLY", value: "option_1" },
        { id: "option_2", label: "Option 2", actionType: "QUICK_REPLY", value: "option_2" },
      ],
    },
    baseCapability: "ready",
  },
  {
    type: "message-list",
    label: "List Message",
    category: "Interactive",
    icon: "LI",
    description: "Send a WhatsApp interactive list with sections and rows.",
    channelSupport: { whatsapp: true, instagram: false, messenger: false, website: false },
    defaultData: {
      body: "Pick the best match",
      listButtonText: "Choose",
      listSections: [
        {
          id: "main",
          title: "Main options",
          rows: [
            { id: "lead_qualification", title: "Lead qualification", description: "Route this as a qualified lead" },
          ],
        },
      ],
    },
    baseCapability: "ready",
  },
  {
    type: "message-template",
    label: "Template Message",
    category: "Interactive",
    icon: "TP",
    description: "Send an approved WhatsApp template. Template approval is required.",
    channelSupport: { whatsapp: true, instagram: false, messenger: false, website: false },
    defaultData: { body: "Approved template placeholder", templateName: "" },
    baseCapability: "template_approval_required",
  },
  {
    type: "condition",
    label: "Condition",
    category: "Logic",
    icon: "IF",
    description: "Route users through true and false paths.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { conditionExpression: "incomingMessage contains pricing" },
    baseCapability: "ready",
  },
  {
    type: "intent-lookup",
    label: "Auth Intent Lookup",
    category: "Logic",
    icon: "OT",
    description: "Resolve the active public OTP/auth intent for the WhatsApp sender.",
    channelSupport: { whatsapp: true, instagram: false, messenger: false, website: false },
    defaultData: { body: "Find matching public auth intent", outputVariable: "auth_intent_status" },
    baseCapability: "builder_only",
  },
  {
    type: "assign-manager",
    label: "Assign Manager",
    category: "Actions",
    icon: "AM",
    description: "Assign the conversation to a manager or support queue.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { body: "Assign to manager", outputVariable: "support_queue" },
    baseCapability: "builder_only",
  },
  {
    type: "create-lead",
    label: "Create Lead",
    category: "Actions",
    icon: "LD",
    description: "Create a CRM lead from the conversation context.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { body: "Create lead from chat", outputVariable: "lead_id" },
    baseCapability: "integration_required",
  },
  {
    type: "api-request",
    label: "API Request",
    category: "Actions",
    icon: "API",
    description: "Call a reviewed server-side integration endpoint.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { apiMethod: "POST", apiUrl: "", outputVariable: "api_response" },
    baseCapability: "integration_required",
  },
  {
    type: "handoff",
    label: "Human Handoff",
    category: "Actions",
    icon: "HO",
    description: "Stop bot replies and transfer to a human queue.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { body: "I am connecting you with a Gigxomi specialist.", outputVariable: "support_queue" },
    baseCapability: "ready",
  },
  {
    type: "wait",
    label: "Wait",
    category: "Control",
    icon: "WT",
    description: "Pause execution until the scheduler resumes the run.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { waitSeconds: 60 },
    baseCapability: "builder_only",
  },
  {
    type: "stop",
    label: "Stop Flow",
    category: "Control",
    icon: "ST",
    description: "Complete the flow run.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { body: "Flow completed" },
    baseCapability: "ready",
  },
  {
    type: "ai-text-generation",
    label: "AI Reply",
    category: "AI",
    icon: "AI",
    description: "Generate a response from an approved AI adapter.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { aiProvider: "OPENAI", aiSystemPrompt: "", outputVariable: "ai_reply" },
    baseCapability: "builder_only",
  },
  {
    type: "meta-ai",
    label: "AI Intent Detection",
    category: "AI",
    icon: "ID",
    description: "Classify intent for routing through an approved AI adapter.",
    channelSupport: { whatsapp: true, instagram: true, messenger: true, website: true },
    defaultData: { aiProvider: "META_AI", aiSystemPrompt: "", outputVariable: "intent" },
    baseCapability: "builder_only",
  },
];

const NODE_BY_KIND = new Map(NODE_REGISTRY.map((definition) => [definition.type, definition]));
const TRIGGER_KINDS = new Set<SuperAdminWhatsAppFlowNodeKind>([
  "trigger-on-message",
  "trigger-keyword",
  "keyword-trigger",
  "trigger-button-reply",
  "trigger-list-reply",
]);
const CATEGORY_ORDER = ["Triggers", "Interactive", "Messages", "Logic", "Actions", "Control", "AI"];
const CONFIGURATION_ISSUE_CODES = new Set([
  "MISSING_KEYWORD",
  "MISSING_MESSAGE",
  "INVALID_BUTTON_COUNT",
  "MISSING_BUTTON_LABEL",
  "MISSING_BUTTON_PAYLOAD",
  "MISSING_BUTTON_ROUTE",
  "MISSING_LIST_ROWS",
  "LIST_ROW_LIMIT",
  "MISSING_LIST_BUTTON",
  "MISSING_SECTION_TITLE",
  "MISSING_ROW_PAYLOAD",
  "MISSING_LIST_ROUTE",
  "MISSING_TEMPLATE",
  "MISSING_CONDITION",
  "MISSING_API_URL",
  "MISSING_AI_PROMPT",
  "MISSING_HANDOFF_QUEUE",
]);
const CAPABILITY_BLOCKING_STATUSES = new Set<NodeCapabilityStatus>(["builder_only", "integration_required", "unsupported_in_runtime"]);

function capabilityCopy(status: NodeCapabilityStatus, definition?: NodeDefinition): NodeCapability {
  if (status === "ready") {
    return {
      status,
      label: "Ready",
      helper: "Supported by the builder and current WhatsApp runtime path.",
    };
  }
  if (status === "builder_only") {
    return {
      status,
      label: "Builder Only",
      helper: `${definition?.label ?? "This node"} can be configured visually, but execution still needs a backend adapter.`,
    };
  }
  if (status === "integration_required") {
    return {
      status,
      label: "Integration Required",
      helper: `${definition?.label ?? "This node"} requires server-side credentials, allowlists, or a connected service before publish.`,
    };
  }
  if (status === "template_approval_required") {
    return {
      status,
      label: "Template Approval Required",
      helper: "Use an approved WhatsApp template name before sending this node through Cloud API.",
    };
  }
  if (status === "configuration_required") {
    return {
      status,
      label: "Configuration Required",
      helper: "Complete the required fields highlighted in validation before publishing.",
    };
  }
  return {
    status,
    label: "Unsupported in Runtime",
    helper: `${definition?.label ?? "This node"} is not executable on the selected channel/runtime.`,
  };
}

function resolveNodeCapability(
  node: SuperAdminWhatsAppFlowNode,
  definition: NodeDefinition,
  nodeIssues: ValidationIssue[],
  channel: BuilderChannel,
): NodeCapability {
  if (!definition.channelSupport[channel]) return capabilityCopy("unsupported_in_runtime", definition);
  if (node.kind === "message-template") return capabilityCopy("template_approval_required", definition);
  const hasMissingConfiguration = nodeIssues.some((issue) => issue.severity === "error" && CONFIGURATION_ISSUE_CODES.has(issue.code));
  if (hasMissingConfiguration) return capabilityCopy("configuration_required", definition);
  return capabilityCopy(definition.baseCapability, definition);
}

function nodeCapabilityBlocksPublish(definition: NodeDefinition) {
  return CAPABILITY_BLOCKING_STATUSES.has(definition.baseCapability);
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatStatus(status: SuperAdminWhatsAppFlowStatus) {
  if (status === "ACTIVE") return "Active";
  if (status === "PAUSED") return "Paused";
  if (status === "ERROR") return "Error";
  return "Draft";
}

function statusClass(status: SuperAdminWhatsAppFlowStatus) {
  return status.toLowerCase();
}

function isProtectedSystemFlow(flow: SuperAdminWhatsAppFlow) {
  return flow.id === "flow-public-auth-otp";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved yet";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function createBuilderNode(kind: SuperAdminWhatsAppFlowNodeKind, position?: { x: number; y: number }): SuperAdminWhatsAppFlowNode {
  const definition = NODE_BY_KIND.get(kind);
  return {
    id: makeId("node"),
    kind,
    title: definition?.label ?? "Untitled node",
    body: "",
    position,
    waitSeconds: 0,
    buttons: [],
    conditionExpression: "",
    apiUrl: "",
    apiMethod: "POST",
    apiHeaders: "",
    apiBody: "",
    outputVariable: "",
    aiProvider: kind === "ai-text-generation" ? "OPENAI" : kind === "meta-ai" ? "META_AI" : undefined,
    aiSystemPrompt: "",
    aiUserPrompt: "",
    headerText: "",
    footerText: "",
    listButtonText: "Choose",
    listSections: [],
    templateName: "",
    templateLanguage: "en",
    templateBodyComponents: [],
    templateButtons: [],
    ...definition?.defaultData,
  } as SuperAdminWhatsAppFlowNode;
}

function createStarterNode() {
  return createBuilderNode("trigger-on-message", { x: 120, y: 120 });
}

function slugButtonPayload(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function buttonPayload(button: SuperAdminWhatsAppFlowNodeButton, index: number) {
  return slugButtonPayload(button.value || button.id || button.label, `option_${index + 1}`);
}

function buttonHandleId(button: SuperAdminWhatsAppFlowNodeButton, index: number) {
  return `button:${buttonPayload(button, index)}`;
}

function isHttpUrl(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function defaultButtonUrl(button: SuperAdminWhatsAppFlowNodeButton, index: number) {
  const value = button.value?.trim() || "";
  return /^https?:\/\//i.test(value) ? value : `https://example.com/${buttonPayload(button, index)}`;
}

function definitionFor(node: SuperAdminWhatsAppFlowNode) {
  return NODE_BY_KIND.get(node.kind) ?? NODE_REGISTRY[0];
}

function getSourceHandles(node: SuperAdminWhatsAppFlowNode) {
  if (node.kind === "stop" || node.kind === "handoff") return [];
  if (node.kind === "condition") {
    return [
      { id: "true", label: "True" },
      { id: "false", label: "False" },
    ];
  }
  if (node.kind === "message-button") {
    const buttons = node.buttons?.length ? node.buttons : [];
    return buttons
      .map((button, index) =>
        button.actionType === "URL"
          ? null
          : {
              id: buttonHandleId(button, index),
              label: button.label || `Button ${index + 1}`,
            },
      )
      .filter((handle): handle is { id: string; label: string } => Boolean(handle));
  }
  if (node.kind === "message-list") {
    const rows = (node.listSections ?? []).flatMap((section) => section.rows ?? []);
    return rows.length
      ? rows.map((row, index) => ({
          id: `row:${row.id || `row_${index + 1}`}`,
          label: row.title || `Row ${index + 1}`,
        }))
      : [{ id: "default", label: "Next" }];
  }
  return [{ id: "default", label: "Next" }];
}

function summarizeNode(node: SuperAdminWhatsAppFlowNode) {
  if (node.kind === "message-button") {
    const labels = (node.buttons ?? []).map((button) => button.label).filter(Boolean);
    return labels.length ? `Buttons: ${labels.join(", ")}` : "No buttons configured";
  }
  if (node.kind === "message-list") {
    const rowCount = (node.listSections ?? []).reduce((total, section) => total + (section.rows?.length ?? 0), 0);
    return `${rowCount} list row${rowCount === 1 ? "" : "s"}`;
  }
  if (node.kind === "condition") return node.conditionExpression || "No condition yet";
  if (node.kind === "api-request") return `${node.apiMethod ?? "POST"} ${node.apiUrl || "No URL"}`;
  if (node.kind === "ai-text-generation" || node.kind === "meta-ai") return node.aiSystemPrompt || node.body || "AI prompt missing";
  if (node.kind === "handoff" || node.kind === "assign-manager") return node.outputVariable || "Queue not set";
  if (node.kind === "wait") return `${node.waitSeconds || 0} seconds`;
  if (TRIGGER_KINDS.has(node.kind)) return node.body || "Trigger configured";
  return node.body || "Configure in inspector";
}

function validateFlow(flow: SuperAdminWhatsAppFlow, channel: BuilderChannel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(flow.nodes.map((node) => node.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const branchKeysBySource = new Map<string, Set<string>>();
  const edgesBySource = new Map<string, string[]>();

  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        code: "BROKEN_EDGE",
        severity: "error",
        message: "An edge references a missing source or target node.",
      });
      continue;
    }
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    branchKeysBySource.set(edge.source, new Set([...(branchKeysBySource.get(edge.source) ?? []), edge.branchKey || edge.label || "default"]));
    edgesBySource.set(edge.source, [...(edgesBySource.get(edge.source) ?? []), edge.target]);
  }

  const triggers = flow.nodes.filter((node) => TRIGGER_KINDS.has(node.kind));
  if (!triggers.length) {
    issues.push({
      code: "MISSING_TRIGGER",
      severity: "error",
      message: "Add at least one trigger node.",
    });
  }

  for (const trigger of triggers) {
    if (!outgoing.get(trigger.id)) {
      issues.push({
        code: "TRIGGER_NO_PATH",
        severity: "error",
        nodeId: trigger.id,
        message: `"${trigger.title}" needs an outgoing path.`,
      });
    }
    if ((trigger.kind === "keyword-trigger" || trigger.kind === "trigger-keyword") && !(trigger.body?.trim() || flow.triggerKeyword?.trim())) {
      issues.push({
        code: "MISSING_KEYWORD",
        severity: "error",
        nodeId: trigger.id,
        message: `"${trigger.title}" needs a keyword.`,
      });
    }
  }

  const reachable = new Set<string>();
  const markReachable = (nodeId: string) => {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    (edgesBySource.get(nodeId) ?? []).forEach(markReachable);
  };
  triggers.forEach((trigger) => markReachable(trigger.id));

  for (const node of flow.nodes) {
    const definition = definitionFor(node);
    if (!definition.channelSupport[channel]) {
      issues.push({
        code: "UNSUPPORTED_CHANNEL",
        severity: "error",
        nodeId: node.id,
        message: `${definition.label} is not supported on ${CHANNEL_LABELS[channel]}.`,
      });
    }

    if (nodeCapabilityBlocksPublish(definition)) {
      const capability = capabilityCopy(definition.baseCapability, definition);
      issues.push({
        code: "CAPABILITY_NOT_READY",
        severity: "error",
        nodeId: node.id,
        message: `${definition.label}: ${capability.helper}`,
      });
    }

    if ((node.kind === "message-text" || node.kind === "message-button" || node.kind === "message-list") && !node.body?.trim()) {
      issues.push({
        code: "MISSING_MESSAGE",
        severity: "error",
        nodeId: node.id,
        message: `"${node.title}" needs message text.`,
      });
    }

    if (node.kind === "message-button") {
      const buttons = node.buttons ?? [];
      if (buttons.length < 1 || buttons.length > 3) {
        issues.push({
          code: "INVALID_BUTTON_COUNT",
          severity: "error",
          nodeId: node.id,
          message: "WhatsApp buttons must have 1 to 3 reply buttons.",
        });
      }
      buttons.forEach((button, index) => {
        const payload = button.id?.trim() || button.value?.trim();
        if (!button.label?.trim()) {
          issues.push({
            code: "MISSING_BUTTON_LABEL",
            severity: "error",
            nodeId: node.id,
            message: `Button ${index + 1} needs a label.`,
          });
        }
        if (button.actionType === "URL") {
          if (!isHttpUrl(button.value)) {
            issues.push({
              code: "INVALID_BUTTON_URL",
              severity: "error",
              nodeId: node.id,
              message: `URL button "${button.label || index + 1}" needs a valid http(s) link.`,
            });
          }
          return;
        }
        if (!payload) {
          issues.push({
            code: "MISSING_BUTTON_PAYLOAD",
            severity: "error",
            nodeId: node.id,
            message: `Button ${index + 1} needs a stable payload.`,
          });
        }
        if (payload && !branchKeysBySource.get(node.id)?.has(`button:${payload}`)) {
          issues.push({
            code: "MISSING_BUTTON_ROUTE",
            severity: "error",
            nodeId: node.id,
            message: `Button "${button.label || payload}" needs a matching outgoing route.`,
          });
        }
      });
    }

    if (node.kind === "message-list") {
      const sections = node.listSections ?? [];
      const rowCount = sections.reduce((total, section) => total + (section.rows?.length ?? 0), 0);
      if (!sections.length || rowCount < 1) {
        issues.push({
          code: "MISSING_LIST_ROWS",
          severity: "error",
          nodeId: node.id,
          message: "List message needs at least one section and one row.",
        });
      }
      if (rowCount > 10) {
        issues.push({
          code: "LIST_ROW_LIMIT",
          severity: "error",
          nodeId: node.id,
          message: "WhatsApp list messages should stay within 10 rows.",
        });
      }
      if (!node.listButtonText?.trim()) {
        issues.push({
          code: "MISSING_LIST_BUTTON",
          severity: "error",
          nodeId: node.id,
          message: "List message needs button text.",
        });
      }
      sections.forEach((section, sectionIndex) => {
        if (!section.title?.trim()) {
          issues.push({
            code: "MISSING_SECTION_TITLE",
            severity: "error",
            nodeId: node.id,
            message: `List section ${sectionIndex + 1} needs a title.`,
          });
        }
        section.rows.forEach((row, rowIndex) => {
          if (!row.id?.trim() || !row.title?.trim()) {
            issues.push({
              code: "MISSING_ROW_PAYLOAD",
              severity: "error",
              nodeId: node.id,
              message: `List row ${rowIndex + 1} needs an id and title.`,
            });
          }
          if (row.id?.trim() && !branchKeysBySource.get(node.id)?.has(`row:${row.id.trim()}`)) {
            issues.push({
              code: "MISSING_LIST_ROUTE",
              severity: "error",
              nodeId: node.id,
              message: `List row "${row.title || row.id}" needs a matching outgoing route.`,
            });
          }
        });
      });
    }

    if (node.kind === "message-template" && !node.templateName?.trim()) {
      issues.push({
        code: "MISSING_TEMPLATE",
        severity: "error",
        nodeId: node.id,
        message: "Template message needs an approved template name.",
      });
    }

    if (node.kind === "condition") {
      if (!node.conditionExpression?.trim()) {
        issues.push({
          code: "MISSING_CONDITION",
          severity: "error",
          nodeId: node.id,
          message: "Condition node needs an expression.",
        });
      }
      const branches = new Set(flow.edges.filter((edge) => edge.source === node.id).map((edge) => edge.branchKey || edge.label || "default"));
      if (!branches.has("true") || !branches.has("false")) {
        issues.push({
          code: "MISSING_CONDITION_BRANCH",
          severity: "warning",
          nodeId: node.id,
          message: "Condition should have true and false paths.",
        });
      }
    }

    if (node.kind === "api-request" && (!node.apiMethod || !node.apiUrl?.trim())) {
      issues.push({
        code: "MISSING_API_URL",
        severity: "error",
        nodeId: node.id,
        message: "API request needs a method and URL.",
      });
    }

    if ((node.kind === "ai-text-generation" || node.kind === "meta-ai") && !(node.aiSystemPrompt?.trim() || node.aiUserPrompt?.trim() || node.body?.trim())) {
      issues.push({
        code: "MISSING_AI_PROMPT",
        severity: "error",
        nodeId: node.id,
        message: "AI node needs a prompt or knowledge source.",
      });
    }

    if ((node.kind === "handoff" || node.kind === "assign-manager") && !node.outputVariable?.trim()) {
      issues.push({
        code: "MISSING_HANDOFF_QUEUE",
        severity: "error",
        nodeId: node.id,
        message: "Handoff or manager assignment needs a queue/manager value.",
      });
    }

    if (!TRIGGER_KINDS.has(node.kind) && !reachable.has(node.id)) {
      issues.push({
        code: "UNREACHABLE_NODE",
        severity: "warning",
        nodeId: node.id,
        message: `"${node.title}" is unreachable from any trigger path.`,
      });
    }

    const terminal = node.kind === "stop" || node.kind === "handoff";
    if (!terminal && !outgoing.get(node.id)) {
      issues.push({
        code: "DEAD_END",
        severity: TRIGGER_KINDS.has(node.kind) ? "error" : "warning",
        nodeId: node.id,
        message: `"${node.title}" has no outgoing path. Add Stop Flow if this is intentional.`,
      });
    }
  }

  const visit = (nodeId: string, stack: string[], seen: Set<string>) => {
    if (stack.includes(nodeId)) {
      issues.push({
        code: "POTENTIAL_LOOP",
        severity: "warning",
        nodeId,
        message: "Potential loop detected. Add a wait, stop, or explicit exit condition.",
      });
      return;
    }
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const nextStack = [...stack, nodeId];
    (edgesBySource.get(nodeId) ?? []).forEach((target) => visit(target, nextStack, seen));
  };

  triggers.forEach((trigger) => visit(trigger.id, [], new Set<string>()));

  return issues;
}

function issuesByNode(issues: ValidationIssue[]) {
  const map = new Map<string, ValidationIssue[]>();
  issues.forEach((issue) => {
    if (!issue.nodeId) return;
    map.set(issue.nodeId, [...(map.get(issue.nodeId) ?? []), issue]);
  });
  return map;
}

function toCanvasNodes(
  flow: SuperAdminWhatsAppFlow,
  issues: ValidationIssue[],
  channel: BuilderChannel,
  options: { actionNodeId?: string | null } = {},
): FlowCanvasNode[] {
  const issueMap = issuesByNode(issues);
  return flow.nodes.map((node, index) => {
    const definition = definitionFor(node);
    const nodeIssues = issueMap.get(node.id) ?? [];
    return {
      id: node.id,
      type: "gigxomiNode",
      position: node.position ?? { x: 120 + index * 260, y: index % 2 === 0 ? 120 : 300 },
      data: {
        node,
        definition,
        issues: nodeIssues,
        capability: resolveNodeCapability(node, definition, nodeIssues, channel),
        actionMenuOpen: options.actionNodeId === node.id,
      },
    };
  });
}

function toCanvasEdges(flow: SuperAdminWhatsAppFlow): FlowCanvasEdge[] {
  return flow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.branchKey || "default",
    label: edge.label || (edge.branchKey && edge.branchKey !== "default" ? edge.branchKey : ""),
    type: "smoothstep",
    animated: edge.branchKey === "true" || edge.branchKey === "false",
    data: { branchKey: edge.branchKey || "default" },
    className: "wa-builder-edge",
  }));
}

function FlowNodeCard({ data, selected }: NodeProps<FlowCanvasNode>) {
  const { node, definition, issues, capability } = data;
  const handles = getSourceHandles(node);
  const hasError = issues.some((issue) => issue.severity === "error");
  const hasWarning = issues.some((issue) => issue.severity === "warning");
  const buttons = node.kind === "message-button" ? node.buttons ?? [] : [];

  const dispatchButtonAction = (
    action: NodeButtonAction,
    index?: number,
    value?: string,
    actionType?: SuperAdminWhatsAppFlowNodeButton["actionType"],
  ) => {
    window.dispatchEvent(new CustomEvent("gigxomi-wa-button-action", { detail: { nodeId: node.id, action, index, value, actionType } }));
  };

  return (
    <article className={`wa-builder-flow-node ${selected ? "selected" : ""} ${hasError ? "has-error" : hasWarning ? "has-warning" : ""}`}>
      <NodeToolbar className="wa-builder-node-toolbar" isVisible={selected || data.actionMenuOpen} position={Position.Top}>
        {(["edit", "duplicate", "add-next", "copy-id", "delete"] as NodeQuickAction[]).map((action) => (
          <button
            aria-label={`${action.replace("-", " ")} ${node.title || definition.label}`}
            className={action === "delete" ? "danger" : ""}
            key={action}
            onClick={(event) => {
              event.stopPropagation();
              window.dispatchEvent(new CustomEvent("gigxomi-wa-node-action", { detail: { nodeId: node.id, action } }));
            }}
            type="button"
          >
            {action === "add-next" ? "Add next" : action === "copy-id" ? "Copy ID" : action.charAt(0).toUpperCase() + action.slice(1)}
          </button>
        ))}
      </NodeToolbar>
      {!TRIGGER_KINDS.has(node.kind) ? <Handle className="wa-builder-handle wa-builder-handle-target" position={Position.Left} type="target" /> : null}
      <div className="wa-builder-node-head">
        <span className="wa-builder-node-icon">{definition.icon}</span>
        <div>
          <strong>{node.title || definition.label}</strong>
          <small>{definition.category}</small>
        </div>
      </div>
      <p className="wa-builder-node-summary">{summarizeNode(node)}</p>
      <div className="wa-builder-node-badges">
        <span>WhatsApp</span>
        <span className={`wa-builder-node-capability ${capability.status}`}>{capability.label}</span>
        {hasError ? <span className="wa-builder-node-issue error">Error</span> : hasWarning ? <span className="wa-builder-node-issue warning">Warning</span> : null}
      </div>
      {handles.length ? (
        <div className="wa-builder-node-options">
          {handles.map((handle, index) => (
            <span key={handle.id}>
              {handle.label}
              <Handle
                className="wa-builder-handle wa-builder-handle-source"
                id={handle.id}
                position={Position.Right}
                style={{ top: `${42 + index * 20}px` }}
                type="source"
              />
            </span>
          ))}
        </div>
      ) : null}
      {selected && node.kind === "message-button" ? (
        <div className="wa-builder-inline-button-editor nodrag nopan" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
          <div className="wa-builder-inline-button-editor-head">
            <strong>Edit buttons</strong>
            <button disabled={buttons.length >= 3} onClick={() => dispatchButtonAction("add-button")} type="button">
              + Button
            </button>
          </div>
          <p>Reply buttons can route to another node. Link buttons open a URL and do not show route dots.</p>
          <div className="wa-builder-inline-button-list">
            {buttons.map((button, index) => {
              const canRemove = buttons.length > 1;
              return (
                <div className="wa-builder-inline-button-row" key={`${button.id || button.value || index}-inline`}>
                  <input
                    aria-label={`Button ${index + 1} label`}
                    onChange={(event) => dispatchButtonAction("update-button-label", index, event.target.value)}
                    value={button.label}
                  />
                  <select
                    aria-label={`Button ${index + 1} type`}
                    onChange={(event) =>
                      dispatchButtonAction("update-button-type", index, undefined, event.target.value as SuperAdminWhatsAppFlowNodeButton["actionType"])
                    }
                    value={button.actionType}
                  >
                    <option value="QUICK_REPLY">Reply route</option>
                    <option value="URL">Open link</option>
                  </select>
                  <input
                    aria-label={button.actionType === "URL" ? `Button ${index + 1} link` : `Button ${index + 1} payload`}
                    onChange={(event) => dispatchButtonAction(button.actionType === "URL" ? "update-button-url" : "update-button-payload", index, event.target.value)}
                    placeholder={button.actionType === "URL" ? "https://example.com" : "route_payload"}
                    value={button.actionType === "URL" ? button.value : buttonPayload(button, index)}
                  />
                  <div className="wa-builder-inline-button-actions">
                    {button.actionType === "QUICK_REPLY" ? (
                      <button onClick={() => dispatchButtonAction("add-next-for-button", index)} type="button">
                        Add next
                      </button>
                    ) : null}
                    <button disabled={!canRemove} onClick={() => dispatchButtonAction("delete-button", index)} type="button">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function buildFlowFromCanvas(flow: SuperAdminWhatsAppFlow, canvasNodes: FlowCanvasNode[], canvasEdges: FlowCanvasEdge[]): SuperAdminWhatsAppFlow {
  const positionById = new Map(canvasNodes.map((node) => [node.id, node.position]));
  return {
    ...flow,
    nodes: flow.nodes.map((node) => ({
      ...node,
      position: positionById.get(node.id) ?? node.position,
    })),
    edges: canvasEdges
      .filter((edge) => edge.source && edge.target)
      .map((edge): SuperAdminWhatsAppFlowEdge => {
        const branchKey = typeof edge.data?.branchKey === "string" ? edge.data.branchKey : edge.sourceHandle || "default";
        return {
          id: edge.id || makeId("edge"),
          source: edge.source,
          target: edge.target,
          label: typeof edge.label === "string" ? edge.label : "",
          branchKey,
        };
      }),
  };
}

function groupNodeRegistry(nodes: NodeDefinition[]) {
  return nodes.reduce<Record<string, NodeDefinition[]>>((acc, node) => {
    acc[node.category] = [...(acc[node.category] ?? []), node];
    return acc;
  }, {});
}

function BuilderInner({
  agencies,
  flows,
  runs,
  fullScreen = false,
  initialFlowId,
  apiPath = "/api/super-admin/whatsapp-flows",
  fullViewBasePath = "/super-admin/whatsapp-flows",
  backHref = "/super-admin/whatsapp-flows",
}: Props) {
  const initialFlow = initialFlowId ? flows.find((flow) => flow.id === initialFlowId) ?? null : null;
  const [flowList, setFlowList] = useState<SuperAdminWhatsAppFlow[]>(flows);
  const [runList, setRunList] = useState<SuperAdminWhatsAppFlowRun[]>(runs);
  const [activeFlowId, setActiveFlowId] = useState(initialFlow?.id ?? "");
  const [view, setView] = useState<BuilderView>(fullScreen || initialFlow ? "builder" : "list");
  const [channel, setChannel] = useState<BuilderChannel>("whatsapp");
  const [activeTab, setActiveTab] = useState<BuilderTab>("inspector");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [quickActionNodeId, setQuickActionNodeId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renamingFlowId, setRenamingFlowId] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [testInput, setTestInput] = useState("hello");
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const reactFlow = useReactFlow();

  const activeFlow = useMemo(
    () => flowList.find((flow) => flow.id === activeFlowId) ?? initialFlow ?? null,
    [activeFlowId, flowList, initialFlow],
  );

  const initialIssues = activeFlow ? validateFlow(activeFlow, channel) : [];
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowCanvasNode>(activeFlow ? toCanvasNodes(activeFlow, initialIssues, channel) : []);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<FlowCanvasEdge>(activeFlow ? toCanvasEdges(activeFlow) : []);

  const nodeTypes = useMemo(() => ({ gigxomiNode: FlowNodeCard }), []);
  const issues = useMemo(
    () => (activeFlow ? validateFlow(buildFlowFromCanvas(activeFlow, nodes, edges), channel) : []),
    [activeFlow, channel, edges, nodes],
  );
  const issueSignature = useMemo(
    () => issues.map((issue) => `${issue.severity}:${issue.code}:${issue.nodeId ?? "flow"}:${issue.message}`).join("|"),
    [issues],
  );
  const blockingIssues = issues.filter((issue) => issue.severity === "error");
  const selectedNode = activeFlow?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = activeFlow?.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedDefinition = selectedNode ? definitionFor(selectedNode) : null;
  const flowRunCount = useMemo(
    () => new Map(flowList.map((flow) => [flow.id, runList.filter((run) => run.flowId === flow.id).length])),
    [flowList, runList],
  );
  const flowStats = useMemo(
    () => ({
      total: flowList.length,
      active: flowList.filter((flow) => flow.status === "ACTIVE").length,
      draft: flowList.filter((flow) => flow.status === "DRAFT").length,
      validationIssues: flowList.reduce((total, flow) => total + validateFlow(flow, "whatsapp").filter((issue) => issue.severity === "error").length, 0),
    }),
    [flowList],
  );

  const filteredRegistry = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return NODE_REGISTRY.filter((node) => {
      const supported = node.channelSupport[channel];
      const matches = !query || `${node.label} ${node.category} ${node.description}`.toLowerCase().includes(query);
      return matches && (supported || query.length > 0);
    });
  }, [channel, libraryQuery]);

  const groupedRegistry = useMemo(() => groupNodeRegistry(filteredRegistry), [filteredRegistry]);
  const registryCategories = useMemo(() => {
    const known = CATEGORY_ORDER.filter((category) => groupedRegistry[category]?.length);
    const custom = Object.keys(groupedRegistry).filter((category) => !CATEGORY_ORDER.includes(category));
    return [...known, ...custom];
  }, [groupedRegistry]);
  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!activeFlow) return;
    const issueMap = issuesByNode(issues);
    setNodes((current) => {
      let changed = false;
      const nextNodes = current.map((canvasNode) => {
        const flowNode = activeFlow.nodes.find((node) => node.id === canvasNode.id);
        if (!flowNode) return canvasNode;
        const definition = definitionFor(flowNode);
        const nodeIssues = issueMap.get(flowNode.id) ?? [];
        const capability = resolveNodeCapability(flowNode, definition, nodeIssues, channel);
        const actionMenuOpen = quickActionNodeId === flowNode.id;
        const currentData = canvasNode.data;
        const currentIssueKey = currentData.issues.map((issue) => `${issue.severity}:${issue.code}:${issue.message}`).join("|");
        const nextIssueKey = nodeIssues.map((issue) => `${issue.severity}:${issue.code}:${issue.message}`).join("|");
        if (
          currentData.node === flowNode &&
          currentData.definition === definition &&
          currentData.capability.status === capability.status &&
          currentData.actionMenuOpen === actionMenuOpen &&
          currentIssueKey === nextIssueKey
        ) {
          return canvasNode;
        }
        changed = true;
        return {
          ...canvasNode,
          data: {
            node: flowNode,
            definition,
            issues: nodeIssues,
            capability,
            actionMenuOpen,
          },
        };
      });
      return changed ? nextNodes : current;
    });
  }, [activeFlow, channel, issueSignature, issues, quickActionNodeId, setNodes]);

  const syncCanvas = useCallback(
    (flow: SuperAdminWhatsAppFlow, nextChannel = channel) => {
      const nextIssues = validateFlow(flow, nextChannel);
      setNodes(toCanvasNodes(flow, nextIssues, nextChannel));
      setEdges(toCanvasEdges(flow));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    [channel, setEdges, setNodes],
  );

  const patchActiveFlow = useCallback(
    (updater: (flow: SuperAdminWhatsAppFlow) => SuperAdminWhatsAppFlow, sync = false) => {
      if (!activeFlow) return;
      const nextFlow = updater(activeFlow);
      setFlowList((prev) => prev.map((flow) => (flow.id === nextFlow.id ? nextFlow : flow)));
      if (sync) syncCanvas(nextFlow);
    },
    [activeFlow, syncCanvas],
  );

  const openFlow = useCallback(
    (flowId: string) => {
      const flow = flowList.find((item) => item.id === flowId);
      if (!flow) {
        setStatusMessage("That flow could not be found.");
        return;
      }
      setActiveFlowId(flowId);
      setView("builder");
      syncCanvas(flow);
      setStatusMessage(`Opened ${flow.name}.`);
    },
    [flowList, syncCanvas],
  );

  const buildDefaultDraftPayload = useCallback((name = "Untitled WhatsApp Flow") => {
    const starter = createStarterNode();
    return {
      name,
      summary: "Draft WhatsApp chatbot flow.",
      status: "DRAFT" as SuperAdminWhatsAppFlowStatus,
      triggerMode: "ANY_INCOMING" as const,
      triggerKeyword: "",
      nodes: [starter],
      edges: [],
    };
  }, []);

  const postFlow = useCallback(async (payload: Partial<SuperAdminWhatsAppFlow>) => {
    const response = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as FlowApiResponse;
    if (!response.ok || !data.ok || !data.flow || !Array.isArray(data.flows)) {
      const apiErrors = data.errors?.map((error) => error.message).join(" ");
      throw new Error(apiErrors || data.error || "Flow save failed.");
    }
    setFlowList(data.flows);
    if (Array.isArray(data.runs)) setRunList(data.runs);
    return data.flow;
  }, [apiPath]);

  const refreshFromApiResponse = useCallback((data: FlowApiResponse) => {
    if (Array.isArray(data.flows)) setFlowList(data.flows);
    if (Array.isArray(data.runs)) setRunList(data.runs);
    if (data.flow) {
      setRenameDrafts((prev) => ({ ...prev, [data.flow!.id]: data.flow!.name }));
    }
  }, []);

  const renameFlow = useCallback(
    async (flow: SuperAdminWhatsAppFlow, nextName: string) => {
      const trimmedName = nextName.trim();
      if (!trimmedName) {
        setRenameDrafts((prev) => ({ ...prev, [flow.id]: flow.name }));
        setStatusMessage("Flow name cannot be empty.");
        return;
      }
      if (trimmedName === flow.name) return;

      setRenamingFlowId(flow.id);
      setStatusMessage("Updating flow name...");
      try {
        const response = await fetch(apiPath, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: flow.id, name: trimmedName }),
        });
        const data = (await response.json().catch(() => ({}))) as FlowApiResponse;
        if (!response.ok || !data.ok || !data.flow) throw new Error(data.error || "Flow rename failed.");
        refreshFromApiResponse(data);
        if (activeFlowId === flow.id) {
          setActiveFlowId(flow.id);
          syncCanvas(data.flow);
        }
        setStatusMessage("Flow name updated.");
      } catch (error) {
        setRenameDrafts((prev) => ({ ...prev, [flow.id]: flow.name }));
        setStatusMessage(error instanceof Error ? error.message : "Flow rename failed.");
      } finally {
        setRenamingFlowId(null);
      }
    },
    [activeFlowId, apiPath, refreshFromApiResponse, syncCanvas],
  );

  const deleteFlow = useCallback(
    async (flow: SuperAdminWhatsAppFlow) => {
      if (isProtectedSystemFlow(flow)) {
        setStatusMessage("The public OTP handoff flow is protected and cannot be deleted.");
        return;
      }

      const confirmed = window.confirm(`Delete "${flow.name}"?\n\nThis action cannot be undone.`);
      if (!confirmed) return;

      setDeletingFlowId(flow.id);
      setStatusMessage("Deleting flow...");
      try {
        const response = await fetch(apiPath, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: flow.id }),
        });
        const data = (await response.json().catch(() => ({}))) as FlowApiResponse;
        if (!response.ok || !data.ok) throw new Error(data.error || "Flow delete failed.");
        refreshFromApiResponse(data);
        setRenameDrafts((prev) => {
          const next = { ...prev };
          delete next[flow.id];
          return next;
        });
        if (activeFlowId === flow.id) {
          setActiveFlowId("");
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setView("list");
        }
        setStatusMessage("Flow deleted.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Flow delete failed.");
      } finally {
        setDeletingFlowId(null);
      }
    },
    [activeFlowId, apiPath, refreshFromApiResponse],
  );

  const createNewFlow = useCallback(async () => {
    setCreating(true);
    setStatusMessage("Creating draft flow...");
    try {
      const flow = await postFlow(buildDefaultDraftPayload());
      setActiveFlowId(flow.id);
      setRenameDrafts((prev) => ({ ...prev, [flow.id]: flow.name }));
      setView("builder");
      syncCanvas(flow);
      setStatusMessage("Draft created. Add a message node and connect it before publishing.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "New flow failed.");
    } finally {
      setCreating(false);
    }
  }, [buildDefaultDraftPayload, postFlow, syncCanvas]);

  const duplicateFlow = useCallback(
    async (flow: SuperAdminWhatsAppFlow) => {
      setCreating(true);
      setStatusMessage("Duplicating flow...");
      try {
        const idMap = new Map(flow.nodes.map((node) => [node.id, makeId("node")]));
        const duplicated = await postFlow({
          ...flow,
          id: undefined,
          name: `${flow.name} copy`,
          status: "DRAFT",
          pluginStatus: "INTERNAL_ONLY",
          nodes: flow.nodes.map((node) => ({ ...node, id: idMap.get(node.id) ?? makeId("node") })),
          edges: flow.edges.map((edge) => ({
            ...edge,
            id: makeId("edge"),
            source: idMap.get(edge.source) ?? edge.source,
            target: idMap.get(edge.target) ?? edge.target,
          })),
        });
        setActiveFlowId(duplicated.id);
        setRenameDrafts((prev) => ({ ...prev, [duplicated.id]: duplicated.name }));
        setView("builder");
        syncCanvas(duplicated);
        setStatusMessage("Duplicated as a draft.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Duplicate failed.");
      } finally {
        setCreating(false);
      }
    },
    [postFlow, syncCanvas],
  );

  const refreshNodeBadges = useCallback(
    (flow: SuperAdminWhatsAppFlow) => {
      const nextIssues = validateFlow(buildFlowFromCanvas(flow, nodes, edges), channel);
      const issueMap = issuesByNode(nextIssues);
      setNodes((current) =>
        current.map((node) => {
          const flowNode = flow.nodes.find((item) => item.id === node.id);
          if (!flowNode) return node;
          const definition = definitionFor(flowNode);
          const nodeIssues = issueMap.get(flowNode.id) ?? [];
          return {
            ...node,
            data: {
              node: flowNode,
              definition,
              issues: nodeIssues,
              capability: resolveNodeCapability(flowNode, definition, nodeIssues, channel),
              actionMenuOpen: quickActionNodeId === flowNode.id,
            },
          };
        }),
      );
    },
    [channel, edges, nodes, quickActionNodeId, setNodes],
  );

  const updateFlowNode = useCallback(
    (nodeId: string, patch: Partial<SuperAdminWhatsAppFlowNode>) => {
      patchActiveFlow((flow) => {
        const nextFlow = {
          ...flow,
          nodes: flow.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
        };
        refreshNodeBadges(nextFlow);
        return nextFlow;
      });
    },
    [patchActiveFlow, refreshNodeBadges],
  );

  const updateFlowName = useCallback(
    (name: string) => {
      patchActiveFlow((flow) => ({ ...flow, name }));
    },
    [patchActiveFlow],
  );

  const addNodeToFlow = useCallback(
    (kind: SuperAdminWhatsAppFlowNodeKind, position?: { x: number; y: number }) => {
      const definition = NODE_BY_KIND.get(kind);
      if (!activeFlow || !definition) return;
      if (!definition.channelSupport[channel]) {
        setStatusMessage(`${definition.label} is not supported on ${CHANNEL_LABELS[channel]}.`);
        return;
      }
      const nextNode = createBuilderNode(kind, position ?? { x: 180 + nodes.length * 34, y: 180 + nodes.length * 28 });
      const nextFlow = { ...activeFlow, nodes: [...activeFlow.nodes, nextNode] };
      setFlowList((prev) => prev.map((flow) => (flow.id === activeFlow.id ? nextFlow : flow)));
      const nextIssues = validateFlow(nextFlow, channel);
      const issueMap = issuesByNode(nextIssues);
      const nodeIssues = issueMap.get(nextNode.id) ?? [];
      setNodes((current) => [
        ...current,
        {
          id: nextNode.id,
          type: "gigxomiNode",
          position: nextNode.position ?? { x: 180, y: 180 },
          data: {
            node: nextNode,
            definition,
            issues: nodeIssues,
            capability: resolveNodeCapability(nextNode, definition, nodeIssues, channel),
            actionMenuOpen: quickActionNodeId === nextNode.id,
          },
        },
      ]);
      setSelectedNodeId(nextNode.id);
      setSelectedEdgeId(null);
      setActiveTab("inspector");
    },
    [activeFlow, channel, nodes.length, quickActionNodeId, setNodes],
  );

  const selectCanvasNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
    },
    [setNodes],
  );

  const deleteNodeById = useCallback(
    (nodeId: string, confirmDelete = true) => {
      if (!activeFlow) return;
      const target = activeFlow.nodes.find((node) => node.id === nodeId);
      if (!target) return;

      if (confirmDelete) {
        const confirmed = window.confirm("Delete this node?\n\nThis will also remove connected edges if required.");
        if (!confirmed) return;
      }

      const nextFlow = {
        ...activeFlow,
        nodes: activeFlow.nodes.filter((node) => node.id !== nodeId),
        edges: activeFlow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      };
      setFlowList((prev) => prev.map((flow) => (flow.id === activeFlow.id ? nextFlow : flow)));
      setQuickActionNodeId(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      syncCanvas(nextFlow);
      setStatusMessage(`Deleted "${target.title || "node"}" and removed connected edges.`);
    },
    [activeFlow, syncCanvas],
  );

  const duplicateNodeById = useCallback(
    (nodeId: string) => {
      if (!activeFlow) return;
      const source = activeFlow.nodes.find((node) => node.id === nodeId);
      const sourceCanvasNode = nodes.find((node) => node.id === nodeId);
      if (!source) return;

      const duplicate: SuperAdminWhatsAppFlowNode = {
        ...structuredClone(source),
        id: makeId("node"),
        title: `${source.title || definitionFor(source).label} copy`,
        position: {
          x: (sourceCanvasNode?.position.x ?? source.position?.x ?? 160) + 44,
          y: (sourceCanvasNode?.position.y ?? source.position?.y ?? 160) + 44,
        },
      };
      const nextFlow = { ...activeFlow, nodes: [...activeFlow.nodes, duplicate] };
      setFlowList((prev) => prev.map((flow) => (flow.id === activeFlow.id ? nextFlow : flow)));
      syncCanvas(nextFlow);
      selectCanvasNode(duplicate.id);
      setQuickActionNodeId(duplicate.id);
      setActiveTab("inspector");
      setStatusMessage(`Duplicated "${source.title || "node"}".`);
    },
    [activeFlow, nodes, selectCanvasNode, syncCanvas],
  );

  const addNextNodeFrom = useCallback(
    (nodeId: string) => {
      if (!activeFlow) return;
      const source = activeFlow.nodes.find((node) => node.id === nodeId);
      const sourceCanvasNode = nodes.find((node) => node.id === nodeId);
      if (!source) return;

      const handle = getSourceHandles(source)[0];
      if (!handle) {
        setStatusMessage("This terminal node cannot add a next step.");
        return;
      }

      const nextNode = createBuilderNode("message-text", {
        x: (sourceCanvasNode?.position.x ?? source.position?.x ?? 180) + 300,
        y: sourceCanvasNode?.position.y ?? source.position?.y ?? 180,
      });
      const nextEdge: SuperAdminWhatsAppFlowEdge = {
        id: makeId("edge"),
        source: source.id,
        target: nextNode.id,
        branchKey: handle.id,
        label: handle.id !== "default" ? handle.label : "",
      };
      const nextFlow = {
        ...activeFlow,
        nodes: [...activeFlow.nodes, nextNode],
        edges: [...activeFlow.edges, nextEdge],
      };
      setFlowList((prev) => prev.map((flow) => (flow.id === activeFlow.id ? nextFlow : flow)));
      syncCanvas(nextFlow);
      selectCanvasNode(nextNode.id);
      setQuickActionNodeId(nextNode.id);
      setActiveTab("inspector");
      setStatusMessage(`Added a text message after "${source.title || "node"}".`);
    },
    [activeFlow, nodes, selectCanvasNode, syncCanvas],
  );

  const handleNodeAction = useCallback(
    async (nodeId: string, action: NodeQuickAction) => {
      selectCanvasNode(nodeId);
      setQuickActionNodeId(nodeId);
      if (action === "edit") {
        setActiveTab("inspector");
        return;
      }
      if (action === "duplicate") {
        duplicateNodeById(nodeId);
        return;
      }
      if (action === "add-next") {
        addNextNodeFrom(nodeId);
        return;
      }
      if (action === "delete") {
        deleteNodeById(nodeId);
        return;
      }
      if (action === "copy-id") {
        await navigator.clipboard?.writeText(nodeId).catch(() => undefined);
        setStatusMessage("Node id copied.");
      }
    },
    [addNextNodeFrom, deleteNodeById, duplicateNodeById, selectCanvasNode],
  );

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string; action?: NodeQuickAction }>).detail;
      if (!detail?.nodeId || !detail.action) return;
      void handleNodeAction(detail.nodeId, detail.action);
    };
    window.addEventListener("gigxomi-wa-node-action", listener);
    return () => window.removeEventListener("gigxomi-wa-node-action", listener);
  }, [handleNodeAction]);

  const handleButtonAction = useCallback(
    (detail: {
      nodeId?: string;
      action?: NodeButtonAction;
      index?: number;
      value?: string;
      actionType?: SuperAdminWhatsAppFlowNodeButton["actionType"];
    }) => {
      if (!activeFlow || !detail.nodeId || !detail.action) return;
      const source = activeFlow.nodes.find((node) => node.id === detail.nodeId);
      if (!source || source.kind !== "message-button") return;
      const buttons = source.buttons ?? [];
      const index = Number.isInteger(detail.index) ? Number(detail.index) : -1;

      const updateButtons = (nextButtons: SuperAdminWhatsAppFlowNodeButton[], nextEdges = activeFlow.edges) => {
        const nextFlow = {
          ...activeFlow,
          nodes: activeFlow.nodes.map((node) => (node.id === source.id ? { ...node, buttons: nextButtons } : node)),
          edges: nextEdges,
        };
        setFlowList((prev) => prev.map((flow) => (flow.id === nextFlow.id ? nextFlow : flow)));
        syncCanvas(nextFlow);
        selectCanvasNode(source.id);
        setQuickActionNodeId(source.id);
        setActiveTab("inspector");
      };

      if (detail.action === "add-button") {
        if (buttons.length >= 3) {
          setStatusMessage("WhatsApp allows up to 3 buttons on this node.");
          return;
        }
        const nextIndex = buttons.length;
        updateButtons([
          ...buttons,
          {
            id: `option_${nextIndex + 1}`,
            label: `Option ${nextIndex + 1}`,
            actionType: "QUICK_REPLY",
            value: `option_${nextIndex + 1}`,
          },
        ]);
        return;
      }

      if (index < 0 || !buttons[index]) return;
      const currentButton = buttons[index];
      const previousHandle = buttonHandleId(currentButton, index);

      if (detail.action === "delete-button") {
        if (buttons.length <= 1) {
          setStatusMessage("Keep at least one button on a button message node.");
          return;
        }
        updateButtons(
          buttons.filter((_, buttonIndex) => buttonIndex !== index),
          activeFlow.edges.filter((edge) => !(edge.source === source.id && edge.branchKey === previousHandle)),
        );
        return;
      }

      if (detail.action === "add-next-for-button") {
        if (currentButton.actionType === "URL") {
          setStatusMessage("Link buttons open a URL and do not route to a next node.");
          return;
        }
        const sourceCanvasNode = nodes.find((node) => node.id === source.id);
        const nextNode = createBuilderNode("message-text", {
          x: (sourceCanvasNode?.position.x ?? source.position?.x ?? 180) + 320,
          y: (sourceCanvasNode?.position.y ?? source.position?.y ?? 180) + 44 + index * 24,
        });
        const branchKey = buttonHandleId(currentButton, index);
        const nextFlow = {
          ...activeFlow,
          nodes: [...activeFlow.nodes, nextNode],
          edges: [
            ...activeFlow.edges.filter((edge) => !(edge.source === source.id && edge.branchKey === branchKey)),
            {
              id: makeId("edge"),
              source: source.id,
              target: nextNode.id,
              branchKey,
              label: currentButton.label || currentButton.value || currentButton.id,
            },
          ],
        };
        setFlowList((prev) => prev.map((flow) => (flow.id === nextFlow.id ? nextFlow : flow)));
        syncCanvas(nextFlow);
        selectCanvasNode(nextNode.id);
        setQuickActionNodeId(nextNode.id);
        setActiveTab("inspector");
        return;
      }

      const nextButtons: SuperAdminWhatsAppFlowNodeButton[] = buttons.map((button, buttonIndex): SuperAdminWhatsAppFlowNodeButton => {
        if (buttonIndex !== index) return button;
        if (detail.action === "update-button-label") return { ...button, label: detail.value ?? "" };
        if (detail.action === "update-button-payload") {
          const value = slugButtonPayload(detail.value ?? "", `option_${index + 1}`);
          return { ...button, id: value, value };
        }
        if (detail.action === "update-button-url") return { ...button, value: detail.value ?? "" };
        if (detail.action === "update-button-type") {
          const actionType: SuperAdminWhatsAppFlowNodeButton["actionType"] = detail.actionType === "URL" ? "URL" : "QUICK_REPLY";
          const value = actionType === "URL" ? defaultButtonUrl(button, index) : buttonPayload(button, index);
          return { ...button, actionType, id: actionType === "URL" ? button.id || `url_${index + 1}` : value, value };
        }
        return button;
      });
      const nextButton = nextButtons[index];
      const nextHandle = nextButton.actionType === "QUICK_REPLY" ? buttonHandleId(nextButton, index) : "";
      const nextEdges =
        detail.action === "update-button-type" && nextButton.actionType === "URL"
          ? activeFlow.edges.filter((edge) => !(edge.source === source.id && edge.branchKey === previousHandle))
          : activeFlow.edges.map((edge) =>
              edge.source === source.id && edge.branchKey === previousHandle
                ? { ...edge, branchKey: nextHandle || previousHandle, label: nextButton.label || nextButton.value || nextButton.id }
                : edge,
            );
      updateButtons(nextButtons, nextEdges);
    },
    [activeFlow, nodes, selectCanvasNode, syncCanvas],
  );

  useEffect(() => {
    const listener = (event: Event) => {
      handleButtonAction((event as CustomEvent<Parameters<typeof handleButtonAction>[0]>).detail ?? {});
    };
    window.addEventListener("gigxomi-wa-button-action", listener);
    return () => window.removeEventListener("gigxomi-wa-button-action", listener);
  }, [handleButtonAction]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!activeFlow || !connection.source || !connection.target) return;
      const edgeId = makeId("edge");
      const branchKey = connection.sourceHandle || "default";
      const nextEdge: SuperAdminWhatsAppFlowEdge = {
        id: edgeId,
        source: connection.source,
        target: connection.target,
        branchKey,
        label: branchKey !== "default" ? branchKey : "",
      };
      patchActiveFlow((flow) => ({
        ...flow,
        edges: [...flow.edges, nextEdge],
      }));
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: edgeId,
            type: "smoothstep",
            label: nextEdge.label,
            data: { branchKey },
            className: "wa-builder-edge",
          },
          current,
        ),
      );
    },
    [activeFlow, patchActiveFlow, setEdges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowCanvasNode>[]) => {
      onNodesChangeBase(changes);
      const removedIds = changes.filter((change) => change.type === "remove").map((change) => change.id);
      if (removedIds.length) {
        patchActiveFlow((flow) => ({
          ...flow,
          nodes: flow.nodes.filter((node) => !removedIds.includes(node.id)),
          edges: flow.edges.filter((edge) => !removedIds.includes(edge.source) && !removedIds.includes(edge.target)),
        }));
      }
    },
    [onNodesChangeBase, patchActiveFlow],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowCanvasEdge>[]) => {
      onEdgesChangeBase(changes);
      const removedIds = changes.filter((change) => change.type === "remove").map((change) => change.id);
      if (removedIds.length) {
        patchActiveFlow((flow) => ({
          ...flow,
          edges: flow.edges.filter((edge) => !removedIds.includes(edge.id)),
        }));
      }
    },
    [onEdgesChangeBase, patchActiveFlow],
  );

  const saveFlow = useCallback(
    async (publish: boolean) => {
      if (!activeFlow) return;
      const payload = buildFlowFromCanvas(activeFlow, nodes, edges);
      if (!payload.name.trim()) {
        setStatusMessage("Flow name cannot be empty.");
        return;
      }
      const nextIssues = validateFlow(payload, channel);
      const nextBlocking = nextIssues.filter((issue) => issue.severity === "error");
      if (publish && nextBlocking.length) {
        setActiveTab("validation");
        setStatusMessage(`Publish blocked by ${nextBlocking.length} validation issue${nextBlocking.length === 1 ? "" : "s"}.`);
        return;
      }

      setSaving(true);
      setStatusMessage(publish ? "Publishing flow..." : "Saving draft...");
      try {
        const flow = await postFlow({
          ...payload,
          status: publish ? "ACTIVE" : "DRAFT",
          pluginStatus: publish ? "READY_TO_DEPLOY" : payload.pluginStatus,
        });
        setActiveFlowId(flow.id);
        syncCanvas(flow);
        setStatusMessage(publish ? "Flow published as Active." : "Draft saved.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Save failed.");
      } finally {
        setSaving(false);
      }
    },
    [activeFlow, channel, edges, nodes, postFlow, syncCanvas],
  );

  const validateCurrentFlow = useCallback(() => {
    if (!activeFlow) return;
    setActiveTab("validation");
    const errorCount = blockingIssues.length;
    setStatusMessage(errorCount ? `Validation found ${errorCount} blocking issue${errorCount === 1 ? "" : "s"}.` : "Validation passed.");
    refreshNodeBadges(buildFlowFromCanvas(activeFlow, nodes, edges));
  }, [activeFlow, blockingIssues.length, edges, nodes, refreshNodeBadges]);

  const fitCanvas = useCallback(() => {
    reactFlow.fitView({ padding: 0.24, duration: 320 });
  }, [reactFlow]);

  const deleteSelected = useCallback(() => {
    if (!activeFlow) return;
    if (!selectedNodeId && !selectedEdgeId) {
      setStatusMessage("Select a node or edge before deleting.");
      return;
    }
    if (selectedNodeId) {
      deleteNodeById(selectedNodeId);
      return;
    }
    const confirmed = window.confirm("Delete this edge?");
    if (!confirmed) return;
    const nextFlow = {
      ...activeFlow,
      edges: activeFlow.edges.filter((edge) => edge.id !== selectedEdgeId),
    };
    setFlowList((prev) => prev.map((flow) => (flow.id === activeFlow.id ? nextFlow : flow)));
    syncCanvas(nextFlow);
    setStatusMessage("Selected edge deleted from the draft canvas.");
  }, [activeFlow, deleteNodeById, selectedEdgeId, selectedNodeId, syncCanvas]);

  const updateSelectedEdge = useCallback(
    (patch: Partial<SuperAdminWhatsAppFlowEdge>) => {
      if (!selectedEdgeId) return;
      patchActiveFlow(
        (flow) => ({
          ...flow,
          edges: flow.edges.map((edge) => (edge.id === selectedEdgeId ? { ...edge, ...patch } : edge)),
        }),
        true,
      );
    },
    [patchActiveFlow, selectedEdgeId],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: FlowCanvasNode) => {
      updateFlowNode(node.id, { position: node.position });
    },
    [updateFlowNode],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/gigxomi-node") as SuperAdminWhatsAppFlowNodeKind;
      if (!kind) return;
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNodeToFlow(kind, position);
    },
    [addNodeToFlow, reactFlow],
  );

  const onCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a")) return;
      event.preventDefault();
      deleteSelected();
    },
    [deleteSelected],
  );

  const runSimulation = useCallback(() => {
    if (!activeFlow) return;
    const flow = buildFlowFromCanvas(activeFlow, nodes, edges);
    const log: string[] = [`User: ${testInput || "(empty message)"}`];
    const trigger =
      flow.nodes.find((node) => node.kind === "keyword-trigger" && testInput.toLowerCase().includes((node.body || "").toLowerCase())) ??
      flow.nodes.find((node) => node.kind === "trigger-on-message") ??
      flow.nodes.find((node) => TRIGGER_KINDS.has(node.kind));

    if (!trigger) {
      setSimulationLog(["No trigger node is available for this sample message."]);
      return;
    }

    let current: SuperAdminWhatsAppFlowNode | null = trigger;
    const seen = new Set<string>();
    let steps = 0;
    while (current && steps < 20 && !seen.has(current.id)) {
      seen.add(current.id);
      steps += 1;
      const definition = definitionFor(current);
      const capability = capabilityCopy(definition.baseCapability, definition);
      log.push(`${current.title} -> ${capability.status === "ready" ? summarizeNode(current) : capability.label}`);
      if (current.kind === "message-text") log.push(`Bot preview: ${current.body}`);
      if (current.kind === "message-button") log.push(`Bot buttons: ${(current.buttons ?? []).map((button) => button.label).join(", ") || "none"}`);
      if (current.kind === "message-list") log.push("List reply waits for a real user selection.");
      if (current.kind === "condition") log.push(`Condition shell: ${current.conditionExpression || "not configured"}`);
      if (current.kind === "stop" || current.kind === "handoff" || capability.status !== "ready") break;
      const nextEdge = flow.edges.find((edge) => edge.source === current?.id);
      current = nextEdge ? flow.nodes.find((node) => node.id === nextEdge.target) ?? null : null;
    }

    if (steps >= 20) log.push("Simulation stopped at 20 steps to avoid loops.");
    log.push("Runtime backend not connected yet for advanced API, scheduler, CRM, and AI actions.");
    setSimulationLog(log);
  }, [activeFlow, edges, nodes, testInput]);

  const renderListView = () => (
    <section className="wa-builder-list">
      <div className="wa-builder-list-header">
        <div>
          <p className="section-label">Automation studio</p>
          <h2>WhatsApp Flows</h2>
          <p className="gx-muted-text">
            Create, open, validate, and publish official WhatsApp chatbot flows. Instagram and Messenger stay future-ready through official Meta APIs only.
          </p>
        </div>
        <div className="wa-builder-list-actions">
          <span className="wa-builder-channel-badge">WhatsApp first</span>
          <button className="ui-button-primary" disabled={creating} onClick={createNewFlow} type="button">
            <Plus size={15} />
            New Flow
          </button>
        </div>
      </div>

      <div className="wa-builder-stat-strip" aria-label="WhatsApp flow summary">
        <div>
          <span>Total flows</span>
          <strong>{flowStats.total}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{flowStats.active}</strong>
        </div>
        <div>
          <span>Draft</span>
          <strong>{flowStats.draft}</strong>
        </div>
        <div className={flowStats.validationIssues ? "has-issues" : ""}>
          <span>Validation issues</span>
          <strong>{flowStats.validationIssues}</strong>
        </div>
      </div>

      {flowList.length ? (
        <div className="wa-builder-flow-table">
          {flowList.map((flow) => {
            const flowIssues = validateFlow(flow, "whatsapp");
            const flowErrors = flowIssues.filter((issue) => issue.severity === "error").length;
            const protectedFlow = isProtectedSystemFlow(flow);
            const renameValue = renameDrafts[flow.id] ?? flow.name;
            return (
              <article className="wa-builder-flow-card" key={flow.id}>
                <div className="wa-builder-flow-main">
                  <div>
                    <span className={`wa-builder-status-badge ${statusClass(flow.status)}`}>{formatStatus(flow.status)}</span>
                    <label className="wa-builder-flow-rename">
                      <span className="sr-only">Flow name</span>
                      <input
                        aria-label={`Rename ${flow.name}`}
                        disabled={renamingFlowId === flow.id}
                        onBlur={() => renameFlow(flow, renameValue)}
                        onChange={(event) => setRenameDrafts((prev) => ({ ...prev, [flow.id]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                          if (event.key === "Escape") {
                            setRenameDrafts((prev) => ({ ...prev, [flow.id]: flow.name }));
                            event.currentTarget.blur();
                          }
                        }}
                        value={renameValue}
                      />
                    </label>
                    <p>{flow.summary}</p>
                  </div>
                  <div className="wa-builder-flow-meta">
                    <span>Channel: WhatsApp</span>
                    <span>Updated: {formatUpdatedAt(flow.updatedAt)}</span>
                    <span>{flowErrors ? `${flowErrors} validation errors` : "Validation ready"}</span>
                    <span>{flowRunCount.get(flow.id) ?? 0} run records</span>
                  </div>
                </div>
                <div className="wa-builder-flow-actions">
                  <button className="ui-button-secondary" onClick={() => openFlow(flow.id)} type="button">
                    Open
                  </button>
                  {fullViewBasePath ? (
                    <Link className="ui-button-secondary" href={`${fullViewBasePath}/${flow.id}/builder`} rel="noreferrer" target="_blank">
                      <Maximize2 size={14} />
                      Full View
                    </Link>
                  ) : null}
                  <button className="ui-button-secondary" disabled={creating} onClick={() => duplicateFlow(flow)} type="button">
                    <Copy size={14} />
                    Duplicate
                  </button>
                  <button
                    className="ui-button-ghost wa-builder-list-delete"
                    disabled={protectedFlow || deletingFlowId === flow.id}
                    onClick={() => deleteFlow(flow)}
                    title={protectedFlow ? "Protected system OTP flow" : "Delete flow"}
                    type="button"
                  >
                    <Trash2 size={14} />
                    {deletingFlowId === flow.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="wa-builder-empty-state">
          <span className="wa-builder-empty-icon">WA</span>
          <h3>No chatbot flows yet</h3>
          <p>Create your first flow to start building the Gigxomi WhatsApp automation runtime path.</p>
          <button className="ui-button-primary" disabled={creating} onClick={createNewFlow} type="button">
            <Plus size={15} />
            Create your first flow
          </button>
        </div>
      )}

      {statusMessage ? <p className="wa-builder-release-message">{statusMessage}</p> : null}
    </section>
  );

  const renderInspector = () => {
    if (!selectedNode && !selectedEdge) {
      return (
        <div className="wa-builder-pane-card wa-builder-empty-inspector">
          <Bot size={22} />
          <h3>No node selected</h3>
          <p className="gx-muted-text">Select a node or edge to edit message copy, routes, payloads, and runtime settings.</p>
        </div>
      );
    }

    if (selectedEdge) {
      return (
        <div className="wa-builder-pane-card">
          <p className="section-label">Edge mapping</p>
          <label className="field-card">
            <span className="field-card__label">Branch key</span>
            <input className="field-card__input" onChange={(event) => updateSelectedEdge({ branchKey: event.target.value })} value={selectedEdge.branchKey ?? ""} />
          </label>
          <label className="field-card">
            <span className="field-card__label">Label</span>
            <input className="field-card__input" onChange={(event) => updateSelectedEdge({ label: event.target.value })} value={selectedEdge.label ?? ""} />
          </label>
          <p className="gx-muted-text">For buttons and list rows, keep the branch key aligned to the payload id, for example button:option_1 or row:lead_qualification.</p>
        </div>
      );
    }

    if (!selectedNode || !selectedDefinition) return null;

    const nodeIssues = issues.filter((issue) => issue.nodeId === selectedNode.id);
    const capability = resolveNodeCapability(selectedNode, selectedDefinition, nodeIssues, channel);
    const patch = (next: Partial<SuperAdminWhatsAppFlowNode>) => updateFlowNode(selectedNode.id, next);

    return (
      <div className="wa-builder-pane-card wa-builder-inspector">
        <div>
          <p className="section-label">Inspector</p>
          <h3>{selectedDefinition.label}</h3>
          <p className="gx-muted-text">{selectedDefinition.description}</p>
        </div>

        <div className={`wa-builder-readiness ${capability.status}`}>
          <strong>{capability.label}</strong>
          <span>{capability.helper}</span>
        </div>

        {nodeIssues.length ? (
          <div className="wa-builder-inline-issues">
            {nodeIssues.map((issue, index) => (
              <p className={issue.severity} key={`${issue.code}-${index}`}>
                {issue.message}
              </p>
            ))}
          </div>
        ) : null}

        <label className="field-card">
          <span className="field-card__label">Node label</span>
          <input className="field-card__input" onChange={(event) => patch({ title: event.target.value })} value={selectedNode.title} />
        </label>

        {TRIGGER_KINDS.has(selectedNode.kind) ? (
          <label className="field-card">
            <span className="field-card__label">Trigger keyword or payload</span>
            <input
              className="field-card__input"
              onChange={(event) => patch({ body: event.target.value })}
              value={selectedNode.body || ""}
            />
          </label>
        ) : null}

        {selectedNode.kind === "message-text" || selectedNode.kind === "message-button" || selectedNode.kind === "message-list" || selectedNode.kind === "handoff" ? (
          <label className="field-card">
            <span className="field-card__label">Message text</span>
            <textarea className="field-card__textarea" onChange={(event) => patch({ body: event.target.value })} rows={4} value={selectedNode.body ?? ""} />
          </label>
        ) : null}

        {selectedNode.kind === "message-button" ? (
          <div className="wa-builder-field-grid">
            {(selectedNode.buttons ?? []).map((button, index) => {
              const canRemove = (selectedNode.buttons ?? []).length > 1;
              return (
                <div className="wa-builder-option-editor" key={button.id || index}>
                  <label className="field-card">
                    <span className="field-card__label">Button {index + 1} label</span>
                    <input
                      className="field-card__input"
                      onChange={(event) =>
                        patch({
                          buttons: (selectedNode.buttons ?? []).map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)),
                        })
                      }
                      value={button.label}
                    />
                  </label>
                  <label className="field-card">
                    <span className="field-card__label">Button type</span>
                    <select
                      className="field-card__input"
                      onChange={(event) => {
                        handleButtonAction({
                          nodeId: selectedNode.id,
                          action: "update-button-type",
                          index,
                          actionType: event.target.value === "URL" ? "URL" : "QUICK_REPLY",
                        });
                      }}
                      value={button.actionType}
                    >
                      <option value="QUICK_REPLY">Reply route</option>
                      <option value="URL">Open URL link</option>
                    </select>
                  </label>
                  <label className="field-card">
                    <span className="field-card__label">{button.actionType === "URL" ? "Button link URL" : "Payload"}</span>
                    <input
                      className="field-card__input"
                      onChange={(event) =>
                        patch({
                          buttons: (selectedNode.buttons ?? []).map((item, itemIndex) => {
                            if (itemIndex !== index) return item;
                            if (button.actionType === "URL") return { ...item, value: event.target.value };
                            const value = slugButtonPayload(event.target.value, `option_${index + 1}`);
                            return { ...item, id: value, value };
                          }),
                        })
                      }
                      placeholder={button.actionType === "URL" ? "https://example.com" : "route_payload"}
                      value={button.actionType === "URL" ? button.value : buttonPayload(button, index)}
                    />
                  </label>
                  {button.actionType === "URL" ? <p className="gx-muted-text">URL buttons open a link and do not create a route dot.</p> : null}
                  <div className="wa-builder-inspector-actions">
                    {button.actionType === "QUICK_REPLY" ? (
                      <button className="ui-button-secondary" onClick={() => handleButtonAction({ nodeId: selectedNode.id, action: "add-next-for-button", index })} type="button">
                        Add next message
                      </button>
                    ) : null}
                    <button className="ui-button-ghost" disabled={!canRemove} onClick={() => handleButtonAction({ nodeId: selectedNode.id, action: "delete-button", index })} type="button">
                      Delete button
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="wa-builder-inspector-actions">
              <button
                className="ui-button-secondary"
                disabled={(selectedNode.buttons ?? []).length >= 3}
                onClick={() =>
                  patch({
                    buttons: [
                      ...(selectedNode.buttons ?? []),
                      {
                        id: `option_${(selectedNode.buttons ?? []).length + 1}`,
                        label: `Option ${(selectedNode.buttons ?? []).length + 1}`,
                        actionType: "QUICK_REPLY",
                        value: `option_${(selectedNode.buttons ?? []).length + 1}`,
                      },
                    ],
                  })
                }
                type="button"
              >
                <Plus size={14} />
                Add button
              </button>
              <button
                className="ui-button-ghost"
                disabled={(selectedNode.buttons ?? []).length <= 1}
                onClick={() => patch({ buttons: (selectedNode.buttons ?? []).slice(0, -1) })}
                type="button"
              >
                Remove last
              </button>
            </div>
          </div>
        ) : null}

        {selectedNode.kind === "message-list" ? (
          <div className="wa-builder-field-grid">
            <label className="field-card">
              <span className="field-card__label">Header</span>
              <input className="field-card__input" onChange={(event) => patch({ headerText: event.target.value })} value={selectedNode.headerText ?? ""} />
            </label>
            <label className="field-card">
              <span className="field-card__label">Button text</span>
              <input className="field-card__input" onChange={(event) => patch({ listButtonText: event.target.value })} value={selectedNode.listButtonText ?? ""} />
            </label>
            {(selectedNode.listSections ?? []).map((section, sectionIndex) => (
              <div className="wa-builder-option-editor" key={section.id}>
                <label className="field-card">
                  <span className="field-card__label">Section title</span>
                  <input
                    className="field-card__input"
                    onChange={(event) =>
                      patch({
                        listSections: (selectedNode.listSections ?? []).map((item, itemIndex) => (itemIndex === sectionIndex ? { ...item, title: event.target.value } : item)),
                      })
                    }
                    value={section.title}
                  />
                </label>
                {section.rows.map((row, rowIndex) => (
                  <div className="wa-builder-row-editor" key={row.id}>
                    <input
                      className="field-card__input"
                      onChange={(event) =>
                        patch({
                          listSections: (selectedNode.listSections ?? []).map((item, itemIndex) =>
                            itemIndex === sectionIndex
                              ? {
                                  ...item,
                                  rows: item.rows.map((rowItem, nextRowIndex) => (nextRowIndex === rowIndex ? { ...rowItem, title: event.target.value } : rowItem)),
                                }
                              : item,
                          ),
                        })
                      }
                      value={row.title}
                    />
                    <input
                      className="field-card__input"
                      onChange={(event) =>
                        patch({
                          listSections: (selectedNode.listSections ?? []).map((item, itemIndex) =>
                            itemIndex === sectionIndex
                              ? {
                                  ...item,
                                  rows: item.rows.map((rowItem, nextRowIndex) => (nextRowIndex === rowIndex ? { ...rowItem, id: event.target.value } : rowItem)),
                                }
                              : item,
                          ),
                        })
                      }
                      value={row.id}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {selectedNode.kind === "condition" ? (
          <label className="field-card">
            <span className="field-card__label">Condition expression</span>
            <input className="field-card__input" onChange={(event) => patch({ conditionExpression: event.target.value })} value={selectedNode.conditionExpression ?? ""} />
          </label>
        ) : null}

        {selectedNode.kind === "api-request" ? (
          <div className="wa-builder-field-grid">
            <label className="field-card">
              <span className="field-card__label">Method</span>
              <select className="field-card__select" onChange={(event) => patch({ apiMethod: event.target.value as SuperAdminWhatsAppFlowNode["apiMethod"] })} value={selectedNode.apiMethod ?? "POST"}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </label>
            <label className="field-card">
              <span className="field-card__label">URL</span>
              <input className="field-card__input" onChange={(event) => patch({ apiUrl: event.target.value })} value={selectedNode.apiUrl ?? ""} />
            </label>
            <label className="field-card">
              <span className="field-card__label">Output variable</span>
              <input className="field-card__input" onChange={(event) => patch({ outputVariable: event.target.value })} value={selectedNode.outputVariable ?? ""} />
            </label>
          </div>
        ) : null}

        {selectedNode.kind === "message-template" ? (
          <label className="field-card">
            <span className="field-card__label">Template name</span>
            <input className="field-card__input" onChange={(event) => patch({ templateName: event.target.value })} value={selectedNode.templateName ?? ""} />
          </label>
        ) : null}

        {selectedNode.kind === "ai-text-generation" || selectedNode.kind === "meta-ai" ? (
          <div className="wa-builder-field-grid">
            <label className="field-card">
              <span className="field-card__label">Prompt / instruction</span>
              <textarea className="field-card__textarea" onChange={(event) => patch({ aiSystemPrompt: event.target.value })} rows={5} value={selectedNode.aiSystemPrompt ?? ""} />
            </label>
            <label className="field-card">
              <span className="field-card__label">Fallback behavior</span>
              <input className="field-card__input" onChange={(event) => patch({ body: event.target.value })} value={selectedNode.body ?? ""} />
            </label>
          </div>
        ) : null}

        {selectedNode.kind === "wait" ? (
          <label className="field-card">
            <span className="field-card__label">Duration seconds</span>
            <input className="field-card__input" min={1} onChange={(event) => patch({ waitSeconds: Number(event.target.value) })} type="number" value={selectedNode.waitSeconds ?? 60} />
          </label>
        ) : null}

        {selectedNode.kind === "handoff" || selectedNode.kind === "assign-manager" ? (
          <label className="field-card">
            <span className="field-card__label">Queue / manager</span>
          <input className="field-card__input" onChange={(event) => patch({ outputVariable: event.target.value })} value={selectedNode.outputVariable ?? ""} />
          </label>
        ) : null}

        <div className="wa-builder-inspector-actions">
          <button className="ui-button-secondary" onClick={() => duplicateNodeById(selectedNode.id)} type="button">
            <Copy size={14} />
            Duplicate
          </button>
          <button className="ui-button-secondary" onClick={() => addNextNodeFrom(selectedNode.id)} type="button">
            <Plus size={14} />
            Add next
          </button>
          <button className="ui-button-ghost wa-builder-delete-button" onClick={() => deleteNodeById(selectedNode.id)} type="button">
            <Trash2 size={14} />
            Delete node
          </button>
        </div>
      </div>
    );
  };

  const renderBuilderView = () => {
    if (!activeFlow) {
      return (
        <section className="wa-builder-empty-state">
          <XCircle size={24} />
          <h3>Flow not found</h3>
          <p>The requested flow is unavailable or was removed.</p>
          <button className="ui-button-secondary" onClick={() => setView("list")} type="button">
            Back to flows
          </button>
        </section>
      );
    }

    const publishDisabled = saving || blockingIssues.length > 0;

    if (!fullScreen) {
      return (
        <section className="wa-builder-embedded-preview">
          <div className="wa-builder-embedded-preview-head">
            <button className="ui-button-ghost" onClick={() => setView("list")} type="button">
              <ArrowLeft size={14} />
              Back to flows
            </button>
            <span className={`wa-builder-status-badge ${statusClass(activeFlow.status)}`}>{formatStatus(activeFlow.status)}</span>
            <span className="wa-builder-channel-badge">WhatsApp</span>
          </div>
          <div className="wa-builder-embedded-preview-body">
            <div>
              <p className="section-label">Selected flow</p>
              <h3>{activeFlow.name}</h3>
              <p className="gx-muted-text">{activeFlow.summary}</p>
            </div>
            <div className="wa-builder-embedded-stats">
              <span>{activeFlow.nodes.length} nodes</span>
              <span>{activeFlow.edges.length} edges</span>
              <span>{blockingIssues.length ? `${blockingIssues.length} publish blockers` : "Validation ready"}</span>
            </div>
            <p className="gx-muted-text">
              Full editing uses the dedicated automation studio so the canvas, node library, and inspector get the entire viewport.
            </p>
            {fullViewBasePath ? (
              <Link className="ui-button-primary" href={`${fullViewBasePath}/${activeFlow.id}/builder`} rel="noreferrer" target="_blank">
                <Maximize2 size={14} />
                Open Full Canvas
              </Link>
            ) : null}
          </div>
        </section>
      );
    }

    return (
      <>
        <div className="wa-builder-topbar">
          <div className="wa-builder-topbar-title">
            {fullScreen ? (
              <Link className="ui-button-ghost" href={backHref}>
                <ArrowLeft size={14} />
                Back to flows
              </Link>
            ) : (
              <button className="ui-button-ghost" onClick={() => setView("list")} type="button">
                <ArrowLeft size={14} />
                Back to flows
              </button>
            )}
            <label className="wa-builder-flow-name">
              <span className="section-label">Flow name</span>
              <input
                onBlur={(event) => renameFlow(activeFlow, event.target.value)}
                onChange={(event) => updateFlowName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    updateFlowName(activeFlow.name);
                    event.currentTarget.blur();
                  }
                }}
                value={activeFlow.name}
              />
            </label>
          </div>
          <div className="wa-builder-topbar-center" aria-live="polite">
            {blockingIssues.length ? (
              <span className="wa-builder-validation-chip error">{blockingIssues.length} publish blockers</span>
            ) : (
              <span className="wa-builder-validation-chip success">Validation ready</span>
            )}
          </div>
          <div className="wa-builder-topbar-actions">
            <span className={`wa-builder-status-badge ${statusClass(activeFlow.status)}`}>{formatStatus(activeFlow.status)}</span>
            <span className="wa-builder-channel-badge">WhatsApp</span>
            <select className="field-card__select" onChange={(event) => setChannel(event.target.value as BuilderChannel)} value={channel}>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram DM future</option>
              <option value="messenger">Messenger future</option>
              <option value="website">Website Chat future</option>
            </select>
            <button aria-label="Save WhatsApp flow draft" className="ui-button-secondary" disabled={saving} onClick={() => saveFlow(false)} type="button">
              <Save size={14} />
              Save Draft
            </button>
            <button aria-label="Validate WhatsApp flow" className="ui-button-secondary" onClick={validateCurrentFlow} type="button">
              <CheckCircle2 size={14} />
              Validate
            </button>
            <button aria-label="Publish WhatsApp flow" className="ui-button-primary" disabled={publishDisabled} onClick={() => saveFlow(true)} type="button">
              <Play size={14} />
              Publish
            </button>
            <button aria-label="Test WhatsApp flow" className="ui-button-secondary" onClick={() => setActiveTab("test")} type="button">
              <Bot size={14} />
              Test
            </button>
            <button aria-label="Fit canvas view" className="ui-button-secondary" onClick={fitCanvas} type="button">
              <Maximize2 size={14} />
              Fit View
            </button>
            {!fullScreen ? (
              fullViewBasePath ? (
                <Link className="ui-button-secondary" href={`${fullViewBasePath}/${activeFlow.id}/builder`} rel="noreferrer" target="_blank">
                  <Maximize2 size={14} />
                  Full Canvas
                </Link>
              ) : null
            ) : null}
            <button aria-label="Delete selected canvas item" className="ui-button-ghost wa-builder-delete-button" onClick={deleteSelected} type="button">
              <Trash2 size={14} />
              Delete selected
            </button>
          </div>
        </div>

        <div className="wa-builder-workspace wa-builder-workspace-studio">
          <aside className="wa-builder-pane wa-builder-pane-left">
            <div className="wa-builder-pane-card">
              <div>
                <p className="section-label">Node library</p>
                <p className="gx-muted-text">Drag a node into the canvas or click to add.</p>
              </div>
              <label className="wa-builder-search">
                <Search size={14} />
                <input onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search nodes" value={libraryQuery} />
              </label>
              <div className="wa-builder-library">
                {registryCategories.map((category) => {
                  const items = groupedRegistry[category] ?? [];
                  const collapsed = collapsedCategories.has(category);
                  return (
                  <div className="wa-builder-library-group" key={category}>
                    <button className="wa-builder-library-heading" onClick={() => toggleCategory(category)} type="button">
                      <span>{category}</span>
                      <small>{collapsed ? "Show" : `${items.length} nodes`}</small>
                    </button>
                    {!collapsed ? <div className="wa-builder-tool-grid">
                      {items.map((tool) => {
                        const unsupported = !tool.channelSupport[channel];
                        const capability = unsupported ? capabilityCopy("unsupported_in_runtime", tool) : capabilityCopy(tool.baseCapability, tool);
                        return (
                          <button
                            className={`wa-builder-tool ${unsupported ? "disabled" : ""}`}
                            disabled={unsupported}
                            draggable={!unsupported}
                            key={tool.type}
                            onClick={() => addNodeToFlow(tool.type)}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("application/gigxomi-node", tool.type);
                            }}
                            type="button"
                          >
                            <span className="wa-builder-tool-icon">{tool.icon}</span>
                            <span className="wa-builder-tool-name">{tool.label}</span>
                            <small className="wa-builder-tool-description">{tool.description}</small>
                            <span className={`wa-builder-tool-capability ${capability.status}`}>{capability.label}</span>
                          </button>
                        );
                      })}
                    </div> : null}
                  </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="wa-builder-pane wa-builder-pane-center">
            <div className="wa-builder-canvas-wrap" onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onKeyDown={onCanvasKeyDown} tabIndex={0}>
              <ReactFlow
                deleteKeyCode={null}
                edges={edges}
                fitView
                fitViewOptions={{ padding: 0.24 }}
                nodeTypes={nodeTypes}
                nodes={nodes}
                onConnect={onConnect}
                onEdgesChange={onEdgesChange}
                onNodeContextMenu={(event, node) => {
                  event.preventDefault();
                  selectCanvasNode(node.id);
                  setQuickActionNodeId(node.id);
                  setActiveTab("inspector");
                }}
                onNodeDoubleClick={(event, node) => {
                  selectCanvasNode(node.id);
                  setQuickActionNodeId(node.id);
                  setActiveTab("inspector");
                  if (event.shiftKey) deleteNodeById(node.id);
                }}
                onNodeDragStop={onNodeDragStop}
                onNodesDelete={(deletedNodes) => {
                  if (deletedNodes.length) setStatusMessage(`${deletedNodes.length} node${deletedNodes.length === 1 ? "" : "s"} removed from the canvas.`);
                }}
                onNodesChange={onNodesChange}
                onPaneClick={() => setQuickActionNodeId(null)}
                onSelectionChange={(selection) => {
                  setSelectedNodeId(selection.nodes[0]?.id ?? null);
                  setSelectedEdgeId(selection.edges[0]?.id ?? null);
                  if (!selection.nodes.length) setQuickActionNodeId(null);
                }}
              >
                <MiniMap className="wa-builder-minimap" pannable position="bottom-right" zoomable />
                <Controls position="bottom-left" showInteractive={false} />
                <Background color="var(--color-border-strong)" gap={24} />
              </ReactFlow>
            </div>
          </section>

          <aside className="wa-builder-pane wa-builder-pane-right">
            <div className="wa-builder-pane-card wa-builder-tabs">
              <button className={activeTab === "inspector" ? "active" : ""} onClick={() => setActiveTab("inspector")} type="button">
                Inspector
              </button>
              <button className={activeTab === "validation" ? "active" : ""} onClick={() => setActiveTab("validation")} type="button">
                Validation
              </button>
              <button className={activeTab === "test" ? "active" : ""} onClick={() => setActiveTab("test")} type="button">
                Test
              </button>
              <button className={activeTab === "analytics" ? "active" : ""} onClick={() => setActiveTab("analytics")} type="button">
                Analytics
              </button>
            </div>

            {activeTab === "inspector" ? renderInspector() : null}

            {activeTab === "validation" ? (
              <div className="wa-builder-pane-card">
                <div className="wa-builder-validation-header">
                  <p className="section-label">Validation</p>
                  <span>{blockingIssues.length ? `${blockingIssues.length} errors` : "Publish-safe"}</span>
                </div>
                {issues.length ? (
                  <div className="wa-builder-validation-list">
                    {issues.map((issue, index) => (
                      <button
                        className={`wa-builder-validation-item ${issue.severity}`}
                        key={`${issue.code}-${issue.nodeId ?? "flow"}-${index}`}
                        onClick={() => {
                          if (issue.nodeId) {
                            selectCanvasNode(issue.nodeId);
                            reactFlow.fitView({ nodes: [{ id: issue.nodeId }] });
                          }
                        }}
                        type="button"
                      >
                        <AlertTriangle size={14} />
                        <span>{issue.message}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="wa-builder-success">
                    <CheckCircle2 size={14} />
                    Validation passed.
                  </p>
                )}
              </div>
            ) : null}

            {activeTab === "test" ? (
              <div className="wa-builder-pane-card">
                <p className="section-label">Test shell</p>
                <label className="field-card">
                  <span className="field-card__label">Sample user message</span>
                  <input className="field-card__input" onChange={(event) => setTestInput(event.target.value)} value={testInput} />
                </label>
                <button className="ui-button-secondary" onClick={runSimulation} type="button">
                  <Bot size={14} />
                  Run local simulation
                </button>
                <div className="wa-builder-sim-log">
                  {simulationLog.length ? (
                    simulationLog.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
                  ) : (
                    <p className="gx-muted-text">Runtime backend not connected yet for full WhatsApp execution. Basic local path preview is available here.</p>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "analytics" ? (
              <div className="wa-builder-pane-card">
                <p className="section-label">Analytics</p>
                {runList.some((run) => run.flowId === activeFlow.id) ? (
                  <div className="wa-builder-runs">
                    {runList
                      .filter((run) => run.flowId === activeFlow.id)
                      .slice(0, 8)
                      .map((run) => (
                        <div className="wa-builder-run-row" key={run.id}>
                          <strong>{run.status}</strong>
                          <span>{run.summary}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="wa-builder-analytics-empty">
                    <p>Flow analytics will appear after runtime events are connected.</p>
                    <span>Needed: flow_started, node_executed, message_sent, replies, handoffs, failures, and conversions.</span>
                  </div>
                )}
              </div>
            ) : null}

            <div className="wa-builder-pane-card wa-builder-run-summary">
              <p className="section-label">Builder state</p>
              <p className="gx-muted-text">{statusMessage || "Ready."}</p>
              <div>
                <span>{activeFlow.nodes.length} nodes</span>
                <span>{activeFlow.edges.length} edges</span>
                <span>{blockingIssues.length ? `${blockingIssues.length} publish blockers` : "Publish-safe structure"}</span>
                <span>{agencies.length} rollout targets available</span>
              </div>
            </div>
          </aside>
        </div>
      </>
    );
  };

  return <div className={`wa-builder-shell ${fullScreen ? "wa-builder-shell-full wa-builder-fullscreen-studio" : ""}`}>{view === "list" ? renderListView() : renderBuilderView()}</div>;
}

export function SuperAdminWhatsAppFlowBuilder(props: Props) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  );
}
