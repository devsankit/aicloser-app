package com.gigxomi.gxclosers.call

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telecom.TelecomManager
import android.util.Log
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeInfo
import com.gigxomi.gxclosers.data.DeviceDiagnostics
import com.gigxomi.gxclosers.data.OfflineEventStore
import com.gigxomi.gxclosers.data.SharedRecordingStore
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Collections
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Automates sharing the native dialer's call recording directly into AI Closer
 * via the user-enabled Accessibility Service.
 *
 * Implements strict safety guardrails superior to CallManager:
 * 1. Never blindly selects the first call row. Verifies target phone number,
 *    exact callEndedAt timestamp tokens (+/- 1m), and screen position.
 *    Strict qualification gate: returns null (no match) if candidates are old or unverified.
 * 2. Never bypasses target verification on pre-existing screens; requires positive
 *    targetPhone and timestamp confirmation before accepting any share button.
 * 3. Strictly forbidden from tapping Call, redial, delete, change SIM, video call, etc.
 *    Forbidden action IDs strictly take precedence over any allow-list or text descriptors.
 * 4. Callbacks strictly scoped by callId and session timestamp: previous call timers
 *    can never cancel or affect a newer call's automation.
 * 5. Resilient to process death: resumes WAIT_SETTLE timers and opens dialer on restart.
 * 6. Bounded retries, timeouts, and conflict detection on phone, time, and duration.
 */
object DialerShareAutomation {
    private const val TAG = "GXDialerShare"
    private const val PREFS = "gxclosers_dialer_share"

    private const val KEY_ENABLED = "enabled"
    private const val KEY_STATE = "state"
    private const val KEY_CALL_ID = "callId"
    private const val KEY_PHONE = "phone"
    private const val KEY_CALL_ENDED_AT = "callEndedAt"
    private const val KEY_EXPECTED_DURATION_MS = "expectedDurationMs"
    private const val KEY_ARMED_AT = "armedAt"
    private const val KEY_LAST_STEP_AT = "lastStepAt"
    private const val KEY_RETRY_COUNT = "retryCount"
    private const val KEY_CONTACT_NAME = "contactName"
    private const val KEY_DIRECTION = "direction"
    private const val CALLS_PREFS = "gxclosers_calls"
    private const val KEY_MICROPHONE_FALLBACK_ENABLED = "micFallbackEnabled"

    const val STATE_IDLE = "IDLE"
    const val STATE_WAIT_SETTLE = "WAIT_SETTLE"
    const val STATE_OPENING = "OPENING"
    const val STATE_FIND_TARGET_CALL = "FIND_TARGET_CALL"
    const val STATE_FIND_SHARE = "FIND_SHARE"
    const val STATE_PICK_TARGET = "PICK_TARGET"
    const val STATE_WAIT_IMPORT = "WAIT_IMPORT"

    private const val DIALER_SETTLE_DELAY_MS = 3_500L // Proven delay for dialer to finalize recording
    private const val TIMEOUT_MS = 60_000L // 60s max bounded automation window
    private const val MAX_RETRIES = 5
    private const val MIN_VERIFIED_SCORE = 400

    internal val FORBIDDEN_TOKENS = setOf(
        "call", "redial", "voice call", "video call", "delete", "remove", "clear",
        "sim", "sim 1", "sim 2", "block", "spam", "edit", "keypad", "dialpad", "messages", "message",
        "call back", "dial", "audio call"
    )

    private val SHARE_LABELS = listOf(
        "share audio file", "share recording", "share audio", "share", "export recording"
    )

    private val TARGET_APP_LABELS = listOf(
        "ai closer", "aicloser", "gxclosers", "com.gigxomi.crm"
    )

    private val HOME_TAB_LABELS = listOf(
        "home", "recents", "recent", "history", "call history", "calls"
    )

    private val TRANSIENT_SYSTEM_PACKAGES = setOf(
        "com.android.systemui",
        "com.google.android.apps.nexuslauncher",
        "com.android.launcher3",
    )

    private val processedCallIds = Collections.synchronizedSet(mutableSetOf<String>())
    private var unexpectedScreenCount = 0

    fun isEnabled(context: Context): Boolean = context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getBoolean(KEY_ENABLED, true)

