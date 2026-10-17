package com.gigxomi.gxclosers.ui

import android.app.Application
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.provider.Settings
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gigxomi.gxclosers.BuildConfig
import com.gigxomi.gxclosers.call.CallManager
import com.gigxomi.gxclosers.call.DeviceCertificationManager
import com.gigxomi.gxclosers.call.LeadCallNotification
import com.gigxomi.gxclosers.call.RealtimeNotification
import com.gigxomi.gxclosers.data.*
import com.gigxomi.gxclosers.device.DeviceIdentity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.Collections
import java.io.File
import java.util.UUID

data class InAppAlert(
    val id: String = java.util.UUID.randomUUID().toString(),
    val type: AlertType,
    val title: String,
    val message: String,
    val leadId: String? = null,
    val conversationId: String? = null,
    val customerName: String? = null,
    val phone: String? = null,
    val actionLabel: String? = null,
) {
    enum class AlertType { CALLBACK, MESSAGE, NOTE, GENERAL }
}

class CrmViewModel(application: Application) : AndroidViewModel(application) {
    val repository = CrmRepository(application)
    var authenticated by mutableStateOf(repository.sessionStore.token != null); private set
    var setupComplete by mutableStateOf(repository.sessionStore.setupComplete); private set
    var session by mutableStateOf(repository.sessionStore.session); private set
    var bootstrap by mutableStateOf<Bootstrap?>(null); private set
    var pipelineStages by mutableStateOf<List<PipelineStage>>(defaultPipelineStages); private set
    var featurePermissions by mutableStateOf<Map<String, Boolean>>(emptyMap()); private set
    var inbox by mutableStateOf<List<InboxItem>>(emptyList()); private set
    var inboxLoading by mutableStateOf(false); private set
    var inboxMessage by mutableStateOf<String?>(null); private set
    var courses by mutableStateOf<List<Course>>(emptyList()); private set
    var learningLoading by mutableStateOf(false); private set
    var learningMessage by mutableStateOf<String?>(null); private set
    var selectedPack by mutableStateOf<LeadPack?>(null); private set
    var chatMessages by mutableStateOf<List<ChatMessage>>(emptyList()); private set
    var chatLoading by mutableStateOf(false); private set
    var customer360 by mutableStateOf<Customer360?>(null); private set
    var customer360Loading by mutableStateOf(false); private set
    var activeInAppAlert by mutableStateOf<InAppAlert?>(null); private set

    fun dismissInAppAlert() {
        activeInAppAlert = null
    }

    fun showInAppAlert(alert: InAppAlert) {
        activeInAppAlert = alert
    }

    var customer360Error by mutableStateOf<String?>(null); private set
    var customer360Unavailable by mutableStateOf(false); private set
    var sessionConflict by mutableStateOf<ClientSlotOccupiedException?>(null); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var status by mutableStateOf<String?>(null); private set
    var syncCounts by mutableStateOf(repository.getSyncCounts()); private set
    var playbackSpeed by mutableFloatStateOf(1.0f); private set
    var playingCallId by mutableStateOf<String?>(null); private set
    var isPlaybackPlaying by mutableStateOf(false); private set
    var playbackPositionSeconds by mutableIntStateOf(0); private set
    var playbackLoadingCallId by mutableStateOf<String?>(null); private set
    var pendingSharedRecording by mutableStateOf(SharedRecordingStore.current(application)); private set
    var certificationStatus by mutableStateOf(repository.sessionStore.certificationStatus); private set
    var certificationFailureReason by mutableStateOf(repository.sessionStore.certificationFailureReason); private set
    var testSessionId by mutableStateOf(repository.sessionStore.lastTestSessionId); private set
    var testSessionBusy by mutableStateOf(false); private set
    var testSessionMessage by mutableStateOf<String?>(null); private set
    var createdPaymentLink by mutableStateOf<CreatedPaymentLink?>(null); private set
    val currentDeviceId: String = android.provider.Settings.Secure.getString(
        application.contentResolver,
        android.provider.Settings.Secure.ANDROID_ID
    ) ?: ""
    val currentDeviceModel: String = android.os.Build.MODEL

    private var heartbeatJob: Job? = null
    private var realtimeConnection: AutoCloseable? = null
    private var lastEventId: String? = null
    private val processedEventIds = Collections.synchronizedSet(HashSet<String>())
    private var activeConversationId: String? = null
    private var mediaPlayer: MediaPlayer? = null
    private var playbackProgressJob: Job? = null

    init {
        if (authenticated) {
            val uid = session?.userId
            if (!setupComplete && !uid.isNullOrBlank() && repository.sessionStore.isSetupCompleteForUser(uid)) {
                repository.sessionStore.markSetupComplete(uid)
                setupComplete = true
            }
            if (setupComplete) {
                refreshAll()
                startRealtime()
            }
            startHeartbeat()
        }
    }

    // Keep a session conflict visible after the transient snackbar is dismissed.
    // The conflict card owns its lifecycle and is cleared when a new login starts.
    fun clearMessage() { error = null; status = null }
    fun showError(message: String) { error = message }

    private fun launchWork(block: suspend () -> Unit) {
        viewModelScope.launch {
            busy = true; error = null
            try {
                block()
            } catch (e: Exception) {
                error = when (e) {
                    is InvalidCredentialsException -> "Invalid email/phone or password"
                    is ClientSlotOccupiedException -> {
                        sessionConflict = e
                        e.message ?: "Your mobile account is already active on another device."
                    }
                    is SessionRevokedException -> {
                        handleSessionRevoked()
                        "Your mobile session was revoked or expired. Please sign in again."
                    }
                    is ForbiddenException -> "Access denied. Insufficient permissions."
                    is NotFoundException -> "The requested resource was not found."
                    is ValidationException -> e.message ?: "Validation error."
                    is NetworkTimeoutException -> "Network timed out. Please check your connection."
                    is SavedOfflineException -> {
                        updateSyncCounts()
                        e.message
                    }
                    else -> e.message ?: "Something went wrong."
                }
            } finally {
                busy = false
                updateSyncCounts()
            }
        }
    }

