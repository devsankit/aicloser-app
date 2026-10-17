# AIcloser Page-by-Page New API Audit

Audit date: 2026-10-16  
Frontend: `D:\AIcloser\application`  
Backend: `D:\AIcloser\aicloser-api`  
Target contract: `/api/v1`  
Scope: current dashboard menu from Dashboard Overview through Settings, including hidden screens reached by existing navigation state.

## Re-audit of the previous migration report

The previous report is a useful implementation log, but its `READY` labels must not be accepted without checking the current checkout and live contract. This re-audit was performed against the current files and a live health/route probe on 2026-10-16.

### Confirmed

- The local New API now contains and mounts the additional `ai`, `workspace`, `integrations`, `marketing` and expanded webhook/super-admin modules.
- The live API health endpoint returned HTTP 200 with a healthy database.
- Unauthenticated probes returned HTTP 401 for the mounted protected route families, confirming that those routers are reachable behind authentication.
- The local frontend adapter contains methods for the new domains.

### Report claims that are not yet verified or are incorrect

- Local `npm run build` currently fails in `src/routes/v1/calls.ts` because `SalesLeadStage` is referenced but not imported. Therefore the current working tree cannot be called build-green.
- The report claims `/api/v1/recordings/:id/stream`, but the source exposes `/init`, `/:id/content`, `/:id/complete` and `/:id/playback`; there is no `stream` route in the current source.
- The AI endpoints are currently deterministic/demo implementations in places: reply and objection responses are hardcoded, lead scoring is stage-based, and call transcription is explicitly marked as simulation/worker dispatch. They are not evidence of a production AI provider integration.
- WhatsApp message send currently returns a generated `wamid` and can return `simulated-channel` when no active channel exists; it is not proof that Meta delivery occurred.
- Workspace plan data still contains fallback/default values such as a generated expiry date, `PAID` fallback and default package values. It is not yet a reliable single source of truth until missing subscription state is handled as an explicit state.
- The frontend still contains legacy route calls; the current source has 38 files referencing `/api/sales/*`, `/api/conversations/*`, `/api/whatsapp-marketing/*`, `/api/super-admin/*`, `/api/meta/*` or `/api/admin/*`. The new adapter exists, but it is not yet wired into the rendered UI.
- The current backend has uncommitted changes in calls, leads, mobile and recordings. Those changes are not part of commit `f18bc75` and cannot be assumed to be on the live server merely because the live health endpoint is healthy.

Decision: treat the previous report as a route implementation milestone, not as final production certification. Before frontend migration, fix the local build, replace demo/synthetic behavior with real provider/queue behavior where claimed, reconcile the plan source of truth, wire the adapter page-by-page, and run authenticated tenant/role/duplicate tests.

## Production-readiness comparison: current MVP vs New API target

| Area | Current MVP | New API target | Current audit status |
|---|---|---|---|
| Business logic | Mixed into Next.js route handlers and UI-specific flows | Central server-side domain rules | Direction correct; migration not wired |
| Data ownership | Duplicate legacy ingestion paths and phone-based fallbacks | Tenant-scoped lead identity with immutable child references | Blocked until normalized phone uniqueness and atomic upsert exist |
| Security | Several legacy paths and UI visibility assumptions | Server-enforced tenant, user, agent and capability scope | Partial; lead 360/tasks/calls/conversation gaps remain |
| Pagination | Heavy legacy screens and broad fetches | Bounded cursor/page contracts | Partial; conversations/contacts/payments/marketing still use offset or unbounded lists |
| Realtime | Legacy SSE/route behavior | Authorized, durable event stream with backfill | Partial; current SSE polls the database every second per connection |
| Recordings | Legacy mobile upload/proxy behavior | Tenant/device-bound upload, completion and playback | Partial; bounded raw-body upload, no true resumable chunks/stream route |
| Provider integrations | Meta/WhatsApp behavior mixed with local fallbacks | Verified provider calls, delivery states, retries and idempotency | Blocked where synthetic `wamid`/`simulated-channel` responses remain |
| Plans/entitlements | Multiple legacy sources | One authoritative subscription/entitlement contract | Partial; fallback package/payment/expiry values remain |
| Frontend contract | Current MVP still calls legacy APIs | Typed adapter calls only New API | Not started in rendered UI; adapter exists but is unused |

### Required readiness gates

1. Build and typecheck pass on a clean checkout; no uncommitted route changes are treated as deployed.
2. Tenant isolation tests cover two companies, two agents per company, Super Admin override, mobile device ownership and webhook channel mapping.
3. Lead identity is normalized and unique per tenant; ingestion is atomic and duplicate-safe under concurrent requests.
4. Every list is bounded and indexed; large tables use cursor/delta pagination and no route returns an unbounded relation.
5. Realtime uses a durable event cursor/backfill model and a connection-capacity test rather than one database poll per client per second.
6. Provider operations fail closed when no real channel is configured; synthetic IDs are allowed only in explicit test mode.
7. Only after these gates pass should the UI adapter replace legacy calls page by page.

## Executive verdict

The New API is usable for the CRM core, but the complete current UI is not yet ready to switch over without feature loss.

### Ready for first migration wave

- Authentication/session bootstrap
- Dashboard summary and reporting basics
- Leads, pipeline, lead pool, claim, duplicates and merge
- Contacts
- Conversation list, thread history, message send, read state, attachments and realtime events
- Chat-side assignment, stage, notes and callbacks
- Calls and recording lifecycle
- Payments approval/rejection
- Team member read/update
- Stages and custom fields

### Partial or needs backend hardening

- Chat assignment/transport/typing authorization
- AI reply and drip automation behavior
- Reports beyond the three summary endpoints
- Integrations and channel setup
- Devices/mobile sync
- Full lead 360 consistency across calls, payments, tasks and messages

### Missing from the New API

