package com.gigxomi.gxclosers.call

import com.gigxomi.gxclosers.data.MobileCall
import com.gigxomi.gxclosers.data.parseBootstrap
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CallDirectionAndFilterTest {

    @Test
    fun parseBootstrap_preservesInboundDirection() {
        val json = JSONObject().apply {
            put("calls", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "call-inbound-1")
                    put("phoneNumber", "+919876543210")
                    put("direction", "INBOUND")
                    put("status", "COMPLETED")
                    put("startedAt", "2026-10-15T09:00:00Z")
                })
            })
        }

        val bootstrap = parseBootstrap(json)
        assertEquals(1, bootstrap.calls.size)
        val call = bootstrap.calls.first()
        assertEquals("INBOUND", call.direction)
        assertEquals("COMPLETED", call.status)
    }

    @Test
    fun parseBootstrap_preservesOutboundDirection() {
        val json = JSONObject().apply {
            put("calls", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "call-outbound-1")
                    put("phoneNumber", "+919876543210")
                    put("direction", "OUTBOUND")
                    put("status", "COMPLETED")
                    put("startedAt", "2026-10-15T09:00:00Z")
                })
            })
        }

        val bootstrap = parseBootstrap(json)
        val call = bootstrap.calls.first()
        assertEquals("OUTBOUND", call.direction)
    }

    @Test
    fun parseBootstrap_missingOrBlankDirection_defaultsToUnknownNotOutbound() {
        val json = JSONObject().apply {
            put("calls", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "call-blank-1")
                    put("phoneNumber", "+919876543210")
                    put("direction", "")
                    put("status", "COMPLETED")
                    put("startedAt", "2026-10-15T09:00:00Z")
                })
                put(JSONObject().apply {
                    put("id", "call-null-2")
                    put("phoneNumber", "+919876543210")
                    put("status", "COMPLETED")
                    put("startedAt", "2026-10-15T09:01:00Z")
                })
            })
        }

        val bootstrap = parseBootstrap(json)
        assertEquals(2, bootstrap.calls.size)
        assertEquals("UNKNOWN", bootstrap.calls[0].direction)
        assertEquals("UNKNOWN", bootstrap.calls[1].direction)
    }

    @Test
    fun callFiltering_allTab_returnsAllCalls() {
        val calls = createTestCalls()
        val allCalls = filterCalls(calls, "All")
        assertEquals(4, allCalls.size)
    }

    @Test
    fun callFiltering_inboundTab_onlyReturnsInboundCalls() {
        val calls = createTestCalls()
        val inbound = filterCalls(calls, "Inbound")
        assertEquals(1, inbound.size)
        assertEquals("call-inbound", inbound.first().id)
        assertEquals("INBOUND", inbound.first().direction)
        assertFalse(inbound.any { it.status.equals("MISSED", true) || it.durationSeconds <= 0 })
    }

    @Test
    fun callFiltering_inboundTab_strictlyExcludesMissedCallsEvenIfDirectionIsInbound() {
        val calls = createTestCalls()
        val inbound = filterCalls(calls, "Inbound")
        assertFalse("Inbound list must never contain missed call", inbound.any { it.id == "call-missed" })
    }

    @Test
    fun callFiltering_outboundTab_onlyReturnsOutboundCalls() {
        val calls = createTestCalls()
        val outbound = filterCalls(calls, "Outbound")
        assertEquals(1, outbound.size)
        assertEquals("call-outbound", outbound.first().id)
        assertEquals("OUTBOUND", outbound.first().direction)
    }

    @Test
    fun callFiltering_missedTab_returnsMissedCalls() {
        val calls = createTestCalls()
        val missed = filterCalls(calls, "Missed")
        assertEquals(1, missed.size)
        assertEquals("call-missed", missed.first().id)
    }

    private fun createTestCalls(): List<MobileCall> = listOf(
        MobileCall(
            id = "call-inbound",
            assignmentId = "a1",
            phoneNumber = "+919876543210",
            direction = "INBOUND",
            status = "COMPLETED",
            outcome = null,
            note = null,
            durationSeconds = 60,
            recordingStatus = "UPLOADED",
            recordingError = null,
            startedAt = "2026-10-15T09:00:00Z",
            endedAt = "2026-10-15T09:01:00Z",
            assignment = null
        ),
        MobileCall(
            id = "call-outbound",
            assignmentId = "a2",
            phoneNumber = "+919876543211",
            direction = "OUTBOUND",
            status = "COMPLETED",
            outcome = null,
            note = null,
            durationSeconds = 45,
            recordingStatus = "UPLOADED",
            recordingError = null,
            startedAt = "2026-10-15T09:05:00Z",
            endedAt = "2026-10-15T09:05:45Z",
            assignment = null
        ),
        MobileCall(
            id = "call-missed",
            assignmentId = "a3",
            phoneNumber = "+919876543212",
            direction = "INBOUND",
            status = "MISSED",
            outcome = null,
            note = null,
            durationSeconds = 0,
            recordingStatus = "NONE",
            recordingError = null,
            startedAt = "2026-10-15T09:10:00Z",
            endedAt = "2026-10-15T09:10:00Z",
            assignment = null
        ),
        MobileCall(
            id = "call-unknown",
            assignmentId = "a4",
            phoneNumber = "+919876543213",
            direction = "UNKNOWN",
            status = "COMPLETED",
            outcome = null,
            note = null,
            durationSeconds = 30,
            recordingStatus = "NONE",
            recordingError = null,
            startedAt = "2026-10-15T09:15:00Z",
            endedAt = "2026-10-15T09:15:30Z",
            assignment = null
        )
    )

    private fun filterCalls(calls: List<MobileCall>, tab: String): List<MobileCall> {
        return calls.filter { call ->
            when (tab.lowercase()) {
                "all" -> true
                "missed" -> call.status.equals("MISSED", true) || call.direction.equals("MISSED", true) || call.durationSeconds <= 0
                "inbound" -> (call.direction.equals("INBOUND", true) ||
                    call.direction.equals("INCOMING", true) ||
                    call.direction.equals("RECEIVED", true)) &&
                    !call.status.equals("MISSED", true) &&
                    !call.direction.equals("MISSED", true) &&
                    call.durationSeconds > 0
                "outbound" -> (call.direction.equals("OUTBOUND", true) || call.direction.equals("DIALED", true)) &&
                    !call.status.equals("MISSED", true) &&
                    !call.direction.equals("MISSED", true) &&
                    call.durationSeconds > 0
                else -> true
            }
        }.sortedByDescending { it.endedAt?.takeIf(String::isNotBlank) ?: it.startedAt }
    }
}
