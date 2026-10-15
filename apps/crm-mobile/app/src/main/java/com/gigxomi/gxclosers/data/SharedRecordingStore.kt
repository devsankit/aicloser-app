package com.gigxomi.gxclosers.data

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.CallLog
import androidx.core.content.ContextCompat
import java.io.File
import java.util.Locale

/**
 * Holds one recording shared into AI Closer from a Phone/Recorder/Truecaller
 * app until the user attaches it to the correct CRM call.
 */
data class PendingSharedRecording(
    val path: String,
    val displayName: String,
    val sizeBytes: Long,
    val durationMs: Long,
    val receivedAt: Long,
    val matchedCallId: String? = null,
    val matchedPhone: String? = null,
    val matchedCallAt: Long? = null,
)

object SharedRecordingStore {
    private const val PREFS = "gxclosers_shared_recording"
    private const val KEY_PATH = "path"
    private const val KEY_NAME = "name"
    private const val KEY_SIZE = "size"
    private const val KEY_DURATION = "duration"
    private const val KEY_RECEIVED = "received"
    private const val KEY_MATCHED_CALL_ID = "matchedCallId"
    private const val KEY_MATCHED_PHONE = "matchedPhone"
    private const val KEY_MATCHED_CALL_AT = "matchedCallAt"

    fun importIntent(context: Context, intent: Intent): PendingSharedRecording? {
        val action = intent.action
        if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return null
        val uri = when (action) {
            Intent.ACTION_SEND_MULTIPLE -> {
                intent.getParcelableArrayListExtraCompat<Uri>(Intent.EXTRA_STREAM)?.firstOrNull()
                    ?: intent.clipData?.getItemAt(0)?.uri
            }
            else -> {
                intent.getParcelableExtraCompat<Uri>(Intent.EXTRA_STREAM)
                    ?: intent.clipData?.getItemAt(0)?.uri
            }
        } ?: return null
        val resolver = context.contentResolver
        val mimeType = listOf(intent.type, runCatching { resolver.getType(uri) }.getOrNull())
            .filterNot { it.isNullOrBlank() }
            .joinToString(";") { it!!.lowercase(Locale.US) }
        val displayName = queryDisplayName(resolver, uri)
            ?: "shared-recording-${System.currentTimeMillis()}.m4a"
        if (!looksLikeAudio(mimeType, displayName)) return null
        val safeName = displayName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120)
        val directory = File(context.filesDir, "shared-recordings").apply { mkdirs() }
        val receivedAt = System.currentTimeMillis()
        val destination = File(directory, "$receivedAt-$safeName")
        val copied = runCatching {
            resolver.openInputStream(uri)?.use { input ->
                destination.outputStream().use { output -> input.copyTo(output) }
            } ?: 0L
        }.getOrDefault(0L)
        if (copied <= 0L) {
            destination.delete()
            return null
        }

        // Reset previous pending recording state before saving new import
        clearPreferences(context)
        val durationMs = duration(destination)
        val armedCall = com.gigxomi.gxclosers.call.DialerShareAutomation.getArmedCall(context)
        val wasArmedForActiveCall = armedCall != null
        val armedCallId = com.gigxomi.gxclosers.call.DialerShareAutomation.consumeArmedCall(context, displayName, durationMs, receivedAt)
        val matchedCall = if (armedCallId != null) {
            MatchedCallResult(
                callId = armedCallId,
                phoneNumber = armedCall?.phoneNumber,
                callAtMillis = armedCall?.callEndedAt ?: receivedAt,
            )
        } else if (wasArmedForActiveCall) {
            // The automation intentionally arms one specific call. If the file
            // fails its phone/time/duration checks, don't silently attach it to
            // some older call via the generic historical matcher.
            null
        } else {
            findBestCallMatch(context, displayName, durationMs, receivedAt)
        }

