# GXClosers Improvement Context

Last updated: 30 August 2026  
Status: local vertical-slice foundation implemented; production deployment pending

## Objective

Separate Gigxomi's Sales CRM into **GXClosers** without changing unrelated Gigxomi product behavior. Gigxomi remains the source of truth for users, agencies, subscriptions, projects, learning, WhatsApp/Instagram inbound messaging, and existing product notifications. GXClosers owns sales acquisition, lead ownership, Customer 360, calls and recordings, follow-ups, sales journeys, and sales reporting.

The primary business outcome is retained paid Agency subscriptions. Leading indicators are webinar registration and attendance, app installation, OTP verification, Agency onboarding, Freemium activation, video/course engagement, first delivery, and completion of the first two projects.

## Repositories and boundaries

| Repository | Responsibility |
| --- | --- |
| `GIGXOMI` | Public acquisition, consumer app/API, identity, product activity, learning, projects, subscriptions, existing notifications, and protected messaging ingestion |
| `GXclosers` | Sales APIs, native Android sales app, agent dashboard, GXClosers Super Admin, Customer 360, calls/recordings, tasks, automation, and sales reports |

- The existing `/sales` implementation is the migration foundation and must be reused where it meets the new contracts.
- GXClosers Android is native Kotlin/Jetpack Compose and is developed with Android Studio. Expo is not part of GXClosers.
- Gigxomi's existing editor/consumer mobile application is an immutable integration boundary for this program. Do not edit its source, build configuration, mobile API contracts, OTP, authentication, chat, notification routing, deep links, or release artifacts.
- Android establishes the core sales-agent workflow. The GXClosers web agent dashboard consumes the same APIs and business rules.
- Administration-heavy configuration remains web-only: imports, distribution rules, journey builder, integration settings, recording QA/retention, LMS authoring, team administration, and payout approvals.

## Protected production behavior

The following Gigxomi surfaces are protected and are not cleanup targets:

- `src/app/api/meta`
- `src/app/api/conversations`
- `src/components/chat`
- messaging and assignment modules under `src/lib/gigxomi`

Existing assignment, missed-assignment, chat, and status notification contracts must remain unchanged. Marketing journeys use a new `JOURNEY_*` event namespace and a dedicated growth channel. GXClosers lead/task alerts use a separate sales-alert channel. Marketing must never be routed through project-assignment or chat channels.

GXClosers does not expose public Meta webhook handlers. Inbound webhook validation remains in Gigxomi; GXClosers reads and sends through authenticated, tenant-scoped Sales routes. Unknown recipients never fall back to a default tenant.

## Customer journey

### Agency journey

`Content engaged -> Webinar landing -> Registered -> Session assigned -> Joined -> Engaged -> CTA clicked -> Play visited -> App installed -> OTP verified -> Agency selected -> Onboarding complete -> Freemium activated -> Workspace ready -> First project -> First delivery -> Two projects/activated -> Upgrade intent -> Premium -> Four projects/retained`

### Freelancer journey

`App installed -> OTP verified -> Freelancer selected -> Profile complete -> Course/assessment ready -> Marketplace ready -> First assignment -> First delivery -> Repeat editor -> Agency intent`

Lifecycle, commercial, and engagement states are separate dimensions. A salesperson's follow-up status does not replace the user's product lifecycle stage.

## KPI definitions

Primary KPI: conversion to a paid Agency Premium subscription.

Supporting KPIs:

- Webinar registration, attendance, watch duration, and CTA conversion.
- Webinar-to-install, install-to-OTP, and OTP-to-onboarding conversion.
- Agency Freemium activation and workspace readiness.
- First project, first delivery, and two projects within 45 days.
- Premium conversion and four-project retention.
- Conversion and retention by first-touch source, last-touch source, campaign, and salesperson.
- Sales response SLA, follow-up completion, and stage aging.
- Verified recurring revenue, renewals, churn, and reactivation; abandoned checkout is never counted as conversion.

## Identity, attribution, and events

