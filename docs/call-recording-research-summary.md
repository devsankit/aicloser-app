# AI Closer call-recording research audit

> Follow-up: the [device-aware stabilization plan](D:/AIcloser/application/docs/ai-closer-recording-stabilization-plan.md) is the current execution proposal. It adds Android 5–7 feasibility, Android 17 checks, evidence-qualified source findings, preserved Accessibility paths, and release gates. Earlier statements below about universal tracking, shell privileges, native-library effectiveness or competitor behavior are not guarantees; use the newer plan's distinctions between observed evidence, risk and unverified claims. The credential noted in the reference APK belongs to a third party and must not be used or treated as AI Closer's credential.

**Prepared:** 11 October 2026  
**Scope:** AI Closer mobile APK/source, MIS Call Manager reference APK, BCR, ShizuCallRecorder, JemRec, skvalex Call Recorder, and axet Android Call Recorder.

## Executive conclusion

There is no ordinary Android API that guarantees two-sided PSTN call audio on every stock device. Android/OEM policy decides whether a third-party app can access the voice-call uplink/downlink. The projects that obtain the best results do so by using one of these capability tiers:

1. **System/OEM/native recorder:** the dialer or a system-signed component receives the call stream.
2. **Root/system image:** privileged permissions such as `CAPTURE_AUDIO_OUTPUT` and call-control access are available.
3. **ADB/Shizuku/shell bootstrap:** a shell-side daemon temporarily obtains privileged access and keeps recording outside ordinary app process limits.
4. **Accessibility/standard microphone:** broadly installable, but commonly captures only the local microphone or speaker leakage; it cannot be treated as reliable two-sided recording.

Therefore the honest product target is **100% tracking and validation of every call event**, plus the best available recording method for that device profile. “100% two-sided audio on every stock Android model” cannot be promised without controlling the device image or requiring an elevated setup. The app must explicitly report `two-sided verified`, `local microphone only`, `silent/invalid`, or `unsupported` instead of attaching a misleading audio file.

## Source comparison

| Project | Primary capture strategy | What it proves | Main limitation for AI Closer | License / reuse risk |
|---|---|---|---|---|
| **BCR** | Root/system app; system permissions; `VOICE_CALL`/call stream; native/system integration | Best reference for privileged capture, metadata, file integrity, and low background overhead | Not a normal unrooted/Play Store solution; requires rooted/custom/system image | GPL-3.0; do not copy code into a closed product without legal review |
| **ShizuCallRecorder** | Shizuku grants shell-like access and uses hidden/internal audio path | Android 12+ can record both sides on some non-rooted devices; event-driven design avoids a permanent recorder process | Requires Shizuku; hidden APIs and OEM HAL differences; Android 11 limited; not a universal path | GPL-3.0; inspect obligations before reuse |
| **JemRec** | App bootstraps local Wireless ADB, launches a shell-side daemon, daemon captures `voice-call`; app later collects file | Strongest architectural lesson for avoiding app freeze, lost tails, and microphone-only fallback | Requires Developer Options, USB/Wireless debugging, pairing, boot/network recovery; not suitable as a hidden Play Store capability | Apache-2.0, but review vendored scrcpy-derived components and NOTICE |
| **skvalex Call Recorder** | Multiple modes: root, Shizuku, built-in ADB, accessibility fallback; continually adapts to Android/OEM changes | Excellent evidence that elevated access plus device-specific setup is necessary; recent releases fix Android 11/15/Honor cases | Proprietary/paid product; not a source to copy; even its elevated modes have reboot, unlock, OEM and Android-version caveats | Use only as behavioral reference; no implementation copying |
| **axet Android Call Recorder** | Native Android interfaces; configurable source/encoder; optional Accessibility, ADB/system permission, Magisk/system image | Good fallback ladder and honest device-support messaging; uses system services rather than constant polling | Project explicitly says most phones do not support call recording; source/encoder combinations can still be silent or one-sided | GPLv3; do not mix into closed code without compliance |
| **MIS Call Manager APK** | Proprietary-looking native CubeACR/callrecorder libraries, Accessibility, HAL parameter routing, MediaRecorder/AudioRecord fallbacks, share/import and upload services | Shows a practical multi-path product: native path first, fallback paths, WhatsApp notification path, and cloud upload | Static APK evidence cannot prove its claims; broad/restricted permissions, OEM selectors, stale-file matching and silent-audio bugs remain risks | Native components/licenses must be identified before reuse; embedded private credential found in asset must be rotated |
| **Current AI Closer APK** | `MediaRecorder`/`AudioRecord`, Accessibility/dialer share automation, selected-folder/MediaStore importer, backend upload | Good event, dashboard and upload foundation | No privileged native call-stream path; several matching, validation, stale-audio, lifecycle and deployment gaps | Our code; fix architecture before adding more capture tricks |

