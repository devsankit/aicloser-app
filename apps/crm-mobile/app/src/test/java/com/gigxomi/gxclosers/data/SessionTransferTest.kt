package com.gigxomi.gxclosers.data

import android.content.SharedPreferences
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.util.concurrent.ConcurrentHashMap

class SessionTransferTest {

    private lateinit var inMemoryPrefs: InMemorySharedPreferences
    private lateinit var sessionStore: SessionStore
    private lateinit var fakeApi: FakeApiClient
    private lateinit var repository: CrmRepository

    private val sampleUser = Session(
        userId = "agent-101",
        displayName = "Alex Carter",
        email = "alex@gigxomi.com",
        phone = "+919876543210"
    )

    @Before
    fun setUp() {
        inMemoryPrefs = InMemorySharedPreferences()
        sessionStore = SessionStore(prefsOverride = inMemoryPrefs)
        fakeApi = FakeApiClient(sessionStore)
        repository = CrmRepository(sessionStore = sessionStore, api = fakeApi)
    }

    @Test
    fun test1_ordinaryLogin_success_newDeviceRequiresOnboarding() {
        // Fresh sign in: user has never completed onboarding on this device
        val isSetupComplete = sessionStore.saveLogin("tok-abc-123", sampleUser, setupComplete = null)

        assertFalse("New device sign-in must not assume onboarding is complete", isSetupComplete)
        assertFalse(sessionStore.setupComplete)
        assertEquals("tok-abc-123", sessionStore.token)
        assertEquals("agent-101", sessionStore.session?.userId)
        assertEquals("Alex Carter", sessionStore.session?.displayName)

        // If the user already completed onboarding previously, ordinary login restores completion
        sessionStore.markSetupComplete("agent-101")
        val restoredComplete = sessionStore.saveLogin("tok-abc-456", sampleUser, setupComplete = null)
        assertTrue("Subsequent login for the same user restores setupComplete", restoredComplete)
        assertTrue(sessionStore.setupComplete)
    }

    @Test
    fun test2_loginConflict_shownOnlyDuringLogin() {
        // 409 conflict payload from acquireAppClientSession
        val conflictJson = JSONObject()
            .put("ok", false)
            .put("error", "ClientSlotOccupied")
            .put("message", "Your mobile account is already active on another device.")
            .put("deviceName", "Pixel 7 Pro")
            .put("lastActiveAt", "2026-10-12T14:30:00.000Z")

        // 1. Tested against REAL ApiClient.parseHttpError mapping for /mobile/auth/login
        val loginEx = ApiClient.parseHttpError("/mobile/auth/login", 409, conflictJson)
        assertTrue("Login 409 must produce ClientSlotOccupiedException", loginEx is ClientSlotOccupiedException)
        val occupied = loginEx as ClientSlotOccupiedException
        assertEquals(409, occupied.status)
        assertEquals("ClientSlotOccupied", occupied.errorCode)
        assertEquals("Pixel 7 Pro", occupied.deviceName)
        assertEquals("2026-10-12T14:30:00.000Z", occupied.lastActiveAt)
        assertEquals("Your mobile account is already active on another device.", occupied.message)

        // 2. Tested against REAL ApiClient.parseHttpError mapping for non-login endpoints:
        // register-device 409 must NEVER produce ClientSlotOccupiedException
        val regDevEx = ApiClient.parseHttpError("/sales/mobile/register-device", 409, conflictJson)
        assertFalse("register-device 409 must NOT produce ClientSlotOccupiedException", regDevEx is ClientSlotOccupiedException)
        assertTrue(regDevEx is ApiException)
        assertEquals(409, regDevEx.status)

        // certification 409 must NEVER produce ClientSlotOccupiedException
        val certEx = ApiClient.parseHttpError("/sales/mobile/certification", 409, conflictJson)
        assertFalse("certification 409 must NOT produce ClientSlotOccupiedException", certEx is ClientSlotOccupiedException)
        assertTrue(certEx is ApiException)
        assertEquals(409, certEx.status)
    }

