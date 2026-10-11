package com.gigxomi.gxclosers.data

import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import com.gigxomi.gxclosers.call.DialerShareAutomation
import java.util.UUID
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
)

object SharedRecordingStore {
    private const val PREFS = "gxclosers_shared_recording"
    private const val KEY_PATH = "path"
    private const val KEY_NAME = "name"
    private const val KEY_SIZE = "size"
    private const val KEY_DURATION = "duration"
    private const val KEY_RECEIVED = "received"

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
        val mimeType = intent.type.orEmpty().lowercase(Locale.US)

        val resolver = context.contentResolver
        val displayName = queryDisplayName(resolver, uri)
            ?: "shared-recording-${System.currentTimeMillis()}.m4a"
        val looksLikeAudio = mimeType.isBlank() ||
            mimeType.startsWith("audio/") ||
            (mimeType == "application/octet-stream" && isAudioName(displayName))
        if (!looksLikeAudio) return null
        val safeName = displayName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120)
        val directory = File(context.filesDir, "shared-recordings").apply { mkdirs() }
        val destination = File(directory, "${System.currentTimeMillis()}-$safeName")
        val copied = runCatching {
            resolver.openInputStream(uri)?.use { input ->
                destination.outputStream().use { output -> input.copyTo(output) }
            } ?: 0L
        }.getOrDefault(0L)
        if (copied <= 0L) {
            destination.delete()
            return null
        }

        val automatedCallId = DialerShareAutomation.consumeCallId(context)
        if (!automatedCallId.isNullOrBlank()) {
            val durationMs = duration(destination)
            OfflineEventStore(context).enqueueRecording(
                QueuedRecording(
                    clientUploadId = UUID.nameUUIDFromBytes("dialer-share:$automatedCallId:${destination.name}".toByteArray()).toString(),
                    callId = automatedCallId,
                    tenantId = null,
                    deviceId = SessionStore(context).installationId,
                    filePath = destination.absolutePath,
                    sizeBytes = destination.length(),
                    durationMs = durationMs,
                    status = "LOCAL_PENDING",
                )
            )
            RecordingUploadWorker.enqueue(context)
            return null
        }

        clear(context)
        val pending = PendingSharedRecording(
            path = destination.absolutePath,
            displayName = displayName,
            sizeBytes = destination.length(),
            durationMs = duration(destination),
            receivedAt = System.currentTimeMillis(),
        )
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_PATH, pending.path)
            .putString(KEY_NAME, pending.displayName)
            .putLong(KEY_SIZE, pending.sizeBytes)
            .putLong(KEY_DURATION, pending.durationMs)
            .putLong(KEY_RECEIVED, pending.receivedAt)
            .apply()
        return pending
    }

    fun current(context: Context): PendingSharedRecording? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val path = prefs.getString(KEY_PATH, null).orEmpty()
        if (path.isBlank()) return null
        val file = File(path)
        if (!file.exists() || file.length() <= 0L) {
            clear(context)
            return null
        }
        return PendingSharedRecording(
            path = path,
            displayName = prefs.getString(KEY_NAME, file.name).orEmpty().ifBlank { file.name },
            sizeBytes = file.length(),
            durationMs = prefs.getLong(KEY_DURATION, 0L).takeIf { it > 0L } ?: duration(file),
            receivedAt = prefs.getLong(KEY_RECEIVED, file.lastModified()),
        )
    }

    fun clear(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY_PATH, null)?.let { runCatching { File(it).delete() } }
        prefs.edit().clear().apply()
    }

    private fun queryDisplayName(resolver: android.content.ContentResolver, uri: Uri): String? = runCatching {
        resolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0)?.takeIf(String::isNotBlank) else null
        }
    }.getOrNull()

    private fun isAudioName(name: String): Boolean =
        name.substringAfterLast('.', "").lowercase(Locale.US) in
            setOf("aac", "amr", "3gp", "m4a", "mp3", "ogg", "opus", "wav", "webm")

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

    @Suppress("DEPRECATION")
    private inline fun <reified T : android.os.Parcelable> Intent.getParcelableExtraCompat(name: String): T? =
        if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableExtra(name, T::class.java) else getParcelableExtra(name)

    @Suppress("DEPRECATION")
    private inline fun <reified T : android.os.Parcelable> Intent.getParcelableArrayListExtraCompat(name: String): ArrayList<T>? =
        if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableArrayListExtra(name, T::class.java) else getParcelableArrayListExtra(name)
}
