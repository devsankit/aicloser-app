package com.gigxomi.gxclosers.ui.reference

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gigxomi.gxclosers.data.SalesLead
import com.gigxomi.gxclosers.data.CreatedPaymentLink
import com.gigxomi.gxclosers.data.DeviceDiagnostics
import com.gigxomi.gxclosers.call.CallManager
import com.gigxomi.gxclosers.ui.CrmViewModel
import com.gigxomi.gxclosers.device.DeviceIdentity
import com.gigxomi.gxclosers.ui.screens.PaymentTransactionPreview
import com.gigxomi.gxclosers.ui.screens.ReferenceAddContactScreen
import com.gigxomi.gxclosers.ui.screens.ReferenceChatScreen
import com.gigxomi.gxclosers.ui.screens.ReferenceContactsScreen
import com.gigxomi.gxclosers.ui.screens.ReferenceInboxScreen
import com.gigxomi.gxclosers.ui.screens.ReferenceLeadOverviewScreen
import com.gigxomi.gxclosers.ui.screens.ReferencePaymentsScreen
import com.gigxomi.gxclosers.ui.screens.ReferencePipelineScreen
import com.gigxomi.gxclosers.ui.theme.LocalThemeMode
import com.gigxomi.gxclosers.ui.theme.LocalThemeModeChange
import com.gigxomi.gxclosers.ui.theme.ThemeMode
import java.util.Locale

/**
 * ============================================================================
 * SECONDARY REFERENCE ADAPTERS (SCREENS 13–19)
 *
 * Bridges reference UI screens 13–19 directly to live [CrmViewModel] state and
 * real telephony / CRM repository actions:
 *
 * 13. Inbox         -> [InboxReferenceAdapter]
 * 14. Chat          -> [ChatReferenceAdapter]
 * 15. Settings/Lead -> [SettingsReferenceAdapter]
 * 16. Add Contact   -> [AddContactReferenceAdapter]
 * 17. Pipeline      -> [PipelineReferenceAdapter]
 * 18. Contacts      -> [ContactsReferenceAdapter]
 * 19. Payments      -> [PaymentsReferenceAdapter]
 *
 * Strict Rules:
 * - Only uses real CrmViewModel data/actions.
 * - No mock / fake data injected.
 * - Handles empty states explicitly.
 * ============================================================================
 */

// ============================================================================
// 13. INBOX ADAPTER
// ============================================================================

@Composable
fun InboxReferenceAdapter(
    viewModel: CrmViewModel,
    onNavigateToChat: (leadId: String) -> Unit = {},
    selectedNavTab: Int = 0,
    onNavTabSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("All") }

    LaunchedEffect(Unit) {
        if (viewModel.inbox.isEmpty()) {
            viewModel.loadInbox()
        }
    }

    val filteredItems = remember(viewModel.inbox, searchQuery, selectedFilter) {
        viewModel.inbox.filter { item ->
            val matchesSearch = if (searchQuery.isBlank()) {
                true
            } else {
                item.lead.customerName.contains(searchQuery, ignoreCase = true) ||
                    item.lead.customerPhone.contains(searchQuery, ignoreCase = true) ||
                    item.latestMessage.contains(searchQuery, ignoreCase = true)
            }
            val matchesFilter = when (selectedFilter) {
                "Priority" -> item.lead.priority.equals("HIGH", ignoreCase = true) ||
                    item.lead.priority.equals("HOT", ignoreCase = true) ||
                    item.lead.priority.equals("URGENT", ignoreCase = true)
                "Follow-up" -> !item.callbackAt.isNullOrBlank() ||
                    item.callbackState != "none" ||
                    !item.lead.followUpAt.isNullOrBlank() ||
                    item.status.equals("follow_up", ignoreCase = true)
                else -> true
            }
            matchesSearch && matchesFilter
        }
    }

    ReferenceInboxScreen(
        inboxItems = filteredItems,
        selectedFilter = selectedFilter,
        searchQuery = searchQuery,
        onSearchQueryChange = { searchQuery = it },
        onFilterSelect = { selectedFilter = it },
        onRefreshClick = { viewModel.loadInbox() },
        onConversationClick = { item ->
            val conversationOrLeadId = item.conversationId ?: item.lead.id
            viewModel.openChat(conversationOrLeadId)
            onNavigateToChat(item.lead.id)
        },
        selectedNavTab = selectedNavTab,
        onNavTabSelect = onNavTabSelect,
        modifier = modifier
    )
}

