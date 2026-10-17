# AI Closer Backend Final Readiness Checklist

**Purpose:** Backend engineer ko ek hi handoff me complete scope dena. UI ko new `/api/v1/*` contracts ke against wire karne se pehle is checklist ke blockers close hone chahiye.

## Non-negotiable architecture rules

- Web Dashboard aur Mobile App ek hi tenant-scoped PostgreSQL data model use karenge.
- `Lead` central identity hai. Same tenant me same normalized E.164 phone par ek hi lead allowed hai.
- Same phone number different companies/tenants me ho sakta hai; unke leads, chats, calls, recordings, notes aur payments completely separate rahenge.
- Koi unmapped webhook, missing tenant, guessed tenant ya fallback tenant par data create nahi hoga. Event reject/quarantine hoga.
- Success response tabhi dena hai jab action real me persist/provider queue me accept ho. Fake `SENT`, fake plan, fake payment ya simulated provider response production path me allowed nahi hai.
- UI final wiring tabhi start hogi jab neeche ke P0/P1 gates evidence ke saath complete hon.

## 1. Authentication and session security — P0

- [ ] JWT signature hamesha verify ho; invalid signature par `jwt.decode()` fallback remove ho.
- [ ] Missing/invalid/expired token par `401` ho; role, userId ya tenantId client payload se trust na ho.
- [ ] User role aur tenant membership server/database se validate ho.
- [ ] `workspace-default`, hardcoded tenant ya any implicit tenant fallback remove ho.
- [ ] Suspended/locked workspace aur disabled user ko har request par block kiya ja sake.
- [ ] Login, OTP, password reset aur token refresh endpoints par dedicated brute-force/rate limits hon.
- [ ] Cookie auth ke liye `Secure`, `HttpOnly`, `SameSite`, CSRF policy aur logout revocation verify ho.
- [ ] Long-lived JWT ke badle revocable session strategy documented ho.
- [ ] Access token URL query string me expose na ho; SSE/file preview ke liye short-lived signed ticket use ho.
- [ ] Tokens, passwords, Meta secrets, FCM tokens aur recording URLs logs me mask hon.
- [ ] Login error response account enumeration allow na kare.

## 2. Tenant isolation and RBAC — P0

Create and approve an endpoint-by-endpoint matrix for:

`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SALES_AGENT`, `FREELANCER`, `CLIENT`.

- [ ] Har read/write query me server-derived `tenantId` mandatory ho.
- [ ] Every object ID lookup tenant condition ke saath ho.
- [ ] Same-tenant object hone ke baad bhi row ownership/assignment policy apply ho.
- [ ] `SALES_AGENT` sirf apne assigned leads, conversations, calls, recordings, notes/tasks dekhe aur mutate kare.
- [ ] `MANAGER` ka scope explicitly team/all workspace ke roop me define aur test ho.
- [ ] `ADMIN` configuration, integrations, users, campaigns, billing aur exports ke allowed actions explicitly define hon.
- [ ] `CLIENT/FREELANCER` ka customer/project-specific scope define ho; default broad tenant access na ho.
- [ ] Team routes par `requireRoles`/capability checks hon; authenticated tenant user ko automatic admin access na mile.
- [ ] `permissions` field ka actual server-side capability evaluation ho, ya field remove karke single canonical policy use ho.
- [ ] `x-target-tenant-id` sirf Super Admin ke liye allowed ho, workspace existence check aur immutable audit ke saath.
- [ ] Cross-tenant BOLA/IDOR tests har resource ke liye hon.

## 3. Common API contract

- [ ] Checked-in OpenAPI/contract document available ho.
- [ ] Har response me stable envelope, error code, requestId aur predictable validation errors hon.
- [ ] Dates ISO-8601 UTC me hon; enums documented hon.
- [ ] All list endpoints cursor pagination use karein; unbounded `findMany`/offset pagination remove ya justified ho.
- [ ] `limit` server-side cap ke saath ho.
- [ ] Create/send/import/webhook/mutation endpoints me idempotency contract ho.
- [ ] Idempotency conflict, retry aur duplicate response documented ho.
- [ ] No legacy endpoint silently different business logic run kare.
- [ ] `/api/v1/*` canonical route ho; legacy `/api/sales/*`, `/api/conversations/*` migration/deprecation plan me hon.

## 4. Lead and contact identity — P0

