# AIcloser — Admin & Sales-Agent Fix Brief

**Hand-off document for an AI coding agent (Antigravity).**
Companion evidence: [`FRONTEND-AUDIT-ROLES.md`](./FRONTEND-AUDIT-ROLES.md) (findings R1–R11) and
[`FRONTEND-AUDIT-REPORT.md`](./FRONTEND-AUDIT-REPORT.md) (CSS findings F1–F13).

- **Audit date:** 2026-10-23
- **Frontend repo:** `D:\AIcloser\application` (Next.js App Router, Turbopack dev server on `:3010`)
- **Backend repo:** `D:\AIcloser\aicloser-api` (Express + Prisma)
- **Live API:** `https://api.aicloser.in/api/v1` — **production**
- **Method:** DOM + computed-style measurement at 1446 × 886 dpr 1, live `fetch` probes, SSR HTML inspection, code trace.
- **No fixes applied yet.** No source file was modified by the audit.

---

## 0. Read this before touching code

### 0.1 What this brief is

Two real accounts were used to walk the product:

| Account | Role | Code | Password |
|---|---|---|---|
| `ui-audit@example.com` | ADMIN | `MGR-15BDDB` | `AuditPass123!` |
| `audit.agent@example.com` | SALES_AGENT | `AG-21AEFB` | `AuditPass123!` |

Both live in tenant `ws-2283fbe5-1` ("UI Audit Test Co") **in production**, created through the
product's own `/team` invite UI. Delete both accounts when this work is closed.

Findings are split by **who is hurt**:

- **Part A — ADMIN experience** (things the workspace owner sees broken).
- **Part B — SALES_AGENT experience** (things a field agent sees, including data they must not see).
- **Part C — cross-role authorization** (holes that make A/B worse).
- **Part D — CSS follow-ups** (already specified in the other report; only role-visible ones repeated here).

### 0.2 Ground rules for the implementer

1. **Do not change production data.** No seeding, no role changes on real users, no deleting the audit
   accounts until the user asks.
2. **Do not "fix" by hiding a symptom.** Every item below names a root cause; patch the cause.
3. **Backend changes are a separate repo and a separate deploy.** If you cannot deploy the API, land the
   frontend half and mark the item `PARTIAL`.
4. **Do not touch the orphaned CSS modules** (`chat-workspace.module.css`,
   `universal-lead-search.module.css`) in this pass. They are dead code, scheduled separately.
5. **Do not reformat `src/app/globals.css`.** It is 6,251 lines with two styling generations and an
   unrelated uncommitted change near L3628. Append-only edits.
6. Work in **PR-sized batches** in the order given in §2. Do not batch a P1 with a cosmetic item.
7. After each batch, run `npx tsc --noEmit` and `npx next lint` in `D:\AIcloser\application`.

### 0.3 Severity legend

| Tag | Meaning |
|---|---|
| **P1** | Blocks a core flow or exposes data across a role boundary. Fix first. |
| **P2** | Lies to the user (fake data, false state) or breaks a page for one role. |
| **P3** | Cosmetic / UX debt. |

---

### 0.4 Shared prerequisite — make API errors carry their HTTP status

Several fixes below branch on `err.status === 403`. That does **not** work today: `api-client.ts`
throws a plain `Error`, so `status` is always `undefined`.

Patch both throw sites (`src/lib/api-client.ts:492-494` and `:538-540`):

```ts
const errorMsg = json?.message || json?.error || `Request failed with status ${response.status}`;
handleCentralAuthFailure(response.status, String(errorMsg));
const error = new Error(String(errorMsg)) as Error & { status?: number };
error.status = response.status;
throw error;
```

Do this first — it is a one-file change and everything else depends on it. Do **not** remove the
`handleCentralAuthFailure` call or the existing `aicloser:api-error` event.

---

## 1. Status board

| ID | Sev | Area | One-line defect | Repo |
|---|---|---|---|---|
| **A1 / R4** | P1 | Billing | `/payment-links` and `/activate-plan` return **500 for every role** | FE |
| **C1 / R3** | P1 | AuthZ | A MANAGER can invite/promote to **ADMIN** and grant any permission (escalation) | API + FE |
| **C4** | P1 | AuthZ | `hasPermission` fails open: agents can play **every recording**, unknown keys are auto-granted | API |
| **B2 / R2** | P1 | AuthZ | A SALES_AGENT can read the full team roster with **emails + phones** | API |
| **B1 / R1** | P2 | Shell | Agent sees **13 admin nav items for ~1.5 s**, then 6; admin routes are in the SSR HTML | FE |
| **A2 / R5** | P2 | Payments | UI fabricates a UPI gateway (`sales@aicloser`) even when the API says `null` | FE |
| **B3 / R6** | P2 | Routing | Agent can open `/team`, `/settings`, `/automations` by direct URL | FE |
| **A3 / R8** | P2 | Team | SIM status, reporting manager and join date are invented in the roster | FE |
| **A4 / R9** | P2 | Team | Managers consume "Closer Seats"; every row says "CLOSER SEAT" | FE |
| **A5 / R11** | P2 | Settings | Developer token card lies: permanent "Generating", fake `aicloser_sec_••••` | FE |
| **B4 / R10** | P2 | Forms | Form create/update/delete has **no role middleware** | API |
| **A6 / R7** | P2 | Layout | Breadcrumb collapses to **16 px** for ADMIN and MANAGER | FE (CSS) |
| **B5** | P2 | AI | Global AI-Bot toggle is shown to agents; failure is silent | FE |
| **B6** | P2 | Leads | Agent can open `/lead-import` but the write always 403s | FE |
| **C2** | P2 | AuthZ | Role is read from a **client-writable cookie** fallback (`gx_role`) | FE |
| **C3** | P2 | AuthZ | Agents can read `/ai/system-prompt`, `/ai/providers`, `/ai/bot-train`, `/ai/bot-corrections` | API |
| **B7** | P3 | Errors | Raw backend strings surface in toasts; some paths fail silently | FE |
| **P3-1** | P3 | UX | `/unauthorized` is unreachable and shows sales-only copy | FE |

# Part A — ADMIN experience

## A1 / R4 — `/payment-links` and `/activate-plan` are 500 for everyone

**Severity:** P1 · **Repo:** frontend only

### Symptom
Opening either route shows the Next.js error page. Reproduced as ADMIN, MANAGER and SALES_AGENT.
Digests: `3508805354` (`/payment-links`), `2493160901` (`/activate-plan`).

This is not a corner case: **"Collect payment" inside a chat** (`ChatView.tsx:2898`) navigates to
`/payment-links`, so every payment collection attempt dead-ends.

### Root cause
Both pages reach `getWorkspacePaymentState()` in `src/lib/billing/workspace-access.ts`, which queries
**local Prisma**. The app runs against the remote API; there is no local DB.

- `/activate-plan` calls it directly (`page.tsx:15`).
- `/payment-links` calls it **through `requirePageRole()`** (`payment-links/page.tsx:11` →
  `src/lib/auth/page-guard.ts:34`), so the guard throws *before* it can redirect.

`/super-admin` is the only other `requirePageRole` caller, and it redirects at the role check before the
billing lookup, which is why it appears fine.

Evidence:

- `.env.local:5` → `DATABASE_URL=postgresql://…@127.0.0.1:5432/aicloser`
- A direct `pg` probe returns `ECONNREFUSED 127.0.0.1:5432`
- `workspace-access.ts:25` calls Prisma without a fallback
- `src/lib/auth/session.ts:8` also imports Prisma but never uses it — which is why login works while
  these two pages crash