        val pending = PendingSharedRecording(
            path = destination.absolutePath,
            displayName = displayName,
            sizeBytes = destination.length(),
            durationMs = durationMs,
            receivedAt = receivedAt,
            matchedCallId = matchedCall?.callId,
            matchedPhone = matchedCall?.phoneNumber,
            matchedCallAt = matchedCall?.callAtMillis,
        )
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_PATH, pending.path)
            .putString(KEY_NAME, pending.displayName)
            .putLong(KEY_SIZE, pending.sizeBytes)
            .putLong(KEY_DURATION, pending.durationMs)
            .putLong(KEY_RECEIVED, pending.receivedAt)
            .putString(KEY_MATCHED_CALL_ID, pending.matchedCallId)
            .putString(KEY_MATCHED_PHONE, pending.matchedPhone)
            .putLong(KEY_MATCHED_CALL_AT, pending.matchedCallAt ?: 0L)
            .apply()
        return pending
    }

    fun current(context: Context): PendingSharedRecording? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val path = prefs.getString(KEY_PATH, null).orEmpty()
        if (path.isBlank()) return null
        val file = File(path)
        if (!file.exists() || file.length() <= 0L) {
            clearPreferences(context)
            return null
        }
        return PendingSharedRecording(
            path = path,
            displayName = prefs.getString(KEY_NAME, file.name).orEmpty().ifBlank { file.name },
            sizeBytes = file.length(),
            durationMs = prefs.getLong(KEY_DURATION, 0L).takeIf { it > 0L } ?: duration(file),
            receivedAt = prefs.getLong(KEY_RECEIVED, file.lastModified()),
            matchedCallId = prefs.getString(KEY_MATCHED_CALL_ID, null),
            matchedPhone = prefs.getString(KEY_MATCHED_PHONE, null),
            matchedCallAt = prefs.getLong(KEY_MATCHED_CALL_AT, 0L).takeIf { it > 0L },
        )
    }

    /**
     * Clears preferences only, preserving any underlying audio file on disk.
     * Use when attaching a recording to a call so it can be uploaded.
     */
    fun clearPreferences(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    /**
     * Deletes the pending file on disk and clears preferences.
     * Used ONLY when the user explicitly discards or cancels an imported recording.
     */
    fun discard(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY_PATH, null)?.let { runCatching { File(it).delete() } }
        prefs.edit().clear().apply()
    }

    /**
     * Backwards-compatible clear - delegates to clearPreferences to prevent
     * premature file deletion before upload.
     */
    fun clear(context: Context) {
        clearPreferences(context)
    }

    private fun queryDisplayName(resolver: android.content.ContentResolver, uri: Uri): String? = runCatching {
        resolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0)?.takeIf(String::isNotBlank) else null
        }
    }.getOrNull()

    private fun isAudioName(name: String): Boolean =
        name.substringAfterLast('.', "").lowercase(Locale.US) in
            setOf("aac", "amr", "3gp", "m4a", "mp3", "ogg", "opus", "wav", "webm")

    /** Google Phone/OEM share sheets may publish audio with a generic MIME type. */
    internal fun looksLikeAudio(mimeType: String, displayName: String): Boolean {
        val types = mimeType.split(';').map { it.trim().lowercase(Locale.US) }.filter { it.isNotBlank() }
        if (types.isEmpty() || types.any { it.startsWith("audio/") }) return true
        val generic = types.any { it == "*/*" || it == "application/octet-stream" || it == "application/*" }
        return generic && isAudioName(displayName)
    }

    internal fun extractPhoneDigits(displayName: String): String? {
        val nameWithoutExt = displayName.substringBeforeLast('.')
        val candidates = Regex("""\+?(\d{10,13})""").findAll(nameWithoutExt).map { it.groupValues[1] }.toList()
        for (candidate in candidates) {
            if (candidate.startsWith("202") || candidate.startsWith("203") || candidate.startsWith("201")) {
                val month = candidate.substring(4, 6).toIntOrNull() ?: 0
                val day = candidate.substring(6, 8).toIntOrNull() ?: 0
                if (month in 1..12 && day in 1..31) continue
            }
            return candidate.takeLast(10)
        }
        return null
    }

    internal fun extractTimestamp(displayName: String): Long? {
        val nameWithoutExt = displayName.substringBeforeLast('.')
        val formattedMatch = Regex("""(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])[\s_-]+([01]\d|2[0-3])[-_.:]([0-5]\d)[-_.:]([0-5]\d)""").find(nameWithoutExt)
        if (formattedMatch != null) {
            val (y, m, d, h, min, s) = formattedMatch.destructured
            return runCatching {
                val ldt = java.time.LocalDateTime.of(y.toInt(), m.toInt(), d.toInt(), h.toInt(), min.toInt(), s.toInt())
                ldt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
            }.getOrNull()
        }
        val fullMatch = Regex("""(?<!\d)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[_-]?([01]\d|2[0-3])([0-5]\d)([0-5]\d)(?!\d)""").find(nameWithoutExt)
        if (fullMatch != null) {
            val (y, m, d, h, min, s) = fullMatch.destructured
            return runCatching {
                val ldt = java.time.LocalDateTime.of(y.toInt(), m.toInt(), d.toInt(), h.toInt(), min.toInt(), s.toInt())
                ldt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
            }.getOrNull()
        }
        val shortMatch = Regex("""(?<!\d)(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[_-]([01]\d|2[0-3])([0-5]\d)([0-5]\d)(?!\d)""").find(nameWithoutExt)
        if (shortMatch != null) {
            val (y, m, d, h, min, s) = shortMatch.destructured
            val fullYear = 2000 + y.toInt()
            return runCatching {
                val ldt = java.time.LocalDateTime.of(fullYear, m.toInt(), d.toInt(), h.toInt(), min.toInt(), s.toInt())
                ldt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
            }.getOrNull()
        }
        return null
    }

    private fun duration(file: File): Long = runCatching {
        MediaMetadataRetriever().let { retriever ->
            try {
                retriever.setDataSource(file.absolutePath)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            } finally {
                retriever.release()
            }
        }
    }.getOrDefault(0L)

    data class MatchedCallResult(
        val callId: String?,
        val phoneNumber: String?,
        val callAtMillis: Long,
    )

    internal fun selectBestCandidate(
        candidates: List<CrmCallCandidate>,
        displayName: String,
        durationMs: Long,
        receivedAt: Long,
    ): CrmCallCandidate? {
        val phoneFromFilename = extractPhoneDigits(displayName)
        val timestampFromFilename = extractTimestamp(displayName)
        // Recency and duration alone cannot reliably identify a call. Keep
        // timestamp-less recordings pending for explicit user selection.
        if (timestampFromFilename == null) return null
        val scored = candidates.map { candidate ->
            candidate to scoreCall(
                candidatePhone = candidate.phoneNumber,
                candidateCallAt = candidate.callAtMillis,
                candidateDurationMs = candidate.durationSeconds * 1000L,
                phoneFromFilename = phoneFromFilename,
                timestampFromFilename = timestampFromFilename,
                audioDurationMs = durationMs,
                receivedAt = receivedAt,
            )
        }.filter { it.second >= CONFIDENCE_THRESHOLD }

        if (scored.isEmpty()) return null

        val maxScore = scored.maxOf { it.second }
        val topCandidates = scored.filter { it.second == maxScore }
        val sorted = scored.sortedByDescending { it.second }

        // Strict ambiguity check:
        // If multiple candidates achieve the top score (tie), or if the top two candidates
        // are separated by less than a decisive 40-point margin, treat as ambiguous.
        val isAmbiguous = topCandidates.size > 1 ||
            (sorted.size > 1 && sorted[0].second - sorted[1].second < 40L)

        if (isAmbiguous) {
            // Do NOT guess or take the first candidate on a tie!
            // Return null so the closer manually picks the call without risk of wrong attachment.
            return null
        }

        return topCandidates.first().first
    }

    internal fun findBestCallMatch(
        context: Context,
        displayName: String,
        durationMs: Long,
        receivedAt: Long,
    ): MatchedCallResult? {
        if (extractTimestamp(displayName) == null) return null
        val eventStore = OfflineEventStore(context)
        val crmCandidates = runCatching { eventStore.recentCrmCallCandidates(receivedAt - 24L * 60L * 60L * 1000L) }
            .getOrDefault(emptyList())

        if (crmCandidates.isNotEmpty()) {
            val bestCrm = selectBestCandidate(crmCandidates, displayName, durationMs, receivedAt)
            if (bestCrm != null) {
                return MatchedCallResult(
                    callId = bestCrm.callId,
                    phoneNumber = bestCrm.phoneNumber,
                    callAtMillis = bestCrm.callAtMillis,
                )
            }
            // If candidates qualified but were ambiguous, do NOT fall back to dialer call log!
            val phoneFromFilename = extractPhoneDigits(displayName)
            val timestampFromFilename = extractTimestamp(displayName)
            val qualifiedCount = crmCandidates.count { candidate ->
                scoreCall(
                    candidatePhone = candidate.phoneNumber,
                    candidateCallAt = candidate.callAtMillis,
                    candidateDurationMs = candidate.durationSeconds * 1000L,
                    phoneFromFilename = phoneFromFilename,
                    timestampFromFilename = timestampFromFilename,
                    audioDurationMs = durationMs,
                    receivedAt = receivedAt,
                ) >= CONFIDENCE_THRESHOLD
            }
            if (qualifiedCount > 1) {
                return null // Ambiguous CRM candidates: require manual user selection
            }
        }

        // Check CallLog to see if system dialer has matching call
        val phoneFromFilename = extractPhoneDigits(displayName)
        val timestampFromFilename = extractTimestamp(displayName)
        val callLogEntry = findCallLogCandidate(
            context = context,
            phoneFromFilename = phoneFromFilename,
            timestampFromFilename = timestampFromFilename,
            durationMs = durationMs,
            receivedAt = receivedAt,
        ) ?: return null

        val crmMatch = eventStore.findBestCallForManualRecording(
            phoneNumber = callLogEntry.phoneNumber,
            callAtMillis = callLogEntry.callAtMillis,
            durationMs = durationMs,
        )

        return MatchedCallResult(
            callId = crmMatch?.callId,
            phoneNumber = callLogEntry.phoneNumber,
            callAtMillis = callLogEntry.callAtMillis,
        )
    }

    const val CONFIDENCE_THRESHOLD = 300L

    internal fun scoreCall(
        candidatePhone: String,
        candidateCallAt: Long,
        candidateDurationMs: Long,
        phoneFromFilename: String?,
        timestampFromFilename: Long?,
        audioDurationMs: Long,
        receivedAt: Long,
    ): Long {
        var score = 0L
        val normalizedCandidatePhone = candidatePhone.filter(Char::isDigit).takeLast(10)

        // 1. Phone matching & strict conflict detection
        if (phoneFromFilename != null && normalizedCandidatePhone.isNotBlank()) {
            if (normalizedCandidatePhone == phoneFromFilename) {
                score += 200L
            } else {
                return -1000L // Hard conflict: phone in filename explicitly belongs to another contact
            }
        }

        // 2. Timestamp matching & strict conflict detection (Call Manager exact-distance pattern)
        if (timestampFromFilename != null) {
            val candidateEndAt = if (candidateDurationMs > 0L) candidateCallAt + candidateDurationMs else candidateCallAt
            val timeDiff = minOf(
                kotlin.math.abs(candidateCallAt - timestampFromFilename),
                kotlin.math.abs(candidateEndAt - timestampFromFilename)
            )

            // When the filename contains a timestamp down to the second,
            // require abs(candidateCallAt - timestampFromFilename) <= 5000L (within 5 seconds) to match.
            // A call 33 seconds away receives a hard conflict score (-1000L),
            // preventing cross-linking between rapid sequential calls to the same number.
            if (timeDiff > 5000L) {
                return -1000L // Hard conflict: filename timestamp disagrees with call by > 5 seconds
            }

            // Score by exact minimum distance (Call Manager pattern: Math.abs(callDate - recordingTimestamp))
            // 0ms diff -> +350L, 500ms diff -> +340L, 5000ms diff -> +250L
            val distanceBonus = (350L - (timeDiff / 50L)).coerceAtLeast(250L)
            score += distanceBonus
        } else {
            val elapsed = receivedAt - candidateCallAt
            when {
                elapsed in 0..(5 * 60 * 1000L) -> score += 70L
                elapsed in 0..(15 * 60 * 1000L) -> score += 30L
                elapsed > 30 * 60 * 1000L -> return -1000L // Hard conflict: recording shared > 30m after call without filename timestamp cannot auto-attach
                elapsed < -2 * 60 * 1000L -> return -1000L // Hard conflict: call timestamp is in the future
            }
        }

        // 3. Duration matching & strict conflict detection
        if (audioDurationMs > 0L && candidateDurationMs > 0L) {
            val durationDiff = kotlin.math.abs(candidateDurationMs - audioDurationMs)
            val durationToleranceMs = maxOf(5_000L, (candidateDurationMs * 0.2).toLong())
            if (durationDiff > durationToleranceMs) {
                return -1000L // Refuse cross-linking when the audio length materially differs from the call
            }
            when {
                durationDiff <= 10_000L -> score += 50L
                durationDiff <= 30_000L -> score += 20L
            }
        }

        return score
    }

    private data class CallLogEntry(
        val phoneNumber: String,
        val callAtMillis: Long,
        val durationSeconds: Long,
    )

    private fun findCallLogCandidate(
        context: Context,
        phoneFromFilename: String?,
        timestampFromFilename: Long?,
        durationMs: Long,
        receivedAt: Long,
    ): CallLogEntry? {
        if (timestampFromFilename == null) return null
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) return null
        val cursor = runCatching {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DATE, CallLog.Calls.DURATION, CallLog.Calls.TYPE),
                "${CallLog.Calls.DATE} <= ? AND ${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.DURATION} > 0",
                arrayOf(receivedAt.toString(), (receivedAt - 24L * 60L * 60L * 1000L).toString()),
                "${CallLog.Calls.DATE} DESC",
            )
        }.getOrNull() ?: return null

        val entries = cursor.use {
            buildList {
                while (it.moveToNext()) {
                    val phone = it.getString(0).orEmpty().takeIf(String::isNotBlank) ?: continue
                    val startedAt = it.getLong(1)
                    val durationSeconds = it.getLong(2).coerceAtLeast(0L)
                    add(CallLogEntry(phone, startedAt, durationSeconds))
                }
            }
        }

        val scored = entries.map { entry ->
            entry to scoreCall(
                candidatePhone = entry.phoneNumber,
                candidateCallAt = entry.callAtMillis,
                candidateDurationMs = entry.durationSeconds * 1000L,
                phoneFromFilename = phoneFromFilename,
                timestampFromFilename = timestampFromFilename,
                audioDurationMs = durationMs,
                receivedAt = receivedAt,
            )
        }.filter { it.second >= CONFIDENCE_THRESHOLD }

        if (scored.isEmpty()) return null

        val maxScore = scored.maxOf { it.second }
        val topCandidates = scored.filter { it.second == maxScore }
        val sorted = scored.sortedByDescending { it.second }
        val isAmbiguous = topCandidates.size > 1 ||
            (sorted.size > 1 && sorted[0].second - sorted[1].second < 40L)

        if (isAmbiguous) {
            // Ambiguity in CallLog entries: do not pick first on a tie!
            return null
        }

        return topCandidates.first().first
    }

    @Suppress("DEPRECATION")
    private inline fun <reified T : android.os.Parcelable> Intent.getParcelableExtraCompat(name: String): T? =
        if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableExtra(name, T::class.java) else getParcelableExtra(name)

    @Suppress("DEPRECATION")
    private inline fun <reified T : android.os.Parcelable> Intent.getParcelableArrayListExtraCompat(name: String): ArrayList<T>? =
        if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableArrayListExtra(name, T::class.java) else getParcelableArrayListExtra(name)
}
