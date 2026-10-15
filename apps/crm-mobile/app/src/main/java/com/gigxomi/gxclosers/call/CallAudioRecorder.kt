package com.gigxomi.gxclosers.call

import android.content.Context
import android.media.MediaMetadataRetriever
import android.media.MediaRecorder
import android.os.Build
import com.gigxomi.gxclosers.data.OfflineEventStore
import com.gigxomi.gxclosers.data.QueuedRecording
import com.gigxomi.gxclosers.data.RecordingUploadWorker
import com.gigxomi.gxclosers.data.SessionStore
import java.io.File
import java.util.UUID

data class PendingRecording(
    val callId: String,
    val path: String,
    val size: Long,
    val durationMs: Long,
    val clientUploadId: String,
)

object CallAudioRecorder {
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var activeCallId: String? = null

    @Synchronized
    fun start(context: Context, callId: String): Boolean {
        if (recorder != null && activeCallId == callId) return true
        stop(context)
        val directory = File(context.filesDir, "crm-recordings").apply { mkdirs() }
        val file = File(directory, "$callId-${System.currentTimeMillis()}.m4a")
        val uploadId = UUID.randomUUID().toString()
        val sessionStore = SessionStore(context)
        OfflineEventStore(context).enqueueRecording(
            QueuedRecording(
                clientUploadId = uploadId,
                callId = callId,
                tenantId = null,
                deviceId = sessionStore.installationId,
                filePath = file.absolutePath,
                sizeBytes = 0L,
                durationMs = 0L,
                status = "RECORDING",
            )
        )
        return runCatching {
            val sources = listOf(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                MediaRecorder.AudioSource.MIC,
            ).distinct()
            var lastError: Throwable? = null
            for (source in sources) {
                @Suppress("DEPRECATION")
                val next = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else MediaRecorder()
                try {
                    next.setAudioSource(source)
                    next.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    next.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    next.setAudioEncodingBitRate(96_000)
                    next.setAudioSamplingRate(16_000)
                    next.setOutputFile(file.absolutePath)
                    next.prepare()
                    next.start()
                    recorder = next
                    outputFile = file
                    activeCallId = callId
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                        .putString("recordingCallId", callId)
                        .putString("recordingUploadId", uploadId)
                        .putString("recordingAudioSource", sourceName(source))
                        .putString("recordingState", "RECORDING")
                        .remove("recordingError")
                        .putLong("recordingStartedAt", System.currentTimeMillis())
                        .apply()
                    return@runCatching true
                } catch (error: Throwable) {
                    lastError = error
                    runCatching { next.reset() }
                    runCatching { next.release() }
                    runCatching { file.delete() }
                }
            }
            throw lastError ?: IllegalStateException("No supported audio source was available")
        }.getOrElse { error ->
            release()
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("recordingState", "FAILED")
                .putString("recordingError", error.message ?: "Failed to initialize audio recorder")
                .apply()
            OfflineEventStore(context).updateRecordingStatus(uploadId, "FAILED", error.message ?: "Failed to initialize audio recorder")
            false
        }
    }

    @Synchronized
    fun stop(context: Context): PendingRecording? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val callId = activeCallId ?: prefs.getString("recordingCallId", null)
        val uploadId = prefs.getString("recordingUploadId", null)
        val file = outputFile
        if (recorder == null) {
            // Never return an arbitrary stale recording when recorder was not running.
            // Only return an unprepared recording if one was explicitly recorded for this exact active call.
            return if (!callId.isNullOrBlank()) pending(context, callId) else null
        }

        return runCatching {
            recorder?.stop()
            release()
            if (file == null || callId.isNullOrBlank() || file.length() <= 0) {
                prefs.edit().putString("recordingState", "RECORDING_UNAVAILABLE").apply()
                if (!uploadId.isNullOrBlank()) {
                    OfflineEventStore(context).updateRecordingStatus(uploadId, "FAILED", "Audio recording was empty or missing")
                }
                return@runCatching null
            }
            val durationMs = duration(file)
            val finalUploadId = uploadId ?: UUID.randomUUID().toString()
            val store = OfflineEventStore(context)
            val recordingStatus = "LOCAL_PENDING"
            if (uploadId.isNullOrBlank()) {
                store.enqueueRecording(
                    QueuedRecording(
                        clientUploadId = finalUploadId,
                        callId = callId,
                        tenantId = null,
                        deviceId = SessionStore(context).installationId,
                        filePath = file.absolutePath,
                        sizeBytes = file.length(),
                        durationMs = durationMs,
                        status = recordingStatus,
                    )
                )
            } else {
                store.finalizeRecording(finalUploadId, file.length(), durationMs, status = recordingStatus)
            }
            prefs.edit().putString("recordingState", recordingStatus).apply()
            RecordingUploadWorker.enqueue(context)
            PendingRecording(callId, file.absolutePath, file.length(), durationMs, finalUploadId)
        }.getOrElse { error ->
            release()
            if (!uploadId.isNullOrBlank()) {
                OfflineEventStore(context).updateRecordingStatus(uploadId, "FAILED", error.message ?: "Audio recorder stopped unexpectedly")
            }
            prefs.edit().putString("recordingState", "FAILED").putString("recordingError", error.message).apply()
            null
        }
    }

    fun pending(context: Context, forCallId: String? = null): PendingRecording? {
        val candidates = OfflineEventStore(context).pendingRecordings().filter { it.status == "LOCAL_PENDING" || it.status == "HOLD_FOR_SYSTEM" }
        val queued = if (!forCallId.isNullOrBlank()) {
            candidates.firstOrNull { it.callId == forCallId }
        } else {
            // Only unprepared captures created within the last 60 seconds are valid without an explicit callId
            candidates.firstOrNull { it.callId.startsWith(UNPREPARED_CALL_PREFIX) }
        } ?: return null
        return PendingRecording(queued.callId, queued.filePath, queued.sizeBytes, queued.durationMs, queued.clientUploadId)
    }

    fun currentCallId(): String? = activeCallId

    fun clearPending(context: Context) {
        pending(context)?.let { recording ->
            runCatching { File(recording.path).delete() }
            OfflineEventStore(context).removeRecording(recording.clientUploadId)
        }
    }

    private fun duration(file: File) = runCatching {
        MediaMetadataRetriever().let { retriever ->
            try {
                retriever.setDataSource(file.absolutePath)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0
            } finally {
                retriever.release()
            }
        }
    }.getOrDefault(0)

    private fun release() {
        runCatching { recorder?.reset() }
        runCatching { recorder?.release() }
        recorder = null
        outputFile = null
        activeCallId = null
    }

    private fun sourceName(source: Int): String = when (source) {
        MediaRecorder.AudioSource.VOICE_COMMUNICATION -> "VOICE_COMMUNICATION"
        MediaRecorder.AudioSource.VOICE_RECOGNITION -> "VOICE_RECOGNITION"
        else -> "MIC"
    }

    const val PREFS = "gxclosers_calls"
    const val UNPREPARED_CALL_PREFIX = "unprepared-"
}
