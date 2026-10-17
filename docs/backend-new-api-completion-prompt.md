# Backend Engineer Prompt — Complete AIcloser New API Before UI Migration

We are rebuilding the AIcloser web UI against the new backend at `api.aicloser.in`. Do a complete API contract audit and implementation pass before the frontend starts migration.

Do not remove or mutate production data. Do not silently reuse the old Next.js `/api/sales/*`, `/api/conversations/*`, `/api/meta/*`, `/api/admin/*`, `/api/super-admin/*` or `/api/whatsapp-marketing/*` routes from the new UI. The new UI must use one versioned backend contract under `/api/v1`, except explicitly documented public webhook/callback endpoints.

Important route-status rule: the endpoint paths below are not all existing APIs. For every path, classify it before implementing it as exactly one of:

- `EXISTING_V1`: already implemented in `aicloser-api/src/routes/v1` and safe to integrate after contract/security verification;
- `LEGACY_WORKING`: currently implemented and used by the application, but still on the old Next.js route surface and therefore a migration source;
- `MIGRATION_REQUIRED`: a real product capability found in the current application/mobile client that has no equivalent New API yet;
- `OPTIONAL`: only needed if the product owner confirms that the capability is part of the new scope or its contract differs from an existing endpoint;
- `NOT_IN_PRODUCT`: not found in the current application or mobile contract; do not implement it.

Do not create a new endpoint merely because a similar path is listed below. Reuse an `EXISTING_V1` endpoint when its request, response, permissions and side effects cover the use case. If a proposed path is not supported by evidence from the current app, mobile app, backend schema or an approved product requirement, mark it `OPTIONAL` or `NOT_IN_PRODUCT` and ask before building it. Do not create duplicate mobile wrappers around generic calls/recordings APIs without a documented contract difference.

Current migration fact: `src/lib/api-client.ts` contains a prepared `/api/v1` adapter, but the current rendered UI does not import it yet. Existing screens still call legacy Next.js routes. Treat the adapter as a migration specification, not as evidence that a New API endpoint is already in production use.

## 1. First deliverable: complete endpoint inventory

Compare the current frontend routes and the new Express `/api/v1` routes. Produce a table with:

- current legacy endpoint;
- current UI page/component using it;
- new `/api/v1` replacement;
- HTTP method, auth and role policy;
- tenant-scope rule;
- request schema;
- response DTO;
- pagination/cursor behavior;
- realtime event, if any;
- status: `READY`, `PARTIAL`, `MISSING`, `DEPRECATED`;
- migration owner and blocking reason.

Inspect all current domains, not only the visible CRM menu:

1. Auth, login, logout, heartbeat, Google login, session/device slots.
2. Dashboard overview, reports, closer metrics and exports.
3. Leads, pipeline, pool, claim, duplicates, merge, lead 360, notes, tasks and custom fields.
4. Contacts, contact deduplication, contact profile and import.
5. Conversations, messages, read state, typing, attachments, assignment, stage, notes, callbacks, transport, AI reply and drip.
6. Calls, missed calls, dispositions, recordings, mobile devices, offline sync, lead packs and telemetry.
7. Payments, payment proof, approval/rejection, notifications, public payment pages, subscription and PhonePe callbacks.
8. Team, roles, permissions, capabilities, plan, seats and session revocation.
9. Settings, stages, custom fields, round robin, chat visibility and integrations.
10. Super Admin tenant directory, active package, subscription/payment state, seat controls, expiry, suspension, user controls, impersonation, mobile telemetry, feedback, Instagram plugin and WhatsApp flow controls.
11. Meta/WhatsApp: Embedded Signup, channel status, token refresh, phone registration, webhook subscription, message send, media, templates, campaigns, contacts/groups, dispatch, delivery events and opt-out.
12. Instagram: OAuth, callback, connection status, webhook, deauthorize and data deletion.
13. Lead forms, public submissions, automation workflows, AI bot configuration/training/test chat, developer webhooks and API keys.
14. Mobile application login, bootstrap, inbox, profile, device registration/certification, calls, recording upload/playback, contacts, lead packs, offline replay, push notifications and diagnostics.

## 2. Mandatory canonical API domains

Keep the already implemented core routes, but make their DTOs and permissions production-ready:

