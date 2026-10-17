package com.gigxomi.gxclosers.call

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.CallLog
import android.provider.ContactsContract
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import com.gigxomi.gxclosers.data.CrmRepository
import com.gigxomi.gxclosers.data.OfflineEventStore
import com.gigxomi.gxclosers.data.SessionStore
import org.json.JSONObject
import java.time.Instant

/**
 * Reconciles and synchronizes call log records from the Android system dialer
 * into AI Closer, ensuring all inbound, outbound, and missed calls appear
 * in the mobile call history even if they occurred while the app was closed.
 */
object CallLogSyncManager {
    private const val TAG = "GXCallLogSync"
    private const val PREFS = "gxclosers_call_log_sync"
    private const val KEY_LAST_SYNCED_DATE = "lastSyncedDate"
    private const val SHARE_AUTOMATION_FRESHNESS_MS = 3 * 60 * 1000L

    internal fun isFreshCompletedCallForShareAutomation(
        nowMillis: Long,
        endedAtMillis: Long,
        durationSeconds: Long,
    ): Boolean {
        val ageMillis = nowMillis - endedAtMillis
        return durationSeconds > 0L && ageMillis in 0L..SHARE_AUTOMATION_FRESHNESS_MS
    }

    internal fun callLogSyncCutoff(nowMillis: Long, lookbackDays: Int, lastSyncedDate: Long): Long {
        val boundedLookbackDays = lookbackDays.coerceIn(1, 30)
        // Self-healing lookback: always check recent call logs so missed/unprepared dialer calls
        // or recordings are never lost to a brittle watermark. Deduplication is handled by hasCallSession().
        return nowMillis - (boundedLookbackDays.toLong() * 24 * 60 * 60 * 1000L)
    }

