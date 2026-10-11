# AI Closer: device-aware call recording stabilization plan

Prepared: 11 October 2026 (Asia/Kolkata). Status: research and proposed implementation plan, NOT a completed implementation or recording certification.

Review revision: 1.1, 11 October 2026. The complete plan was reread against the user's clarification: repeated calls mean a diagnose–fix–retest loop, not a numerical finish line. This review updates documentation only. The source/device findings below remain the earlier audit snapshot; no new code audit, device connection check or audio test is implied by this review.

## Customer-facing summary of the second review

Tumhara final result: customer app install kare, simple setup kare, normal call kare, aur correct recording correct user ke web dashboard par automatically aaye aur play ho.

- 10–10 calls ek minimum check hain, finish line nahi. Failure mile toh cause fix, wahi case retest, aur pehle se working phones bhi dobara check.
- Customer ko jo exact APK deni hai, usi par final tests honge. Purani builds ke passes jodkar final pass nahi banega.
- Cable/debugger ke bina, lock screen, internet off/on, next-day use aur jaldi-jaldi calls bhi test honge.
- Customer ko har call ke baad Share dabana ya app kholna pade, toh use fully automatic success nahi kahenge.
- Ek phone fix karne se doosra bigde toh release rukegi. Existing working support preserve rahega.
- Recording missing ho toh reason aur recovery dikhe; purani recording, silent file ya endless Processing se problem hide nahi hogi.
- Call Manager se same-device comparison hoga. Apni success ka proof actual audio aur customer experience hoga, assumptions nahi.
- Abhi sirf plan review complete hai. Implementation aur release approval alag stages hain.

The stricter acceptance rules in section 14 supplement the original plan. Where wording conflicts, the revised phase table and section 14 take precedence.

## 1. Decision in plain language

Humein har client ke liye alag APK nahi banani. Ek maintained application, common recording pipeline aur device/dialer-specific adapters chahiye. Jo Pixel/Vivo/POCO flow sach mein working hai, use preserve karke coverage badhani hai. Accessibility ko blindly remove nahi karna; jahan approved direct file access works, wahan screen automation ki zaroorat kam karni hai.

Success ka matlab sirf call entry, audio file, green tick ya successful upload nahi hai. Correct call ki original, usable recording correct agent ke dashboard par play honi chahiye. Unsupported device ko successful test count nahi karna. Silent, old, ambiguous ya incomplete audio ko clearly flag karna hai.

This plan consolidates the conversation's requirements, targeted current-source inspection, reference APK evidence, connected-device checks, and current primary-source research. It does not claim that every line of every reference project was audited or that their device claims have been independently reproduced.

### Non-negotiable requirements

- Normal carrier/SIM calls, including calls made from the phone's ordinary dialer, not only AI Closer's button.
- Incoming and outgoing calls on the selected work SIM. Personal SIM recordings must not be collected accidentally.
- Two enrolled agents calling each other produce two agent-owned call records: one outbound and one inbound. Each endpoint's recording is verified independently.
- Foreground, minimized, locked, process restart, offline recovery and supported reboot scenarios have explicit tests.
- Adding support for a new device must not silently remove existing providers or change another device's selected method.
- Setup should be short, understandable and verified. A click on Settings is not proof that a permission or recording capability works.
- Dashboard updates automatically without aggressive per-browser database polling.
- No irreversible deletion before verified receipt, no stale audio substitution, no endless Share loops.
- No promise of universal two-sided audio or zero failures without evidence. Even event collection can be interrupted by force-stop, revoked permissions or an unavailable OS interface.
- No implementation, deployment, new call tests or phone-setting changes as part of this plan-only request.

## 2. Evidence baseline and current devices

Local source: `D:/AIcloser/application`, HEAD `8c40e956da787c7d9d37cf84692f9b5ed429d9a9`. The working tree has substantial existing mobile/backend/dashboard changes. HEAD alone does not identify the inspected working-tree contents. Preserve all existing work; do not reset it.

| Item | Read-only observation | What it does NOT establish |
|---|---|---|
| Current mobile source | `com.gigxomi.crm`, version 1.0.17/code 17, minSdk 26, targetSdk 36 | Source and installed binaries have not been proven identical |
| Pixel 9 | Android 17/API 37, Google Phone; installed AI Closer 1.0.17/code 17 | No new audio pass in this research session |
| POCO X2 | Android 11/API 30; default dialer reported `com.android.contacts`; AI Closer 1.0.17/code 17 | Its user-reported faulty microphone prevents an ordinary two-sided certification |
| Vivo | Windows sees `vivo 1718 (Unlock the phone to manage files.)`; not present in the latest ADB device list | Android version, current APK, dialer and usable debugging connection remain unverified |
| OPPO | User reports Android 5; not available in the current ADB inventory | Confirm actual Android/API, not ColorOS version; exact model and capabilities unknown |
| Reference Call Manager | `com.mis.callmanager`, 1.0.26, minSdk 26/Android 8, targetSdk 35 | It is NOT evidence of Android 5 compatibility or universal capture |

SIMs were moved repeatedly during the conversation. Before any later call test, verify device/account/SIM/phone-number mapping again. Do not reuse historical mappings blindly.

Artifact fingerprints, for later reproducibility:

- Reference APKS: `C:/Users/hello/Downloads/Call-Manager_1.0.26_apkcube.apks`; SHA-256 `05DBDD38BCF792AE2D754154AE1252C18657EAF63671499F8946886A1C0E2058`.
- Extracted reference base APK: SHA-256 `F3952E67CDBF719504B7195F14A5B735F04A9D4D81BB7FC48CA3350997FFEFDC`.
- Local release APK: `D:/AIcloser/application/apps/crm-mobile/app/build/outputs/apk/release/app-release.apk`; SHA-256 `B84FDCD90A9E195C8E75525D846DCFFE64AA188D3397368082635D3EAF0B6C70`.
- Before certification, collect installed APK hashes, signing-certificate identity, build manifest and backend release identity. Matching version names alone are insufficient.

## 3. Support boundary: Android version, brand AND actual capability

### 3.1 Old-phone strategy

The current AI Closer APK and supplied Call Manager APK both exclude Android 5, 6 and 7 at installation because their minimum is Android 8. Our app cannot cover those phones by changing onboarding text.

As checked on 11 October 2026, WhatsApp's official supported-OS page lists Android 6.0 and newer. Its localized notice dates the Android 5 retirement to 8 September 2026. This provides a useful market baseline, not a call-recording capability guarantee. WhatsApp Business compatibility must additionally be checked for `com.whatsapp.w4b` on each intended device; an old installed version is not proof of current vendor support. [WhatsApp supported OS](https://faq.whatsapp.com/1150261202542208), [dated support notice](https://faq.whatsapp.com/2366980643469578/?cms_platform=android&locale=ar_AR), [Business listing](https://play.google.com/store/apps/details?id=com.whatsapp.w4b).

Recommended product target: extend the main application toward Android 6/API 23 and newer, subject to an explicit compatibility gate. Keep Android 5/API 21–22 as a separate feasibility investigation, not an untested support badge or an automatic exclusion of the user's OPPO.

