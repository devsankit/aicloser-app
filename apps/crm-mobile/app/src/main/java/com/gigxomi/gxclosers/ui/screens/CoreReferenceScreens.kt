package com.gigxomi.gxclosers.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gigxomi.gxclosers.data.*
import com.gigxomi.gxclosers.R
import com.gigxomi.gxclosers.ui.theme.*
import kotlin.math.cos
import kotlin.math.sin

// =============================================================================
// AI CLOSER DESIGN TOKENS (Screens 06-12 Visual Authority)
// =============================================================================

private val RefBrandOrange = Color(0xFFFF5C00)
private val RefBrandOrangeDark = Color(0xFFFF4500)
private val RefBrandOrangeSoft = Color(0x26FF5C00)
private val RefBrandOrangeGlow = Color(0x40FF5C00)

private val RefDarkBg = Color(0xFF0D0E12)
private val RefDarkCard = Color(0xD914171D)
private val RefDarkCardElevated = Color(0xFF1A1F27)
private val RefDarkBorder = Color(0xFF232832)
private val RefDarkBorderSubtle = Color(0xFF1C2028)
private val RefDarkMuted = Color(0xFF8E98A8)
private val RefDarkText = Color(0xFFF6F8FA)

private val RefLightBg = Color(0xFFF7F8FA)
private val RefLightCard = Color(0xE6FFFFFF)
private val RefLightBorder = Color(0xFFE5E7EB)
private val RefLightMuted = Color(0xFF6B7280)
private val RefLightText = Color(0xFF111827)

private val RefSuccessGreen = Color(0xFF10B981)
private val RefSuccessGreenSoft = Color(0x2610B981)
private val RefWarningYellow = Color(0xFFF59E0B)
private val RefDangerRed = Color(0xFFEF4444)
private val RefDangerRedSoft = Color(0x26EF4444)
private val RefBlue = Color(0xFF3B82F6)
private val RefBlueSoft = Color(0x263B82F6)
private val RefPurple = Color(0xFF8B5CF6)
private val RefPurpleSoft = Color(0x268B5CF6)

@Composable
private fun refBgColor(): Color {
    val isDark = MaterialTheme.colorScheme.background.red < 0.5f
    return if (isDark) RefDarkBg else RefLightBg
}

@Composable
private fun refCardColor(): Color {
    val isDark = MaterialTheme.colorScheme.background.red < 0.5f
    return if (isDark) RefDarkCard else RefLightCard
}

@Composable
private fun refBorderColor(): Color {
    val isDark = MaterialTheme.colorScheme.background.red < 0.5f
    return if (isDark) RefDarkBorder else RefLightBorder
}

@Composable
private fun refTextColor(): Color {
    val isDark = MaterialTheme.colorScheme.background.red < 0.5f
    return if (isDark) RefDarkText else RefLightText
}

@Composable
private fun refMutedColor(): Color {
    val isDark = MaterialTheme.colorScheme.background.red < 0.5f
    return if (isDark) RefDarkMuted else RefLightMuted
}

/** Shared photo/glass backdrop used by the 19-screen reference pack. */
@Composable
fun ReferencePhotoBackdrop(modifier: Modifier = Modifier) {
    val dark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    Box(modifier = modifier.fillMaxSize().background(if (dark) RefDarkBg else RefLightBg)) {
        Image(
            painter = painterResource(R.drawable.login_telephony_background),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            alpha = if (dark) 0.34f else 0.16f,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        if (dark) {
                            listOf(Color(0xB80D0E12), Color(0x660D0E12), Color(0xD90D0E12))
                        } else {
                            listOf(Color(0xB8F7F8FA), Color(0x40F7F8FA), Color(0xCFF7F8FA))
                        }
                    )
                )
        )
    }
}

private fun stageDisplayLabel(value: String): String = when (
    value.trim().uppercase().replace('-', '_').replace(' ', '_')
) {
    "FOLLOW_UP" -> "Follow-up"
    "NOT_REACHABLE" -> "Not reachable"
    "CLOSED_WON" -> "Closed won"
    "CLOSED_LOST" -> "Closed lost"
    else -> value.replace('_', ' ').replace('-', ' ').lowercase().replaceFirstChar { it.uppercase() }
}

// =============================================================================
// SUBTLE PREMIUM MOTION MODIFIERS
// =============================================================================

@Composable
private fun Modifier.pressScale(onClick: () -> Unit): Modifier {
    return this.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = null,
            onClick = onClick,
        )
}

// =============================================================================
// REUSABLE UI PRIMITIVES
// =============================================================================

@Composable
private fun RefLogoBadge(modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(RefBrandOrange),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "AI",
                color = Color.White,
                fontWeight = FontWeight.Black,
                fontSize = 15.sp,
                letterSpacing = (-0.5).sp
            )
        }
        Spacer(Modifier.width(8.dp))
        Text(
            text = "Closer",
            color = refTextColor(),
            fontWeight = FontWeight.Bold,
            fontSize = 19.sp,
            letterSpacing = (-0.3).sp
        )
    }
}

@Composable
private fun PhonePlusGlyph(
    tint: Color,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Icon(
            imageVector = Icons.Default.Call,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(17.dp),
        )
        Text(
            text = "+",
            color = tint,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.align(Alignment.TopEnd),
        )
    }
}

@Composable
private fun WhatsAppGlyph(
    tint: Color,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.matchParentSize()) {
            val radius = size.minDimension * 0.36f
            drawCircle(
                color = tint,
                radius = radius,
                center = Offset(size.width / 2f, size.height / 2f),
                style = Stroke(width = 2.1f),
            )
            drawLine(
                color = tint,
                start = Offset(size.width * 0.27f, size.height * 0.76f),
                end = Offset(size.width * 0.18f, size.height * 0.88f),
                strokeWidth = 2.1f,
                cap = StrokeCap.Round,
            )
        }
        Icon(
            imageVector = Icons.Default.Call,
            contentDescription = "WhatsApp",
            tint = tint,
            modifier = Modifier.size(10.dp),
        )
    }
}

@Composable
private fun RefNotificationButton(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(42.dp)
            .clip(CircleShape)
            .background(refCardColor())
            .border(1.dp, refBorderColor(), CircleShape)
            .pressScale(onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.Notifications,
            contentDescription = "Notifications",
            tint = refTextColor(),
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun RefCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = refCardColor(),
    borderColor: Color = refBorderColor(),
    cornerRadius: Dp = 20.dp,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(cornerRadius))
            .background(backgroundColor)
            .border(1.dp, borderColor, RoundedCornerShape(cornerRadius))
            .padding(18.dp),
        content = content
    )
}

@Composable
fun AppBottomNavBar(
    selectedTab: String,
    onTabSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        color = refCardColor(),
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, refBorderColor().copy(alpha = 0.6f)),
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(start = 20.dp, end = 20.dp, bottom = 12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(88.dp)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            val tabs = listOf(
                Triple("home", "Home", Icons.Default.Home),
                Triple("leads", "Leads", Icons.Default.Groups),
                Triple("calls", "Calls", Icons.Default.Call),
                Triple("more", "More", Icons.Default.MoreHoriz)
            )

            tabs.forEach { (id, label, icon) ->
                val isSelected = selectedTab == id
                val iconColor by animateColorAsState(
                    if (isSelected) RefBrandOrange else refMutedColor(),
                    animationSpec = tween(180), label = "iconColor"
                )
                val bgColor by animateColorAsState(
                    if (isSelected) RefBrandOrangeSoft else Color.Transparent,
                    animationSpec = tween(180), label = "bgColor"
                )

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .offset(y = (-2).dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(bgColor)
                        .border(
                            width = if (isSelected) 1.dp else 0.dp,
                            color = if (isSelected) RefBrandOrange.copy(alpha = 0.38f) else Color.Transparent,
                            shape = RoundedCornerShape(14.dp)
                        )
                        .pressScale { onTabSelected(id) }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = iconColor,
                        modifier = Modifier.size(21.dp)
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = label,
                        fontSize = 12.sp,
                        lineHeight = 14.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = iconColor
                    )
                }
            }
        }
    }
}

// =============================================================================
// SCREEN 06: REFERENCE HOME SCREEN (06-home.png)
// =============================================================================

@Composable
fun ReferenceHomeScreen(
    agentName: String = "",
    greeting: String = "Welcome",
    headline: String = "Track your progress and follow-ups",
    callsToday: Int = 0,
    talkTimeMinutes: Int = 0,
    talkTimeDisplay: String = "0m",
    leadsCount: Int = 0,
    syncStatusText: String = "Synced",
    recentLeads: List<SalesLead> = emptyList(),
    selectedNavTab: String = "home",
    onNotificationClick: () -> Unit = {},
    onGrabLeadsClick: () -> Unit = {},
    onWhatsAppClick: () -> Unit = {},
    onChatsClick: () -> Unit = {},
    onPaymentsClick: () -> Unit = {},
    onViewAllLeadsClick: () -> Unit = {},
    onLeadClick: (SalesLead) -> Unit = {},
    onCallLead: (SalesLead) -> Unit = {},
    onNavTabSelected: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Box(Modifier.fillMaxSize()) {
        ReferencePhotoBackdrop()
        AnimatedVisibility(
            visible = true,
            enter = fadeIn(tween(220)) + slideInVertically(tween(220)) { 25 },
            modifier = Modifier.fillMaxSize(),
        ) {
        Scaffold(
            containerColor = Color.Transparent,
            modifier = Modifier.fillMaxSize()
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(scrollState)
                    .padding(horizontal = 20.dp, vertical = 14.dp)
            ) {
                // Top header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RefLogoBadge()
                    RefNotificationButton(onClick = onNotificationClick)
                }

                Spacer(Modifier.height(20.dp))

                // Greetings
                Text(
                    text = greeting,
                    color = refMutedColor(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Normal
                )
                Text(
                    text = headline,
                    color = refTextColor(),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.5).sp
                )

                Spacer(Modifier.height(22.dp))

                // Circular Dial Meter Card
                HomeCallsGaugeCard(
                    callsToday = callsToday,
                    talkTimeMinutes = talkTimeMinutes,
                    talkTimeDisplay = talkTimeDisplay,
                    leadsCount = leadsCount,
                    syncStatusText = syncStatusText
                )

                Spacer(Modifier.height(16.dp))

                // Grab leads action banner
                GrabLeadsBannerCard(onClick = onGrabLeadsClick)

                Spacer(Modifier.height(14.dp))

                // Quick Action Row (WhatsApp, Chats, Payments)
                HomeQuickActionsRow(
                    onWhatsAppClick = onWhatsAppClick,
                    onChatsClick = onChatsClick,
                    onPaymentsClick = onPaymentsClick
                )

                Spacer(Modifier.height(22.dp))

                // Recent leads header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Recent leads",
                        color = refTextColor(),
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "View all",
                        color = RefBrandOrange,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clickable(onClick = onViewAllLeadsClick)
                            .padding(4.dp)
                    )
                }

                Spacer(Modifier.height(12.dp))

                // Recent leads list
                val leadsToDisplay = recentLeads.take(4)
                if (leadsToDisplay.isEmpty()) {
                    Text(
                        text = "No recent leads yet",
                        color = refMutedColor(),
                        fontSize = 13.sp,
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                } else {
                    leadsToDisplay.forEach { lead ->
                        HomeRecentLeadItem(
                            lead = lead,
                            onLeadClick = { onLeadClick(lead) },
                            onCallLead = { onCallLead(lead) }
                        )
                        Spacer(Modifier.height(10.dp))
                    }
                }

                Spacer(Modifier.navigationBarsPadding().height(116.dp))
            }
        }
        }
    }
}

