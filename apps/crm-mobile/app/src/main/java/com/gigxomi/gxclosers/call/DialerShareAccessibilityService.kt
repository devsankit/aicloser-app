package com.gigxomi.gxclosers.call

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.util.Log

/** Receives visible Phone/share-sheet UI events after the user enables access. */
class DialerShareAccessibilityService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val poller = object : Runnable {
        override fun run() {
            runCatching {
                val root = rootInActiveWindow
                val packageName = root?.packageName?.toString()
                DialerShareAutomation.onAccessibilityWindow(this@DialerShareAccessibilityService, root, packageName)
            }.onFailure { error ->
                Log.w("GXShareAccess", "Ignoring accessibility poll", error)
            }
            handler.postDelayed(this, 500L)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
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
        super.onDestroy()
    }
}
