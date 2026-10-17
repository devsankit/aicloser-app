# Current Menu vs New API Gap Audit

Source menu: `src/components/sales/sales-dashboard.tsx` (`tabs` and `navigationTabs`).  
Target backend: `D:\AIcloser\aicloser-api`, routes mounted under `/api/v1`.

## Current menu

### CRM & Telephony

1. Dashboard Overview
2. CRM Pipeline & Kanban
3. Grab Leads
4. Contacts
5. Lead Import
6. Call Recordings & Missed Call History
7. Live Multi-Channel Chat

### Growth & Automation

8. Lead Form Builder
9. Plugins & Channels
10. WhatsApp Marketing
11. AI Bot & Automations

### Analytics & Settings

12. Payments & Confirmations
13. Reports & Lead-IQ
14. Team & Users
15. Settings, Team & Channels

## New API coverage

| Current menu item | New API coverage | Status | Recommendation |
| --- | --- | --- | --- |
| Dashboard Overview | `GET /reports/summary`, `/reports/overview`, `/reports/closers`, `/leads/pipeline-aggregates` | Ready | Keep; build cards and charts from server aggregates |
| CRM Pipeline & Kanban | `/leads`, `/leads/:id`, `/leads/:id/360`, `/leads/:id/tasks`, `/stages`, `/leads/pipeline-aggregates` | Ready with scope checks | Keep; use dynamic stages from `/stages` |
| Grab Leads | `/leads/pool`, `POST /leads/:id/claim` | Ready | Keep only for users with claim capability |
| Contacts | `/contacts`, `/contacts/:id` | Ready | Keep; add related lead/conversation data when contract supports it |
| Lead Import | No dedicated bulk import endpoint | Missing | Hide from New API menu until import contract exists |
| Call Recordings & Missed Call History | `/calls`, `/calls/:id/end`, `/recordings/*` | Partial | Keep calls/recordings; hide missed-call actions until ack/resolve APIs exist |
| Live Multi-Channel Chat | `/conversations/*`, `/realtime/events` | Core ready, actions need hardening | Keep; migrate off legacy `/api/conversations` |
| Lead Form Builder | No forms endpoint in New API | Missing | Hide until forms CRUD/submission APIs are added |
| Plugins & Channels | Meta webhooks, Google Drive, conversation transport only | Partial | Split into Integrations; do not promise generic plugin management |
| WhatsApp Marketing | No `/whatsapp-marketing` routes in New API | Missing | Hide until campaigns/templates/dispatch APIs are migrated |
| AI Bot & Automations | Conversation AI draft and drip placeholder routes only | Partial | Show as Labs/feature-flagged; do not expose full automation claims |
| Payments & Confirmations | `/payments`, create, approve, reject | Ready | Keep; protect approve/reject by role |
| Reports & Lead-IQ | `/reports/*`, lead 360 AI fields | Partial | Keep Reports; rename Lead-IQ to Insights only when dedicated APIs exist |
| Team & Users | `/team`, `PATCH /team/:id`, `/me/sessions`, admin session routes | Ready with permissions | Keep; separate Team from session/security settings |
| Settings, Team & Channels | `/custom-fields`, `/stages`, Google Drive integration, auth/session APIs | Partial | Split into Workspace Settings, Integrations and Security |

## Recommended New API menu

### Workspace

1. Overview
2. Inbox
3. Leads
   - All Leads
   - Pipeline
   - Lead Pool
   - Duplicates
4. Contacts
5. Calls & Recordings
6. Payments
7. Reports

### Workspace management

8. Team & Permissions
9. Stages & Custom Fields
10. Integrations
11. Devices & Sync

### Feature-flagged / future

12. Lead Import
13. Lead Forms
14. WhatsApp Marketing
15. Automations & AI

## Recommended menu grouping

```text
CRM
├── Overview
├── Inbox
├── Leads
│   ├── All Leads
│   ├── Pipeline
│   ├── Lead Pool
│   └── Duplicates
├── Contacts
└── Calls & Recordings

Operations
├── Payments
├── Reports
└── Tasks & Follow-ups

Workspace
├── Team & Permissions
├── Stages & Custom Fields
├── Integrations
└── Devices & Sync

Coming soon
├── Lead Import
├── Lead Forms
├── WhatsApp Marketing
└── Automations & AI
```

## Menu implementation rules

1. Menu visibility must come from role and API capability, not only hardcoded role checks.
2. A menu item should not be visible if its minimum read API is unavailable.
3. Destructive actions need a separate mutation capability, e.g. `lead.delete`, `payment.approve`, `team.manage`.
4. Feature-flagged modules should show a disabled/coming-soon state only if product wants users to discover them; otherwise keep them hidden.
5. Menu labels should describe the user outcome: `Inbox`, `Leads`, `Calls & Recordings`, `Workspace Settings`.
6. The navigation shell should not own API calls. Each feature module owns its query and loading/error state.

