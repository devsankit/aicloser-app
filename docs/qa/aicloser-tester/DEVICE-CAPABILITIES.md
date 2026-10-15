# AI Closer device recording and sync context

This is the working inventory for device-specific call-recording behavior. It keeps exact-device evidence separate from assumptions about a manufacturer or dialer family. A device being listed here does **not** mean every route is supported or verified.

## How recording reaches AI Closer

1. **Recording source:** the phone dialer/OEM recorder creates a recording, if that dialer and region permit it. AI Closer cannot make a dialer create a recording when the dialer reports recording unavailable.
2. **Getting the file into AI Closer:** either the app imports a configured OEM recording folder (`OEM_FOLDER_IMPORT`), the user chooses AI Closer from the dialer's Android Share sheet (`GOOGLE_PHONE_SHARE_MANUAL` or equivalent), or an enabled Accessibility service attempts a predefined UI flow (`GOOGLE_PHONE_ACCESSIBILITY_AUTO`). These are different routes; success in one does not prove another works.
3. **Local import and call matching:** on a share intent, AI Closer copies the supplied audio into its private `shared-recordings` storage and tries to associate it with a call using an armed call context or available filename/time/duration/call metadata. Matching must be checked; a copied file alone does not prove it was linked to the right call.
4. **Upload and playback:** the app queues the imported file for upload; the backend accepts it and the Calls UI should show and play the recording. A green/local “ready” state is not proof of server upload or playback.

Accessibility is an attempted UI automation route, not a universal dialer API. It can be affected by Android/OEM UI changes, timing, lock state, dialer eligibility, and user-granted Accessibility access. It must not be described as trained or verified just because a user manually shared a file once. No route may bypass Android permissions or dialer/region restrictions.

## Status meanings

| Status | Meaning |
|---|---|
| `PASS_AUTOMATIC_VERIFIED` | A fresh end-to-end call test proves hands-free recording acquisition, correct call match, server upload, and playable audio. Record call direction and evidence. |
| `PASS_MANUAL_IMPORT` | User/system Share or folder import was used; file import, match, upload, and playback were verified. This does not qualify Accessibility automation. |
| `PASS_ASSISTED` | A human had to perform setup or a share action; state exactly which action and which pipeline stages passed. |
| `FAIL_APPLICATION` | The source recording existed and was accessible, but AI Closer failed import, matching, queue, upload, or playback. Name the failing stage. |
| `BLOCKED_SOURCE_OR_SETUP` | No usable source recording or required access was available, so downstream behavior could not be evaluated. |
| `NOT_TESTED` | No adequate device-specific evidence. |
| `UNSUPPORTED_PROVEN` | A reproducible platform/dialer limitation is documented for this exact configuration. Do not infer this from a failed test alone. |

## Device evidence inventory

