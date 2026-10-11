package com.gigxomi.gxclosers.call

import android.content.BroadcastReceiver
import android.content.Context
import android.database.Cursor
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.CallLog
import android.provider.ContactsContract
import android.provider.Settings
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.gigxomi.gxclosers.data.CrmRepository
import com.gigxomi.gxclosers.data.DeviceDiagnostics
import com.gigxomi.gxclosers.data.OfflineEventStore
import com.gigxomi.gxclosers.data.RecordingUploadWorker
import com.gigxomi.gxclosers.data.SessionStore
import com.gigxomi.gxclosers.data.SystemRecordingImportWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant

class PhoneStateReceiver : BroadcastReceiver() {
    private data class CallLogDetails(
        val id: String,
        val number: String,
        val direction: String,
        val startedAt: Long,
        val durationSeconds: Long,
        val contactName: String?,
        val simSubscriptionId: String?,
        val simSlotIndex: Int?,
        val simLabel: String?,
    )

    override fun onReceive(context: Context, intent: Intent) {
        val state = when (intent.action) {
            TelephonyManager.ACTION_PHONE_STATE_CHANGED ->
                intent.getStringExtra(TelephonyManager.EXTRA_STATE)?.substringAfterLast('_')
            ACTION_INTERNAL_PHONE_STATE -> intent.getStringExtra(EXTRA_INTERNAL_STATE)
            else -> null
        } ?: return
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        val incoming = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER).orEmpty()
        val rawPhone = incoming.ifBlank { prefs.getString("activePhone", prefs.getString("phone", "")).orEmpty() }
        // Some OEMs put a caller label/SIP URI in EXTRA_INCOMING_NUMBER.
        // Normalize it before creating the inbound CRM session.
        val phone = normalizePhone(rawPhone)
        Log.i("GXPhoneState", "state=$state incoming=$incoming resolved=$phone")
        prefs.edit().putString("state", state).putString("phone", phone).putLong("updatedAt", System.currentTimeMillis()).apply()

        val detectedSubId = CallManager.extractSubscriptionId(context, intent)
        if (detectedSubId != null && !CallManager.isWorkSim(context, detectedSubId)) {
            prefs.edit().putBoolean("activeCallIsNonWorkSim", true).apply()
        }

        if (state == "RINGING" && phone.isNotBlank()) {
            if (detectedSubId != null && !CallManager.isWorkSim(context, detectedSubId)) {
                Log.i("GXPhoneState", "RINGING detected on personal SIM subId= phone=. Ignoring completely.")
                prefs.edit().putBoolean("activeCallIsNonWorkSim", true).apply()
                return
            }

            val isMultiSimConfigured = CallManager.availableSims(context).size > 1 &&
                CallManager.simSelection(context) != CallManager.SIM_SELECTION_ASK &&
                CallManager.simSelection(context).isNotBlank()

            val lead = CallManager.lookup(context, phone)

            val isConfirmedWorkSim = (detectedSubId != null && CallManager.isWorkSim(context, detectedSubId))
            val allowCrmUi = !isMultiSimConfigured || isConfirmedWorkSim || (lead != null)
            if (allowCrmUi) {
                LeadCallNotification.show(context, phone)
                CallOverlayWindow.show(context, phone)
            }

            val allowRingingSessionStart = !isMultiSimConfigured ||
                (detectedSubId != null && CallManager.isWorkSim(context, detectedSubId)) ||
                (lead != null)

            if (allowRingingSessionStart &&
                phone.isNotBlank() && prefs.getString("activeCallId", null).isNullOrBlank() &&
                prefs.getString("pendingInboundLeadId", null).isNullOrBlank() &&
                !prefs.getBoolean("incomingSessionStarting", false)) {
                startIncomingSession(context, phone, simSubscriptionId = detectedSubId)
            }
        }

