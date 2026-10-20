# AI Closer CRM — Frontend Global CSS Mandate & Operating Standard

> **MANDATE**: In `D:\AIcloser\application`, ALL styling must be authored in `src/app/globals.css`.  
> NEVER use inline `style={{ ... }}` for layout geometry, spacing, borders, or colors.  
> NEVER patch CSS in individual components.

---

## 1. Strict Agent Separation of Concerns

| Area | Frontend Agent Responsibility | Backend Agent Responsibility |
| :--- | :--- | :--- |
| **Codebase Target** | `D:\AIcloser\application\src\components` & `src\app` (pages/layouts) | `D:\AIcloser\aicloser-api`, `src\app\api\*`, Prisma schema, DB migrations |
| **CSS & Design** | 100% strict adherence to `globals.css` design system | Zero CSS, Zero UI touches |
| **Data Ingestion** | Live API consumption & standardized empty states (`.empty`) | PostgreSQL database models & REST/SSE endpoint delivery |
| **Missing Endpoints** | Document & communicate exact REST contract (do not mock) | Implement endpoint & database operations |

---

## 2. Core Global CSS Class Hierarchy (`globals.css`)

### 🗂️ Surfaces & Containers
- `.page-shell`: Main screen container with proper padding and viewport bounding.
- `.page-head`: Header containing title, subtitle, and primary actions.
- `.card`: Standardized panel with `--border`, `--bg-surface`, and `--r-md`.
- `.card-head`: Panel header with title and subtitle.
- `.card-body`: Content container.
- `.card-foot`: Action bar or footer stats.
- `.dialog`: Modal overlay container with `--shadow-lg` and `--border-strong`.
- `.drawer`: Slide-over panel for lead details and editing.

### 🔘 Buttons & Controls
- `.btn`: Base button class.
  - `data-variant="primary"`: Solid dark ink fill with light text.
  - `data-variant="accent"`: Brand orange solid fill.
  - `data-variant="ghost"`: Borderless transparent hoverable button.
  - `data-variant="danger"`: Red warning/destructive button.
  - `data-variant="outline"`: Bordered neutral button.
  - `data-size="sm"`: Compact 28px height.
  - `data-size="md"`: Standard 32px height.
  - `data-size="lg"`: Large 40px height.
- `.icon-btn`: Square 32x32 button for icon-only interactions.
- `.seg`: Segmented control wrapper.
- `.seg-item`: Tab item within segmented control (`data-active="true"`).

### 🏷️ Status Chips & Badges
- `.chip`: Standard status badge with 4px radius and 11.5px meta font.
  - `data-tone="accent"`: Brand orange soft fill with accent border.
  - `data-tone="success"`: Green fill for connected/won states.
  - `data-tone="warning"`: Amber fill for pending/in-progress states.
  - `data-tone="danger"`: Red fill for overdue/lost states.
  - Default: Neutral gray soft fill.
- `.dot`: 6px circular status indicator (`data-status="online"`).

### 📝 Form Controls
- `.field`: Vertical form stack (`label` + input control).
- `.input`: Text, email, number, search inputs.
- `.select`: Dropdown select controls.
- `.textarea`: Multi-line text inputs.

### 📊 Tables
- `.table-wrap`: Horizontally scrolling wrapper with border and radius.
- `table`: 100% width, border-collapsed table.
- `th`: Sticky table header with meta font and subtle borders.
- `td`: Table cell with hoverable rows.

### 📭 Empty States
- `.empty`: Centered, calm container when zero items exist.
- `.empty-icon`: 40x40 rounded box with icon.
- `.empty-title`: 14px bold message.
- `.empty-desc`: 13px muted explanation.
- `.col-empty`: Kanban column empty placeholder.

---

## 3. Global CSS Variables (`:root` & `[data-theme="light"]`)

Always consume design tokens instead of hardcoded hex values:

```css
/* Backgrounds */
var(--bg)
var(--bg-sidebar)
var(--bg-surface)
var(--bg-panel)
var(--bg-soft)
var(--bg-hover)
var(--bg-active)
var(--bg-selected)

/* Text */
var(--text)
var(--text-secondary)
var(--text-tertiary)
var(--text-disabled)
var(--text-inverse)

/* Borders */
var(--border)
var(--border-strong)
var(--border-input)

/* Brand Accent */
var(--accent)
var(--accent-hover)
var(--accent-strong)
var(--accent-soft)
var(--accent-border)

/* Semantic Colors */
var(--success)
var(--warning)
var(--danger)
var(--info)

/* Radii */
var(--r-sm) /* 5px */
var(--r-md) /* 7px */
var(--r-lg) /* 10px */
var(--r-xl) /* 12px */
```

---

## 4. Anti-Patterns (STRICTLY PROHIBITED)

1. ❌ **NO Inline Layout Hacks**:
   ```tsx
   // BAD:
   <div style={{ display: 'flex', gap: '8px', padding: '12px', background: '#141516' }}>
   
   // GOOD:
   <div className="card-head">
   ```
2. ❌ **NO Inline Hex Colors**:
   ```tsx
   // BAD:
   <span style={{ color: '#f4612a' }}>Active</span>
   
   // GOOD:
   <span className="chip" data-tone="accent">Active</span>
   ```
3. ❌ **NO Inline Modals / Drawers**:
   ```tsx
   // BAD:
   <div style={{ position: 'fixed', top: 0, right: 0, width: 400, background: '#111' }}>
   
   // GOOD:
   <div className="drawer">
   ```
4. ❌ **NO Ad-hoc CSS Modules or `<style jsx>`**:
   Everything must live centrally in `globals.css` so the theme engine, light/dark switches, and layout scaling remain 100% unified.
