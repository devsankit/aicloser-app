package com.gigxomi.gxclosers.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gigxomi.gxclosers.data.ChatMessage
import com.gigxomi.gxclosers.data.InboxItem
import com.gigxomi.gxclosers.data.SalesLead
import com.gigxomi.gxclosers.ui.theme.*
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.cos
import kotlin.math.sin

// --- Color Tokens & Reference Palette ---
private val RefBrandOrange = Color(0xFFFF5C1C)
private val RefBrandOrangeDark = Color(0xFFE04E15)
private val RefBrandOrangeSoft = Color(0x24FF5C1C)
private val RefDarkBackground: Color
    @Composable get() = secondaryBackground()
private val RefDarkSurface: Color
    @Composable get() = secondarySurface()
private val RefDarkSurfaceVariant: Color
    @Composable get() = secondarySurfaceVariant()
private val RefDarkBorder: Color
    @Composable get() = secondaryBorder()
private val RefTextPrimary: Color
    @Composable get() = secondaryText()
private val RefTextMuted: Color
    @Composable get() = secondaryMuted()
private val RefSuccessGreen = Color(0xFF22C55E)
private val RefSuccessGreenSoft = Color(0x2622C55E)
private val RefWarningOrange = Color(0xFFF97316)
private val RefWarningOrangeSoft = Color(0x26F97316)
private val RefBlue = Color(0xFF38BDF8)
private val RefBlueSoft = Color(0x2638BDF8)
private val RefPurple = Color(0xFFA855F7)
private val RefPurpleSoft = Color(0x26A855F7)

@Composable private fun secondaryBackground() = Color.Transparent
@Composable private fun secondarySurface() = MaterialTheme.colorScheme.surface.copy(alpha = 0.82f)
@Composable private fun secondarySurfaceVariant() = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.86f)
@Composable private fun secondaryBorder() = MaterialTheme.colorScheme.outlineVariant
@Composable private fun secondaryText() = MaterialTheme.colorScheme.onSurface
@Composable private fun secondaryMuted() = MaterialTheme.colorScheme.onSurfaceVariant

private fun secondaryInboxTime(value: String?): String {
    if (value.isNullOrBlank()) return "Now"
    return runCatching {
        val local = Instant.parse(value).atZone(ZoneId.systemDefault())
        if (local.toLocalDate() == LocalDate.now()) {
            DateTimeFormatter.ofPattern("hh:mm a").format(local)
        } else {
            DateTimeFormatter.ofPattern("dd MMM").format(local)
        }
    }.getOrDefault(value.takeLast(5))
}

private fun secondaryChatTime(value: String?): String {
    if (value.isNullOrBlank()) return ""
    return runCatching {
        DateTimeFormatter.ofPattern("h:mm a")
            .format(Instant.parse(value).atZone(ZoneId.systemDefault()))
    }.getOrDefault(value.takeLast(5))
}

private fun secondaryChatDayLabel(value: String?): String {
    if (value.isNullOrBlank()) return "Today"
    return runCatching {
        val local = Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate()
        when {
            local == LocalDate.now() -> "Today"
            local == LocalDate.now().minusDays(1) -> "Yesterday"
            else -> DateTimeFormatter.ofPattern("dd MMM").format(local)
        }
    }.getOrDefault("Today")
}

/**
 * Interactive bounce micro-motion: scales down to ~0.97 on press.
 */
fun Modifier.referenceBounceClick(onClick: () -> Unit): Modifier = this.clickable(onClick = onClick)

/**
 * Screen fade + slide entrance transition (~200ms).
 */
@Composable
private fun ReferenceEntrance(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        visible = true
    }
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(animationSpec = tween(210)) + slideInVertically(
            animationSpec = tween(210),
            initialOffsetY = { it / 24 }
        ),
        modifier = modifier
    ) {
        Box(Modifier.fillMaxSize()) {
            ReferencePhotoBackdrop()
            content()
        }
    }
}

/**
 * AI Closer brand top badge
 */
@Composable
private fun ReferenceBrandBadge(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(RefBrandOrange)
                .padding(horizontal = 7.dp, vertical = 3.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "AI",
                color = Color.White,
                fontWeight = FontWeight.Black,
                fontSize = 13.sp,
                letterSpacing = 0.5.sp
            )
        }
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = "Closer",
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp
        )
    }
}

/**
 * Circular avatar badge with initial letter
 */
@Composable
private fun ReferenceAvatar(
    text: String,
    size: Dp = 42.dp,
    backgroundColor: Color = RefDarkSurfaceVariant,
    textColor: Color = MaterialTheme.colorScheme.onBackground,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(backgroundColor)
            .border(1.dp, RefDarkBorder.copy(alpha = 0.6f), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text.take(2).uppercase(),
            color = textColor,
            fontSize = (size.value * 0.4f).sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

/**
 * Bottom Navigation Bar for tabs 17 & 18 matching reference designs
 */
@Composable
private fun ReferenceBottomNavigation(
    selectedTab: Int, // 0: Home, 1: Leads, 2: Calls, 3: More
    onTabSelect: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val items = listOf(
        Triple(0, "Home", Icons.Default.Home),
        Triple(1, "Leads", Icons.Default.Group),
        Triple(2, "Calls", Icons.Default.Call),
        Triple(3, "More", Icons.Default.MoreHoriz)
    )

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = RefDarkSurface.copy(alpha = 0.98f),
        tonalElevation = 8.dp,
        border = BorderStroke(1.dp, RefDarkBorder.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(vertical = 8.dp, horizontal = 12.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { (index, title, icon) ->
                val selected = selectedTab == index
                val itemBg by animateColorAsState(
                    targetValue = if (selected) RefBrandOrangeSoft else Color.Transparent,
                    animationSpec = tween(180),
                    label = "tabBg"
                )
                val itemColor by animateColorAsState(
                    targetValue = if (selected) RefBrandOrange else RefTextMuted,
                    animationSpec = tween(180),
                    label = "tabColor"
                )

                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(itemBg)
                        .clickable { onTabSelect(index) }
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = title,
                        tint = itemColor,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = title,
                        color = itemColor,
                        fontSize = 11.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                    )
                }
            }
        }
    }
}

// ============================================================================
// 13. REFERENCE INBOX SCREEN (`13-inbox.png`)
// ============================================================================