- [ ] Phone normalization ek shared library/service se E.164 canonical format me ho.
- [ ] `SalesLeadAssignment` me database unique constraint `(tenantId, normalizedPhone)` ho.
- [ ] Create/upsert transaction-safe ho; concurrent webhook/mobile/manual requests duplicate lead na bana saken.
- [ ] Email-only leads ke liye separate deterministic identity rule documented ho.
- [ ] Same number in two tenants = two separate leads; tests explicitly included hon.
- [ ] Webhook, mobile contacts, manual create, import aur marketing contacts same identity rules use karein.
- [ ] `MarketingContact` aur CRM Lead ke beech canonical relation/dangling-record policy define ho.
- [ ] Lead merge atomic transaction me ho:
  - [ ] conversations
  - [ ] messages
  - [ ] calls
  - [ ] recordings
  - [ ] notes/timeline
  - [ ] tasks/callbacks
  - [ ] payments/deals
  - [ ] marketing contact
  - [ ] external IDs
- [ ] Merge audit log, conflict policy, undo/backup policy aur duplicate dry-run report ho.
- [ ] `GET /leads/:id/360` row ownership, tenant ownership aur child-resource ownership enforce kare.
- [ ] Lead deletion/archive policy explicit ho; accidental hard delete prohibited ho.

## 5. Leads, stages, notes, tasks and custom fields

- [ ] `GET /leads`, `/leads/:id/360`, delta, search, filter aur aggregate endpoints role-scoped hon.
- [ ] Stage transitions server-side validate hon; invalid transitions reject hon.
- [ ] Assignment/reassignment sirf same-tenant active eligible agent ko ho.
- [ ] Assignment max-active-leads/canClaimLeads rules enforce hon.
- [ ] Notes/timeline create/update/delete parent lead + tenant + role check ke saath hon.
- [ ] Tasks/callbacks create/update/delete parent lead + tenant + owner check ke saath hon.
- [ ] Due-date/timezone semantics documented hon.
- [ ] Custom-field definitions aur values tenant-scoped hon; field type/value validation server par ho.
- [ ] Bulk import streaming, validation report, dedupe, idempotency aur rollback support kare.

## 6. Conversations and chat

- [ ] Har conversation canonical Lead se linked ho; orphan/duplicate conversation policy define ho.
- [ ] Multiple channels/threads same lead ke under supported hon; `lead.conversationId` single-thread limitation review ho.
- [ ] Messages relational/event table me persist hon; large mutable JSON payload ko primary history store na banaya jaye.
- [ ] Message external ID par tenant/provider-level unique idempotency ho.
- [ ] Chat list cursor-based ho; history cursor-based ho; payload me unlimited messages na aayein.
- [ ] Send flow: authorize → persist pending/outbox → provider send → status webhook → final status.
- [ ] Fake `wamid`/`SENT` response remove ho.
- [ ] Attachment upload signed URL/storage flow se ho; MIME, size, virus/content validation ho.
- [ ] Read receipts, typing, assignment, notes, callbacks aur tags row-scoped hon.
- [ ] Agent ko doosre agent ki chat ID guess karke access na mile.
- [ ] SSE/realtime reconnect cursor, replay window aur permission filtering tested ho.

## 7. Calls, dispositions and recordings — P0

- [ ] Call create me assignment, current agent, target agent aur device ownership validate ho.
- [ ] Client call ID/idempotency duplicate call rows prevent kare.
- [ ] Call state machine define ho: initiated, connected, ended, failed, discarded.
- [ ] Sales Agent doosre agent ka call end/disposition/discard na kar sake.
- [ ] Disposition + lead update + callback task + activity log ek transaction me ho.
- [ ] Discarded personal calls CRM metrics se consistently exclude hon.
- [ ] Recording init/upload/complete/playback me tenant + current agent + call + device ownership check ho.
- [ ] Recording status transitions invalid state se protected hon.
- [ ] Checksum actually verify ho; claimed size vs received size validate ho.
- [ ] Upload memory me 50 MB buffer karne ke badle streaming/signed object upload ho.
- [ ] Proper resumable/chunk upload contract ho, ya explicitly bounded single-upload contract documented ho.
- [ ] Byte-range playback/streaming, signed expiry, retention, deletion aur access audit ho.
- [ ] Recording path/object key tenant-safe ho aur public URL expose na ho.

## 8. Mobile synchronization