@Composable
private fun HomeCallsGaugeCard(
    callsToday: Int,
    talkTimeMinutes: Int,
    talkTimeDisplay: String = "${talkTimeMinutes}m",
    leadsCount: Int,
    syncStatusText: String
) {
    val gaugeBorder = refBorderColor()

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(172.dp),
            contentAlignment = Alignment.Center
        ) {
            // Dial Canvas
            Canvas(
                modifier = Modifier
                    .size(164.dp)
            ) {
                val center = Offset(size.width / 2f, size.height / 2f)
                val radius = size.width / 2f - 14.dp.toPx()

                // Tick marks ring
                val tickCount = 48
                for (i in 0 until tickCount) {
                    val angle = (i * (360f / tickCount)).toDouble()
                    val rad = Math.toRadians(angle)
                    val innerR = radius - 7.dp.toPx()
                    val outerR = radius - 2.dp.toPx()

                    val startX = (center.x + innerR * cos(rad)).toFloat()
                    val startY = (center.y + innerR * sin(rad)).toFloat()
                    val endX = (center.x + outerR * cos(rad)).toFloat()
                    val endY = (center.y + outerR * sin(rad)).toFloat()

                    drawLine(
                    color = gaugeBorder.copy(alpha = 0.72f),
                        start = Offset(startX, startY),
                        end = Offset(endX, endY),
                        strokeWidth = 2.dp.toPx(),
                        cap = StrokeCap.Round
                    )
                }

                // Gray track arc
                drawArc(
                    color = gaugeBorder.copy(alpha = 0.55f),
                    startAngle = 135f,
                    sweepAngle = 270f,
                    useCenter = false,
                    topLeft = Offset(center.x - radius, center.y - radius),
                    size = Size(radius * 2, radius * 2),
                    style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round)
                )

                // Glowing orange progress arc
                val progressSweep = 190f
                drawArc(
                    brush = Brush.sweepGradient(
                        0f to RefBrandOrange,
                        0.7f to Color(0xFFFF7A1A),
                        1f to RefBrandOrange
                    ),
                    startAngle = 135f,
                    sweepAngle = progressSweep,
                    useCenter = false,
                    topLeft = Offset(center.x - radius, center.y - radius),
                    size = Size(radius * 2, radius * 2),
                    style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round)
                )
            }

            // Center Call Count
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "$callsToday",
                    color = refTextColor(),
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = (-1).sp
                )
                Text(
                    text = "calls today",
                    color = refMutedColor(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            // Left Pill: Leads
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .clip(RoundedCornerShape(14.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$leadsCount",
                        color = refTextColor(),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "leads",
                        color = refMutedColor(),
                        fontSize = 11.sp
                    )
                }
            }

            // Right Pill: Talk time
            Box(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .clip(RoundedCornerShape(14.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = talkTimeDisplay,
                        color = refTextColor(),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "talk time",
                        color = refMutedColor(),
                        fontSize = 11.sp
                    )
                }
            }
        }

        Spacer(Modifier.height(4.dp))

        // Synced pill at bottom of gauge
        Row(
            modifier = Modifier
                .clip(CircleShape)
                .background(refCardColor())
                .border(1.dp, refBorderColor(), CircleShape)
                .padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.CloudDone,
                contentDescription = null,
                tint = refMutedColor(),
                modifier = Modifier.size(15.dp)
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = syncStatusText,
                color = refMutedColor(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun GrabLeadsBannerCard(onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(refCardColor())
            .border(1.dp, refBorderColor(), RoundedCornerShape(20.dp))
            .pressScale(onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(RefBrandOrange),
                contentAlignment = Alignment.Center
            ) {
                PhonePlusGlyph(tint = Color.White, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column {
                Text(
                    text = "Grab leads",
                    color = refTextColor(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Find available leads",
                    color = refMutedColor(),
                    fontSize = 11.sp
                )
            }
        }
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = refMutedColor(),
            modifier = Modifier.size(19.dp)
        )
    }
}

@Composable
private fun HomeQuickActionsRow(
    onWhatsAppClick: () -> Unit,
    onChatsClick: () -> Unit,
    onPaymentsClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(refCardColor())
            .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
            .padding(vertical = 4.dp),
    ) {
        HomeQuickActionItem("WhatsApp", onWhatsAppClick) {
            WhatsAppGlyph(tint = refTextColor(), modifier = Modifier.size(20.dp))
        }
        VerticalDivider(color = refBorderColor(), modifier = Modifier.height(34.dp))
        HomeQuickActionItem("Chats", onChatsClick) {
            Icon(Icons.Default.ChatBubbleOutline, contentDescription = "Chats", tint = refTextColor(), modifier = Modifier.size(18.dp))
        }
        VerticalDivider(color = refBorderColor(), modifier = Modifier.height(34.dp))
        HomeQuickActionItem("Payments", onPaymentsClick) {
            Icon(Icons.Default.CreditCard, contentDescription = "Payments", tint = refTextColor(), modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun RowScope.HomeQuickActionItem(
    label: String,
    onClick: () -> Unit,
    icon: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .pressScale(onClick)
            .padding(vertical = 6.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        icon()
        Spacer(Modifier.height(2.dp))
        Text(
            text = label,
            color = refTextColor(),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun HomeRecentLeadItem(
    lead: SalesLead,
    onLeadClick: () -> Unit,
    onCallLead: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 2.dp, vertical = 2.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .pressScale(onLeadClick)
        ) {
            // Circular initial avatar
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(refCardColor()),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = lead.customerName.take(1).uppercase(),
                    color = refTextColor(),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = lead.customerName,
                    color = refTextColor(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = stageDisplayLabel(lead.stage.ifBlank { "New lead" }),
                    color = refMutedColor(),
                    fontSize = 11.sp
                )
            }
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), CircleShape)
                    .pressScale(onCallLead),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Call,
                    contentDescription = "Call lead",
                    tint = refTextColor(),
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        HorizontalDivider(color = refBorderColor().copy(alpha = 0.8f))
    }
}

// =============================================================================
// SCREEN 07: REFERENCE LEADS SCREEN (07-leads.png)
// =============================================================================

@Composable
fun ReferenceLeadsScreen(
    leads: List<SalesLead> = emptyList(),
    selectedStageFilter: String = "All",
    searchQuery: String = "",
    selectedNavTab: String = "leads",
    onSearchQueryChange: (String) -> Unit = {},
    onFilterClick: () -> Unit = {},
    onStageFilterSelect: (String) -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onGrabLeadsClick: () -> Unit = {},
    onAddContactClick: () -> Unit = {},
    onLeadClick: (SalesLead) -> Unit = {},
    onCallLead: (SalesLead) -> Unit = {},
    onNavTabSelected: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val displayedLeads = remember(leads, selectedStageFilter, searchQuery) {
        leads.filter { lead ->
            val matchesStage = when (selectedStageFilter) {
                "All" -> true
                "New" -> lead.stage.equals("new", ignoreCase = true) || lead.stage.contains("new", true)
                "Follow-up" -> lead.stage.contains("follow", true)
                "Contacted" -> lead.stage.contains("contact", true)
                else -> lead.stage.contains(selectedStageFilter, true)
            }
            val matchesSearch = searchQuery.isBlank() ||
                lead.customerName.contains(searchQuery, true) ||
                lead.customerPhone.contains(searchQuery, true) ||
                lead.serviceInterest.contains(searchQuery, true)

            matchesStage && matchesSearch
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        modifier = modifier,
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(top = 14.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RefLogoBadge()
                    RefNotificationButton(onClick = onNotificationClick)
                }
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Leads",
                    color = refTextColor(),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.5).sp
                )
                Text(
                    text = "Manage and follow up with your leads",
                    color = refMutedColor(),
                    fontSize = 14.sp
                )
            }

            // Search Bar + Filter Icon
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(refCardColor())
                            .border(1.dp, refBorderColor(), RoundedCornerShape(16.dp))
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            tint = refMutedColor(),
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            text = if (searchQuery.isBlank()) "Search leads" else searchQuery,
                            color = if (searchQuery.isBlank()) refMutedColor() else refTextColor(),
                            fontSize = 14.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(Modifier.width(10.dp))

                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(refCardColor())
                            .border(1.dp, refBorderColor(), RoundedCornerShape(16.dp))
                            .pressScale(onFilterClick),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Tune,
                            contentDescription = "Filter",
                            tint = refTextColor(),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // Stage Filter Chips Row
            item {
                val chips = listOf("All", "New", "Follow-up", "Contacted")
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(horizontal = 2.dp)
                ) {
                    items(chips) { chip ->
                        val isSelected = selectedStageFilter == chip
                        val bgColor by animateColorAsState(
                            if (isSelected) RefBrandOrange else refCardColor(),
                            label = "chipBg"
                        )
                        val textColor by animateColorAsState(
                            if (isSelected) Color.White else refTextColor(),
                            label = "chipText"
                        )
                        val borderColor by animateColorAsState(
                            if (isSelected) RefBrandOrange else refBorderColor(),
                            label = "chipBorder"
                        )

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(bgColor)
                                .border(1.dp, borderColor, RoundedCornerShape(20.dp))
                                .pressScale { onStageFilterSelect(chip) }
                                .padding(horizontal = 18.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = chip,
                                color = textColor,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                }
            }

            // Grab Leads Banner
            item {
                GrabLeadsBannerCard(onClick = onGrabLeadsClick)
            }

            // Leads Count + Add contact button
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${displayedLeads.size} leads",
                        color = refTextColor(),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Row(
                        modifier = Modifier
                            .clip(CircleShape)
                            .pressScale(onAddContactClick)
                            .padding(vertical = 4.dp, horizontal = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = refTextColor(),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = "Add contact",
                            color = refTextColor(),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // Leads Items
            items(displayedLeads) { lead ->
                LeadsListItemCard(
                    lead = lead,
                    onLeadClick = { onLeadClick(lead) },
                    onCallLead = { onCallLead(lead) }
                )
            }
        }
    }
}

@Composable
private fun LeadsListItemCard(
    lead: SalesLead,
    onLeadClick: () -> Unit,
    onCallLead: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .pressScale(onLeadClick)
            .padding(vertical = 5.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(refCardColor()),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = lead.customerName.take(1).uppercase(),
                    color = refTextColor(),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = lead.customerName,
                    color = refTextColor(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(1.dp))
                Text(
                    text = lead.serviceInterest.ifBlank { "General enquiry" },
                    color = refMutedColor(),
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(3.dp))

                // Badges row
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val stageColor = when {
                        lead.stage.contains("follow", true) -> RefBrandOrange
                        lead.stage.contains("new", true) -> RefBlue
                        lead.stage.contains("contact", true) -> RefSuccessGreen
                        else -> RefPurple
                    }
                    val stageBg = when {
                        lead.stage.contains("follow", true) -> RefBrandOrangeSoft
                        lead.stage.contains("new", true) -> RefBlueSoft
                        lead.stage.contains("contact", true) -> RefSuccessGreenSoft
                        else -> RefPurpleSoft
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(stageBg)
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = stageDisplayLabel(lead.stage.ifBlank { "New lead" }),
                            color = stageColor,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    if (lead.priority.equals("HIGH", ignoreCase = true)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(RefBrandOrangeSoft)
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Whatshot,
                                contentDescription = null,
                                tint = RefBrandOrange,
                                modifier = Modifier.size(11.dp)
                            )
                            Spacer(Modifier.width(3.dp))
                            Text(
                                text = "High",
                                color = RefBrandOrange,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.width(8.dp))

            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), CircleShape)
                    .pressScale(onCallLead),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Call,
                    contentDescription = "Call lead",
                    tint = refTextColor(),
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        HorizontalDivider(
            modifier = Modifier.padding(top = 5.dp),
            color = refBorderColor().copy(alpha = 0.8f),
        )
    }
}

// =============================================================================
// SCREEN 08: REFERENCE CALLS SCREEN (08-calls.png)
// =============================================================================

@Composable
fun ReferenceCallsScreen(
    calls: List<MobileCall> = emptyList(),
    activeCall: MobileCall? = null,
    pendingSharedRecording: PendingSharedRecording? = null,
    attachableCalls: List<MobileCall> = emptyList(),
    isAttachingSharedRecording: Boolean = false,
    isPlaying: Boolean = false,
    playbackPositionSeconds: Int = 36,
    selectedCallTab: String = "All",
    selectedScopeTab: String = "All",
    selectedNavTab: String = "calls",
    currentDeviceId: String = "",
    currentDeviceModel: String = "",
    onScopeTabSelect: (String) -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onPlayPauseToggle: () -> Unit = {},
    onSkipBackward: () -> Unit = {},
    onSkipForward: () -> Unit = {},
    onSeek: (Float) -> Unit = {},
    onCallTabSelect: (String) -> Unit = {},
    onAttachSharedRecording: (MobileCall) -> Unit = {},
    onDiscardSharedRecording: () -> Unit = {},
    onCallClick: (MobileCall) -> Unit = {},
    onNavTabSelected: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Scaffold(
        containerColor = Color.Transparent,
        modifier = modifier,
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(top = 14.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RefLogoBadge()
                    RefNotificationButton(onClick = onNotificationClick)
                }
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Calls",
                    color = refTextColor(),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.5).sp
                )
                Text(
                    text = "Recordings and call history",
                    color = refMutedColor(),
                    fontSize = 14.sp
                )
                Spacer(Modifier.height(10.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val scopeTabs = listOf("All", "This Device")
                    scopeTabs.forEach { scope ->
                        val isScopeSelected = selectedScopeTab.equals(scope, ignoreCase = true)
                        val scopeLabel = if (scope == "This Device" && currentDeviceModel.isNotBlank()) "This Device ($currentDeviceModel)" else if (scope == "All") "All Devices" else scope
                        val pillBg = if (isScopeSelected) RefBrandOrange.copy(alpha = 0.15f) else refCardColor()
                        val pillBorder = if (isScopeSelected) RefBrandOrange.copy(alpha = 0.6f) else refBorderColor()
                        val pillText = if (isScopeSelected) RefBrandOrange else refMutedColor()

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(pillBg)
                                .border(1.dp, pillBorder, RoundedCornerShape(20.dp))
                                .pressScale { onScopeTabSelect(scope) }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = scopeLabel,
                                color = pillText,
                                fontSize = 11.sp,
                                fontWeight = if (isScopeSelected) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                }
            }

            pendingSharedRecording?.let { pending ->
                item {
                    SharedRecordingRecoveryCard(
                        pending = pending,
                        attachableCalls = attachableCalls,
                        isBusy = isAttachingSharedRecording,
                        onAttach = onAttachSharedRecording,
                        onDiscard = onDiscardSharedRecording,
                    )
                }
            }

            // Audio Player Hero Card
            item {
                CallsPlayerCard(
                    activeCall = activeCall,
                    isPlaying = isPlaying,
                    currentPos = playbackPositionSeconds,
                    onPlayPauseToggle = onPlayPauseToggle,
                    onSkipBackward = onSkipBackward,
                    onSkipForward = onSkipForward,
                    onSeek = onSeek,
                )
            }

            // Inbound / Outbound / Missed Tabs
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(refCardColor())
                        .border(1.dp, refBorderColor(), RoundedCornerShape(14.dp))
                        .padding(4.dp)
                ) {
                    val tabs = listOf("All", "Inbound", "Outbound", "Missed")
                    tabs.forEach { tab ->
                        val isSelected = selectedCallTab.equals(tab, ignoreCase = true)
                        val selectedTabColor = if (MaterialTheme.colorScheme.background.luminance() < .5f) {
                            Color(0xFF262C38)
                        } else {
                            RefBrandOrange.copy(alpha = 0.14f)
                        }
                        val bgColor by animateColorAsState(
                            if (isSelected) selectedTabColor else Color.Transparent,
                            label = "tabBg"
                        )
                        val textColor by animateColorAsState(
                            if (isSelected) refTextColor() else refMutedColor(),
                            label = "tabText"
                        )

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(bgColor)
                                .pressScale { onCallTabSelect(tab) }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = tab,
                                color = textColor,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                }
            }

            // Call history list
            if (calls.isEmpty()) {
                item {
                    RefCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 18.dp) {
                        Text(
                            text = "No ${selectedCallTab.lowercase()} calls yet",
                            color = refTextColor(),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "New calls in this category will appear here.",
                            color = refMutedColor(),
                            fontSize = 12.sp,
                        )
                    }
                }
            } else {
                items(calls) { call ->
                    CallsHistoryItemCard(call = call, currentDeviceId = currentDeviceId, onClick = { onCallClick(call) })
                }
            }
        }
    }
}

