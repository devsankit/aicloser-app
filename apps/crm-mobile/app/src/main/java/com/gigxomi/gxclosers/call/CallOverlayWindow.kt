package com.gigxomi.gxclosers.call

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.util.Log
import com.gigxomi.gxclosers.MainActivity

/**
 * Truecaller-style caller context card. The Accessibility service supplies
 * the preferred window type, which lets the card appear on Pixel/Google Phone
 * without asking for the broader "draw over other apps" permission.
 */
object CallOverlayWindow {
    private var windowManager: WindowManager? = null
    private var card: View? = null

    fun show(
        context: Context,
        phone: String,
        windowType: Int = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    ) {
        val needsOverlayPermission = windowType == WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        if (phone.isBlank() || needsOverlayPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) return
        Handler(Looper.getMainLooper()).post {
            // The caller is already on the main looper here. A posted remove
            // would run after addView and immediately delete the new card.
            removeNow()
            val lead = CallManager.lookup(context, phone)
            val root = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(context, 16), dp(context, 14), dp(context, 16), dp(context, 14))
                background = GradientDrawable(
                    GradientDrawable.Orientation.TL_BR,
                    intArrayOf(Color.argb(246, 18, 28, 34), Color.argb(232, 7, 12, 17)),
                ).apply {
                    cornerRadius = dp(context, 22).toFloat()
                    setStroke(dp(context, 1), Color.argb(92, 255, 255, 255))
                }
                elevation = dp(context, 18).toFloat()
            }

