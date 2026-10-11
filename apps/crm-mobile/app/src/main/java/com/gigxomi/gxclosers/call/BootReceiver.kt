package com.gigxomi.gxclosers.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.gigxomi.gxclosers.data.CallbackReminderWorker
import com.gigxomi.gxclosers.data.SessionStore

/**
 * Resumes background call monitoring and callback notifications after device reboot
 * or app package update (APK upgrade) so client calls are never lost.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        Log.i("GXBootReceiver", "Received broadcast action=$action")
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            val sessionStore = SessionStore(context)
            if (!sessionStore.token.isNullOrBlank() && sessionStore.setupComplete) {
                Log.i("GXBootReceiver", "Restarting CallStateMonitorService after boot/update")
                runCatching {
                    ContextCompat.startForegroundService(
                        context,
                        Intent(context, CallStateMonitorService::class.java),
                    )
                }.onFailure { Log.e("GXBootReceiver", "Failed to start CallStateMonitorService", it) }
            }
            CallbackReminderWorker.enqueue(context)
        }
    }
}