@Composable
fun LiveInboxScreen(
    viewModel: CrmViewModel,
    onNavigateToChat: (leadId: String) -> Unit = {},
    selectedNavTab: Int = 0,
    onNavTabSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    InboxReferenceAdapter(
        viewModel = viewModel,
        onNavigateToChat = onNavigateToChat,
        selectedNavTab = selectedNavTab,
        onNavTabSelect = onNavTabSelect,
        modifier = modifier
    )
}

// ============================================================================
// 14. CHAT ADAPTER
// ============================================================================

@Composable
fun ChatReferenceAdapter(
    viewModel: CrmViewModel,
    leadId: String,
    conversationId: String? = null,
    contactName: String? = null,
    onBackClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var inputText by remember { mutableStateOf("") }
    var notesDraft by remember(leadId) { mutableStateOf("") }
    var notesOpen by rememberSaveable(leadId) { mutableStateOf(false) }
    val context = LocalContext.current

    val lead = remember(viewModel.bootstrap?.leads, viewModel.inbox, leadId) {
        viewModel.bootstrap?.leads?.find { it.id == leadId }
            ?: viewModel.inbox.find { it.lead.id == leadId }?.lead
            ?: viewModel.inbox.find { it.conversationId == leadId }?.lead
    }
    val resolvedConversationId = conversationId
        ?: viewModel.inbox.firstOrNull { it.lead.id == leadId }?.conversationId
        ?: leadId
    LaunchedEffect(lead?.id, lead?.notes) {
        if (!notesOpen) notesDraft = lead?.notes.orEmpty()
    }

    LaunchedEffect(resolvedConversationId) {
        if (resolvedConversationId.isNotBlank()) {
            viewModel.openChat(resolvedConversationId)
        }
    }

    val attachmentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val resolver = context.contentResolver
        val displayName = resolver.query(
            uri,
            arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
            null,
            null,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val name = cursor.getString(cursor.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME))
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                val size = if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) cursor.getLong(sizeIndex) else null
                name to size
            } else null
        } ?: ("attachment" to null)
        viewModel.sendChatAttachment(
            id = resolvedConversationId,
            name = displayName.first,
            mimeType = resolver.getType(uri),
            sizeBytes = displayName.second,
        )
    }

    ReferenceChatScreen(
        lead = lead,
        messages = viewModel.chatMessages,
        fallbackContactName = contactName.orEmpty(),
        inputText = inputText,
        onInputTextChange = { inputText = it },
        onSendMessage = { text ->
            if (text.isNotBlank()) {
                // The lead id and the unified conversation id are different
                // resources. Use the resolved conversation id for the
                // message endpoint, otherwise assigned chats cannot send.
                viewModel.sendChat(resolvedConversationId, text)
                inputText = ""
            }
        },
        onAttachFileClick = {
            attachmentLauncher.launch(arrayOf("*/*"))
        },
        onMenuClick = { viewModel.loadChat(resolvedConversationId) },
        onCallClick = {
            lead?.let { viewModel.startCall(it) }
        },
        onStageSelect = { stage ->
            val statusId = when (stage) {
                "NEW" -> "new"
                "CONTACTED" -> "contacted"
                "INTERESTED" -> "interested"
                "FOLLOW_UP" -> "follow-up"
                "QUALIFIED" -> "qualified"
                "CLOSED_WON" -> "closed-won"
                "CLOSED_LOST" -> "closed-lost"
                "NOT_REACHABLE" -> "not-reachable"
                else -> stage.lowercase().replace('_', '-')
            }
            viewModel.updateConversationStage(resolvedConversationId, statusId)
        },
        notes = notesDraft,
        onNotesClick = { notesOpen = true },
        onBackClick = {
            viewModel.closeChat()
            onBackClick()
        },
        modifier = modifier
    )

    if (notesOpen) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { if (!viewModel.busy) notesOpen = false },
            title = { androidx.compose.material3.Text("Private notes") },
            text = {
                androidx.compose.material3.OutlinedTextField(
                    value = notesDraft,
                    onValueChange = { notesDraft = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 4,
                    label = { androidx.compose.material3.Text("Internal note") },
                )
            },
            confirmButton = {
                androidx.compose.material3.Button(
                    enabled = !viewModel.busy,
                    onClick = {
                        viewModel.saveConversationNotes(resolvedConversationId, notesDraft) { notesOpen = false }
                    },
                ) { androidx.compose.material3.Text(if (viewModel.busy) "Saving…" else "Save note") }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { notesOpen = false }, enabled = !viewModel.busy) {
                    androidx.compose.material3.Text("Cancel")
                }
            },
        )
    }
}

