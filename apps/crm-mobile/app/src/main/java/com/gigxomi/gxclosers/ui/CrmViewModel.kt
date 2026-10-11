package com.gigxomi.gxclosers.ui

import android.app.Application
import android.media.MediaPlayer
import android.os.Build
import android.provider.Settings
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gigxomi.gxclosers.BuildConfig
import com.gigxomi.gxclosers.call.CallManager
import com.gigxomi.gxclosers.call.DeviceCertificationManager
import com.gigxomi.gxclosers.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.Collections
import java.util.UUID

class CrmViewModel(application: Application) : AndroidViewModel(application) {
    val repository = CrmRepository(application)
    var authenticated by mutableStateOf(repository.sessionStore.token != null); private set
    var setupComplete by mutableStateOf(repository.sessionStore.setupComplete); private set
    var session by mutableStateOf(repository.sessionStore.session); private set
    var bootstrap by mutableStateOf<Bootstrap?>(null); private set
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
    var customer360Error by mutableStateOf<String?>(null); private set
    var customer360Unavailable by mutableStateOf(false); private set
    var sessionConflict by mutableStateOf<ClientSlotOccupiedException?>(null); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var status by mutableStateOf<String?>(null); private set
    var syncCounts by mutableStateOf(repository.getSyncCounts()); private set
    var playbackSpeed by mutableFloatStateOf(1.0f); private set
    var playingCallId by mutableStateOf<String?>(null); private set
    var playbackLoadingCallId by mutableStateOf<String?>(null); private set
    var pendingSharedRecording by mutableStateOf(SharedRecordingStore.current(application)); private set
    var certificationStatus by mutableStateOf(repository.sessionStore.certificationStatus); private set
    var certificationFailureReason by mutableStateOf(repository.sessionStore.certificationFailureReason); private set
    var testSessionId by mutableStateOf(repository.sessionStore.lastTestSessionId); private set
    var testSessionBusy by mutableStateOf(false); private set
    var testSessionMessage by mutableStateOf<String?>(null); private set

    private var heartbeatJob: Job? = null
    private var realtimeConnection: AutoCloseable? = null
    private var lastEventId: String? = null
    private val processedEventIds = Collections.synchronizedSet(HashSet<String>())
    private var activeConversationId: String? = null
    private var mediaPlayer: MediaPlayer? = null

