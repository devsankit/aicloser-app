package com.gigxomi.gxclosers.call

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.accessibility.AccessibilityManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telecom.TelecomManager
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import com.gigxomi.gxclosers.data.CrmRepository
import com.gigxomi.gxclosers.data.OfflineEventStore
import com.gigxomi.gxclosers.data.RecordingUploadWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Coordinates the user-enabled Accessibility bridge used to receive a
 * recording from the OEM Phone app's Share sheet.
 *
 * This never reads a private dialer directory and never records the call
 * itself. It only automates the same visible actions a user can perform:
 * open Phone, open the latest call, press Share, and choose AI Closer.
 */
object DialerShareAutomation {
    private const val TAG = "GXDailerShare"
    private const val PREFS = "gxclosers_dialer_share"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_STATE = "state"
    private const val KEY_CALL_ID = "callId"
    private const val KEY_PHONE = "phone"
    private const val KEY_ARMED_AT = "armedAt"
    private const val KEY_LAST_REFRESH_AT = "lastRefreshAt"
    // Google Phone can take a little while to finish indexing a private
    // recording before the call card exposes its Share action.
    private const val TIMEOUT_MS = 180_000L
    private const val DIALER_SETTLE_DELAY_MS = 2_000L

    private const val STATE_IDLE = "IDLE"
    private const val STATE_OPENING = "OPENING"
    private const val STATE_FIND_SHARE = "FIND_SHARE"
    private const val STATE_REFRESH_RECORDING = "REFRESH_RECORDING"
    private const val STATE_PICK_TARGET = "PICK_TARGET"
    private const val STATE_WAIT_IMPORT = "WAIT_IMPORT"

    private val shareLabels = listOf("share audio file", "share recording", "share", "export")
    private val homeLabels = listOf("home", "recents", "recent", "history", "call history", "calls")
    private val targetLabels = listOf("ai closer", "aicloser", "gxclosers")

    fun isEnabled(context: Context): Boolean = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getBoolean(KEY_ENABLED, true)

