# AIcloser Closer / User Dashboard API Requirements

This document defines the API contract for a role-limited Closer dashboard. The current application already has most of these routes; the UI should reuse them instead of creating a second lead or chat system.

## Access rules

- Every request is authenticated with the existing session middleware.
- Every database query must be scoped to the signed-in workspace/tenant.
- `ADMIN` and `SUPER_ADMIN` can see and manage workspace data.
- `MANAGER` can see the users and leads allowed by the existing manager scope.
- `SALES_AGENT` / Closer can see only assigned leads, assigned conversations, and open claimable lead-pool items.
- A Closer must never receive another tenant's contacts, messages, notes, recordings, or API credentials.
- New users are created as `UNASSIGNED` / `PENDING` and become active only after an administrator assigns a role.

## 1. Closer dashboard overview

### `GET /api/sales/dashboard`

Returns the signed-in user's dashboard snapshot. Admins may pass `?agentId=<id>` to inspect a selected user; a Closer cannot override its own scope.

Important response fields:

```json
{
  "ok": true,
  "snapshot": {
    "currentAgent": {},
    "visibleLeads": [],
    "visibleLeadPool": [],
    "mobileCalls": [],
    "reports": {}
  }
}
```

The overview UI uses `reports`, call totals, callbacks, recent activity, and the user's own pipeline. Admin reports must keep the existing `Viewing data for` context.

## 2. CRM pipeline and list view

### `GET /api/sales/leads`

Returns the scoped lead list and claim queue.

```json
{
  "ok": true,
  "leads": [
    {
      "id": "lead_123",
      "customerName": "Contact name",
      "customerPhone": "+919800000000",
      "customerEmail": "person@example.com",
      "source": "instagram",
      "stage": "CONTACTED",
      "followUpAt": "2026-10-08T10:00:00.000Z",
      "notes": "Last conversation summary",
      "assignedAgentId": "agent_123",
      "tags": []
    }
  ],
  "leadPool": [],
  "agents": []
}
```

The response powers both Kanban and list views. The stage counts must be calculated from the same scoped `leads` array so counts never disagree between views.

### `POST /api/sales/leads` with `action: "stage"`

Changes a lead status after a drag/drop or status selector change.

```json
{
  "action": "stage",
  "leadId": "lead_123",
  "stage": "FOLLOW_UP",
  "followUpAt": "2026-10-08T10:00:00.000Z",
  "note": "Requested a callback tomorrow"
}
```

The server validates ownership, allowed stages, required notes/reasons, and paid-stage requirements. If the admin disables `allowNonAdminModifyLeads`, non-admin users receive `403`.

### `POST /api/sales/leads` with `action: "update"`

Updates contact details, source metadata, follow-up date, tags, notes, and conversation linkage. The endpoint must apply the same workspace and permission checks as the stage operation.

### Lead card actions

- Email: `mailto:<customerEmail>` when an email exists.
- Personal WhatsApp: open the assigned lead phone in the approved WhatsApp/personal channel integration.
- Admin Meta/WhatsApp replies: open the related conversation in the unified chat workspace; do not expose another tenant's thread.
- Notes and follow-up: persist through the conversation notes or sales lead update route.
- Recording: load only through the scoped recording endpoint described below.

## 3. Unified chat

### `GET /api/conversations?audience=sales&tenantId=<tenant>`

Returns the sales inbox for WhatsApp Business, WhatsApp API, closer personal WhatsApp sync, Instagram, and admin-assigned lead conversations. The server must filter by the signed-in closer's assigned leads before returning the payload.

### `GET /api/conversations/<conversationId>/messages`

Returns the selected conversation and message history after access validation.

### `POST /api/conversations/<conversationId>/messages`

Sends a reply through the selected channel.

```json
{
  "body": "Thanks, I will call you tomorrow.",
  "lane": "customer",
  "clientMessageId": "web-unique-id",
  "attachments": []
}
```

The channel adapter decides whether the message uses WhatsApp API, a connected business inbox, or a permitted personal WhatsApp sync. The UI should show channel availability rather than silently merging unrelated conversations.

### `POST /api/conversations/<conversationId>/notes`

Saves internal notes and optional follow-up date. Notes are synchronized to the linked CRM lead and timeline.

