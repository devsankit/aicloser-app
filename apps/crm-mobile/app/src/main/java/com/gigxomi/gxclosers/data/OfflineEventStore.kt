package com.gigxomi.gxclosers.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject
import java.io.File

data class OfflineEventRecord(
    val id: String,
    val type: String,
    val entityId: String?,
    val payload: String,
    val createdAt: Long,
    val retryCount: Int,
    val syncStatus: String,
    val errorMessage: String?,
)

data class QueuedRecording(
    val clientUploadId: String,
    val callId: String,
    val tenantId: String?,
    val deviceId: String?,
    val filePath: String,
    val sizeBytes: Long,
    val durationMs: Long,
    val retryCount: Int = 0,
    val status: String = "LOCAL_PENDING",
    val errorMessage: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

data class ManualRecordingCallMatch(
    val callId: String,
    val phoneNumber: String?,
    val callAtMillis: Long,
)

data class CrmCallCandidate(
    val callId: String,
    val phoneNumber: String,
    val callAtMillis: Long,
    val durationSeconds: Long,
)

data class LocalCallRecord(
    val callId: String,
    val phoneNumber: String,
    val contactName: String?,
    val direction: String,
    val status: String,
    val durationSeconds: Int,
    val startedAt: String,
    val endedAt: String?,
    val recordingStatus: String,
)

data class SyncCounts(
    val pending: Int,
    val syncing: Int,
    val synced: Int,
    val failed: Int,
)

class OfflineEventStore private constructor(context: Context) : SQLiteOpenHelper(context.applicationContext, "gxclosers-offline.db", null, 4) {
    companion object {
        @Volatile private var instance: OfflineEventStore? = null

        operator fun invoke(context: Context): OfflineEventStore =
            instance ?: synchronized(this) {
                instance ?: OfflineEventStore(context.applicationContext).also { instance = it }
            }

        fun getInstance(context: Context): OfflineEventStore = invoke(context)
    }
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE offline_events (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                entity_id TEXT,
                payload TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                sync_status TEXT NOT NULL DEFAULT 'PENDING',
                error_message TEXT
            )"""
        )
        db.execSQL(
            """CREATE TABLE recording_queue (
                client_upload_id TEXT PRIMARY KEY,
                call_id TEXT NOT NULL,
                tenant_id TEXT,
                device_id TEXT,
                file_path TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                duration_ms INTEGER NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'LOCAL_PENDING',
                error_message TEXT,
                created_at INTEGER NOT NULL
            )"""
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Never drop the offline queue during an app upgrade. A recording can be
        // the only copy of a call until the server confirms the upload.
        if (oldVersion < 3) {
            db.execSQL(
                """CREATE TABLE IF NOT EXISTS offline_events (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    entity_id TEXT,
                    payload TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    sync_status TEXT NOT NULL DEFAULT 'PENDING',
                    error_message TEXT
                )"""
            )
            db.execSQL(
                """CREATE TABLE IF NOT EXISTS recording_queue (
                    client_upload_id TEXT PRIMARY KEY,
                    call_id TEXT NOT NULL,
                    tenant_id TEXT,
                    device_id TEXT,
                    file_path TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'LOCAL_PENDING',
                    error_message TEXT,
                    created_at INTEGER NOT NULL
                )"""
            )
        }
    }

    fun enqueue(id: String, type: String, payload: JSONObject, entityId: String? = null) {
        val values = ContentValues().apply {
            put("id", id)
            put("type", type)
            put("entity_id", entityId)
            put("payload", payload.toString())
            put("created_at", System.currentTimeMillis())
            put("retry_count", 0)
            put("sync_status", "PENDING")
            putNull("error_message")
        }
        writableDatabase.insertWithOnConflict("offline_events", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    fun hasEvent(id: String): Boolean = readableDatabase.query(
        "offline_events",
        arrayOf("id"),
        "id = ?",
        arrayOf(id),
        null,
        null,
        null
    ).use { it.moveToFirst() }

    fun hasCallSession(callSessionId: String): Boolean = readableDatabase.query(
        "offline_events",
        arrayOf("id"),
        "id = ? OR entity_id = ? OR id = ? OR entity_id = ?",
        arrayOf(
            callSessionId,
            callSessionId,
            "call-log-end-${callSessionId.removePrefix("call-log-")}",
            "call-end-$callSessionId"
        ),
        null,
        null,
        null
    ).use { it.moveToFirst() }

    fun pendingEvents(maxRetries: Int = 5): List<OfflineEventRecord> = readableDatabase.query(
        "offline_events",
        arrayOf("id", "type", "entity_id", "payload", "created_at", "retry_count", "sync_status", "error_message"),
        "sync_status = 'PENDING' OR (sync_status = 'FAILED' AND retry_count < ?)",
        arrayOf(maxRetries.toString()),
        null,
        null,
        "created_at ASC"
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(
                    OfflineEventRecord(
                        id = cursor.getString(0),
                        type = cursor.getString(1),
                        entityId = cursor.getString(2),
                        payload = cursor.getString(3),
                        createdAt = cursor.getLong(4),
                        retryCount = cursor.getInt(5),
                        syncStatus = cursor.getString(6),
                        errorMessage = cursor.getString(7),
                    )
                )
            }
        }
    }

    fun markEventSyncing(ids: List<String>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            val values = ContentValues().apply { put("sync_status", "SYNCING") }
            for (id in ids) {
                db.update("offline_events", values, "id = ?", arrayOf(id))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun markEventSynced(id: String) {
        val values = ContentValues().apply {
            put("sync_status", "SYNCED")
            putNull("error_message")
        }
        writableDatabase.update("offline_events", values, "id = ?", arrayOf(id))
    }

    fun markEventFailed(id: String, errorMessage: String) {
        val db = writableDatabase
        val cursor = db.rawQuery("SELECT retry_count FROM offline_events WHERE id = ?", arrayOf(id))
        val currentRetries = cursor.use { if (it.moveToFirst()) it.getInt(0) else 0 }
        val newRetries = currentRetries + 1
        val isPermanent = errorMessage.contains("Call session not found", ignoreCase = true) ||
            errorMessage.contains("Unsupported offline event type", ignoreCase = true) ||
            newRetries >= 5
        val values = ContentValues().apply {
            put("sync_status", if (isPermanent) "FAILED_PERMANENT" else "FAILED")
            put("retry_count", newRetries)
            put("error_message", errorMessage)
        }
        db.update("offline_events", values, "id = ?", arrayOf(id))
    }

    fun recoverPermanentFailure(id: String) {
        val values = ContentValues().apply {
            put("sync_status", "SYNCED")
            putNull("error_message")
        }
        writableDatabase.update("offline_events", values, "id = ?", arrayOf(id))
    }

    fun getSyncCounts(): SyncCounts {
        val db = readableDatabase
        var pending = 0
        var syncing = 0
        var synced = 0
        var failed = 0
        db.rawQuery("SELECT sync_status, COUNT(*) FROM offline_events WHERE retry_count < 5 GROUP BY sync_status", null).use { cursor ->
            while (cursor.moveToNext()) {
                val status = cursor.getString(0)
                val count = cursor.getInt(1)
                when (status) {
                    "PENDING" -> pending += count
                    "SYNCING" -> syncing += count
                    "SYNCED" -> synced += count
                    "FAILED" -> failed += count
                }
            }
        }
        db.rawQuery("SELECT status, COUNT(*) FROM recording_queue WHERE retry_count < 5 GROUP BY status", null).use { cursor ->
            while (cursor.moveToNext()) {
                val status = cursor.getString(0)
                val count = cursor.getInt(1)
                when (status) {
                    "LOCAL_PENDING", "RECORDING" -> pending += count
                    "UPLOADING" -> syncing += count
                    "UPLOADED" -> synced += count
                    "FAILED" -> failed += count
                }
            }
        }
        return SyncCounts(pending, syncing, synced, failed)
    }

    fun enqueueRecording(recording: QueuedRecording) {
        val values = ContentValues().apply {
            put("client_upload_id", recording.clientUploadId)
            put("call_id", recording.callId)
            put("tenant_id", recording.tenantId)
            put("device_id", recording.deviceId)
            put("file_path", recording.filePath)
            put("size_bytes", recording.sizeBytes)
            put("duration_ms", recording.durationMs)
            put("retry_count", recording.retryCount)
            put("status", recording.status)
            put("error_message", recording.errorMessage)
            put("created_at", recording.createdAt)
        }
        writableDatabase.insertWithOnConflict("recording_queue", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    fun finalizeRecording(clientUploadId: String, sizeBytes: Long, durationMs: Long, status: String = "LOCAL_PENDING") {
        val values = ContentValues().apply {
            put("size_bytes", sizeBytes)
            put("duration_ms", durationMs)
            put("status", status)
            putNull("error_message")
        }
        writableDatabase.update("recording_queue", values, "client_upload_id = ?", arrayOf(clientUploadId))
    }

    fun supersedeRecordingWithSystem(
        callId: String,
        systemUploadId: String,
        filePath: String,
        sizeBytes: Long,
        durationMs: Long,
        deviceId: String,
    ) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val cursor = readableDatabase.query(
                "recording_queue",
                arrayOf("client_upload_id", "file_path"),
                "call_id = ?",
                arrayOf(callId),
                null,
                null,
                null
            )
            val filesToDelete = mutableListOf<File>()
            val idsToDelete = mutableListOf<String>()
            cursor.use {
                while (it.moveToNext()) {
                    val uploadId = it.getString(0)
                    val path = it.getString(1)
                    if (uploadId != systemUploadId) {
                        idsToDelete.add(uploadId)
                        if (!path.isNullOrBlank()) filesToDelete.add(File(path))
                    }
                }
            }
            for (id in idsToDelete) {
                db.delete("recording_queue", "client_upload_id = ?", arrayOf(id))
            }
            for (file in filesToDelete) {
                runCatching { if (file.exists()) file.delete() }
            }

            val values = ContentValues().apply {
                put("client_upload_id", systemUploadId)
                put("call_id", callId)
                putNull("tenant_id")
                put("device_id", deviceId)
                put("file_path", filePath)
                put("size_bytes", sizeBytes)
                put("duration_ms", durationMs)
                put("retry_count", 0)
                put("status", "LOCAL_PENDING")
                putNull("error_message")
                put("created_at", System.currentTimeMillis())
            }
            db.insertWithOnConflict("recording_queue", null, values, SQLiteDatabase.CONFLICT_REPLACE)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun rebindRecordingCall(clientUploadId: String, callId: String) {
        val values = ContentValues().apply { put("call_id", callId) }
        writableDatabase.update("recording_queue", values, "client_upload_id = ?", arrayOf(clientUploadId))
    }

    fun updateRecordingStatus(clientUploadId: String, status: String, errorMessage: String? = null) {
        val values = ContentValues().apply {
            put("status", status)
            if (errorMessage != null) put("error_message", errorMessage) else putNull("error_message")
        }
        writableDatabase.update("recording_queue", values, "client_upload_id = ?", arrayOf(clientUploadId))
    }

    fun incrementRecordingRetry(clientUploadId: String, errorMessage: String) {
        val db = writableDatabase
        val cursor = db.rawQuery("SELECT retry_count FROM recording_queue WHERE client_upload_id = ?", arrayOf(clientUploadId))
        val currentRetries = cursor.use { if (it.moveToFirst()) it.getInt(0) else 0 }
        val values = ContentValues().apply {
            put("status", "FAILED")
            put("retry_count", currentRetries + 1)
            put("error_message", errorMessage)
        }
        db.update("recording_queue", values, "client_upload_id = ?", arrayOf(clientUploadId))
    }

    fun pendingRecordings(): List<QueuedRecording> = readableDatabase.query(
        "recording_queue",
        arrayOf("client_upload_id", "call_id", "tenant_id", "device_id", "file_path", "size_bytes", "duration_ms", "retry_count", "status", "error_message", "created_at"),
        "status IN ('LOCAL_PENDING', 'FAILED', 'RECORDING', 'HOLD_FOR_SYSTEM')",
        null,
        null,
        null,
        "created_at ASC"
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(
                    QueuedRecording(
                        clientUploadId = cursor.getString(0),
                        callId = cursor.getString(1),
                        tenantId = cursor.getString(2),
                        deviceId = cursor.getString(3),
                        filePath = cursor.getString(4),
                        sizeBytes = cursor.getLong(5),
                        durationMs = cursor.getLong(6),
                        retryCount = cursor.getInt(7),
                        status = cursor.getString(8),
                        errorMessage = cursor.getString(9),
                        createdAt = cursor.getLong(10),
                    )
                )
            }
        }
    }

    fun allRecordings(): List<QueuedRecording> = readableDatabase.query(
        "recording_queue",
        arrayOf("client_upload_id", "call_id", "tenant_id", "device_id", "file_path", "size_bytes", "duration_ms", "retry_count", "status", "error_message", "created_at"),
        null,
        null,
        null,
        null,
        "created_at DESC"
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(
                    QueuedRecording(
                        clientUploadId = cursor.getString(0),
                        callId = cursor.getString(1),
                        tenantId = cursor.getString(2),
                        deviceId = cursor.getString(3),
                        filePath = cursor.getString(4),
                        sizeBytes = cursor.getLong(5),
                        durationMs = cursor.getLong(6),
                        retryCount = cursor.getInt(7),
                        status = cursor.getString(8),
                        errorMessage = cursor.getString(9),
                        createdAt = cursor.getLong(10),
                    )
                )
            }
        }
    }

    fun recordingForCall(callId: String): QueuedRecording? {
        val matches = allRecordings().filter { it.callId == callId }
        return matches.find { it.status == "UPLOADED" }
            ?: matches.find { it.status == "UPLOADING" }
            ?: matches.find { it.status == "LOCAL_PENDING" }
            ?: matches.firstOrNull()
    }

    fun hasPendingRecordingForCall(callId: String): Boolean = runCatching {
        readableDatabase.query(
            "recording_queue",
            arrayOf("client_upload_id"),
            "call_id = ? AND status IN ('LOCAL_PENDING', 'RECORDING', 'UPLOADING')",
            arrayOf(callId),
            null,
            null,
            null
        ).use { it.moveToFirst() }
    }.getOrDefault(false)

    fun recentLocalCalls(sinceMillis: Long = System.currentTimeMillis() - 14L * 24L * 60L * 60L * 1000L): List<LocalCallRecord> =
        readableDatabase.query(
            "offline_events",
            arrayOf("entity_id", "payload", "created_at"),
            "type = ? AND entity_id IS NOT NULL",
            arrayOf("CALL_END"),
            null,
            null,
            "created_at DESC"
        ).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val callId = cursor.getString(0).orEmpty().takeIf(String::isNotBlank) ?: continue
                    val payload = runCatching { org.json.JSONObject(cursor.getString(1)) }.getOrNull() ?: continue
                    val phone = payload.optString("phoneNumber").trim().takeIf(String::isNotBlank) ?: continue
                    val contactName = payload.optString("contactName").takeIf { it.isNotBlank() && it != "null" }
                    val direction = payload.optString("direction").ifBlank { "UNKNOWN" }
                    val status = payload.optString("status").ifBlank { "COMPLETED" }
                    val isUnverified = payload.optBoolean("unverified", false) || status == "UNVERIFIED"

                    // Do not display unverified calls or calls with missing/unknown direction as completed calls
                    if (isUnverified || (direction == "UNKNOWN" && status == "COMPLETED")) {
                        continue
                    }

                    val durationSec = payload.optInt("durationSeconds", 0)
                    val endedAtIso = payload.optString("endedAt").takeIf(String::isNotBlank)
                    val endedAtMillis = endedAtIso?.toInstantMillis() ?: cursor.getLong(2)
                    val startedAtIso = payload.optString("startedAt").takeIf(String::isNotBlank)
                        ?: payload.optString("connectedAt").takeIf(String::isNotBlank)
                        ?: java.time.Instant.ofEpochMilli(endedAtMillis - durationSec * 1000L).toString()
                    val startedAtMillis = startedAtIso.toInstantMillis() ?: (endedAtMillis - durationSec * 1000L)
                    if (startedAtMillis < sinceMillis && endedAtMillis < sinceMillis) continue

                    val rawRecordingStatus = payload.optString("recordingStatus").ifBlank { "NONE" }
                    val recordingStatus = if (rawRecordingStatus == "LOCAL_PENDING") {
                        val hasQueueItem = hasPendingRecordingForCall(callId)
                        if (hasQueueItem) "LOCAL_PENDING" else "NONE"
                    } else rawRecordingStatus

                    add(
                        LocalCallRecord(
                            callId = callId,
                            phoneNumber = phone,
                            contactName = contactName,
                            direction = direction,
                            status = status,
                            durationSeconds = durationSec,
                            startedAt = startedAtIso,
                            endedAt = endedAtIso,
                            recordingStatus = recordingStatus,
                        )
                    )
                }
            }
        }

    fun recentCrmCallCandidates(sinceMillis: Long = System.currentTimeMillis() - 24L * 60L * 60L * 1000L): List<CrmCallCandidate> =
        readableDatabase.query(
            "offline_events",
            arrayOf("entity_id", "payload", "created_at"),
            "type = ? AND entity_id IS NOT NULL",
            arrayOf("CALL_END"),
            null,
            null,
            "created_at DESC"
        ).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val callId = cursor.getString(0).orEmpty()
                    val payload = runCatching { org.json.JSONObject(cursor.getString(1)) }.getOrNull() ?: continue
                    val phone = payload.optString("phoneNumber")
                    val durationSec = payload.optLong("durationSeconds", 0L)
                    val endedAt = payload.optString("endedAt").toInstantMillis() ?: cursor.getLong(2)
                    val startedAt = payload.optString("connectedAt").toInstantMillis()
                        ?: (endedAt - durationSec * 1000L)
                    if (startedAt < sinceMillis && endedAt < sinceMillis) continue
                    add(CrmCallCandidate(callId, phone, startedAt, durationSec))
                }
            }
        }

    /**
     * Finds the completed CRM call represented by a recording shared manually
     * from the Phone app. The native share intent does not carry the call ID,
     * so match the newest local CALL_END event by normalized phone, end time,
     * and duration before falling back to the time window alone.
     */
    fun findBestCallForManualRecording(
        phoneNumber: String?,
        callAtMillis: Long,
        durationMs: Long,
    ): ManualRecordingCallMatch? {
        val requestedPhone = normalizePhone(phoneNumber)
        val candidates = readableDatabase.query(
            "offline_events",
            arrayOf("entity_id", "payload", "created_at"),
            "type = ? AND entity_id IS NOT NULL",
            arrayOf("CALL_END"),
            null,
            null,
            "created_at DESC",
        ).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val callId = cursor.getString(0).orEmpty()
                    val payload = runCatching { JSONObject(cursor.getString(1)) }.getOrNull() ?: continue
                    val eventPhone = normalizePhone(payload.optString("phoneNumber"))
                    if (requestedPhone.isNotBlank() && eventPhone.isNotBlank() && requestedPhone != eventPhone) continue
                    val endedAt = payload.optString("endedAt").toInstantMillis() ?: cursor.getLong(2)
                    val durationSec = payload.optLong("durationSeconds", 0L)
                    val startedAt = payload.optString("connectedAt").toInstantMillis()
                        ?: (endedAt - durationSec * 1000L)
                    val timeDiff = minOf(
                        kotlin.math.abs(startedAt - callAtMillis),
                        kotlin.math.abs(endedAt - callAtMillis)
                    )
                    if (timeDiff > 5000L) continue // Reject calls > 5 seconds away (prevents sequential call cross-linking)
                    val eventDurationMs = payload.optLong("durationSeconds", 0L) * 1000L
                    val durationDiff = if (durationMs > 0L && eventDurationMs > 0L) kotlin.math.abs(eventDurationMs - durationMs) else 0L
                    if (durationMs > 0L && eventDurationMs > 0L && durationDiff > 60_000L) continue // Reject duration mismatch > 60s
                    var score = 0L
                    if (requestedPhone.isNotBlank() && requestedPhone == eventPhone) score += 200L
                    score += (60L - (timeDiff / 60_000L).coerceAtMost(60L))
                    if (durationDiff <= 10_000L) score += 50L else if (durationDiff <= 30_000L) score += 20L
                    add(ScoredManualCall(ManualRecordingCallMatch(callId, eventPhone.ifBlank { null }, endedAt), score))
                }
            }
        }
        val best = candidates.filter { it.score >= 200L }.maxByOrNull { it.score } ?: return null
        return best.match.takeIf { kotlin.math.abs(it.callAtMillis - callAtMillis) <= 15 * 60 * 1000L }
    }

    private data class ScoredManualCall(val match: ManualRecordingCallMatch, val score: Long)

    private fun normalizePhone(value: String?): String = value.orEmpty().filter(Char::isDigit).takeLast(10)

    private fun String.toInstantMillis(): Long? = takeIf(String::isNotBlank)
        ?.let { runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull() }

    fun markRecordingUploaded(clientUploadId: String) {
        val values = ContentValues().apply {
            put("status", "UPLOADED")
            putNull("error_message")
        }
        writableDatabase.update("recording_queue", values, "client_upload_id = ?", arrayOf(clientUploadId))
    }

    fun removeRecording(clientUploadId: String) {
        writableDatabase.delete("recording_queue", "client_upload_id = ?", arrayOf(clientUploadId))
    }

    /**
     * Reconciles the app-private audio directory after a process death or an
     * interrupted upgrade. The local file is the source of truth until upload
     * is acknowledged by the API, so an orphan must be re-added to the queue.
     */
    fun reconcileRecordingFiles(directory: File, activeCallId: String? = null): Int {
        if (!directory.exists()) return 0
        val existing = allRecordings()
        val knownPaths = existing.mapTo(mutableSetOf()) { it.filePath }
        val db = writableDatabase
        var recovered = 0
        db.beginTransaction()
        try {
            // Archive permanently failed offline events and recordings so they do not loop forever
            runCatching {
                db.execSQL("UPDATE offline_events SET sync_status = 'FAILED_PERMANENT' WHERE retry_count >= 5 AND sync_status = 'FAILED'")
                db.execSQL("UPDATE recording_queue SET status = 'FAILED_PERMANENT' WHERE retry_count >= 5 AND status = 'FAILED'")
            }
            // If an app was killed while mic recording was held for system import, release it after 2 minutes
            val staleHoldCutoff = System.currentTimeMillis() - (2 * 60 * 1000L)
            existing.filter { it.status == "HOLD_FOR_SYSTEM" && it.createdAt < staleHoldCutoff }.forEach { item ->
                val values = ContentValues().apply { put("status", "LOCAL_PENDING") }
                db.update("recording_queue", values, "client_upload_id = ?", arrayOf(item.clientUploadId))
            }

            existing.filter { (it.status == "RECORDING" || it.status == "UPLOADING") && it.callId != activeCallId }.forEach { item ->
                val file = File(item.filePath)
                if (file.exists() && file.length() > 0L) {
                    val values = ContentValues().apply {
                        put("size_bytes", file.length())
                        put("status", "LOCAL_PENDING")
                        putNull("error_message")
                    }
                    db.update("recording_queue", values, "client_upload_id = ?", arrayOf(item.clientUploadId))
                    recovered++
                } else {
                    val values = ContentValues().apply {
                        put("status", "FAILED")
                        put("error_message", "Audio file was lost before upload.")
                    }
                    db.update("recording_queue", values, "client_upload_id = ?", arrayOf(item.clientUploadId))
                }
            }

            val audioExtensions = setOf("m4a", "mp3", "wav", "aac", "3gp", "amr", "ogg", "opus")
            directory.listFiles()
                ?.filter { it.isFile && it.extension.lowercase() in audioExtensions && it.length() > 0L }
                ?.filterNot { knownPaths.contains(it.absolutePath) }
                ?.forEach { file ->
                    val callId = when {
                        file.nameWithoutExtension.startsWith("shared-") -> {
                            file.nameWithoutExtension.removePrefix("shared-").substringBeforeLast("-")
                        }
                        file.nameWithoutExtension.contains("-system-") -> file.nameWithoutExtension.substringBefore("-system-")
                        file.nameWithoutExtension.contains("-shared-") -> file.nameWithoutExtension.substringBefore("-shared-")
                        file.nameWithoutExtension.contains("-") -> file.nameWithoutExtension.substringBeforeLast("-")
                        else -> ""
                    }.removePrefix("shared-")
                    if (callId.isBlank()) return@forEach
                    val uploadId = "recovered-${file.nameWithoutExtension}"
                    val values = ContentValues().apply {
                        put("client_upload_id", uploadId)
                        put("call_id", callId)
                        putNull("tenant_id")
                        putNull("device_id")
                        put("file_path", file.absolutePath)
                        put("size_bytes", file.length())
                        put("duration_ms", 0L)
                        put("retry_count", 0)
                        put("status", "LOCAL_PENDING")
                        putNull("error_message")
                        put("created_at", file.lastModified().takeIf { it > 0L } ?: System.currentTimeMillis())
                    }
                    if (db.insertWithOnConflict("recording_queue", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L) recovered++
                }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        return recovered
    }

    fun deleteRecordingByCallId(callId: String): Int {
        if (callId.isBlank()) return 0
        val cursor = readableDatabase.query(
            "recording_queue",
            arrayOf("file_path"),
            "call_id = ?",
            arrayOf(callId),
            null,
            null,
            null
        )
        val files = cursor.use {
            buildList {
                while (it.moveToNext()) {
                    it.getString(0)?.let { path -> add(java.io.File(path)) }
                }
            }
        }
        files.forEach { file -> runCatching { if (file.exists()) file.delete() } }
        val db = writableDatabase
        val deleted = db.delete("recording_queue", "call_id = ?", arrayOf(callId))
        db.delete("offline_events", "entity_id = ?", arrayOf(callId))
        return deleted
    }

    fun clear() {
        writableDatabase.delete("offline_events", null, null)
        writableDatabase.delete("recording_queue", null, null)
    }
}
