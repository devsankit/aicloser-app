package com.gigxomi.gxclosers.ui

import android.webkit.JavascriptInterface

class TrainingBridge(private val callback: (String) -> Unit) {
    @JavascriptInterface
    fun onProgress(raw: String) {
        callback(raw)
    }
}
