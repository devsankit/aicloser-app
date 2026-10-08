package com.gigxomi.gxclosers.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

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

data class SyncCounts(
    val pending: Int,
    val syncing: Int,
    val synced: Int,
    val failed: Int,
)

class OfflineEventStore(context: Context) : SQLiteOpenHelper(context, "gxclosers-offline.db", null, 3) {
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
        if (oldVersion < 3) {
            db.execSQL("DROP TABLE IF EXISTS offline_events")
            db.execSQL("DROP TABLE IF EXISTS recording_queue")
            onCreate(db)
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

    fun pendingEvents(): List<OfflineEventRecord> = readableDatabase.query(
        "offline_events",
        arrayOf("id", "type", "entity_id", "payload", "created_at", "retry_count", "sync_status", "error_message"),
        "sync_status IN ('PENDING', 'FAILED')",
        null,
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
        val values = ContentValues().apply {
            put("sync_status", "FAILED")
            put("retry_count", currentRetries + 1)
            put("error_message", errorMessage)
        }
        db.update("offline_events", values, "id = ?", arrayOf(id))
    }

    fun getSyncCounts(): SyncCounts {
        val db = readableDatabase
        var pending = 0
        var syncing = 0
        var synced = 0
        var failed = 0
        db.rawQuery("SELECT sync_status, COUNT(*) FROM offline_events GROUP BY sync_status", null).use { cursor ->
            while (cursor.moveToNext()) {
                val status = cursor.getString(0)
                val count = cursor.getInt(1)
                when (status) {
                    "PENDING" -> pending = count
                    "SYNCING" -> syncing = count
                    "SYNCED" -> synced = count
                    "FAILED" -> failed = count
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
        "status IN ('LOCAL_PENDING', 'FAILED')",
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

    fun clear() {
        writableDatabase.delete("offline_events", null, null)
        writableDatabase.delete("recording_queue", null, null)
    }
}