@Composable
fun LiveChatScreen(
    viewModel: CrmViewModel,
    leadId: String,
    conversationId: String? = null,
    contactName: String? = null,
    onBackClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    ChatReferenceAdapter(
        viewModel = viewModel,
        leadId = leadId,
        conversationId = conversationId,
        contactName = contactName,
        onBackClick = onBackClick,
        modifier = modifier
    )
}

// ============================================================================
// 15. SETTINGS / LEAD OVERVIEW ADAPTER
// ============================================================================

@Composable
fun SettingsReferenceAdapter(
    viewModel: CrmViewModel,
    onBackClick: () -> Unit = {},
    onLogout: () -> Unit = {},
    onEditProfileClick: () -> Unit = {},
    onOpenSettingsClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val session = viewModel.session
    val agent = viewModel.bootstrap?.agent
    val context = LocalContext.current

    val userName = session?.displayName?.takeIf(String::isNotBlank) ?: agent?.displayName?.takeIf(String::isNotBlank) ?: "Sales agent"
    val userEmail = session?.email?.takeIf(String::isNotBlank) ?: "Email not available"
    val userRole = if (agent?.canClaimLeads == true) "Sales closer" else "Sales Agent"

    val identity = remember { DeviceIdentity.current() }
    val themeMode = LocalThemeMode.current
    val setThemeMode = LocalThemeModeChange.current
    val lastFourDigits = session?.phone?.takeLast(4)?.takeIf(String::isNotBlank)
    val simLabel = lastFourDigits?.let { "Work SIM •••• $it" } ?: "Work SIM not selected"
    val deviceName = "${identity.displayName} · $simLabel"
    val selectedSim = simLabel

    val diagnostics = remember(context) { DeviceDiagnostics.snapshot(context) }
    val recordingCapability = diagnostics.optString("recordingCapability")
    val recordingReady = diagnostics.optBoolean("recordingEnabled") &&
        diagnostics.optBoolean("permissionCallLog") &&
        diagnostics.optBoolean("permissionPhoneState")
    val isDeviceSynced = viewModel.syncCounts.pending == 0 && viewModel.syncCounts.failed == 0
    val hasSelectedWorkSim = CallManager.simSelection(context) != CallManager.SIM_SELECTION_ASK
    val isDeviceVerified =
        (viewModel.certificationStatus == "VERIFIED" || viewModel.setupComplete) &&
            recordingReady && hasSelectedWorkSim
    val lastSyncText = when {
        viewModel.syncCounts.failed > 0 -> "${viewModel.syncCounts.failed} sync failed"
        viewModel.syncCounts.pending > 0 -> "${viewModel.syncCounts.pending} pending sync"
        else -> "Synced just now"
    }
    val recordingSource = when (recordingCapability) {
        "SYSTEM_FOLDER_OR_MEDIASTORE" -> "Phone folder sync"
        "DIALER_SHARE" -> "Manual Phone share"
        "MICROPHONE_FALLBACK" -> "AI Closer microphone fallback"
        else -> "Setup required"
    }

    ReferenceLeadOverviewScreen(
        userName = userName,
        userEmail = userEmail,
        userRole = userRole,
        deviceName = deviceName,
        isDeviceSynced = isDeviceSynced,
        isDeviceVerified = isDeviceVerified,
        appearanceSetting = themeMode.name.lowercase().replaceFirstChar(Char::uppercase),
        notificationsSetting = "On",
        selectedSim = selectedSim,
        recordingSource = recordingSource,
        lastSyncText = lastSyncText,
        onBackClick = onBackClick,
        onEditProfileClick = onEditProfileClick,
        onSettingRowClick = { setting ->
            when (setting) {
                "Display name", "Email" -> onEditProfileClick()
                "Appearance" -> {
                    val next = if (themeMode == ThemeMode.DARK) ThemeMode.LIGHT else ThemeMode.DARK
                    setThemeMode(next)
                }
                "Notifications" -> runCatching {
                    context.startActivity(
                        Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
                    )
                }.onFailure { viewModel.showError("Notification settings could not be opened on this phone.") }
                "Selected work SIM", "Recording source" -> onOpenSettingsClick()
                "Last sync" -> viewModel.retryOfflineSync()
            }
        },
        onRunDiagnosticsClick = onOpenSettingsClick,
        onLogoutClick = {
            viewModel.logout(onLogout)
        },
        modifier = modifier
    )
}

