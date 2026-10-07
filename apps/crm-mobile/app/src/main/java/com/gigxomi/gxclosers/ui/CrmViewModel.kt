package com.gigxomi.gxclosers.ui

import android.app.Application
import android.os.Build
import android.provider.Settings
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gigxomi.gxclosers.BuildConfig
import com.gigxomi.gxclosers.call.CallManager
import com.gigxomi.gxclosers.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CrmViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = CrmRepository(application)
    var authenticated by mutableStateOf(repository.sessionStore.token != null); private set
    var setupComplete by mutableStateOf(repository.sessionStore.setupComplete); private set
    var session by mutableStateOf(repository.sessionStore.session); private set
    var bootstrap by mutableStateOf<Bootstrap?>(null); private set
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
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var status by mutableStateOf<String?>(null); private set

    init { if (authenticated && setupComplete) refreshAll() }

    fun clearMessage() { error = null; status = null }
    private fun launchWork(block: suspend () -> Unit) {
        viewModelScope.launch {
            busy = true; error = null
            try { block() } catch (e: Exception) { error = e.message ?: "Something went wrong." } finally { busy = false }
        }
    }

    fun login(identifier: String, password: String, done: () -> Unit) = launchWork {
        val result = withContext(Dispatchers.IO) { repository.login(identifier.trim(), password, deviceId(), "${Build.MANUFACTURER} ${Build.MODEL}", BuildConfig.VERSION_NAME) }
        session = result; authenticated = true; done()
    }

    fun registerDevice(done: () -> Unit) = launchWork {
        val app = getApplication<Application>()
        val id = deviceId()
        withContext(Dispatchers.IO) { repository.registerDevice(id, "${Build.MANUFACTURER} ${Build.MODEL}", Build.MANUFACTURER, Build.MODEL, Build.VERSION.RELEASE, BuildConfig.VERSION_NAME) }
        setupComplete = true; refreshAll(); done()
    }

    fun refreshAll() = launchWork {
        val data = withContext(Dispatchers.IO) {
            runCatching { repository.syncOffline() }
            runCatching { repository.uploadPendingRecording() }
            repository.bootstrap()
        }
        bootstrap = data
        CallManager.cacheLeads(getApplication(), data.leads)
    }

    fun loadInbox() {
        if (inboxLoading) return
        viewModelScope.launch {
            inboxLoading = true
            inboxMessage = null
            try { inbox = withContext(Dispatchers.IO) { repository.inbox() } }
            catch (_: Exception) { inboxMessage = "Inbox could not be refreshed right now." }
            finally { inboxLoading = false }
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
    fun clearCustomer360() { customer360 = null; customer360Error = null; customer360Unavailable = false; customer360Loading = false }
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
        selectedPack = null; refreshAll(); done()
    }

    fun startCall(lead: SalesLead) = launchWork {
        val callId = withContext(Dispatchers.IO) { repository.startCall(lead, deviceId()) }
        val app = getApplication<Application>()
        CallManager.prepare(app, callId, lead); CallManager.dial(app, lead.customerPhone)
        status = "Tracked call started. Complete the disposition when the call ends."
    }

    fun saveDisposition(callId: String, outcome: String, note: String, followUp: String?, done: () -> Unit) = launchWork {
        if (outcome.isBlank() || note.isBlank()) throw IllegalArgumentException("Outcome and notes are required.")
        try { withContext(Dispatchers.IO) { repository.submitDisposition(callId, outcome, note.trim(), followUp) } }
        catch (_: SavedOfflineException) { status = "Saved offline. GXClosers will sync it when the connection returns." }
        refreshAll(); done()
    }

    fun loadChat(id: String) {
        if (chatLoading) return
        viewModelScope.launch {
            chatLoading = true
            try { chatMessages = withContext(Dispatchers.IO) { repository.chat(id) } }
            catch (e: Exception) { error = e.message ?: "Conversation could not be refreshed." }
            finally { chatLoading = false }
        }
    }
    fun sendChat(id: String, body: String) = launchWork {
        if (body.isNotBlank()) withContext(Dispatchers.IO) { repository.sendChat(id, body.trim()) }
        chatMessages = withContext(Dispatchers.IO) { repository.chat(id) }
    }
    fun updateLeadStage(leadId: String, stage: String) = launchWork {
        withContext(Dispatchers.IO) { repository.updateLeadStage(leadId, stage) }
        val refreshed = withContext(Dispatchers.IO) { repository.bootstrap() }
        bootstrap = refreshed
        inbox = withContext(Dispatchers.IO) { repository.inbox() }
        CallManager.cacheLeads(getApplication(), refreshed.leads)
        status = "Chat labelled ${stage.replace('_', ' ').lowercase()}."
    }
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
            } catch (e: Exception) { error = e.message ?: "Training progress could not be saved." }
        }
    }
    fun logout(done: () -> Unit) { repository.logout(); authenticated = false; setupComplete = false; session = null; bootstrap = null; customer360 = null; done() }
    private fun deviceId() = Settings.Secure.getString(getApplication<Application>().contentResolver, Settings.Secure.ANDROID_ID) ?: "${Build.MANUFACTURER}-${Build.MODEL}"
}
