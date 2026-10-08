package com.gigxomi.gxclosers.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.telephony.TelephonyManager
import android.util.Log
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
        Log.i("GXPhoneState", "state=$state incoming=$incoming resolved=$phone")
        prefs.edit().putString("state", state).putString("phone", phone).putLong("updatedAt", System.currentTimeMillis()).apply()

        if (state == "RINGING" && phone.isNotBlank()) {
            LeadCallNotification.show(context, phone)
            CallOverlayWindow.show(context, phone)
            // Some Android/emulator PHONE_STATE broadcasts omit EXTRA_INCOMING_NUMBER
            // on the first RINGING event. `phone` is already resolved from the
            // broadcast or the receiver's short-lived state, so gate on that
            // resolved value instead of dropping the backend call session.
            if (phone.isNotBlank() && prefs.getString("activeCallId", null).isNullOrBlank() &&
                prefs.getString("pendingInboundLeadId", null).isNullOrBlank() &&
                !prefs.getBoolean("incomingSessionStarting", false)) {
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
            CallOverlayWindow.remove()
            val pending = CallAudioRecorder.stop(context)
            context.stopService(Intent(context, CallRecordingService::class.java))
            val callId = prefs.getString("activeCallId", null)
            val sessionStarting = prefs.getBoolean("incomingSessionStarting", false)

            // The server request can still be in flight when a very short
            // call ends. Keep enough state for startIncomingSession() to close
            // the call after it receives the newly-created call ID.
            if (callId.isNullOrBlank() && sessionStarting) {
                prefs.edit()
                    .putBoolean("incomingSessionEnded", true)
                    .putLong("incomingEndedAt", System.currentTimeMillis())
                    .apply()
            }

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
            val cleanup = prefs.edit()
                .remove("activeCallId")
                .remove("activeLeadId")
                .remove("activePhone")
                .remove("activeStartedAt")
                .remove("pendingInboundLeadId")
            if (!sessionStarting) {
                cleanup.remove("wasOffhook").remove("incomingSessionEnded").remove("incomingEndedAt").remove("phone")
            }
            cleanup.apply()
        }
    }

    private fun startIncomingSession(context: Context, phone: String) {
        val pendingResult = goAsync()
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean("incomingSessionStarting", true).apply()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val lead = CallManager.lookup(context, phone)
                prefs.edit().apply {
                    lead?.id?.let { putString("pendingInboundLeadId", it) }
                    putString("direction", "INBOUND")
                    apply()
                }
                val repository = CrmRepository(context)
                // Device registration uses the stable Android device ID. Keep
                // incoming call sessions on that same identity; the install
                // session UUID is only for mobile login/session ownership.
                val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                    ?: "${Build.MANUFACTURER}-${Build.MODEL}"
                Log.i("GXPhoneState", "starting inbound session phone=$phone deviceId=$deviceId leadId=${lead?.id.orEmpty()}")
                val callId = repository.startIncomingCall(lead?.id, phone, deviceId)
                Log.i("GXPhoneState", "inbound session created callId=$callId")
                val endedBeforeSession = prefs.getBoolean("incomingSessionEnded", false)
                val wasOffhook = prefs.getBoolean("wasOffhook", false)
                prefs.edit().apply {
                    putString("activeCallId", callId)
                    lead?.id?.let { putString("activeLeadId", it) }
                    putString("activePhone", phone)
                    putString("direction", "INBOUND")
                    putLong("activeStartedAt", System.currentTimeMillis())
                    putBoolean("incomingSessionStarting", false)
                    apply()
                }
                // RINGING -> OFFHOOK can happen before the network request
                // returns. Start recording as soon as the server gives us the
                // stable call ID instead of silently missing the beginning.
                if (endedBeforeSession) {
                    val payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", if (wasOffhook) "COMPLETED" else "MISSED")
                        .put("endedAt", Instant.ofEpochMilli(prefs.getLong("incomingEndedAt", System.currentTimeMillis())).toString())
                        .put("durationSeconds", 0)
                        .put("recordingStatus", if (wasOffhook) "RECORDING_UNAVAILABLE" else "NONE")
                    OfflineEventStore(context).enqueue("call-end-$callId", "CALL_END", payload, callId)
                    CoroutineScope(Dispatchers.IO).launch {
                        runCatching { CrmRepository(context).syncOffline() }
                    }
                    prefs.edit()
                        .remove("activeCallId")
                        .remove("activeLeadId")
                        .remove("activePhone")
                        .remove("activeStartedAt")
                        .remove("wasOffhook")
                        .remove("incomingSessionEnded")
                        .remove("incomingEndedAt")
                        .apply()
                } else if (wasOffhook) {
                    startRecorder(context, callId)
                }
            } catch (error: Exception) {
                Log.e("GXPhoneState", "Could not create incoming call session", error)
                prefs.edit()
                    .putBoolean("incomingSessionStarting", false)
                    .remove("incomingSessionEnded")
                    .remove("incomingEndedAt")
                    .remove("pendingInboundLeadId")
                    .remove("activeLeadId")
                    .remove("activePhone")
                    .remove("phone")
                    .remove("wasOffhook")
                    .apply()
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

}
