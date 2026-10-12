package com.gigxomi.gxclosers.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
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
import kotlin.math.cos
import kotlin.math.sin

// --- Color Tokens & Reference Palette ---
private val RefBrandOrange = Color(0xFFFF5C1C)
private val RefBrandOrangeDark = Color(0xFFE04E15)
private val RefBrandOrangeSoft = Color(0x24FF5C1C)
private val RefDarkBackground = Color(0xFF0C0E12)
private val RefDarkSurface = Color(0xFF15181F)
private val RefDarkSurfaceVariant = Color(0xFF1C2029)
private val RefDarkBorder = Color(0xFF262C38)
private val RefTextPrimary = Color(0xFFF7F9FC)
private val RefTextMuted = Color(0xFF8E95A5)
private val RefSuccessGreen = Color(0xFF22C55E)
private val RefSuccessGreenSoft = Color(0x2622C55E)
private val RefWarningOrange = Color(0xFFF97316)
private val RefWarningOrangeSoft = Color(0x26F97316)
private val RefBlue = Color(0xFF38BDF8)
private val RefBlueSoft = Color(0x2638BDF8)
private val RefPurple = Color(0xFFA855F7)
private val RefPurpleSoft = Color(0x26A855F7)

/**
 * Interactive bounce micro-motion: scales down to ~0.97 on press.
 */
fun Modifier.referenceBounceClick(onClick: () -> Unit): Modifier = this.pointerInput(Unit) {
    detectTapGestures(
        onPress = {
            tryAwaitRelease()
            onClick()
        }
    )
}

