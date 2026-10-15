package com.gigxomi.gxclosers.call

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.WindowManager
import android.util.Log

/** Receives visible Phone/share-sheet UI events after the user enables access. */
class DialerShareAccessibilityService : AccessibilityService() {
    companion object {
        @Volatile
        private var activeService: DialerShareAccessibilityService? = null

        /** Shows the caller card through the already-enabled accessibility channel. */
        fun showCallerCard(context: android.content.Context, phone: String): Boolean {
            val service = activeService ?: return false
            service.handler.post {
                CallOverlayWindow.show(
                    service,
                    phone,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                )
            }
            return true
        }

        fun hideCallerCard() {
            activeService?.handler?.post { CallOverlayWindow.remove() }
        }
    }

    private var dynamicReceiver: PhoneStateReceiver? = null
    private val handler = Handler(Looper.getMainLooper())
    private val poller = object : Runnable {
        override fun run() {
            if (DialerShareAutomation.isArmed(this@DialerShareAccessibilityService)) {
                runCatching {
                    val root = rootInActiveWindow
                    val packageName = root?.packageName?.toString()
                    DialerShareAutomation.onAccessibilityWindow(this@DialerShareAccessibilityService, root, packageName)
                }.onFailure { error ->
                    Log.w("GXShareAccess", "Ignoring accessibility poll", error)
                }
                handler.postDelayed(this, 500L)
            } else {
                // When disarmed, relax polling to prevent CPU and window-traversal battery drain
                handler.postDelayed(this, 5_000L)
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        activeService = this
        if (dynamicReceiver == null) {
            runCatching {
                val receiver = PhoneStateReceiver()
                val filter = android.content.IntentFilter().apply {
                    addAction(android.telephony.TelephonyManager.ACTION_PHONE_STATE_CHANGED)
                    @Suppress("DEPRECATION")
                    addAction(android.content.Intent.ACTION_NEW_OUTGOING_CALL)
                }
                androidx.core.content.ContextCompat.registerReceiver(
                    this,
                    receiver,
                    filter,
                    androidx.core.content.ContextCompat.RECEIVER_EXPORTED,
                )
                dynamicReceiver = receiver
                Log.i("GXShareAccess", "Dynamically registered PhoneStateReceiver in AccessibilityService")
            }.onFailure { Log.w("GXShareAccess", "Could not register PhoneStateReceiver in a11y", it) }
        }
        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = flags or
                AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 100
        }
        Log.i("GXShareAccess", "Accessibility bridge connected")
        handler.removeCallbacks(poller)
        handler.post(poller)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        runCatching {
            if (event == null) return
            DialerShareAutomation.onAccessibilityWindow(this, rootInActiveWindow, event.packageName?.toString())
        }.onFailure { error ->
            Log.w("GXShareAccess", "Ignoring unsafe accessibility event", error)
        }
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        handler.removeCallbacks(poller)
        CallOverlayWindow.remove()
        if (activeService === this) dynamicReceiver?.let {
            runCatching { unregisterReceiver(it) }
            dynamicReceiver = null
        }
        activeService = null
        super.onDestroy()
    }
}
