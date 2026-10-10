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
import com.gigxomi.gxclosers.data.RecordingUploadWorker
import com.gigxomi.gxclosers.data.SessionStore
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
            prefs.edit().putBoolean("wasOffhook", true).putLong("offhookAt", System.currentTimeMillis()).apply()
            val callId = prefs.getString("activeCallId", null) ?: prefs.getString("recordingCallId", null)
            if (!callId.isNullOrBlank()) {
                startRecorder(context, callId)
            } else if (!prefs.getBoolean("incomingSessionStarting", false) &&
                !SessionStore(context).token.isNullOrBlank() &&
                SessionStore(context).setupComplete
            ) {
                // The normal dialer does not expose an outgoing number in
                // PHONE_STATE. Capture locally and bind it to the real
                // tenant-scoped call-log session after the call ends.
                val localCallId = prefs.getString("unpreparedRecordingCallId", null)
                    ?: "${CallAudioRecorder.UNPREPARED_CALL_PREFIX}${System.currentTimeMillis()}"
                prefs.edit().putString("unpreparedRecordingCallId", localCallId).apply()
                startRecorder(context, localCallId)
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
                val connectedAt = prefs.getLong("offhookAt", started)
                // PHONE_STATE can go RINGING -> IDLE without OFFHOOK for a
                // missed/rejected call. Treat the absence of OFFHOOK as not
                // connected; defaulting to true falsely reports missed calls
                // as completed and attaches a recording failure to them.
                val connected = prefs.getBoolean("wasOffhook", false)
                val lastRecordingState = prefs.getString("recordingState", null)
                val recordingError = prefs.getString("recordingError", null).orEmpty()
                val recordingStatus = when {
                    pending?.callId == callId -> "LOCAL_PENDING"
                    !connected -> "NONE"
                    lastRecordingState == "FAILED" -> "FAILED"
                    else -> "RECORDING_UNAVAILABLE"
                }

                val payload = JSONObject()
                    .put("callSessionId", callId)
                    .put("status", if (connected) "COMPLETED" else "MISSED")
                    .put("connectedAt", if (connected) Instant.ofEpochMilli(connectedAt).toString() else JSONObject.NULL)
                    .put("endedAt", Instant.now().toString())
                    .put("durationSeconds", if (connected) ((System.currentTimeMillis() - connectedAt) / 1000).coerceAtLeast(0) else 0)
                    .put("recordingStatus", recordingStatus)
                    .put("recordingError", recordingError.ifBlank {
                        if (connected && recordingStatus == "RECORDING_UNAVAILABLE") "Recorder did not produce an audio file before the call ended." else ""
                    })

                // Android can deliver more than one IDLE broadcast for the same
                // physical call. Keep a short-lived fingerprint so the next
                // broadcast cannot create a second call-log fallback row.
                prefs.edit()
                    .putLong("lastTrackedCallEndedAt", System.currentTimeMillis())
                    .putString("lastTrackedCallPhone", phone)
                    .apply()

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
                syncUnpreparedCallLog(context, pending)
            }
            val cleanup = prefs.edit()
                .remove("activeCallId")
                .remove("activeLeadId")
                .remove("activePhone")
                .remove("activeStartedAt")
                .remove("pendingInboundLeadId")
                .remove("recordingError")
                .remove("unpreparedRecordingCallId")
            if (!sessionStarting) {
                cleanup.remove("wasOffhook").remove("offhookAt").remove("incomingSessionEnded").remove("incomingEndedAt").remove("phone")
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
                        .put("connectedAt", if (wasOffhook) Instant.ofEpochMilli(prefs.getLong("offhookAt", prefs.getLong("incomingEndedAt", System.currentTimeMillis()))).toString() else JSONObject.NULL)
                        .put("endedAt", Instant.ofEpochMilli(prefs.getLong("incomingEndedAt", System.currentTimeMillis())).toString())
                        .put("durationSeconds", if (wasOffhook) ((prefs.getLong("incomingEndedAt", System.currentTimeMillis()) - prefs.getLong("offhookAt", prefs.getLong("incomingEndedAt", System.currentTimeMillis()))) / 1000).coerceAtLeast(0) else 0)
                        .put("recordingStatus", if (wasOffhook) "RECORDING_UNAVAILABLE" else "NONE")
                        .put("recordingError", if (wasOffhook) "Call connected before the recorder session was ready." else "")
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
                        .remove("offhookAt")
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
        }.onFailure { error ->
            context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE).edit()
                .putString("recordingState", "FAILED")
                .putString("recordingError", error.message ?: "Could not start foreground recording service")
                .apply()
            Log.e("GXCallRecording", "Could not start recorder service callId=$callId", error)
        }
    }

    private fun syncUnpreparedCallLog(context: Context, pendingRecording: PendingRecording? = null) {
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

            val lastTrackedAt = prefs.getLong("lastTrackedCallEndedAt", 0L)
            val lastTrackedPhone = prefs.getString("lastTrackedCallPhone", "").orEmpty()
            val callLogEndedAt = startedAt + (duration * 1000L)
            if (lastTrackedAt > 0L &&
                (System.currentTimeMillis() - lastTrackedAt).coerceAtLeast(0L) <= DUPLICATE_IDLE_WINDOW_MS &&
                normalizedPhone(phone) == normalizedPhone(lastTrackedPhone) &&
                kotlin.math.abs(callLogEndedAt - lastTrackedAt) <= DUPLICATE_IDLE_WINDOW_MS
            ) {
                // Mark the row as seen without creating a second CRM call.
                prefs.edit().putString(LAST_CALL_LOG_ID, id).apply()
                Log.i("GXPhoneState", "Ignoring duplicate IDLE call-log row id=$id phone=$phone")
                return
            }
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
                    val localRecordingStartedAt = pendingRecording?.callId
                        ?.takeIf { it.startsWith(CallAudioRecorder.UNPREPARED_CALL_PREFIX) }
                        ?.removePrefix(CallAudioRecorder.UNPREPARED_CALL_PREFIX)
                        ?.toLongOrNull()
                    val linkedRecording = pendingRecording?.takeIf {
                        localRecordingStartedAt != null &&
                            kotlin.math.abs(startedAt - localRecordingStartedAt) <= CALL_LOG_LOOKBACK_MS
                    }
                    if (linkedRecording != null) {
                        OfflineEventStore(context).rebindRecordingCall(linkedRecording.clientUploadId, callId)
                    }
                    val endedAt = startedAt + (duration * 1000L)
                    val payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", status)
                        .put("endedAt", Instant.ofEpochMilli(endedAt).toString())
                        .put("durationSeconds", duration)
                        .put("recordingStatus", if (linkedRecording != null) "LOCAL_PENDING" else "RECORDING_UNAVAILABLE")
                        .put("recordingError", if (linkedRecording == null) "Call synced from the device call log because no recorder session was available." else "")
                    OfflineEventStore(context).enqueue("call-log-end-$id", "CALL_END", payload, callId)
                    repository.syncOffline()
                    if (linkedRecording != null) RecordingUploadWorker.enqueue(context)
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
        const val DUPLICATE_IDLE_WINDOW_MS = 15_000L
    }

    private fun normalizedPhone(phone: String): String =
        phone.filter { it.isDigit() }.takeLast(10)

}