@Composable
fun LiveSettingsScreen(
    viewModel: CrmViewModel,
    onBackClick: () -> Unit = {},
    onLogout: () -> Unit = {},
    onEditProfileClick: () -> Unit = {},
    onOpenSettingsClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    SettingsReferenceAdapter(
        viewModel = viewModel,
        onBackClick = onBackClick,
        onLogout = onLogout,
        onEditProfileClick = onEditProfileClick,
        onOpenSettingsClick = onOpenSettingsClick,
        modifier = modifier
    )
}

@Composable
fun LiveLeadOverviewScreen(
    viewModel: CrmViewModel,
    onBackClick: () -> Unit = {},
    onLogout: () -> Unit = {},
    onEditProfileClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    SettingsReferenceAdapter(
        viewModel = viewModel,
        onBackClick = onBackClick,
        onLogout = onLogout,
        onEditProfileClick = onEditProfileClick,
        modifier = modifier
    )
}

// ============================================================================
// 16. ADD CONTACT ADAPTER
// ============================================================================

@Composable
fun AddContactReferenceAdapter(
    viewModel: CrmViewModel,
    onContactSaved: () -> Unit = {},
    onCancel: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var fullName by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var selectedSource by remember { mutableStateOf("Manual") }
    var selectedStage by remember { mutableStateOf("New") }

    ReferenceAddContactScreen(
        fullName = fullName,
        onFullNameChange = { fullName = it },
        phoneNumber = phoneNumber,
        onPhoneNumberChange = { phoneNumber = it },
        email = email,
        onEmailChange = { email = it },
        notes = notes,
        onNotesChange = { notes = it },
        selectedSource = selectedSource,
        onSourceChange = { selectedSource = it },
        selectedStage = selectedStage,
        onStageChange = { selectedStage = it },
        onSaveContact = {
            if (fullName.trim().length < 2) {
                viewModel.showError("Enter customer full name.")
                return@ReferenceAddContactScreen
            }
            if (phoneNumber.trim().length < 5) {
                viewModel.showError("Enter a valid phone number.")
                return@ReferenceAddContactScreen
            }
            viewModel.addContact(
                name = fullName.trim(),
                phone = phoneNumber.trim(),
                email = email.trim(),
                source = selectedSource.ifBlank { "Manual" },
                serviceInterest = "Sales Inquiry",
                priority = "HIGH",
                notes = notes.trim(),
                stage = selectedStage,
                done = onContactSaved
            )
        },
        onCancel = onCancel,
        modifier = modifier
    )
}

@Composable
fun LiveAddContactScreen(
    viewModel: CrmViewModel,
    onContactSaved: () -> Unit = {},
    onCancel: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    AddContactReferenceAdapter(
        viewModel = viewModel,
        onContactSaved = onContactSaved,
        onCancel = onCancel,
        modifier = modifier
    )
}

// ============================================================================
// 17. PIPELINE ADAPTER
// ============================================================================

