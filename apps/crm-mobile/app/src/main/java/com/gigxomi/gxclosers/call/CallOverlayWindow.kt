package com.gigxomi.gxclosers.call

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.net.Uri
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.util.Log

/** Renders caller context directly from the call callbacks. This avoids Android 14
 * background-FGS restrictions that prevent a special-use service from starting. */
object CallOverlayWindow {
    private var windowManager: WindowManager? = null
    private var card: LinearLayout? = null

    fun show(context: Context, phone: String) {
        Log.i(TAG, "show requested phone=$phone overlay=${Settings.canDrawOverlays(context)}")
        if (phone.isBlank() || Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) return
        context.mainExecutor.execute {
            remove()
            val lead = CallManager.lookup(context, phone)
            val root = LinearLayout(context.applicationContext).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(context, 18), dp(context, 14), dp(context, 14), dp(context, 14))
                background = GradientDrawable().apply {
                    setColor(Color.rgb(27, 29, 34))
                    cornerRadius = dp(context, 18).toFloat()
                    setStroke(dp(context, 1), Color.rgb(255, 105, 45))
                }
                elevation = dp(context, 12).toFloat()
            }
            val header = LinearLayout(context).apply { gravity = Gravity.CENTER_VERTICAL }
            val title = TextView(context).apply {
                text = lead?.name ?: "Unknown caller"
                setTextColor(Color.WHITE)
                textSize = 18f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val close = TextView(context).apply {
                text = "×"
                setTextColor(Color.LTGRAY)
                textSize = 28f
                gravity = Gravity.CENTER
                setPadding(dp(context, 8), 0, dp(context, 4), 0)
                setOnClickListener { remove() }
            }
            header.addView(title)
            header.addView(close)
            root.addView(header)
            addText(context, root, phone, 14f, Color.rgb(190, 196, 206), 2)
            if (lead == null) {
                addText(context, root, "New company caller", 13f, Color.rgb(255, 166, 115), 14)
                addText(context, root, "This number will appear in New Leads after the call.", 12f, Color.rgb(190, 196, 206), 4)
            } else {
                listOfNotNull(
                    lead.stage.takeIf(String::isNotBlank)?.let { "Stage  ·  ${it.replace('_', ' ')}" },
                    lead.source.takeIf(String::isNotBlank)?.let { "Source  ·  $it" },
                    lead.serviceInterest.takeIf(String::isNotBlank)?.let { "Interest  ·  $it" },
                    lead.email.takeIf(String::isNotBlank)?.let { "Email  ·  $it" },
                ).forEachIndexed { index, value ->
                    addText(context, root, value, 12f, Color.rgb(218, 222, 230), if (index == 0) 14 else 5)
                }
                lead.notes.takeIf(String::isNotBlank)?.let { note ->
                    addText(context, root, note, 12f, Color.rgb(177, 183, 194), 10, 2)
                }
                lead.lastTouchBy.takeIf(String::isNotBlank)?.let { handledBy ->
                    addText(context, root, "Previously handled by  ·  $handledBy", 12f, Color.rgb(255, 166, 115), 10)
                    lead.lastTouchSummary.takeIf(String::isNotBlank)?.let { summary ->
                        addText(context, root, summary, 11f, Color.rgb(177, 183, 194), 3, 2)
                    }
                }
            }

            val openCrm = TextView(context).apply {
                text = if (lead == null) "Add details after call" else "Open CRM details"
                textSize = 12f
                gravity = Gravity.CENTER
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
                setPadding(dp(context, 12), dp(context, 11), dp(context, 12), dp(context, 11))
                background = GradientDrawable().apply {
                    setColor(Color.rgb(255, 105, 45))
                    cornerRadius = dp(context, 11).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = dp(context, 14)
                }
                setOnClickListener { openDisposition(context) }
            }
            root.addView(openCrm)

            val params = WindowManager.LayoutParams(
                dp(context, 344),
                WindowManager.LayoutParams.WRAP_CONTENT,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                y = dp(context, 520)
            }
            windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            runCatching {
                windowManager?.addView(root, params)
                card = root
                Log.i(TAG, "caller card attached")
            }.onFailure { Log.e(TAG, "caller card attach failed", it) }
        }
    }

    fun remove() {
        card?.let { runCatching { windowManager?.removeView(it) } }
        card = null
    }

    private fun addText(context: Context, parent: LinearLayout, value: String, size: Float, color: Int, top: Int, maxLines: Int = 1) {
        parent.addView(TextView(context).apply {
            text = value
            textSize = size
            setTextColor(color)
            this.maxLines = maxLines
            ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(context, top)
            }
        })
    }

    private fun dp(context: Context, value: Int) = (value * context.resources.displayMetrics.density).toInt()

    private fun openDisposition(context: Context) {
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        val callId = prefs.getString("activeCallId", null).orEmpty()
        val intent = if (callId.isNotBlank()) {
            Intent(Intent.ACTION_VIEW, Uri.parse("gxclosers://disposition/$callId"))
        } else {
            context.packageManager.getLaunchIntentForPackage(context.packageName)
        } ?: return
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        runCatching { context.startActivity(intent) }
        remove()
    }

    private const val TAG = "GXCallOverlay"
}