| Device/configuration | OS / dialer | Recording and sync evidence | Current conclusion | Evidence / caveat |
|---|---|---|---|---|
| **Pixel 9** (`tokay`; local alias `pixel-9-primary`) | Android 17 / API 37; Google Phone (`com.google.android.dialer`); device rechecked 2026-10-15. AI Closer `com.gigxomi.crm`, version 1.0.22 / code 22 (debug). | **2026-10-15 manual route:** 18-second inbound call shared as 15.3-second audio and uploaded/matched; 7-second outbound call shared as 4.8-second audio and uploaded/matched. **Automation:** user subsequently reported the Accessibility flow stuck and selecting a recording from roughly 10 calls earlier; treat as a wrong-recording match, not a successful sync. | **Manual share:** PASS_ASSISTED for the two documented calls. **Accessibility auto:** FAIL_APPLICATION / DO NOT RELY ON; stale/wrong recording selection reported, and no safe fresh inbound+outbound automatic pass is documented. **Accessibility service:** enabled on the connected phone at audit time. **Mic fallback:** OFF, confirmed from app preferences; retain this Pixel-specific setting. | [`20261015-pixel9-inbound-outbound-share`](runs/20261015-pixel9-inbound-outbound-share/REPORT.md) plus the user's latest live report (automation stuck and selected an old recording; no audio/call identifiers retained). Android identity/version/package and enabled Accessibility were rechecked on-device on 2026-10-15. |
| **Pixel 9** (`pixel-9-primary`, earlier build) | Android 17 / API 37; Google Phone. | Install and UI smoke passed; no recording test in this run. | **NOT_TESTED for recording.** | [`20261011-161551-pixel-install-smoke`](runs/20261011-161551-pixel-install-smoke/REPORT.md); older catalog entry was AI Closer 1.0.19/code 19. |
| **Redmi 9** (reported model family; exact model/build must be captured per run) | Xiaomi/MIUI; Android version and active dialer must be recorded each time. User reported Xiaomi dialer and recording not appearing in the selected folder. | A later two-device reproduction reported mic-fallback audio as silent/too quiet; this does not prove OEM-folder import or manual dialer share succeeds. A code-side share/import fix did not by itself establish a device retest. | **OEM folder route: NOT_CONFIRMED. Manual share route: NOT_CONFIRMED. Mic fallback: failed usable-audio check in one run. Accessibility auto: NOT_TESTED.** | [`20261013-172857-accessibility-share-repro`](runs/20261013-172857-accessibility-share-repro/REPORT.md); re-identify exact Redmi model, ROM, dialer package/version, and recording source on next test. |
| **Redmi 6A** (reported test device) | Android 9 / MIUI; exact dialer version/build not captured in the referenced report. | One test imported an OEM MP3 recording and uploaded it; report gives a ~35.9-second file. | **One-run OEM folder/import/upload pass; not a current or broad Xiaomi qualification.** Accessibility auto and playback should be retested. | [`20261011-184338-two-user-cross-device`](runs/20261011-184338-two-user-cross-device/REPORT.md). |
| **POCO X2** (reported test device) | Android 11 / API 30; default dialer was reported as `com.android.contacts`; exact dialer identity/version should be re-captured. | Prior project notes mention faulty mic fallback; no adequate successful source-to-server recording evidence found for this exact configuration. | **NOT_TESTED / not qualified.** Do not assume it behaves like Pixel or another Xiaomi/POCO model. | [`docs/ai-closer-recording-stabilization-plan.md`](../../ai-closer-recording-stabilization-plan.md). |
| **Vivo 1718** (reported model string; exact commercial model uncertain) | OS and active dialer not captured. | No device-specific end-to-end evidence located. | **NOT_TESTED.** | Earlier stabilization notes only; identify the handset and dialer before testing. |
| **OPPO device** (user-reported Android 5; exact identity not confirmed) | OS report and handset identity are unverified. Android 5 is below the app's documented minimum API 26 if accurate. | No compatible-install or recording evidence. | **Compatibility/install status must be established first; recording NOT_TESTED.** | Earlier stabilization notes. Do not treat this as an OPPO-family result. |

### Pixel 9 microphone fallback policy

Keep mic fallback disabled for the Pixel 9 configuration. The user clarified that mic fallback ON does create a recording file, but that file has no audible audio (blank/silent). Therefore file creation or upload alone must not be counted as successful capture. This is a device-specific operational safeguard; the reported cause still needs a controlled A/B verification. Any future change to this policy requires a test that checks audible content, correct call matching, upload, and playback.

### Pixel 9 locked operational profile (2026-10-15)

This is the current exact-device baseline to reuse on the next Pixel 9 test; it locks the **known settings and evidence**, not the handset or its Android settings. Do not widen this result to every Google Phone device.