```json
{
  "notes": "Spoke with the customer; comparing plans.",
  "nextFollowUpAt": "2026-10-09T09:30:00.000Z"
}
```

### `POST /api/conversations/<conversationId>/lead-status`

Changes the conversation status and synchronizes the mapped CRM stage and Meta outbox event.

```json
{ "leadStatusId": "follow-up", "notes": "Callback requested" }
```

### `GET /api/conversations/<conversationId>/crm-details`

Loads customer 360 data, linked lead, calls, deals, tasks, and timeline for the detail drawer. The response must remain tenant-scoped.

## 4. Grab Leads / claim queue

### `GET /api/sales/leads`

Use the `leadPool` array and show only items with `status: "OPEN"` in the dedicated `Grab Leads` menu item.

### `POST /api/sales/leads` with `action: "claim"`

Claims one open queue item for the signed-in Closer.

```json
{
  "action": "claim",
  "poolItemId": "pool_123",
  "agentId": "agent_123"
}
```

The server must reject another user's `agentId`, closed/already claimed items, and cross-workspace items. A successful claim moves the lead into the user's CRM pipeline.

The mobile lead-pack APIs remain available for the mobile app:

- `POST /api/sales/mobile/lead-packs/request`
- `POST /api/sales/mobile/lead-packs/<packId>/claim`

## 5. Calls, notes, and recordings

### `GET /api/sales/dashboard`

The `mobileCalls` response supplies the closer's call history, outcome, notes, duration, and recording status.

### `GET /api/sales/mobile/calls/<callId>/recording`

Streams a recording only when the current user is allowed to access the linked call. Support HTTP range requests for audio seeking.

Mobile write operations remain:

- `POST /api/sales/mobile/call/start`
- `POST /api/sales/mobile/call/end`
- `POST /api/sales/mobile/call/disposition`
- `POST /api/sales/mobile/calls/<callId>/recording`

## 6. Admin controls for closer access

### `GET /api/sales/round-robin`

Returns the workspace distribution settings and whether the current user can claim leads. Relevant flags:

```json
{
  "settings": {
    "enabled": true,
    "allowNonAdminModifyLeads": true,
    "allowNonAdminImportData": false,
    "allowNonAdminExportData": false
  }
}
```

### `POST /api/sales/round-robin` with `action: "save_settings"`

Only administrators can update round-robin participation, groups, grab-lead behavior, modification access, import access, and export access.

### `GET /api/sales/roles/features`

Returns the role feature matrix used to keep dashboard modules off by default for Closer users. The Closer baseline should expose only dashboard, CRM, status changes/notes, calls, conversations, and Grab Leads when enabled.

### `GET /api/sales/roles/users`

Admin-only user list with role, manager, status, seat, and claim capability.

### `POST /api/sales/roles/users`

Creates a user with name, email, password, and phone. New accounts must be `PENDING` with `UNASSIGNED` role.

### `PATCH /api/sales/roles/users`

Assigns `ADMIN`, `MANAGER`, or `SALES_AGENT`, updates pending/active status, and assigns a manager to a Sales User. An unassigned user cannot enter a role-specific workspace.

## 7. Import/export permissions

### `POST /api/sales/leads/import`

Imports CSV/TSV/XLS/XLSX or a Google Sheet link. It returns imported, duplicate, skipped, invalid, and row-level error counts. The route must reject non-admins unless `allowNonAdminImportData` is enabled.

### `GET /api/sales/reports/export?type=leads`

Exports scoped leads. Supported values include `leads`, `contacts`, and `calls`. The route must reject non-admins unless `allowNonAdminExportData` is enabled.

Import preview should be implemented as a non-mutating client/server mode before the final import request. The preview rows must never become CRM records until the user confirms save.

## 8. UI contract for the Closer role

Default menu order:

1. Dashboard Overview
2. CRM Pipeline & Kanban
3. Grab Leads (only when enabled by admin)
4. Live Multi-Channel Chat

All other modules are hidden from the Closer navigation by default. Menu order is a user preference and is persisted locally by role/user; it must not change permissions or server authorization.

The CRM header should contain only view switcher, lead status counts, and permitted actions. Unrelated admin filters, deduplication, lead creation, import, and export controls stay hidden unless the user's role and workspace settings allow them.
