# AI Closer tester run — Pixel install and smoke test

## Decision

**Diagnostic only; not recording qualification.** The Antigravity-active APK installed and launched on the connected Pixel. A real carrier recording test was not started because no consented test recipient/number was provided in this run.

## Scope and mode

- Mode: audit/test.
- Scope: install the newest APK from the active AI Closer worktree on the connected Pixel, launch it, inspect the main and Calls screens, and perform a process restart check.
- No app data was cleared. The existing failed sync was not retried so existing user data would not be mutated.

## Candidate identity

- Repository: `D:/AIcloser/application`
- Branch: `feature/telephony-sync-locked`
- Source HEAD: `8c40e956da787c7d9d37cf84692f9b5ed429d9a9`
- Working tree: dirty; existing changes preserved.
- APK: `apps/crm-mobile/app/build/outputs/apk/release/aicloser-1.0.19-release.apk`
- SHA-256: `3DDFB8235B3B2D570539D238B0CB02B9F94ADBDD93525EA4EA5CC9B3A6EC1195`
- Installed identity: package `com.gigxomi.crm`, version `1.0.19`, code `19`, target SDK `36`.
- Signing certificate SHA-256: `b6e8e8e87bd24cedc61271c162dbf8c5db297b183f560738014c900fb89f23e2`
- Backend configured in the mobile build: `https://app.aicloser.in/api`

## Device

- Alias: `pixel-9-primary`
- Model/manufacturer: Google Pixel 9
- Android/API: 17 / 37
- Dialer: Google Phone (`com.google.android.dialer`)
- Network: validated cellular connection observed
- Audio route at idle: earpiece
- Relevant permissions: microphone, call log, phone state/number, media audio, notifications and microphone foreground-service permission were granted at inspection time.
- Account/SIM/tenant: existing logged-in state present; exact SIM/number mapping was not revalidated for a call.

## Results

- `PASS_ASSISTED` — APK upgraded with `adb install -r`; install returned `Success` and preserved existing install data.
- `PASS_ASSISTED` — app launched to the AI Closer home screen; no onboarding loop or permission prompt appeared.
- `PASS_ASSISTED` — Calls screen opened and rendered existing sync state: 93 synced, 1 failed, recording queue clear. This is pre-existing state, not a new test call.
- `PASS_ASSISTED` — process restart returned to `MainActivity`; no app-specific fatal exception was found in the post-restart log scan.
- `NOT_TESTED` — controlled inbound/outbound call, source recording, matching, upload, audio quality and dashboard playback. First blocked layer: missing consented test recipient/number and current SIM mapping.

## Remaining blocker and next step

Provide or confirm a consented test call endpoint (for example, the operator's other test phone) and the Pixel's work-SIM mapping. Then run one controlled call with distinct phrases from both sides and trace call event, source media, matching, upload validation and dashboard playback.

