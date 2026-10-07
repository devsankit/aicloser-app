package com.gigxomi.gxclosers.ui

import android.annotation.SuppressLint
import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.app.role.RoleManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.gigxomi.gxclosers.data.*
import com.gigxomi.gxclosers.ui.theme.*
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

private const val LOGIN = "login"
private const val SETUP = "setup"
private const val MAIN = "main"

@Composable
fun GXClosersApp(initialLink: Uri?, vm: CrmViewModel = viewModel()) {
    val nav = rememberNavController()
    val snackbar = remember { SnackbarHostState() }
    val start = when { !vm.authenticated -> LOGIN; !vm.setupComplete -> SETUP; else -> MAIN }

    LaunchedEffect(vm.error, vm.status) {
        (vm.error ?: vm.status)?.let { snackbar.showSnackbar(it) }
        vm.clearMessage()
    }
    LaunchedEffect(vm.authenticated, vm.setupComplete) {
        val destination = when { !vm.authenticated -> LOGIN; !vm.setupComplete -> SETUP; else -> MAIN }
        nav.navigate(destination) { popUpTo(nav.graph.startDestinationId) { inclusive = true }; launchSingleTop = true }
    }
    LaunchedEffect(initialLink, vm.authenticated, vm.setupComplete) {
        if (vm.authenticated && vm.setupComplete && initialLink != null) {
            val id = initialLink.lastPathSegment.orEmpty()
            when (initialLink.host) { "lead" -> nav.navigate("lead/$id"); "disposition" -> nav.navigate("disposition/$id") }
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, containerColor = GxBackground) { padding ->
        NavHost(navController = nav, startDestination = start, modifier = Modifier.padding(padding)) {
            composable(LOGIN) { LoginScreen(vm) }
            composable(SETUP) { SetupScreen(vm) }
            composable(MAIN) { MainScreen(vm, nav) }
            composable("lead-grab") { LeadGrabScreen(vm) { nav.popBackStack() } }
            composable("lead/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                LeadDetailScreen(vm, entry.arguments?.getString("id").orEmpty()) { nav.popBackStack() }
            }
            composable("disposition/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                DispositionScreen(vm, entry.arguments?.getString("id").orEmpty()) { nav.navigate(MAIN) { popUpTo(MAIN) { inclusive = true } } }
            }
            composable("chat/{id}/{name}", arguments = listOf(navArgument("id") { type = NavType.StringType }, navArgument("name") { type = NavType.StringType })) { entry ->
                ChatScreen(vm, entry.arguments?.getString("id").orEmpty(), Uri.decode(entry.arguments?.getString("name").orEmpty())) { nav.popBackStack() }
            }
            composable("lesson/{courseId}/{lessonId}", arguments = listOf(navArgument("courseId") { type = NavType.StringType }, navArgument("lessonId") { type = NavType.StringType })) { entry ->
                LessonScreen(vm, entry.arguments?.getString("courseId").orEmpty(), entry.arguments?.getString("lessonId").orEmpty()) { nav.popBackStack() }
            }
            composable("edit-profile") { EditProfileScreen(vm) { nav.popBackStack() } }
        }
    }
}

@Composable private fun LoginScreen(vm: CrmViewModel) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Page(vertical = true) {
        Spacer(Modifier.height(44.dp)); BrandHeader("GXClosers", "Closers by Gigxomi · Native Android CRM")
        GxCard {
            Text("Sales login", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
            Text("Use your approved Gigxomi sales credentials.", color = GxMuted)
            OutlinedTextField(identifier, { identifier = it }, label = { Text("Email or phone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
            PrimaryButton("Login to GXClosers", vm.busy, enabled = identifier.isNotBlank() && password.isNotBlank()) { vm.login(identifier, password) {} }
        }
        Text("Connected securely to closers.gigxomi.com", color = GxMuted, fontSize = 12.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
    }
}

@Composable private fun SetupScreen(vm: CrmViewModel) {
    val context = LocalContext.current
    val roleManager = if (Build.VERSION.SDK_INT >= 29) context.getSystemService(RoleManager::class.java) else null
    val finishSetup = { vm.registerDevice {} }
    val roleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { finishSetup() }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        if (Build.VERSION.SDK_INT >= 29 && roleManager?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true && !roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) roleLauncher.launch(roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)) else finishSetup()
    }
    val permissions = buildList {
        add(Manifest.permission.CALL_PHONE); add(Manifest.permission.READ_PHONE_STATE); add(Manifest.permission.READ_PHONE_NUMBERS)
        add(Manifest.permission.RECORD_AUDIO); add(Manifest.permission.READ_CONTACTS)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
    }.toTypedArray()
    Page(vertical = true) {
        BrandHeader("Set up company phone", "Native Android call context and CRM sync")
        GxCard {
            FeatureRow(Icons.Default.Phone, "Tracked company calls", "Link outbound and assigned inbound calls to the correct lead.")
            FeatureRow(Icons.Default.Mic, "Local recording", "Capture supported calls through the phone microphone and upload securely.")
            FeatureRow(Icons.Default.Sync, "Offline continuity", "Queue call-end events and mandatory notes until the connection returns.")
            FeatureRow(Icons.Default.Notifications, "Lead context", "Show the assigned lead and post-call action without display-over-app access.")
            Text("Android and device manufacturers can restrict call audio. GXClosers reports recording failures instead of pretending audio was captured.", color = GxWarning, fontSize = 12.sp)
            PrimaryButton("Grant permissions and register", vm.busy) { permissionLauncher.launch(permissions) }
        }
    }
}

private data class Tab(val label: String, val icon: ImageVector)
private val tabs = listOf(Tab("Home", Icons.Default.Home), Tab("Leads", Icons.Default.Groups), Tab("Calls", Icons.Default.Phone), Tab("Inbox", Icons.Default.Chat), Tab("Profile", Icons.Default.Person))

@Composable private fun MainScreen(vm: CrmViewModel, nav: NavHostController) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { if (vm.inbox.isEmpty()) vm.loadInbox(); if (vm.courses.isEmpty()) vm.loadCourses() }
    LaunchedEffect(selected) { when { selected == 3 && vm.inbox.isEmpty() -> vm.loadInbox(); selected == 4 && vm.courses.isEmpty() -> vm.loadCourses() } }
    Scaffold(
        containerColor = GxBackground,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            GxBottomNav(selected = selected, onSelect = { selected = it })
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (selected) {
                0 -> DashboardScreen(vm, { nav.navigate("lead-grab") }, { selected = 2 }, { selected = 4 })
                1 -> LeadsScreen(vm, { nav.navigate("lead-grab") }) { nav.navigate("lead/${it.id}") }
                2 -> CallsScreen(vm) { nav.navigate("disposition/$it") }
                3 -> InboxScreen(vm) { item -> item.conversationId?.let { nav.navigate("chat/$it/${Uri.encode(item.lead.customerName)}") } }
                else -> MoreScreen(vm, edit = { nav.navigate("edit-profile") }) { course, lesson -> nav.navigate("lesson/${course.id}/${lesson.id}") }
            }
        }
    }
}

@Composable private fun GxBottomNav(selected: Int, onSelect: (Int) -> Unit) {
    Box(Modifier.fillMaxWidth().background(Color.Transparent).padding(top = 4.dp, bottom = 4.dp).navigationBarsPadding(), contentAlignment = Alignment.Center) {
        Surface(
            color = GxSurface.copy(alpha = .86f),
            shape = RoundedCornerShape(30.dp),
            border = BorderStroke(1.dp, GxMuted.copy(alpha = .16f)),
            shadowElevation = 7.dp,
            modifier = Modifier.fillMaxWidth(.78f).widthIn(min = 316.dp, max = 560.dp).heightIn(min = 62.dp),
        ) {
            Row(Modifier.padding(horizontal = 8.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                tabs.forEachIndexed { index, tab ->
                    val active = selected == index
                    val interactionSource = remember { MutableInteractionSource() }
                    Column(
                        modifier = Modifier.weight(1f).heightIn(min = 44.dp).clickable(interactionSource = interactionSource, indication = null) { onSelect(index) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Surface(color = if (active) GxAccent.copy(alpha = .18f) else Color.Transparent, shape = androidx.compose.foundation.shape.CircleShape, border = BorderStroke(1.dp, if (active) GxAccent.copy(alpha = .30f) else Color.Transparent)) {
                            Box(Modifier.size(30.dp), contentAlignment = Alignment.Center) {
                            Icon(tab.icon, tab.label, tint = if (active) GxAccent else GxMuted, modifier = Modifier.size(21.dp))
                            }
                        }
                        Spacer(Modifier.height(1.dp))
                        Text(tab.label, color = if (active) GxText else GxMuted, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable private fun DashboardScreen(vm: CrmViewModel, grab: () -> Unit, calls: () -> Unit, learning: () -> Unit) {
    val data = vm.bootstrap
    Page {
        BrandHeader("Good day${data?.agent?.displayName?.substringBefore(' ')?.let { ", $it" } ?: ""}", "Your live GXClosers command centre")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatusPill("CRM live", GxSuccess); StatusPill(if ((data?.deviceCount ?: 0) > 0) "Phone linked" else "Phone setup", if ((data?.deviceCount ?: 0) > 0) GxSuccess else GxWarning)
        }
        GxCard(accent = true) {
            Text("LIVE LEAD QUEUE", color = GxAccent, fontWeight = FontWeight.Black, fontSize = 11.sp)
            Text("${data?.availableLeadCount ?: 0}", fontSize = 48.sp, fontWeight = FontWeight.Black)
            Text("fresh opportunities ready to claim", color = GxMuted)
            val canGrab = data?.agent?.canClaimLeads == true && data.pendingNotes == 0
            Text(when { data?.agent?.canClaimLeads != true -> "Complete required training to unlock lead grabbing."; (data.pendingNotes) > 0 -> "Complete ${data.pendingNotes} call notes before claiming more."; else -> "Claim only the leads you can contact now." }, color = GxWarning)
            PrimaryButton("Grab new leads", false, canGrab && (data?.availableLeadCount ?: 0) > 0) { grab() }
            when {
                (data?.pendingNotes ?: 0) > 0 -> SecondaryButton("Complete call notes to unlock", false) { calls() }
                data?.agent?.canClaimLeads != true -> SecondaryButton("Complete learning to unlock", false) { learning() }
                (data.availableLeadCount) == 0 -> SecondaryButton("Refresh new-lead pool", vm.busy) { vm.refreshAll() }
            }
        }
        Text("Today at a glance", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Metric("${data?.dashboard?.activeLeads ?: 0}", "Active leads", Modifier.weight(1f)); Metric("${data?.calls?.size ?: 0}", "Calls logged", Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Metric("${data?.dashboard?.closedWon ?: 0}", "Closed won", Modifier.weight(1f)); Metric("${data?.pendingNotes ?: 0}", "Notes due", Modifier.weight(1f))
        }
        SecondaryButton("Refresh CRM", vm.busy) { vm.refreshAll() }
    }
}

@Composable private fun LeadsScreen(vm: CrmViewModel, grab: () -> Unit, open: (SalesLead) -> Unit) {
    var search by rememberSaveable { mutableStateOf("") }
    var stageFilter by rememberSaveable { mutableStateOf("ALL") }
    val leads = vm.bootstrap?.leads.orEmpty()
    val stages = remember(leads) { leads.map { it.stage }.filter(String::isNotBlank).distinct().sorted() }
    val filteredLeads = remember(leads, search, stageFilter) {
        val term = search.trim().lowercase()
        leads.filter { lead ->
            val matchesStage = stageFilter == "ALL" || lead.stage == stageFilter
            val matchesSearch = term.isBlank() || listOf(lead.customerName, lead.customerPhone, lead.customerEmail, lead.source, lead.serviceInterest, lead.stage).any { it.lowercase().contains(term) }
            matchesStage && matchesSearch
        }
    }
    Page {
        BrandHeader("My Leads", "Assigned opportunities and follow-ups")
        GxCard(accent = true) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = GxAccent.copy(alpha = .14f), shape = RoundedCornerShape(16.dp)) { Icon(Icons.Default.Bolt, null, tint = GxAccent, modifier = Modifier.padding(12.dp).size(23.dp)) }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) { Text("NEW LEAD POOL", color = GxAccent, fontSize = 10.sp, fontWeight = FontWeight.Black); Text("${vm.bootstrap?.availableLeadCount ?: 0} available", fontSize = 22.sp, fontWeight = FontWeight.Black); Text("Unassigned leads appear here first", color = GxMuted, fontSize = 11.sp) }
            }
            val canGrab = vm.bootstrap?.agent?.canClaimLeads == true && (vm.bootstrap?.pendingNotes ?: 0) == 0 && (vm.bootstrap?.availableLeadCount ?: 0) > 0
            PrimaryButton("Grab new leads", false, canGrab) { grab() }
            if (!canGrab) Text(when { (vm.bootstrap?.pendingNotes ?: 0) > 0 -> "Complete pending call notes before grabbing more."; vm.bootstrap?.agent?.canClaimLeads != true -> "Complete required lessons to unlock lead grabbing."; else -> "No unassigned leads right now. Refresh to check again." }, color = GxWarning, fontSize = 11.sp)
        }
        OutlinedTextField(value = search, onValueChange = { search = it }, leadingIcon = { Icon(Icons.Default.Search, null, tint = GxMuted) }, placeholder = { Text("Search name, phone, source or status") }, singleLine = true, shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth())
        Text("CRM STATUS", color = GxMuted, fontSize = 10.sp, fontWeight = FontWeight.Black)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            listOf("ALL") .plus(stages).forEach { value -> FilterChip(selected = stageFilter == value, onClick = { stageFilter = value }, label = { Text(if (value == "ALL") "All" else value.replace('_', ' '), fontSize = 10.sp) }) }
        }
        if (filteredLeads.isEmpty()) EmptyCard(if (leads.isEmpty()) "No leads assigned yet." else "No leads match this search and status.")
        filteredLeads.forEach { lead -> LeadCard(lead) { open(lead) } }
        TextButton(onClick = { vm.refreshAll() }, enabled = !vm.busy, modifier = Modifier.align(Alignment.CenterHorizontally)) { Icon(Icons.Default.Refresh, null, Modifier.size(17.dp)); Spacer(Modifier.width(7.dp)); Text(if (vm.busy) "Refreshing…" else "Refresh leads") }
    }
}

@Composable private fun CallsScreen(vm: CrmViewModel, disposition: (String) -> Unit) {
    val data = vm.bootstrap
    Page {
        BrandHeader("Calls & Recordings", "Outcomes, notes and secure audio sync")
        GxCard { Text(if ((data?.pendingUploads ?: 0) > 0) "${data?.pendingUploads} upload(s) waiting" else "Recording sync is healthy", fontWeight = FontWeight.Black); Text(if ((data?.pendingNotes ?: 0) > 0) "${data?.pendingNotes} mandatory disposition(s) due" else "All completed calls have notes.", color = GxMuted) }
        data?.calls.orEmpty().forEach { call ->
            GxCard {
                Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Phone, null, tint = GxAccent); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(call.assignment?.customerName ?: call.phoneNumber, fontWeight = FontWeight.Black); Text(formatDate(call.startedAt), color = GxMuted, fontSize = 11.sp) }; Text("${call.durationSeconds}s", color = GxMuted) }
                Text(call.recordingStatus.replace('_', ' '), color = if (call.recordingStatus == "UPLOADED") GxSuccess else GxWarning, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                call.recordingError?.let { Text(it, color = GxWarning, fontSize = 11.sp) }
                if (call.note.isNullOrBlank()) PrimaryButton("Complete required disposition", false) { disposition(call.id) } else { Text(call.outcome.orEmpty().replace('_', ' '), color = GxAccent, fontWeight = FontWeight.Bold); Text(call.note, color = GxMuted) }
            }
        }
        if (data?.calls.isNullOrEmpty()) EmptyCard("No sales calls logged yet. Open an assigned lead to start a tracked call.")
        SecondaryButton("Sync calls now", vm.busy) { vm.refreshAll() }
    }
}

@Composable private fun InboxScreen(vm: CrmViewModel, open: (InboxItem) -> Unit) {
    var search by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("ALL") }
    val filteredInbox = remember(vm.inbox, search, filter) {
        val term = search.trim().lowercase()
        vm.inbox.filter { item ->
            val matchesSearch = term.isBlank() || listOf(item.lead.customerName, item.lead.customerPhone, item.lead.serviceInterest, item.latestMessage, item.lead.stage).any { it.lowercase().contains(term) }
            val matchesFilter = when (filter) { "PRIORITY" -> item.lead.priority.equals("HIGH", true) || item.lead.priority.equals("URGENT", true); "FOLLOW_UP" -> item.lead.stage.contains("FOLLOW", true); else -> true }
            matchesSearch && matchesFilter
        }
    }
    Page {
        BrandHeader("Inbox", "Only conversations linked to your assigned leads")
        OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            leadingIcon = { Icon(Icons.Default.Search, null, tint = GxMuted) },
            placeholder = { Text("Search chats") },
            singleLine = true,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("ALL" to "All", "PRIORITY" to "Priority", "FOLLOW_UP" to "Follow-up").forEach { (value, title) ->
                FilterChip(selected = filter == value, onClick = { filter = value }, label = { Text(title) })
            }
        }
        Column(Modifier.fillMaxWidth()) {
            if (vm.inboxLoading && filteredInbox.isEmpty()) repeat(4) { index ->
                InboxLoadingRow()
                if (index < 3) HorizontalDivider(Modifier.padding(start = 62.dp), color = GxMuted.copy(alpha = .10f))
            }
            filteredInbox.forEachIndexed { index, item ->
                InboxConversationRow(item) { open(item) }
                if (index < filteredInbox.lastIndex) HorizontalDivider(Modifier.padding(start = 62.dp), color = GxMuted.copy(alpha = .14f))
            }
            if (!vm.inboxLoading && filteredInbox.isEmpty()) Text(vm.inboxMessage ?: if (search.isBlank() && filter == "ALL") "No assigned conversations yet." else "No chats match this search.", color = GxMuted, modifier = Modifier.padding(vertical = 28.dp).align(Alignment.CenterHorizontally))
        }
        TextButton(onClick = { vm.loadInbox() }, enabled = !vm.inboxLoading, modifier = Modifier.align(Alignment.CenterHorizontally)) { Icon(Icons.Default.Refresh, null, Modifier.size(17.dp)); Spacer(Modifier.width(7.dp)); Text(if (vm.inboxLoading) "Updating…" else "Refresh inbox") }
    }
}

@Composable private fun ProfileLearningContent(vm: CrmViewModel, open: (Course, Lesson) -> Unit) {
    if (vm.learningLoading && vm.courses.isEmpty()) GxCard(accent = true) { Row(verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp); Spacer(Modifier.width(10.dp)); Text("Loading sales lessons…", color = GxMuted) } }
    vm.courses.forEach { course ->
        GxCard {
            Row(verticalAlignment = Alignment.CenterVertically) { Text(course.title, fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.weight(1f)); if (course.lessons.any { it.youtubeVideoId in setOf("jNQXAC9IVRw", "aqz-KE-bpKQ") }) StatusPill("DEMO", GxWarning) }
            Text(course.description, color = GxMuted)
            LinearProgressIndicator(progress = { course.completionPercent / 100f }, modifier = Modifier.fillMaxWidth(), trackColor = GxMuted.copy(alpha = .14f))
            Text("${course.completionPercent}% complete", color = GxAccent, fontWeight = FontWeight.Bold)
            course.lessons.forEach { lesson ->
                Row(
                    Modifier.fillMaxWidth().clickable(enabled = !lesson.youtubeVideoId.isNullOrBlank()) { open(course, lesson) }.padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(if (lesson.progressPercent >= lesson.completionThreshold) Icons.Default.CheckCircle else Icons.Default.PlayCircle, null, tint = GxAccent)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(lesson.title, fontWeight = FontWeight.Bold)
                        Text("${lesson.progressPercent}% · ${if (lesson.isRequired) "Required" else "Optional"}${if (lesson.youtubeVideoId.isNullOrBlank()) " · Video pending" else " · Video"}", color = GxMuted, fontSize = 11.sp)
                    }
                    Icon(Icons.Default.ChevronRight, null, tint = if (lesson.youtubeVideoId.isNullOrBlank()) GxMuted.copy(alpha = .35f) else GxMuted)
                }
            }
        }
    }
    if (!vm.learningLoading && vm.courses.isEmpty()) EmptyCard(vm.learningMessage ?: "No CRM courses are published yet.")
    SecondaryButton("Refresh lessons", vm.learningLoading) { vm.loadCourses() }
}

