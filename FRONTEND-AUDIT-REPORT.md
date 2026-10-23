# AIcloser — Frontend / CSS Audit

**Project:** `D:\AIcloser\application`
**Date:** 2026-10-23
**Type:** Read-only audit. No source files were modified.
**Method:** static analysis of the real import graph + live measurement in a running dev build.

---

## 0. How this was measured

| | |
|---|---|
| Runtime | `next dev --turbopack -p 3010` (Next 16.1.6, React 19.2.3, Tailwind 4) |
| Browser | Chromium, viewport **1446×886**, DPR 1 |
| Session | throwaway tenant created via `/signup` (`ui-audit@example.com`, workspace "UI Audit Test Co") |
| Routes walked | `/dashboard`, `/pipeline`, `/pipeline?tab=recycle`, `/contacts`, `/lead-import`, `/calls`, `/chat`, `/whatsapp`, `/automations`, `/payments`, `/settings` |
| Static | scripts over `src/**` (CSS parse, import graph, token resolution, contrast math) |
| Live CSS | exactly **one** stylesheet chunk reaches the browser: `_next/static/chunks/src_app_globals_*.css` (814 rules) + one 4-rule inline block |

Two ground-truth checks drove the whole audit:

1. **Import graph** — only three files import CSS:
   `src/app/layout.tsx:3` → `globals.css`, `src/components/chat/chat-workspace.tsx:78` → `chat-workspace.module.css`, `src/components/ui/universal-lead-search.tsx:7` → `universal-lead-search.module.css`.
2. **Token resolution** — every `var(--x)` was resolved against every declaration in every loaded sheet. Tokens that resolve to `""` at runtime were confirmed by reading all `document.styleSheets` in the browser, not just by grepping `src`.

Everything below is either a measured browser value or a file:line citation.

> **Line-number basis:** all citations refer to the **working copy** of `src/app/globals.css` as served by the dev build. That file carries a pre-existing uncommitted change (33 added lines at ~3628: `.phone-static-box`, `.phone-static-text`, `.phone-actions`) — not part of this audit. Against `git HEAD` everything after 3628 would shift by +33.

---

## 1. Summary

| # | Finding | Severity | Where |
|---|---|---|---|
| **F1** | Breadcrumb is clipped on **every** route (16–28 px of 114–229 px). Topbar has no responsive strategy; needs ≈1610 px. | **P1 — visible** | `globals.css:769–795` |
| **F2** | Android APK download is unreachable for everyone: `/latestapk` → 307 → `/downloads/*.apk` → **307 → `/login`**. | **P1 — broken feature** | `src/proxy.ts:10–39`, `src/app/latestapk/route.ts:7` |
| **F3** | Light theme **fails WCAG AA** on all secondary/table text: `#64748b` on `#f4f6f8` = **4.39:1** at 11–13 px. One line drives **81 declarations**. | **P1 — readability** | `globals.css:4028` vs `:143` |
| **F4** | 43 undefined CSS variables; 3 live `border-radius` declarations silently dropped. | **P2** | `globals.css:4838, 5734, 5802` |
| **F5** | Two stylesheets stacked: 835 rules / 749 distinct / **71 duplicated**; `!important` ×64. Header comment claims the opposite. | **P2** | `globals.css:1–7`, `:4001+` |
| **F6** | **196 KB (62.7 %) of the project's CSS never reaches the browser** — 3 dead files + 2 orphaned components. | **P2** | `legacy.css`, `design-tokens.css`, `theme.css`, `chat-workspace.*`, `universal-lead-search.*` |
| **F7** | Font-size scale defined 3× (`:root`, polish block, inline bootstrap). The polish intent (28/22/15) is silently defeated. | **P2** | `globals.css:90–95`, `:4007–4009`, `layout.tsx:113–115` |
| **F8** | `<html>` computes to **Times New Roman** (no `font-family` on `html`). | **P3** | `globals.css:86–87` |
| **F9** | 4,115 inline `style={{}}`, 162 distinct hardcoded hex in TSX; 4 of the top 5 fail contrast on white. | **P2** | `ChannelsView.tsx` 301, `AutomationsView.tsx` 298, … |
| **F10** | 76 `onClick` handlers on `div`/`span` without `role`/`tabIndex`; heading order skipped; 2 topbar buttons' accessible name mismatches their text. | **P2 — a11y** | live audit + Lighthouse |
| **F11** | `Icon` clamps every size to ≥16 px and falls back to a **Circle** for 5 unmapped Lucide names. | **P2** | `Icon.tsx:296`, `LUCIDE_MAP` |
| **F12** | `theme-toggle.tsx` is dead code containing `prefersDark ? "dark" : "dark"`; three different theme storage keys exist. | **P3** | `theme-toggle.tsx:21` |
| **F13** | `public-upi-payment-page.tsx` embeds ~3.4 KB `<style>` with a parallel, partly undeclared token set. | **P3** | `public-upi-payment-page.tsx:65` |