    fun onForeground() {
        startHeartbeat()
        if (authenticated && setupComplete) {
            // Re-read the bootstrap projection when returning from background so
            // role permissions, leads, calls, and recording states are not stale.
            refreshAll()
            startRealtime()
        }
    }

    fun onBackground() {
        stopHeartbeat()
        stopRealtime()
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        val currentToken = repository.sessionStore.token ?: return
        heartbeatJob = viewModelScope.launch(Dispatchers.IO) {
            while (isActive) {
                delay(60_000L)
                if (!isActive || !authenticated) break
                if (repository.sessionStore.token != currentToken) break
                try {
                    repository.heartbeat(deviceId())
                } catch (e: SessionRevokedException) {
                    if (repository.sessionStore.token == currentToken) {
                        withContext(Dispatchers.Main) { handleSessionRevoked() }
                    }
                    break
                } catch (_: Exception) {
                    // Network error during heartbeat, will retry next tick
                }
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private fun handleSessionRevoked() {
        stopHeartbeat()
        stopRealtime()
        repository.sessionStore.clearSession()
        authenticated = false
        setupComplete = false
        session = null
        bootstrap = null
        error = "Your mobile session was revoked or expired. Please sign in again."
    }

    private fun startRealtime() {
        stopRealtime()
        if (!authenticated || !setupComplete) return
        realtimeConnection = repository.api.openRealtimeStream(lastEventId = lastEventId) { id, eventType, data ->
            if (id != null) {
                lastEventId = id
                if (!processedEventIds.add(id)) return@openRealtimeStream
            }
            viewModelScope.launch(Dispatchers.Main) {
                handleRealtimeEvent(eventType, data)
            }
        }
    }

    private fun stopRealtime() {
        realtimeConnection?.close()
        realtimeConnection = null
    }

    private fun handleRealtimeEvent(eventType: String, data: JSONObject) {
        val actualEventType = data.optString("eventType", eventType).ifBlank { eventType }
        val payload = data.optJSONObject("payload") ?: data
        val normalizedEventType = actualEventType.lowercase().replace('-', '.')
        RealtimeNotification.show(getApplication(), normalizedEventType, payload)

        val isCallback = normalizedEventType == "callback.due" ||
            normalizedEventType == "callback.scheduled" ||
            normalizedEventType == "follow.up.due" ||
            normalizedEventType == "follow.up.scheduled" ||
            (normalizedEventType.startsWith("lead.") && (payload.has("followUpAt") || payload.has("nextFollowUpAt")))

        val isChatMessage = normalizedEventType == "message.created" ||
            normalizedEventType == "chat.message" ||
            normalizedEventType == "whatsapp.message" ||
            normalizedEventType == "message.received" ||
            normalizedEventType == "conversation.message"

        val isNoteUpdate = normalizedEventType == "lead.note_updated" ||
            (normalizedEventType.startsWith("lead.") && (payload.has("note") || payload.has("notes") || payload.has("internalNotes")))

        val convId = payload.optString("conversationId", payload.optString("id"))
        val leadIdFromPayload = payload.optString("leadId", payload.optString("id"))
        val matchedLead = bootstrap?.leads?.find { it.id == leadIdFromPayload || it.id == convId }
            ?: inbox.find { it.conversationId == convId || it.lead.id == leadIdFromPayload }?.lead

        val customerName = payload.optString("customerName", payload.optString("leadName", matchedLead?.customerName ?: "Lead")).ifBlank { matchedLead?.customerName ?: "Lead" }
        val customerPhone = payload.optString("customerPhone", payload.optString("phone", matchedLead?.customerPhone ?: "")).ifBlank { matchedLead?.customerPhone ?: "" }

        if (isCallback) {
            val callbackAt = payload.optString("followUpAt", payload.optString("nextFollowUpAt", "Soon"))
            activeInAppAlert = InAppAlert(
                type = InAppAlert.AlertType.CALLBACK,
                title = "📞 Callback Due: $customerName",
                message = "Scheduled follow-up • $customerPhone",
                leadId = matchedLead?.id ?: leadIdFromPayload,
                phone = customerPhone,
                customerName = customerName,
                actionLabel = "Call Now",
            )
        } else if (isChatMessage) {
            val body = payload.optString("body", payload.optString("message", "New chat message waiting")).ifBlank { "New chat message waiting" }
            activeInAppAlert = InAppAlert(
                type = InAppAlert.AlertType.MESSAGE,
                title = "💬 $customerName",
                message = body,
                conversationId = convId,
                customerName = customerName,
                actionLabel = "Reply",
            )
        } else if (isNoteUpdate) {
            val noteText = payload.optString("note", payload.optString("notes", payload.optString("body", "Notes updated"))).ifBlank { "Notes were updated for this lead." }
            activeInAppAlert = InAppAlert(
                type = InAppAlert.AlertType.NOTE,
                title = "📝 Note Updated: $customerName",
                message = noteText,
                leadId = matchedLead?.id ?: leadIdFromPayload,
                customerName = customerName,
                actionLabel = "View Lead",
            )
        }

        when (normalizedEventType) {
            "lead.updated", "lead.note_updated" -> {
                val leadId = payload.optString("leadId", payload.optString("id"))
                val conversationId = payload.optString("conversationId")
                if (leadId.isNotBlank() || conversationId.isNotBlank()) refreshAll()
            }
            "conversation.updated", "conversation.created" -> refreshAll()
            "message.created" -> {
                val conversationId = payload.optString("conversationId", payload.optString("id"))
                if (conversationId.isNotBlank() && conversationId == activeConversationId) {
                    loadChat(conversationId)
                }
                loadInbox()
            }
            "message.read" -> {
                loadInbox()
            }
            "call.ended" -> {
                val callId = payload.optString("callId", payload.optString("id"))
                if (callId.isNotBlank()) {
                    refreshAll()
                }
            }
            "recording.uploaded", "recording.failed" -> {
                refreshAll()
                updateSyncCounts()
            }
            "lead.created", "task.created", "follow.up.scheduled", "callback.scheduled" -> refreshAll()
            "device.online", "device.offline" -> {
                // Refresh device status
            }
        }
    }

    fun updateSyncCounts() {
        syncCounts = repository.getSyncCounts()
    }

    fun login(identifier: String, password: String, forceReplace: Boolean = false, done: () -> Unit = {}) = launchWork {
        sessionConflict = null
        error = null
        stopHeartbeat()
        stopRealtime()
        val result = withContext(Dispatchers.IO) { repository.login(identifier.trim(), password, forceReplace = forceReplace) }
        session = result
        authenticated = true
        sessionConflict = null
        error = null
        if (forceReplace) {
            repository.sessionStore.markSetupComplete(result.userId)
            setupComplete = true
        } else {
            val userDone = repository.sessionStore.isSetupCompleteForUser(result.userId)
            if (userDone) {
                repository.sessionStore.markSetupComplete(result.userId)
                setupComplete = true
            } else {
                setupComplete = repository.sessionStore.setupComplete
            }
        }
        if (setupComplete) {
            refreshAllInternal()
            startRealtime()
        }
        startHeartbeat()
        done()
    }

    fun startTestSession(): String {
        val id = DeviceCertificationManager.startTestSession(getApplication())
        testSessionId = id
        certificationStatus = DeviceCertificationManager.STATUS_TESTING
        certificationFailureReason = null
        testSessionMessage = "Test session started. Make a 10+ second test call on your work SIM now."
        return id
    }

    fun evaluateTestCall(done: (DeviceCertificationManager.DiagnosticChecklist) -> Unit = {}) {
        testSessionBusy = true
        testSessionMessage = "Evaluating test call recording..."
        viewModelScope.launch {
            val checklist = withContext(Dispatchers.IO) {
                DeviceCertificationManager.evaluateTestCall(getApplication(), repository)
            }
            certificationStatus = checklist.status
            certificationFailureReason = checklist.failureReason
            testSessionMessage = checklist.summaryMessage
            testSessionBusy = false
            refreshAll()
            done(checklist)
        }
    }

    fun skipTestCertification(done: () -> Unit = {}) {
        launchWork {
            sessionConflict = null
            error = null
            withContext(Dispatchers.IO) {
                DeviceCertificationManager.updateStatus(
                    getApplication(),
                    repository,
                    DeviceCertificationManager.STATUS_UNVERIFIED,
                    null,
                    testSessionId,
                )
                registerDeviceOnIo(force = true)
            }
            certificationStatus = DeviceCertificationManager.STATUS_UNVERIFIED
            certificationFailureReason = null
            repository.sessionStore.markSetupComplete(session?.userId)
            setupComplete = true
            sessionConflict = null
            error = null
            refreshAllInternal()
            startRealtime()
            startHeartbeat()
            done()
        }
    }

    fun registerDevice(force: Boolean = true, done: () -> Unit = {}) = launchWork {
        sessionConflict = null
        error = null
        withContext(Dispatchers.IO) { registerDeviceOnIo(force) }
        repository.sessionStore.markSetupComplete(session?.userId)
        setupComplete = true
        sessionConflict = null
        error = null
        refreshAllInternal()
        startRealtime()
        startHeartbeat()
        done()
    }

    private fun registerDeviceOnIo(force: Boolean) {
        val id = deviceId()
        val identity = DeviceIdentity.current()
        repository.registerDevice(
            id,
            identity.displayName,
            identity.manufacturerLabel,
            identity.modelLabel,
            Build.VERSION.RELEASE,
            BuildConfig.VERSION_NAME,
            force = force
        )
    }

    fun refreshAll() = launchWork { refreshAllInternal() }

    private suspend fun refreshAllInternal() {
        val data = withContext(Dispatchers.IO) {
            runCatching { repository.syncOffline() }
            runCatching { repository.uploadPendingRecording() }
            runCatching { com.gigxomi.gxclosers.call.CallLogSyncManager.syncRecentCallLogs(getApplication()) }
            val stagesData = runCatching { repository.stages() }.getOrDefault(defaultPipelineStages)
            val raw = repository.bootstrap()
            val store = OfflineEventStore(getApplication())
            val localRecordings = store.allRecordings().associateBy { it.callId }
            val existingIds = raw.calls.map { it.id }.toSet()
            val localCalls = store.recentLocalCalls()
                .filter { it.callId !in existingIds && it.status != "UNVERIFIED" && !it.direction.equals("UNKNOWN", ignoreCase = true) }

            val synthesizedLocalCalls = localCalls.map { rec ->
                val localRec = localRecordings[rec.callId]
                val effectiveStatus = when (localRec?.status) {
                    "UPLOADED" -> "UPLOADED"
                    "UPLOADING" -> "UPLOADING"
                    "FAILED", "FAILED_PERMANENT" -> "FAILED"
                    "LOCAL_PENDING", "RECORDING" -> "LOCAL_PENDING"
                    else -> rec.recordingStatus
                }
                val lead = raw.leads.find { l ->
                    val normLead = l.customerPhone.filter(Char::isDigit).takeLast(10)
                    val normCall = rec.phoneNumber.filter(Char::isDigit).takeLast(10)
                    normLead.isNotBlank() && normLead == normCall
                } ?: com.gigxomi.gxclosers.data.SalesLead(
                    id = rec.callId,
                    customerName = rec.contactName ?: "Unknown caller",
                    customerPhone = rec.phoneNumber,
                    customerEmail = "",
                    stage = "CONTACTED",
                    source = "PHONE_CALL",
                    serviceInterest = "Phone enquiry",
                    notes = "",
                    followUpAt = null,
                    priority = "NORMAL",
                )
                com.gigxomi.gxclosers.data.MobileCall(
                    id = rec.callId,
                    assignmentId = lead.id,
                    phoneNumber = rec.phoneNumber,
                    direction = rec.direction,
                    status = rec.status,
                    outcome = null,
                    note = null,
                    durationSeconds = rec.durationSeconds,
                    recordingStatus = effectiveStatus,
                    recordingError = localRec?.errorMessage,
                    startedAt = rec.startedAt,
                    endedAt = rec.endedAt,
                    assignment = lead,
                )
            }

            val mergedCalls = synthesizedLocalCalls + raw.calls
            val enrichedCalls = mergedCalls.map { call ->
                val local = localRecordings[call.id]
                if (local != null && call.recordingStatus != "UPLOADED") {
                    val effectiveStatus = when (local.status) {
                        "UPLOADED" -> "UPLOADED"
                        "UPLOADING" -> "UPLOADING"
                        "FAILED", "FAILED_PERMANENT" -> "FAILED"
                        "LOCAL_PENDING", "RECORDING" -> "LOCAL_PENDING"
                        else -> call.recordingStatus
                    }
                    call.copy(
                        recordingStatus = effectiveStatus,
                        recordingError = local.errorMessage ?: call.recordingError
                    )
                } else if (local == null && (call.recordingStatus == "LOCAL_PENDING" || call.recordingStatus == "UPLOADING")) {
                    // Only label recordingStatus as pending when a physical recording file exists in the queue.
                    call.copy(recordingStatus = "NONE", recordingError = null)
                } else {
                    call
                }
            }
            raw.copy(calls = enrichedCalls)
        }
        bootstrap = data
        featurePermissions = data.permissions
        CallManager.cacheLeads(getApplication(), data.leads)
        updateSyncCounts()
        checkDueCallbacks(data.leads)
    }

    fun retryOfflineSync() = launchWork {
        val synced = withContext(Dispatchers.IO) { repository.syncOffline() }
        refreshAll()
        status = if (synced > 0) "Synced $synced offline event(s)." else "Sync completed."
    }

    fun retryPendingRecordings() {
        RecordingUploadWorker.retryNow(getApplication())
        status = "Retrying recording uploads..."
    }

    fun refreshSharedRecording() {
        val pending = SharedRecordingStore.current(getApplication())
        pendingSharedRecording = pending
        if (pending?.matchedCallId != null) {
            autoAttachMatchedRecording(pending)
        } else {
            status = if (pending != null) {
                "Recording imported. No exact call match was found; choose the matching completed call."
            } else {
                "Shared recording could not be imported."
            }
        }
    }

    private fun autoAttachMatchedRecording(pending: PendingSharedRecording) = launchWork {
        val callId = pending.matchedCallId ?: throw IllegalStateException("No matched call was found.")
        val context = getApplication<Application>()
        val crmDir = java.io.File(context.filesDir, "crm-recordings").apply { mkdirs() }
        val sourceFile = java.io.File(pending.path)
        val ext = sourceFile.extension.ifBlank { "m4a" }
        val permanentFile = java.io.File(crmDir, "shared-$callId-${System.currentTimeMillis()}.$ext")
        val safeFile = if (sourceFile.exists()) {
            if (!sourceFile.renameTo(permanentFile)) {
                sourceFile.copyTo(permanentFile, overwrite = true)
                sourceFile.delete()
            }
            permanentFile
        } else {
            sourceFile
        }

        val clientUploadId = "manual-shared-${pending.receivedAt}-${safeFile.length()}"
        OfflineEventStore(context).enqueueRecording(
            QueuedRecording(
                clientUploadId = clientUploadId,
                callId = callId,
                tenantId = null,
                deviceId = deviceId(),
                filePath = safeFile.absolutePath,
                sizeBytes = safeFile.length(),
                durationMs = pending.durationMs,
                status = "LOCAL_PENDING",
            )
        )
        SharedRecordingStore.clearPreferences(context)
        pendingSharedRecording = null
        RecordingUploadWorker.enqueue(context)
        updateSyncCounts()
        status = "Recording linked to ${pending.matchedPhone ?: "the matching completed call"} and uploading."
        refreshAll()
    }

    fun discardSharedRecording() {
        SharedRecordingStore.discard(getApplication())
        pendingSharedRecording = null
        status = "Imported recording discarded."
    }

    fun attachSharedRecording(call: MobileCall) = launchWork {
        val pending = pendingSharedRecording ?: throw IllegalStateException("No shared recording is waiting.")
        if (call.id.isBlank()) throw IllegalArgumentException("This call cannot accept a recording yet.")
        if (!call.status.equals("COMPLETED", ignoreCase = true)) {
            throw IllegalArgumentException("Only a completed call can receive a recording.")
        }
        val context = getApplication<Application>()
        val crmDir = java.io.File(context.filesDir, "crm-recordings").apply { mkdirs() }
        val sourceFile = java.io.File(pending.path)
        val ext = sourceFile.extension.ifBlank { "m4a" }
        val permanentFile = java.io.File(crmDir, "shared-${call.id}-${System.currentTimeMillis()}.$ext")
        val safeFile = if (sourceFile.exists()) {
            if (!sourceFile.renameTo(permanentFile)) {
                sourceFile.copyTo(permanentFile, overwrite = true)
                sourceFile.delete()
            }
            permanentFile
        } else {
            sourceFile
        }

        OfflineEventStore(context).enqueueRecording(
            QueuedRecording(
                clientUploadId = "shared-${UUID.randomUUID()}",
                callId = call.id,
                tenantId = null,
                deviceId = deviceId(),
                filePath = safeFile.absolutePath,
                sizeBytes = safeFile.length(),
                durationMs = pending.durationMs.takeIf { it > 0L } ?: call.durationSeconds * 1000L,
                status = "LOCAL_PENDING",
            )
        )
        SharedRecordingStore.clearPreferences(context)
        pendingSharedRecording = null
        RecordingUploadWorker.enqueue(context)
        updateSyncCounts()
        status = "Recording queued for ${call.assignment?.customerName ?: call.phoneNumber}."
    }

    fun attachAudioUri(callId: String, uri: Uri) = launchWork {
        if (callId.isBlank()) throw IllegalArgumentException("Invalid call ID.")
        val context = getApplication<Application>()
        val resolver = context.contentResolver
        val directory = java.io.File(context.filesDir, "crm-recordings").apply { mkdirs() }
        val destination = java.io.File(directory, "manual-$callId-${System.currentTimeMillis()}.m4a")
        val copied = withContext(Dispatchers.IO) {
            runCatching {
                resolver.openInputStream(uri)?.use { input ->
                    destination.outputStream().use { output -> input.copyTo(output) }
                } ?: 0L
            }.getOrDefault(0L)
        }
        if (copied <= 0L) {
            destination.delete()
            throw IllegalArgumentException("Could not read selected audio file.")
        }
        val durationMs = runCatching {
            android.media.MediaMetadataRetriever().let { retriever ->
                try {
                    retriever.setDataSource(destination.absolutePath)
                    retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
                } finally {
                    retriever.release()
                }
            }
        }.getOrDefault(0L)

        val targetCall = bootstrap?.calls?.find { it.id == callId }
        val duration = if (durationMs > 0L) durationMs else (targetCall?.durationSeconds ?: 0).toLong() * 1000L

        OfflineEventStore(context).enqueueRecording(
            QueuedRecording(
                clientUploadId = "manual-${UUID.randomUUID()}",
                callId = callId,
                tenantId = null,
                deviceId = deviceId(),
                filePath = destination.absolutePath,
                sizeBytes = destination.length(),
                durationMs = duration,
                status = "LOCAL_PENDING",
            )
        )
        RecordingUploadWorker.retryNow(context)
        updateSyncCounts()
        status = "Audio attached. Uploading in background..."
        refreshAll()
    }

    fun retryRecordingUpload(callId: String) = launchWork {
        val context = getApplication<Application>()
        val store = OfflineEventStore(context)
        val queueItem = store.recordingForCall(callId)
        if (queueItem != null) {
            store.updateRecordingStatus(queueItem.clientUploadId, "LOCAL_PENDING", null)
        }
        RecordingUploadWorker.retryNow(context)
        updateSyncCounts()
        status = "Retrying recording upload..."
        refreshAll()
    }

    fun setSpeed(speed: Float) {
        playbackSpeed = speed
        mediaPlayer?.let { player ->
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    player.playbackParams = player.playbackParams.setSpeed(speed)
                }
            }
        }
    }

    fun playRecording(callId: String) {
        if (playingCallId == callId && mediaPlayer != null) {
            val player = mediaPlayer ?: return
            if (player.isPlaying) {
                player.pause()
                isPlaybackPlaying = false
                playbackProgressJob?.cancel()
            } else {
                player.start()
                isPlaybackPlaying = true
                playbackProgressJob?.cancel()
                playbackProgressJob = viewModelScope.launch {
                    while (isActive && mediaPlayer === player && player.isPlaying) {
                        playbackPositionSeconds = player.currentPosition / 1000
                        delay(250L)
                    }
                }
            }
            return
        }
        playbackProgressJob?.cancel()
        mediaPlayer?.release()
        mediaPlayer = null
        playingCallId = null
        isPlaybackPlaying = false
        playbackPositionSeconds = 0
        playbackLoadingCallId = callId
        viewModelScope.launch {
            try {
                val file = withContext(Dispatchers.IO) {
                    val store = OfflineEventStore(getApplication())
                    val localPath = store.recordingForCall(callId)?.filePath
                    val localFile = localPath?.let { java.io.File(it) }
                    if (localFile != null && localFile.exists() && localFile.length() > 0L) {
                        localFile
                    } else {
                        val cached = java.io.File(getApplication<Application>().cacheDir, "recording-$callId.m4a")
                        if (!cached.exists() || cached.length() == 0L) {
                            repository.api.downloadRecording(callId, cached)
                        }
                        cached
                    }
                }
                val player = MediaPlayer().apply {
                    setDataSource(file.absolutePath)
                    setOnPreparedListener { prepared ->
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            prepared.playbackParams = prepared.playbackParams.setSpeed(playbackSpeed)
                        }
                        playbackLoadingCallId = null
                        playingCallId = callId
                        isPlaybackPlaying = true
                        prepared.start()
                        playbackProgressJob?.cancel()
                        playbackProgressJob = viewModelScope.launch {
                            while (isActive && mediaPlayer === prepared) {
                                playbackPositionSeconds = prepared.currentPosition / 1000
                                delay(250L)
                            }
                        }
                    }
                    setOnCompletionListener {
                        playbackProgressJob?.cancel()
                        playingCallId = null
                        isPlaybackPlaying = false
                        playbackLoadingCallId = null
                        playbackPositionSeconds = 0
                        it.release()
                        if (mediaPlayer === it) mediaPlayer = null
                    }
                    setOnErrorListener { failed, what, extra ->
                        playbackProgressJob?.cancel()
                        playbackLoadingCallId = null
                        playingCallId = null
                        isPlaybackPlaying = false
                        playbackPositionSeconds = 0
                        error = "Recording could not be played (media error $what/$extra)."
                        failed.release()
                        if (mediaPlayer === failed) mediaPlayer = null
                        true
                    }
                }
                mediaPlayer = player
                player.prepareAsync()
            } catch (e: Exception) {
                mediaPlayer?.release()
                mediaPlayer = null
                playingCallId = null
                playbackLoadingCallId = null
                isPlaybackPlaying = false
                error = e.message ?: "Recording could not be played."
            }
        }
    }

