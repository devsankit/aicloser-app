package com.gigxomi.gxclosers.ui

import android.app.Application
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

    private var heartbeatJob: Job? = null
    private var realtimeConnection: AutoCloseable? = null
    private var lastEventId: String? = null
    private val processedEventIds = Collections.synchronizedSet(HashSet<String>())
    private var activeConversationId: String? = null

    init {
        if (authenticated && setupComplete) {
            refreshAll()
            startRealtime()
        }
    }

    // Keep a session conflict visible after the transient snackbar is dismissed.
    // The conflict card owns its lifecycle and is cleared when a new login starts.
    fun clearMessage() { error = null; status = null }

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
                        repository.heartbeat()
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
                if (leadId.isNotBlank()) refreshAll()
            }
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

    fun registerDevice(done: () -> Unit) = launchWork {
        val id = deviceId()
        withContext(Dispatchers.IO) {
            repository.registerDevice(
                id,
                "${Build.MANUFACTURER} ${Build.MODEL}",
                Build.MANUFACTURER,
                Build.MODEL,
                Build.VERSION.RELEASE,
                BuildConfig.VERSION_NAME
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

    fun setSpeed(speed: Float) {
        playbackSpeed = speed
    }

    fun loadInbox() {
        if (inboxLoading) return
        viewModelScope.launch {
            inboxLoading = true
            inboxMessage = null
            try {
                inbox = withContext(Dispatchers.IO) { repository.inbox() }
            } catch (_: Exception) {
                inboxMessage = "Inbox could not be refreshed right now."
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
                learningMessage = if (e is ApiException && e.status == 404) "The sales learning catalog is being prepared." else "Learning could not be refreshed right now."
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
                if (e is ApiException && e.status == 404) customer360Unavailable = true
                else customer360Error = "Live journey sync is temporarily unavailable."
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

    fun startCall(lead: SalesLead) = launchWork {
        val callId = withContext(Dispatchers.IO) { repository.startCall(lead, deviceId()) }
        val app = getApplication<Application>()
        CallManager.prepare(app, callId, lead)
        CallManager.dial(app, lead.customerPhone)
        status = "Tracked call started. Complete the disposition when the call ends."
    }

    fun saveDisposition(callId: String, outcome: String, note: String, followUp: String?, done: () -> Unit) = launchWork {
        if (outcome.isBlank() || note.isBlank()) throw IllegalArgumentException("Outcome and notes are required.")
        try {
            withContext(Dispatchers.IO) { repository.submitDisposition(callId, outcome, note.trim(), followUp) }
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
                error = e.message ?: "Conversation could not be refreshed."
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

        // Sync to backend via dedicated API https://api.aicloser.in/api/v1/mobile/contacts or fallback
        try {
            val contactObj = JSONObject()
                .put("name", trimmedName)
                .put("phone", trimmedPhone)
                .put("email", email.trim())
                .put("notes", notes.trim())
                .put("tags", org.json.JSONArray(listOf("hot", "mobile")))
                .put("source", "MOBILE_MANUAL")

            val dedicatedPayload = JSONObject().put("contact", contactObj)

            withContext(Dispatchers.IO) {
                // Try dedicated production API first
                try {
                    repository.api.requestAt(
                        BuildConfig.AICLOSER_DEDICATED_API_BASE,
                        "/api/v1/mobile/contacts",
                        "POST",
                        dedicatedPayload
                    )
                } catch (_: Exception) {
                    // Fall back to main web app API route
                    repository.api.post("/sales/mobile/contacts", dedicatedPayload)
                }
            }
        } catch (_: Exception) {
            // Silently maintain optimistic local contact
        }

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
                error = e.message ?: "Training progress could not be saved."
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
