# UX bug log — live verification

## Opened during 2026-10-08 live verification

- **Login session conflict loses the entered password.** The old full-page form redirect rendered the conflict state with an empty password field, so “Login here” required the user to re-enter the password. The login form now submits through the JSON flow and keeps the password only in in-memory component state while the conflict is resolved.
- **User creation hides the actual server failure.** The roles panel falls back to `Unable to create user account.` when the live response is not JSON, which makes seat, validation, deployment, and server failures indistinguishable. Keep the response/status visible during the next live retry and add server-side structured error logging before production retest.
- **Post-call notification does not reliably open the disposition form.** Tapping “Complete call notes” returned to the launcher instead of the exact call form; the notification now targets the app activity explicitly.
- **Live dashboard state can look stale after mobile disposition.** The database had the updated name, stage, note, callback, and call summary, but the already-open dashboard needed a hard refresh before rendering them. Add a refresh/poll or cache invalidation after mobile call updates.
- **Disposition form needs keyboard-aware scrolling.** Lower note and callback fields are difficult to reach while the keyboard is open; the focused field should scroll into view before entry.
- **Playback controls differ by client.** The web card exposes 1x, 1.5x, 2x, and 3x while the mobile Calls screen currently exposes only 1x, 1.5x, and 2x; align the supported speed range or document the intentional difference.
- **Emulator dialer recording limitation.** Native dialer recording was unavailable under the current emulator locale, but the AI Closer recorder still uploaded an `UPLOADED` recording; keep this platform limitation visible in test evidence.
- **Incoming-call broadcast edge case fixed.** The emulator omitted the number in the broadcast and the screening service marked a session too early; the receiver now resolves the active number and creates the session only after it has a number.
- **Quick Paste parser could swap name and phone.** Numeric fragments in an email such as `qa.20261008@example.com` could win the old phone heuristic. The parser now detects email and phone-shaped columns separately and prefers the actual numeric phone column.
- **Call action can be blocked by an unfinished disposition — fixed.** The backend correctly prevents a second call until the previous call notes are submitted; the mobile lead card now shows the pending-note count and disables Call until the closer completes the notes from Calls.
- **Lead details opened as a full-screen form — fixed.** Clicking a Kanban lead used the drawer's `fullScreen` mode, hiding the board and making the lead feel detached from CRM. Lead details now open in the standard right-side drawer so the board context remains visible.

## Verification notes

- Never store passwords or session tokens in this log.
- Re-test the admin-created closer after deployment before continuing with emulator calls.