// The bridge is a concrete TrainingBridge whose public method is annotated;
// lint loses that type through AndroidView's generic factory.
@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
@Composable private fun LessonScreen(vm: CrmViewModel, courseId: String, lessonId: String, back: () -> Unit) {
    val course = vm.courses.find { it.id == courseId }
    val lesson = course?.lessons?.find { it.id == lessonId }
    if (course == null || lesson == null) {
        Page { HeaderWithBack("Lesson unavailable", "Refresh Learning and try again.", back); EmptyCard("This lesson is not in the current catalog.") }
        return
    }
    var watched by remember(lesson.id) { mutableDoubleStateOf(lesson.watchedSeconds.toDouble()) }
    var position by remember(lesson.id) { mutableDoubleStateOf(lesson.lastPositionSeconds.toDouble()) }
    var duration by remember(lesson.id) { mutableDoubleStateOf(lesson.durationSeconds.toDouble()) }
    var percent by remember(lesson.id) { mutableIntStateOf(lesson.progressPercent) }
    var lastPosition by remember(lesson.id) { mutableDoubleStateOf(position) }
    var lastSaved by remember(lesson.id) { mutableDoubleStateOf(watched) }
    val handler = remember { Handler(Looper.getMainLooper()) }
    val bridge: TrainingBridge = remember(lesson.id) {
        TrainingBridge { raw ->
            handler.post {
                runCatching {
                    val event = JSONObject(raw)
                    val nextPosition = event.optDouble("position", position)
                    val nextDuration = event.optDouble("duration", duration)
                    val delta = nextPosition - lastPosition
                    if (event.optInt("state") == 1 && delta > 0 && delta < 3) watched += delta
                    position = nextPosition; duration = nextDuration; lastPosition = nextPosition
                    percent = if (duration > 0) ((watched / duration) * 100).toInt().coerceIn(0, 100) else 0
                    if (watched - lastSaved >= 10) {
                        lastSaved = watched
                        vm.saveLessonProgress(course.id, lesson.id, watched.toInt(), duration.toInt(), position.toInt(), false)
                    }
                }
            }
        }
    }
    val safeVideoId = lesson.youtubeVideoId.orEmpty().filter { it.isLetterOrDigit() || it == '-' || it == '_' }
    val html = remember(lesson.id) {
        """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000}</style></head><body><div id="player"></div><script src="https://www.youtube.com/iframe_api"></script><script>let player,timer;function send(){if(player&&player.getCurrentTime){GXClosers.onProgress(JSON.stringify({position:player.getCurrentTime(),duration:player.getDuration(),state:player.getPlayerState()}));}}function onYouTubeIframeAPIReady(){player=new YT.Player('player',{videoId:'$safeVideoId',playerVars:{playsinline:1,start:${lesson.lastPositionSeconds},rel:0},events:{onStateChange:function(e){send();clearInterval(timer);if(e.data===YT.PlayerState.PLAYING){timer=setInterval(send,1000);}}}});}</script></body></html>"""
    }
    Page {
        HeaderWithBack(lesson.title, course.title) {
            vm.saveLessonProgress(course.id, lesson.id, watched.toInt(), duration.toInt(), position.toInt(), false, back)
        }
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    webViewClient = WebViewClient()
                    addJavascriptInterface(bridge, "GXClosers")
                    loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "utf-8", null)
                }
            },
            modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f),
            onRelease = { it.removeJavascriptInterface("GXClosers"); it.destroy() },
        )
        GxCard {
            Text(lesson.description.ifBlank { "Watch the required portion, then confirm completion." }, color = GxMuted)
            LinearProgressIndicator(progress = { percent / 100f }, modifier = Modifier.fillMaxWidth())
            Text("$percent% watched · ${lesson.completionThreshold}% required", color = GxAccent, fontWeight = FontWeight.Bold)
            PrimaryButton(if (percent >= lesson.completionThreshold) "Mark complete" else "Watch to ${lesson.completionThreshold}%", false, percent >= lesson.completionThreshold) {
                vm.saveLessonProgress(course.id, lesson.id, watched.toInt(), duration.toInt(), position.toInt(), true, back)
            }
        }
    }
}

