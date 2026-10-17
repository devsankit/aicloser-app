# AIcloser New API → UI Feature Map

Purpose: design the next AIcloser dashboard around the new `/api/v1` APIs without coupling the UI to one screen or one backend response shape.

## 1. User visibility model

| User role | Default data scope | Primary UI |
| --- | --- | --- |
| `SALES_AGENT` | Assigned leads/conversations only | My Inbox, My Leads, callbacks, calls |
| `MANAGER` | Workspace/team data allowed by permissions | Team Inbox, Pipeline, reports, assignment |
| `ADMIN` | Full workspace/tenant data | Workspace dashboard, settings, integrations |
| `SUPER_ADMIN` | Cross-tenant only through explicit admin/impersonation flow | Tenant administration and support |

Every screen should receive `viewer` and `capabilities` from the session layer. Do not decide visibility from frontend role labels alone; the API remains the source of truth.

## 2. Global application shell

### APIs

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/heartbeat`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me/sessions`
- `GET /api/v1/me/activity`

### UI

- Workspace switcher / workspace name
- User profile and role
- Session/device status
- Theme toggle and notifications
- Global command/search entry point
- Permission-aware navigation

### Design rule

Keep this shell independent from feature modules. New modules should register a navigation item and route surface instead of modifying the shell layout.

## 3. Live Inbox / Multi-channel Chat

### APIs

- `GET /api/v1/conversations`
- `GET /api/v1/conversations/:id/messages`
- `POST /api/v1/conversations/:id/messages`
- `POST /api/v1/conversations/:id/read`
- `POST /api/v1/conversations/:id/attachments`
- `GET /api/v1/conversations/:id/attachments/:filename`
- `POST /api/v1/conversations/:id/typing`
- `GET /api/v1/realtime/events`

### Data to showcase

Inbox summary row:

- Customer name and phone
- Channel badge: WhatsApp API, WhatsApp Personal, Instagram, etc.
- Latest message preview and timestamp
- Unread count
- Lead stage/status
- Assigned closer
- Ad/source metadata when available

Thread view:

- Cursor-paginated messages
- Customer/internal lanes
- Sender and delivery state
- Attachments with secure preview
- Typing indicator
- Load older messages on upward scroll

### UI layout

```text
InboxScreen
├── InboxToolbar: search, channel, stage, assignee, unread
├── ConversationList: summary rows, pagination/virtual scroll
├── ConversationThread: header, message timeline, composer
└── LeadContextPanel: selected lead 360 data
```

### Current contract status

- Summary/history endpoints exist.
- Existing UI still calls legacy `/api/conversations`; it must move to the typed API adapter.
- Message route currently stores the message and emits an event; actual provider delivery must be confirmed before showing final “sent”.
- Attachment and action routes need closer-level access checks before exposing them to restricted users.

## 4. Lead 360 / Customer profile

### APIs

- `GET /api/v1/leads/:id/360`
- `GET /api/v1/leads/:id`
- `PATCH /api/v1/leads/:id`
- `DELETE /api/v1/leads/:id`
- `GET /api/v1/leads/:id/notes`
- `POST /api/v1/leads/:id/notes`
- `GET /api/v1/leads/:id/tasks`
- `POST /api/v1/leads/:id/tasks`
- `PATCH /api/v1/leads/:id/tasks/:taskId`
- `DELETE /api/v1/leads/:id/tasks/:taskId`

### Data to showcase

- Customer identity and contact details
- Current stage, priority and owner
- AI score/sentiment/summary
- Custom fields
- Notes timeline
- Open and completed tasks
- Call history
- Active conversation
- Payments related to the lead

### UI cards

1. Profile header: identity, source, owner, stage.
2. Next action card: next callback/task and priority.
3. Activity timeline: notes, calls, stage changes and messages.
4. Conversation card: open thread and unread state.
5. Commercial card: budget, payments and deal status.

## 5. Pipeline / Lead management

### APIs

- `GET /api/v1/leads`
- `POST /api/v1/leads`
- `GET /api/v1/leads/pipeline-aggregates`
- `GET /api/v1/stages`
- `GET /api/v1/leads/pool`
- `POST /api/v1/leads/:id/claim`
- `GET /api/v1/leads/duplicates`
- `POST /api/v1/leads/merge`

### UI

- Pipeline board grouped by dynamic stages
- Lead table/list with server-side search and filters
- Stage totals and weighted value metrics
- Unassigned lead pool
- Duplicate review queue
- Merge preview and confirmation dialog

### Important rule

Stages and labels come from `/stages`; do not hardcode stage names or colors in the UI.

## 6. Chat-side CRM actions

### APIs

- `POST /api/v1/conversations/:id/assign`
- `PATCH /api/v1/conversations/:id/stage`
- `POST /api/v1/conversations/:id/notes`
- `POST /api/v1/conversations/:id/callback`
- `PATCH /api/v1/conversations/:id/transport`
- `POST /api/v1/conversations/:id/ai-reply`
- `POST /api/v1/conversations/:id/drip`