    init {
        if (authenticated && setupComplete) {
            refreshAll()
            startRealtime()
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
        heartbeatJob = viewModelScope.launch(Dispatchers.IO) {
            while (isActive) {
                if (authenticated) {
                    try {
                        repository.heartbeat(deviceId())
                    } catch (_: SessionRevokedException) {
                        withContext(Dispatchers.Main) { handleSessionRevoked() }
                        break
                    } catch (_: Exception) {
                        // Network error during heartbeat, will retry next tick
                    }
                }
                delay(60_000L)
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private fun handleSessionRevoked() {
        repository.sessionStore.clear()
        authenticated = false
        session = null
        bootstrap = null
        stopRealtime()
        stopHeartbeat()
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
        val payload = data.optJSONObject("payload") ?: data
        when (eventType) {
            "lead.updated" -> {
                val leadId = payload.optString("leadId", payload.optString("id"))
                val conversationId = payload.optString("conversationId")
                if (leadId.isNotBlank() || conversationId.isNotBlank()) refreshAll()
            }
            "conversation-updated" -> refreshAll()
            "message.created" -> {
                val convId = payload.optString("conversationId", payload.optString("id"))
                if (convId.isNotBlank() && convId == activeConversationId) {
                    loadChat(convId)
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
            "device.online", "device.offline" -> {
                // Refresh device status
            }
        }
    }

    fun updateSyncCounts() {
        syncCounts = repository.getSyncCounts()
    }

    fun login(identifier: String, password: String, forceReplace: Boolean = false, done: () -> Unit) = launchWork {
        sessionConflict = null
        val result = withContext(Dispatchers.IO) { repository.login(identifier.trim(), password, forceReplace = forceReplace) }
        session = result
        authenticated = true
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
        DeviceCertificationManager.updateStatus(
            getApplication(),
            repository,
            DeviceCertificationManager.STATUS_UNVERIFIED,
            null,
            testSessionId
        )
        certificationStatus = DeviceCertificationManager.STATUS_UNVERIFIED
        certificationFailureReason = null
        done()
    }

        fun registerDevice(force: Boolean = false, done: () -> Unit = {}) = launchWork {
        val id = deviceId()
        withContext(Dispatchers.IO) {
            repository.registerDevice(
                id,
                "${Build.MANUFACTURER} ${Build.MODEL}",
                Build.MANUFACTURER,
                Build.MODEL,
                Build.VERSION.RELEASE,
                BuildConfig.VERSION_NAME,
                force = force
            )
        }
        setupComplete = true
        refreshAll()
        startRealtime()
        done()
    }

    fun refreshAll() = launchWork {
        val data = withContext(Dispatchers.IO) {
            runCatching { repository.syncOffline() }
            runCatching { repository.uploadPendingRecording() }
            repository.bootstrap()
        }
        bootstrap = data
        featurePermissions = data.permissions
        CallManager.cacheLeads(getApplication(), data.leads)
        updateSyncCounts()
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
        pendingSharedRecording = SharedRecordingStore.current(getApplication())
        status = if (pendingSharedRecording != null) {
            "Recording imported. Select the completed call to attach it."
        } else {
            "Shared recording could not be imported."
        }
    }

    fun discardSharedRecording() {
        SharedRecordingStore.clear(getApplication())
        pendingSharedRecording = null
        status = "Imported recording discarded."
    }

    fun attachSharedRecording(call: MobileCall) = launchWork {
        val pending = pendingSharedRecording ?: throw IllegalStateException("No shared recording is waiting.")
        if (call.id.isBlank()) throw IllegalArgumentException("This call cannot accept a recording yet.")
        if (!call.status.equals("COMPLETED", ignoreCase = true)) {
            throw IllegalArgumentException("Only a completed call can receive a recording.")
        }
        OfflineEventStore(getApplication()).enqueueRecording(
            QueuedRecording(
                clientUploadId = "shared-${UUID.randomUUID()}",
                callId = call.id,
                tenantId = null,
                deviceId = deviceId(),
                filePath = pending.path,
                sizeBytes = pending.sizeBytes,
                durationMs = pending.durationMs.takeIf { it > 0L } ?: call.durationSeconds * 1000L,
                status = "LOCAL_PENDING",
            )
        )
        SharedRecordingStore.clear(getApplication())
        pendingSharedRecording = null
        RecordingUploadWorker.enqueue(getApplication())
        updateSyncCounts()
        status = "Recording queued for ${call.assignment?.customerName ?: call.phoneNumber}."
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
        if (playingCallId == callId) {
            mediaPlayer?.pause()
            playingCallId = null
            return
        }
        mediaPlayer?.release()
        mediaPlayer = null
        playingCallId = null
        playbackLoadingCallId = callId
        viewModelScope.launch {
            try {
                val file = withContext(Dispatchers.IO) {
                    val cached = java.io.File(getApplication<Application>().cacheDir, "recording-$callId.m4a")
                    repository.api.downloadRecording(callId, cached)
                    cached
                }
                val player = MediaPlayer().apply {
                    setDataSource(file.absolutePath)
                    setOnPreparedListener { prepared ->
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            prepared.playbackParams = prepared.playbackParams.setSpeed(playbackSpeed)
                        }
                        playbackLoadingCallId = null
                        playingCallId = callId
                        prepared.start()
                    }
                    setOnCompletionListener {
                        playingCallId = null
                        playbackLoadingCallId = null
                        it.release()
                        if (mediaPlayer === it) mediaPlayer = null
                    }
                    setOnErrorListener { failed, _, _ ->
                        playbackLoadingCallId = null
                        playingCallId = null
                        failed.release()
                        if (mediaPlayer === failed) mediaPlayer = null
                        true
                    }
                }
                mediaPlayer = player
                player.prepareAsync()
            } catch (e: Exception) {
                playbackLoadingCallId = null
                error = e.message ?: "Recording could not be played."
            }
        }
    }

    override fun onCleared() {
        mediaPlayer?.release()
        mediaPlayer = null
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
        refreshAll()
        done()
    }

    fun startCall(lead: SalesLead, sim: com.gigxomi.gxclosers.call.SimOption? = null) = launchWork {
        val callId = withContext(Dispatchers.IO) {
            repository.startCall(
                lead = lead,
                deviceId = deviceId(),
                simSubscriptionId = sim?.subscriptionId,
                simSlotIndex = sim?.slotIndex,
                simLabel = sim?.label,
            )
        }
        val app = getApplication<Application>()
        CallManager.prepare(app, callId, lead, sim)
        CallManager.dial(app, lead.customerPhone, sim)
        status = "Tracked call started. Complete the disposition when the call ends."
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
            stage = "NEW",
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

    fun logout(done: () -> Unit) {
        stopHeartbeat()
        stopRealtime()
        repository.logout()
        authenticated = false
        setupComplete = false
        session = null
        bootstrap = null
        customer360 = null
        done()
    }

    private fun deviceId() = Settings.Secure.getString(getApplication<Application>().contentResolver, Settings.Secure.ANDROID_ID) ?: "${Build.MANUFACTURER}-${Build.MODEL}"
}
