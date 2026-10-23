# ANTIGRAVITY REMEDIATION PROMPT — AI Closer CRM

> Paste everything below the horizontal rule into Antigravity in **Agent mode**, with the
> `application` repo open at `D:\AIcloser\application`. Work phase by phase. Do not skip gates.

---

## 0. MISSION

You are fixing a live production CRM (Next.js frontend + Express/Prisma API). The audit found
**fake data, false-success toasts, dead API calls, unsafe secret storage, and missing server-side
authorization**. Your job is to make the product honest and safe — not to add features and not to
make the UI merely *look* fixed.

**Prime directive:** every success message must be backed by a 2xx server response. Every number
shown to a user must come from the database or a real integration. If the truth is "not configured"
or "failed", the UI must say that.

---

## 1. REPOSITORIES & RUNTIME

| Item | Value |
|---|---|
| Frontend | `D:\AIcloser\application` (Next.js App Router, TypeScript) |
| API | `D:\AIcloser\aicloser-api` (Express, Prisma, Zod) |
| Prod app | `https://app.aicloser.in` |
| Prod API | `https://api.aicloser.in/api/v1` |
| Local dev | `http://localhost:3010` — **already running, do not kill** |
| Deploy | SSH `root@31.97.229.166`, app `/var/www/aicloser-app`, PM2 `aicloser-app` |
| Current app commit | `bc219ad` |

Verification accounts exist for SUPER_ADMIN, ADMIN, MANAGER and SALES_AGENT. Read them from the
secure handoff note. **Never commit credentials, tokens, or `.env` values.**

---

## 2. NON-NEGOTIABLE RULES

1. **No fake success.** A success toast/banner may only render after `await` on a real request that
   returned 2xx. No `setTimeout` used to simulate work. No `Math.random()` for latency, IDs, or
   metrics. No `.catch(() => null)` / `.catch(() => {})` on a mutation.
2. **No fabricated data.** Remove demo/sample/simulated records from production paths. If a demo is
   required, gate it behind `process.env.NEXT_PUBLIC_DEMO_MODE === "true"` **and** label it `DEMO`.
3. **No secrets client-side.** No API keys, gateway secrets, CRM keys, or webhook secrets in
   `localStorage`, `sessionStorage`, cookies readable by JS, or the bundle. Persist via the API and
   return masked values only.
4. **No client-only authorization.** Hiding a nav item or reading a localStorage flag is UX, never
   security. Every protected page and API route must enforce role/permission server-side.
5. **One API base URL.** Derive it from env (`NEXT_PUBLIC_AICLOSER_API_URL` / `AICLOSER_API_URL`).
   No hardcoded `api.aicloser.com` or `api.aicloser.in` in components.
6. **No dead endpoints.** Every URL in `api-client.ts` and every direct `fetch("/api/v1/...")` must
   map to a mounted API route. Delete the call or add the route — never leave it silently failing.
7. **Build must type-check.** Remove `typescript.ignoreBuildErrors`.
8. **Additive API changes only**, unless a listed defect requires a contract change. If you change a
   contract, update all callers and add a regression test.
9. **No destructive production data changes.** No deletes, no bulk updates, no migrations without a
   reviewed rollback.
10. **Small commits per phase.** Do not reformat unrelated files. Do not "fix" code you were not
    asked to touch.

---

## 3. CONFIRMED DEFECT REGISTER (evidence-backed)

### P0 — Security & correctness

