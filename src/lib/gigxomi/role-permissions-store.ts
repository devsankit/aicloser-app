import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type FeatureDefinition = {
  id: string;
  name: string;
  description: string;
  category: "Core CRM" | "Telephony & Audio" | "Automation & AI" | "Administration";
};

export const AVAILABLE_FEATURES: FeatureDefinition[] = [
  { id: "dashboard", name: "Dashboard & SIM Updates", description: "Real-time SIM metrics, call volumes, and overview cards", category: "Core CRM" },
  { id: "crm", name: "CRM Pipeline & Kanban", description: "Kanban board, drag-and-drop stages, and lead management", category: "Core CRM" },
  { id: "status_labels_crud", name: "Status Labels Manager (CRUD)", description: "Create, customize, edit, and delete status badges & tags", category: "Core CRM" },
  { id: "notes_crud", name: "Lead Notes Full CRUD & Sync", description: "Create, edit, delete timeline notes synced with mobile app", category: "Core CRM" },
  { id: "calls", name: "Call History & Audio Playback", description: "Play SIM call recordings, listen to audio, and check durations", category: "Telephony & Audio" },
  { id: "conversations", name: "Live Multi-Channel Chat", description: "Real-time WhatsApp, Instagram, and web chat workspace", category: "Telephony & Audio" },
  { id: "whatsapp_marketing", name: "WhatsApp Marketing Campaigns", description: "Broadcast templates and scheduled WhatsApp campaigns", category: "Telephony & Audio" },
  { id: "ai_bot_beta", name: "AI Bot (Beta Studio)", description: "Multi-provider API keys, document training, and chat playground", category: "Automation & AI" },
  { id: "deals", name: "Subscriptions & Deals", description: "Manage active subscriptions and closed deal revenue", category: "Administration" },
  { id: "referrals", name: "Referral & Commission Tracking", description: "Dual referral links, commission rates, and payout requests", category: "Administration" },
  { id: "role_management", name: "Role & Feature Access Control", description: "Configure feature toggles and permissions per user role", category: "Administration" },
];

export type RolePermissionsMatrix = {
  SUPER_ADMIN: Record<string, boolean>;
  ADMIN: Record<string, boolean>;
  MANAGER: Record<string, boolean>;
  SALES_AGENT: Record<string, boolean>;
};

const DEFAULT_MATRIX: RolePermissionsMatrix = {
  SUPER_ADMIN: {
    dashboard: true,
    crm: true,
    status_labels_crud: true,
    notes_crud: true,
    calls: true,
    conversations: true,
    whatsapp_marketing: true,
    ai_bot_beta: true,
    deals: true,
    referrals: true,
    role_management: true,
  },
  ADMIN: {
    dashboard: true,
    crm: true,
    status_labels_crud: true,
    notes_crud: true,
    calls: true,
    conversations: true,
    whatsapp_marketing: true,
    ai_bot_beta: true,
    deals: true,
    referrals: true,
    role_management: true,
  },
  MANAGER: {
    dashboard: true,
    crm: true,
    status_labels_crud: true,
    notes_crud: true,
    calls: true,
    conversations: true,
    whatsapp_marketing: true,
    ai_bot_beta: true,
    deals: true,
    referrals: false,
    role_management: false,
  },
  SALES_AGENT: {
    dashboard: true,
    crm: true,
    status_labels_crud: true,
    notes_crud: true,
    calls: true,
    conversations: true,
    whatsapp_marketing: false,
    ai_bot_beta: true,
    deals: false,
    referrals: true,
    role_management: false,
  },
};

const MATRIX_FILE = path.join(process.cwd(), "data", "role-permissions.json");

export async function getRolePermissionsMatrix(): Promise<RolePermissionsMatrix> {
  try {
    const raw = await readFile(MATRIX_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.ADMIN) {
      // Ensure all features exist in parsed matrix
      const matrix: RolePermissionsMatrix = { ...DEFAULT_MATRIX };
      for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"] as const) {
        matrix[role] = {
          ...DEFAULT_MATRIX[role],
          ...(parsed[role] || {}),
        };
      }
      return matrix;
    }
  } catch {}
  return DEFAULT_MATRIX;
}

export async function saveRolePermissionsMatrix(matrix: Partial<RolePermissionsMatrix>): Promise<RolePermissionsMatrix> {
  const current = await getRolePermissionsMatrix();
  const next: RolePermissionsMatrix = {
    SUPER_ADMIN: { ...current.SUPER_ADMIN, ...(matrix.SUPER_ADMIN || {}) },
    ADMIN: { ...current.ADMIN, ...(matrix.ADMIN || {}) },
    MANAGER: { ...current.MANAGER, ...(matrix.MANAGER || {}) },
    SALES_AGENT: { ...current.SALES_AGENT, ...(matrix.SALES_AGENT || {}) },
  };

  // SUPER_ADMIN always has all features
  for (const feat of AVAILABLE_FEATURES) {
    next.SUPER_ADMIN[feat.id] = true;
  }

  await mkdir(path.dirname(MATRIX_FILE), { recursive: true });
  await writeFile(MATRIX_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function isFeatureEnabledForRole(role: string, featureId: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const matrix = await getRolePermissionsMatrix();
  const roleKey = (role in matrix ? role : "SALES_AGENT") as keyof RolePermissionsMatrix;
  return matrix[roleKey]?.[featureId] ?? true;
}
