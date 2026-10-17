# Closer — document-style CRM UI

A fresh front-end for the AIcloser CRM, built from scratch so no styling is inherited
from the previous app. Same modules and workflows as the live dashboard, but the
look, the tokens and every rule are authored here.

```bash
npm install
npm run dev -- --port 3040     # http://localhost:3040
npm run build && npm start     # production check
npx tsc --noEmit && npx eslint src
```

## Stack

| | |
| --- | --- |
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Hand-authored CSS in `src/app/globals.css` — tokens → shell → surfaces |
| Dependencies | `next`, `react`, `react-dom` only. Icons, charts and drag-and-drop are hand-rolled. |
| State | React context + reducer-ish store in `src/lib/store.tsx`, persisted to `localStorage` |
| Data | 18 seeded leads in `src/lib/data.ts` |

## Layout

```
src/
  app/
    globals.css              design tokens + shell + all component styles
    layout.tsx               root layout, no-flash theme bootstrap, AppProvider
    page.tsx                 → /dashboard
    (app)/
      layout.tsx             wraps routes in AppShell
      dashboard/page.tsx     metrics, pipeline breakdown, activity, owner load
      pipeline/page.tsx      8-stage kanban with drag & drop
      contacts/page.tsx      sortable table over the same records
      settings/page.tsx      theme, density, export, reset, connections
      [module]/page.tsx      blueprint pages for modules awaiting their API
  components/
    shell/AppShell.tsx       sidebar, topbar, ⌘K search, scope + theme controls
    ui/Icon.tsx              40 hand-written SVG icons, no icon library
    pipeline/                PipelineView, LeadDrawer, AddLeadDialog
    contacts/ContactsView.tsx
    dashboard/DashboardView.tsx
    settings/SettingsView.tsx
  lib/
    types.ts                 Lead, StageId, STAGES, SOURCES, SEGMENTS, OWNERS
    data.ts                  seed leads + navigation config
    store.tsx                provider, scope filter, formatting helpers
    modules.ts               spec for each not-yet-wired module
```

## What works today

- **Pipeline** — drag a card between the eight stages, or move it from the drawer's
  stage select. Filters by source and segment, free-text search, sort by recency or
  value, per-column counts and open value, add-lead dialog with phone validation,
  and a **Fit board** toggle that squeezes all eight stages into the viewport.
- **Lead drawer** — edit name, company, phone, email, value, owner, source, segment,
  tags and notes; delete with confirmation. Changes persist to `localStorage`.
- **Contacts** — search, stage filter, sortable columns, row opens the same drawer.
- **Dashboard** — open pipeline value, closed-won, new leads, win rate, value by
  stage, recent activity and owner load, all derived from the same records.
- **Scope switch** in the topbar (`All team users` / `My leads` / `Unassigned`)
  filters every page at once.
- **Theme + density** — light and dark, comfortable and compact, applied before the
  first paint and persisted.
- **⌘K search** over pages and leads.

## Not wired yet (by design)

Every module that needs a backend renders a blueprint page listing what the screen
will do and what it is waiting on. `src/lib/modules.ts` holds those specs:

| Module | Needs |
| --- | --- |
| Lead Import | file parsing + `POST /leads` batches |
| Call Recordings | telephony webhooks (Exotel / Twilio) |
| Live Chat | WhatsApp Cloud API + websocket relay |
| Lead Form Builder | public submissions endpoint |
| Plugins & Channels | OAuth apps + credential vault |
| WhatsApp Marketing | WABA + template approval + send queue |
| AI Bot & Automations | job runner + LLM API |
| Payments | Razorpay + webhook verification |
| Team & Users | auth provider + membership table |

## The API contract the UI already assumes

`Lead` in `src/lib/types.ts` is the shape the backend should return. Settings →
Export JSON writes exactly this array, so the same payload can seed a real
database. Once endpoints exist, replace `SEED_LEADS` with a fetch and keep
`useScopedLeads()` as the single filter point.

## Design tokens

Everything reads from the variables at the top of `src/app/globals.css`:
surfaces, ink, borders, accent, status colours, radii, the six-step type scale and
two motion speeds, each with a light and a dark value. Change `:root` and the whole
app follows — there are no `!important` rules and no legacy aliases to trace.