- The current program does not add first-open instrumentation to the protected Gigxomi app. GXClosers records a store CTA click as an anonymous acquisition touch and creates/merges the identified customer from existing server-side OTP/account records when reliable evidence becomes available; the click is not presented as an installation.
- Webinar forms and permitted Meta lead forms can create identified pre-app leads.
- Deterministic merge keys are Gigxomi user ID, verified normalized phone, and verified email. Ambiguous records require audited manual merge/unmerge.
- Preserve original acquisition, subsequent touches, current owner, ownership history, and conversion credit independently.
- Capture UTM source/medium/campaign/content/term, `fbclid`, referral token, landing page, ad/ad-set identifiers where supplied, occurrence time, consent context, and attribution confidence.
- Use a first-party `/go/app` redirect to measure outbound store clicks. Individual Google Play Install Referrer attribution is deferred because it requires a Gigxomi mobile release, which is outside the protected boundary. A store click is never reported as an installation.
- Browser and app clients may report interactions but cannot assert payment, entitlement, approval, identity, or subscription state.

Every Customer 360 event has an idempotency key, event type and version, source, occurred/received timestamps, server-resolved identity/workspace, campaign/session/device context, consent context, and allowlisted metadata. Authoritative state changes create an outbox entry and are processed with retry, leases, dead-letter visibility, and duplicate-safe projections.

Video activity remains detailed in existing Gigxomi records. GXClosers derives compact milestones from those records without changing the mobile client or mobile API: started, 25%, 50%, 75%, 90%, completed, dropped, resumed, and CTA clicked where the existing evidence supports them.

## API direction

- Existing `/api/sales/*` routes remain compatible during migration.
- New behavior is additive and versioned; Android and web share the same backend DTOs and rules.
- Gigxomi publishes signed, retryable journey events to an authenticated GXClosers ingestion endpoint.
- GXClosers Customer 360 exposes identity, attribution, stages, webinar/app/course/video/project/subscription activity, calls, recordings, notes, tasks, conversations, notifications, ownership, and audit history.
- Search supports contact, owner, source, campaign, stage, outcome, date, recording state, subscription, and engagement.
- Admin bootstrap accepts the approved email and password only from one-time deployment secrets, stores a salted password hash, and removes the bootstrap secret after initialization. Plaintext credentials never enter Git, documentation, fixtures, or logs.

## Notification automation defaults

- Pre-install follow-up uses Webinar.gg, permitted email/WhatsApp workflows, or retargeting; push is unavailable until the app registers a token and permission.
- Post-install journeys cover OTP incomplete, onboarding incomplete, Freemium setup, course/video abandonment, first-project assistance, first delivery, two-project activation, third-editor/upgrade intent, abandoned checkout, and Premium inactivity.
- Initial marketing cap: one automated promotional message per 24 hours and three per seven days, with user-timezone quiet hours. Essential service notices and explicitly requested webinar reminders are separate but deduplicated.
- Completion, conversion, opt-out, ineligible access, unpublished content, active support hold, or an active salesperson conversation can suppress applicable nurture.
- Push outcomes distinguish suppressed, no token/permission, provider accepted, delivery confirmed when available, opened, and target action completed.

## Cleanup policy

All relevant source is classified as:

1. Reuse unchanged.
2. Reuse after cleanup.
3. Move to GXClosers.
4. Temporarily support through compatibility code.
5. Delete after verification.

Code is deleted only after proving there is no route, import, dynamic import, mobile consumer, scheduled job, webhook, database relationship, build plugin, deployment dependency, or rollback requirement. Cleanup must not delete uncommitted user work or generated/release artifacts merely because they are untracked.

Duplicate authentication checks, schemas, DTOs, API clients, and helpers are consolidated only when tenant boundaries and existing client contracts remain intact. One compatibility layer is preferred over maintaining two Sales CRM implementations.

For every material removal, record the removed surface, replacement or reason, verification evidence, and bundle/dependency impact in this document.

## Sprint tracker

| Sprint | Deliverable | Status |
| --- | --- | --- |
| 0 | Context ledger, clean worktree, inventory, baselines | Complete locally |
| 1 | Verified cleanup and compatibility map | Initial safe cleanup complete; continued audit remains |
| 2 | Free webinar, attribution, install/identity/video tracking | Server/web foundation complete; protected native install work deferred |
| 3 | Gigxomi journey ledger/outbox/reports deployed behind flags | Ledger/outbox complete locally; reports and deployment pending |
| 4 | GXClosers ingestion, Customer 360, tasks/search/admin bootstrap | Ingestion, Customer 360, tasks, and secure bootstrap complete locally; advanced search pending |
| 5 | Native Android Customer 360 and sales workflow | Customer 360/follow-up slice and lead-detail UI iteration 1 complete and locally validated; remaining workflow expansion pending |
| 6 | Web agent dashboard and GXClosers Super Admin | Agent Customer 360 slice complete; Super Admin expansion pending |
| 7 | Automated journeys, Meta reporting, measured rollout | Pending |

