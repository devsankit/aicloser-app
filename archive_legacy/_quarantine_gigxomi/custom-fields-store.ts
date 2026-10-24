import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type CustomFieldType = "text" | "number" | "date" | "dropdown" | "multiselect" | "boolean" | "url";
export type FieldRolePermission = "READ_WRITE" | "READ_ONLY" | "HIDDEN";

export type CustomFieldDefinition = {
  id: string;
  name: string; // alphanumeric identifier (e.g., industry, company_size)
  label: string; // Human label (e.g., "Client Industry")
  type: CustomFieldType;
  options?: string[]; // For dropdown or multiselect
  required: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  appliesToStage?: string[]; // Specific stages where this field is prompted or required
  rolePermissions: {
    ADMIN: FieldRolePermission;
    MANAGER: FieldRolePermission;
    SALES_AGENT: FieldRolePermission;
  };
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type StageConfig = {
  stageKey: string;
  label: string;
  color: string;
  slaHours: number; // SLA threshold in hours (e.g. 2h for NEW, 24h for FOLLOW_UP)
  requiredFieldIds: string[]; // Fields that must be filled before moving into or out of this stage
  isDefault?: boolean;
};

export type SalesFormDefinition = {
  id: string;
  slug: string;
  title: string;
  description: string;
  source: string; // Source attribution (e.g. "website-form", "meta-inbound", "landing-page")
  fieldIds: string[]; // Custom fields included in the form
  includeCustomerName: boolean;
  includeCustomerPhone: boolean;
  includeCustomerEmail: boolean;
  includeServiceInterest: boolean;
  assignedAgentId?: string | null;
  targetStage: string;
  tags: string[];
  successMessage: string;
  redirectUrl?: string | null;
  isActive: boolean;
  submissionsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LeadCustomValues = Record<string, string | number | boolean | string[]>;

const DATA_DIR = path.join(process.cwd(), "data");
const FIELDS_FILE = path.join(DATA_DIR, "custom-fields.json");
const STAGES_FILE = path.join(DATA_DIR, "stage-configs.json");
const FORMS_FILE = path.join(DATA_DIR, "sales-forms.json");
const VALUES_FILE = path.join(DATA_DIR, "lead-custom-values.json");

const DEFAULT_FIELDS: CustomFieldDefinition[] = [
  {
    id: "fld-industry",
    name: "client_industry",
    label: "Client Industry / Niche",
    type: "dropdown",
    options: ["E-Commerce / D2C", "Real Estate", "EdTech / Coaching", "B2B SaaS", "Healthcare / Fitness", "Financial Services", "Agency / Marketing", "Other"],
    required: false,
    placeholder: "Select client industry",
    rolePermissions: { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_WRITE" },
    sortOrder: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fld-decision-maker",
    name: "decision_maker_role",
    label: "Decision Maker Designation",
    type: "text",
    required: false,
    placeholder: "e.g. Founder, CMO, VP Sales",
    rolePermissions: { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_WRITE" },
    sortOrder: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fld-expected-closure",
    name: "expected_closure_date",
    label: "Expected Deal Closure Date",
    type: "date",
    required: false,
    rolePermissions: { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_WRITE" },
    sortOrder: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fld-city",
    name: "client_city",
    label: "City / Region",
    type: "text",
    required: false,
    placeholder: "e.g. Mumbai, Bangalore, Dubai",
    rolePermissions: { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_WRITE" },
    sortOrder: 4,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fld-team-size",
    name: "team_size",
    label: "Team Size / Headcount",
    type: "dropdown",
    options: ["1-5", "6-20", "21-50", "51-200", "200+"],
    required: false,
    rolePermissions: { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_WRITE" },
    sortOrder: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fld-gstin",
    name: "gstin_tax_id",
    label: "GSTIN / Tax ID",
    type: "text",
    required: false,
    placeholder: "22AAAAA0000A1Z5",
    rolePermissions: { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_ONLY" },
    sortOrder: 6,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const DEFAULT_STAGES: StageConfig[] = [
  { stageKey: "NEW", label: "New Inbound", color: "#3b82f6", slaHours: 2, requiredFieldIds: [], isDefault: true },
  { stageKey: "ASSIGNED", label: "Assigned Rep", color: "#8b5cf6", slaHours: 4, requiredFieldIds: [], isDefault: true },
  { stageKey: "CONTACTED", label: "Contacted", color: "#06b6d4", slaHours: 24, requiredFieldIds: [], isDefault: true },
  { stageKey: "INTERESTED", label: "Interested", color: "#10b981", slaHours: 48, requiredFieldIds: ["fld-industry"], isDefault: true },
  { stageKey: "FOLLOW_UP", label: "Follow Up", color: "#f59e0b", slaHours: 72, requiredFieldIds: [], isDefault: true },
  { stageKey: "NEGOTIATION", label: "Negotiation", color: "#ec4899", slaHours: 96, requiredFieldIds: ["fld-expected-closure"], isDefault: true },
  { stageKey: "CLOSED_WON", label: "Closed Won", color: "#22c55e", slaHours: 0, requiredFieldIds: [], isDefault: true },
  { stageKey: "CLOSED_LOST", label: "Closed Lost", color: "#ef4444", slaHours: 0, requiredFieldIds: [], isDefault: true },
  { stageKey: "NOT_REACHABLE", label: "Not Reachable", color: "#64748b", slaHours: 12, requiredFieldIds: [], isDefault: true },
  { stageKey: "RECYCLED", label: "Recycled", color: "#a855f7", slaHours: 168, requiredFieldIds: [], isDefault: true },
];

const DEFAULT_FORMS: SalesFormDefinition[] = [
  {
    id: "frm-demo-request",
    slug: "book-demo",
    title: "Request Live Platform Demo",
    description: "Connect with a senior sales closer within 15 minutes to evaluate AIcloser capabilities.",
    source: "website-demo",
    fieldIds: ["fld-industry", "fld-decision-maker", "fld-team-size"],
    includeCustomerName: true,
    includeCustomerPhone: true,
    includeCustomerEmail: true,
    includeServiceInterest: true,
    assignedAgentId: null,
    targetStage: "NEW",
    tags: ["Inbound Form", "Demo Request"],
    successMessage: "Thank you! Our sales team is calling your number right away.",
    redirectUrl: null,
    isActive: true,
    submissionsCount: 14,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "frm-pricing-inquiry",
    slug: "pricing-quote",
    title: "Get Custom Agency Quote",
    description: "Provide your business volume details for a volume-discounted enterprise quote.",
    source: "pricing-calculator",
    fieldIds: ["fld-industry", "fld-city", "fld-team-size"],
    includeCustomerName: true,
    includeCustomerPhone: true,
    includeCustomerEmail: true,
    includeServiceInterest: true,
    assignedAgentId: null,
    targetStage: "NEW",
    tags: ["High Intent", "Enterprise Quote"],
    successMessage: "Your quote request has been received. Check your WhatsApp for the proposal link.",
    redirectUrl: null,
    isActive: true,
    submissionsCount: 8,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function getCustomFields(): Promise<CustomFieldDefinition[]> {
  try {
    const raw = await readFile(FIELDS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_FIELDS;
}

export async function saveCustomFields(fields: CustomFieldDefinition[]): Promise<void> {
  await ensureDataDir();
  await writeFile(FIELDS_FILE, JSON.stringify(fields, null, 2), "utf8");
}

export async function upsertCustomField(field: Omit<CustomFieldDefinition, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<CustomFieldDefinition> {
  const fields = await getCustomFields();
  const now = new Date().toISOString();
  if (field.id) {
    const idx = fields.findIndex((f) => f.id === field.id);
    if (idx >= 0) {
      const updated: CustomFieldDefinition = {
        ...fields[idx],
        ...field,
        id: field.id,
        updatedAt: now,
      };
      fields[idx] = updated;
      await saveCustomFields(fields);
      return updated;
    }
  }
  const created: CustomFieldDefinition = {
    ...field,
    id: `fld-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    updatedAt: now,
  };
  fields.push(created);
  await saveCustomFields(fields);
  return created;
}

export async function deleteCustomField(id: string): Promise<void> {
  const fields = await getCustomFields();
  const filtered = fields.filter((f) => f.id !== id);
  await saveCustomFields(filtered);
}

export async function getStageConfigs(): Promise<StageConfig[]> {
  try {
    const raw = await readFile(STAGES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_STAGES;
}

export async function saveStageConfigs(stages: StageConfig[]): Promise<void> {
  await ensureDataDir();
  await writeFile(STAGES_FILE, JSON.stringify(stages, null, 2), "utf8");
}

export async function getSalesForms(): Promise<SalesFormDefinition[]> {
  try {
    const raw = await readFile(FORMS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_FORMS;
}

export async function saveSalesForms(forms: SalesFormDefinition[]): Promise<void> {
  await ensureDataDir();
  await writeFile(FORMS_FILE, JSON.stringify(forms, null, 2), "utf8");
}

export async function upsertSalesForm(form: Omit<SalesFormDefinition, "id" | "submissionsCount" | "createdAt" | "updatedAt"> & { id?: string }): Promise<SalesFormDefinition> {
  const forms = await getSalesForms();
  const now = new Date().toISOString();
  if (form.id) {
    const idx = forms.findIndex((f) => f.id === form.id);
    if (idx >= 0) {
      const updated: SalesFormDefinition = {
        ...forms[idx],
        ...form,
        id: form.id,
        updatedAt: now,
      };
      forms[idx] = updated;
      await saveSalesForms(forms);
      return updated;
    }
  }
  const created: SalesFormDefinition = {
    ...form,
    id: `frm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    submissionsCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  forms.push(created);
  await saveSalesForms(forms);
  return created;
}

export async function deleteSalesForm(id: string): Promise<void> {
  const forms = await getSalesForms();
  await saveSalesForms(forms.filter((f) => f.id !== id));
}

// Custom values mapping per lead
async function readAllLeadValues(): Promise<Record<string, LeadCustomValues>> {
  try {
    const raw = await readFile(VALUES_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getLeadCustomValues(leadId: string): Promise<LeadCustomValues> {
  const all = await readAllLeadValues();
  return all[leadId] || {};
}

export async function saveLeadCustomValues(leadId: string, values: LeadCustomValues): Promise<LeadCustomValues> {
  await ensureDataDir();
  const all = await readAllLeadValues();
  all[leadId] = { ...(all[leadId] || {}), ...values };
  await writeFile(VALUES_FILE, JSON.stringify(all, null, 2), "utf8");
  return all[leadId];
}

// Public Form Intake Handler: captures lead, creates SalesLeadAssignment, stores custom values
export async function submitPublicSalesForm(slug: string, input: {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceInterest?: string;
  notes?: string;
  customValues?: LeadCustomValues;
}) {
  const forms = await getSalesForms();
  const form = forms.find((f) => f.slug === slug && f.isActive);
  if (!form) throw new Error("Sales form not found or inactive.");

  const customerName = (input.customerName || "Inbound Web Lead").trim();
  const customerPhone = input.customerPhone ? input.customerPhone.trim() : null;
  const customerEmail = input.customerEmail ? input.customerEmail.trim() : null;

  // Find assigned agent via Round-Robin if set to "round_robin" or null
  let assignedAgentId = form.assignedAgentId && form.assignedAgentId !== "round_robin" ? form.assignedAgentId : null;
  if (!assignedAgentId) {
    try {
      const { getNextRoundRobinAgentId } = await import("@/lib/gigxomi/round-robin-service");
      assignedAgentId = await getNextRoundRobinAgentId("tenant-gigxomi");
    } catch {}
  }

  if (!assignedAgentId) {
    const activeAgent = await prisma.salesAgentProfile.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    if (activeAgent) assignedAgentId = activeAgent.id;
  }

  if (!assignedAgentId) {
    throw new Error("No active sales agent profile available for lead distribution.");
  }

  // Create lead assignment with Round-Robin tags
  const tags = Array.from(new Set([...(form.tags || []), "Inbound Form Lead", "Round-Robin Assigned"]));
  const newLead = await prisma.salesLeadAssignment.create({
    data: {
      customerName,
      customerPhone,
      customerEmail,
      source: form.source || "inbound_web_form",
      serviceInterest: input.serviceInterest || form.title,
      segment: "Inbound Form",
      priority: "normal",
      tags,
      stage: (form.targetStage as any) || "NEW",
      notes: input.notes ? `[Form: ${form.title}] ${input.notes}` : `Captured via sales form: ${form.title}`,
      assignedAgentId,
    },
  });

  // Also sync to Unified MarketingContact
  if (customerPhone) {
    try {
      const { upsertMarketingContact } = await import("@/lib/whatsapp-marketing/contact-service");
      await upsertMarketingContact({
        tenantId: "tenant-gigxomi",
        fullName: customerName,
        phone: customerPhone,
        email: customerEmail || undefined,
        tags: [form.title, "Inbound Form Lead"],
        optInStatus: "OPTED_IN",
        optInSource: "sales_lead_form",
      });
    } catch {}
  }

  // Store custom field values if provided
  if (input.customValues && Object.keys(input.customValues).length > 0) {
    await saveLeadCustomValues(newLead.id, input.customValues);
  }

  // Increment submission counter
  form.submissionsCount += 1;
  form.updatedAt = new Date().toISOString();
  await saveSalesForms(forms);

  return {
    ok: true,
    leadId: newLead.id,
    successMessage: form.successMessage,
    redirectUrl: form.redirectUrl,
  };
}
