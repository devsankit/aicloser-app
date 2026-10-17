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
import org.json.JSONObject

object RealtimeNotification {
    private const val CHANNEL_UPDATES = "gxclosers_realtime_updates_v2"
    private const val CHANNEL_MESSAGES = "gxclosers_chat_messages_v2"
    private const val CHANNEL_NOTES = "gxclosers_lead_notes_v2"

    fun show(context: Context, eventType: String, payload: JSONObject) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return

        val nm = context.getSystemService(NotificationManager::class.java)
        val normalized = eventType.lowercase().replace('-', '.')

        // 1. CALLBACK / FOLLOW-UP REMINDER (Heads-up popup with 1-click Call action)
        val isCallback = normalized == "callback.due" ||
            normalized == "callback.scheduled" ||
            normalized == "follow.up.due" ||
            normalized == "follow.up.scheduled" ||
            (normalized.startsWith("lead.") && (payload.has("followUpAt") || payload.has("nextFollowUpAt")))
        if (isCallback) {
            val leadId = payload.optString("leadId", payload.optString("id"))
            val leadName = payload.optString("customerName", payload.optString("leadName", "Lead")).ifBlank { "Lead" }
            val phone = payload.optString("customerPhone", payload.optString("phone", ""))
            val callbackAt = payload.optString("followUpAt", payload.optString("nextFollowUpAt", payload.optString("callbackAt", payload.optString("time", ""))))
            if (leadId.isNotBlank() && phone.isNotBlank()) {
                LeadCallNotification.showCallback(
                    context = context,
                    leadId = leadId,
                    leadName = leadName,
                    phone = phone,
                    callbackAt = callbackAt.ifBlank { "Now" },
                )
                return
            }
        }

        // 2. CHAT / WHATSAPP / INCOMING MESSAGE NOTIFICATIONS (Heads-up popup with Reply action)
        val isChatMessage = normalized == "message.created" ||
            normalized == "chat.message" ||
            normalized == "whatsapp.message" ||
            normalized == "message.received" ||
            normalized == "conversation.message"
        if (isChatMessage) {
            if (Build.VERSION.SDK_INT >= 26) {
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build()
                val msgChannel = NotificationChannel(CHANNEL_MESSAGES, "Chat Messages", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Incoming messages from leads and prospects"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 250, 100, 250)
                    enableLights(true)
                    lightColor = 0xFFA855F7.toInt()
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    setSound(Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
                }
                nm.createNotificationChannel(msgChannel)
            }

            val conversationId = payload.optString("conversationId", payload.optString("id"))
            val customerName = payload.optString("customerName", payload.optString("senderName", payload.optString("senderLabel", "Lead"))).ifBlank { "Lead" }
            val body = payload.optString("body", payload.optString("message", "New chat message waiting")).ifBlank { "New chat message waiting" }
            val title = "💬 $customerName"

            val notificationId = 5000 + (conversationId.hashCode() and 0x3fff)

            // Open chat intent
            val chatUri = Uri.parse("gxclosers://chat/${Uri.encode(conversationId)}/${Uri.encode(customerName)}")
            val chatIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = chatUri
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val chatPending = PendingIntent.getActivity(
                context,
                notificationId,
                chatIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL_MESSAGES) else @Suppress("DEPRECATION") Notification.Builder(context)
            builder.setSmallIcon(R.drawable.ic_launcher)
                .setColor(0xFFA855F7.toInt()) // Vibrant Purple
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(Notification.BigTextStyle().bigText(body))
                .setContentIntent(chatPending)
                .setPriority(Notification.PRIORITY_HIGH)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true)

            // Add "Reply" action
            val replyAction = Notification.Action.Builder(
                android.R.drawable.ic_menu_send,
                "Reply",
                chatPending
            ).build()
            builder.addAction(replyAction)

            nm.notify(notificationId, builder.build())
            return
        }

        // 3. LEAD NOTE UPDATED NOTIFICATIONS (Heads-up popup with View Lead action)
        val isNoteUpdate = normalized == "lead.note_updated" ||
            (normalized.startsWith("lead.") && (payload.has("note") || payload.has("notes") || payload.has("internalNotes")))
        if (isNoteUpdate) {
            if (Build.VERSION.SDK_INT >= 26) {
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .build()
                val notesChannel = NotificationChannel(CHANNEL_NOTES, "Lead Note Updates", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Updates to lead notes and customer activity"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 200, 100, 200)
                    enableLights(true)
                    lightColor = 0xFF3B82F6.toInt()
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    setSound(Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)
                }
                nm.createNotificationChannel(notesChannel)
            }

            val leadId = payload.optString("leadId", payload.optString("id"))
            val customerName = payload.optString("customerName", payload.optString("leadName", "Lead")).ifBlank { "Lead" }
            val noteText = payload.optString("note", payload.optString("notes", payload.optString("body", "Lead notes were updated."))).ifBlank { "Lead notes were updated." }
            val title = "📝 Note Updated: $customerName"

            val notificationId = 6000 + (leadId.hashCode() and 0x3fff)

            val leadUri = Uri.parse("gxclosers://lead/${Uri.encode(leadId)}")
            val leadIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = leadUri
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val leadPending = PendingIntent.getActivity(
                context,
                notificationId,
                leadIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL_NOTES) else @Suppress("DEPRECATION") Notification.Builder(context)
            builder.setSmallIcon(R.drawable.ic_launcher)
                .setColor(0xFF3B82F6.toInt()) // Vibrant Blue
                .setContentTitle(title)
                .setContentText(noteText)
                .setStyle(Notification.BigTextStyle().bigText(noteText))
                .setContentIntent(leadPending)
                .setPriority(Notification.PRIORITY_HIGH)
                .setCategory(Notification.CATEGORY_EVENT)
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true)

            val viewAction = Notification.Action.Builder(
                android.R.drawable.ic_menu_view,
                "View Lead",
                leadPending
            ).build()
            builder.addAction(viewAction)

            nm.notify(notificationId, builder.build())
            return
        }

        // 4. GENERAL SYSTEM / RECORDING UPDATES
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_UPDATES, "AI Closer updates", NotificationManager.IMPORTANCE_DEFAULT),
            )
        }

        val (title, fallbackBody) = when {
            normalized.startsWith("lead.") -> "Lead updated" to "An assigned lead has new activity."
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

        val leadId = payload.optString("leadId").ifBlank { payload.optString("id") }
        val launch = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (leadId.isNotBlank()) {
                action = Intent.ACTION_VIEW
                data = Uri.parse("gxclosers://lead/${Uri.encode(leadId)}")
            }
        }
        val notificationId = 4100 + ("$normalized:${payload.optString("id")}".hashCode() and 0x3fff)
        val pending = PendingIntent.getActivity(
            context,
            notificationId,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL_UPDATES) else @Suppress("DEPRECATION") Notification.Builder(context)
        val notification = builder
            .setSmallIcon(R.drawable.ic_launcher)
            .setColor(0xFFFF6B2F.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        nm.notify(notificationId, notification)
    }
}