---

## 2. P1 — user-visible defects

### F1. Breadcrumb is clipped on every route (measured at 1446 px; no media query fixes it at any width)

`.breadcrumb` has `white-space: nowrap` + `overflow: hidden` and **no `text-overflow`**, so the text is cut mid-word with no ellipsis:

```css
/* globals.css:780 */
.topbar-lead { display:flex; align-items:center; gap:8px; min-width:0; }

/* globals.css:787 */
.breadcrumb {
  display:flex; align-items:center; gap:6px;
  color: var(--text-tertiary);
  font-size: var(--fs-meta);
  white-space: nowrap;
  overflow: hidden;      /* ← no ellipsis, no min-width */
}
```

Measured live (rendered width / natural `scrollWidth`, light theme, 1446×886):

| Route | rendered | natural | clipped |
|---|---|---|---|
| `/dashboard` | 16 px | 194 px | **92 %** |
| `/settings` | 28 px | 114 px | 75 % |
| `/contacts` | 28 px | 118 px | 76 % |
| `/lead-import` | 28 px | 140 px | 80 % |
| `/whatsapp` | 16 px | 197 px | 92 % |
| `/automations` | 28 px | 200 px | 86 % |
| `/pipeline` | 28 px | 211 px | 87 % |
| `/calls` | 28 px | 220 px | 87 % |
| `/payments` | 28 px | 229 px | 88 % |

Live probe: `.breadcrumb` → `{ width: 16, scrollWidth: 197, overflow: "hidden", textOverflow: "clip", fontSize: "13px" }`.

**Root cause — the topbar has no space budget.** Children measured at 1202 px available:

```
mobile-menu 0 · topbar-lead 16 · spacer 8 · search-wrap 340 · scope 294
· Team-breaks 112 · AI-btn 122 · seg 135 · icon-btn 28 · avatar 24
```

Forcing `.topbar-lead { flex: 0 0 auto }` makes it 194 px and pushes the topbar to `scrollWidth 1366` vs `width 1202` → **164 px overflow at 1446 px viewport**, i.e. the layout needs ≈**1610 px**.

The reason `.topbar-lead` absorbs the whole deficit is that it is the only flexible child — every other item is effectively non-shrinkable:

| Item | Why it won't shrink | Ref |
|---|---|---|
| `.search` | `width: clamp(180px, 26vw, 340px)` | `globals.css:809` |
| `.scope` | `white-space: nowrap` | `:856` |
| `.topbar-ai-btn` | `white-space: nowrap` | `:882` |
| `.break-badge` | `white-space: nowrap` | `:6023` |
| `.icon-btn` | `flex: 0 0 auto` | `:507` |

**And there is no media query for the topbar at all.** All 14 `@media` blocks were enumerated; the only structural responsive block is `@media (max-width: 860px)` (`globals.css:3108–3230`), which turns the sidebar into a drawer and caps `.search` at 220 px — it never mentions `.topbar-lead`, `.breadcrumb`, `.scope` or `.search-wrap`. At that width the remaining children still sum to roughly 900 px against ~832 px of available topbar, so `.topbar-lead` keeps absorbing the deficit and the breadcrumb stays clipped (arithmetic estimate — only 1446 px was measured directly).

