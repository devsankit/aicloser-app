# UX bug log — live verification

## Opened during 2026-10-08 live verification

- **Login session conflict loses the entered password.** The old full-page form redirect rendered the conflict state with an empty password field, so “Login here” required the user to re-enter the password. The login form now submits through the JSON flow and keeps the password only in in-memory component state while the conflict is resolved.
- **User creation hides the actual server failure.** The roles panel falls back to `Unable to create user account.` when the live response is not JSON, which makes seat, validation, deployment, and server failures indistinguishable. Keep the response/status visible during the next live retry and add server-side structured error logging before production retest.

## Verification notes

- Never store passwords or session tokens in this log.
- Re-test the admin-created closer after deployment before continuing with emulator calls.
