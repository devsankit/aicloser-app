package com.gigxomi.gxclosers.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

data class OfflineEvent(val id: String, val type: String, val payload: String)
data class QueuedRecording(val clientUploadId: String, val callId: String, val path: String, val size: Long, val durationMs: Long)

class OfflineEventStore(context: Context) : SQLiteOpenHelper(context, "gxclosers-offline.db", null, 2) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE offline_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0)")
        db.execSQL("CREATE TABLE recording_queue (client_upload_id TEXT PRIMARY KEY, call_id TEXT NOT NULL, path TEXT NOT NULL, size_bytes INTEGER NOT NULL, duration_ms INTEGER NOT NULL, created_at INTEGER NOT NULL)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) db.execSQL("CREATE TABLE IF NOT EXISTS recording_queue (client_upload_id TEXT PRIMARY KEY, call_id TEXT NOT NULL, path TEXT NOT NULL, size_bytes INTEGER NOT NULL, duration_ms INTEGER NOT NULL, created_at INTEGER NOT NULL)")
    }
    fun enqueue(id: String, type: String, payload: JSONObject) {
        writableDatabase.insertWithOnConflict("offline_events", null, ContentValues().apply { put("id", id); put("type", type); put("payload", payload.toString()); put("created_at", System.currentTimeMillis()); put("synced", 0) }, SQLiteDatabase.CONFLICT_IGNORE)
    }
    fun pending(): List<OfflineEvent> = readableDatabase.query("offline_events", arrayOf("id", "type", "payload"), "synced=0", null, null, null, "created_at ASC").use { cursor ->
        buildList { while (cursor.moveToNext()) add(OfflineEvent(cursor.getString(0), cursor.getString(1), cursor.getString(2))) }
    }
    fun markSynced(id: String) { writableDatabase.update("offline_events", ContentValues().apply { put("synced", 1) }, "id=?", arrayOf(id)) }
    fun enqueueRecording(recording: QueuedRecording) {
        writableDatabase.insertWithOnConflict("recording_queue", null, ContentValues().apply {
            put("client_upload_id", recording.clientUploadId); put("call_id", recording.callId); put("path", recording.path)
            put("size_bytes", recording.size); put("duration_ms", recording.durationMs); put("created_at", System.currentTimeMillis())
        }, SQLiteDatabase.CONFLICT_IGNORE)
    }
    fun pendingRecordings(): List<QueuedRecording> = readableDatabase.query("recording_queue", arrayOf("client_upload_id", "call_id", "path", "size_bytes", "duration_ms"), null, null, null, null, "created_at ASC").use { cursor ->
        buildList { while (cursor.moveToNext()) add(QueuedRecording(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getLong(3), cursor.getLong(4))) }
    }
    fun removeRecording(clientUploadId: String) { writableDatabase.delete("recording_queue", "client_upload_id=?", arrayOf(clientUploadId)) }
    fun clear() { writableDatabase.delete("offline_events", null, null); writableDatabase.delete("recording_queue", null, null) }
}
