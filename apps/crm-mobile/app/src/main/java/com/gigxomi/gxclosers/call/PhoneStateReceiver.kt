package com.gigxomi.gxclosers.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.TelephonyManager
import com.gigxomi.gxclosers.data.CrmRepository
import com.gigxomi.gxclosers.data.OfflineEventStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
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

        if (state == "RINGING" && phone.isNotBlank()) {
            LeadCallNotification.show(context, phone)
        }

        if (state == "OFFHOOK") {
            val callId = prefs.getString("activeCallId", null) ?: prefs.getString("recordingCallId", null)
            if (!callId.isNullOrBlank()) {
                runCatching {
                    val service = Intent(context, CallRecordingService::class.java)
                        .setAction(CallRecordingService.ACTION_START)
                        .putExtra(CallRecordingService.EXTRA_CALL_ID, callId)
                    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service) else context.startService(service)
                }
            }
        }

        if (state == "IDLE") {
            LeadCallNotification.cancelIncoming(context)
            val pending = CallAudioRecorder.stop(context)
            context.stopService(Intent(context, CallRecordingService::class.java))
            val callId = prefs.getString("activeCallId", null)

            if (!callId.isNullOrBlank()) {
                val started = prefs.getLong("activeStartedAt", System.currentTimeMillis())
                val durationSeconds = ((System.currentTimeMillis() - started) / 1000).coerceAtLeast(0)
                val lastRecordingState = prefs.getString("recordingState", null)
                val recordingStatus = when {
                    pending != null -> "LOCAL_PENDING"
                    lastRecordingState == "FAILED" -> "FAILED"
                    else -> "RECORDING_UNAVAILABLE"
                }

                val payload = JSONObject()
                    .put("callSessionId", callId)
                    .put("status", "COMPLETED")
                    .put("endedAt", Instant.now().toString())
                    .put("durationSeconds", durationSeconds)
                    .put("recordingStatus", recordingStatus)

                // Enqueue call-end with deterministic idempotency key
                val store = OfflineEventStore(context)
                store.enqueue("call-end-$callId", "CALL_END", payload, callId)
                LeadCallNotification.show(context, phone, ended = true, callId = callId)

                // Attempt immediate online sync in background; if offline, OfflineEventStore keeps it for retry
                CoroutineScope(Dispatchers.IO).launch {
                    runCatching {
                        val repo = CrmRepository(context)
                        repo.syncOffline()
                    }
                }
            }
            prefs.edit().remove("activeCallId").remove("activeLeadId").remove("activePhone").remove("activeStartedAt").apply()
        }
    }
}
