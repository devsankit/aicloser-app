package com.gigxomi.gxclosers.call

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.net.Uri
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
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
        // Context.getMainExecutor() was added in API 28. Vivo test devices can
        // still run API 27, so use the platform main looper for all supported
        // Android versions and keep the PHONE_STATE receiver from crashing on
        // the first inbound ring event.
        Handler(Looper.getMainLooper()).post {
            remove()
            val lead = CallManager.lookup(context, phone)
            val root = LinearLayout(context.applicationContext).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(context, 14), dp(context, 10), dp(context, 12), dp(context, 10))
                background = GradientDrawable().apply {
                    setColor(Color.rgb(27, 29, 34))
                    cornerRadius = dp(context, 18).toFloat()
                    setStroke(dp(context, 1), Color.rgb(255, 105, 45))
                }
                elevation = dp(context, 12).toFloat()
            }
            val header = LinearLayout(context).apply { gravity = Gravity.CENTER_VERTICAL }
            val dragHandle = TextView(context).apply {
                text = "⋮⋮"
                setTextColor(Color.rgb(140, 148, 160))
                textSize = 15f
                gravity = Gravity.CENTER
                setPadding(0, 0, dp(context, 8), 0)
                contentDescription = "Drag caller card"
            }
            val title = TextView(context).apply {
                text = lead?.name ?: "Unknown caller"
                setTextColor(Color.WHITE)
                textSize = 16f
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
            header.addView(dragHandle)
            header.addView(title)
            header.addView(close)
            root.addView(header)
            addText(context, root, phone, 12f, Color.rgb(190, 196, 206), 2)
            if (lead == null) {
                addText(context, root, "NEW LEAD  ·  COMPANY CALLER", 11f, Color.rgb(255, 166, 115), 10)
                addText(context, root, "Lead details can be added after the call.", 11f, Color.rgb(190, 196, 206), 3)
            } else {
                listOfNotNull(
                    lead.stage.takeIf(String::isNotBlank)?.let { "Stage  ·  ${it.replace('_', ' ')}" },
                    lead.source.takeIf(String::isNotBlank)?.let { "Source  ·  $it" },
                ).take(2).forEachIndexed { index, value ->
                    addText(context, root, value, 11f, Color.rgb(218, 222, 230), if (index == 0) 8 else 4)
                }
            }

            val openCrm = TextView(context).apply {
                text = if (lead == null) "Add lead details after call" else "Open CRM details"
                textSize = 12f
                gravity = Gravity.CENTER
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
                setPadding(dp(context, 10), dp(context, 9), dp(context, 10), dp(context, 9))
                background = GradientDrawable().apply {
                    setColor(Color.rgb(255, 105, 45))
                    cornerRadius = dp(context, 11).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = dp(context, 10)
                }
                setOnClickListener { openDisposition(context) }
            }
            root.addView(openCrm)

            val params = WindowManager.LayoutParams(
                dp(context, 280),
                WindowManager.LayoutParams.WRAP_CONTENT,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = dp(context, 12)
                y = dp(context, 160)
            }
            windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            var downX = 0f
            var downY = 0f
            var startX = params.x
            var startY = params.y
            header.setOnTouchListener { _, event ->
                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        downX = event.rawX
                        downY = event.rawY
                        startX = params.x
                        startY = params.y
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = startX + (event.rawX - downX).toInt()
                        params.y = startY + (event.rawY - downY).toInt()
                        runCatching { windowManager?.updateViewLayout(root, params) }
                        true
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> true
                    else -> false
                }
            }
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