    fun syncRecentCallLogs(context: Context, lookbackDays: Int = 14): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.d(TAG, "READ_CALL_LOG permission not granted; skipping call log sync")
            return 0
        }

        val session = SessionStore(context)
        if (session.token.isNullOrBlank() || !session.setupComplete) {
            return 0
        }

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val lastSynced = prefs.getLong(KEY_LAST_SYNCED_DATE, 0L)
        val cutoff = callLogSyncCutoff(now, lookbackDays, lastSynced)

        val resolver = context.contentResolver
        val baseProjection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.CACHED_NAME,
        )
        val cursor = runCatching {
            resolver.query(
                CallLog.Calls.CONTENT_URI,
                baseProjection + CallLog.Calls.PHONE_ACCOUNT_ID,
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(cutoff.toString()),
                "${CallLog.Calls.DATE} DESC",
            )
        }.recoverCatching {
            // OEM / Xiaomi / MIUI fallback where PHONE_ACCOUNT_ID is an invalid column
            resolver.query(
                CallLog.Calls.CONTENT_URI,
                baseProjection + arrayOf("subscription_id", "simid"),
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(cutoff.toString()),
                "${CallLog.Calls.DATE} DESC",
            )
        }.recoverCatching {
            resolver.query(
                CallLog.Calls.CONTENT_URI,
                baseProjection,
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(cutoff.toString()),
                "${CallLog.Calls.DATE} DESC",
            )
        }.getOrNull() ?: return 0

        val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "${Build.MANUFACTURER}-${Build.MODEL}"
        val repository = CrmRepository(context)
        val store = OfflineEventStore(context)
        var importedCount = 0
        var maxSeenDate = lastSynced
        var earliestFailedDate: Long? = null

        cursor.use {
            val idCol = it.getColumnIndex(CallLog.Calls._ID)
            val numCol = it.getColumnIndex(CallLog.Calls.NUMBER)
            val typeCol = it.getColumnIndex(CallLog.Calls.TYPE)
            val dateCol = it.getColumnIndex(CallLog.Calls.DATE)
            val durCol = it.getColumnIndex(CallLog.Calls.DURATION)
            val accCol = when {
                it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID) >= 0 -> it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)
                it.getColumnIndex("subscription_id") >= 0 -> it.getColumnIndex("subscription_id")
                it.getColumnIndex("simid") >= 0 -> it.getColumnIndex("simid")
                it.getColumnIndex("sim_id") >= 0 -> it.getColumnIndex("sim_id")
                it.getColumnIndex("sim_index") >= 0 -> it.getColumnIndex("sim_index")
                else -> -1
            }
            val nameCol = it.getColumnIndex(CallLog.Calls.CACHED_NAME)

            while (it.moveToNext()) {
                val id = if (idCol >= 0) it.getString(idCol).orEmpty() else ""
                val number = if (numCol >= 0) it.getString(numCol).orEmpty().trim() else ""
                if (number.isBlank()) continue

                val date = if (dateCol >= 0) it.getLong(dateCol) else 0L
                if (date > maxSeenDate) maxSeenDate = date

                val callLogKey = "call-log-$id"
                if (store.hasCallSession(callLogKey)) {
                    continue
                }

                val type = if (typeCol >= 0) it.getInt(typeCol) else CallLog.Calls.INCOMING_TYPE
                val duration = if (durCol >= 0) it.getLong(durCol).coerceAtLeast(0L) else 0L
                val accountId = if (accCol >= 0) it.getString(accCol) else null
                val cachedName = if (nameCol >= 0) it.getString(nameCol)?.takeIf(String::isNotBlank) else null

                val lead = CallManager.lookup(context, number)
                val isKnownLead = lead != null

                // Filter out calls only when reliably identified as a personal SIM
                if (!isKnownLead && CallManager.isPersonalSim(context, accountId)) {
                    continue
                }

                val direction = when (type) {
                    CallLog.Calls.INCOMING_TYPE, CallLog.Calls.MISSED_TYPE, CallLog.Calls.REJECTED_TYPE -> "INBOUND"
                    CallLog.Calls.OUTGOING_TYPE -> "OUTBOUND"
                    else -> "UNKNOWN"
                }
                val status = if (type == CallLog.Calls.MISSED_TYPE || duration == 0L) "MISSED" else "COMPLETED"
                val contactName = cachedName ?: lead?.name ?: lookupContactName(context, number)
                val endedAtMillis = date + (duration * 1000L)
                val startedAtIso = Instant.ofEpochMilli(date).toString()
                val endedAtIso = Instant.ofEpochMilli(endedAtMillis).toString()

                try {
                    val callId = repository.startUnmatchedCall(
                        leadId = lead?.id,
                        phone = number,
                        direction = direction,
                        deviceId = deviceId,
                        contactName = contactName,
                        simSubscriptionId = accountId,
                        callSessionId = callLogKey,
                        startedAt = startedAtIso,
                        endedAt = endedAtIso,
                        durationSeconds = duration,
                    )

                    val importedRec = if (status == "COMPLETED" && duration > 0L) {
                        SystemCallRecordingImporter.importLatest(
                            context = context,
                            callId = callId,
                            callStartedAt = date,
                            callEndedAt = endedAtMillis,
                            expectedDurationSeconds = duration,
                            phoneNumber = number,
                        )
                    } else null

                    val recStatus = if (importedRec != null) "LOCAL_PENDING" else "NONE"
                    if (importedRec != null) {
                        val sessionStore = SessionStore(context)
                        val uploadId = java.util.UUID.nameUUIDFromBytes("system:$callId:${importedRec.sourceId}".toByteArray()).toString()
                        store.supersedeRecordingWithSystem(
                            callId = callId,
                            systemUploadId = uploadId,
                            filePath = importedRec.file.absolutePath,
                            sizeBytes = importedRec.file.length(),
                            durationMs = importedRec.durationMs,
                            deviceId = sessionStore.installationId,
                        )
                        com.gigxomi.gxclosers.data.RecordingUploadWorker.enqueue(context)
                        Log.i(TAG, "Attached existing system recording for callId=$callId file=${importedRec.file.name}")
                    } else if (status == "COMPLETED" && duration > 0L) {
                        com.gigxomi.gxclosers.data.SystemRecordingImportWorker.enqueue(
                            context, callId, date, endedAtMillis, duration, number
                        )
                    }

                    val payload = JSONObject()
                        .put("callSessionId", callId)
                        .put("status", status)
                        .put("direction", direction)
                        .put("phoneNumber", number)
                        .put("contactName", contactName ?: JSONObject.NULL)
                        .put("startedAt", startedAtIso)
                        .put("endedAt", endedAtIso)
                        .put("durationSeconds", duration)
                        .put("recordingStatus", recStatus)

                    store.enqueue("call-log-end-$id", "CALL_END", payload, callId)
                    // PhoneStateReceiver can miss a transient broadcast (for example after
                    // process death). The call-log reconciliation path is the recovery path:
                    // arm only a just-ended, completed Google Phone call, never backfill.
                    val shouldAutomateShare =
                        direction != "UNKNOWN" && status == "COMPLETED" &&
                            DialerShareAutomation.isGoogleDialer(context) &&
                            DialerShareAutomation.isReady(context) &&
                            isFreshCompletedCallForShareAutomation(now, endedAtMillis, duration)
                    if (shouldAutomateShare) {
                        val armed = DialerShareAutomation.arm(
                            context = context,
                            callId = callId,
                            phone = number,
                            callEndedAt = endedAtMillis,
                            expectedDurationMs = duration * 1000L,
                            contactName = contactName,
                            direction = direction,
                        )
                        Log.i(TAG, "Recent call-log recovery share arm: callLogId=$id armed=$armed ageMs=${now - endedAtMillis}")
                    }
                    importedCount++
                } catch (e: Exception) {
                    earliestFailedDate = earliestFailedDate?.let { minOf(it, date) } ?: date
                    Log.w(TAG, "Failed to import call log row id=$id phone=$number", e)
                }
            }
        }

        val safeWatermark = earliestFailedDate?.let { minOf(maxSeenDate, it) } ?: maxSeenDate
        if (safeWatermark != lastSynced) {
            prefs.edit().putLong(KEY_LAST_SYNCED_DATE, safeWatermark).apply()
        }

        if (importedCount > 0) {
            Log.i(TAG, "Imported $importedCount recent dialer calls into AI Closer")
            runCatching { repository.syncOffline() }
        }

        return importedCount
    }

    private fun lookupContactName(context: Context, phone: String): String? {
        val resolver = context.contentResolver
        return runCatching {
            val uri = android.net.Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                android.net.Uri.encode(phone)
            )
            resolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null,
                null,
                null
            )?.use { c ->
                if (c.moveToFirst()) c.getString(0)?.takeIf(String::isNotBlank) else null
            }
        }.getOrNull()
    }
}
