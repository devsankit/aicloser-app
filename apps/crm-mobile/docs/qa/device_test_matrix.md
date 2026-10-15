# AI Closer Mobile Device QA Matrix & Diagnostics Note

## Test Execution Summary
- **Target Application**: AI Closer (`com.gigxomi.crm`)
- **Workspace**: `D:\AIcloser\application\apps\crm-mobile`
- **Build Version**: `1.0.22` (Debug APK: `app-debug.apk`)
- **Date Verified**: October 15, 2026

---

## 1. Physical Device Verification: Google Pixel 9

| Property | Value / Status |
| :--- | :--- |
| **Device Model** | Google Pixel 9 (`tokay`) |
| **Serial / ADB ID** | `55211VDAQ000EC` |
| **Android OS Version** | Android 17 (API 36 / VanillaIceCream/Baklava preview) |
| **Default Dialer** | Google Phone (`com.google.android.dialer` version `241.0.991235506-pixel`) |
| **Work SIM Verification** | Dual SIM detected (`9589510954` work profile active) |
| **CallLog Sync Status** | **VERIFIED PASS** (`CallLogSyncManager` imported rolling 14-day window) |
| **Inbound Call History UI** | **VERIFIED PASS** (All inbound calls populated in Inbound tab with durations, timestamps, and contact names) |
| **Outbound Call History UI** | **VERIFIED PASS** (Outbound calls populated and sorted by effective call timestamp descending) |
| **Missed Call History UI** | **VERIFIED PASS** (Missed calls filtered and badge rendered) |
| **Contact Name Accessibility Automation** | **VERIFIED PASS** (Candidate scoring matches Google Phone contact card names e.g. `PPW Office No` when raw digits are not in card UI) |
| **Inbound Recording Sync** | **VERIFIED PASS** (`cmv8jljt700514qjpm11u4jxq`, `2026-10-15_00.19.24.m4a`, 26,529 bytes, duration 17s, Status: `UPLOADED`, Audio playback verified live: `0:02 / 0:17`) |
| **Outbound Recording Sync** | **VERIFIED PASS** (`cmv8gri2c004j4qjp5li67onz`, `2026-10-15_00.18.51.m4a`, 14,159 bytes, duration 10s, Status: `UPLOADED`, Audio playback verified live: `0:03 / 0:10`) |

---

## 2. Reference Emulator Verification

| Property | Value / Status |
| :--- | :--- |
| **Device Model** | Android SDK built for x86_64 (`sdk_gphone64_x86_64`) |
| **Serial / ADB ID** | `emulator-5554` |
| **Android OS Version** | Android 14 (API 34) |
| **Build Installed** | `com.gigxomi.crm` v1.0.22 |
| **Status** | **VERIFIED PASS** (UI renders without crashing, tabs functional) |

---

## 3. Other Manufacturer Status (Mandatory Untested Marking)

Per explicit architectural and QA guidelines, the following manufacturer platforms have **NOT** been certified in this session and must be marked as **UNTESTED**:

| Manufacturer | ROM / OS Skin | Verification Status | Notes |
| :--- | :--- | :--- | :--- |
| **Xiaomi / POCO** | MIUI / HyperOS | ⚠️ **UNTESTED** | Not connected during this session; file storage path and dialer accessibility tree unverified |
| **Vivo / iQOO** | Funtouch OS / OriginOS | ⚠️ **UNTESTED** | Not connected; proprietary recorder directory unverified |
| **Samsung** | One UI | ⚠️ **UNTESTED** | Not connected; Samsung Phone dialer UI hierarchy unverified |
| **OnePlus / Realme / Oppo**| OxygenOS / ColorOS | ⚠️ **UNTESTED** | Not connected; ODialer integration unverified |

---

## 4. Key Architectural Fixes Delivered

1. **Inbound Direction Filtering**:
   - Fixed condition in `CoreReferenceAdapters.kt` where `status == "COMPLETED"` was causing answered inbound calls to be incorrectly grouped under Outbound. Now strictly filters `direction.equals("INBOUND", true)` for the Inbound tab.
2. **Reverse Chronological Call Order**:
   - Sorted call history by effective call time descending (`it.endedAt?.takeIf(String::isNotBlank) ?: it.startedAt`), ensuring calls made or received today appear immediately at the top of the call feed.
3. **Local Call & Recording Synthesis**:
   - Enhanced `CrmViewModel.kt` to merge local call events and recordings from `OfflineEventStore` with bootstrap data, ensuring that freshly recorded calls and offline call records are always visible and playable immediately without waiting for server batch synchronization or suffering from pagination truncation.
4. **Dialer Candidate Scoring for Contact Names**:
   - Enhanced `DialerShareAutomation.kt` to score Google Phone cards by `contactName`, direction matching ("answered call" vs "outgoing call"), and sub-5-second timestamp tolerances, preventing ambiguous or cross-linked recordings.