- Bulk lead import
- Lead form CRUD/submissions
- WhatsApp marketing campaigns, templates, audiences and dispatch
- Full plugin/channel management
- Full automation workflow CRUD, runs and logs
- Full AI bot configuration/training/chat
- Missed-call acknowledge/resolve state
- Export endpoints
- Dedicated permission/capability contract
- Dedicated notification/read state contract

The safe migration decision is therefore: migrate the core pages first, keep unsupported modules behind a feature flag or hide them from the New API navigation until their contracts exist. Do not silently connect those pages to legacy endpoints.

## New API UI-usage audit

The New API route list was checked against the current web menu, hidden web screens, the mobile client surface and platform integrations. “Not directly rendered as a web card” does not mean “unused”: some routes are infrastructure or role-specific contracts.

| New API area | UI/use context | Classification | Decision |
|---|---|---|---|
| Auth, `/me/sessions`, heartbeat/logout | Login, session expiry, device/session security | Core web + security | Keep |
| Leads, pipeline aggregates, pool, duplicates, merge, 360, notes, tasks | Dashboard, Leads, lead detail and assignment workflows | Core web | Keep |
| Contacts | Contacts and lead/contact linking | Core web | Keep |
| Conversations, messages, attachments, assignment, stage, notes, callback, typing, transport, AI reply, drip | Inbox/chat workspace and chat-side actions | Core web; some actions need hardening | Keep and fix authorization/storage gaps |
| Realtime events | Live chat updates, typing and delivery refresh | Web support contract | Keep; capacity-test SSE |
| Calls and recordings | Calls, call detail and playback; also reusable by mobile | Core web + mobile foundation | Keep; use generic routes before adding wrappers |
| Payments | Payments & Confirmations | Core web/admin | Keep |
| Reports `summary` / `closers` | Dashboard and Reports | Core web | Keep |
| Reports `overview` | Same handler as `summary`; current `src/lib/api-client.ts` calls it | Duplicate alias, but currently used | Keep the alias during migration; switch the adapter to canonical `summary` later, then deprecate only after client usage is zero |
| Team, stages, custom fields | Team, Settings and pipeline configuration | Core web | Keep |
| Mobile contacts/devices/offline sync | Mobile application, not the desktop menu | Mobile-only | Keep; do not expose in web navigation |
| Super Admin tenants/impersonation | Super Admin tenant directory and support access | Super Admin-only | Keep; not regular sales UI |
| Meta webhook | Provider callback, inbound messages and delivery state | Integration infrastructure | Keep; not a user-facing page, but required for chat |
| Google Drive integration | Attachment/file integration and settings | Optional integration | Keep only if Drive is part of product scope; hide the settings card otherwise |

Conclusion: no core New API family is random or contextless. The only verified redundancy is the reports alias, but it is currently used by the frontend adapter, so it must not be removed now. Mobile, Super Admin, webhook and Google Drive routes should remain outside the regular web menu and be loaded only by the corresponding client/integration. The frontend adapter must not call any route that is not required by the active page and permission set.

## Mobile calls, recordings and lead synchronization

The mobile app must not have a separate lead/call/recording database. The intended model is one tenant-scoped source of truth shared by web and mobile:

- `POST/GET /api/v1/calls` and `POST /api/v1/calls/:id/end` store and update the same call records for both clients.
- `POST /api/v1/recordings/init`, `POST /api/v1/recordings/:id/content`, `POST /api/v1/recordings/:id/complete` and `GET /api/v1/recordings/:id/playback` provide the common recording lifecycle. The upload is linked to the call and completion updates its recording status.
- `/api/v1/mobile/contacts` currently syncs a bounded batch of mobile contacts into the shared marketing-contact and lead tables; it is not a complete lead synchronization protocol.
- `/api/v1/mobile/offline-events/sync` currently has explicit business logic for idempotent `CALL_END` replay. It does not yet replay arbitrary lead create/update, message or recording-byte events.
- The current generic recording implementation accepts a `deviceId`, but device ownership validation and resumable chunk upload still need to be completed before calling mobile recording sync production-ready.

Required before claiming “all leads sync to mobile”: define either a mobile-specific bounded delta endpoint (for example, leads changed since a cursor) or document that the mobile client consumes the tenant-scoped leads endpoint with cursor/updatedAt filters; define outbound offline event types, idempotency keys, conflict rules, assignment/permission scope and realtime backfill behavior. Do not add duplicate `/mobile/leads` or `/mobile/recordings` wrappers if the generic contracts can satisfy those requirements.

## Lead ownership and tenant-isolation audit

### Verified protections

- Standard users are bound to the tenant in the server middleware; spoofed tenant header, query and body values are rejected.
- Lead list, create, detail, update, delete, claim, duplicate lookup and merge start with tenant-scoped lead queries.
- Lead creation and reassignment validate that the target `salesAgentProfile` belongs to the same tenant.
- Calls and recordings check the call/upload tenant, and recording playback limits `SALES_AGENT` users to their own calls.
- Super Admin cross-tenant access requires an explicit, existing target workspace and is marked as an override.

### Must be fixed before declaring ownership production-safe

1. `GET /api/v1/leads/:id/360` verifies tenant ownership but does not apply the `SALES_AGENT` assigned-agent filter used by normal lead detail. A closer who knows another lead ID could receive that lead’s 360 data.
2. Lead notes/tasks do not consistently verify that the parent lead exists in the tenant and is visible to the current user. Task update/delete currently operate by task ID alone; they must verify parent lead, tenant and role in the same operation.
3. Lead merge has tenant checks but no explicit capability/ownership check and should be atomic. A closer must not merge leads outside their permitted assignments.
4. Conversation reassignment writes the requested `assignedAgentId` without first validating that the target agent exists in the same tenant and is eligible. The linked lead update must use the same validated target and transaction.
5. Conversation typing broadcasts without checking conversation existence/access, and transport mutation updates by conversation ID without a tenant-safe lookup/update.
6. Generic call create/end validates tenant and agent existence, but does not yet prove that a `SALES_AGENT` caller is acting as their own agent profile. A closer must not create/end another closer’s call by supplying another `agentId`.
7. Recording init checks call tenant but does not yet verify that `deviceId` belongs to the authenticated agent/tenant. Add this before mobile recording sync is trusted.
8. Mobile contact sync can create a second lead when the same phone already belongs to another assigned agent, and it can move the marketing-contact assignment to the current agent. Deduplication and reassignment must use one canonical tenant-level identity plus an explicit reassignment permission.
9. Pipeline aggregates currently cover the entire tenant. Confirm whether `SALES_AGENT` should receive only their own aggregates; if yes, apply the same assigned-agent scope as lead list/detail. The open lead pool may remain tenant-wide only if the product explicitly intends a shared claim pool.