    fun setEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .apply()
        if (!enabled) clear(context)
    }

    fun isAccessibilityEnabled(context: Context): Boolean {
        val expected = ComponentName(context, DialerShareAccessibilityService::class.java).flattenToString()
        val manager = context.getSystemService(AccessibilityManager::class.java)
        val serviceList = runCatching {
            manager?.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        }.getOrNull()
        if (serviceList != null) {
            return serviceList.any { info ->
                if (info.id.equals(expected, ignoreCase = true)) return@any true
                val service = info.resolveInfo?.serviceInfo ?: return@any false
                ComponentName(service.packageName, service.name).flattenToString()
                    .equals(expected, ignoreCase = true)
            }
        }

        // Some OEM builds briefly return an empty AccessibilityManager list
        // while the service is binding. Keep the secure-setting check only as
        // a short compatibility fallback; the runtime service list above is
        // the authoritative signal once Android has finished binding.
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ).orEmpty()
        return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
    }

    fun arm(context: Context, callId: String, phone: String?): Boolean {
        if (callId.isBlank() || !isEnabled(context) || !isAccessibilityEnabled(context)) {
            Log.i(TAG, "Share automation unavailable: enabled=${isEnabled(context)} accessibility=${isAccessibilityEnabled(context)}")
            return false
        }
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_STATE, STATE_OPENING)
            .putString(KEY_CALL_ID, callId)
            .putString(KEY_PHONE, phone.orEmpty())
            .putLong(KEY_ARMED_AT, System.currentTimeMillis())
            .putLong(KEY_LAST_REFRESH_AT, 0L)
            .apply()
        Handler(Looper.getMainLooper()).postDelayed({
            if (isArmed(context)) openDefaultDialer(context)
        }, DIALER_SETTLE_DELAY_MS)
        Handler(Looper.getMainLooper()).postDelayed({
            if (reconcileTimedOutCall(context)) {
                Log.w(TAG, "Share automation timed out; marked the call recording unavailable")
                clear(context)
            }
        }, TIMEOUT_MS)
        return true
    }

    /**
     * The Phone app may never expose a completed recording (for example when
     * its private recording service is disabled or still stuck at 0:00). Do
     * not leave the CRM row in Processing forever, and never fall back to an
     * older recording. Only OPENING/FIND_SHARE can time out here; once the
     * chooser or import flow has started, its upload owns the call state.
     */
    private fun reconcileTimedOutCall(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val state = prefs.getString(KEY_STATE, STATE_IDLE)
        if (state != STATE_OPENING && state != STATE_FIND_SHARE && state != STATE_REFRESH_RECORDING) return false

        val callId = prefs.getString(KEY_CALL_ID, null)?.takeIf(String::isNotBlank) ?: return false
        val recording = OfflineEventStore(context).recordingForCall(callId)
        when (recording?.status) {
            "UPLOADED" -> {
                // A successful local upload is authoritative. Never let the
                // delayed dialer-share timeout downgrade the same call back to
                // RECORDING_UNAVAILABLE after the dashboard already has audio.
                OfflineEventStore(context).enqueue(
                    id = "recording-restore-$callId",
                    type = "CALL_END",
                    payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", "COMPLETED")
                        .put("recordingStatus", "UPLOADED"),
                    entityId = callId,
                )
                CoroutineScope(Dispatchers.IO).launch {
                    runCatching { CrmRepository(context).syncOffline() }
                }
                clear(context)
                return false
            }
            "LOCAL_PENDING", "UPLOADING", "RECORDING" -> {
                // Give a real local recording/upload time to finish instead of
                // publishing a false permanent failure.
                RecordingUploadWorker.enqueue(context)
                clear(context)
                return false
            }
        }
        val payload = JSONObject()
            .put("callSessionId", callId)
            .put("status", "COMPLETED")
            .put("recordingStatus", "RECORDING_UNAVAILABLE")
            .put("recordingError", "Phone app did not expose a completed recording within 180 seconds.")
        OfflineEventStore(context).enqueue(
            id = "call-recording-timeout-$callId",
            type = "CALL_END",
            payload = payload,
            entityId = callId,
        )
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { CrmRepository(context).syncOffline() }
        }
        return true
    }

    fun repairUploadedRecordingStatuses(context: Context) {
        val store = OfflineEventStore(context)
        val uploaded = store.allRecordings().filter { it.status == "UPLOADED" }
        if (uploaded.isEmpty()) return
        uploaded.forEach { recording ->
            store.enqueue(
                id = "recording-restore-${recording.callId}",
                type = "CALL_END",
                payload = JSONObject()
                    .put("callSessionId", recording.callId)
                    .put("status", "COMPLETED")
                    .put("recordingStatus", "UPLOADED"),
                entityId = recording.callId,
            )
        }
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { CrmRepository(context).syncOffline() }
        }
    }

    fun isArmed(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val state = prefs.getString(KEY_STATE, STATE_IDLE)
        val armedAt = prefs.getLong(KEY_ARMED_AT, 0L)
        return state != STATE_IDLE && armedAt > 0L && System.currentTimeMillis() - armedAt <= TIMEOUT_MS
    }

    fun consumeCallId(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val callId = prefs.getString(KEY_CALL_ID, null)
        clear(context)
        return callId?.takeIf(String::isNotBlank)
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_STATE, STATE_IDLE)
            .remove(KEY_CALL_ID)
            .remove(KEY_PHONE)
            .remove(KEY_ARMED_AT)
            .remove(KEY_LAST_REFRESH_AT)
            .apply()
    }

    fun onAccessibilityWindow(service: AccessibilityService, root: AccessibilityNodeInfo?, packageName: String?) {
        if (root == null || !isArmed(service) || !isEnabled(service)) return
        val prefs = service.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val state = prefs.getString(KEY_STATE, STATE_IDLE) ?: STATE_IDLE
        val packageText = (packageName ?: root.packageName?.toString()).orEmpty().lowercase()
        val defaultDialer = defaultDialerPackage(service).orEmpty()
        val isDialer = packageText == defaultDialer.lowercase() ||
            packageText.contains("dialer") ||
            packageText.contains("phone") ||
            packageText == "com.android.contacts" ||
            packageText == "com.miui.contacts"
        val isShareSheet = packageText.contains("resolver") || packageText.contains("sharesheet") || packageText.contains("chooser")

        try {
            when {
                state == STATE_OPENING && isDialer -> {
                    if (clickRecordedCall(root)) {
                        prefs.edit().putString(KEY_STATE, STATE_FIND_SHARE).apply()
                        return
                    }
                    // Some Phone versions open the dialpad first. Return to
                    // the visible call history before looking for the card.
                    clickByLabels(root, homeLabels)
                }
                state == STATE_REFRESH_RECORDING && isDialer -> {
                    // Re-open the same newest card after the controlled
                    // collapse below. Some Phone builds do not rebind the
                    // expanded audio view until it is opened again.
                    if (clickRecordedCall(root)) {
                        prefs.edit().putString(KEY_STATE, STATE_FIND_SHARE).apply()
                    }
                }
                state == STATE_FIND_SHARE && isDialer -> {
                    // Google Phone may briefly expose the previous recording's
                    // Share URI while the newest call is still being indexed.
                    // Wait until the expanded card reports a real duration.
                    // Stay bound to the newest call card that was opened in
                    // STATE_OPENING. Do not fall through to an older card
                    // merely because that older card already has a recording.
                    // Otherwise a newly finished call can receive the
                    // previous call's audio while its own recording is still
                    // being indexed by Google Phone.
                    val latestCard = latestCallCard(root)
                    if (latestCard != null && recordingReady(latestCard) &&
                        (clickByResourceId(latestCard, "playback_share") || clickByLabels(latestCard, shareLabels))) {
                        prefs.edit().putString(KEY_STATE, STATE_PICK_TARGET).apply()
                    } else if (latestCard != null) {
                        maybeRefreshRecording(service, prefs, root)
                    }
                    // Do not click the card again while indexing. Google Phone
                    // toggles expanded/collapsed on each click, so retrying on
                    // every accessibility event creates a visible on/off loop
                    // and can expose an older card's Share action. The card is
                    // opened once in STATE_OPENING; here we only observe it
                    // until a non-zero duration and Share action are present.
                }
                state == STATE_PICK_TARGET && (isShareSheet || !isDialer) -> {
                    if (clickByLabels(root, targetLabels)) {
                        Log.i(TAG, "Selected AI Closer in the dialer share sheet")
                        prefs.edit().putString(KEY_STATE, STATE_WAIT_IMPORT).apply()
                        // Keep the armed call ID until MainActivity receives
                        // ACTION_SEND and SharedRecordingStore consumes it.
                        // Clearing here races the resolver callback and turns
                        // an automatic share into an unprepared upload.
                    } else {
                        // Resolver apps may lazy-load targets below the first
                        // row. Scroll the user-visible chooser until AI Closer
                        // is present, then the next accessibility event will
                        // select it.
                        scrollForward(root)
                    }
                }
            }
        } catch (error: Throwable) {
            Log.w(TAG, "Accessibility share step failed", error)
        }
    }

    private fun maybeRefreshRecording(
        context: Context,
        prefs: android.content.SharedPreferences,
        root: AccessibilityNodeInfo,
    ) {
        val now = System.currentTimeMillis()
        val lastRefreshAt = prefs.getLong(KEY_LAST_REFRESH_AT, 0L)
        if (now - lastRefreshAt < 8_000L) return
        if (nearestClickable(latestCallCard(root))?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) {
            prefs.edit()
                .putString(KEY_STATE, STATE_REFRESH_RECORDING)
                .putLong(KEY_LAST_REFRESH_AT, now)
                .apply()
            Log.i(TAG, "Refreshing newest Phone call recording card")
        }
    }

    private fun openDefaultDialer(context: Context) {
        val packageName = defaultDialerPackage(context)
        // A package-only MAIN intent can leave Phone on its current Settings
        // or dialpad activity. Resolve the actual launcher activity and reset
        // that task so the accessibility bridge always sees call history.
        val launch = packageName?.let {
            context.packageManager.getLaunchIntentForPackage(it)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
        } ?: Intent(Intent.ACTION_DIAL).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(launch) }
            .onFailure { Log.w(TAG, "Could not open the default dialer", it) }
    }

    private fun defaultDialerPackage(context: Context): String? {
        val telecom = context.getSystemService(TelecomManager::class.java)
        return runCatching { telecom?.defaultDialerPackage }.getOrNull()
            ?: listOf("com.miui.dialer", "com.android.dialer", "com.google.android.dialer", "com.samsung.android.dialer")
                .firstOrNull { context.packageManager.getLaunchIntentForPackage(it) != null }
    }

    private fun clickRecordedCall(root: AccessibilityNodeInfo): Boolean {
        // Google Phone presents call-log cards newest-first. Open the newest
        // call even when its recording is not visible yet; FIND_SHARE will
        // wait on this same card instead of selecting an older recording.
        val node = latestCallCard(root) ?: return false
        val clicked = nearestClickable(node)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
        if (clicked) Log.i(TAG, "Opened newest call card in Phone")
        return clicked
    }

    private fun latestCallCard(root: AccessibilityNodeInfo): AccessibilityNodeInfo? =
        allNodes(root).firstOrNull { candidate ->
            val id = candidate.viewIdResourceName.orEmpty()
            id.contains("call_log_entry_card")
        }

    private fun clickByResourceId(root: AccessibilityNodeInfo, suffix: String): Boolean {
        val node = allNodes(root).firstOrNull { candidate ->
            candidate.viewIdResourceName.orEmpty().endsWith(suffix)
        } ?: return false
        return nearestClickable(node)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
    }

    private fun clickByLabels(root: AccessibilityNodeInfo, labels: List<String>): Boolean {
        val node = allNodes(root).firstOrNull { candidate ->
            val text = nodeText(candidate).trim().lowercase()
            labels.any { label -> text == label || text.contains(label) }
        } ?: return false
        return nearestClickable(node)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
    }

    private fun recordingReady(root: AccessibilityNodeInfo): Boolean {
        val durationNode = allNodes(root).firstOrNull {
            it.viewIdResourceName.orEmpty().endsWith("playback_duration")
        } ?: return false
        val value = nodeText(durationNode).trim().lowercase()
        return value.isNotBlank() && value != "0:00" && !value.contains("0 seconds")
    }

    private fun nearestClickable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        var current = node
        while (current != null) {
            if (current.isClickable) return current
            current = current.parent
        }
        return null
    }

    private fun nodeText(node: AccessibilityNodeInfo): String = buildString {
        append(node.text ?: "")
        append(' ')
        append(node.contentDescription ?: "")
    }

    private fun scrollForward(root: AccessibilityNodeInfo): Boolean =
        allNodes(root)
            .filter { it.isScrollable }
            .firstOrNull()
            ?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) == true

    private fun allNodes(root: AccessibilityNodeInfo): Sequence<AccessibilityNodeInfo> = sequence {
        val pending = ArrayDeque<AccessibilityNodeInfo>()
        pending.add(root)
        var visited = 0
        while (pending.isNotEmpty() && visited < 1500) {
            val current = pending.removeFirst()
            yield(current)
            visited++
            for (index in 0 until current.childCount) {
                runCatching { current.getChild(index) }.getOrNull()?.let(pending::addLast)
            }
        }
    }
}