        if (state == "OFFHOOK") {
            prefs.edit().putBoolean("wasOffhook", true).putLong("offhookAt", System.currentTimeMillis()).apply()
            // Only trust a server call ID that belongs to the current call.
            // `recordingCallId` is persisted for the upload queue and can be
            // left behind after a previous call finishes. Reusing it here
            // attaches a new dialer call's recording to the old call session.
            // A live in-process recorder is safe to reuse; otherwise the
            // unprepared-call path below creates a fresh local ID and binds it
            // to the device call-log row after IDLE.
            val callId = prefs.getString("activeCallId", null)
                ?: CallAudioRecorder.currentCallId()
            if (!prefs.getBoolean("activeCallIsNonWorkSim", false)) {
                if (!callId.isNullOrBlank()) {
                startRecorder(context, callId)
            } else if ((prefs.getBoolean("micFallbackEnabled", false) &&
                    prefs.getBoolean("incomingSessionStarting", false)) ||
                (!prefs.getBoolean("incomingSessionStarting", false) &&
                    !SessionStore(context).token.isNullOrBlank() &&
                    SessionStore(context).setupComplete)
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
        }

        if (state == "IDLE") {
            LeadCallNotification.cancelIncoming(context)
            CallOverlayWindow.remove()
            // Prefer the user's system-dialer recording. If the user enabled
            // the visible experimental fallback, stop and queue the local
            // microphone capture first so it can be uploaded to this call.
            val localMicRecording = CallAudioRecorder.stop(context)
            runCatching { context.stopService(Intent(context, CallRecordingService::class.java)) }
            val activePhone = prefs.getString("activePhone", null)?.ifBlank { null } ?: phone.ifBlank { null }
            val activeStarted = prefs.getLong("activeStartedAt", 0L).takeIf { it > 0L }
            val callLog = latestCallLog(context, expectedPhone = activePhone, minStartedAt = activeStarted)
            val effectivePhone = callLog?.number?.takeIf(String::isNotBlank) ?: activePhone ?: phone
            val callId = prefs.getString("activeCallId", null)
            val sessionStarting = prefs.getBoolean("incomingSessionStarting", false)

            val wasNonWork = prefs.getBoolean("activeCallIsNonWorkSim", false)
            val rawSubId = callLog?.simSubscriptionId ?: queryRawCallLogSim(context, effectivePhone, activeStarted)
            val isPersonalCall = wasNonWork || (rawSubId != null && !CallManager.isWorkSim(context, rawSubId))

            if (isPersonalCall) {
                Log.i("GXPhoneState", "IDLE: Dropping personal SIM call phone=$effectivePhone subId=$rawSubId wasNonWork=$wasNonWork")
                if (localMicRecording != null) {
                    OfflineEventStore(context).deleteRecordingByCallId(localMicRecording.callId)
                    runCatching { java.io.File(localMicRecording.path).delete() }
                }
                val unpreparedCallId = prefs.getString("unpreparedRecordingCallId", null)
                if (!unpreparedCallId.isNullOrBlank()) {
                    OfflineEventStore(context).deleteRecordingByCallId(unpreparedCallId)
                }
                if (!callId.isNullOrBlank()) {
                    OfflineEventStore(context).deleteRecordingByCallId(callId)
                    CoroutineScope(Dispatchers.IO).launch {
                        runCatching { CrmRepository(context).discardCall(callId) }
                    }
                }
                val cleanup = prefs.edit()
                    .remove("activeCallId")
                    .remove("activeLeadId")
                    .remove("activePhone")
                    .remove("activeStartedAt")
                    .remove("activeContactName")
                    .remove("activeSimSubscriptionId")
                    .remove("activeSimSlotIndex")
                    .remove("activeSimLabel")
                    .remove("pendingInboundLeadId")
                    .remove("recordingError")
                    .remove("recordingAudioSource")
                    .remove("recordingCallId")
                    .remove("recordingUploadId")
                    .remove("recordingState")
                    .remove("unpreparedRecordingCallId")
                    .remove("activeCallIsNonWorkSim")
                    .remove("wasOffhook")
                    .remove("offhookAt")
                    .remove("incomingSessionEnded")
                    .remove("incomingEndedAt")
                    .remove("phone")
                    .putLong("lastCallEndedAt", System.currentTimeMillis())
                    .putBoolean("lastCallWasWorkSim", false)
                    .putBoolean("lastDiscardedWasNonWorkSim", true)
                callLog?.id?.let { logId ->
                    cleanup.putString(LAST_CALL_LOG_ID, logId)
                }
                cleanup.apply()
                return
            }

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
                val connected = if (callLog != null) callLog.durationSeconds > 0L else prefs.getBoolean("wasOffhook", false)
                val recordingError = prefs.getString("recordingError", null).orEmpty()
                val endedAtMillis = System.currentTimeMillis()
                val durationSeconds = callLog?.durationSeconds?.takeIf { it > 0L }
                    ?: if (connected) ((endedAtMillis - connectedAt) / 1000).coerceAtLeast(0) else 0L
                // When the visible Phone-app Share flow is armed, the recording
                // is expected but has not reached AI Closer yet. Keep the call in
                // Processing instead of publishing a false permanent failure.
                // The upload worker will move it to UPLOADED after the share.
                val shareAutomationArmed = connected && durationSeconds > 0L &&
                    DialerShareAutomation.arm(context, callId, effectivePhone)
                val inboundMicUploadId = localMicRecording
                    ?.takeIf { it.callId.startsWith(CallAudioRecorder.UNPREPARED_CALL_PREFIX) }
                    ?.clientUploadId
                inboundMicUploadId?.let { OfflineEventStore(context).rebindRecordingCall(it, callId) }
                val hasLocalMicRecording = localMicRecording?.callId == callId || inboundMicUploadId != null
                val recordingStatus = when {
                    !connected -> "NONE"
                    hasLocalMicRecording -> "LOCAL_PENDING"
                    shareAutomationArmed -> "LOCAL_PENDING"
                    else -> "RECORDING_UNAVAILABLE"
                }

                DeviceDiagnostics.record(
                    context,
                    kind = "CALL_RECORDING_ROUTE_SELECTED",
                    callId = callId,
                    fields = JSONObject()
                        .put("stage", "CALL_END")
                        .put("route", when {
                            hasLocalMicRecording -> "MICROPHONE_FALLBACK"
                            shareAutomationArmed -> "DIALER_SHARE"
                            connected && durationSeconds > 0L -> "SYSTEM_IMPORT_PENDING"
                            else -> "NONE"
                        })
                        .put("status", recordingStatus)
                        .put("durationMs", durationSeconds * 1000L),
                )

                val payload = JSONObject()
                    .put("callSessionId", callId)
                    .put("status", if (connected) "COMPLETED" else "MISSED")
                    .put("connectedAt", if (connected) Instant.ofEpochMilli(connectedAt).toString() else JSONObject.NULL)
                    .put("endedAt", Instant.ofEpochMilli(endedAtMillis).toString())
                    .put("durationSeconds", if (connected) durationSeconds else 0)
                    .put("recordingStatus", recordingStatus)
                    .put("recordingError", recordingError.ifBlank {
                        if (recordingStatus == "RECORDING_UNAVAILABLE") "No recording was captured yet. Check Phone app recording or enable the AICloser microphone fallback." else ""
                    })
                    .put("phoneNumber", effectivePhone)
                    .put("contactName", callLog?.contactName ?: prefs.getString("activeContactName", ""))
                    .put("simSubscriptionId", callLog?.simSubscriptionId ?: JSONObject.NULL)
                    .put("simSlotIndex", callLog?.simSlotIndex ?: JSONObject.NULL)
                    .put("simLabel", callLog?.simLabel ?: JSONObject.NULL)

                // Android can deliver more than one IDLE broadcast for the same
                // physical call. Keep a short-lived fingerprint so the next
                // broadcast cannot create a second call-log fallback row.
                val idleEditor = prefs.edit()
                    .putLong("lastTrackedCallEndedAt", System.currentTimeMillis())
                    .putString("lastTrackedCallPhone", effectivePhone)
                callLog?.id?.let { logId ->
                    idleEditor.putString(LAST_CALL_LOG_ID, logId)
                }
                idleEditor.apply()

                // Enqueue call-end with deterministic idempotency key
                val store = OfflineEventStore(context)
                store.enqueue("call-end-$callId", "CALL_END", payload, callId)
                if (connected && durationSeconds > 0L && !hasLocalMicRecording && !shareAutomationArmed) {
                    SystemRecordingImportWorker.enqueue(
                        context,
                        callId,
                        connectedAt,
                        endedAtMillis,
                        durationSeconds,
                        effectivePhone,
                    )
                }
                LeadCallNotification.show(context, effectivePhone, ended = true, callId = callId)

                // Attempt immediate online sync in background; if offline, OfflineEventStore keeps it for retry
                CoroutineScope(Dispatchers.IO).launch {
                    runCatching {
                        val repo = CrmRepository(context)
                        repo.syncOffline()
                    }
                }
                if (inboundMicUploadId != null) RecordingUploadWorker.enqueue(context)
            } else if (!sessionStarting) {
                // A call started from the normal Android dialer never gets an
                // activeCallId because CRM did not get a chance to prepare it.
                // Read the just-finished real system call-log row and create
                // the tenant-scoped CRM session before closing it.
                syncUnpreparedCallLog(
                    context,
                    callLog,
                    connectedHint = prefs.getBoolean("wasOffhook", false),
                    connectedAtHint = prefs.getLong("offhookAt", 0L),
                    endedAtHint = System.currentTimeMillis(),
                    localMicRecording = localMicRecording,
                )
            }
            if (sessionStarting && localMicRecording?.callId?.startsWith(CallAudioRecorder.UNPREPARED_CALL_PREFIX) == true) {
                prefs.edit().putString("pendingInboundRecordingUploadId", localMicRecording.clientUploadId).apply()
            }
            val isNonWorkCall = prefs.getBoolean("lastDiscardedWasNonWorkSim", false)
            val cleanup = prefs.edit()
                .putLong("lastCallEndedAt", System.currentTimeMillis())
                .putBoolean("lastCallWasWorkSim", !isNonWorkCall)
                .putBoolean("lastDiscardedWasNonWorkSim", isNonWorkCall)
                .remove("activeCallId")
                .remove("activeLeadId")
                .remove("activePhone")
                .remove("activeStartedAt")
                .remove("activeContactName")
                .remove("activeSimSubscriptionId")
                .remove("activeSimSlotIndex")
                .remove("activeSimLabel")
                .remove("pendingInboundLeadId")
                .remove("recordingError")
                .remove("recordingAudioSource")
                .remove("recordingCallId")
                .remove("recordingUploadId")
                .remove("recordingState")
                .remove("unpreparedRecordingCallId")
            if (!sessionStarting) {
                cleanup.remove("wasOffhook").remove("offhookAt").remove("incomingSessionEnded").remove("incomingEndedAt").remove("phone")
            }
            cleanup.apply()
        }
    }