@Composable private fun MoreScreen(vm: CrmViewModel, edit: () -> Unit, openLesson: (Course, Lesson) -> Unit) {
    val session = vm.session
    val data = vm.bootstrap
    val agent = data?.agent
    var selectedSection by rememberSaveable { mutableIntStateOf(0) }
    val lessons = vm.courses.flatMap { it.lessons }
    val learningScore = if (vm.courses.isEmpty()) 0 else vm.courses.map { it.completionPercent }.average().toInt()
    val completedLessons = lessons.count { it.progressPercent >= it.completionThreshold }
    Page {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { BrandHeader("Profile", "Your sales workspace and academy") }
            FilledIconButton(onClick = edit, colors = IconButtonDefaults.filledIconButtonColors(containerColor = GxSurface2, contentColor = GxAccent)) { Icon(Icons.Default.Edit, "Edit profile") }
        }
        GxCard(accent = true) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.size(76.dp)) {
                    CircularProgressIndicator(progress = { learningScore / 100f }, modifier = Modifier.fillMaxSize(), strokeWidth = 5.dp, color = GxAccent, trackColor = GxMuted.copy(alpha = .16f))
                    Text(initials(session?.displayName ?: "Sales agent"), color = GxAccent, fontSize = 21.sp, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(session?.displayName ?: "Sales agent", fontWeight = FontWeight.Black, fontSize = 21.sp)
                    Text("Sales executive", color = GxMuted, fontSize = 13.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { StatusPill("ACTIVE", GxSuccess); if (agent?.canClaimLeads == true) StatusPill("LEADS UNLOCKED", GxAccent) }
                }
            }
            HorizontalDivider(color = GxMuted.copy(alpha = .15f))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.School, null, tint = GxAccent, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) { Text("Learning score", color = GxMuted, fontSize = 11.sp); Text("$learningScore%", color = GxAccent, fontSize = 20.sp, fontWeight = FontWeight.Black) }
                Text("$completedLessons/${lessons.size} lessons", color = GxMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
        Surface(color = GxSurface, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, GxMuted.copy(alpha = .14f)), modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(5.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                listOf("Overview", "Lessons").forEachIndexed { index, label ->
                    Surface(color = if (selectedSection == index) GxAccent.copy(alpha = .14f) else Color.Transparent, shape = RoundedCornerShape(14.dp), modifier = Modifier.weight(1f).clickable { selectedSection = index }) {
                        Row(Modifier.padding(vertical = 11.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                            Icon(if (index == 0) Icons.Default.Person else Icons.Default.School, null, tint = if (selectedSection == index) GxAccent else GxMuted, modifier = Modifier.size(17.dp)); Spacer(Modifier.width(7.dp)); Text(label, color = if (selectedSection == index) GxText else GxMuted, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
        if (selectedSection == 0) {
            GxCard {
                SectionHeading(Icons.Default.Badge, "Sales identity")
                CustomerFact(Icons.Default.AlternateEmail, "Email", session?.email ?: "Not added")
                CustomerFact(Icons.Default.Phone, "Phone", session?.phone?.ifBlank { "Not added" } ?: "Not added")
                CustomerFact(Icons.Default.Fingerprint, "Agent code", agent?.agentCode?.ifBlank { "Not assigned" } ?: "Not assigned")
                CustomerFact(Icons.Default.Groups, "Lead access", if (agent?.canClaimLeads == true) "Can claim fresh leads" else "Complete required learning to unlock")
            }
            Text("Performance", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Metric("${data?.dashboard?.activeLeads ?: 0}", "Active leads", Modifier.weight(1f))
                Metric("${data?.calls?.size ?: 0}", "Calls logged", Modifier.weight(1f))
                Metric("${data?.dashboard?.closedWon ?: 0}", "Closed won", Modifier.weight(1f))
            }
            GxCard {
                SectionHeading(Icons.Default.Smartphone, "App & device")
                CustomerFact(Icons.Default.PhoneAndroid, "Company phone", if ((data?.deviceCount ?: 0) > 0) "Connected to ${data?.deviceCount} registered device${if ((data?.deviceCount ?: 0) == 1) "" else "s"}" else "Device registration pending")
                CustomerFact(Icons.Default.CloudDone, "CRM connection", "closers.gigxomi.com")
                CustomerFact(Icons.Default.Security, "Account security", "Authenticated native Android session")
            }
            SecondaryButton("Refresh profile", vm.busy) { vm.refreshAll() }
            TextButton(onClick = { vm.logout {} }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Icon(Icons.Default.Logout, null, Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)); Text("Sign out", color = GxDanger, fontWeight = FontWeight.Bold) }
        } else {
            ProfileLearningContent(vm, openLesson)
        }
    }
}

@Composable private fun EditProfileScreen(vm: CrmViewModel, back: () -> Unit) {
    val session = vm.session
    var displayName by rememberSaveable(session?.userId) { mutableStateOf(session?.displayName.orEmpty()) }
    var email by rememberSaveable(session?.userId) { mutableStateOf(session?.email.orEmpty()) }
    Page {
        HeaderWithBack("Edit profile", "Update your GXClosers sales identity", back)
        GxCard(accent = true) {
            Surface(color = GxAccent.copy(alpha = .14f), shape = RoundedCornerShape(24.dp), modifier = Modifier.size(76.dp).align(Alignment.CenterHorizontally)) {
                Box(contentAlignment = Alignment.Center) { Text(initials(displayName.ifBlank { "Sales agent" }), color = GxAccent, fontSize = 23.sp, fontWeight = FontWeight.Black) }
            }
            OutlinedTextField(displayName, { displayName = it }, label = { Text("Full name") }, leadingIcon = { Icon(Icons.Default.Person, null) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(email, { email = it }, label = { Text("Work email") }, leadingIcon = { Icon(Icons.Default.AlternateEmail, null) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(session?.phone.orEmpty(), {}, label = { Text("Verified company phone") }, leadingIcon = { Icon(Icons.Default.Phone, null) }, readOnly = true, singleLine = true, modifier = Modifier.fillMaxWidth())
            Text("The verified company phone is protected because it is linked to calls, login and sales ownership. Ask Super Admin to change it.", color = GxMuted, fontSize = 11.sp, lineHeight = 16.sp)
            PrimaryButton("Save profile", vm.busy, displayName.trim().length >= 2) { vm.updateProfile(displayName, email, back) }
        }
    }
}

private data class LeadContextEvent(
    val dateLabel: String,
    val note: String,
    val reference: String,
    val timestamp: Long,
    val title: String,
)

private fun parseLeadContext(raw: String): List<LeadContextEvent> {
    if (raw.isBlank()) return emptyList()
    val datePattern = Regex("Registered:?\\s+(\\d{4}-\\d{2}-\\d{2})(?:\\s+(\\d{2}:\\d{2}:\\d{2}))?\\.?", RegexOption.IGNORE_CASE)
    val headingPattern = Regex("^\\[([^]]+)]\\s*")
    return raw.trim().split(Regex("\\n\\s*\\n+")).mapIndexedNotNull { index, block ->
        val cleanBlock = block.trim()
        if (cleanBlock.isBlank()) return@mapIndexedNotNull null
        val heading = headingPattern.find(cleanBlock)?.groupValues?.getOrNull(1).orEmpty()
        val title = heading.substringBefore(':').trim().ifBlank { "Lead activity" }
        val reference = heading.substringAfter(':', "").trim()
        val withoutHeading = headingPattern.replaceFirst(cleanBlock, "")
        val dateMatch = datePattern.find(withoutHeading)
        val date = dateMatch?.groupValues?.getOrNull(1).orEmpty()
        val time = dateMatch?.groupValues?.getOrNull(2).orEmpty()
        val instant = runCatching {
            if (time.isNotBlank()) LocalDateTime.parse("$date $time", DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")).atZone(ZoneId.systemDefault()).toInstant()
            else LocalDate.parse(date, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay(ZoneId.systemDefault()).toInstant()
        }.getOrNull()
        val dateLabel = when {
            instant != null && time.isNotBlank() -> DateTimeFormatter.ofPattern("dd MMM yyyy · hh:mm a").withZone(ZoneId.systemDefault()).format(instant)
            instant != null -> DateTimeFormatter.ofPattern("dd MMM yyyy").withZone(ZoneId.systemDefault()).format(instant)
            else -> "Date not available"
        }
        val note = dateMatch?.let { withoutHeading.removeRange(it.range) } ?: withoutHeading
        LeadContextEvent(
            dateLabel = dateLabel,
            note = note.replace(Regex("\\s+"), " ").trim().trimEnd('.').ifBlank { "Lead context recorded" },
            reference = reference,
            timestamp = instant?.toEpochMilli() ?: Long.MIN_VALUE + index,
            title = title,
        )
    }.sortedByDescending { it.timestamp }
}

@Composable private fun LeadContextTimeline(events: List<LeadContextEvent>) {
    Column(Modifier.fillMaxWidth()) {
        events.forEachIndexed { index, event ->
            val isLatest = index == 0
            val markerColor = if (isLatest) GxAccent else GxMuted
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                Canvas(Modifier.width(28.dp).fillMaxHeight()) {
                    val centerX = size.width / 2f
                    val dotY = 10.dp.toPx()
                    val stroke = 2.dp.toPx()
                    if (index > 0) drawLine(GxMuted.copy(alpha = .28f), Offset(centerX, 0f), Offset(centerX, dotY), stroke)
                    if (index < events.lastIndex) drawLine(GxMuted.copy(alpha = .28f), Offset(centerX, dotY), Offset(centerX, size.height), stroke)
                    drawCircle(markerColor, radius = if (isLatest) 6.dp.toPx() else 5.dp.toPx(), center = Offset(centerX, dotY))
                    drawCircle(GxSurface, radius = if (isLatest) 2.5.dp.toPx() else 2.dp.toPx(), center = Offset(centerX, dotY))
                }
                Column(Modifier.weight(1f).padding(bottom = if (index == events.lastIndex) 2.dp else 20.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(event.dateLabel.uppercase(), color = markerColor, fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                        if (isLatest) StatusPill("LATEST", GxAccent)
                    }
                    Text(event.title, fontWeight = FontWeight.Black, fontSize = 15.sp)
                    if (event.reference.isNotBlank()) Surface(color = GxAccent.copy(alpha = .09f), shape = RoundedCornerShape(8.dp)) {
                        Text("Reference ${event.reference}", color = GxAccent, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                    }
                    Text(event.note, color = GxMuted, fontSize = 12.sp, lineHeight = 18.sp)
                }
            }
        }
    }
}

@Composable private fun LeadDetailScreen(vm: CrmViewModel, id: String, back: () -> Unit) {
    val context = LocalContext.current
    val keyboard = LocalSoftwareKeyboardController.current
    val lead = vm.bootstrap?.leads?.find { it.id == id }
    val customer = vm.customer360
    val contextEvents = remember(lead?.notes) { parseLeadContext(lead?.notes.orEmpty()) }
    var taskTitle by rememberSaveable(id) { mutableStateOf("") }
    var taskDueAt by rememberSaveable(id) { mutableStateOf("") }
    var taskDueLabel by rememberSaveable(id) { mutableStateOf("") }
    var taskDescription by rememberSaveable(id) { mutableStateOf("") }
    var taskPriority by rememberSaveable(id) { mutableStateOf("NORMAL") }
    var taskComposerOpen by rememberSaveable(id) { mutableStateOf(false) }
    var historyExpanded by rememberSaveable(id) { mutableStateOf(false) }
    LaunchedEffect(id) { vm.clearCustomer360(); vm.loadCustomer360(id) }
    Page {
        HeaderWithBack(lead?.customerName ?: "Lead unavailable", lead?.let { "${it.stage.replace('_', ' ')} · ${it.priority}" } ?: "This lead may have moved.", back)
        if (lead == null) { EmptyCard("Refresh My Leads and try again."); return@Page }
        GxCard(accent = true) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = GxAccent.copy(alpha = .14f), shape = RoundedCornerShape(18.dp)) {
                    Text(lead.customerName.take(1).uppercase(), color = GxAccent, fontSize = 28.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp))
                }
                Spacer(Modifier.width(13.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(lead.customerPhone.ifBlank { "No phone number" }, fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text(lead.customerEmail.ifBlank { "No email address" }, color = GxMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { vm.startCall(lead) }, enabled = lead.customerPhone.isNotBlank() && !vm.busy, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Default.Phone, null, Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)); Text("Call", fontWeight = FontWeight.Black)
                }
                OutlinedButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/${lead.customerPhone.filter(Char::isDigit)}"))) }, enabled = lead.customerPhone.isNotBlank(), modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Default.Chat, null, Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)); Text("WhatsApp", fontWeight = FontWeight.Bold)
                }
            }
        }
        GxCard {
            SectionHeading(Icons.Default.Notes, "Lead journey")
            if (contextEvents.isEmpty()) Text("No lead journey notes yet.", color = GxMuted)
            else LeadContextTimeline(contextEvents)
            Surface(color = GxWarning.copy(alpha = .10f), shape = RoundedCornerShape(12.dp)) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Schedule, null, tint = GxWarning, modifier = Modifier.size(17.dp)); Spacer(Modifier.width(8.dp))
                    Text(lead.followUpAt?.let { "Next follow-up ${formatDate(it)}" } ?: "No follow-up scheduled", color = GxWarning, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        GxCard(accent = true) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SectionHeading(Icons.Default.Radar, "Customer 360", Modifier.weight(1f))
                StatusPill(when { vm.customer360Loading -> "SYNCING"; customer != null -> "LIVE"; else -> "CRM SNAPSHOT" }, when { vm.customer360Loading -> GxWarning; customer != null -> GxSuccess; else -> GxAccent })
            }
            when {
                vm.customer360Loading -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp); Spacer(Modifier.width(10.dp)); Text("Loading verified journey data…", color = GxMuted)
                }
                customer != null -> {
                    val snapshot = customer.snapshots.firstOrNull()
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        JourneyMetric("STAGE", snapshot?.lifecycleStage ?: "UNKNOWN", Modifier.weight(1f))
                        JourneyMetric("IDENTITY", customer.identityStatus, Modifier.weight(1f))
                        JourneyMetric("PLAN", customer.packageName ?: "NONE", Modifier.weight(1f))
                    }
                    CustomerFact(Icons.Default.PhoneAndroid, "App account", customer.appRole?.replace('_', ' ') ?: "Not linked")
                    CustomerFact(Icons.Default.CheckCircle, "Onboarding", customer.onboardingStage?.replace('_', ' ') ?: "Not started")
                    CustomerFact(Icons.Default.Bolt, "Engagement", snapshot?.engagementState?.replace('_', ' ') ?: "No signal")
                    CustomerFact(Icons.Default.Notifications, "Notifications", "${customer.notificationCount} sent · ${customer.unreadNotificationCount} unread")
                    CustomerFact(Icons.Default.Event, "Last journey activity", snapshot?.lastEventAt?.let(::formatDate) ?: contextEvents.firstOrNull()?.dateLabel ?: "Date not available")
                    CustomerFact(Icons.Default.Schedule, "Next follow-up date", lead.followUpAt?.let(::formatDate) ?: "Not scheduled")
                }
                else -> {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        JourneyMetric("STAGE", lead.stage, Modifier.weight(1f))
                        JourneyMetric("SOURCE", lead.source.ifBlank { "UNKNOWN" }, Modifier.weight(1f))
                        JourneyMetric("PRIORITY", lead.priority, Modifier.weight(1f))
                    }
                    CustomerFact(Icons.Default.Event, "Last journey activity", contextEvents.firstOrNull()?.dateLabel ?: "Date not available")
                    CustomerFact(Icons.Default.Schedule, "Next follow-up date", lead.followUpAt?.let(::formatDate) ?: "Not scheduled")
                    Text(if (vm.customer360Unavailable) "Detailed app activity will appear after Customer 360 sync is enabled." else vm.customer360Error ?: "No linked app activity yet.", color = GxMuted, fontSize = 11.sp, lineHeight = 16.sp)
                }
            }
        }
        if (customer?.webinars?.isNotEmpty() == true) GxCard {
            SectionHeading(Icons.Default.LiveTv, "Webinar touchpoints")
            customer.webinars.take(3).forEach { webinar ->
                CustomerFact(Icons.Default.PlayCircle, webinar.title, "${webinar.status.replace('_', ' ')} · ${webinar.participantType} · ${formatDate(webinar.scheduledAt)}")
            }
        }
        if (customer?.learning?.isNotEmpty() == true) GxCard {
            SectionHeading(Icons.Default.School, "In-app learning")
            customer.learning.take(5).forEach { learning ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(progress = { learning.progressPercent / 100f }, modifier = Modifier.size(38.dp), strokeWidth = 4.dp, trackColor = GxMuted.copy(alpha = .16f))
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)) { Text("Lesson ${learning.lessonId.takeLast(8)}", fontWeight = FontWeight.Bold); Text(if (learning.completedAt != null) "Completed" else "Last active ${formatDate(learning.lastHeartbeatAt)}", color = GxMuted, fontSize = 11.sp) }
                    Text("${learning.progressPercent}%", color = GxAccent, fontWeight = FontWeight.Black)
                }
            }
        }
        GxCard {
            val openTasks = customer?.tasks?.filter { it.status == "OPEN" }.orEmpty()
            Row(verticalAlignment = Alignment.CenterVertically) { SectionHeading(Icons.Default.TaskAlt, "Follow-up tasks", Modifier.weight(1f)); if (openTasks.isNotEmpty()) StatusPill("${openTasks.size} OPEN", GxWarning) }
            openTasks.take(5).forEach { task ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = GxWarning.copy(alpha = .10f), shape = RoundedCornerShape(12.dp)) { Icon(Icons.Default.Schedule, null, tint = GxWarning, modifier = Modifier.padding(9.dp).size(18.dp)) }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) { Text(task.title, fontWeight = FontWeight.Bold); Text("${task.priority} · ${formatDate(task.dueAt)}", color = GxMuted, fontSize = 11.sp) }
                    TextButton(onClick = { vm.completeTask(id, task.id) }) { Text("Done", fontWeight = FontWeight.Bold) }
                }
            }
            if (openTasks.isEmpty()) Text("Nothing due right now. Add the next clear action for this lead.", color = GxMuted, fontSize = 12.sp)
            if (!taskComposerOpen) SecondaryButton("Add follow-up", false) { taskComposerOpen = true }
            else {
                HorizontalDivider(color = GxMuted.copy(alpha = .16f))
                Text("New follow-up", fontWeight = FontWeight.Black, fontSize = 16.sp)
                OutlinedTextField(taskTitle, { taskTitle = it }, label = { Text("What needs to happen?") }, placeholder = { Text("Call after webinar") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedButton(
                    onClick = { showFollowUpPicker(context) { iso, display -> taskDueAt = iso; taskDueLabel = display } },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Icon(Icons.Default.CalendarMonth, null); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text("Due date & time", fontSize = 11.sp, color = GxMuted); Text(taskDueLabel.ifBlank { "Choose date and time" }, fontWeight = FontWeight.Bold) }; Icon(Icons.Default.ChevronRight, null)
                }
                Text("Priority", color = GxMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("NORMAL", "HIGH", "URGENT").forEach { value -> FilterChip(taskPriority == value, { taskPriority = value }, { Text(value) }) } }
                OutlinedTextField(taskDescription, { taskDescription = it }, label = { Text("Notes (optional)") }, minLines = 2, maxLines = 4, modifier = Modifier.fillMaxWidth())
                PrimaryButton("Schedule follow-up", vm.busy, taskTitle.isNotBlank() && taskDueAt.isNotBlank()) {
                    keyboard?.hide()
                    vm.createFollowUpTask(id, taskTitle, taskDueAt, taskPriority, taskDescription)
                    taskTitle = ""; taskDueAt = ""; taskDueLabel = ""; taskDescription = ""; taskPriority = "NORMAL"; taskComposerOpen = false
                }
                TextButton(onClick = { keyboard?.hide(); taskComposerOpen = false }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Cancel") }
            }
        }
        if (customer?.timeline?.isNotEmpty() == true) GxCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SectionHeading(Icons.Default.History, "System history", Modifier.weight(1f))
                TextButton(onClick = { historyExpanded = !historyExpanded }) { Text(if (historyExpanded) "Collapse" else "View all") }
            }
            customer.timeline.take(if (historyExpanded) 20 else 3).forEach { item ->
                CustomerFact(Icons.Default.Bolt, item.title.replace('_', ' '), "${item.type} · ${formatDate(item.at)}${item.detail?.takeIf(String::isNotBlank)?.let { "\n${it.take(120)}" } ?: ""}")
            }
        }
        GxCard { SectionHeading(Icons.Default.Security, "Tracked-call flow"); Text("CRM session → company dialer → supported recording → secure upload → required disposition", color = GxMuted, fontSize = 12.sp, lineHeight = 18.sp) }
    }
}

