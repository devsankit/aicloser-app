package com.gigxomi.gxclosers.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.BatteryChargingFull
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.SignalCellularAlt
import androidx.compose.material.icons.outlined.SimCard
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gigxomi.gxclosers.R
import com.gigxomi.gxclosers.ui.theme.GxAccent
import com.gigxomi.gxclosers.ui.theme.GxMuted
import com.gigxomi.gxclosers.ui.theme.GxOutlineSoft
import com.gigxomi.gxclosers.ui.theme.GxSurface
import com.gigxomi.gxclosers.ui.theme.GxText
import com.gigxomi.gxclosers.ui.theme.LocalThemeMode
import com.gigxomi.gxclosers.ui.theme.LocalThemeModeChange
import com.gigxomi.gxclosers.ui.theme.ThemeMode

val GxOrange = Color(0xFFFE6420)
val GxGreen = Color(0xFF3CB64D)
val GxDarkBg = Color(0xFF090B0D)
val GxCardDark = Color(0xFF171A1E)
val GxCardBorder = Color(0x1FFFFFFF)
val GxMutedText = Color(0xFF8E95A2)

data class GxFooterItem(val label: String, val icon: ImageVector)

@Composable
fun GxAppFooter(
    items: List<GxFooterItem>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val navShape = RoundedCornerShape(30.dp)
    Box(
        modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            color = GxSurface,
            shape = navShape,
            border = BorderStroke(1.dp, GxOutlineSoft),
            tonalElevation = 0.dp,
            shadowElevation = 12.dp,
            modifier = Modifier
                .fillMaxWidth(.92f)
                .widthIn(min = 300.dp, max = 560.dp)
                .heightIn(min = 78.dp),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(68.dp)
                    .padding(horizontal = 6.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items.forEachIndexed { index, item ->
                    val active = selected == index
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(24.dp))
                            .background(if (active) GxAccent.copy(alpha = .14f) else Color.Transparent)
                            .clickable { onSelect(index) }
                            .padding(horizontal = 2.dp, vertical = 2.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Box(
                            Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(if (active) GxAccent.copy(alpha = .16f) else Color.Transparent)
                                .border(BorderStroke(1.dp, if (active) GxAccent.copy(alpha = .42f) else Color.Transparent), CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(item.icon, item.label, tint = if (active) GxAccent else GxMuted, modifier = Modifier.size(19.dp))
                        }
                        Spacer(Modifier.height(2.dp))
                        Text(
                            item.label,
                            color = if (active) GxText else GxMuted,
                            fontSize = 11.sp,
                            lineHeight = 14.sp,
                            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                            maxLines = 1,
                            softWrap = false,
                        )
                    }
                }
            }
        }
    }
}

enum class GxBackdropKind { TELEPHONY, CRM, COMMUNICATION, NEUTRAL }