### Change (required)

**1. Make the guard fail open, with a log.** In `src/lib/billing/workspace-access.ts`, catch only the
lookup — keep the return shape byte-identical so no consumer type changes:

```ts
export async function getWorkspacePaymentState(userId: string) {
  let subscription: Awaited<ReturnType<typeof getLatestWorkspaceSubscription>> = null;

  try {
    subscription = await getLatestWorkspaceSubscription(userId);
  } catch (error) {
    // The app talks to the remote API; this Prisma client has no reachable database.
    // Fail open so billing pages render instead of throwing a 500.
    console.error("[billing] workspace subscription lookup failed; failing open", error);
  }

  const locked = isWorkspacePlanLocked(subscription);
  return {
    subscription,
    locked,
    paymentStatus: subscription?.paymentStatus ?? "NOT_CONFIGURED",
    pendingSince: subscription?.createdAt ?? null,
    lockAt: subscription
      ? new Date(subscription.createdAt.getTime() + WORKSPACE_PAYMENT_GRACE_MS)
      : null,
  };
}
```

`"NOT_CONFIGURED"` is already a value in the existing union — do not invent `"UNKNOWN"`, it will not type-check.

**2. Add route-level error boundaries** so a future failure is a readable card, not a white 500:

- `src/app/payment-links/error.tsx`
- `src/app/activate-plan/error.tsx`

```tsx
"use client";

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 48, maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 650 }}>This page could not load</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        Billing data is temporarily unavailable. Your workspace and payments are unaffected.
      </p>
      <button className="btn" data-variant="primary" style={{ marginTop: 20 }} onClick={reset}>
        Try again
      </button>
      {error.digest ? (
        <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-tertiary)" }}>
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
```

**3. (Recommended, separate ticket) remove the local-Prisma dependency entirely.** The session JWT already
carries `packageStatus` / `packageId`; the lock check should read that, or a new
`GET /billing/subscription` on the API. Note this in the PR description; do not attempt it in the same
patch as the fail-open fix.

### Acceptance
- ADMIN, MANAGER and SALES_AGENT all render `/payment-links` and `/activate-plan`.
- With `DATABASE_URL` pointed at a dead host, both pages still render and log one `[billing]` error.
- `grep -R "ECONNREFUSED" .next` produces nothing after a fresh build.
- The "Collect payment" button in a chat reaches a usable payment-link page.

---

## A2 / R5 — The payments UI invents a gateway that does not exist

**Severity:** P2 · **Repo:** frontend

### Symptom
`/payments` → *Gateway Configuration* shows:

- UPI VPA: `sales@aicloser`
- Payee: `AI Closer Technologies Pvt Ltd`
- Protocol string: `upi://pay?pa=sales@aicloser&pn=AI%20Closer%20Technologies%20Pvt%20Ltd&cu=INR`

But the API returns the opposite:

```
GET /payments/settings  (ADMIN) → 200 { "enabled": false, "upiId": null, "payeeName": null, … }
GET /payments/settings  (MANAGER / SALES_AGENT) → 403
```

An admin can therefore believe collections are configured when they are not. Worse, managers and agents
also see the fake values (their fetch 403s and the component keeps its defaults).

### Root cause
`src/components/payments/PaymentsView.tsx` initialises state **with real-looking fake values** and
re-applies them as fallbacks:

```ts
// :61-68  initial state
{
  enabled: true,
  upiId: "sales@aicloser",
  payeeName: "AI Closer Technologies Pvt Ltd",
  instructions: "Pay instantly using Google Pay, PhonePe…",
  qrBrandName: "AI Closer",
}

// :164-180  loader
enabled: data.enabled ?? true,
upiId: data.upiId || "sales@aicloser",
payeeName: data.payeeName || "AI Closer Technologies Pvt Ltd",
…
} catch {
  // Keep defaults
}
```

The `||` fallbacks overwrite an explicit `null` from the server. The empty `catch` hides the 403.

### Change (required)

**1. Empty initial state + load status** (`PaymentsView.tsx:54-68`):

```ts
const [upiSettings, setUpiSettings] = useState<{
  enabled: boolean;
  upiId: string | null;
  payeeName: string | null;
  instructions: string | null;
  qrBrandName: string | null;
  qrAccentColor: string;
}>({
  enabled: false,
  upiId: null,
  payeeName: null,
  instructions: null,
  qrBrandName: null,
  qrAccentColor: "#f4612a",
});
const [settingsLoaded, setSettingsLoaded] = useState(false);
const [settingsError, setSettingsError] = useState<string | null>(null);
```

**2. Truthful loader** (`:164-180`):

```ts
const loadSettings = async () => {
  try {
    const data = await aicloserApi.payments.getSettings();
    setUpiSettings({
      enabled: Boolean(data?.enabled),
      upiId: data?.upiId ?? null,
      payeeName: data?.payeeName ?? null,
      instructions: data?.instructions ?? null,
      qrBrandName: data?.qrBrandName ?? null,
      qrAccentColor: data?.qrAccentColor || "#f4612a",
    });
    setSettingsError(null);
  } catch (err: any) {
    setSettingsError(
      err?.status === 403
        ? "Only a workspace admin can view gateway settings."
        : "Could not load gateway settings.",
    );
  } finally {
    setSettingsLoaded(true);
  }
};
```

**3. Render an explicit unconfigured state** above the form at `:704`:

```tsx
{settingsError ? (
  <div className="card" style={{ marginBottom: 16 }}>
    <div className="card-body" style={{ color: "var(--text-secondary)" }}>{settingsError}</div>
  </div>
) : settingsLoaded && !upiSettings.upiId ? (
  <div className="card" style={{ marginBottom: 16 }}>
    <div className="card-body">
      <strong>Gateway not configured.</strong>{" "}
      No UPI VPA has been saved for this workspace. Payment links stay in draft until one is set.
    </div>
  </div>
) : null}
```

**4. Never render a protocol string from a null VPA.** Find the `upi://pay?pa=` template (around `:345-365`
and the QR card at `:778-790`) and guard it:

```tsx
{upiSettings.upiId ? (
  <code>upi://pay?pa={upiSettings.upiId}&pn={encodeURIComponent(upiSettings.payeeName || "")}&cu=INR</code>
) : (
  <span style={{ color: "var(--text-tertiary)" }}>Not configured</span>
)}
```

**5. Gate the tab by role** (`:448-452`). `GET /payments/settings` is `ADMIN`/`SUPER_ADMIN` only, so the
tab must not exist for anyone else:

```tsx
{isAdmin ? (
  <button className="tab" data-on={tab === "settings"} onClick={() => setTab("settings")}>
    Gateway
  </button>
) : null}
```

with `const isAdmin = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN";`
(the component already uses `state` at `:33`).

Also guard the render block at `:704` with `tab === "settings" && isAdmin`.

**6. Disable Save when unconfigured** (`:759`):

```tsx
disabled={isSavingSettings || !isAdmin || !upiSettings.upiId}
```

### Acceptance
- Fresh workspace, admin opens `/payments → Gateway`: fields are empty, banner says *Gateway not configured*,
  and no `sales@aicloser` string exists anywhere in the DOM.
- After saving a VPA, the QR card and protocol string show exactly that VPA.
- MANAGER and SALES_AGENT see no Gateway tab.
- `grep -R "sales@aicloser" src` returns only migration/fixture data (ideally nothing).

---

## A3 / R8 — The team roster invents SIM status, manager and join date

**Severity:** P2 · **Repo:** frontend