private fun showFollowUpPicker(context: Context, onPicked: (iso: String, display: String) -> Unit) {
    val initial = ZonedDateTime.now().plusDays(1).withHour(11).withMinute(0).withSecond(0).withNano(0)
    DatePickerDialog(context, { _, year, month, day ->
        TimePickerDialog(context, { _, hour, minute ->
            val selected = LocalDateTime.of(year, month + 1, day, hour, minute).atZone(ZoneId.systemDefault())
            val display = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a").format(selected)
            onPicked(selected.toInstant().toString(), display)
        }, initial.hour, initial.minute, false).show()
    }, initial.year, initial.monthValue - 1, initial.dayOfMonth).apply {
        datePicker.minDate = System.currentTimeMillis() - 1_000
    }.show()
}

private val outcomes = listOf("CONNECTED_INTERESTED", "CONNECTED_NOT_INTERESTED", "NO_ANSWER", "BUSY", "SWITCHED_OFF", "WRONG_NUMBER", "CALLBACK_REQUESTED", "WEBINAR_LINK_SENT", "PAYMENT_LINK_SENT", "CLOSED_WON", "LOST")

@Composable private fun DispositionScreen(vm: CrmViewModel, callId: String, done: () -> Unit) {
    var outcome by remember { mutableStateOf("") }; var note by remember { mutableStateOf("") }; var followUp by remember { mutableStateOf("") }
    Page {
        BrandHeader("Complete call notes", "Required before the next tracked call")
        GxCard {
            Text("Outcome", fontWeight = FontWeight.Black)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) { outcomes.forEach { value -> FilterChip(outcome == value, { outcome = value }, { Text(value.replace('_', ' '), fontSize = 10.sp) }) } }
            OutlinedTextField(note, { note = it }, label = { Text("Discussion notes") }, minLines = 3, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(followUp, { followUp = it }, label = { Text("Follow-up ISO date/time (optional)") }, placeholder = { Text("2026-09-01T10:30:00+05:30") }, modifier = Modifier.fillMaxWidth())
            PrimaryButton("Save disposition", vm.busy, outcome.isNotBlank() && note.isNotBlank()) { vm.saveDisposition(callId, outcome, note, followUp.ifBlank { null }, done) }
        }
    }
}

