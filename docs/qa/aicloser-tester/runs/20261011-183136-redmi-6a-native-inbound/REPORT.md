# AI Closer physical-device test report

- Run ID: `20261011-183136-redmi-6a-native-inbound`
- Result: `PASS_AUTOMATIC_VERIFIED` for Xiaomi native-dialer recording on this device profile
- Device under test: Xiaomi Redmi 6A (`cactus`), Android 9, MIUI build `V11.0.9.0.PCBMIXM`
- Companion device: Google Pixel 9 (`tokay`), Android 17
- APK: AI Closer `1.0.22` / versionCode `22`
- APK SHA-256: `6A5B63385991FDC05C5405E4506E86A8D619DFC6F7B0144590106AF92A726B32`

## Setup

- Final release APK installed successfully after cache-only cleanup; no personal data was deleted.
- Redmi setup completed: permissions granted, Xiaomi Phone automatic call recording was ON, and recording scope was All numbers.
- Calling SIM: SIM 2 selected. Android did not expose SIM 2's MSISDN; SIM 1 visibly showed a different number ending `9871`, so SIM 2 was the only candidate for the requested `99933…` line.
- App diagnostics: device verified and route reported as `Automatic native dialer recording`.

## Physical call

- Pixel called the Redmi line; Redmi received the call from the Pixel test line ending `0954`.
- Call was answered at approximately 18:31:36 IST, held for about 26 seconds, and ended at approximately 18:32:02 IST.
- Xiaomi Phone showed recording active during the call.

## Evidence

- New source file: `/sdcard/MIUI/sound_recorder/call_rec/Call@009195895109(00919589510954)_20261011183136.mp3`
- Source file size: `103776` bytes.
- Local media probe: MP3, 48 kHz, mono, `25.944s`; non-silent signal (`mean_volume -27.9 dB`, `max_volume -8.6 dB`).
- Redmi logcat: one inbound session was created; `SystemRecordingImportWorker` returned `SUCCESS`; `RecordingUploadWorker` returned `SUCCESS`.
- Dashboard: latest `anshita` inbound call at 18:32, `Completed`, 26s, playable recording with 25s duration. Browser playback advanced to 0:04, confirming the dashboard audio element loaded and played.

## Findings / follow-up

1. Native Xiaomi route passed end-to-end on Redmi 6A: call event -> native MP3 -> automatic import -> upload -> dashboard playback.
2. The accessibility/share fallback did not remain active at runtime: log reported `Share automation unavailable: enabled=true accessibility=false`. Native route was unaffected, but this fallback needs a separate fix/verification.
3. Dashboard displayed two playable inbound rows for the same physical call window (18:31 and 18:32). Phone logs showed one inbound session, so call-event deduplication or start/end lifecycle handling needs investigation.
4. This smoke test did not deliberately speak scripted phrases on both phones; recording existence, duration, signal, upload, and playback are proven, but two-sided speech intelligibility remains `NOT_TESTED`.

## Qualification

`PASS_AUTOMATIC_VERIFIED` is valid for this Redmi 6A/MIUI native-recording profile only. It is not proof that every Android/OEM profile will record automatically.