### Symptom
`/team` rows claim:

- **Telephony SIM: Connected** for everyone (no SIM data exists in the API response)
- **Reporting manager** names that were never stored (`"Founder & Owner"`, `"Direct Admin"`)
- The word **"Active"** in the *Joined* column for the owner row — a status, not a date

### Root cause
`src/components/team/TeamView.tsx`:

```ts
// :325
simConnected: Boolean(m.simConnected ?? true),      // missing → true

// :333-339
reportingManager:
  m.reportingManager ||
  m.manager?.displayName ||
  (role === "MANAGER" ? "Founder & Owner" : "Direct Admin"),
joinedAt: m.createdAt
  ? new Date(m.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
  : "Active",

// :361-362 and :386-387 (owner fallbacks)
simConnected: true,
reportingManager: "Founder & Owner",
joinedAt: "Active",
```

The API never returns `simConnected` (it returns no telephony field at all), so **every** row is "Connected".

Also `:709` sets a fabricated reporting manager at invite time:

```ts
reportingManager: inviteRole === "MANAGER" ? "Founder & Owner" : "Direct Admin",
```

### Change (required)

**1. Widen the view model** (`:18`, and wherever `TeamMemberView` is declared):

```ts
simConnected: boolean | null;
reportingManager: string | null;
joinedAt: string | null;
```

**2. Stop defaulting to true** (`:325`, `:333-339`, `:353`, `:378`):

```ts
simConnected: typeof m.simConnected === "boolean" ? m.simConnected : null,

// API returns reportingManager as { id, agentCode, name } | null,
// not a string. Normalise before it reaches the select.
reportingManager:
  typeof m.reportingManager === "string"
    ? m.reportingManager
    : m.reportingManager?.name ?? m.manager?.displayName ?? null,

joinedAt: m.createdAt
  ? new Date(m.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
  : null,
```

For the owner fallbacks at `:353-362` and `:371-387`, use `simConnected: null`,
`reportingManager: null`, `joinedAt: null`.

> `:1363-1364` compares `mgr.name === member.reportingManager` and feeds `member.reportingManager`
> into a `<select value>`. With an object from the API that comparison is always false and React warns.
> Normalising to a string in the mapper fixes both call sites.

**3. Render three states** (`:1246-1254`):

```tsx
{member.simConnected === true ? (
  <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>
    <Icon name="phone" size={11} /> Connected
  </span>
) : member.simConnected === false ? (
  <span className="chip" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>No SIM</span>
) : (
  <span className="chip" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Unknown</span>
)}
```

**4. Render `—` for unknown manager/date** at their cell sites. Do not fall back to a person's name or a
hardcoded date.

**5. Remove the fabricated invite payload** (`:709`). Drop the `reportingManager` field entirely unless the
invite form collects a real manager id — the backend does not accept this string field meaningfully.

### Acceptance
- No member row says "Connected" unless the API actually returned `simConnected: true`.
- A newly invited agent shows `Unknown` for SIM and `—` for manager.
- The owner row's *Joined* column shows `—`, not `Active`.
- `grep -R "Founder & Owner\|Direct Admin" src/components/team` returns nothing.

---

## A4 / R9 — Seat accounting counts managers as closers, and mislabels every row

**Severity:** P2 · **Repo:** frontend

### Symptom
`/team` header card says **"Workspace Closer Seats 7 / 10"** while only 4 people have the closer role —
because the count includes managers and other non-admin roles.

Every non-admin table row shows the chip **"CLOSER SEAT"**, including managers.

### Root cause
`TeamView.tsx:947-952`:

```ts
const closerMembers = useMemo(() => members.filter((m) => m.role !== "ADMIN"), [members]);
const closerSeatsUsed = closerMembers.length;   // counts MANAGER too
```

Chip is hardcoded at `:1203-1216`:

```tsx
<span className="chip">CLOSER SEAT</span>
```

### Change (required)

**1. Count billable seats explicitly:**

```ts
const billableMembers = useMemo(
  () => members.filter((m) => m.role === "MANAGER" || m.role === "CLOSER"),
  [members],
);
const closerSeatsUsed = billableMembers.length;
const managerSeatsUsed = useMemo(
  () => members.filter((m) => m.role === "MANAGER").length,
  [members],
);
const activeClosersCount = useMemo(
  () => members.filter((m) => m.role === "CLOSER" && m.status === "active" && !m.onLeave).length,
  [members],
);
```

**2. Label the card honestly** (`:989`): `Workspace Billable Seats`, with a sub-line
`{managerSeatsUsed} manager · {closerSeatsUsed - managerSeatsUsed} closer`.

**3. Derive the row chip** (`:1203-1216`):

```tsx
{member.role === "ADMIN" ? (
  <span className="chip" data-tone="neutral">ADMIN</span>
) : member.role === "MANAGER" ? (
  <span className="chip" data-tone="info">MANAGER SEAT</span>
) : (
  <span className="chip">CLOSER SEAT</span>
)}
```

### Acceptance
- Seat number equals managers + closers only.
- A manager row never says "CLOSER SEAT".
- Add a unit test for the selector if the file has any test harness; otherwise a comment is acceptable.

---

## A5 / R11 — The developer-token card lies

**Severity:** P2 · **Repo:** frontend

### Symptom
As ADMIN the card shows a real JWT prefix, but as MANAGER / SALES_AGENT it shows:

- `aicloser_sec_••••••••••••••••••••••••` (a token that does not exist)
- chip permanently says **"Generating"**
- Copy button stays disabled with no explanation

### Root cause
`src/components/settings/SettingsView.tsx`:

```tsx
// :1124-1126
<span className="chip" data-tone={developerToken ? "success" : "neutral"}>
  {developerToken ? "Active Key" : "Generating"}
</span>

// :1136-1138
: isTokenLoading
? "Loading token..."
: "aicloser_sec_••••••••••••••••••••••••"
```

and the loader swallows the 403 at `:228` (`.catch(() => …)` continues), leaving
`isTokenLoading === false`, `developerToken === null`, hence "Generating" forever.

`GET /developer-token` requires ADMIN, so the correct state for other roles is **"Admin only"**, not
"Generating".

### Change (required)

**1. Add error state:**

```ts
const [tokenError, setTokenError] = useState<string | null>(null);
```

**2. In the loader (`:223-229`)** — replace the empty `.catch(() => {})`; keep the existing `.finally`:

```ts
.catch((err: any) => {
  setTokenError(
    err?.status === 403
      ? "Only a workspace admin can view this token."
      : "Could not load token.",
  );
})
.finally(() => setIsTokenLoading(false));
```

Also set `tokenError` inside `handleRegenerateToken`'s `catch` (`:243-245`) so the chip leaves "Generating"
after a failed regeneration.

**3. Three honest states:**

```tsx
<span
  className="chip"
  data-tone={developerToken ? "success" : tokenError ? "neutral" : "neutral"}
>
  {developerToken ? "Active Key" : isTokenLoading ? "Loading…" : tokenError ? "Unavailable" : "Not generated"}
</span>
```

**4. Never print a fake token.** Replace the literal at `:1138` with the error text, and disable Copy when
there is no token:

```tsx
{developerToken
  ? `${developerToken.slice(0, 14)}••••••••••••${developerToken.slice(-6)}`
  : isTokenLoading
    ? "Loading token..."
    : tokenError || "No token available"}
```

