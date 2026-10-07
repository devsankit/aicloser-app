package com.gigxomi.gxclosers.data

import android.content.Context
import com.gigxomi.gxclosers.call.CallAudioRecorder
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class CrmRepository(context: Context) {
    val sessionStore = SessionStore(context)
    private val api = ApiClient(sessionStore)
    private val offline = OfflineEventStore(context)
    private val appContext = context.applicationContext

    fun login(identifier: String, password: String, installationId: String, deviceName: String, appVersion: String): Session {
        val response = api.post("/mobile/auth/login", JSONObject().put("identifier", identifier).put("password", password).put("loginScope", "sales")
            .put("clientType", "MOBILE").put("installationId", installationId).put("deviceName", deviceName).put("appVersion", appVersion))
        val session = parseSession(response.getJSONObject("session"))
        sessionStore.saveLogin(response.getString("token"), session)
        return session
    }

    fun bootstrap(): Bootstrap = parseBootstrap(api.get("/sales/mobile/bootstrap"))
    fun inbox(): List<InboxItem> = parseInbox(api.get("/sales/mobile/inbox"))
    fun courses(): List<Course> = parseCourses(api.get("/sales/lms/courses"))

    fun updateLeadStage(leadId: String, stage: String) {
        api.post("/sales/leads", JSONObject()
            .put("action", "stage")
            .put("leadId", leadId)
            .put("stage", stage)
            .put("note", "CRM label updated from the GXClosers conversation"))
    }

    fun updateProfile(displayName: String, email: String): Session {
        val response = api.post("/sales/mobile/profile", JSONObject().put("displayName", displayName).put("email", email))
        val updated = parseSession(response.getJSONObject("user"))
        sessionStore.token?.let { sessionStore.saveLogin(it, updated) }
        return updated
    }

    fun registerDevice(deviceId: String, deviceName: String, manufacturer: String, model: String, androidVersion: String, appVersion: String) {
        api.post("/sales/mobile/register-device", JSONObject()
            .put("deviceId", deviceId).put("deviceName", deviceName).put("manufacturer", manufacturer)
            .put("model", model).put("androidVersion", androidVersion).put("appVersion", appVersion)
            .put("recordingCapability", "MIC_RECORDING").put("recordingEnabled", true))
        sessionStore.setupComplete = true
    }

    fun requestLeadPack(size: Int) = parseLeadPack(api.post("/sales/mobile/lead-packs/request", JSONObject().put("size", size)))
    fun claimLeadPack(packId: String) { api.post("/sales/mobile/lead-packs/$packId/claim") }
    fun customer360(leadId: String): Customer360 = parseCustomer360(api.get("/sales/leads/$leadId/customer-360"))

    fun createFollowUpTask(leadId: String, title: String, dueAt: String, priority: String, description: String) {
        api.post("/sales/leads/$leadId/tasks", JSONObject()
            .put("title", title).put("dueAt", dueAt).put("priority", priority).put("description", description))
    }

    fun updateTaskStatus(leadId: String, taskId: String, status: String) {
        api.post("/sales/leads/$leadId/tasks", JSONObject().put("action", "status").put("taskId", taskId).put("status", status))
    }

    fun startCall(lead: SalesLead, deviceId: String): String {
        val response = api.post("/sales/mobile/call/start", JSONObject()
            .put("leadId", lead.id).put("phoneNumber", lead.customerPhone).put("direction", "OUTBOUND")
            .put("deviceId", deviceId).put("recordingStatus", "NONE"))
        return response.getJSONObject("call").getString("id")
    }

    fun submitDisposition(callId: String, outcome: String, note: String, followUp: String?) {
        val payload = JSONObject().put("callSessionId", callId).put("outcome", outcome).put("note", note)
            .put("stageUpdate", when { outcome == "CLOSED_WON" -> "CLOSED_WON"; outcome == "LOST" -> "LOST"; outcome.startsWith("CONNECTED") -> "CONTACTED"; else -> JSONObject.NULL })
        followUp?.takeIf(String::isNotBlank)?.let { payload.put("nextFollowUpAt", it) }
        try { api.post("/sales/mobile/call/disposition", payload) }
        catch (error: Exception) { offline.enqueue("disposition-$callId", "DISPOSITION", payload); throw SavedOfflineException(error.message ?: "Saved offline") }
    }

    fun syncOffline(): Int {
        val events = offline.pending()
        if (events.isEmpty()) return 0
        val body = JSONObject().put("events", JSONArray().apply { events.forEach { put(JSONObject().put("localEventId", it.id).put("type", it.type).put("payload", JSONObject(it.payload))) } })
        val results = api.post("/sales/mobile/offline-events/sync", body).optJSONArray("results")?.objects().orEmpty()
        results.filter { it.optBoolean("ok") }.forEach { offline.markSynced(it.text("idempotencyKey")) }
        return results.count { it.optBoolean("ok") }
    }

    fun uploadPendingRecording(): Boolean {
        val pending = CallAudioRecorder.pending(appContext) ?: return false
        val file = File(pending.path)
        if (!file.exists()) return false
        api.uploadRecording(pending.callId, pending.clientUploadId, file, pending.durationMs)
        CallAudioRecorder.clearPending(appContext)
        return true
    }

    fun chat(conversationId: String): List<ChatMessage> {
        val payload = api.get("/conversations/$conversationId/messages")
        val array = payload.optJSONArray("messages") ?: payload.optJSONObject("conversation")?.optJSONArray("messages") ?: JSONArray()
        return array.objects().mapNotNull { message ->
            val attachments = message.optJSONArray("attachments")?.objects().orEmpty()
            val body = message.text("body").trim()
            if (body.isBlank() && attachments.isEmpty()) return@mapNotNull null
            val senderRole = message.text("senderRole").lowercase()
            ChatMessage(
                id = message.text("id"),
                body = body,
                author = message.text("senderLabel").ifBlank { message.text("author").ifBlank { message.text("senderName") } },
                createdAt = message.text("createdAt"),
                outbound = senderRole in setOf("sales", "admin", "manager") || message.text("direction").equals("OUTBOUND", true) || message.optBoolean("outbound"),
                attachmentName = attachments.firstOrNull()?.text("name")?.ifBlank { "Attachment" },
                attachmentCount = attachments.size,
            )
        }
    }

    fun sendChat(conversationId: String, body: String) {
        api.post("/conversations/$conversationId/messages", JSONObject().put("body", body).put("message", body))
    }

    fun saveLessonProgress(courseId: String, lessonId: String, watchedSeconds: Int, durationSeconds: Int, positionSeconds: Int, confirmComplete: Boolean) {
        if (!confirmComplete) return
        api.post("/sales/lms/progress", JSONObject().put("courseId", courseId).put("lessonId", lessonId)
            .put("watchedSeconds", watchedSeconds).put("durationSeconds", durationSeconds).put("positionSeconds", positionSeconds).put("confirmComplete", confirmComplete))
    }

    fun logout() {
        runCatching { api.post("/auth/logout") }
        sessionStore.clear()
        offline.clear()
    }
}

class SavedOfflineException(message: String) : Exception(message)
