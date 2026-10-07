package com.gigxomi.gxclosers.call

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.gigxomi.gxclosers.data.SalesLead

object CallManager {
    fun cacheLeads(context: Context, leads: List<SalesLead>) {
        val editor = context.getSharedPreferences("gxclosers_leads", Context.MODE_PRIVATE).edit().clear()
        leads.forEach { lead -> lead.customerPhone.filter(Char::isDigit).takeLast(10).takeIf(String::isNotBlank)?.let { editor.putString(it, listOf(lead.id, lead.customerName, lead.stage, lead.notes).joinToString("\u001F")) } }
        editor.apply()
    }
    fun prepare(context: Context, callId: String, lead: SalesLead) {
        context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE).edit().putString("activeCallId", callId).putString("activeLeadId", lead.id).putString("activePhone", lead.customerPhone).putLong("activeStartedAt", System.currentTimeMillis()).apply()
        LeadCallNotification.show(context, lead.customerPhone)
    }
    fun dial(context: Context, phone: String) {
        val direct = Intent(Intent.ACTION_CALL, Uri.parse("tel:${Uri.encode(phone)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(direct) }.getOrElse { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
}