| ID | Defect | Evidence | Required outcome |
|---|---|---|---|
| SEC-1 | Page-level RBAC missing on 10 routes; closer saw admin UI and read admin APIs | Only `/team`, `/settings`, `/automations`, `/super-admin` call `requirePageRole` (`src/lib/auth/page-guard.ts`). Live SALES_AGENT session rendered `/payments`, `/channels`, `/whatsapp`, `/import`, `/lead-import`, `/forms`, `/calls`, `/chat`, `/pipeline`, `/contacts` with admin controls. `GET /workspace/settings` returned 33 keys to a closer; `GET /payments` and `POST /payments` are scoped but not role-gated. | Add a central route→roles map, call `requirePageRole` in every `(app)/*/page.tsx`, and enforce the same roles in the API. Closer must get 403/redirect on direct URL and 403 from API. |
| SEC-2 | Payment/CRM secrets written to `localStorage`; save is fake | `ChannelsView.tsx:71,262-270` writes `aicloser_rzp_key_secret`, `aicloser_rzp_key_id`, `aicloser_upi_vpa`, `aicloser_payee_name`; shows "saved successfully" with **no API call**. IndiaMART CRM key also lives in localStorage (`:74-77,182-185`). | Delete these writes. Persist UPI/Razorpay through `PUT /payments/settings` (already used by `PaymentsView.tsx:355`) and IndiaMART through `POST /integrations/indiamart/config`. Never return secrets; return `maskedKey`. Razorpay secret is server-side only. |
| SEC-3 | Authorization decided by `localStorage` | `ChannelsView.tsx:311-321` reads `closer.closer.nav.v1` to decide access; `TeamView.tsx:669-671,806-810` persists nav/ops locally; `AppShell.tsx:469-475` uses it for nav. Devtools bypass. | Delete the localStorage gate. Use server-returned permissions (`state.permissions` / permission matrix). Nav and guards must read the same server policy. |
| SEC-4 | "View Only" share can still reply (live repro) | Share UI sends permission correctly (`ChatView.tsx:1918`), but `checkConversationAccess` returns `REPLY` for owner/lead-assignment before checking shares (`aicloser-api/src/routes/v1/conversations.ts:191-213`), and `POST /:id/share` hardcodes `permission:'VIEW'` (`:2034`). Recipient matched an earlier path. | Make VIEW authoritative: check explicit share permission **before** any assignment-derived REPLY, or subtract VIEW. Add a test: share VIEW → `POST /messages` must return 403 `VIEW_ONLY`. Remove/deprecate the hardcoded `/:id/share` endpoint. |
| SEC-5 | Type errors ignored at build, shipped a crash | `next.config.ts:20-22` `ignoreBuildErrors: true`; `TeamView.tsx` `isAdmin` ReferenceError shipped (already hotfixed in `bc219ad`). Remaining errors: `ContactsView.tsx:72` (`Priority` undefined), `CallsView.tsx:42` (invalid `"OWNER"` compare), `app/api/super-admin/impersonate/route.ts:47` (type mismatch). | Remove the flag, fix all `tsc --noEmit` errors, and add `typecheck` to the predeploy gate. |
| SEC-6 | Reassign leaves conversation with old owner | Live: admin reassigned a lead; conversation still owned by previous agent. | On reassignment, update `assignedFreelancerId/Name` on the linked conversation (or clear it) in the same transaction. Add regression test. |
| SEC-7 | WhatsApp inbound media corrupt | Live: body `[Message type unknown]`, mime `application/x-gigxomi-inbound`, filename `unsupported received`, target `local`. | Persist real mime/filename when available; otherwise render a safe "Unsupported attachment" bubble with retry. Do not invent a mime type. |

### P1 — Fake data & false-success

