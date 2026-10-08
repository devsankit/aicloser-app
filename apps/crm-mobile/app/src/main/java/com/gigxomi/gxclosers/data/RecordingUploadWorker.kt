package com.gigxomi.gxclosers.data

import android.content.Context
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

class RecordingUploadWorker(appContext: Context, workerParams: WorkerParameters) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val store = OfflineEventStore(applicationContext)
        val sessionStore = SessionStore(applicationContext)
        if (sessionStore.token.isNullOrBlank()) return Result.success()

        val api = ApiClient(sessionStore)
        val pending = store.pendingRecordings()
        if (pending.isEmpty()) return Result.success()

        var hasFailures = false

        for (item in pending) {
            val file = File(item.filePath)
            if (!file.exists()) {
                store.updateRecordingStatus(item.clientUploadId, "FAILED", "Audio file not found on device")
                continue
            }

            store.updateRecordingStatus(item.clientUploadId, "UPLOADING")
            try {
                api.uploadRecording(item.callId, item.clientUploadId, file, item.durationMs)
                store.markRecordingUploaded(item.clientUploadId)
                // Clean up local recording file after successful upload to protect storage & privacy
                runCatching { file.delete() }
            } catch (error: Exception) {
                hasFailures = true
                val message = error.message ?: "Recording upload failed"
                store.incrementRecordingRetry(item.clientUploadId, message)
            }
        }

        return if (hasFailures) Result.retry() else Result.success()
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