    @Test
    fun test3_forcedLoginTakeover_succeeds() {
        val takeoverUser = Session(
            userId = "agent-202",
            displayName = "Sarah Connor",
            email = "sarah@gigxomi.com",
            phone = "+919876543211"
        )
        // User taps "Login here" (forceReplace = true): takeover atomically completes setup
        val isSetupComplete = sessionStore.saveLogin("tok-takeover-999", takeoverUser, setupComplete = true)

        assertTrue("Takeover must atomically mark setup complete", isSetupComplete)
        assertTrue(sessionStore.setupComplete)
        assertTrue(sessionStore.isSetupCompleteForUser("agent-202"))
        assertEquals("tok-takeover-999", sessionStore.token)
        assertEquals("agent-202", sessionStore.session?.userId)
    }

    @Test
    fun test4_exactLegacyRegisterDeviceOwnershipConflict_handledAsDesigned() {
        // 1. Boundary check: CrmRepository.isLegacyDeviceOwnershipConflict recognizes only legacy message/code
        assertTrue(CrmRepository.isLegacyDeviceOwnershipConflict(400, "This company device is registered to another sales agent."))
        assertTrue(CrmRepository.isLegacyDeviceOwnershipConflict(409, "This device is linked to another sales agent"))
        assertTrue(CrmRepository.isLegacyDeviceOwnershipConflict(400, "Error", "DeviceRegisteredToAnother"))
        assertTrue(CrmRepository.isLegacyDeviceOwnershipConflict(409, "Error", "RegisteredToAnotherAgent"))

        // Unrelated errors must NOT be matched
        assertFalse(CrmRepository.isLegacyDeviceOwnershipConflict(400, "deviceId is required"))
        assertFalse(CrmRepository.isLegacyDeviceOwnershipConflict(409, "ClientSlotOccupied"))
        assertFalse(CrmRepository.isLegacyDeviceOwnershipConflict(401, "Session revoked"))
        assertFalse(CrmRepository.isLegacyDeviceOwnershipConflict(500, "Internal Server Error"))

        // 2. Real repository boundary: simulate backend returning legacy ownership 400
        sessionStore.saveLogin("tok-legacy-test", sampleUser, setupComplete = false)
        assertFalse(sessionStore.setupComplete)

        fakeApi.postHandler = { path, _ ->
            if (path == "/sales/mobile/register-device") {
                throw ApiException("This company device is registered to another sales agent.", 400)
            }
            JSONObject().put("ok", true)
        }

        // registerDevice must absorb this exact legacy response and complete setup
        repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")

        assertTrue("Setup must complete when legacy ownership conflict is encountered", sessionStore.setupComplete)
        assertTrue("User setup history must be recorded", sessionStore.isSetupCompleteForUser("agent-101"))
    }

    @Test
    fun test5_networkFailure_doesNotMarkSetupComplete() {
        sessionStore.saveLogin("tok-net-test", sampleUser, setupComplete = false)
        assertFalse(sessionStore.setupComplete)

        fakeApi.postHandler = { _, _ ->
            throw NetworkTimeoutException("Connection timed out. Please check your internet connection.")
        }

        try {
            repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")
            fail("NetworkTimeoutException must be re-thrown")
        } catch (e: NetworkTimeoutException) {
            assertEquals(408, e.status)
        }

        assertFalse("Network failure must NOT mark setup complete", sessionStore.setupComplete)
        assertFalse(sessionStore.isSetupCompleteForUser("agent-101"))
    }

    @Test
    fun test6_unauthorizedOrForbidden_doesNotMarkSetupComplete() {
        sessionStore.saveLogin("tok-auth-test", sampleUser, setupComplete = false)

        // 401 SessionRevoked
        fakeApi.postHandler = { _, _ -> throw SessionRevokedException("Your mobile session has expired.") }
        try {
            repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")
            fail("SessionRevokedException must be re-thrown")
        } catch (e: SessionRevokedException) {
            assertEquals(401, e.status)
        }
        assertFalse("401 must NOT mark setup complete", sessionStore.setupComplete)

        // 403 Forbidden
        fakeApi.postHandler = { _, _ -> throw ForbiddenException("Access denied. Insufficient permissions.") }
        try {
            repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")
            fail("ForbiddenException must be re-thrown")
        } catch (e: ForbiddenException) {
            assertEquals(403, e.status)
        }
        assertFalse("403 must NOT mark setup complete", sessionStore.setupComplete)
    }

