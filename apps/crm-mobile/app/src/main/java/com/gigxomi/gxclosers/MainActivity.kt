package com.gigxomi.gxclosers

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.gigxomi.gxclosers.ui.GXClosersApp
import com.gigxomi.gxclosers.ui.theme.GXClosersTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { GXClosersTheme { GXClosersApp(intent.data) } }
    }
}
