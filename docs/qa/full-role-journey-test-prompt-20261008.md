# AI Closer — Full Role-Based End-to-End Test Prompt

Use this prompt against the existing AI Closer web dashboard, Android app, and configured Meta channels. Do not add new features while executing it. Test the current product as a real customer would use it, record evidence for every step, and stop at the first blocking failure in that journey.

## Test rules

- Use a disposable QA tenant and QA-labelled records only. Never use production customer data.
- Use fresh, unique QA emails, phone numbers, CSV/XLSX rows, WhatsApp contacts, and Instagram conversations for each run.
- Never write passwords, access tokens, OAuth codes, client secrets, webhook secrets, or full session cookies into screenshots, logs, or reports.
- Do not treat a mocked response, a source-code assertion, or a successful HTTP status alone as an end-to-end pass. Confirm the visible UI and the persisted record IDs.
- For every mutation, capture tenant ID, actor role, user ID, lead/contact ID, conversation ID, call ID, recording ID, import batch ID, and channel connection ID in redacted evidence.
- Run the complete suite twice: once with a fresh browser session and once after refresh, logout/login, and app restart. Existing records must remain unchanged.
- Admin is a control/reporting role; admin must not appear as a closer, receive round-robin work, or make sales calls.

## Phase 0 — Environment and test fixtures

1. Confirm the web build, Android build, API base URL, database health, queue/worker health, and configured webhook callback URLs.
2. Create one disposable tenant/workspace from the public signup flow using a fresh email and unused phone number. Verify the workspace is isolated from all other tenants.
3. Create three QA users from the admin UI:
   - one `MANAGER`;
   - two `SALES_AGENT` closers;
   - do not create or count an admin as a sales user.
4. Verify duplicate email/phone, invalid email, weak password, full-seat, and missing-required-field errors are structured and actionable.
5. Verify an already authenticated user is not forced through an unnecessary password prompt when the existing session is valid; verify expired/revoked sessions still require authentication.
6. Record the baseline: team hierarchy, active sales-user count, lead count, contact count, channel connections, import queues, and reporting totals.

## Phase 1 — Admin control and reporting journey

1. Sign in as admin and verify the navigation is an admin control/reporting surface.
2. Confirm admin sees workspace health, team hierarchy, lead/contact totals, assignment totals, call outcomes, recording status, channel status, and activity reports by user.
3. Confirm admin does not see a closer-only grab queue, does not count as a sales agent, and has no sales-call action on the admin dashboard.
4. Add the manager and closers. Under the manager, verify the correct number of direct reports, active/inactive state, device state, and assigned-lead counts.
5. Verify manager/closer permissions can be reviewed and changed without changing tenant ownership.
6. Verify phone-number masking can be configured from the admin side and that the manager-side view follows policy. Confirm unmasked numbers are never exposed to a role without permission.
7. Verify admin can open each reporting drill-down and trace totals to the underlying user, lead, call, message, and recording records.

## Phase 2 — Lead sources, forms, import, and distribution

1. Open every existing lead source/form entry point and verify each button opens the intended panel or route; remove no options during the test.
2. Create a QA lead form with required name and phone fields. Submit it once with email and once without email. Phone-only submission must succeed when email is optional.
3. Verify the form creates exactly one contact/lead, keeps the source, tenant, and form IDs, and does not duplicate on refresh or retry.
4. Upload a real CSV through the browser file picker. Include valid phone-only rows, email rows, duplicate phone rows, invalid rows, and blank rows.
5. Preview the CSV and verify counts, validation messages, duplicate detection, source, and approval state. Confirm the actual Import/Save action is visible after preview.
6. Repeat with a real XLSX file. Verify an `importBatchId` and exact pool-item IDs are returned and preserved after refresh.
7. Distribute only the selected batch through round robin. Verify each active closer receives exactly one intended lead, no existing lead is reassigned, and the manager/admin are not counted.
8. Run round robin with no selected batch and verify the UI explains that a selection is required; it must not silently distribute every queued contact.
9. Test the closer lead-grab flow separately. Verify claim locking prevents two closers from claiming the same lead and that admin cannot accidentally claim sales work.
10. Verify imported lead fields, source, assignment, stage, notes, and batch identity remain unchanged after browser refresh and mobile bootstrap.

## Phase 3 — WhatsApp and Instagram channel onboarding

1. Open `Plugins & Channels` as admin. The WhatsApp and Instagram setup actions must open an in-place setup panel or a clearly linked setup route.
2. WhatsApp:
   - start Embedded Signup with the configured QA Meta app/configuration;
   - complete business-account, WABA, phone, token exchange, phone registration, and webhook subscription steps;
   - verify only redacted connection data is shown in the browser;
   - verify tenant, WABA, phone ID, connection status, callback URL, webhook readiness, last error, reconnect, and disconnect states;
   - verify missing configuration, invalid token, phone-registration failure, webhook failure, and Meta API errors are actionable.
3. Instagram:
   - start the dedicated Instagram OAuth flow using the dedicated app identity;
   - verify signed state/redirect validation and the configured callback URL;
   - connect a QA Instagram Business account;
   - verify account, status, required callback URLs, inbox readiness, reconnect, deauthorize, data-deletion, and last-error states;
   - send a QA DM and verify signed webhook ingestion into the correct tenant.
4. Verify WhatsApp and Instagram connections cannot be mixed, cross-tenant, or displayed with secrets/tokens.

## Phase 4 — Unified inbox and messaging

