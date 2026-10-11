package com.gigxomi.gxclosers.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.telecom.TelecomManager
import com.gigxomi.gxclosers.BuildConfig
import com.gigxomi.gxclosers.call.DialerShareAutomation
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.UUID

/**
 * Privacy-safe device/call diagnostics. This records capability facts and
 * pipeline boundaries, never phone numbers, credentials, tokens or audio.
 * Events use the existing offline queue so diagnostics survive bad networks.
 */
object DeviceDiagnostics {
    private const val PREFS = "gxclosers_device_diagnostics"
    private const val LAST_SNAPSHOT_FINGERPRINT = "last_snapshot_fingerprint"
    private const val SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000L
    private const val LAST_SNAPSHOT_AT = "last_snapshot_at"

    fun enqueueSnapshot(context: Context, force: Boolean = false): Boolean {
        val snapshot = snapshot(context)
        val fingerprint = sha256(snapshot.toString())
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val unchanged = prefs.getString(LAST_SNAPSHOT_FINGERPRINT, null) == fingerprint
        val fresh = now - prefs.getLong(LAST_SNAPSHOT_AT, 0L) < SNAPSHOT_INTERVAL_MS
        if (!force && unchanged && fresh) return false

        val event = JSONObject(snapshot.toString()).put("kind", "DEVICE_SNAPSHOT")
        enqueue(context, "snapshot-$fingerprint", event)
        prefs.edit().putString(LAST_SNAPSHOT_FINGERPRINT, fingerprint).putLong(LAST_SNAPSHOT_AT, now).apply()
        return true
    }

    fun record(context: Context, kind: String, callId: String? = null, fields: JSONObject = JSONObject()) {
        val payload = JSONObject()
            .put("kind", kind.uppercase())
            .put("at", System.currentTimeMillis())
            .put("appVersion", BuildConfig.VERSION_NAME)
        callId?.takeIf { it.isNotBlank() }?.let { payload.put("callId", it) }
        val safeFields = JSONObject(fields.toString())
        val keys = safeFields.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            if (key !in SAFE_EVENT_FIELDS) continue
            payload.put(key, safeFields.opt(key))
        }
        enqueue(context, "event-${UUID.randomUUID()}", payload)
    }

    fun snapshot(context: Context): JSONObject {
        val resolver = context.contentResolver
        val callLog = hasPermission(context, Manifest.permission.READ_CALL_LOG)
        val phoneState = hasPermission(context, Manifest.permission.READ_PHONE_STATE)
        val phoneNumbers = hasPermission(context, Manifest.permission.READ_PHONE_NUMBERS)
        val callPhone = hasPermission(context, Manifest.permission.CALL_PHONE)
        val microphone = hasPermission(context, Manifest.permission.RECORD_AUDIO)
        val contacts = hasPermission(context, Manifest.permission.READ_CONTACTS)
        val notifications = Build.VERSION.SDK_INT < 33 || hasPermission(context, Manifest.permission.POST_NOTIFICATIONS)
        val audioStorage = when {
            Build.VERSION.SDK_INT >= 30 -> runCatching { Environment.isExternalStorageManager() }.getOrDefault(false)
            Build.VERSION.SDK_INT >= 23 -> hasPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE)
            else -> true
        }
        val miuiFolder = File(Environment.getExternalStorageDirectory(), "MIUI/sound_recorder/call_rec")
        val dialer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            runCatching { context.getSystemService(TelecomManager::class.java)?.defaultDialerPackage }.getOrNull()
        } else null
        val shareAutomation = runCatching { DialerShareAutomation.isAccessibilityEnabled(context) }.getOrDefault(false)
        val batteryOptimized = runCatching {
            val power = context.getSystemService(PowerManager::class.java)
            !power.isIgnoringBatteryOptimizations(context.packageName)
        }.getOrNull()
        val recordingCapability = when {
            miuiFolder.isDirectory && audioStorage -> "SYSTEM_FOLDER_OR_MEDIASTORE"
            shareAutomation -> "DIALER_SHARE"
            microphone -> "MICROPHONE_FALLBACK"
            else -> "UNAVAILABLE"
        }

        return JSONObject()
            .put("deviceId", SessionStore(context).installationId)
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("device", Build.DEVICE)
            .put("brand", Build.BRAND)
            .put("androidVersion", Build.VERSION.RELEASE)
            .put("androidApi", Build.VERSION.SDK_INT)
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("appPackage", context.packageName)
            .put("defaultDialer", dialer ?: "")
            .put("permissionCallLog", callLog)
            .put("permissionPhoneState", phoneState)
            .put("permissionPhoneNumbers", phoneNumbers)
            .put("permissionCallPhone", callPhone)
            .put("permissionMicrophone", microphone)
            .put("permissionContacts", contacts)
            .put("permissionNotifications", notifications)
            .put("sharedAudioAccess", audioStorage)
            .put("miuiRecordingFolderPresent", miuiFolder.isDirectory)
            .put("miuiRecordingFolderReadable", miuiFolder.isDirectory && miuiFolder.canRead())
            .put("accessibilityShareEnabled", shareAutomation)
            .put("batteryOptimizationEnabled", batteryOptimized ?: false)
            .put("recordingCapability", recordingCapability)
            .put("recordingEnabled", recordingCapability != "UNAVAILABLE")
    }

    private fun enqueue(context: Context, id: String, payload: JSONObject) {
        OfflineEventStore(context).enqueue(
            id = "device-diagnostic-${SessionStore(context).installationId}-$id",
            type = "DEVICE_DIAGNOSTIC",
            payload = payload,
            entityId = null,
        )
    }

    private fun hasPermission(context: Context, permission: String): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }

    private val SAFE_EVENT_FIELDS = setOf(
        "stage", "route", "source", "status", "reason", "errorCode", "retryCount",
        "durationMs", "expectedDurationMs", "sizeBytes", "mimeType", "candidateCount",
        "matched", "decoded", "serverStatus", "network", "screenState",
    )
}
