package com.gigxomi.gxclosers.data

import android.content.Context
import com.gigxomi.gxclosers.call.CallAudioRecorder
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.io.File
import java.util.concurrent.TimeUnit
import android.util.Log

class RecordingUploadWorker(appContext: Context, workerParams: WorkerParameters) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val store = OfflineEventStore(applicationContext)
        val sessionStore = SessionStore(applicationContext)
        store.reconcileRecordingFiles(File(applicationContext.filesDir, "crm-recordings"), CallAudioRecorder.currentCallId())
        if (sessionStore.token.isNullOrBlank()) return Result.success()

        val api = ApiClient(sessionStore)
        // An active recorder remains in RECORDING until the phone emits IDLE.
        // Never upload that file while it is still being written.
        val pending = store.pendingRecordings().filter { it.status != "RECORDING" }
        if (pending.isEmpty()) return Result.success()

        var hasFailures = false

        for (item in pending) {
            val file = File(item.filePath)
            if (!file.exists()) {
                // A missing local file cannot become uploadable on a later retry.
                // Keep the queue history, but do not let it block newer calls.
                store.updateRecordingStatus(item.clientUploadId, "FAILED_PERMANENT", "Audio file not found on device")
                DeviceDiagnostics.record(
                    applicationContext,
                    kind = "RECORDING_LOCAL_FILE_MISSING",
                    callId = item.callId,
                    fields = org.json.JSONObject().put("stage", "UPLOAD").put("status", "FAILED_PERMANENT"),
                )
                continue
            }

            store.updateRecordingStatus(item.clientUploadId, "UPLOADING")
            try {
                api.uploadRecording(item.callId, item.clientUploadId, file, item.durationMs)
                store.markRecordingUploaded(item.clientUploadId)
                DeviceDiagnostics.record(
                    applicationContext,
                    kind = "RECORDING_UPLOAD_ACKNOWLEDGED",
                    callId = item.callId,
                    fields = org.json.JSONObject()
                        .put("stage", "UPLOAD")
                        .put("status", "ACKNOWLEDGED")
                        .put("durationMs", item.durationMs)
                        .put("sizeBytes", file.length()),
                )
                // Retain a safe local buffer (keep latest 10 files / 2 hours) instead of immediate deletion
                pruneOldRecordings(applicationContext)
            } catch (error: Exception) {
                val message = error.message ?: "Recording upload failed"
                Log.e("GXUpload", "Recording upload failed callId=${item.callId} status=${item.status} file=${file.name} bytes=${file.length()} message=$message", error)
                if (isPermanentFailure(error)) {
                    // Invalid/expired call-session references (especially old
                    // unprepared mic captures) will never succeed by retrying.
                    // Leave the file and history intact, but remove it from the
                    // active retry set so a fresh dialer recording can upload.
                    store.updateRecordingStatus(item.clientUploadId, "FAILED_PERMANENT", message)
                    DeviceDiagnostics.record(
                        applicationContext,
                        kind = "RECORDING_UPLOAD_PERMANENT_FAILURE",
                        callId = item.callId,
                        fields = org.json.JSONObject()
                            .put("stage", "UPLOAD")
                            .put("status", "FAILED_PERMANENT")
                            .put("errorCode", (error as? ApiException)?.status ?: 0)
                            .put("retryCount", item.retryCount),
                    )
                    Log.w("GXUpload", "Marking recording permanently failed: ${item.clientUploadId}")
                } else {
                    hasFailures = true
                    store.incrementRecordingRetry(item.clientUploadId, message)
                    DeviceDiagnostics.record(
                        applicationContext,
                        kind = "RECORDING_UPLOAD_RETRY",
                        callId = item.callId,
                        fields = org.json.JSONObject()
                            .put("stage", "UPLOAD")
                            .put("status", "RETRY")
                            .put("errorCode", (error as? ApiException)?.status ?: 0)
                            .put("retryCount", item.retryCount + 1),
                    )
                }
            }
        }

        return if (hasFailures) Result.retry() else Result.success()
    }

    private fun isPermanentFailure(error: Exception): Boolean {
        val apiError = error as? ApiException ?: return false
        // Retryable client responses are session expiry, conflict, timeout and
        // rate limiting. Other 4xx responses describe a request that cannot be
        // repaired by repeating the same upload (for example a missing call
        // session or lead assignment).
        return apiError.status in 400..499 && apiError.status !in setOf(401, 408, 409, 429)
    }

    private fun pruneOldRecordings(context: Context) {
        runCatching {
            val dir = File(context.filesDir, "crm-recordings")
            if (!dir.exists() || !dir.isDirectory) return
            val files = dir.listFiles()?.filter { it.isFile }?.sortedBy { it.lastModified() } ?: return
            // Keep at least the latest 10 files; delete files older than 2 hours if count > 10
            val cutoff = System.currentTimeMillis() - (2 * 60 * 60 * 1000L)
            if (files.size > 10) {
                files.take(files.size - 10).forEach { file ->
                    if (file.lastModified() < cutoff) {
                        file.delete()
                    }
                }
            }
        }
    }

    companion object {
        private const val UNIQUE_NAME = "gxclosers-recording-upload"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<RecordingUploadWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_NAME, ExistingWorkPolicy.KEEP, request)
        }

        fun retryNow(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<RecordingUploadWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_NAME, ExistingWorkPolicy.REPLACE, request)
        }
    }
}
