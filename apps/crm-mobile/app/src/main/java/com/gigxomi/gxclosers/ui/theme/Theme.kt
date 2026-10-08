package com.gigxomi.gxclosers.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val GxBackground = Color(0xFF080B09)
val GxSurface = Color(0xFF111612)
val GxSurface2 = Color(0xFF192019)
val GxAccent = Color(0xFFFF6B2F) // Closer Orange matching web dashboard
val GxAccentSoft = Color(0x26FF6B2F)
val GxText = Color(0xFFF4F7F2)
val GxMuted = Color(0xFFA4AEA2)
val GxDanger = Color(0xFFFF6B6B)
val GxWarning = Color(0xFFFFC857)
val GxSuccess = Color(0xFF5EE38C)

private val colors = darkColorScheme(
    primary = GxAccent,
    onPrimary = Color.White, // Always white on orange/primary background
    background = GxBackground,
    onBackground = GxText,
    surface = GxSurface,
    onSurface = GxText,
    surfaceVariant = GxSurface2,
    onSurfaceVariant = GxMuted,
    error = GxDanger,
    onError = Color.White
)

@Composable
fun GXClosersTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, content = content)
}
