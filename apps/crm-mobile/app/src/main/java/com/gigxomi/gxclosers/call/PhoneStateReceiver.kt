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
import java.util.UUID

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
        val now = System.currentTimeMillis()
        val lastHandledState = prefs.getString("lastHandledState", null)
        val lastHandledStateAt = prefs.getLong("lastHandledStateAt", 0L)
        if (lastHandledState == state && (now - lastHandledStateAt) < 500L) {
            Log.d("GXPhoneState", "Debouncing duplicate $state transition within ${now - lastHandledStateAt}ms")
            return
        }
        prefs.edit().putString("lastHandledState", state).putLong("lastHandledStateAt", now).apply()

        if (state == "RINGING") {
            val hasCurrentSession = !prefs.getString("activeCallId", null).isNullOrBlank() ||
                prefs.getBoolean("incomingSessionStarting", false)
            val offhookAt = prefs.getLong("offhookAt", 0L)
            val currentOffhookIsRecent = prefs.getBoolean("wasOffhook", false) && offhookAt > 0L && now - offhookAt in 0L..30_000L
            if (!hasCurrentSession && !currentOffhookIsRecent) {
                prefs.edit()
                    .putLong("incomingRingingAt", now)
                    .putLong("callSequenceStartedAt", now)
                    .remove("offhookAt")
                    .remove("incomingSessionEnded")
                    .remove("incomingEndedAt")
                    .apply()
            }
        }

        val incoming = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER).orEmpty()
        val screenedPhone = prefs.getString("screenedIncomingPhone", null)?.takeIf {
            prefs.getLong("screenedIncomingAt", 0L) >= (now - 25_000L)
        }
        // When incoming-number extra is missing on RINGING, only accept fresh CallScreening evidence.
        // Never fall back to activePhone (outbound target) or stale cached phone numbers.
        val rawPhone = when {
            incoming.isNotBlank() -> incoming
            state == "RINGING" && !screenedPhone.isNullOrBlank() -> screenedPhone
            state == "RINGING" -> ""
            state == "OFFHOOK" -> prefs.getString("activePhone", "").orEmpty()
            else -> prefs.getString("activePhone", "").orEmpty()
        }
        val phone = normalizePhone(rawPhone)
        Log.i("GXPhoneState", "state=$state incoming=$incoming resolved=$phone")
        prefs.edit().putString("state", state).putString("phone", phone).putLong("updatedAt", System.currentTimeMillis()).apply()

        val detectedSubId = CallManager.extractSubscriptionId(context, intent)
        val initialLead = phone.takeIf(String::isNotBlank)?.let { CallManager.lookup(context, it) }
        val isInitialLead = initialLead != null

        if (detectedSubId != null && CallManager.isPersonalSim(context, detectedSubId) && !isInitialLead) {
            prefs.edit().putBoolean("activeCallIsNonWorkSim", true).apply()
        }

        if (state == "RINGING" && phone.isNotBlank()) {
            if (detectedSubId != null && CallManager.isPersonalSim(context, detectedSubId) && !isInitialLead) {
                Log.i("GXPhoneState", "RINGING detected on personal SIM subId=$detectedSubId phone=$phone. Ignoring completely.")
                prefs.edit().putBoolean("activeCallIsNonWorkSim", true).apply()
                return
            }

            val isMultiSimConfigured = CallManager.availableSims(context).size > 1 &&
                CallManager.simSelection(context) != CallManager.SIM_SELECTION_ASK &&
                CallManager.simSelection(context).isNotBlank()

            val lead = CallManager.lookup(context, phone)

            val isConfirmedPersonalSim = (detectedSubId != null && CallManager.isPersonalSim(context, detectedSubId))
            val allowCrmUi = !isConfirmedPersonalSim || (lead != null)
            if (allowCrmUi) {
                val callerCardShown = DialerShareAccessibilityService.showCallerCard(context, phone)
                if (!callerCardShown) {
                    LeadCallNotification.show(context, phone)
                    CallOverlayWindow.show(context, phone)
                }
            }

            val allowRingingSessionStart = !isConfirmedPersonalSim || (lead != null)

            if (allowRingingSessionStart &&
                phone.isNotBlank() && prefs.getString("activeCallId", null).isNullOrBlank() &&
                prefs.getString("pendingInboundLeadId", null).isNullOrBlank() &&
                !prefs.getBoolean("incomingSessionStarting", false)) {
                // Persist one client key for the physical inbound call before
                // the asynchronous request starts. Retries after a lost
                // response must address the same CRM row, not create another.
                val newIncomingKey = "inbound-${System.currentTimeMillis()}-${UUID.randomUUID()}"
                prefs.edit()
                    .putString("incomingSessionKey", newIncomingKey)
                    .putBoolean("incomingSessionStarting", true)
                    .apply()
                startIncomingSession(context, phone, simSubscriptionId = detectedSubId)
            }
        }

        if (state == "OFFHOOK") {
            val offhookAt = prefs.getLong("offhookAt", 0L)
            val newOffhookTransition = lastHandledState != "OFFHOOK" || now - lastHandledStateAt > 15_000L
            val ringingAt = prefs.getLong("incomingRingingAt", 0L)
            val sequenceStartedAt = ringingAt.takeIf { it > 0L && now - it in 0L..(10 * 60_000L) }
                ?: if (newOffhookTransition) now else prefs.getLong("callSequenceStartedAt", 0L).takeIf { it > 0L } ?: now
            prefs.edit()
                .putBoolean("wasOffhook", true)
                .putLong("offhookAt", if (newOffhookTransition || offhookAt <= 0L) now else offhookAt)
                .putLong("callSequenceStartedAt", sequenceStartedAt)
                .apply()
            val activePhoneForCard = prefs.getString("activePhone", null).orEmpty()
            if (!prefs.getBoolean("activeCallIsNonWorkSim", false) && activePhoneForCard.isNotBlank()) {
                val callerCardShown = DialerShareAccessibilityService.showCallerCard(context, activePhoneForCard)
                if (!callerCardShown) {
                    LeadCallNotification.show(context, activePhoneForCard)
                    CallOverlayWindow.show(context, activePhoneForCard)
                }
            }
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
            } else if ((DialerShareAutomation.isMicrophoneFallbackEnabled(context) &&
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
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    handleIdleState(context, phone, localMicRecording)
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }

    private fun handleIdleState(context: Context, phone: String, localMicRecording: PendingRecording?) {
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        val callId = prefs.getString("activeCallId", null)
        val sessionStarting = prefs.getBoolean("incomingSessionStarting", false)
        val activeSession = !callId.isNullOrBlank() || sessionStarting
        val activePhone = if (activeSession) prefs.getString("activePhone", null)?.ifBlank { null } else null
        val wasOffhook = prefs.getBoolean("wasOffhook", false)
        val offhookAt = prefs.getLong("offhookAt", 0L)
        val sequenceStartedAt = prefs.getLong(
            "callSequenceStartedAt",
            prefs.getLong("incomingRingingAt", prefs.getLong("activeStartedAt", 0L)),
        )
        val freshConnectedSequence = CallHistoryCorrelation.hasFreshConnectedSequence(wasOffhook, offhookAt, System.currentTimeMillis())
        val callLogWindowStart = when {
            activeSession -> sequenceStartedAt.takeIf { it > 0L }?.minus(15_000L)?.coerceAtLeast(0L)
            freshConnectedSequence -> (offhookAt - CallHistoryCorrelation.CALL_LOG_RINGING_TOLERANCE_MS).coerceAtLeast(0L)
            else -> null
        }
        val callLogCandidate = callLogWindowStart?.let { windowStart ->
            latestCallLog(context, expectedPhone = activePhone, minStartedAt = windowStart)
        }
        val now = System.currentTimeMillis()
        val callLog = callLogCandidate?.takeIf { candidate ->
            when {
                candidate.durationSeconds > 0L ->
                    freshConnectedSequence && CallHistoryCorrelation.matchesConnectedCallLogRow(
                        rowStartedAt = candidate.startedAt,
                        durationSeconds = candidate.durationSeconds,
                        observedCallStartedAt = sequenceStartedAt.takeIf { it > 0L } ?: offhookAt,
                        observedOffhookAt = offhookAt,
                        observedIdleAt = now,
                        expectedPhone = activePhone,
                        rowPhone = candidate.number,
                    )
                activeSession -> CallHistoryCorrelation.matchesMissedCallLogRow(
                    rowStartedAt = candidate.startedAt,
                    observedCallStartedAt = sequenceStartedAt,
                    observedIdleAt = now,
                    expectedPhone = activePhone,
                    rowPhone = candidate.number,
                )
                else -> false
            }
        }
        val effectivePhone = callLog?.number?.takeIf(String::isNotBlank) ?: activePhone ?: phone

            val wasNonWork = prefs.getBoolean("activeCallIsNonWorkSim", false)
            val rawSubId = callLog?.simSubscriptionId ?: callLogWindowStart?.let {
                queryRawCallLogSim(context, effectivePhone, it)
            }
            val effectiveLead = effectivePhone.takeIf(String::isNotBlank)?.let { CallManager.lookup(context, it) }
            val isKnownLeadOrCrmCall = effectiveLead != null || !callId.isNullOrBlank()
            val isPersonalCall = !isKnownLeadOrCrmCall && (wasNonWork || (rawSubId != null && CallManager.isPersonalSim(context, rawSubId)))

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
                    .remove("incomingSessionKey")
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
                val inboundMicUploadId = localMicRecording
                    ?.takeIf { it.callId.startsWith(CallAudioRecorder.UNPREPARED_CALL_PREFIX) }
                    ?.clientUploadId
                inboundMicUploadId?.let { OfflineEventStore(context).rebindRecordingCall(it, callId) }
                val audioFileExists = localMicRecording?.let { recording ->
                    java.io.File(recording.path).let { it.exists() && it.length() > 0L }
                } == true
                val uploadJobExists = inboundMicUploadId?.let { uploadId ->
                    OfflineEventStore(context).pendingRecordings().any { it.clientUploadId == uploadId }
                } == true
                val hasLocalAudioFile = CallHistoryCorrelation.isActualAudioAvailable(audioFileExists, uploadJobExists)

                // Correlate with current call-log row or actual captured audio file.
                // Do not mark a call completed solely from a stale pref or uncorrelated broadcast transition.
                val isCorrelatedCallLog = callLog != null && callLog.durationSeconds > 0L
                val isMissedCallLog = callLog != null && callLog.durationSeconds == 0L
                val isUncorrelated = callLog == null && !hasLocalAudioFile

                if (isUncorrelated) {
                    Log.w("GXPhoneState", "IDLE: Uncorrelated state transition for callId=$callId phone=$effectivePhone (no call-log row and no audio file). Discarding phantom session.")
                    CoroutineScope(Dispatchers.IO).launch {
                        runCatching { CrmRepository(context).discardCall(callId) }
                    }
                    val cleanup = prefs.edit()
                        .remove("incomingSessionKey")
                        .remove("activeCallId")
                        .remove("activeLeadId")
                        .remove("activePhone")
                        .remove("activeStartedAt")
                        .remove("activeContactName")
                        .remove("wasOffhook")
                        .remove("offhookAt")
                        .remove("incomingSessionEnded")
                        .remove("incomingEndedAt")
                        .remove("phone")
                    cleanup.apply()
                    return
                }

                val connected = isCorrelatedCallLog || hasLocalAudioFile
                val recordingError = prefs.getString("recordingError", null).orEmpty()
                val endedAtMillis = System.currentTimeMillis()
                val durationSeconds = callLog?.durationSeconds?.takeIf { it > 0L }
                    ?: if (connected) ((endedAtMillis - connectedAt) / 1000).coerceAtLeast(0) else 0L
                val callLogEndedAtForShare = callLog?.takeIf { it.durationSeconds > 0L }
                    ?.let { it.startedAt + it.durationSeconds * 1000L }
                    ?: endedAtMillis

                val shareAutomationArmed = if (
                    connected && durationSeconds > 0L && DialerShareAutomation.isReady(context) &&
                    CallLogSyncManager.isFreshCompletedCallForShareAutomation(
                        System.currentTimeMillis(), callLogEndedAtForShare, durationSeconds,
                    )
                ) {
                    DialerShareAutomation.arm(
                        context,
                        callId,
                        effectivePhone,
                        callLogEndedAtForShare,
                        durationSeconds * 1000L,
                        contactName = callLog?.contactName ?: prefs.getString("activeContactName", ""),
                        direction = prefs.getString("direction", null) ?: callLog?.direction ?: "INBOUND",
                    )
                } else false

                // Only mark recordingStatus as LOCAL_PENDING when an actual audio file or upload job exists.
                val recordingStatus = when {
                    !connected -> "NONE"
                    hasLocalAudioFile -> "LOCAL_PENDING"
                    else -> "RECORDING_UNAVAILABLE"
                }
                if (hasLocalAudioFile) {
                    val finalUploadId = inboundMicUploadId ?: localMicRecording?.clientUploadId
                    if (finalUploadId != null) {
                        OfflineEventStore(context).updateRecordingStatus(finalUploadId, "LOCAL_PENDING")
                    }
                    RecordingUploadWorker.enqueue(context)
                }

                DeviceDiagnostics.record(
                    context,
                    kind = "CALL_RECORDING_ROUTE_SELECTED",
                    callId = callId,
                    fields = JSONObject()
                        .put("stage", "CALL_END")
                        .put("route", when {
                            hasLocalAudioFile -> "MICROPHONE_FALLBACK"
                            shareAutomationArmed -> "DIALER_SHARE"
                            connected && durationSeconds > 0L -> "SYSTEM_IMPORT_PENDING"
                            else -> "NONE"
                        })
                        .put("status", recordingStatus)
                        .put("durationMs", durationSeconds * 1000L),
                )

                val callDirection = prefs.getString("direction", null) ?: callLog?.direction ?: "INBOUND"
                val payload = JSONObject()
                    .put("callSessionId", callId)
                    .put("status", if (connected) "COMPLETED" else "MISSED")
                    .put("direction", callDirection)
                    .put("startedAt", Instant.ofEpochMilli(started).toString())
                    .put("connectedAt", if (connected) Instant.ofEpochMilli(connectedAt).toString() else JSONObject.NULL)
                    .put("endedAt", Instant.ofEpochMilli(endedAtMillis).toString())
                    .put("durationSeconds", if (connected) durationSeconds else 0)
                    .put("recordingStatus", recordingStatus)
                    .put("recordingError", if (recordingStatus == "LOCAL_PENDING") "" else recordingError.ifBlank {
                        if (recordingStatus == "RECORDING_UNAVAILABLE") "No recording was captured yet. Open the completed call in Phone and use Share recording." else ""
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
                if (connected && durationSeconds > 0L) {
                    if (!DialerShareAutomation.isGoogleDialer(context) || !shareAutomationArmed) {
                        SystemRecordingImportWorker.enqueue(
                            context,
                            callId,
                            connectedAt,
                            endedAtMillis,
                            durationSeconds,
                            effectivePhone,
                        )
                    }
                }
                LeadCallNotification.show(context, effectivePhone, ended = true, callId = callId)

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
                if (freshConnectedSequence) {
                    syncUnpreparedCallLog(
                        context,
                        connectedAtHint = offhookAt,
                        callStartedAtHint = sequenceStartedAt,
                        endedAtHint = System.currentTimeMillis(),
                        localMicRecording = localMicRecording,
                    )
                } else {
                    Log.w("GXPhoneState", "IDLE without a fresh connected-call sequence; ignoring unprepared-call fallback")
                }
            }
            if (sessionStarting && localMicRecording?.callId?.startsWith(CallAudioRecorder.UNPREPARED_CALL_PREFIX) == true) {
                prefs.edit().putString("pendingInboundRecordingUploadId", localMicRecording.clientUploadId).apply()
            }
            val isNonWorkCall = prefs.getBoolean("lastDiscardedWasNonWorkSim", false)
            val cleanup = prefs.edit()
                .remove("incomingSessionKey")
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

    private fun queryLatestCallLogNumber(context: Context): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            context.checkSelfPermission(android.Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED
        ) return null
        return runCatching {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls.NUMBER),
                null,
                null,
                "${CallLog.Calls.DATE} DESC LIMIT 1",
            )?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0)?.takeIf(String::isNotBlank) else null
            }
        }.getOrNull()
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
                    callSessionId = prefs.getString("incomingSessionKey", null),
                    contactName = contactName,
                    simSubscriptionId = simSubscriptionId,
                    simSlotIndex = sim?.simSlotIndex,
                    simLabel = sim?.let { info ->
                        val title = info.displayName?.toString()?.trim().orEmpty().ifBlank { info.carrierName?.toString()?.trim().orEmpty() }
                        if (title.isBlank()) "SIM ${info.simSlotIndex + 1}" else "$title • SIM ${info.simSlotIndex + 1}"
                    },
                )
                if (callId.isNullOrBlank()) {
                    throw IllegalStateException("Server returned empty callId for incoming session")
                }
                Log.i("GXPhoneState", "inbound session created callId=$callId")
                val endedBeforeSession = prefs.getBoolean("incomingSessionEnded", false)
                val wasOffhook = prefs.getBoolean("wasOffhook", false)
                prefs.edit().apply {
                    putString("activeCallId", callId)
                    lead?.id?.let { putString("activeLeadId", it) }
                    putString("activePhone", phone)
                    putString("direction", "INBOUND")
                    putLong("activeStartedAt", prefs.getLong("incomingRingingAt", System.currentTimeMillis()))
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
                    val recordingStore = OfflineEventStore(context)
                    val queuedRecording = queuedMicUploadId?.let { uploadId ->
                        recordingStore.allRecordings().firstOrNull { it.clientUploadId == uploadId }
                    }
                    val queuedUploadJobExists = queuedRecording != null && queuedRecording.status in setOf("LOCAL_PENDING", "UPLOADING", "FAILED", "RECORDING")
                    val queuedAudioFileExists = queuedRecording?.let { recording ->
                        java.io.File(recording.filePath).let { it.exists() && it.length() > 0L }
                    } == true
                    val hasLocalAudio = CallHistoryCorrelation.isActualAudioAvailable(queuedAudioFileExists, queuedUploadJobExists)
                    if (hasLocalAudio) queuedMicUploadId?.let { recordingStore.rebindRecordingCall(it, callId) }
                    val shareAutomationArmed = if (
                        wasOffhook && durationSeconds > 0L && DialerShareAutomation.isReady(context) &&
                        CallLogSyncManager.isFreshCompletedCallForShareAutomation(System.currentTimeMillis(), endedAt, durationSeconds)
                    ) {
                        DialerShareAutomation.arm(
                            context,
                            callId,
                            prefs.getString("activePhone", null),
                            endedAt,
                            durationSeconds * 1000L,
                            contactName = prefs.getString("activeContactName", ""),
                            direction = "INBOUND",
                        )
                    } else false
                    val callLog = latestCallLog(context, expectedPhone = phone, minStartedAt = prefs.getLong("activeStartedAt", 0L))
                    val connected = (callLog != null && callLog.durationSeconds > 0L) || hasLocalAudio
                    val realDuration = callLog?.durationSeconds?.takeIf { it > 0L }
                        ?: if (hasLocalAudio && wasOffhook) durationSeconds else 0L
                    val recStatus = when {
                        !connected -> "NONE"
                        hasLocalAudio -> "LOCAL_PENDING"
                        else -> "RECORDING_UNAVAILABLE"
                    }
                    val payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", if (connected) "COMPLETED" else "MISSED")
                        .put("direction", "INBOUND")
                        .put("phoneNumber", phone)
                        .put("contactName", contactName ?: JSONObject.NULL)
                        .put("startedAt", Instant.ofEpochMilli(prefs.getLong("activeStartedAt", System.currentTimeMillis())).toString())
                        .put("connectedAt", if (connected) Instant.ofEpochMilli(prefs.getLong("offhookAt", endedAt)).toString() else JSONObject.NULL)
                        .put("endedAt", Instant.ofEpochMilli(endedAt).toString())
                        .put("durationSeconds", realDuration)
                        .put("recordingStatus", recStatus)
                        .put("recordingError", if (recStatus == "LOCAL_PENDING") "" else if (recStatus == "RECORDING_UNAVAILABLE") "No recording was captured yet. Open the completed call in Phone and use Share recording." else "")
                    OfflineEventStore(context).enqueue("call-end-$callId", "CALL_END", payload, callId)
                    if (wasOffhook && durationSeconds > 0L) {
                        if (!DialerShareAutomation.isGoogleDialer(context) || !shareAutomationArmed) {
                            SystemRecordingImportWorker.enqueue(
                                context,
                                callId,
                                prefs.getLong("offhookAt", endedAt),
                                endedAt,
                                durationSeconds,
                                prefs.getString("activePhone", null),
                            )
                        }
                    }
                    CoroutineScope(Dispatchers.IO).launch {
                        runCatching { CrmRepository(context).syncOffline() }
                    }
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
                        .remove("incomingSessionKey")
                        .apply()
                } else if (wasOffhook && CallAudioRecorder.currentCallId().isNullOrBlank()) {
                    startRecorder(context, callId)
                }
            } catch (error: Exception) {
                Log.e("GXPhoneState", "Could not create incoming call session", error)
                val endedBeforeSession = prefs.getBoolean("incomingSessionEnded", false)
                val wasOffhook = prefs.getBoolean("wasOffhook", false)
                val offhookAt = prefs.getLong("offhookAt", 0L)
                val callStartedAt = prefs.getLong("callSequenceStartedAt", prefs.getLong("incomingRingingAt", offhookAt))
                val endedAt = prefs.getLong("incomingEndedAt", System.currentTimeMillis())
                prefs.edit()
                    .putBoolean("incomingSessionStarting", false)
                    .remove("incomingSessionEnded")
                    .remove("incomingEndedAt")
                    .remove("pendingInboundLeadId")
                    .remove("activeLeadId")
                    .remove("activePhone")
                    .remove("activeContactName")
                    .remove("phone")
                    .remove("incomingSessionKey")
                    .remove("wasOffhook")
                    .apply()
                if (endedBeforeSession || wasOffhook) {
                    if (CallHistoryCorrelation.hasFreshConnectedSequence(wasOffhook, offhookAt, endedAt)) {
                        syncUnpreparedCallLog(
                            context,
                            connectedAtHint = offhookAt,
                            callStartedAtHint = callStartedAt,
                            endedAtHint = endedAt,
                            localMicRecording = null,
                        )
                    }
                }
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
        val canUseMic = Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val fallbackEnabled = DialerShareAutomation.isMicrophoneFallbackEnabled(context)
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
        connectedAtHint: Long,
        callStartedAtHint: Long,
        endedAtHint: Long,
        localMicRecording: PendingRecording? = null,
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            context.checkSelfPermission(android.Manifest.permission.READ_CALL_LOG) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) return

        val resolver = context.contentResolver
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        if (!CallHistoryCorrelation.hasFreshConnectedSequence(true, connectedAtHint, endedAtHint) || callStartedAtHint <= 0L) {
            Log.w("GXPhoneState", "Rejecting unprepared import without fresh OFFHOOK/IDLE evidence")
            return
        }
        val cutoff = (callStartedAtHint - CallHistoryCorrelation.CALL_LOG_RINGING_TOLERANCE_MS).coerceAtLeast(0L)
        val upperBound = endedAtHint + CallHistoryCorrelation.CALL_LOG_END_TOLERANCE_MS
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
                "${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.DATE} <= ?",
                arrayOf(cutoff.toString(), upperBound.toString()),
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
            if (!CallHistoryCorrelation.matchesConnectedCallLogRow(
                    rowStartedAt = startedAt,
                    durationSeconds = callLogDuration,
                    observedCallStartedAt = callStartedAtHint,
                    observedOffhookAt = connectedAtHint,
                    observedIdleAt = endedAtHint,
                    rowPhone = phone,
                )
            ) {
                Log.w("GXPhoneState", "Call-log row id=$id does not match the current OFFHOOK/IDLE timestamps; ignoring")
                return
            }
            val duration = callLogDuration
            val simSubscriptionId = extractSimAccountFromCallLog(it)
            val callLogLead = CallManager.lookup(context, phone)
            val isCallLogLead = callLogLead != null
            if (!isCallLogLead && CallManager.isPersonalSim(context, simSubscriptionId)) {
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
            val contactName = lookupContactName(context, phone)

            val lastTrackedAt = prefs.getLong("lastTrackedCallEndedAt", 0L)
            val lastTrackedPhone = prefs.getString("lastTrackedCallPhone", "").orEmpty()
            val timeSinceLastCallEnd = (System.currentTimeMillis() - lastTrackedAt).coerceAtLeast(0L)
            val lastTrackedId = prefs.getString(LAST_CALL_LOG_ID, "").orEmpty()
            if (lastTrackedAt > 0L &&
                lastTrackedId == id &&
                timeSinceLastCallEnd <= DUPLICATE_IDLE_WINDOW_MS &&
                normalizedPhone(phone) == normalizedPhone(lastTrackedPhone)
            ) {
                // Mark the row as seen without creating a second CRM call.
                prefs.edit().putString(LAST_CALL_LOG_ID, id).apply()
                Log.i("GXPhoneState", "Ignoring duplicate IDLE call-log row id=$id phone=$phone")
                return
            }
            val direction = when (type) {
                CallLog.Calls.INCOMING_TYPE -> "INBOUND"
                CallLog.Calls.OUTGOING_TYPE -> "OUTBOUND"
                else -> "UNKNOWN"
            }
            if (direction == "UNKNOWN") return
            val status = "COMPLETED"
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
                    val startedAtIso = Instant.ofEpochMilli(startedAt).toString()
                    val endedAtIso = if (callLogDuration > 0L) {
                        Instant.ofEpochMilli(startedAt + (callLogDuration * 1000L)).toString()
                    } else if (duration > 0L) {
                        Instant.ofEpochMilli(endedAtHint).toString()
                    } else {
                        Instant.ofEpochMilli(startedAt).toString()
                    }
                    val callId = repository.startUnmatchedCall(
                        lead?.id,
                        phone,
                        direction,
                        deviceId,
                        callSessionId = "call-log-$id",
                        contactName = lead?.name?.takeUnless { it.startsWith("Unknown caller", ignoreCase = true) } ?: contactName,
                        simSubscriptionId = simSubscriptionId,
                        simSlotIndex = sim?.simSlotIndex,
                        simLabel = sim?.let { info ->
                            val title = info.displayName?.toString()?.trim().orEmpty().ifBlank { info.carrierName?.toString()?.trim().orEmpty() }
                        if (title.isBlank()) "SIM ${info.simSlotIndex + 1}" else "$title • SIM ${info.simSlotIndex + 1}"
                        },
                        startedAt = startedAtIso,
                        endedAt = endedAtIso,
                        durationSeconds = duration,
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
                    val shareAutomationArmed = if (
                        status == "COMPLETED" && duration > 0L && DialerShareAutomation.isReady(context) &&
                        CallLogSyncManager.isFreshCompletedCallForShareAutomation(System.currentTimeMillis(), endedAt, duration)
                    ) {
                        DialerShareAutomation.arm(
                            context,
                            callId,
                            phone,
                            endedAt,
                            duration * 1000L,
                            contactName = contactName,
                            direction = direction,
                        )
                    } else false
                    val recordingStatus = when {
                        queuedMicUploadId != null -> "LOCAL_PENDING"
                        else -> "RECORDING_UNAVAILABLE"
                    }
                    if (queuedMicUploadId != null) {
                        store.updateRecordingStatus(queuedMicUploadId, "LOCAL_PENDING")
                        RecordingUploadWorker.enqueue(context)
                    }
                    val payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", status)
                        .put("direction", direction)
                        .put("phoneNumber", phone)
                        .put("contactName", contactName ?: JSONObject.NULL)
                        .put("startedAt", startedAtIso)
                        .put("endedAt", Instant.ofEpochMilli(endedAt).toString())
                        .put("durationSeconds", duration)
                        .put("recordingStatus", recordingStatus)
                        .put("recordingError", if (recordingStatus == "LOCAL_PENDING") "" else if (recordingStatus == "RECORDING_UNAVAILABLE") "No recording was captured yet. Check Phone app recording or enable the AICloser microphone fallback." else "")
                    store.enqueue("call-log-end-$id", "CALL_END", payload, callId)
                    if (status == "COMPLETED" && duration > 0L) {
                        if (!DialerShareAutomation.isGoogleDialer(context) || !shareAutomationArmed) {
                            SystemRecordingImportWorker.enqueue(context, callId, startedAt, endedAt, duration, phone)
                        }
                    }
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
                                CallLog.Calls.OUTGOING_TYPE -> "OUTBOUND"
                                else -> "UNKNOWN"
                            },
                            startedAt = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DATE)),
                            durationSeconds = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DURATION)).coerceAtLeast(0),
                            contactName = lookupContactName(context, number),
                            simSubscriptionId = simSubscriptionId,
                            simSlotIndex = sim?.simSlotIndex,
                            simLabel = sim?.let { info ->
                                val title = info.displayName?.toString()?.trim().orEmpty().ifBlank { info.carrierName?.toString()?.trim().orEmpty() }
                        if (title.isBlank()) "SIM ${info.simSlotIndex + 1}" else "$title • SIM ${info.simSlotIndex + 1}"
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
