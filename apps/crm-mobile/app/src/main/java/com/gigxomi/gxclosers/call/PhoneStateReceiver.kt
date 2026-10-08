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
            showCallerCard(context, phone)
            if (incoming.isNotBlank() && prefs.getString("activeCallId", null).isNullOrBlank() && prefs.getString("pendingInboundLeadId", null).isNullOrBlank()) {
                startIncomingSession(context, phone)
            }
        }

        if (state == "OFFHOOK") {
            prefs.edit().putBoolean("wasOffhook", true).apply()
            val callId = prefs.getString("activeCallId", null) ?: prefs.getString("recordingCallId", null)
            if (!callId.isNullOrBlank()) {
                startRecorder(context, callId)
            }
        }

        if (state == "IDLE") {
            LeadCallNotification.cancelIncoming(context)
            hideCallerCard(context)
            val pending = CallAudioRecorder.stop(context)
            context.stopService(Intent(context, CallRecordingService::class.java))
            val callId = prefs.getString("activeCallId", null)

            if (!callId.isNullOrBlank()) {
                val started = prefs.getLong("activeStartedAt", System.currentTimeMillis())
                val durationSeconds = ((System.currentTimeMillis() - started) / 1000).coerceAtLeast(0)
                val connected = prefs.getBoolean("wasOffhook", true)
                val lastRecordingState = prefs.getString("recordingState", null)
                val recordingStatus = when {
                    pending?.callId == callId -> "LOCAL_PENDING"
                    !connected -> "NONE"
                    lastRecordingState == "FAILED" -> "FAILED"
                    else -> "RECORDING_UNAVAILABLE"
                }

                val payload = JSONObject()
                    .put("callSessionId", callId)
                    .put("status", if (connected) "COMPLETED" else "MISSED")
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
            prefs.edit().remove("activeCallId").remove("activeLeadId").remove("activePhone").remove("activeStartedAt").remove("pendingInboundLeadId").remove("wasOffhook").apply()
        }
    }

    private fun startIncomingSession(context: Context, phone: String) {
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val lead = CallManager.lookup(context, phone) ?: return@launch
                val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
                prefs.edit().putString("pendingInboundLeadId", lead.id).putString("direction", "INBOUND").apply()
                val repository = CrmRepository(context)
                val callId = repository.startIncomingCall(lead.id, phone, repository.sessionStore.installationId)
                prefs.edit()
                    .putString("activeCallId", callId)
                    .putString("activeLeadId", lead.id)
                    .putString("activePhone", phone)
                    .putString("direction", "INBOUND")
                    .putLong("activeStartedAt", System.currentTimeMillis())
                    .apply()
            } catch (_: Exception) {
                // Unknown/offline callers still get the caller card; the call is not
                // attached to CRM until a later supported sync is available.
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun startRecorder(context: Context, callId: String) {
        runCatching {
            val service = Intent(context, CallRecordingService::class.java)
                .setAction(CallRecordingService.ACTION_START)
                .putExtra(CallRecordingService.EXTRA_CALL_ID, callId)
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service) else context.startService(service)
        }
    }

    private fun showCallerCard(context: Context, phone: String) {
        runCatching {
            val service = Intent(context, CallOverlayService::class.java)
                .setAction(CallOverlayService.ACTION_SHOW)
                .putExtra(CallOverlayService.EXTRA_PHONE, phone)
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service) else context.startService(service)
        }
    }

    private fun hideCallerCard(context: Context) {
        runCatching { context.startService(Intent(context, CallOverlayService::class.java).setAction(CallOverlayService.ACTION_HIDE)) }
    }
}