Non-bug note: the 3 px delta on `.sidebar` (243 rendered / 246 scroll) is a border-box rounding artifact, not clipping.

---

### F2. The APK download link is broken for every user

```
GET /latestapk                     → 307  Location: /downloads/aicloser-latest.apk
GET /downloads/aicloser-latest.apk → 307  Location: /login?redirectTo=%2Fdownloads%2Faicloser-latest.apk
```

`src/app/latestapk/route.ts:5-15` redirects to the static file. `public/downloads/aicloser-latest.apk` **does exist** (9,881,227 B). But `src/proxy.ts`:

* `:10–23` — the static-extension allowlist covers `.png .jpg .jpeg .svg .webp .css .js` and **not `.apk`**;
* `:25–39` — the public-route allowlist contains `/latestapk` but **not `/downloads`** — even though the comment on `:25` reads *"Publicly accessible routes (Checkout, Inbound Forms, Auth flow, **APK downloads**)"*.

The redirect then lands on `/login` for everyone, including signed-in users, because auth is a **localStorage JWT** (`aicloser_auth_token` / `aicloser_token`) while `proxy.ts:47-53` only reads cookies (`aicloser_token`, `gx_session`, `Authorization`). A browser navigation never sends the token, so the proxy can never authorize `/downloads/*`.

Repro: visit `/latestapk` in any browser, signed in or not.

---

### F3. Light theme secondary text fails AA — a polish-layer regression

Measured live, light theme, on `/whatsapp` table headers:

```
color: rgb(100,116,139)   bg: rgb(244,246,248)   font-size: 11px   font-weight: 600
```

`#64748b` on `#f4f6f8` = **4.39:1** → below the 4.5:1 minimum at that size. The base theme had the correct value:

```css
/* globals.css:143 — original light theme, passes */
--text-tertiary: #5f636a;      /* 5.53:1 on #f4f5f6 */
```

```css
/* globals.css:4015 + 4028 — "POLISH" layer, overrides it */
[data-theme="light"] { --bg-soft: #f4f6f8; --text-tertiary: #64748b; }  /* 4.39:1 */
```

Contrast math (verified):

| Pair | Ratio | |
|---|---|---|
| `#64748b` on `#f4f6f8` | **4.39:1** | ✗ |
| `#5f636a` on `#f4f5f6` | 5.53:1 | ✓ |
| `#64748b` on `#f8f9fa` (`--bg`) | 4.51:1 | ✓ (barely) |

So the failure is surface-dependent: text sitting on `--bg` passes, text on `--bg-soft` (table headers, card bodies, empty states) fails. Affected live elements include "CAMPAIGN NAME", "TEMPLATE", "TARGET SEGMENT", "SENT", "DELIVERED", the breadcrumb, "Add a lead", "Audio recordings & transcripts" — i.e. most 11–13 px labels in the product.

**Blast radius:** `color: var(--text-tertiary)` appears in **81 declarations** in `globals.css` alone (`var(--text-tertiary)` in 95). One line — `:4028` — therefore changes 81 text colours in light mode. This is the highest-leverage single-line fix in the audit.

**Dark theme is fine** — `#8a8f98` on `#191a1b` = 5.36:1. Lighthouse's accessibility score of **0.99** on `/dashboard` is consistent with that run happening in dark mode: the same page measures 6 contrast failures in light mode, so an automated green does not clear this defect.

Note: `--accent` has the same override pattern (`#ab441d` at `:154` → `#ea580c` at `:4036`, 3.56:1) but it is **masked**, because `layout.tsx:103-108` writes `--accent*` as inline styles on `<html>`. Live value is `#ab441d` (5.87:1). Do not "fix" this by deleting the polish override without checking the bootstrap.

---

## 3. P2 — structural CSS problems

### F4. 43 undefined CSS variables; 3 live declarations silently dropped