            root.addView(TextView(context).apply {
                text = "AI CLOSER  •  CALL CONTEXT"
                setTextColor(ACCENT)
                textSize = 10f
                typeface = Typeface.DEFAULT_BOLD
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) letterSpacing = 0.08f
            })

            val header = LinearLayout(context).apply {
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(context, 10), 0, 0)
            }
            header.addView(TextView(context).apply {
                text = initials(lead?.name ?: "Caller")
                gravity = Gravity.CENTER
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(ACCENT)
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.argb(45, 255, 107, 47))
                    setStroke(dp(context, 1), Color.argb(150, 255, 107, 47))
                }
                layoutParams = LinearLayout.LayoutParams(dp(context, 44), dp(context, 44))
            })

            val identity = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(context, 12), 0, dp(context, 8), 0)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            identity.addView(TextView(context).apply {
                text = lead?.name ?: "Unknown caller"
                setTextColor(Color.WHITE)
                textSize = 18f
                typeface = Typeface.DEFAULT_BOLD
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
            })
            identity.addView(TextView(context).apply {
                text = lead?.phone ?: phone
                setTextColor(MUTED)
                textSize = 12f
                setPadding(0, dp(context, 3), 0, 0)
            })
            header.addView(identity)
            header.addView(TextView(context).apply {
                text = "LIVE"
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                textSize = 10f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(dp(context, 8), dp(context, 5), dp(context, 8), dp(context, 5))
                background = GradientDrawable().apply {
                    setColor(Color.argb(225, 255, 107, 47))
                    cornerRadius = dp(context, 99).toFloat()
                }
            })
            header.addView(TextView(context).apply {
                text = "×"
                contentDescription = "Close caller information"
                gravity = Gravity.CENTER
                setTextColor(Color.argb(220, 247, 251, 255))
                textSize = 27f
                setPadding(dp(context, 10), 0, 0, dp(context, 2))
                minimumWidth = dp(context, 48)
                minimumHeight = dp(context, 48)
                setOnClickListener { remove() }
            })
            root.addView(header)

            if (lead != null) {
                val meta = listOfNotNull(
                    lead.stage.takeIf(String::isNotBlank)?.replace('_', ' '),
                    lead.source.takeIf(String::isNotBlank),
                ).joinToString("  ·  ")
                if (meta.isNotBlank()) addText(context, root, meta.uppercase(), 10f, Color.argb(220, 218, 222, 230), 10)
                addText(context, root, "LAST NOTE", 10f, Color.argb(190, 255, 107, 47), 14)
                val lastNote = lead.lastTouchSummary.ifBlank { lead.notes }.trim()
                addText(
                    context,
                    root,
                    if (lastNote.isBlank()) "No previous note saved" else lastNote,
                    12f,
                    if (lastNote.isBlank()) MUTED else Color.argb(238, 247, 251, 255),
                    5,
                    maxLines = 3,
                )
            } else {
                addText(context, root, "NEW LEAD  ·  NO CRM MATCH", 10f, Color.argb(220, 255, 166, 115), 12)
                addText(context, root, "Save caller context after the call", 12f, MUTED, 5)
            }

            root.addView(TextView(context).apply {
                text = if (lead == null) "Add caller to AI Closer" else "Open AI Closer"
                gravity = Gravity.CENTER
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
                textSize = 12f
                setPadding(dp(context, 12), dp(context, 11), dp(context, 12), dp(context, 11))
                background = GradientDrawable().apply {
                    setColor(Color.argb(232, 255, 107, 47))
                    cornerRadius = dp(context, 13).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = dp(context, 14)
                }
                setOnClickListener { openCaller(context, phone, lead?.id) }
            })

            val maxWidth = context.resources.displayMetrics.widthPixels - dp(context, 24)
            val params = WindowManager.LayoutParams(
                minOf(dp(context, 344), maxWidth),
                WindowManager.LayoutParams.WRAP_CONTENT,
                windowType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                y = dp(context, 88)
            }
            windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            var downX = 0f
            var downY = 0f
            var startX = params.x
            var startY = params.y
            root.setOnTouchListener { _, event ->
                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        downX = event.rawX
                        downY = event.rawY
                        startX = params.x
                        startY = params.y
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val maxHorizontalOffset = ((context.resources.displayMetrics.widthPixels - maxWidth) / 2).coerceAtLeast(0)
                        val maxVerticalOffset = (context.resources.displayMetrics.heightPixels - root.height - dp(context, 32)).coerceAtLeast(dp(context, 32))
                        params.x = (startX + event.rawX - downX).toInt().coerceIn(-maxHorizontalOffset, maxHorizontalOffset)
                        params.y = (startY + event.rawY - downY).toInt().coerceIn(dp(context, 32), maxVerticalOffset)
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
                Log.i(TAG, "caller info card attached type=$windowType phone=$phone")
            }.onFailure { error -> Log.e(TAG, "caller info card attach failed", error) }
        }
    }

    fun remove() {
        if (Looper.myLooper() == Looper.getMainLooper()) removeNow()
        else Handler(Looper.getMainLooper()).post { removeNow() }
    }

    private fun removeNow() {
        card?.let { runCatching { windowManager?.removeView(it) } }
        card = null
    }

    private fun addText(
        context: Context,
        parent: LinearLayout,
        value: String,
        size: Float,
        color: Int,
        top: Int,
        maxLines: Int = 1,
    ) {
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

    private fun openCaller(context: Context, phone: String, leadId: String?) {
        val prefs = context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE)
        val callId = prefs.getString("activeCallId", null).orEmpty()
        val uri = when {
            callId.isNotBlank() -> Uri.parse("gxclosers://disposition/$callId")
            !leadId.isNullOrBlank() -> Uri.parse("gxclosers://lead/${Uri.encode(leadId)}")
            else -> Uri.parse("gxclosers://lead/${Uri.encode(phone)}")
        }
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = uri
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        runCatching { context.startActivity(intent) }
        remove()
    }

    private fun initials(name: String): String = name.trim().split(Regex("\\s+")).filter(String::isNotBlank).take(2).joinToString("") { it.first().uppercase() }.ifBlank { "?" }

    private fun dp(context: Context, value: Int) = (value * context.resources.displayMetrics.density).toInt()

    private const val ACCENT = 0xFFFF6B2F.toInt()
    private const val MUTED = 0xFF9BA8B4.toInt()
    private const val TAG = "GXCallOverlay"
}