## What each project teaches us

### 1. BCR: privileged/system reference, not a universal APK model

BCR documents that reliable call-stream access depends on system-level capabilities. It uses system-app/root permissions and exposes metadata such as direction, SIM slot, timestamp, duration, channels, format, frames and buffer-overrun information. This is valuable for our data model and validation, but its environment is fundamentally different from a normal customer-installed APK.

Use from BCR:

- Store a recording manifest beside every file.
- Record source/method, direction, SIM/subscription, start/end timestamps, duration, channels, codec, sample rate, and validation result.
- Treat buffer overruns, encoder failures and zero-frame output as explicit errors.
- Separate “call row exists” from “playable two-sided recording exists”.

Do not assume BCR’s root/system approach can be moved into `com.gigxomi.crm` and still work on a stock Pixel, Redmi, Poco or Vivo.

Source: [BCR](https://github.com/chenxiaolong/BCR).

### 2. ShizuCallRecorder: event-driven shell access

ShizuCallRecorder uses Shizuku and hidden/internal Android APIs to record carrier calls on Android 11+ devices. Its documented strengths are both-side recording on supported devices, Bluetooth/headset support, automatic rules, Opus/AAC output and starting only around phone-event changes rather than maintaining a permanent polling recorder. It also documents the important caveats: Android 11 is limited, Android/OEM changes can break hidden APIs, concurrent calls may merge, and support depends on the device.

Use from ShizuCallRecorder:

- Replace our always-on polling model with event-driven work.
- Make the capture method a capability, not a single hard-coded implementation.
- Add a fast self-test that reports whether the device gives both sides, one side, silence or unusable audio.
- Keep carrier-call support separate from WhatsApp/VoIP support; one does not prove the other.

Do not silently require Shizuku or hidden APIs for normal users. Make it an optional managed-device path with clear security and support warnings.

Source: [ShizuCallRecorder](https://github.com/kitsumed/ShizuCallRecorder).

### 3. JemRec: the most useful architecture lesson

JemRec is unusually explicit about its design. Normal apps cannot hold the signature-level permissions needed for the `voice-call` stream. JemRec pairs the phone with its own Wireless Debugging endpoint over loopback, runs a short ADB bootstrap, grants the required access and launches a shell-side daemon. The daemon—not the UI app—watches call state and captures audio. The app later copies the finished file. This avoids the app being frozen while the dialer is in front of the user, which otherwise causes truncated recordings.

Use from JemRec:

- Separate **capture**, **collection**, **validation**, **upload** and **dashboard display** into independent state machines.
- Keep capture outside a UI process and use a durable local queue.
- Authenticate any local socket; JemRec uses a two-way nonce/HMAC exchange rather than trusting loopback.
- Detect daemon version/build mismatch and replace stale helper state.
- Run a self-test against the same capture path used by a real call.
- Make reboot, Wi-Fi loss, debugging loss and OEM auto-launch behavior visible in setup status.
- Treat Android HAL output as a measured capability; JemRec itself says some phones provide both sides, some one side and some silence.

What we should not copy blindly:

- Leaving USB/Wireless debugging enabled on customer devices.
- A hidden shell daemon as a default Play-distributed experience.
- The assumption that a paired device remains healthy after every reboot/OEM policy change.

Source: [JemRec](https://github.com/jemcik/JemRec).

### 4. skvalex: production-grade fallback ladder, but not a source dependency

The release history is useful evidence. It has separate recording-access modes for root, Shizuku and built-in ADB; its recent releases mention Android 11 two-sided capture, Android 15 compatibility, Honor screen-lock fixes, reboot recovery and improved setup stability. Its public help also states that Accessibility fallback commonly records through the microphone only, while elevated access is needed for the other side.

Use from skvalex:

- A setup wizard should identify the active recording-access tier and warn when it fell back to microphone-only.
- Access health must be rechecked after reboot, Developer Options changes, debugging changes and OEM battery-policy changes.
- Device/OEM-specific diagnostics are necessary; one global “permission granted” boolean is insufficient.
- A “pause elevated access” concept is useful where banking/security apps conflict with debugging.

Do not use its binary, proprietary implementation or product behavior as a code dependency. Treat the releases and help pages as behavioral research only.

Sources: [skvalex releases](https://github.com/skvalex/callrecorder/releases), [recording-access help](https://callrecorder.skvalex.com/help/settings-for-call-recording), [issue-avoidance help](https://callrecorder.skvalex.com/help/avoid-recording-issues).

### 5. axet: honest fallback and battery model

axet’s README explicitly says most phones do not support call recording. It tries system services and configurable encoders/sources, then falls back from high-quality voice-line capture to microphone capture. Its documentation lists default capture, Magisk, Accessibility/Voice Recognition, system mixer and ADB/system permission as separate options. It also emphasizes that system-service handling avoids constant polling and battery/CPU overload.

Use from axet:

- Expose encoder/source combinations only as diagnostic profiles, not as a promise.
- Mark MIC fallback as `local-only` and never attach it as verified two-sided call audio.
- Prefer call-state callbacks and short-lived foreground work over a 750 ms forever loop.
- Provide a custom folder/file naming policy and a test recording that users can locate.

Source: [axet Android Call Recorder](https://gitlab.com/axet/android-call-recorder), [its recording notes](https://gitlab.com/axet/android-call-recorder/-/tree/master/docs).

## MIS Call Manager reference APK audit

The attached `Call-Manager_1.0.26_apkcube.apks` was statically inspected. It is not just a simple recorder. Its manifest/classes show several parallel systems:

- Native libraries: `libcallrecorder_native.so`, `libcubeacr.so`, FFmpeg-related libraries.
- Capture paths: native CubeACR-like recorder, HAL/audio-route parameters, `AudioRecord`, `MediaRecorder`.
- Lifecycle: phone-state receiver, boot receiver, foreground services, accessibility service and call-screening/telecom components.
- VoIP/WhatsApp path: notification listener, WhatsApp recording/overlay services.
- Data path: local recording writer, share automation, upload queue, retry worker, call-log sync and health worker.
- UI bridge: share activity and accessibility automation that appears designed around a particular dialer UI.

Static code evidence showed a priority order of native capture → HAL route attempt → standard `AudioRecord` microphone fallback → `MediaRecorder`. The native path references `VOICE_CALL`/audio-system routing, which explains why it can outperform a normal microphone recorder on some devices. It does **not** prove universal support: the HAL route is OEM/firmware dependent, and the APK’s Google-Phone/dialer selectors are inherently device-specific.

Important security finding: an embedded service-account private credential was present in an APK asset. No secret value is reproduced here. If it belongs to our project, revoke and rotate it immediately; if it belongs to the third party, do not use it or distribute it.

## Current AI Closer gaps found before implementation

These are the highest-priority issues to resolve before adding more device-specific capture paths:

### P0: wrong/stale recording can attach to a new call

`CallAudioRecorder.stop(context)` can return the first global `LOCAL_PENDING` recording when the current recorder is null. This matches the observed symptom where an old recording appeared on a new inbound/outbound row. The handoff must be keyed by a unique call session, number, direction, subscription/SIM and a strict time window—not by “first pending file”.

### P0: backend can overwrite a good upload with a late failure

`endSalesMobileCall()` can replace a successfully uploaded recording with a late local-pending/failure result. The backend needs monotonic, idempotent transitions and must reject stale updates.

### P0: audio is not actually validated

The current upload path accepts bytes/MIME/client duration without proving that the file decodes, has non-zero frames, has usable RMS/peak energy, and contains expected duration. A playable but silent file must be classified as `silent_or_unverified`, not `ready`.

### P1: current capture path is not a universal two-sided path

AI Closer currently has MediaRecorder/AudioRecord, Accessibility/dialer-share automation and folder/MediaStore import. It has no equivalent of BCR’s system path, JemRec’s shell daemon or MIS’s native routing library. On stock devices it can therefore produce microphone-only or silent results.

### P1: lifecycle/battery risk

`CallStateMonitorService` is sticky, microphone-foreground and polls at roughly 750 ms; `MainActivity` starts it on resume. The service should be event-driven, start only when capability checks require it, stop after a bounded idle period and avoid declaring microphone FGS when it is not recording.

### P1: matching and import races

- Selected-folder timestamp normalization is inconsistent between discovery and comparison.
- Share automation and folder/MediaStore import are mutually exclusive; one failed path can skip a valid fallback.
- `SEND_MULTIPLE` is declared but the importer handles one URI.
- Generic MIME/URI handling can reject valid audio.
- Newest call-log row is not strictly matched by number, direction, SIM/subscription and call window.
- Orphan recovery sets duration to zero.
- Dashboard waveform fallback can look valid after audio decoding failed.

### P1: setup creates false confidence

Opening Phone settings can mark setup complete before a real inbound and outbound self-test confirms two-sided audio. Setup completion must be evidence-based and device-specific.

### P1: deployment/security

- Local disk uploads under `process.cwd()` are unsafe for multi-instance/ephemeral deployment; use durable object storage and immutable recording IDs.
- Release signing credentials are hard-coded in Gradle and must be moved to protected CI secrets and rotated.
- The exported phone-state receiver accepts a custom action without strong authentication; harden or make it internal.
- There is insufficient recording/audio integration coverage; current tests are mainly API/unit-level.

## Recommended AI Closer architecture

### Capability profile at onboarding

Detect Android API, OEM/model, dialer package, SIM/subscription, default-dialer status, accessibility state, notification access, battery policy, selected folder and available capture routes. Run a short controlled self-test and save a profile:

- **Tier A — verified system/OEM or elevated voice-call:** two-sided capture expected; still validate every file.
- **Tier B — managed shell/Shizuku/ADB:** only if the customer explicitly enables a managed-device mode; show security implications and health status.
- **Tier C — imported native/dialer recording:** reliable only when a new file can be matched strictly to the exact call.
- **Tier D — microphone/speaker fallback:** local-side only; never claim full call recording.
- **Tier E — unsupported:** track the call event but show that audio could not be obtained.

### Per-call state machine

`detected → ringing/off-hook → recording_expected → candidate_found → copied → decoded → energy_checked → identity_matched → upload_queued → upload_verified → dashboard_ready`.

Every transition needs a call-session ID, source method, timestamps, file hash/size, duration, codec, channel count, audio-energy result and error code. A late event may only advance a call, never replace a newer verified state.

### File correctness rules

- Generate a unique local filename from session ID, not phone number alone.
- Never attach a file merely because it is the newest or pending.
- Verify container parsing, duration tolerance, frame count, non-silence and optional two-channel/voice-energy heuristics.
- Keep the original file immutable; derived transcoding gets a new object/version.
- Upload via a durable queue with resumable retry and idempotency key.
- Dashboard must show actual media duration only after metadata is loaded, and must disable play when validation fails.

### Device compatibility strategy

Do not delete a working Pixel/Vivo/Poco path when adding another OEM. Keep a device capability registry and append measured profiles. The same APK can adapt onboarding and choose a route, but it cannot manufacture a missing HAL permission. Unsupported combinations should be visible and actionable.

## Test matrix for “production ready”

For every supported device profile, run at minimum:

- 10 inbound and 10 outbound carrier calls.
- Foreground, minimized, screen locked, app force-stopped/reopened, rebooted, mobile-data-only and Wi-Fi-only conditions.
- Default dialer and non-default dialer conditions where supported.
- Each active SIM/subscription and each tested Bluetooth/headset/speaker route.
- Calls of different durations, including very short calls and overlapping/rapid consecutive calls.
- Verify: exactly one call row, exactly one matching recording, correct direction/number/SIM/time, playable audio, expected duration tolerance, non-silent audio, no stale attachment, retry after offline, and no duplicate upload.

Passing ten rows is not enough. A pass requires **media validation** and an explicit result for both sides. If a device can only produce microphone audio, it should fail the two-sided capability test rather than be counted as a successful universal device.

## Legal, policy and licensing guardrails

- Obtain recording consent according to the applicable country/state and disclose recording to participants where required.
- Google Play’s Accessibility policy and sensitive-permission requirements are material constraints for a general Play Store build. A sideload/managed-device build is a different distribution and compliance decision. See [Google Play Accessibility API policy](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en-EN) and [sensitive permissions policy](https://support.google.com/googleplay/android-developer/answer/16558241?hl=en&rd=2).
- BCR, ShizuCallRecorder and axet are GPL-family projects; JemRec is Apache-2.0. Any code reuse, linking, vendoring or modification must be reviewed against the intended AI Closer distribution model.
- MIS APK native libraries and third-party components need license/provenance review before reuse.
- Never ship embedded private keys or service-account credentials in an APK.

## Final recommendation

The best technical direction is not to clone one project. Combine:

1. **JemRec’s separation of capture from app/UI and its authenticated local handoff.**
2. **BCR’s evidence-rich metadata and validation model.**
3. **ShizuCallRecorder/skvalex’s capability tiers, self-test and access-health recovery.**
4. **axet’s honest source/encoder fallback and low-background-overhead approach.**
5. **MIS’s multi-path upload/retry/VoIP architecture, but with strict identity matching and no blind native-library copying.**

The next engineering phase should first fix stale-file attachment, monotonic backend state, real audio validation and event-driven lifecycle. Only after those are stable should we add an optional elevated capture tier. That order prevents a powerful recorder path from continuing to place the wrong or silent audio on the dashboard.

## Primary references

- [BCR](https://github.com/chenxiaolong/BCR)
- [ShizuCallRecorder](https://github.com/kitsumed/ShizuCallRecorder)
- [JemRec](https://github.com/jemcik/JemRec)
- [skvalex Call Recorder releases](https://github.com/skvalex/callrecorder/releases)
- [skvalex recording-access documentation](https://callrecorder.skvalex.com/help/settings-for-call-recording)
- [axet Android Call Recorder](https://gitlab.com/axet/android-call-recorder)
- [axet recording documentation](https://gitlab.com/axet/android-call-recorder/-/tree/master/docs)
- [Google Play Accessibility policy](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en-EN)
- [Google Play sensitive permissions policy](https://support.google.com/googleplay/android-developer/answer/16558241?hl=en&rd=2)
