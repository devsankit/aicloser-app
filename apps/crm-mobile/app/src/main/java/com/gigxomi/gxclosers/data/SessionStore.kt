package com.gigxomi.gxclosers.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.util.UUID

class SessionStore(
    context: Context? = null,
    prefsOverride: SharedPreferences? = null
) {
    private val lock = Any()
    private val prefs: SharedPreferences = prefsOverride
        ?: context?.getSharedPreferences("gxclosers_session", Context.MODE_PRIVATE)
        ?: error("A valid Context or SharedPreferences instance is required for SessionStore.")

    val installationId: String
        get() = synchronized(lock) {
            val existing = prefs.getString(KEY_INSTALLATION_ID, null)
            if (!existing.isNullOrBlank()) return existing
            val newId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_INSTALLATION_ID, newId).commit()
            newId
        }

    var token: String?
        get() = synchronized(lock) { prefs.getString(KEY_TOKEN, null) }
        set(value) = synchronized(lock) {
            if (value != null) {
                prefs.edit().putString(KEY_TOKEN, value).commit()
            } else {
                prefs.edit().remove(KEY_TOKEN).commit()
            }
        }

    var setupComplete: Boolean
        get() = synchronized(lock) { prefs.getBoolean(KEY_SETUP_COMPLETE, false) }
        set(value) = synchronized(lock) {
            val editor = prefs.edit().putBoolean(KEY_SETUP_COMPLETE, value)
            if (value) {
                session?.userId?.takeIf { it.isNotBlank() }?.let { uid ->
                    editor.putBoolean(KEY_SETUP_USER_PREFIX + uid, true)
                }
            }
            editor.commit()
        }

    var certificationStatus: String
        get() = synchronized(lock) { prefs.getString(KEY_CERTIFICATION_STATUS, "UNVERIFIED") ?: "UNVERIFIED" }
        set(value) = synchronized(lock) { prefs.edit().putString(KEY_CERTIFICATION_STATUS, value).commit() }

    var certificationFailureReason: String?
        get() = synchronized(lock) { prefs.getString(KEY_CERTIFICATION_FAILURE_REASON, null) }
        set(value) = synchronized(lock) {
            if (value != null) {
                prefs.edit().putString(KEY_CERTIFICATION_FAILURE_REASON, value).commit()
            } else {
                prefs.edit().remove(KEY_CERTIFICATION_FAILURE_REASON).commit()
            }
        }

    var lastTestSessionId: String?
        get() = synchronized(lock) { prefs.getString(KEY_LAST_TEST_SESSION_ID, null) }
        set(value) = synchronized(lock) {
            if (value != null) {
                prefs.edit().putString(KEY_LAST_TEST_SESSION_ID, value).commit()
            } else {
                prefs.edit().remove(KEY_LAST_TEST_SESSION_ID).commit()
            }
        }

    var testCallStartedAt: Long
        get() = synchronized(lock) { prefs.getLong(KEY_TEST_CALL_STARTED_AT, 0L) }
        set(value) = synchronized(lock) { prefs.edit().putLong(KEY_TEST_CALL_STARTED_AT, value).commit() }

    var session: Session?
        get() = synchronized(lock) {
            prefs.getString(KEY_SESSION, null)?.let { runCatching { parseSession(JSONObject(it)) }.getOrNull() }
        }
        set(value) = synchronized(lock) {
            val json = value?.let {
                JSONObject()
                    .put("userId", it.userId)
                    .put("displayName", it.displayName)
                    .put("email", it.email)
                    .put("phone", it.phone)
                    .toString()
            }
            if (json != null) {
                prefs.edit().putString(KEY_SESSION, json).commit()
            } else {
                prefs.edit().remove(KEY_SESSION).commit()
            }
        }

    fun isSetupCompleteForUser(userId: String?): Boolean = synchronized(lock) {
        if (userId.isNullOrBlank()) return false
        prefs.getBoolean(KEY_SETUP_USER_PREFIX + userId, false)
    }

    fun markSetupComplete(userId: String? = null) = synchronized(lock) {
        val editor = prefs.edit().putBoolean(KEY_SETUP_COMPLETE, true)
        val targetUid = userId ?: session?.userId
        if (!targetUid.isNullOrBlank()) {
            editor.putBoolean(KEY_SETUP_USER_PREFIX + targetUid, true)
        }
        editor.commit()
    }

    fun saveLogin(token: String, session: Session, setupComplete: Boolean? = null): Boolean = synchronized(lock) {
        val isSetupDone = setupComplete ?: isSetupCompleteForUser(session.userId)
        val editor = prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(
                KEY_SESSION,
                JSONObject()
                    .put("userId", session.userId)
                    .put("displayName", session.displayName)
                    .put("email", session.email)
                    .put("phone", session.phone)
                    .toString()
            )
            .putBoolean(KEY_SETUP_COMPLETE, isSetupDone)

        if (isSetupDone && session.userId.isNotBlank()) {
            editor.putBoolean(KEY_SETUP_USER_PREFIX + session.userId, true)
        }
        editor.commit()
        isSetupDone
    }

    fun clearSession() = synchronized(lock) {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_SESSION)
            .putBoolean(KEY_SETUP_COMPLETE, false)
            .putString(KEY_CERTIFICATION_STATUS, "UNVERIFIED")
            .remove(KEY_CERTIFICATION_FAILURE_REASON)
            .remove(KEY_LAST_TEST_SESSION_ID)
            .remove(KEY_TEST_CALL_STARTED_AT)
            .commit()
    }

    fun clear() {
        clearSession()
    }

    companion object {
        const val KEY_INSTALLATION_ID = "installation_id"
        const val KEY_TOKEN = "token"
        const val KEY_SESSION = "session"
        const val KEY_SETUP_COMPLETE = "setupComplete"
        const val KEY_SETUP_USER_PREFIX = "setup_complete_user_"
        const val KEY_CERTIFICATION_STATUS = "certificationStatus"
        const val KEY_CERTIFICATION_FAILURE_REASON = "certificationFailureReason"
        const val KEY_LAST_TEST_SESSION_ID = "lastTestSessionId"
        const val KEY_TEST_CALL_STARTED_AT = "testCallStartedAt"
    }
}

