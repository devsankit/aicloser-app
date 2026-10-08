package com.gigxomi.gxclosers.data

import org.json.JSONArray
import org.json.JSONObject

data class Session(val userId: String, val displayName: String, val email: String?, val phone: String)

data class SalesLead(
    val id: String,
    val customerName: String,
    val customerPhone: String,
    val customerEmail: String,
    val stage: String,
    val source: String,
    val serviceInterest: String,
    val notes: String,
    val followUpAt: String?,
    val priority: String,
    val lastTouchBy: String = "",
    val lastTouchSummary: String = "",
    val lastTouchedAt: String? = null,
)

data class AvailableLead(
    val id: String,
    val customerName: String,
    val source: String,
    val serviceInterest: String,
    val priority: String,
    val createdAt: String,
)

data class MobileCall(
    val id: String,
    val assignmentId: String,
    val phoneNumber: String,
    val status: String,
    val outcome: String?,
    val note: String?,
    val durationSeconds: Int,
    val recordingStatus: String,
    val recordingError: String?,
    val startedAt: String,
    val endedAt: String?,
    val assignment: SalesLead?,
)

data class Dashboard(val totalLeads: Int, val activeLeads: Int, val closedWon: Int, val availableBalance: Double)
data class Agent(val id: String, val displayName: String, val agentCode: String, val canClaimLeads: Boolean)

data class Bootstrap(
    val agent: Agent?,
    val dashboard: Dashboard,
    val leads: List<SalesLead>,
    val availableLeads: List<AvailableLead>,
    val availableLeadCount: Int,
    val calls: List<MobileCall>,
    val pendingNotes: Int,
    val pendingUploads: Int,
    val deviceCount: Int,
    val permissions: Map<String, Boolean>,
)

data class InboxItem(
    val lead: SalesLead,
    val conversationId: String?,
    val latestMessage: String,
    val latestMessageAt: String?,
    val status: String,
)

data class Lesson(
    val id: String,
    val title: String,
    val description: String,
    val youtubeVideoId: String?,
    val isRequired: Boolean,
    val completionThreshold: Int,
    val progressPercent: Int,
    val watchedSeconds: Int,
    val durationSeconds: Int,
    val lastPositionSeconds: Int,
)

data class Course(val id: String, val title: String, val description: String, val completionPercent: Int, val lessons: List<Lesson>)
data class LeadPack(val id: String, val leadPoolIds: List<String>, val expiresAt: String, val leads: List<AvailableLead>)
data class ChatMessage(
    val id: String,
    val body: String,
    val author: String,
    val createdAt: String,
    val outbound: Boolean,
    val attachmentName: String? = null,
    val attachmentCount: Int = 0,
)

data class CustomerJourneySnapshot(
    val lifecycleStage: String,
    val commercialState: String,
    val engagementState: String,
    val identityStatus: String,
    val lastEventAt: String?,
)

data class CustomerTimelineItem(val id: String, val at: String, val type: String, val title: String, val detail: String?)
data class CustomerTask(val id: String, val title: String, val description: String?, val priority: String, val status: String, val dueAt: String)
data class CustomerWebinar(val id: String, val title: String, val status: String, val scheduledAt: String, val participantType: String)
data class CustomerLearning(val lessonId: String, val progressPercent: Int, val completedAt: String?, val lastHeartbeatAt: String)

data class Customer360(
    val identityStatus: String,
    val appRole: String?,
    val packageName: String?,
    val onboardingStage: String?,
    val snapshots: List<CustomerJourneySnapshot>,
    val tasks: List<CustomerTask>,
    val webinars: List<CustomerWebinar>,
    val learning: List<CustomerLearning>,
    val timeline: List<CustomerTimelineItem>,
    val notificationCount: Int,
    val unreadNotificationCount: Int,
)

internal fun JSONObject.text(name: String): String = optString(name, "").takeUnless { it == "null" } ?: ""
internal fun JSONObject.nullableText(name: String): String? = text(name).ifBlank { null }
internal fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
internal fun JSONArray.strings(): List<String> = (0 until length()).mapNotNull { optString(it).takeIf(String::isNotBlank) }

fun parseSession(json: JSONObject) = Session(
    userId = json.text("userId"),
    displayName = json.text("displayName"),
    email = json.nullableText("email"),
    phone = json.text("phone"),
)

