# AIcloser — Role-Scoped Frontend & Authorization Audit

Companion to `FRONTEND-AUDIT-REPORT.md` (CSS/layout findings F1–F13).
This pass re-audits the same build **through real accounts of each role**, and covers role-dependent UI plus the authorization surface the UI sits on.

- **Date:** 2026-10-23
- **Build:** `D:\AIcloser\application` @ dev server `http://localhost:3010` (Turbopack), viewport **1446 × 886 @ dpr 1**, light theme, warm cache
- **Backend:** `https://api.aicloser.in/api/v1` — **production**
- **Method:** DOM + computed-style measurement, live `fetch` probes, SSR source inspection, code trace. Screenshots were unavailable (headless window not visible), so every number below is measured, not eyeballed.
- **No fixes were applied.** No source file was modified.

> **Test-data disclosure:** both accounts live in the **real production backend**, tenant `ws-2283fbe5-1` ("UI Audit Test Co"), created through the product's own `/team` invite UI. They should be deleted when the audit is closed.

| Account | Role | Code | Permissions |
|---|---|---|---|
| `ui-audit@example.com` | ADMIN | `MGR-15BDDB`* | all |
| `audit.manager@example.com` | MANAGER | `MGR-15BDDB` | 14 granted |
| `audit.agent@example.com` | SALES_AGENT | `AG-21AEFB` | 8 granted / 5 denied |

\* the ADMIN's roster row is returned with the same `agentCode` shape as a manager; see R9.

---

## 1. Route access matrix (measured, not inferred)

`nav` = present in that role's sidebar after hydration. `URL` = direct navigation.
`200` / `403` = status of the page's primary data call made with that role's bearer token.

| Route | ADMIN | MANAGER | SALES_AGENT |
|---|---|---|---|
| `/dashboard` | nav · URL ✓ | nav · URL ✓ | nav · URL ✓ |
| `/pipeline` | nav · URL ✓ | nav · URL ✓ | nav · URL ✓ |
| `/contacts` | nav · URL ✓ | nav · URL ✓ | nav · URL ✓ |
| `/calls` | nav · URL ✓ | nav · URL ✓ | nav · URL ✓ |
| `/chat` | nav · URL ✓ | nav · URL ✓ | nav · URL ✓ |
| `/payments` | nav · URL ✓ | nav · URL ✓ | nav · URL ✓ |
| `/team` | nav · URL ✓ · `200` | **no nav** · URL ✓ · `200` | **no nav · URL ✓ · `200`** |
| `/settings` | nav · URL ✓ · `200` | **no nav** · URL ✓ · `200` | **no nav · URL ✓ · `200`** |
| `/automations` | nav · URL ✓ · `200` | **no nav** · URL ✓ · `200` | **no nav · URL ✓ · `200`** |
| `/whatsapp` | nav · URL ✓ | nav · URL ✓ | no nav · URL → **renders "Admin Access Required" panel** |
| `/channels` | nav · URL ✓ | nav · URL ✓ | no nav · URL → **renders "Admin Access Required" panel** |
| `/forms` | nav · URL ✓ | nav · URL ✓ | no nav · **URL ✓ fully rendered** |
| `/lead-import` | nav · URL ✓ | nav · URL ✓ | no nav · **URL ✓ fully rendered** |
| `/payment-links` | **500** | **500** | **500** |
| `/activate-plan` | **500** | **500** | **500** |
| `/super-admin` | → `/super-admin/login?error=…` (expected) | → same | → same |
| `/unauthorized` | renders (sales-only copy) | renders | renders |

Sidebar item counts after hydration: **ADMIN 14 · MANAGER 12 · SALES_AGENT 6**.

Only **two** pages call a role guard at all — `payment-links/page.tsx:11` and `super-admin/page.tsx:13`. `src/app/(app)/layout.tsx` has no role check, and `src/proxy.ts` gates authentication only (`:40-70`), never role, for `(app)` routes. Every other route is "protected" solely by whether the sidebar happens to render a link.