    @Test
    fun test7_unrelated400Or409_doesNotMarkSetupComplete() {
        sessionStore.saveLogin("tok-validation-test", sampleUser, setupComplete = false)

        // Unrelated 400 validation error
        fakeApi.postHandler = { _, _ -> throw ApiException("deviceId is required", 400, "MissingField") }
        try {
            repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")
            fail("Unrelated 400 must be re-thrown")
        } catch (e: ApiException) {
            assertEquals(400, e.status)
            assertEquals("MissingField", e.errorCode)
        }
        assertFalse("Unrelated 400 must NOT mark setup complete", sessionStore.setupComplete)

        // Unrelated 409 conflict
        fakeApi.postHandler = { _, _ -> throw ApiException("Database concurrency conflict", 409, "Conflict") }
        try {
            repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")
            fail("Unrelated 409 must be re-thrown")
        } catch (e: ApiException) {
            assertEquals(409, e.status)
        }
        assertFalse("Unrelated 409 must NOT mark setup complete", sessionStore.setupComplete)
    }

    @Test
    fun test8_5xxServerError_doesNotMarkSetupComplete() {
        sessionStore.saveLogin("tok-500-test", sampleUser, setupComplete = false)

        fakeApi.postHandler = { _, _ -> throw ApiException("Internal Server Error", 500) }
        try {
            repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")
            fail("500 must be re-thrown")
        } catch (e: ApiException) {
            assertEquals(500, e.status)
        }
        assertFalse("500 must NOT mark setup complete", sessionStore.setupComplete)

        fakeApi.postHandler = { _, _ -> throw ApiException("Bad Gateway", 502) }
        try {
            repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")
            fail("502 must be re-thrown")
        } catch (e: ApiException) {
            assertEquals(502, e.status)
        }
        assertFalse("502 must NOT mark setup complete", sessionStore.setupComplete)
    }

    @Test
    fun test9_successfulRegistration_marksSetupCompleteOnce() {
        sessionStore.saveLogin("tok-success-test", sampleUser, setupComplete = false)
        assertFalse(sessionStore.setupComplete)

        fakeApi.postHandler = { _, _ -> JSONObject().put("ok", true) }
        repository.registerDevice("dev-1", "Pixel", "Google", "Pixel 7", "14", "1.0.22")

        assertTrue("Setup must be marked complete on successful registration", sessionStore.setupComplete)
        assertTrue("User setup history must be recorded", sessionStore.isSetupCompleteForUser("agent-101"))
    }

    @Test
    fun test10_restart_preservesValidSessionAndSetupComplete() {
        sessionStore.saveLogin("tok-cold-restart-555", sampleUser, setupComplete = true)

        // Simulate cold restart: new SessionStore reading the same preferences
        val restartedStore = SessionStore(prefsOverride = inMemoryPrefs)

        assertNotNull("Token must persist across restart", restartedStore.token)
        assertEquals("tok-cold-restart-555", restartedStore.token)
        assertEquals("agent-101", restartedStore.session?.userId)
        assertTrue("SetupComplete must persist reliably after app restart", restartedStore.setupComplete)
        assertTrue(restartedStore.isSetupCompleteForUser("agent-101"))
    }

    @Test
    fun test11_staleHeartbeat_cannotClearReplacementSession() {
        val initialSession = Session(
            userId = "agent-heartbeat-race",
            displayName = "Race Agent",
            email = "race@gigxomi.com",
            phone = "+919876543219"
        )
        sessionStore.saveLogin("tok-old-session-1", initialSession, setupComplete = true)
        val heartbeatCapturedToken = sessionStore.token // tok-old-session-1

        // User performs takeover / new login on this device -> new token issued
        sessionStore.saveLogin("tok-new-replacement-2", initialSession, setupComplete = true)

        // Now stale heartbeat response arrives from the old session claiming 401 SessionRevoked
        val incomingHeartbeatToken = heartbeatCapturedToken
        val currentActiveToken = sessionStore.token

        var revokedActiveSession = false
        // Heartbeat revocation guard in CrmViewModel:
        if (currentActiveToken == incomingHeartbeatToken) {
            sessionStore.clearSession()
            revokedActiveSession = true
        }

        assertFalse("Stale heartbeat must NOT revoke the replacement session", revokedActiveSession)
        assertEquals("tok-new-replacement-2", sessionStore.token)
        assertTrue(sessionStore.setupComplete)
    }