Full sweep of the three CSS files: **89 declared / 112 distinct used / 43 undefined / 195 uses / 136 with no fallback.**

| Token | uses (no fallback) | First use |
|---|---|---|
| `--surface` | 24 | `chat-workspace.module.css:693` |
| `--line` | 17 | `:691` |
| `--chat-border` | 15 | `:22` |
| `--chat-text` | 9 | `:8` |
| `--foreground` | 8 | `:62` |
| `--chat-surface-soft` | 7 | `:131` |
| `--chat-surface` | 5 | `:23` |
| `--line-strong` | 4 | `:681` |
| `--r-xs` | 3 | `globals.css:4838` |
| `--chat-canvas` | 3 | `chat-workspace.module.css:7` |

Authoritative browser check — read every rule in every loaded sheet, then `getComputedStyle(document.documentElement)`:

```
--surface "" | --line "" | --line-strong "" | --chat-border "" | --chat-text ""
--foreground "" | --chat-canvas "" | --chat-rail-width "" | --r-xs ""
→ declarations found in any stylesheet: 0
```

**Live impact (globals.css, `--r-xs`):** `border-radius: var(--r-xs)` is invalid at computed-value time, so the whole declaration is dropped and the corner falls back to `0`:

* `.ai-key-input-wrap .toggle-btn` — `:4838` (API-key show/hide, 24×24)
* `.chat-action-btn` — `:5734` (22×22 message actions)
* `.drawer-copy-btn` — `:5802`

Result: square corners among otherwise-rounded controls. Cosmetic, but it is a correctness bug — an undefined token with no fallback.

The bulk (`--chat-*`, `--surface`, `--line`, `--foreground`) lives in the **orphaned** chat module (F6), where it is far worse: **118 of 153 final declarations are invalid** (39 backgrounds, 20 colors, 15 border-colors, 11 borders, 6 radii), affecting **57 of 73 selectors**. If that component is ever mounted, `.shell` loses `grid-template-columns` (children stack), `.rail`/`.stage` lose their backgrounds and borders, and the header loses its divider. It is dead today; it is a trap tomorrow.

### F5. Two styling generations stacked, and the file contradicts its own header

`globals.css:1-7` states:

> *"Everything is authored here — no overrides, no `!important`, no legacy aliases."*

Reality, in the same file:

* **64** `!important` declarations;
* **1,006** `var(--…)` uses, **130** hex literals, **86** `rgb()/rgba()`, 3 `color-mix()`;
* a section literally titled **"Canonical aliases for legacy tokens"** (`:108–124`), including `--closer-*` and `--color-*` alias families;
* a second authoring generation starting at `globals.css:4001`:

```css
/* LINEAR CRM POLISH: DUAL THEME, SPACING, PROPORTIONS & ICONOGRAPHY */
```

That block re-declares `:root` (`:4006`) and `[data-theme="light"]` (`:4015`), and re-styles `.sidebar`, `.col`, `.drawer`, `.dash-split`, `.funnel-row`, `.funnel-value` — mostly with `!important` — on top of the original definitions thousands of lines earlier.

Rule census: **835 rules, 749 distinct selectors, 71 selectors declared more than once, 157 rules involved in a duplicate chain.**

| Selector | Definitions at lines |
|---|---|
| `.sidebar` | **4×** — 325, 3117, 3331, 3937 |
| `.col` | **4×** — 1679, 3200, 3335, 3947 |
| `.sidebar[data-collapsed="true"]` | 3× — 339, 3132, 3942 |
| `.drawer` | 3× — 1529, 3213, 3951 |
| `.page-wide` | 3× — 1065, 1600, 3187 |
| `.table-wrap` | 3× — 1379, 2378, 2865 |
| `.dash-split` | 3× — 2127, 2359, 4123 |
| `.kbd` | 3× — 843, 3174, 3263 |
| `.setting-row` | 3× — 2918, 3076, 3081 |
| `:root` | 2× — 10, 4006 |
| `[data-theme="light"]` | 2× — 128, 4015 |

