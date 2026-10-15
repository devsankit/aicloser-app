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
            callId,
            startedAt,
            endedAt,
            durationSeconds,
            phoneNumber,
        ) ?: run {
            val isFinalAttempt = runAttemptCount >= MAX_ATTEMPTS
            DeviceDiagnostics.record(
                applicationContext,
                kind = if (!isFinalAttempt) "RECORDING_SOURCE_WAITING" else "RECORDING_SOURCE_MISSING",
                callId = callId,
                fields = org.json.JSONObject()
                    .put("stage", "IMPORT")
                    .put("retryCount", runAttemptCount)
                    .put("expectedDurationMs", durationSeconds * 1000L),
            )
            if (isFinalAttempt) {
                val store = OfflineEventStore(applicationContext)
                // If a microphone fallback was held for this call, release it now since system audio was not found
                val fallbackMic = store.pendingRecordings().firstOrNull { it.callId == callId && it.status == "HOLD_FOR_SYSTEM" }
                if (fallbackMic != null) {
                    store.updateRecordingStatus(fallbackMic.clientUploadId, "LOCAL_PENDING")
                    RecordingUploadWorker.enqueue(applicationContext)
                    return Result.success()
                }

                val existingRec = store.recordingForCall(callId)
                if (existingRec == null || existingRec.status == "FAILED" || existingRec.status == "FAILED_PERMANENT") {
                    store.enqueue(
                        id = "system-import-timeout-$callId",
                        type = "CALL_END",
                        payload = org.json.JSONObject()
                            .put("callSessionId", callId)
                            .put("status", "COMPLETED")
                            .put("recordingStatus", "RECORDING_UNAVAILABLE")
                            .put("recordingError", "System recording was not found. Open the call in Phone, tap Share recording, and choose AI Closer."),
                        entityId = callId,
                    )
                    CrmRepository(applicationContext).syncOffline()
                }
                return Result.success()
            }
            return Result.retry()
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
        val sessionStore = SessionStore(applicationContext)
        // Cleanly supersede any 1-way mic fallback recording with the 2-way system recording
        store.supersedeRecordingWithSystem(
            callId = callId,
            systemUploadId = clientUploadId,
            filePath = imported.file.absolutePath,
            sizeBytes = imported.file.length(),
            durationMs = imported.durationMs,
            deviceId = sessionStore.installationId,
        )
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
        private const val MAX_ATTEMPTS = 8

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
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }
    }
}