Granted permissions returned by the API:

| Permission | MANAGER | SALES_AGENT |
|---|---|---|
| `team:view` | ✅ | **❌** |
| `team:manage` | ✅ | **❌** |
| `payouts:approve` | ✅ | ❌ |
| `payouts:view` | ✅ | ✅ |
| `leads:reassign` | ✅ | ❌ |
| `leads:claim` / `leads:create` / `leads:view` | ✅ | ✅ |
| `customer:unmask_phone` | ✅ | ❌ |

---

## 2. Findings

Severity: **P1** = exploitable or hard-down · **P2** = broken/deceptive user-facing behaviour · **P3** = polish/consistency.

### R1 — P1 · Role gating is client-side only; every role receives the full admin sidebar at first paint

**Evidence**
- Server-rendered HTML for a **SALES_AGENT** session on `/team` contains links to `/settings`, `/automations`, `/team`, `/whatsapp`, `/channels`, `/forms`, `/lead-import`.
- `src/components/shell/AppShell.tsx:578` — `const userRole = state.user?.role || "ADMIN";` → before `/auth/me` resolves, `state.user` is `null`, so the sidebar is built as **admin**.
- `AppShell.tsx:227-233, 278-289` — filters run only after the client knows the role.
- `src/app/(app)/layout.tsx` wraps `AppShell` with no server-side role gate.

**Measured flash (same-origin iframe, polling every ~40 ms):** 13 admin nav items at **t = 252 ms** → 6 items at **t = 1784 ms** → **≈1.53 s** of privileged navigation visible to a sales agent on a warm cache.

**Impact** — the lowest-privileged role can read the privileged route map, and the layout visibly "collapses" on every load. Users on slow connections see it far longer.

**Fix** — compute the allowed nav set on the server (session already available in `(app)/layout.tsx`) and pass it down; default the client state to *least* privilege, not `"ADMIN"`.

---

### R2 — P1 · `GET /team` is unguarded: a SALES_AGENT with `team:view: false` receives the full member directory (PII)

**Evidence**
- `audit.agent` permissions payload: `team:view: false`, `team:manage: false`.
- `GET /api/v1/team` as `audit.agent` → **200**, 3 members, each row containing `displayName`, `email`, `phone`, `role`, `agentCode`.
- `/team` renders for the agent by direct URL: heading "Team & Users", "Team Members (3)", rows with `audit.manager@example.com` / `+91 90000000xx` and an **Invite member** button.
- `aicloser-api/src/routes/v1/team.ts:131` — `teamRouter.get('/', …)` has **no `requirePermissions`**.
  Compare the same file: `:346` `GET /audit-logs` requires `PERM_TEAM_VIEW`; `:1338` `GET /:id/permissions` requires `PERM_TEAM_VIEW`; `:910` `PATCH /:id` requires `PERM_TEAM_MANAGE`. The list endpoint is the outlier.
- `aicloser-api/src/routes/v1/team.ts:1061` — `GET /permissions/matrix` also unguarded → agent received the full catalog + matrix with **200**.

**Impact** — directory + phone numbers of every manager/closer leak to the role that is explicitly denied `team:view`. The write side is correctly blocked (`POST /team/invite` → **403** `team:manage`), so this is read-only exposure — but it is real PII.

**Fix** — wrap `GET /` and `GET /permissions/matrix` in `requirePermissions(PERM_TEAM_VIEW)`; return members scoped to the caller's reporting tree (`workspace-scope.ts` already exists for leads).

---

### R3 — P1 · A MANAGER can mint an ADMIN (tenant takeover)