Until these items are fixed and tested with two tenants and two agents in one tenant, the API should be marked `PARTIAL` for lead ownership—not fully production-ready.

## “Lead is the Sun” claim validation

The lead-centric rule is the correct product architecture, but the pasted claim that it is already guaranteed is not yet accurate:

- `SalesLeadAssignment` currently has an index on `(tenantId, customerPhone)`, not a unique constraint on a normalized phone identity. A database-level guarantee does not exist yet.
- `POST /api/v1/leads` performs an application-level phone/email lookup, but the check and insert are not one atomic operation. Concurrent requests can still create duplicates, and raw phone formatting is not stored in a canonical normalized column.
- The Meta webhook attempts to reuse a lead by tenant and phone suffix, but if duplicates already exist it selects an arbitrary row. If the WhatsApp channel is not mapped, the current fallback tenant value must never be used in production; the event should be rejected/quarantined instead of assigned to an unrelated workspace.
- The webhook selects an agent by tenant but does not clearly enforce active/eligible assignment policy before creating a lead.
- Mobile contact sync can create a new lead when the same phone is assigned to another agent; this conflicts with “one phone, one Sun.” It needs canonical tenant-level deduplication plus an explicit reassignment policy.
- Calls and timeline notes carry lead references, but conversation matching and some payment/deal lookups still use phone/custom-field fallbacks. These must be migrated to an immutable lead ID wherever possible.

The safe target is **one normalized phone identity per tenant/workspace**, not one global phone across all companies. Enforce it with a canonical phone column plus a tenant-scoped unique index (after a reviewed cleanup), then make webhook, mobile contact sync and manual lead creation use an atomic find-or-create/upsert path. Never run a destructive duplicate cleanup before producing a dry-run mapping and backing up the database.

## Source findings

The current menu is declared in `src/components/sales/sales-dashboard.tsx:258-274`. The main page branches are rendered in `src/components/sales/sales-dashboard.tsx:1929-3608`.

The current shell also contains legacy-only navigation/state for `campaigns`, `developer`, `ai-beta`, `custom-fields`, `whatsapp-api`, `instagram-inbox` and `chatbot-builder`. These are not all visible in the primary menu, but URL/session state can still reach them.

The current dashboard makes direct calls to legacy routes such as:

- `/api/sales/dashboard`
- `/api/sales/conversations`
- `/api/sales/leads`
- `/api/sales/leads/import`
- `/api/sales/call-reports`
- `/api/sales/reports/*`
- `/api/sales/roles/*`
- `/api/sales/automations/*`
- `/api/sales/ai-bot/*`
- `/api/sales/forms/*`
- `/api/sales/whatsapp*`
- `/api/conversations/*`
- `/api/payment-links/*`

These calls must be replaced by a typed New API adapter. The navigation shell should not call feature APIs directly.

Important implementation finding: `src/lib/api-client.ts` is a prepared `/api/v1` adapter, but no component currently imports or calls `aicloserApi`. The live UI is still using the legacy Next.js routes listed above. Therefore, in the current checkout, **zero New API families are actually wired into the rendered UI yet**. The New API audit below describes the correct migration target, not proof that those calls are already active in the browser.

## Current navigation audit

Status meanings:

- **Ready**: New API has the minimum read and mutation contract for the current screen.
- **Partial**: the main screen can migrate, but one or more visible actions or data cards are missing/hard to trust.
- **Blocked**: migrating now would remove a current feature or require falling back to legacy APIs.

| Current page | Current UI responsibility | New API status | Migration decision |
| --- | --- | --- | --- |
| Dashboard Overview | KPIs, team/closer metrics, date filters, calls, callbacks, lead funnel, activity | Partial | Migrate after a server-side overview view model is defined |
| CRM Pipeline & Kanban | List/Kanban, filters, stage updates, assignment, notes, tasks, duplicate merge, lead 360 | Ready with scope checks | First-wave migration |
| Grab Leads | Pool, quota/availability, claim lead | Ready | First-wave migration |
| Contacts | Search, create, profile, linked data, import-related panels | Partial | Migrate contacts; split import out |
| Lead Import | CSV/file import and result reporting | Blocked | Hide until bulk import API exists |
| Call Recordings & Missed Call History | Calls, recording player, missed-call history, dispositions | Partial | Migrate calls/recordings; hide missed-call actions until contract exists |
| Live Multi-Channel Chat | Inbox, thread, attachments, typing, read, assignment, stage, notes, callbacks | Partial | First-wave migration after security fixes and provider delivery semantics |
| Lead Form Builder | Form CRUD, custom fields, submissions, lead conversion | Blocked | Keep legacy screen isolated or hide |
| Plugins & Channels | WhatsApp/Instagram/email/channel status and setup | Partial | Replace with Integrations page based only on supported contracts |
| WhatsApp Marketing | Audience, templates, campaigns, preview, dispatch, channel test | Blocked | Hide from New API navigation |
| AI Bot & Automations | Bot config, training, chat test, workflow CRUD, logs, webhooks | Blocked/partial | Put behind Labs flag; do not claim production parity |
| Payments & Confirmations | Payment links, proof preview, approval/rejection, notifications/settings | Ready for core payment state | First/second-wave migration after role policy is explicit |
| Reports & Lead-IQ | Custom reports, exports, AI query, closer performance, lead intelligence | Partial | Start with summary/overview/closers; defer custom/export/AI cards |
| Team & Users | Team list, role/status/permissions, plan/seats, session controls | Partial | Team list/update ready; permissions/session admin contract incomplete |
| Settings, Team & Channels | Profile, round robin, chat visibility, WhatsApp, Instagram, custom fields, stages | Partial | Split into Workspace, Integrations, Security, Stages & Fields |