    fun seekRecordingTo(fraction: Float) {
        mediaPlayer?.let { player ->
            runCatching {
                val target = (player.duration * fraction.coerceIn(0f, 1f)).toInt()
                player.seekTo(target)
                playbackPositionSeconds = target / 1000
            }
        }
    }

    fun seekRecordingBy(seconds: Int) {
        mediaPlayer?.let { player ->
            runCatching {
                val target = (player.currentPosition + seconds * 1000).coerceIn(0, player.duration)
                player.seekTo(target)
                playbackPositionSeconds = target / 1000
            }
        }
    }

    override fun onCleared() {
        playbackProgressJob?.cancel()
        mediaPlayer?.release()
        mediaPlayer = null
        isPlaybackPlaying = false
        super.onCleared()
    }

    fun loadInbox() {
        if (inboxLoading) return
        viewModelScope.launch {
            inboxLoading = true
            inboxMessage = null
            try {
                inbox = withContext(Dispatchers.IO) { repository.inbox() }
            } catch (e: Exception) {
                if (e is SessionRevokedException) {
                    handleSessionRevoked()
                } else {
                    inboxMessage = e.message?.takeIf { it.isNotBlank() } ?: "Inbox could not be refreshed right now."
                }
            } finally {
                inboxLoading = false
            }
        }
    }