@Composable
fun ReferenceInboxScreen(
    inboxItems: List<InboxItem> = emptyList(),
    selectedFilter: String = "All",
    searchQuery: String = "",
    onSearchQueryChange: (String) -> Unit = {},
    onFilterSelect: (String) -> Unit = {},
    onRefreshClick: () -> Unit = {},
    onConversationClick: (InboxItem) -> Unit = {},
    selectedNavTab: Int = 0,
    onNavTabSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val filters = listOf("All", "Priority", "Follow-up")
    val visibleItems = inboxItems.take(10)

    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Transparent)
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        ReferenceBrandBadge()
                        Spacer(Modifier.width(14.dp))
                        Text("Inbox", color = secondaryText(), fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        IconButton(onClick = onRefreshClick) {
                            Icon(Icons.Default.Refresh, "Refresh chats", tint = secondaryText(), modifier = Modifier.size(22.dp))
                        }
                    }

                    Spacer(Modifier.height(9.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(secondarySurface())
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Search, null, tint = secondaryMuted(), modifier = Modifier.size(19.dp))
                            Spacer(Modifier.width(8.dp))
                            BasicTextField(
                                value = searchQuery,
                                onValueChange = onSearchQueryChange,
                                textStyle = TextStyle(color = secondaryText(), fontSize = 15.sp),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                decorationBox = { innerTextField ->
                                    if (searchQuery.isEmpty()) Text("Search conversations", color = secondaryMuted(), fontSize = 15.sp)
                                    innerTextField()
                                },
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(28.dp))
                            .background(secondarySurface())
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        filters.forEach { filter ->
                            val isSelected = filter == selectedFilter
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(22.dp))
                                    .background(if (isSelected) RefBrandOrangeSoft else Color.Transparent)
                                    .clickable { onFilterSelect(filter) }
                                    .padding(horizontal = 8.dp, vertical = 9.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = filter,
                                    color = if (isSelected) RefBrandOrange else secondaryMuted(),
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }

                }
            },
        ) { paddingValues ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Transparent)
                    .padding(paddingValues),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 5.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                if (visibleItems.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 46.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = Icons.Default.ChatBubbleOutline,
                                    contentDescription = null,
                                    tint = secondaryMuted(),
                                    modifier = Modifier.size(36.dp)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = "No conversations found",
                                    color = secondaryMuted(),
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                } else {
                    items(visibleItems, key = { it.conversationId ?: it.lead.id }) { item ->
                        InboxChatRow(
                            item = item,
                            onClick = { onConversationClick(item) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InboxChatRow(
    item: InboxItem,
    onClick: () -> Unit,
) {
    val unread = item.status.equals("new", ignoreCase = true) || item.status.equals("assigned", ignoreCase = true) || item.status.equals("open", ignoreCase = true)
    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
        Surface(color = RefBrandOrangeSoft, shape = CircleShape, border = BorderStroke(1.dp, RefBrandOrange.copy(alpha = 0.55f)), modifier = Modifier.size(48.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Text(item.lead.customerName.take(2).uppercase(), color = RefBrandOrange, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(item.lead.customerName.ifBlank { "Unknown contact" }, color = secondaryText(), fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Text(secondaryInboxTime(item.latestMessageAt), color = if (unread) RefBrandOrange else secondaryMuted(), fontSize = 11.sp)
            }
            if (item.lead.serviceInterest.isNotBlank()) {
                Text(item.lead.serviceInterest, color = secondaryMuted(), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(item.latestMessage.ifBlank { "Open conversation" }, color = if (unread) secondaryText() else secondaryMuted(), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (unread) Box(Modifier.size(8.dp).clip(CircleShape).background(RefBrandOrange))
            }
        }
        }
        HorizontalDivider(modifier = Modifier.padding(start = 60.dp, top = 8.dp), color = secondaryBorder().copy(alpha = 0.75f))
    }
}

@Composable
private fun ReferenceInboxItemCard(
    item: InboxItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(secondarySurface())
            .border(1.dp, secondaryBorder().copy(alpha = 0.8f), RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top
        ) {
            ReferenceAvatar(
                text = item.lead.customerName.firstOrNull()?.toString() ?: "L",
                size = 44.dp
            )

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = item.lead.customerName,
                        color = secondaryText(),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = secondaryInboxTime(item.latestMessageAt),
                            color = secondaryMuted(),
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(RefBrandOrange)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = null,
                            tint = secondaryMuted(),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                if (item.lead.serviceInterest.isNotBlank()) {
                    Text(
                        text = item.lead.serviceInterest,
                        color = secondaryMuted(),
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = item.latestMessage.ifBlank { "Open conversation" },
                    color = secondaryText().copy(alpha = 0.85f),
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Badges row
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(secondarySurfaceVariant())
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "CRM",
                            color = secondaryMuted(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    val stageLabel = item.lead.stage.ifBlank { "FOLLOW-UP" }.uppercase()
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(RefBrandOrangeSoft)
                            .border(1.dp, RefBrandOrange.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = stageLabel,
                            color = RefBrandOrange,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

// ============================================================================
// 14. REFERENCE CHAT SCREEN (`14-chat.png`)
// ============================================================================

@Composable
fun ReferenceChatScreen(
    lead: SalesLead? = null,
    messages: List<ChatMessage> = emptyList(),
    notes: String = "",
    inputText: String = "",
    onInputTextChange: (String) -> Unit = {},
    onSendMessage: (String) -> Unit = {},
    onAttachFileClick: () -> Unit = {},
    onCallClick: () -> Unit = {},
    onMenuClick: () -> Unit = {},
    onStageSelect: (String) -> Unit = {},
    onNotesClick: () -> Unit = {},
    onBackClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val contactName = lead?.customerName ?: "Ankit Sharma"
    val stageText = lead?.stage?.ifBlank { "Follow-up" } ?: "Follow-up"
    val dealTitle = lead?.serviceInterest?.ifBlank { "CRM implementation" } ?: "CRM implementation"
    var moreExpanded by remember { mutableStateOf(false) }
    var stageMenuExpanded by remember { mutableStateOf(false) }
    // Keep the chat card responsive immediately after a stage selection. The
    // conversation object is refreshed asynchronously, so relying only on the
    // incoming lead would leave the chip looking static until navigation.
    var selectedStageKey by remember(lead?.id, stageText) {
        mutableStateOf(stageText.uppercase().replace('-', '_').replace(' ', '_'))
    }
    val messageListState = rememberLazyListState()
    val stageOptions = listOf(
        "NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "QUALIFIED",
        "CLOSED_WON", "CLOSED_LOST", "NOT_REACHABLE",
    )
    fun stageLabel(value: String): String = when (value.uppercase().replace(' ', '_').replace('-', '_')) {
        "FOLLOW_UP" -> "Follow-up"
        "NOT_REACHABLE" -> "Not reachable"
        "CLOSED_WON" -> "Closed won"
        "CLOSED_LOST" -> "Closed lost"
        else -> value.replace('_', ' ').replace('-', ' ').lowercase().replaceFirstChar { it.uppercase() }
    }

    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .background(Color.Transparent)
                ) {
                    // Header Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onBackClick) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = RefTextPrimary
                            )
                        }

                        ReferenceAvatar(
                            text = contactName.firstOrNull()?.toString() ?: "A",
                            size = 38.dp
                        )

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = contactName,
                                color = RefTextPrimary,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = stageLabel(selectedStageKey),
                                color = RefTextMuted,
                                fontSize = 12.sp
                            )
                        }

                        IconButton(
                            onClick = onCallClick,
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Color.Transparent)
                                .border(1.dp, RefDarkBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Phone,
                                contentDescription = "Call",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(6.dp))

                        Box {
                            IconButton(
                                onClick = { moreExpanded = true },
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(Color.Transparent)
                                    .border(1.dp, RefDarkBorder, CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.MoreVert,
                                    contentDescription = "More",
                                    tint = RefTextPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            DropdownMenu(
                                expanded = moreExpanded,
                                onDismissRequest = { moreExpanded = false },
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Refresh conversation") },
                                    onClick = {
                                        moreExpanded = false
                                        onMenuClick()
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Private notes") },
                                    onClick = {
                                        moreExpanded = false
                                        onNotesClick()
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Call contact") },
                                    onClick = {
                                        moreExpanded = false
                                        onCallClick()
                                    },
                                )
                            }
                        }

                    }

                    // Deal context banner
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(RefDarkSurface)
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(16.dp))
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = dealTitle,
                                    color = RefTextPrimary,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Assigned to you",
                                    color = RefTextMuted,
                                    fontSize = 11.sp
                                )
                            }

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(RefDarkSurfaceVariant)
                                    .border(1.dp, RefDarkBorder, RoundedCornerShape(14.dp))
                                    .clickable { stageMenuExpanded = true }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = stageLabel(selectedStageKey),
                                        color = RefTextPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(
                                        imageVector = Icons.Default.KeyboardArrowDown,
                                        contentDescription = null,
                                        tint = RefTextMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                                DropdownMenu(
                                    expanded = stageMenuExpanded,
                                    onDismissRequest = { stageMenuExpanded = false },
                                ) {
                                    stageOptions.forEach { option ->
                                        DropdownMenuItem(
                                            text = { Text(stageLabel(option)) },
                                            leadingIcon = {
                                        if (option == selectedStageKey) {
                                                    Icon(Icons.Default.Check, contentDescription = null, tint = RefBrandOrange)
                                                }
                                            },
                                            onClick = {
                                                stageMenuExpanded = false
                                                selectedStageKey = option
                                                onStageSelect(option)
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))
                }
            },
            bottomBar = {
                // Composer Bottom Bar with IME and Nav padding
                Surface(
                    color = Color.Transparent,
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(22.dp))
                            .background(RefDarkSurface.copy(alpha = 0.9f))
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(22.dp))
                            .padding(horizontal = 5.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = onAttachFileClick,
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.AttachFile,
                                contentDescription = "Attach",
                                tint = RefTextMuted,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(6.dp))

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .padding(horizontal = 8.dp, vertical = 5.dp)
                        ) {
                            BasicTextField(
                                value = inputText,
                                onValueChange = onInputTextChange,
                                textStyle = TextStyle(color = RefTextPrimary, fontSize = 14.sp),
                                modifier = Modifier.fillMaxWidth(),
                                decorationBox = { innerTextField ->
                                    if (inputText.isEmpty()) {
                                        Text(
                                            text = "Write a reply",
                                            color = RefTextMuted,
                                            fontSize = 14.sp
                                        )
                                    }
                                    innerTextField()
                                }
                            )
                        }

                        Spacer(modifier = Modifier.width(6.dp))

                        IconButton(
                            enabled = inputText.isNotBlank(),
                            onClick = {
                                if (inputText.isNotBlank()) {
                                    onSendMessage(inputText)
                                }
                            },
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(
                                    if (inputText.isNotBlank()) RefBrandOrange else RefDarkSurfaceVariant
                                )
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Send,
                                contentDescription = "Send",
                                tint = if (inputText.isNotBlank()) Color.White else RefTextMuted,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                LazyColumn(
                    state = messageListState,
                    modifier = Modifier.fillMaxSize(),
                // The chat detail screen intentionally has no global navigation
                // footer. Keep only a small composer-safe gap so the thread does
                // not look detached from the reply field.
                    contentPadding = PaddingValues(start = 16.dp, top = 14.dp, end = 16.dp, bottom = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {

                if (messages.isEmpty()) {
                    item {
                        Text(
                            text = "No messages in this assigned conversation yet.",
                            color = RefTextMuted,
                            fontSize = 13.sp,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp),
                            textAlign = TextAlign.Center,
                        )
                    }
                } else {
                    item {
                        ReferenceChatDayDivider(
                            label = secondaryChatDayLabel(messages.firstOrNull()?.createdAt)
                        )
                    }
                    items(messages) { message ->
                        if (message.outbound) {
                            ReferenceOutgoingBubble(
                                text = message.body,
                                time = secondaryChatTime(message.createdAt),
                                attachmentName = message.attachmentName,
                                attachmentCount = message.attachmentCount,
                            )
                        } else {
                            ReferenceIncomingBubble(
                                text = message.body,
                                time = secondaryChatTime(message.createdAt),
                                attachmentName = message.attachmentName,
                                attachmentCount = message.attachmentCount,
                            )
                        }
                    }
                }
                }
            }
        }
    }
}

@Composable
private fun ReferenceChatDayDivider(
    label: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = RefDarkBorder.copy(alpha = 0.8f),
        )
        Text(
            text = label,
            color = RefTextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = RefDarkBorder.copy(alpha = 0.8f),
        )
    }
}

@Composable
private fun ReferenceIncomingBubble(
    text: String,
    time: String,
    attachmentName: String? = null,
    attachmentCount: Int = 0,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 4.dp))
                .background(RefDarkSurfaceVariant)
                .border(1.dp, RefDarkBorder, RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 4.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Column {
                if (text.isNotBlank()) {
                    Text(
                        text = text,
                        color = RefTextPrimary,
                        fontSize = 14.sp,
                        lineHeight = 19.sp
                    )
                }
                attachmentName?.let {
                    if (text.isNotBlank()) Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (attachmentCount > 1) "$it (+${attachmentCount - 1})" else it,
                        color = RefBrandOrange,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = time,
                    color = RefTextMuted,
                    fontSize = 11.sp,
                    modifier = Modifier.align(Alignment.End)
                )
            }
        }
    }
}

@Composable
private fun ReferenceOutgoingBubble(
    text: String,
    time: String,
    attachmentName: String? = null,
    attachmentCount: Int = 0,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 16.dp, bottomEnd = 4.dp))
                .background(Color(0xFFCE5A20))
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Column {
                if (text.isNotBlank()) {
                    Text(
                        text = text,
                        color = Color.White,
                        fontSize = 14.sp,
                        lineHeight = 19.sp
                    )
                }
                attachmentName?.let {
                    if (text.isNotBlank()) Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (attachmentCount > 1) "$it (+${attachmentCount - 1})" else it,
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.align(Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = time,
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 11.sp
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "✓✓",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

// ============================================================================
// 15. REFERENCE LEAD OVERVIEW SCREEN (`15-lead-overview.png`)
// (Profile & Settings / Device Telephony Status)
// ============================================================================

@Composable
fun ReferenceLeadOverviewScreen(
    userName: String = "Ankit Rathore",
    userEmail: String = "sales@aicloser.in",
    userRole: String = "Sales closer",
    deviceName: String = "Redmi · Work SIM •••• 9933",
    isDeviceSynced: Boolean = true,
    isDeviceVerified: Boolean = true,
    appearanceSetting: String = "System",
    notificationsSetting: String = "On",
    selectedSim: String = "Work SIM •••• 9933",
    recordingSource: String = "Phone recording",
    lastSyncText: String = "Just now",
    onBackClick: () -> Unit = {},
    onEditProfileClick: () -> Unit = {},
    onSettingRowClick: (String) -> Unit = {},
    onRunDiagnosticsClick: () -> Unit = {},
    onLogoutClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = RefTextPrimary
                        )
                    }
                    Text(
                        text = "Profile & settings",
                        color = RefTextPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                // Profile header card
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ReferenceAvatar(
                        text = userName.split(" ").mapNotNull { it.firstOrNull()?.toString() }.joinToString("").take(2).ifBlank { "AR" },
                        size = 54.dp
                    )

                    Spacer(modifier = Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = userName,
                            color = RefTextPrimary,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = userEmail,
                            color = RefTextMuted,
                            fontSize = 13.sp
                        )
                        Text(
                            text = userRole,
                            color = RefTextMuted,
                            fontSize = 12.sp
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(18.dp))
                            .background(RefDarkSurfaceVariant)
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(18.dp))
                            .clickable(onClick = onEditProfileClick)
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = null,
                                tint = RefTextPrimary,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Edit",
                                color = RefTextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Telephony hardware / sync card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(RefDarkSurface)
                        .border(1.dp, RefDarkBorder, RoundedCornerShape(20.dp))
                        .padding(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Phone graphic
                        Box(
                            modifier = Modifier
                                .size(46.dp, 54.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(RefDarkSurfaceVariant)
                                .border(1.dp, RefDarkBorder, RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Smartphone,
                                contentDescription = null,
                                tint = RefBrandOrange,
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column {
                            Text(
                                text = deviceName,
                                color = RefTextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(3.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(if (isDeviceSynced) RefSuccessGreen else RefWarningOrange)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (isDeviceSynced) "Synced" else "Sync pending",
                                    color = RefTextPrimary,
                                    fontSize = 12.sp
                                )
                            }
                            Spacer(modifier = Modifier.height(1.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = if (isDeviceVerified) RefSuccessGreen else RefWarningOrange,
                                    modifier = Modifier.size(13.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (isDeviceVerified) "Device verified" else "Pending verification",
                                    color = RefTextMuted,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Account section
                ReferenceSettingsSectionTitle("Account")
                ReferenceSettingsCard {
                    ReferenceSettingsRow(
                        icon = Icons.Default.PersonOutline,
                        label = "Display name",
                        value = userName,
                        onClick = { onSettingRowClick("Display name") }
                    )
                    HorizontalDivider(color = RefDarkBorder, thickness = 0.8.dp)
                    ReferenceSettingsRow(
                        icon = Icons.Default.MailOutline,
                        label = "Email",
                        value = userEmail,
                        onClick = { onSettingRowClick("Email") }
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Preferences section
                ReferenceSettingsSectionTitle("Preferences")
                ReferenceSettingsCard {
                    ReferenceSettingsRow(
                        icon = Icons.Default.Palette,
                        label = "Appearance",
                        value = appearanceSetting,
                        onClick = { onSettingRowClick("Appearance") }
                    )
                    HorizontalDivider(color = RefDarkBorder, thickness = 0.8.dp)
                    ReferenceSettingsRow(
                        icon = Icons.Default.NotificationsNone,
                        label = "Notifications",
                        value = notificationsSetting,
                        onClick = { onSettingRowClick("Notifications") }
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Call & Sync section
                ReferenceSettingsSectionTitle("Call & sync")
                ReferenceSettingsCard {
                    ReferenceSettingsRow(
                        icon = Icons.Default.SimCard,
                        label = "Selected work SIM",
                        value = selectedSim,
                        onClick = { onSettingRowClick("Selected work SIM") }
                    )
                    HorizontalDivider(color = RefDarkBorder, thickness = 0.8.dp)
                    ReferenceSettingsRow(
                        icon = Icons.Default.Mic,
                        label = "Recording source",
                        value = recordingSource,
                        onClick = { onSettingRowClick("Recording source") }
                    )
                    HorizontalDivider(color = RefDarkBorder, thickness = 0.8.dp)
                    ReferenceSettingsRow(
                        icon = Icons.Default.Sync,
                        label = "Last sync",
                        value = lastSyncText,
                        onClick = { onSettingRowClick("Last sync") }
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Run Diagnostics Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(RefDarkSurface)
                        .border(1.dp, RefDarkBorder, RoundedCornerShape(24.dp))
                        .clickable(onClick = onRunDiagnosticsClick)
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.ShowChart,
                            contentDescription = null,
                            tint = RefTextPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Run diagnostics",
                            color = RefTextPrimary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Log out Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(RefDarkSurface)
                        .border(1.dp, Color(0xFFEF4444).copy(alpha = 0.4f), RoundedCornerShape(24.dp))
                        .clickable(onClick = onLogoutClick)
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Logout,
                            contentDescription = null,
                            tint = Color(0xFFEF4444),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Log out",
                            color = Color(0xFFEF4444),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }
}

@Composable
private fun ReferenceSettingsSectionTitle(title: String) {
    Text(
        text = title,
        color = RefTextMuted,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(bottom = 8.dp)
    )
}

@Composable
private fun ReferenceSettingsCard(content: @Composable ColumnScope.() -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(RefDarkSurface)
            .border(1.dp, RefDarkBorder, RoundedCornerShape(20.dp))
    ) {
        Column(content = content)
    }
}

@Composable
private fun ReferenceSettingsRow(
    icon: ImageVector,
    label: String,
    value: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = RefTextMuted,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = label,
                color = RefTextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = value,
                color = RefTextMuted,
                fontSize = 13.sp
            )
            Spacer(modifier = Modifier.width(6.dp))
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = RefTextMuted,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

// ============================================================================
// 16. REFERENCE ADD CONTACT SCREEN (`16-add-contact.png`)
// (Bottom Sheet Modal Dialog)
// ============================================================================

@Composable
fun ReferenceAddContactScreen(
    fullName: String = "",
    onFullNameChange: (String) -> Unit = {},
    phoneNumber: String = "",
    onPhoneNumberChange: (String) -> Unit = {},
    email: String = "",
    onEmailChange: (String) -> Unit = {},
    notes: String = "",
    onNotesChange: (String) -> Unit = {},
    selectedSource: String = "Manual",
    onSourceChange: (String) -> Unit = {},
    selectedStage: String = "New",
    onStageChange: (String) -> Unit = {},
    isSaving: Boolean = false,
    onSaveContact: () -> Unit = {},
    onCancel: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var sourceExpanded by remember { mutableStateOf(false) }
    var stageExpanded by remember { mutableStateOf(false) }
    val sourceOptions = listOf("Manual", "WhatsApp", "Website", "Referral")
    val stageOptions = listOf("New", "Contacted", "Qualified", "Follow-up", "Closed won")

    ReferenceEntrance(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.68f)),
            contentAlignment = Alignment.BottomCenter
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.92f)
                    .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)),
                color = RefDarkSurface,
                border = BorderStroke(1.dp, RefDarkBorder.copy(alpha = 0.6f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 14.dp)
                        .navigationBarsPadding()
                        .imePadding()
                        .verticalScroll(rememberScrollState())
                ) {
                    // Drag handle
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterHorizontally)
                            .size(36.dp, 4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(RefDarkBorder)
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Title row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Add new contact",
                                color = RefTextPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Save lead directly into CRM pipeline",
                                color = RefTextMuted,
                                fontSize = 12.sp
                            )
                        }

                        IconButton(
                            onClick = onCancel,
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(RefDarkSurfaceVariant)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Form Fields
                    ReferenceFormField(
                        label = "Customer full name *",
                        icon = Icons.Default.PersonOutline,
                        value = fullName,
                        placeholder = "Enter full name",
                        onValueChange = onFullNameChange
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    ReferenceFormField(
                        label = "Phone number *",
                        icon = Icons.Default.Phone,
                        value = phoneNumber,
                        placeholder = "Enter phone number",
                        keyboardType = KeyboardType.Phone,
                        onValueChange = onPhoneNumberChange
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    ReferenceFormField(
                        label = "Email (optional)",
                        icon = Icons.Default.MailOutline,
                        value = email,
                        placeholder = "Enter email address",
                        keyboardType = KeyboardType.Email,
                        onValueChange = onEmailChange
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Notes field
                    Text(
                        text = "Discussion notes (optional)",
                        color = RefTextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(84.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(RefDarkSurfaceVariant)
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(16.dp))
                            .padding(horizontal = 14.dp, vertical = 10.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxSize()) {
                            Icon(
                                imageVector = Icons.Default.Description,
                                contentDescription = null,
                                tint = RefTextMuted,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            BasicTextField(
                                value = notes,
                                onValueChange = onNotesChange,
                                textStyle = TextStyle(color = RefTextPrimary, fontSize = 14.sp),
                                modifier = Modifier.fillMaxSize(),
                                decorationBox = { innerTextField ->
                                    if (notes.isEmpty()) {
                                        Text(
                                            text = "Add any relevant notes...",
                                            color = RefTextMuted,
                                            fontSize = 14.sp
                                        )
                                    }
                                    innerTextField()
                                }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Source and Stage dropdowns
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Source",
                                color = RefTextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(bottom = 6.dp)
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(RefDarkSurfaceVariant)
                                    .border(1.dp, RefDarkBorder, RoundedCornerShape(16.dp))
                                    .clickable { sourceExpanded = true }
                                    .padding(horizontal = 12.dp, vertical = 11.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Group,
                                            contentDescription = null,
                                            tint = RefTextMuted,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = selectedSource,
                                            color = RefTextPrimary,
                                            fontSize = 13.sp
                                        )
                                    }
                                    Icon(
                                        imageVector = Icons.Default.KeyboardArrowDown,
                                        contentDescription = null,
                                        tint = RefTextMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                                DropdownMenu(
                                    expanded = sourceExpanded,
                                    onDismissRequest = { sourceExpanded = false },
                                ) {
                                    sourceOptions.forEach { option ->
                                        DropdownMenuItem(
                                            text = { Text(option) },
                                            onClick = {
                                                onSourceChange(option)
                                                sourceExpanded = false
                                            },
                                        )
                                    }
                                }
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Stage",
                                color = RefTextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(bottom = 6.dp)
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(RefDarkSurfaceVariant)
                                    .border(1.dp, RefDarkBorder, RoundedCornerShape(16.dp))
                                    .clickable { stageExpanded = true }
                                    .padding(horizontal = 12.dp, vertical = 11.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.BarChart,
                                            contentDescription = null,
                                            tint = RefTextMuted,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = selectedStage,
                                            color = RefTextPrimary,
                                            fontSize = 13.sp
                                        )
                                    }
                                    Icon(
                                        imageVector = Icons.Default.KeyboardArrowDown,
                                        contentDescription = null,
                                        tint = RefTextMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                                DropdownMenu(
                                    expanded = stageExpanded,
                                    onDismissRequest = { stageExpanded = false },
                                ) {
                                    stageOptions.forEach { option ->
                                        DropdownMenuItem(
                                            text = { Text(option) },
                                            onClick = {
                                                onStageChange(option)
                                                stageExpanded = false
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Action buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = onCancel,
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp),
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = RefDarkSurfaceVariant,
                                contentColor = RefTextPrimary
                            ),
                            border = BorderStroke(1.dp, RefDarkBorder)
                        ) {
                            Text(text = "Cancel", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }

                        Button(
                            onClick = onSaveContact,
                            enabled = !isSaving,
                            modifier = Modifier
                                .weight(1.3f)
                                .height(48.dp),
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = RefBrandOrange,
                                contentColor = Color.White
                            )
                        ) {
                            if (isSaving) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(17.dp),
                                    color = Color.White,
                                    strokeWidth = 2.dp,
                                )
                            } else {
                                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(17.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(text = "Save contact", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                }
            }
        }
    }
}

@Composable
private fun ReferenceFormField(
    label: String,
    icon: ImageVector,
    value: String,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    onValueChange: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            color = RefTextPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(bottom = 6.dp)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(RefDarkSurfaceVariant)
                .border(1.dp, RefDarkBorder, RoundedCornerShape(16.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = RefTextMuted,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    textStyle = TextStyle(color = RefTextPrimary, fontSize = 14.sp),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                    modifier = Modifier.fillMaxWidth(),
                    decorationBox = { innerTextField ->
                        if (value.isEmpty()) {
                            Text(
                                text = placeholder,
                                color = RefTextMuted,
                                fontSize = 14.sp
                            )
                        }
                        innerTextField()
                    }
                )
            }
        }
    }
}

// ============================================================================
// 17. REFERENCE PIPELINE SCREEN (`17-pipeline.png`)
// (Kanban Board with Columns & Floating Action Button)
// ============================================================================

@Composable
fun ReferencePipelineScreen(
    leads: List<SalesLead> = emptyList(),
    selectedViewMode: String = "Pipeline",
    onViewModeChange: (String) -> Unit = {},
    searchQuery: String = "",
    onSearchQueryChange: (String) -> Unit = {},
    onFilterClick: () -> Unit = {},
    onAddLeadClick: () -> Unit = {},
    onLeadCardClick: (SalesLead) -> Unit = {},
    onLeadMenuClick: (SalesLead) -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    selectedNavTab: Int = 1,
    onNavTabSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val newLeads = leads.filter { it.stage.equals("NEW", ignoreCase = true) }
    val followUpLeads = leads.filter {
        it.stage.equals("FOLLOW_UP", ignoreCase = true) ||
            it.stage.equals("INTERESTED", ignoreCase = true) ||
            it.stage.equals("QUALIFIED", ignoreCase = true)
    }
    val qualifiedLeads = leads.filter { it.stage.equals("QUALIFIED", ignoreCase = true) }

    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        ReferenceBrandBadge()
                        IconButton(
                            onClick = onNotificationsClick,
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(RefDarkSurfaceVariant)
                                .border(1.dp, RefDarkBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.NotificationsNone,
                                contentDescription = "Notifications",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Pipeline",
                        color = RefTextPrimary,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Search & Filter Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, RoundedCornerShape(16.dp))
                                .padding(horizontal = 14.dp, vertical = 12.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = "Search",
                                    tint = RefTextMuted,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                BasicTextField(
                                    value = searchQuery,
                                    onValueChange = onSearchQueryChange,
                                    textStyle = TextStyle(color = RefTextPrimary, fontSize = 14.sp),
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    decorationBox = { innerTextField ->
                                        if (searchQuery.isEmpty()) {
                                            Text(
                                                text = "Search leads, name or service...",
                                                color = RefTextMuted,
                                                fontSize = 14.sp
                                            )
                                        }
                                        innerTextField()
                                    }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        IconButton(
                            onClick = onFilterClick,
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, RoundedCornerShape(14.dp))
                        ) {
                            Icon(
                                imageVector = Icons.Default.Tune,
                                contentDescription = "Filter",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // View Mode Switcher (List vs Pipeline)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(RefDarkSurface)
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(18.dp))
                            .padding(4.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            val isList = selectedViewMode == "List"
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (isList) RefDarkSurfaceVariant else Color.Transparent)
                                    .clickable { onViewModeChange("List") }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.FormatListBulleted,
                                        contentDescription = null,
                                        tint = if (isList) RefBrandOrange else RefTextMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "List",
                                        color = if (isList) RefBrandOrange else RefTextMuted,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }

                            val isPipeline = selectedViewMode == "Pipeline"
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (isPipeline) RefDarkSurfaceVariant else Color.Transparent)
                                    .clickable { onViewModeChange("Pipeline") }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.ViewKanban,
                                        contentDescription = null,
                                        tint = if (isPipeline) RefBrandOrange else RefTextMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Pipeline",
                                        color = if (isPipeline) RefBrandOrange else RefTextMuted,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            },
            floatingActionButton = {
                FloatingActionButton(
                    onClick = onAddLeadClick,
                    containerColor = RefBrandOrange,
                    contentColor = Color.White,
                    shape = CircleShape,
                    modifier = Modifier.size(56.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PersonAdd,
                        contentDescription = "Add Lead",
                        modifier = Modifier.size(24.dp)
                    )
                }
            },
            bottomBar = {
                AppBottomNavBar(
                    selectedTab = when (selectedNavTab) {
                        0 -> "home"
                        2 -> "calls"
                        3 -> "more"
                        else -> "leads"
                    },
                    onTabSelected = { tab ->
                        onNavTabSelect(
                            when (tab) {
                                "home" -> 0
                                "calls" -> 2
                                "more" -> 3
                                else -> 1
                            }
                        )
                    }
                )
            }
        ) { paddingValues ->
            // Kanban board columns
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Peek Left Column: New
                ReferenceKanbanPeekColumn(
                    title = "New",
                    count = newLeads.size,
                    dotColor = RefBlue,
                    modifier = Modifier.width(52.dp)
                )

                // Active Center Column: Follow-up
                ReferenceKanbanActiveColumn(
                    leads = followUpLeads,
                    onLeadCardClick = onLeadCardClick,
                    onLeadMenuClick = onLeadMenuClick,
                    onColumnMenuClick = onFilterClick,
                    modifier = Modifier.weight(1f)
                )

                // Peek Right Column: Qualified
                ReferenceKanbanPeekColumn(
                    title = "Qualif",
                    count = qualifiedLeads.size,
                    dotColor = RefSuccessGreen,
                    modifier = Modifier.width(52.dp)
                )
            }
        }
    }
}

@Composable
private fun ReferenceKanbanPeekColumn(
    title: String,
    count: Int,
    dotColor: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(18.dp))
            .background(RefDarkSurface.copy(alpha = 0.5f))
            .border(1.dp, RefDarkBorder.copy(alpha = 0.3f), RoundedCornerShape(18.dp))
            .padding(vertical = 12.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(dotColor)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = title,
            color = RefTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = count.toString(),
            color = RefTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(14.dp))

        if (count == 0) {
            Text(
                text = "—",
                color = RefTextMuted,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun ReferenceKanbanActiveColumn(
    leads: List<SalesLead>,
    onLeadCardClick: (SalesLead) -> Unit,
    onLeadMenuClick: (SalesLead) -> Unit,
    onColumnMenuClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(22.dp))
            .background(RefDarkSurface)
            .border(1.dp, RefDarkBorder, RoundedCornerShape(22.dp))
            .padding(14.dp)
    ) {
        // Column Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(RefBrandOrange)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Follow-up · ${leads.size}",
                    color = RefTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            IconButton(
                onClick = onColumnMenuClick,
                modifier = Modifier.size(28.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.MoreHoriz,
                    contentDescription = "Pipeline actions",
                    tint = RefTextMuted,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Cards List
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (leads.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 36.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(Icons.Default.Inbox, contentDescription = null, tint = RefTextMuted, modifier = Modifier.size(28.dp))
                        Text("No follow-ups yet", color = RefTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text("Live lead activity will appear here.", color = RefTextMuted, fontSize = 12.sp)
                    }
                }
            } else {
                items(leads) { lead ->
                    val priorityColor = when (lead.priority.uppercase()) {
                        "HIGH" -> RefBrandOrange
                        "MEDIUM" -> RefWarningOrange
                        else -> RefSuccessGreen
                    }
                    val priorityBg = when (lead.priority.uppercase()) {
                        "HIGH" -> RefBrandOrangeSoft
                        "MEDIUM" -> RefWarningOrangeSoft
                        else -> RefSuccessGreenSoft
                    }
                    ReferencePipelineLeadCard(
                        avatar = lead.customerName.firstOrNull()?.toString() ?: "L",
                        name = lead.customerName,
                        service = lead.serviceInterest.ifBlank { "CRM Service" },
                        priority = lead.priority.replaceFirstChar { it.uppercase() },
                        priorityColor = priorityColor,
                        priorityBg = priorityBg,
                        actionTime = lead.followUpAt ?: "Schedule call",
                        onMenuClick = { onLeadMenuClick(lead) },
                        onClick = { onLeadCardClick(lead) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ReferencePipelineLeadCard(
    avatar: String,
    name: String,
    service: String,
    priority: String,
    priorityColor: Color,
    priorityBg: Color,
    actionTime: String,
    onMenuClick: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(RefDarkSurfaceVariant)
            .border(1.dp, RefDarkBorder, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(12.dp)
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ReferenceAvatar(text = avatar, size = 32.dp)
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = name,
                        color = RefTextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = service,
                        color = RefTextMuted,
                        fontSize = 12.sp
                    )
                }
                IconButton(
                    onClick = onMenuClick,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.MoreHoriz,
                        contentDescription = "Lead actions",
                        tint = RefTextMuted,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        tint = RefTextMuted,
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(modifier = Modifier.width(5.dp))
                    Text(
                        text = actionTime,
                        color = RefTextMuted,
                        fontSize = 11.sp
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(priorityBg)
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = priority,
                        color = priorityColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

// ============================================================================
// 18. REFERENCE CONTACTS SCREEN (`18-contacts.png`)
// (Contact Directory & Lead Import Tab)
// ============================================================================

@Composable
fun ReferenceContactsScreen(
    contacts: List<SalesLead> = emptyList(),
    selectedTab: String = "Contacts",
    onTabSelect: (String) -> Unit = {},
    searchQuery: String = "",
    onSearchQueryChange: (String) -> Unit = {},
    onFilterClick: () -> Unit = {},
    onChooseFileClick: () -> Unit = {},
    onDownloadTemplateClick: () -> Unit = {},
    onContactClick: (SalesLead) -> Unit = {},
    onCallContactClick: (SalesLead) -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    selectedNavTab: Int = 1,
    onNavTabSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        ReferenceBrandBadge()
                        IconButton(
                            onClick = onNotificationsClick,
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(RefDarkSurfaceVariant)
                                .border(1.dp, RefDarkBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.NotificationsNone,
                                contentDescription = "Notifications",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Contacts",
                        color = RefTextPrimary,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Contacts vs Import Tab Pills
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(RefDarkSurface)
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(18.dp))
                            .padding(4.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            val isContacts = selectedTab == "Contacts"
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (isContacts) RefDarkSurfaceVariant else Color.Transparent)
                                    .clickable { onTabSelect("Contacts") }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Contacts",
                                    color = if (isContacts) RefBrandOrange else RefTextMuted,
                                    fontSize = 14.sp,
                                    fontWeight = if (isContacts) FontWeight.Bold else FontWeight.Medium
                                )
                            }

                            val isImport = selectedTab == "Import"
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (isImport) RefDarkSurfaceVariant else Color.Transparent)
                                    .clickable { onTabSelect("Import") }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Import",
                                    color = if (isImport) RefBrandOrange else RefTextMuted,
                                    fontSize = 14.sp,
                                    fontWeight = if (isImport) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Import Leads Banner Card
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(RefDarkSurface)
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(20.dp))
                            .padding(16.dp)
                    ) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(42.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(RefDarkSurfaceVariant)
                                            .border(1.dp, RefDarkBorder, RoundedCornerShape(12.dp)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.FileUpload,
                                            contentDescription = null,
                                            tint = RefTextPrimary,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }

                                    Spacer(modifier = Modifier.width(12.dp))

                                    Column {
                                        Text(
                                            text = "Import leads",
                                            color = RefTextPrimary,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "CSV or Excel file",
                                            color = RefTextMuted,
                                            fontSize = 12.sp
                                        )
                                    }
                                }

                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(RefDarkSurfaceVariant)
                                        .border(1.dp, RefBrandOrange.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                                        .clickable(onClick = onChooseFileClick)
                                        .padding(horizontal = 14.dp, vertical = 7.dp)
                                ) {
                                    Text(
                                        text = "Choose file",
                                        color = RefBrandOrange,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = "Download template",
                                color = RefTextMuted,
                                fontSize = 11.sp,
                                textDecoration = TextDecoration.Underline,
                                modifier = Modifier
                                    .clickable(onClick = onDownloadTemplateClick)
                                    .padding(start = 54.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Search field
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, RoundedCornerShape(16.dp))
                                .padding(horizontal = 14.dp, vertical = 12.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = "Search",
                                    tint = RefTextMuted,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                BasicTextField(
                                    value = searchQuery,
                                    onValueChange = onSearchQueryChange,
                                    textStyle = TextStyle(color = RefTextPrimary, fontSize = 14.sp),
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    decorationBox = { innerTextField ->
                                        if (searchQuery.isEmpty()) {
                                            Text(
                                                text = "Search contacts",
                                                color = RefTextMuted,
                                                fontSize = 14.sp
                                            )
                                        }
                                        innerTextField()
                                    }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        IconButton(
                            onClick = onFilterClick,
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, RoundedCornerShape(14.dp))
                        ) {
                            Icon(
                                imageVector = Icons.Default.Tune,
                                contentDescription = "Filter",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            },
            bottomBar = {
                AppBottomNavBar(
                    selectedTab = when (selectedNavTab) {
                        0 -> "home"
                        2 -> "calls"
                        3 -> "more"
                        else -> "leads"
                    },
                    onTabSelected = { tab ->
                        onNavTabSelect(
                            when (tab) {
                                "home" -> 0
                                "calls" -> 2
                                "more" -> 3
                                else -> 1
                            }
                        )
                    }
                )
            }
        ) { paddingValues ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (contacts.isEmpty()) {
                    item {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 44.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(Icons.Default.PeopleOutline, contentDescription = null, tint = RefTextMuted, modifier = Modifier.size(30.dp))
                            Text("No contacts yet", color = RefTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text("Add a contact or refresh to load live leads.", color = RefTextMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
                        }
                    }
                } else {
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(20.dp))
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, RoundedCornerShape(20.dp))
                        ) {
                            contacts.forEachIndexed { index, contact ->
                                ReferenceContactItemCard(
                                    avatar = contact.customerName.firstOrNull()?.toString() ?: "C",
                                    name = contact.customerName,
                                    phone = contact.customerPhone,
                                    email = contact.customerEmail,
                                    onCallClick = { onCallContactClick(contact) },
                                    onClick = { onContactClick(contact) },
                                    modifier = Modifier.fillMaxWidth(),
                                )
                                if (index < contacts.lastIndex) {
                                    HorizontalDivider(
                                        color = RefDarkBorder.copy(alpha = 0.72f),
                                        modifier = Modifier.padding(horizontal = 10.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReferenceContactItemCard(
    avatar: String,
    name: String,
    phone: String,
    email: String,
    onCallClick: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ReferenceAvatar(text = avatar, size = 42.dp)

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = name,
                color = RefTextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (phone.isNotBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = null,
                        tint = RefTextMuted,
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = phone,
                        color = RefTextMuted,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (email.isNotBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.MailOutline,
                        contentDescription = null,
                        tint = RefTextMuted,
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = email,
                        color = RefTextMuted,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }

        IconButton(
            onClick = onCallClick,
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(RefDarkSurfaceVariant)
                .border(1.dp, RefDarkBorder, CircleShape)
        ) {
            Icon(
                imageVector = Icons.Default.Phone,
                contentDescription = "Call",
                tint = RefTextPrimary,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

// ============================================================================
// 19. REFERENCE PAYMENTS SCREEN (`19-payments.png`)
// (Financial Overview, Radial Meter & Transactions Ledger)
// ============================================================================

data class PaymentTransactionPreview(
    val id: String,
    val initial: String,
    val title: String,
    val date: String,
    val amount: String,
    val status: String // "Confirmed", "Pending"
)

@Composable
fun ReferencePaymentsScreen(
    totalCollected: String = "₹84,500",
    selectedSubTab: String = "Overview",
    onSubTabSelect: (String) -> Unit = {},
    transactions: List<PaymentTransactionPreview> = emptyList(),
    onTransactionClick: (PaymentTransactionPreview) -> Unit = {},
    onCreatePaymentLinkClick: () -> Unit = {},
    onRefreshClick: () -> Unit = {},
    onExternalBrowserClick: () -> Unit = {},
    onBackClick: () -> Unit = {},
    onMenuClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val subTabs = listOf("Overview", "Payment links", "Confirmations")
    val paymentBorderColor = RefDarkBorder
    val paymentSurfaceVariantColor = RefDarkSurfaceVariant
    val visibleTransactions = if (selectedSubTab == "Overview") transactions else emptyList()
    val emptyTitle = when (selectedSubTab) {
        "Payment links" -> "No payment links yet"
        "Confirmations" -> "No confirmations yet"
        else -> "No transactions yet"
    }
    val emptyMessage = when (selectedSubTab) {
        "Payment links" -> "Created payment links will appear here."
        "Confirmations" -> "Customer confirmations will appear here."
        else -> "Confirmed payments will appear here."
    }

    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    // Browser / in-app page header
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onBackClick) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = RefTextPrimary
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Payments",
                                color = RefTextPrimary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = null,
                                    tint = RefTextMuted,
                                    modifier = Modifier.size(11.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "app.aicloser.in",
                                    color = RefTextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        IconButton(onClick = onExternalBrowserClick) {
                            Icon(
                                imageVector = Icons.Default.OpenInNew,
                                contentDescription = "Open External",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        IconButton(onClick = onMenuClick) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "Menu",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        ReferenceBrandBadge()
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "Payments & confirmations",
                        color = RefTextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Sub-tab pills
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        subTabs.forEach { tab ->
                            val isSelected = tab == selectedSubTab
                            val chipBg by animateColorAsState(
                                targetValue = if (isSelected) RefDarkSurfaceVariant else Color.Transparent,
                                animationSpec = tween(180),
                                label = "subTabBg"
                            )
                            val chipBorder by animateColorAsState(
                                targetValue = if (isSelected) RefBrandOrange.copy(alpha = 0.5f) else Color.Transparent,
                                animationSpec = tween(180),
                                label = "subTabBorder"
                            )

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(chipBg)
                                    .border(1.dp, chipBorder, RoundedCornerShape(16.dp))
                                    .clickable { onSubTabSelect(tab) }
                                    .padding(horizontal = 14.dp, vertical = 7.dp)
                            ) {
                                Text(
                                    text = tab,
                                    color = if (isSelected) RefBrandOrange else RefTextMuted,
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            },
            bottomBar = {
                // Bottom Action buttons
                Surface(
                    color = RefDarkBackground,
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = onCreatePaymentLinkClick,
                            modifier = Modifier
                                .weight(1.3f)
                                .height(48.dp),
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = RefBrandOrange,
                                contentColor = Color.White
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Create payment link",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Button(
                            onClick = onRefreshClick,
                            modifier = Modifier
                                .weight(0.9f)
                                .height(48.dp),
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = RefDarkSurfaceVariant,
                                contentColor = RefTextPrimary
                            ),
                            border = BorderStroke(1.dp, RefDarkBorder)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Refresh",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        ) { paddingValues ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Total collected & circular progress gauge card
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(22.dp))
                            .background(RefDarkSurface)
                            .border(1.dp, RefDarkBorder, RoundedCornerShape(22.dp))
                            .padding(20.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Total collected",
                                    color = RefTextMuted,
                                    fontSize = 13.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = totalCollected,
                                    color = RefTextPrimary,
                                    fontSize = 32.sp,
                                    fontWeight = FontWeight.Black
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "collected",
                                    color = RefTextMuted,
                                    fontSize = 13.sp
                                )
                            }

                            // Circular Radial Gauge
                            Box(
                                modifier = Modifier.size(96.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Canvas(modifier = Modifier.fillMaxSize()) {
                                    val strokeWidth = 7.dp.toPx()
                                    val radius = (size.minDimension - strokeWidth) / 2
                                    val center = Offset(size.width / 2, size.height / 2)

                                    // Outer tick marks
                                    val tickCount = 36
                                    for (i in 0 until tickCount) {
                                        val angleRad = Math.toRadians(i * (360.0 / tickCount))
                                        val innerR = radius - 10.dp.toPx()
                                        val outerR = radius - 4.dp.toPx()
                                        val start = Offset(
                                            (center.x + innerR * cos(angleRad)).toFloat(),
                                            (center.y + innerR * sin(angleRad)).toFloat()
                                        )
                                        val end = Offset(
                                            (center.x + outerR * cos(angleRad)).toFloat(),
                                            (center.y + outerR * sin(angleRad)).toFloat()
                                        )
                                        drawLine(
                                            color = paymentBorderColor,
                                            start = start,
                                            end = end,
                                            strokeWidth = 1.5.dp.toPx()
                                        )
                                    }

                                    // Base grey track
                                    drawArc(
                                        color = paymentSurfaceVariantColor,
                                        startAngle = -90f,
                                        sweepAngle = 360f,
                                        useCenter = false,
                                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
                                        size = Size(radius * 2, radius * 2),
                                        topLeft = Offset(center.x - radius, center.y - radius)
                                    )

                                    // Glowing Orange progress arc
                                    drawArc(
                                        color = RefBrandOrange,
                                        startAngle = -90f,
                                        sweepAngle = 145f,
                                        useCenter = false,
                                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
                                        size = Size(radius * 2, radius * 2),
                                        topLeft = Offset(center.x - radius, center.y - radius)
                                    )
                                }

                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = "This",
                                        color = RefTextMuted,
                                        fontSize = 11.sp
                                    )
                                    Text(
                                        text = "month",
                                        color = RefTextMuted,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }
                    }
                }

                // Transactions Ledger
                if (visibleTransactions.isEmpty()) {
                    item {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 34.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = RefTextMuted, modifier = Modifier.size(30.dp))
                            Text(emptyTitle, color = RefTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text(emptyMessage, color = RefTextMuted, fontSize = 12.sp)
                        }
                    }
                } else {
                    items(visibleTransactions) { tx ->
                        val isConfirmed = tx.status.equals("Confirmed", ignoreCase = true)
                        ReferencePaymentItemCard(
                            initial = tx.initial,
                            title = tx.title,
                            date = tx.date,
                            amount = tx.amount,
                            status = tx.status,
                            statusColor = if (isConfirmed) RefSuccessGreen else RefWarningOrange,
                            statusBg = if (isConfirmed) RefSuccessGreenSoft else RefWarningOrangeSoft,
                            onClick = { onTransactionClick(tx) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReferencePaymentItemCard(
    initial: String,
    title: String,
    date: String,
    amount: String,
    status: String,
    statusColor: Color,
    statusBg: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(RefDarkSurface)
            .border(1.dp, RefDarkBorder, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ReferenceAvatar(text = initial, size = 42.dp)

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = RefTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = date,
                    color = RefTextMuted,
                    fontSize = 12.sp
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = amount,
                    color = RefTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(statusBg)
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = status,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = RefTextMuted,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

// ============================================================================
// PREVIEWS
// ============================================================================

@Preview(name = "13 - Inbox Screen Dark", showBackground = true, backgroundColor = 0xFF0C0E12)
@Composable
private fun PreviewInboxScreen() {
    GXClosersTheme {
        ReferenceInboxScreen()
    }
}

@Preview(name = "14 - Chat Screen Dark", showBackground = true, backgroundColor = 0xFF0C0E12)
@Composable
private fun PreviewChatScreen() {
    GXClosersTheme {
        ReferenceChatScreen()
    }
}

@Preview(name = "15 - Lead Overview Screen Dark", showBackground = true, backgroundColor = 0xFF0C0E12)
@Composable
private fun PreviewLeadOverviewScreen() {
    GXClosersTheme {
        ReferenceLeadOverviewScreen()
    }
}

@Preview(name = "16 - Add Contact Screen Dark", showBackground = true, backgroundColor = 0xFF0C0E12)
@Composable
private fun PreviewAddContactScreen() {
    GXClosersTheme {
        ReferenceAddContactScreen()
    }
}

@Preview(name = "17 - Pipeline Screen Dark", showBackground = true, backgroundColor = 0xFF0C0E12)
@Composable
private fun PreviewPipelineScreen() {
    GXClosersTheme {
        ReferencePipelineScreen()
    }
}

@Preview(name = "18 - Contacts Screen Dark", showBackground = true, backgroundColor = 0xFF0C0E12)
@Composable
private fun PreviewContactsScreen() {
    GXClosersTheme {
        ReferenceContactsScreen()
    }
}

@Preview(name = "19 - Payments Screen Dark", showBackground = true, backgroundColor = 0xFF0C0E12)
@Composable
private fun PreviewPaymentsScreen() {
    GXClosersTheme {
        ReferencePaymentsScreen()
    }
}
