package com.gigxomi.gxclosers.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Neutral surfaces keep the orange brand accent readable across the whole app.
// The previous green-black mix made cards and borders compete with each other.
val GxBackground = Color(0xFF101318)
val GxSurface = Color(0xFF181D24)
val GxSurface2 = Color(0xFF232A34)
val GxAccent = Color(0xFFFF6B2F) // Closer Orange matching web dashboard
val GxAccentSoft = Color(0x26FF6B2F)
val GxText = Color(0xFFF7F9FC)
val GxMuted = Color(0xFFB0BAC7)
val GxDanger = Color(0xFFFF7878)
val GxWarning = Color(0xFFF6C85F)
val GxSuccess = Color(0xFF48D597)

val GxOutline = Color(0xFF526070)
val GxOutlineSoft = Color(0xFF35404E)
private val GxBlue = Color(0xFF8CCBFF)

private val colors = darkColorScheme(
    primary = GxAccent,
    onPrimary = Color.White, // Always white on orange/primary background
    primaryContainer = Color(0xFF743419),
    onPrimaryContainer = Color(0xFFFFE7DD),
    secondary = GxBlue,
    onSecondary = Color(0xFF082033),
    secondaryContainer = Color(0xFF17364D),
    onSecondaryContainer = Color(0xFFD5ECFF),
    tertiary = GxSuccess,
    onTertiary = Color(0xFF062117),
    background = GxBackground,
    onBackground = GxText,
    surface = GxSurface,
    onSurface = GxText,
    surfaceVariant = GxSurface2,
    onSurfaceVariant = GxMuted,
    outline = GxOutline,
    outlineVariant = GxOutlineSoft,
    error = GxDanger,
    onError = Color.White
)

@Composable
fun GXClosersTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, content = content)
}
