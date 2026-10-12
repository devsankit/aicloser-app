package com.gigxomi.gxclosers.ui.theme

import android.content.Context
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.graphics.Color

enum class ThemeMode { SYSTEM, LIGHT, DARK }

object ThemePreferenceStore {
    private const val PREFERENCES = "gxclosers_appearance"
    private const val KEY_MODE = "theme_mode"

    fun read(context: Context): ThemeMode = runCatching {
        ThemeMode.valueOf(
            context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                // Dark is the product default. Light remains an explicit
                // choice from Appearance; do not inherit the emulator's
                // system theme on a fresh install.
                .getString(KEY_MODE, ThemeMode.DARK.name)
                .orEmpty()
        )
    }.getOrDefault(ThemeMode.DARK)

    fun write(context: Context, mode: ThemeMode) {
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_MODE, mode.name)
            .apply()
    }
}

val LocalThemeMode = compositionLocalOf { ThemeMode.SYSTEM }
val LocalThemeModeChange = compositionLocalOf<(ThemeMode) -> Unit> { {} }

private val BrandOrange = Color(0xFFFF6B2F)
private val DarkBackground = Color(0xFF121417)
private val DarkSurface = Color(0xFF202429)
private val DarkSurfaceRaised = Color(0xFF2B3036)
private val DarkText = Color(0xFFF7F5F1)
private val DarkMuted = Color(0xFFB6B3AE)
private val LightBackground = Color(0xFFF6F3EE)
private val LightSurface = Color(0xFFFCFBF8)
private val LightSurfaceRaised = Color(0xFFFFFFFF)
private val LightText = Color(0xFF151922)
private val LightMuted = Color(0xFF686A70)

private val DarkColors = darkColorScheme(
    primary = BrandOrange,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF53301F),
    onPrimaryContainer = Color(0xFFFFE5D9),
    secondary = Color(0xFFE2DDD6),
    onSecondary = Color(0xFF292724),
    secondaryContainer = Color(0xFF4A342B),
    onSecondaryContainer = Color(0xFFFFE5D9),
    tertiary = Color(0xFF74D7A8),
    onTertiary = Color(0xFF0B2B1E),
    background = DarkBackground,
    onBackground = DarkText,
    surface = DarkSurface,
    onSurface = DarkText,
    surfaceVariant = DarkSurfaceRaised,
    onSurfaceVariant = DarkMuted,
    outline = Color(0xFF65676A),
    outlineVariant = Color(0xFF3D4044),
    error = Color(0xFFFF7A79),
    onError = Color.White,
)

private val LightColors = lightColorScheme(
    primary = BrandOrange,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDED1),
    onPrimaryContainer = Color(0xFF55200B),
    secondary = Color(0xFF5F5B56),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFFE3D7),
    onSecondaryContainer = Color(0xFF54210C),
    tertiary = Color(0xFF16875E),
    onTertiary = Color.White,
    background = LightBackground,
    onBackground = LightText,
    surface = LightSurface,
    onSurface = LightText,
    surfaceVariant = LightSurfaceRaised,
    onSurfaceVariant = LightMuted,
    outline = Color(0xFFA9A6A0),
    outlineVariant = Color(0xFFD9D5CF),
    error = Color(0xFFB3261E),
    onError = Color.White,
)

val GxBackground: Color @Composable get() = MaterialTheme.colorScheme.background
val GxSurface: Color @Composable get() = MaterialTheme.colorScheme.surface
val GxSurface2: Color @Composable get() = MaterialTheme.colorScheme.surfaceVariant
val GxAccent: Color get() = BrandOrange
val GxAccentSoft: Color get() = BrandOrange.copy(alpha = .13f)
val GxText: Color @Composable get() = MaterialTheme.colorScheme.onBackground
val GxMuted: Color @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant
val GxDanger: Color @Composable get() = MaterialTheme.colorScheme.error
val GxWarning: Color @Composable get() = if (MaterialTheme.colorScheme.background == DarkBackground) Color(0xFFF0BD63) else Color(0xFFA55A00)
val GxSuccess: Color @Composable get() = if (MaterialTheme.colorScheme.background == DarkBackground) Color(0xFF74D7A8) else Color(0xFF16875E)
val GxOutline: Color @Composable get() = MaterialTheme.colorScheme.outline
val GxOutlineSoft: Color @Composable get() = MaterialTheme.colorScheme.outlineVariant

@Composable
fun GXClosersTheme(
    themeMode: ThemeMode = ThemeMode.DARK,
    onThemeModeChange: (ThemeMode) -> Unit = {},
    content: @Composable () -> Unit,
) {
    val dark = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    CompositionLocalProvider(
        LocalThemeMode provides themeMode,
        LocalThemeModeChange provides onThemeModeChange,
    ) {
        MaterialTheme(colorScheme = if (dark) DarkColors else LightColors, content = content)
    }
}