@Composable private fun LeadGrabScreen(vm: CrmViewModel, done: () -> Unit) {
    var size by remember { mutableIntStateOf(3) }
    val pack = vm.selectedPack
    var seconds by remember(pack?.expiresAt) { mutableLongStateOf(0) }
    LaunchedEffect(pack?.expiresAt) { while (pack != null) { seconds = ((runCatching { Instant.parse(pack.expiresAt).toEpochMilli() }.getOrDefault(0) - System.currentTimeMillis()) / 1000).coerceAtLeast(0); delay(1000) } }
    Page {
        HeaderWithBack("Lead Grab", "Reserve fresh enquiries, then claim before expiry", done)
        if (pack == null) GxCard(accent = true) {
            Text("How many leads can you contact now?", fontWeight = FontWeight.Black, fontSize = 19.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(3, 4, 5).forEach { value -> FilterChip(size == value, { size = value }, { Text("$value leads") }, modifier = Modifier.weight(1f)) } }
            Text("Numbers stay hidden until claimed. Call notes must be completed before another pack unlocks.", color = GxMuted)
            PrimaryButton("Reserve $size leads", vm.busy) { vm.requestPack(size) }
        } else {
            GxCard(accent = true) { Text("PACK RESERVED", color = GxAccent, fontSize = 11.sp, fontWeight = FontWeight.Black); Text("${seconds}s", fontSize = 44.sp, fontWeight = FontWeight.Black); LinearProgressIndicator(progress = { (seconds / 60f).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth()) }
            pack.leads.forEach { lead -> GxCard { Text(lead.customerName, fontWeight = FontWeight.Black); Text(lead.serviceInterest, color = GxMuted); Text("${lead.source} · ${lead.priority}", color = GxAccent, fontSize = 11.sp) } }
            if (seconds > 0) PrimaryButton("Claim ${pack.leadPoolIds.size} leads now", vm.busy) { vm.claimPack(done) } else PrimaryButton("Request another pack", false) { vm.clearPack() }
        }
    }
}

private val conversationStages = listOf("NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "NOT_REACHABLE", "QUALIFIED", "CLOSED_WON", "CLOSED_LOST")

@Composable private fun ChatScreen(vm: CrmViewModel, id: String, name: String, back: () -> Unit) {
    var body by rememberSaveable { mutableStateOf("") }
    var labelMenu by remember { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()
    val imeVisible = WindowInsets.ime.getBottom(LocalDensity.current) > 0
    val inboxItem = vm.inbox.firstOrNull { it.conversationId == id }
    LaunchedEffect(id) { vm.loadChat(id) }
    LaunchedEffect(vm.chatMessages.size, imeVisible) {
        if (vm.chatMessages.isNotEmpty()) listState.scrollToItem(vm.chatMessages.lastIndex)
    }
    Column(Modifier.fillMaxSize().background(GxBackground).imePadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(back) { Icon(Icons.Default.ArrowBack, "Back") }
            Surface(color = GxSurface2, shape = RoundedCornerShape(99.dp), modifier = Modifier.size(42.dp)) {
                Box(contentAlignment = Alignment.Center) { Text(initials(name), color = GxAccent, fontWeight = FontWeight.Black) }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(name.ifBlank { "Conversation" }, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Assigned lead conversation", color = GxMuted, fontSize = 11.sp)
            }
            IconButton(onClick = { vm.loadChat(id) }, enabled = !vm.chatLoading) { Icon(Icons.Default.Refresh, "Refresh conversation", tint = GxMuted) }
        }
        Surface(color = GxSurface.copy(alpha = .72f), border = BorderStroke(1.dp, GxMuted.copy(alpha = .10f)), modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Label, null, tint = GxAccent, modifier = Modifier.size(17.dp)); Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) { Text("CRM LABEL", color = GxMuted, fontSize = 9.sp, fontWeight = FontWeight.Black); Text("Used for reminders and sales follow-up", color = GxText, fontSize = 11.sp) }
                Box {
                    OutlinedButton(onClick = { labelMenu = true }, contentPadding = PaddingValues(horizontal = 11.dp, vertical = 5.dp), shape = RoundedCornerShape(99.dp)) {
                        Text(inboxItem?.lead?.stage?.replace('_', ' ') ?: "SET LABEL", fontSize = 9.sp, fontWeight = FontWeight.Black); Spacer(Modifier.width(3.dp)); Icon(Icons.Default.ArrowDropDown, null, Modifier.size(16.dp))
                    }
                    DropdownMenu(expanded = labelMenu, onDismissRequest = { labelMenu = false }) {
                        conversationStages.forEach { stage -> DropdownMenuItem(text = { Text(stage.replace('_', ' ')) }, leadingIcon = { Icon(Icons.Default.Label, null, tint = if (stage == inboxItem?.lead?.stage) GxAccent else GxMuted) }, onClick = { labelMenu = false; inboxItem?.lead?.id?.let { vm.updateLeadStage(it, stage) } }) }
                    }
                }
            }
        }
        HorizontalDivider(color = GxMuted.copy(alpha = .13f))
        LazyColumn(state = listState, modifier = Modifier.weight(1f).padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(vertical = 14.dp)) {
            if (vm.chatLoading && vm.chatMessages.isEmpty()) items(5) { index -> ChatLoadingBubble(outbound = index % 3 == 0) }
            if (vm.chatMessages.isEmpty() && !vm.chatLoading) item { EmptyCard("No messages in this assigned conversation yet.") }
            itemsIndexed(vm.chatMessages, key = { _, message -> message.id }) { index, message ->
                if (index == 0 || messageDay(vm.chatMessages[index - 1].createdAt) != messageDay(message.createdAt)) {
                    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.Center) {
                        Surface(color = GxSurface2, shape = RoundedCornerShape(99.dp)) { Text(formatMessageDay(message.createdAt), color = GxMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 11.dp, vertical = 5.dp)) }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.outbound) Arrangement.End else Arrangement.Start, verticalAlignment = Alignment.Bottom) {
                    Surface(
                        color = if (message.outbound) GxAccent.copy(alpha = .17f) else GxSurface2,
                        contentColor = GxText,
                        shape = if (message.outbound) RoundedCornerShape(18.dp, 18.dp, 5.dp, 18.dp) else RoundedCornerShape(18.dp, 18.dp, 18.dp, 5.dp),
                        border = BorderStroke(1.dp, if (message.outbound) GxAccent.copy(alpha = .25f) else GxMuted.copy(alpha = .10f)),
                        modifier = Modifier.widthIn(min = 84.dp, max = 300.dp),
                    ) {
                        Column(Modifier.padding(horizontal = 14.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            message.attachmentName?.let { attachmentName ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(color = GxAccent.copy(alpha = .13f), shape = RoundedCornerShape(12.dp)) { Icon(Icons.Default.Movie, null, tint = GxAccent, modifier = Modifier.padding(9.dp).size(20.dp)) }
                                    Spacer(Modifier.width(10.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(attachmentName, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                        Text(if (message.attachmentCount > 1) "Video attachment +${message.attachmentCount - 1}" else "Video attachment", color = GxMuted, fontSize = 10.sp)
                                    }
                                }
                            }
                            if (message.body.isNotBlank()) Text(message.body, fontSize = 15.sp, lineHeight = 21.sp)
                            Text("${message.author.ifBlank { if (message.outbound) "You" else name }} · ${formatMessageTime(message.createdAt)}", color = GxMuted, fontSize = 9.sp, maxLines = 1, modifier = Modifier.align(Alignment.End))
                        }
                    }
                }
            }
        }
        // The IME inset belongs to the full chat column. Applying it to this box
        // would make the box keyboard-height and leave a large empty gap below it.
        Box(Modifier.fillMaxWidth().background(Color.Transparent).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Surface(color = GxSurface.copy(alpha = .92f), shape = RoundedCornerShape(30.dp), border = BorderStroke(1.dp, GxMuted.copy(alpha = .10f)), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextField(
                        value = body,
                        onValueChange = { body = it },
                        placeholder = { Text("Write a reply", color = GxMuted) },
                        minLines = 1,
                        maxLines = 4,
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            disabledContainerColor = Color.Transparent,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent,
                            cursorColor = GxAccent,
                        ),
                        modifier = Modifier.weight(1f).heightIn(min = 46.dp, max = 104.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    val readyToSend = body.isNotBlank() && !vm.busy
                    FilledIconButton(
                        onClick = { val message = body.trim(); if (message.isNotBlank()) { vm.sendChat(id, message); body = ""; keyboard?.hide() } },
                        enabled = readyToSend,
                        colors = IconButtonDefaults.filledIconButtonColors(
                            containerColor = if (readyToSend) GxAccent else GxAccent.copy(alpha = .32f),
                            contentColor = if (readyToSend) GxBackground else GxBackground.copy(alpha = .55f),
                            disabledContainerColor = GxAccent.copy(alpha = .18f),
                            disabledContentColor = GxMuted,
                        ),
                        modifier = Modifier.size(48.dp),
                    ) { Icon(Icons.Default.Send, "Send", modifier = Modifier.size(19.dp)) }
                }
            }
        }
    }
}