    fun loadCourses() {
        viewModelScope.launch {
            learningLoading = true
            learningMessage = null
            try {
                courses = withContext(Dispatchers.IO) { repository.courses() }
                if (courses.isEmpty()) learningMessage = "No published sales lessons yet."
            } catch (e: Exception) {
                if (e is SessionRevokedException) {
                    handleSessionRevoked()
                } else {
                    learningMessage = if (e is ApiException && e.status == 404) "The sales learning catalog is being prepared." else e.message?.takeIf { it.isNotBlank() } ?: "Learning could not be refreshed right now."
                }
            } finally {
                learningLoading = false
            }
        }
    }

    fun requestPack(size: Int) = launchWork { selectedPack = withContext(Dispatchers.IO) { repository.requestLeadPack(size) } }
    fun clearPack() { selectedPack = null }

    fun loadCustomer360(leadId: String) {
        viewModelScope.launch {
            customer360Loading = true
            customer360Error = null
            customer360Unavailable = false
            try {
                customer360 = withContext(Dispatchers.IO) { repository.customer360(leadId) }
            } catch (e: Exception) {
                customer360 = null
                if (e is SessionRevokedException) {
                    handleSessionRevoked()
                } else if (e is ApiException && e.status == 404) customer360Unavailable = true
                else customer360Error = e.message?.takeIf { it.isNotBlank() } ?: "Live journey sync is temporarily unavailable."
            } finally {
                customer360Loading = false
            }
        }
    }

