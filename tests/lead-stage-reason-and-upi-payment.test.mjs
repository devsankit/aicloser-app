import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/components/sales/sales-dashboard.tsx", import.meta.url), "utf8");
const reasonModal = fs.readFileSync(new URL("../src/components/sales/lead-stage-reason-modal.tsx", import.meta.url), "utf8");
const leadsRoute = fs.readFileSync(new URL("../src/app/api/sales/leads/route.ts", import.meta.url), "utf8");
const upiPanel = fs.readFileSync(new URL("../src/components/sales/upi-payment-collection-panel.tsx", import.meta.url), "utf8");
const requireRole = fs.readFileSync(new URL("../src/lib/api/require-session-role.ts", import.meta.url), "utf8");

test("Kanban board integrates LeadStageReasonModal for lost/recycled reason prompting", () => {
  // Modal component verification
  assert.match(reasonModal, /export function LeadStageReasonModal/);
  assert.match(reasonModal, /PRESET_REASONS/);
  assert.match(reasonModal, /Budget too low \/ Mismatch/);
  assert.match(reasonModal, /Not interested \/ No requirement/);
  assert.match(reasonModal, /trimmed\.length >= 3/);

  // Sales dashboard wiring
  assert.match(dashboard, /LeadStageReasonModal/);
  assert.match(dashboard, /stagesRequiringReason/);
  assert.match(dashboard, /CLOSED_LOST/);
  assert.match(dashboard, /stageReasonRequest/);
  assert.match(dashboard, /handleConfirmStageReason/);
  assert.match(dashboard, /<LeadStageReasonModal/);
});

test("leads API accepts reason and note for stage transitions", () => {
  assert.match(leadsRoute, /const note = typeof body\.note === "string" \? body\.note\.trim\(\) : \(typeof body\.reason === "string" \? body\.reason\.trim\(\) : ""\)/);
  assert.match(leadsRoute, /const requiresReason = new Set<SalesLeadStage>\(\["CLOSED_LOST", "LOST", "NOT_REACHABLE", "RECYCLED"\]\)/);
  assert.match(leadsRoute, /if \(requiresReason\.has\(stage\) && note\.length < 3\)/);
});

test("UPI payment collection panel and dashboard allow workspace admins to manage settings and create QR", () => {
  // sales-dashboard passes ADMIN for workspace admins
  assert.match(dashboard, /sessionRole=\{\(isWorkspaceAdmin \? "ADMIN"/);

  // upi-payment-collection-panel considers SUPER_ADMIN and ADMIN as admin
  assert.match(upiPanel, /const isAdmin = sessionRole === "ADMIN" \|\| sessionRole === "SUPER_ADMIN"/);
  assert.match(upiPanel, /if \(isAdmin\) \{/);

  // require-session-role allows profile workspace admins when ADMIN is required
  assert.match(requireRole, /isProfileWorkspaceAdmin/);
  assert.match(requireRole, /permissions\?\.workspaceAdmin === true/);
});