@Composable private fun InboxLoadingRow() {
    Row(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(color = GxSurface2, shape = RoundedCornerShape(18.dp), modifier = Modifier.size(50.dp)) {}
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Surface(color = GxSurface2, shape = RoundedCornerShape(6.dp), modifier = Modifier.width(132.dp).height(14.dp)) {}
            Surface(color = GxSurface2.copy(alpha = .72f), shape = RoundedCornerShape(6.dp), modifier = Modifier.fillMaxWidth(.72f).height(11.dp)) {}
            Surface(color = GxSurface2.copy(alpha = .55f), shape = RoundedCornerShape(6.dp), modifier = Modifier.fillMaxWidth(.48f).height(10.dp)) {}
        }
    }
}

@Composable private fun ChatLoadingBubble(outbound: Boolean) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (outbound) Arrangement.End else Arrangement.Start) {
        Surface(color = GxSurface2, shape = RoundedCornerShape(17.dp), modifier = Modifier.width(if (outbound) 190.dp else 245.dp).height(74.dp)) {}
    }
}

@Composable private fun SectionHeading(icon: ImageVector, title: String, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Surface(color = GxAccent.copy(alpha = .12f), shape = RoundedCornerShape(10.dp)) { Icon(icon, null, tint = GxAccent, modifier = Modifier.padding(7.dp).size(17.dp)) }
        Spacer(Modifier.width(9.dp))
        Text(title, fontWeight = FontWeight.Black, fontSize = 17.sp)
    }
}