## Page-by-page contract audit

### 1. Dashboard Overview

Current UI features:

- Welcome/role-aware workspace summary
- Date range filters: today, yesterday, last 7 days, month, all time
- Total calls, talk time, connect rate and recording metrics
- Lead/funnel and deal metrics
- Callback/action lead counts
- Admin team activity and agent selector
- Shortcuts to CRM, lead pool, calls, inbox and payments

New API mapping:

- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/overview`
- `GET /api/v1/reports/closers`
- `GET /api/v1/leads/pipeline-aggregates`
- `GET /api/v1/calls`

Missing/required contract work:

- A single overview response or documented query strategy for date range, tenant, team and selected closer.
- Explicit metric definitions: what counts as a connected call, conversion, response rate and active lead.
- Server-side aggregation for large tenants. The UI must not fetch thousands of calls/leads and calculate KPIs in the browser.
- Permission response for team-wide vs own metrics.
- Consistent timezone handling for date filters.

Decision: **Partial**. Build the new dashboard against aggregate endpoints only. Do not port the current legacy snapshot shape as-is.

### 2. CRM Pipeline & Kanban

Current UI features:

- List and Kanban views
- Search and saved views
- Stage/status/source/segment/ownership/date filters
- Stage totals and counts
- Lead assignment and reassignment
- Stage change reason for lost/recycled states
- Lead creation/edit/delete
- Lead notes and tasks
- Duplicate lead review and merge
- Customer 360 drawer
- Conversation and call shortcuts
- Export action in the current UI

New API mapping:

- `GET /api/v1/leads`
- `POST /api/v1/leads`
- `GET /api/v1/leads/pipeline-aggregates`
- `GET /api/v1/leads/:id`
- `PATCH /api/v1/leads/:id`
- `DELETE /api/v1/leads/:id`
- `GET /api/v1/leads/:id/360`
- `GET|POST /api/v1/leads/:id/notes`
- `GET|POST /api/v1/leads/:id/tasks`
- `PATCH|DELETE /api/v1/leads/:id/tasks/:taskId`
- `GET /api/v1/leads/duplicates`
- `POST /api/v1/leads/merge`
- `GET /api/v1/stages`

Missing/required contract work:

- Confirm server-side filters and sort fields match every current saved-view filter.
- Add export contract if export remains in the product.
- Define optimistic update conflict behavior for simultaneous stage/assignment changes.
- Return a stable lead summary DTO so list cards do not depend on database field names.
- Return custom fields in list/360 according to permission, not by frontend filtering.

Decision: **Ready for first wave**, with contract tests for pagination, filters, duplicates, role scoping and merge rollback.

### 3. Grab Leads

Current UI features:

- Shared lead queue
- Availability count
- Active lead quota/capacity state
- Lead source, priority and creation time
- Claim action
- Empty, quota-full and disabled states

New API mapping:

- `GET /api/v1/leads/pool`
- `POST /api/v1/leads/:id/claim`
- `GET /api/v1/leads` for the current user's active quota context if returned there

Missing/required contract work:

- Return quota state directly in the pool response.
- Claim must be atomic and return a conflict when another closer claims first.
- Define the ordering/fairness rule for the pool.
- Return the resulting assigned lead DTO after a successful claim.

Decision: **Ready** after race-condition tests.

### 4. Contacts

Current UI features:

- Contact search/list
- Contact creation/update
- Contact detail/profile
- WhatsApp scanner and email inbox panels in the legacy UI
- Import and bulk marketing links
- Open chat and related lead actions

New API mapping:

- `GET /api/v1/contacts`
- `POST /api/v1/contacts`
- `GET /api/v1/contacts/:id`

Missing/required contract work:

- Contact search must define normalized phone/email matching and pagination.
- Contact detail should include related lead IDs and conversation IDs or provide documented follow-up calls.
- Decide whether WhatsApp scanner/email inbox are integrations or contact sources; they are not covered by New API contacts.
- Add update endpoint if the screen allows editing an existing contact. Current New API list only exposes create and detail.

Decision: **Partial**. Migrate the core contacts table/profile; do not carry scanner/email/import tabs into the New API screen yet.

### 5. Lead Import

Current UI features:

- File upload
- Imported/skipped/duplicate/invalid counts
- Row-level import errors
- Add-manually fallback
- Import permission gate

New API mapping: none.

Required backend contract:

- `POST /api/v1/leads/import` with an asynchronous job ID for large files.
- `GET /api/v1/leads/import/:jobId` for progress/result.
- Idempotency key and duplicate policy.
- Field mapping/validation preview.
- Tenant-scoped file limits and audit log.

Decision: **Blocked**. Hide from the New API menu until this contract exists.

### 6. Call Recordings & Missed Call History

Current UI features:

- Call history filters
- Team/closer selection
- Call status and duration
- Recording state/reason badges
- Recording playback
- Missed call history and follow-up handling
- Call disposition actions

New API mapping:

- `GET /api/v1/calls`
- `POST /api/v1/calls`
- `POST /api/v1/calls/:id/end`
- `POST /api/v1/recordings/init`
- `POST /api/v1/recordings/:id/content`
- `POST /api/v1/recordings/:id/complete`
- `GET /api/v1/recordings/:id/playback`

Missing/required contract work:

- No New API missed-call list/acknowledge/resolve endpoints.
- No explicit disposition endpoint in the New API list.
- Recording playback authorization and content range/streaming behavior must be documented.
- Call list needs pagination/filtering by lead, agent, status and date.

Decision: **Partial**. Migrate calls and recordings. Keep missed-call actions hidden until the missing endpoints are delivered.

### 7. Live Multi-Channel Chat

Current UI features:

- Conversation list with pagination/search/filtering
- Channel and assignment/stage badges
- Thread history with customer/internal lanes
- Message composer
- Read state
- Typing indicator
- Attachments and secure preview
- Assignment, stage, notes and callback actions
- Transport/channel selector
- AI reply and drip controls
- Lead/customer context panel
- Realtime refresh

New API mapping:

- `GET /api/v1/conversations`
- `GET /api/v1/conversations/:id/messages`
- `POST /api/v1/conversations/:id/messages`
- `POST /api/v1/conversations/:id/read`
- `POST /api/v1/conversations/:id/attachments`
- `GET /api/v1/conversations/:id/attachments/:filename`
- `POST /api/v1/conversations/:id/assign`
- `PATCH /api/v1/conversations/:id/stage`
- `POST /api/v1/conversations/:id/notes`
- `POST /api/v1/conversations/:id/callback`
- `POST /api/v1/conversations/:id/typing`
- `PATCH /api/v1/conversations/:id/transport`
- `POST /api/v1/conversations/:id/ai-reply`
- `POST /api/v1/conversations/:id/drip`
- `GET /api/v1/realtime/events`

Required backend hardening before UI migration:

- `PATCH /:id/transport` currently updates by `id` without putting `tenantId` in the update `where`; validate the tenant-scoped conversation first and update only that record.
- `POST /:id/typing` broadcasts without first verifying that the conversation exists and that the user can access it.
- `POST /:id/assign` validates the conversation tenant but does not visibly validate that the target agent belongs to the same tenant and is eligible for assignment.
- Message status currently means the API stored the message and emitted an event; it must not be shown as provider-delivered until the provider delivery status exists.
- Message history is stored in `AppConversation.payload` JSON. Define the scale/retention strategy before high-volume production use.
- Realtime currently polls the database every second per SSE connection. Add a load test and connection budget before enabling for large tenants.
- AI reply is rule-based draft copy and drip only changes JSON state. Mark both as beta/feature-flagged.

Decision: **Partial but high priority**. This is the first visible page to migrate after the authorization fixes and a typed adapter are in place.

### 8. Lead Form Builder

Current UI features:

- Form create/edit/delete
- Form fields using custom fields
- Public form slug/submission flow
- Submission-to-lead behavior
- Round-robin integration

New API mapping: none in `/api/v1`.

Decision: **Blocked**. Keep as legacy-only or remove from the New API menu. Do not mix its local form data with the new lead contract.

Required endpoints: forms CRUD, form schema/publish state, public submission, submission result/job, spam/rate-limit controls and form-to-tenant ownership.

### 9. Plugins & Channels

Current UI features:

- WhatsApp setup/status
- Instagram setup/status
- Email/WhatsApp scanner-related controls
- Open inbox and channel settings

New API mapping:

- `GET /api/v1/google-drive/auth-url`
- `POST /api/v1/google-drive/callback`
- `GET /api/v1/google-drive/status`
- `POST /api/v1/google-drive/disconnect`
- `POST /api/v1/google-drive/sync-test`
- `POST /api/v1/webhooks/meta`
- `GET /api/v1/conversations` channel field

Missing/required contract work:

- No generic channel connection list/status/update endpoint.
- No Instagram/WhatsApp OAuth/setup lifecycle in New API.
- No integration permission/capability response.
- No webhook delivery health/last event status.

Decision: **Partial**. Rename to Integrations and show only integrations covered by New API. Do not expose setup buttons that still hit legacy routes.

### 10. WhatsApp Marketing

Current UI features:

- Campaign list/create/edit
- Audience/groups/import
- Template management and sync
- Preview and test send
- Dispatch and campaign status
- Channel configuration

New API mapping: none.

Decision: **Blocked**. Hide from New API navigation. A future contract needs campaigns, templates, contacts/groups, preview, dispatch, delivery status, opt-out and webhook events.

### 11. AI Bot & Automations

Current UI features:

- AI bot config
- Training data add/delete
- AI chat test
- Workflow CRUD
- Workflow logs
- Inbound webhook keys
- Developer integrations/API access view

New API mapping:

- `POST /api/v1/conversations/:id/ai-reply`
- `POST /api/v1/conversations/:id/drip`

Missing/required contract work:

- Bot configuration, versions, training documents and test chat APIs.
- Automation workflow CRUD, validation, enable/disable, run history and logs.
- Idempotent webhook ingestion and delivery status.
- Per-tenant secret rotation and audit trail.

Decision: **Blocked for full parity**. Show as Labs only if product explicitly wants discovery; otherwise hide.

### 12. Payments & Confirmations

Current UI features:

- Payment request list
- Payment details and proof preview
- Create payment request
- Approve/reject proof
- Notify customer
- Payment settings and confirmation webhook fields

New API mapping:

- `GET /api/v1/payments`
- `POST /api/v1/payments`
- `POST /api/v1/payments/:id/approve`
- `POST /api/v1/payments/:id/reject`

Missing/required contract work:

- Proof upload/preview URL contract.
- Notification/resend endpoint if the button remains.
- Settings/confirmation webhook contract.
- Approval/rejection actor, reason and audit response.
- Lead/customer linkage in list/detail DTO.

Decision: **Ready for core status**, **partial for current UI parity**. Keep approval restricted to the correct tenant role.

### 13. Reports & Lead-IQ

Current UI features:

- Report summary/custom report
- Closer comparison
- Lead intelligence/AI query
- Export CSV/Excel
- Date/team filters

New API mapping:

- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/overview`
- `GET /api/v1/reports/closers`

