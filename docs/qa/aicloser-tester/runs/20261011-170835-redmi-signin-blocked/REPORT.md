# AI Closer tester run — Redmi 5G sign-in and call preparation

## Decision

**Blocked before sign-in; no call or recording result claimed.** The target Redmi 5G is connected and has Jio 4G service, but Xiaomi rejects automated touch/text injection with `INJECT_EVENTS`. The local native-window control surface is unavailable, so I did not bypass the phone security setting. No phone setting, app data, APK or existing record was changed.

## Scope and mode

- Mode: audit/test.
- Scope: identify the Redmi 5G, verify the installed candidate, open AI Closer, and prepare the supplied sign-in/permission/call test.
- The supplied credentials and test endpoint were not entered or transmitted because all input attempts were rejected before reaching the fields.
- No call was placed.

## Candidate identity

- Repository: `D:/AIcloser/application`
- Branch: `feature/telephony-sync-locked`
- Source HEAD: `8c40e956da787c7d9d37cf84692f9b5ed429d9a9`
- Working tree: dirty; preserved.
- Installed package: `com.gigxomi.crm`, version `1.0.21`, code `21`, target SDK `36`.
- Installed APK SHA-256: `b1f90982f0ac925aaf92abf724263b9019c64ab52fcd00269a306af88a328c8c`
- Local latest release candidate: `aicloser-1.0.22-release.apk`, SHA-256 `8D950B6609EF037520D57C6908AD5803209D5B19E4CFD553CA51A1D0B66D4D41`.
- Candidate mismatch: local `1.0.22` was not installed because the request prohibited phone changes.
- Backend configured by the mobile build: `https://app.aicloser.in/api`.

## Device preflight

- Alias: `redmi-5g-primary`
- Model/manufacturer: Xiaomi `2311DRN14I`
- Product: `gale`
- Android/API: 15 / 35
- Firmware: `OS2.0.208.0.VGPINXM`
- Default dialer: `com.android.contacts`
- Network/SIM: Jio 4G, LTE voice/data registered; validated cellular network observed.
- AI Closer permissions before setup: notification, call log, phone state/number, media audio and microphone were all not granted.
- Initial screen was Developer options; it was not modified. AI Closer was then opened normally and showed the sign-in screen.

## Results

- `PASS_ASSISTED` — correct Redmi 5G identified; Redmi 6A was excluded.
- `PASS_ASSISTED` — installed package and version/hash collected without reinstalling.
- `PASS_ASSISTED` — AI Closer opened to the sign-in screen and showed secure connection to `app.aicloser.in`.
- `BLOCKED_SETUP_OR_HARDWARE` — Redmi rejected all ADB tap/text events with `SecurityException: Injecting input events requires ... INJECT_EVENTS`.
- `NOT_TESTED` — sign-in, permission prompts, SIM selection, call, Xiaomi recording file generation, importer matching, upload, dashboard playback and runtime call errors.

## Exact blocker and next step

A human must operate the Redmi screen to enter the supplied credentials, approve the listed app permissions and select Jio 4G. After that, the test can continue without changing phone settings: place one consented call for 6–10 seconds, hang up, and tell me when it ends so I can collect the call log, Xiaomi recording directory, importer logs and upload/dashboard evidence.