@Composable private fun JourneyMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(color = GxBackground.copy(alpha = .55f), shape = RoundedCornerShape(13.dp), modifier = modifier) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, color = GxMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Text(value.replace('_', ' '), color = GxAccent, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable private fun CustomerFact(icon: ImageVector, title: String, detail: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Icon(icon, null, tint = GxMuted, modifier = Modifier.padding(top = 2.dp).size(17.dp))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(detail, color = GxMuted, fontSize = 11.sp, lineHeight = 16.sp, maxLines = 4, overflow = TextOverflow.Ellipsis)
        }
    }
}

private fun initials(value: String): String = value.trim().split(Regex("\\s+")).filter(String::isNotBlank).take(2).mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("").ifBlank { "GX" }

private fun formatInboxTime(value: String?): String {
    val instant = value?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    val local = instant.atZone(ZoneId.systemDefault())
    return if (local.toLocalDate() == LocalDate.now()) DateTimeFormatter.ofPattern("hh:mm a").format(local) else DateTimeFormatter.ofPattern("dd MMM").format(local)
}

private fun formatMessageTime(value: String): String {
    val instant = runCatching { Instant.parse(value) }.getOrNull() ?: return ""
    return DateTimeFormatter.ofPattern("hh:mm a").format(instant.atZone(ZoneId.systemDefault()))
}