Everything is still one cascade, so the last definition wins — the practical cost is that **nobody can tell which value is live without opening devtools**, which is exactly how F3 happened.

### F6. 196 KB of CSS (62.7 %) is shipped but never loaded

| File | Bytes | Lines | Loaded? |
|---|---|---|---|
| `src/app/globals.css` | 119,497 | 6,251 | **yes** |
| `src/app/legacy.css` | 59,567 | 513 | no import anywhere |
| `src/styles/design-tokens.css` | 42,223 | 1,602 | no import anywhere |
| `src/styles/theme.css` | 17,753 | 416 | no import anywhere |
| `src/components/chat/chat-workspace.module.css` | 76,472 | 2,623 | only from an orphan |
| `src/components/ui/universal-lead-search.module.css` | 4,753 | 235 | only from an orphan |

**Total 320,265 B → 200,768 B never reaches the browser.**

The two module files are dead because their components are never imported:

* `chat-workspace.tsx` — **8,042 lines / 347,411 B** — no file contains an import specifier for it. `/chat` renders `ChatView` instead (`src/app/(app)/chat/page.tsx:2`). A second, complete chat implementation is sitting in the tree, unreachable.
* `universal-lead-search.tsx` — 222 lines — referenced only from its own file.

The orphaned chat module is also the worst-behaved file in the repo: **744 `!important`** in 2,623 lines, 51 duplicate selectors (`.shell` 7×, `.rail` 4×, `.stage` 4×, `.stageHeader` 3×), 21 `z-index` values spanning **0…120**, and the 118 invalid declarations from F4. Deleting it removes more `!important` than the entire live stylesheet (64).

### F7. The font scale has three sources of truth

```css
/* globals.css:90-95 */
--fs-caption:12px; --fs-meta:13px; --fs-body:14px;
--fs-title:16px;  --fs-page:19px; --fs-metric:24px;

/* globals.css:4007-4009  (polish) */
--fs-metric:28px; --fs-page:22px; --fs-title:15px;

/* layout.tsx:87 + 113-115  (inline, on <html>, wins) */
var SIZES = { caption:12, meta:13, body:14, title:16, page:19, metric:24 };
root.style.setProperty('--fs-' + name, ... + 'px');
```

The inline stylesheet-level declaration on `<html>` outranks both `:root` blocks. Consequences:

* `globals.css:90–95` is dead weight (identical values, immediately overwritten);
* the polish block's larger type (28/22/15) **never takes effect** — the "proportions" redesign it advertises is not on screen;
* `layout.tsx:96–98` and `:103–111` write another 12 tokens the same way, so **~18 CSS variables are runtime-injected and invisible in CSS source**. This is the mechanism that hid the `--accent` conflict in F3.

### F8. `<html>` renders in Times New Roman

`layout.tsx:124` sets no font family, and `globals.css` puts `--font` only on `body`. Live:

```
getComputedStyle(document.documentElement).fontFamily  →  "Times New Roman"
getComputedStyle(document.body).fontFamily            →  Inter, …
```