@Composable
fun GxScreenBackdrop(
    kind: GxBackdropKind,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val dark = MaterialTheme.colorScheme.background.luminance() < .5f
    val line = if (dark) Color.White.copy(alpha = .040f) else Color(0xFF7C756E).copy(alpha = .045f)
    val mass = if (dark) Color(0xFF747B83).copy(alpha = .10f) else Color(0xFFC7BBAE).copy(alpha = .13f)
    val wave = 0f
    val photoBackdrop = kind != GxBackdropKind.NEUTRAL
    Box(modifier.fillMaxSize().background(if (dark) GxDarkBg else MaterialTheme.colorScheme.background)) {
        if (photoBackdrop && kind == GxBackdropKind.TELEPHONY) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(480.dp)
            ) {
                Image(
                    painter = painterResource(R.drawable.login_telephony_background),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    alignment = Alignment.TopCenter,
                    modifier = Modifier.fillMaxSize(),
                    alpha = if (dark) 0.50f else 0.35f,
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                0.00f to Color(0xFF090B0D).copy(alpha = 0.40f),
                                0.20f to Color.Transparent,
                                0.50f to Color(0xFF090B0D).copy(alpha = 0.50f),
                                0.72f to Color(0xFF090B0D).copy(alpha = 0.88f),
                                0.88f to Color(0xFF090B0D),
                                1.00f to Color(0xFF090B0D),
                            )
                        )
                )
            }
        }
        if (!photoBackdrop) Canvas(Modifier.fillMaxSize()) {
            val driftX = size.width * .035f * wave
            when (kind) {
                GxBackdropKind.TELEPHONY -> {
                    val radius = size.minDimension * .47f
                    val leftGlow = Offset(size.width * .17f + driftX, size.height * .25f)
                    val rightGlow = Offset(size.width * .78f - driftX * .55f, size.height * .32f)
                    drawCircle(
                        Brush.radialGradient(listOf(mass.copy(alpha = mass.alpha * 1.45f), mass.copy(alpha = .015f), Color.Transparent), center = leftGlow, radius = radius * 1.22f),
                        radius * 1.22f,
                        leftGlow,
                    )
                    drawCircle(
                        Brush.radialGradient(listOf(mass.copy(alpha = mass.alpha), Color.Transparent), center = rightGlow, radius = radius * .9f),
                        radius * .9f,
                        rightGlow,
                    )
                    val speakerTop = Offset(size.width * -.08f + driftX, size.height * .30f)
                    val speakerSize = Size(size.width * 1.16f, size.height * .28f)
                    drawOval(
                        brush = Brush.linearGradient(listOf(mass.copy(alpha = .17f), Color.Transparent, mass.copy(alpha = .06f))),
                        topLeft = speakerTop,
                        size = speakerSize,
                    )
                    repeat(6) { ring ->
                        drawArc(
                            color = line,
                            startAngle = 204f,
                            sweepAngle = 252f,
                            useCenter = false,
                            topLeft = Offset(-radius * .76f + driftX + ring * 18f, radius * .12f + ring * 18f),
                            size = Size(radius * 2f - ring * 36f, radius * 2f - ring * 36f),
                            style = Stroke(width = if (ring == 0) 2.5f else 1.5f),
                        )
                    }
                    repeat(15) { index ->
                        val x = size.width * (.10f + index * .058f) + driftX * (index % 2)
                        val amplitude = size.height * (.014f + ((index + 2) % 4) * .009f)
                        drawLine(line.copy(alpha = line.alpha * .9f), Offset(x, size.height * .46f - amplitude), Offset(x, size.height * .46f + amplitude), 2.2f)
                    }
                }
                GxBackdropKind.CRM -> {
                    drawCircle(Brush.radialGradient(listOf(mass, Color.Transparent), center = Offset(size.width * .86f - driftX, size.height * .18f), radius = size.minDimension * .62f), size.minDimension * .62f, Offset(size.width * .86f - driftX, size.height * .18f))
                    repeat(7) { row ->
                        val y = size.height * (.14f + row * .085f) + driftX * .14f
                        drawLine(line, Offset(size.width * .08f, y), Offset(size.width * .92f, y), 1.5f)
                    }
                }
                GxBackdropKind.COMMUNICATION -> {
                    drawCircle(Brush.radialGradient(listOf(mass, Color.Transparent), center = Offset(size.width * .14f + driftX, size.height * .24f), radius = size.minDimension * .55f), size.minDimension * .55f, Offset(size.width * .14f + driftX, size.height * .24f))
                    repeat(4) { row ->
                        val y = size.height * (.13f + row * .07f)
                        drawRoundRect(line, Offset(size.width * (.16f + (row % 2) * .12f) + driftX, y), Size(size.width * .58f, 28f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(14f))
                    }
                }
                GxBackdropKind.NEUTRAL -> {
                    drawCircle(Brush.radialGradient(listOf(mass, Color.Transparent), center = Offset(size.width * .90f - driftX, size.height * .08f), radius = size.minDimension * .60f), size.minDimension * .60f, Offset(size.width * .90f - driftX, size.height * .08f))
                }
            }
        }
        content()
    }
}

@Composable
fun GxGlassSurface(
    modifier: Modifier = Modifier,
    radius: Dp = 24.dp,
    padding: Dp = 16.dp,
    accent: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val dark = MaterialTheme.colorScheme.background.luminance() < .5f
    val fill = if (dark) Color(0xFF272B30).copy(alpha = .90f) else Color(0xFFFFFEFC).copy(alpha = .90f)
    val edge = if (accent) GxAccent.copy(alpha = .34f) else if (dark) Color.White.copy(alpha = .09f) else Color.White.copy(alpha = .72f)
    val shape = RoundedCornerShape(radius)
    Box(
        modifier = modifier
            .clip(shape)
            .background(fill)
            .border(BorderStroke(1.dp, edge), shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(padding),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content,
        )
    }
}