```text
/api/v1/auth/*
/api/v1/me/*
/api/v1/leads/*
/api/v1/contacts/*
/api/v1/conversations/*
/api/v1/calls/*
/api/v1/recordings/*
/api/v1/payments/*
/api/v1/reports/*
/api/v1/team/*
/api/v1/stages/*
/api/v1/custom-fields/*
/api/v1/mobile/*
/api/v1/realtime/events
/api/v1/integrations/*
/api/v1/marketing/*
/api/v1/workspace/*
/api/v1/admin/*
/api/v1/super-admin/*
```

The following are the concrete `EXISTING_V1` route families verified in the current New API. This is the baseline to preserve, not a request to recreate them:

```text
/api/v1/auth/*
/api/v1/me/sessions
/api/v1/leads/*
/api/v1/contacts/*
/api/v1/conversations/*
/api/v1/calls/*
/api/v1/recordings/*
/api/v1/payments/*
/api/v1/reports/*
/api/v1/team/*
/api/v1/stages/*
/api/v1/custom-fields/*
/api/v1/mobile/contacts
/api/v1/mobile/devices/*
/api/v1/mobile/offline-events/sync
/api/v1/realtime/events
/api/v1/admin/users/*
/api/v1/super-admin/tenants
/api/v1/super-admin/tenants/:tenantId/impersonate
/api/v1/webhooks/meta
/api/v1/integrations/google-drive/*
```

The following families are currently `MIGRATION_REQUIRED` or `OPTIONAL` until their legacy behavior is mapped and approved: `/api/v1/workspace/*`, the extended `/api/v1/super-admin/*` controls, `/api/v1/integrations/whatsapp/*`, `/api/v1/integrations/instagram/*`, `/api/v1/marketing/*`, and mobile-only bootstrap/profile/diagnostic/push contracts. Do not report these as already available New API routes.

## 3. Mobile application API parity

The mobile application is already running on a separate legacy API surface. Do not treat mobile as only a web client. Audit and migrate these current capabilities:

```text
POST /api/mobile/auth/login
GET  /api/sales/mobile/bootstrap
GET  /api/sales/mobile/inbox
POST /api/sales/mobile/register-device
POST /api/sales/mobile/heartbeat
POST /api/sales/mobile/profile
POST /api/sales/mobile/certification
POST /api/sales/mobile/contacts
POST /api/sales/mobile/contacts/sync
POST /api/sales/mobile/call/start
POST /api/sales/mobile/call/end
POST /api/sales/mobile/call/discard
POST /api/sales/mobile/call/disposition
POST /api/sales/mobile/call/recording-upload
GET  /api/sales/mobile/calls/:id/recording
POST /api/sales/mobile/offline-events/sync
POST /api/sales/mobile/lead-packs/request
POST /api/sales/mobile/lead-packs/:id/claim
POST /api/mobile/push-token
POST /api/mobile/push-config
```

The New API currently covers only part of this through:

```text
POST /api/v1/auth/login                 # clientType MOBILE
GET  /api/v1/me/sessions
POST /api/v1/mobile/contacts
POST /api/v1/mobile/devices
POST /api/v1/mobile/devices/:deviceId/heartbeat
POST /api/v1/mobile/offline-events/sync
GET|POST /api/v1/calls
POST /api/v1/calls/:id/end
POST /api/v1/recordings/init
POST /api/v1/recordings/:id/content
POST /api/v1/recordings/:id/complete
GET  /api/v1/recordings/:id/playback
```

Add or explicitly document the following mobile capabilities. Prefer the existing generic `/api/v1/calls` and `/api/v1/recordings` contracts where they already cover the behavior. Add a mobile-specific path only when the mobile request, offline, device-binding or upload contract genuinely differs and the difference is documented:

