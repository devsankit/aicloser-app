# Theme audit — CRM surface (Oct 2026)

Why this file exists: the styling for the internal app is spread over ~51k lines
of CSS with four overlapping token systems and a late `!important` block. Every
session that touches the look re-discovers the same facts. This file records
them once, with file:line evidence, and explains what `src/styles/theme.css`
does and does not fix.

## 1. File map

| File | Lines | Role |
| --- | --- | --- |
| `src/app/globals.css` | 45 644 | All component rules. Imports Tailwind, React Flow and `design-tokens.css` at the top. |
| `src/styles/design-tokens.css` | 1 602 | Three parallel palettes plus the canonical `--crm-*` set. |
| `src/styles/theme.css` | ~380 | **The theme layer.** Loaded last from `src/app/layout.tsx:5`. |
| `src/components/chat/chat-workspace.module.css` | — | Chat three-pane surface; reads the same tokens. |

Load order is `design-tokens.css` → `globals.css` → `theme.css`.

## 2. Token systems found

Counted with `grep -o 'var(--…'` over `globals.css`:

| Family | `var()` uses | Defined in | Reaches the UI |
| --- | --- | --- | --- |
| `--crm-*` | 1 071 | `design-tokens.css:1402+` | yes — canonical |
| `--gx-*` | 209 | `design-tokens.css:19-56` (dark), `113-150` (light) | yes, directly |
| `--closer-*` | 92 | `design-tokens.css:5-16`, `101-111` — literals, never bridged | yes, directly |
| `--wa-builder-*` | 219 | derived from `--color-*` (`globals.css:25525`) | yes, already bridged |
| `--gapp-*` | 45 | literals at `globals.css:31884` — separate sub-app | not the CRM |
| `--color-*` | 1 500+ | `design-tokens.css:57-76` then re-pointed to `--crm-*` at `1580+` | yes — bridge layer |

`theme.css` therefore retunes `--crm-*` **and** re-points `--gx-*` / `--closer-*`
at it. Both are declared on `:root` so every route of this app (CRM, chat,
settings, login, signup) shares one palette — there is no marketing site in this
repo, the public site is a separate project. The app-shell selectors are listed
alongside `:root` so a portal rendered into `<body>` resolves too.

## 3. Why token changes alone look half-applied

A "21st UI Polish" block at the end of `globals.css` (≈ lines 41000-43050)
re-declares geometry and colour **with `!important` and extra specificity**.
Variables lose to it. Measured on the live dashboard (1440×900) before
`theme.css` section 5 existed:

| Element | Computed | Pinned by |
| --- | --- | --- |
| `.internal-topbar .app-page-title` | `20.48px` (1.28rem) | `globals.css:41134` `clamp(1.08rem,1.5vw,1.28rem)` |
| `.internal-nav-item` | `12.48px`, radius `9px` | `globals.css:41026` |
| `.sales-kanban-column` radius | `16px` | `globals.css:42323` |
| `.sales-crm-card.compact` radius | `14px` | `globals.css:42228` |
| `.sales-crm-surface` radius | `20px` | `globals.css:42192` |
| `.sales-crm-card.compact` background | `rgb(23,26,34)` `#171a22` | `globals.css:43023` |
| `.sales-kanban-column-header` background | `rgba(18,20,26,.92)` | `globals.css:43005` |

Section 5 of `theme.css` out-specifies exactly these seven (matching the
`!important` mechanism already in use). Verified on the live page after
injection: title 20 px, nav 14 px / 6 px, column 8 px, card 8 px and
`rgb(32,32,32)`, column header `rgb(32,32,32)`, surface 10 px, sidebar
240 px / `rgb(32,32,32)`. Delete a rule there when its component
is migrated. Do not add new `!important` rules for values a token can carry.

## 4. Type scale

`--crm-type-*` and `--type-*` exist, but most rules use raw `rem`:
78 × `0.72rem`, 59 × `0.78rem`, 40 × `0.68rem`, 35 × `0.8rem` … which is where
the odd computed sizes came from (`12.48px`, `20.48px`, `8.96px`). `theme.css`
therefore snaps the visible surfaces (title, nav, cards, columns) to six integer
steps — 12 / 13 / 14 / 16 / 20 / 24 — and leaves the rest for a mechanical pass.

## 5. Remaining work (measured, not fixed)

1. **191 hex literals** in the polish block alone; light-theme blocks still
   use the cold slate ramp (`#64748b`, `#0f172a`, `#cbd5e1`, `#e2e8f0`) instead
   of the warm neutral of `theme.css`. Dark-theme kanban is covered; light
   theme and secondary panels are not.
2. **Kanban grid is `repeat(7, 330px)` for 8 columns** (`globals.css:42308`):
   measured `scrollWidth 2 792px` in a `1 103px` box — 5 of 8 stages offscreen.
   A `minmax()` alternative is commented in `theme.css`.
3. **Page-title truncation**: `h1.app-page-title` measured 191 px for a 214 px
   string at 1440 px, no `title` attribute. Not touched — it is a layout bug in
   `.internal-topbar-main-row`, not a token issue.
4. **Word concatenation** on inline nodes: `"All team users7visible leads"`,
   `"New LeadNo payment sent"`, and on the marketing site `"Toolsfor"`,
   `"QuestionsAbout"`. Missing space between text nodes; DOM-level fix needed.
5. **Accent contrast**: white on `#ff6b2f` is 2.8:1 (fails WCAG AA for normal
   text). An opt-in `--primary-contrast` override sits commented in `theme.css`.
6. **Custom properties declared on `:root` that read `--gx-*`** resolve with the
   root value, not the shell-scoped one — `--accent-strong`,
   `--sidebar-active-border`, `--list-highlight` are re-declared in `theme.css`
   for that reason. Watch for this pattern in new tokens.

## 6. Verification performed

- `lightningcss` (the same engine Next.js uses) parses `theme.css` with
  0 warnings and round-trips through minification; every `var()` reference
  resolves to a declaration in `theme.css`, `design-tokens.css` or
  `globals.css`.
- `design-tokens.css` + `theme.css` parsed together in real cascade order:
  0 warnings, and the bundler drops the old `--crm-canvas: #0d0e10` as a dead
  declaration because the theme sets the same property on the same selector —
  proof the override wins on specificity, not just on file order.
- Both `@import`-style css entries in `src/app/layout.tsx` resolve to real
  files (`./globals.css`, `../styles/theme.css`).
- Rules injected into the live dashboard at 1440×900: `--crm-canvas #191919`,
  `--crm-surface #202020`, `--gx-bg #191919`, `--closer-surface #202020`,
  sidebar `rgb(32,32,32)` / 240 px, title 20 px, nav 14 px / 6 px radius,
  column `8px`, card `8px` / `rgb(32,32,32)`, surface `10px`.
- Not verified: a real `next build`. The running server is `next start`
  (production build), so `theme.css` is live only after a rebuild.
