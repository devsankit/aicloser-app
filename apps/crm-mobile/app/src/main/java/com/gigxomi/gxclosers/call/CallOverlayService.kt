package com.gigxomi.gxclosers.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.content.pm.ServiceInfo
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import com.gigxomi.gxclosers.R

class CallOverlayService : Service() {
    private var windowManager: WindowManager? = null
    private var card: LinearLayout? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_HIDE) {
            stopSelf()
            return START_NOT_STICKY
        }
        val phone = intent?.getStringExtra(EXTRA_PHONE).orEmpty()
        if (phone.isBlank() || !Settings.canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification())
        }
        showCard(phone)
        return START_NOT_STICKY
    }

    private fun showCard(phone: String) {
        removeCard()
        val lead = CallManager.lookup(this, phone)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(14), dp(14))
            background = GradientDrawable().apply {
                setColor(Color.rgb(27, 29, 34))
                cornerRadius = dp(18).toFloat()
                setStroke(dp(1), Color.rgb(255, 105, 45))
            }
            elevation = dp(12).toFloat()
        }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        val title = TextView(this).apply {
            text = lead?.name ?: "Unknown caller"
            setTextColor(Color.WHITE)
            textSize = 18f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val close = TextView(this).apply {
            text = "×"
            setTextColor(Color.LTGRAY)
            textSize = 28f
            gravity = Gravity.CENTER
            setPadding(dp(8), 0, dp(4), 0)
            setOnClickListener { stopSelf() }
        }
        header.addView(title)
        header.addView(close)
        root.addView(header)
        addText(root, phone, 14f, Color.rgb(190, 196, 206), top = 2)
        if (lead == null) {
            addText(root, "No matching CRM lead", 13f, Color.rgb(160, 166, 176), top = 14)
            addText(root, "Save this number as a contact to track the call.", 12f, Color.rgb(160, 166, 176), top = 4)
        } else {
            val details = listOfNotNull(
                lead.stage.takeIf(String::isNotBlank)?.let { "Stage  ·  ${it.replace('_', ' ')}" },
                lead.source.takeIf(String::isNotBlank)?.let { "Source  ·  $it" },
                lead.serviceInterest.takeIf(String::isNotBlank)?.let { "Interest  ·  $it" },
                lead.email.takeIf(String::isNotBlank)?.let { "Email  ·  $it" },
            )
            details.forEachIndexed { index, value -> addText(root, value, 12f, Color.rgb(218, 222, 230), top = if (index == 0) 14 else 5) }
            lead.notes.takeIf(String::isNotBlank)?.let { note ->
                addText(root, note, 12f, Color.rgb(177, 183, 194), top = 10, maxLines = 2)
            }
        }

        val params = WindowManager.LayoutParams(
            dp(344),
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dp(56)
        }
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        runCatching {
            windowManager?.addView(root, params)
            card = root
        }.onFailure { stopSelf() }
    }

    private fun addText(parent: LinearLayout, value: String, size: Float, color: Int, top: Int, maxLines: Int = 1) {
        parent.addView(TextView(this).apply {
            text = value
            textSize = size
            setTextColor(color)
            this.maxLines = maxLines
            ellipsize = android.text.TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(top) }
        })
    }

    private fun notification(): Notification {
        if (Build.VERSION.SDK_INT >= 26) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL, "Incoming caller card", NotificationManager.IMPORTANCE_LOW))
        }
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
        return builder.setSmallIcon(R.drawable.ic_launcher).setContentTitle("GXClosers caller card").setContentText("Showing CRM caller context").build()
    }

    private fun removeCard() {
        card?.let { runCatching { windowManager?.removeView(it) } }
        card = null
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        removeCard()
        super.onDestroy()
    }

    companion object {
        const val ACTION_SHOW = "com.gigxomi.gxclosers.SHOW_CALL_CARD"
        const val ACTION_HIDE = "com.gigxomi.gxclosers.HIDE_CALL_CARD"
        const val EXTRA_PHONE = "phone"
        private const val CHANNEL = "gxclosers_caller_card"
        private const val NOTIFICATION_ID = 2403
    }
}