## Known audited gaps

- The additive lead identity-link table is present, but ambiguous matches still require an audited manual merge/unmerge workflow.
- Public webinar registrations are matched only by deterministic exact identity evidence; they are not treated as an authenticated app identity by registration alone.
- Install Referrer attribution is not yet present in the audited consumer Android surface.
- The current drip runner processes a limited audience without full pagination.
- Stored campaign stop conditions are not fully evaluated by the current runner.
- A campaign can appear sent when only an in-app record exists and no push token was available.
- Opt-out and frequency caps are not consistently shared across all reminder paths.
- Required-learning evaluation does not yet cover every relevant enrolled course.
- Neither database migration has been applied to a live database, and signed production delivery is not enabled.
- Production secrets, final ingress URL, DNS/TLS configuration, deployment target, and Google Play signing/release credentials are not present in either clean local checkout.
- The retained `xlsx` lead-import package has upstream high-severity advisories with no compatible fix. Imports remain an authenticated, administration-only surface; replacing its parser is a release-security task.

## Release gates

Gigxomi changes require journey/identity/attribution tests plus notification contract regression, `npm run test:application-stability`, lint, production build, and database verification. Any explicitly authorized protected messaging change also requires every messaging stability gate.

GXClosers requires API authentication/authorization/signature/idempotency/tenant tests, web tests, lint, production build, database verification, Android unit tests, Android lint, debug build, release bundle, notification/deep-link tests, offline recovery, and emulator workflow QA.

## External prerequisites and defaults

- Webinar registration becomes free. Webinar.gg evergreen/hourly scheduling and attendance APIs must be verified against the active account.
- Google Play package and release track must be verified before paid app-install campaigns. App Links, Install Referrer, mobile push configuration, and other native changes are deferred unless separately authorized for the Gigxomi mobile application.
- Meta tooling may assist campaign analysis, but durable production integration uses validated webhooks and Conversions API.
- Recordings are private and encrypted, use short-lived signed playback URLs and audited access, and default to 180-day raw-file retention. Searchable metadata may be retained longer under the approved privacy/financial policy.
- Database changes are additive and backward compatible during migration.

## Implementation log

### 30 August 2026

- Canonical context file created.
- Existing growth-journey audit incorporated.
- Current Gigxomi checkout confirmed dirty and left untouched.
- Gigxomi editor mobile app, mobile APIs, OTP, chat, mobile authentication, and existing mobile notifications declared out of scope and protected from all changes.
- Created clean Gigxomi worktree `C:\Users\hello\OneDrive\Documents\gigxomi-gxclosers-funnel` on `codex/gxclosers-funnel` from current `origin/main`. The original `C:\Users\hello\OneDrive\Documents\New project` checkout and all pre-existing changes remain untouched.
- Verified that the clean Gigxomi diff contains no editor-mobile, OTP, authentication, chat, conversation, Meta webhook, protected messaging/assignment, or notification-routing changes.
- Added additive Gigxomi growth journey event, snapshot, and outbox schemas plus the corresponding migration. Added signed, feature-flagged, retryable journey delivery to GXClosers.
- Made the GAPP webinar free, retained qualification fields, captured allowlisted first/last attribution, and added a tracked `/go/app` outbound store redirect. The redirect records a store click only and does not claim an app installation.
- Added the GXClosers signed versioned ingestion contract, duplicate-safe projections, monotonic lifecycle/commercial state guards, identity-link foundation, Customer 360 service, lead-scoped Customer 360/tasks APIs, and audited follow-up task timeline.
- Replaced the copied GXClosers webinar implementation with a small Sales-facing read projection; no public registration, payment, or PhonePe webhook logic remains in that projection.
- Removed verified-unused GXClosers dependencies (`framer-motion`, `googleapis`, `jose`, `qrcode`, `@types/qrcode`, and `tsx`) and added explicit runtime dependencies used by the code (`server-only` and `dotenv`). This removed 29 installed packages before subsequent framework patching.
- Ran the non-breaking audit repair, removing the critical WebSocket advisory, then upgraded Next.js and its lint configuration from 16.1.6 to 16.3.3. The production build passes on the patched version. Forced Prisma/Firebase downgrades were rejected as unsafe.
- Removed the committed fallback administrator password and demo owner credential. Super Admin bootstrap now accepts a one-time environment secret, stores only the password hash, preserves an existing hash, and requires secret removal after bootstrap. No plaintext administrator password is stored in source or this document.
- Extended only the native GXClosers Android app with Customer 360, stages, app/onboarding, webinar and learning activity, notifications summary, follow-up creation/completion, and unified timeline. The Gigxomi editor app was not opened or edited.
- Added the same Customer 360 data to the GXClosers desktop lead drawer so Android and web consume the same backend rules.
- Gigxomi validation passed: Prisma generation/validation, TypeScript, growth/webinar contract tests, all application-stability suites (chat 25, notification privacy 11, agency-editor 5, assignment 3), lint, and production build.
- GXClosers validation passed: Prisma generation/validation, TypeScript, 10 API/contract tests, lint, and Next.js production build. Generated routes include signed journey ingestion plus lead-scoped Customer 360 and task APIs.
- GXClosers Android validation passed: unit tests, lint, debug APK build, release bundle build, installation/launch on the `Gigxomi_API_34` emulator, login-screen UI inspection, and crash-log check. The debug APK is approximately 19.6 MB and the local release AAB is approximately 3.6 MB. Play Console upload and production-key verification remain separate release steps.
- Production database verification, migration execution, signed end-to-end event delivery, production-key verification, DNS/TLS cutover, deployment, and Google Play submission remain pending because production credentials/configuration are intentionally absent from the clean worktrees.