```text
GET    /api/v1/mobile/bootstrap
GET    /api/v1/mobile/inbox
GET    /api/v1/mobile/profile
PATCH  /api/v1/mobile/profile
POST   /api/v1/mobile/devices/:deviceId/certification
GET    /api/v1/mobile/devices/:deviceId/diagnostics
# OPTIONAL wrappers only if generic calls/recordings do not satisfy the mobile contract:
POST   /api/v1/mobile/calls/start
POST   /api/v1/mobile/calls/:id/end
POST   /api/v1/mobile/calls/:id/discard
POST   /api/v1/mobile/calls/:id/disposition
POST   /api/v1/mobile/calls/:id/recording-upload/init
POST   /api/v1/mobile/calls/:id/recording-upload/chunk
POST   /api/v1/mobile/calls/:id/recording-upload/complete
GET    /api/v1/mobile/calls/:id/recording
POST   /api/v1/mobile/lead-packs/request
POST   /api/v1/mobile/lead-packs/:id/claim
POST   /api/v1/mobile/push-tokens
DELETE /api/v1/mobile/push-tokens/:id
GET    /api/v1/mobile/notification-preferences
PATCH  /api/v1/mobile/notification-preferences
POST   /api/v1/mobile/crash-events
```

The legacy client references `POST /api/mobile/push-token` and `POST /api/mobile/push-config`, but matching route ownership was not found in the checked web application source. Treat push-token/config migration as `OPTIONAL` until the mobile engineer confirms the current production owner, payloads and call sites. Do not implement a duplicate push service from this prompt alone.

Mobile requirements:

- `POST /api/v1/auth/login` must support `clientType: MOBILE`, installation ID, device ID, app version and single-device session policy.
- Bootstrap must return mobile profile, tenant/workspace, active plan/entitlements, capabilities, stages, current device, callback reminders, unread inbox count and feature flags in one bounded response.
- Inbox must be a mobile-optimized cursor-paginated projection; it must not return full message history or the entire lead table.
- Call start/end/discard/disposition must be idempotent and tied to authenticated agent, tenant and registered device.
- Recording upload must support resumable chunks, idempotency, MIME/size validation, checksum and retry status.
- Offline events must be ordered and idempotent; duplicate replay must not create duplicate leads/calls/messages.
- Lead-pack claim must be atomic and return a conflict when another device/user claims it first.
- Push tokens must be tenant/user/device scoped and revocable.
- Certification and diagnostics must be visible to Super Admin telemetry with safe redaction.
- Plan restrictions, suspended account behavior and minimum app version must be enforced server-side.
- Mobile endpoints must return consistent `401`, `403`, `409`, `422` errors and support retry semantics.
- Do not create a separate mobile lead/call/recording store. Define the shared-data sync contract explicitly: cursor/delta reads for leads, idempotent outbound lead/contact/call/message events, conflict rules, permission filtering and realtime backfill. The current mobile offline route explicitly applies `CALL_END` only, so it must not be described as full lead synchronization.
- Before production mobile recording sync, validate that `deviceId` belongs to the authenticated agent/tenant and either implement resumable chunks or explicitly document that the signed upload/local body flow is the supported bounded upload contract.
- Enforce the “one normalized phone identity per tenant/workspace” rule at the database and ingestion layers. Do not claim this is complete while `SalesLeadAssignment` has only a `(tenantId, customerPhone)` index and no canonical unique key. Manual create, Meta webhook and mobile contact sync must share one atomic find-or-create/upsert path; an unmapped webhook channel must be quarantined, never assigned to a fallback tenant.

## 4. Workspace plan and entitlement API

The current frontend receives active plan data from the legacy `/api/sales/workspace-plan`, while Super Admin derives plan/payment/expiry from multiple tables. These are `MIGRATION_REQUIRED` contracts, not existing New API routes. Create one authoritative contract:

```text
GET /api/v1/workspace/plan
GET /api/v1/workspace/entitlements
GET /api/v1/workspace/usage
```

Response must include:

- workspace/tenant ID and name;
- package ID, name, type and version;
- subscription ID, status, payment status, start date and expiry date;
- active/suspended/activation-locked state;
- seat limit, active seats and remaining seats;
- feature entitlements: WhatsApp, AI, automations, analytics, API, webhooks, forms, marketing, exports and recordings;
- usage limits and current usage;
- server timestamp and source-of-truth version.

No screen should infer plan state from `packageName`, `packageStatus` or a fallback user record.

## 5. Super Admin API parity

The New API currently has only tenant listing and tenant impersonation in this area. The following are `MIGRATION_REQUIRED` only where the corresponding legacy Super Admin action is confirmed in the endpoint matrix; do not build speculative controls:

