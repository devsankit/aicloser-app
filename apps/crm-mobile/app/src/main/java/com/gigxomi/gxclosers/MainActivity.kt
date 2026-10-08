package com.gigxomi.gxclosers

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.gigxomi.gxclosers.ui.CrmViewModel
import com.gigxomi.gxclosers.ui.GXClosersApp
import com.gigxomi.gxclosers.ui.theme.GXClosersTheme

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.mutableStateOf

class MainActivity : ComponentActivity() {
    private val vm: CrmViewModel by viewModels()
    private val activeLink = mutableStateOf<Uri?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        activeLink.value = intent.data
        enableEdgeToEdge()
        setContent { GXClosersTheme { GXClosersApp(activeLink.value, vm) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        activeLink.value = intent.data
    }

    override fun onResume() {
        super.onResume()
        vm.onForeground()
    }

    override fun onPause() {
        super.onPause()
        vm.onBackground()
    }
}