Missing/required contract work:

- Custom report dimensions/filters.
- Export job/download endpoint.
- Lead-IQ/AI query endpoint and a clear definition of the returned score.
- Server-side date/timezone and permission semantics.

Decision: **Partial**. Migrate the standard reports first; label advanced intelligence/export as unavailable until supported.

### 14. Team & Users

Current UI features:

- Team member list
- Role/status update
- User permissions/features
- Workspace plan/seats
- Session/security controls

New API mapping:

- `GET /api/v1/team`
- `PATCH /api/v1/team/:id`
- `GET /api/v1/auth/me`
- `GET /api/v1/client-sessions/sessions`
- `GET /api/v1/client-sessions/activity`
- `POST /api/v1/client-sessions/:userId/sessions/:channel/revoke`
- Super-admin tenant APIs only for explicitly authorized cross-tenant workflows

Missing/required contract work:

- Invite/create/deactivate user endpoint if the UI allows those actions.
- Explicit capability matrix instead of frontend-only feature IDs.
- Plan/seat endpoint.
- Admin-only session listing/revocation semantics.
- Audit log for role/permission changes.

Decision: **Partial**. Team read/update can migrate; permission and seat management needs contract completion.

### 15. Settings, Team & Channels

Current UI features:

- Profile/company details
- Round-robin settings
- Chat visibility
- Stages
- Custom fields
- WhatsApp setup
- Instagram setup
- Security/password actions