| ID | Defect | Evidence | Required outcome |
|---|---|---|---|
| FAKE-1 | Chat fabricates ~531 of 599 conversations and messages | `ChatView.tsx:693-743` maps scanned leads into fake conversations; fallback message text `"Recent WhatsApp conversation"`; fabricated `messages[]`. | Remove the block. Chat renders API conversations only. A scanned lead with no thread must not appear as a conversation. Add infinite scroll / cursor pagination; `limit: 200` (`:746`) silently truncates. |
| FAKE-2 | Lead import always "succeeds", even when the API fails | `LeadImportView.tsx:401-459`: `setTimeout(...,700)`, `addLead()` before server call, `import(...).catch(() => {})`, then fake batch `id: BAT-${random}` (`:462`), `duplicateCount: 0` (`:467`), `status:"completed"` (`:476`), `timestamp:"Just now"` (`:475`). | Make it async: upload → await import → use the server's batch/duplicate counts → only then show success and refresh. On failure show the real error and add **zero** rows. Rollback (`:489-492`) must call a real endpoint or be removed. |
| FAKE-3 | "Simulate Incoming Forwarded Leads" injects 3 hardcoded leads | `LeadImportView.tsx:387-399`, button `:1162-1172` ("Alok Mathur", "Bhavna Trivedi", "Farhan Qureshi"). | Remove from production; if kept for dev, gate on demo mode and label DEMO. |
| FAKE-4 | "Save Lead Distribution Settings" is a no-op | `AutomationsView.tsx:1441-1444` only sets a notice; strategy/SLA/source routing are local state. | Add `GET/PUT /automations/distribution` (or extend round-robin config), persist all fields, show real errors, and reload from server. |
| FAKE-5 | AI credentials save reports success on failure | `AutomationsView.tsx:624,644` and `SettingsView.tsx:509,530` use `await ...updateProviders(...).catch(() => null)` then claim "saved & encrypted". | Await without swallowing. Show success only on 2xx. Remove localStorage as source of truth (keep only non-sensitive UI cache). |
| FAKE-6 | Provider "Test connection" fabricates success + latency | `SettingsView.tsx:465-481`: any key > 8 chars → success with `180 + Math.random()*90` ms; `fallback` always success at 12 ms. Same pattern in `AutomationsView.tsx:590-607`. | Remove. Show the real provider error. `fallback` must not claim network success. |
| FAKE-7 | IndiaMART save/sync call dead routes and claim success | `api-client.ts:551-567` calls `/channels/indiamart/*` with `.catch(()=>null)`; `ChannelsView.tsx:187-214` shows "saved locally"/"sync triggered". No `/channels` router exists. | Point to `POST/GET /integrations/indiamart/config` and `POST /integrations/indiamart/sync` (`routes/v1/integrations.ts:115,156,193`). Await, surface real errors, disable sync until configured. |
| FAKE-8 | Super Admin shows hardcoded credentials and fake telemetry | `SuperAdminView.tsx:1739` WABA `WABA-99214002847192`; `:1747` verify token `aicloser_meta_secure_verify_tok_9918`; `:1780` `socket://wa-relay-1.aicloser.in:8088`; `:1784` "14 Connected Companion Devices"; `:1788` "184 messages / min (0 dropped)"; "Test Meta Webhook Ping"/"Refresh System Token" are toast-only. | Replace with API values or an explicit "Not configured" state. Mask secrets. Make test buttons call a real health endpoint or remove them. Do not display a fake relay endpoint. |
| FAKE-9 | Token usage is fabricated | `AutomationsView.tsx:656` `tokensUsed = totalRuns * 120`. | Fetch real usage from an API endpoint (add `/ai/usage` if absent) or show "Not tracked". |
| FAKE-10 | WhatsApp delivery metrics contradict reality | Live `/whatsapp`: "MESSAGES DELIVERED 0" vs "99.4% Delivery rate"; both campaigns failed; `/channels` says "0 active channels" while `/whatsapp` says "Live Cloud Sync". | Compute the rate from real counts (`delivered/sent`); show 0% or "No deliveries yet" when 0. Mark failed campaigns with the provider error. Use one channel-status source. |
| FAKE-11 | Settings "saved locally" masks server rejection | `SuperAdminView.tsx` applies optimistic seat/status overrides, then on failure says "saved locally" while UI shows the change. | Roll back on failure (pattern already used in `super-admin-closer-control.tsx`), or show a persistent "not saved" badge. Never leave UI diverged from DB. |

### P2 — Old / dead APIs

| ID | Defect | Evidence | Required outcome |
|---|---|---|---|
| API-1 | `/channels/indiamart/*` and `/channels/justdial/*` do not exist | `api-client.ts:549-577`; no `/channels` mount in `aicloser-api/src/routes/v1/index.ts`. | Rewire to `/integrations/*` (see FAKE-7). Delete `getWebhookUrl()` — no such route exists on either prefix. |
| API-2 | `/api/v1/chat/support` is dead | `chat-workspace.tsx:1881` fetches it; `routes/v1/chat.ts` exposes only `/conversations`, `/messages`, `/stream`. | Replace with existing `/team` + `/stages` + `/macros` calls, or add a real `GET /chat/support` returning the same shape. |
| API-3 | Wrong domain `api.aicloser.com` | `ChannelsView.tsx:85`, `LeadImportView.tsx:70`, `SettingsView.tsx:357,371,374`, `api-client.ts:2087`. | Replace with the env-driven API base. The real domain is `api.aicloser.in`. |
| API-4 | JustDial secret is fake | `ChannelsView.tsx:86`, `LeadImportView.tsx:71`: `jd_sec_live_${tenantId}` is displayed as a credential; the API verifies `settings.integrations.justdial.secret` or env (`integrations.ts:49`). | Do not display a generated secret. Either return a masked configured secret from the server or show "Configure in server settings". The webhook URL must include the real tenant id and correct domain. |
| API-5 | `(app)/[module]/page.tsx` is dead for all static slugs | Every slug it could serve has a static page (lead-import, calls, chat, forms, channels, whatsapp, automations, payments). | Delete it, or make it a deliberate 404. |
| API-6 | `chat-workspace.tsx` is unused dead code | Only self-imports its CSS; `/chat` imports `ChatView` (`app/(app)/chat/page.tsx`). | Delete it (and its CSS) or wire it intentionally. Do not leave two chat implementations. |

