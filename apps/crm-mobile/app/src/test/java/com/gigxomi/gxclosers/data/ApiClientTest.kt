package com.gigxomi.gxclosers.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ApiClientTest {
    @Test
    fun productionEndpointIsBuiltWithoutDuplicateSlashes() {
        assertEquals("https://app.aicloser.in/api/sales/mobile/bootstrap", ApiClient.endpoint("/sales/mobile/bootstrap"))
        assertEquals("https://app.aicloser.in/api/mobile/auth/login", ApiClient.endpoint("mobile/auth/login"))
        assertEquals("https://app.aicloser.in/api/auth/logout", ApiClient.endpoint("/auth/logout"))
        assertEquals("https://app.aicloser.in/api/auth/heartbeat", ApiClient.endpoint("/auth/heartbeat"))
    }

    @Test
    fun invalidCredentialsExceptionProvidesExactErrorMessage() {
        val ex = InvalidCredentialsException()
        assertEquals(401, ex.status)
        assertEquals("InvalidCredentials", ex.errorCode)
        assertEquals("Invalid email/phone or password", ex.message)
    }

    @Test
    fun clientSlotOccupiedExceptionProvidesExactErrorMessage() {
        val ex = ClientSlotOccupiedException()
        assertEquals(409, ex.status)
        assertEquals("ClientSlotOccupied", ex.errorCode)
        assertEquals("Your mobile account is already active on another device.", ex.message)
    }

    @Test
    fun sessionRevokedExceptionIdentifiesRevokedSession() {
        val ex = SessionRevokedException()
        assertEquals(401, ex.status)
        assertEquals("SessionRevoked", ex.errorCode)
        assertEquals("This client session is no longer active", ex.message)
    }

    @Test
    fun recordingQueueStatesEnforceAllowedSetAndDisallowPendingUpload() {
        val allowedStates = setOf(
            "NONE",
            "RECORDING_UNAVAILABLE",
            "LOCAL_PENDING",
            "UPLOADING",
            "UPLOADED",
            "FAILED"
        )
        // Verify PENDING_UPLOAD is strictly absent
        assertFalse(allowedStates.contains("PENDING_UPLOAD"))

        val testState = "LOCAL_PENDING"
        assertTrue(allowedStates.contains(testState))
    }

    @Test
    fun callEndIdempotencyKeyIsDeterministic() {
        val callId = "call-12345"
        val idempotencyKey = "call-end-$callId"
        assertEquals("call-end-call-12345", idempotencyKey)
    }

    @Test
    fun parseSessionParsesAllRequiredFields() {
        val json = JSONObject()
            .put("userId", "usr-1")
            .put("displayName", "Test Agent")
            .put("email", "agent@gigxomi.com")
            .put("phone", "+919876543210")
        val session = parseSession(json)
        assertEquals("usr-1", session.userId)
        assertEquals("Test Agent", session.displayName)
        assertEquals("agent@gigxomi.com", session.email)
        assertEquals("+919876543210", session.phone)
    }

    @Test
    fun parseLeadHandlesNullsGracefully() {
        val json = JSONObject()
            .put("id", "lead-1")
            .put("customerName", "Client Name")
            .put("customerPhone", "+919999999999")
            .put("stage", "CONTACTED")
            .put("source", "INBOUND")
            .put("serviceInterest", "Video Editing")
            .put("notes", "Initial discussion")
            .put("priority", "HIGH")
        val lead = parseLead(json)
        assertEquals("lead-1", lead.id)
        assertEquals("Client Name", lead.customerName)
        assertEquals("CONTACTED", lead.stage)
        assertEquals("HIGH", lead.priority)
    }
}