@Composable
fun GxPremiumHeader(
    greeting: String,
    headline: String,
    notificationCount: Int = 0,
    onNotificationsClick: () -> Unit = {},
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            androidx.compose.foundation.Image(
                painter = painterResource(R.drawable.ic_ai_closer_logo),
                contentDescription = "AI Closer",
                modifier = Modifier.size(37.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text("Closer", color = GxText, fontSize = 23.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                GxThemeToggle()
                Box(contentAlignment = Alignment.Center) {
                Surface(
                    color = GxSurface,
                    shape = CircleShape,
                    border = BorderStroke(1.dp, GxText.copy(alpha = .08f)),
                    modifier = Modifier.size(44.dp),
                ) {
                    IconButton(onClick = onNotificationsClick) {
                        Icon(Icons.Outlined.NotificationsNone, "Notifications", tint = GxText, modifier = Modifier.size(21.dp))
                    }
                }
                if (notificationCount > 0) {
                    Surface(color = GxAccent, shape = CircleShape, modifier = Modifier.align(Alignment.TopEnd).size(17.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(notificationCount.coerceAtMost(9).toString(), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                }
            }
        }
        Text(greeting, color = GxMuted, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Text(headline, color = GxText, fontSize = 24.sp, lineHeight = 29.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.5).sp)
    }
}

@Composable
fun GxThemeToggle(modifier: Modifier = Modifier) {
    val mode = LocalThemeMode.current
    val setMode = LocalThemeModeChange.current
    val dark = MaterialTheme.colorScheme.background.luminance() < .5f
    Surface(
        color = GxSurface,
        shape = CircleShape,
        border = BorderStroke(1.dp, GxText.copy(alpha = .08f)),
        modifier = modifier.size(40.dp),
    ) {
        IconButton(
            onClick = {
                setMode(if (mode == ThemeMode.DARK || (mode == ThemeMode.SYSTEM && dark)) ThemeMode.LIGHT else ThemeMode.DARK)
            },
            modifier = Modifier.fillMaxSize(),
        ) {
            GxThemeGlyph(dark = dark)
        }
    }
}

@Composable
private fun GxThemeGlyph(dark: Boolean) {
    val color = GxText
    val cutout = MaterialTheme.colorScheme.surface
    Canvas(Modifier.size(20.dp)) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val radius = size.minDimension * .25f
        drawCircle(color, radius, center)
        repeat(8) { index ->
            val angle = Math.toRadians((index * 45.0).toDouble())
            val inner = size.minDimension * .37f
            val outer = size.minDimension * .48f
            drawLine(
                color,
                Offset(center.x + kotlin.math.cos(angle).toFloat() * inner, center.y + kotlin.math.sin(angle).toFloat() * inner),
                Offset(center.x + kotlin.math.cos(angle).toFloat() * outer, center.y + kotlin.math.sin(angle).toFloat() * outer),
                strokeWidth = 1.6.dp.toPx(),
                cap = StrokeCap.Round,
            )
        }
        if (dark) {
            drawCircle(cutout, radius * .75f, Offset(center.x + radius * .65f, center.y - radius * .65f))
        }
    }
}

@Composable
fun GxWorkspaceHeader(
    title: String,
    subtitle: String,
    notificationCount: Int = 0,
    onNotificationsClick: () -> Unit = {},
    action: (@Composable () -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            androidx.compose.foundation.Image(
                painter = painterResource(R.drawable.ic_ai_closer_logo),
                contentDescription = "AI Closer",
                modifier = Modifier.size(34.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text("Closer", color = GxText, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            if (action != null) {
                action()
            } else {
                GxThemeToggle()
                Spacer(Modifier.width(2.dp))
                Box(contentAlignment = Alignment.Center) {
                    Surface(
                        color = GxSurface,
                        shape = CircleShape,
                        border = BorderStroke(1.dp, GxText.copy(alpha = .08f)),
                        modifier = Modifier.size(40.dp),
                    ) {
                        IconButton(onClick = onNotificationsClick) {
                            Icon(Icons.Outlined.NotificationsNone, "Notifications", tint = GxText, modifier = Modifier.size(20.dp))
                        }
                    }
                    if (notificationCount > 0) {
                        Surface(color = GxAccent, shape = CircleShape, modifier = Modifier.align(Alignment.TopEnd).size(16.dp)) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(notificationCount.coerceAtMost(9).toString(), color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
        Text(title, color = GxText, fontSize = 25.sp, lineHeight = 29.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.5).sp)
        Text(subtitle, color = GxMuted, fontSize = 13.sp)
    }
}

@Composable
fun GxCommandDial(
    value: Int,
    label: String,
    progress: Float,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    val textColor = GxText
    val animatedProgress by animateFloatAsState(
        targetValue = progress.coerceIn(.04f, 1f),
        animationSpec = tween(900),
        label = "dial-progress",
    )
    val transition = rememberInfiniteTransition(label = "dial-pulse")
    val pulse by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(2600, easing = LinearEasing), RepeatMode.Reverse),
        label = "dial-pulse-value",
    )
    val centerScale = 1f + (kotlin.math.sin(pulse * Math.PI).toFloat() * .012f)
    Box(modifier.size(168.dp), contentAlignment = Alignment.Center) {
        val track = textColor.copy(alpha = .10f)
        Canvas(Modifier.fillMaxSize()) {
            val stroke = 13.dp.toPx()
            val inset = stroke / 2f + 2.dp.toPx()
            drawArc(track, 135f, 270f, false, Offset(inset, inset), Size(size.width - inset * 2, size.height - inset * 2), style = Stroke(stroke, cap = StrokeCap.Round))
            drawArc(GxAccent, 135f, 270f * animatedProgress, false, Offset(inset, inset), Size(size.width - inset * 2, size.height - inset * 2), style = Stroke(stroke, cap = StrokeCap.Round))
            repeat(22) { index ->
                val angle = Math.toRadians((135f + index * (270f / 21f)).toDouble())
                val outer = size.minDimension / 2f - 1.dp.toPx()
                val inner = outer - 5.dp.toPx()
                val center = Offset(size.width / 2f, size.height / 2f)
                drawLine(
                    color = textColor.copy(alpha = .24f),
                    start = Offset(center.x + kotlin.math.cos(angle).toFloat() * inner, center.y + kotlin.math.sin(angle).toFloat() * inner),
                    end = Offset(center.x + kotlin.math.cos(angle).toFloat() * outer, center.y + kotlin.math.sin(angle).toFloat() * outer),
                    strokeWidth = 1.dp.toPx(),
                )
            }
        }
        Box(
            modifier = Modifier
                .size(122.dp)
                .graphicsLayer { scaleX = centerScale; scaleY = centerScale }
                .clip(CircleShape)
                .background(GxSurface)
                .border(BorderStroke(1.dp, GxText.copy(alpha = .10f)), CircleShape),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                if (icon != null) Icon(icon, null, tint = GxAccent, modifier = Modifier.size(21.dp))
                Text(value.toString(), color = GxText, fontSize = 34.sp, lineHeight = 38.sp, fontWeight = FontWeight.SemiBold)
                Text(label, color = GxMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
fun GxMetricBubble(value: String, label: String, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(22.dp)
    Box(
        modifier = modifier
            .clip(shape)
            .background(GxSurface)
            .border(BorderStroke(1.dp, GxText.copy(alpha = .10f)), shape),
    ) {
        Column(Modifier.padding(horizontal = 13.dp, vertical = 11.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = GxText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
            Text(label, color = GxMuted, fontSize = 10.sp, textAlign = TextAlign.Center)
        }
    }
}

data class GxStripAction(
    val icon: ImageVector,
    val label: String,
    val enabled: Boolean = true,
    val onClick: () -> Unit,
)

@Composable
fun GxPrimaryActionRow(
    title: String,
    detail: String,
    icon: ImageVector,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val contentAlpha = if (enabled) 1f else .68f
    val dark = MaterialTheme.colorScheme.background.luminance() < .5f
    val iconFill = if (enabled) GxAccent else if (dark) Color(0xFF7E4430) else Color(0xFFFFB08F)
    val rowShape = RoundedCornerShape(24.dp)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(rowShape)
            .background(GxSurface)
            .border(BorderStroke(1.dp, GxText.copy(alpha = .08f)), rowShape)
            .clickable(enabled = enabled, onClick = onClick),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(iconFill),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (title.contains("Grab", ignoreCase = true)) {
                        Text("U⁺", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-1.2).sp)
                    } else {
                        Icon(icon, null, tint = Color.White, modifier = Modifier.size(24.dp))
                    }
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, color = GxText.copy(alpha = contentAlpha), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Text(detail, color = GxMuted.copy(alpha = contentAlpha), fontSize = 12.sp)
            }
            Icon(androidx.compose.material.icons.Icons.Default.ChevronRight, null, tint = GxText.copy(alpha = contentAlpha), modifier = Modifier.size(21.dp))
        }
    }
}

@Composable
fun GxActionStrip(actions: List<GxStripAction>, modifier: Modifier = Modifier) {
    val stripShape = RoundedCornerShape(22.dp)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(stripShape)
            .background(GxSurface)
            .border(BorderStroke(1.dp, GxText.copy(alpha = .07f)), stripShape),
    ) {
        Row(Modifier.height(76.dp), verticalAlignment = Alignment.CenterVertically) {
            actions.forEachIndexed { index, action ->
                Column(
                    modifier = Modifier.weight(1f).fillMaxSize().clickable(enabled = action.enabled, onClick = action.onClick),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(action.icon, action.label, tint = if (action.enabled) GxText else GxMuted.copy(alpha = .45f), modifier = Modifier.size(21.dp))
                    Spacer(Modifier.height(5.dp))
                    Text(action.label, color = if (action.enabled) GxMuted else GxMuted.copy(alpha = .45f), fontSize = 10.sp, maxLines = 1)
                }
                if (index < actions.lastIndex) VerticalDivider(color = GxText.copy(alpha = .08f), modifier = Modifier.height(34.dp))
            }
        }
    }
}

@Composable
fun GxIconAction(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val actionShape = RoundedCornerShape(20.dp)
    Box(
        modifier = modifier
            .clip(actionShape)
            .background(GxSurface)
            .border(BorderStroke(1.dp, GxText.copy(alpha = .10f)), actionShape)
            .clickable(onClick = onClick),
    ) {
        Column(Modifier.padding(vertical = 13.dp, horizontal = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, label, tint = GxText, modifier = Modifier.size(21.dp))
            Spacer(Modifier.height(5.dp))
            Text(label, color = GxMuted, fontSize = 10.sp, maxLines = 1)
        }
    }
}

@Composable
fun AiCloserLogoHeader(
    modifier: Modifier = Modifier,
    badgeSize: androidx.compose.ui.unit.Dp = 34.dp,
    badgeTextSize: androidx.compose.ui.unit.TextUnit = 15.sp,
    closerTextSize: androidx.compose.ui.unit.TextUnit = 21.sp,
    rightContent: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                color = GxOrange,
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.size(badgeSize),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        "AI",
                        color = Color.White,
                        fontSize = badgeTextSize,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-0.5).sp,
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
            Text(
                "Closer",
                color = Color.White,
                fontSize = closerTextSize,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp,
            )
        }
        if (rightContent != null) {
            rightContent()
        }
    }
}

@Composable
fun SetupStepper(
    step: Int,
    total: Int = 4,
    textAbove: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (textAbove) {
            Text(
                "${step + 1} of $total",
                color = GxMutedText,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
            repeat(total) { index ->
                val isActive = index <= step
                val barWidth = when {
                    index == step -> 26.dp
                    index < step -> 22.dp
                    else -> 8.dp
                }
                Box(
                    modifier = Modifier
                        .width(barWidth)
                        .height(3.5.dp)
                        .clip(RoundedCornerShape(99.dp))
                        .background(if (isActive) GxOrange else Color(0xFF383D45)),
                )
            }
        }
        if (!textAbove) {
            Text(
                "${step + 1} of $total",
                color = GxMutedText,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
fun DialGaugeHero(
    step: Int,
    value: String = "10",
    label: String = "sec",
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(180.dp),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(164.dp)) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val radius = size.minDimension / 2f

            drawCircle(color = Color(0xFF14171A), radius = radius)
            drawCircle(color = Color.White.copy(alpha = 0.08f), radius = radius, style = Stroke(width = 1.dp.toPx()))

            val tickCount = 44
            for (i in 0 until tickCount) {
                val angle = Math.toRadians((i * (360.0 / tickCount) - 90).toDouble())
                val innerR = radius - 15.dp.toPx()
                val outerR = radius - 8.dp.toPx()
                val tickColor = Color.White.copy(alpha = 0.18f)
                drawLine(
                    color = tickColor,
                    start = Offset(center.x + kotlin.math.cos(angle).toFloat() * innerR, center.y + kotlin.math.sin(angle).toFloat() * innerR),
                    end = Offset(center.x + kotlin.math.cos(angle).toFloat() * outerR, center.y + kotlin.math.sin(angle).toFloat() * outerR),
                    strokeWidth = 1.2.dp.toPx(),
                    cap = StrokeCap.Round,
                )
            }

            val arcInset = 11.dp.toPx()
            drawArc(
                color = GxOrange,
                startAngle = -90f,
                sweepAngle = 120f,
                useCenter = false,
                topLeft = Offset(arcInset, arcInset),
                size = Size(size.width - arcInset * 2, size.height - arcInset * 2),
                style = Stroke(width = 6.dp.toPx(), cap = StrokeCap.Round),
            )
        }

        if (step == 0) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                val heights = listOf(14.dp, 24.dp, 34.dp, 44.dp, 56.dp, 44.dp, 34.dp, 24.dp, 14.dp)
                heights.forEachIndexed { i, h ->
                    val isCenter = i == heights.size / 2
                    val isInner = kotlin.math.abs(i - heights.size / 2) == 1
                    val color = when {
                        isCenter -> GxOrange
                        isInner -> Color(0xFFD2D6DE)
                        else -> Color(0xFF5E6573)
                    }
                    Box(
                        modifier = Modifier
                            .width(3.5.dp)
                            .height(h)
                            .clip(RoundedCornerShape(99.dp))
                            .background(color),
                    )
                }
            }
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    value,
                    color = Color.White,
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.5).sp,
                )
                Text(
                    label,
                    color = GxMutedText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
    }
}

@Composable
fun SimTrayHero(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(175.dp),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height

            // Soft warm orange glow centered around SIM tray
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(GxOrange.copy(alpha = 0.45f), GxOrange.copy(alpha = 0.12f), Color.Transparent),
                    center = Offset(w * 0.44f, h * 0.58f),
                    radius = 110.dp.toPx(),
                ),
                radius = 110.dp.toPx(),
                center = Offset(w * 0.44f, h * 0.58f),
            )

            // Phone chassis / body in perspective
            val phoneTop = h * 0.12f
            val phoneW = w * 0.88f
            val phoneH = 96.dp.toPx()
            val phoneX = (w - phoneW) / 2f

            drawRoundRect(
                brush = Brush.verticalGradient(
                    listOf(Color(0xFF282C34), Color(0xFF16181D)),
                    startY = phoneTop,
                    endY = phoneTop + phoneH,
                ),
                topLeft = Offset(phoneX, phoneTop),
                size = Size(phoneW, phoneH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(20.dp.toPx()),
            )
            // Metallic chamfer edge highlight
            drawRoundRect(
                brush = Brush.linearGradient(
                    listOf(Color.White.copy(alpha = 0.18f), Color.White.copy(alpha = 0.04f)),
                ),
                topLeft = Offset(phoneX, phoneTop),
                size = Size(phoneW, phoneH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(20.dp.toPx()),
                style = Stroke(width = 1.2.dp.toPx()),
            )

            // SIM tray slot cavity
            val slotW = 106.dp.toPx()
            val slotH = 36.dp.toPx()
            val slotX = w * 0.38f
            val slotY = phoneTop + 14.dp.toPx()
            drawRoundRect(
                color = Color(0xFF0A0C0E),
                topLeft = Offset(slotX, slotY),
                size = Size(slotW, slotH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx()),
            )
            drawRoundRect(
                color = Color.White.copy(alpha = 0.12f),
                topLeft = Offset(slotX, slotY),
                size = Size(slotW, slotH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx()),
                style = Stroke(width = 1.dp.toPx()),
            )

            // Extruded SIM tray
            val trayW = 92.dp.toPx()
            val trayH = 50.dp.toPx()
            val trayX = slotX - 32.dp.toPx()
            val trayY = slotY + 16.dp.toPx()

            drawRoundRect(
                brush = Brush.linearGradient(
                    listOf(Color(0xFF2E333C), Color(0xFF191C21)),
                ),
                topLeft = Offset(trayX, trayY),
                size = Size(trayW, trayH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(9.dp.toPx()),
            )
            // Glowing tray rim
            drawRoundRect(
                brush = Brush.linearGradient(
                    listOf(GxOrange, Color(0xFFFF9E54)),
                ),
                topLeft = Offset(trayX, trayY),
                size = Size(trayW, trayH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(9.dp.toPx()),
                style = Stroke(width = 2.2.dp.toPx()),
            )

            // Glowing SIM card body
            val simW = 72.dp.toPx()
            val simH = 38.dp.toPx()
            val simX = trayX + 10.dp.toPx()
            val simY = trayY + 6.dp.toPx()

            drawRoundRect(
                brush = Brush.linearGradient(
                    listOf(Color(0xFFFFB85E), GxOrange),
                ),
                topLeft = Offset(simX, simY),
                size = Size(simW, simH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(6.dp.toPx()),
            )

            // Golden metallic chip contact pads (6-pad grid)
            val chipPadW = 16.dp.toPx()
            val chipPadH = 11.dp.toPx()
            val padGap = 2.dp.toPx()
            val gridStartX = simX + (simW - (chipPadW * 3 + padGap * 2)) / 2f
            val gridStartY = simY + (simH - (chipPadH * 2 + padGap)) / 2f

            for (col in 0..2) {
                for (row in 0..1) {
                    val px = gridStartX + col * (chipPadW + padGap)
                    val py = gridStartY + row * (chipPadH + padGap)
                    drawRoundRect(
                        brush = Brush.verticalGradient(
                            listOf(Color(0xFFFFDF88), Color(0xFFD49A28)),
                            startY = py,
                            endY = py + chipPadH,
                        ),
                        topLeft = Offset(px, py),
                        size = Size(chipPadW, chipPadH),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(2.dp.toPx()),
                    )
                }
            }
        }
    }
}

@Composable
fun MicRecordingHero(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(180.dp),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val center = Offset(size.width / 2f, size.height / 2f)

            drawCircle(
                color = Color.White.copy(alpha = 0.05f),
                radius = 78.dp.toPx(),
                center = center,
                style = Stroke(width = 1.dp.toPx()),
            )
            drawCircle(
                color = Color.White.copy(alpha = 0.09f),
                radius = 54.dp.toPx(),
                center = center,
                style = Stroke(width = 1.dp.toPx()),
            )

            val barCount = 18
            val leftStart = size.width * 0.12f
            val rightEnd = size.width * 0.88f
            val step = (rightEnd - leftStart) / (barCount - 1)
            val heights = listOf(14f, 22f, 18f, 32f, 26f, 44f, 28f, 50f, 36f, 48f, 30f, 44f, 22f, 34f, 18f, 24f, 16f, 12f)

            heights.forEachIndexed { i, h ->
                val x = leftStart + i * step
                val distFromCenter = kotlin.math.abs(x - center.x)
                if (distFromCenter > 26.dp.toPx()) {
                    drawLine(
                        color = Color.White.copy(alpha = 0.35f),
                        start = Offset(x, center.y - h.dp.toPx() / 2f),
                        end = Offset(x, center.y + h.dp.toPx() / 2f),
                        strokeWidth = 2.5.dp.toPx(),
                        cap = StrokeCap.Round,
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(GxOrange),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.Mic,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(26.dp),
            )
        }
    }
}

@Composable
fun GxPillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    showArrow: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        colors = ButtonDefaults.buttonColors(
            containerColor = GxOrange,
            contentColor = Color.White,
            disabledContainerColor = GxOrange.copy(alpha = 0.40f),
            disabledContentColor = Color.White.copy(alpha = 0.60f),
        ),
        shape = RoundedCornerShape(99.dp),
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = Color.White,
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    text,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                )
                if (showArrow) {
                    Spacer(Modifier.width(8.dp))
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(19.dp),
                    )
                }
            }
        }
    }
}

