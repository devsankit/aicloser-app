package com.gigxomi.gxclosers.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.TelephonyManager
import com.gigxomi.gxclosers.data.OfflineEventStore
import org.json.JSONObject
import java.time.Instant

class PhoneStateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "android.intent.action.PHONE_STATE") return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)?.substringAfterLast('_') ?: return
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        val incoming = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER).orEmpty()
        val phone = incoming.ifBlank { prefs.getString("activePhone", prefs.getString("phone", "")).orEmpty() }
        prefs.edit().putString("state", state).putString("phone", phone).putLong("updatedAt", System.currentTimeMillis()).apply()
        if (state == "RINGING" && phone.isNotBlank()) LeadCallNotification.show(context, phone)
        if (state == "OFFHOOK") {
            val callId = prefs.getString("activeCallId", null) ?: prefs.getString("recordingCallId", null)
            if (!callId.isNullOrBlank()) runCatching {
                val service = Intent(context, CallRecordingService::class.java).setAction(CallRecordingService.ACTION_START).putExtra(CallRecordingService.EXTRA_CALL_ID, callId)
                if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service) else context.startService(service)
            }
        }
        if (state == "IDLE") {
            LeadCallNotification.cancelIncoming(context)
            val pending = CallAudioRecorder.stop(context)
            context.stopService(Intent(context, CallRecordingService::class.java))
            val callId = prefs.getString("activeCallId", null)
            if (!callId.isNullOrBlank()) {
                val started = prefs.getLong("activeStartedAt", System.currentTimeMillis())
                OfflineEventStore(context).enqueue("call-end-$callId", "CALL_END", JSONObject().put("callSessionId", callId).put("status", "COMPLETED").put("endedAt", Instant.now().toString()).put("durationSeconds", ((System.currentTimeMillis() - started) / 1000).coerceAtLeast(0)).put("recordingStatus", if (pending != null) "LOCAL_PENDING" else "FAILED"))
                LeadCallNotification.show(context, phone, ended = true, callId = callId)
            }
            prefs.edit().remove("activeCallId").remove("activeLeadId").remove("activePhone").remove("activeStartedAt").apply()
        }
    }
}