```text
GET    /api/v1/super-admin/tenants
GET    /api/v1/super-admin/tenants/:tenantId
GET    /api/v1/super-admin/tenants/:tenantId/plan
PATCH  /api/v1/super-admin/tenants/:tenantId/plan
PATCH  /api/v1/super-admin/tenants/:tenantId/status
PATCH  /api/v1/super-admin/tenants/:tenantId/seats
PATCH  /api/v1/super-admin/tenants/:tenantId/expiry
GET    /api/v1/super-admin/tenants/:tenantId/users
POST   /api/v1/super-admin/tenants/:tenantId/users
PATCH  /api/v1/super-admin/tenants/:tenantId/users/:userId
DELETE /api/v1/super-admin/tenants/:tenantId/users/:userId
GET    /api/v1/super-admin/telemetry
GET    /api/v1/super-admin/feedback
PATCH  /api/v1/super-admin/feedback/:id
```

Preserve audited impersonation:

```text
POST /api/v1/super-admin/tenants/:tenantId/impersonate
POST /api/v1/super-admin/impersonation/return
```

Required controls: SUPER_ADMIN only, explicit tenant existence, audit log, expiry, reason, target tenant context, no cross-tenant cache leakage, no secret/token exposure.

## 6. Meta, WhatsApp and Instagram API parity

The current application already has functionality that is not in New API. Map each legacy call to a versioned equivalent. Implement only confirmed `MIGRATION_REQUIRED` capabilities and label unconfirmed items `OPTIONAL`:

### WhatsApp channel lifecycle

```text
GET    /api/v1/integrations/whatsapp/channels
GET    /api/v1/integrations/whatsapp/channels/:id
POST   /api/v1/integrations/whatsapp/embedded-signup/start
POST   /api/v1/integrations/whatsapp/embedded-signup/complete
POST   /api/v1/integrations/whatsapp/channels/:id/register-phone
POST   /api/v1/integrations/whatsapp/channels/:id/subscribe-webhook
POST   /api/v1/integrations/whatsapp/channels/:id/refresh-token
PATCH  /api/v1/integrations/whatsapp/channels/:id
DELETE /api/v1/integrations/whatsapp/channels/:id
POST   /api/v1/integrations/whatsapp/messages
GET    /api/v1/integrations/whatsapp/media/:mediaId
```

### Templates and marketing

```text
GET    /api/v1/marketing/templates
POST   /api/v1/marketing/templates
GET    /api/v1/marketing/templates/:id
DELETE /api/v1/marketing/templates/:id
POST   /api/v1/marketing/templates/media
POST   /api/v1/marketing/templates/sync

GET    /api/v1/marketing/contacts
POST   /api/v1/marketing/contacts
POST   /api/v1/marketing/contacts/import
GET    /api/v1/marketing/groups
POST   /api/v1/marketing/groups
DELETE /api/v1/marketing/groups/:id

GET    /api/v1/marketing/campaigns
POST   /api/v1/marketing/campaigns
GET    /api/v1/marketing/campaigns/:id
PATCH  /api/v1/marketing/campaigns/:id
POST   /api/v1/marketing/campaigns/:id/preview
POST   /api/v1/marketing/campaigns/:id/dispatch
POST   /api/v1/marketing/campaigns/:id/pause
POST   /api/v1/marketing/campaigns/:id/resume
POST   /api/v1/marketing/campaigns/:id/cancel
POST   /api/v1/marketing/campaigns/:id/retry-failed
POST   /api/v1/marketing/channel/test-send
```

### Webhooks and Instagram

`GET|POST /api/v1/webhooks/meta` is the existing canonical Meta webhook entry point. Reuse it for WhatsApp/Instagram events unless the provider verification or payload contract requires separate public aliases. The separate `/webhooks/whatsapp` and `/webhooks/instagram` paths below are `OPTIONAL` aliases, not mandatory duplicate handlers.

```text
GET    /api/v1/webhooks/meta
POST   /api/v1/webhooks/meta
GET    /api/v1/webhooks/whatsapp
POST   /api/v1/webhooks/whatsapp
GET    /api/v1/webhooks/instagram
POST   /api/v1/webhooks/instagram
POST   /api/v1/webhooks/instagram/deauthorize
POST   /api/v1/webhooks/instagram/data-deletion

GET    /api/v1/integrations/instagram/status
POST   /api/v1/integrations/instagram/oauth/start
GET    /api/v1/integrations/instagram/oauth/callback
PATCH  /api/v1/integrations/instagram/status
```

