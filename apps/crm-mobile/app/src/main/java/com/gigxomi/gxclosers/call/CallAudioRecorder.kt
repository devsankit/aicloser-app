package com.gigxomi.gxclosers.call

import android.content.Context
import android.media.MediaMetadataRetriever
import android.media.MediaRecorder
import android.os.Build
import java.io.File

data class PendingRecording(val callId: String, val path: String, val size: Long, val durationMs: Long)

object CallAudioRecorder {
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var activeCallId: String? = null

    @Synchronized fun start(context: Context, callId: String): Boolean {
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
            next.prepare(); next.start()
            recorder = next; outputFile = file; activeCallId = callId
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("recordingCallId", callId).putString("recordingState", "RECORDING").putLong("recordingStartedAt", System.currentTimeMillis()).apply()
            true
        }.getOrElse { error ->
            release()
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("recordingState", "FAILED").putString("recordingError", error.message).apply()
            false
        }
    }

    @Synchronized fun stop(context: Context): PendingRecording? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val callId = activeCallId ?: prefs.getString("recordingCallId", null)
        val file = outputFile
        if (recorder == null) return pending(context)
        return runCatching {
            recorder?.stop(); release()
            if (file == null || callId.isNullOrBlank() || file.length() <= 0) return@runCatching null
            val pending = PendingRecording(callId, file.absolutePath, file.length(), duration(file))
            prefs.edit().putString("pendingRecordingCallId", callId).putString("pendingRecordingPath", file.absolutePath)
                .putLong("pendingRecordingSize", pending.size).putLong("pendingRecordingDurationMs", pending.durationMs).putString("recordingState", "LOCAL_PENDING").apply()
            pending
        }.getOrElse { release(); null }
    }

    fun pending(context: Context): PendingRecording? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val callId = prefs.getString("pendingRecordingCallId", null) ?: return null
        val path = prefs.getString("pendingRecordingPath", null) ?: return null
        return PendingRecording(callId, path, prefs.getLong("pendingRecordingSize", 0), prefs.getLong("pendingRecordingDurationMs", 0))
    }

    fun clearPending(context: Context) {
        pending(context)?.let { runCatching { File(it.path).delete() } }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("pendingRecordingCallId").remove("pendingRecordingPath").remove("pendingRecordingSize").remove("pendingRecordingDurationMs").apply()
    }

    private fun duration(file: File) = runCatching {
        MediaMetadataRetriever().let { retriever -> try { retriever.setDataSource(file.absolutePath); retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0 } finally { retriever.release() } }
    }.getOrDefault(0)
    private fun release() { runCatching { recorder?.reset() }; runCatching { recorder?.release() }; recorder = null; outputFile = null; activeCallId = null }
    const val PREFS = "gxclosers_calls"
}