New API mapping:

- `GET /api/v1/stages`
- `GET|POST /api/v1/custom-fields`
- `PUT|DELETE /api/v1/custom-fields/:id`
- Auth/session endpoints
- Google Drive integration endpoints
- Meta webhook endpoint

Missing/required contract work:

- Profile update endpoint.
- Round-robin settings endpoint.
- Chat visibility policy endpoint.
- WhatsApp and Instagram connection lifecycle endpoints.
- Password change contract under the new auth service.
- Settings audit log.

Decision: **Partial**. Split the current page into `Workspace settings`, `Stages & custom fields`, `Integrations` and `Security`; only render sections with a real New API contract.

## Hidden/legacy screen audit

These are still represented in `SalesTab` or URL restoration but are not part of the clean 15-item menu:

| Hidden route/state | Current screen | New API status | Action |
| --- | --- | --- | --- |
| `campaigns` | Reuses call reports | No campaign API | Redirect to Calls or hide |
| `developer` | Automation/developer panel | No developer key/workflow API | Hide |
| `ai-beta` | AI bot panel | Only conversation AI draft exists | Labs flag only |
| `custom-fields` | Settings deep-link | Custom fields/stages available | Keep as settings sub-route |
| `whatsapp-api` | WhatsApp setup card | No setup lifecycle | Hide or route to Integrations placeholder |
| `instagram-inbox` | Instagram plugin card | No inbox/plugin API | Hide |
| `chatbot-builder` | WhatsApp flow builder | No flow CRUD/run API | Hide |

The new navigation must reject unsupported URL tabs instead of rendering a legacy panel accidentally.

## Cross-cutting API requirements before UI implementation

### 1. Shared response and error contract

Every endpoint used by the UI should return the same envelope:

```ts
{
  success: boolean,
  data: unknown,
  pagination?: { page?: number, limit?: number, total?: number, totalPages?: number, nextCursor?: string | null },
  error?: { code: string, message: string, field?: string }
}
```

The current frontend checks both `payload.ok` and `payload.success` in different places. New UI must use one adapter and one contract only.

### 2. Capability/permission contract

Add a session capability response containing:

- tenant ID and workspace name
- user ID, role and agent/profile ID
- read capabilities per module
- mutation capabilities per action
- team-wide vs own-data scope
- feature flags and API version

Example capability keys: `leads.read`, `leads.update`, `leads.assign`, `leads.delete`, `conversations.read`, `conversations.send`, `payments.approve`, `team.manage`, `integrations.manage`.

The frontend must use this response for navigation and action visibility, but the backend must enforce it again.

### 3. Pagination and scale

- All list endpoints need server-side pagination, stable sort and documented maximum limits.
- Conversation history should remain cursor-paginated.
- Lead and conversation list DTOs must not return full JSON message history.
- Dashboard metrics must be aggregate queries, not browser reductions over large lists.
- Add indexes for tenant + updated time and common filter combinations before production volume.

### 4. Realtime contract

Define event names and payloads for:

- `lead.created`, `lead.updated`, `lead.stage_changed`
- `conversation.created`, `conversation.updated`
- `message.created`, `message.status_changed`
- `call.started`, `call.ended`
- `recording.uploaded`, `recording.failed`
- `payment.created`, `payment.updated`

Events must be tenant-scoped and permission-filtered. The UI should invalidate the affected query, not refresh the entire dashboard after every event.

### 5. Auditability and idempotency

Mutations that change ownership, stage, payments, roles, imports or message delivery need:

- actor ID
- tenant ID
- request/idempotency key where retries are possible
- before/after or reason metadata
- consistent conflict response (`409`)

## Confirmed backend blockers to fix before chat migration

1. Tenant-safe update for `PATCH /api/v1/conversations/:id/transport`.
2. Conversation access verification in `POST /api/v1/conversations/:id/typing`.
3. Same-tenant and role validation for the target agent in `POST /api/v1/conversations/:id/assign`.
4. Provider delivery state for messages; storage/event acceptance is not the same as delivery.
5. Load strategy for `AppConversation.payload` message history.
6. Realtime SSE connection/polling capacity test.
7. Contract tests for every `SALES_AGENT` vs `MANAGER` vs `ADMIN` data path.

## Recommended migration order

### Wave 0 — API contract hardening

- Freeze DTOs, envelope, error codes, pagination and capability response.
- Fix the confirmed chat authorization/update issues.
- Add tenant/role integration tests.
- Add OpenAPI or generated TypeScript types for `/api/v1`.
- Decide whether API base URL is same-origin proxy or direct `api.aicloser.in`.