    companion object {
        /**
         * MIUI can reject the protected PHONE_STATE broadcast for ordinary
         * third-party receivers. CallStateMonitorService sends this explicit,
         * app-private equivalent after reading TelephonyManager.callState.
         */
        const val ACTION_INTERNAL_PHONE_STATE = "com.gigxomi.crm.INTERNAL_PHONE_STATE"
        const val EXTRA_INTERNAL_STATE = "state"

        private const val LAST_CALL_LOG_ID = "lastSyncedCallLogId"
        private const val CALL_LOG_LOOKBACK_MS = 2 * 60 * 60 * 1000L
        private const val DUPLICATE_IDLE_WINDOW_MS = 45_000L
    }

    private fun startIncomingSession(context: Context, phone: String, simSubscriptionId: String? = null) {
        val pendingResult = goAsync()
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean("incomingSessionStarting", true).apply()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val lead = CallManager.lookup(context, phone)
                val contactName = lead?.name?.takeUnless { it.startsWith("Unknown caller", ignoreCase = true) }
                    ?: lookupContactName(context, phone)
                prefs.edit().apply {
                    lead?.id?.let { putString("pendingInboundLeadId", it) }
                    contactName?.takeIf(String::isNotBlank)?.let { putString("activeContactName", it) }
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
                val sim = resolveSim(context, simSubscriptionId)
                val callId = repository.startIncomingCall(
                    lead?.id,
                    phone,
                    deviceId,
                    contactName = contactName,
                    simSubscriptionId = simSubscriptionId,
                    simSlotIndex = sim?.simSlotIndex,
                    simLabel = sim?.let { info ->
                        val title = info.displayName?.toString()?.trim().orEmpty().ifBlank { info.carrierName?.toString()?.trim().orEmpty() }
                        if (title.isBlank()) "SIM " else " - SIM "
                    },
                )
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
                    val endedAt = prefs.getLong("incomingEndedAt", System.currentTimeMillis())
                    val durationSeconds = if (wasOffhook) ((endedAt - prefs.getLong("offhookAt", endedAt)) / 1000).coerceAtLeast(0) else 0
                    val queuedMicUploadId = prefs.getString("pendingInboundRecordingUploadId", null)
                    queuedMicUploadId?.let { OfflineEventStore(context).rebindRecordingCall(it, callId) }
                    val shareAutomationArmed = wasOffhook && durationSeconds > 0L && queuedMicUploadId == null &&
                        DialerShareAutomation.arm(context, callId, prefs.getString("activePhone", phone))
                    val payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", if (wasOffhook) "COMPLETED" else "MISSED")
                        .put("connectedAt", if (wasOffhook) Instant.ofEpochMilli(prefs.getLong("offhookAt", prefs.getLong("incomingEndedAt", System.currentTimeMillis()))).toString() else JSONObject.NULL)
                        .put("endedAt", Instant.ofEpochMilli(endedAt).toString())
                        .put("durationSeconds", durationSeconds)
                        .put("recordingStatus", when {
                            !wasOffhook -> "NONE"
                            queuedMicUploadId != null -> "LOCAL_PENDING"
                            shareAutomationArmed -> "LOCAL_PENDING"
                            else -> "RECORDING_UNAVAILABLE"
                        })
                        .put("recordingError", if (wasOffhook && !shareAutomationArmed) "Call connected before the recorder session was ready." else "")
                    OfflineEventStore(context).enqueue("call-end-$callId", "CALL_END", payload, callId)
                    if (wasOffhook && durationSeconds > 0L && queuedMicUploadId == null && !shareAutomationArmed) {
                        SystemRecordingImportWorker.enqueue(
                            context,
                            callId,
                            prefs.getLong("offhookAt", endedAt),
                            endedAt,
                            durationSeconds,
                            prefs.getString("activePhone", null),
                        )
                    }
                    CoroutineScope(Dispatchers.IO).launch {
                        runCatching { CrmRepository(context).syncOffline() }
                    }
                    if (queuedMicUploadId != null) RecordingUploadWorker.enqueue(context)
                    prefs.edit()
                        .remove("activeCallId")
                        .remove("activeLeadId")
                        .remove("activePhone")
                        .remove("activeStartedAt")
                        .remove("activeContactName")
                        .remove("wasOffhook")
                        .remove("offhookAt")
                        .remove("incomingSessionEnded")
                        .remove("incomingEndedAt")
                        .remove("pendingInboundRecordingUploadId")
                        .apply()
                } else if (wasOffhook && CallAudioRecorder.currentCallId().isNullOrBlank()) {
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
                    .remove("activeContactName")
                    .remove("phone")
                    .remove("wasOffhook")
                    .apply()
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun startRecorder(context: Context, callId: String) {
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        val edit = prefs.edit()
            .putString("recordingCallId", callId)
            .putString("recordingAudioSource", "SYSTEM_DIALER")
            .putString("recordingState", "WAITING_FOR_SYSTEM_DIALER")
            .remove("recordingError")
        val fallbackEnabled = prefs.getBoolean("micFallbackEnabled", false)
        val canUseMic = Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        // The Phone-app Share bridge is only useful when the OEM actually
        // exposes a completed system recording. Pixel/Google Phone can expose
        // the Share UI while still reporting that call recording is unavailable
        // in the current location. The user explicitly enabled the fallback,
        // so do not suppress it merely because the accessibility bridge is on.
        // The call-end path prefers this local file when it exists and will not
        // attach an old system recording to the call.
        if (fallbackEnabled && canUseMic) {
            val started = runCatching {
                ContextCompat.startForegroundService(
                    context,
                    Intent(context, CallRecordingService::class.java)
                        .setAction(CallRecordingService.ACTION_START)
                        .putExtra(CallRecordingService.EXTRA_CALL_ID, callId),
                )
            }.isSuccess
            if (started) {
                edit.putString("recordingAudioSource", "AICLOSER_MIC_FALLBACK")
                    .putString("recordingState", "STARTING_MIC_FALLBACK")
            } else {
                edit.putString("recordingError", "Microphone fallback could not start; waiting for system dialer recording.")
            }
        }
        edit.apply()
    }

    private fun syncUnpreparedCallLog(
        context: Context,
        details: CallLogDetails? = null,
        connectedHint: Boolean = false,
        connectedAtHint: Long = 0L,
        endedAtHint: Long = System.currentTimeMillis(),
        localMicRecording: PendingRecording? = null,
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            context.checkSelfPermission(android.Manifest.permission.READ_CALL_LOG) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) return

        val resolver = context.contentResolver
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        // If details was already resolved for this exact call, target that ID directly;
        // otherwise only search within the active call window (last 2 minutes), never 2 hours ago.
        val cutoff = if (connectedAtHint > 0L) (connectedAtHint - 15_000L) else (now - 120_000L)
        val selection = if (details != null) "${CallLog.Calls._ID} = ?" else "${CallLog.Calls.DATE} >= ?"
        val selectionArgs = if (details != null) arrayOf(details.id) else arrayOf(cutoff.toString())
        val cursor = runCatching {
            resolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls._ID,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.PHONE_ACCOUNT_ID,
                ),
                selection,
                selectionArgs,
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
            val callLogDuration = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DURATION)).coerceAtLeast(0)
            val duration = callLogDuration.takeIf { value -> value > 0L }
                ?: if (connectedHint && connectedAtHint > 0L) {
                    ((endedAtHint - connectedAtHint) / 1000L).coerceAtLeast(0L)
                } else 0L
            val simSubscriptionId = extractSimAccountFromCallLog(it)
            if (!CallManager.isWorkSim(context, simSubscriptionId)) {
                prefs.edit()
                    .putString(LAST_CALL_LOG_ID, id)
                    .putLong("lastCallEndedAt", System.currentTimeMillis())
                    .putBoolean("lastCallWasWorkSim", false)
                    .putBoolean("lastDiscardedWasNonWorkSim", true)
                    .apply()
                val unpreparedCallId = prefs.getString("unpreparedRecordingCallId", null)
                if (!unpreparedCallId.isNullOrBlank()) {
                    OfflineEventStore(context).deleteRecordingByCallId(unpreparedCallId)
                }
                if (localMicRecording != null) {
                    OfflineEventStore(context).deleteRecordingByCallId(localMicRecording.callId)
                    runCatching { java.io.File(localMicRecording.path).delete() }
                }
                Log.i("GXPhoneState", "syncUnpreparedCallLog rejecting non-work SIM call log row id=$id phone=$phone subId=$simSubscriptionId")
                return
            }
            val sim = resolveSim(context, simSubscriptionId)
            val contactName = details?.contactName ?: lookupContactName(context, phone)