1. As admin, send a permitted WhatsApp API QA message using an approved template and verify campaign/contact/message IDs, delivery state, and audit trail.
2. Import a small QA marketing audience and verify preview, opt-out filtering, duplicate handling, template validation, explicit selection, test-send, and dispatch confirmation.
3. Verify bulk marketing cannot send without an explicit audience/template/consent-safe selection and that no non-QA contact is included.
4. As manager and closer, open the unified inbox and verify permitted WhatsApp API, Instagram, and assigned lead conversations appear in one list with channel labels.
5. Verify every message shows the correct lead/contact, channel, sender role, timestamp, delivery state, notes, and assignment history.
6. Verify a closer cannot view or reply to conversations outside their assignment/tenant; manager and admin visibility follows their role policy.
7. Scan/connect the closer's personal WhatsApp only through the supported QR/sync flow. Verify consent, account identity, sync mode, conflict handling, and that personal chats do not leak into another tenant or user.
8. Verify personal WhatsApp Business and company WhatsApp API remain distinguishable while still appearing in the unified inbox where policy allows.

## Phase 5 — Closer web journey

1. Sign in as each closer and verify only the closer navigation and assigned work are shown.
2. Open an assigned imported lead. Verify the card shows correct name, phone, source, stage, tags, assignment, previous team history, last user contacted, notes, callback, and call/message history.
3. Change stage, name, notes, and callback from the card. Refresh and sign in again; verify all values remain on the same assignment and no duplicate lead is created.
4. Verify if another teammate previously handled the same phone number, the card shows a dynamic “Previously handled by…” label with the correct user and timestamp. Do not show the label when there is no history.
5. Verify restricted actions explain prerequisites and permissions instead of silently failing.

## Phase 6 — Android incoming-call journey

1. Install the QA APK on a clean test device/emulator and sign in as a closer.
2. Verify permission requests for phone state/call handling, call screening, overlay, microphone, contacts, and notifications. Deny each once and confirm a clear recovery message.
3. Keep the app backgrounded without force-stopping it. Use a fresh QA caller number not already in the tenant.
4. Trigger an incoming call and verify, in order:
   - native incoming-call UI appears;
   - AI Closer caller card appears;
   - unknown number is displayed;
   - one inbound call session is created during ringing;
   - one `PHONE_CALL` lead is created/assigned under the correct tenant and closer;
   - existing leads remain unchanged.
5. Answer, keep the call connected, and end it. Verify call direction, status, duration, recording state, call/lead/assignment linkage, upload retries, and failure explanation when the emulator cannot capture audio.
6. Verify “Add details after call” opens the disposition form. During/after the call update name, outcome/status, notes, and callback. The keyboard must not cover focused fields.
7. Save, refresh web and mobile, and verify all disposition data is on the same lead and call.
8. Open the recording on web and mobile. Verify play/pause, seek backward/forward, 1x, 1.5x, 2x, and 3x speeds, refresh persistence, access control, and a truthful unavailable state when no audio exists.

## Phase 7 — Android outgoing-call journey

1. From the closer's assigned lead card, start an outbound call. Verify a call session is created before dialing and has the same tenant, closer, assignment, and lead IDs.
2. Verify the active call card/notification shows name, phone, stage, notes, and callback context without exposing another user's lead.
3. Use a second QA endpoint. If the emulator cannot establish a real two-sided connected call, mark native audio as blocked rather than passed and continue only with clearly separated API/UI lifecycle assertions.
4. End the call and save outcome/status, updated name, notes, and callback. Verify one call, one disposition, and no duplicate lead.
5. Refresh both web and mobile. Verify the same lead card contains the updated details, call history, recording state, and playback controls.

## Phase 8 — Manager journey

1. Sign in as manager and verify only manager-authorized team data is visible.
2. Verify team hierarchy, direct-report counts, lead ownership, round-robin settings, grab-lead visibility, workload distribution, call outcomes, recording states, and response/activity reports.
3. Reassign a QA lead only where policy allows. Verify audit history, no duplicate assignment, and no cross-tenant access.
4. Verify manager masking policy, notes visibility, team conversation visibility, and unified inbox behavior.
5. Verify manager cannot perform admin-only tenant/channel credential actions unless explicitly permitted.

## Phase 9 — Negative, security, and cleanup tests

1. Attempt closer deletion of a lead; verify the action is unavailable or returns `403`, and the lead remains.
2. Attempt cross-tenant lead, call, recording, contact, WhatsApp, Instagram, and report access; verify denial.
3. Verify secrets/tokens are absent from UI, browser storage, URLs, logs, screenshots, and QA evidence.
4. Verify stale sessions, device conflicts, duplicate submissions, double taps, refreshes, offline call-end events, and retry queues do not create duplicate records.
5. As admin, delete only QA leads, contacts, conversations, calls, recordings, imports, channel connections, and test users. Verify no orphaned records and no change to baseline production data.
6. Revoke/delete the QA closer and verify login/device access is revoked. Verify the manager hierarchy and counts update correctly.

## Evidence and pass criteria

For each phase store a redacted JSON result with: phase, role, step, timestamp, UI assertion, request/response status, IDs, screenshot/XML path, and pass/fail/block reason. Never store credentials or tokens.

The complete suite passes only when every role journey, channel journey, import/distribution journey, call direction, recording state, disposition, masking rule, permission boundary, refresh/retry behavior, cleanup check, and second-run persistence check is proven in the visible product and persisted data. If Meta credentials, real WhatsApp/Instagram accounts, a physical call endpoint, device registration, audio capture, Play Console access, or any other external dependency is unavailable, mark that exact step `BLOCKED_EXTERNAL` and do not report the full suite as passed.
