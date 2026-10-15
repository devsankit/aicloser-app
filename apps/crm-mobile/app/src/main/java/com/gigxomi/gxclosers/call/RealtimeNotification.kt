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
import org.json.JSONObject

/** Local presentation for authenticated realtime events received by the mobile stream. */
object RealtimeNotification {
    private const val CHANNEL = "gxclosers_realtime_updates"

    fun show(context: Context, eventType: String, payload: JSONObject) {
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val normalized = eventType.lowercase().replace('-', '.')
        val (title, fallbackBody) = when {
            normalized.startsWith("message.") -> "New chat message" to "A new message is waiting in your assigned conversation."
            normalized.startsWith("conversation.") -> "Conversation updated" to "An assigned conversation has been updated."
            normalized.startsWith("lead.") -> "Lead updated" to "An assigned lead has new activity."
            normalized.contains("follow") || normalized.contains("callback") || normalized.startsWith("task.") -> "Follow-up reminder" to "A follow-up needs your attention."
            normalized == "recording.uploaded" -> "Recording synced" to "A call recording is ready to play."
            normalized == "recording.failed" -> "Recording sync needs attention" to "A call recording could not be synced."
            normalized == "call.ended" -> "Call notes required" to "Complete the call outcome and notes."
            else -> return
        }
        val body = payload.optString("message").ifBlank {
            payload.optString("body").ifBlank {
                payload.optString("title").ifBlank { fallbackBody }
            }
        }
        if (Build.VERSION.SDK_INT >= 26) {
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL, "AI Closer updates", NotificationManager.IMPORTANCE_DEFAULT),
            )
        }

        val leadId = payload.optString("leadId").ifBlank { payload.optString("id") }
        val launch = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (leadId.isNotBlank()) {
                action = Intent.ACTION_VIEW
                data = Uri.parse("gxclosers://lead/${Uri.encode(leadId)}")
            }
        }
        val notificationId = 4100 + ("$normalized:${payload.optString("id")}:${payload.optString("conversationId")}".hashCode() and 0x3fff)
        val pending = PendingIntent.getActivity(
            context,
            notificationId,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(context)
        val notification = builder
            .setSmallIcon(R.drawable.ic_launcher)
            .setColor(0xFFFF6B2F.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(notificationId, notification)
    }
}