Important: the current New API `/api/v1/webhooks/meta` acknowledges Meta quickly, maps `phone_number_id` to a tenant, appends inbound WhatsApp messages to the conversation payload, creates/links a lead and stores delivery events. It still needs strict unmapped-channel rejection, canonical lead identity, complete normalized message/delivery DTOs, idempotency guarantees and retries before the chat UI can rely on it as the final production contract.

## 7. Chat and data isolation blockers

Before frontend migration, fix and test:

1. Tenant-safe update in conversation transport mutation.
2. Conversation access check in typing mutation.
3. Same-tenant target-agent and permission validation in assignment mutation.
4. Message provider delivery status; `stored` is not `delivered`.
5. Attachment authorization and file size/type limits.
6. Tenant-scoped callback/task writes.
7. Conversation message storage strategy; do not make the UI load an unbounded JSON payload.
8. Realtime SSE polling/connection capacity and event authorization.
9. Duplicate lead/contact idempotency and merge audit trail.
10. Lead 360, notes and tasks must enforce the same tenant plus assigned-agent/capability scope as lead detail; task update/delete must not authorize by task ID alone.
11. Lead claim and merge must be atomic and capability-checked; conversation reassignment must validate same-tenant target agent before updating the conversation and linked lead.
12. Generic call create/end and recording init must bind the authenticated mobile/desktop user and registered device to the agent/call being changed.

## 8. Contract rules

- Use one response envelope: `{ success, data, pagination?, error? }`.
- Use typed Zod/OpenAPI schemas for every request and response.
- Every resource query and mutation must be tenant-scoped in the database operation itself.
- Role checks are not enough; enforce action capabilities.
- Use cursor pagination for conversations/messages and stable page pagination for tables.
- Add idempotency keys for messages, imports, campaign dispatch, payments, webhook events and mobile offline events.
- Return `401`, `403`, `404`, `409`, `422` consistently with machine-readable error codes.
- Include `requestId`, `createdAt/updatedAt`, actor and audit metadata where relevant.
- Never return access tokens, webhook secrets or private credentials.
- Add rate limits per tenant/user for messaging, imports, campaign dispatch and webhooks.
- Avoid growing duplicate aliases: `/api/v1/reports/summary` and `/api/v1/reports/overview` currently use the same handler, and the current frontend adapter still calls `/overview`. Keep both during migration, switch the adapter to canonical `/summary`, and deprecate `/overview` only after verified client usage reaches zero.

## 9. Required testing

Run automated tests for:

- every endpoint with no auth;
- every endpoint with wrong tenant;
- SALES_AGENT, MANAGER, ADMIN and SUPER_ADMIN scope;
- plan entitlement denial;
- duplicate create and idempotent retry;
- 409 claim/assignment conflict;
- Meta webhook signature and duplicate event delivery;
- OAuth state mismatch and callback replay;
- payment approval authorization;
- impersonation audit and return;
- mobile login/session collision and device revocation;
- mobile bootstrap/inbox pagination;
- mobile call lifecycle retry and duplicate replay;
- resumable recording upload and checksum failure;
- offline event replay and idempotency;
- push token registration/revocation;
- minimum app version and plan entitlement denial;
- pagination at 311 conversations, 5,829 lead assignments, 500,000 synthetic leads and 5,000,000 synthetic leads using bounded queries;
- realtime with many concurrent SSE clients;
- all legacy routes disabled or explicitly marked deprecated after migration.

Do not report only HTTP 200. Report p50, p95, p99, error rate, DB query count, response size and memory/connection behavior.

## 10. Final response required from backend engineer

Return:

1. Complete endpoint matrix.
2. OpenAPI/JSON schema or generated TypeScript DTO package.
3. Migration status for every legacy route.
4. Database index/query plan changes.
5. Permission/capability matrix.
6. Meta webhook and delivery-state design.
7. Plan/entitlement source-of-truth decision.
8. Load-test report.
9. Test report including tenant isolation.
10. Explicit list of remaining missing APIs.

The UI team will not start wiring a page until its minimum read API, mutation API, permission contract, pagination, realtime behavior, empty/error states and test evidence are marked ready.