### Mobile UI iteration 1 — 30 August 2026

- Audited the running native GXClosers lead-detail screen against the supplied emulator screenshot. No Gigxomi editor-app source or API was opened or changed.
- Reworked the lead hero into a compact identity/contact card with equal call and WhatsApp actions while preserving the existing action handlers.
- Replaced the indefinite Customer 360 loading message with explicit syncing, verified, unlinked, and retry/error states. A live 404 now renders as `Needs retry` with a retry action instead of appearing to load forever.
- Added compact lifecycle, identity, plan, app-account, onboarding, engagement, and notification summaries plus clearer webinar and video-progress rows.
- Collapsed follow-up creation behind an `Add follow-up` action, replaced the technical ISO timestamp field with native Android date and time pickers, added human-readable due-time display and priority choices, and kept editable fields visible above the software keyboard.
- Limited system history to three recent events by default with an explicit expand/collapse control, reducing the initial lead-detail scroll length.
- Installed the refreshed debug APK over the emulator build and visually verified the lead hero, retry state, compact task card, expanded task composer, native date picker, and keyboard-safe title field.
- Android debug assembly, unit tests, lint, and repository whitespace checks passed after the UI changes.

### Mobile UI iteration 2 — 30 August 2026

- Replaced the unreadable imported-context paragraph with a vertical lead-journey timeline.
- Each journey item now has a connected process line and dot, readable date/time, event title, source reference, and separate note. The newest event is visually marked `Latest` and events are sorted newest first.
- Existing registration notes are parsed locally for presentation only; no source CRM notes, lead history, APIs, or database records are rewritten.
- Installed the rebuilt APK and visually verified the dated two-step journey on the running Android emulator.
- Android debug assembly, unit tests, lint, and repository whitespace checks passed after the timeline change.

### Mobile UI iteration 3 — 30 August 2026

- Reduced excessive top spacing on primary mobile screens while retaining the Android system-status safe area.
- Rebuilt the GXClosers footer from the current Gigxomi `MobileBottomNav` measurements: a transparent wrapper, translucent 78%-width navigation surface, five destinations, 21dp icons, and one circular active marker. Removed the rectangular press indication that appeared while changing tabs.
- Consolidated Learning and Settings into Profile. Profile now shows the salesperson identity, performance, learning score, Overview/Lessons switcher, and a separate Edit Profile route. The verified company phone remains read-only because it is tied to authentication, calls, and ownership.
- Added a sales-only authenticated profile update endpoint for display name and email. It does not alter Gigxomi editor profiles or OTP behavior.
- Added lead search plus canonical CRM-stage filters and visible stage labels. These stages are the internal source of truth; any later Meta conversion/status publishing must use a reviewed server-side mapping instead of sending arbitrary client labels.
- Replaced the imported-context paragraph with a dated line-and-dot lead journey, and replaced the Customer 360 404/retry panel with a useful CRM snapshot containing last activity and next-follow-up dates.
- Corrected the sales-learning client routes, added friendly loading/empty states, and seeded removable demonstration YouTube lessons for Super Admin replacement before launch.