fun parseLead(json: JSONObject) = SalesLead(
    id = json.text("id"),
    customerName = json.text("customerName").ifBlank { "Unnamed lead" },
    customerPhone = json.text("customerPhone"),
    customerEmail = json.text("customerEmail"),
    stage = json.text("stage"),
    source = json.text("source"),
    serviceInterest = json.text("serviceInterest"),
    notes = json.text("notes"),
    followUpAt = json.nullableText("followUpAt"),
    priority = json.text("priority").ifBlank { "NORMAL" },
    lastTouchBy = json.optJSONObject("lastTouch")?.text("by").orEmpty(),
    lastTouchSummary = json.optJSONObject("lastTouch")?.text("summary").orEmpty(),
    lastTouchedAt = json.optJSONObject("lastTouch")?.nullableText("at"),
)

fun parseAvailableLead(json: JSONObject) = AvailableLead(
    id = json.text("id"), customerName = json.text("customerName").ifBlank { "New enquiry" },
    source = json.text("source"), serviceInterest = json.text("serviceInterest"),
    priority = json.text("priority").ifBlank { "NORMAL" }, createdAt = json.text("createdAt"),
)

fun parseBootstrap(json: JSONObject): Bootstrap {
    val dashboard = json.optJSONObject("dashboard") ?: JSONObject()
    val agentJson = json.optJSONObject("agent")
    val permissionsJson = json.optJSONObject("permissions")
    val permissions = permissionsJson?.keys()?.asSequence()?.associateWith { permissionsJson.optBoolean(it, true) }.orEmpty()
    return Bootstrap(
        agent = agentJson?.let { Agent(it.text("id"), it.text("displayName"), it.text("agentCode"), it.optBoolean("canClaimLeads")) },
        dashboard = Dashboard(dashboard.optInt("totalLeads"), dashboard.optInt("activeLeads"), dashboard.optInt("closedWon"), dashboard.optDouble("availableBalance")),
        leads = json.optJSONArray("leads")?.objects()?.map(::parseLead).orEmpty(),
        availableLeads = json.optJSONArray("availableLeads")?.objects()?.map(::parseAvailableLead).orEmpty(),
        availableLeadCount = json.optInt("availableLeadCount"),
        calls = json.optJSONArray("calls")?.objects()?.map { call ->
            MobileCall(
                id = call.text("id"), assignmentId = call.text("assignmentId"), phoneNumber = call.text("phoneNumber"),
                status = call.text("status"), outcome = call.nullableText("outcome"), note = call.nullableText("note"),
                durationSeconds = call.optInt("durationSeconds"), recordingStatus = call.text("recordingStatus"),
                recordingError = call.nullableText("recordingError"), startedAt = call.text("startedAt"), endedAt = call.nullableText("endedAt"),
                assignment = call.optJSONObject("assignment")?.let(::parseLead),
            )
        }.orEmpty(),
        pendingNotes = json.optInt("pendingNotes"), pendingUploads = json.optInt("pendingUploads"),
        deviceCount = json.optJSONArray("devices")?.length() ?: 0,
        permissions = permissions,
    )
}

fun parseInbox(json: JSONObject): List<InboxItem> = json.optJSONArray("conversations")?.objects()?.mapNotNull { item ->
    val leadJson = item.optJSONObject("lead") ?: return@mapNotNull null
    val conversation = item.optJSONObject("conversation")
    val latestMessage = conversation?.optJSONObject("latestMessage")
    InboxItem(
        lead = parseLead(leadJson),
        conversationId = conversation?.text("id")?.ifBlank { null },
        latestMessage = latestMessage?.text("body").orEmpty(),
        latestMessageAt = latestMessage?.nullableText("createdAt") ?: conversation?.nullableText("updatedAt"),
        status = conversation?.text("status").orEmpty(),
    )
}.orEmpty()

private fun youtubeVideoId(value: String?): String? {
    val raw = value?.trim().orEmpty()
    if (raw.isBlank()) return null
    val candidate = when {
        "youtu.be/" in raw -> raw.substringAfter("youtu.be/").substringBefore('?').substringBefore('/')
        "youtube.com/embed/" in raw -> raw.substringAfter("youtube.com/embed/").substringBefore('?').substringBefore('/')
        "youtube.com/watch" in raw -> runCatching { java.net.URI(raw).rawQuery.orEmpty().split('&').firstOrNull { it.startsWith("v=") }?.substringAfter("v=") }.getOrNull()
        else -> raw
    }.orEmpty().filter { it.isLetterOrDigit() || it == '-' || it == '_' }
    return candidate.takeIf(String::isNotBlank)
}