    fun setEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .apply()
        if (!enabled) clear(context)
    }

    fun isGoogleDialer(context: Context): Boolean =
        defaultDialerPackage(context).orEmpty().lowercase(Locale.US).let { packageName ->
            packageName == "com.google.android.dialer" || packageName.contains("google.android.dialer")
        }

    /** Returns the user's mic-fallback choice, gated by the Android microphone permission. */
    fun isMicrophoneFallbackEnabled(context: Context): Boolean {
        val canUseMic = android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M ||
            androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.RECORD_AUDIO
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!canUseMic) return false
        return context.getSharedPreferences(CALLS_PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_MICROPHONE_FALLBACK_ENABLED, true)
    }

    fun setMicrophoneFallbackEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(CALLS_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_MICROPHONE_FALLBACK_ENABLED, enabled)
            .apply()
    }

    fun repairUploadedRecordingStatuses(context: Context) {
        val store = OfflineEventStore(context)
        val uploaded = store.allRecordings().filter { it.status == "UPLOADED" }
        if (uploaded.isEmpty()) return
        uploaded.forEach { recording ->
            val restoreEventId = "recording-restore-${recording.callId}"
            if (store.hasEvent(restoreEventId)) return@forEach
            store.enqueue(
                id = restoreEventId,
                type = "CALL_END",
                payload = JSONObject()
                    .put("callSessionId", recording.callId)
                    .put("status", "COMPLETED")
                    .put("recordingStatus", "UPLOADED"),
                entityId = recording.callId,
            )
        }
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            runCatching { com.gigxomi.gxclosers.data.CrmRepository(context).syncOffline() }
        }
    }

    fun isAccessibilityEnabled(context: Context): Boolean {
        val expected = ComponentName(context, DialerShareAccessibilityService::class.java).flattenToString()
        val manager = context.getSystemService(AccessibilityManager::class.java)
        val serviceList = runCatching {
            manager?.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        }.getOrNull()
        if (serviceList != null) {
            val found = serviceList.any { info ->
                if (info.id.equals(expected, ignoreCase = true)) return@any true
                val service = info.resolveInfo?.serviceInfo ?: return@any false
                ComponentName(service.packageName, service.name).flattenToString().equals(expected, ignoreCase = true)
            }
            if (found) return true
        }

        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ).orEmpty()
        return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
    }

    fun isReady(context: Context): Boolean =
        isEnabled(context) && isAccessibilityEnabled(context)

    fun isArmed(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val state = prefs.getString(KEY_STATE, STATE_IDLE) ?: STATE_IDLE
        val armedAt = prefs.getLong(KEY_ARMED_AT, 0L)
        return state != STATE_IDLE && armedAt > 0L && (System.currentTimeMillis() - armedAt) <= TIMEOUT_MS
    }

    fun getState(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_STATE, STATE_IDLE) ?: STATE_IDLE

    data class ArmedCall(
        val callId: String,
        val phoneNumber: String,
        val callEndedAt: Long,
        val expectedDurationMs: Long = 0L,
        val contactName: String? = null,
        val direction: String? = null,
    )

    fun getArmedCall(context: Context): ArmedCall? {
        if (!isArmed(context)) return null
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val callId = prefs.getString(KEY_CALL_ID, null) ?: return null
        val phone = prefs.getString(KEY_PHONE, "") ?: ""
        val endedAt = prefs.getLong(KEY_CALL_ENDED_AT, 0L)
        val expectedDurationMs = prefs.getLong(KEY_EXPECTED_DURATION_MS, 0L)
        val contactName = prefs.getString(KEY_CONTACT_NAME, null)
        val direction = prefs.getString(KEY_DIRECTION, null)
        return ArmedCall(callId, phone, endedAt, expectedDurationMs, contactName, direction)
    }

    fun arm(
        context: Context,
        callId: String,
        phone: String?,
        callEndedAt: Long,
        expectedDurationMs: Long = 0L,
        contactName: String? = null,
        direction: String? = null,
    ): Boolean {
        if (callId.isBlank() || !isReady(context)) {
            Log.i(TAG, "Share automation not ready: enabled=${isEnabled(context)} a11y=${isAccessibilityEnabled(context)}")
            return false
        }
        if (processedCallIds.contains(callId)) {
            Log.i(TAG, "Call $callId already processed by share automation; skipping duplicate")
            return false
        }
        processedCallIds.add(callId)
        unexpectedScreenCount = 0

        val normalizedPhone = phone.orEmpty().filter(Char::isDigit).takeLast(10)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val armedAt = System.currentTimeMillis()
        val editor = prefs.edit()
            .putString(KEY_STATE, STATE_WAIT_SETTLE)
            .putString(KEY_CALL_ID, callId)
            .putString(KEY_PHONE, normalizedPhone)
            .putLong(KEY_CALL_ENDED_AT, callEndedAt)
            .putLong(KEY_EXPECTED_DURATION_MS, expectedDurationMs)
            .putLong(KEY_ARMED_AT, armedAt)
            .putLong(KEY_LAST_STEP_AT, armedAt)
            .putInt(KEY_RETRY_COUNT, 0)
        if (!contactName.isNullOrBlank()) editor.putString(KEY_CONTACT_NAME, contactName) else editor.remove(KEY_CONTACT_NAME)
        if (!direction.isNullOrBlank()) editor.putString(KEY_DIRECTION, direction) else editor.remove(KEY_DIRECTION)
        editor.apply()

        Log.i(TAG, "Armed dialer share automation for callId=$callId phone=$normalizedPhone contact=$contactName direction=$direction endedAt=$callEndedAt durationMs=$expectedDurationMs")
        scheduleExecution(context, callId, armedAt)
        return true
    }

    internal fun scheduleExecution(context: Context, callId: String, armedAt: Long) {
        val now = System.currentTimeMillis()
        val elapsed = (now - armedAt).coerceAtLeast(0L)
        val remainingSettle = (DIALER_SETTLE_DELAY_MS - elapsed).coerceAtLeast(0L)
        val remainingTimeout = (TIMEOUT_MS - elapsed).coerceAtLeast(1000L)

        // Settle delay timer scoped strictly to callId and armedAt
        Handler(Looper.getMainLooper()).postDelayed({
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val currentCallId = prefs.getString(KEY_CALL_ID, null)
            val currentArmedAt = prefs.getLong(KEY_ARMED_AT, 0L)

            if (currentCallId == callId && currentArmedAt == armedAt && isArmed(context)) {
                val currentState = getState(context)
                if (currentState == STATE_WAIT_SETTLE) {
                    prefs.edit().putString(KEY_STATE, STATE_OPENING).apply()
                    openDefaultDialer(context)
                }
            } else {
                Log.i(TAG, "Ignoring stale settle timer for callId=$callId (active call is $currentCallId)")
            }
        }, remainingSettle)

        // Global safety timeout timer scoped strictly to callId and armedAt
        Handler(Looper.getMainLooper()).postDelayed({
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val currentCallId = prefs.getString(KEY_CALL_ID, null)
            val currentArmedAt = prefs.getLong(KEY_ARMED_AT, 0L)

            if (currentCallId == callId && currentArmedAt == armedAt && isArmed(context)) {
                Log.w(TAG, "Dialer share automation reached 60s timeout for callId=$callId; disarming safely")
                reconcileTimedOutCall(context)
                clear(context)
            } else {
                Log.i(TAG, "Ignoring stale timeout timer for callId=$callId (active call is $currentCallId)")
            }
        }, remainingTimeout)
    }

    /**
     * Resumes pending share automation across process restarts without losing state.
     */
    fun resumeIfNeeded(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val state = prefs.getString(KEY_STATE, STATE_IDLE) ?: STATE_IDLE
        if (state == STATE_IDLE) return
        val callId = prefs.getString(KEY_CALL_ID, null)?.takeIf(String::isNotBlank)
        if (callId == null) {
            clear(context)
            return
        }
        val armedAt = prefs.getLong(KEY_ARMED_AT, 0L)
        val now = System.currentTimeMillis()
        val elapsed = now - armedAt

        if (armedAt <= 0L || elapsed < 0L || elapsed > TIMEOUT_MS) {
            Log.w(TAG, "Resuming expired share automation for callId=$callId (elapsed=${elapsed}ms); clearing")
            reconcileTimedOutCall(context)
            clear(context)
            return
        }

        Log.i(TAG, "Resuming dialer share automation after process restart: callId=$callId state=$state elapsed=${elapsed}ms")

        if (state == STATE_WAIT_SETTLE) {
            if (elapsed >= DIALER_SETTLE_DELAY_MS) {
                Log.i(TAG, "Settle delay already elapsed while process was stopped; advancing to OPENING and launching dialer")
                prefs.edit().putString(KEY_STATE, STATE_OPENING).apply()
                openDefaultDialer(context)
                scheduleExecution(context, callId, armedAt)
            } else {
                scheduleExecution(context, callId, armedAt)
            }
        } else if (state == STATE_OPENING) {
            openDefaultDialer(context)
            scheduleExecution(context, callId, armedAt)
        } else {
            val remainingTimeout = (TIMEOUT_MS - elapsed).coerceAtLeast(1000L)
            Handler(Looper.getMainLooper()).postDelayed({
                val currentCallId = prefs.getString(KEY_CALL_ID, null)
                val currentArmedAt = prefs.getLong(KEY_ARMED_AT, 0L)
                if (currentCallId == callId && currentArmedAt == armedAt && isArmed(context)) {
                    reconcileTimedOutCall(context)
                    clear(context)
                }
            }, remainingTimeout)
        }
    }

    private fun reconcileTimedOutCall(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val callId = prefs.getString(KEY_CALL_ID, null)?.takeIf(String::isNotBlank) ?: return
        val recording = OfflineEventStore(context).recordingForCall(callId)
        if (recording?.status == "UPLOADED" || recording?.status == "LOCAL_PENDING" || recording?.status == "UPLOADING") {
            return
        }
        DeviceDiagnostics.record(
            context,
            kind = "DIALER_SHARE_AUTOMATION_TIMEOUT",
            callId = callId,
            fields = JSONObject()
                .put("stage", "DIALER_SHARE")
                .put("status", "TIMEOUT")
                .put("message", "Recording was not automatically shared within 60s timeout."),
        )
    }

    fun consumeArmedCall(
        context: Context,
        displayName: String,
        durationMs: Long,
        receivedAt: Long,
    ): String? {
        val armed = getArmedCall(context) ?: return null
        val phoneFromFilename = SharedRecordingStore.extractPhoneDigits(displayName)
        val timestampFromFilename = SharedRecordingStore.extractTimestamp(displayName)

        // Conflict detection against armed call
        if (phoneFromFilename != null && armed.phoneNumber.isNotBlank()) {
            if (phoneFromFilename != armed.phoneNumber) {
                Log.w(TAG, "Shared file phone $phoneFromFilename conflicts with armed phone ${armed.phoneNumber}; disarming")
                clear(context)
                return null
            }
        }

        val timestampMatches = timestampFromFilename != null && armed.callEndedAt > 0L &&
            isRecordingTimestampMatch(timestampFromFilename, armed.callEndedAt, armed.expectedDurationMs)
        if (!timestampMatches) {
            Log.w(TAG, "Shared file has no exact timestamp match for armed call; refusing automatic attachment: name=$displayName")
            clear(context)
            return null
        }

        if (armed.expectedDurationMs <= 0L || durationMs <= 0L ||
            !isRecordingDurationMatch(durationMs, armed.expectedDurationMs)
        ) {
            Log.w(TAG, "Shared file duration is missing or conflicts with armed call: actual=${durationMs}ms expected=${armed.expectedDurationMs}ms; refusing automatic attachment")
            clear(context)
            return null
        }

        clear(context)
        Log.i(TAG, "Successfully bound shared recording to armed callId=${armed.callId}")
        return armed.callId
    }

    internal fun isRecordingTimestampMatch(timestampMs: Long, callEndedAt: Long, expectedDurationMs: Long): Boolean {
        if (timestampMs <= 0L || callEndedAt <= 0L) return false
        val callStartedAt = if (expectedDurationMs > 0L) callEndedAt - expectedDurationMs else callEndedAt
        return minOf(kotlin.math.abs(timestampMs - callEndedAt), kotlin.math.abs(timestampMs - callStartedAt)) <= 5_000L
    }

    internal fun isRecordingDurationMatch(actualDurationMs: Long, expectedDurationMs: Long): Boolean {
        if (actualDurationMs <= 0L || expectedDurationMs <= 0L) return false
        val toleranceMs = maxOf(5_000L, (expectedDurationMs * 0.2).toLong())
        return kotlin.math.abs(actualDurationMs - expectedDurationMs) <= toleranceMs
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
            .remove(KEY_CALL_ENDED_AT)
            .remove(KEY_EXPECTED_DURATION_MS)
            .remove(KEY_ARMED_AT)
            .remove(KEY_LAST_STEP_AT)
            .remove(KEY_RETRY_COUNT)
            .remove(KEY_CONTACT_NAME)
            .remove(KEY_DIRECTION)
            .apply()
    }

    fun onAccessibilityWindow(
        service: AccessibilityService,
        root: AccessibilityNodeInfo?,
        packageName: String?,
    ) {
        val context = service.applicationContext
        if (!isArmed(context) || root == null) return

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val state = prefs.getString(KEY_STATE, STATE_IDLE) ?: STATE_IDLE
        val pkg = packageName?.lowercase(Locale.US).orEmpty()

        val isDialer = pkg.contains("dialer") || pkg.contains("phone") || pkg.contains("telecom")
        val isShareSheet = pkg == "android" || pkg.contains("resolver") || pkg.contains("sharesheet") || pkg.contains("intentresolver")

        // Android briefly reports SystemUI/launcher (and occasionally a blank
        // package) while handing foreground control to the dialer. These are
        // transition windows, not a user leaving the verified call workflow.
        // Never interact with them; keep the bounded automation alive so the
        // dialer can become active. Other unexpected apps still abort safely.
        if (!isDialer && !isShareSheet && pkg != "com.gigxomi.crm" && !isTransientSystemPackage(pkg)) {
            unexpectedScreenCount++
            Log.w(TAG, "Unexpected app in foreground during share automation: $pkg (count=$unexpectedScreenCount)")
            if (unexpectedScreenCount >= MAX_RETRIES) {
                Log.w(TAG, "Aborting share automation due to unexpected screen")
                clear(context)
            }
            return
        }
        unexpectedScreenCount = 0

        val targetPhone = prefs.getString(KEY_PHONE, "").orEmpty()
        val armedCallEndedAt = prefs.getLong(KEY_CALL_ENDED_AT, 0L)
        val expectedDurationMs = prefs.getLong(KEY_EXPECTED_DURATION_MS, 0L)
        val targetContactName = prefs.getString(KEY_CONTACT_NAME, null)
        val targetDirection = prefs.getString(KEY_DIRECTION, null)

        try {
            when (state) {
                STATE_WAIT_SETTLE -> {
                    val armedAt = prefs.getLong(KEY_ARMED_AT, 0L)
                    if (System.currentTimeMillis() - armedAt >= DIALER_SETTLE_DELAY_MS) {
                        Log.i(TAG, "Advancing from WAIT_SETTLE to OPENING on accessibility window event")
                        prefs.edit().putString(KEY_STATE, STATE_OPENING).apply()
                        if (isDialer) {
                            clickByLabels(root, HOME_TAB_LABELS)
                            prefs.edit().putString(KEY_STATE, STATE_FIND_TARGET_CALL).apply()
                        } else {
                            // This event can win the race with the settle timer.
                            // Launch here as well; otherwise state becomes OPENING
                            // and the timer's WAIT_SETTLE guard skips the launch.
                            openDefaultDialer(context)
                        }
                    }
                }
                STATE_OPENING -> {
                    if (isDialer) {
                        clickByLabels(root, HOME_TAB_LABELS)
                        prefs.edit().putString(KEY_STATE, STATE_FIND_TARGET_CALL).apply()
                    }
                }
                STATE_FIND_TARGET_CALL -> {
                    if (isDialer) {
                        val callRow = findTargetCallRow(
                            root, targetPhone, armedCallEndedAt, targetContactName, targetDirection, expectedDurationMs
                        )
                        if (callRow != null) {
                            val playbackShare = findPlaybackShareButton(callRow)
                            if (playbackShare != null) {
                                val clicked = safeClickable(playbackShare)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
                                Log.i(TAG, "Tapped playback share inside uniquely matched call row (clicked=$clicked)")
                                if (clicked) prefs.edit().putString(KEY_STATE, STATE_PICK_TARGET).apply()
                            } else if (containsViewId(callRow, "audio_playback_view_container")) {
                                // The row is expanded, but this specific call has no share control.
                                // Do not toggle it or look elsewhere in the contact history.
                                Log.w(TAG, "Matched call row is expanded but has no recording share action; waiting safely")
                            } else {
                                val clicked = callRow.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                                Log.i(TAG, "Expanded uniquely matched call row for phone=$targetPhone (clicked=$clicked)")
                            }
                            return
                        }

                        // Check if current screen is ALREADY the verified details screen for targetPhone and callEndedAt
                        val isVerifiedTargetDetails = isScreenMatchingTargetCall(
                            root, targetPhone, armedCallEndedAt, targetContactName, targetDirection, expectedDurationMs
                        )
                        if (isVerifiedTargetDetails) {
                            // Pixel's call-details page exposes the recording as a
                            // per-call "Listen to recording" integration. Never tap
                            // a generic Share control on the conversation-history page:
                            // it may belong to a different call card for the same number.
                            val listen = findListenToRecording(
                                root, armedCallEndedAt, expectedDurationMs, targetDirection
                            )
                            val clickable = safeClickable(listen)
                            if (clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) {
                                Log.i(TAG, "Opened recording from verified call details; waiting for playback share action")
                                prefs.edit().putString(KEY_STATE, STATE_FIND_SHARE).apply()
                            } else {
                                Log.w(TAG, "Verified call details had no uniquely matched Listen to recording action; refusing generic share")
                            }
                        } else {
                            if (findSafeShareButton(root) != null) {
                                // If dialer is showing an UNVERIFIED or older call's details screen with a share button,
                                // DO NOT tap share! Navigate to Recents/History tab to find the real target call!
                                Log.w(TAG, "Share button visible but screen does NOT match targetPhone=$targetPhone or endedAt=$armedCallEndedAt; navigating to Recents tab")
                                clickByLabels(root, HOME_TAB_LABELS)
                            }
                        }
                    }
                }
                STATE_FIND_SHARE -> {
                    if (isDialer) {
                        // Google Phone's playback screen has a dedicated action ID.
                        // Generic Share buttons on call details can target another call.
                        val shareButton = findPlaybackShareButton(root)
                        if (shareButton != null) {
                            val clickable = safeClickable(shareButton)
                            val clicked = clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
                            Log.i(TAG, "Tapped Share recording button (clicked=$clicked)")
                            if (clicked) {
                                prefs.edit().putString(KEY_STATE, STATE_PICK_TARGET).apply()
                            }
                        }
                    }
                }
                STATE_PICK_TARGET -> {
                    if (isShareSheet || !isDialer) {
                        val targetApp = findTargetAppNode(root)
                        if (targetApp != null) {
                            val clickable = safeClickable(targetApp)
                            val clicked = clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
                            Log.i(TAG, "Selected AI Closer in share sheet (clicked=$clicked)")
                            if (clicked) {
                                prefs.edit().putString(KEY_STATE, STATE_WAIT_IMPORT).apply()
                            }
                        } else {
                            scrollForward(root)
                        }
                    }
                }
                STATE_WAIT_IMPORT -> {
                    // Waiting for importIntent to consume call ID
                }
            }
        } catch (error: Throwable) {
            Log.w(TAG, "Error in accessibility automation step state=$state", error)
        }
    }

    internal fun isSafeAction(text: String?, desc: String?, viewId: String?): Boolean {
        val t = normalizeUiText(text)
        val d = normalizeUiText(desc)
        val rawId = viewId.orEmpty().lowercase(Locale.US).trim()

        // Strip package prefix: e.g. "com.google.android.dialer:id/playback_share" -> "playback_share"
        val idEntry = when {
            rawId.contains(":id/") -> rawId.substringAfter(":id/")
            rawId.contains('/') -> rawId.substringAfterLast('/')
            else -> rawId
        }

        // 1. STRICT FORBIDDEN ACTION IDS - ZERO TOLERANCE, MUST TAKE PRECEDENCE OVER ANY ALLOW-LIST OR TEXT DESCRIPTORS
        val forbiddenIdTokens = listOf(
            "call_button", "btn_call", "make_call", "place_call", "start_call",
            "voice_call", "video_call", "audio_call", "redial",
            "delete", "remove", "clear", "sim_select", "btn_sim", "sim",
            "block", "spam", "dialpad", "keypad"
        )
        if (forbiddenIdTokens.any { idEntry.contains(it) }) {
            return false
        }

        // 2. STRICT FORBIDDEN TEXT PHRASES - MUST TAKE PRECEDENCE OVER ALLOW-LIST
        val forbiddenPhrases = listOf(
            "call back", "voice call", "video call", "audio call", "make call",
            "place call", "start call", "redial", "delete", "remove", "clear",
            "sim 1", "sim 2", "block", "spam", "keypad", "dialpad",
            "message", "send message"
        )
        if (forbiddenPhrases.any { t.contains(it) || d.contains(it) }) {
            return false
        }

        // 3. DIRECT "CALL" OR "DIAL" ACTION VERBS
        fun isCallOrDialAction(s: String): Boolean {
            if (s.isEmpty()) return false
            if (s == "call" || s.startsWith("call ") || s.endsWith(" call") || s == "dial" || s.startsWith("dial ")) {
                val safeInformational = listOf(
                    "call details", "call history", "call log", "call summary",
                    "incoming call", "outgoing call", "answered call", "missed call",
                )
                if (safeInformational.any { s.contains(it) }) return false
                return true
            }
            return false
        }

        if (isCallOrDialAction(t) || isCallOrDialAction(d)) {
            return false
        }

        // 4. EXPLICITLY SAFE ACTIONS (Only reachable if step 1, 2, and 3 passed)
        val isExplicitlySafe = listOf(
            "share audio file", "share recording", "share audio", "share",
            "playback_share", "details", "call details", "call history", "history", "recents",
            "ai closer", "aicloser", "gxclosers"
        ).any { t.contains(it) || d.contains(it) || idEntry.contains(it) }

        if (isExplicitlySafe) {
            return true
        }

        // 5. Default safe if no forbidden action or command detected
        return true
    }

    private fun normalizeUiText(value: String?): String = value.orEmpty()
        .replace('\u00a0', ' ')
        .replace('\u202f', ' ')
        .replace(Regex("\\s+"), " ")
        .lowercase(Locale.US)
        .trim()

    internal fun findListenToRecording(
        root: AccessibilityNodeInfo,
        callEndedAt: Long,
        expectedDurationMs: Long,
        direction: String?,
    ): AccessibilityNodeInfo? {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        val matchingCards = mutableListOf<AccessibilityNodeInfo>()
        val exactTimeTokens = generateExactCallTimeTokens(callEndedAt, expectedDurationMs)
        val expectedDirection = when (direction?.uppercase(Locale.US)) {
            "INBOUND" -> "incoming call"
            "OUTBOUND" -> "outgoing call"
            else -> null
        }
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            val id = node.viewIdResourceName.orEmpty().lowercase(Locale.US)
            if (id.endsWith("conversation_history_call_details_entry_card")) {
                val cardText = normalizeUiText(subtreeText(node))
                val timeMatches = exactTimeTokens.any(cardText::contains)
                val directionMatches = expectedDirection == null || cardText.contains(expectedDirection)
                if (timeMatches && directionMatches) matchingCards.add(node)
            }
            for (i in 0 until node.childCount) node.getChild(i)?.let(queue::add)
        }
        // A minute-only label can match two rapid calls. Refuse to guess.
        if (matchingCards.size != 1) return null
        val cardQueue = ArrayDeque<AccessibilityNodeInfo>()
        cardQueue.add(matchingCards.single())
        while (cardQueue.isNotEmpty()) {
            val node = cardQueue.removeFirst()
            val text = normalizeUiText(node.text?.toString())
            val desc = normalizeUiText(node.contentDescription?.toString())
            val id = node.viewIdResourceName.orEmpty().lowercase(Locale.US)
            if ((text == "listen to recording" || desc == "listen to recording" ||
                    id.endsWith("call_details_integration_secondary_text")) && isSafeActionNode(node)
            ) return node
            for (i in 0 until node.childCount) node.getChild(i)?.let(cardQueue::add)
        }
        return null
    }

    private fun subtreeText(root: AccessibilityNodeInfo): String {
        val values = mutableListOf<String>()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            node.text?.toString()?.takeIf(String::isNotBlank)?.let(values::add)
            node.contentDescription?.toString()?.takeIf(String::isNotBlank)?.let(values::add)
            for (i in 0 until node.childCount) node.getChild(i)?.let(queue::add)
        }
        return values.joinToString(" ")
    }

    private fun generateExactCallTimeTokens(callEndedAt: Long, expectedDurationMs: Long): List<String> {
        if (callEndedAt <= 0L) return emptyList()
        val startAt = if (expectedDurationMs > 0L) (callEndedAt - expectedDurationMs).coerceAtLeast(0L) else callEndedAt
        return listOf(startAt, callEndedAt).flatMap { timestamp ->
            val date = Date(timestamp)
            listOf(
                SimpleDateFormat("h:mm a", Locale.US).format(date),
                SimpleDateFormat("HH:mm", Locale.US).format(date),
            ).map(::normalizeUiText)
        }.distinct()
    }

    private fun matchingGoogleCallCards(
        root: AccessibilityNodeInfo,
        callEndedAt: Long,
        expectedDurationMs: Long,
        direction: String?,
    ): List<AccessibilityNodeInfo> {
        val result = mutableListOf<AccessibilityNodeInfo>()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        val times = generateExactCallTimeTokens(callEndedAt, expectedDurationMs)
        val expectedDirection = when (direction?.uppercase(Locale.US)) {
            "INBOUND" -> "incoming call"
            "OUTBOUND" -> "outgoing call"
            else -> null
        }
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            if (node.viewIdResourceName.orEmpty().lowercase(Locale.US).endsWith("conversation_history_call_details_entry_card")) {
                val cardText = normalizeUiText(subtreeText(node))
                if (times.any(cardText::contains) && (expectedDirection == null || cardText.contains(expectedDirection))) {
                    result.add(node)
                }
            }
            for (i in 0 until node.childCount) node.getChild(i)?.let(queue::add)
        }
        return result
    }

    private fun findNodesByViewId(root: AccessibilityNodeInfo, suffixes: List<String>): List<AccessibilityNodeInfo> {
        val result = mutableListOf<AccessibilityNodeInfo>()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            val id = node.viewIdResourceName.orEmpty().lowercase(Locale.US)
            if (suffixes.any(id::endsWith)) result.add(node)
            for (i in 0 until node.childCount) node.getChild(i)?.let(queue::add)
        }
        return result
    }

    private fun containsViewId(root: AccessibilityNodeInfo, suffix: String): Boolean =
        findNodesByViewId(root, listOf(suffix)).isNotEmpty()

    internal fun isSafeActionNode(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        val text = node.text?.toString()
        val desc = node.contentDescription?.toString()
        val viewId = node.viewIdResourceName
        return isSafeAction(text, desc, viewId)
    }

    /**
     * Walks up the ancestor hierarchy from [node] to the root.
     * Enforces that EVERY node in the ancestor chain passes [isSafeActionNode].
     * If ANY ancestor contains a forbidden token (such as "Call", "Redial", "SIM", "Delete"),
     * returns null immediately, making it impossible to trigger calls or unintended actions.
     * Returns the closest verified clickable ancestor only if the entire chain is safe.
     */
    internal fun safeClickable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        var current: AccessibilityNodeInfo? = node
        var candidateClickable: AccessibilityNodeInfo? = null

        while (current != null) {
            if (!isSafeActionNode(current)) {
                Log.w(TAG, "Unsafe ancestor detected: text='${current.text}' desc='${current.contentDescription}' viewId='${current.viewIdResourceName}'; click aborted")
                return null
            }
            if (candidateClickable == null && current.isClickable) {
                candidateClickable = current
            }
            current = current.parent
        }
        return candidateClickable
    }

    data class TestNode(
        val text: String? = null,
        val contentDescription: String? = null,
        val viewIdResourceName: String? = null,
        val isClickable: Boolean = false,
        val parent: TestNode? = null,
    )

    internal fun safeClickableTestNode(node: TestNode?): TestNode? {
        if (node == null) return null
        var current: TestNode? = node
        var candidateClickable: TestNode? = null

        while (current != null) {
            if (!isSafeAction(current.text, current.contentDescription, current.viewIdResourceName)) {
                return null
            }
            if (candidateClickable == null && current.isClickable) {
                candidateClickable = current
            }
            current = current.parent
        }
        return candidateClickable
    }

    internal fun generateTimeTokens(timestampMs: Long): List<String> {
        if (timestampMs <= 0L) return emptyList()
        val tokens = mutableSetOf<String>()
        val format12 = SimpleDateFormat("h:mm a", Locale.US)
        val format12NoAmPm = SimpleDateFormat("h:mm", Locale.US)
        val format24 = SimpleDateFormat("HH:mm", Locale.US)

        for (offset in listOf(0L, -60_000L, 60_000L)) {
            val date = Date(timestampMs + offset)
            tokens.add(format12.format(date).lowercase(Locale.US))
            tokens.add(format12NoAmPm.format(date).lowercase(Locale.US))
            tokens.add(format24.format(date).lowercase(Locale.US))
        }
        return tokens.toList()
    }

    internal fun normalizeCallTimeText(value: String): String = normalizeUiText(value)

    /**
     * Google Phone can label a recent call by its start time, while automation
     * is armed with its end time. Verify against both ends of the call interval.
     */
    internal fun generateCallTimeTokens(callEndedAt: Long, expectedDurationMs: Long): List<String> {
        val tokens = generateTimeTokens(callEndedAt).toMutableSet()
        if (expectedDurationMs > 0L && callEndedAt > 0L) {
            tokens.addAll(generateTimeTokens((callEndedAt - expectedDurationMs).coerceAtLeast(0L)))
        }
        return tokens.toList()
    }

    /**
     * A Google Phone call-row description can include both the contact number
     * and the SIM's line number. Match each comma-delimited phone field rather
     * than taking the last ten digits of the entire accessibility description.
     */
    internal fun containsTargetPhoneNumber(value: String, targetPhone: String): Boolean {
        val normalizedTarget = targetPhone.filter(Char::isDigit).takeLast(10)
        if (normalizedTarget.isBlank()) return false
        return value.split(',', ';', '\n').any { field ->
            val digits = field.filter(Char::isDigit)
            digits.length in 7..15 && digits.takeLast(10) == normalizedTarget
        }
    }

    internal fun isScreenMatchingTargetCall(
        root: AccessibilityNodeInfo,
        targetPhone: String,
        callEndedAt: Long,
        targetContactName: String? = null,
        targetDirection: String? = null,
        expectedDurationMs: Long = 0L,
    ): Boolean {
        val normalizedTarget = targetPhone.filter(Char::isDigit).takeLast(10)
        val normalizedContact = targetContactName?.trim()?.takeIf(String::isNotBlank)
        if (normalizedTarget.isBlank() && normalizedContact.isNullOrBlank()) return false

        // Google Phone's details page contains multiple call cards for one
        // contact. Never combine the toolbar identity with another card's
        // timestamp/direction when deciding which recording to share.
        // A recents list can contain this contact and a "Just now" row for a
        // different call. Never combine text from the whole list to validate
        // a details page; list rows are handled separately by findTargetCallRow.
        if (!containsViewId(root, "conversation_history_call_details_root")) return false
        val identityMatches = findNodesByViewId(root, listOf("phone_number", "contact_name")).any { node ->
            val value = "${node.text?.toString().orEmpty()} ${node.contentDescription?.toString().orEmpty()}"
            (normalizedTarget.isNotBlank() && containsTargetPhoneNumber(value, normalizedTarget)) ||
                (!normalizedContact.isNullOrBlank() && value.contains(normalizedContact, ignoreCase = true))
        }
        return identityMatches && matchingGoogleCallCards(root, callEndedAt, expectedDurationMs, targetDirection).size == 1
    }

    internal fun findTargetCallRow(
        root: AccessibilityNodeInfo,
        targetPhone: String,
        callEndedAt: Long = 0L,
        targetContactName: String? = null,
        targetDirection: String? = null,
        expectedDurationMs: Long = 0L,
    ): AccessibilityNodeInfo? {
        val normalizedTarget = targetPhone.filter(Char::isDigit).takeLast(10)
        val normalizedContact = targetContactName?.trim()?.takeIf(String::isNotBlank)
        if (callEndedAt <= 0L || (normalizedTarget.isBlank() && normalizedContact.isNullOrBlank())) return null
        val candidates = mutableListOf<AccessibilityNodeInfo>()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        val exactTimeTokens = generateExactCallTimeTokens(callEndedAt, expectedDurationMs)

        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            val rawId = node.viewIdResourceName.orEmpty().lowercase(Locale.US)
            if (rawId.endsWith("call_log_entry_card")) {
                val rowText = normalizeUiText(subtreeText(node))
                val identityText = findNodesByViewId(node, listOf("primary_text", "secondary_text"))
                    .joinToString(" ") { "${it.text?.toString().orEmpty()} ${it.contentDescription?.toString().orEmpty()}" }
                val matchesPhone = normalizedTarget.isNotBlank() && containsTargetPhoneNumber(identityText, normalizedTarget)
                val matchesContact = !normalizedContact.isNullOrBlank() && identityText.contains(normalizedContact, ignoreCase = true)
                val matchesDirection = when (targetDirection?.uppercase(Locale.US)) {
                    "INBOUND" -> rowText.contains("answered call") || rowText.contains("incoming call")
                    "OUTBOUND" -> rowText.contains("outgoing call") || rowText.contains("placed call")
                    else -> false
                }
                val matchesTime = exactTimeTokens.any(rowText::contains) ||
                    matchesRelativeCallAge(rowText, callEndedAt, expectedDurationMs, System.currentTimeMillis())

                if ((matchesPhone || matchesContact) && matchesDirection && matchesTime) {
                    safeClickable(node)?.let(candidates::add)
                }
            }

            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }

        if (candidates.size != 1) {
            Log.w(TAG, "Expected one call row matching identity, direction and time for phone=$normalizedTarget contact=$normalizedContact; found ${candidates.size}, refusing to guess")
            return null
        }
        Log.i(TAG, "Selected unique call row matching identity, direction and time for phone=$normalizedTarget contact=$normalizedContact")
        return candidates.single()
    }

    internal fun matchesRelativeCallAge(rowText: String, callEndedAt: Long, expectedDurationMs: Long, nowMillis: Long): Boolean {
        val normalized = normalizeUiText(rowText)
        val referenceTimes = buildList {
            add(callEndedAt)
            if (expectedDurationMs > 0L) add((callEndedAt - expectedDurationMs).coerceAtLeast(0L))
        }
        val recent = normalized.contains("just now") || normalized.contains("moments ago") || normalized == "now"
        if (recent) return referenceTimes.any { nowMillis - it in 0L..90_000L }

        val minuteLabels = Regex("\\b(\\d+)\\s*(?:min|mins|minute|minutes)\\s+ago\\b")
            .findAll(normalized).mapNotNull { it.groupValues[1].toLongOrNull() }.toList()
        if (minuteLabels.isNotEmpty()) {
            return referenceTimes.any { reference ->
                val ageMinutes = ((nowMillis - reference).coerceAtLeast(0L) / 60_000L)
                minuteLabels.any { kotlin.math.abs(it - ageMinutes) <= 1L }
            }
        }

        val hourLabels = Regex("\\b(\\d+)\\s*(?:hr|hrs|hour|hours)\\s+ago\\b")
            .findAll(normalized).mapNotNull { it.groupValues[1].toLongOrNull() }.toList()
        return referenceTimes.any { reference ->
            val ageHours = ((nowMillis - reference).coerceAtLeast(0L) / 3_600_000L)
            hourLabels.any { kotlin.math.abs(it - ageHours) <= 1L }
        }
    }

    internal fun findSafeShareButton(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)

        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            val text = node.text?.toString().orEmpty().lowercase(Locale.US)
            val desc = node.contentDescription?.toString().orEmpty().lowercase(Locale.US)
            val viewId = node.viewIdResourceName.orEmpty().lowercase(Locale.US)

            val isShare = SHARE_LABELS.any { text == it || desc.contains(it) || viewId.contains("share") }
            if (isShare && isSafeActionNode(node)) {
                return node
            }

            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        return null
    }

    internal fun isGooglePlaybackShareControl(viewId: String?): Boolean =
        viewId.orEmpty().lowercase(Locale.US).substringAfterLast(":id/").endsWith("playback_share")

    private fun findPlaybackShareButton(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            if (isGooglePlaybackShareControl(node.viewIdResourceName) && isSafeActionNode(node)) return node
            for (i in 0 until node.childCount) node.getChild(i)?.let(queue::add)
        }
        return null
    }

    internal fun findTargetAppNode(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)

        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            val text = node.text?.toString().orEmpty().lowercase(Locale.US)
            val desc = node.contentDescription?.toString().orEmpty().lowercase(Locale.US)

            val isTarget = TARGET_APP_LABELS.any { text.contains(it) || desc.contains(it) }
            if (isTarget) {
                return node
            }

            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        return null
    }

    private fun clickByLabels(root: AccessibilityNodeInfo, labels: List<String>): Boolean {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)

        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            val text = node.text?.toString().orEmpty().lowercase(Locale.US)
            val desc = node.contentDescription?.toString().orEmpty().lowercase(Locale.US)

            val matchesLabel = labels.any { label ->
                if (label == "home") text == label || desc == label
                else text.contains(label) || desc.contains(label)
            }
            if (matchesLabel && isSafeActionNode(node)) {
                val clickable = safeClickable(node)
                if (clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) {
                    return true
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        return false
    }

    private fun scrollForward(root: AccessibilityNodeInfo): Boolean {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            if (node.isScrollable && node.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)) {
                return true
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        return false
    }

    private fun openDefaultDialer(context: Context) {
        val packageName = defaultDialerPackage(context)
        val launch = packageName?.let {
            context.packageManager.getLaunchIntentForPackage(it)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
        } ?: Intent(Intent.ACTION_DIAL).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(launch) }
            .onFailure { Log.w(TAG, "Could not open default dialer", it) }
    }

    internal fun isTransientSystemPackage(packageName: String): Boolean =
        packageName.isBlank() || packageName in TRANSIENT_SYSTEM_PACKAGES

    fun defaultDialerPackage(context: Context): String? {
        val telecom = context.getSystemService(TelecomManager::class.java)
        return runCatching { telecom?.defaultDialerPackage }.getOrNull()
            ?: listOf(
                "com.miui.dialer",
                "com.android.dialer",
                "com.google.android.dialer",
                "com.samsung.android.dialer",
            ).firstOrNull { context.packageManager.getLaunchIntentForPackage(it) != null }
    }
}