private fun messageDay(value: String): LocalDate? = runCatching { Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull()

private fun formatMessageDay(value: String): String {
    val date = messageDay(value) ?: return "Conversation"
    return when (date) { LocalDate.now() -> "Today"; LocalDate.now().minusDays(1) -> "Yesterday"; else -> DateTimeFormatter.ofPattern("dd MMM yyyy").format(date) }
}

@Composable private fun InboxConversationRow(item: InboxItem, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 13.dp), verticalAlignment = Alignment.Top) {
        Surface(color = GxSurface2, shape = RoundedCornerShape(99.dp), border = BorderStroke(1.dp, GxMuted.copy(alpha = .14f)), modifier = Modifier.size(50.dp)) {
            Box(contentAlignment = Alignment.Center) { Text(initials(item.lead.customerName), color = GxAccent, fontWeight = FontWeight.Black, fontSize = 14.sp) }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(item.lead.customerName, fontWeight = FontWeight.Black, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(item.lead.serviceInterest.ifBlank { "Assigned sales conversation" }, color = GxText.copy(alpha = .72f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(item.latestMessage.ifBlank { if (item.conversationId != null) "Open conversation" else "Conversation is not connected" }, color = GxMuted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(color = GxAccent.copy(alpha = .10f), shape = RoundedCornerShape(99.dp), border = BorderStroke(1.dp, GxAccent.copy(alpha = .20f))) { Text("CRM", color = GxAccent, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)) }
                Surface(color = GxMuted.copy(alpha = .08f), shape = RoundedCornerShape(99.dp)) { Text(item.lead.stage.replace('_', ' '), color = GxText.copy(alpha = .76f), fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)) }
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(formatInboxTime(item.latestMessageAt), color = GxMuted, fontSize = 10.sp)
            if (item.lead.priority.equals("HIGH", true) || item.lead.priority.equals("URGENT", true)) StatusPill(item.lead.priority.uppercase(), GxWarning)
        }
    }
}

@Composable private fun Page(vertical: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(GxBackground).then(if (vertical) Modifier.verticalScroll(rememberScrollState()) else Modifier.verticalScroll(rememberScrollState())).imePadding().padding(start = 16.dp, top = 5.dp, end = 16.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(13.dp), content = content)
}
@Composable private fun BrandHeader(title: String, subtitle: String) { Column(Modifier.fillMaxWidth()) { Text("GX", color = GxAccent, fontSize = 13.sp, fontWeight = FontWeight.Black); Text(title, fontSize = 27.sp, fontWeight = FontWeight.Black); Text(subtitle, color = GxMuted) } }
@Composable private fun HeaderWithBack(title: String, subtitle: String, back: () -> Unit) { Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) { IconButton(back) { Icon(Icons.Default.ArrowBack, "Back") }; Column(Modifier.weight(1f)) { Text(title, fontSize = 22.sp, fontWeight = FontWeight.Black); Text(subtitle, color = GxMuted, fontSize = 12.sp) } } }
@Composable private fun GxCard(accent: Boolean = false, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) { Surface(color = if (accent) GxSurface2 else GxSurface, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, if (accent) GxAccent.copy(alpha = .35f) else GxMuted.copy(alpha = .15f)), modifier = Modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content) } }
@Composable private fun PrimaryButton(label: String, loading: Boolean, enabled: Boolean = true, onClick: () -> Unit) { Button(onClick, enabled = enabled && !loading, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(15.dp)) { if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text(label, fontWeight = FontWeight.Black) } }
@Composable private fun SecondaryButton(label: String, loading: Boolean, enabled: Boolean = true, onClick: () -> Unit) { OutlinedButton(onClick, enabled = enabled && !loading, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(15.dp)) { if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text(label, fontWeight = FontWeight.Bold) } }
@Composable private fun FeatureRow(icon: ImageVector, title: String, copy: String) { Row(verticalAlignment = Alignment.Top) { Icon(icon, null, tint = GxAccent); Spacer(Modifier.width(12.dp)); Column { Text(title, fontWeight = FontWeight.Black); Text(copy, color = GxMuted, fontSize = 12.sp) } } }
@Composable private fun Metric(value: String, label: String, modifier: Modifier) { Surface(color = GxSurface, shape = RoundedCornerShape(16.dp), modifier = modifier) { Column(Modifier.padding(14.dp)) { Text(value, fontSize = 25.sp, fontWeight = FontWeight.Black); Text(label, color = GxMuted, fontSize = 11.sp) } } }
@Composable private fun StatusPill(label: String, color: androidx.compose.ui.graphics.Color) { Surface(color = color.copy(alpha = .12f), shape = RoundedCornerShape(99.dp), border = BorderStroke(1.dp, color.copy(alpha = .35f))) { Text(label, color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) } }
@Composable private fun LeadCard(lead: SalesLead, open: () -> Unit) {
    GxCard(onClick = open) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(color = GxAccent.copy(alpha = .12f), shape = RoundedCornerShape(99.dp), modifier = Modifier.size(46.dp)) { Box(contentAlignment = Alignment.Center) { Text(initials(lead.customerName), color = GxAccent, fontWeight = FontWeight.Black) } }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(lead.customerName, fontWeight = FontWeight.Black, fontSize = 16.sp)
                Text(lead.customerPhone.ifBlank { "No phone number" }, color = GxMuted, fontSize = 12.sp)
                Text(lead.source.ifBlank { lead.serviceInterest.ifBlank { "Direct CRM lead" } }, color = GxMuted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                StatusPill(lead.stage.replace('_', ' '), GxAccent)
                Text(lead.priority.uppercase(), color = if (lead.priority.equals("URGENT", true)) GxWarning else GxMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
        lead.followUpAt?.let { CustomerFact(Icons.Default.Schedule, "Next follow-up", formatDate(it)) }
    }
}
@Composable private fun EmptyCard(copy: String) { GxCard { Text(copy, color = GxMuted) } }
private fun formatDate(value: String): String = runCatching { DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a").withZone(ZoneId.systemDefault()).format(Instant.parse(value)) }.getOrDefault(value)