### Wave 1 — CRM core

- Shell/auth/session bootstrap
- Overview aggregates
- Leads/list/Kanban/lead 360
- Grab Leads
- Contacts core
- Team read/update
- Stages/custom fields

### Wave 2 — Inbox and telephony

- Conversation list/thread
- Message send/read/attachments
- Assignment/stage/notes/callback
- Realtime invalidation
- Calls/recording lifecycle

### Wave 3 — Commercial and reporting

- Payments core
- Standard reports
- Audit-friendly approvals

### Wave 4 — Remaining product modules

- Import
- Forms
- Integrations/channels
- WhatsApp marketing
- Automation/AI
- Advanced reports and exports

## Page acceptance checklist

Before each page is marked migrated:

- Read API works for the page with an empty dataset.
- Loading, empty, error, unauthorized and forbidden states are designed.
- Every mutation has pending, success, conflict and retry behavior.
- `SALES_AGENT` cannot see another closer's lead, conversation, call or payment data.
- Tenant switching cannot leak cached data from the previous tenant.
- Refresh/deep-link preserves page and selected record safely.
- Realtime events update only the relevant query.
- Large lists use pagination/virtualization and do not load full histories.
- No request goes to a legacy `/api/sales/*` or `/api/conversations/*` endpoint.
- Browser verification is performed against the live API contract, not mocked data.

## UI architecture recommendation

Do not rebuild every screen as another branch inside `sales-dashboard.tsx`. Keep the existing shell only as a temporary host and create feature modules:

```text
src/features/
  auth/
  overview/
  leads/
  contacts/
  inbox/
  calls/
  payments/
  reports/
  team/
  settings/
src/lib/api/
  client.ts
  types.ts
  errors.ts
  query-keys.ts
```

Each feature owns its API hooks, DTO mapping, permission checks, loading/error/empty states and tests. The shell owns navigation and session context only.

## UI review signal

The UI review tool found no errors in the two main surfaces, but it reported design-system drift from hardcoded colors:

- `sales-dashboard.tsx`: 279 design-token suggestions.
- `chat-workspace.tsx`: 230 design-token suggestions and 2 autofocus accessibility warnings.

These are not API blockers, but they confirm that the new central theme should be applied while the feature modules are split. Do not mix this visual cleanup with the API migration in one large commit.

## Final audit conclusion

The New API is not yet a complete replacement for every current menu item. The backend engineer should finish the contract gaps listed above before the UI team wires those modules. For now, the correct UI target is a permission-aware core CRM: Overview, Leads, Pool, Contacts, Inbox, Calls, Payments, Reports, Team and Settings. Unsupported modules should be hidden or explicitly marked unavailable; they should never quietly use old data or legacy endpoints.

## Extended audit: Super Admin, plans, Meta and non-menu flows

The first version of this audit focused on the sales dashboard menu. The following surfaces are also part of the product contract and must be included before declaring the New API complete.

### Super Admin and workspace control

Current frontend/API capabilities in the application:

- `GET /api/super-admin/users`: cross-workspace directory with package name, package status, payment status, expiry, activation lock, seat limits, workspace status and user counts.
- `POST /api/super-admin/users`: update user/workspace seats, workspace expiry/status, user expiry/status/payment status and user profile.
- `GET /api/super-admin/sales`: sales settings, agents, groups, goals, rewards, commission rules, payouts, announcements, lead pool and mobile state.
- `POST /api/super-admin/sales`: agent create/update/status, password reset, group, announcement, lead-pool, goal, reward, commission rule, payout status and mobile-device status actions.
- `DELETE /api/super-admin/sales`: delete sales agent.
- `POST /api/super-admin/impersonate`: audited support access into a workspace.
- `GET /api/super-admin/mobile-telemetry`: devices, calls, diagnostic events, recording health and action items.
- `GET/PATCH /api/super-admin/feedback`: customer feedback queue and status updates.
- `GET/POST /api/super-admin/plugins/instagram-inbox`: Instagram plugin state.
- Super Admin WhatsApp flow builder and payment moderation endpoints.

New API coverage:

- `/api/v1/super-admin/tenants` only lists canonical workspaces with basic `planTier`, `maxSeats`, status and counts.
- `/api/v1/super-admin/tenants/:tenantId/impersonate` provides scoped impersonation.
- There is no New API contract for active package, subscription, payment status, entitlements, expiry enforcement, seat mutation, workspace suspension, agent management, commission/payout controls, telemetry, feedback, plugin state, flow builder or super-admin payment moderation.

Required New API modules:

```text
GET    /api/v1/workspace/plan
GET    /api/v1/workspace/entitlements
GET    /api/v1/workspace/usage
GET    /api/v1/admin/users
POST   /api/v1/admin/users
PATCH  /api/v1/admin/users/:id
DELETE /api/v1/admin/users/:id
GET    /api/v1/admin/roles/capabilities
PUT    /api/v1/admin/roles/capabilities
GET    /api/v1/admin/audit-log

GET    /api/v1/super-admin/tenants
GET    /api/v1/super-admin/tenants/:tenantId
GET    /api/v1/super-admin/tenants/:tenantId/plan
PATCH  /api/v1/super-admin/tenants/:tenantId/plan
PATCH  /api/v1/super-admin/tenants/:tenantId/status
PATCH  /api/v1/super-admin/tenants/:tenantId/seats
PATCH  /api/v1/super-admin/tenants/:tenantId/expiry
GET    /api/v1/super-admin/tenants/:tenantId/users
GET    /api/v1/super-admin/telemetry
GET    /api/v1/super-admin/feedback
PATCH  /api/v1/super-admin/feedback/:id
```

The plan DTO must contain the authoritative values currently assembled from `Package`, `UserSubscription`, `AppAuthUser`, `Tenant` and `AicloserWorkspace`: package ID/name/type, subscription status, payment status, start/end dates, seat limit, active seats, feature entitlements, API/webhook limits, suspension/activation lock and the source of truth used when values disagree.