For Android 6–7, audit all dependencies and platform calls, enable appropriate core-library desugaring for existing `java.time` usage, guard newer services/APIs, and test authentication, TLS, media decoding, database recovery and background behavior on real low-memory phones. The current build does not declare core-library desugaring. Lowering one number is not the solution. [Android desugaring guidance](https://developer.android.com/studio/write/java8-support).

Android 5 needs additional work: current Lifecycle 2.10 and several modern AndroidX lines require API 23. Do not force manifest overrides to hide this. First verify whether the OPPO is truly Android 5. If it is, assess a compatible dependency/UI implementation with shared business logic versus a maintained legacy variant. A separate OS-compatibility variant, if eventually approved, is not a separate APK per brand/client. Do not downgrade modern dependencies across the whole app merely to claim an unsupported install. [Lifecycle 2.10 release notes](https://developer.android.com/jetpack/androidx/releases/lifecycle#2.10.0), [AndroidX minimum-SDK guidance](https://developer.android.com/jetpack/androidx/versions).

Legacy feasibility exit: successful install, login, normal-dialer call detection, recording acquisition, matching, upload/playback, permission recovery and acceptable memory/battery behavior on the actual OPPO. Report recording support separately from installation support. Assess the security/support cost of obsolete firmware before business approval.

### 3.2 Android compatibility matrix

| Android/API | Main test focus | Release treatment |
|---|---|---|
| 5.0–5.1 / 21–22 | Legacy dependencies, API availability, storage, TLS/auth, low RAM, actual OEM recording | Feasibility only until proven; current APK cannot install |
| 6–7.1 / 23–25 | Runtime permissions, Doze, legacy file access, old WebView/auth, guarded Telecom APIs | Planned expansion of main build after compatibility gate |
| 8–8.1 / 26–27 | Background execution, notification channels, older OEM recorders | Existing installation floor; still requires recording qualification |
| 9 / 28 | Audio-source behavior, background mic restrictions, OEM differences | Own capture and route tests; not grouped with Android 8 |
| 10 / 29 | Audio-input sharing, scoped-storage behavior, OEM recording export | Prefer verified native recording/import; microphone is diagnostic only |
| 11 / 30 | SAF restrictions, permission recovery, shell-capture lock behavior | POCO baseline; do not treat Android 12 results as proof |
| 12–12L / 31–32 | Background service starts, mic contention, permission revocation | Background/lock/startup tests for each provider |
| 13 / 33 | Media audio and notification permissions, restricted settings | Minimal permission onboarding and denial recovery |
| 14 / 34 | Service types and while-in-use microphone checks | Correct lifecycle/type; no fake persistent microphone service |
| 15 / 35 | Target-specific boot/service limits, stopped-state recovery, native compatibility | Distinguish OS behavior from targetSdk behavior |
| 16 / 36 | Job quotas including foreground-started jobs, upload recovery | Batch work and test backoff under quota pressure |
| 17 / 37 | Background playback/focus/volume hardening; new protected concurrent-capture permission | Required now: connected Pixel is already API 37 |

Maintain OS version and targetSdk as separate test dimensions. Android 17 background playback restrictions can affect older-target apps too; this is not proof that those restrictions caused the previously silent recording. The new `BYPASS_CONCURRENT_RECORD_AUDIO_RESTRICTION` is not an ordinary user permission: the connected Pixel reports `signature|privileged`. We did not grant or change it. It is not a public universal-recording shortcut. [Android 17 changes](https://developer.android.com/about/versions/17/summary), [background audio hardening](https://developer.android.com/about/versions/17/changes/bg-audio).

Further platform references: [FGS start restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start), [Android 15 FGS changes](https://developer.android.com/about/versions/15/changes/foreground-service-types), [FGS/version changes](https://developer.android.com/develop/background-work/services/fgs/changes), [Android 15 stopped state](https://developer.android.com/about/versions/15/behavior-changes-all).

### 3.3 Brand/dialer coverage plan

Brand is an onboarding hint, NOT a recording engine selection rule. The same brand can ship different dialers, ROMs, regions and carrier configurations.

| Device family | Adapter and setup plan | Mandatory distinguishing tests |
|---|---|---|
| Google Pixel | Google Phone recording availability; approved Share/export; readable folder only if actually exposed | Dialer version, recording enabled for tested numbers, newest recording identity, screen locked/unlocked, Android 17 playback |
| Xiaomi / Redmi / POCO | Detect OEM/MIUI dialer versus Google Phone; probe approved folder/MediaStore before Share fallback | MIUI/HyperOS version, private versus shared storage, battery/autostart behavior, default dialer changes |
| Vivo / iQOO | Detect current OEM or Google dialer; discover actual export route; versioned setup guidance | Funtouch/OriginOS and Android separately, app-clear behavior, recording finalize delay, reboot and folder grants |
| OPPO / realme | Detect OEM dialer/Google Phone/compatible ODialer if already available; never presume ODialer installation support | Old Android versus ColorOS label, recording source, lock/background behavior, permission return |
| OnePlus | Separate explicit family profile; detect actual dialer instead of assuming OPPO behavior | OxygenOS/region differences, Google-versus-OEM export, headset and Wi-Fi calling |
| Samsung | Samsung Phone versus another dialer; native recording/export only if offered | Region/carrier availability, One UI, folder access, codecs, Bluetooth route |
| Motorola / Nokia / Nothing / Android One | Dialer-led discovery, often Google Phone but not hard-coded | Recording availability, Share route, background restrictions, update invalidation |
| Honor / Huawei | Separate profiles; do not make core syncing depend on Google services | Dialer/firmware variant, authentication fallback, locked-screen behavior, battery management |
| Tecno / Infinix / itel / Lava and other budget phones | Generic capability probe plus verified OEM adapters as devices become available | Android Go/low RAM, 32-bit ABI, slow storage, missing settings intents, regional dialers |
| Unknown devices | Safe generic discovery, verified test or clear manual/unsupported mode | No guessed folder, guessed permission or guessed two-sided badge |

Candidate folder names are suggestions, not guarantees. Xiaomi's own documentation describes model/region/carrier variation and differing recording paths. Samsung documents region/model-dependent recording. [Xiaomi call-recording storage](https://www.mi.com/uk/support/faq/details/KA-541461/), [Xiaomi storage-path differences](https://www.mi.com/sg/support/article/KA-07847/), [Samsung recording support](https://www.samsung.com/us/support/answer/ANS10004613/).

Coverage sequence: current Pixel/POCO/Vivo → actual old OPPO and Android 6–7 device → Samsung and realme/OnePlus → Redmi/modern HyperOS → budget Android Go and remaining families. This is a qualification order, not a claim that untested brands are supported. Prioritize further purchases/borrowed devices using real customer model counts.

## 4. Reference research: what to adopt, what not to assume

| Reference | Useful lesson for AI Closer | Important limitation / decision |
|---|---|---|
| Supplied MIS Call Manager APK | Multiple capture/import paths, diagnostics, recording settings, call matching, cloud workflow; DEX index includes native audio and WhatsApp-recorder classes | Static symbols/libraries do not prove successful two-sided recording or the order of runtime fallbacks. Its Android 8 minimum excludes the reported Android 5 OPPO. Proprietary code/binaries are not to be copied |
| BCR | Recording metadata, capture diagnostics, lifecycle and direct-boot design | Root/system environment differs from public APK. Reference architecture, optional managed-fleet evaluation; GPL compliance review before reuse. [BCR](https://github.com/chenxiaolong/BCR) |
| ShizuCallRecorder | Centralized recording decision logic and shell-assisted capture | Its docs describe hidden APIs, limited Android 11/locked-screen behavior and uncertain Android 17 support. Carrier recording does not prove WhatsApp recording. GPL-3.0. [Project](https://github.com/kitsumed/ShizuCallRecorder) |
| JemRec | Separate capture daemon from UI, authenticated local communication, collect completed files, path-specific self-test | Extra debugging setup and OEM-dependent results. Apache-2.0 with third-party notices; its ADB dependency explicitly lacks a security audit. Evaluate, do not blindly ship. [Project](https://github.com/jemcik/JemRec), [notices](https://github.com/jemcik/JemRec/blob/eb063f2b631dc8a141381bb91710ac2850d5f82b/NOTICE.md) |
| skvalex | Access-mode setup, recovery, model/version-specific bug history | Proprietary implementation; release notes are behavioral evidence, not transferable source or a universal guarantee. [Releases](https://github.com/skvalex/callrecorder/releases) |
| axet recorder | Source/encoder selection and explicit unsupported-device behavior | Device-dependent legacy/system paths; GPL review required. [Project](https://gitlab.com/axet/android-call-recorder) |
| ACR Phone Helper — additional research | Built-in Shizuku can reduce the number of companion setup steps; useful benchmark for assisted setup | Vendor claims, not our test results. Requires elevated/debugging setup; reboot recovery and Wi-Fi-calling limitations remain. Not the default minimal-settings public UX. [Vendor documentation](https://acr.app/) |
| scrcpy | Independent shell-side audio diagnostic reference | Desktop/debugging success does not prove ordinary APK capture. Audio mirroring should be OFF during baseline capture tests to avoid changing the audio environment. [Audio documentation](https://github.com/Genymobile/scrcpy/blob/master/doc/audio.md) |

Research snapshots: BCR `4d835b073962f9b0ae35d254612c1ba6f8b9608f`; ShizuCallRecorder `41d1dc7be09ec4d1ca648ff62d9cf1aff6e0cd8a`; JemRec `eb063f2b631dc8a141381bb91710ac2850d5f82b`. Revalidate before adopting dependencies.

Corrections to earlier assumptions:

- A native `.so`, a newer language, AI, a custom dialer or an Accessibility grant does not itself create privileged access to carrier audio. Android separates microphone access from voice-call stream capture. [Audio sharing](https://developer.android.com/media/platform/sharing-audio-input), [audio-source permissions](https://developer.android.com/reference/android/media/MediaRecorder.AudioSource).
- MediaProjection/AudioPlaybackCapture is not a general SIM or WhatsApp capture bypass; permitted playback usages and source-app capture policies apply. [Playback capture](https://developer.android.com/media/platform/av-capture).
- MDM/company ownership alone does not grant system-signed audio permissions. A managed-fleet solution still needs a proven OEM/system or explicitly enabled elevated capability.
- No evidence establishes that every MIS threat is solved. A same-device, same-call-route black-box comparison is required.
- The reference APK audit reported an embedded third-party credential. Do not use, reproduce or ship it. Any responsible owner notification is separate from this plan; it is not our credential to rotate.
- Device auto-detection, SSE and an upload queue already exist in our source. The task is to make them trustworthy, not claim they are entirely absent.

## 5. Confirmed code observations and prioritized repairs

Evidence labels: **C** = directly observed source/configuration; **R** = risk inferred from that code, requiring a reproducing test; **U** = user-reported runtime symptom, not reproduced in this plan session. File links refer to the inspected local working tree and may move during implementation.

| Priority / issue | Evidence | Proposed repair and required proof |
|---|---|---|
| P0 — old audio can be rebound | C: `CallAudioRecorder.stop()` can return a global pending file when no recorder exists; `PhoneStateReceiver` can bind an unprepared pending recording to the current call. R: stale attachment route. U: old audio attached to a new incoming call | Session-bound files only; immutable source identity; ambiguous files quarantined. Reproduce with old pending audio, same number and consecutive calls. [Recorder](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/call/CallAudioRecorder.kt:103), [receiver](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/call/PhoneStateReceiver.kt:106) |
| P0 — latest call row is not necessarily this call | C: latest-call-log helper returns the newest candidate; end handling uses it for number/duration. R: delayed rows, overlapping or fast successive calls can mismatch | Reconcile a bounded candidate set against session, direction, SIM and time evidence; do not select newest blindly. [Call-log lookup](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/call/PhoneStateReceiver.kt:544) |
| P0 — uploaded is treated as validated | C: server stores `UPLOADED` with null checksum after size/MIME handling; mobile displays Ready to play from upload state. U: silent audio called available | Server-side decode/integrity/quality result; separate transfer, match and audio quality. No green audio badge from HTTP success. [Server recording store](D:/AIcloser/application/src/lib/gigxomi/sales-mobile-store.ts:441), [mobile label](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/ui/App.kt:2109) |
| P0 — local recovery copy deleted too early | C: worker marks uploaded and deletes local file on API success | Delete only after durable server checksum/validation acknowledgment and defined retention policy. Test server crash, corrupt response, lost acknowledgment. [Worker](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/data/RecordingUploadWorker.kt:44) |
| P0 — late events can change recording status | C: end-call path accepts recording status without a demonstrated monotonic/versioned merge | Versioned merge rules; late metadata may enrich a session but cannot unselect or downgrade valid audio. Test upload-before-end and duplicated callbacks. [End-call handling](D:/AIcloser/application/src/lib/gigxomi/sales-mobile-store.ts:281) |
| P0 — tenant/agent notification filtering | C: realtime audience OR conditions can broaden delivery when one audience list is empty | Define explicit unrestricted versus restricted event scope; truth-table tests for tenant, user and role. Preserve and extend existing ownership checks. [Realtime route](D:/AIcloser/application/src/app/api/sales/realtime/route.ts:36) |
| P1 — incomplete media compatibility | C: mobile importer supports extensions including AMR/OGG/Opus while server MIME allowlist lacks corresponding types | Safely sniff actual container/codec, normalize MIME, bounded decoder tests, browser-compatible derivative where needed. Never merely trust an extension. [Upload validation](D:/AIcloser/application/src/lib/gigxomi/sales-mobile-store.ts:480) |
| P1 — matching is score-based without enough identity | C: importer boosts phone match and chooses from preferred sources; modified-time handling differs between paths | Common candidate model, normalized seconds/milliseconds, confidence plus ambiguity check, call-bound consumed-source ledger. [Importer](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/call/SystemCallRecordingImporter.kt:51) |
| P1 — queue race/account scope | C: snapshot processing and one KEEP work name; current session supplies auth. R: enqueue-at-exit lost wakeup or wrong-account retry | Durable account/device-scoped queue, transactional leases, drain-until-idle handshake; freeze queue on logout. Tests must establish whether races occur. [Upload scheduling](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/data/RecordingUploadWorker.kt:77) |
| P1 — import retries can end without useful result | C: bounded attempts can end as worker success even without a recording | Explicit failure reason, bounded retry deadline, user recovery action, separately handle late file discovery. [Import worker](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/data/SystemRecordingImportWorker.kt) |
| P1 — share ingestion and automation | C: manifest advertises SEND_MULTIPLE; store handles SEND and one pending file. U: share-card opening/closing loop | Queue each granted URI, copy safely before temporary grant expires, bounded deterministic automation, new-call/user-interaction cancellation. [Share store](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/data/SharedRecordingStore.kt:33) |
| P1 — battery/service model | C: call monitor polls at 750 ms and declares microphone FGS even for monitoring | Event-driven detection plus measured bounded reconciliation. Do not remove an OEM-required detector before proving its replacement. [Monitor](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/call/CallStateMonitorService.kt:156) |
| P1 — SSE still polls DB per connection | C: each connection has a 2.5-second polling timer; browser has reconnect fallback. R: overlapping polls and cancellation cleanup gaps | Shared backend fanout over durable outbox, bounded reconciliation, correct teardown and replay. [Route](D:/AIcloser/application/src/app/api/sales/realtime/route.ts:47) |
| P1 — onboarding completion is not a self-test | C: manufacturer text profiles exist, but opening settings/mic flags can permit completion | Capability-based steps, actual state checks and a real test recording before verified status. [Profile and setup](D:/AIcloser/application/apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/ui/App.kt:108) |
| P1 — old OS excluded | C: minSdk 26, modern API usage and dependency minimums | Android 6–7 compatibility work; Android 5 feasibility as described above. [Build configuration](D:/AIcloser/application/apps/crm-mobile/app/build.gradle.kts:15) |
| P1 — credentials/build hygiene | C: signing credentials are hard-coded in build configuration | Move secrets to secure build inputs; assess key exposure and Play upload/app-signing continuity before any rotation. Never randomly re-sign an installed app |
| P2 — misleading media visualization | C: dashboard substitutes generated sine-wave data when decode fails | Use real analyzed waveform, loading placeholder or explicit decode failure, not a fake waveform that suggests valid speech. [Player](D:/AIcloser/application/src/components/sales/sales-dashboard.tsx:606) |
| P1 — behavior tests are insufficient | C: existing contract tests include source-pattern assertions; mobile coverage is limited | Executable state, queue, media and API integration tests plus physical calls. Passing regex/build checks is not audio proof |

Also verify call-start retry idempotency, reuse of an upload ID with a different call/hash, access-controlled media playback, disk durability, and internal receiver actions. These are audit targets, not asserted reproduced exploits. Existing server ownership validation must be preserved.

## 6. Target architecture: one app, several verified providers

```text
Device + dialer + selected SIM + permission/capability checks
                           |
                durable local call session
                           |
      selected provider produces a recording candidate
                           |
      identity match -> media validation -> durable upload
                           |
       server validation + authoritative recording selection
                           |
             tenant-scoped dashboard update/playback
```

### 6.1 Provider selection: improve Accessibility without discarding it

1. **OEM recording + approved folder/MediaStore import:** preferred when a real finalized call file is accessible. Usually removes visible Share navigation. Persist user-selected SAF access and re-check access after updates/reboot. Do not request full-device file access by default.
2. **OEM recording + user-approved Share:** preserve this working path when the dialer owns private audio. Manual Share is a valid fallback, but not automatic success. If permitted Accessibility assistance is evaluated, keep it a separate, bounded provider with explicit consent and distribution review.
3. **Optional elevated capture experiment:** Shizuku/ADB-assisted provider for explicitly managed/opted-in devices, only after baseline pipeline works. Measure both voices, setup effort, locked-screen/reboot recovery and security trade-offs. No silent setup of debugging or re-enabling it after the user turns it off.
4. **System/OEM/root fleet:** optional controlled-device product, not a claim for ordinary customer phones. No rooting or flashing in the stabilization workflow without a separate explicit decision.
5. **Microphone diagnostic:** useful to check mic hardware and some routes, but never silently substitutes for verified call-stream recording. Do not run competing capture providers simultaneously by default.

Google Phone's recording/export availability is device/region dependent. Use actual current capabilities, not an assumed private folder path. [Google Phone recording help](https://support.google.com/phoneapp/answer/9803950).

Accessibility is a control/navigation mechanism; in the system-recording Share flow, the native dialer creates the audio. Therefore screen automation and audio capture must be diagnosed separately. A successful tap does not prove a recording exists or that both voices are present.

Suggested automation contract: known dialer package/version, expected screen, session-bound target, one active operation, per-state timeout, bounded total attempt budget, stop on incoming call/user navigation/unexpected screen. Fail to an actionable pending/manual state; never keep opening/closing a card indefinitely. Never unlock the phone or conceal user-visible recording controls.

### 6.2 Device capability profile

Store Android/API and targetSdk, manufacturer/model, firmware/patch, default dialer package/version, region/carrier where legitimately available, work SIM/subscription identity, supported routes, selected provider, permission state, URI grant health, background restrictions, last controlled audio test and reasoned support status.

Cache measured results, not permanent brand assumptions. Invalidate relevant tests on OS/dialer/app/provider version changes, SIM changes or lost access. Unknown fields remain unknown. Some capabilities require a guided test because Android does not expose a reliable read API.

Use separate labels: install supported; tracking supported; automatic import verified; controlled two-sided test passed; manual only; needs setup; unsupported; not yet tested. Store verification build/date/route so a stale test does not imply current health.

### 6.3 Call and recording identity

- Create `clientSessionId` locally before network access; key it by tenant, agent and enrolled device. Backend call creation must be idempotent.
- Keep raw number plus normalized E.164 when possible. Use country-aware parsing, not last-ten-digit equality; handle withheld/unknown numbers explicitly.
- Record direction, work subscription/phone account, ring/dial start, connected/end evidence, wall clock plus elapsed time/boot identity, and eventual call-log identifier.
- Reconcile delayed call logs within a bounded window. OFFHOOK alone is not proof of answered talk time; do not fabricate connected duration.
- Each file candidate carries its own provider, URI/source ID, discovered time, original metadata, measured media duration, hash and evidence provenance.
- A unique consumed-source ledger prevents one old source asset from silently becoming a new call's recording. Scope correctly to endpoint/account; do not merge the two agents' legitimate recordings.
- Use available identity evidence with confidence and ambiguity rules. Do not require filename fields a provider never supplies. If two calls remain plausible, ask for selection instead of guessing.
- Support multiple segments/assets per call where genuine, with one explicit primary playback selection; do not overwrite a good asset with a late inferior candidate.
- Call duration and recording duration are distinct facts. Shorter recordings can start late; longer recordings may include announcements/hold audio. Validate timeline plausibility and disclose partial coverage rather than force equality or match by duration alone.

### 6.4 Honest state and media validation

Track separate dimensions: call lifecycle, matching result, transfer state, media quality, playback availability and privacy/retention state. Use versioned transitions and server-authoritative reconciliation, not one overloaded status enum.

A late end event may enrich metadata but cannot erase a validated recording. Conversely, an authenticated later corruption/deletion/security result must still be allowed to invalidate availability. Do not implement a simplistic rule that UPLOADED can never change under any circumstances.

Validate stable/finalized source bytes, container/codec, full decode with resource limits, actual duration/sample rate/channel count, zero frames, silence/clipping/dropouts and checksum continuity. Produce specific failure codes such as SOURCE_MISSING, ACCESS_REVOKED, AMBIGUOUS_MATCH, SILENT_AUDIO, PARTIAL_AUDIO, DECODE_FAILED and UPLOAD_RETRY.

RMS/non-zero samples prove signal, not two speakers. Mono can contain both voices; stereo can contain duplicated silence or one speaker. A controlled two-person phrase test with listening is required for device certification. Per-call speech analysis may flag issues but cannot honestly guarantee both participants spoke. Never generate or enhance nonexistent speech to make a test pass.

Keep the original immutable. If browser decoding requires a normalized derivative, preserve original hash and provenance, generate derivative server-side with bounded workers, and show which asset plays. Test authorized Range requests, seeking, expiry, reload and cross-browser playback.

### 6.5 Durable queue and storage

Use account/device-scoped durable records, atomic queue claims, checksums and a drain/re-enqueue handshake that survives worker exit races. WorkManager handles deferred import/upload/retry, not guaranteed real-time call capture. Restore unfinished records after process death; never upload an old account's queue with a new account's credentials.

Separate server receipt from validation acknowledgment. Keep a protected recovery copy until durable validation acknowledgment, then use a documented bounded retention policy. Proposed default for discussion: up to 24 hours after verified receipt, subject to user/admin policy and storage limits; never silently erase unuploaded recordings to satisfy the timer. Show storage pressure and a recovery action. Do not delete the native dialer's original recording.

Retry temporary network/server errors with exponential backoff and jitter; pause on authentication/entitlement problems and surface permanent rejection. Long recordings need resumable/multipart or otherwise recoverable uploads rather than a silent 50 MB failure. Verify production volume persistence/backups before deciding whether existing disk storage is adequate; object storage is a possible implementation, not a current fact.

### 6.6 Dashboard and server efficiency

Keep existing SSE, but remove the per-browser 2.5-second DB scan. Proposed design: transactionally write domain change plus outbox record; a shared dispatcher fans out authorized events. PostgreSQL LISTEN/NOTIFY can wake that dispatcher if the deployed database supports it; notifications are not the durable event history. [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html).

Provide bounded shared reconciliation, cursor replay, deduplication and a snapshot/reconnect handshake. Test late commits and equal timestamps; a naive highest-ID cursor can miss events. Do not send sensitive event payloads over a broad notification channel. Clean timers/listeners on both abort and cancel; prevent overlapping polls and bound slow-client buffers.

At the current interval, N idle open connections can cause roughly 0.4N polling queries/second before other work. Test 1, 10 and 100 clients. Desired cost should scale with events and server dispatchers, not a tight scan for every browser. UI updates must preserve the actively playing recording and stable row order.

### 6.7 Battery and simple onboarding

Onboarding flow: sign in -> select work SIM -> connect the available recording source -> guided test -> clear result. Reveal brand-specific instructions only when needed, with one action per screen. Avoid long technical essays and requesting every optional permission together.

On return from Settings, query actual permission/URI state and run relevant checks. If system recording cannot be queried, require a guided call rather than a false success tick. No unsolicited default-dialer prompt on an incoming call. Keep premium visual polish after correctness, using the same verified step model on every supported device.

Steady state: no continuous audio capture and no tight idle polling. Use system events and bounded reconciliation, constrained uploads, temporary wakelocks only when justified, and narrow Accessibility package/event filters if that provider remains permitted. Measure overnight idle drain against the same phone's baseline. Do not promise zero battery impact.

The app cannot override an explicit force-stop or revoked permission. Distinguish minimized, swiped from recents, OEM-killed process and true force-stop in UI and tests. Explain recovery honestly rather than creating hidden persistence.

## 7. How to investigate the silent-audio problem correctly

Do not make another long series of calls until one call is traced through all layers.

1. **Verify hardware without a call:** short voice memo on each healthy device, playback and measured signal. POCO's known mic defect is a separate hardware result, not proof our recorder failed.
2. **Verify native source alone:** one consensual test call with native recording enabled, no competing AI Closer microphone capture and no audio forwarding from mirroring. Preserve both endpoints' originals before testing imports. Use a distinctive spoken test ID at the beginning and end.
3. **Inspect native playback:** if the original itself is silent, investigate native recording settings, audio route, mic mute, Bluetooth, Wi-Fi calling, OEM/OS behavior and competing recorders. Backend changes cannot recover voice never captured.
4. **Inspect export:** if original is good but Shared/SAF copy is wrong or silent, compare source identity, bytes, finalized duration and hashes; investigate export grants, old-file selection or an incomplete copy.
5. **Inspect server:** if local copy is good but server bytes differ, investigate upload/resume/content handling and storage. Verify hash, decoder and recorded metadata.
6. **Inspect playback:** if server bytes are good, check browser/native player codec support, MIME, Range behavior, expiry and lifecycle. On Android 17, inspect background audio-hardening logs when appropriate rather than assuming capture was blocked.
7. **Choose the fix based on the failing layer.** Save evidence and a regression test, then rerun the same case before increasing test volume.

Two-sided verification needs actual distinct speech from both endpoints. Automated answer/hangup is not an audio test. If speech is injected for a lab test, document its route and do not confuse it with human conversational capture. Hardware with a broken microphone needs a verified healthy external mic/headset or replacement for full certification.

## 8. Acceptance and testing plan

### 8.1 One-call acceptance record

For every connected qualification call, save:

- Test ID, build hashes, backend release, device profiles, enrolled accounts, selected SIMs, route and app/lock state.
- Expected caller/callee, direction at each endpoint, start/connect/end evidence, call-log row and recording source.
- Original and uploaded hashes, measured durations, quality result, upload latency and dashboard event time.
- Evidence that both expected call rows exist, independently own the right recordings, and play from phone and browser.
- Listening result for the distinctive test phrases from each side; no reliance on file size, waveform or green status alone.
- Pass/fail/blocked with a specific reason. Logs and screenshots must redact unrelated personal calls, tokens and contacts.

A temporary Processing state while a file is finalizing is normal. A call is not a pass until the expected recording is verified. Proposed initial budgets: UI event within 5 seconds of committed backend change; normal online finalized recordings playable within 120 seconds of call end; a separate bounded late-file recovery window, initially 15 minutes. These are proposed targets, not measured guarantees. Tune using observed OEM finalization times and report breaches explicitly instead of hiding a stuck state.

Missed, rejected, canceled and unconnected calls should have correct call outcomes, not fabricated audio. Unsupported/manual-only devices must not be included in the automatic recording success denominator. Force-stop tests pass only when limitations and recovery are honestly handled, not when a forbidden hidden recorder persists.

### 8.2 Consecutive-call gate requested by the user

- Every qualified device profile needs at least 10 inbound and 10 outbound connected calls on the final candidate build, with the corresponding recordings visible and playable in the browser.
- With two healthy enrolled phones, 20 alternating-direction physical calls yield 40 endpoint call rows and 40 endpoint recordings; each phone receives 10 inbound and 10 outbound.
- With three healthy enrolled phones, 10 calls per pair, five each direction, yield 30 physical calls and 60 endpoint rows/recordings. Each phone totals 10 inbound and 10 outbound. This is only a minimum distribution, not the whole edge-case matrix.
- During initial diagnosis, verify both endpoints before starting another call. After that baseline passes, deliberately run the controlled back-to-back scenarios in section 14, allowing the next call before an earlier upload finishes. Stop uncontrolled repetitions of a known failing case; do not omit realistic rapid-call testing.
- Vary durations: e.g. 5, 8, 15, 27, 45, 60, 90, 120, 180 and 300 seconds, plus separate long-call tests. Rotate foreground, minimized, locked and app-swiped states across the sequence.
- A genuine recording/matching failure breaks the affected consecutive sequence. Diagnose, fix, produce an identified new candidate when code/config changes, and restart the affected sequence. Also rerun cross-device regressions. Final device qualification must use the exact frozen release artifact and backend/config combination; do not pool successful calls from different APKs. Do not erase failed attempts from the evidence ledger.
- No final two-sided pass for POCO using its known faulty mic unless a healthy input path is demonstrated. Its call detection, remote-side capture and sync results can still be reported separately.

Twenty successful calls are a release gate, not statistical proof of 100% future reliability. Follow with at least 100 connected-call soak tests across supported profiles, overnight idle tests and limited beta monitoring before broad claims.

### 8.3 Full scenario matrix

| Area | Required cases | Expected outcome |
|---|---|---|
| Call origin | AI Closer button, ordinary dial pad, saved contact, incoming | Same session/matching pipeline; no dependency on app-launched calls |
| App lifecycle | Foreground, minimized, locked, swiped from recents, OS process kill, explicit force-stop | Supported behavior works; limitations are differentiated and visible |
| Call outcomes | Answered, missed, rejected, canceled, busy, voicemail | Correct direction/outcome/talk-time evidence; audio expectations match the actual event |
| Identity | Same number twice quickly, unknown/private caller, contacts with similar names, international numbers | No newest-file guessing or contact-name-only match |
| Concurrency | Call waiting, hold/resume, second call, conference | Explicit multi-leg/segment handling or visible unsupported case; no silent merge |
| SIM | Work SIM1/SIM2, incoming on unselected SIM, swap/reinsert, default SIM changed | No personal-SIM upload; ask to reconfirm mapping when identity changes |
| Audio routes | Earpiece, loudspeaker, wired/USB headset, Bluetooth, route switch during call | Qualify each supported route separately; no speaker-leakage result called universal |
| Network calling | Normal cellular, VoLTE/VoNR where available, Wi-Fi calling | Test actual carrier route; distinguish route-specific limits |
| Network upload | Offline call, reconnect, interrupted upload, slow data, server 429/5xx, expired token | Durable retry with bounded load, no loss/duplicate/misowned upload |
| Recording files | Old file present, late file, incomplete write, silent/corrupt file, AMR/M4A/MP3/OGG/Opus, multiple shares | Correct file or explicit reason; stable bytes and supported decode |
| Time | Clock/timezone change, seconds versus milliseconds, delayed call log | Monotonic/session evidence prevents false identity |
| Recovery | Reboot before call, first unlock, permission/SAF revocation, app update, dialer update/change | Recheck relevant capabilities, preserve queued data, no false Ready |
| Storage | Low disk, long recording, quota reached, partial upload, unavailable media provider | Safe failure and actionable recovery; no silent deletion |
| Accounts | Logout/login as different agent, suspended/expired plan, refreshed entitlement, device reassignment | Queue isolation and correct permissions; no data transferred under another account |
| Dashboard | Two endpoint entries, stable ordering, live updates, replay after disconnect, play/pause/seek/reload | Correct audio persists without refreshing or resetting active playback |
| Security | Wrong tenant/user asset request, reused upload ID, manipulated MIME/path, revoked access | Denied or quarantined, audited; no audio leak |

Android/emulator coverage must include representative API 21/22 legacy feasibility, 23–25, 26–30 and each modern behavior boundary through 37. Not every brand/OS combination exists; use targeted pairwise coverage plus high-risk full combinations. A model tested on one ROM/dialer version is not the whole brand certified.

Emulators are useful for install, UI, API compatibility, permission-denial and state-machine tests. They do not prove real SIM downlink audio, carrier routing, OEM HAL behavior or both-party capture. Device-cloud tools may expand UI coverage; do not assume they provide real carrier-call pairs, and do not start paid runs as part of planning.

### 8.4 Automated tests to add before another release

1. Session reducer/property tests: duplicate and reordered ring/offhook/idle/end/upload events; late call-log arrival; same-number fast retries.
2. Matcher fixtures: old asset, changed timestamps, missing number, different SIM, seconds/milliseconds, several plausible candidates, multiple segments.
3. Queue integration: process death, enqueue-at-worker-exit, lease expiry, network timeout after server commit, account switch and revoked entitlement.
4. Real decoder fixtures: speech, actual silence, clipping, corrupt headers, truncated containers, large files and codec/MIME mismatch.
5. Backend transaction/idempotency tests using a test database and storage, not just source regexes; assert identity and authorization.
6. SSE event-scope truth tables, reconnect/replay, late-commit race, abort/cancel cleanup and load tests.
7. UI tests: grant/deny/revoke, return from Settings, unsupported device, manual Share, recording failure, font scaling and Hindi/English copy.
8. Signed upgrade tests: preserve data, permissions as allowed by OS, selected provider, account queue and rollback/forward-fix compatibility.

## 9. Implementation sequence and exit gates — not started

Do not perform a full rewrite or add a speculative native engine before fixing identity and validation. The following are work packages, not promises of completion dates.

| Phase | Work package | Exit evidence |
|---|---|---|
| 0A. Freeze and reproduce | Preserve dirty tree; snapshot artifacts/config; reconcile local and production release per repo instructions; confirm accounts/SIMs; capture one failing and one working trace | Reproducible baseline, no accidentally overwritten work, correct business-account access |
| 0B. Prove the customer path | Check an actual two-sided source and an authorized acquisition route under intended customer setup; review distribution/privacy/license constraints before expanding that route | Each initial target profile has an evidenced automatic path, an explicitly assisted path, or a named unresolved blocker. No major provider investment assumes a permission or store approval that has not been established |
| 1. Stop false success | Session-bound asset ownership, source-consumption ledger, idempotency, status merge, no early deletion, honest UI labels | Old audio cannot attach in automated fixtures; wrong/silent/corrupt media never gets a verified badge |
| 2. Make delivery reliable | Decode/checksum pipeline, format support, queue/account recovery, storage durability, authenticated playback, realtime scope and fanout | Same original file demonstrably survives device-to-browser transport and reconnects |
| 3. Preserve and extend providers | Freeze working dialer/provider contracts; bounded Accessibility flow; native folder/MediaStore/Share adapters; single-provider ownership | Pixel/Vivo/POCO independent baseline/regression evidence; no global toggle breaking another family |
| 4. Expand old-device support | API 23–25 compatibility and low-end performance; inspect actual OPPO; time-box API 21–22 feasibility | Main minimum-SDK decision backed by installs/tests; legacy trade-off documented, not hand-waved |
| 5. Simplify setup and battery | Capability-based onboarding, measured self-test, recovery actions, event-driven lifecycle | New user completes setup without developer intervention on each qualified profile; overnight measurement |
| 6. Qualify the release | Frozen-artifact 10 inbound/10 outbound per profile, unplugged customer-mode and burst tests, external-party calls, edge matrix, soak, security and entitlement tests | Traceable playable audio evidence; one candidate independently passes all advertised initial profiles; no silent reduction in agreed scope |
| 7. Distribution and rollout | Revalidate the early license/policy/signing decisions, test track, small customer pilot, staged rollout, monitoring and forward-fix plan | Eligible signed release, actual tester link verified, customer-mode pilot evidence and explicit release decision; no claim of a publication that has not happened |

Repository preflight for later code work must follow `D:/AIcloser/AGENTS.md`: verify production commit before editing code, reconcile rather than reset local changes, consult bundled Next.js docs for affected server APIs, and use the prescribed deployment script only. No production deployment was attempted for this report.

Suggested split when implementation is authorized: mobile identity/providers; backend validation/realtime/security; test/evidence ownership; UX/onboarding. Freeze shared contracts first. Work can run in parallel after that, but one owner coordinates physical calls so two agents do not operate the same phone simultaneously. This plan did not create or message another agent.

### Additive compatibility and regression rule

Every provider has a versioned capability contract and scoped feature switch. A POCO-specific repair must not change Pixel selection or disable Vivo capture unless a shared bug is proved and all affected profiles are retested. Keep fixtures for each previously passing flow.

One common application release remains the default. Optional managed/legacy distribution variants, if justified later, share core logic and are not customer-specific forks. Remote configuration may select known signed adapters/settings but must not download arbitrary executable fixes. Unknown configurations fail transparently.

Release rollback means a tested server-compatible rollback or a higher-version forward-fix where Android version rules require it, not blindly installing an older APK. Preserve migration compatibility, source files and queue state.

## 10. Security, Play Store and operational gates

### Play release is a separate requirement

Google Play says Accessibility cannot be requested for remote-call audio recording or used to bypass privacy/security controls. Merely adding a disclosure does not authorize a prohibited use. Treat the current Accessibility-assisted recording flow as a policy-review blocker until its exact behavior and permitted distribution are established. Native Share/import and any assistance must be assessed on their actual implementation, not relabeled to evade policy. [Accessibility policy](https://support.google.com/googleplay/android-developer/answer/16558241).

Call Log access has an enterprise CRM exception pathway, subject to Google's eligibility and approval requirements; it is not automatically approved and does not grant voice-stream capture. Avoid making the app default dialer merely to obtain unrelated permissions. [Call Log policy](https://support.google.com/googleplay/android-developer/answer/10208820).

Sideloading or enterprise distribution does not remove Android's technical privacy restrictions. Do not ask clients to routinely disable Play Protect as a product setup strategy. Final release approval, actual Play Console track status and tester-link accessibility must be verified separately.

### Privacy and security checklist

- Explicit work-SIM and recording consent, clear recording status, pause/exclusion controls and jurisdiction-specific business/legal review. App permissions do not substitute for participants' required consent.
- Keep personal-call data out of CRM; no blanket upload of the entire Recorder folder. On ambiguous SIM identity, fail safely rather than upload private audio.
- Encrypt protected recovery data as appropriate, use TLS, short-lived authenticated playback access, server tenant/agent ACLs and tested retention/deletion behavior.
- Validate shared URI grants, sanitize display names, enforce size/time/decoder limits, and isolate untrusted media decoding.
- Audit exported receivers/activities and custom internal actions. Preserve required system binding permissions; do not blindly disable legitimate Telecom/Accessibility components.
- Redact phone numbers/tokens from diagnostics where possible; store minimal test evidence with controlled access.
- Remove hard-coded signing secrets from tracked configuration with a continuity-aware remediation plan. Verify who owns each exposed key before any rotation.
- No third-party APK secrets, copied proprietary `.so` files or unreviewed GPL reuse. Generate dependency/license inventory for the final build. If native components are added, verify ABI coverage and 16 KB page-size compatibility rather than copying old binaries. [Android page-size requirements](https://developer.android.com/guide/practices/page-sizes).

### Business access must not sabotage recording tests

The earlier super-admin expiry, seats, suspend/activate and Google-login problems need their own regression suite: update through super-admin UI, verify server entitlement and account-session revalidation, then log in through the ordinary user flow. Do not bypass the UI by manually changing a database record and call the bug fixed.

Expired/auth-failed uploads should pause with a recoverable reason and preserve queued files subject to disclosed retention; renewed access should resume correctly. A test blocked by account entitlement is not a recording pass, nor evidence of a hardware problem. Current production status of those earlier fixes has not been re-certified in this report.

### Observability and operating targets

Track separately: eligible-call count; missing session rate; correct attachment rate; non-silent media rate; controlled two-sided test rate; upload completion/latency; ambiguous matches; source-missing reasons; crash/ANR; idle battery delta; backend work per event; supported-profile coverage. Never inflate success by excluding failed calls after the fact.

Attach a single diagnostic correlation ID from call session through asset, worker, server and dashboard event. Expose a simple user action: Send diagnostics, with a preview/consent step and no automatic sharing of recording content.

For initial performance gates, require no tight idle mic/poll loop, bounded retries and stable memory during long calls. Measure an 8-hour idle and 24-hour mixed-use baseline on healthy batteries before setting a defensible battery percentage target. Compare call audio/storage quality before choosing compression; keep originals when required by policy.

## 11. New technology experiments worth doing — bounded and optional

| Experiment | What it may improve | Go/no-go condition |
|---|---|---|
| JemRec/scrcpy-inspired shell capture benchmark | Direct audio on some unrooted devices when the user explicitly enables elevated setup | Must pass current Pixel Android 17 and representative older devices, lock/reboot/reconnect, audio quality and security review; no hidden debug persistence |
| ACR Phone Helper / Shizuku reference benchmark | Learn whether guided elevated setup reduces support burden | Measure vendor claim on same routes; compare number of setup/recovery steps; do not ship based on promotional claims |
| Capability-driven onboarding and verified configuration registry | Broader device support without per-client builds | Settings come from observed capabilities and test evidence; unknowns remain explicit |
| On-device lightweight signal diagnostics | Catch blank/corrupt/partial files before upload | Low CPU/battery; no claim that speech detection proves two voices; no fabricated waveform/audio |
| Shared outbox-driven realtime | Faster UI with lower idle server load | Correct tenant scope, replay and bounded resource use under load |
| Cloud/VoIP call recording | More control over capture if calls are routed through our/provider infrastructure | Separate business approval for changed call routing, numbers, cost and consent; not a silent replacement for ordinary SIM calls |

For cloud-routed calls, providers can expose recording and separate call legs, which reduces dependence on handset recorder access. It still has network/provider failure modes and does not record arbitrary existing SIM calls magically. Keep it an optional product alternative, not a prerequisite to the current native-dialer goal. [Twilio recording API](https://www.twilio.com/docs/voice/api/recording), [recording settings](https://www.twilio.com/docs/voice/recording-settings).

Do not investigate unlimited capture tricks in the main release branch. Give each provider experiment a small predeclared device/scenario set and a stop condition. Preserve existing working paths even if an experiment fails.

WhatsApp Business being installed is a device-market selection criterion in the latest request. Capturing WhatsApp Business calls is a separate future qualification track: different call events, audio ownership and policies. Do not label carrier-call success as WhatsApp-call support. The earlier Google Recorder/cloud discussion also does not establish an integration API or automatic access to Google Phone's call recordings.

## 12. Open questions and exactly how to close them

| Open question | Evidence needed / next action | Default until answered |
|---|---|---|
| Is OPPO really Android 5 or ColorOS 5? | Read model, `VERSION.RELEASE` and `SDK_INT` from the authorized device | Legacy feasibility, not supported |
| What OS/dialer/build is on Vivo now? | Establish ADB authorization; read-only inventory and installed APK fingerprint | Connected to Windows only; not test-ready |
| Do current installed APKs equal the local release? | Pull/fingerprint installed packages and signing identity; map to source snapshot | Do not credit old tests to a new source tree |
| Which exact layer causes Pixel silence? | Native-original -> exported-copy -> server-object -> player comparison for one controlled call | No engine rewrite based only on a silent player |
| Which providers work without visible UI? | Test real file export/grants/finalization per dialer and OS | Keep working approved Share route; do not promise invisible sync |
| Can current Accessibility behavior be distributed as intended? | Exact API/behavior review against current policy and Play declaration/decision | No production Play release promise |
| Can Android 6–7 be included in the main APK safely? | Dependency/API/lint audit, desugaring, authentication and real-device qualification | Planned work, not an install support claim |
| Is Android 5 support worth a legacy maintenance surface? | Actual OPPO result, customer demand, security/support cost and dependency feasibility | No rushed library downgrade or per-client fork |
| Is shell-assisted capture reliable enough for optional use? | Same-device A/B testing, reboot/lock/Wi-Fi-call failures, security and UX assessment | Experimental, off by default |
| Can we certify POCO's two-sided audio? | Healthy input route or repaired mic plus distinct speech at both ends | Only partial hardware-independent tests may pass |
| Are plan/seat/login and media authorization stable? | Ordinary-user UI regression and backend contract tests | Treat unresolved access errors as separate blockers |
| What latency/battery/storage promises can we publish? | Measured distributions on qualified devices and production-like load | Proposed targets only, no invented results |

## 13. What this plan enables next

Immediately actionable engineering work, once implementation is requested: eliminate stale attachment, establish durable call/file identity, add actual audio validation, repair queue/status semantics, improve dashboard event efficiency, and replace setup assumptions with measured capability checks. These improvements benefit every provider and every brand.

Device-dependent work: identify a reliable acquisition route for each phone/OS/dialer/region combination, assess Android 5–7 expansion, and decide whether an optional elevated profile is acceptable. Access to tools does not remove these platform constraints.

Definition of the desired product: one maintained app that makes the best verified route easy, protects existing working devices, accounts for every expected call outcome, preserves correct recordings through failures, and clearly tells the user when this device cannot provide the requested audio. We can improve substantially beyond the reference in correctness, diagnostics, onboarding and measurable reliability without claiming capabilities we have not demonstrated.

## 14. Second-review decisions: close the customer-delivery gaps

### 14.1 The test loop is an engineering process, not a call counter

After implementation is authorized, follow this loop for a reproducible failure:

1. Preserve the call ID, original audio, source/transfer/playback evidence and exact build/config.
2. Identify the failing layer. Classify it as application defect, backend defect, setup defect, hardware condition or demonstrated platform limitation. Do not label a defect unsupported merely to improve the pass count.
3. Reproduce the relevant case with a deterministic fixture when possible. Choose the smallest justified fix, rather than changing several capture methods at once.
4. Run automated checks and repeat the actual failed scenario.
5. Retest previously supported device paths affected by the change. Shared matching/queue/backend changes require cross-device coverage, not just the phone that reported the bug.
6. Resume the acceptance sequence on the new identified candidate. Keep failed attempts in the ledger. If the same failure persists, revise the diagnosis instead of repeating calls without new evidence.

This loop is operated by the implementation/testing team. The production APK does not rewrite itself or silently install experimental fixes on customers' phones. Its automatic recovery is limited to tested retry/reconciliation/provider behavior and respects user permissions.

Software defects should be fixed within the authorized implementation scope without making the user debug them. When progress genuinely requires new hardware, a repaired microphone, a different distribution choice or another business trade-off, report the specific blocker and choices; unlimited repetition is not a solution. The release stays unapproved if an agreed requirement is not met.

### 14.2 Prove a normal customer's setup, not only a development setup

Add a mandatory qualification block using the intended signed release, normal account and documented permissions only. For the standard public-device profile:

- No attached USB/debugging session, automated screen controller or undocumented permission grants during the acceptance call.
- Do not keep the app foreground, screen awake or charger connected just to help a test pass.
- Test immediately after ordinary setup, after an idle/locked interval, after overnight idle and after the documented reboot/unlock recovery.
- Observe the web dashboard without touching Refresh or manually rescuing Share/upload. Retrieve consented diagnostic evidence afterward if needed.
- Repeat at least one first-time installation/setup with a non-technical tester following only the app's instructions. Count setup steps, confusion, help requests and per-call interventions, not just setup duration.

An explicitly elevated/managed profile has its own documented prerequisites and acceptance results. A successful ADB-assisted recording cannot qualify the ordinary public-install profile.

### 14.3 Separate automatic, assisted and manual outcomes

Use these labels in the support matrix and test report:

| Result | Meaning for the customer | Counts toward automatic-recording acceptance? |
|---|---|---|
| Automatic, verified | After documented initial setup, an eligible call reaches playable dashboard audio without a per-call customer action, within the agreed supported conditions | Yes |
| Assisted | The customer must unlock/open something or approve an action after a call | No; report the exact intervention |
| Manual import | The customer selects/shares a recording for that call | No; useful recovery only |
| Setup/action required | A permission, source or account prerequisite is missing | No; clear reason and next step |
| Unsupported/unverified | No reliable route exists yet or sufficient tests have not been completed | No; do not call it a completed target |

An honest unsupported label prevents misleading users but is not delivery of the requested recording capability. Any reduction of the agreed release device scope needs an explicit product decision. This avoids turning the safeguards in the original plan into an excuse to stop improving coverage.

### 14.4 Test real customer calling patterns

In addition to paired enrolled-phone tests, test an AI Closer phone calling and receiving calls from an ordinary phone with no AI Closer installed. Only the enrolled endpoint's CRM record is expected. Identity and syncing must not depend on both callers being CRM users or on test-number exceptions.

After isolated end-to-end success, run a bounded batch of rapid consecutive calls, including repeat numbers, while earlier recordings are still finalizing or uploading. Also collect several offline calls and reconnect once. Reconcile every expected session/asset after the batch; check no omissions, overwrites, duplicate rows or wrong ordering. These are intentional stress scenarios, not an uncontrolled call storm.

Include ordinary use of other apps, browser tab closure/reopening, token refresh, next-day usage, different contact/number formats and delayed source export. Do not modify firmware, root a phone, suppress recording notices or perform unsafe network/security changes merely to make a scenario pass.

### 14.5 Mobile and web must agree and recover together

Give both surfaces a consistent explanation of each call: source being awaited, locally saved, waiting for network, validating, playable, attention required, or deliberately removed. Internal states may be more detailed, but users should not see contradictory Ready and Unavailable labels for the same acknowledged recording.

Required recovery proofs:

- Mobile says uploaded only with an identifiable server acknowledgment; browser disappearance triggers reconciliation, not a new guessed attachment.
- A reopened browser rebuilds the correct view even if it missed all live events. Live notification is an optimization, not the sole record of truth.
- A temporary backend outage/restart does not lose queued calls or acknowledged media. Retrying after a lost response remains idempotent.
- Test old and new app versions during backend rollout, account/session expiry, signing-preserving upgrade and database/queue migrations. Do not require every client to update at the same instant.
- A permitted deliberate deletion is recorded so an old retry/import cannot resurrect the recording. Apply access and retention changes to originals, derivatives, caches and pending jobs, with an auditable bounded policy.
- Define per-call/per-device retry and storage budgets; avoid unlimited battery-consuming retry loops or silent deletion under pressure. Show the administrator before a backlog becomes a service incident.

Silence analysis is a diagnostic, not automatic proof of a defective real-world call: participants may genuinely say nothing or remain on hold. Preserve evidence and flag quality appropriately. Controlled test calls with known speech still require audible expected content; signal thresholds cannot replace that check.

### 14.6 A credible competitor comparison

Treat Call Manager as a benchmark, not as proven bug-free across all phones. The supplied APK's hash identifies the file but does not verify its publisher signature, currentness or all advertised behavior. Establish version/provenance before a customer-facing comparison; do not use embedded credentials or real customer CRM data.

Use the same healthy device, OS/dialer, carrier/route, scenario, network conditions and spoken test content. Run the products separately to avoid competing recorders influencing each other; record their respective required settings. Use repeated crossover runs rather than one favorable example. A reference needing extra setup must be compared as that profile, not described as install-only.

Compare a concise scorecard: first-time setup, correct call identity, both-party audio, no per-call intervention, locked/idle recovery, offline delivery, browser usability, battery/storage impact and time to resolve an understandable failure. Label untested cells unknown. Better-than-competitor claims require measured evidence, not library names or marketing statements.

### 14.7 One release artifact and a small real-use pilot

Keep a release manifest recording APK/signing hashes, source snapshot including relevant working-tree changes, backend/schema versions, provider configuration and support profiles. Freeze it for qualification. A subsequent change invalidates relevant evidence; a broad shared change restarts cross-device qualification. Do not combine Pixel passes on one APK with Vivo passes on another and label a third APK final.

After device-lab gates pass, run a proposed 3–5 working-day pilot with a small consented group on the initial supported profiles. This is a proposed acceptance stage, not a scheduled or started activity. Use real ordinary usage without continuous developer intervention, privacy-controlled diagnostics and an incident owner. Resolve critical failures before wider rollout; investigate delayed uploads and setup friction as well as crashes.

Release-blocking conditions include wrong-call audio, wrong-account exposure, loss of acknowledged media, persistent silent audio on a profile advertised as verified, frozen/looping phone UI, a broken previously agreed device profile, and failure of documented automatic syncing. No amount of unrelated passing calls cancels one of these findings.

### 14.8 Decision presented to the user

The revised plan is a suitable controlled basis for implementation, not a certification that the application is already reliable. Begin with Phase 0A/0B and the cross-device correctness repairs once the user authorizes implementation. Do not wait until final publishing to discover that a capture route needs unavailable privileges or an unacceptable customer setup.

The user should receive a simple progress report: what works, what failed, what was fixed, which phones were retested, and whether the same candidate is ready for the next stage. Engineering detail stays in the evidence ledger; the user is not responsible for choosing low-level Android APIs or interpreting logs.

### Plan-only completion statement

This report used the APK-reverse skill's evidence separation and Android-development skill's lifecycle/testing guidance. The second review used the architect-review skill to strengthen customer-mode acceptance, early feasibility decisions and cross-device release safeguards. Only documentation was created/updated for these deliverables. No application code, APK, device configuration, account data, server deployment or Play release was changed. No fresh call/audio test is being claimed as passed.

Operational testing is now defined by the local `$aicloser-tester` skill at `C:/Users/hello/.codex/skills/aicloser-tester/SKILL.md`. It converts this plan into repeatable test, fix/retest and qualification modes, while saving persistent device capabilities, confirmed regressions and per-run evidence under `docs/qa/aicloser-tester/` when a test run is actually started.
