package com.gigxomi.gxclosers.call

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.gigxomi.gxclosers.data.SalesLead
import org.json.JSONObject

data class CachedLead(
    val id: String,
    val name: String,
    val phone: String,
    val stage: String,
    val notes: String,
    val source: String,
    val serviceInterest: String,
    val email: String,
)

object CallManager {
    fun cacheLeads(context: Context, leads: List<SalesLead>) {
        val editor = context.getSharedPreferences("gxclosers_leads", Context.MODE_PRIVATE).edit().clear()
        leads.forEach { lead ->
            lead.customerPhone.filter(Char::isDigit).takeLast(10).takeIf(String::isNotBlank)?.let { key ->
                editor.putString(key, JSONObject()
                    .put("id", lead.id)
                    .put("name", lead.customerName)
                    .put("phone", lead.customerPhone)
                    .put("stage", lead.stage)
                    .put("notes", lead.notes)
                    .put("source", lead.source)
                    .put("serviceInterest", lead.serviceInterest)
                    .put("email", lead.customerEmail)
                    .toString())
            }
        }
        editor.apply()
    }

    fun lookup(context: Context, phone: String): CachedLead? {
        val key = phone.filter(Char::isDigit).takeLast(10)
        if (key.isBlank()) return null
        val raw = context.getSharedPreferences("gxclosers_leads", Context.MODE_PRIVATE).getString(key, null) ?: return null
        return runCatching {
            val json = JSONObject(raw)
            CachedLead(
                id = json.optString("id"),
                name = json.optString("name", "Unknown caller"),
                phone = json.optString("phone", phone),
                stage = json.optString("stage"),
                notes = json.optString("notes"),
                source = json.optString("source"),
                serviceInterest = json.optString("serviceInterest"),
                email = json.optString("email"),
            )
        }.getOrElse {
            val legacy = raw.split("\u001F")
            CachedLead(
                id = legacy.getOrNull(0).orEmpty(),
                name = legacy.getOrNull(1).orEmpty().ifBlank { "Unknown caller" },
                phone = phone,
                stage = legacy.getOrNull(2).orEmpty(),
                notes = legacy.getOrNull(3).orEmpty(),
                source = "",
                serviceInterest = "",
                email = "",
            )
        }.takeIf { it.id.isNotBlank() }
    }

    fun prepare(context: Context, callId: String, lead: SalesLead) {
        context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE).edit()
            .putString("activeCallId", callId)
            .putString("activeLeadId", lead.id)
            .putString("activePhone", lead.customerPhone)
            .putString("direction", "OUTBOUND")
            .putBoolean("wasOffhook", false)
            .putLong("activeStartedAt", System.currentTimeMillis())
            .apply()
        LeadCallNotification.show(context, lead.customerPhone)
    }
    fun dial(context: Context, phone: String) {
        val direct = Intent(Intent.ACTION_CALL, Uri.parse("tel:${Uri.encode(phone)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(direct) }.getOrElse { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
}