### P3 — UI / UX / data quality

| ID | Defect | Evidence | Required outcome |
|---|---|---|---|
| UI-1 | Global data-scope `<select>` is unstyled | `.scope select` (`globals.css:888-896`) sets `border:0;background:none` but **not** `appearance:none`, leaving a native arrow and 19px height inside a 32px `.scope` (`:874-886`). | Match `.select`: `appearance:none`, 32px hit area, 1px border, radius 5px, 13px font, custom chevron, visible focus ring. |
| UI-2 | "Recent" sort is not recent | `PipelineView.tsx:506-507` sorts by `kanbanPosition`; button labelled "Recent" (`:1156`). | Sort by `updatedAt` desc. If board order is wanted, rename to "Board order". |
| UI-3 | Wrong identity in sidebar | Live closer session showed "AD Admin Owner · Workspace" while API returned "Calling Ankit"/`SALES_AGENT`; `store.tsx:467-479` falls back to stale `gx_user_name`/`gx_role` cookies when `me()` is slow. | Remove the cookie identity fallback (or only use it after a confirmed `me()` failure). Clear all `gx_*` cookies on every login/logout. Render a skeleton, never "Admin" as a default. |
| UI-4 | Priority casing is mixed; Kanban cards omit value/date | Prod data: `normal` 646, `MEDIUM` 2, `URGENT` 2, `medium` 1. Cards show no value or follow-up date. | Normalize on write and on read (`normal|medium|high|urgent` lowercase) with a single helper. Render value + follow-up date on cards. |
| UI-5 | Manager role dropdown offers ADMIN though API blocks it | `TeamView.tsx` role select; `team.ts:16-19` `canMintRole`, enforced at `:1007/:1021`. | Filter options by `canMintRole`. MANAGER → SALES_AGENT only; ADMIN → MANAGER/SALES_AGENT; SUPER_ADMIN → ADMIN. |
| UI-6 | Manager nav hides `/automations`, but page guard and dispatch API allow MANAGER | Nav filter (`AppShell.tsx:584-653`) vs `requirePageRole` on `/automations` and `marketing.ts:982`. | Pick one policy. Recommended: MANAGER may view automations but not edit AI providers; hide provider keys and block writes server-side. Nav must match guards. |
| UI-7 | Pool has 50 identical leads; claim 409 UX is poor | Live: 50 unassigned, all "Missed", all `+918799923000`; claim returns 409 `LeadAlreadyAssigned` with no recovery. | Deduplicate seed/test data; show a duplicate badge; on 409 show "Already claimed by X" and refresh the board. Add a uniqueness/claim guard. |
| UI-8 | Break duration not capped; break count absent | Live test: break exceeded its configured duration with no auto-end; no history count. | Enforce the cap server-side and client-side; auto-end at expiry; show break count/history. |
| UI-9 | Pre-hydration flash shows "Admin / Owner · Workspace" and zero counts | Observed on every reload before `me()` resolves. | Skeleton until session resolves; no admin defaults. |
| UI-10 | Chat share/read-only state computed from local list | `ChatView.tsx:458-500` derives `isReadOnlyShare` from `activeChat.shares`; if the API omits `shares` the composer unlocks. | Derive from the conversation's server-provided `permission`/`access` field and keep the server 403 as the final gate. |

---

## 4. PHASED EXECUTION PLAN

Create a branch: `fix/audit-remediation`. One commit per phase. **Stop and report at the end of
each phase**; do not chain phases without review.

### Phase 0 — Baseline & safety net
1. Run `npx tsc --noEmit` and save the output to `audit/typecheck-before.txt`.
2. Run `npm run build`; save output.
3. Add scripts: `"typecheck": "tsc --noEmit"`, `"verify": "npm run typecheck && npm run build"`.
4. Remove `typescript.ignoreBuildErrors` from `next.config.ts`.
5. Fix the three known type errors (SEC-5) and any others surfaced.
6. **Gate:** `npm run typecheck` exits 0; build passes without the ignore flag.