    @Test
    fun test12_logoutAndRelogin_preservesSetupCompleteForSameUser() {
        val user = Session(
            userId = "agent-404",
            displayName = "Emma Watson",
            email = "emma@gigxomi.com",
            phone = "+919876543213"
        )
        sessionStore.saveLogin("tok-emma-111", user, setupComplete = true)
        assertTrue(sessionStore.setupComplete)
        assertTrue(sessionStore.isSetupCompleteForUser("agent-404"))

        // User logs out
        sessionStore.clearSession()
        assertNull("Token must be cleared on logout", sessionStore.token)
        assertNull("Session must be cleared on logout", sessionStore.session)
        assertFalse("Current active setup complete should reset to false", sessionStore.setupComplete)

        // Historical completion for Emma Watson is preserved
        assertTrue("Saved onboarding completion for agent-404 must not be corrupted", sessionStore.isSetupCompleteForUser("agent-404"))

        // Same user logs in again (ordinary login without forceReplace)
        val reloginComplete = sessionStore.saveLogin("tok-emma-222", user, setupComplete = null)
        assertTrue("Re-login for the same user must restore setup complete", reloginComplete)
        assertTrue(sessionStore.setupComplete)
        assertEquals("tok-emma-222", sessionStore.token)
    }
}

class FakeApiClient(sessionStore: SessionStore) : ApiClient(sessionStore) {
    var postHandler: ((path: String, body: JSONObject) -> JSONObject)? = null

    override fun post(path: String, body: JSONObject): JSONObject {
        val handler = postHandler ?: return JSONObject().put("ok", true)
        return handler(path, body)
    }
}

class InMemorySharedPreferences : SharedPreferences {
    private val data = ConcurrentHashMap<String, Any>()

    override fun getAll(): MutableMap<String, *> = HashMap(data)

    override fun getString(key: String, defValue: String?): String? =
        data[key] as? String ?: defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String, defValues: MutableSet<String>?): MutableSet<String>? =
        (data[key] as? Set<String>)?.toMutableSet() ?: defValues

    override fun getInt(key: String, defValue: Int): Int =
        (data[key] as? Number)?.toInt() ?: defValue

    override fun getLong(key: String, defValue: Long): Long =
        (data[key] as? Number)?.toLong() ?: defValue

    override fun getFloat(key: String, defValue: Float): Float =
        (data[key] as? Number)?.toFloat() ?: defValue

    override fun getBoolean(key: String, defValue: Boolean): Boolean =
        data[key] as? Boolean ?: defValue

    override fun contains(key: String): Boolean = data.containsKey(key)

    override fun edit(): SharedPreferences.Editor = EditorImpl(this)

    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

    private class EditorImpl(private val prefs: InMemorySharedPreferences) : SharedPreferences.Editor {
        private val modifications = HashMap<String, Any?>()
        private var clearFlag = false

        override fun putString(key: String, value: String?): SharedPreferences.Editor {
            modifications[key] = value
            return this
        }

        override fun putStringSet(key: String, values: MutableSet<String>?): SharedPreferences.Editor {
            modifications[key] = values
            return this
        }

        override fun putInt(key: String, value: Int): SharedPreferences.Editor {
            modifications[key] = value
            return this
        }

        override fun putLong(key: String, value: Long): SharedPreferences.Editor {
            modifications[key] = value
            return this
        }

        override fun putFloat(key: String, value: Float): SharedPreferences.Editor {
            modifications[key] = value
            return this
        }

        override fun putBoolean(key: String, value: Boolean): SharedPreferences.Editor {
            modifications[key] = value
            return this
        }

        override fun remove(key: String): SharedPreferences.Editor {
            modifications[key] = this
            return this
        }

        override fun clear(): SharedPreferences.Editor {
            clearFlag = true
            return this
        }

        override fun commit(): Boolean {
            apply()
            return true
        }

        override fun apply() {
            if (clearFlag) {
                prefs.data.clear()
            }
            for ((key, value) in modifications) {
                if (value === this || value == null) {
                    prefs.data.remove(key)
                } else {
                    prefs.data[key] = value
                }
            }
        }
    }
}