### Mobile UI iteration 4 — 30 August 2026

- Made `Grab new leads` the primary acquisition action on both Home and My Leads. My Leads now starts with the unassigned pool before search and assigned-lead cards.
- Added the real open-pool count and preview records to the GXClosers mobile bootstrap and lead-pack APIs. Phone, email, and full notes remain protected until claim.
- Removed duplicate conversation-link reconciliation from every mobile Inbox read; bootstrap still runs the existing idempotent reconciliation. Inbox and lessons now prefetch in the background, preserving content between tabs and avoiding a blocking global busy state.
- Replaced generic Inbox and chat spinners with layout-shaped loading rows and bubbles. Inbox rows remain flat rather than being wrapped in one large rounded box.
- Rebuilt the assigned-lead conversation presentation without changing the protected conversation send/read routes: filtered records with neither text nor attachments, rendered attachment-only WhatsApp records as compact video rows, added date separators, and retained actual sender labels.
- Matched the reply composer to the current Gigxomi chat design: transparent outer dock, translucent rounded composer, borderless multi-line text field, and a compact send control that gains emphasis only when a message is ready.
- Added a persistent CRM label control to each conversation. It calls the existing authenticated, lead-scoped, audited Sales stage endpoint and refreshes the agent's lead/inbox projection; it does not modify Meta webhook, WhatsApp delivery, Instagram delivery, or Gigxomi assignment behavior.
- Emulator QA on `Gigxomi_API_34` verified the five-tab footer, immediate preloaded Inbox entry, New Lead Pool placement, stage filters, compact chat attachments, date separators, label control, and composer. Crash-buffer inspection returned no GXClosers crash.
- Installed the requested `Leonxlnx/taste-skill` project-local design pack. Its audit guidance was used for targeted spacing, loading-state, hierarchy, and generic-card cleanup; it does not ship in the Android or web runtime bundles.

### Mobile UI iteration 5 — 30 August 2026

- Fixed the GXClosers chat layout when the Android software keyboard opens. The keyboard inset is now consumed by the full chat column, so the conversation viewport resizes and the reply composer remains anchored directly above the keyboard instead of jumping upward and leaving a large empty panel.
- Added explicit `adjustResize` activity behavior while retaining Compose edge-to-edge rendering. The reply field continues to expand up to four lines and the message list scrolls to the latest item when keyboard visibility or message count changes.
- Rebuilt and installed the debug APK on `Gigxomi_API_34`. Emulator QA verified both the empty one-line composer and a wrapped multi-line draft with the keyboard open; the latest conversation content remained visible and no crash was recorded.
- Android debug assembly, unit tests, lint, and repository whitespace checks passed after the keyboard-responsiveness fix.
- Scope remained limited to the native GXClosers Android UI and its manifest. No Gigxomi editor-mobile, OTP, Meta webhook, WhatsApp/Instagram delivery, conversation API, assignment, or protected notification behavior was changed.

### Mobile build artifacts — 31 August 2026

- Generated the current GXClosers v1.0.0 debug APK (`com.gigxomi.gxclosers`, version code 1). Android signature verification passed with the local debug certificate; this artifact is suitable for direct testing, not Play Store release.
- Generated the minified and resource-shrunk release AAB. Release compilation, vital lint, R8 optimization, and bundle packaging passed.
- The GXClosers project contains no release/upload keystore or signing configuration, so the AAB is intentionally unsigned and cannot be uploaded to Google Play until a dedicated GXClosers upload key is securely created or supplied. No Gigxomi mobile signing key was inspected, copied, or reused.
- Artifact hashes were recorded at generation time: APK SHA-256 `24852274CBE47722A75B41FDD9FD1159C4756200DD1B894B3385405DCBAC20CB`; AAB SHA-256 `3EE7C16CD358D4590431884B7985B88A216E26305E66B3CDAADAB8BCA0186BA4`.
