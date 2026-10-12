package com.gigxomi.gxclosers.data

import android.content.SharedPreferences
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.ConcurrentHashMap

class SessionTransferTest {

    private lateinit var inMemoryPrefs: InMemorySharedPreferences
    private lateinit var sessionStore: SessionStore

    @Before
    fun setUp() {
        inMemoryPrefs = InMemorySharedPreferences()
        sessionStore = SessionStore(prefsOverride = inMemoryPrefs)
    }

    @Test
    fun test1_ordinaryLogin_newDevice_requiresOnboarding() {
        val testSession = Session(
            userId = "agent-101",
            displayName = "Alex Carter",
            email = "alex@gigxomi.com",
            phone = "+919876543210"
        )
        // Fresh sign in: user has never completed onboarding on this device
        val isSetupComplete = sessionStore.saveLogin("tok-abc-123", testSession, setupComplete = null)

        assertFalse("New device sign-in must not assume onboarding is complete", isSetupComplete)
        assertFalse(sessionStore.setupComplete)
        assertEquals("tok-abc-123", sessionStore.token)
        assertEquals("agent-101", sessionStore.session?.userId)
        assertEquals("Alex Carter", sessionStore.session?.displayName)
    }

    @Test
    fun test2_occupiedSession_returnsConflictState() {
        // Simulate backend 409 conflict payload from acquireAppClientSession
        val conflictJson = JSONObject()
            .put("ok", false)
            .put("error", "ClientSlotOccupied")
            .put("message", "Your mobile account is already active on another device.")
            .put("deviceName", "Pixel 7 Pro")
            .put("lastActiveAt", "2026-10-12T14:30:00.000Z")

        val errorCode = conflictJson.optString("error")
        val errorMsg = conflictJson.optString("message")
        val devName = conflictJson.optString("deviceName").ifBlank { null }
        val activeAt = conflictJson.optString("lastActiveAt").ifBlank { null }

        val ex = ClientSlotOccupiedException(
            message = errorMsg,
            deviceName = devName,
            lastActiveAt = activeAt
        )

        assertEquals(409, ex.status)
        assertEquals("ClientSlotOccupied", ex.errorCode)
        assertEquals("Pixel 7 Pro", ex.deviceName)
        assertEquals("2026-10-12T14:30:00.000Z", ex.lastActiveAt)
        assertEquals("Your mobile account is already active on another device.", ex.message)
    }

    @Test
    fun test3_forcedTakeover_atomicallyRevokesAndMarksSetupComplete() {
        val testSession = Session(
            userId = "agent-202",
            displayName = "Sarah Connor",
            email = "sarah@gigxomi.com",
            phone = "+919876543211"
        )
        // User taps "Login here" (forceReplace = true): takeover atomically completes setup
        val isSetupComplete = sessionStore.saveLogin("tok-takeover-999", testSession, setupComplete = true)

        assertTrue("Takeover must atomically mark setup complete", isSetupComplete)
        assertTrue(sessionStore.setupComplete)
        assertTrue(sessionStore.isSetupCompleteForUser("agent-202"))
        assertEquals("tok-takeover-999", sessionStore.token)
        assertEquals("agent-202", sessionStore.session?.userId)
    }

    @Test
    fun test4_appRestartAfterTakeover_preservesSetupCompleteAndSession() {
        val testSession = Session(
            userId = "agent-303",
            displayName = "David Miller",
            email = "david@gigxomi.com",
            phone = "+919876543212"
        )
        sessionStore.saveLogin("tok-cold-restart-555", testSession, setupComplete = true)

        // Simulate app kill and cold start: create a brand new SessionStore reading the same preferences
        val restartedStore = SessionStore(prefsOverride = inMemoryPrefs)

        assertNotNull("Token must persist across restart", restartedStore.token)
        assertEquals("tok-cold-restart-555", restartedStore.token)
        assertEquals("agent-303", restartedStore.session?.userId)
        assertTrue("SetupComplete must persist reliably after app restart", restartedStore.setupComplete)
        assertTrue(restartedStore.isSetupCompleteForUser("agent-303"))
    }

    @Test
    fun test5_logoutAndRelogin_preservesSetupCompleteForSameUser() {
        val testSession = Session(
            userId = "agent-404",
            displayName = "Emma Watson",
            email = "emma@gigxomi.com",
            phone = "+919876543213"
        )
        // First login and completes setup
        sessionStore.saveLogin("tok-emma-111", testSession, setupComplete = true)
        assertTrue(sessionStore.setupComplete)
        assertTrue(sessionStore.isSetupCompleteForUser("agent-404"))

        // User logs out
        sessionStore.clearSession()

        // Active session is safely cleared
        assertNull("Token must be cleared on logout", sessionStore.token)
        assertNull("Session must be cleared on logout", sessionStore.session)
        assertFalse("Current active setup complete should reset to false", sessionStore.setupComplete)

        // Historical completion for Emma Watson is preserved!
        assertTrue("Saved onboarding completion for agent-404 must not be corrupted", sessionStore.isSetupCompleteForUser("agent-404"))

        // Same user logs in again (ordinary login without forceReplace)
        val reloginComplete = sessionStore.saveLogin("tok-emma-222", testSession, setupComplete = null)
        assertTrue("Re-login for the same user must restore setup complete", reloginComplete)
        assertTrue(sessionStore.setupComplete)
        assertEquals("tok-emma-222", sessionStore.token)
    }

    @Test
    fun test6_revokedHeartbeat_clearsSessionSafelyWithoutCorruptingUserData() {
        val testSession = Session(
            userId = "agent-505",
            displayName = "James Bond",
            email = "james@gigxomi.com",
            phone = "+919876543214"
        )
        sessionStore.saveLogin("tok-james-007", testSession, setupComplete = true)

        // Simulate heartbeat returning 401 SessionRevoked
        val revokedEx = SessionRevokedException("This client session is no longer active")
        assertEquals("SessionRevoked", revokedEx.errorCode)
        assertEquals(401, revokedEx.status)

        // handleSessionRevoked calls clearSession()
        sessionStore.clearSession()

        assertNull("Revocation must clear active token", sessionStore.token)
        assertNull("Revocation must clear active session", sessionStore.session)
        assertFalse(sessionStore.setupComplete)

        // User setup flag is still safe so future re-authentication won't repeat onboarding
        assertTrue(sessionStore.isSetupCompleteForUser("agent-505"))
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
