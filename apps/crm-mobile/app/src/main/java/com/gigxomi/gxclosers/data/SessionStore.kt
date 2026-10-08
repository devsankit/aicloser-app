package com.gigxomi.gxclosers.data

import android.content.Context
import org.json.JSONObject
import java.util.UUID

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("gxclosers_session", Context.MODE_PRIVATE)

    val installationId: String
        get() {
            val existing = prefs.getString("installation_id", null)
            if (!existing.isNullOrBlank()) return existing
            val newId = UUID.randomUUID().toString()
            prefs.edit().putString("installation_id", newId).apply()
            return newId
        }

    var token: String?
        get() = prefs.getString("token", null)
        set(value) { prefs.edit().putString("token", value).apply() }

    var setupComplete: Boolean
        get() = prefs.getBoolean("setupComplete", false)
        set(value) { prefs.edit().putBoolean("setupComplete", value).apply() }

    var session: Session?
        get() = prefs.getString("session", null)?.let { runCatching { parseSession(JSONObject(it)) }.getOrNull() }
        set(value) {
            val json = value?.let {
                JSONObject()
                    .put("userId", it.userId)
                    .put("displayName", it.displayName)
                    .put("email", it.email)
                    .put("phone", it.phone)
                    .toString()
            }
            prefs.edit().putString("session", json).apply()
        }

    fun saveLogin(token: String, session: Session) {
        prefs.edit()
            .putString("token", token)
            .putString("session", JSONObject()
                .put("userId", session.userId)
                .put("displayName", session.displayName)
                .put("email", session.email)
                .put("phone", session.phone)
                .toString())
            .apply()
    }

    fun clear() {
        val stableInstallId = installationId
        prefs.edit().clear().putString("installation_id", stableInstallId).apply()
    }
}
