package com.gigxomi.gxclosers

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.gigxomi.gxclosers.data.SharedRecordingStore
import com.gigxomi.gxclosers.ui.CrmViewModel
import com.gigxomi.gxclosers.ui.GXClosersApp
import com.gigxomi.gxclosers.ui.theme.GXClosersTheme
import com.gigxomi.gxclosers.call.CallStateMonitorService
import androidx.core.content.ContextCompat

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.mutableStateOf

class MainActivity : ComponentActivity() {
    private val vm: CrmViewModel by viewModels()
    private val activeLink = mutableStateOf<Uri?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        activeLink.value = intent.data
        handleIncomingIntent(intent)
        enableEdgeToEdge()
        setContent { GXClosersTheme { GXClosersApp(activeLink.value, vm) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        activeLink.value = intent.data
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(incoming: Intent) {
        if (SharedRecordingStore.importIntent(this, incoming) != null) {
            vm.refreshSharedRecording()
        }
    }

    override fun onResume() {
        super.onResume()
        vm.onForeground()
        // Start monitoring as soon as the user opens AICloser. This must not
        // wait for setupComplete: on MIUI the process can be killed between
        // setup and the first call, while the foreground monitor is the part
        // that keeps the call-state handoff alive.
        runCatching {
            ContextCompat.startForegroundService(this, Intent(this, CallStateMonitorService::class.java))
        }
    }

    override fun onPause() {
        super.onPause()
        vm.onBackground()
    }
}