- [ ] Mobile aur web same lead/call/recording/conversation tables use karein.
- [ ] Device registration tenant + user/agent binding ke saath ho.
- [ ] Device reuse/cross-company policy explicitly documented ho.
- [ ] Heartbeat sirf owner device update kare.
- [ ] Bootstrap authoritative user, workspace, plan, entitlements aur minimum app version return kare.
- [ ] Delta sync cursor stable ordering, updates aur deletions/tombstones support kare.
- [ ] Offline event types strict allowlist se validate hon.
- [ ] Unknown event ko `SYNCED` mark na kiya jaye.
- [ ] Har offline event me tenant + agent + target object ownership check ho.
- [ ] Conflict resolution policy documented ho: last-write, version, or server-wins.
- [ ] Replay idempotency aur partial batch retry tested ho.
- [ ] Push token hashed/encrypted, device-bound aur revocable ho.
- [ ] Diagnostics arbitrary device IDs ya unrestricted PII accept na kare.

## 9. WhatsApp/Meta/Instagram integrations — P0

- [ ] Embedded Signup authorization code ko real Meta token exchange se process kare.
- [ ] Access/refresh tokens encrypted at rest hon; raw OAuth code/token database me na rahe.
- [ ] OAuth `state` signed, nonce-bound, tenant-bound, short-lived aur one-time-use ho.
- [ ] `phoneNumberId` existing tenant ko silently reassign na kar sake.
- [ ] Channel ownership, default channel uniqueness aur disconnect behavior transaction-safe hon.
- [ ] Register phone, webhook subscription, token refresh actual Meta Graph API calls hon ya explicit `NOT_CONFIGURED` error dein.
- [ ] Outbound text/media/template send actual provider request, outbox status aur retry flow use kare.
- [ ] Provider rate limits, template rules, opt-in, suppression/DND aur 24-hour window enforce hon.
- [ ] Webhook signature verification mandatory, constant-time aur secret fallback-free ho.
- [ ] Unmapped `phone_number_id` reject/quarantine ho; hardcoded tenant fallback forbidden ho.
- [ ] Webhook all entries/changes/messages process kare.
- [ ] Provider message ID + event type idempotency unique ho.
- [ ] Webhook durable inbox/queue, retry, dead-letter aur replay tool ho.
- [ ] WhatsApp media endpoint actual authenticated proxy/signed URL use kare.
- [ ] Instagram callback code exchange, state validation, tenant persistence, deauthorize aur data deletion complete ho.

## 10. Marketing and campaigns

- [ ] Templates, versions, media, groups, contacts, campaigns and recipients tenant-scoped hon.
- [ ] Channel/template/group/campaign cross-tenant ID access impossible ho.
- [ ] Campaign create/dispatch/pause/resume/cancel/retry state machine ho.
- [ ] Recipient dedupe, opt-out suppression, rate limits aur provider delivery statuses persist hon.
- [ ] Campaign dispatch background queue se ho; request timeout me bulk send na ho.
- [ ] Import limits, progress, partial failures and retry report available ho.
- [ ] Marketing APIs workspace entitlements ke according server-side gated hon.

## 11. Billing, plan and entitlements

- [ ] Workspace subscription authoritative source defined ho; user-level fallback se plan decide na ho.
- [ ] Plan expiry, payment status, suspension and grace period actual DB state se aayein.
- [ ] Missing billing state ko fake `PAID` ya future expiry na banaya jaye.
- [ ] Entitlements database/package configuration se calculate hon, static booleans se nahi.
- [ ] Seat limit atomic transaction me enforce ho.
- [ ] Feature limits API mutations par enforce hon, sirf UI flags par nahi.
- [ ] Payment webhooks signature, idempotency, reconciliation, refund and duplicate event handling ke saath hon.
- [ ] Payment/deal/lead relations tenant + permission safe hon.

## 12. AI and external services

- [ ] Demo/deterministic AI behavior production endpoint se separate ho.
- [ ] Provider config, timeout, retry, cost, quota and failure response documented ho.
- [ ] AI reply/scoring/transcription sirf authorized lead/conversation/call par chale.
- [ ] Prompt injection, data leakage, PII logging and retention policy defined ho.
- [ ] Transcription asynchronous job/status flow ho; request ko indefinitely block na kare.
- [ ] Google Drive OAuth tokens encrypted, tenant/user scoped and revocable hon.
- [ ] External callbacks signed, stateful and idempotent hon.

## 13. Super Admin, team and administration

