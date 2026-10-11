# AIcloser release verification report — 2026-10-09

## Scope tracked after the release pass started

- UPI payment collection is tenant-aware, has a branded preview, configurable link validity, customer proof upload, screenshot preview, and approval actions.
- Approval now requires a payment screenshot. Closer approval is enabled by default, while an admin can explicitly turn it off.
- The payment expiry migration was restored as a valid no-op migration because expiry is stored in the link custom-fields JSON. Production migration history is now complete.
- Workspace admin protection prevents changing/deleting the current admin account.
- Round-robin options exclude admins, suspended users, non-claiming users, and profiles outside the current workspace.
- Report UI no longer exposes the unfinished scheduled email/WhatsApp digest or placeholder report data.
- Login defaults for admin/manager identities return to the main dashboard.
- WhatsApp personal scanner state is isolated by closer identity; inbox upserts remain tenant-scoped.
- AIcloser Meta onboarding defaults are pinned to the AIcloser app (`1385995129001581` / configured AIcloser onboarding config), so a saved Gigxomi app ID is not reused by this deployment.
- Super Admin now manages workspace capacity only: the workspace summary exposes tenant-level `− / +` seat controls (1–500), while individual-user controls, team drill-down, and user creation are not exposed there.
- Super Admin workspace summary now also provides a shared expiry-date control; saving it updates every linked workspace account and subscription together, including clearing the expiry when left blank.
- Super Admin workspace summary now provides tenant-scoped Activate/Suspend control; it updates the workspace status and linked sales profiles together without exposing individual-user management.
- Super Admin page wiring now renders the manual workspace-control screen in production; it uses the existing `AicloserWorkspace` mapping so each signed-up admin and its agents stay under the correct workspace instead of appearing as `Unassigned workspace`.
- Admin call navigation no longer redirects `calls` to `reports`; Call Recordings & Missed Call History and Reports remain separate tabs/components.

## Verification completed

- Focused contract tests: 37 passed, 0 failed.
- UPI contract tests: 4 passed, 0 failed.
- TypeScript check: passed.
- Git whitespace check: passed; only existing line-ending warnings were reported.
- Production `prisma migrate status`: schema up to date.
- Production build: passed.
- Production PM2 process `aicloser-app`: online after restart.
- Production Super Admin seat-control build deployed successfully; Gigxomi processes remained online and untouched.
- Live Super Admin browser verification showed workspace names/admins, team-user counts, expiry date inputs, Activate/Suspend buttons, and `− / +` seat controls.
- Live `/api/super-admin/users` remains protected with HTTP `401` without the Super Admin session; live `/super-admin` redirects unauthenticated users to login.
- The AIcloser test workspace profile for `gigxomi@gmail.com` was restored to `ACTIVE`; its pending subscription remains pending and was not falsely marked paid.
- `https://app.aicloser.in/login`: HTTP 200.
- Public live signup page: opened successfully and shows AIcloser workspace fields, with no package catalog displayed.
- Unauthenticated WhatsApp, admin WhatsApp, and payment APIs return JSON `401` responses.
- Unauthenticated Instagram OAuth correctly redirects to the AIcloser login page instead of returning an HTML/JSON parse failure.

## Remaining live-test dependency

Private WhatsApp Embedded Signup and Instagram OAuth exchange require an authenticated AIcloser admin session. The production environment currently has no Instagram OAuth client secret and no WhatsApp Cloud API token configured; these secrets cannot be safely invented or bypassed. After the admin signs in and the server secrets are configured, the final UI test must cover: Meta WhatsApp signup, tenant-scoped lead/chat import, Instagram connect, payment proof review/approval, and dashboard status updates.

Gigxomi PM2 processes were not restarted or modified by this release.