@Composable
fun ValuePropItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(46.dp)
                .clip(CircleShape)
                .background(Color(0xFF1E2126))
                .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(22.dp),
            )
        }
        Spacer(Modifier.width(14.dp))
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                title,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                subtitle,
                color = GxMutedText,
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
            )
        }
    }
}

@Composable
fun SimCardOptionItem(
    label: String,
    phoneNumber: String?,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0xFF1C2025))
            .border(
                BorderStroke(
                    1.dp,
                    if (selected) GxOrange.copy(alpha = 0.65f) else Color.White.copy(alpha = 0.08f),
                ),
                RoundedCornerShape(18.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 13.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (selected) GxOrange else Color(0xFF2C3138)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.SimCard,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (!phoneNumber.isNullOrBlank()) "$label \u2022\u2022\u2022\u2022\u2022 ${phoneNumber.takeLast(4)}" else label,
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Box(
                modifier = Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .border(
                        BorderStroke(
                            if (selected) 2.dp else 1.5.dp,
                            if (selected) GxOrange else Color(0xFF4A515C),
                        ),
                        CircleShape,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (selected) {
                    Box(
                        modifier = Modifier
                            .size(11.dp)
                            .clip(CircleShape)
                            .background(GxOrange),
                    )
                }
            }
        }
    }
}