- [ ] Super Admin actions complete audit log me actor, target tenant, action, reason, IP and requestId ke saath save hon.
- [ ] Tenant plan/status/seats/expiry inputs strict schema se validate hon.
- [ ] User invite flow real ho; placeholder hash, OTP ya password allowed nahi.
- [ ] Role update `role`/`assignedRole` consistency maintain kare.
- [ ] Delete ke badle deactivate/offboard workflow with child-data policy ho.
- [ ] Impersonation explicit reason, short-lived scoped session, banner, audit, revoke and return flow ke saath ho.
- [ ] Feedback APIs actual persistent model use karein; static sample data remove ho.
- [ ] Telemetry tenant-safe ho; sensitive data expose na ho.
- [ ] Team list/update actions role/capability restricted hon.

## 14. Reports, exports and realtime

- [ ] Reports agent/manager/admin scope ke according calculate hon.
- [ ] Exports async job, row limits, permission check and signed download use karein.
- [ ] Large aggregate counts/index strategy documented ho.
- [ ] SSE connection limits, heartbeat, reconnect cursor, backpressure and cleanup tested ho.
- [ ] Har SSE event audience filtering server-side ho.
- [ ] Per-connection one-second database polling remove ya bounded fallback ke roop me justify ho.
- [ ] Redis/pub-sub failure behavior documented ho.

## 15. Performance and scale gates

- [ ] Cursor pagination for leads, chats, messages, calls, recordings, contacts, campaigns and reports.
- [ ] No unbounded JSON payload or `findMany` in user-facing request.
- [ ] Required indexes for `(tenantId, normalizedPhone)`, assignment, updatedAt, external IDs and event cursors.
- [ ] DB connection pool, timeout and slow-query logging configured.
- [ ] Route-specific rate limits: auth, webhook, AI, send message, import, upload, SSE.
- [ ] Upload body limits and streaming verified.
- [ ] Queue workers horizontally scalable and idempotent hon.
- [ ] Synthetic load test results documented for 311, 5,829, 500k and 5m leads/chats.
- [ ] Target p95/p99 latency, error rate, throughput and DB resource limits publish hon.
- [ ] 5m scale test me list latency, search, delta sync, lead 360, webhook and realtime separately measure hon.

## 16. Data safety and operations

- [ ] Duplicate dry-run report before any cleanup.
- [ ] Cleanup/merge script backup, transaction, resumability and rollback ke saath ho.
- [ ] No destructive cleanup directly on production without approved backup and count reconciliation.
- [ ] Migration apply, rollback/forward-fix and seed strategy documented ho.
- [ ] Backup restore test successful ho.
- [ ] PII retention, recording retention and delete/export request policy defined ho.
- [ ] Audit log retention and tamper-resistance defined ho.

## 17. Frontend handoff contract

- [ ] Every UI page mapped to exact `/api/v1` endpoints.
- [ ] New API client actually used by screens; adapter-only methods count as incomplete.
- [ ] No legacy endpoint calls remain, except explicitly documented compatibility endpoints.
- [ ] Loading, empty, partial, 401, 403, 404, 409, 429 and provider-failure states documented.
- [ ] Role/entitlement response defines which menu/actions are visible and which remain server-enforced.
- [ ] Example success/error payloads and seeded non-production fixtures provided.
- [ ] API versioning/backward compatibility policy documented.

## Final “DONE” evidence required from backend engineer

- [ ] Commit SHA and deployed SHA match.
- [ ] Clean `npm run build` output.
- [ ] Migration status and database schema checksum.
- [ ] OpenAPI/endpoint matrix with every route status: `READY`, `BLOCKED`, `NOT_IN_PRODUCT`.
- [ ] Role × endpoint × row-scope permission matrix.
- [ ] Cross-tenant BOLA/IDOR test report.
- [ ] Duplicate lead concurrency test report.
- [ ] Idempotency/replay test report for webhooks, sends, mobile sync and payments.
- [ ] Meta provider integration evidence; no simulated success paths.
- [ ] Mobile sync/offline/conflict test report.
- [ ] Recording ownership/range/checksum test report.
- [ ] Load-test report for requested data volumes.
- [ ] Security review of secrets, JWT, OAuth, cookies, uploads and logs.
- [ ] Legacy frontend call inventory reduced to zero or explicitly approved compatibility list.
- [ ] Known limitations and remaining blockers written down.

**Rule:** “Done” ka matlab route exist karna ya health endpoint ka 200 aana nahi hai. Har item ke liye code, test result aur deployment evidence attach hona chahiye.
