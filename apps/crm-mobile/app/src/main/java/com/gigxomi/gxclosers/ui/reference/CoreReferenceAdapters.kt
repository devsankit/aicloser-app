package com.gigxomi.gxclosers.ui.reference

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gigxomi.gxclosers.data.*
import com.gigxomi.gxclosers.ui.CrmViewModel
import com.gigxomi.gxclosers.ui.screens.*
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Calendar

private val RefBrandOrange = Color(0xFFFF5C00)
private val RefDarkBg = Color(0xFF0D0E12)
private val RefDarkCard = Color(0xFF14171D)
private val RefDarkBorder = Color(0xFF232832)
private val RefDarkMuted = Color(0xFF8E98A8)
private val RefDarkText = Color(0xFFF6F8FA)

/**
 * Reusable explicit empty state view for screens where live data is currently empty.
 */
@Composable
private fun ExplicitEmptyStateView(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    message: String,
    actionLabel: String? = null,
    onActionClick: (() -> Unit)? = null,
    secondaryActionLabel: String? = null,
    onSecondaryActionClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(RefDarkBg)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = RefDarkCard),
            border = BorderStroke(1.dp, RefDarkBorder)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = RefBrandOrange.copy(alpha = 0.15f),
                    modifier = Modifier.size(64.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = RefBrandOrange,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                Text(
                    text = title,
                    color = RefDarkText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text = message,
                    color = RefDarkMuted,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )

                if (actionLabel != null && onActionClick != null) {
                    Spacer(Modifier.height(20.dp))
                    Button(
                        onClick = onActionClick,
                        colors = ButtonDefaults.buttonColors(containerColor = RefBrandOrange),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                    ) {
                        Text(
                            text = actionLabel,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }

                if (secondaryActionLabel != null && onSecondaryActionClick != null) {
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = onSecondaryActionClick,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, RefDarkBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                    ) {
                        Text(
                            text = secondaryActionLabel,
                            color = RefDarkText,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    }
}

// =============================================================================
// SCREEN 06: LIVE HOME / DASHBOARD ADAPTER
// =============================================================================

@Composable
fun LiveHomeScreenAdapter(
    vm: CrmViewModel,
    onNavigateToTab: (String) -> Unit = {},
    onOpenLead: (SalesLead) -> Unit = {},
    onGrabLeads: () -> Unit = {},
    onOpenChats: () -> Unit = {},
    onOpenPayments: () -> Unit = {},
    onOpenNotifications: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val data = vm.bootstrap
    val session = vm.session

    val agentName = remember(session, data) {
        session?.displayName?.split(" ")?.firstOrNull()
            ?: data?.agent?.displayName?.split(" ")?.firstOrNull()
            ?: "Closer"
    }

    val greeting = remember(agentName) {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val timeGreeting = when {
            hour < 12 -> "Good morning"
            hour < 17 -> "Good afternoon"
            else -> "Good evening"
        }
        "$timeGreeting, $agentName"
    }

    val headline = remember(data) {
        val available = data?.availableLeadCount ?: 0
        if (available > 0) "Ready to close more today?" else "Track your progress and follow-ups"
    }

    val callsToday = remember(data?.calls) {
        val today = LocalDate.now()
        data?.calls.orEmpty().count { call ->
            runCatching {
                Instant.parse(call.startedAt).atZone(ZoneId.systemDefault()).toLocalDate() == today
            }.getOrDefault(true)
        }
    }

    val talkTimeMinutes = remember(data?.calls) {
        data?.calls.orEmpty().sumOf { it.durationSeconds } / 60
    }

    val leadsCount = data?.dashboard?.totalLeads ?: data?.leads?.size ?: 0

    val syncStatusText = remember(vm.syncCounts) {
        when {
            vm.syncCounts.failed > 0 -> "${vm.syncCounts.failed} sync failed"
            vm.syncCounts.pending > 0 -> "${vm.syncCounts.pending} pending sync"
            vm.syncCounts.syncing > 0 -> "Syncing..."
            else -> "Synced just now"
        }
    }

    val recentLeads = data?.leads.orEmpty()

    ReferenceHomeScreen(
        agentName = agentName,
        greeting = greeting,
        headline = headline,
        callsToday = callsToday,
        talkTimeMinutes = talkTimeMinutes,
        leadsCount = leadsCount,
        syncStatusText = syncStatusText,
        recentLeads = recentLeads,
        selectedNavTab = "home",
        onNotificationClick = onOpenNotifications,
        onGrabLeadsClick = onGrabLeads,
        onWhatsAppClick = { /* Real action triggered via WhatsApp or chat */ },
        onChatsClick = onOpenChats,
        onPaymentsClick = onOpenPayments,
        onViewAllLeadsClick = { onNavigateToTab("leads") },
        onLeadClick = onOpenLead,
        onCallLead = { lead -> vm.startCall(lead) },
        onNavTabSelected = onNavigateToTab,
        modifier = modifier
    )
}

/**
 * Convenient alias for Dashboard screen naming.
 */
@Composable
fun LiveDashboardAdapter(
    vm: CrmViewModel,
    onNavigateToTab: (String) -> Unit = {},
    onOpenLead: (SalesLead) -> Unit = {},
    onGrabLeads: () -> Unit = {},
    onOpenChats: () -> Unit = {},
    onOpenPayments: () -> Unit = {},
    onOpenNotifications: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    LiveHomeScreenAdapter(
        vm = vm,
        onNavigateToTab = onNavigateToTab,
        onOpenLead = onOpenLead,
        onGrabLeads = onGrabLeads,
        onOpenChats = onOpenChats,
        onOpenPayments = onOpenPayments,
        onOpenNotifications = onOpenNotifications,
        modifier = modifier
    )
}

// =============================================================================
// SCREEN 07: LIVE LEADS ADAPTER
// =============================================================================

@Composable
fun LiveLeadsScreenAdapter(
    vm: CrmViewModel,
    onNavigateToTab: (String) -> Unit = {},
    onOpenLead: (SalesLead) -> Unit = {},
    onGrabLeads: () -> Unit = {},
    onOpenNotifications: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedStageFilter by rememberSaveable { mutableStateOf("All") }
    var showAddContactDialog by rememberSaveable { mutableStateOf(false) }

    val rawLeads = vm.bootstrap?.leads.orEmpty()

    if (rawLeads.isEmpty() && vm.bootstrap != null) {
        // Explicit empty state when no leads are assigned to the authenticated user
        ExplicitEmptyStateView(
            icon = Icons.Default.PeopleOutline,
            title = "No leads assigned yet",
            message = "You currently have no assigned leads. Claim fresh enquiries from the lead queue to start closing.",
            actionLabel = "Grab new leads",
            onActionClick = onGrabLeads,
            secondaryActionLabel = "Refresh leads",
            onSecondaryActionClick = { vm.refreshAll() },
            modifier = modifier
        )
    } else {
        ReferenceLeadsScreen(
            leads = rawLeads,
            selectedStageFilter = selectedStageFilter,
            searchQuery = searchQuery,
            selectedNavTab = "leads",
            onSearchQueryChange = { searchQuery = it },
            onFilterClick = { /* Opens filter sheet or cycles stages */ },
            onStageFilterSelect = { selectedStageFilter = it },
            onNotificationClick = onOpenNotifications,
            onGrabLeadsClick = onGrabLeads,
            onAddContactClick = { showAddContactDialog = true },
            onLeadClick = onOpenLead,
            onCallLead = { lead -> vm.startCall(lead) },
            onNavTabSelected = onNavigateToTab,
            modifier = modifier
        )
    }

    if (showAddContactDialog) {
        var name by rememberSaveable { mutableStateOf("") }
        var phone by rememberSaveable { mutableStateOf("") }
        var email by rememberSaveable { mutableStateOf("") }
        var notes by rememberSaveable { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showAddContactDialog = false },
            title = { Text("Add New Contact", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Customer full name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("Phone number") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email (optional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Initial notes (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        vm.addContact(name, phone, email, notes = notes) {
                            showAddContactDialog = false
                        }
                    },
                    enabled = name.isNotBlank() && phone.isNotBlank() && !vm.busy
                ) {
                    Text(if (vm.busy) "Saving..." else "Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddContactDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// =============================================================================
// SCREEN 08: LIVE CALLS ADAPTER
// =============================================================================

@Composable
fun LiveCallsScreenAdapter(
    vm: CrmViewModel,
    onNavigateToTab: (String) -> Unit = {},
    onOpenDisposition: (String) -> Unit = {},
    onOpenNotifications: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val calls = vm.bootstrap?.calls.orEmpty()
    var selectedCallTab by rememberSaveable { mutableStateOf("Outbound") }

    val activeCall = remember(calls, vm.playingCallId) {
        calls.find { it.id == vm.playingCallId } ?: calls.firstOrNull()
    }
    val isPlaying = vm.playingCallId != null && vm.playingCallId == activeCall?.id

    if (calls.isEmpty() && vm.bootstrap != null) {
        // Explicit empty state when no calls are logged
        ExplicitEmptyStateView(
            icon = Icons.AutoMirrored.Filled.PhoneCallback,
            title = "No call history yet",
            message = "Outbound and inbound customer calls will automatically be tracked and displayed here.",
            actionLabel = "Refresh calls",
            onActionClick = { vm.refreshAll() },
            modifier = modifier
        )
    } else {
        ReferenceCallsScreen(
            calls = calls,
            activeCall = activeCall,
            isPlaying = isPlaying,
            playbackPositionSeconds = 0,
            selectedCallTab = selectedCallTab,
            selectedNavTab = "calls",
            onNotificationClick = onOpenNotifications,
            onPlayPauseToggle = {
                activeCall?.id?.let { callId -> vm.playRecording(callId) }
            },
            onSkipBackward = { /* Rewind playback */ },
            onSkipForward = { /* Fast forward playback */ },
            onSeek = { /* Seek position */ },
            onCallTabSelect = { selectedCallTab = it },
            onCallClick = { call ->
                if (call.recordingStatus == "UPLOADED") {
                    vm.playRecording(call.id)
                } else if (call.note.isNullOrBlank()) {
                    onOpenDisposition(call.id)
                }
            },
            onNavTabSelected = onNavigateToTab,
            modifier = modifier
        )
    }
}

// =============================================================================
// SCREEN 09: LIVE MORE DRAWER ADAPTER
// =============================================================================

@Composable
fun LiveMoreDrawerAdapter(
    vm: CrmViewModel,
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
    val session = vm.session
    val agent = vm.bootstrap?.agent

    val userName = session?.displayName ?: agent?.displayName ?: "Sales Closer"
    val userRole = if (agent?.canClaimLeads == true) "Certified Closer" else "Sales closer"

    ReferenceMoreDrawer(
        userName = userName,
        userRole = userRole,
        currentTheme = "Dark",
        onClose = onClose,
        onInboxClick = {
            vm.loadInbox()
            onInboxClick()
        },
        onDiagnosticsClick = onDiagnosticsClick,
        onProfileClick = onProfileClick,
        onSettingsClick = onSettingsClick,
        onPaymentsClick = onPaymentsClick,
        onHelpClick = onHelpClick,
        onThemeChange = onThemeChange,
        onLogoutClick = {
            vm.logout(onLogoutClick)
        },
        modifier = modifier
    )
}

// =============================================================================
// SCREEN 10: LIVE GRAB LEADS ADAPTER
// =============================================================================

@Composable
fun LiveGrabLeadsScreenAdapter(
    vm: CrmViewModel,
    onBackClick: () -> Unit = {},
    onViewLeadQueue: () -> Unit = {},
    onClaimCompleted: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val availableCount = vm.bootstrap?.availableLeadCount ?: vm.bootstrap?.availableLeads?.size ?: 0
    val pack = vm.selectedPack
    val previewLead = pack?.leads?.firstOrNull() ?: vm.bootstrap?.availableLeads?.firstOrNull()

    if (availableCount == 0 && pack == null && vm.bootstrap != null) {
        // Explicit empty state when no leads are available in the queue
        ExplicitEmptyStateView(
            icon = Icons.Default.Inbox,
            title = "No leads in queue",
            message = "There are currently no fresh leads in the unassigned queue. Please check back soon or refresh.",
            actionLabel = "Refresh pool",
            onActionClick = { vm.refreshAll() },
            secondaryActionLabel = "Back to dashboard",
            onSecondaryActionClick = onBackClick,
            modifier = modifier
        )
    } else {
        ReferenceGrabLeadsScreen(
            availableCount = availableCount,
            previewLead = previewLead,
            onBackClick = onBackClick,
            onGrabNextLead = {
                if (pack == null) {
                    vm.requestPack(3)
                } else {
                    vm.claimPack(onClaimCompleted)
                }
            },
            onViewLeadQueue = onViewLeadQueue,
            modifier = modifier
        )
    }
}

// =============================================================================
// SCREEN 11: LIVE LEAD DETAIL ADAPTER
// =============================================================================

@Composable
fun LiveLeadDetailScreenAdapter(
    vm: CrmViewModel,
    leadId: String,
    onBackClick: () -> Unit = {},
    onMenuClick: () -> Unit = {},
    onOpenDisposition: (String) -> Unit = {},
    onChatClick: (String) -> Unit = {},
    onWhatsAppClick: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val lead = vm.bootstrap?.leads?.find { it.id == leadId }
    val customer = vm.customer360

    LaunchedEffect(leadId) {
        vm.clearCustomer360()
        vm.loadCustomer360(leadId)
    }

    if (lead == null) {
        // Explicit empty state when lead record is missing
        ExplicitEmptyStateView(
            icon = Icons.Default.PersonOff,
            title = "Lead unavailable",
            message = "This lead may have been reassigned, completed, or cannot be found in your active leads.",
            actionLabel = "Back to leads",
            onActionClick = onBackClick,
            secondaryActionLabel = "Refresh leads",
            onSecondaryActionClick = { vm.refreshAll() },
            modifier = modifier
        )
    } else {
        val nextActionSummary = remember(lead.followUpAt, customer?.tasks) {
            val pendingTask = customer?.tasks?.firstOrNull { it.status != "DONE" }
            when {
                pendingTask != null -> "${pendingTask.title} · ${pendingTask.dueAt}"
                !lead.followUpAt.isNullOrBlank() -> "Follow-up scheduled · ${lead.followUpAt}"
                else -> "No upcoming task scheduled"
            }
        }

        ReferenceLeadDetailScreen(
            lead = lead,
            currentStage = lead.stage.ifBlank { "New" },
            nextActionSummary = nextActionSummary,
            activityTimeline = customer?.timeline.orEmpty(),
            onBackClick = onBackClick,
            onMenuClick = onMenuClick,
            onCallClick = { vm.startCall(lead) },
            onWhatsAppClick = { onWhatsAppClick?.invoke(lead.customerPhone) },
            onChatClick = { onChatClick(lead.id) },
            onStageChange = { newStage -> vm.updateLeadStage(lead.id, newStage) },
            onNextActionClick = { /* Opens schedule follow-up picker */ },
            onUpdateLeadClick = { /* Opens update lead details */ },
            modifier = modifier
        )
    }
}

// =============================================================================
// SCREEN 12: LIVE COMPLETE CALL ADAPTER
// =============================================================================

@Composable
fun LiveCompleteCallScreenAdapter(
    vm: CrmViewModel,
    callId: String,
    onBackClick: () -> Unit = {},
    onSaved: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val call = vm.bootstrap?.calls?.find { it.id == callId }

    if (call == null && callId.isNotBlank()) {
        // Explicit empty state when call is not found
        ExplicitEmptyStateView(
            icon = Icons.AutoMirrored.Filled.PhoneMissed,
            title = "Call record not found",
            message = "The call you are attempting to disposition could not be located in your recent calls.",
            actionLabel = "Back",
            onActionClick = onBackClick,
            secondaryActionLabel = "Refresh calls",
            onSecondaryActionClick = { vm.refreshAll() },
            modifier = modifier
        )
    } else {
        val contactName = call?.assignment?.customerName ?: call?.phoneNumber ?: "Contact"
        val durationSeconds = call?.durationSeconds ?: 0
        val min = durationSeconds / 60
        val sec = durationSeconds % 60
        val callTypeAndDuration = "Outgoing · %02d:%02d".format(min, sec)
        val initialOutcome = call?.outcome?.ifBlank { "Connected" } ?: "Connected"
        val initialFollowUpText = call?.assignment?.followUpAt ?: ""
        val initialNotes = call?.note.orEmpty()
        val initialMoveToFollowUp = call?.assignment?.stage?.equals("FOLLOW_UP", ignoreCase = true) ?: true

        ReferenceCompleteCallScreen(
            contactName = contactName,
            callTypeAndDuration = callTypeAndDuration,
            initialOutcome = initialOutcome,
            initialFollowUpText = initialFollowUpText,
            initialNotes = initialNotes,
            initialMoveToFollowUp = initialMoveToFollowUp,
            onBackClick = onBackClick,
            onSelectFollowUpTime = { /* Opens follow-up date/time picker */ },
            onSaveOutcome = { outcome, notes, followUpText, moveToFollowUp ->
                val stageUpdate = if (moveToFollowUp) "FOLLOW_UP" else (call?.assignment?.stage ?: "CONTACTED")
                vm.saveDisposition(
                    callId = callId,
                    customerName = contactName,
                    outcome = outcome,
                    note = notes,
                    followUp = followUpText.ifBlank { null },
                    stageUpdate = stageUpdate,
                    done = onSaved
                )
            },
            modifier = modifier
        )
    }
}
