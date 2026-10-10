package com.gigxomi.gxclosers.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.CallLog
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
            } else if (!sessionStarting) {
                // A call started from the normal Android dialer never gets an
                // activeCallId because CRM did not get a chance to prepare it.
                // Read the just-finished real system call-log row and create
                // the tenant-scoped CRM session before closing it.
                syncUnpreparedCallLog(context)
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

    private fun syncUnpreparedCallLog(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            context.checkSelfPermission(android.Manifest.permission.READ_CALL_LOG) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) return

        val resolver = context.contentResolver
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val cursor = runCatching {
            resolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls._ID,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                ),
                "${CallLog.Calls.DATE} >= ?",
                arrayOf((now - CALL_LOG_LOOKBACK_MS).toString()),
                "${CallLog.Calls.DATE} DESC"
            )
        }.getOrNull() ?: return

        cursor.use {
            if (!it.moveToFirst()) return
            val id = it.getString(it.getColumnIndexOrThrow(CallLog.Calls._ID))
            if (id == prefs.getString(LAST_CALL_LOG_ID, null)) return
            val phone = it.getString(it.getColumnIndexOrThrow(CallLog.Calls.NUMBER)).orEmpty()
            if (phone.isBlank()) return
            val type = it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.TYPE))
            val startedAt = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DATE))
            val duration = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DURATION)).coerceAtLeast(0)
            val direction = when (type) {
                CallLog.Calls.INCOMING_TYPE, CallLog.Calls.MISSED_TYPE, CallLog.Calls.REJECTED_TYPE -> "INBOUND"
                else -> "OUTBOUND"
            }
            val status = if (type == CallLog.Calls.MISSED_TYPE || duration == 0L) "MISSED" else "COMPLETED"
            val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                ?: "${Build.MANUFACTURER}-${Build.MODEL}"

            prefs.edit().putString(LAST_CALL_LOG_ID, id).apply()
            CoroutineScope(Dispatchers.IO).launch {
                runCatching {
                    val repository = CrmRepository(context)
                    val lead = CallManager.lookup(context, phone)
                    val callId = repository.startUnmatchedCall(lead?.id, phone, direction, deviceId)
                    val endedAt = startedAt + (duration * 1000L)
                    val payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", status)
                        .put("endedAt", Instant.ofEpochMilli(endedAt).toString())
                        .put("durationSeconds", duration)
                        .put("recordingStatus", "RECORDING_UNAVAILABLE")
                    OfflineEventStore(context).enqueue("call-log-end-$id", "CALL_END", payload, callId)
                    repository.syncOffline()
                }.onFailure { error ->
                    // Leave the call-log marker untouched only for a failed
                    // server request so the next phone event can retry it.
                    Log.e("GXPhoneState", "Could not sync unprepared call log id=$id", error)
                    prefs.edit().remove(LAST_CALL_LOG_ID).apply()
                }
            }
        }
    }

    private companion object {
        const val LAST_CALL_LOG_ID = "lastSyncedCallLogId"
        const val CALL_LOG_LOOKBACK_MS = 2 * 60 * 60 * 1000L
    }

}