@Composable
private fun SharedRecordingRecoveryCard(
    pending: PendingSharedRecording,
    attachableCalls: List<MobileCall>,
    isBusy: Boolean,
    onAttach: (MobileCall) -> Unit,
    onDiscard: () -> Unit,
) {
    val showAllCandidates = remember { mutableStateOf(false) }
    RefCard(
        backgroundColor = if (MaterialTheme.colorScheme.background.luminance() < .5f) {
            RefBrandOrange.copy(alpha = 0.12f)
        } else {
            RefBrandOrange.copy(alpha = 0.08f)
        },
        borderColor = RefBrandOrange.copy(alpha = 0.55f),
        cornerRadius = 18.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Icon(
                    imageVector = Icons.Default.AttachFile,
                    contentDescription = null,
                    tint = RefBrandOrange,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "Shared recording ready",
                    color = refTextColor(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            TextButton(
                onClick = onDiscard,
                enabled = !isBusy,
                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text("Discard", color = refMutedColor(), fontSize = 11.sp)
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(
            text = pending.displayName,
            color = refTextColor(),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = if (pending.durationMs > 0L) {
                "${pending.durationMs / 1000L}s audio - choose target call"
            } else {
                "Audio imported - choose target call"
            },
            color = refMutedColor(),
            fontSize = 11.sp,
        )
        Spacer(Modifier.height(8.dp))
        if (attachableCalls.isEmpty()) {
            Text(
                text = "No completed calls are available yet. Refresh calls first.",
                color = RefWarningYellow,
                fontSize = 11.sp,
            )
        } else {
            val bestCandidate = attachableCalls.first()
            val bestLabel = bestCandidate.assignment?.customerName
                ?.takeIf(String::isNotBlank)
                ?: bestCandidate.phoneNumber
            Button(
                onClick = { onAttach(bestCandidate) },
                enabled = !isBusy,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = RefBrandOrange)
            ) {
                Icon(Icons.Default.UploadFile, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text("Attach to $bestLabel", fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }

            if (attachableCalls.size > 1) {
                if (!showAllCandidates.value) {
                    TextButton(
                        onClick = { showAllCandidates.value = true },
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(vertical = 2.dp)
                    ) {
                        Text(
                            text = "Or choose from ${attachableCalls.size - 1} other calls ▾",
                            color = RefBrandOrange,
                            fontSize = 11.sp
                        )
                    }
                } else {
                    attachableCalls.drop(1).take(3).forEach { call ->
                        val label = call.assignment?.customerName
                            ?.takeIf(String::isNotBlank)
                            ?: call.phoneNumber
                        OutlinedButton(
                            onClick = { onAttach(call) },
                            enabled = !isBusy,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                            border = BorderStroke(1.dp, RefBrandOrange.copy(alpha = 0.55f)),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = refTextColor(),
                            ),
                        ) {
                            Text("Attach to $label", fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CallsPlayerCard(
    activeCall: MobileCall?,
    isPlaying: Boolean,
    currentPos: Int,
    onPlayPauseToggle: () -> Unit,
    onSkipBackward: () -> Unit,
    onSkipForward: () -> Unit,
    onSeek: (Float) -> Unit,
) {
    val playerBorder = refBorderColor()
    val totalSeconds = activeCall?.durationSeconds?.coerceAtLeast(0) ?: 0
    val contactName = activeCall?.assignment?.customerName ?: activeCall?.phoneNumber ?: "No recording selected"
    val isMissed = activeCall?.status.equals("MISSED", true) || activeCall?.direction.equals("MISSED", true)
    val isInbound = activeCall?.direction.equals("INBOUND", true) || activeCall?.direction.equals("INCOMING", true) || activeCall?.direction.equals("RECEIVED", true)
    val isOutbound = activeCall?.direction.equals("OUTBOUND", true) || activeCall?.direction.equals("DIALED", true)
    val direction = when {
        isMissed -> "Missed"
        isInbound -> "Incoming"
        isOutbound -> "Outgoing"
        activeCall != null && activeCall.direction.isNotBlank() && !activeCall.direction.equals("UNKNOWN", true) -> activeCall.direction.lowercase().replaceFirstChar { it.uppercase() }
        else -> "Unknown"
    }
    val playerDirectionIcon = when {
        isMissed -> Icons.Default.CallMissed
        isInbound -> Icons.Default.SouthWest
        isOutbound -> Icons.Default.NorthEast
        else -> Icons.Default.Phone
    }
    val playerDirectionTint = when {
        isMissed -> RefDangerRed
        isInbound -> RefSuccessGreen
        isOutbound -> RefSuccessGreen
        else -> refMutedColor()
    }
    val durationText = String.format("%d:%02d", totalSeconds / 60, totalSeconds % 60)
    val isPlayerUploaded = activeCall?.recordingStatus.equals("UPLOADED", ignoreCase = true) || activeCall?.recordingStatus.equals("ready", ignoreCase = true)
    val isPlayerUploading = activeCall?.recordingStatus.equals("UPLOADING", ignoreCase = true) || activeCall?.recordingStatus.equals("LOCAL_PENDING", ignoreCase = true) || activeCall?.recordingStatus.equals("processing", ignoreCase = true)
    val isPlayerFailed = activeCall?.recordingStatus.equals("FAILED", ignoreCase = true) || activeCall?.recordingStatus.equals("FAILED_PERMANENT", ignoreCase = true)
    val badgeText = when {
        isPlayerUploaded -> "Recording synced"
        isPlayerUploading -> "Uploading audio..."
        isPlayerFailed -> "Upload failed"
        activeCall == null -> "No call selected"
        else -> "No audio synced"
    }
    val badgeColor = when {
        isPlayerUploaded -> RefSuccessGreen
        isPlayerUploading -> RefBrandOrange
        isPlayerFailed -> RefDangerRed
        else -> refMutedColor()
    }
    val badgeIcon = when {
        isPlayerUploaded -> Icons.Default.CloudDone
        isPlayerUploading -> Icons.Default.Sync
        isPlayerFailed -> Icons.Default.ErrorOutline
        else -> Icons.Default.CloudOff
    }

    RefCard(
        modifier = Modifier.fillMaxWidth(),
        cornerRadius = 24.dp
    ) {
        // Contact header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(refCardColor()),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = contactName.take(1).uppercase(),
                        color = refTextColor(),
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = contactName,
                        color = refTextColor(),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = playerDirectionIcon,
                            contentDescription = null,
                            tint = playerDirectionTint,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = "$direction · $durationText",
                            color = refMutedColor(),
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            // Synced badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .widthIn(max = 160.dp)
                    .clip(CircleShape)
                    .background(refCardColor())
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Icon(
                    imageVector = badgeIcon,
                    contentDescription = null,
                    tint = badgeColor,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    text = badgeText,
                    color = refTextColor(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Spacer(Modifier.height(18.dp))

        // Soundwave Graphic
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            val barCount = 44
            val barWidth = 3.dp.toPx()
            val spacing = (size.width - barCount * barWidth) / (barCount - 1)
            val playedFraction = if (totalSeconds > 0) {
                (currentPos.toFloat() / totalSeconds.toFloat()).coerceIn(0f, 1f)
            } else 0f

            for (i in 0 until barCount) {
                val fraction = i.toFloat() / barCount.toFloat()
                val isPlayed = fraction <= playedFraction

                // Pseudo waveform pattern
                val heightMultiplier = when (i % 6) {
                    0 -> 0.4f
                    1 -> 0.75f
                    2 -> 1.0f
                    3 -> 0.6f
                    4 -> 0.9f
                    else -> 0.35f
                }
                val barHeight = (size.height * heightMultiplier).coerceAtLeast(8.dp.toPx())
                val x = i * (barWidth + spacing)
                val y = (size.height - barHeight) / 2f

                drawRoundRect(
                    color = if (isPlayed) RefBrandOrange else playerBorder,
                    topLeft = Offset(x, y),
                    size = Size(barWidth, barHeight),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f)
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        // Scrubber line with thumb
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(16.dp)
                .pointerInput(totalSeconds) {
                    detectTapGestures { offset ->
                        onSeek((offset.x / size.width).coerceIn(0f, 1f))
                    }
                },
            contentAlignment = Alignment.CenterStart
        ) {
            Canvas(modifier = Modifier.fillMaxWidth().height(4.dp)) {
                val playedFraction = if (totalSeconds > 0) {
                    (currentPos.toFloat() / totalSeconds.toFloat()).coerceIn(0f, 1f)
                } else 0f
                // Background line
                drawRoundRect(
                    color = playerBorder,
                    size = size,
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(2.dp.toPx(), 2.dp.toPx())
                )
                // Played line
                drawRoundRect(
                    color = RefBrandOrange,
                    size = Size(size.width * playedFraction, size.height),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(2.dp.toPx(), 2.dp.toPx())
                )
            }
        }

        // Time labels
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            val m = currentPos / 60
            val s = currentPos % 60
            Text(
                text = String.format("%d:%02d", m, s),
                color = refMutedColor(),
                fontSize = 11.sp
            )
            val tm = totalSeconds / 60
            val ts = totalSeconds % 60
            Text(
                text = String.format("%d:%02d", tm, ts),
                color = refMutedColor(),
                fontSize = 11.sp
            )
        }

        Spacer(Modifier.height(16.dp))

        // Playback buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Skip -15s
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), CircleShape)
                    .pressScale(onSkipBackward),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "15",
                        color = refTextColor(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(Modifier.width(24.dp))

            // Main Play/Pause
            Box(
                modifier = Modifier
                    .size(62.dp)
                    .clip(CircleShape)
                    .background(if (isPlayerUploaded) RefBrandOrange else refCardColor().copy(alpha = 0.5f))
                    .then(if (isPlayerUploaded) Modifier.pressScale(onPlayPauseToggle) else Modifier),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = "Play/Pause",
                    tint = if (isPlayerUploaded) Color.White else refMutedColor(),
                    modifier = Modifier.size(32.dp)
                )
            }

            Spacer(Modifier.width(24.dp))

            // Skip +15s
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), CircleShape)
                    .pressScale(onSkipForward),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "15",
                        color = refTextColor(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun CallsHistoryItemCard(
    call: MobileCall,
    currentDeviceId: String = "",
    onClick: () -> Unit
) {
    val contactName = call.assignment?.customerName ?: "Contact"
    val isMissed = call.status.equals("MISSED", ignoreCase = true) || call.direction.equals("MISSED", ignoreCase = true)
    val isInbound = call.direction.equals("INBOUND", ignoreCase = true) ||
        call.direction.equals("INCOMING", ignoreCase = true) ||
        call.direction.equals("RECEIVED", ignoreCase = true)
    val isOutbound = call.direction.equals("OUTBOUND", ignoreCase = true) ||
        call.direction.equals("DIALED", ignoreCase = true)

    val itemIconVector = when {
        isMissed -> Icons.Default.CallMissed
        isInbound -> Icons.Default.SouthWest
        isOutbound -> Icons.Default.NorthEast
        else -> Icons.Default.Phone
    }
    val itemIconTint = when {
        isMissed -> RefDangerRed
        isInbound -> RefSuccessGreen
        isOutbound -> RefSuccessGreen
        else -> refMutedColor()
    }
    val itemIconBg = when {
        isMissed -> Color(0x1AEF4444)
        isInbound -> Color(0x1A10B981)
        isOutbound -> Color(0x1A10B981)
        else -> refCardColor()
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .pressScale(onClick)
            .padding(horizontal = 4.dp, vertical = 4.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(itemIconBg),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = itemIconVector,
                        contentDescription = null,
                        tint = itemIconTint,
                        modifier = Modifier.size(18.dp)
                    )
                }

                Spacer(Modifier.width(10.dp))

                Column {
                    Text(
                        text = contactName,
                        color = refTextColor(),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = formatCallDateTime(call),
                            color = refMutedColor(),
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        val model = call.deviceModel?.takeIf(String::isNotBlank)
                        val isOtherDevice = !call.deviceId.isNullOrBlank() && currentDeviceId.isNotBlank() && call.deviceId != currentDeviceId
                        if (isOtherDevice || model != null) {
                            val deviceBadge = if (isOtherDevice) " • ${model ?: "Remote"}" else " • ${model ?: "This Device"}"
                            Text(
                                text = deviceBadge,
                                color = if (isOtherDevice) RefBrandOrange else refMutedColor(),
                                fontSize = 10.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.width(8.dp))

            Column(
                horizontalAlignment = Alignment.End,
                modifier = Modifier.widthIn(max = 160.dp),
            ) {
                val durationText = if (call.durationSeconds > 0) {
                    String.format("%02d:%02d", call.durationSeconds / 60, call.durationSeconds % 60)
                } else "—"
                Text(
                    text = durationText,
                    color = refTextColor(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(3.dp))
                val isUploaded = call.recordingStatus.equals("UPLOADED", ignoreCase = true) || call.recordingStatus.equals("ready", ignoreCase = true)
                val isUploading = call.recordingStatus.equals("UPLOADING", ignoreCase = true) || call.recordingStatus.equals("LOCAL_PENDING", ignoreCase = true) || call.recordingStatus.equals("processing", ignoreCase = true)
                val isFailed = call.recordingStatus.equals("FAILED", ignoreCase = true) || call.recordingStatus.equals("FAILED_PERMANENT", ignoreCase = true)
                val isAwaitingShare = call.recordingError?.contains("Share recording", ignoreCase = true) == true

                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (isUploaded) {
                        Icon(Icons.Default.CloudDone, contentDescription = null, tint = RefSuccessGreen, modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Ready to play", color = RefSuccessGreen, fontSize = 11.sp, maxLines = 1)
                    } else if (isUploading && !isAwaitingShare) {
                        Icon(Icons.Default.Sync, contentDescription = null, tint = RefBrandOrange, modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Uploading audio...", color = RefBrandOrange, fontSize = 11.sp, maxLines = 1)
                    } else if (isAwaitingShare) {
                        Icon(Icons.Default.Share, contentDescription = null, tint = RefBrandOrange, modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Awaiting share", color = RefBrandOrange, fontSize = 11.sp, maxLines = 1)
                    } else if (isFailed) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = RefDangerRed, modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Failed • Tap retry", color = RefDangerRed, fontSize = 11.sp, maxLines = 1)
                    } else if (call.durationSeconds > 0) {
                        Icon(Icons.Default.MicOff, contentDescription = null, tint = refMutedColor(), modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("No recording", color = refMutedColor(), fontSize = 11.sp, maxLines = 1)
                    } else {
                        Text("Missed call", color = refMutedColor(), fontSize = 11.sp, maxLines = 1)
                    }
                }
            }

            Spacer(Modifier.width(8.dp))

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = refMutedColor(),
                modifier = Modifier.size(18.dp)
            )
        }
        HorizontalDivider(
            modifier = Modifier.padding(top = 10.dp),
            color = refBorderColor().copy(alpha = 0.8f),
        )
    }
}

private fun formatCallDateTime(call: MobileCall): String {
    val instant = call.parseEffectiveInstant() ?: return "Date unavailable"

    val zone = ZoneId.systemDefault()
    val local = instant.atZone(zone)
    val today = LocalDate.now(zone)
    val dateLabel = when {
        local.toLocalDate() == today -> "Today"
        local.toLocalDate() == today.minusDays(1) -> "Yesterday"
        local.year == today.year -> DateTimeFormatter.ofPattern("d MMM", Locale.getDefault()).format(local)
        else -> DateTimeFormatter.ofPattern("d MMM yyyy", Locale.getDefault()).format(local)
    }
    val timeLabel = DateTimeFormatter.ofPattern("h:mm a", Locale.getDefault()).format(local)
    return "$dateLabel, $timeLabel"
}

// =============================================================================
// SCREEN 09: REFERENCE MORE DRAWER (09-more-drawer.png)
// =============================================================================

@Composable
fun ReferenceMoreDrawer(
    userName: String = "",
    userRole: String = "Agent",
    currentTheme: String = "Dark",
    onClose: () -> Unit = {},
    onInboxClick: () -> Unit = {},
    onDiagnosticsClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    onSettingsClick: () -> Unit = {},
    onPaymentsClick: () -> Unit = {},
    onHelpClick: () -> Unit = {},
    onThemeChange: (String) -> Unit = {},
    onLogoutClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()
    val drawerBg = MaterialTheme.colorScheme.background
    val drawerSurface = MaterialTheme.colorScheme.surface
    val drawerRaised = MaterialTheme.colorScheme.surfaceVariant
    val drawerText = MaterialTheme.colorScheme.onSurface
    val drawerMuted = MaterialTheme.colorScheme.onSurfaceVariant
    val drawerBorder = MaterialTheme.colorScheme.outlineVariant
    var drawerVisible by remember { mutableStateOf(false) }
    var closeRequested by remember { mutableStateOf(false) }
    val drawerProgress by animateFloatAsState(
        targetValue = if (drawerVisible) 1f else 0f,
        animationSpec = tween(280, easing = FastOutSlowInEasing),
        label = "more-drawer-progress",
    )

    LaunchedEffect(Unit) { drawerVisible = true }
    LaunchedEffect(drawerVisible, closeRequested) {
        if (closeRequested && !drawerVisible) {
            kotlinx.coroutines.delay(290)
            onClose()
        }
    }

    fun requestClose() {
        if (!closeRequested) {
            closeRequested = true
            drawerVisible = false
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            // Use an opaque surface so the old dashboard/footer cannot show
            // through the live drawer as a second set of boxed controls.
            .background(drawerBg.copy(alpha = 0.24f * drawerProgress))
            .clickable(onClick = ::requestClose)
    ) {
        AnimatedVisibility(
            visible = drawerVisible,
            enter = fadeIn(tween(220)) + slideInHorizontally(tween(280)) { -it },
            exit = fadeOut(tween(180)) + slideOutHorizontally(tween(260)) { -it },
        ) {
            Column(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(0.76f)
                    // Match the reference drawer's glass treatment: keep the
                    // menu readable, but let the dashboard backdrop remain
                    // visibly present instead of turning the drawer opaque.
                    .background(drawerBg.copy(alpha = 0.87f))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = {},
                    )
                    .verticalScroll(scrollState)
                    .statusBarsPadding()
                    .navigationBarsPadding()
                    .padding(22.dp)
            ) {
                // Logo Header
                RefLogoBadge()

                Spacer(Modifier.height(24.dp))

                // Profile Header Card
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(drawerSurface)
                        .border(1.dp, drawerBorder, RoundedCornerShape(18.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(drawerRaised),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = userName.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString(""),
                            color = drawerText,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(
                            text = userName,
                            color = drawerText,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = userRole,
                            color = drawerMuted,
                            fontSize = 12.sp
                        )
                    }
                }

                Spacer(Modifier.height(24.dp))

                // SECTION: WORK
                DrawerSectionHeader("WORK")
                DrawerMenuItem(
                    icon = Icons.Default.MailOutline,
                    label = "Inbox",
                    onClick = onInboxClick
                )
                DrawerMenuItem(
                    icon = Icons.Default.Smartphone,
                    label = "Device diagnostics",
                    onClick = onDiagnosticsClick
                )

                Spacer(Modifier.height(20.dp))

                // SECTION: ACCOUNT
                DrawerSectionHeader("ACCOUNT")
                DrawerMenuItem(
                    icon = Icons.Default.PersonOutline,
                    label = "Profile",
                    onClick = onProfileClick
                )
                DrawerMenuItem(
                    icon = Icons.Default.Settings,
                    label = "Settings",
                    onClick = onSettingsClick
                )

                Spacer(Modifier.height(20.dp))

                // SECTION: WORKSPACE
                DrawerSectionHeader("WORKSPACE")
                DrawerMenuItem(
                    icon = Icons.Default.CreditCard,
                    label = "Payments",
                    onClick = onPaymentsClick
                )
                DrawerMenuItem(
                    icon = Icons.Default.HelpOutline,
                    label = "Help & support",
                    onClick = onHelpClick
                )

                Spacer(Modifier.height(22.dp))

                // Appearance Switcher
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.WbSunny,
                            contentDescription = null,
                            tint = drawerMuted,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = "Appearance",
                            color = drawerText,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    // 3-Option segmented pill
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(drawerSurface)
                            .border(1.dp, drawerBorder, RoundedCornerShape(12.dp))
                            .padding(2.dp)
                    ) {
                        listOf("Light", "Dark", "System").forEach { theme ->
                            val isSelected = currentTheme.equals(theme, ignoreCase = true)
                            val bg by animateColorAsState(
                                if (isSelected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent,
                                label = "themeBg"
                            )
                            val tc by animateColorAsState(
                                if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else drawerMuted,
                                label = "themeTc"
                            )

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(bg)
                                    .clickable { onThemeChange(theme) }
                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = theme,
                                    color = tc,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))

                // Log out button
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .clickable(onClick = onLogoutClick)
                        .padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.ExitToApp,
                            contentDescription = null,
                            tint = RefDangerRed,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = "Log out",
                            color = RefDangerRed,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = RefDangerRed.copy(alpha = 0.6f),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun DrawerSectionHeader(title: String) {
    Text(
        text = title,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(bottom = 8.dp)
    )
}

@Composable
private fun DrawerMenuItem(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(14.dp))
            Text(
                text = label,
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            modifier = Modifier.size(18.dp)
        )
    }
}

// =============================================================================
// SCREEN 10: REFERENCE GRAB LEADS SCREEN (10-grab-leads.png)
// =============================================================================

@Composable
fun ReferenceGrabLeadsEmptyState(
    onBackClick: () -> Unit = {},
    onRefreshClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Scaffold(
        containerColor = Color.Transparent,
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = refTextColor()
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Grab leads",
                    color = refTextColor(),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = refCardColor()),
                    border = BorderStroke(1.dp, refBorderColor())
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp, vertical = 28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            modifier = Modifier.size(72.dp),
                            shape = RoundedCornerShape(18.dp),
                            color = RefBrandOrangeSoft
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Inbox,
                                    contentDescription = null,
                                    tint = RefBrandOrange,
                                    modifier = Modifier.size(34.dp)
                                )
                            }
                        }
                        Spacer(Modifier.height(18.dp))
                        Text(
                            text = "No leads in queue",
                            color = refTextColor(),
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "There are currently no fresh leads in the unassigned queue. Refresh to check again.",
                            color = refMutedColor(),
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(22.dp))
                        Button(
                            onClick = onRefreshClick,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = RefBrandOrange)
                        ) {
                            Text("Refresh pool", fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.height(10.dp))
                        OutlinedButton(
                            onClick = onBackClick,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, refBorderColor())
                        ) {
                            Text("Back to dashboard", color = refTextColor(), fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReferenceGrabLeadsLoadingState(
    onBackClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Scaffold(
        containerColor = Color.Transparent,
        modifier = modifier,
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp, vertical = 12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = refTextColor(),
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Grab leads",
                    color = refTextColor(),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CircularProgressIndicator(color = RefBrandOrange)
                    Text(
                        text = "Loading live leads…",
                        color = refMutedColor(),
                        fontSize = 14.sp,
                    )
                }
            }
        }
    }
}

@Composable
fun ReferenceGrabLeadsScreen(
    availableCount: Int = 0,
    previewLead: AvailableLead? = null,
    canClaimLeads: Boolean = true,
    hasPendingNotes: Boolean = false,
    isBusy: Boolean = false,
    errorMessage: String? = null,
    onBackClick: () -> Unit = {},
    onGrabNextLead: () -> Unit = {},
    onViewLeadQueue: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val lead = previewLead ?: AvailableLead(
        id = "lead_mock_1",
        customerName = "Aarav Khanna",
        source = "Website enquiry",
        serviceInterest = "Interested in CRM demo",
        priority = "HIGH",
        createdAt = "Just now"
    )

    Scaffold(
        containerColor = Color.Transparent,
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(top = 8.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 14.dp)
        ) {
            // Top Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = refTextColor()
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Grab leads",
                    color = refTextColor(),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.height(18.dp))

            // Radar gauge sits directly on the speaker backdrop in the reference.
            val radarBorder = refBorderColor()
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    // Concentric radar circles Canvas
                    Box(contentAlignment = Alignment.Center) {
                        Canvas(modifier = Modifier.size(180.dp)) {
                        val center = Offset(size.width / 2f, size.height / 2f)
                        val maxR = size.width / 2f - 10.dp.toPx()

                        // Outer, mid, inner circles
                        val rings = listOf(maxR, maxR * 0.72f, maxR * 0.45f)
                        rings.forEach { r ->
                            drawCircle(
                                color = Color(0xFF242C39).copy(alpha = 0.5f),
                                radius = r,
                                center = center,
                                style = Stroke(width = 1.dp.toPx())
                            )
                        }

                        // Target cross lines
                        drawLine(
                            color = radarBorder.copy(alpha = 0.60f),
                            start = Offset(center.x - maxR, center.y),
                            end = Offset(center.x + maxR, center.y),
                            strokeWidth = 1.dp.toPx()
                        )
                        drawLine(
                            color = radarBorder.copy(alpha = 0.60f),
                            start = Offset(center.x, center.y - maxR),
                            end = Offset(center.x, center.y + maxR),
                            strokeWidth = 1.dp.toPx()
                        )

                        // Glowing orange arc segment
                        drawArc(
                            color = RefBrandOrange,
                            startAngle = 310f,
                            sweepAngle = 100f,
                            useCenter = false,
                            topLeft = Offset(center.x - maxR, center.y - maxR),
                            size = Size(maxR * 2, maxR * 2),
                            style = Stroke(width = 6.dp.toPx(), cap = StrokeCap.Round)
                        )
                        }
                        // Count in center
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "$availableCount",
                                color = refTextColor(),
                                fontSize = 38.sp,
                                fontWeight = FontWeight.Black
                            )
                            Text(
                                text = "available",
                                color = refMutedColor(),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    Spacer(Modifier.height(10.dp))

                    // Matched pill
                    Row(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(refCardColor())
                            .border(1.dp, refBorderColor(), CircleShape)
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CloudDone,
                            contentDescription = null,
                            tint = refMutedColor(),
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "Matched to your workspace",
                            color = refMutedColor(),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // NEXT LEAD PREVIEW Card
            Text(
                text = "NEXT LEAD PREVIEW",
                color = refMutedColor(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )

            Spacer(Modifier.height(10.dp))

            RefCard(
                modifier = Modifier.fillMaxWidth(),
                cornerRadius = 20.dp
            ) {
                // Lead header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(refCardColor()),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = lead.customerName.take(1).uppercase(),
                                color = refTextColor(),
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(
                                text = lead.customerName,
                                color = refTextColor(),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = lead.serviceInterest,
                                color = refMutedColor(),
                                fontSize = 12.sp
                            )
                        }
                    }

                    // High priority pill
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(RefBrandOrangeSoft)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Whatshot,
                            contentDescription = null,
                            tint = RefBrandOrange,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = "High",
                            color = RefBrandOrange,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(Modifier.height(18.dp))

                // Detail metadata
                LeadMetadataRow(icon = Icons.Default.ChatBubbleOutline, label = "Source", value = displayLeadSource(lead.source))
                Spacer(Modifier.height(12.dp))
                LeadMetadataRow(icon = Icons.Default.StarBorder, label = "Priority", value = stageDisplayLabel(lead.priority.ifBlank { "Standard" }))
                Spacer(Modifier.height(12.dp))
                LeadMetadataRow(icon = Icons.Default.Schedule, label = "Added", value = formatLeadAddedDate(lead.createdAt))
            }

            Spacer(Modifier.height(10.dp))

            if (!canClaimLeads || hasPendingNotes || !errorMessage.isNullOrBlank()) {
                RefCard(
                    modifier = Modifier.fillMaxWidth(),
                    cornerRadius = 14.dp,
                ) {
                    val message = when {
                        !errorMessage.isNullOrBlank() -> errorMessage
                        !canClaimLeads -> "Complete the required training before grabbing leads."
                        else -> "Submit your pending call notes before requesting another lead pack."
                    }
                    Text(
                        text = message,
                        color = if (!errorMessage.isNullOrBlank()) RefDangerRed else refMutedColor(),
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                    )
                }
                Spacer(Modifier.height(12.dp))
            }

            // Primary Button: Grab next lead
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
                    .then(
                        if (canClaimLeads && !hasPendingNotes && !isBusy) {
                            Modifier.pressScale(onGrabNextLead)
                        } else {
                            Modifier
                        }
                    )
                    .then(if (!canClaimLeads || hasPendingNotes || isBusy) Modifier.alpha(0.55f) else Modifier)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(RefBrandOrange),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.PhoneCallback,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(
                            text = if (isBusy) "Loading leads…" else "Grab next lead",
                            color = refTextColor(),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Add to your lead queue",
                            color = refMutedColor(),
                            fontSize = 12.sp
                        )
                    }
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = refMutedColor(),
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(Modifier.height(12.dp))

            // Secondary Button: View lead queue
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
                    .pressScale(onViewLeadQueue)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF222936)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.List,
                            contentDescription = null,
                            tint = refTextColor(),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(
                            text = "View lead queue",
                            color = refTextColor(),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "See all grabbed leads",
                            color = refMutedColor(),
                            fontSize = 12.sp
                        )
                    }
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = refMutedColor(),
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(Modifier.height(20.dp))

            // Disclaimer info
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = null,
                    tint = refMutedColor(),
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Assignment is confirmed before the lead is added.",
                    color = refMutedColor(),
                    fontSize = 12.sp
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun LeadMetadataRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = refMutedColor(),
                modifier = Modifier.size(16.dp)
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = label,
                color = refMutedColor(),
                fontSize = 13.sp
            )
        }
        Text(
            text = value,
            color = refTextColor(),
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

// =============================================================================
// SCREEN 11: REFERENCE LEAD DETAILS SCREEN (11-lead-details.png)
// =============================================================================

@Composable
fun ReferenceLeadDetailScreen(
    lead: SalesLead? = null,
    currentStage: String = "Follow-up",
    nextActionSummary: String = "Call tomorrow · 11:30 AM",
    activityTimeline: List<CustomerTimelineItem> = emptyList(),
    onBackClick: () -> Unit = {},
    onMenuClick: () -> Unit = {},
    onCallClick: () -> Unit = {},
    onWhatsAppClick: () -> Unit = {},
    onChatClick: () -> Unit = {},
    onStageChange: (String) -> Unit = {},
    onNextActionClick: () -> Unit = {},
    onUpdateLeadClick: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val activeLead = lead ?: SalesLead(
        id = "",
        customerName = "Lead unavailable",
        customerPhone = "",
        customerEmail = "",
        stage = "",
        source = "",
        serviceInterest = "",
        notes = "",
        followUpAt = null,
        priority = "NORMAL"
    )
    var selectedStage by remember(lead?.id, currentStage) { mutableStateOf(currentStage) }
    var moreExpanded by remember(lead?.id) { mutableStateOf(false) }
    val priorityLabel = activeLead.priority
        .replace('_', ' ')
        .lowercase()
        .replaceFirstChar { it.uppercase() }
        .ifBlank { "Standard" }
    val sourceLabel = activeLead.source
        .replace('_', ' ')
        .replace('-', ' ')
        .lowercase()
        .replaceFirstChar { it.uppercase() }
        .ifBlank { "Website" }
    val activityItems = activityTimeline
        .sortedByDescending { timelineTimestamp(it.at) }
        .take(8)

    Scaffold(
        containerColor = Color.Transparent,
        bottomBar = {
            // Sticky "Update lead" button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(refCardColor())
                    .border(BorderStroke(1.dp, refBorderColor().copy(alpha = 0.5f)))
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 14.dp)
            ) {
                Button(
                    onClick = { onUpdateLeadClick(selectedStage) },
                    colors = ButtonDefaults.buttonColors(containerColor = RefBrandOrange),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "Update lead",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        },
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(top = 8.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 14.dp)
        ) {
            // Top Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = refTextColor()
                    )
                }
                Text(
                    text = "Lead details",
                    color = refTextColor(),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Box {
                    IconButton(onClick = { moreExpanded = true }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "More",
                            tint = refTextColor()
                        )
                    }
                    DropdownMenu(
                        expanded = moreExpanded,
                        onDismissRequest = { moreExpanded = false },
                    ) {
                        DropdownMenuItem(
                            text = { Text("Refresh lead") },
                            onClick = {
                                moreExpanded = false
                                onMenuClick()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Call contact") },
                            onClick = {
                                moreExpanded = false
                                onCallClick()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Open chat") },
                            onClick = {
                                moreExpanded = false
                                onChatClick()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Open WhatsApp") },
                            onClick = {
                                moreExpanded = false
                                onWhatsAppClick()
                            },
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Lead Profile Hero Header
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF262D38)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = activeLead.customerName.take(1).uppercase(),
                        color = refTextColor(),
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                Spacer(Modifier.height(10.dp))

                Text(
                    text = activeLead.customerName,
                    color = refTextColor(),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = activeLead.serviceInterest.ifBlank { "CRM implementation" },
                    color = refMutedColor(),
                    fontSize = 13.sp
                )

                Spacer(Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(RefBrandOrangeSoft)
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = stageDisplayLabel(selectedStage),
                            color = RefBrandOrange,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(RefBrandOrangeSoft)
                            .border(1.dp, RefBrandOrange.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = priorityLabel,
                            color = RefBrandOrange,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            // 3 Quick Action Buttons: Call (Orange solid), WhatsApp, Chat
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                // Call
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(RefBrandOrange)
                            .pressScale(onCallClick),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Call,
                            contentDescription = "Call",
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(text = "Call", color = refTextColor(), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }

                // WhatsApp
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(refCardColor())
                            .border(1.dp, refBorderColor(), CircleShape)
                            .pressScale(onWhatsAppClick),
                        contentAlignment = Alignment.Center
                    ) {
                        WhatsAppGlyph(tint = refTextColor(), modifier = Modifier.size(22.dp))
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(text = "WhatsApp", color = refTextColor(), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }

                // Chat
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(refCardColor())
                            .border(1.dp, refBorderColor(), CircleShape)
                            .pressScale(onChatClick),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.ChatBubbleOutline,
                            contentDescription = "Chat",
                            tint = refTextColor(),
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(text = "Chat", color = refTextColor(), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }

            Spacer(Modifier.height(22.dp))

            // Metadata card: Assigned to, Source, Added
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                MetadataColumn(icon = Icons.Default.PersonOutline, label = "Assigned to", value = "You")
                MetadataColumn(icon = Icons.Default.Link, label = "Source", value = sourceLabel)
                MetadataColumn(
                    icon = Icons.Default.CalendarToday,
                    label = "Added",
                    value = formatLeadAddedDate(
                        activityTimeline.minByOrNull { timelineTimestamp(it.at) }?.at.orEmpty()
                    )
                )
            }

            Spacer(Modifier.height(22.dp))

            // Stage Selector
            Text(
                text = "Stage",
                color = refTextColor(),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("New", "Contacted", "Follow-up", "Qualified").forEach { stage ->
                    val isSelected = selectedStage
                        .replace('_', '-')
                        .replace(' ', '-')
                        .equals(stage.replace('_', '-').replace(' ', '-'), ignoreCase = true)
                    val bg by animateColorAsState(if (isSelected) RefBrandOrange else refCardColor(), label = "stageBg")
                    val tc by animateColorAsState(if (isSelected) Color.White else refTextColor(), label = "stageTc")
                    val bc by animateColorAsState(if (isSelected) RefBrandOrange else refBorderColor(), label = "stageBc")

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(bg)
                            .border(1.dp, bc, RoundedCornerShape(12.dp))
                            .pressScale {
                                selectedStage = stage
                                onStageChange(stage)
                            }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = stage,
                            color = tc,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // Next action card
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
                    .pressScale(onNextActionClick)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFF222936)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CalendarToday,
                            contentDescription = null,
                            tint = refTextColor(),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(
                            text = "Next action",
                            color = refMutedColor(),
                            fontSize = 12.sp
                        )
                        Text(
                            text = nextActionSummary,
                            color = refTextColor(),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = refMutedColor(),
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(Modifier.height(22.dp))

            // Activity Section
            Text(
                text = "Activity",
                color = refTextColor(),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(14.dp))

            // Render the live Customer 360 timeline. The previous version
            // always showed three invented events, which made every lead look
            // identical even when the API returned different activity.
            if (activityItems.isEmpty()) {
                Text(
                    text = "No activity recorded yet.",
                    color = refMutedColor(),
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            } else {
                activityItems.forEachIndexed { index, item ->
                    val style = timelineStyle(item.type)
                    ActivityTimelineNode(
                        icon = style.first,
                        iconTint = style.second,
                        iconBg = style.third,
                        title = item.title.ifBlank { "Lead activity" },
                        subtitle = item.detail?.ifBlank { null } ?: item.type.replace('_', ' ').replace('-', ' ').lowercase().replaceFirstChar { it.uppercase() },
                        time = formatTimelineDate(item.at),
                        isLast = index == activityItems.lastIndex,
                    )
                }
            }

            Spacer(Modifier.height(18.dp))
        }
    }
}

private fun timelineTimestamp(value: String): Long =
    runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(Long.MIN_VALUE)

private fun displayLeadSource(value: String): String {
    if (value.isBlank()) return "Unknown"
    return value
        .replace('_', ' ')
        .replace('-', ' ')
        .trim()
        .lowercase(Locale.getDefault())
        .split(Regex("\\s+"))
        .joinToString(" ") { word -> word.replaceFirstChar { it.uppercase(Locale.getDefault()) } }
}

private fun formatLeadAddedDate(value: String): String {
    val instant = runCatching { Instant.parse(value) }.getOrNull() ?: return "Recently"
    val date = instant.atZone(ZoneId.systemDefault()).toLocalDate()
    return when {
        date == LocalDate.now() -> "Today"
        date == LocalDate.now().minusDays(1) -> "Yesterday"
        else -> DateTimeFormatter.ofPattern("d MMM yyyy", Locale.getDefault()).format(date)
    }
}

private fun formatTimelineDate(value: String): String {
    val instant = runCatching { Instant.parse(value) }.getOrNull() ?: return "Date unavailable"
    val local = instant.atZone(ZoneId.systemDefault())
    return DateTimeFormatter.ofPattern("d MMM\nh:mm a", Locale.getDefault()).format(local)
}

private fun timelineStyle(type: String): Triple<ImageVector, Color, Color> {
    return when {
        type.contains("call", ignoreCase = true) -> Triple(Icons.Default.Call, RefDarkText, Color(0xFF232A36))
        type.contains("message", ignoreCase = true) || type.contains("chat", ignoreCase = true) -> Triple(Icons.Default.Chat, Color.White, RefSuccessGreen)
        type.contains("task", ignoreCase = true) || type.contains("follow", ignoreCase = true) -> Triple(Icons.Default.CalendarToday, RefWarningYellow, Color(0xFF3A2D18))
        else -> Triple(Icons.Default.PersonOutline, RefDarkText, Color(0xFF232A36))
    }
}

@Composable
private fun MetadataColumn(icon: ImageVector, label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = refMutedColor(),
            modifier = Modifier.size(18.dp)
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = label,
            color = refMutedColor(),
            fontSize = 11.sp
        )
        Text(
            text = value,
            color = refTextColor(),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun ActivityTimelineNode(
    icon: ImageVector,
    iconTint: Color,
    iconBg: Color,
    title: String,
    subtitle: String,
    time: String,
    isLast: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(iconBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(16.dp)
                )
            }
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(38.dp)
                        .background(Color(0xFF2A313E))
                )
            }
        }

        Spacer(Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = refTextColor(),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = subtitle,
                color = refMutedColor(),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Text(
            text = time,
            color = refMutedColor(),
            fontSize = 11.sp,
            textAlign = TextAlign.End
        )
    }
}

// =============================================================================
// SCREEN 12: REFERENCE COMPLETE CALL SCREEN (12-complete-call.png)
// =============================================================================

@Composable
fun ReferenceCompleteCallScreen(
    contactName: String = "",
    callTypeAndDuration: String = "",
    initialOutcome: String = "",
    initialFollowUpText: String = "",
    initialNotes: String = "",
    recordingStatus: String = "none",
    recordingDurationSeconds: Int = 0,
    onBackClick: () -> Unit = {},
    onSelectFollowUpTime: () -> Unit = {},
    onAttachAudioClick: () -> Unit = {},
    onRetryRecordingClick: () -> Unit = {},
    onSaveOutcome: (outcome: String, notes: String, followUpText: String, moveToFollowUp: Boolean) -> Unit = { _, _, _, _ -> },
    modifier: Modifier = Modifier) {
    var outcome by remember { mutableStateOf(initialOutcome) }
    var notes by remember { mutableStateOf(initialNotes) }
    var followUpTime by remember { mutableStateOf(initialFollowUpText) }
    var moveToFollowUp by remember {
        mutableStateOf(
            initialOutcome.equals("Follow-up", ignoreCase = true) || initialFollowUpText.isNotBlank()
        )
    }

    LaunchedEffect(initialFollowUpText) {
        if (initialFollowUpText.isNotBlank()) {
            followUpTime = initialFollowUpText
            moveToFollowUp = true
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        bottomBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(refCardColor())
                    .border(BorderStroke(1.dp, refBorderColor().copy(alpha = 0.5f)))
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 14.dp)
            ) {
                Button(
                    onClick = { onSaveOutcome(outcome, notes, followUpTime, moveToFollowUp) },
                    colors = ButtonDefaults.buttonColors(containerColor = RefBrandOrange),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    Text(
                        text = "Save outcome",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        },
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(top = 8.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 14.dp)
        ) {
            // Top Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = refTextColor()
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Complete call",
                    color = refTextColor(),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.height(16.dp))

            // Call Summary Card
            RefCard(
                modifier = Modifier.fillMaxWidth(),
                cornerRadius = 20.dp
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF262D38)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = contactName.take(1).uppercase(),
                                color = refTextColor(),
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(
                                text = contactName,
                                color = refTextColor(),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = callTypeAndDuration,
                                color = refMutedColor(),
                                fontSize = 12.sp
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(RefBrandOrangeSoft),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Call,
                            contentDescription = null,
                            tint = RefBrandOrange,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                // Waveform indicator
                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(24.dp)
                ) {
                    val count = 38
                    val w = 2.dp.toPx()
                    val gap = (size.width - count * w) / (count - 1)
                    for (i in 0 until count) {
                        val h = size.height * (0.3f + (i % 5) * 0.15f)
                        val x = i * (w + gap)
                        val y = (size.height - h) / 2f
                        drawRoundRect(
                            color = Color(0xFF333D4D),
                            topLeft = Offset(x, y),
                            size = Size(w, h),
                            cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f, 2f)
                        )
                    }
                }

                val isDispoUploaded = recordingStatus.equals("UPLOADED", ignoreCase = true) || recordingStatus.equals("ready", ignoreCase = true)
                val isDispoUploading = recordingStatus.equals("UPLOADING", ignoreCase = true) || recordingStatus.equals("LOCAL_PENDING", ignoreCase = true) || recordingStatus.equals("processing", ignoreCase = true)
                val isDispoFailed = recordingStatus.equals("FAILED", ignoreCase = true) || recordingStatus.equals("FAILED_PERMANENT", ignoreCase = true)

                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isDispoUploaded) RefSuccessGreen.copy(alpha = 0.12f) else if (isDispoUploading) RefBrandOrange.copy(alpha = 0.12f) else if (isDispoFailed) RefDangerRed.copy(alpha = 0.12f) else refCardColor())
                        .border(1.dp, if (isDispoUploaded) RefSuccessGreen.copy(alpha = 0.4f) else if (isDispoUploading) RefBrandOrange.copy(alpha = 0.4f) else if (isDispoFailed) RefDangerRed.copy(alpha = 0.4f) else refBorderColor(), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = when {
                                isDispoUploaded -> Icons.Default.CloudDone
                                isDispoUploading -> Icons.Default.Sync
                                isDispoFailed -> Icons.Default.ErrorOutline
                                else -> Icons.Default.MicOff
                            },
                            contentDescription = null,
                            tint = when {
                                isDispoUploaded -> RefSuccessGreen
                                isDispoUploading -> RefBrandOrange
                                isDispoFailed -> RefDangerRed
                                else -> refMutedColor()
                            },
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        val durationText = if (recordingDurationSeconds > 0) String.format(" (%02d:%02d)", recordingDurationSeconds / 60, recordingDurationSeconds % 60) else ""
                        Text(
                            text = when {
                                isDispoUploaded -> "Audio synced$durationText"
                                isDispoUploading -> "Uploading recording in background..."
                                isDispoFailed -> "Recording upload failed"
                                else -> "No audio synced for this call"
                            },
                            color = refTextColor(),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    if (isDispoFailed) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "Retry",
                                color = RefBrandOrange,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(RefBrandOrange.copy(alpha = 0.15f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                    .pressScale(onRetryRecordingClick)
                            )
                            Text(
                                text = "Attach",
                                color = refTextColor(),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(refCardColor())
                                    .border(1.dp, refBorderColor(), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                    .pressScale(onAttachAudioClick)
                            )
                        }
                    } else if (!isDispoUploaded && !isDispoUploading) {
                        Text(
                            text = "Attach audio",
                            color = RefBrandOrange,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(RefBrandOrange.copy(alpha = 0.15f))
                                .padding(horizontal = 10.dp, vertical = 5.dp)
                                .pressScale(onAttachAudioClick)
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                if (isDispoUploaded) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = RefSuccessGreen,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "Recording synced",
                            color = refMutedColor(),
                            fontSize = 12.sp
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Disposition Selector Header
            Text(
                text = "How did the call go?",
                color = refTextColor(),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(8.dp))

            // Row 1: Connected, No answer, Busy
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutcomeButton(
                    icon = Icons.Default.Call,
                    label = "Connected",
                    isSelected = outcome == "Connected",
                    modifier = Modifier.weight(1f),
                    onClick = { outcome = "Connected" }
                )
                OutcomeButton(
                    icon = Icons.Default.CallMissed,
                    label = "No answer",
                    isSelected = outcome == "No answer",
                    modifier = Modifier.weight(1f),
                    onClick = { outcome = "No answer" }
                )
                OutcomeButton(
                    icon = Icons.Default.PhonePaused,
                    label = "Busy",
                    isSelected = outcome == "Busy",
                    modifier = Modifier.weight(1f),
                    onClick = { outcome = "Busy" }
                )
            }

            Spacer(Modifier.height(6.dp))

            // Row 2: Follow-up, Not interested
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutcomeButton(
                    icon = Icons.Default.CalendarToday,
                    label = "Follow-up",
                    isSelected = outcome == "Follow-up",
                    modifier = Modifier.weight(1f),
                    onClick = {
                        outcome = "Follow-up"
                        moveToFollowUp = true
                    }
                )
                OutcomeButton(
                    icon = Icons.Default.Block,
                    label = "Not interested",
                    isSelected = outcome == "Not interested",
                    modifier = Modifier.weight(1f),
                    onClick = { outcome = "Not interested" }
                )
            }

            Spacer(Modifier.height(12.dp))

            // Next follow-up picker card
            Text(
                text = "Next follow-up",
                color = refTextColor(),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(16.dp))
                    .pressScale(onSelectFollowUpTime)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.CalendarToday,
                        contentDescription = null,
                        tint = refMutedColor(),
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        text = followUpTime.ifBlank { "Choose date and time" },
                        color = if (followUpTime.isBlank()) refMutedColor() else refTextColor(),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = refMutedColor(),
                    modifier = Modifier.size(18.dp)
                )
            }

            Spacer(Modifier.height(12.dp))

            // Notes Section
            Text(
                text = "Notes",
                color = refTextColor(),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(6.dp))

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                placeholder = {
                    Text("Add discussion notes", color = refMutedColor(), fontSize = 13.sp)
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.EditNote,
                        contentDescription = null,
                        tint = refMutedColor()
                    )
                },
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = refCardColor(),
                    unfocusedContainerColor = refCardColor(),
                    focusedBorderColor = RefBrandOrange,
                    unfocusedBorderColor = refBorderColor(),
                    focusedTextColor = refTextColor(),
                    unfocusedTextColor = refTextColor()
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp)
            )

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Move lead to Follow-up",
                    color = refTextColor(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
                Switch(
                    checked = moveToFollowUp,
                    onCheckedChange = { moveToFollowUp = it },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = RefBrandOrange,
                        uncheckedThumbColor = refMutedColor(),
                        uncheckedTrackColor = refBorderColor(),
                    ),
                )
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
fun ReferenceCompleteCallLoadingState(
    onBackClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Scaffold(
        containerColor = Color.Transparent,
        modifier = modifier,
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp, vertical = 12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBackClick) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = refTextColor())
                }
                Spacer(Modifier.width(8.dp))
                Text("Complete call", color = refTextColor(), fontSize = 22.sp, fontWeight = FontWeight.Bold)
            }
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CircularProgressIndicator(color = RefBrandOrange)
                    Text("Loading call details…", color = refMutedColor(), fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
private fun OutcomeButton(
    icon: ImageVector,
    label: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val bg by animateColorAsState(if (isSelected) RefBrandOrange else refCardColor(), label = "outcomeBg")
    val tc by animateColorAsState(if (isSelected) Color.White else refTextColor(), label = "outcomeTc")
    val bc by animateColorAsState(if (isSelected) RefBrandOrange else refBorderColor(), label = "outcomeBc")

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(bg)
            .border(1.dp, bc, RoundedCornerShape(16.dp))
            .pressScale(onClick)
            .padding(vertical = 14.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = tc,
            modifier = Modifier.size(20.dp)
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = label,
            color = tc,
            fontSize = 12.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// =============================================================================
// PREVIEW DATA GENERATOR (Preview-Only Sample Data)
// =============================================================================

private fun sampleRecentLeads(): List<SalesLead> = emptyList()

private fun sampleCallsList(): List<MobileCall> = emptyList()

// =============================================================================
// COMPOSE PREVIEWS (Dark & Light Theme Validations)
// =============================================================================

@Preview(name = "Home Screen - Dark", showBackground = true)
@Composable
private fun PreviewReferenceHomeScreenDark() {
    GXClosersTheme {
        ReferenceHomeScreen()
    }
}

@Preview(name = "Leads Screen - Dark", showBackground = true)
@Composable
private fun PreviewReferenceLeadsScreenDark() {
    GXClosersTheme {
        ReferenceLeadsScreen()
    }
}

@Preview(name = "Calls Screen - Dark", showBackground = true)
@Composable
private fun PreviewReferenceCallsScreenDark() {
    GXClosersTheme {
        ReferenceCallsScreen()
    }
}

@Preview(name = "Grab Leads - Dark", showBackground = true)
@Composable
private fun PreviewReferenceGrabLeadsScreenDark() {
    GXClosersTheme {
        ReferenceGrabLeadsScreen()
    }
}

@Preview(name = "Lead Detail - Dark", showBackground = true)
@Composable
private fun PreviewReferenceLeadDetailScreenDark() {
    GXClosersTheme {
        ReferenceLeadDetailScreen()
    }
}

@Preview(name = "Complete Call - Dark", showBackground = true)
@Composable
private fun PreviewReferenceCompleteCallScreenDark() {
    GXClosersTheme {
        ReferenceCompleteCallScreen()
    }
}