### Phase 1 — Security (SEC-1 … SEC-7)
1. Create `src/lib/auth/route-policy.ts` exporting `ROUTE_ROLES: Record<string, Role[]>` for every
   `(app)` page. Apply `requirePageRole` in each page server component.
2. Mirror the policy in the API. Add `requireRoles` to:
   - `GET /workspace/settings` (ADMIN/SUPER_ADMIN; closers get only their own safe subset)
   - `/payments` reads/writes (ADMIN/MANAGER; closers only their own records)
   - `/team` reads (ADMIN/MANAGER)
   - `/automations` writes (ADMIN; MANAGER read-only if UI-6 chooses that)
   - `POST /marketing/campaigns/:id/dispatch` (ADMIN, or MANAGER if policy says so)
3. Delete all secret writes to localStorage; rewire to `PUT /payments/settings` and
   `POST /integrations/indiamart/config`.
4. Remove the `closer.closer.nav.v1` access gate; read permissions from the server.
5. Fix share permission (SEC-4) and add the regression test.
6. Fix reassignment propagation (SEC-6) and inbound media (SEC-7).
7. **Gate:** run the role matrix in §6; every forbidden URL returns 403/redirect and every forbidden
   API returns 403. Grep for `localStorage.*secret|localStorage.*key_secret` returns 0.

### Phase 2 — Remove fake data & false success (FAKE-1 … FAKE-11)
Work top to bottom. For each item:
- Delete the fabrication, not just the label.
- Await the real request; branch on the response.
- Add an error state that names the failing system.
- Add/keep a test proving the failure path.

Specific must-dos:
- `ChatView`: delete the scanned-lead synthetic block; paginate for real.
- `LeadImportView`: rewrite `handleExecuteImport` as `async`; remove `setTimeout`, `addLead` before
  success, `.catch(() => {})`, random batch id, `duplicateCount: 0`, `"Just now"`.
- `AutomationsView`: implement distribution persistence; stop swallowing AI save errors; remove
  `tokensUsed` fabrication.
- `SettingsView`: remove fabricated provider test success.
- `ChannelsView` + `LeadImportView`: rewire IndiaMART; remove fake JustDial secret; remove
  localStorage CRM key.
- `SuperAdminView`: replace hardcoded WABA/token/socket/metrics; roll back optimistic writes on
  failure.
- `/whatsapp` + `/channels`: one source of truth for channel status and delivery rate.

**Gate:** with the API stopped, every save/test button shows a visible error and changes nothing.
Restart the API, retry, and confirm the change persists after a hard reload.

### Phase 3 — API rewiring (API-1 … API-6)
1. Rewrite `api-client.ts` channels methods to the real `/integrations/*` endpoints; remove
   `.catch(() => null)` from every mutation.
2. Replace `/chat/support` (or add the route).
3. Centralize the API base URL; remove all `api.aicloser.com`.
4. Remove `getWebhookUrl()` and the fake secret.
5. Delete `(app)/[module]/page.tsx` and `chat-workspace.tsx` (confirm zero imports first).
6. **Gate:** a script that extracts every path from `api-client.ts` and every `fetch("/api/v1/...")`,
   then asserts each exists in the API route table. Commit the script as
   `scripts/check-api-contract.mjs`.

### Phase 4 — UI / UX / data quality (UI-1 … UI-10)
Fix the data-scope select first, then sort semantics, identity hydration, priority normalization,
manager role options, nav/guard alignment, pool duplicates, break caps, skeletons, chat read-only.

**Gate:** computed styles for the data-scope select match `.select` (32px height, 1px border,
`appearance:none`, radius 5px); no "Admin / Owner" flash; "Recent" orders by `updatedAt`.

### Phase 5 — Verification & evidence
Run the full matrix in §6 on production-like data. Attach evidence. Do not deploy until the user
approves.

---

## 5. ACCEPTANCE CRITERIA (all must be demonstrably true)

1. `npx tsc --noEmit` → 0 errors; `npm run build` succeeds with `ignoreBuildErrors` removed.
2. `node scripts/check-api-contract.mjs` → 0 missing routes.
3. Grep proves zero client-side secrets:
   `rg -n "key_secret|rzp_key|indiamart_crm_key|jd_sec_live" src` → no writes to storage.
