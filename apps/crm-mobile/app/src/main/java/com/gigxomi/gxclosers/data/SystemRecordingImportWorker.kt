package com.gigxomi.gxclosers.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.gigxomi.gxclosers.call.SystemCallRecordingImporter
import java.util.UUID
import java.util.concurrent.TimeUnit

/** Waits for the system dialer to finish writing its recording, then queues it. */
class SystemRecordingImportWorker(appContext: Context, workerParams: WorkerParameters) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val callId = inputData.getString(KEY_CALL_ID).orEmpty()
        if (callId.isBlank()) return Result.success()
        val startedAt = inputData.getLong(KEY_STARTED_AT, 0L)
        val endedAt = inputData.getLong(KEY_ENDED_AT, System.currentTimeMillis())
        val durationSeconds = inputData.getLong(KEY_DURATION_SECONDS, 0L)
        val phoneNumber = inputData.getString(KEY_PHONE_NUMBER)
        val imported = SystemCallRecordingImporter.importLatest(
            applicationContext,
            startedAt,
            endedAt,
            durationSeconds,
            phoneNumber,
        ) ?: run {
            DeviceDiagnostics.record(
                applicationContext,
                kind = if (runAttemptCount < MAX_ATTEMPTS) "RECORDING_SOURCE_WAITING" else "RECORDING_SOURCE_MISSING",
                callId = callId,
                fields = org.json.JSONObject()
                    .put("stage", "IMPORT")
                    .put("retryCount", runAttemptCount)
                    .put("expectedDurationMs", durationSeconds * 1000L),
            )
            return if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.success()
        }

        DeviceDiagnostics.record(
            applicationContext,
            kind = "RECORDING_SOURCE_FOUND",
            callId = callId,
            fields = org.json.JSONObject()
                .put("stage", "IMPORT")
                .put("durationMs", imported.durationMs)
                .put("sizeBytes", imported.file.length())
                .put("matched", true),
        )

        val clientUploadId = UUID.nameUUIDFromBytes("system:$callId:${imported.sourceId}".toByteArray()).toString()
        val store = OfflineEventStore(applicationContext)
        if (store.allRecordings().none { it.clientUploadId == clientUploadId }) {
            store.enqueueRecording(
                QueuedRecording(
                    clientUploadId = clientUploadId,
                    callId = callId,
                    tenantId = null,
                    deviceId = SessionStore(applicationContext).installationId,
                    filePath = imported.file.absolutePath,
                    sizeBytes = imported.file.length(),
                    durationMs = imported.durationMs,
                    status = "LOCAL_PENDING",
                )
            )
        }
        RecordingUploadWorker.enqueue(applicationContext)
        return Result.success()
    }

    companion object {
        private const val UNIQUE_PREFIX = "gxclosers-system-recording-"
        private const val KEY_CALL_ID = "callId"
        private const val KEY_STARTED_AT = "startedAt"
        private const val KEY_ENDED_AT = "endedAt"
        private const val KEY_DURATION_SECONDS = "durationSeconds"
        private const val KEY_PHONE_NUMBER = "phoneNumber"
        private const val MAX_ATTEMPTS = 5

        fun enqueue(context: Context, callId: String, startedAt: Long, endedAt: Long, durationSeconds: Long, phoneNumber: String?) {
            val input = Data.Builder()
                .putString(KEY_CALL_ID, callId)
                .putLong(KEY_STARTED_AT, startedAt)
                .putLong(KEY_ENDED_AT, endedAt)
                .putLong(KEY_DURATION_SECONDS, durationSeconds)
                .putString(KEY_PHONE_NUMBER, phoneNumber)
                .build()
            val request = OneTimeWorkRequestBuilder<SystemRecordingImportWorker>()
                .setInputData(input)
                .setInitialDelay(2, TimeUnit.SECONDS)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 5, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_PREFIX + callId,
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