@Composable
fun SetupPermissionsCard(
    phoneAllowed: Boolean,
    historyAllowed: Boolean,
    notificationsAllowed: Boolean,
    onRequestPermissions: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        color = Color(0xFF171A1E),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(Modifier.fillMaxWidth()) {
            SetupPermissionRow(
                icon = Icons.Outlined.Phone,
                title = "Phone",
                allowed = phoneAllowed,
                onClick = onRequestPermissions,
            )
            HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
            SetupPermissionRow(
                icon = Icons.Outlined.Schedule,
                title = "Call history",
                allowed = historyAllowed,
                onClick = onRequestPermissions,
            )
            HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
            SetupPermissionRow(
                icon = Icons.Outlined.NotificationsNone,
                title = "Notifications",
                allowed = notificationsAllowed,
                onClick = onRequestPermissions,
            )
        }
    }
}

@Composable
private fun SetupPermissionRow(
    icon: ImageVector,
    title: String,
    allowed: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(14.dp))
        Text(
            title,
            color = Color.White,
            fontSize = 14.5.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        if (allowed) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    tint = GxGreen,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    "Allowed",
                    color = GxGreen,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    "Allow",
                    color = GxMutedText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = GxMutedText,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

@Composable
fun RecordingRowItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    statusText: String,
    isGreen: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Color(0xFF22252A)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(19.dp),
            )
        }
        Spacer(Modifier.width(13.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                title,
                color = Color.White,
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                subtitle,
                color = GxMutedText,
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
            )
        }
        Spacer(Modifier.width(8.dp))
        Surface(
            color = if (isGreen) Color(0xFF192A1E) else Color(0xFF22252A),
            shape = RoundedCornerShape(99.dp),
            border = BorderStroke(
                1.dp,
                if (isGreen) Color(0xFF2E633B) else Color.White.copy(alpha = 0.08f),
            ),
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (isGreen) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = null,
                        tint = GxGreen,
                        modifier = Modifier.size(12.dp),
                    )
                } else {
                    Text("\u2014", color = GxMutedText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Text(
                    statusText,
                    color = if (isGreen) GxGreen else GxMutedText,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        Spacer(Modifier.width(6.dp))
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = GxMutedText,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
fun StatusChecklistRow(
    text: String,
    isBold: Boolean = false,
    checked: Boolean = true,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(if (checked) GxGreen else Color(0xFF282C32)),
            contentAlignment = Alignment.Center,
        ) {
            if (checked) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(13.dp),
                )
            }
        }
        Spacer(Modifier.width(14.dp))
        Text(
            text,
            color = Color.White,
            fontSize = 13.5.sp,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.Medium,
        )
    }
}