Visible impact is limited to nodes portalled to `<html>` (toasts/dialogs rendered outside `body`'s inheritance chain) and to any element that resets `font: inherit` from `html`. Low severity, one-line fix, but it is a real inheritance gap.

### F9. Inline styles and hardcoded colours bypass the token system

* **4,115** `style={{ … }}` occurrences. Top files: `ChannelsView.tsx` 301, `AutomationsView.tsx` 298, `super-admin-closer-control.tsx` 261, `LeadImportView.tsx` 253.
* **162 distinct hex literals / 1,183 occurrences** in TSX. The most frequent fail contrast on white:

| Hex | Uses | On white |
|---|---|---|
| `#ff6b2f` | 97 | **2.84:1** |
| `#10b981` | 82 | **2.54:1** |
| `#A1A1AA` | 60 | **2.56:1** |
| `#F97316` | — | **2.80:1** |
| `#94a3b8` | — | **2.56:1** |

These bypass `--accent`/`--success` and therefore bypass the runtime contrast correction in `layout.tsx:55-85`. Any inline colour is a place where the theme silently stops working.

### F10. Accessibility smells that automated tooling only partly catches

Live Lighthouse (`/dashboard`, desktop, dark theme): **accessibility 0.99**, best-practices 1.00, SEO 1.00 — with exactly two failures:

1. `heading-order` — `<section.card > div.card-body > div.empty > h3>`: `h3` with no `h2` above it.
2. `label-content-name-mismatch` — `.topbar .break-badge` and `.topbar .topbar-ai-btn`: visible text is not contained in the accessible name.

Static, not covered by Lighthouse:

* **76** `onClick` handlers on `div`/`span` with no `role`, no `tabIndex`, no key handler → unreachable by keyboard.
* 241 `aria-label` (good coverage), 16 `tabIndex`, **0** images missing `alt`.
* 252 of 901 `<button>` lack `type` — currently harmless because **0** sit inside a `<form>`, but it is a latent submit bug.

### F11. Icon sizing is clamped and some names silently become circles

`Icon.tsx:296` clamps `size` to **≥16 px**, so every smaller request inflates (432 of 571 static `<Icon>` usages request <16). Measured in dark-mode dashboard SVGs: 16×35, 17×17, 18×4, 20×2 — aspect ratios that should not exist for square icons.

Five names used in the app are missing from `LUCIDE_MAP` and fall back to `Circle`:

`clipboard-list`, `settings-2`, `plug-2`, `upload-cloud`, `layout-dashboard`

A wrong glyph is worse than a missing one — it looks intentional.

---

## 4. P3 — hygiene

* **F12. Dead theme toggle.** `theme-toggle.tsx` is reachable only through the barrel `src/components/ui/index.ts`, and its only real consumer — `internal-app-shell.tsx` — is itself imported nowhere. It contains a logic bug (`:21` `const initialTheme = prefersDark ? "dark" : "dark"`) that is currently invisible. Worse, the repo now has **three theme storage keys**: `closer.ui.v2` (live, `store.tsx:18`), `aicloser_theme` (written but never read, `store.tsx`), `ai-closer-theme` (dead component). Consolidate to one.
* **F13. Inline `<style>` with a parallel token set.** `public-upi-payment-page.tsx:65` embeds ~3.4 KB of CSS using `--color-text-primary`, `--color-success`, `--color-error`, `--shadow-card`, none of which are declared in `globals.css`. Same failure mode as F4, isolated to the public payment page.
* **`legacy.css` / `design-tokens.css` / `theme.css`** (F6) are not just unimported — they are *stale duplicates* of `globals.css` tokens. Anyone editing them will see no change and assume the build is broken.

---

## 5. Verified — **not** bugs (do not chase these)

| Thing | Verdict |
|---|---|
| `/pipeline` board scrolls horizontally (2376 vs 1162) | Intentional kanban: `.board { overflow-x: auto }`, 8 × 288 px columns |
| `/contacts` table 1255 px inside a 1138 px box | Intentional: `.table-wrap { overflow-x: auto }` |
| Sidebar 243 rendered vs 246 scroll | 3 px border-box rounding, not clipping |
| `.chip` "APK" 2.2:1 in my contrast sweep | **Measurement artifact.** Real composite is chip 15 % green over `rgba(255,255,255,.035)` over `#0f1011` ≈ `rgb(22,28,24)` → ≈6.4:1. Light theme uses `--success:#166534` (6.58:1). Passes. |
| Theme doesn't persist | Works. Verified: Dark → `data-theme="dark"`, `--accent:#f4612a`, `--bg:#08090a`, persisted across reload. |
| Dark flash on load | Not present. `layout.tsx:126` injects a blocking `themeBootstrap` in `<head>`; `data-theme="dark"` at `:124` is SSR-only and is replaced before paint. |
| `/super-admin` → login | Correct RBAC: `ADMIN` role lacks `SUPER_ADMIN`; proxy redirects with "Super Admin credentials required". |
| Dark-theme contrast | Passes (`.chip` aside). All F3 failures are light-theme only. |
| 401s on first authenticated load (`/api/v1/auth/me`, `/api/v1/ai/bot-config`) | Two calls fire before the JWT is hydrated from localStorage; they recover. Cosmetic, but it does indicate the auth bootstrap races the first render. |

---

## 6. Appendix — how the numbers were produced

**Route sweep (light theme, 1446×886; `.sidebar` 3 px and `sr-only`/`.avatar` excluded as artifacts):**

| Route | off-viewport-right | text clipped | contrast fails | <12 px text | <24 px targets | breadcrumb |
|---|---|---|---|---|---|---|
| `/dashboard` | 0 | 2 | 6 | – | – | 16 / 194 |
| `/pipeline` | 76 (scroll) | 10 (`.col` 286/289) | 10 | 20 | 3 | 28 / 211 |
| `/contacts` | 8 (scroll) | 2 | 11 | 19 | 4 | 28 / 118 |
| `/lead-import` | 0 | 2 | 7 | 15 | 2 | 28 / 140 |
| `/calls` | 0 | 2 | 7 | 15 | 3 | 28 / 220 |
| `/whatsapp` | 0 | 2 | 10 | 18 | 2 | 16 / 197 |
| `/automations` | 0 | 2 | 0 | 9 | 2 | 28 / 200 |
| `/payments` | 0 | 2 | 7 | – | – | 28 / 229 |
| `/settings` | 0 | 2 | 0 | 20 | 2 | 28 / 114 |
| `/pipeline?tab=recycle` | 76 (scroll) | 10 | 8 | 20 | 3 | 28 / 211 |

The universal "2 clipped" on quiet routes is the breadcrumb plus the page title; the kanban/table numbers are the intentional scrollers.

**`globals.css` census:** 119,497 B · 6,251 lines · 835 rules · 749 distinct selectors · 71 duplicated (157 rules) · 64 `!important` · 14 `@media` · 4 `@keyframes` · 0 `@supports` / `@container` / `@layer` / `:where()` / `:is()` · 1,006 `var()` · 130 hex · 86 `rgb()/rgba()` · 3 `color-mix()` · 13 `z-index` (range 1–1000).

**Breakpoints present:** 1180, 1080, 980, 900, 860 (twice), 768, 760, 640 (twice), 620, 480, plus `prefers-reduced-motion` and `hover: none`. Only the 860 px block is structural; **69 of the stylesheet's 3,542 declarations (1.9 %) live inside any media query**, and none of them touch the topbar.

**Console on first authenticated load:** 58 requests, 32 scripts, 2 × 401 (`/api/v1/auth/me`, `/api/v1/ai/bot-config`).

**Lighthouse** (`/dashboard`, desktop, dark): accessibility 0.99, best-practices 1.00, SEO 1.00, 2 failures (F10).

---

## 7. Suggested order of work

1. **F2** — one line in `proxy.ts` (`/downloads`) or serve the APK from `/latestapk` directly. Shipping a download button that logs users out is the worst defect here.
2. **F1** — give the topbar a budget: `flex: 0 1 auto` + `text-overflow: ellipsis` on `.breadcrumb`, and hide `.scope`/`.break-badge` below ~1200 px. Decide explicitly which control loses at each breakpoint instead of letting one 16 px sliver absorb it.
3. **F3** — delete the polish-layer `--text-tertiary` (or bump it to `#5a6a7d`); keep `#5f636a`. Cheapest possible AA win.
4. **F6 / F12** — delete `legacy.css`, `design-tokens.css`, `theme.css`, `theme-toggle.tsx`, `internal-app-shell.tsx`, and decide the fate of `chat-workspace.tsx`. That removes 196 KB, 744 `!important`, and the F4 blast radius in one commit.
5. **F5 / F7** — collapse the two generations in `globals.css`; move the runtime-injected tokens into a documented block so the cascade stops lying.
6. **F4, F9, F10, F11** — token backfill, inline-style migration, keyboard handlers, icon map.

Nothing here has been changed yet.
