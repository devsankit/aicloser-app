# Meta and Excel verification progress — 2026-10-08

## Released

- `34442bf`: Excel imports return a batch identity and exact created queue IDs. The contacts hub retains this selection across refresh. Empty round-robin distribution now returns `DISTRIBUTION_SELECTION_REQUIRED` instead of distributing all contacts or queued leads.
- `e3e275c`: correct the stale mobile API host assertion to `app.aicloser.in`.
- Both commits pushed to GitHub and deployed to `/var/www/aicloser-app`. Remote suite: 58 passed, zero failed. Production build succeeded; PM2 reload succeeded. Local and public login health checks returned HTTP 200.
- No blog files changed by these releases.

## Local implementation, not released or end-to-end verified

- WhatsApp setup endpoints: state, finalize signup, refresh/reconnect, phone registration, webhook subscription.
- Tenant authorization, token redaction, dedicated Instagram credentials, setup UI visibility, corrected redirect URLs.
- Encrypted Meta snapshot credentials and explicit durable connection writes, plus channel persistence.
- Signed Instagram ingestion; canonical WhatsApp webhook signature enforcement and awaited persistence.
- Mobile playback includes 3x in source; APK build and device verification not performed in this continuation.
- Latest local suite: 59 passed, zero failed. Final type checking passed including snapshot/transaction edits. An earlier local production build passed, but does not validate all subsequent edits; rerun before releasing Meta.

## Bugs and remaining verification

1. **Distribution safety — released.** No selection previously meant all contacts/unassigned leads. Exact queue IDs now constrain the import flow. Real browser file-picker upload and assignment comparison still need verification.
2. **Missing Meta routes — implemented locally.** Live setup still lacks the new routes until the Meta release is completed.
3. **Wrong Meta identity — local fix.** Existing server app IDs reference Gigxomi rather than AiCloser. Do not replace an existing live connection blindly.
4. **Credential leakage — local fix.** Logs and setup responses previously included raw token/code fields. New diagnostics redact them; connection UI uses `hasAccessToken`.
5. **Durability — local fix, needs restart test.** Explicit Meta connection updates were file-backed rather than durable integration records.
6. **Webhook security — local fix, needs integration tests.** Missing signatures previously bypassed validation. Unknown WhatsApp channels could use a default tenant.
7. **Instagram setup hidden for workspace admins — local fix.** Admin dashboard previously used the read-only sales variant and invalid callback origins derived from tenant IDs.
8. **Login conflict — observed.** Live UI preserved the password and offered “Login here” for an existing desktop session. After selecting it, a subsequent page inspection showed the authenticated admin dashboard. Browser inspection timed out during the heavy dashboard transition; do not claim broad performance verification.
9. **Live import UI — incomplete.** Authenticated browser interaction timed out while opening import navigation. No new browser-file import was committed during this continuation.
10. **Remaining approved scope.** WhatsApp OAuth fallback, proper token refresh/reconnect UX, Instagram deauthorization/data deletion callbacks, Meta popup completion and DM ingestion, full recording/disposition regression, focused-field keyboard behavior, dashboard refresh behavior and structured user-creation error checks remain to complete or verify.

## Meta preflight and blocker

- Main AiCloser app ID: `1385995129001581`.
- Embedded Signup Builder showed configuration `899249879744989`, v4, session info version 3.
- Previously observed dedicated Instagram app ID: `944586574731678`; reverify before configuring.
- App mode was not changed. Accessibility reports both Development text and a Live switch; verify visually before describing current mode conclusively.
- Server dotenv preflight found signup configuration, dedicated Instagram credentials and connected-platform encryption key missing. Existing WhatsApp token-encryption secret is configured. Runtime PM2-only overrides were not fully audited.
- Meta Basic settings opens a **“Please re-enter your password”** dialog before revealing the app secret. User must complete Facebook account re-verification in the existing Meta browser tab. Do not collect the Facebook password in a report or guess it.
- User authorized handling configuration, but no usable AiCloser/Instagram secrets were obtained. Secrets must be transferred through protected deployment configuration, not committed or printed in test evidence.

## Resume point

After Meta re-verification, securely configure dedicated credentials; finish the missing callback flows; rerun type-check/build and security/tenant tests; deploy Meta separately. Then perform actual browser-file upload and compare only the QA batch assignments, followed by web/mobile sync verification. Do not mark these end-to-end tests passed from source-contract tests alone.