@Composable
fun ActionOptionCard(
    icon: ImageVector,
    title: String,
    iconBgColor: Color = Color(0xFF22252A),
    loading: Boolean = false,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0xFF1C2025))
            .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)), RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                .background(iconBgColor),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(19.dp),
                )
            }
            Spacer(Modifier.width(14.dp))
            Text(
                title,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = GxOrange,
                )
            } else {
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = GxMutedText,
                    modifier = Modifier.size(19.dp),
                )
            }
        }
    }
}

@Composable
fun LoginGlassCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        color = Color(0xFF14171C).copy(alpha = 0.78f),
        shape = RoundedCornerShape(26.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        shadowElevation = 10.dp,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 22.dp),
            content = content,
        )
    }
}

@Composable
fun LoginCtaButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed && enabled && !loading) 0.97f else 1.0f,
        animationSpec = spring(
            stiffness = Spring.StiffnessMediumLow,
            dampingRatio = Spring.DampingRatioMediumBouncy,
        ),
        label = "login-cta-scale",
    )

    val activeGradient = Brush.horizontalGradient(
        listOf(
            Color(0xFFFE6420),
            Color(0xFFFF7A30),
        )
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clip(RoundedCornerShape(99.dp))
            .then(
                if (enabled && !loading) {
                    Modifier
                        .background(activeGradient)
                        .clickable(
                            interactionSource = interactionSource,
                            indication = null,
                            onClick = onClick,
                        )
                } else {
                    Modifier
                        .background(Color(0xFF22252A))
                        .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(99.dp))
                        .clickable(
                            interactionSource = interactionSource,
                            indication = null,
                            onClick = onClick,
                        )
                }
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = Color.White,
            )
        } else {
            Text(
                text = text,
                color = if (enabled) Color.White else Color.White.copy(alpha = 0.40f),
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.2).sp,
            )
        }
    }
}