            val lastTrackedAt = prefs.getLong("lastTrackedCallEndedAt", 0L)
            val lastTrackedPhone = prefs.getString("lastTrackedCallPhone", "").orEmpty()
            val timeSinceLastCallEnd = (System.currentTimeMillis() - lastTrackedAt).coerceAtLeast(0L)
            if (lastTrackedAt > 0L &&
                timeSinceLastCallEnd <= DUPLICATE_IDLE_WINDOW_MS &&
                normalizedPhone(phone) == normalizedPhone(lastTrackedPhone) &&
                startedAt <= (lastTrackedAt + 10_000L)
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

            prefs.edit()
                .putString(LAST_CALL_LOG_ID, id)
                .putLong("lastTrackedCallEndedAt", System.currentTimeMillis())
                .putString("lastTrackedCallPhone", phone)
                .putLong("lastCallEndedAt", System.currentTimeMillis())
                .putBoolean("lastCallWasWorkSim", true)
                .putBoolean("lastDiscardedWasNonWorkSim", false)
                .apply()
            CoroutineScope(Dispatchers.IO).launch {
                runCatching {
                    val repository = CrmRepository(context)
                    val lead = CallManager.lookup(context, phone)
                    val callId = repository.startUnmatchedCall(
                        lead?.id,
                        phone,
                        direction,
                        deviceId,
                        contactName = lead?.name?.takeUnless { it.startsWith("Unknown caller", ignoreCase = true) } ?: contactName,
                        simSubscriptionId = simSubscriptionId,
                        simSlotIndex = sim?.simSlotIndex,
                        simLabel = sim?.let { info ->
                            val title = info.displayName?.toString()?.trim().orEmpty().ifBlank { info.carrierName?.toString()?.trim().orEmpty() }
                            if (title.isBlank()) "SIM ${info.simSlotIndex + 1}" else "$title · SIM ${info.simSlotIndex + 1}"
                        },
                    )
                    val endedAt = if (callLogDuration > 0L) {
                        startedAt + (callLogDuration * 1000L)
                    } else if (duration > 0L) {
                        endedAtHint
                    } else {
                        startedAt
                    }
                    val store = OfflineEventStore(context)
                    val unpreparedCallId = prefs.getString("unpreparedRecordingCallId", null)
                    // The IDLE handler clears short-lived call prefs immediately
                    // after launching this coroutine. Prefer the immutable
                    // PendingRecording returned by stop(), otherwise the
                    // coroutine can lose the temporary ID and upload the audio
                    // before it is rebound to the newly-created CRM call.
                    val queuedMicUploadId = localMicRecording
                        ?.takeIf { it.callId.startsWith(CallAudioRecorder.UNPREPARED_CALL_PREFIX) }
                        ?.clientUploadId
                        ?: unpreparedCallId?.let { pendingId ->
                            store.pendingRecordings().firstOrNull { it.callId == pendingId }?.clientUploadId
                        }
                    queuedMicUploadId?.let { store.rebindRecordingCall(it, callId) }
                    val shareAutomationArmed = status == "COMPLETED" && duration > 0L &&
                        queuedMicUploadId == null && DialerShareAutomation.arm(context, callId, phone)
                    val recordingStatus = when {
                        queuedMicUploadId != null -> "LOCAL_PENDING"
                        shareAutomationArmed -> "LOCAL_PENDING"
                        else -> "RECORDING_UNAVAILABLE"
                    }
                    val payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", status)
                        .put("endedAt", Instant.ofEpochMilli(endedAt).toString())
                        .put("durationSeconds", duration)
                        .put("recordingStatus", recordingStatus)
                        .put("recordingError", if (recordingStatus == "RECORDING_UNAVAILABLE") "No recording was captured yet. Check Phone app recording or enable the AICloser microphone fallback." else "")
                    store.enqueue("call-log-end-$id", "CALL_END", payload, callId)
                    if (status == "COMPLETED" && duration > 0L && queuedMicUploadId == null) {
                        if (!shareAutomationArmed) {
                            SystemRecordingImportWorker.enqueue(context, callId, startedAt, endedAt, duration, phone)
                        }
                    }
                    repository.syncOffline()
                    // The microphone file is deliberately held back while an
                    // unprepared dialer call is being resolved. Once the real
                    // CRM call exists and the queue row is rebound above,
                    // explicitly wake the upload worker for this recording.
                    if (queuedMicUploadId != null) {
                        RecordingUploadWorker.enqueue(context)
                    }
                }.onFailure { error ->
                    // Leave the call-log marker untouched only for a failed
                    // server request so the next phone event can retry it.
                    Log.e("GXPhoneState", "Could not sync unprepared call log id=$id", error)
                    prefs.edit().remove(LAST_CALL_LOG_ID).apply()
                }
            }
        }
    }

    private fun extractSimAccountFromCallLog(cursor: Cursor): String? {
        val candidates = arrayOf(
            CallLog.Calls.PHONE_ACCOUNT_ID,
            "subscription_id",
            "sim_id",
            "simid",
            "sim_index",
        )
        for (col in candidates) {
            val idx = cursor.getColumnIndex(col)
            if (idx >= 0) {
                val value = try { cursor.getString(idx)?.trim() } catch (_: Exception) { null }
                if (!value.isNullOrBlank()) return value
            }
        }
        return null
    }

    private fun queryRawCallLogSim(
        context: Context,
        expectedPhone: String?,
        minStartedAt: Long?,
    ): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            context.checkSelfPermission(android.Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED
        ) return null
        val expectedDigits = expectedPhone?.filter(Char::isDigit)?.takeLast(10)
        val cutoffTime = minStartedAt ?: (System.currentTimeMillis() - CALL_LOG_LOOKBACK_MS)
        return runCatching {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls._ID,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.DATE,
                    CallLog.Calls.PHONE_ACCOUNT_ID,
                ),
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(cutoffTime.toString()),
                "${CallLog.Calls.DATE} DESC",
            )?.use { cursor ->
                var inspected = 0
                while (cursor.moveToNext() && inspected++ < 10) {
                    val number = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)).orEmpty()
                    if (number.isBlank()) continue
                    val rowDigits = number.filter(Char::isDigit).takeLast(10)
                    if (!expectedDigits.isNullOrBlank() && rowDigits != expectedDigits) continue
                    val accountId = extractSimAccountFromCallLog(cursor)
                    if (!accountId.isNullOrBlank()) return@use accountId
                }
                null
            }
        }.getOrNull()
    }

    private fun latestCallLog(
        context: Context,
        expectedPhone: String? = null,
        minStartedAt: Long? = null,
    ): CallLogDetails? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            context.checkSelfPermission(android.Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED
        ) return null

        val expectedDigits = expectedPhone?.filter(Char::isDigit)?.takeLast(10)
        val cutoffTime = minStartedAt ?: (System.currentTimeMillis() - CALL_LOG_LOOKBACK_MS)

        // Android Telecom flushes CallLog rows asynchronously after IDLE.
        // If an expected phone is known, retry briefly to catch the freshly inserted row.
        var attempts = if (!expectedDigits.isNullOrBlank()) 4 else 1
        while (attempts-- > 0) {
            val cursor = runCatching {
                context.contentResolver.query(
                    CallLog.Calls.CONTENT_URI,
                    arrayOf(
                        CallLog.Calls._ID,
                        CallLog.Calls.NUMBER,
                        CallLog.Calls.TYPE,
                        CallLog.Calls.DATE,
                        CallLog.Calls.DURATION,
                        CallLog.Calls.PHONE_ACCOUNT_ID,
                    ),
                    "${CallLog.Calls.DATE} >= ?",
                    arrayOf(cutoffTime.toString()),
                    "${CallLog.Calls.DATE} DESC",
                )
            }.getOrNull()

            if (cursor != null) {
                cursor.use {
                    var inspected = 0
                    while (it.moveToNext() && inspected++ < 5) {
                        val number = it.getString(it.getColumnIndexOrThrow(CallLog.Calls.NUMBER)).orEmpty()
                        if (number.isBlank()) continue
                        val rowDigits = number.filter(Char::isDigit).takeLast(10)

                        // If expectedPhone is provided, only accept the matching contact/number
                        if (!expectedDigits.isNullOrBlank() && rowDigits != expectedDigits) {
                            continue
                        }

                        val type = it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.TYPE))
                        val simSubscriptionId = extractSimAccountFromCallLog(it)
                        val sim = resolveSim(context, simSubscriptionId)
                        return CallLogDetails(
                            id = it.getString(it.getColumnIndexOrThrow(CallLog.Calls._ID)),
                            number = number,
                            direction = when (type) {
                                CallLog.Calls.INCOMING_TYPE, CallLog.Calls.MISSED_TYPE, CallLog.Calls.REJECTED_TYPE -> "INBOUND"
                                else -> "OUTBOUND"
                            },
                            startedAt = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DATE)),
                            durationSeconds = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DURATION)).coerceAtLeast(0),
                            contactName = lookupContactName(context, number),
                            simSubscriptionId = simSubscriptionId,
                            simSlotIndex = sim?.simSlotIndex,
                            simLabel = sim?.let { info ->
                                val title = info.displayName?.toString()?.trim().orEmpty().ifBlank { info.carrierName?.toString()?.trim().orEmpty() }
                                if (title.isBlank()) "SIM ${info.simSlotIndex + 1}" else "$title · SIM ${info.simSlotIndex + 1}"
                            },
                        )
                    }
                }
            }
            if (attempts > 0) {
                try { Thread.sleep(300L) } catch (_: InterruptedException) { break }
            }
        }
        return null
    }

    private fun lookupContactName(context: Context, phone: String): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            context.checkSelfPermission(android.Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED
        ) return null
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phone))
        return runCatching {
            context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0)?.trim()?.takeIf(String::isNotBlank) else null
            }
        }.getOrNull()
    }

    private fun resolveSim(context: Context, subscriptionId: String?): SubscriptionInfo? {
        if (subscriptionId.isNullOrBlank() ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && context.checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
        ) return null
        return runCatching {
            context.getSystemService(SubscriptionManager::class.java)?.activeSubscriptionInfoList
                ?.firstOrNull { it.subscriptionId.toString() == subscriptionId }
        }.getOrNull()
    }

    private fun normalizedPhone(phone: String): String =
        phone.filter { it.isDigit() }.takeLast(10)

    private fun normalizePhone(raw: String): String {
        val digits = raw.filter { it.isDigit() }
        return when {
            digits.length >= 12 && digits.startsWith("91") -> "+${digits.takeLast(12)}"
            digits.length >= 10 -> digits.takeLast(10)
            else -> raw.trim()
        }
    }

}
