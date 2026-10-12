package com.gigxomi.gxclosers.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CallIdempotencyTest {

    private lateinit var inMemoryPrefs: InMemorySharedPreferences
    private lateinit var sessionStore: SessionStore
    private lateinit var fakeApi: FakeApiClient
    private lateinit var repository: CrmRepository

    private val sampleLead = SalesLead(
        id = "lead-999",
        customerName = "Jane Doe",
        customerPhone = "+919876543210",
        customerEmail = "jane@example.com",
        stage = "NEW",
        source = "DIRECT",
        serviceInterest = "Consulting",
        notes = "Interested in premium package",
        followUpAt = null,
        priority = "HIGH"
    )

    @Before
    fun setUp() {
        inMemoryPrefs = InMemorySharedPreferences()
        sessionStore = SessionStore(prefsOverride = inMemoryPrefs)
        fakeApi = FakeApiClient(sessionStore)
        repository = CrmRepository(sessionStore = sessionStore, api = fakeApi)
    }

    @Test
    fun startCall_autoGeneratesStableClientCallIdAndReturnsCallId() {
        var recordedPath = ""
        var recordedBody = JSONObject()

        fakeApi.postHandler = { path, body ->
            recordedPath = path
            recordedBody = body
            JSONObject().put("ok", true).put("call", JSONObject().put("id", "server-call-123"))
        }

        val callId = repository.startCall(sampleLead, deviceId = "dev-android-1")
        assertEquals("/sales/mobile/call/start", recordedPath)
        assertEquals("server-call-123", callId)
        assertEquals("lead-999", recordedBody.getString("leadId"))
        assertEquals("+919876543210", recordedBody.getString("phoneNumber"))
        assertEquals("OUTBOUND", recordedBody.getString("direction"))

        val clientCallId = recordedBody.getString("clientCallId")
        assertTrue("clientCallId must start with 'call-' prefix", clientCallId.startsWith("call-"))
        assertEquals(clientCallId, recordedBody.getString("callSessionId"))
        assertEquals(clientCallId, recordedBody.getString("idempotencyKey"))
    }

    @Test
    fun startCall_withExplicitCallSessionId_preservesIdempotencyKey() {
        var recordedBody = JSONObject()

        fakeApi.postHandler = { _, body ->
            recordedBody = body
            JSONObject().put("ok", true).put("call", JSONObject().put("id", "server-call-456"))
        }

        val explicitKey = "call-custom-session-uuid-777"
        val callId = repository.startCall(sampleLead, deviceId = "dev-android-1", callSessionId = explicitKey)

        assertEquals("server-call-456", callId)
        assertEquals(explicitKey, recordedBody.getString("clientCallId"))
        assertEquals(explicitKey, recordedBody.getString("callSessionId"))
        assertEquals(explicitKey, recordedBody.getString("idempotencyKey"))
    }

    @Test
    fun startIncomingCall_sendsClientCallIdAndIdempotencyKey() {
        var recordedBody = JSONObject()

        fakeApi.postHandler = { _, body ->
            recordedBody = body
            JSONObject().put("ok", true).put("call", JSONObject().put("id", "server-inbound-888"))
        }

        val callId = repository.startIncomingCall(
            leadId = "lead-999",
            phone = "+919993300000",
            deviceId = "dev-redmi-6a",
            contactName = "Caller 1"
        )

        assertEquals("server-inbound-888", callId)
        assertEquals("INBOUND", recordedBody.getString("direction"))
        assertEquals("+919993300000", recordedBody.getString("phoneNumber"))
        val clientKey = recordedBody.getString("clientCallId")
        assertTrue(clientKey.isNotBlank())
        assertEquals(clientKey, recordedBody.getString("callSessionId"))
        assertEquals(clientKey, recordedBody.getString("idempotencyKey"))
    }

    @Test
    fun startUnmatchedCall_withExplicitSessionId_preservesKeyAcrossRetries() {
        val capturedKeys = mutableListOf<String>()

        fakeApi.postHandler = { _, body ->
            capturedKeys.add(body.getString("clientCallId"))
            JSONObject().put("ok", true).put("call", JSONObject().put("id", "server-unmatched-999"))
        }

        val stableKey = "call-unmatched-retry-session-555"
        repository.startUnmatchedCall(
            leadId = null,
            phone = "+919876500000",
            direction = "INBOUND",
            deviceId = "dev-xiaomi",
            callSessionId = stableKey
        )

        repository.startUnmatchedCall(
            leadId = null,
            phone = "+919876500000",
            direction = "INBOUND",
            deviceId = "dev-xiaomi",
            callSessionId = stableKey
        )

        assertEquals(2, capturedKeys.size)
        assertEquals(stableKey, capturedKeys[0])
        assertEquals(stableKey, capturedKeys[1])
    }
}