| Profile field | Locked value |
|---|---|
| Match key | Google / Pixel 9 (`tokay`) / Android 17 (API 37) / `com.google.android.dialer` |
| AI Closer build observed | `com.gigxomi.crm`, 1.0.22 (22), debug |
| Verified route | Google Phone recording → explicit Share to AI Closer → call match → upload; inbound and outbound each passed once in the report above |
| Automatic Accessibility route | **Not qualified; currently unsafe to rely on.** Latest user observation: flow stuck and chose an old call's recording. Do not mark the call recorded/uploaded unless the audio is tied to the exact fresh call. |
| Accessibility setting | Service enabled on the connected Pixel 9 at audit time; this is a point-in-time setting, not proof of a successful automation run |
| Mic fallback | **OFF** (confirmed in `gxclosers_calls.xml` on the connected device at audit time); do not turn on for this Pixel profile absent an audible-content test |
| Safety rule | Match a single recent call row by exact identity, direction, and time; only tap that row's recording share action. On ambiguity, stale row, missing/contradictory timestamp or duration, or timeout: stop without sharing/attaching anything and leave the recording unresolved. Never fall back to “latest/first recording.” |
| Requalification gate | Fresh inbound and outbound calls, with no manual dialer interaction; each must share the recording for that exact call, match the right call ID, upload, and play audible content. Capture redacted evidence and repeat before changing status to automatic PASS. |

The app's backend profile model has a Pixel/Google Phone manual-share profile, but it has no fields for evidence status or the Pixel mic-fallback policy. This catalog is the current source of the stricter qualification result; do not interpret the generic server guide as proof of automatic Accessibility compatibility.

## Manufacturer/dialer candidates — not device test results

Samsung, Xiaomi/Redmi/POCO, Vivo/iQOO, OPPO/realme, OnePlus, Motorola, and non-Pixel phones using Google Phone are **candidate families only** until an exact handset + OS + dialer configuration has a recorded test. OEM recording-folder names and dialer behavior vary by model, software build, region, and user settings. “Google Phone” alone does not guarantee that call recording is enabled or available.

## Next-device test record template

Add a new row for every materially different configuration; do not overwrite an older result when Android, firmware, dialer, app build, region, or route changes.

| Field | Capture |
|---|---|
| Test date and evidence run | Timestamp and report path; redact phone numbers, account IDs, serials, and contact names. |
| Device identity | Manufacturer, exact model/product code, Android version/API, build fingerprint or build number, security patch. Omit serial/IMEI. |
| Dialer identity | Default dialer package and app version; identify OEM vs Google Phone. Record region/carrier only when relevant. |
| AI Closer build | Version name/code and build type. |
| Test case | Inbound or outbound, answered/missed, approximate duration, and whether the source dialer actually created a playable recording. Never store the phone number in this catalog. |
| Route and user action | `OEM_FOLDER_IMPORT`, `GOOGLE_PHONE_SHARE_MANUAL`, `GOOGLE_PHONE_ACCESSIBILITY_AUTO`, `MIC_FALLBACK`, or `UNKNOWN`; note every human action and required permission. |
| Pipeline checkpoints | Source file exists/readable → imported locally → matched to correct call → queued → backend upload accepted → playable in app. Mark each separately. |
| Result | Use the status definitions above; include failure stage and concise, redacted log/error evidence. |
| Repeatability | Repeat at least inbound and outbound where applicable; record each attempt, not just the best result. Automatic qualification requires no manual share action during the test. |

Only retain the minimum diagnostic evidence needed. Do not collect full screen recordings, Accessibility node-tree dumps, call audio, phone numbers, or account credentials in this inventory. Store audio only in the approved test flow with consent and access controls.

## Existing run reports

- [`20261013-call-recording-fix`](runs/20261013-call-recording-fix/REPORT.md) — code/build-side change; report did not establish physical-device retest.
- [`20261013-google-dialer-share-route`](runs/20261013-google-dialer-share-route/REPORT.md) — Pixel Google Phone recording availability blocked during that run.
- [`20261015-pixel9-inbound-outbound-share`](runs/20261015-pixel9-inbound-outbound-share/REPORT.md) — manual inbound/outbound share-to-upload verified; Home-tab fix installed, but the later live user report found the automatic flow stuck and selecting an old recording, so Accessibility remains unqualified.
- [`20261013-172857-accessibility-share-repro`](runs/20261013-172857-accessibility-share-repro/REPORT.md) — manual share/import observations and separate short-call/fallback reproduction.
- [`20261011-184338-two-user-cross-device`](runs/20261011-184338-two-user-cross-device/REPORT.md) — Redmi 6A folder/import result and Pixel cross-device observations.
