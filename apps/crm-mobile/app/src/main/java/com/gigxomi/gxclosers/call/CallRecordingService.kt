package com.gigxomi.gxclosers.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import com.gigxomi.gxclosers.R

class CallRecordingService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL, "GXClosers call recording", NotificationManager.IMPORTANCE_LOW))
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
        startForeground(2402, builder.setContentTitle("GXClosers call recording").setContentText("Recording the active company sales call").setSmallIcon(R.drawable.ic_launcher).build())
        val callId = intent?.getStringExtra(EXTRA_CALL_ID).orEmpty()
        if (intent?.action != ACTION_START || callId.isBlank() || !CallAudioRecorder.start(this, callId)) stopSelf()
        return START_NOT_STICKY
    }
    override fun onDestroy() { CallAudioRecorder.stop(this); super.onDestroy() }
    companion object { const val ACTION_START = "com.gigxomi.gxclosers.START_RECORDING"; const val EXTRA_CALL_ID = "callId"; private const val CHANNEL = "gxclosers_recording" }
}