**Evidence**
- Invite modal, opened as MANAGER, offers **"Workspace Admin"** in the role select (`TeamView.tsx:166-172`).
- `aicloser-api/src/routes/v1/team.ts:386-400` — `inviteMemberSchema` accepts `ADMIN` and `SUPER_ADMIN`.
- Both invite handlers (`:652`, `:653`) are gated only by `PERM_TEAM_MANAGE` — which a MANAGER has.
- The invite UI sets the password at creation (no email verification); the manager therefore knows the new admin's credentials and can log in as an admin immediately.
- `PATCH /team/:id` (`:910`) also gates only on `team:manage` and accepts `SUPER_ADMIN` in its role enum — a manager can promote an existing account (effect lands on next login, since role is baked into the JWT).
- Inconsistency proving intent to restrict this: `PUT /permissions/matrix` (`:1170`) **is** `requireRoles('ADMIN','SUPER_ADMIN')`.

**Verified without mutating state:** a valid-shaped invite payload from the agent returns **403** (`You lack the required granular permission: team:manage`), and an invalid payload from the manager returns **400** — i.e. the manager passes authorization and fails only schema validation. No account was created and no role was changed.

**Fix** — restrict `ADMIN`/`SUPER_ADMIN` in `inviteMemberSchema` and `updateAgentSchema` to callers whose own role is `ADMIN`+; keep `team:manage` for `MANAGER`/`CLOSER` only.

---

### R4 — P1 · `/payment-links` and `/activate-plan` return a 500 for every role

**Evidence**
- Both routes render: `Application error: a server-side exception has occurred…` with stable digests **3508805354** (`/payment-links`) and **2493160901** (`/activate-plan`) — identical for ADMIN and SALES_AGENT, across reloads.
- `src/lib/billing/workspace-access.ts:25` → `prisma.userSubscription.findFirst(...)`.
- `src/lib/prisma.ts:36-43, 70-76` → builds a `pg` Pool from `DATABASE_URL`.
- `.env.local:5` → `DATABASE_URL=…@127.0.0.1:5432/aicloser`.
- Direct probe with the same URL: **`connect ECONNREFUSED 127.0.0.1:5432`** — no local Postgres is running; the app's data layer is the remote API.
- Callers: `src/lib/auth/page-guard.ts:37-39` (invoked by `/payment-links:11`) and `src/app/activate-plan/page.tsx:14`.

**Impact** — the two billing entry points are hard-down for all users. This is not cosmetic: `ChatView.tsx:2942` sends the user to `/payment-links` when collecting a payment in chat, so "collect payment from a conversation" ends on a Next.js error page. `/activate-plan` can never render, so the "plan locked" redirect has no destination.

**Fix** — point the billing guard at the remote API (or guard the Prisma read and fail open), and add an `error.tsx` so a data-layer failure doesn't surface as a raw digest.

---

### R5 — P2 · Payments screen fabricates a configured UPI gateway

**Evidence**
- `GET /api/v1/payments/settings` as **ADMIN** returns `enabled: false`, `upiId: null`, `payeeName: null` — nothing is configured.
- UI nonetheless displays (verified as ADMIN, MANAGER and SALES_AGENT):
  - Receiving UPI ID/VPA → `sales@aicloser`
  - Payee name → `AI Closer Technologies Pvt Ltd`
  - Brand → `AI Closer`
  - plus the panel **"ACTIVE PROTOCOL — upi://pay?pa=sales@aicloser&pn=AI%20Closer%20Technologies%20Pvt%20Ltd&cu=INR"** and the line "✓ Zero PG Cut: 100% direct bank-to-bank settlement via UPI."
- Source: `PaymentsView.tsx:63-64` (defaults), `:170-173` (`data.upiId || "sales@aicloser"`, etc.), `:785` (protocol string re-applies the same fallbacks).
- The **Save** button is enabled in every case; for non-admins it returns `Insufficient permissions: role MANAGER is not authorized for this resource` (raw backend string, see R6).

**Why it matters** — an admin who has never configured a gateway is shown a plausible, "active" payment endpoint. The link-creation call itself does not send `upiId` (good), so this is a *display* lie rather than misrouted funds — but it is the kind of screen that gets screenshotted into an onboarding doc.

**Fix** — render an explicit "Not configured" state when `upiId` is null; never substitute credentials; hide Save unless the caller is authorized.

---

