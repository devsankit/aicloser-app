package com.gigxomi.gxclosers.data

import android.content.Context
import org.json.JSONObject

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("gxclosers_session", Context.MODE_PRIVATE)
    var token: String?
        get() = prefs.getString("token", null)
        set(value) { prefs.edit().putString("token", value).apply() }
    var setupComplete: Boolean
        get() = prefs.getBoolean("setupComplete", false)
        set(value) { prefs.edit().putBoolean("setupComplete", value).apply() }
    var session: Session?
        get() = prefs.getString("session", null)?.let { runCatching { parseSession(JSONObject(it)) }.getOrNull() }
        set(value) {
            val json = value?.let { JSONObject().put("userId", it.userId).put("displayName", it.displayName).put("email", it.email).put("phone", it.phone).toString() }
            prefs.edit().putString("session", json).apply()
        }
    fun saveLogin(token: String, session: Session) { prefs.edit().putString("token", token).putString("session", JSONObject().put("userId", session.userId).put("displayName", session.displayName).put("email", session.email).put("phone", session.phone).toString()).apply() }
    fun clear() { prefs.edit().clear().apply() }
}
