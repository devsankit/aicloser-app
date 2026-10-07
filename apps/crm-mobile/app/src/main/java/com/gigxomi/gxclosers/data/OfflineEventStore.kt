package com.gigxomi.gxclosers.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

data class OfflineEvent(val id: String, val type: String, val payload: String)

class OfflineEventStore(context: Context) : SQLiteOpenHelper(context, "gxclosers-offline.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE offline_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    fun enqueue(id: String, type: String, payload: JSONObject) {
        writableDatabase.insertWithOnConflict("offline_events", null, ContentValues().apply { put("id", id); put("type", type); put("payload", payload.toString()); put("created_at", System.currentTimeMillis()); put("synced", 0) }, SQLiteDatabase.CONFLICT_IGNORE)
    }
    fun pending(): List<OfflineEvent> = readableDatabase.query("offline_events", arrayOf("id", "type", "payload"), "synced=0", null, null, null, "created_at ASC").use { cursor ->
        buildList { while (cursor.moveToNext()) add(OfflineEvent(cursor.getString(0), cursor.getString(1), cursor.getString(2))) }
    }
    fun markSynced(id: String) { writableDatabase.update("offline_events", ContentValues().apply { put("synced", 1) }, "id=?", arrayOf(id)) }
    fun clear() { writableDatabase.delete("offline_events", null, null) }
}
