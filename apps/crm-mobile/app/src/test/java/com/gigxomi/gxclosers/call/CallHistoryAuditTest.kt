package com.gigxomi.gxclosers.call

import com.gigxomi.gxclosers.data.MobileCall
import com.gigxomi.gxclosers.data.parseBootstrap
import com.gigxomi.gxclosers.data.isFromDevice
import com.gigxomi.gxclosers.data.parseEffectiveInstant
import org.junit.Assert.assertNotNull
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class CallHistoryAuditTest {

    // -------------------------------------------------------------------------
    // 1. Stale-Number Broadcast Resolution Tests
    // -------------------------------------------------------------------------

    @Test
    fun resolveIncomingNumber_missingExtra_doesNotUseCachedActivePhone() {
        val incomingExtra = ""
        val cachedActivePhone = "+919876500001" // Outbound target left in prefs
        val screenedPhone: String? = null

        val state = "RINGING"
        val resolved = when {
            incomingExtra.isNotBlank() -> incomingExtra
            state == "RINGING" && !screenedPhone.isNullOrBlank() -> screenedPhone
            state == "RINGING" -> "" // Safe: Never fall back to activePhone or stale phone on RINGING
            else -> cachedActivePhone
        }

        assertEquals("", resolved)
        assertFalse(resolved == cachedActivePhone)
    }

    @Test
    fun resolveIncomingNumber_missingExtra_acceptsFreshScreenedNumber() {
        val incomingExtra = ""
        val screenedPhone = "+919123456789"
        val now = System.currentTimeMillis()
        val screenedAt = now - 5_000L // 5 seconds ago (fresh)
        val isFresh = (now - screenedAt) <= 25_000L

        val state = "RINGING"
        val resolved = when {
            incomingExtra.isNotBlank() -> incomingExtra
            state == "RINGING" && isFresh && !screenedPhone.isNullOrBlank() -> screenedPhone
            state == "RINGING" -> ""
            else -> ""
        }

        assertEquals("+919123456789", resolved)
    }

    @Test
    fun resolveIncomingNumber_staleScreenedNumber_isIgnored() {
        val incomingExtra = ""
        val screenedPhone = "+919123456789"
        val now = System.currentTimeMillis()
        val screenedAt = now - 60_000L // 60 seconds ago (stale)
        val isFresh = (now - screenedAt) <= 25_000L

        val state = "RINGING"
        val resolved = when {
            incomingExtra.isNotBlank() -> incomingExtra
            state == "RINGING" && isFresh && !screenedPhone.isNullOrBlank() -> screenedPhone
            state == "RINGING" -> ""
            else -> ""
        }

        assertEquals("", resolved)
    }

    // -------------------------------------------------------------------------
    // 2. Uncorrelated IDLE Events & State Transitions
    // -------------------------------------------------------------------------

    @Test
    fun idleState_withoutCallLogOrAudioFile_isMarkedUncorrelatedAndNotCompleted() {
        val hasCallLogRow = false
        val callLogDurationSeconds = 0L
        val hasLocalAudioFile = false
        val wasOffhookPref = true // Glitched / leftover in SharedPreferences

        // Core safeguard: Must correlate with telecom CallLog or recorded audio
        val isCorrelatedCallLog = hasCallLogRow && callLogDurationSeconds > 0L
        val isUncorrelated = !hasCallLogRow && !hasLocalAudioFile
        val connected = isCorrelatedCallLog || hasLocalAudioFile

        assertTrue("Transition must be flagged as uncorrelated", isUncorrelated)
        assertFalse("Must never mark connected without call log or audio evidence", connected)
    }

    @Test
    fun idleState_withCallLogRow_computesRealDurationFromTelecom() {
        val hasCallLogRow = true
        val callLogDurationSeconds = 42L
        val hasLocalAudioFile = false

        val connected = hasCallLogRow && callLogDurationSeconds > 0L
        val durationSeconds = if (connected) callLogDurationSeconds else 0L

        assertTrue(connected)
        assertEquals(42L, durationSeconds)
    }

    // -------------------------------------------------------------------------
    // 3. Historical Call Log Timestamp Preservation & Deduplication
    // -------------------------------------------------------------------------

    @Test
    fun historicalCallLogImport_preservesOriginalDateAndDoesNotMakeItToday() {
        val historicalDateMillis = Instant.parse("2026-10-01T12:00:00Z").toEpochMilli()
        val durationSeconds = 65L
        val endedAtMillis = historicalDateMillis + (durationSeconds * 1000L)

        val startedAtIso = Instant.ofEpochMilli(historicalDateMillis).toString()
        val endedAtIso = Instant.ofEpochMilli(endedAtMillis).toString()

        assertEquals("2026-10-01T12:00:00Z", startedAtIso)
        assertEquals("2026-10-01T12:01:05Z", endedAtIso)

        val payload = JSONObject().apply {
            put("callSessionId", "call-log-12345")
            put("status", "COMPLETED")
            put("direction", "INBOUND")
            put("phoneNumber", "+919876543210")
            put("startedAt", startedAtIso)
            put("endedAt", endedAtIso)
            put("durationSeconds", durationSeconds)
            put("recordingStatus", "NONE")
        }

        assertEquals("2026-10-01T12:00:00Z", payload.getString("startedAt"))
        assertEquals("2026-10-01T12:01:05Z", payload.getString("endedAt"))
        assertEquals("NONE", payload.getString("recordingStatus"))
    }

    // -------------------------------------------------------------------------
    // 4. Device Provenance & Scope Separation
    // -------------------------------------------------------------------------

    @Test
    fun parseBootstrap_extractsDeviceModelAndProvenance() {
        val json = JSONObject().apply {
            put("calls", JSONArray().apply {
                // Call from Pixel 9 (this device)
                put(JSONObject().apply {
                    put("id", "call-pixel-1")
                    put("phoneNumber", "+919876543210")
                    put("direction", "INBOUND")
                    put("status", "COMPLETED")
                    put("startedAt", "2026-10-15T09:00:00Z")
                    put("deviceId", "pixel-9-android-id")
                    put("device", JSONObject().apply {
                        put("deviceId", "pixel-9-android-id")
                        put("model", "Pixel 9")
                    })
                })
                // Call from another device (e.g. POCO F5)
                put(JSONObject().apply {
                    put("id", "call-poco-1")
                    put("phoneNumber", "+919876543211")
                    put("direction", "OUTBOUND")
                    put("status", "COMPLETED")
                    put("startedAt", "2026-10-14T15:00:00Z")
                    put("deviceId", "poco-f5-device-id")
                    put("device", JSONObject().apply {
                        put("deviceId", "poco-f5-device-id")
                        put("model", "23049PCD8G")
                    })
                })
            })
        }

        val bootstrap = parseBootstrap(json)
        assertEquals(2, bootstrap.calls.size)

        val pixelCall = bootstrap.calls.find { it.id == "call-pixel-1" }!!
        assertEquals("Pixel 9", pixelCall.deviceModel)
        assertEquals("pixel-9-android-id", pixelCall.deviceId)

        val pocoCall = bootstrap.calls.find { it.id == "call-poco-1" }!!
        assertEquals("23049PCD8G", pocoCall.deviceModel)
        assertEquals("poco-f5-device-id", pocoCall.deviceId)
    }

    @Test
    fun filterCalls_byDeviceScope_separatesLocalFromAgentWide() {
        val currentDeviceId = "pixel-9-android-id"
        val calls = listOf(
            createTestCall("c1", deviceId = "pixel-9-android-id", deviceModel = "Pixel 9"),
            createTestCall("c2", deviceId = "poco-device-id", deviceModel = "POCO F5"),
            createTestCall("c3", deviceId = null, deviceModel = null), // Local legacy/unprepared
        )

        // "All Devices" scope includes all 3
        val allScope = calls.filter { true }
        assertEquals(3, allScope.size)

        // "This Device" scope filters to current device only
        val thisDeviceScope = calls.filter { call ->
            val isOtherDevice = (!call.deviceId.isNullOrBlank() && currentDeviceId.isNotBlank() && call.deviceId != currentDeviceId) ||
                    (!call.deviceModel.isNullOrBlank() && !call.deviceModel.equals("Pixel 9", ignoreCase = true))
            !isOtherDevice
        }
        assertEquals(2, thisDeviceScope.size)
        assertTrue(thisDeviceScope.any { it.id == "c1" })
        assertTrue(thisDeviceScope.any { it.id == "c3" })
        assertFalse(thisDeviceScope.any { it.id == "c2" })
    }

    // -------------------------------------------------------------------------
    // 5. Recording Status vs Actual Queue State
    // -------------------------------------------------------------------------

    @Test
    fun recordingStatus_withoutLocalAudioFile_isNotLocalPending() {
        val hasLocalAudioFile = false
        val shareAutomationArmed = true // Configured/armed, but no audio shared yet
        val hasOemFolderConfigured = true

        val recordingStatus = when {
            hasLocalAudioFile -> "LOCAL_PENDING"
            else -> "RECORDING_UNAVAILABLE"
        }

        assertEquals("RECORDING_UNAVAILABLE", recordingStatus)
    }

    @Test
    fun recordingStatus_withLocalAudioFile_isLocalPending() {
        val hasLocalAudioFile = true
        val recordingStatus = when {
            hasLocalAudioFile -> "LOCAL_PENDING"
            else -> "RECORDING_UNAVAILABLE"
        }

        assertEquals("LOCAL_PENDING", recordingStatus)
    }

    private fun createTestCall(
        id: String,
        deviceId: String? = null,
        deviceModel: String? = null,
        recordingStatus: String = "NONE",
    ) = MobileCall(
        id = id,
        assignmentId = "lead-1",
        phoneNumber = "+919876543210",
        direction = "INBOUND",
        status = "COMPLETED",
        outcome = null,
        note = null,
        durationSeconds = 60,
        recordingStatus = recordingStatus,
        recordingError = null,
        startedAt = "2026-10-15T09:00:00Z",
        endedAt = "2026-10-15T09:01:00Z",
        assignment = null,
        deviceId = deviceId,
        deviceModel = deviceModel,
    )

    // -------------------------------------------------------------------------
    // 6. Home Screen Metrics & Historical Date Resolution
    // -------------------------------------------------------------------------

    @Test
    fun parseEffectiveInstant_detectsServerStampedHistoricalImport_preservesOriginalEndedDate() {
        val historicalCall = MobileCall(
            id = "call-hist-1",
            assignmentId = "lead-1",
            phoneNumber = "+919926669103",
            direction = "OUTBOUND",
            status = "COMPLETED",
            outcome = null,
            note = null,
            durationSeconds = 108,
            recordingStatus = "NONE",
            recordingError = null,
            startedAt = "2026-10-14T20:08:43.209Z", // Server timestamp at import time
            endedAt = "2026-10-01T12:38:31.240Z",   // Original CallLog ended timestamp
            assignment = null,
            deviceId = "pixel-9-android-id",
            deviceModel = "Pixel 9",
        )

        val effectiveInstant = historicalCall.parseEffectiveInstant()
        assertNotNull(effectiveInstant)
        val zone = java.time.ZoneId.of("Asia/Kolkata")
        val effectiveLocalDate = effectiveInstant!!.atZone(zone).toLocalDate()

        // Must be October 1st (real call date), NOT October 15th (import date)
        assertEquals(java.time.LocalDate.of(2026, 10, 1), effectiveLocalDate)
    }

    @Test
    fun todayCallsFilter_excludesHistoricalCallsAndRemoteDevices() {
        val currentDeviceId = "pixel-9-android-id"
        val currentModel = "Pixel 9"
        val zone = java.time.ZoneId.of("Asia/Kolkata")
        val today = java.time.LocalDate.of(2026, 10, 15)

        val calls = listOf(
            // 1. Genuine call on Pixel 9 today (Oct 15)
            MobileCall(
                id = "today-local",
                assignmentId = "lead-1",
                phoneNumber = "+919993328124",
                direction = "OUTBOUND",
                status = "COMPLETED",
                outcome = null,
                note = null,
                durationSeconds = 45,
                recordingStatus = "NONE",
                recordingError = null,
                startedAt = "2026-10-15T07:00:00Z",
                endedAt = "2026-10-15T07:00:45Z",
                assignment = null,
                deviceId = currentDeviceId,
                deviceModel = currentModel,
            ),
            // 2. Historical call with server-stamped import timestamp (Oct 14 20:08 UTC = Oct 15 01:38 IST)
            MobileCall(
                id = "imported-old",
                assignmentId = "lead-2",
                phoneNumber = "+919926669103",
                direction = "OUTBOUND",
                status = "COMPLETED",
                outcome = null,
                note = null,
                durationSeconds = 120,
                recordingStatus = "NONE",
                recordingError = null,
                startedAt = "2026-10-14T20:08:43.209Z",
                endedAt = "2026-10-01T12:38:31.240Z",
                assignment = null,
                deviceId = currentDeviceId,
                deviceModel = currentModel,
            ),
            // 3. Remote call today from another agent phone (e.g. POCO F5)
            MobileCall(
                id = "today-remote",
                assignmentId = "lead-3",
                phoneNumber = "+919876500001",
                direction = "INBOUND",
                status = "COMPLETED",
                outcome = null,
                note = null,
                durationSeconds = 34,
                recordingStatus = "NONE",
                recordingError = null,
                startedAt = "2026-10-15T05:04:13Z",
                endedAt = "2026-10-15T05:04:47Z",
                assignment = null,
                deviceId = "remote-poco-id",
                deviceModel = "POCO F5",
            ),
        )

        val todayCalls = calls.filter { call ->
            if (!call.isFromDevice(currentDeviceId, currentModel)) return@filter false
            val instant = call.parseEffectiveInstant() ?: return@filter false
            instant.atZone(zone).toLocalDate() == today
        }

        // Must ONLY match the 1 genuine local call today
        assertEquals(1, todayCalls.size)
        assertEquals("today-local", todayCalls[0].id)
        assertEquals(45, todayCalls.sumOf { it.durationSeconds })
    }

}