4. As SALES_AGENT, every admin URL (`/payments`, `/channels`, `/whatsapp`, `/import`, `/forms`,
   `/calls`, `/settings`, `/team`, `/automations`, `/super-admin`) returns redirect/403 **and** the
   underlying API calls return 403. Attach the network log.
5. As MANAGER, the visible nav matches the routes that actually render; no hidden-but-reachable page.
6. Every success toast has a preceding 2xx in the network log. Every failure shows a named error.
7. Stop the API and repeat every save/test action: all fail visibly, no local state is presented as
   saved, and a reload shows the old values.
8. Chat count equals the API count; no row contains "Recent WhatsApp conversation" unless it is a
   real stored message; no conversation exists without a real message.
9. Importing an invalid file adds 0 leads and shows the server error; a valid import shows the
   server's real inserted/duplicate counts and survives reload. Rollback either works or is absent.
10. `/whatsapp` delivery rate is mathematically consistent with delivered/sent; a 0-delivered state
    never shows a non-zero percentage.
11. The data-scope select's computed style matches the design-system select.
12. Kanban "Recent" is ordered by `updatedAt`; cards show value and follow-up date.
13. Priority values in the DB are one casing; the UI renders one label per value.
14. Share VIEW → recipient cannot send (403), and the composer is disabled with an explanation.

---

## 6. VERIFICATION MATRIX

Run as each role, on production-like data. Record URL, expected, actual, HTTP status.

| Surface | SUPER_ADMIN | ADMIN | MANAGER | SALES_AGENT |
|---|---|---|---|---|
| `/dashboard` | allow | allow | allow | allow |
| `/pipeline` | allow | allow | allow | allow (scoped) |
| `/contacts` | allow | allow | allow | allow (scoped) |
| `/chat` | allow | allow | allow | allow (own/shared) |
| `/calls` | allow | allow | allow | allow (own) |
| `/forms` | allow | allow | allow | deny |
| `/channels` | allow | allow | deny | deny |
| `/whatsapp` | allow | allow | deny | deny |
| `/import`, `/lead-import` | allow | allow | allow | deny |
| `/automations` | allow | allow (write) | read-only or deny | deny |
| `/payments` | allow | allow | allow | own only |
| `/team` | allow | allow | allow | deny |
| `/settings` | allow | allow | deny | deny |
| `/super-admin` | allow | deny | deny | deny |

API probes to include (expect 403 for the deny cells):
`GET /workspace/settings`, `GET/POST /payments`, `GET /team`, `GET /team/permissions/matrix`,
`GET /marketing/campaigns`, `GET /marketing/contacts`, `GET /integrations/indiamart/config`,
`GET /integrations/whatsapp/channels`, `GET /reports/overview`, `POST /ai/providers`,
`POST /marketing/campaigns/:id/dispatch`, `POST /conversations/:id/shares` (VIEW),
`POST /conversations/:id/messages` (VIEW recipient).

---

## 7. OUTPUT FORMAT (required)

For each phase, reply with:

```
PHASE <n> — <name>
Status: DONE | BLOCKED
Files changed: <path:line-range> ...
Root cause: <one sentence per defect id>
Fix: <what changed and why it cannot regress>
Tests added: <file + test name>
Evidence:
  - typecheck: <paste tail>
  - build: <paste tail>
  - network: <method path -> status> ...
  - screenshots: <paths>
Remaining risks: <list>
```

Do **not** write "fixed" without evidence. Do **not** deploy. Do **not** modify production data.

---

## 8. STOP CONDITIONS

Stop and ask before proceeding if:

- A fix requires deleting or rewriting production rows.
- An API contract must break for an existing client.
- A required secret/env var is missing (`META_APP_SECRET`, `WEBHOOK_APP_SECRET`, Razorpay keys).
- WhatsApp QR pairing or real message delivery is required (needs a human phone).
- You cannot reproduce a listed defect — say so with the request/response you observed instead of
  inventing a fix.

---

## 9. WHAT "DONE" MEANS

The app no longer lies. Every number is real, every save is confirmed by the server, every role is
enforced server-side, no secret is in the browser, and no dead endpoint remains. The UI may show
fewer features and more "Not configured" states — that is the correct outcome.
