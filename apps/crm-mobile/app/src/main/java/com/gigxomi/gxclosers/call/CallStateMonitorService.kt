package com.gigxomi.gxclosers.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.gigxomi.gxclosers.R

/**
 * Keeps call-state monitoring alive on OEMs that block the protected
 * ACTION_PHONE_STATE_CHANGED broadcast from reaching normal applications.
 * It does not record audio; it only forwards state transitions to the same
 * call/session pipeline used by PhoneStateReceiver.
 */
class CallStateMonitorService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var lastState: Int? = null
    private val poll = object : Runnable {
        override fun run() {
            checkState()
            handler.postDelayed(this, POLL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIFICATION_ID, notification())
        }
        handler.post(poll)
        Log.i(TAG, "Call-state monitor started")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int =
        START_STICKY

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        Log.i(TAG, "Call-state monitor stopped")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun checkState() {
        val state = runCatching {
            getSystemService(TelephonyManager::class.java)?.callState
        }.getOrNull() ?: return
        if (state == lastState) return
        lastState = state
        val stateName = when (state) {
            TelephonyManager.CALL_STATE_RINGING -> "RINGING"
            TelephonyManager.CALL_STATE_OFFHOOK -> "OFFHOOK"
            else -> "IDLE"
        }
        Log.i(TAG, "call state=$stateName")
        sendBroadcast(
            Intent(this, PhoneStateReceiver::class.java)
                .setAction(PhoneStateReceiver.ACTION_INTERNAL_PHONE_STATE)
                .putExtra(PhoneStateReceiver.EXTRA_INTERNAL_STATE, stateName),
        )
        // MIUI can reject a foreground microphone-service start when it is
        // requested directly from a background BroadcastReceiver. This
        // service is already a visible foreground service, so use it as the
        // allowed launch point for the user's explicitly enabled fallback.
        when (stateName) {
            "OFFHOOK" -> handler.postDelayed({ ensureMicRecorderStarted() }, 250L)
            "IDLE" -> handler.postDelayed({
                runCatching { stopService(Intent(this, CallRecordingService::class.java)) }
            }, 1_500L)
        }
    }

    private fun ensureMicRecorderStarted() {
        val prefs = getSharedPreferences(CallAudioRecorder.PREFS, MODE_PRIVATE)
        if (!prefs.getBoolean("micFallbackEnabled", false)) return
        // The visible Phone Share bridge does not prove that a system recording
        // exists. Pixel/Google Phone can keep the bridge enabled while call
        // recording is unavailable in the current location. If the user
        // enabled the fallback, let it run and let call-end prefer its fresh
        // file over any stale system-dialer recording.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
        ) return
        val callId = prefs.getString("activeCallId", null)
            ?: prefs.getString("unpreparedRecordingCallId", null)
            ?: prefs.getString("recordingCallId", null)
        if (callId.isNullOrBlank()) return
        val state = prefs.getString("recordingState", "").orEmpty()
        if (state == "STARTING_MIC_FALLBACK" || state == "RECORDING") return
        runCatching {
            ContextCompat.startForegroundService(
                this,
                Intent(this, CallRecordingService::class.java)
                    .setAction(CallRecordingService.ACTION_START)
                    .putExtra(CallRecordingService.EXTRA_CALL_ID, callId),
            )
            prefs.edit()
                .putString("recordingAudioSource", "AICLOSER_MIC_FALLBACK")
                .putString("recordingState", "STARTING_MIC_FALLBACK")
                .apply()
            Log.i(TAG, "requested microphone fallback from foreground monitor callId=$callId")
        }.onFailure { error ->
            Log.w(TAG, "could not start microphone fallback from monitor", error)
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL, "AICloser call tracking", NotificationManager.IMPORTANCE_LOW),
            )
        }
    }

    private fun notification(): Notification =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.mipmap.ic_launcher_foreground)
                .setContentTitle("AICloser call tracking")
                .setContentText("Ready to sync call recordings")
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setSmallIcon(R.mipmap.ic_launcher_foreground)
                .setContentTitle("AICloser call tracking")
                .setContentText("Ready to sync call recordings")
                .setOngoing(true)
                .build()
        }

    private companion object {
        const val TAG = "GXCallMonitor"
        const val CHANNEL = "gxclosers_call_monitor"
        const val NOTIFICATION_ID = 2403
        const val POLL_MS = 750L
    }
}
