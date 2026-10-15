package com.gigxomi.gxclosers.ui.reference

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.gigxomi.gxclosers.ui.FollowUpPickerDialog

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
import com.gigxomi.gxclosers.ui.theme.LocalThemeMode
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
    onBackClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        if (onBackClick != null) {
            IconButton(
                onClick = onBackClick,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
        }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
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
                    color = MaterialTheme.colorScheme.onSurface,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                    ) {
                        Text(
                            text = secondaryActionLabel,
                            color = MaterialTheme.colorScheme.onSurface,
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
    onOpenWhatsApp: () -> Unit = {},
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

    val todayCalls = remember(data?.calls, vm.currentDeviceId, vm.currentDeviceModel) {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        data?.calls.orEmpty().filter { call ->
            if (!call.isFromDevice(vm.currentDeviceId, vm.currentDeviceModel)) return@filter false
            val instant = call.parseEffectiveInstant() ?: return@filter false
            instant.atZone(zone).toLocalDate() == today
        }
    }

    val callsToday = todayCalls.size
    val totalTalkSeconds = todayCalls.sumOf { it.durationSeconds }
    val talkTimeMinutes = totalTalkSeconds / 60
    val talkTimeDisplay = when {
        totalTalkSeconds >= 3600 -> "${totalTalkSeconds / 3600}h ${(totalTalkSeconds % 3600) / 60}m"
        totalTalkSeconds >= 60 -> "${totalTalkSeconds / 60}m"
        totalTalkSeconds > 0 -> "${totalTalkSeconds}s"
        else -> "0m"
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
        talkTimeDisplay = talkTimeDisplay,
        leadsCount = leadsCount,
        syncStatusText = syncStatusText,
        recentLeads = recentLeads,
        selectedNavTab = "home",
        onNotificationClick = onOpenNotifications,
        onGrabLeadsClick = onGrabLeads,
        onWhatsAppClick = onOpenWhatsApp,
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
    onBackClick: () -> Unit = { onNavigateToTab("home") },
    onModalVisibilityChanged: (Boolean) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedStageFilter by rememberSaveable { mutableStateOf("All") }
    var showAddContactDialog by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(showAddContactDialog) {
        onModalVisibilityChanged(showAddContactDialog)
    }

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
            onBackClick = onBackClick,
            modifier = modifier
        )
    } else {
        ReferenceLeadsScreen(
            leads = rawLeads,
            selectedStageFilter = selectedStageFilter,
            searchQuery = searchQuery,
            selectedNavTab = "leads",
            onSearchQueryChange = { searchQuery = it },
            onFilterClick = {
                val filters = listOf("All", "New", "Follow-up", "Contacted")
                val next = (filters.indexOf(selectedStageFilter).coerceAtLeast(0) + 1) % filters.size
                selectedStageFilter = filters[next]
            },
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
        var selectedSource by rememberSaveable { mutableStateOf("Manual") }
        var selectedStage by rememberSaveable { mutableStateOf("New") }

        ReferenceAddContactScreen(
            fullName = name,
            onFullNameChange = { name = it },
            phoneNumber = phone,
            onPhoneNumberChange = { phone = it },
            email = email,
            onEmailChange = { email = it },
            notes = notes,
            onNotesChange = { notes = it },
            selectedSource = selectedSource,
            onSourceChange = { selectedSource = it },
            selectedStage = selectedStage,
            onStageChange = { selectedStage = it },
            isSaving = vm.busy,
            onCancel = { showAddContactDialog = false },
            onSaveContact = {
                if (name.trim().length < 2) {
                    vm.showError("Enter customer full name.")
                } else if (phone.filter(Char::isDigit).length < 7) {
                    vm.showError("Enter a valid phone number.")
                } else {
                    vm.addContact(
                        name = name.trim(),
                        phone = phone.trim(),
                        email = email.trim(),
                        source = selectedSource,
                        notes = notes.trim(),
                        stage = selectedStage,
                    ) { showAddContactDialog = false }
                }
            },
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
    var selectedCallTab by rememberSaveable { mutableStateOf("All") }
    var selectedScopeTab by rememberSaveable { mutableStateOf("All") }
    var selectedCallId by rememberSaveable { mutableStateOf<String?>(null) }

    val filteredCalls = remember(calls, selectedCallTab, selectedScopeTab) {
        calls.filter { call ->
            val matchesScope = when (selectedScopeTab) {
                "This Device" -> {
                    val isOtherDevice = (!call.deviceId.isNullOrBlank() && vm.currentDeviceId.isNotBlank() && call.deviceId != vm.currentDeviceId) ||
                            (!call.deviceModel.isNullOrBlank() && vm.currentDeviceModel.isNotBlank() && !call.deviceModel.equals(vm.currentDeviceModel, ignoreCase = true))
                    !isOtherDevice
                }
                else -> true
            }
            if (!matchesScope) return@filter false

            when (selectedCallTab.lowercase()) {
                "all" -> true
                "missed" -> call.status.equals("MISSED", true) || call.direction.equals("MISSED", true) || call.durationSeconds <= 0
                "inbound" -> (call.direction.equals("INBOUND", true) ||
                    call.direction.equals("INCOMING", true) ||
                    call.direction.equals("RECEIVED", true)) &&
                    !call.status.equals("MISSED", true) &&
                    !call.direction.equals("MISSED", true) &&
                    call.durationSeconds > 0
                "outbound" -> (call.direction.equals("OUTBOUND", true) || call.direction.equals("DIALED", true)) &&
                    !call.status.equals("MISSED", true) &&
                    !call.direction.equals("MISSED", true) &&
                    call.durationSeconds > 0
                else -> true
            }
        }.sortedByDescending { it.endedAt?.takeIf(String::isNotBlank) ?: it.startedAt }
    }

    val activeCall = remember(filteredCalls, vm.playingCallId, selectedCallId) {
        filteredCalls.find { it.id == vm.playingCallId }
            ?: filteredCalls.find { it.id == selectedCallId }
            ?: filteredCalls.find { it.recordingStatus == "UPLOADED" }
            ?: filteredCalls.firstOrNull()
    }
    val isPlaying = vm.isPlaybackPlaying && vm.playingCallId == activeCall?.id
    val attachableCalls = remember(calls) {
        calls.filter { call ->
            call.status.equals("COMPLETED", ignoreCase = true) &&
                call.recordingStatus != "UPLOADED"
        // A contact can have several call attempts in the bootstrap payload.
        // Show one representative target per contact so recovery stays compact;
        // the newest call is first in the API response and is the safest match
        // for a recording just shared from Phone.
        }.distinctBy { call ->
            listOf(
                call.assignment?.customerName.orEmpty().trim().lowercase(),
                call.phoneNumber.trim(),
            ).joinToString("|")
        }.take(8)
    }

    // Keep the Calls surface available when a dialer share was imported but
    // there is no call in the currently selected tab yet. The recovery card
    // is the only user-facing path for a share that missed auto-association.
    if (calls.isEmpty() && vm.bootstrap != null && vm.pendingSharedRecording == null) {
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
            calls = filteredCalls,
            activeCall = activeCall,
            isPlaying = isPlaying,
            playbackPositionSeconds = vm.playbackPositionSeconds,
            selectedCallTab = selectedCallTab,
            selectedScopeTab = selectedScopeTab,
            selectedNavTab = "calls",
            currentDeviceId = vm.currentDeviceId,
            currentDeviceModel = vm.currentDeviceModel,
            onScopeTabSelect = { selectedScopeTab = it },
            onNotificationClick = onOpenNotifications,
            onPlayPauseToggle = {
                activeCall?.id?.let { callId -> vm.playRecording(callId) }
            },
            onSkipBackward = { vm.seekRecordingBy(-15) },
            onSkipForward = { vm.seekRecordingBy(15) },
            onSeek = vm::seekRecordingTo,
            onCallTabSelect = { selectedCallTab = it },
            pendingSharedRecording = vm.pendingSharedRecording,
            attachableCalls = attachableCalls,
            isAttachingSharedRecording = vm.busy,
            onAttachSharedRecording = vm::attachSharedRecording,
            onDiscardSharedRecording = vm::discardSharedRecording,
            onCallClick = { call ->
                selectedCallId = call.id
                if (call.recordingStatus == "UPLOADED") {
                    vm.playRecording(call.id)
                } else if (call.recordingStatus == "FAILED" || call.recordingStatus == "LOCAL_PENDING" || call.recordingStatus == "PENDING") {
                    vm.retryRecordingUpload(call.id)
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
    val themeMode = LocalThemeMode.current

    val userName = session?.displayName ?: agent?.displayName ?: "Sales Closer"
    val userRole = if (agent?.canClaimLeads == true) "Certified Closer" else "Sales closer"

    ReferenceMoreDrawer(
        userName = userName,
        userRole = userRole,
        currentTheme = themeMode.name.lowercase().replaceFirstChar { it.uppercase() },
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
    val availableCount = maxOf(
        vm.bootstrap?.availableLeadCount ?: 0,
        vm.bootstrap?.availableLeads?.size ?: 0,
    )
    val pack = vm.selectedPack
    val previewLead = pack?.leads?.firstOrNull() ?: vm.bootstrap?.availableLeads?.firstOrNull()
    val canClaimLeads = vm.bootstrap?.agent?.canClaimLeads == true
    val hasPendingNotes = (vm.bootstrap?.pendingNotes ?: 0) > 0

    if (vm.bootstrap == null) {
        ReferenceGrabLeadsLoadingState(
            onBackClick = onBackClick,
            modifier = modifier,
        )
    } else if (availableCount == 0 && pack == null) {
        ReferenceGrabLeadsEmptyState(
            onBackClick = onBackClick,
            onRefreshClick = { vm.refreshAll() },
            modifier = modifier
        )
    } else {
        ReferenceGrabLeadsScreen(
            availableCount = availableCount,
            previewLead = previewLead,
            canClaimLeads = canClaimLeads,
            hasPendingNotes = hasPendingNotes,
            isBusy = vm.busy,
            errorMessage = vm.error,
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
    var showFollowUpDialog by rememberSaveable(leadId) { mutableStateOf(false) }

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
            onNextActionClick = { showFollowUpDialog = true },
            // Stage chips persist changes as they are selected. Keep the
            // sticky action useful by explicitly re-saving the current stage
            // and refreshing the lead list instead of leaving it inert.
            onUpdateLeadClick = { selectedStage ->
                vm.updateLeadStage(lead.id, selectedStage.ifBlank { lead.stage.ifBlank { "NEW" } })
            },
            modifier = modifier
        )

        if (showFollowUpDialog) {
            FollowUpPickerDialog(
                onDismiss = { showFollowUpDialog = false },
                onPicked = { iso, _ ->
                    showFollowUpDialog = false
                    vm.createFollowUpTask(
                        leadId = lead.id,
                        title = "Follow up with ${lead.customerName}",
                        dueAt = iso,
                        priority = lead.priority.ifBlank { "NORMAL" },
                        description = "Scheduled from lead details",
                    )
                },
            )
        }
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
    var followUpIso by rememberSaveable(callId) { mutableStateOf<String?>(null) }
    var followUpDisplay by rememberSaveable(callId) { mutableStateOf("") }
    var showFollowUpDialog by rememberSaveable(callId) { mutableStateOf(false) }

    val audioPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            vm.attachAudioUri(callId, it)
        }
    }

    LaunchedEffect(call?.assignment?.followUpAt) {
        if (followUpDisplay.isBlank()) {
            followUpDisplay = call?.assignment?.followUpAt.orEmpty()
        }
    }

    if (vm.bootstrap == null) {
        ReferenceCompleteCallLoadingState(
            onBackClick = onBackClick,
            modifier = modifier,
        )
    } else if (call == null || callId.isBlank()) {
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
        val contactName = call.assignment?.customerName ?: call.phoneNumber
        val durationSeconds = call.durationSeconds
        val min = durationSeconds / 60
        val sec = durationSeconds % 60
        val callTypeAndDuration = "Outgoing • %02d:%02d".format(min, sec)
        val initialOutcome = call.outcome?.ifBlank { "Connected" } ?: "Connected"
        val initialNotes = call.note.orEmpty()

        ReferenceCompleteCallScreen(
            contactName = contactName,
            callTypeAndDuration = callTypeAndDuration,
            initialOutcome = initialOutcome,
            initialFollowUpText = followUpDisplay,
            initialNotes = initialNotes,
            recordingStatus = call.recordingStatus,
            recordingDurationSeconds = durationSeconds,
            onBackClick = onBackClick,
            onSelectFollowUpTime = {
                showFollowUpDialog = true
            },
            onAttachAudioClick = {
                audioPickerLauncher.launch("audio/*")
            },
            onRetryRecordingClick = {
                vm.retryRecordingUpload(callId)
            },
            onSaveOutcome = { outcome, notes, followUpText, moveToFollowUp ->
                val stageUpdate = if (moveToFollowUp) "FOLLOW_UP" else (call.assignment?.stage ?: "CONTACTED")
                val followUpToSend = followUpIso ?: followUpText.ifBlank { null }
                vm.saveDisposition(
                    callId = callId,
                    customerName = contactName,
                    outcome = outcome,
                    note = notes,
                    followUp = followUpToSend,
                    stageUpdate = stageUpdate,
                    done = onSaved
                )
            },
            modifier = modifier
        )
        if (showFollowUpDialog) {
            FollowUpPickerDialog(
                onDismiss = { showFollowUpDialog = false },
                onPicked = { iso, display ->
                    followUpIso = iso
                    followUpDisplay = display
                    showFollowUpDialog = false
                },
            )
        }
    }
}