    fun clearCustomer360() {
        customer360 = null
        customer360Error = null
        customer360Unavailable = false
        customer360Loading = false
    }

    fun createFollowUpTask(leadId: String, title: String, dueAt: String, priority: String, description: String) = launchWork {
        if (title.isBlank() || dueAt.isBlank()) throw IllegalArgumentException("Task title and due date are required.")
        withContext(Dispatchers.IO) { repository.createFollowUpTask(leadId, title.trim(), dueAt.trim(), priority, description.trim()) }
        customer360 = withContext(Dispatchers.IO) { repository.customer360(leadId) }
        status = "Follow-up task scheduled."
    }

    fun completeTask(leadId: String, taskId: String) = launchWork {
        withContext(Dispatchers.IO) { repository.updateTaskStatus(leadId, taskId, "DONE") }
        customer360 = withContext(Dispatchers.IO) { repository.customer360(leadId) }
        status = "Task completed."
    }

    fun claimPack(done: () -> Unit) = launchWork {
        val pack = selectedPack ?: return@launchWork
        withContext(Dispatchers.IO) { repository.claimLeadPack(pack.id) }
        selectedPack = null
        // Wait for the live bootstrap refresh before leaving the screen so
        // the newly claimed leads are immediately visible in the pipeline.
        refreshAllInternal()
        done()
    }

