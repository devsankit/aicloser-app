# AI Closer two-user cross-device recording test report

- Run ID: `20261011-184338-two-user-cross-device`
- Result: `PASS_NOT_DUPLICATE_MEDIA; PARTIAL_RECORDING_ON_PIXEL`
- APK: AI Closer `1.0.22` / versionCode `22`
- Devices: Xiaomi Redmi 6A (`cactus`, Android 9, MIUI) and Google Pixel 9 (`tokay`, Android 17)
- Test identity: Redmi remained on its existing user; Pixel was logged in as `Vivo Test`.

## Setup

- Pixel login succeeded with the second user and the device was claimed using the in-app `Login here` flow.
- Pixel work SIM 1 was selected automatically by the setup screen. Redmi's existing SIM selection was preserved; the outgoing call required the native SIM chooser and SIM 2 was selected.
- No uninstall, data clear, or account change was performed on Redmi.
- Pixel setup reported Share automation connected. Its optional recording-folder route remained unset.

## Physical call

- Redmi placed a real cellular call to the Pixel work number.
- Redmi SIM 2 was selected in the native chooser.
- Both phones reached `ACTIVE`; the call remained connected for approximately 37–38 seconds and was ended from Pixel.
- Dashboard refresh increased workspace totals from `149` to `151` calls and from `53` to `55` recordings.

## Dashboard evidence

The single physical call produced two user-owned rows at `11 Oct 2026, 6:44 pm IST`:

1. `anshita` / outbound / completed / `37s` / recording `35.88s` / call ID `cmv3ui2ji0021k6jpqxdh4ypg`
2. `Vivo Test` / inbound / completed / `38s` / recording `5.248s` / call ID `cmv3uh4a7001yk6jpa6qs0ogm`

The rows are not the same media:

- Redmi native MP3: `143520` bytes, SHA-256 `E16802A87446EAEC20F2EEE26F08F8BF38930BAF177A3D730338A9FB27F6AA32`.
- Pixel M4A: `14267` bytes, SHA-256 `C48B9EDC96ECF7FEF049FBEB6E2658130AE8C1D98984716C32C0643438F57EBB`.
- The Redmi source file hash matched the dashboard MP3 download exactly.

## Findings

1. Two separate user sessions were successfully distinguished. The dashboard did not merge the Redmi and Pixel records into one owner.
2. The two dashboard recordings are not duplicate bytes or duplicate recording IDs. They are separate endpoint uploads from one physical call.
3. Redmi's Xiaomi native recording/import/upload path worked end-to-end for this call and produced the 35.88-second MP3.
4. Pixel produced only a 5.248-second M4A fallback recording. This is a partial/short capture, not proof of a complete two-sided recording.
5. `RecordingUploadWorker` returned `SUCCESS` on Pixel. Pixel logs also showed SQLite connection-leak warnings for `gxclosers-offline.db`; this is a code-quality issue to investigate, although the upload completed.
6. Pixel's source route is independently visible in logcat: Google Dialer sent an `ACTION_SEND` intent with `audio/*` to `com.gigxomi.crm` at `18:44:58`, matching the separate M4A dashboard row.
7. Because no scripted voice phrase was independently confirmed during the call, two-sided speech intelligibility remains `NOT_TESTED`.

## Qualification

This run proves account separation, per-device call ingestion, upload, dashboard visibility, and non-duplicate media for this specific two-phone call. It does not prove that Pixel's fallback captures a complete call recording or that the product should show one combined CRM row instead of two endpoint rows.
