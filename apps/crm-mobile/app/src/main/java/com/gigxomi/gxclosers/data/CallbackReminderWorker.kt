package com.gigxomi.gxclosers.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.gigxomi.gxclosers.call.LeadCallNotification
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.util.concurrent.TimeUnit

/**
 * Polls the tenant-scoped mobile bootstrap projection and raises a native
 * Android reminder five minutes before a web-scheduled callback. This keeps
 * callback reminders working even when the CRM screen is not open and does
 * not require exposing a shared Meta or workspace credential to the device.
 */
class CallbackReminderWorker(appContext: Context, workerParams: WorkerParameters) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val sessionStore = SessionStore(applicationContext)
        if (sessionStore.token.isNullOrBlank()) return Result.success()

        return try {
            val bootstrap = ApiClient(sessionStore).get("/sales/mobile/bootstrap")
            val now = Instant.now()
            val reminderStore = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val futureCallbacks = mutableListOf<Instant>()
            bootstrap.optJSONArray("leads")?.let { leads ->
                for (index in 0 until leads.length()) {
                    val lead = leads.optJSONObject(index) ?: continue
                    val callbackAtText = lead.optString("followUpAt", "").trim()
                    val callbackAt = runCatching { Instant.parse(callbackAtText) }.getOrNull() ?: continue
                    if (callbackAt.isAfter(now.plusSeconds(4 * 60))) {
                        futureCallbacks += callbackAt
                    }

                    val secondsUntil = Duration.between(now, callbackAt).seconds
                    if (secondsUntil in (-15 * 60)..(6 * 60)) {
                        val reminderKey = "${lead.optString("id")}|$callbackAtText"
                        if (!reminderStore.getBoolean(reminderKey, false)) {
                            LeadCallNotification.showCallback(
                                applicationContext,
                                leadId = lead.optString("id"),
                                leadName = lead.optString("customerName").ifBlank { "Lead" },
                                phone = lead.optString("customerPhone"),
                                callbackAt = callbackAtText,
                            )
                            reminderStore.edit().putBoolean(reminderKey, true).apply()
                        }
                    }
                }
            }
            scheduleNext(applicationContext, futureCallbacks.minOrNull())
            Result.success()
        } catch (_: SessionRevokedException) {
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val PERIODIC_NAME = "gxclosers-callback-reminders-periodic"
        private const val ONCE_NAME = "gxclosers-callback-reminders-next"
        private const val PREFS = "gxclosers_callback_reminders"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<CallbackReminderWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun scheduleNext(context: Context, callbackAt: Instant?) {
            val delayMs = callbackAt?.let { (it.minusSeconds(5 * 60).toEpochMilli() - System.currentTimeMillis()).coerceAtLeast(15_000L) } ?: 15 * 60_000L
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<CallbackReminderWorker>()
                .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(ONCE_NAME, ExistingWorkPolicy.REPLACE, request)
        }
    }
}
