package com.gigxomi.gxclosers.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gigxomi.gxclosers.data.*
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
private val RefDarkCard = Color(0xFF14171D)
private val RefDarkCardElevated = Color(0xFF1A1F27)
private val RefDarkBorder = Color(0xFF232832)
private val RefDarkBorderSubtle = Color(0xFF1C2028)
private val RefDarkMuted = Color(0xFF8E98A8)
private val RefDarkText = Color(0xFFF6F8FA)

private val RefLightBg = Color(0xFFF7F8FA)
private val RefLightCard = Color(0xFFFFFFFF)
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

// =============================================================================
// SUBTLE PREMIUM MOTION MODIFIERS
// =============================================================================

@Composable
private fun Modifier.pressScale(onClick: () -> Unit): Modifier {
    val scale = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()
    return this
        .scale(scale.value)
        .pointerInput(onClick) {
            detectTapGestures(
                onPress = {
                    try {
                        scale.animateTo(0.97f, animationSpec = tween(70, easing = FastOutSlowInEasing))
                        awaitRelease()
                    } finally {
                        scale.animateTo(1f, animationSpec = tween(120, easing = FastOutSlowInEasing))
                    }
                },
                onTap = { onClick() }
            )
        }
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
private fun RefBottomNavBar(
    selectedTab: String,
    onTabSelected: (String) -> Unit
) {
    Surface(
        color = refCardColor(),
        border = BorderStroke(1.dp, refBorderColor().copy(alpha = 0.6f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 8.dp),
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
                        .clip(RoundedCornerShape(14.dp))
                        .background(bgColor)
                        .pressScale { onTabSelected(id) }
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = iconColor,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(Modifier.height(3.dp))
                    Text(
                        text = label,
                        fontSize = 11.sp,
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
    agentName: String = "Ankit",
    greeting: String = "Good morning, $agentName",
    headline: String = "Ready to close more today?",
    callsToday: Int = 24,
    talkTimeMinutes: Int = 38,
    leadsCount: Int = 12,
    syncStatusText: String = "Synced just now",
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

    AnimatedVisibility(
        visible = true,
        enter = fadeIn(tween(220)) + slideInVertically(tween(220)) { 25 }
    ) {
        Scaffold(
            containerColor = refBgColor(),
            bottomBar = {
                RefBottomNavBar(selectedTab = selectedNavTab, onTabSelected = onNavTabSelected)
            },
            modifier = modifier
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
                val leadsToDisplay = if (recentLeads.isEmpty()) {
                    sampleRecentLeads()
                } else {
                    recentLeads.take(4)
                }

                leadsToDisplay.forEach { lead ->
                    HomeRecentLeadItem(
                        lead = lead,
                        onLeadClick = { onLeadClick(lead) },
                        onCallLead = { onCallLead(lead) }
                    )
                    Spacer(Modifier.height(10.dp))
                }

                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun HomeCallsGaugeCard(
    callsToday: Int,
    talkTimeMinutes: Int,
    leadsCount: Int,
    syncStatusText: String
) {
    RefCard(
        modifier = Modifier.fillMaxWidth(),
        cornerRadius = 24.dp
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            // Dial Canvas
            Canvas(
                modifier = Modifier
                    .size(190.dp)
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
                        color = Color(0xFF2B3340).copy(alpha = 0.5f),
                        start = Offset(startX, startY),
                        end = Offset(endX, endY),
                        strokeWidth = 2.dp.toPx(),
                        cap = StrokeCap.Round
                    )
                }

                // Gray track arc
                drawArc(
                    color = Color(0xFF262E3B).copy(alpha = 0.4f),
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
                    fontSize = 38.sp,
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
                    .background(Color(0xFF1B202A))
                    .border(1.dp, RefDarkBorder, RoundedCornerShape(14.dp))
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
                    .background(Color(0xFF1B202A))
                    .border(1.dp, RefDarkBorder, RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${talkTimeMinutes}m",
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

        Spacer(Modifier.height(14.dp))

        // Synced pill at bottom of gauge
        Row(
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .clip(CircleShape)
                .background(Color(0xFF181E27))
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
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(RefBrandOrange),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PhoneCallback,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
            Spacer(Modifier.width(14.dp))
            Column {
                Text(
                    text = "Grab leads",
                    color = refTextColor(),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Find available leads",
                    color = refMutedColor(),
                    fontSize = 13.sp
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
}

@Composable
private fun HomeQuickActionsRow(
    onWhatsAppClick: () -> Unit,
    onChatsClick: () -> Unit,
    onPaymentsClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        val actions = listOf(
            Triple("WhatsApp", Icons.Default.Chat, onWhatsAppClick),
            Triple("Chats", Icons.Default.ChatBubbleOutline, onChatsClick),
            Triple("Payments", Icons.Default.CreditCard, onPaymentsClick)
        )

        actions.forEach { (label, icon, click) ->
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(16.dp))
                    .pressScale(click)
                    .padding(vertical = 14.dp, horizontal = 8.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = refTextColor(),
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = label,
                    color = refTextColor(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun HomeRecentLeadItem(
    lead: SalesLead,
    onLeadClick: () -> Unit,
    onCallLead: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(refCardColor())
            .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
            .pressScale(onLeadClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            // Circular initial avatar
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF262D38)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = lead.customerName.take(1).uppercase(),
                    color = refTextColor(),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.width(14.dp))

            Column {
                Text(
                    text = lead.customerName,
                    color = refTextColor(),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = lead.stage.ifBlank { "New lead" },
                    color = refMutedColor(),
                    fontSize = 12.sp
                )
            }
        }

        // Circular call icon button
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Color(0xFF1E242F))
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
        val base = if (leads.isEmpty()) sampleRecentLeads() else leads
        base.filter { lead ->
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
        containerColor = refBgColor(),
        bottomBar = {
            RefBottomNavBar(selectedTab = selectedNavTab, onTabSelected = onNavTabSelected)
        },
        modifier = modifier
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(top = 14.dp, bottom = 24.dp),
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
                val chips = listOf("All", "New", "Follow-up", "Contacted", "Qualified")
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
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(refCardColor())
            .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
            .pressScale(onLeadClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF262D38)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = lead.customerName.take(1).uppercase(),
                    color = refTextColor(),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = lead.customerName,
                    color = refTextColor(),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = lead.serviceInterest.ifBlank { "General enquiry" },
                    color = refMutedColor(),
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(6.dp))

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
                            text = lead.stage.ifBlank { "New lead" },
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
        }

        Spacer(Modifier.width(10.dp))

        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(Color(0xFF1E242F))
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
}

// =============================================================================
// SCREEN 08: REFERENCE CALLS SCREEN (08-calls.png)
// =============================================================================

@Composable
fun ReferenceCallsScreen(
    calls: List<MobileCall> = emptyList(),
    activeCall: MobileCall? = null,
    isPlaying: Boolean = false,
    playbackPositionSeconds: Int = 36,
    selectedCallTab: String = "Outbound",
    selectedNavTab: String = "calls",
    onNotificationClick: () -> Unit = {},
    onPlayPauseToggle: () -> Unit = {},
    onSkipBackward: () -> Unit = {},
    onSkipForward: () -> Unit = {},
    onSeek: (Float) -> Unit = {},
    onCallTabSelect: (String) -> Unit = {},
    onCallClick: (MobileCall) -> Unit = {},
    onNavTabSelected: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Scaffold(
        containerColor = refBgColor(),
        bottomBar = {
            RefBottomNavBar(selectedTab = selectedNavTab, onTabSelected = onNavTabSelected)
        },
        modifier = modifier
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(top = 14.dp, bottom = 24.dp),
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
            }

            // Audio Player Hero Card
            item {
                CallsPlayerCard(
                    activeCall = activeCall,
                    isPlaying = isPlaying,
                    currentPos = playbackPositionSeconds,
                    onPlayPauseToggle = onPlayPauseToggle,
                    onSkipBackward = onSkipBackward,
                    onSkipForward = onSkipForward
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
                    val tabs = listOf("Inbound", "Outbound", "Missed")
                    tabs.forEach { tab ->
                        val isSelected = selectedCallTab.equals(tab, ignoreCase = true)
                        val bgColor by animateColorAsState(
                            if (isSelected) Color(0xFF262C38) else Color.Transparent,
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
            val displayCalls = if (calls.isEmpty()) sampleCallsList() else calls
            items(displayCalls) { call ->
                CallsHistoryItemCard(call = call, onClick = { onCallClick(call) })
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
    onSkipForward: () -> Unit
) {
    val totalSeconds = activeCall?.durationSeconds ?: 138 // 02:18
    val contactName = activeCall?.assignment?.customerName ?: "Ankit Sharma"

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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.NorthEast,
                            contentDescription = null,
                            tint = RefSuccessGreen,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = "Outgoing · 02:18",
                            color = refMutedColor(),
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // Synced badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Color(0xFF1A222D))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.CloudDone,
                    contentDescription = null,
                    tint = RefSuccessGreen,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    text = "Recording synced",
                    color = refTextColor(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
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
            val playedFraction = (currentPos.toFloat() / totalSeconds.toFloat()).coerceIn(0f, 1f)

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
                    color = if (isPlayed) RefBrandOrange else Color(0xFF333B4A),
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
                .height(16.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Canvas(modifier = Modifier.fillMaxWidth().height(4.dp)) {
                val playedFraction = (currentPos.toFloat() / totalSeconds.toFloat()).coerceIn(0f, 1f)
                // Background line
                drawRoundRect(
                    color = Color(0xFF2E3644),
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
                    .background(Color(0xFF1E242E))
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
                    .background(RefBrandOrange)
                    .pressScale(onPlayPauseToggle),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = "Play/Pause",
                    tint = Color.White,
                    modifier = Modifier.size(32.dp)
                )
            }

            Spacer(Modifier.width(24.dp))

            // Skip +15s
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF1E242E))
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
    onClick: () -> Unit
) {
    val contactName = call.assignment?.customerName ?: "Contact"
    val isOutbound = call.status.equals("completed", true)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(refCardColor())
            .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
            .pressScale(onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            // Direction square icon
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isOutbound) Color(0x1A10B981) else Color(0x1AEF4444)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isOutbound) Icons.Default.NorthEast else Icons.Default.SouthWest,
                    contentDescription = null,
                    tint = if (isOutbound) RefSuccessGreen else RefDangerRed,
                    modifier = Modifier.size(18.dp)
                )
            }

            Spacer(Modifier.width(14.dp))

            Column {
                Text(
                    text = contactName,
                    color = refTextColor(),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "Today, 9:14 AM",
                    color = refMutedColor(),
                    fontSize = 12.sp
                )
            }
        }

        Column(horizontalAlignment = Alignment.End) {
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (call.durationSeconds > 0) {
                    Icon(
                        imageVector = Icons.Default.CloudDone,
                        contentDescription = null,
                        tint = RefSuccessGreen,
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = "Ready to play",
                        color = refMutedColor(),
                        fontSize = 11.sp
                    )
                } else {
                    Text(
                        text = "No audio · Missed",
                        color = refMutedColor(),
                        fontSize = 11.sp
                    )
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
}

// =============================================================================
// SCREEN 09: REFERENCE MORE DRAWER (09-more-drawer.png)
// =============================================================================

@Composable
fun ReferenceMoreDrawer(
    userName: String = "Ankit Rathore",
    userRole: String = "Sales closer",
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

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.65f))
            .clickable(onClick = onClose)
    ) {
        AnimatedVisibility(
            visible = true,
            enter = fadeIn(tween(180)) + slideInHorizontally(tween(220)) { -it }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(0.85f)
                    .background(Color(0xFF101319))
                    .clickable(enabled = false) {} // Consume click inside drawer
                    .verticalScroll(scrollState)
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
                        .background(Color(0xFF181D26))
                        .border(1.dp, RefDarkBorder, RoundedCornerShape(18.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF28303E)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = userName.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString(""),
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(
                            text = userName,
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = userRole,
                            color = RefDarkMuted,
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
                            tint = RefDarkMuted,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = "Appearance",
                            color = RefDarkText,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    // 3-Option segmented pill
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF191E27))
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(12.dp))
                            .padding(2.dp)
                    ) {
                        listOf("Light", "Dark", "System").forEach { theme ->
                            val isSelected = currentTheme.equals(theme, ignoreCase = true)
                            val bg by animateColorAsState(
                                if (isSelected) Color(0xFF2C3442) else Color.Transparent,
                                label = "themeBg"
                            )
                            val tc by animateColorAsState(
                                if (isSelected) Color.White else RefDarkMuted,
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
        color = Color(0xFF6B7280),
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
                tint = RefDarkMuted,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(14.dp))
            Text(
                text = label,
                color = RefDarkText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = RefDarkMuted.copy(alpha = 0.6f),
            modifier = Modifier.size(18.dp)
        )
    }
}

// =============================================================================
// SCREEN 10: REFERENCE GRAB LEADS SCREEN (10-grab-leads.png)
// =============================================================================

@Composable
fun ReferenceGrabLeadsScreen(
    availableCount: Int = 12,
    previewLead: AvailableLead? = null,
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
        containerColor = refBgColor(),
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
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

            // Radar Gauge Card
            RefCard(
                modifier = Modifier.fillMaxWidth(),
                cornerRadius = 24.dp
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    // Concentric radar circles Canvas
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
                            color = Color(0xFF242C39).copy(alpha = 0.35f),
                            start = Offset(center.x - maxR, center.y),
                            end = Offset(center.x + maxR, center.y),
                            strokeWidth = 1.dp.toPx()
                        )
                        drawLine(
                            color = Color(0xFF242C39).copy(alpha = 0.35f),
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
                        .align(Alignment.CenterHorizontally)
                        .clip(CircleShape)
                        .background(Color(0xFF19202B))
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
                                .background(Color(0xFF262D38)),
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
                LeadMetadataRow(icon = Icons.Default.ChatBubbleOutline, label = "Source", value = lead.source)
                Spacer(Modifier.height(12.dp))
                LeadMetadataRow(icon = Icons.Default.Phone, label = "Phone", value = "+91 98XXX 4521")
                Spacer(Modifier.height(12.dp))
                LeadMetadataRow(icon = Icons.Default.MailOutline, label = "Email", value = "aarav.k@XXXX.com")
            }

            Spacer(Modifier.height(16.dp))

            // Primary Button: Grab next lead
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(18.dp))
                    .pressScale(onGrabNextLead)
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
                            text = "Grab next lead",
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
    onUpdateLeadClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val activeLead = lead ?: sampleRecentLeads().first()
    var selectedStage by remember { mutableStateOf(currentStage) }

    Scaffold(
        containerColor = refBgColor(),
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
                    onClick = onUpdateLeadClick,
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
                IconButton(onClick = onMenuClick) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "More",
                        tint = refTextColor()
                    )
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
                            text = selectedStage,
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
                            text = "High",
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
                        Icon(
                            imageVector = Icons.Default.Chat,
                            contentDescription = "WhatsApp",
                            tint = refTextColor(),
                            modifier = Modifier.size(22.dp)
                        )
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
                MetadataColumn(icon = Icons.Default.Link, label = "Source", value = activeLead.source.ifBlank { "Website" })
                MetadataColumn(icon = Icons.Default.CalendarToday, label = "Added", value = "Today")
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
                    val isSelected = selectedStage.equals(stage, ignoreCase = true)
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

            // Vertical Activity Nodes
            ActivityTimelineNode(
                icon = Icons.Default.PersonOutline,
                iconTint = refTextColor(),
                iconBg = Color(0xFF232A36),
                title = "Lead assigned",
                subtitle = "Assigned to you",
                time = "Today\n9:12 AM"
            )
            ActivityTimelineNode(
                icon = Icons.Default.Chat,
                iconTint = Color.White,
                iconBg = RefSuccessGreen,
                title = "WhatsApp message",
                subtitle = "Hi Ankit, sharing the product overview...",
                time = "Today\n10:04 AM"
            )
            ActivityTimelineNode(
                icon = Icons.Default.Call,
                iconTint = refTextColor(),
                iconBg = Color(0xFF232A36),
                title = "Outgoing call · 02:18",
                subtitle = "Recording synced",
                time = "Today\n11:26 AM",
                isLast = true
            )

            Spacer(Modifier.height(18.dp))
        }
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
    contactName: String = "Ankit Sharma",
    callTypeAndDuration: String = "Outgoing · 02:18",
    initialOutcome: String = "Connected",
    initialFollowUpText: String = "Tomorrow · 11:30 AM",
    initialNotes: String = "",
    initialMoveToFollowUp: Boolean = true,
    onBackClick: () -> Unit = {},
    onSelectFollowUpTime: () -> Unit = {},
    onSaveOutcome: (outcome: String, notes: String, followUpText: String, moveToFollowUp: Boolean) -> Unit = { _, _, _, _ -> },
    modifier: Modifier = Modifier
) {
    var outcome by remember { mutableStateOf(initialOutcome) }
    var notes by remember { mutableStateOf(initialNotes) }
    var followUpTime by remember { mutableStateOf(initialFollowUpText) }
    var moveToFollowUp by remember { mutableStateOf(initialMoveToFollowUp) }

    Scaffold(
        containerColor = refBgColor(),
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

                Spacer(Modifier.height(14.dp))

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

                Spacer(Modifier.height(12.dp))

                // Green Recording synced badge
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

            Spacer(Modifier.height(22.dp))

            // Disposition Selector Header
            Text(
                text = "How did the call go?",
                color = refTextColor(),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(12.dp))

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

            Spacer(Modifier.height(8.dp))

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
                    onClick = { outcome = "Follow-up" }
                )
                OutcomeButton(
                    icon = Icons.Default.Block,
                    label = "Not interested",
                    isSelected = outcome == "Not interested",
                    modifier = Modifier.weight(1f),
                    onClick = { outcome = "Not interested" }
                )
            }

            Spacer(Modifier.height(20.dp))

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
                    .padding(16.dp),
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
                        text = followUpTime,
                        color = refTextColor(),
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

            Spacer(Modifier.height(20.dp))

            // Notes Section
            Text(
                text = "Notes",
                color = refTextColor(),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(8.dp))

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
                    .height(100.dp)
            )

            Spacer(Modifier.height(16.dp))

            // Move lead to Follow-up Switch
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(refCardColor())
                    .border(1.dp, refBorderColor(), RoundedCornerShape(16.dp))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Move lead to Follow-up",
                    color = refTextColor(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
                Switch(
                    checked = moveToFollowUp,
                    onCheckedChange = { moveToFollowUp = it },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = RefBrandOrange,
                        uncheckedThumbColor = refMutedColor(),
                        uncheckedTrackColor = Color(0xFF232A36)
                    )
                )
            }

            Spacer(Modifier.height(20.dp))
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

private fun sampleRecentLeads(): List<SalesLead> {
    return listOf(
        SalesLead(
            id = "lead_1",
            customerName = "Ankit Sharma",
            customerPhone = "+91 98000 11223",
            customerEmail = "ankit.sharma@example.com",
            stage = "Follow-up",
            source = "Website",
            serviceInterest = "Salon enquiry",
            notes = "Interested in monthly agency retainers",
            followUpAt = "2026-10-13T11:30:00Z",
            priority = "HIGH"
        ),
        SalesLead(
            id = "lead_2",
            customerName = "Priya Mehta",
            customerPhone = "+91 91234 56789",
            customerEmail = "priya.mehta@example.com",
            stage = "New lead",
            source = "Instagram DM",
            serviceInterest = "Wedding event",
            notes = "Sent intro brochure",
            followUpAt = null,
            priority = "NORMAL"
        ),
        SalesLead(
            id = "lead_3",
            customerName = "Rahul Verma",
            customerPhone = "+91 99887 66554",
            customerEmail = "rahul.verma@example.com",
            stage = "Contacted",
            source = "Meta Lead Ads",
            serviceInterest = "Corporate event",
            notes = "Budget confirmed around 50k",
            followUpAt = "2026-10-14T10:00:00Z",
            priority = "NORMAL"
        ),
        SalesLead(
            id = "lead_4",
            customerName = "Neha Kapoor",
            customerPhone = "+91 98765 43210",
            customerEmail = "neha.kapoor@example.com",
            stage = "Qualified",
            source = "Website",
            serviceInterest = "Birthday event",
            notes = "Closing call scheduled",
            followUpAt = null,
            priority = "HIGH"
        )
    )
}

private fun sampleCallsList(): List<MobileCall> {
    val leads = sampleRecentLeads()
    return listOf(
        MobileCall(
            id = "call_1",
            assignmentId = "lead_1",
            phoneNumber = "+91 98000 11223",
            status = "completed",
            outcome = "Connected",
            note = "Client discussed implementation timeline",
            durationSeconds = 138,
            recordingStatus = "ready",
            recordingError = null,
            startedAt = "2026-10-12T09:14:00Z",
            endedAt = "2026-10-12T09:16:18Z",
            assignment = leads[0]
        ),
        MobileCall(
            id = "call_2",
            assignmentId = "lead_2",
            phoneNumber = "+91 91234 56789",
            status = "completed",
            outcome = "Connected",
            note = "Follow-up required tomorrow",
            durationSeconds = 84,
            recordingStatus = "processing",
            recordingError = null,
            startedAt = "2026-10-12T08:37:00Z",
            endedAt = "2026-10-12T08:38:24Z",
            assignment = leads[1]
        ),
        MobileCall(
            id = "call_3",
            assignmentId = "lead_3",
            phoneNumber = "+91 99887 66554",
            status = "missed",
            outcome = "No answer",
            note = null,
            durationSeconds = 0,
            recordingStatus = "none",
            recordingError = null,
            startedAt = "2026-10-11T17:22:00Z",
            endedAt = null,
            assignment = leads[2]
        )
    )
}

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