@Composable
private fun animateScaleOnPress(): Pair<Modifier, Float> {
    var isPressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.97f else 1f,
        animationSpec = spring(dampingRatio = 0.6f, stiffness = 800f),
        label = "bounceScale"
    )
    val modifier = Modifier.pointerInput(Unit) {
        detectTapGestures(
            onPress = {
                isPressed = true
                tryAwaitRelease()
                isPressed = false
            }
        )
    }
    return Pair(modifier, scale)
}

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
        content()
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

    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = RefDarkBackground,
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
                            onClick = onRefreshClick,
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(RefDarkSurfaceVariant)
                                .border(1.dp, RefDarkBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Refresh",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Inbox",
                        color = RefTextPrimary,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Search Field
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
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
                                textStyle = TextStyle(color = RefTextPrimary, fontSize = 15.sp),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                decorationBox = { innerTextField ->
                                    if (searchQuery.isEmpty()) {
                                        Text(
                                            text = "Search conversations",
                                            color = RefTextMuted,
                                            fontSize = 15.sp
                                        )
                                    }
                                    innerTextField()
                                }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Filter chips
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        filters.forEach { filter ->
                            val isSelected = filter == selectedFilter
                            val chipBg by animateColorAsState(
                                targetValue = if (isSelected) RefBrandOrangeSoft else RefDarkSurface,
                                animationSpec = tween(180),
                                label = "filterBg"
                            )
                            val chipBorder by animateColorAsState(
                                targetValue = if (isSelected) RefBrandOrange else RefDarkBorder,
                                animationSpec = tween(180),
                                label = "filterBorder"
                            )
                            val chipText by animateColorAsState(
                                targetValue = if (isSelected) RefBrandOrange else RefTextMuted,
                                animationSpec = tween(180),
                                label = "filterText"
                            )

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(chipBg)
                                    .border(1.dp, chipBorder, RoundedCornerShape(20.dp))
                                    .clickable { onFilterSelect(filter) }
                                    .padding(horizontal = 18.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = filter,
                                    color = chipText,
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            }
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
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (inboxItems.isEmpty()) {
                    item {
                        // Empty / preview placeholder card
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(20.dp))
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, RoundedCornerShape(20.dp))
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = Icons.Default.ChatBubbleOutline,
                                    contentDescription = null,
                                    tint = RefTextMuted,
                                    modifier = Modifier.size(36.dp)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = "No conversations found",
                                    color = RefTextMuted,
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                } else {
                    items(inboxItems) { item ->
                        ReferenceInboxItemCard(
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
private fun ReferenceInboxItemCard(
    item: InboxItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(RefDarkSurface)
            .border(1.dp, RefDarkBorder.copy(alpha = 0.8f), RoundedCornerShape(20.dp))
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
                        color = RefTextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = item.latestMessageAt?.take(5) ?: "2m",
                            color = RefTextMuted,
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
                            tint = RefTextMuted,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                if (item.lead.serviceInterest.isNotBlank()) {
                    Text(
                        text = item.lead.serviceInterest,
                        color = RefTextMuted,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = item.latestMessage.ifBlank { "Open conversation" },
                    color = RefTextPrimary.copy(alpha = 0.85f),
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
                            .background(RefDarkSurfaceVariant)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "CRM",
                            color = RefTextMuted,
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
    inputText: String = "",
    onInputTextChange: (String) -> Unit = {},
    onSendMessage: (String) -> Unit = {},
    onAttachFileClick: () -> Unit = {},
    onCallClick: () -> Unit = {},
    onMenuClick: () -> Unit = {},
    onStageDropdownClick: () -> Unit = {},
    onBackClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val contactName = lead?.customerName ?: "Ankit Sharma"
    val stageText = lead?.stage?.ifBlank { "Follow-up" } ?: "Follow-up"
    val dealTitle = lead?.serviceInterest?.ifBlank { "CRM implementation" } ?: "CRM implementation"

    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = RefDarkBackground,
            topBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .background(RefDarkBackground)
                ) {
                    // Header Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
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
                                text = stageText,
                                color = RefTextMuted,
                                fontSize = 12.sp
                            )
                        }

                        IconButton(
                            onClick = onCallClick,
                            modifier = Modifier
                                .size(36.dp)
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

                        Spacer(modifier = Modifier.width(6.dp))

                        IconButton(
                            onClick = onMenuClick,
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(RefDarkSurfaceVariant)
                                .border(1.dp, RefDarkBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "More",
                                tint = RefTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
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
                                    .clickable(onClick = onStageDropdownClick)
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = stageText,
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
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))
                }
            },
            bottomBar = {
                // Composer Bottom Bar with IME and Nav padding
                Surface(
                    color = RefDarkBackground,
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = onAttachFileClick,
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.AttachFile,
                                contentDescription = "Attach",
                                tint = RefTextMuted,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(22.dp))
                                .background(RefDarkSurface)
                                .border(1.dp, RefDarkBorder, RoundedCornerShape(22.dp))
                                .padding(horizontal = 16.dp, vertical = 11.dp)
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

                        Spacer(modifier = Modifier.width(10.dp))

                        IconButton(
                            onClick = {
                                if (inputText.isNotBlank()) {
                                    onSendMessage(inputText)
                                }
                            },
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(RefBrandOrange)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Send,
                                contentDescription = "Send",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
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
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    // Date Separator "Today"
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Today",
                            color = RefTextMuted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                if (messages.isEmpty()) {
                    // Fallback to sample reference messages matching screenshot 14
                    item {
                        ReferenceIncomingBubble(
                            text = "Hi, can we schedule the demo tomorrow?",
                            time = "9:14 AM"
                        )
                    }
                    item {
                        ReferenceOutgoingBubble(
                            text = "Yes, 11:30 AM works. I'll send the details.",
                            time = "9:16 AM"
                        )
                    }
                    item {
                        ReferenceIncomingBubble(
                            text = "Perfect, thank you.",
                            time = "9:18 AM"
                        )
                    }
                } else {
                    items(messages) { message ->
                        if (message.outbound) {
                            ReferenceOutgoingBubble(
                                text = message.body,
                                time = message.createdAt.takeLast(8).take(5)
                            )
                        } else {
                            ReferenceIncomingBubble(
                                text = message.body,
                                time = message.createdAt.takeLast(8).take(5)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReferenceIncomingBubble(
    text: String,
    time: String,
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
                Text(
                    text = text,
                    color = RefTextPrimary,
                    fontSize = 14.sp,
                    lineHeight = 19.sp
                )
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
                Text(
                    text = text,
                    color = Color.White,
                    fontSize = 14.sp,
                    lineHeight = 19.sp
                )
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
            containerColor = RefDarkBackground,
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

                Spacer(modifier = Modifier.height(18.dp))

                // Telephony hardware / sync card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(RefDarkSurface)
                        .border(1.dp, RefDarkBorder, RoundedCornerShape(20.dp))
                        .padding(18.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Phone graphic
                        Box(
                            modifier = Modifier
                                .size(50.dp, 64.dp)
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

                        Spacer(modifier = Modifier.width(16.dp))

                        Column {
                            Text(
                                text = deviceName,
                                color = RefTextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(RefSuccessGreen)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (isDeviceSynced) "Synced" else "Offline",
                                    color = RefTextPrimary,
                                    fontSize = 12.sp
                                )
                            }
                            Spacer(modifier = Modifier.height(3.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = RefSuccessGreen,
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

                Spacer(modifier = Modifier.height(20.dp))

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

                Spacer(modifier = Modifier.height(16.dp))

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

                Spacer(modifier = Modifier.height(16.dp))

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

                Spacer(modifier = Modifier.height(22.dp))

                // Run Diagnostics Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(RefDarkSurface)
                        .border(1.dp, RefDarkBorder, RoundedCornerShape(24.dp))
                        .clickable(onClick = onRunDiagnosticsClick)
                        .padding(vertical = 14.dp),
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

                Spacer(modifier = Modifier.height(12.dp))

                // Log out Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(RefDarkSurface)
                        .border(1.dp, Color(0xFFEF4444).copy(alpha = 0.4f), RoundedCornerShape(24.dp))
                        .clickable(onClick = onLogoutClick)
                        .padding(vertical = 14.dp),
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

                Spacer(modifier = Modifier.height(28.dp))
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
            .padding(horizontal = 16.dp, vertical = 14.dp),
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
    onSaveContact: () -> Unit = {},
    onCancel: () -> Unit = {},
    modifier: Modifier = Modifier
) {
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
                            modifier = Modifier
                                .weight(1.3f)
                                .height(48.dp),
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = RefBrandOrange,
                                contentColor = Color.White
                            )
                        ) {
                            Text(text = "Save contact", fontSize = 14.sp, fontWeight = FontWeight.Bold)
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
    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = RefDarkBackground,
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
            bottomBar = {
                ReferenceBottomNavigation(
                    selectedTab = selectedNavTab,
                    onTabSelect = onNavTabSelect
                )
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
                    count = 4,
                    dotColor = RefBlue,
                    modifier = Modifier.width(52.dp)
                )

                // Active Center Column: Follow-up
                ReferenceKanbanActiveColumn(
                    leads = leads,
                    onLeadCardClick = onLeadCardClick,
                    onLeadMenuClick = onLeadMenuClick,
                    modifier = Modifier.weight(1f)
                )

                // Peek Right Column: Qualified
                ReferenceKanbanPeekColumn(
                    title = "Qualif",
                    count = 3,
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

        // Placeholder cards
        repeat(4) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(vertical = 4.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(RefDarkSurfaceVariant.copy(alpha = 0.4f))
            )
        }
    }
}

@Composable
private fun ReferenceKanbanActiveColumn(
    leads: List<SalesLead>,
    onLeadCardClick: (SalesLead) -> Unit,
    onLeadMenuClick: (SalesLead) -> Unit,
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
                    text = "Follow-up · 6",
                    color = RefTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Icon(
                imageVector = Icons.Default.MoreHoriz,
                contentDescription = null,
                tint = RefTextMuted,
                modifier = Modifier.size(18.dp)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Cards List
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (leads.isEmpty()) {
                // Render sample reference cards matching screenshot 17
                item {
                    ReferencePipelineLeadCard(
                        avatar = "A",
                        name = "Ankit Sharma",
                        service = "Car Loan",
                        priority = "High",
                        priorityColor = RefBrandOrange,
                        priorityBg = RefBrandOrangeSoft,
                        actionTime = "Call today, 10:00 AM",
                        onClick = {}
                    )
                }
                item {
                    ReferencePipelineLeadCard(
                        avatar = "P",
                        name = "Priya Mehta",
                        service = "Home Loan",
                        priority = "Medium",
                        priorityColor = RefWarningOrange,
                        priorityBg = RefWarningOrangeSoft,
                        actionTime = "Follow up tomorrow",
                        onClick = {}
                    )
                }
                item {
                    ReferencePipelineLeadCard(
                        avatar = "R",
                        name = "Rahul Verma",
                        service = "Personal Loan",
                        priority = "Low",
                        priorityColor = RefSuccessGreen,
                        priorityBg = RefSuccessGreenSoft,
                        actionTime = "Send document",
                        onClick = {}
                    )
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
                Icon(
                    imageVector = Icons.Default.MoreHoriz,
                    contentDescription = null,
                    tint = RefTextMuted,
                    modifier = Modifier.size(16.dp)
                )
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
            containerColor = RefDarkBackground,
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
                ReferenceBottomNavigation(
                    selectedTab = selectedNavTab,
                    onTabSelect = onNavTabSelect
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
                    // Fallback to sample contacts matching screenshot 18
                    item {
                        ReferenceContactItemCard(
                            avatar = "A",
                            name = "Aarav Khanna",
                            phone = "+91 98765 43210",
                            email = "aarav.khanna@example.com",
                            onCallClick = {},
                            onClick = {}
                        )
                    }
                    item {
                        ReferenceContactItemCard(
                            avatar = "P",
                            name = "Priya Mehta",
                            phone = "+91 91234 56789",
                            email = "priya.mehta@example.com",
                            onCallClick = {},
                            onClick = {}
                        )
                    }
                    item {
                        ReferenceContactItemCard(
                            avatar = "R",
                            name = "Rahul Verma",
                            phone = "+91 99887 66554",
                            email = "rahul.verma@example.com",
                            onCallClick = {},
                            onClick = {}
                        )
                    }
                } else {
                    items(contacts) { contact ->
                        ReferenceContactItemCard(
                            avatar = contact.customerName.firstOrNull()?.toString() ?: "C",
                            name = contact.customerName,
                            phone = contact.customerPhone,
                            email = contact.customerEmail,
                            onCallClick = { onCallContactClick(contact) },
                            onClick = { onContactClick(contact) }
                        )
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
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(RefDarkSurface)
            .border(1.dp, RefDarkBorder, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ReferenceAvatar(text = avatar, size = 42.dp)

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = name,
                    color = RefTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(2.dp))
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
                        fontSize = 12.sp
                    )
                }
                Spacer(modifier = Modifier.height(2.dp))
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
                        fontSize = 12.sp
                    )
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

    ReferenceEntrance(modifier = modifier) {
        Scaffold(
            containerColor = RefDarkBackground,
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
                                            color = RefDarkBorder,
                                            start = start,
                                            end = end,
                                            strokeWidth = 1.5.dp.toPx()
                                        )
                                    }

                                    // Base grey track
                                    drawArc(
                                        color = RefDarkSurfaceVariant,
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
                if (transactions.isEmpty()) {
                    // Fallback to sample reference transactions matching screenshot 19
                    item {
                        ReferencePaymentItemCard(
                            initial = "P",
                            title = "PPW Office",
                            date = "12 Mar 2025",
                            amount = "₹24,500",
                            status = "Confirmed",
                            statusColor = RefSuccessGreen,
                            statusBg = RefSuccessGreenSoft,
                            onClick = {}
                        )
                    }
                    item {
                        ReferencePaymentItemCard(
                            initial = "A",
                            title = "Ankit Sharma",
                            date = "10 Mar 2025",
                            amount = "₹35,000",
                            status = "Pending",
                            statusColor = RefWarningOrange,
                            statusBg = RefWarningOrangeSoft,
                            onClick = {}
                        )
                    }
                    item {
                        ReferencePaymentItemCard(
                            initial = "C",
                            title = "CRM Setup",
                            date = "05 Mar 2025",
                            amount = "₹25,000",
                            status = "Confirmed",
                            statusColor = RefSuccessGreen,
                            statusBg = RefSuccessGreenSoft,
                            onClick = {}
                        )
                    }
                } else {
                    items(transactions) { tx ->
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
