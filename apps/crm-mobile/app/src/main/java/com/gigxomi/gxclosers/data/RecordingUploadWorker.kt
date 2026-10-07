package com.gigxomi.gxclosers.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class RecordingUploadWorker(appContext: Context, workerParams: androidx.work.WorkerParameters) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val repository = CrmRepository(applicationContext)
        if (repository.sessionStore.token.isNullOrBlank()) return Result.success()
        return runCatching {
            while (repository.uploadPendingRecording()) Unit
            Result.success()
        }.getOrElse { Result.retry() }
    }

    companion object {
        private const val UNIQUE_NAME = "gxclosers-recording-upload"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<RecordingUploadWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