fun parseCourses(json: JSONObject): List<Course> {
    val flatLessons = json.optJSONArray("lessons")?.objects().orEmpty()
    val progressByLesson = json.optJSONArray("progress")?.objects().orEmpty().filter { it.text("lessonId").isNotBlank() }.associateBy { it.text("lessonId") }
    return json.optJSONArray("courses")?.objects().orEmpty().filter { it.optBoolean("isPublished", true) }.map { course ->
        val lessons = (course.optJSONArray("lessons")?.objects() ?: flatLessons.filter { it.text("courseId") == course.text("id") })
            .filter { it.optBoolean("isPublished", true) }
            .map { lesson ->
                val progress = lesson.optJSONObject("progress") ?: progressByLesson[lesson.text("id")]
                Lesson(
                    id = lesson.text("id"),
                    title = lesson.text("title"),
                    description = lesson.text("description"),
                    youtubeVideoId = youtubeVideoId(lesson.nullableText("youtubeVideoId") ?: lesson.nullableText("videoUrl") ?: lesson.nullableText("videoEmbedUrl")),
                    isRequired = lesson.optBoolean("isRequired", true),
                    completionThreshold = lesson.optInt("completionThreshold", 90),
                    progressPercent = progress?.optInt("progressPercent") ?: 0,
                    watchedSeconds = progress?.optInt("watchedSeconds") ?: 0,
                    durationSeconds = progress?.optInt("durationSeconds") ?: 0,
                    lastPositionSeconds = progress?.optInt("lastPositionSeconds") ?: 0,
                )
            }
        val completion = if (lessons.isEmpty()) 0 else lessons.sumOf { it.progressPercent } / lessons.size
        Course(course.text("id"), course.text("title"), course.text("description"), course.optInt("completionPercent", completion), lessons)
    }
}

fun parseLeadPack(json: JSONObject): LeadPack {
    val pack = json.getJSONObject("pack")
    return LeadPack(pack.text("id"), pack.optJSONArray("leadPoolIds")?.strings().orEmpty(), pack.text("expiresAt"), pack.optJSONArray("leads")?.objects()?.map(::parseAvailableLead).orEmpty())
}

fun parseCustomer360(json: JSONObject): Customer360 {
    val customer = json.optJSONObject("customer360") ?: json
    val identity = customer.optJSONObject("identity") ?: JSONObject()
    val app = customer.optJSONObject("app") ?: JSONObject()
    val user = app.optJSONObject("user")
    val onboarding = app.optJSONObject("onboarding")
    val journey = customer.optJSONObject("journey") ?: JSONObject()
    val notificationSummary = customer.optJSONObject("notificationSummary") ?: JSONObject()
    return Customer360(
        identityStatus = identity.text("status").ifBlank { "UNRESOLVED" },
        appRole = user?.nullableText("role"),
        packageName = user?.nullableText("packageName"),
        onboardingStage = onboarding?.nullableText("stage"),
        snapshots = journey.optJSONArray("snapshots")?.objects()?.map { snapshot ->
            CustomerJourneySnapshot(
                lifecycleStage = snapshot.text("lifecycleStage").ifBlank { "UNKNOWN" },
                commercialState = snapshot.text("commercialState").ifBlank { "UNKNOWN" },
                engagementState = snapshot.text("engagementState").ifBlank { "UNKNOWN" },
                identityStatus = snapshot.text("identityStatus").ifBlank { "UNRESOLVED" },
                lastEventAt = snapshot.nullableText("lastEventAt"),
            )
        }.orEmpty(),
        tasks = customer.optJSONArray("tasks")?.objects()?.map { task ->
            CustomerTask(task.text("id"), task.text("title"), task.nullableText("description"), task.text("priority"), task.text("status"), task.text("dueAt"))
        }.orEmpty(),
        webinars = customer.optJSONArray("webinars")?.objects()?.map { webinar ->
            CustomerWebinar(webinar.text("id"), webinar.text("title"), webinar.text("status"), webinar.text("scheduledAt"), webinar.text("participantType"))
        }.orEmpty(),
        learning = customer.optJSONArray("learning")?.objects()?.map { learning ->
            CustomerLearning(learning.text("lessonId"), learning.optInt("progressPercent"), learning.nullableText("completedAt"), learning.text("lastHeartbeatAt"))
        }.orEmpty(),
        timeline = customer.optJSONArray("timeline")?.objects()?.map { item ->
            CustomerTimelineItem(item.text("id"), item.text("at"), item.text("type"), item.text("title"), item.nullableText("detail"))
        }.orEmpty(),
        notificationCount = notificationSummary.optInt("sent"),
        unreadNotificationCount = notificationSummary.optInt("unread"),
    )
}