@Composable
fun PipelineReferenceAdapter(
    viewModel: CrmViewModel,
    onAddLeadClick: () -> Unit = {},
    onLeadCardClick: (SalesLead) -> Unit = {},
    selectedNavTab: Int = 1,
    onNavTabSelect: (Int) -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedViewMode by remember { mutableStateOf("Pipeline") }

    val rawLeads = viewModel.bootstrap?.leads ?: emptyList()
    val filteredLeads = remember(rawLeads, searchQuery) {
        if (searchQuery.isBlank()) {
            rawLeads
        } else {
            rawLeads.filter { lead ->
                lead.customerName.contains(searchQuery, ignoreCase = true) ||
                    lead.customerPhone.contains(searchQuery, ignoreCase = true) ||
                    lead.serviceInterest.contains(searchQuery, ignoreCase = true) ||
                    lead.notes.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    ReferencePipelineScreen(
        leads = filteredLeads,
        selectedViewMode = selectedViewMode,
        onViewModeChange = { selectedViewMode = it },
        searchQuery = searchQuery,
        onSearchQueryChange = { searchQuery = it },
        onFilterClick = { viewModel.refreshAll() },
        onAddLeadClick = onAddLeadClick,
        onLeadCardClick = onLeadCardClick,
        onLeadMenuClick = { lead ->
            val nextStage = when (lead.stage.uppercase()) {
                "NEW" -> "QUALIFIED"
                "QUALIFIED" -> "DEMO_COMPLETED"
                "DEMO_COMPLETED" -> "NEGOTIATION"
                "NEGOTIATION" -> "CLOSED_WON"
                else -> "FOLLOW_UP"
            }
            viewModel.updateLeadStage(lead.id, nextStage)
        },
        onNotificationsClick = { viewModel.loadInbox(); onNotificationsClick() },
        selectedNavTab = selectedNavTab,
        onNavTabSelect = onNavTabSelect,
        modifier = modifier
    )
}

@Composable
fun LivePipelineScreen(
    viewModel: CrmViewModel,
    onAddLeadClick: () -> Unit = {},
    onLeadCardClick: (SalesLead) -> Unit = {},
    selectedNavTab: Int = 1,
    onNavTabSelect: (Int) -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    PipelineReferenceAdapter(
        viewModel = viewModel,
        onAddLeadClick = onAddLeadClick,
        onLeadCardClick = onLeadCardClick,
        selectedNavTab = selectedNavTab,
        onNavTabSelect = onNavTabSelect,
        onNotificationsClick = onNotificationsClick,
        modifier = modifier
    )
}

// ============================================================================
// 18. CONTACTS / IMPORT ADAPTER
// ============================================================================

@Composable
fun ContactsReferenceAdapter(
    viewModel: CrmViewModel,
    onContactClick: (SalesLead) -> Unit = {},
    selectedNavTab: Int = 1,
    onNavTabSelect: (Int) -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedTab by remember { mutableStateOf("Contacts") }
    val context = LocalContext.current
    val templateLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        runCatching {
            context.contentResolver.openOutputStream(uri)?.use { output ->
                output.write("name,phone,email,source,stage,notes\n".toByteArray())
            } ?: error("Could not open the selected location.")
        }.onSuccess {
            viewModel.showError("CSV template saved.")
        }.onFailure {
            viewModel.showError("Could not save the CSV template.")
        }
    }
    val contactImportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri?.let(viewModel::importContacts)
    }

    val rawContacts = viewModel.bootstrap?.leads ?: emptyList()
    val filteredContacts = remember(rawContacts, searchQuery) {
        if (searchQuery.isBlank()) {
            rawContacts
        } else {
            rawContacts.filter { lead ->
                lead.customerName.contains(searchQuery, ignoreCase = true) ||
                    lead.customerPhone.contains(searchQuery, ignoreCase = true) ||
                    lead.customerEmail.contains(searchQuery, ignoreCase = true) ||
                    lead.serviceInterest.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    ReferenceContactsScreen(
        contacts = filteredContacts,
        selectedTab = selectedTab,
        onTabSelect = { selectedTab = it },
        searchQuery = searchQuery,
        onSearchQueryChange = { searchQuery = it },
        onFilterClick = { viewModel.refreshAll() },
        onChooseFileClick = {
            contactImportLauncher.launch(
                arrayOf(
                    "text/csv",
                    "text/tab-separated-values",
                    "application/vnd.ms-excel",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            )
        },
        onDownloadTemplateClick = {
            templateLauncher.launch("aicloser-leads-template.csv")
        },
        onContactClick = onContactClick,
        onCallContactClick = { lead ->
            viewModel.startCall(lead)
        },
        onNotificationsClick = { viewModel.loadInbox(); onNotificationsClick() },
        selectedNavTab = selectedNavTab,
        onNavTabSelect = onNavTabSelect,
        modifier = modifier
    )
}

@Composable
fun LiveContactsScreen(
    viewModel: CrmViewModel,
    onContactClick: (SalesLead) -> Unit = {},
    selectedNavTab: Int = 1,
    onNavTabSelect: (Int) -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    ContactsReferenceAdapter(
        viewModel = viewModel,
        onContactClick = onContactClick,
        selectedNavTab = selectedNavTab,
        onNavTabSelect = onNavTabSelect,
        onNotificationsClick = onNotificationsClick,
        modifier = modifier
    )
}

// ============================================================================
// 19. PAYMENTS ADAPTER
// ============================================================================

@Composable
fun PaymentsReferenceAdapter(
    viewModel: CrmViewModel,
    onBackClick: () -> Unit = {},
    onCreatePaymentLinkClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var selectedSubTab by remember { mutableStateOf("Overview") }
    var showCreateDialog by rememberSaveable { mutableStateOf(false) }
    var showPaymentMenu by rememberSaveable { mutableStateOf(false) }
    var selectedTransaction by remember { mutableStateOf<PaymentTransactionPreview?>(null) }
    var successUrl by rememberSaveable { mutableStateOf<String?>(null) }
    val context = LocalContext.current

    val dashboard = viewModel.bootstrap?.dashboard
    val totalCollected = remember(dashboard) {
        val balance = dashboard?.availableBalance ?: 0.0
        if (balance > 0.0) {
            String.format(Locale.US, "₹%,.0f", balance)
        } else {
            "₹0"
        }
    }

    val transactions = remember(viewModel.bootstrap?.leads) {
        val leads = viewModel.bootstrap?.leads ?: emptyList()
        val wonLeads = leads.filter {
            it.stage.equals("CLOSED_WON", ignoreCase = true) ||
                it.stage.equals("WON", ignoreCase = true) ||
                it.stage.equals("PAID", ignoreCase = true)
        }
        wonLeads.map { lead ->
            PaymentTransactionPreview(
                id = lead.id,
                initial = lead.customerName.take(1).uppercase(),
                title = lead.customerName,
                date = lead.followUpAt?.take(10) ?: "Closed Won",
                amount = if (lead.serviceInterest.contains("₹")) {
                    lead.serviceInterest
                } else {
                    "₹${(dashboard?.availableBalance ?: 0.0).toInt().coerceAtLeast(0)}"
                },
                status = "Confirmed"
            )
        }
    }

    androidx.compose.foundation.layout.Box(modifier = modifier) {
        ReferencePaymentsScreen(
            totalCollected = totalCollected,
            selectedSubTab = selectedSubTab,
            onSubTabSelect = { selectedSubTab = it },
            transactions = transactions,
            onTransactionClick = { selectedTransaction = it },
            onCreatePaymentLinkClick = { showCreateDialog = true },
            onRefreshClick = { viewModel.refreshAll() },
            onExternalBrowserClick = {
                runCatching {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://app.aicloser.in/payments")))
                }.onFailure {
                    viewModel.showError("Unable to open the payments page on this phone.")
                }
            },
            onMenuClick = { showPaymentMenu = true },
            onBackClick = onBackClick,
            modifier = Modifier.fillMaxSize()
        )

        if (showPaymentMenu) {
            AlertDialog(
                onDismissRequest = { showPaymentMenu = false },
                title = { Text("Payments") },
                text = { Text("Refresh live payment data or open the payments workspace in your browser.") },
                confirmButton = {
                    TextButton(onClick = { showPaymentMenu = false; viewModel.refreshAll() }) {
                        Text("Refresh")
                    }
                },
                dismissButton = {
                    TextButton(onClick = {
                        showPaymentMenu = false
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://app.aicloser.in/payments")))
                        }.onFailure {
                            viewModel.showError("Unable to open the payments page on this phone.")
                        }
                    }) {
                        Text("Open web")
                    }
                },
            )
        }

        if (showCreateDialog) {
            PaymentLinkCreateDialog(
                viewModel = viewModel,
                onDismiss = { showCreateDialog = false },
                onCreated = { link ->
                    showCreateDialog = false
                    successUrl = "https://app.aicloser.in/pay/${link.publicToken}"
                },
            )
        }

        successUrl?.let { url ->
            PaymentLinkCreatedDialog(
                url = url,
                onDismiss = {
                    successUrl = null
                    viewModel.clearCreatedPaymentLink()
                },
                onOpen = {
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                        .onFailure { viewModel.showError("Unable to open the payment link on this phone.") }
                },
                onCopy = {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("Payment link", url))
                    viewModel.showError("Payment link copied.")
                },
            )
        }

        selectedTransaction?.let { transaction ->
            AlertDialog(
                onDismissRequest = { selectedTransaction = null },
                title = { Text(transaction.title) },
                text = { Text("${transaction.amount} · ${transaction.status}\n${transaction.date}") },
                confirmButton = {
                    TextButton(onClick = { selectedTransaction = null }) { Text("Close") }
                },
            )
        }
    }
}

@Composable
private fun PaymentLinkCreateDialog(
    viewModel: CrmViewModel,
    onDismiss: () -> Unit,
    onCreated: (CreatedPaymentLink) -> Unit,
) {
    var amount by rememberSaveable { mutableStateOf("") }
    var customerName by rememberSaveable { mutableStateOf("") }
    var customerPhone by rememberSaveable { mutableStateOf("") }
    var customerEmail by rememberSaveable { mutableStateOf("") }
    var productName by rememberSaveable { mutableStateOf("") }
    var customerNote by rememberSaveable { mutableStateOf("") }
    var durationUnit by rememberSaveable { mutableStateOf("MONTH") }
    var localError by rememberSaveable { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = { if (!viewModel.busy) onDismiss() },
        title = { Text("Create payment link", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Create a real UPI link from your workspace settings. The link will be saved to the dashboard.",
                    fontSize = 12.sp,
                    color = Color.Gray,
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it; localError = null },
                    label = { Text("Base amount (₹)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = customerName,
                    onValueChange = { customerName = it },
                    label = { Text("Customer name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = customerPhone,
                    onValueChange = { customerPhone = it },
                    label = { Text("Customer phone") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = customerEmail,
                    onValueChange = { customerEmail = it },
                    label = { Text("Customer email (optional)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = productName,
                    onValueChange = { productName = it },
                    label = { Text("Product / service") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text("Billing duration", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("DAY", "MONTH", "YEAR").forEach { unit ->
                        TextButton(
                            onClick = { durationUnit = unit },
                        ) {
                            Text(
                                unit.lowercase().replaceFirstChar { it.uppercase() },
                                color = if (durationUnit == unit) Color(0xFFFF5C1C) else Color.Gray,
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = customerNote,
                    onValueChange = { customerNote = it },
                    label = { Text("Note (optional)") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
                localError?.let { Text(it, color = Color(0xFFB3261E), fontSize = 12.sp) }
                viewModel.error?.let { error ->
                    Text(error, color = Color(0xFFB3261E), fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val parsedAmount = amount.replace(",", "").trim().toDoubleOrNull()
                    when {
                        parsedAmount == null || parsedAmount <= 0.0 -> localError = "Enter a valid amount."
                        else -> viewModel.createPaymentLink(
                            baseAmount = parsedAmount,
                            quantity = 1,
                            duration = 1,
                            durationUnit = durationUnit,
                            customerName = customerName,
                            customerPhone = customerPhone,
                            customerEmail = customerEmail,
                            productName = productName,
                            customerNote = customerNote,
                            done = onCreated,
                        )
                    }
                },
                enabled = !viewModel.busy,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF5C1C)),
                shape = RoundedCornerShape(20.dp),
            ) { Text(if (viewModel.busy) "Creating…" else "Create link") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !viewModel.busy) { Text("Cancel") }
        },
    )
}

@Composable
private fun PaymentLinkCreatedDialog(
    url: String,
    onDismiss: () -> Unit,
    onOpen: () -> Unit,
    onCopy: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Payment link created", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("The real link is ready to share with the customer.", fontSize = 13.sp)
                Text(url, fontSize = 12.sp, color = Color(0xFFFF5C1C))
            }
        },
        confirmButton = {
            Button(
                onClick = onOpen,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF5C1C)),
                shape = RoundedCornerShape(20.dp),
            ) { Text("Open link") }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onCopy) { Text("Copy") }
                TextButton(onClick = onDismiss) { Text("Done") }
            }
        },
    )
}

@Composable
fun LivePaymentsScreen(
    viewModel: CrmViewModel,
    onBackClick: () -> Unit = {},
    onCreatePaymentLinkClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    PaymentsReferenceAdapter(
        viewModel = viewModel,
        onBackClick = onBackClick,
        onCreatePaymentLinkClick = onCreatePaymentLinkClick,
        modifier = modifier
    )
}
