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
        return runCatching {
            @Suppress("DEPRECATION")
            val next = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else MediaRecorder()
            next.setAudioSource(MediaRecorder.AudioSource.MIC)
            next.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            next.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            next.setAudioEncodingBitRate(64_000)
            next.setAudioSamplingRate(16_000)
            next.setOutputFile(file.absolutePath)
            next.prepare()
            next.start()
            recorder = next
            outputFile = file
            activeCallId = callId
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("recordingCallId", callId)
                .putString("recordingState", "RECORDING")
                .putLong("recordingStartedAt", System.currentTimeMillis())
                .apply()
            true
        }.getOrElse { error ->
            release()
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("recordingState", "FAILED")
                .putString("recordingError", error.message ?: "Failed to initialize audio recorder")
                .apply()
            false
        }
    }

    @Synchronized
    fun stop(context: Context): PendingRecording? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val callId = activeCallId ?: prefs.getString("recordingCallId", null)
        val file = outputFile
        if (recorder == null) return pending(context)

        return runCatching {
            recorder?.stop()
            release()
            if (file == null || callId.isNullOrBlank() || file.length() <= 0) {
                prefs.edit().putString("recordingState", "RECORDING_UNAVAILABLE").apply()
                return@runCatching null
            }
            val uploadId = UUID.randomUUID().toString()
            val durationMs = duration(file)
            val sessionStore = SessionStore(context)
            val queued = QueuedRecording(
                clientUploadId = uploadId,
                callId = callId,
                tenantId = null,
                deviceId = sessionStore.installationId,
                filePath = file.absolutePath,
                sizeBytes = file.length(),
                durationMs = durationMs,
                status = "LOCAL_PENDING",
            )
            OfflineEventStore(context).enqueueRecording(queued)
            RecordingUploadWorker.enqueue(context)
            prefs.edit().putString("recordingState", "LOCAL_PENDING").apply()
            PendingRecording(callId, file.absolutePath, file.length(), durationMs, uploadId)
        }.getOrElse { error ->
            release()
            prefs.edit().putString("recordingState", "FAILED").putString("recordingError", error.message).apply()
            null
        }
    }

    fun pending(context: Context): PendingRecording? {
        val queued = OfflineEventStore(context).pendingRecordings().firstOrNull() ?: return null
        return PendingRecording(queued.callId, queued.filePath, queued.sizeBytes, queued.durationMs, queued.clientUploadId)
    }

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

    const val PREFS = "gxclosers_calls"
}