### R6 — P2 · Privileged pages render fully with live-looking controls, then 403 on use

**`/settings` — the token card is a permanent, silent dead end**
- As SALES_AGENT and MANAGER: chip reads **"Generating"** indefinitely, token box shows `aicloser_sec_••••••••••••••••••••••••`, **Copy Token disabled**, **Regenerate Token enabled**.
- `SettingsView.tsx:1125` derives the chip from `developerToken` truthiness — so "Generating" is also the *failure* state.
- `:228` — `.catch(() => {})` swallows the 403; no error UI.
- Clicking Regenerate: `:244` → **"Failed to regenerate token. Please verify a…"** (truncated generic copy); the real cause is never shown, the chip stays "Generating".
- Admin baseline: chip **"Active Key"**, Copy enabled.

**`/automations` — readable by a role with no permission to it**
- As SALES_AGENT: `GET /automations` **200**, `GET /ai/system-prompt` **200**, `GET /ai/providers` **200** (keys masked), page fully rendered.
- `aicloser-api/src/routes/v1/ai.ts` — `GET /system-prompt`, `/providers`, `/bot-train` carry **no role middleware**; `PUT /bot-config` is `requireRoles('ADMIN','MANAGER','SUPER_ADMIN')`.

**Global AI Bot toggle is rendered for everyone, and fails silently**
- `AppShell.tsx:1163-1182` — the master switch is not role-gated.
- `src/lib/store.tsx:1004-1015` — optimistic flip, `catch` → roll back and rethrow.
- `AppShell.tsx:1169` — `void toggleGlobalAiBot().catch(() => {})` → an agent sees the switch flip and flip back with **no message**.

**`/lead-import` — fully rendered, submit is 403**
- Page renders for the agent (heading, uploaders, source tabs).
- `aicloser-api/src/routes/v1/leads.ts:3508` — `POST /import` requires `PERM_LEADS_REASSIGN`, which the agent does not have.

**`/forms` — rendered *and* writable by the agent**
- As SALES_AGENT the page renders fully ("Lead Form Builder & Public URLs").
- `aicloser-api/src/routes/v1/forms.ts:411-428` — `PUT/POST/PATCH/DELETE /forms/:slug` have **no permission middleware**; `POST /` (`:416`) has none either. Any authenticated user can create/modify/delete public capture forms under the tenant brand.
- Not exercised (would create data); proven by route inspection.

**`/whatsapp`, `/channels` — correctly denied, but only in the component**
- Both render an "Admin Access Required" panel for the agent. Credit where due — but the gate is client-side; the route still returns 200 HTML.

**Fix** — either hide/disable these surfaces for unauthorized roles and show a "not available on your plan/role" state, or (preferred) let the page guard reject before render. Never bind a control's enabled state to something other than the same permission the API enforces.

---

### R7 — P2 · Breadcrumb is clipped to an invisible sliver — severity depends on role

`.topbar` lays out with no `min-width` on `.topbar-lead`, and `.breadcrumb` (`globals.css:769/780/787`) has no ellipsis. The lead region is squeezed by topbar actions, so the available width varies by role.

Measured (element width / scrollWidth, px):

| Route | ADMIN | MANAGER | SALES_AGENT |
|---|---|---|---|
| `/dashboard` | 16 / 194 | 16 / 194 | 161 / 194 |
| `/pipeline` | 16 / 211 | 16 / 211 | 161 / 211 |
| `/contacts` | 16 / 118 | 16 / 118 | 118 / 118 ✅ |
| `/calls` | 16 / 220 | 16 / 220 | 161 / 220 |
| `/chat` | 16 / 213 | 16 / 213 | 161 / 213 |
| `/payments` | 16 / 229 | 16 / 229 | 161 / 229 |
| `/team` | 16 / 148 | 16 / 148 | 148 / 148 ✅ |
| `/settings` | 16 / 114 | 16 / 114 | 114 / 114 ✅ |
| `/automations` | 16 / 200 | 16 / 200 | 161 / 200 |

