# Live lead activity verification — 2026-10-10

## Verified

- Web production build completed successfully after the mobile disposition sync fix.
- PM2 process `aicloser-app` restarted and reported `online` on the live host.
- Live browser smoke-tested the Dashboard, CRM Pipeline & Kanban, Call Recordings & Missed Call History, Reports & Lead-IQ, and Live Multi-Channel Chat screens.
- Live chat shows one combined `Notes & Callback` action, with no duplicate note/callback controls.
- Mobile disposition now writes notes and callback time to the tenant-scoped linked `AppConversation` payload and emits a tenant realtime `lead.updated` event.
- Android release package is `com.gigxomi.crm`, version `1.0.15` (versionCode `15`).
- Both QA emulators are running the package and reach the login screen.
- Android unit tests, debug lint, release APK, and release AAB builds completed successfully.

## Commits

- `e451feb` — combine chat notes and callback action.
- `9db827d` — set Android release package to `com.gigxomi.crm`.
- `dbb02c7` — sync mobile call dispositions with chat leads.

## Release artifacts

- APK: `apps/crm-mobile/app/build/outputs/apk/release/app-release.apk`
- AAB: `apps/crm-mobile/app/build/outputs/bundle/release/app-release.aab`
- APK SHA-256: `91E563FC9FD707A615D5E690B2070B922701DE71BCE169630B6E9B1335CB53CB`
- AAB SHA-256: `762534B84616B76F0B098FF6B0D225F23A3B598C7EA45009776F03DFE61A66CD`

## Pending end-to-end gate

The live workspace still needs two UI-created QA users before the emulator call journey can run. The form is prepared, but the final `Create User Account` action requires explicit confirmation because it creates real live workspace accounts. Until that action is confirmed, the following remain unverified: separate mobile logins, connected and missed calls, call duration and recording playback, and cross-surface sync through chat, Kanban, call history, dashboard, mobile, and role-wise reports.

The full legacy contract suite currently reports 104 passing and 5 failures. Those failures are stale expectations for the dashboard redirect default, the old Android package ID, the removed hardcoded WhatsApp test number, and the intentionally removed CAPI status hook; they do not override the live smoke-test results above.