### UI placement

Keep these actions in a compact thread header/context panel:

- Owner selector
- Stage selector
- Notes drawer
- Schedule callback dialog
- Channel/transport selector
- AI draft button
- Automation status menu

Use feature flags for AI, drip and transport until their backend behavior is production-ready.

## 7. Contacts

### APIs

- `GET /api/v1/contacts`
- `POST /api/v1/contacts`
- `GET /api/v1/contacts/:id`

### UI

- Searchable contacts table
- Contact profile drawer
- Related leads and conversations
- Create/contact enrichment form

## 8. Calls and recordings

### APIs

- `GET /api/v1/calls`
- `POST /api/v1/calls`
- `POST /api/v1/calls/:id/end`
- `POST /api/v1/recordings/init`
- `POST /api/v1/recordings/:id/content`
- `POST /api/v1/recordings/:id/complete`
- `GET /api/v1/recordings/:id/playback`

### UI

- Call history table
- Missed/completed call filters
- Call disposition panel
- Recording player with loading/error state
- Lead-linked call timeline

## 9. Payments and commercial actions

### APIs

- `GET /api/v1/payments`
- `POST /api/v1/payments`
- `POST /api/v1/payments/:id/approve`
- `POST /api/v1/payments/:id/reject`

### UI

- Payment request status card inside Lead 360
- Pending approvals queue for managers/admins
- Payment detail drawer
- Approve/reject confirmation with audit reason

## 10. Reports and workspace overview

### APIs

- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/overview`
- `GET /api/v1/reports/closers`

### UI

- KPI cards: leads, conversations, response rate, conversions
- Funnel/pipeline chart
- Channel comparison
- Closer performance table
- Date range and team filters

Reports should load independently from the inbox so a slow chart cannot block chat usage.

## 11. Team and permission management

### APIs

- `GET /api/v1/team`
- `PATCH /api/v1/team/:id`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/sessions`
- `POST /api/v1/admin/users/:userId/sessions/:channel/revoke`

### UI

- Team member table
- Role/status/assignment controls
- Active sessions and revoke action
- Permission-aware action states

## 12. Customization and settings

### APIs

- `GET/POST /api/v1/custom-fields`
- `PUT/DELETE /api/v1/custom-fields/:id`
- `GET /api/v1/stages`
- `GET /api/v1/integrations/google-drive/status`
- `GET /api/v1/integrations/google-drive/auth-url`
- `POST /api/v1/integrations/google-drive/callback`
- `POST /api/v1/integrations/google-drive/disconnect`
- `POST /api/v1/integrations/google-drive/sync-test`

### UI

- Custom field builder
- Stage configuration
- Google Drive connection/status
- Storage and recording preferences

## 13. Mobile and offline sync

### APIs

- `POST /api/v1/mobile/contacts`
- `POST /api/v1/mobile/devices`
- `POST /api/v1/mobile/devices/:deviceId/heartbeat`
- `POST /api/v1/mobile/offline-events/sync`

### UI

- Connected device list
- Last heartbeat and sync status
- Offline event conflict/error queue
- Device revoke/reconnect states

## 14. Webhooks and provider integrations

### APIs

- `GET /api/v1/webhooks/meta`
- `POST /api/v1/webhooks/meta`

### UI

These are mostly operational rather than daily user screens:

- Provider connection health
- Last webhook received
- Failed event count
- Retry/reconciliation status

## 15. Recommended screen map

```text
Dashboard
├── Overview
├── Inbox
│   ├── All conversations
│   ├── My conversations
│   ├── Unread
│   ├── Waiting
│   └── Needs follow-up
├── Leads
│   ├── List
│   ├── Pipeline
│   ├── Lead pool
│   ├── Duplicates
│   └── Lead 360
├── Calls
│   ├── Call history
│   └── Recordings
├── Payments
├── Reports
├── Team & permissions
└── Settings
    ├── Stages
    ├── Custom fields
    ├── Integrations
    └── Devices
```

## 16. Stable frontend architecture

```text
src/features/
├── auth/
├── inbox/
│   ├── api/
│   ├── components/
│   ├── hooks/
│   └── types.ts
├── lead-360/
├── pipeline/
├── calls/
├── payments/
├── reports/
├── team/
└── settings/
```

Each feature owns its query hooks, view models, loading/error/empty states and action handlers. The shared shell only owns navigation, session, theme and global notifications.

## 17. Data loading rules

1. Load inbox summaries first; never load every message history with the list.
2. Load selected thread history on demand with cursor pagination.
3. Load Lead 360 only after a lead is selected.
4. Keep reports, calls and payments on separate queries.
5. Use one tenant-scoped SSE connection and invalidate only affected queries.
6. Preserve skeleton, empty, error and permission-denied states for every feature.
7. Keep API response mapping in the adapter, not inside visual components.