- **ADMIN and MANAGER: 16 px on every route** — the breadcrumb is effectively absent (that is roughly the width of the `/` separator), because their topbars carry the most actions.
- **SALES_AGENT: clipped to a fixed 161 px**, which truncates 5 of its 6 pages mid-word with no "…".
- No horizontal page overflow in any case (`scrollWidth - clientWidth = 0`), so this is pure squeeze, not a layout blowout.

**Fix (ties to F1)** — `min-width: 0` on the flex child, `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on `.breadcrumb`, and collapse the breadcrumb to a single crumb below ~1500 px.

---

### R8 — P2 · Team screen invents SIM status and reporting lines

**Evidence — API payload is the ground truth**
- `GET /api/v1/team` member keys contain **no `simConnected` field at all** (keys: `id, userId, displayName, email, phone, role, agentCode, status, commissionPercent, canClaimLeads, maxActiveLeads, parentAgentId, reportingManager, permissions, …`).
- `reportingManager` is `null` for both the manager and the agent.

**Evidence — UI**
- `TeamView.tsx:325` — `simConnected: Boolean(m.simConnected ?? true)` → **every row renders "Connected"**, including accounts that have never installed the mobile app.
- `:333-336` — `reportingManager || m.manager?.displayName || (role === "MANAGER" ? "Founder & Owner" : "Direct Admin")` → rows display invented reporting lines.
- `:339` — `joinedAt: createdAt ? … : "Active"` → a missing date renders the word **"Active"** in the "Joined" column (latent; our rows have dates).

**Impact** — the page that manages seats and call routing displays fabricated operational state. "Connected" is the one signal an admin would use to decide whether a closer can take calls.

**Fix** — render an explicit "Unknown / Not installed" state when the field is absent; show "—" for missing reporting manager and join date.

---

### R9 — P3 · Seat accounting and role vocabulary contradict each other

All on `/team`, measured with 1 MANAGER + 1 SALES_AGENT + 1 ADMIN:

- `TeamView.tsx:947` — `closerMembers = members.filter(m => m.role !== "ADMIN")` → the **MANAGER consumes a "CLOSER SEAT"**. Header: **"2 / 10 seats"**, with the note "Admin owner separate (unmetered)".
- `:952` — `activeClosersCount` counts only `role === "CLOSER"` → KPI **"1 online now"** while 2 seats are billed.
- `:1211` — the row chip is the **hardcoded string "CLOSER SEAT"**, so a MANAGER row is labelled CLOSER SEAT next to a role field reading "Manager".
- `:303-307` — the mapper collapses every unrecognised role to `CLOSER`; a future role (e.g. `VIEWER`) would silently become a closer and consume a seat.
- API says `SALES_AGENT`; UI vocabulary says `CLOSER`. The two never reconcile.
- The ADMIN's own row is issued an `agentCode` (`MGR-15BDDB`) identical in shape to a manager's.

**Fix** — define one seat rule (`billable = MANAGER + SALES_AGENT`, admin excluded) and derive both the counter and the chip from `role`, not a literal.

---

### R10 — P3 · `/unauthorized` is sales-only copy, ignores `?from=`, and dead-ends a signed-in user

**Evidence**
- `page-guard.ts:26` redirects to `/unauthorized?from=<path>`.
- `src/app/unauthorized/page.tsx` is a static server component: no `searchParams`, no session read.
- Rendered copy: **"Sales Agent permissions required."** / "Your current account does not have Closer or Sales Agent permissions… Please sign in with an authorized sales account or **create a new workspace**."
- Only actions: `/login` and `/signup`. There is no "back", no "switch account", no mention of the role that was actually refused.

**Impact** — a MANAGER or ADMIN who lands here (e.g. via the billing guard) is told to sign in as a sales agent or create a second workspace. In practice the page is near-unreachable: `/payment-links` admits all three app roles, so the only real trigger is `SUPER_ADMIN`. It is dead code carrying wrong copy — cheap to fix, easy to be bitten by later.

**Fix** — make it role-aware, print the required role and the caller's role, and render `from` as a "go back" link.

---

### R11 — P3 · The developer-token card misrepresents the credential it hands out

**Evidence**
- Non-admin placeholder: `aicloser_sec_••••••••••••••••••••••••`.
- Actual token issued to the ADMIN is a **339-character JWT** — `eyJhbGciOiJIUzI1…` — and the card displays `eyJhbGciOiJIUz••••••••••••4B6L4k`.
- `SettingsView.tsx:1138` hardcodes the `aicloser_sec_` placeholder; `:1119` slices the real value. "Copy Token" copies the JWT.
- The surrounding docs tell the user to send this as `Authorization: Bearer <token>`, which works — but the `aicloser_sec_` framing implies a scoped, revocable API key that the system does not issue. There is no scope, no expiry display, and no "last used".

**Fix** — either issue real `aicloser_sec_` keys, or stop showing that prefix; surface the token's expiry and scopes.

---

## 3. What is working

- **Invite flow** — modal collects Name / Email / Phone / Password / Role / Capacity, creates the account immediately, and the invited user can sign in at once. (No email verification — a product decision to confirm, but the flow itself is intact.)
- **Destructive endpoints are correctly denied** — `POST /team/invite` **403**, `PATCH /team/:id` **403**, `GET /auth/developer-token` **403**, `PUT /payments/settings` **403**, `PUT /ai/bot-config` **403** for SALES_AGENT.
- **`/whatsapp` and `/channels`** render an explicit "Admin Access Required" panel instead of leaking content.
- **`/super-admin`** redirects to `/super-admin/login?error=…` for app roles, and the redirect happens before any privileged data is fetched.
- **No console errors** on the ADMIN routes sampled; no horizontal overflow on any route at 1446 px.

---

## 4. Fix order (proposed; not applied)

1. **R4** — dead `DATABASE_URL` → 500s on the two billing routes. One-line config or guard; unblocks `/payment-links` from chat.
2. **R3** — manager→ADMIN escalation. Backend, 5 lines of schema/role validation.
3. **R2** — `GET /team` + `GET /permissions/matrix` permission gate. Backend, 2 lines.
4. **R8/R9** — fabricated "Connected" / reporting manager / seat chip. High trust cost, low effort.
5. **R5** — payments "not configured" state; stop substituting credentials; hide Save when unauthorized.
6. **R6** — stop rendering privileged controls for unauthorized roles; surface the real 403 reason instead of `.catch(() => {})`.
7. **R1** — server-computed nav (also removes the 1.53 s flash).
8. **R7** — breadcrumb `min-width: 0` + ellipsis (pairs with F1 in the CSS report).
9. **R10/R11** — copy and credential-label corrections.

---

## Appendix — reproduction

```text
# role session (browser console)
await fetch('/api/auth/logout', { method: 'POST' });
const r = await fetch('/api/auth/login/password', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier, password, loginScope, clientType: 'DESKTOP' }),
}).then(r => r.json());
localStorage.setItem('aicloser_auth_token', r.token);

# permission proof
GET /api/v1/team                    -> 200 (SALES_AGENT, team:view=false)
GET /api/v1/team/permissions/matrix -> 200 (SALES_AGENT)

# fabricated gateway proof
GET /api/v1/payments/settings       -> 200 { enabled:false, upiId:null, payeeName:null } (ADMIN)
open /payments -> "sales@aicloser" / "AI Closer Technologies Pvt Ltd"

# 500 proof
GET /payment-links  -> 500, digest 3508805354
GET /activate-plan  -> 500, digest 2493160901
node -e "require('pg')" probe of DATABASE_URL -> ECONNREFUSED 127.0.0.1:5432
```

`ui-audit@example.com`, `audit.manager@example.com`, `audit.agent@example.com` — all `AuditPass123!`, tenant **UI Audit Test Co** (`ws-2283fbe5-1`), **production**. Delete after review.