**5. Gate the whole card.** Wrap the token block (`:1116-…)` in `{isAdmin ? … : null}` where
`isAdmin = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN"`. Non-admins should not see a
card for a capability they do not have.

### Acceptance
- ADMIN sees a masked real JWT and a working Copy button.
- MANAGER / SALES_AGENT see **no token card** (preferred).
- No `aicloser_sec_` string remains in `src`.

---

## A6 / R7 — Breadcrumb collapses to 16 px for ADMIN and MANAGER

**Severity:** P2 · **Repo:** frontend (CSS)

### Symptom
Measured at 1446 px viewport:

| Role | `.breadcrumb` width | `.breadcrumb` scrollWidth |
|---|---|---|
| ADMIN | **16 px** | 160 px |
| MANAGER | **16 px** | 161 px |
| SALES_AGENT | 161 px | 161 px |

Only the first crumb's edge is visible; the page name is clipped. SALES_AGENT is fine purely because it
has fewer topbar actions.

### Root cause
`src/app/globals.css`:

- `.topbar` `:769` — flex row, no `min-width: 0` on children
- `.topbar-lead` `:780` — `min-width: 0`, shrinkable, so it absorbs all the missing space
- `.breadcrumb` `:787` — `white-space: nowrap; overflow: hidden`
- `.topbar-spacer` `:804` — grows, competing with the lead for free space

The breadcrumb is the only shrinkable child, so it collapses to its border width.

### Change (required)

Append near `.topbar` (do not edit the existing blocks destructively):

```css
/* Breadcrumb must win space from the spacer, not lose it to the actions. */
.topbar-lead {
  flex: 1 1 auto;
  min-width: 0;
}
.topbar-spacer {
  flex: 0 1 8px;
}
.breadcrumb {
  min-width: 0;
  overflow: hidden;
}
.breadcrumb > * {
  flex: 0 0 auto;
}
.breadcrumb > strong {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (min-width: 1100px) {
  .topbar-lead {
    min-width: 180px;
  }
}
```

> Note: `text-overflow` only applies to a block/inline-block with a single line box. `.breadcrumb` is a flex
> container, so the ellipsis must live on the last crumb (`strong`), which is what the rule above does.

### Acceptance
- ADMIN and MANAGER breadcrumb width ≥ 180 px at 1446 px viewport, and the current page name is legible.
- At 1024 px the breadcrumb truncates with `…` rather than clipping mid-glyph.
- No horizontal scrollbar appears at 1024, 1280, 1446 or 1920.
- Re-measure with `document.querySelector('.breadcrumb').getBoundingClientRect().width`.

---

# Part B — SALES_AGENT experience

## B1 / R1 — Admin navigation flashes for ~1.5 s, and admin routes are in the agent's HTML

**Severity:** P2 (security-adjacent) · **Repo:** frontend

### Symptom
An agent loading `/dashboard`:

- **t = 252 ms** → sidebar shows **13 items** (Dashboard, Pipeline, Contacts, Inbox, Calls, Forms,
  Lead Import, Team, Settings, Automations, Payments, WhatsApp, Channels)
- **t = 1,784 ms** → collapses to **6 items**

The pre-hydration HTML also contains links to `/settings`, `/automations`, `/team`, `/whatsapp`,
`/channels`, `/forms`, `/lead-import`.

### Root cause
`src/components/shell/AppShell.tsx:578`:

```ts
const userRole = state.user?.role || "ADMIN";
```

`state.user` is `null` on first render and is only populated after `GET /auth/me` resolves
(`store.tsx:533`). Until then the shell renders the **ADMIN** nav. There is no server-side role passed to
the shell:

```tsx
// src/app/(app)/layout.tsx — 7 lines
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

Two related hazards:

- `store.tsx:481` falls back to `"ADMIN"` when the `gx_role` cookie is missing.
- `gx_role` is set **without `httpOnly`** (`session.ts:334-340`), so any script on the page can rewrite it.

### Change (required)

**1. Pass the role from the server.** `src/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getSessionContext } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSessionContext();

  if (!session.userId || session.role === "GUEST") {
    redirect("/login");
  }

  return <AppShell initialRole={session.role}>{children}</AppShell>;
}
```

> `session.role` is `AppRole | "GUEST"`. Type the prop as `string`, not `AppRole` — `AppRole` does not
> include `"OWNER"`, which the existing shell compares against.

> This makes `(app)` routes dynamic. They are already client dashboards; verify no page relies on static
> export before merging.

**2. Accept the prop and resolve once** (`AppShell.tsx:222`):

```tsx
export function AppShell({
  children,
  initialRole,
}: {
  children: ReactNode;
  initialRole?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, … } = useApp();

  const userRole: string =
    state.user?.role ?? initialRole ?? "SALES_AGENT";

  const isAdmin =
    userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "OWNER";
  const isManager = userRole === "MANAGER";
```

No import needed for `AppRole`; keeping `userRole` as `string` preserves the existing `"OWNER"` comparison.

**3. Remove the per-group default** (`:578`). Delete `const userRole = state.user?.role || "ADMIN";`
inside `NAV.map` and use the outer `userRole`.

**4. Least-privilege fallbacks.**

- `store.tsx:481`: change `"ADMIN"` to `"SALES_AGENT"`.
- Any other `|| "ADMIN"` / `?? "ADMIN"` in `src/` → `"SALES_AGENT"`.

**5. Stop trusting `gx_role` for authorization.** It may remain as a *display hint*, but `AppShell` must
prefer `state.user.role` then the server prop. Do not let the cookie override a non-null `state.user.role`.

### Acceptance
- Hard reload `/dashboard` as SALES_AGENT: the **first** painted sidebar has 6 items. Sample at 100 ms via
  `document.querySelectorAll('.sidebar-scroll a').length`.
- View source of `/dashboard` as SALES_AGENT: no `href="/team"`, `/settings`, `/automations`, `/whatsapp`,
  `/channels` in the SSR HTML.
- Setting `document.cookie = "gx_role=ADMIN"` does **not** add items after hydration.
- ADMIN still sees 14 items immediately.

---

## B2 / R2 — An agent can read the whole team directory, with email and phone

**Severity:** P1 · **Repo:** backend (frontend only masks what the API gives it)

### Symptom
As SALES_AGENT — whose permission payload explicitly says `team:view: false`, `team:manage: false`:

```
GET /api/v1/team                → 200
{
  "members": [
    { "displayName": "…", "email": "…", "phone": "+91 …", "role": "ADMIN" },
    { "displayName": "…", "email": "…", "phone": "+91 …", "role": "MANAGER" },
    { "displayName": "…", "email": "…", "phone": "+91 …", "role": "SALES_AGENT" }
  ]
}
```

`GET /team/permissions/matrix` → **200** as well.

### Root cause
`D:\AIcloser\aicloser-api\src\routes\v1\team.ts:131`:

```ts
// GET / - List team members (Workspace roster open to all workspace members; …)
teamRouter.get('/', async (req, res) => {
```

No `requirePermissions(PERM_TEAM_VIEW)`. The serializer at `:238-266` always emits `email` and `phone`.
The `authUsers` loop at `:272-298` adds ADMIN/MANAGER rows with email and phone too.

Do **not** simply 403 the whole route: `PipelineView.tsx:170` and `store.tsx:496` call
`team.listMembers()` for assignment dropdowns, including for agents. A blanket block breaks lead routing.

### Change (required)

**1. Mask PII, keep the roster.** Add helpers near the top of `team.ts`:

```ts
const maskEmail = (value?: string | null) => {
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!domain) return "•••";
  return `${local.slice(0, 1)}•••@${domain}`;
};

const maskPhone = (value?: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••••••${digits.slice(-4)}` : "••••••";
};
```

**2. Derive the flag from the role, not from `hasPermission`.** Add this immediately after `:207`:

```ts
// :207 — already present, keep as-is (metrics, not identity)
const canSeeTeamMetrics =
  user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ||
  await hasPermission(user.userId, tenantId, user.role, PERM_TEAM_VIEW);

// Identity is stricter than metrics: only the roles that manage the roster.
const canViewDirectory =
  user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'MANAGER';
```

Do **not** reuse `canSeeTeamMetrics` here. `hasPermission` ends its legacy-profile branch with a bare
`return true` (`src/middlewares/rbac.ts`), so `team:view` is granted to any manager/agent whose stored
permission map lacks an explicit `team:view` key. See **C4** — that fail-open default is itself a defect.
A role check cannot be widened by a missing key.

`MANAGER` is included deliberately: managers run the roster and need contact details, and they already hold
`team:manage` by default. `CLOSER` and `SALES_AGENT` are not included.

**3. Apply to both serializers:**

- `:242-243` →
  `email: canViewDirectory ? p.user.email : maskEmail(p.user.email)`,
  `phone: canViewDirectory ? p.user.phone : maskPhone(p.user.phone)`
- `:278-279` (the `authUsers` loop that appends admins/managers) → same treatment. This block is easy to
  miss and leaks the founder's address to every agent.

**4. Gate the permissions matrix** (`:1061`) — it currently has **no middleware at all**:

```ts
teamRouter.get(
  '/permissions/matrix',
  requireRoles('ADMIN', 'MANAGER', 'SUPER_ADMIN'),
  async (req, res) => { … },
);
```

Use `requireRoles`, not `requirePermissions(PERM_TEAM_VIEW)`, for the same fail-open reason as step 2.
The `PUT` at `:1170` is already `requireRoles('ADMIN', 'SUPER_ADMIN')` — leave it.

**5. Leave `GET /team?assignable=true` working** — it already excludes admins and is used by routing UI.

### Acceptance
- Agent `GET /team` → 200, but every `email` is `a•••@domain` and every `phone` ends in 4 masked digits.
- Agent `GET /team/permissions/matrix` → 403.
- Agent's pipeline assignment dropdown still lists agents.
- ADMIN `GET /team` unchanged (full email/phone).
- Add an API test asserting the masked shape for a SALES_AGENT token.

---

## B3 / R6 — Privileged pages open by direct URL

**Severity:** P2 · **Repo:** frontend

### Symptom
As SALES_AGENT, typing the URL works and the page renders (after the ~1.5 s nav flash):

| Route | Agent result | API behaviour |
|---|---|---|
| `/team` | full roster UI | GET 200 (see B2) |
| `/settings` | full settings UI | various 403s |
| `/automations` | full page | GET 200 |
| `/whatsapp` | "Admin Access Required" panel | — |
| `/channels` | "Admin Access Required" panel | — |
| `/forms` | full editor | writes 200 (see B4) |
| `/lead-import` | full importer | writes 403 |

`/whatsapp` and `/channels` already do this correctly — copy that pattern.

### Root cause
`src/proxy.ts` only checks *authentication* for the `(app)` group, not role. Individual `page.tsx` files
have no `requirePageRole` call. Only `/payment-links` and `/activate-plan` use the helper.

### Change (required)

**1. Add guards where the role is unambiguous:**

```tsx
// src/app/(app)/team/page.tsx
export default async function Page() {
  await requirePageRole(["ADMIN", "MANAGER"], "/team");
  return <TeamView />;
}

// src/app/(app)/settings/page.tsx
await requirePageRole(["ADMIN", "SUPER_ADMIN"], "/settings");

// src/app/(app)/automations/page.tsx
await requirePageRole(["ADMIN", "MANAGER", "SUPER_ADMIN"], "/automations");
```

Import `requirePageRole` from `@/lib/auth/page-guard`.

> `requirePageRole` also performs the billing-lock lookup. **Land A1 first**, otherwise every new guard you
> add will 500 on the dead local database instead of redirecting.

> `MANAGER` is allowed on `/automations` because a manager can be granted it through `managerNavMap`
> (`AppShell.tsx:585-587`). If that grant is removed, tighten to ADMIN only.

**2. Do not server-guard `/forms` and `/lead-import` yet.** Their access is per-closer via
`closerNavMap` (client state), so a hard server gate would break the feature. Instead:

- render the existing "Access not enabled" empty state when
  `closerNavMap["/forms"] !== true` (agents) — same component used by `/whatsapp`;
- fix the write path in B4 (forms) and B6 (lead import).

**3. Keep `/unauthorized` copy accurate.** It currently says "requires sales access" for every denial;
change it to a neutral "You do not have access to this page" (P3-1).

### Acceptance
- Agent direct URL `/team` → redirect to `/unauthorized` (or a 403 panel), no roster in the DOM.
- Agent `/settings` → same. Agent `/automations` → same.
- Manager `/settings` → same (managers do not have settings in their nav).
- Manager `/team` and `/automations` still render.
- Admin unaffected on all routes.

---

## B4 / R10 — Any authenticated user can create, overwrite or delete forms

**Severity:** P2 · **Repo:** backend

### Symptom
As SALES_AGENT:

```
POST   /api/v1/forms            → no role check
PUT    /api/v1/forms/:slug      → no role check
PATCH  /api/v1/forms/:slug      → no role check
DELETE /api/v1/forms/:slug      → no role check
```

An agent can rewrite a public lead-capture form (the workspace's inbound funnel) or delete it.

### Root cause
`src/routes/v1/forms.ts` does apply `formsRouter.use(authenticate, enforceTenantIsolation)` — but at
**`:305`**, *after* the two public routes (`:86-87`, `:299-300`). Express runs middleware in registration
order, so everything registered below `:305` (including all writes at `:411-428`) is authenticated but has
**no role check**. The file never imports `requireRoles`.

### Change (required)

```ts
import { requireRoles } from "../../middlewares/rbac.js";

const requireFormAdmin = requireRoles("ADMIN", "MANAGER", "SUPER_ADMIN");

formsRouter.put("/:slug", requireFormAdmin, upsertFormHandler);
formsRouter.post("/:slug", requireFormAdmin, upsertFormHandler);
formsRouter.patch("/:slug", requireFormAdmin, upsertFormHandler);
formsRouter.post("/", requireFormAdmin, async (req, res) => { … });
formsRouter.delete("/:slug", requireFormAdmin, async (req, res) => { … });
```

Keep the **public** submission routes (`GET /public/:slug` `:86`, `POST /submit/:slug` `:299`,
`POST /:slug/submit` `:300`) above the `:305` middleware line and unmodified — they are the customer-facing
surface and must stay open. Do not move `formsRouter.use(authenticate, …)`; the ordering is load-bearing.

Also note `GET /:slug` (`:87`) sits above the auth line, so it is public too. If form definitions are
tenant-private, that route needs to move below `:305`; verify against the embed flow before changing it.

`MANAGER` is included because managers see `/forms` by default in the shell
(`AppShell.tsx:584-589`). If product decides forms are admin-only, drop `MANAGER` and update the nav filter
in the same PR.

### Acceptance
- Agent `POST/PUT/PATCH/DELETE /forms…` → 403 with a clear message.
- Public form submission still works with no auth header.
- Admin and manager form editing unchanged.

---

## B5 — The AI-Bot master toggle is shown to agents and fails silently

**Severity:** P2 · **Repo:** frontend

### Symptom
The topbar AI toggle (`AppShell.tsx:1143-1162`) is visible to every role. For an agent the write is rejected
(`PUT /ai/bot-config` → 403, verified), but the UI optimistically flips and then nothing explains the revert.

### Root cause
`store.tsx:1043-1054` already does the right thing — it rolls the optimistic value back and **rethrows**:

```ts
} catch (err) {
  setState((p) => ({ ...p, globalAiBotEnabled: !nextVal, isTogglingAiBot: false }));
  throw err;
}
```

The caller discards that error:

```tsx
// AppShell.tsx:1148-1150
onClick={() => {
  void toggleGlobalAiBot().catch(() => {});
}}
```

### Change

**1. Hide the control from roles that cannot use it.** Wrap the block at `:1143-1162`:

```tsx
{(isAdmin || isManager) && (
  <button … >…</button>
)}
```

**2. Surface the rejection** — replace the empty catch with the app's existing toast/banner mechanism:

```tsx
onClick={() => {
  void toggleGlobalAiBot().catch((err: any) => {
    setAiBotError(
      err?.status === 403
        ? "Only an admin can change the AI bot setting."
        : "Could not update the AI bot. Try again.",
    );
  });
}}
```

If `AppShell` has no toast primitive, reuse the same one used for `savedBanner`-style feedback in `TeamView`,
or add a 3-second inline `role="status"` message under the topbar. Do not use `alert()`.

### Acceptance
- Agent sees no AI toggle.
- Manager toggling with a rejected request shows "Only an admin can change the AI bot setting." and the
  switch returns to its previous position.
- A successful toggle for an admin shows no error.

---

## B6 — `/lead-import` is enabled but can never succeed

**Severity:** P2 · **Repo:** frontend

### Symptom
`closerNavMap["/lead-import"] = true` lets an agent open the importer. The submit calls an endpoint that
requires `leads:reassign`, which the agent does not have (`payouts:approve:false`,
`customer:unmask_phone:false`, `leads:reassign` absent) → 403 after the file is parsed.

### Change
Before rendering the dropzone, check the same permission payload the page already loads. If the agent lacks
`leads:reassign`, render a disabled state: *"Lead import is not enabled for your role. Ask your workspace
admin."* Do not let them pick a file.

If product wants agents to import, add a dedicated `leads:import` permission server-side instead — do not
reuse `leads:reassign`.

### Acceptance
- Agent without the permission sees the disabled state and no file picker.
- Agent with the permission (granted in `/team`) can import successfully.

---

## B7 — Raw backend errors and silent failures

**Severity:** P3 · **Repo:** frontend

### Evidence
- `SettingsView.tsx:228` — `.catch(() => …)` with no user feedback.
- `SettingsView.tsx:244` — one generic "Failed to save" for all causes.
- Toasts occasionally print backend strings such as `RoleEscalationBlocked` or Prisma messages.

### Change
Add one `toUserMessage(err)` helper: map `err.status` (403 → "You do not have permission…", 400 →
"Check the highlighted fields", 5xx → "Server error — try again") and show `err.message` only when it is
already human-readable. Never render a raw error code.

### Acceptance
- A 403 on save shows a permission sentence, not `Forbidden` / a stack string.
- A network failure shows "Could not reach the server."

---

# Part C — Cross-role authorization

## C1 / R3 — MANAGER can create or promote an ADMIN (privilege escalation)

**Severity:** P1 · **Repo:** backend + frontend

### Symptom
A MANAGER (who has `team:manage`) can:

1. invite a new user with `role: "ADMIN"` — the modal offers "Workspace Admin" (`TeamView.tsx:2573`);
2. change an existing user's role to `ADMIN` (`TeamView.tsx:2383`).

Both are accepted by the API (`inviteMemberSchema` / `updateAgentSchema` allow `ADMIN` and
`SUPER_ADMIN`). The manager controls the initial password, so this is full tenant takeover.

### Root cause
`team.ts:15-29` (`updateAgentSchema`) and `:386-400` (`inviteMemberSchema`) accept
`'ADMIN' | 'SUPER_ADMIN'`. The handlers only require `team:manage`, which managers have.

### Change (required)

**1. Server-side role ceiling** (shared helper in `team.ts`):

```ts
const PRIVILEGED_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

const canMintRole = (actorRole: string, targetRole: string) => {
  if (actorRole === "SUPER_ADMIN") return true;
  if (actorRole === "ADMIN") return true;
  return !PRIVILEGED_ROLES.includes(targetRole as any);
};
```

**2. In `POST /invite`** (route `:652`, handler `handleInvite` at `:402`) — insert **after** line `:408`,
where `normalizedRole` is derived (defaults `SALES_AGENT`, maps `CLOSER` → `SALES_AGENT`):

```ts
if (!canMintRole(req.user!.role, normalizedRole)) {
  return res.status(403).json({
    success: false,
    error: "RoleEscalationBlocked",
    message: "Only an admin can create admin accounts.",
  });
}
```

Check `normalizedRole`, not `req.body.role` — the raw value may be absent or `CLOSER`.

**3. In `PATCH /:id`** (route `:910`), if `req.body.role` is present:

```ts
if (!canMintRole(req.user!.role, req.body.role)) {
  return res.status(403).json({ … same shape … });
}
```

Also block a non-admin from changing **any** role (not just to ADMIN):

```ts
if (req.body.role && req.user!.role === "MANAGER") {
  return res.status(403).json({
    success: false,
    error: "RoleChangeForbidden",
    message: "Managers cannot change workspace roles.",
  });
}
```

**4. Frontend: hide the option** (`TeamView.tsx`):

- Invite select `:2571-2573` — render the `ADMIN` option only when
  `state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN"`.
- Edit select `:2381-2383` — same, and disable the whole select for non-admins.

**5. Close the second escalation path — arbitrary permission grants.**

`handleUpdatePermissions` (`:1378-1407`) writes **any** permission map for **any** member and is guarded only
by `team:manage` (`:1410-1411`). A manager can therefore grant themselves `payouts:approve`,
`customer:unmask_phone`, `leads:delete`, `leads:permanent_delete` or `team:manage`.

Add a ceiling before the write:

```ts
const ADMIN_ONLY_PERMISSIONS = new Set([
  "payouts:approve",
  "customer:unmask_phone",
  "leads:delete",
  "leads:permanent_delete",
  "team:manage",
  "integrations:manage",
]);

if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN") {
  const requested = Object.entries(permissions || {})
    .filter(([, granted]) => Boolean(granted))
    .map(([key]) => key);

  const forbidden = requested.filter((key) => ADMIN_ONLY_PERMISSIONS.has(key));
  if (forbidden.length > 0 || req.user!.userId === String(profile.userId)) {
    return res.status(403).json({
      success: false,
      error: "PermissionEscalationBlocked",
      message: `Managers cannot grant: ${forbidden.join(", ") || "permissions to themselves"}`,
    });
  }
}
```

Also block self-editing of permissions and self role changes entirely — `profile.userId === req.user.userId`
is never a legitimate manager action.

### Acceptance
- Manager invite with `role: "ADMIN"` → 403 `RoleEscalationBlocked`; UI never offers it.
- Manager `PATCH /team/:id { role: "ADMIN" }` → 403.
- Manager `PATCH /team/:id { role: "CLOSER" }` → 403 (role changes are admin-only).
- Manager `PATCH /team/:id/permissions` granting `payouts:approve` → 403.
- Manager cannot modify their own permissions.
- Admin can still invite/promote and grant any permission.
- Inventory the existing tenant for any ADMIN created by a manager during the audit window and report it.

---

## C2 — Role can be spoofed through a client-writable cookie

**Severity:** P2 · **Repo:** frontend

### Evidence
`session.ts:334-340` sets `gx_role` **without `httpOnly`**. `store.tsx:477-481` reads it as a fallback:

```ts
role: (roleMatch ? decodeURIComponent(roleMatch) : "ADMIN") as any,
```

So `document.cookie = "gx_role=ADMIN"` changes the client-side role whenever `/auth/me` is slow or fails.
The API still enforces permissions, so this is UI spoofing, not a backend bypass — but it makes the nav
flash in B1 worse and could expose admin-only panels.

### Change
1. In `AppShell`, prefer `state.user.role` → server `initialRole` → `"SALES_AGENT"`. Never read `gx_role`.
2. Change the `store.tsx:481` default to `"SALES_AGENT"`.
3. If `gx_role`/`gx_tenant` are only used for cosmetic bootstrapping, mark them `httpOnly: true` in
   `session.ts` and remove the client reader. Verify nothing else depends on `document.cookie`.

### Acceptance
- Setting `gx_role=ADMIN` in DevTools produces no admin UI after a reload.
- A slow `/auth/me` (throttle to 3G) never shows admin nav to an agent.

---

## C3 — Agents can read AI configuration and the system prompt

**Severity:** P2 · **Repo:** backend

### Evidence
As SALES_AGENT:

| Endpoint | Result | Content |
|---|---|---|
| `GET /ai/system-prompt` | 200 | full workspace prompt (business IP) |
| `GET /ai/providers` | 200 | provider list, models, `maskedApiKey` |
| `GET /ai/bot-train` | 200 | training documents |
| `GET /ai/bot-corrections` | 200 | correction history |
| `PUT /ai/bot-config` | 403 | correctly gated |

### Change
`src/routes/v1/ai.ts` — add the same middleware already used by the write routes:

```ts
aiRouter.get("/system-prompt",   requireRoles("ADMIN", "MANAGER", "SUPER_ADMIN"), …); // :1031
aiRouter.get("/providers",       requireRoles("ADMIN", "MANAGER", "SUPER_ADMIN"), …); // :906
aiRouter.get("/bot-train",       requireRoles("ADMIN", "MANAGER", "SUPER_ADMIN"), …); // :513
aiRouter.get("/bot-corrections", requireRoles("ADMIN", "MANAGER", "SUPER_ADMIN"), …); // :632
```

Leave `GET /bot-config` (`:270`) open: the store reads it on every page load to render the global toggle.
It must not leak secrets — if it does, strip them rather than gating it.

### Acceptance
- Agent gets 403 on the four endpoints.
- `/bot-config` still returns 200 for agents with no secret fields.
- Admin/manager AI settings pages unaffected.

---

## C4 — `hasPermission` grants every permission it does not recognise

**Severity:** P1 · **Repo:** backend

### Symptom
An agent can play **any** recording in the workspace, not just their own. The "strict closer scoping" block
in `calls.ts:39-46` and `recordings.ts:175-186` never runs, because the permission it checks is granted by
default:

```ts
// recordings.ts:175-186
if (req.user?.role === 'SALES_AGENT') {
  const canPlayAll = await hasPermission(userId, tenantId, 'SALES_AGENT', PERM_RECORDINGS_PLAY_ALL);
  if (!canPlayAll) {            // ← never reached
    … scope to this agent's calls …
  }
}
```

### Root cause
`src/middlewares/rbac.ts`, inside the `MANAGER | SALES_AGENT` profile branch, the "backward-compatible
defaults" end with a catch-all:

```ts
if (permission === PERM_LEADS_CLAIM) return profile.canClaimLeads;
if (permission === PERM_TEAM_MANAGE) return role === 'MANAGER';
if (permission === PERM_LEADS_REASSIGN) return true;
if (permission === 'payouts:approve') return role === 'MANAGER';
if (permission === PERM_TEAM_VIEW) return true;
if (permission === PERM_CONTACTS_VIEW) return true;
return true;                     // ← anything not listed above
```

`handleInvite` seeds a profile with `roleDefaults` (`team.ts:449-504`), which covers **14** keys. But the
permission catalog exposes ~23, and `recordings:play_all` is in neither list. Anything absent from both the
profile map and `workspace.settings.rolePermissions[role]` falls through to `return true`.

| Key state | Result | Evidence |
|---|---|---|
| Explicit `false` in the profile map | denied | agent `POST /leads/import` → 403 (B6) |
| Explicit `true` | allowed | agent `contacts:view` → allowed |
| **Absent from map and role matrix** | **allowed** | `recordings:play_all` → all recordings unlocked |

Keys in the catalog but **not** in `roleDefaults`, i.e. implicitly granted today:
`leads:export`, `leads:delete`, `leads:permanent_delete`, `telephony:make_call`, `chat:share`,
`whatsapp:marketing`, `payments:create`, `payments:settle`, `integrations:manage`, and
`recordings:play_all` (not even in the catalog).

No `requirePermissions(...)` route currently uses those keys, so today the live exposure is through the
direct `hasPermission()` calls — of which `recordings:play_all` is the damaging one. The moment any route
adds one of these guards, it is open to every agent and manager. Legacy profiles with `permissions = {}`
also get `team:view`, which unlocks `GET /team/audit-logs` (`:346`) and `GET /team/:id/permissions`
(`:1338`).

This is also why **B2 must not** derive identity-masking from `hasPermission`: an agent whose map lacks
`team:view` would come back unmasked. B2 uses a role check instead.

### Change

**1. Default deny** — replace the tail of that branch:

```ts
if (permission === PERM_LEADS_CLAIM) return profile.canClaimLeads;
if (permission === PERM_TEAM_MANAGE) return role === 'MANAGER';
if (permission === 'payouts:approve') return role === 'MANAGER';
if (permission === PERM_TEAM_VIEW) return role === 'MANAGER';

// No implicit grants. Anything not covered above must come from the
// profile map or the workspace role matrix.
return false;
```

This removes the hardcoded `true` for `leads:reassign`, `contacts:view` and `recordings:play_all` in one
stroke. `recordings:play_all` should stay denied-by-default; admins can be granted it explicitly later.

**2. Backfill before you flip it.** Profiles created through `/team` already carry all 14 keys. Profiles
created before that code existed may carry `{}`. Inspect first:

```sql
SELECT id, "userId", role, permissions
FROM "SalesAgentProfile"
WHERE permissions IS NULL OR permissions = '{}'::jsonb;
```

For each such profile, write the intended legacy defaults explicitly
(`{"contacts:view": true, "leads:view": true, "leads:create": true, "leads:claim": <canClaimLeads>, "leads:reassign": false, "calls:view": true, "calls:playback": true, "chat:view": true, "chat:send": true, "payouts:view": true, "team:view": false, "team:manage": false}`).
Do **not** backfill `payouts:approve`, `customer:unmask_phone`, `leads:delete`, `leads:permanent_delete` or
`team:manage` for agents.

If you cannot run the backfill this sprint, ship the `return false` alone: the 14-key profiles are
unaffected, and only the (rare) empty-map profiles change behaviour — in the safe direction.

**3. Regression tests:**

- unknown permission key → `false` for `MANAGER` and `SALES_AGENT`;
- `recordings:play_all` → `false` for an agent with a full `roleDefaults` map;
- `team:manage` → still `true` for a manager.

### Acceptance
- Agent `GET` on another agent's recording → 403/404; their own recording still plays.
- Agent `GET /team/audit-logs` and `GET /team/:id/permissions` → 403 (role gate added in B2 plus this).
- Unknown key → `false`.
- Manager keeps `team:manage` and `payouts:approve`.
- No agent loses `contacts:view`, `leads:view`, `leads:create`, `leads:claim`, `calls:view`, `chat:*`.

---

# Part D — CSS follow-ups

These are already specified with measurements in `FRONTEND-AUDIT-REPORT.md`. Only the role-visible ones
belong in this brief's acceptance pass; the rest can ship separately.

| ID | Defect | Where | Priority |
|---|---|---|---|
| **R7 / A6** | Breadcrumb collapses to 16 px | `globals.css:769-807` | **P2 — include in this work** |
| **F1** | Light-mode `--text-tertiary` = 4.39:1 (fails WCAG AA 4.5:1) | `globals.css:4028` | P2 |
| **F2** | 62.7 % of CSS never ships; two styling generations; 71 duplicated selectors | `globals.css`, orphan modules | P3 (separate PR) |
| **F3** | 64 `!important`, 69 of 3,542 declarations in media queries, no `@container`/`@supports` | `globals.css` | P3 |
| **F5/F7** | No reduced-motion path; fixed px type scale | `globals.css` | P3 |
| **F6/F12** | Table density and focus-visible inconsistencies | `globals.css` | P3 |

**Do not delete** `chat-workspace.module.css` or `universal-lead-search.module.css` in this pass; their only
importers are orphaned components (`chat-workspace.tsx`, 8,042 lines). Removing them is a separate,
reviewable change.

---

# 2. Execution order

Ship in this exact order. Each row is one PR.

| Batch | Items | Why this order |
|---|---|---|
| **0** | §0.4 (attach `status` to API errors) | One file; every later error-state fix depends on it. |
| **1** | A1 (fail-open + error boundaries) | Unblocks payment flows for every role. Zero product decisions. |
| **2** | C1 (role ceiling, API first, then UI) | Highest security impact; independent of everything else. |
| **3** | C4 (default-deny + permission backfill) | Must land before B2/C3 rely on permission gates. Backfill first, then flip the default. |
| **4** | B2 (mask PII, gate matrix) | Stops the active data leak; does not break routing. |
| **5** | B4 + C3 (forms roles, AI read roles) | Same shape of fix, both backend-only. |
| **6** | B3 (page guards) | Depends on nothing, but verify no manager flow breaks. |
| **7** | B1 + C2 (server role, least-privilege fallback) | Removes the flash and the cookie trust in one change. |
| **8** | A2 (payments truthfulness) | Product-facing; needs a manual pass. |
| **9** | A3 + A4 (team data + seats) | Same file; batch together. |
| **10** | A5 (token card) | Same file as `/settings` guard. |
| **11** | A6 (breadcrumb CSS) | Isolated, visual only. |
| **12** | B5 + B6 + B7 + P3-1 | Polish. |
| **13** | Part D remainder | Separate CSS cleanup effort. |

Do not merge batch *n+1* until batch *n* passes its acceptance checks.

---

# 3. Verification runbook

Run these after each batch. Use the two audit accounts; do not create new ones.

### 3.1 Static

```powershell
cd D:\AIcloser\application
npx tsc --noEmit
npx next lint
```

Backend:

```powershell
cd D:\AIcloser\aicloser-api
npx tsc --noEmit
npm test -- --runInBand
```

### 3.2 Browser checks (viewport 1446 × 886)

| Check | How | Pass |
|---|---|---|
| Nav first paint | Reload `/dashboard`, sample `document.querySelectorAll('.sidebar-scroll a').length` at 100 ms | ADMIN 14, MANAGER 12, SALES_AGENT 6 |
| SSR leak | `curl` the page with the agent cookie, grep for `href="/team"` | absent |
| Breadcrumb | `.breadcrumb` width / scrollWidth | ≥180 / equal, both admin and manager |
| Billing pages | Visit `/payment-links`, `/activate-plan` | render, no digest |
| Payments truth | `/payments → Gateway` on a fresh workspace | no `sales@aicloser`, shows *Not configured* |
| Team PII | Agent `GET /team` | masked email/phone |
| Team escalation | Manager invite `role=ADMIN` via devtools fetch | 403 |
| Permission default | Agent `GET /team/audit-logs`, `GET /team/:id/permissions` | 403 |
| Page guards | Agent direct URL `/team`, `/settings`, `/automations` | denied |
| Token card | Agent `/settings` | no card, or "Unavailable" — never "Generating" |

### 3.3 Regression checklist (do not skip)

- Admin can still invite a CLOSER and that user can log in.
- Agent's pipeline assignment dropdown still lists teammates (B2 must not break it).
- Public form submission works without auth (B4 must not break it).
- Chat "Collect payment" reaches a working `/payment-links`.
- Theme toggle still works (A6 touches the topbar).

---

# 4. Definition of done

- [ ] All P1 items closed and verified on the two audit accounts.
- [ ] No `|| "ADMIN"` role fallback remains in `src/`.
- [ ] No fabricated business data (`sales@aicloser`, `Founder & Owner`, join-date fallback `"Active"`) remains in `src/`.
- [ ] Agent SSR HTML contains only the 6 permitted nav hrefs.
- [ ] Agent `GET /team` returns masked contact fields.
- [ ] Manager cannot mint an ADMIN through any endpoint or UI control.
- [ ] `tsc` and `lint` clean in both repos.
- [ ] Audit accounts deleted from production, or explicitly handed back to the user for deletion.
- [ ] A short `CHANGELOG` entry per batch, with the finding IDs.

---

# Appendix — raw evidence index

| Finding | Evidence |
|---|---|
| A1 | digests `3508805354`, `2493160901`; `pg` probe `ECONNREFUSED 127.0.0.1:5432`; `.env.local:5` |
| A2 | `GET /payments/settings` → `{enabled:false, upiId:null, payeeName:null}`; UI `sales@aicloser` |
| A3 | API roster has no `simConnected`; UI default `Boolean(m.simConnected ?? true)` |
| A4 | 7 non-admin members vs 4 closers; chip hardcoded `CLOSER SEAT` |
| A5 | ADMIN token 339 chars `eyJhbGciOiJIUz…`; non-admin `aicloser_sec_••••` + "Generating" |
| A6 | breadcrumb width 16 px (ADMIN/MANAGER) vs scrollWidth 160/161 |
| B1 | 13 nav items at t=252 ms → 6 at t=1,784 ms; SSR HTML contains 7 admin hrefs |
| B2 | agent `GET /team` 200 with 3 emails and phones; matrix 200 |
| B3 | direct URL renders `/team`, `/settings`, `/automations` for agent |
| B4 | no `requireRoles` in `forms.ts`; write routes bare |
| B5 | `PUT /ai/bot-config` 403 for agent; toggle visible |
| B6 | `/lead-import` submit → 403 (`leads:reassign` absent) |
| C1 | `inviteMemberSchema` / `updateAgentSchema` allow `ADMIN`/`SUPER_ADMIN`; `handleUpdatePermissions` writes arbitrary maps with only `team:manage` |
| C2 | `gx_role` cookie set without `httpOnly`; store falls back to `"ADMIN"` |
| C3 | agent 200 on `/ai/system-prompt`, `/ai/providers`, `/ai/bot-train`, `/ai/bot-corrections` |
| C4 | `rbac.ts` fallback ends in `return true`; `recordings:play_all` absent from `roleDefaults` (`team.ts:449-504`) and from the catalog |
