package com.gigxomi.gxclosers.call

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import com.gigxomi.gxclosers.MainActivity
import com.gigxomi.gxclosers.R

object LeadCallNotification {
    private const val CHANNEL = "gxclosers_call_context"
    fun show(context: Context, phone: String, ended: Boolean = false, callId: String? = null) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        if (Build.VERSION.SDK_INT >= 26) context.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL, "Sales call context", NotificationManager.IMPORTANCE_HIGH))
        val lead = CallManager.lookup(context, phone)
        val title = if (ended) "Complete call notes" else lead?.name ?: "GXClosers sales call"
        val text = if (ended) {
            "${lead?.name ?: phone} · Add the required disposition and sync the recording."
        } else {
            listOf(phone, lead?.stage, lead?.source, lead?.notes).mapNotNull { it?.takeIf(String::isNotBlank) }.joinToString(" · ")
        }
        val uri = if (ended && !callId.isNullOrBlank()) Uri.parse("gxclosers://disposition/$callId") else lead?.id?.takeIf(String::isNotBlank)?.let { Uri.parse("gxclosers://lead/$it") }
        val launch = uri?.let {
            Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = it
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
        } ?: context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        val pending = PendingIntent.getActivity(context, if (ended) 2402 else 2401, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(context)
        val notification = builder.setSmallIcon(R.drawable.ic_launcher).setColor(0xFFD7FF2F.toInt()).setContentTitle(title).setContentText(text).setStyle(Notification.BigTextStyle().bigText(text)).setContentIntent(pending).setAutoCancel(ended).setOngoing(!ended).build()
        context.getSystemService(NotificationManager::class.java).notify(if (ended) 2402 else 2401, notification)
    }
    fun cancelIncoming(context: Context) = context.getSystemService(NotificationManager::class.java).cancel(2401)
}
