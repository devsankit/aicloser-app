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
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import com.gigxomi.gxclosers.R

/**
 * Keeps call-state monitoring alive on OEMs that block the protected
 * ACTION_PHONE_STATE_CHANGED broadcast from reaching normal applications.
 * Uses event-driven OS listeners with a relaxed watchdog timer to prevent
 * excessive battery consumption and background-kill triggers on Xiaomi/Vivo/Samsung.
 */
class CallStateMonitorService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var lastState: Int? = null
    private var telephonyManager: TelephonyManager? = null

    @Suppress("DEPRECATION")
    private var legacyListener: PhoneStateListener? = null
    private var modernCallback: Any? = null

    private val poll = object : Runnable {
        override fun run() {
            val currentState = runCatching { telephonyManager?.callState }.getOrNull()
            if (currentState != null && currentState != lastState) {
                handleStateChange(currentState)
            }
            // Relax watchdog polling when phone is idle (10s) to prevent CPU wakeups
            // and aggressive MIUI/Vivo battery kills. Poll faster (1s) only while call is active.
            val nextDelay = if (lastState == TelephonyManager.CALL_STATE_RINGING || lastState == TelephonyManager.CALL_STATE_OFFHOOK) 1_000L else 10_000L
            handler.postDelayed(this, nextDelay)
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

        telephonyManager = getSystemService(TelephonyManager::class.java)
        registerCallStateListener()
        handler.post(poll)
        Log.i(TAG, "Call-state monitor started with event-driven listener and relaxed watchdog")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int =
        START_STICKY

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        unregisterCallStateListener()
        Log.i(TAG, "Call-state monitor stopped")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun registerCallStateListener() {
        val tm = telephonyManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            runCatching {
                val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) {
                        handleStateChange(state)
                    }
                }
                modernCallback = cb
                tm.registerTelephonyCallback(mainExecutor, cb)
                Log.i(TAG, "Registered TelephonyCallback for Android 12+")
            }.onFailure { Log.w(TAG, "Could not register TelephonyCallback", it) }
        } else {
            runCatching {
                @Suppress("DEPRECATION")
                val listener = object : PhoneStateListener() {
                    @Deprecated("Deprecated in Java")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                        handleStateChange(state)
                    }
                }
                legacyListener = listener
                @Suppress("DEPRECATION")
                tm.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
                Log.i(TAG, "Registered PhoneStateListener for pre-Android 12")
            }.onFailure { Log.w(TAG, "Could not register PhoneStateListener", it) }
        }
    }

    private fun unregisterCallStateListener() {
        val tm = telephonyManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val cb = modernCallback as? TelephonyCallback
            if (cb != null) {
                runCatching { tm.unregisterTelephonyCallback(cb) }
                modernCallback = null
            }
        } else {
            val listener = legacyListener
            if (listener != null) {
                @Suppress("DEPRECATION")
                runCatching { tm.listen(listener, PhoneStateListener.LISTEN_NONE) }
                legacyListener = null
            }
        }
    }

    private fun handleStateChange(state: Int) {
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
    }
}
