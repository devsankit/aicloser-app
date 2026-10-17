package com.gigxomi.gxclosers.call

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.gigxomi.gxclosers.MainActivity
import com.gigxomi.gxclosers.R

object LeadCallNotification {
    private const val CHANNEL = "gxclosers_call_context"
    private const val CALLBACK_CHANNEL = "gxclosers_callback_reminders_v2"

    fun show(context: Context, phone: String, ended: Boolean = false, callId: String? = null) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL, "Sales call context", NotificationManager.IMPORTANCE_HIGH).apply {
                enableLights(true)
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        val lead = CallManager.lookup(context, phone)
        val title = if (ended) "Complete call notes" else (lead?.name ?: "GXClosers sales call")
        val text = if (ended) {
            "${lead?.name ?: phone} • Add the required disposition and sync the recording."
        } else {
            listOf(phone, lead?.stage, lead?.source, lead?.notes).mapNotNull { it?.takeIf(String::isNotBlank) }.joinToString(" • ")
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
        val notification = builder.setSmallIcon(R.drawable.ic_launcher)
            .setColor(0xFFD7FF2F.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(pending)
            .setAutoCancel(ended)
            .setOngoing(!ended)
            .setPriority(Notification.PRIORITY_HIGH)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(if (ended) 2402 else 2401, notification)
    }

    fun cancelIncoming(context: Context) = context.getSystemService(NotificationManager::class.java).cancel(2401)

    fun showCallback(context: Context, leadId: String, leadName: String, phone: String, callbackAt: String) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        if (Build.VERSION.SDK_INT >= 26) {
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_REQUEST)
                .build()
            val channel = NotificationChannel(CALLBACK_CHANNEL, "Callback Reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Urgent reminders for scheduled customer follow-up calls"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 350, 150, 350, 150, 350)
                enableLights(true)
                lightColor = 0xFF10B981.toInt()
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setSound(Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
            }
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val callbackLabel = runCatching {
            java.time.Instant.parse(callbackAt)
                .atZone(java.time.ZoneId.systemDefault())
                .format(java.time.format.DateTimeFormatter.ofPattern("dd MMM, hh:mm a"))
        }.getOrElse { callbackAt }

        val cleanPhone = phone.filter(Char::isDigit)
        val title = "📞 Callback Reminder: $leadName"
        val text = "Scheduled for $callbackLabel • $phone"

        val notificationId = 3000 + ("$leadId|$callbackAt".hashCode() and 0x7fff)

        // View lead intent
        val viewIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("gxclosers://lead/${Uri.encode(leadId)}")
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val viewPending = PendingIntent.getActivity(
            context,
            notificationId,
            viewIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CALLBACK_CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(context)
        builder.setSmallIcon(R.drawable.ic_launcher)
            .setColor(0xFF10B981.toInt()) // Vibrant Emerald Green
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(viewPending)
            .setPriority(Notification.PRIORITY_HIGH)
            .setCategory(Notification.CATEGORY_REMINDER)
            .setDefaults(Notification.DEFAULT_ALL)
            .setAutoCancel(true)

        // Add 1-Click "Call Now" action
        if (cleanPhone.isNotBlank()) {
            val callIntent = Intent(Intent.ACTION_DIAL).apply {
                data = Uri.parse("tel:$cleanPhone")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val callPending = PendingIntent.getActivity(
                context,
                notificationId + 100,
                callIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val callAction = Notification.Action.Builder(
                android.R.drawable.ic_menu_call,
                "Call Now",
                callPending
            ).build()
            builder.addAction(callAction)
        }

        // Add "View Lead" action
        val viewAction = Notification.Action.Builder(
            android.R.drawable.ic_menu_view,
            "View Lead",
            viewPending
        ).build()
        builder.addAction(viewAction)

        context.getSystemService(NotificationManager::class.java).notify(notificationId, builder.build())
    }
}