### Pricing and active-plan data

The current Team & Users screen calls `/api/sales/workspace-plan`. That route derives:

- current package name/status/expiry;
- seat limit and active user usage;
- WhatsApp, AI, automation, analytics, API and webhook entitlements;
- plan usage counts.

The current Super Admin directory separately derives package name from the latest `UserSubscription`, `AppAuthUser.packageName` or workspace `planTier`, and derives payment/activation state from multiple tables. This is a data-consistency risk. The New API must provide one canonical plan/entitlements DTO instead of letting each frontend screen calculate it differently.

### Meta / WhatsApp / Instagram coverage

Current application capabilities outside `/api/v1` include:

- WhatsApp Embedded Signup/setup: state, register phone, subscribe webhook, refresh token, finalize signup.
- WhatsApp message send via Meta Graph API.
- WhatsApp media metadata lookup and secure media download.
- WhatsApp webhook verification and inbound message processing.
- WhatsApp channel status, quality rating, messaging tier and last sync.
- WhatsApp template CRUD, media upload, Meta template sync.
- WhatsApp marketing contacts, groups, import, campaigns, preview, dispatch, pause/resume/cancel/retry and test-send.
- Meta conversions events.
- Instagram OAuth connect/callback.
- Instagram webhook verification and signed event ingestion.
- Instagram deauthorize and data-deletion callbacks.
- Instagram plugin enable/disable state.

New API currently has only:

- `POST /api/v1/webhooks/meta` and `GET /api/v1/webhooks/meta`.
- Conversation transport/channel field.

The current New API webhook implementation acknowledges Meta quickly, resolves a tenant from `phoneNumberId`, appends inbound WhatsApp messages to the conversation payload, creates/links a lead and stores delivery events. It does not yet expose the complete channel lifecycle, provide the final normalized conversation/message DTO, safely reject unmapped channels, or cover Instagram OAuth/webhooks/data deletion.

Required New API modules:

```text
GET    /api/v1/integrations
GET    /api/v1/integrations/whatsapp/channels
POST   /api/v1/integrations/whatsapp/embedded-signup/start
POST   /api/v1/integrations/whatsapp/embedded-signup/complete
POST   /api/v1/integrations/whatsapp/channels/:id/refresh
POST   /api/v1/integrations/whatsapp/channels/:id/subscribe-webhook
PATCH  /api/v1/integrations/whatsapp/channels/:id
POST   /api/v1/integrations/whatsapp/messages
GET    /api/v1/integrations/whatsapp/media/:mediaId
GET    /api/v1/integrations/whatsapp/templates
POST   /api/v1/integrations/whatsapp/templates
POST   /api/v1/integrations/whatsapp/templates/media
POST   /api/v1/integrations/whatsapp/templates/sync
DELETE /api/v1/integrations/whatsapp/templates/:id

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

GET    /api/v1/integrations/instagram/oauth/start
GET    /api/v1/integrations/instagram/oauth/callback
GET    /api/v1/integrations/instagram/status
PATCH  /api/v1/integrations/instagram/status
GET    /api/v1/webhooks/instagram
POST   /api/v1/webhooks/instagram
POST   /api/v1/webhooks/instagram/deauthorize
POST   /api/v1/webhooks/instagram/data-deletion
```

Every Meta endpoint must specify tenant/channel ownership, signature verification, idempotency, retry behavior, webhook event persistence, delivery status mapping and permission checks. Never expose access tokens in DTOs; return booleans such as `hasAccessToken` and safe connection metadata.

### Mobile and telephony completeness

The New API has mobile contact sync, device registration, heartbeat and offline-event sync, plus calls and recordings. The current frontend also uses legacy mobile bootstrap, call start/end/discard/disposition, recording upload, certification, inbox, lead packs, profile, push token and device diagnostics routes.

The current mobile client surface is:

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

New API already covers mobile login through `POST /api/v1/auth/login` with `clientType: MOBILE`, session listing, contacts, devices, device heartbeat, offline events, calls and recording lifecycle. It does not yet expose the mobile bootstrap/inbox/profile/certification, call discard/disposition, resumable mobile upload, lead-pack, push-token or mobile diagnostics contracts.

Required additions or explicit migration decisions:

- mobile bootstrap and cursor-paginated inbox;
- mobile profile and device certification;
- call start/end/discard/disposition;
- recording upload/progress/failure;
- device certification and diagnostics;
- lead-pack request/claim;
- push-token registration and revocation;
- notification preferences and minimum app version policy;
- mobile crash/diagnostic telemetry;
- missed call list/acknowledge/resolve;
- Super Admin telemetry aggregation.

If these remain mobile-only and are intentionally outside the web New API, document that boundary and do not expose web controls that call old endpoints.

### Public and commerce flows

The application also has public payment pages, payment-link settings/proof/notify, PhonePe return/webhook callbacks, subscription callbacks, public forms, public form submissions, notifications and freelancer/customer payment details. These are not represented by the current New API.

Required decision: either migrate them into versioned public/admin API namespaces or explicitly mark them as separate legacy/public services with ownership, authentication and data-contract documentation. They cannot be accidentally coupled to the new dashboard client.

## Corrected completeness status

The New API is **core CRM-ready**, not **full-product-ready**. The missing areas are larger than the original menu-only audit showed:

1. Platform plan/billing/entitlement source of truth.
2. Super Admin workspace/user/seat/status/telemetry/feedback controls.
3. Meta channel lifecycle and Instagram integration.
4. WhatsApp marketing domain.
5. Mobile login/bootstrap/inbox, call-control, recording, offline-sync, push and diagnostics parity.
6. Public payment/subscription/form/notification flows.
7. Permission capabilities and audit logs for all of the above.

The backend completion prompt below includes these areas so the API engineer does not implement only the visible CRM pages.