    fun createPaymentLink(
        baseAmount: Double,
        quantity: Int,
        duration: Int,
        durationUnit: String,
        customerName: String,
        customerPhone: String,
        customerEmail: String,
        productName: String,
        customerNote: String,
        done: (CreatedPaymentLink) -> Unit = {},
    ) = launchWork {
        val result = withContext(Dispatchers.IO) {
            repository.createPaymentLink(
                baseAmount = baseAmount,
                quantity = quantity,
                duration = duration,
                durationUnit = durationUnit,
                customerName = customerName.trim(),
                customerPhone = customerPhone.trim(),
                customerEmail = customerEmail.trim(),
                productName = productName.trim(),
                customerNote = customerNote.trim(),
            )
        }
        createdPaymentLink = result
        done(result)
    }

    fun clearCreatedPaymentLink() {
        createdPaymentLink = null
    }

    fun startCall(lead: SalesLead, sim: com.gigxomi.gxclosers.call.SimOption? = null) {
        val app = getApplication<Application>()
        val localCallId = "call-${UUID.randomUUID()}"
        CallManager.prepare(app, localCallId, lead, sim)
        CallManager.dial(app, lead.customerPhone, sim)
        status = "Tracked call started. Complete the disposition when the call ends."
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val serverCallId = repository.startCall(
                        lead = lead,
                        deviceId = deviceId(),
                        simSubscriptionId = sim?.subscriptionId,
                        simSlotIndex = sim?.slotIndex,
                        simLabel = sim?.label,
                        callSessionId = localCallId,
                    )
                    if (serverCallId.isNotBlank() && serverCallId != localCallId) {
                        CallManager.prepare(app, serverCallId, lead, sim)
                    }
                }
            } catch (_: Exception) {
                // Background startCall sync failure is safely ignored as call is dialed and logged locally
            }
        }
    }

    fun saveDisposition(callId: String, customerName: String, outcome: String, note: String, followUp: String?, stageUpdate: String, done: () -> Unit) = launchWork {
        if (outcome.isBlank() || note.isBlank()) throw IllegalArgumentException("Outcome and notes are required.")
        try {
            withContext(Dispatchers.IO) { repository.submitDisposition(callId, customerName.trim(), outcome, note.trim(), followUp, stageUpdate) }
        } catch (_: SavedOfflineException) {
            status = "Saved offline. GXClosers will sync it when connection returns."
        }
        refreshAll()
        done()
    }

    fun openChat(id: String) {
        activeConversationId = id
        loadChat(id)
    }

    fun closeChat() {
        activeConversationId = null
    }

    fun loadChat(id: String) {
        if (chatLoading) return
        viewModelScope.launch {
            chatLoading = true
            try {
                chatMessages = withContext(Dispatchers.IO) { repository.chat(id) }
            } catch (e: Exception) {
                if (e is SessionRevokedException) {
                    handleSessionRevoked()
                } else {
                    error = e.message ?: "Conversation could not be refreshed."
                }
            } finally {
                chatLoading = false
            }
        }
    }

    fun sendChat(id: String, body: String) = launchWork {
        if (body.isNotBlank()) withContext(Dispatchers.IO) { repository.sendChat(id, body.trim()) }
        chatMessages = withContext(Dispatchers.IO) { repository.chat(id) }
    }

    fun sendChatAttachment(
        id: String,
        name: String,
        mimeType: String?,
        sizeBytes: Long?,
    ) = launchWork {
        val cleanName = name.trim()
        if (cleanName.isBlank()) throw IllegalArgumentException("The selected file has no name.")
        if (sizeBytes != null && sizeBytes > 20L * 1024L * 1024L) {
            throw IllegalArgumentException("Choose a file smaller than 20 MB.")
        }
        withContext(Dispatchers.IO) {
            repository.sendChat(
                conversationId = id,
                body = "",
                attachmentName = cleanName,
                attachmentMimeType = mimeType,
                attachmentSizeBytes = sizeBytes,
            )
        }
        chatMessages = withContext(Dispatchers.IO) { repository.chat(id) }
        status = "Attachment sent."
    }

    fun importContacts(uri: Uri) = launchWork {
        val context = getApplication<Application>()
        val resolver = context.contentResolver
        val displayName = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }?.trim().orEmpty().ifBlank { "contacts.csv" }
        val extension = displayName.substringAfterLast('.', "csv").lowercase()
        if (extension !in setOf("csv", "tsv", "xls", "xlsx")) {
            throw IllegalArgumentException("Choose a CSV, TSV, XLS, or XLSX contact file.")
        }

        val temporary = File.createTempFile("aicloser-import-", ".$extension", context.cacheDir)
        try {
            val result = withContext(Dispatchers.IO) {
                resolver.openInputStream(uri)?.use { input ->
                    temporary.outputStream().use { output -> input.copyTo(output) }
                } ?: throw IllegalArgumentException("The selected file could not be opened.")
                repository.importContacts(temporary)
            }
            val imported = result.optInt("imported")
            val duplicate = result.optInt("duplicate")
            val skipped = result.optInt("skipped")
            refreshAllInternal()
            status = if (imported > 0) {
                "Imported $imported contact${if (imported == 1) "" else "s"}." +
                    if (duplicate + skipped > 0) " $duplicate duplicate(s), $skipped skipped." else ""
            } else {
                "No new contacts imported. $duplicate duplicate(s), $skipped skipped."
            }
        } finally {
            temporary.delete()
        }
    }

    fun updateConversationStage(conversationId: String, leadStatusId: String) = launchWork {
        withContext(Dispatchers.IO) { repository.updateConversationStage(conversationId, leadStatusId) }
        loadInbox()
        status = "Chat label updated."
    }

    fun saveConversationNotes(conversationId: String, notes: String, done: () -> Unit = {}) = launchWork {
        withContext(Dispatchers.IO) { repository.saveConversationNotes(conversationId, notes) }
        loadInbox()
        status = "Internal note saved."
        done()
    }

    fun updateLeadStage(leadId: String, stage: String) = launchWork {
        try {
            withContext(Dispatchers.IO) { repository.updateLeadStage(leadId, stage) }
            status = "Chat labelled ${stage.replace('_', ' ').lowercase()}."
        } catch (_: SavedOfflineException) {
            status = "Stage saved offline. Will sync when reconnected."
        }
        val refreshed = withContext(Dispatchers.IO) { repository.bootstrap() }
        bootstrap = refreshed
        featurePermissions = refreshed.permissions
        inbox = withContext(Dispatchers.IO) { repository.inbox() }
        CallManager.cacheLeads(getApplication(), refreshed.leads)
    }

    fun addContact(
        name: String,
        phone: String,
        email: String,
        source: String = "Direct / WhatsApp",
        serviceInterest: String = "Sales Inquiry",
        priority: String = "HIGH",
        notes: String = "",
        stage: String = "NEW",
        done: () -> Unit
    ) = launchWork {
        val trimmedName = name.trim()
        val trimmedPhone = phone.trim()
        if (trimmedName.length < 2) throw IllegalArgumentException("Enter customer full name.")
        if (trimmedPhone.length < 5) throw IllegalArgumentException("Enter a valid phone number.")

        val newLead = SalesLead(
            id = "lead_local_" + UUID.randomUUID().toString().take(8),
            customerName = trimmedName,
            customerPhone = trimmedPhone,
            customerEmail = email.trim(),
            stage = stage.ifBlank { "NEW" }.uppercase(),
            source = source.ifBlank { "Direct / Manual" },
            serviceInterest = serviceInterest.ifBlank { "Sales Inquiry" },
            notes = notes.trim(),
            followUpAt = null,
            priority = priority.ifBlank { "NORMAL" }
        )

        // Optimistically update bootstrap state and lead list
        val currentBootstrap = bootstrap
        if (currentBootstrap != null) {
            val updatedLeads = listOf(newLead) + currentBootstrap.leads
            val updatedDashboard = currentBootstrap.dashboard.copy(
                totalLeads = currentBootstrap.dashboard.totalLeads + 1,
                activeLeads = currentBootstrap.dashboard.activeLeads + 1
            )
            bootstrap = currentBootstrap.copy(
                leads = updatedLeads,
                dashboard = updatedDashboard
            )
            CallManager.cacheLeads(getApplication(), updatedLeads)
        }

        val contactObj = JSONObject()
            .put("name", trimmedName)
            .put("phone", trimmedPhone)
            .put("email", email.trim())
            .put("notes", notes.trim())
            .put("tags", org.json.JSONArray(listOf("hot", "mobile")))
            .put("source", "MOBILE_MANUAL")
            .put("stage", stage.ifBlank { "NEW" }.uppercase())
        val dedicatedPayload = JSONObject().put("contact", contactObj)

        // The app API is the tenant-aware source of truth. Do not leave the
        // optimistic local id in the lead list after a successful create: the
        // next call must use the server assignment id belonging to this agent.
        withContext(Dispatchers.IO) {
            try {
                repository.api.post("/sales/mobile/contacts", dedicatedPayload)
            } catch (mainError: Exception) {
                if (BuildConfig.AICLOSER_DEDICATED_API_BASE.isBlank()) throw mainError
                repository.api.requestAt(
                    BuildConfig.AICLOSER_DEDICATED_API_BASE,
                    "/api/v1/mobile/contacts",
                    "POST",
                    dedicatedPayload,
                )
            }
        }
        val refreshed = withContext(Dispatchers.IO) { repository.bootstrap() }
        bootstrap = refreshed
        featurePermissions = refreshed.permissions
        CallManager.cacheLeads(getApplication(), refreshed.leads)

        status = "Contact \"$trimmedName\" added to CRM."
        done()
    }

    fun hasFeature(featureId: String): Boolean = featurePermissions[featureId] != false

    fun updateProfile(displayName: String, email: String, done: () -> Unit) = launchWork {
        if (displayName.trim().length < 2) throw IllegalArgumentException("Enter your full name.")
        session = withContext(Dispatchers.IO) { repository.updateProfile(displayName.trim(), email.trim()) }
        refreshAll()
        status = "Profile updated."
        done()
    }

    fun saveLessonProgress(courseId: String, lessonId: String, watchedSeconds: Int, durationSeconds: Int, positionSeconds: Int, confirmComplete: Boolean, done: (() -> Unit)? = null) {
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { repository.saveLessonProgress(courseId, lessonId, watchedSeconds, durationSeconds, positionSeconds, confirmComplete) }
                if (confirmComplete) courses = withContext(Dispatchers.IO) { repository.courses() }
                done?.invoke()
            } catch (e: Exception) {
                if (e is SessionRevokedException) {
                    handleSessionRevoked()
                } else {
                    error = e.message ?: "Training progress could not be saved."
                }
            }
        }
    }

    fun logout(done: () -> Unit = {}) {
        stopHeartbeat()
        stopRealtime()
        repository.logout()
        authenticated = false
        setupComplete = false
        session = null
        bootstrap = null
        customer360 = null
        sessionConflict = null
        error = null
        done()
    }

    private fun deviceId() = Settings.Secure.getString(getApplication<Application>().contentResolver, Settings.Secure.ANDROID_ID) ?: "${Build.MANUFACTURER}-${Build.MODEL}"

    private val notifiedCallbackKeys = Collections.synchronizedSet(mutableSetOf<String>())

    private fun checkDueCallbacks(leads: List<SalesLead>) {
        val now = java.time.Instant.now()
        for (lead in leads) {
            val followUpAtText = lead.followUpAt?.trim().orEmpty()
            if (followUpAtText.isBlank()) continue
            val callbackAt = runCatching { java.time.Instant.parse(followUpAtText) }.getOrNull() ?: continue
            val secondsUntil = java.time.Duration.between(now, callbackAt).seconds
            if (secondsUntil in (-10 * 60)..(5 * 60)) {
                val key = "${lead.id}|$followUpAtText"
                if (notifiedCallbackKeys.add(key)) {
                    LeadCallNotification.showCallback(
                        context = getApplication(),
                        leadId = lead.id,
                        leadName = lead.customerName,
                        phone = lead.customerPhone,
                        callbackAt = followUpAtText,
                    )
                    activeInAppAlert = InAppAlert(
                        type = InAppAlert.AlertType.CALLBACK,
                        title = "📞 Callback Due: ${lead.customerName}",
                        message = "Scheduled follow-up • ${lead.customerPhone}",
                        leadId = lead.id,
                        phone = lead.customerPhone,
                        customerName = lead.customerName,
                        actionLabel = "Call Now",
                    )
                }
            }
        }
    }
}
