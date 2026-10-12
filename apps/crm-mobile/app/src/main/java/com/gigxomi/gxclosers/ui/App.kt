package com.gigxomi.gxclosers.ui

import android.annotation.SuppressLint
import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.content.pm.PackageManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.telecom.TelecomManager
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.tween
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.gigxomi.gxclosers.data.*
import com.gigxomi.gxclosers.call.CallManager
import com.gigxomi.gxclosers.call.DeviceCertificationManager
import androidx.compose.ui.text.style.TextDecoration
import com.gigxomi.gxclosers.call.SimOption
import com.gigxomi.gxclosers.call.SystemCallRecordingImporter
import com.gigxomi.gxclosers.call.DialerShareAutomation
import com.gigxomi.gxclosers.ui.theme.*
import com.gigxomi.gxclosers.ui.components.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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

private enum class RecordingDeviceFamily {
    PIXEL,
    XIAOMI,
    OPPO,
    VIVO,
    SAMSUNG,
    MOTOROLA,
    OTHER,
}

private data class RecordingDeviceProfile(
    val family: RecordingDeviceFamily,
    val deviceLabel: String,
    val setupHeadline: String,
    val setupDetail: String,
    val phoneRecordingDetail: String,
    val shareDetail: String,
    val folderDetail: String,
    val folderTip: String,
)

private fun recordingDeviceProfile(): RecordingDeviceProfile {
    val manufacturer = Build.MANUFACTURER.trim().lowercase()
    val brand = Build.BRAND.trim().lowercase()
    val model = Build.MODEL.trim().ifBlank { "Android phone" }
    val family = when {
        manufacturer.contains("google") || brand.contains("google") || model.lowercase().contains("pixel") -> RecordingDeviceFamily.PIXEL
        manufacturer.contains("xiaomi") || manufacturer.contains("poco") || manufacturer.contains("redmi") || brand.contains("xiaomi") || brand.contains("poco") || brand.contains("redmi") -> RecordingDeviceFamily.XIAOMI
        manufacturer.contains("oppo") || manufacturer.contains("realme") || brand.contains("oppo") || brand.contains("realme") -> RecordingDeviceFamily.OPPO
        manufacturer.contains("vivo") || brand.contains("vivo") -> RecordingDeviceFamily.VIVO
        manufacturer.contains("samsung") || brand.contains("samsung") -> RecordingDeviceFamily.SAMSUNG
        manufacturer.contains("motorola") || manufacturer.contains("lenovo") || brand.contains("motorola") -> RecordingDeviceFamily.MOTOROLA
        else -> RecordingDeviceFamily.OTHER
    }
    return when (family) {
        RecordingDeviceFamily.PIXEL -> RecordingDeviceProfile(
            family, "Google $model", "Guided for Google Phone", "Google Phone keeps recordings private on many Pixel builds, so the visible Share flow is the primary connection.",
            "Enable Call recording in Google Phone, then make one short test call.",
            "Primary path — AI Closer watches the visible Phone share flow and imports the finished audio.",
            "Optional on Pixel. Use it only if Google Phone exposes a readable recording folder.",
            "If no folder is visible, leave this optional and use Share automation instead."
        )
        RecordingDeviceFamily.XIAOMI -> RecordingDeviceProfile(
            family, "Xiaomi/Redmi/POCO $model", "Guided for Xiaomi dialer", "Xiaomi-family phones commonly publish recordings through a shared folder; AI Closer will prefer that exact folder and use Share as backup.",
            "Enable recording in the active Phone app and confirm the newest call is saved.",
            "Backup path — allows AI Closer to select Share if the dialer exposes the recording there.",
            "Recommended. Choose the folder containing the newest Xiaomi/Recorder call file.",
            "Make one test call first, then choose the folder from Files so the app can match new files by call time."
        )
        RecordingDeviceFamily.OPPO -> RecordingDeviceProfile(
            family, "OPPO/realme $model", "Guided for OPPO Phone", "OPPO-family dialers vary by region and ColorOS version, so AI Closer checks both the visible Share route and an approved recording folder.",
            "Turn on call recording in the active Phone app, then return here.",
            "Recommended fallback — lets AI Closer receive a recording when the Phone app offers Share.",
            "Recommended if the Recorder app shows a normal folder. Otherwise use Share automation.",
            "Do not select a generic Music folder; choose the folder where the newest call recording appears."
        )
        RecordingDeviceFamily.VIVO -> RecordingDeviceProfile(
            family, "vivo $model", "Guided for vivo Phone", "vivo recording locations depend on Funtouch OS and region; the app keeps both approved paths available without changing the phone dialer.",
            "Enable recording in the active Phone app and complete one short test call.",
            "Recommended fallback — imports the recording through the Phone app's visible Share action.",
            "Recommended when Recorder exposes call files to Files; otherwise use Share automation.",
            "After the test call, select the folder containing the newest audio file."
        )
        RecordingDeviceFamily.SAMSUNG -> RecordingDeviceProfile(
            family, "Samsung $model", "Guided for Samsung Phone", "Samsung recording availability varies by region and Phone version; AI Closer uses only the recording access the device exposes.",
            "Enable call recording in Samsung Phone, then make one test call.",
            "Backup path for a Phone app that offers Share after recording.",
            "Choose it if Samsung Voice Recorder or Files exposes the call recording folder.",
            "If the device does not expose recordings, the setup screen will keep Share as the safer route."
        )
        RecordingDeviceFamily.MOTOROLA -> RecordingDeviceProfile(
            family, "Motorola/Lenovo $model", "Guided for Android Phone", "Recording controls are usually provided by Google Phone or the carrier; AI Closer adapts to whichever route is available.",
            "Enable call recording in the active Phone app, then make one test call.",
            "Recommended when the Phone app exposes a finished recording through Share.",
            "Choose a folder only if the Phone/Recorder app exposes one through Files.",
            "The folder is optional; do not grant access to a private app folder that Android cannot share."
        )
        RecordingDeviceFamily.OTHER -> RecordingDeviceProfile(
            family, model, "Guided for this Android phone", "AI Closer will detect the recording path available on this device and keep the setup reversible.",
            "Enable call recording in the active Phone app, then make one test call.",
            "Use this when the Phone or Recorder app offers a visible Share action.",
            "Choose a folder only when the recording appears in Files.",
            "The app never assumes a private folder; Android must explicitly approve the folder or Share action."
        )
    }
}

@Composable
fun GXClosersApp(initialLink: Uri?, vm: CrmViewModel = viewModel()) {
    val nav = rememberNavController()
    val snackbar = remember { SnackbarHostState() }
    val start = when { !vm.authenticated -> LOGIN; !vm.setupComplete -> SETUP; else -> MAIN }

    LaunchedEffect(vm.error, vm.status) {
        // Setup and login render actionable inline states. Keep the snackbar
        // for the main workspace and generic login failures, but do not stack
        // it under the setup conflict card or the login replacement card.
        val route = nav.currentDestination?.route
        val showSnackbar = vm.status != null ||
            (route == LOGIN && vm.sessionConflict == null)
        if (showSnackbar) {
            (vm.error ?: vm.status)?.let { snackbar.showSnackbar(it) }
        }
        // Setup/login render their own inline recovery states. Keep the
        // error available for those effects instead of clearing it before the
        // conflict card can consume it.
        if (showSnackbar) vm.clearMessage()
    }
    LaunchedEffect(vm.authenticated, vm.setupComplete) {
        val destination = when { !vm.authenticated -> LOGIN; !vm.setupComplete -> SETUP; else -> MAIN }
        // NavHost installs its graph during composition. The first state
        // effect can run before that happens, so do not read nav.graph (or
        // navigate) until a real destination exists. The startDestination
        // already renders the correct initial screen; this branch is only for
        // later login/setup transitions.
        val current = nav.currentDestination
        if (current != null && current.route != destination) {
            nav.navigate(destination) { popUpTo(current.id) { inclusive = true }; launchSingleTop = true }
        }
    }
    LaunchedEffect(initialLink, vm.authenticated, vm.setupComplete) {
        if (vm.authenticated && vm.setupComplete && initialLink != null && nav.currentDestination != null) {
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
                LeadDetailScreen(
                    vm = vm,
                    id = entry.arguments?.getString("id").orEmpty(),
                    back = { nav.popBackStack() },
                    openDisposition = { callId -> nav.navigate("disposition/$callId") },
                    openChat = { conversationId, name -> nav.navigate("chat/$conversationId/${Uri.encode(name)}") },
                )
            }
            composable("disposition/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                DispositionScreen(vm, entry.arguments?.getString("id").orEmpty()) { nav.navigate(MAIN) { popUpTo(MAIN) { inclusive = true } } }
            }
            composable("chat/{id}/{name}", arguments = listOf(navArgument("id") { type = NavType.StringType }, navArgument("name") { type = NavType.StringType })) { entry ->
                ChatScreen(vm, entry.arguments?.getString("id").orEmpty(), Uri.decode(entry.arguments?.getString("name").orEmpty())) { nav.popBackStack() }
            }
            composable("inbox") {
                InboxScreen(
                    vm = vm,
                    open = { item -> item.conversationId?.let { nav.navigate("chat/$it/${Uri.encode(item.lead.customerName)}") } },
                    back = { nav.popBackStack() },
                )
            }
            composable("lesson/{courseId}/{lessonId}", arguments = listOf(navArgument("courseId") { type = NavType.StringType }, navArgument("lessonId") { type = NavType.StringType })) { entry ->
                LessonScreen(vm, entry.arguments?.getString("courseId").orEmpty(), entry.arguments?.getString("lessonId").orEmpty()) { nav.popBackStack() }
            }
            composable("edit-profile") { EditProfileScreen(vm) { nav.popBackStack() } }
        }
    }
}

@Composable private fun LoginScreen(vm: CrmViewModel) {
    var identifier by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    val backgroundMotion = rememberInfiniteTransition(label = "login-background-motion")
    val backgroundDrift by backgroundMotion.animateFloat(
        initialValue = -5f,
        targetValue = 5f,
        animationSpec = infiniteRepeatable(tween(7000, easing = LinearEasing), RepeatMode.Reverse),
        label = "login-background-drift",
    )

    Box(
        Modifier
            .fillMaxSize()
            .background(GxDarkBg)
    ) {
        // Upper background microphone with smooth fade to GxDarkBg
        Image(
            painter = painterResource(com.gigxomi.gxclosers.R.drawable.login_telephony_background),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            alignment = androidx.compose.ui.BiasAlignment(0f, -0.2f),
            modifier = Modifier
                .fillMaxWidth()
                .height(490.dp)
                .graphicsLayer {
                    translationX = backgroundDrift * 0.4f
                },
            alpha = 0.82f,
        )
        Box(
            Modifier
                .fillMaxWidth()
                .height(510.dp)
                .background(
                    androidx.compose.ui.graphics.Brush.verticalGradient(
                        listOf(
                            GxDarkBg.copy(alpha = 0.10f),
                            Color.Transparent,
                            GxDarkBg.copy(alpha = 0.75f),
                            GxDarkBg,
                        )
                    )
                )
        )
        // Floating soundwave bars in upper-right
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(290.dp)
        ) {
            val waveRight = size.width - 24.dp.toPx()
            val waveCenterY = 195.dp.toPx()
            val barHeights = listOf(14f, 24f, 18f, 38f, 26f, 52f, 22f, 44f, 28f, 36f, 18f)
            val barSpacing = 7.dp.toPx()
            barHeights.forEachIndexed { i, h ->
                val x = waveRight - (barHeights.size - 1 - i) * barSpacing
                drawLine(
                    color = Color.White.copy(alpha = 0.26f),
                    start = Offset(x, waveCenterY - h.dp.toPx() / 2f),
                    end = Offset(x, waveCenterY + h.dp.toPx() / 2f),
                    strokeWidth = 2.5.dp.toPx(),
                    cap = androidx.compose.ui.graphics.StrokeCap.Round,
                )
            }
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(horizontal = 24.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            AiCloserLogoHeader()

            Spacer(Modifier.height(12.dp))

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "Sign in to AI Closer",
                    color = Color.White,
                    fontSize = 28.sp,
                    lineHeight = 34.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.5).sp,
                )
                Text(
                    "Use the account provided by your business",
                    color = GxMutedText,
                    fontSize = 14.5.sp,
                    lineHeight = 20.sp,
                )
            }

            Spacer(Modifier.height(10.dp))

            Surface(
                color = Color(0xFF171A1E).copy(alpha = 0.88f),
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    OutlinedTextField(
                        value = identifier,
                        onValueChange = { identifier = it },
                        placeholder = { Text("Email or phone", color = GxMutedText, fontSize = 15.sp) },
                        leadingIcon = { Icon(Icons.Outlined.Email, null, tint = GxMutedText, modifier = Modifier.size(20.dp)) },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        textStyle = LocalTextStyle.current.copy(color = Color.White, fontSize = 15.sp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color(0xFF1E2126),
                            unfocusedContainerColor = Color(0xFF1E2126),
                            focusedBorderColor = GxOrange,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            cursorColor = GxOrange,
                        ),
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        placeholder = { Text("Password", color = GxMutedText, fontSize = 15.sp) },
                        leadingIcon = { Icon(Icons.Outlined.Lock, null, tint = GxMutedText, modifier = Modifier.size(20.dp)) },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    if (passwordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                    contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                    tint = GxMutedText,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                        },
                        singleLine = true,
                        visualTransformation = if (passwordVisible) androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        shape = RoundedCornerShape(16.dp),
                        textStyle = LocalTextStyle.current.copy(color = Color.White, fontSize = 15.sp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color(0xFF1E2126),
                            unfocusedContainerColor = Color(0xFF1E2126),
                            focusedBorderColor = GxOrange,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            cursorColor = GxOrange,
                        ),
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                    )
                    GxPillButton(
                        text = "Sign in",
                        onClick = {
                            if (identifier.isBlank() || password.isBlank()) {
                                vm.showError("Enter your email or phone and password")
                            } else {
                                vm.login(identifier, password) {}
                            }
                        },
                        loading = vm.busy,
                    )

                    vm.sessionConflict?.let { conflict ->
                        Surface(
                            color = GxDanger.copy(alpha = 0.08f),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, GxDanger.copy(alpha = 0.40f)),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Warning, null, tint = GxDanger, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("Active Session on Another Device", color = GxDanger, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }
                                Text(
                                    conflict.message ?: "This user already has an active mobile session on another device.",
                                    color = GxText,
                                    fontSize = 12.sp,
                                    lineHeight = 16.sp,
                                )
                                if (!conflict.deviceName.isNullOrBlank()) {
                                    Text("Current device: ${conflict.deviceName}", color = GxMuted, fontSize = 11.sp)
                                }
                                Button(
                                    onClick = { vm.login(identifier, password, forceReplace = true) {} },
                                    enabled = !vm.busy,
                                    colors = ButtonDefaults.buttonColors(containerColor = GxOrange, contentColor = Color.White),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth().height(42.dp),
                                ) {
                                    if (vm.busy) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(16.dp),
                                            strokeWidth = 2.dp,
                                            color = Color.White,
                                        )
                                    } else {
                                        Icon(Icons.Default.Login, null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("Login here", fontWeight = FontWeight.Black, fontSize = 13.sp)
                                    }
                                }
                                Text(
                                    "“Login here” will end the session on your other mobile device and activate this phone.",
                                    color = GxMuted,
                                    fontSize = 10.sp,
                                    lineHeight = 14.sp,
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.weight(1f, fill = false))

            Row(
                Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Lock, null, tint = GxMutedText, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(7.dp))
                Text("Connected securely to app.aicloser.in", color = GxMutedText, fontSize = 12.sp)
            }
        }
    }
}

@Composable private fun SetupScreen(vm: CrmViewModel) {
    val context = LocalContext.current
    val deviceProfile = remember { recordingDeviceProfile() }
    var setupIssue by rememberSaveable { mutableStateOf<String?>(null) }
    var takingOverDevice by rememberSaveable { mutableStateOf(false) }
    var setupStep by rememberSaveable { mutableIntStateOf(0) }
    var simOptions by remember { mutableStateOf<List<SimOption>>(emptyList()) }
    var selectedSimId by rememberSaveable { mutableStateOf("") }
    val setupPrefs = remember { context.getSharedPreferences("gxclosers_setup", Context.MODE_PRIVATE) }
    var recordingSettingsOpened by rememberSaveable {
        mutableStateOf(setupPrefs.getBoolean("phoneRecordingSettingsOpened", false))
    }
    var accessibilityEnabled by remember { mutableStateOf(DialerShareAutomation.isAccessibilityEnabled(context)) }
    var micFallbackEnabled by remember { mutableStateOf(context.getSharedPreferences("gxclosers_calls", Context.MODE_PRIVATE).getBoolean("micFallbackEnabled", false)) }
    var recordingFolderUri by remember { mutableStateOf(RecordingFolderStore.getTreeUri(context)) }
    var folderCheckBusy by remember { mutableStateOf(false) }
    var folderCheckMessage by rememberSaveable { mutableStateOf<String?>(null) }
    val folderCheckScope = rememberCoroutineScope()
    val setupScope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                accessibilityEnabled = DialerShareAutomation.isAccessibilityEnabled(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(setupStep) {
        if (setupStep == 2) {
            repeat(6) {
                accessibilityEnabled = DialerShareAutomation.isAccessibilityEnabled(context)
                if (accessibilityEnabled) return@LaunchedEffect
                delay(500L)
            }
        }
    }
    val finishSetup = { vm.registerDevice {} }
    val permissions = buildList {
        add(Manifest.permission.CALL_PHONE); add(Manifest.permission.READ_PHONE_STATE); add(Manifest.permission.READ_PHONE_NUMBERS); add(Manifest.permission.READ_CALL_LOG)
        add(Manifest.permission.READ_CONTACTS)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.READ_MEDIA_AUDIO) else add(Manifest.permission.READ_EXTERNAL_STORAGE)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
    }.toTypedArray()
    val micPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        micFallbackEnabled = granted
        context.getSharedPreferences("gxclosers_calls", Context.MODE_PRIVATE).edit().putBoolean("micFallbackEnabled", granted).apply()
        if (!granted) setupIssue = "Microphone fallback permission was denied. System dialer folder/MediaStore sync can still be used."
    }
    fun prepareSimSelection() {
        // Telecom/SubscriptionManager can block on emulator and OEM devices.
        // Never run that discovery from a permission callback or Compose click
        // handler; keep the setup screen responsive while it resolves.
        setupScope.launch {
            val options = withContext(Dispatchers.IO) { CallManager.availableSims(context) }
            val saved = CallManager.simSelection(context)
            simOptions = options
            selectedSimId = options.firstOrNull { it.subscriptionId == saved }?.subscriptionId.orEmpty()
            setupStep = 1
        }
    }
    fun continueAfterRecordingSetup() {
        val hasRecordingRoute = accessibilityEnabled ||
            recordingFolderUri != null ||
            micFallbackEnabled ||
            deviceProfile.family == RecordingDeviceFamily.XIAOMI
        if (!hasRecordingRoute && deviceProfile.family == RecordingDeviceFamily.PIXEL) {
            setupIssue = "Enable AI Closer under Android Accessibility or enable Microphone fallback before continuing. Google Phone keeps call recordings private."
            return
        }
        setupStep = 3
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        if (!permissions.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) {
            vm.showError("Allow phone, call history, recording-file, contacts, and notification access to continue setup.")
        } else {
            prepareSimSelection()
        }
    }
    val recordingFolderPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        if (persistRecordingFolder(context, uri)) {
            recordingFolderUri = uri
            folderCheckMessage = null
            setupIssue = null
        } else {
            setupIssue = "Android did not allow persistent access to that folder. Choose the Phone app's recording folder again."
        }
    }
    fun checkRecordingFolder() {
        if (recordingFolderUri == null || folderCheckBusy) return
        folderCheckBusy = true
        folderCheckMessage = null
        folderCheckScope.launch {
            val result = withContext(Dispatchers.IO) { SystemCallRecordingImporter.checkSelectedFolder(context) }
            folderCheckBusy = false
            folderCheckMessage = result?.let {
                "Access confirmed: ${it.fileName}${if (it.durationMs > 0L) " · ${it.durationMs / 1000}s audio" else ""}"
            } ?: "No readable audio file found. Make one test call with recording enabled, then check this folder again."
        }
    }
    fun continueSetup() {
        if (permissions.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) {
            prepareSimSelection()
        } else {
            permissionLauncher.launch(permissions)
        }
    }
    fun continueWithSim() {
        if (selectedSimId.isBlank()) {
            setupIssue = "Select the SIM that should be used for CRM calls."
            return
        }
        CallManager.saveSimSelection(context, selectedSimId)
        setupIssue = null
        setupStep = 2
    }
    fun openPhoneRecordingSettings() {
        val defaultDialerPackage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            context.getSystemService(TelecomManager::class.java)?.defaultDialerPackage
        } else null
        val phoneIntent = defaultDialerPackage
            ?.let { context.packageManager.getLaunchIntentForPackage(it) }
            ?: context.packageManager.getLaunchIntentForPackage("com.google.android.dialer")
            ?: Intent(Intent.ACTION_DIAL)
        runCatching {
            context.startActivity(phoneIntent)
            recordingSettingsOpened = true
            setupPrefs.edit().putBoolean("phoneRecordingSettingsOpened", true).apply()
            setupIssue = null
        }
            .onFailure { vm.showError("Open the Phone app manually and enable Call recording from Phone app settings.") }
    }
    LaunchedEffect(vm.error) {
        vm.error?.let {
            takingOverDevice = false
            setupIssue = it
        }
    }
    val stageTitle = when (setupStep) {
        1 -> "Choose your work SIM"
        2 -> "Connect call recording"
        3 -> "Test this phone"
        else -> "Connect your work phone"
    }
    val stageSubtitle = when (setupStep) {
        1 -> "We’ll sync calls, call history and notifications from your work SIM only."
        2 -> "Enable call recording so AI Closer can analyze your calls and help you close more."
        3 -> "Make a quick 10 second test call to verify recording and sync."
        else -> "Link your work number to start capturing and syncing your calls with AI Closer."
    }
    Page(vertical = true, backdrop = GxBackdropKind.TELEPHONY) {
        when (setupStep) {
            0 -> AiCloserLogoHeader(rightContent = { SetupStepper(step = 0, total = 4) })
            1 -> AiCloserLogoHeader(rightContent = { SetupStepper(step = 1, total = 4, textAbove = true) })
            2 -> {
                AiCloserLogoHeader(rightContent = {
                    Surface(
                        color = Color(0xFF1E2126),
                        shape = CircleShape,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
                        modifier = Modifier.size(42.dp),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Outlined.NotificationsNone, "Notifications", tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                    }
                })
                Text("Step 3 of 4", color = GxMutedText, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            }
            else -> AiCloserLogoHeader()
        }

        Text(
            stageTitle,
            color = Color.White,
            fontSize = 28.sp,
            lineHeight = 34.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.5).sp,
        )
        Text(
            stageSubtitle,
            color = GxMutedText,
            fontSize = 14.sp,
            lineHeight = 20.sp,
        )
        when (setupStep) {
            0 -> {
                DialGaugeHero(step = 0)
                ValuePropItem(
                    icon = Icons.Outlined.SignalCellularAlt,
                    title = "Calls linked to your CRM",
                    subtitle = "Calls, notes and outcomes sync automatically.",
                )
                ValuePropItem(
                    icon = Icons.Outlined.Cloud,
                    title = "Recordings sync automatically",
                    subtitle = "Call recordings are transcribed and synced to your CRM.",
                )
                ValuePropItem(
                    icon = Icons.Outlined.SimCard,
                    title = "Your work SIM stays separate",
                    subtitle = "Keep your personal number private. Only your work calls are captured.",
                )
                Spacer(Modifier.height(8.dp))
                GxPillButton(
                    text = "Start setup",
                    onClick = { continueSetup() },
                    showArrow = true,
                    loading = vm.busy,
                )
            }
            1 -> {
                SimTrayHero()
                if (simOptions.isEmpty()) {
                    SimCardOptionItem(
                        label = "No active SIM found",
                        phoneNumber = null,
                        selected = false,
                        onClick = { prepareSimSelection() },
                    )
                } else {
                    simOptions.forEach { sim ->
                        SimCardOptionItem(
                            label = sim.label,
                            phoneNumber = sim.phoneNumber,
                            selected = selectedSimId == sim.subscriptionId,
                            onClick = { selectedSimId = sim.subscriptionId },
                        )
                    }
                    if (simOptions.size == 1) {
                        SimCardOptionItem(
                            label = "Personal SIM",
                            phoneNumber = null,
                            selected = false,
                            onClick = {},
                        )
                    }
                }

                val phoneAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
                val historyAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
                val notifAllowed = if (Build.VERSION.SDK_INT >= 33) ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED else true
                SetupPermissionsCard(
                    phoneAllowed = phoneAllowed,
                    historyAllowed = historyAllowed,
                    notificationsAllowed = notifAllowed,
                    onRequestPermissions = { permissionLauncher.launch(permissions) },
                )

                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Lock, null, tint = GxMutedText, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Only calls on the selected work SIM are synced.", color = GxMutedText, fontSize = 12.sp)
                }

                GxPillButton(
                    text = "Allow & continue",
                    onClick = { continueWithSim() },
                    showArrow = true,
                    enabled = simOptions.isNotEmpty() && selectedSimId.isNotBlank(),
                    loading = vm.busy,
                )
            }
            2 -> {
                MicRecordingHero()
                var isBatteryExempt by remember { mutableStateOf(DeviceCertificationManager.isBatteryOptimizationExempt(context)) }
                Surface(
                    color = Color(0xFF171A1E),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.fillMaxWidth()) {
                        RecordingRowItem(
                            icon = Icons.Outlined.Phone,
                            title = "Phone recording",
                            subtitle = "Allow call recording access",
                            statusText = if (recordingSettingsOpened) "On" else "Off",
                            isGreen = recordingSettingsOpened,
                            onClick = ::openPhoneRecordingSettings,
                        )
                        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
                        RecordingRowItem(
                            icon = Icons.Outlined.Share,
                            title = "Share automation",
                            subtitle = "Send recordings to AI Closer",
                            statusText = if (accessibilityEnabled) "Connected" else "Off",
                            isGreen = accessibilityEnabled,
                            onClick = {
                                runCatching { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
                                    .onFailure { vm.showError("Open Android Accessibility settings manually and enable AI Closer.") }
                            },
                        )
                        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
                        RecordingRowItem(
                            icon = Icons.Outlined.Folder,
                            title = "Recording folder",
                            subtitle = "Select storage location",
                            statusText = if (recordingFolderUri != null) "Linked" else "Off",
                            isGreen = recordingFolderUri != null,
                            onClick = { recordingFolderPicker.launch(recordingFolderUri) },
                        )
                        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
                        RecordingRowItem(
                            icon = Icons.Outlined.BatteryChargingFull,
                            title = "Battery access",
                            subtitle = "Keep recording in background",
                            statusText = if (isBatteryExempt) "Allowed" else "Off",
                            isGreen = isBatteryExempt,
                            onClick = {
                                if (!isBatteryExempt && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                        data = Uri.parse("package:${context.packageName}")
                                    }
                                    runCatching { context.startActivity(intent) }
                                        .onFailure {
                                            runCatching { context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
                                        }
                                }
                            },
                        )
                        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
                        RecordingRowItem(
                            icon = Icons.Outlined.Mic,
                            title = "Microphone fallback",
                            subtitle = "Use device mic if needed",
                            statusText = if (micFallbackEnabled) "On" else "Off",
                            isGreen = micFallbackEnabled,
                            onClick = {
                                if (!micFallbackEnabled) {
                                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                        micFallbackEnabled = true
                                        context.getSharedPreferences("gxclosers_calls", Context.MODE_PRIVATE).edit().putBoolean("micFallbackEnabled", true).apply()
                                    } else {
                                        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                    }
                                } else {
                                    micFallbackEnabled = false
                                    context.getSharedPreferences("gxclosers_calls", Context.MODE_PRIVATE).edit().putBoolean("micFallbackEnabled", false).apply()
                                }
                            },
                        )
                    }
                }

                Spacer(Modifier.height(4.dp))
                GxPillButton(
                    text = "Continue to phone verification",
                    onClick = { continueAfterRecordingSetup() },
                    showArrow = true,
                    loading = vm.busy,
                    enabled = recordingSettingsOpened || micFallbackEnabled || recordingFolderUri != null || accessibilityEnabled,
                )
            }
            3 -> {
                DialGaugeHero(step = 3, value = "10", label = "sec")
                val isVerified = vm.certificationStatus == DeviceCertificationManager.STATUS_VERIFIED
                val isPartial = vm.certificationStatus == DeviceCertificationManager.STATUS_PARTIAL

                Surface(
                    color = Color(0xFF171A1E),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.fillMaxWidth()) {
                        StatusChecklistRow("Call event captured", checked = isVerified || isPartial || vm.testSessionId != null)
                        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
                        StatusChecklistRow("Work SIM matched", checked = isVerified || (vm.certificationStatus != DeviceCertificationManager.STATUS_UNVERIFIED && vm.certificationFailureReason != DeviceCertificationManager.REASON_WRONG_SIM))
                        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
                        StatusChecklistRow("Recording detected", checked = isVerified)
                        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
                        StatusChecklistRow("Dashboard sync complete", checked = isVerified)
                        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
                        StatusChecklistRow("Ready — Recording & Sync Verified", isBold = true, checked = isVerified)
                    }
                }

                ActionOptionCard(
                    icon = Icons.Outlined.AddIcCall,
                    title = "Dial test call",
                    iconBgColor = GxOrange,
                    onClick = {
                        vm.startTestSession()
                        runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:198"))) }
                    },
                )

                ActionOptionCard(
                    icon = Icons.Outlined.Description,
                    title = "Check result",
                    iconBgColor = Color(0xFF22252A),
                    loading = vm.testSessionBusy,
                    onClick = { vm.evaluateTestCall() },
                )

                GxPillButton(
                    text = if (isVerified) "Finish setup (Certified)" else "Finish setup",
                    onClick = { finishSetup() },
                    loading = vm.busy,
                )

                Text(
                    "Skip for now",
                    color = GxMutedText,
                    fontSize = 13.sp,
                    textDecoration = TextDecoration.Underline,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .clickable { vm.skipTestCertification() },
                )
            }
        }

        setupIssue?.let { issue ->
            Surface(
                color = GxDanger.copy(alpha = 0.08f),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, GxDanger.copy(alpha = 0.40f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, null, tint = GxDanger, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Phone setup needs attention", color = GxDanger, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Text(issue, color = GxText, fontSize = 12.sp, lineHeight = 16.sp)
                    if (issue.contains("linked to another", ignoreCase = true) || issue.contains("registered to another", ignoreCase = true)) {
                        Text(
                            "“Login here” will end the other session and open your account on this phone.",
                            color = GxMuted,
                            fontSize = 11.sp,
                            lineHeight = 15.sp
                        )
                        Spacer(Modifier.height(4.dp))
                        Button(
                            onClick = {
                                takingOverDevice = true
                                vm.registerDevice(force = true) {
                                    takingOverDevice = false
                                    setupIssue = null
                                }
                            },
                            enabled = !vm.busy && !takingOverDevice,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = GxAccent,
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth().height(42.dp)
                        ) {
                            if (takingOverDevice || vm.busy) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.White,
                                )
                            } else {
                                Icon(Icons.Default.Login, null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Login here", fontWeight = FontWeight.Black, fontSize = 13.sp)
                            }
                        }
                    } else {
                        TextButton(
                            onClick = { setupIssue = null; continueSetup() },
                            enabled = !vm.busy,
                            modifier = Modifier.align(Alignment.End)
                        ) {
                            Text("Retry setup", color = GxAccent, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

private data class Tab(val key: String, val label: String, val icon: ImageVector)

@Composable private fun MainScreen(vm: CrmViewModel, nav: NavHostController) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    var showMoreSettings by rememberSaveable { mutableStateOf(false) }
    val tabs = remember(vm.featurePermissions) {
        buildList {
            if (vm.hasFeature("dashboard")) add(Tab("home", "Home", Icons.Default.Home))
            if (vm.hasFeature("crm")) add(Tab("leads", "Leads", Icons.Default.Groups))
            if (vm.hasFeature("calls")) add(Tab("calls", "Calls", Icons.Default.Phone))
            add(Tab("more", "More", Icons.Default.MoreHoriz))
        }
    }
    LaunchedEffect(tabs.size) { if (selected >= tabs.size) selected = 0 }
    val activeTab = tabs.getOrNull(selected)?.key ?: "more"
    LaunchedEffect(activeTab) { if (activeTab != "more") showMoreSettings = false }
    LaunchedEffect(Unit) { if (vm.inbox.isEmpty()) vm.loadInbox(); if (vm.courses.isEmpty()) vm.loadCourses() }
    LaunchedEffect(activeTab) { if (activeTab == "inbox" && vm.inbox.isEmpty()) vm.loadInbox(); if (activeTab == "more" && vm.courses.isEmpty()) vm.loadCourses() }
    Box(Modifier.fillMaxSize().background(GxBackground)) {
        if (activeTab == "more" && !showMoreSettings) {
            MoreScreen(
                vm = vm,
                edit = { nav.navigate("edit-profile") },
                inbox = { nav.navigate("inbox") },
                openSettings = { showMoreSettings = true },
                close = { selected = 0 },
                bottomBar = {
                    GxBottomNav(
                        tabs = tabs,
                        selected = selected,
                        onSelect = { selected = it },
                        modifier = Modifier.align(Alignment.BottomCenter),
                    )
                },
            )
        } else {
            when (activeTab) {
                "home" -> DashboardScreen(
                    vm = vm,
                    grab = { if (vm.hasFeature("crm")) nav.navigate("lead-grab") },
                    calls = { tabs.indexOfFirst { it.key == "calls" }.takeIf { it >= 0 }?.let { selected = it } },
                    inbox = { nav.navigate("inbox") },
                )
                "leads" -> LeadsScreen(vm, { nav.navigate("lead-grab") }) { nav.navigate("lead/${it.id}") }
                "calls" -> CallsScreen(vm) { nav.navigate("disposition/$it") }
                "inbox" -> InboxScreen(vm, open = { item -> item.conversationId?.let { nav.navigate("chat/$it/${Uri.encode(item.lead.customerName)}") } })
                else -> {
                    if (showMoreSettings) {
                        SettingsScreen(
                            vm = vm,
                            edit = { nav.navigate("edit-profile") },
                            inbox = { nav.navigate("inbox") },
                            openLesson = { course, lesson -> nav.navigate("lesson/${course.id}/${lesson.id}") },
                            back = { showMoreSettings = false },
                        )
                    }
                }
            }
            GxBottomNav(
                tabs = tabs,
                selected = selected,
                onSelect = { selected = it },
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

@Composable private fun GxBottomNav(
    tabs: List<Tab>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val navShape = RoundedCornerShape(30.dp)
    Box(
        modifier
            .fillMaxWidth()
            .padding(top = 4.dp, bottom = 4.dp)
            .navigationBarsPadding(),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            color = GxSurface,
            shape = navShape,
            border = BorderStroke(1.dp, GxOutlineSoft),
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
            modifier = Modifier
                .fillMaxWidth(.88f)
                .widthIn(min = 316.dp, max = 560.dp)
                .height(68.dp)
                .shadow(
                    elevation = 12.dp,
                    shape = navShape,
                    clip = false,
                    ambientColor = Color.Black.copy(alpha = .34f),
                    spotColor = Color.Black.copy(alpha = .48f),
                ),
        ) {
            Row(Modifier.padding(horizontal = 8.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                tabs.forEachIndexed { index, tab ->
                    val active = selected == index
                    Column(
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp).clickable { onSelect(index) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        val indicatorSize by animateDpAsState(
                            targetValue = if (active) 42.dp else 30.dp,
                            animationSpec = tween(240),
                            label = "bottom-nav-indicator",
                        )
                        Box(Modifier.size(42.dp), contentAlignment = Alignment.Center) {
                            Box(
                                Modifier
                                    .size(indicatorSize)
                                    .clip(CircleShape)
                                    .background(if (active) GxAccent.copy(alpha = .14f) else Color.Transparent)
                                    .border(BorderStroke(1.dp, if (active) GxAccent.copy(alpha = .42f) else Color.Transparent), CircleShape)
                            )
                            Icon(tab.icon, tab.label, tint = if (active) GxAccent else GxMuted, modifier = Modifier.size(21.dp))
                        }
                        Spacer(Modifier.height(1.dp))
                        Text(tab.label, color = if (active) GxText else GxMuted, fontSize = 10.sp, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium, maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable private fun DashboardScreen(
    vm: CrmViewModel,
    grab: () -> Unit,
    calls: () -> Unit,
    inbox: () -> Unit,
) {
    val data = vm.bootstrap
    val callsToday = data?.calls.orEmpty()
    val talkSeconds = callsToday.sumOf { it.durationSeconds }
    val talkTime = when {
        talkSeconds >= 3600 -> "${talkSeconds / 3600}h ${(talkSeconds % 3600) / 60}m"
        talkSeconds >= 60 -> "${talkSeconds / 60}m"
        else -> "${talkSeconds}s"
    }
    val firstName = data?.agent?.displayName?.substringBefore(' ')?.takeIf(String::isNotBlank)
        ?: vm.session?.displayName?.substringBefore(' ')?.takeIf(String::isNotBlank)
        ?: "Closer"
    val canGrab = data?.agent?.canClaimLeads == true && (data.pendingNotes) == 0
    val recentLeads = data?.leads.orEmpty().take(3)

    Page(backdrop = GxBackdropKind.TELEPHONY, reserveBottomBar = true) {
        GxPremiumHeader(
            greeting = "Good morning, $firstName",
            headline = "Ready to close more today?",
            notificationCount = data?.pendingNotes ?: 0,
        )

        Box(Modifier.fillMaxWidth().height(190.dp), contentAlignment = Alignment.Center) {
            GxCommandDial(
                value = callsToday.size,
                label = "calls today",
                progress = (callsToday.size / 30f).coerceIn(.06f, 1f),
                icon = Icons.Default.Phone,
            )
            GxMetricBubble(talkTime, "talk time", Modifier.align(Alignment.CenterStart).offset(y = 42.dp))
            GxMetricBubble("${data?.dashboard?.activeLeads ?: 0}", "leads", Modifier.align(Alignment.CenterEnd).offset(y = (-36).dp))
        }

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.CloudDone, null, tint = GxSuccess, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                if ((data?.pendingUploads ?: 0) == 0) "Synced just now" else "${data?.pendingUploads} uploads pending",
                color = GxMuted,
                fontSize = 11.sp,
            )
            IconButton(onClick = { vm.refreshAll() }, enabled = !vm.busy, modifier = Modifier.size(34.dp)) {
                Icon(Icons.Default.Refresh, "Refresh", tint = GxMuted, modifier = Modifier.size(17.dp))
            }
        }

        val availableLeads = data?.availableLeadCount ?: 0
        val actionDetail = when {
            (data?.pendingNotes ?: 0) > 0 -> "Complete ${data?.pendingNotes} call notes first"
            availableLeads > 0 -> "$availableLeads leads available"
            else -> "No leads available right now"
        }
        GxPrimaryActionRow(
            title = "Grab leads",
            detail = actionDetail,
            icon = Icons.Default.PhoneCallback,
            enabled = canGrab && availableLeads > 0,
            onClick = grab,
        )

        GxActionStrip(
            actions = listOf(
                GxStripAction(Icons.Default.Phone, "Calls", onClick = calls),
                GxStripAction(Icons.Default.ChatBubbleOutline, "Chats", onClick = inbox),
                GxStripAction(Icons.Default.Sync, "Sync", enabled = !vm.busy, onClick = { vm.refreshAll() }),
            ),
        )

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Recent leads", color = GxText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text("View all", color = GxAccent, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
        if (recentLeads.isEmpty()) {
            GxGlassSurface { Text("No assigned leads yet.", color = GxMuted, fontSize = 13.sp) }
        } else {
            GxGlassSurface(padding = 4.dp) {
                recentLeads.forEachIndexed { index, lead ->
                    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = GxAccent.copy(alpha = .14f), shape = CircleShape, modifier = Modifier.size(38.dp)) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(initials(lead.customerName), color = GxAccent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(lead.customerName, color = GxText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1)
                            Text(lead.serviceInterest.ifBlank { lead.customerPhone }, color = GxMuted, fontSize = 11.sp, maxLines = 1)
                        }
                        Icon(Icons.Default.Phone, "Open lead", tint = GxMuted, modifier = Modifier.size(19.dp))
                    }
                    if (index < recentLeads.lastIndex) HorizontalDivider(color = GxOutlineSoft.copy(alpha = .65f))
                }
            }
        }
    }
}

@Composable private fun LeadsScreen(vm: CrmViewModel, grab: () -> Unit, open: (SalesLead) -> Unit) {
    var search by rememberSaveable { mutableStateOf("") }
    var stageFilter by rememberSaveable { mutableStateOf("ALL") }
    var showAddContact by rememberSaveable { mutableStateOf(false) }
    val leads = vm.bootstrap?.leads.orEmpty()
    val filteredLeads = remember(leads, search, stageFilter) {
        val term = search.trim().lowercase()
        leads.filter { lead ->
            val matchesStage = when (stageFilter) {
                "ALL" -> true
                "NEW" -> lead.stage.equals("NEW", true)
                "FOLLOW_UP" -> lead.stage.contains("FOLLOW", true)
                "CONTACTED" -> lead.stage.contains("CONTACT", true)
                else -> true
            }
            val matchesSearch = term.isBlank() || listOf(lead.customerName, lead.customerPhone, lead.customerEmail, lead.source, lead.serviceInterest, lead.stage).any { it.lowercase().contains(term) }
            matchesStage && matchesSearch
        }
    }

    if (showAddContact) {
        AddContactDialog(
            busy = vm.busy,
            onDismiss = { showAddContact = false },
            onAdd = { name, phone, email, notes ->
                vm.addContact(name, phone, email, notes = notes) {
                    showAddContact = false
                }
            }
        )
    }

    Page(backdrop = GxBackdropKind.CRM, reserveBottomBar = true) {
        GxWorkspaceHeader("Leads", "Manage and follow up with your leads", vm.bootstrap?.pendingNotes ?: 0)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = GxMuted, modifier = Modifier.size(20.dp)) },
                placeholder = { Text("Search leads") },
                singleLine = true,
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.weight(1f),
            )
            Box(
                Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(GxSurface)
                    .border(BorderStroke(1.dp, GxOutlineSoft), RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center,
            ) {
                IconButton(onClick = { stageFilter = if (stageFilter == "ALL") "FOLLOW_UP" else "ALL" }) {
                    Icon(Icons.Default.FilterList, "Filter leads", tint = GxText, modifier = Modifier.size(21.dp))
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("ALL" to "All", "NEW" to "New", "FOLLOW_UP" to "Follow-up", "CONTACTED" to "Contacted").forEach { (value, label) ->
                FilterChip(
                    selected = stageFilter == value,
                    onClick = { stageFilter = value },
                    label = { Text(label, fontSize = 11.sp, maxLines = 1) },
                    shape = RoundedCornerShape(50),
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = GxSurface,
                        labelColor = GxText,
                        selectedContainerColor = GxAccent,
                        selectedLabelColor = Color.White,
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = stageFilter == value,
                        borderColor = if (stageFilter == value) GxAccent else GxOutlineSoft,
                    ),
                    modifier = Modifier.weight(1f),
                )
            }
        }
        val availableLeads = vm.bootstrap?.availableLeadCount ?: 0
        val canGrab = vm.bootstrap?.agent?.canClaimLeads == true && (vm.bootstrap?.pendingNotes ?: 0) == 0 && availableLeads > 0
        val grabDetail = when {
            (vm.bootstrap?.pendingNotes ?: 0) > 0 -> "Complete pending call notes first"
            vm.bootstrap?.agent?.canClaimLeads != true -> "Complete required learning to unlock"
            availableLeads > 0 -> "$availableLeads leads waiting to be claimed"
            else -> "No unassigned leads right now"
        }
        GxPrimaryActionRow(
            title = "Grab leads",
            detail = grabDetail,
            icon = Icons.Default.PhoneCallback,
            enabled = canGrab,
            onClick = grab,
        )
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("${filteredLeads.size} leads", color = GxText, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            TextButton(onClick = { showAddContact = true }, contentPadding = PaddingValues(horizontal = 4.dp, vertical = 2.dp)) {
                Box(
                    Modifier
                        .size(30.dp)
                        .clip(CircleShape)
                        .border(BorderStroke(1.dp, GxText.copy(alpha = .7f)), CircleShape),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Default.Add, null, tint = GxText, modifier = Modifier.size(18.dp)) }
                Spacer(Modifier.width(7.dp))
                Text("Add contact", color = GxText, fontSize = 12.sp)
            }
        }
        if (filteredLeads.isEmpty()) {
            EmptyCard(if (leads.isEmpty()) "No leads assigned yet." else "No leads match this search and status.")
        } else {
            Column(Modifier.fillMaxWidth()) {
                filteredLeads.forEachIndexed { index, lead ->
                    Row(
                        Modifier.fillMaxWidth().clickable { open(lead) }.padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(42.dp).clip(CircleShape).background(GxText.copy(alpha = .09f)),
                            contentAlignment = Alignment.Center,
                        ) { Text(initials(lead.customerName), color = GxText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp) }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(lead.customerName, color = GxText, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(lead.serviceInterest.ifBlank { lead.customerPhone.ifBlank { "CRM lead" } }, color = GxMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            StatusPill(leadStageLabel(lead.stage), leadStageColor(lead.stage))
                            if (lead.priority.equals("HIGH", true) || lead.priority.equals("URGENT", true)) {
                                Text("🔥 ${lead.priority.replaceFirstChar { it.uppercase() }}", color = GxAccent, fontSize = 10.sp)
                            }
                        }
                        Spacer(Modifier.width(8.dp))
                        Box(
                            Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .border(BorderStroke(1.dp, GxOutlineSoft), CircleShape)
                                .clickable { open(lead) },
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Default.Phone, "Open ${lead.customerName}", tint = GxText, modifier = Modifier.size(19.dp)) }
                    }
                    if (index < filteredLeads.lastIndex) HorizontalDivider(color = GxOutlineSoft.copy(alpha = .7f))
                }
            }
        }
        TextButton(onClick = { vm.refreshAll() }, enabled = !vm.busy, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Icon(Icons.Default.Refresh, null, Modifier.size(17.dp))
            Spacer(Modifier.width(7.dp))
            Text(if (vm.busy) "Refreshing…" else "Refresh leads")
        }
    }
}

@Composable private fun CallsScreen(vm: CrmViewModel, disposition: (String) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var accessibilityEnabled by remember { mutableStateOf(DialerShareAutomation.isAccessibilityEnabled(context)) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                accessibilityEnabled = DialerShareAutomation.isAccessibilityEnabled(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val data = vm.bootstrap
    Page(backdrop = GxBackdropKind.TELEPHONY, reserveBottomBar = true) {
        GxWorkspaceHeader("Calls", "Recordings and call history", data?.pendingNotes ?: 0)

        if (vm.certificationStatus != DeviceCertificationManager.STATUS_VERIFIED) {
            GxCard(accent = true) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, null, tint = GxWarning, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Column(Modifier.weight(1f)) {
                        Text("PHONE UNCERTIFIED", color = GxWarning, fontSize = 11.sp, fontWeight = FontWeight.Black)
                        Text(
                            when (vm.certificationStatus) {
                                DeviceCertificationManager.STATUS_TESTING -> "Test session in progress. Place a 10s call on work SIM."
                                DeviceCertificationManager.STATUS_PARTIAL -> "Make one test call to verify audio recording sync."
                                DeviceCertificationManager.STATUS_ACTION_REQUIRED -> "Recording setup needs attention. Run verification."
                                else -> "Phone uncertified — make one test call to verify recording."
                            },
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    StatusPill(
                        vm.certificationStatus,
                        if (vm.certificationStatus == DeviceCertificationManager.STATUS_PARTIAL) GxWarning else GxDanger
                    )
                }
                vm.certificationFailureReason?.let { reason ->
                    Text(
                        when (reason) {
                            DeviceCertificationManager.REASON_CALL_NOT_DETECTED -> "Last issue: No call detected during test session."
                            DeviceCertificationManager.REASON_WRONG_SIM -> "Last issue: Call placed on personal or unconfigured SIM."
                            DeviceCertificationManager.REASON_RECORDING_NOT_FOUND -> "Last issue: No recording file found."
                            DeviceCertificationManager.REASON_AUDIO_UNREADABLE -> "Last issue: Audio file unreadable or < 1KB."
                            DeviceCertificationManager.REASON_UPLOAD_FAILED -> "Last issue: Audio upload to CRM failed."
                            DeviceCertificationManager.REASON_DASHBOARD_SYNC_FAILED -> "Last issue: Sync could not link recording to call."
                            else -> "Last issue: $reason"
                        },
                        color = GxMuted,
                        fontSize = 11.sp
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            vm.startTestSession()
                            runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:198"))) }
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Default.Phone, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Dial test call", fontSize = 12.sp)
                    }
                    Button(
                        onClick = { vm.evaluateTestCall() },
                        enabled = !vm.testSessionBusy,
                        colors = ButtonDefaults.buttonColors(containerColor = GxAccent),
                        modifier = Modifier.weight(1f),
                    ) {
                        if (vm.testSessionBusy) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = Color.White)
                        } else {
                            Icon(Icons.Default.CheckCircle, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Verify now", fontSize = 12.sp)
                        }
                    }
                }
                vm.testSessionMessage?.let { msg ->
                    Text(msg, color = if (vm.certificationStatus == DeviceCertificationManager.STATUS_VERIFIED) GxSuccess else GxWarning, fontSize = 11.sp)
                }
            }
        }

        CallHistoryPreview(data?.calls.orEmpty(), vm, disposition)

        if (!accessibilityEnabled) {
            GxCard(accent = true) {
                Text("RECORDING BRIDGE NEEDS ATTENTION", color = GxWarning, fontSize = 10.sp, fontWeight = FontWeight.Black)
                Text("Pixel/Google Phone recordings are private until AI Closer is allowed to use the visible Share flow.", fontWeight = FontWeight.Black)
                Text("After an APK update, Android may turn this protected service off. Enable it before making the next test call; otherwise the call can appear without audio.", color = GxMuted, fontSize = 11.sp, lineHeight = 16.sp)
                OutlinedButton(
                    onClick = {
                        runCatching { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Default.Accessibility, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Open Accessibility settings")
                }
            }
        }

        vm.pendingSharedRecording?.let { pending ->
            val attachableCalls = data?.calls.orEmpty()
                .filter { it.status.equals("COMPLETED", ignoreCase = true) && it.recordingStatus != "UPLOADED" }
                .take(8)
            GxCard(accent = true) {
                Text("SHARED RECORDING", color = GxAccent, fontSize = 10.sp, fontWeight = FontWeight.Black)
                Text("${pending.displayName} is ready to attach.", fontWeight = FontWeight.Black)
                Text(
                    if (pending.durationMs > 0L) "${pending.durationMs / 1000L}s audio • choose the matching completed call below."
                    else "Audio imported • choose the matching completed call below.",
                    color = GxMuted,
                    fontSize = 11.sp,
                )
                if (attachableCalls.isEmpty()) {
                    Text("No completed calls are available yet. Sync calls first.", color = GxWarning, fontSize = 11.sp)
                } else {
                    attachableCalls.forEach { call ->
                        SecondaryButton(
                            "Attach to ${call.assignment?.customerName ?: call.phoneNumber}",
                            vm.busy,
                        ) { vm.attachSharedRecording(call) }
                    }
                }
                TextButton(onClick = { vm.discardSharedRecording() }, enabled = !vm.busy) {
                    Text("Discard import", color = GxMuted)
                }
            }
        }

        GxCard {
            Text("SYNC & QUEUE STATUS", color = GxAccent, fontSize = 10.sp, fontWeight = FontWeight.Black)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QueueMetric("${vm.syncCounts.pending}", "Pending", Modifier.weight(1f))
                QueueMetric("${vm.syncCounts.syncing}", "Syncing", Modifier.weight(1f), GxWarning)
                QueueMetric("${vm.syncCounts.synced}", "Synced", Modifier.weight(1f), GxSuccess)
                QueueMetric("${vm.syncCounts.failed}", "Failed", Modifier.weight(1f), if (vm.syncCounts.failed > 0) GxDanger else GxMuted)
            }
            if (vm.syncCounts.failed > 0) {
                SecondaryButton("Retry failed sync (${vm.syncCounts.failed})", vm.busy) {
                    vm.retryOfflineSync()
                }
            }
        }

        GxCard {
            Text(if ((data?.pendingUploads ?: 0) > 0) "${data?.pendingUploads} upload(s) waiting in queue" else "Recording upload queue is clear", fontWeight = FontWeight.Black)
            Text(if ((data?.pendingNotes ?: 0) > 0) "${data?.pendingNotes} mandatory disposition(s) due" else "All completed calls have notes.", color = GxMuted)
            if ((data?.pendingNotes ?: 0) > 0) {
                val pendingCall = data?.calls.orEmpty().firstOrNull { it.note.isNullOrBlank() }
                SecondaryButton("Complete pending call notes", vm.busy) {
                    pendingCall?.id?.let(disposition)
                }
            }
            if ((data?.pendingUploads ?: 0) > 0) {
                SecondaryButton("Retry audio uploads now", vm.busy) {
                    vm.retryPendingRecordings()
                }
            }
        }

        val hasPlayableRecordings = data?.calls.orEmpty().any { it.recordingStatus == "UPLOADED" }
        if (hasPlayableRecordings) GxCard {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("RECORDING SPEED", color = GxAccent, fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(1.0f to "1.0X", 1.5f to "1.5X", 2.0f to "2.0X", 3.0f to "3.0X").forEach { (speed, label) ->
                        FilterChip(
                            selected = vm.playbackSpeed == speed,
                            onClick = { vm.setSpeed(speed) },
                            label = { Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                        )
                    }
                }
            }
        }

        if (data?.calls.isNullOrEmpty()) EmptyCard("No sales calls logged yet. Open an assigned lead to start a tracked call.")
        SecondaryButton("Sync calls now", vm.busy) { vm.refreshAll() }
    }
}

@Composable
private fun CallHistoryPreview(calls: List<MobileCall>, vm: CrmViewModel, disposition: (String) -> Unit) {
    if (calls.isEmpty()) return
    var filter by rememberSaveable { mutableStateOf("OUTBOUND") }
    var expandedCallId by rememberSaveable { mutableStateOf<String?>(null) }
    val featured = calls.first()
    val secondary = calls.drop(1)
    val featuredName = featured.assignment?.customerName ?: featured.phoneNumber
    val featuredDuration = formatCallDuration(featured.durationSeconds)
    val featuredStatus = if (featured.recordingStatus == "UPLOADED") "Recording synced" else recordingStatusLabel(featured.recordingStatus)
    val mutedColor = GxMuted

    GxGlassSurface(radius = 24.dp, padding = 16.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(42.dp).clip(CircleShape).background(GxText.copy(alpha = .10f)),
                contentAlignment = Alignment.Center,
            ) { Text(initials(featuredName), color = GxText, fontSize = 15.sp, fontWeight = FontWeight.SemiBold) }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(featuredName, color = GxText, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("↗ Outgoing · $featuredDuration", color = GxMuted, fontSize = 11.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Icon(Icons.Default.CloudDone, null, tint = if (featured.recordingStatus == "UPLOADED") GxSuccess else GxMuted, modifier = Modifier.size(17.dp))
                Text(featuredStatus, color = GxMuted, fontSize = 10.sp, maxLines = 1)
            }
        }
        Canvas(Modifier.fillMaxWidth().height(46.dp).padding(top = 8.dp)) {
            val bars = List(42) { index ->
                val base = 0.18f + ((index * 17) % 9) / 24f
                (base + if (index in 4..15) .28f else 0f).coerceIn(.16f, .90f)
            }
            val gap = size.width / (bars.size * 1.55f)
            bars.forEachIndexed { index, value ->
                val x = gap * (index + .75f)
                val half = size.height * value / 2f
                drawLine(
                    color = if (index < bars.size * .30f) GxAccent else mutedColor.copy(alpha = .34f),
                    start = Offset(x, size.height / 2f - half),
                    end = Offset(x, size.height / 2f + half),
                    strokeWidth = 3.2f,
                )
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("0:36", color = GxText, fontSize = 10.sp)
            Spacer(Modifier.width(8.dp))
            LinearProgressIndicator(
                progress = { .27f },
                modifier = Modifier.weight(1f).height(3.dp),
                color = GxAccent,
                trackColor = GxMuted.copy(alpha = .18f),
            )
            Spacer(Modifier.width(8.dp))
            Text(featuredDuration, color = GxText, fontSize = 10.sp)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = {}, modifier = Modifier.size(42.dp)) { Icon(Icons.Default.Replay10, "Rewind 10 seconds", tint = GxText) }
            Box(
                Modifier.size(56.dp).clip(CircleShape).background(GxAccent).clickable { vm.playRecording(featured.id) },
                contentAlignment = Alignment.Center,
            ) {
                Icon(if (vm.playingCallId == featured.id) Icons.Default.Pause else Icons.Default.PlayArrow, "Play recording", tint = Color.White, modifier = Modifier.size(26.dp))
            }
            IconButton(onClick = {}, modifier = Modifier.size(42.dp)) { Icon(Icons.Default.Forward10, "Forward 10 seconds", tint = GxText) }
        }
    }

    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(GxSurface).border(BorderStroke(1.dp, GxOutlineSoft), RoundedCornerShape(50)).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        listOf("INBOUND" to "Inbound", "OUTBOUND" to "Outbound", "MISSED" to "Missed").forEach { (value, label) ->
            Box(
                Modifier.weight(1f).clip(RoundedCornerShape(50)).background(if (filter == value) GxAccent.copy(alpha = .13f) else Color.Transparent).clickable { filter = value }.padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) { Text(label, color = if (filter == value) GxAccent else GxText, fontSize = 11.sp, fontWeight = if (filter == value) FontWeight.SemiBold else FontWeight.Normal) }
        }
    }

    Column(Modifier.fillMaxWidth()) {
        secondary.forEachIndexed { index, call ->
            val name = call.assignment?.customerName ?: call.phoneNumber
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .clickable { expandedCallId = if (expandedCallId == call.id) null else call.id }
                    .padding(vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(36.dp).clip(CircleShape).background(if (call.status.equals("MISSED", true)) GxDanger.copy(alpha = .10f) else GxSuccess.copy(alpha = .10f)), contentAlignment = Alignment.Center) {
                    Icon(if (call.status.equals("MISSED", true)) Icons.Default.CallReceived else Icons.Default.CallMade, null, tint = if (call.status.equals("MISSED", true)) GxDanger else GxSuccess, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(name, color = GxText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(formatDate(call.startedAt), color = GxMuted, fontSize = 10.sp)
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(formatCallDuration(call.durationSeconds), color = GxText, fontSize = 11.sp)
                    Text(recordingStatusLabel(call.recordingStatus), color = if (call.recordingStatus == "UPLOADED") GxSuccess else GxMuted, fontSize = 10.sp)
                }
                Icon(Icons.Default.ChevronRight, null, tint = GxMuted, modifier = Modifier.size(18.dp))
            }
            if (expandedCallId == call.id) {
                CallDetailActions(call, vm, disposition)
            }
            if (index < secondary.lastIndex) HorizontalDivider(color = GxOutlineSoft.copy(alpha = .65f))
        }
    }
}

@Composable
private fun CallDetailActions(call: MobileCall, vm: CrmViewModel, disposition: (String) -> Unit) {
    GxGlassSurface(
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
        radius = 18.dp,
        padding = 12.dp,
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                recordingStatusLabel(call.recordingStatus),
                modifier = Modifier.weight(1f),
                color = when (call.recordingStatus) {
                    "UPLOADED" -> GxSuccess
                    "UPLOADING", "LOCAL_PENDING" -> GxWarning
                    "FAILED" -> GxDanger
                    else -> GxMuted
                },
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
            if (call.recordingStatus == "UPLOADED") {
                Text("${vm.playbackSpeed}x", color = GxAccent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (call.recordingStatus == "UPLOADED") {
            SecondaryButton(
                when {
                    vm.playbackLoadingCallId == call.id -> "Loading audio…"
                    vm.playingCallId == call.id -> "Pause recording"
                    else -> "Play recording"
                },
                vm.playbackLoadingCallId == call.id,
            ) { vm.playRecording(call.id) }
        }
        call.recordingError?.let { Text(it, color = GxDanger, fontSize = 11.sp) }
        if (call.note.isNullOrBlank()) {
            PrimaryButton("Add call notes & outcome", false) { disposition(call.id) }
        } else {
            Text(call.outcome.orEmpty().replace('_', ' '), color = GxAccent, fontWeight = FontWeight.Bold)
            Text(call.note, color = GxMuted)
        }
    }
}

private fun formatCallDuration(seconds: Int): String = "%d:%02d".format(seconds / 60, seconds % 60)

@Composable private fun InboxScreen(vm: CrmViewModel, open: (InboxItem) -> Unit, back: (() -> Unit)? = null) {
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
        if (back == null) {
            GxWorkspaceHeader(
                "Inbox",
                "Your conversations and follow-ups",
                vm.bootstrap?.pendingNotes ?: 0,
                action = {
                    Box(
                        Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(GxSurface)
                            .border(BorderStroke(1.dp, GxOutlineSoft), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        IconButton(onClick = { vm.loadInbox() }, enabled = !vm.inboxLoading) {
                            Icon(Icons.Default.Refresh, "Refresh inbox", tint = GxText, modifier = Modifier.size(20.dp))
                        }
                    }
                },
            )
        }
        else HeaderWithBack("Inbox", "Only conversations linked to your assigned leads", back)
        OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            leadingIcon = { Icon(Icons.Default.Search, null, tint = GxMuted) },
            placeholder = { Text("Search conversations") },
            singleLine = true,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(50))
                .background(GxSurface)
                .border(BorderStroke(1.dp, GxOutlineSoft), RoundedCornerShape(50))
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            listOf("ALL" to "All", "PRIORITY" to "Priority", "FOLLOW_UP" to "Follow-up").forEach { (value, title) ->
                Box(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(50))
                        .background(if (filter == value) GxAccent.copy(alpha = .13f) else Color.Transparent)
                        .clickable { filter = value }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(title, color = if (filter == value) GxAccent else GxText, fontSize = 11.sp, fontWeight = if (filter == value) FontWeight.SemiBold else FontWeight.Normal)
                }
            }
        }
        Column(Modifier.fillMaxWidth()) {
            if (vm.inboxLoading && filteredInbox.isEmpty()) repeat(4) { index ->
                InboxLoadingRow()
                if (index < 3) HorizontalDivider(Modifier.padding(start = 62.dp), color = GxMuted.copy(alpha = .10f))
            }
            filteredInbox.forEachIndexed { index, item ->
                if (index == 0) {
                    GxGlassSurface(modifier = Modifier.fillMaxWidth(), radius = 20.dp, padding = 0.dp) {
                        InboxConversationRow(item, onClick = { open(item) }, featured = true)
                    }
                } else {
                    InboxConversationRow(item, onClick = { open(item) })
                }
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

@Composable
private fun MoreScreen(
    vm: CrmViewModel,
    edit: () -> Unit,
    inbox: () -> Unit,
    openSettings: () -> Unit,
    close: () -> Unit,
    bottomBar: @Composable BoxScope.() -> Unit,
) {
    val session = vm.session
    val themeMode = LocalThemeMode.current
    val setThemeMode = LocalThemeModeChange.current
    val dark = MaterialTheme.colorScheme.background.luminance() < .5f
    var drawerOpen by remember { mutableStateOf(false) }
    val drawerProgress by animateFloatAsState(
        targetValue = if (drawerOpen) .72f else 0f,
        animationSpec = tween(320),
        label = "more-drawer-progress",
    )
    LaunchedEffect(Unit) { drawerOpen = true }

    Box(Modifier.fillMaxSize()) {
        if (vm.hasFeature("dashboard")) {
            DashboardScreen(vm = vm, grab = {}, calls = {}, inbox = inbox)
        } else {
            Page(backdrop = GxBackdropKind.NEUTRAL) {
                GxWorkspaceHeader("More", "Your workspace and account")
            }
        }
        bottomBar()
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = if (dark) .48f else .25f))
                .clickable { close() },
        )
        Box(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(drawerProgress)
                .clip(RoundedCornerShape(topEnd = 30.dp, bottomEnd = 30.dp))
                .background(if (dark) Color(0xFF24282D).copy(alpha = .98f) else Color(0xFFFFFEFC).copy(alpha = .98f))
                .border(BorderStroke(1.dp, if (dark) Color.White.copy(alpha = .10f) else GxText.copy(alpha = .10f)), RoundedCornerShape(topEnd = 30.dp, bottomEnd = 30.dp)),
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 22.dp, vertical = 24.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Image(
                        painter = painterResource(com.gigxomi.gxclosers.R.drawable.ic_ai_closer_logo),
                        contentDescription = "AI Closer",
                        modifier = Modifier.size(38.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("Closer", color = GxText, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(52.dp).clip(CircleShape).background(GxText.copy(alpha = .10f)),
                        contentAlignment = Alignment.Center,
                    ) { Text(initials(session?.displayName ?: "Sales closer"), color = GxText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold) }
                    Spacer(Modifier.width(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(session?.displayName ?: "Sales closer", color = GxText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text("Sales closer", color = GxMuted, fontSize = 12.sp)
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 18.dp), color = GxOutlineSoft)

                DrawerSectionLabel("WORK")
                DrawerItem(Icons.Default.MailOutline, "Inbox") { inbox() }
                DrawerItem(Icons.Default.PhoneAndroid, "Device diagnostics") { openSettings() }
                DrawerSectionLabel("ACCOUNT", Modifier.padding(top = 14.dp))
                DrawerItem(Icons.Default.PersonOutline, "Profile") { edit() }
                DrawerItem(Icons.Default.Settings, "Settings") { openSettings() }
                DrawerSectionLabel("WORKSPACE", Modifier.padding(top = 14.dp))
                DrawerItem(Icons.Default.CreditCard, "Payments") { }
                DrawerItem(Icons.Default.HelpOutline, "Help & support") { }

                Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.LightMode, null, tint = GxText, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(12.dp))
                    Text("Appearance", color = GxText, fontSize = 14.sp, modifier = Modifier.weight(1f))
                }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(50))
                        .background(GxSurface2)
                        .border(BorderStroke(1.dp, GxOutlineSoft), RoundedCornerShape(50))
                        .padding(3.dp),
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    listOf(ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM).forEach { mode ->
                        Box(
                            Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(50))
                                .background(if (themeMode == mode) GxSurface else Color.Transparent)
                                .clickable { setThemeMode(mode) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) { Text(mode.name.lowercase().replaceFirstChar(Char::uppercase), color = if (themeMode == mode) GxText else GxMuted, fontSize = 10.sp) }
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 12.dp), color = GxOutlineSoft)
                DrawerItem(Icons.Default.Logout, "Log out", danger = true) { vm.logout(close) }
            }
        }
    }
}

@Composable
private fun DrawerSectionLabel(label: String, modifier: Modifier = Modifier) {
    Text(label, color = GxMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = .7.sp, modifier = modifier.padding(bottom = 3.dp))
}

@Composable
private fun DrawerItem(icon: ImageVector, label: String, danger: Boolean = false, onClick: () -> Unit) {
    val color = if (danger) GxDanger else GxText
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, label, tint = color, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Text(label, color = color, fontSize = 14.sp, modifier = Modifier.weight(1f))
        if (!danger) Icon(Icons.Default.ChevronRight, null, tint = GxMuted, modifier = Modifier.size(18.dp))
    }
}

@Composable private fun SettingsScreen(
    vm: CrmViewModel,
    edit: () -> Unit,
    inbox: () -> Unit,
    openLesson: (Course, Lesson) -> Unit,
    back: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val session = vm.session
    val data = vm.bootstrap
    val agent = data?.agent
    val themeMode = LocalThemeMode.current
    val setThemeMode = LocalThemeModeChange.current
    var simOptions by remember { mutableStateOf<List<SimOption>>(emptyList()) }
    var simSelection by rememberSaveable { mutableStateOf(CallManager.simSelection(context)) }
    var recordingFolderUri by remember { mutableStateOf(RecordingFolderStore.getTreeUri(context)) }
    var folderCheckBusy by remember { mutableStateOf(false) }
    var folderCheckMessage by rememberSaveable { mutableStateOf<String?>(null) }
    val folderCheckScope = rememberCoroutineScope()
    val recordingFolderPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        if (persistRecordingFolder(context, uri)) {
            recordingFolderUri = uri
            folderCheckMessage = null
        }
    }
    fun checkRecordingFolder() {
        if (recordingFolderUri == null || folderCheckBusy) return
        folderCheckBusy = true
        folderCheckMessage = null
        folderCheckScope.launch {
            val result = withContext(Dispatchers.IO) { SystemCallRecordingImporter.checkSelectedFolder(context) }
            folderCheckBusy = false
            folderCheckMessage = result?.let {
                "Access confirmed: ${it.fileName}${if (it.durationMs > 0L) " · ${it.durationMs / 1000}s audio" else ""}"
            } ?: "No readable audio file found. Make one test call with recording enabled, then check this folder again."
        }
    }
    LaunchedEffect(Unit) { simOptions = CallManager.availableSims(context) }
    Page(backdrop = GxBackdropKind.NEUTRAL) {
        if (back != null) {
            HeaderWithBack("Settings", "Your sales workspace and phone setup", back)
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { BrandHeader("Profile & settings", "Your sales workspace and phone setup") }
                FilledIconButton(onClick = edit, colors = IconButtonDefaults.filledIconButtonColors(containerColor = GxSurface2, contentColor = GxAccent)) { Icon(Icons.Default.Edit, "Edit profile") }
            }
        }
        GxCard(accent = true) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.size(76.dp)) {
                    Surface(color = GxAccent.copy(alpha = .14f), shape = CircleShape, modifier = Modifier.fillMaxSize()) {}
                    Text(initials(session?.displayName ?: "Sales agent"), color = GxAccent, fontSize = 21.sp, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(session?.displayName ?: "Sales agent", fontWeight = FontWeight.SemiBold, fontSize = 21.sp)
                    Text("Sales executive", color = GxMuted, fontSize = 13.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { StatusPill("ACTIVE", GxSuccess); if (agent?.canClaimLeads == true) StatusPill("LEADS UNLOCKED", GxAccent) }
                }
            }
        }
        if (vm.hasFeature("conversations")) GxCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = GxAccent.copy(alpha = .14f), shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Default.Chat, null, tint = GxAccent, modifier = Modifier.padding(11.dp).size(22.dp))
                }
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text("Team inbox", fontWeight = FontWeight.Black)
                    Text("Review assigned conversations and reply", color = GxMuted, fontSize = 11.sp)
                }
                OutlinedButton(onClick = inbox, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)) { Text("Open") }
            }
        }
        GxCard {
            SectionHeading(Icons.Default.Palette, "Appearance")
            Text("Choose how AI Closer looks on this phone.", color = GxMuted, fontSize = 12.sp)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf(ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM).forEachIndexed { index, mode ->
                    SegmentedButton(
                        selected = themeMode == mode,
                        onClick = { setThemeMode(mode) },
                        shape = SegmentedButtonDefaults.itemShape(index, ThemeMode.entries.size),
                        label = { Text(mode.name.lowercase().replaceFirstChar(Char::uppercase), fontSize = 11.sp) },
                    )
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
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
            GxCard {
                SectionHeading(Icons.Default.Folder, "Call recording folder")
                Text(
                    "TeleCRM-style sync reads the recording created by the Phone app. Choose the folder where that app saves completed call recordings.",
                    color = GxMuted,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                )
                Text(
                    "How to find it: make a short recorded call, open Files, locate the newest audio file, and select the folder containing it. Pixel/Google Phone may keep recordings private and unavailable to other apps.",
                    color = GxMuted,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                )
                OutlinedButton(
                    onClick = { recordingFolderPicker.launch(recordingFolderUri) },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Default.Folder, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (recordingFolderUri == null) "Select recording folder" else "Change recording folder")
                }
                SecondaryButton("Check selected folder", folderCheckBusy, recordingFolderUri != null) { checkRecordingFolder() }
                Text(
                    if (recordingFolderUri == null) "No folder linked. GXClosers will try Android's automatic audio library scan; private OEM recordings may require Share/Export to a visible folder."
                    else "Folder linked. New system-dialer recordings will be matched and uploaded after each call.",
                    color = if (recordingFolderUri == null) GxWarning else GxSuccess,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                )
                folderCheckMessage?.let { message ->
                    Text(message, color = if (message.startsWith("Access confirmed")) GxSuccess else GxWarning, fontSize = 11.sp, lineHeight = 16.sp)
                }
            }
            var testPhoneBusy by remember { mutableStateOf(false) }
            var testPhoneResult by rememberSaveable { mutableStateOf<String?>(null) }
            val diagScope = rememberCoroutineScope()
            GxCard {
                val diag = remember { DeviceDiagnostics.snapshot(context) }
                SectionHeading(Icons.Default.Analytics, "Device capability & diagnostics")
                Text(
                    "Hardware capability probe for call tracking and recording sync.",
                    color = GxMuted,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                )
                CustomerFact(Icons.Default.PhoneAndroid, "Model", "${diag.optString("manufacturer")} ${diag.optString("model")} (Android ${diag.optString("androidVersion")})")
                CustomerFact(Icons.Default.Call, "Dialer", diag.optString("defaultDialer").ifBlank { "System default dialer" })
                val capability = diag.optString("recordingCapability")
                val capabilityLabel = when (capability) {
                    "SYSTEM_FOLDER_OR_MEDIASTORE" -> "Automatic native dialer recording"
                    "DIALER_SHARE" -> "Dialer Share automation"
                    "MICROPHONE_FALLBACK" -> "Microphone fallback active"
                    else -> "Setup required"
                }
                CustomerFact(Icons.Default.Mic, "Recording route", capabilityLabel)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = {
                            testPhoneBusy = true
                            testPhoneResult = null
                            diagScope.launch {
                                delay(600L)
                                val current = DeviceDiagnostics.snapshot(context)
                                val hasPhone = current.optBoolean("permissionPhoneState") && current.optBoolean("permissionCallLog")
                                val hasRec = current.optString("recordingCapability") != "UNAVAILABLE"
                                testPhoneBusy = false
                                testPhoneResult = when {
                                    !hasPhone -> "Phone or Call Log permission missing. Re-open Setup to grant access."
                                    !hasRec -> "Recording route unavailable. Check phone dialer recording settings."
                                    else -> "Device verified: ready for automated CRM call tracking & sync."
                                }
                                DeviceDiagnostics.enqueueSnapshot(context, force = true)
                            }
                        },
                        modifier = Modifier.weight(1f).height(42.dp),
                        shape = RoundedCornerShape(12.dp),
                        enabled = !testPhoneBusy,
                    ) {
                        Icon(Icons.Default.Speed, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(if (testPhoneBusy) "Checking..." else "Test this phone", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = {
                            runCatching {
                                val current = DeviceDiagnostics.snapshot(context)
                                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_SUBJECT, "AI Closer Diagnostics - ${Build.MODEL}")
                                    putExtra(Intent.EXTRA_TEXT, current.toString(2))
                                }
                                context.startActivity(Intent.createChooser(shareIntent, "Share Diagnostics"))
                            }
                        },
                        modifier = Modifier.weight(1f).height(42.dp),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Icon(Icons.Default.Share, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Export report", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                testPhoneResult?.let { result ->
                    val isPass = result.startsWith("Device verified")
                    Surface(
                        color = (if (isPass) GxSuccess else GxDanger).copy(alpha = 0.12f),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, (if (isPass) GxSuccess else GxDanger).copy(alpha = 0.35f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            result,
                            color = if (isPass) GxSuccess else GxDanger,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(10.dp),
                        )
                    }
                }
            }
            GxCard {
                SectionHeading(Icons.Default.SimCard, "Calling SIM")
                Text("Choose the SIM used for outbound CRM calls. Recordings stay linked to the selected call session.", color = GxMuted, fontSize = 12.sp, lineHeight = 17.sp)
                if (simOptions.isEmpty()) {
                    Text("No active SIM details are available. Allow phone access in setup.", color = GxWarning, fontSize = 12.sp)
                } else {
                    simOptions.forEach { sim ->
                        Row(
                            Modifier.fillMaxWidth().clickable {
                                simSelection = sim.subscriptionId
                                CallManager.saveSimSelection(context, sim.subscriptionId)
                            },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = simSelection == sim.subscriptionId,
                                onClick = {
                                    simSelection = sim.subscriptionId
                                    CallManager.saveSimSelection(context, sim.subscriptionId)
                                },
                            )
                            Column(Modifier.weight(1f)) {
                                Text(sim.label, fontWeight = FontWeight.Bold)
                                sim.phoneNumber?.takeIf(String::isNotBlank)?.let { Text(it, color = GxMuted, fontSize = 11.sp) }
                            }
                        }
                    }
                }
                Row(
                    Modifier.fillMaxWidth().clickable {
                        simSelection = CallManager.SIM_SELECTION_ASK
                        CallManager.saveSimSelection(context, CallManager.SIM_SELECTION_ASK)
                    },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(
                        selected = simSelection == CallManager.SIM_SELECTION_ASK,
                        onClick = {
                            simSelection = CallManager.SIM_SELECTION_ASK
                            CallManager.saveSimSelection(context, CallManager.SIM_SELECTION_ASK)
                        },
                    )
                    Column {
                        Text("Ask every time", fontWeight = FontWeight.Bold)
                        Text("Show SIM picker before each outbound call", color = GxMuted, fontSize = 11.sp)
                    }
                }
            }
            SecondaryButton("Refresh profile", vm.busy) { vm.refreshAll() }
            TextButton(onClick = { vm.logout {} }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Icon(Icons.Default.Logout, null, Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)); Text("Sign out", color = GxDanger, fontWeight = FontWeight.Bold) }
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
    val timelineMuted = GxMuted
    val timelineSurface = GxSurface
    Column(Modifier.fillMaxWidth()) {
        events.forEachIndexed { index, event ->
            val isLatest = index == 0
            val markerColor = if (isLatest) GxAccent else GxMuted
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                Canvas(Modifier.width(28.dp).fillMaxHeight()) {
                    val centerX = size.width / 2f
                    val dotY = 10.dp.toPx()
                    val stroke = 2.dp.toPx()
                    if (index > 0) drawLine(timelineMuted.copy(alpha = .28f), Offset(centerX, 0f), Offset(centerX, dotY), stroke)
                    if (index < events.lastIndex) drawLine(timelineMuted.copy(alpha = .28f), Offset(centerX, dotY), Offset(centerX, size.height), stroke)
                    drawCircle(markerColor, radius = if (isLatest) 6.dp.toPx() else 5.dp.toPx(), center = Offset(centerX, dotY))
                    drawCircle(timelineSurface, radius = if (isLatest) 2.5.dp.toPx() else 2.dp.toPx(), center = Offset(centerX, dotY))
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

@Composable private fun LeadDetailScreen(
    vm: CrmViewModel,
    id: String,
    back: () -> Unit,
    openDisposition: (String) -> Unit,
    openChat: (conversationId: String, name: String) -> Unit,
) {
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
    var simChooserOpen by remember { mutableStateOf(false) }
    var simOptions by remember { mutableStateOf<List<SimOption>>(emptyList()) }
    val pendingCall = vm.bootstrap?.calls.orEmpty().firstOrNull { it.note.isNullOrBlank() }
    LaunchedEffect(id) { vm.clearCustomer360(); vm.loadCustomer360(id) }
    Page {
        HeaderWithBack("Lead details", lead?.customerName ?: "This lead may have moved.", back)
        if (lead == null) { EmptyCard("Refresh My Leads and try again."); return@Page }
        val linkedConversation = vm.inbox.firstOrNull { it.lead.id == lead.id }?.conversationId
        GxGlassSurface(radius = 24.dp, padding = 16.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(64.dp).clip(CircleShape).background(GxText.copy(alpha = .10f)), contentAlignment = Alignment.Center) {
                    Text(initials(lead.customerName), color = GxText, fontSize = 25.sp, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.width(13.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(lead.customerName, color = GxText, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(lead.serviceInterest.ifBlank { "CRM implementation" }, color = GxText, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        StatusPill(leadStageLabel(lead.stage), leadStageColor(lead.stage))
                        if (lead.priority.equals("HIGH", true) || lead.priority.equals("URGENT", true)) StatusPill("High", GxAccent)
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                LeadQuickAction(Icons.Default.Phone, "Call", enabled = lead.customerPhone.isNotBlank() && (vm.bootstrap?.pendingNotes ?: 0) == 0 && !vm.busy) {
                    val activeSims = CallManager.availableSims(context)
                    val preferredSim = CallManager.preferredSim(context, activeSims)
                    if (activeSims.size > 1 && preferredSim == null) {
                        simOptions = activeSims
                        simChooserOpen = true
                    } else vm.startCall(lead, preferredSim ?: activeSims.firstOrNull())
                }
                LeadQuickAction(Icons.Default.Chat, "WhatsApp", enabled = lead.customerPhone.isNotBlank()) {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/${lead.customerPhone.filter(Char::isDigit)}")))
                }
                LeadQuickAction(Icons.Default.ChatBubbleOutline, "Chat", enabled = linkedConversation != null) {
                    linkedConversation?.let { openChat(it, lead.customerName) }
                }
            }
        }
        GxGlassSurface(radius = 20.dp, padding = 12.dp) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                LeadMetaFact(Icons.Default.PersonOutline, "Assigned to", vm.session?.displayName ?: "You")
                VerticalDivider(Modifier.height(38.dp), color = GxOutlineSoft)
                LeadMetaFact(Icons.Default.Link, "Source", lead.source.ifBlank { "Website" })
                VerticalDivider(Modifier.height(38.dp), color = GxOutlineSoft)
                LeadMetaFact(Icons.Default.Event, "Added", lead.lastTouchedAt?.let(::formatDate) ?: "Today")
            }
        }
        Text("Stage", color = GxText, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("NEW" to "New", "CONTACTED" to "Contacted", "FOLLOW_UP" to "Follow-up", "QUALIFIED" to "Qualified").forEach { (value, label) ->
                val selected = when (value) {
                    "FOLLOW_UP" -> lead.stage.contains("FOLLOW", true)
                    "QUALIFIED" -> lead.stage.contains("QUAL", true)
                    else -> lead.stage.equals(value, true)
                }
                Box(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(50))
                        .background(if (selected) GxAccent else GxSurface)
                        .border(BorderStroke(1.dp, if (selected) GxAccent else GxOutlineSoft), RoundedCornerShape(50))
                        .clickable { vm.updateLeadStage(lead.id, value) }
                        .padding(vertical = 9.dp),
                    contentAlignment = Alignment.Center,
                ) { Text(label, color = if (selected) Color.White else GxText, fontSize = 10.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal, maxLines = 1) }
            }
        }
        GxGlassSurface(radius = 18.dp, padding = 12.dp) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.CalendarMonth, null, tint = GxText, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Next action", color = GxMuted, fontSize = 11.sp)
                    Text(lead.followUpAt?.let { "Call · ${formatDate(it)}" } ?: "No follow-up scheduled", color = GxText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
                Icon(Icons.Default.ChevronRight, null, tint = GxMuted, modifier = Modifier.size(19.dp))
            }
        }
        Text("Activity", color = GxText, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        if (contextEvents.isEmpty()) {
            GxGlassSurface(radius = 18.dp, padding = 12.dp) { Text("No activity recorded yet.", color = GxMuted, fontSize = 12.sp) }
        } else {
            GxGlassSurface(radius = 20.dp, padding = 12.dp) { LeadContextTimeline(contextEvents.take(3)) }
        }
        PrimaryButton("Update lead", false) { taskComposerOpen = true }
        if ((vm.bootstrap?.pendingNotes ?: 0) > 0) {
            GxGlassSurface(accent = true, radius = 18.dp, padding = 12.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.EditNote, null, tint = GxWarning, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Complete ${vm.bootstrap?.pendingNotes} pending call note${if ((vm.bootstrap?.pendingNotes ?: 0) == 1) "" else "s"} before starting another call.",
                        color = GxWarning,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                    )
                }
                if (pendingCall != null) SecondaryButton("Open pending call notes", false) { openDisposition(pendingCall.id) }
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
    if (simChooserOpen) {
        AlertDialog(
            onDismissRequest = { simChooserOpen = false },
            title = { Text("Choose SIM for this call", fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("The selected SIM will route the call. Recording will be linked to this CRM call session.", color = GxMuted, fontSize = 12.sp)
                    simOptions.forEach { sim ->
                        OutlinedButton(
                            onClick = {
                                simChooserOpen = false
                                CallManager.saveSimSelection(context, sim.subscriptionId)
                                lead?.let { vm.startCall(it, sim) }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Icon(Icons.Default.SimCard, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                                Text(sim.label, fontWeight = FontWeight.Bold)
                                sim.phoneNumber?.takeIf(String::isNotBlank)?.let { Text(it, color = GxMuted, fontSize = 11.sp) }
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { simChooserOpen = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun LeadQuickAction(icon: ImageVector, label: String, enabled: Boolean = true, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(
            Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(if (enabled && label == "Call") GxAccent else GxSurface)
                .border(BorderStroke(1.dp, if (enabled && label == "Call") GxAccent else GxOutlineSoft), CircleShape)
                .clickable(enabled = enabled, onClick = onClick),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, label, tint = if (enabled && label == "Call") Color.White else if (enabled) GxText else GxMuted.copy(alpha = .45f), modifier = Modifier.size(22.dp)) }
        Text(label, color = if (enabled) GxText else GxMuted.copy(alpha = .45f), fontSize = 10.sp)
    }
}

@Composable
private fun RowScope.LeadMetaFact(icon: ImageVector, label: String, value: String) {
    Column(Modifier.weight(1f), horizontalAlignment = Alignment.Start, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Icon(icon, null, tint = GxText, modifier = Modifier.size(18.dp))
        Text(label, color = GxMuted, fontSize = 10.sp)
        Text(value, color = GxText, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

private fun persistRecordingFolder(context: Context, uri: Uri): Boolean {
    val resolver = context.contentResolver
    val read = Intent.FLAG_GRANT_READ_URI_PERMISSION
    val write = Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    val persisted = runCatching {
        resolver.takePersistableUriPermission(uri, read or write)
        true
    }.getOrElse {
        runCatching {
            resolver.takePersistableUriPermission(uri, read)
            true
        }.getOrDefault(false)
    }
    if (persisted) RecordingFolderStore.saveTreeUri(context, uri)
    return persisted
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
private val dispositionStages = listOf("NEW", "CONTACTED", "INTERESTED", "QUALIFIED", "FOLLOW_UP", "CLOSED_WON", "CLOSED_LOST")

@Composable private fun DispositionScreen(vm: CrmViewModel, callId: String, done: () -> Unit) {
    val context = LocalContext.current
    val existingCall = vm.bootstrap?.calls?.firstOrNull { it.id == callId }
    var customerName by remember(callId) { mutableStateOf(existingCall?.assignment?.customerName.orEmpty()) }
    var stageUpdate by remember(callId) { mutableStateOf(existingCall?.assignment?.stage?.ifBlank { "NEW" } ?: "NEW") }
    var outcome by remember(callId) { mutableStateOf("") }
    var note by remember(callId) { mutableStateOf("") }
    var followUp by remember(callId) { mutableStateOf("") }
    var followUpLabel by remember(callId) { mutableStateOf("") }
    Page {
        BrandHeader("Complete call notes", "Update this contact while the call context is fresh")
        GxCard {
            OutlinedTextField(
                customerName,
                { customerName = it },
                label = { Text("Contact name (correct if needed)") },
                placeholder = { Text("Add the customer's name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Text("Lead status", fontWeight = FontWeight.Black)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                dispositionStages.forEach { value ->
                    FilterChip(stageUpdate == value, { stageUpdate = value }, { Text(value.replace('_', ' '), fontSize = 10.sp) })
                }
            }
            Text("Outcome", fontWeight = FontWeight.Black)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) { outcomes.forEach { value -> FilterChip(outcome == value, { outcome = value }, { Text(value.replace('_', ' '), fontSize = 10.sp) }) } }
            OutlinedTextField(note, { note = it }, label = { Text("Discussion notes") }, placeholder = { Text("What happened, what matters next?") }, minLines = 3, modifier = Modifier.fillMaxWidth())
            OutlinedButton(
                onClick = { showFollowUpPicker(context) { iso, display -> followUp = iso; followUpLabel = display } },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(Icons.Default.CalendarMonth, null)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                    Text("Callback / follow-up", fontSize = 11.sp, color = GxMuted)
                    Text(followUpLabel.ifBlank { "Set a callback (optional)" }, fontWeight = FontWeight.Bold)
                }
                Icon(Icons.Default.ChevronRight, null)
            }
            if (followUp.isNotBlank()) TextButton(onClick = { followUp = ""; followUpLabel = "" }, modifier = Modifier.align(Alignment.End)) { Text("Clear callback") }
            PrimaryButton("Save contact & disposition", vm.busy, outcome.isNotBlank() && note.isNotBlank()) {
                vm.saveDisposition(callId, customerName, outcome, note, followUp.ifBlank { null }, stageUpdate, done)
            }
        }
    }
}

@Composable private fun LeadGrabScreen(vm: CrmViewModel, done: () -> Unit) {
    var size by remember { mutableIntStateOf(3) }
    val pack = vm.selectedPack
    var seconds by remember(pack?.expiresAt) { mutableLongStateOf(0) }
    LaunchedEffect(pack?.expiresAt) { while (pack != null) { seconds = ((runCatching { Instant.parse(pack.expiresAt).toEpochMilli() }.getOrDefault(0) - System.currentTimeMillis()) / 1000).coerceAtLeast(0); delay(1000) } }
    Page {
        HeaderWithBack("Grab leads", "Reserve and claim fresh enquiries", done)
        val availableCount = vm.bootstrap?.availableLeadCount ?: 0
        val preview = pack?.leads?.firstOrNull() ?: vm.bootstrap?.availableLeads?.firstOrNull()
        Box(Modifier.fillMaxWidth().height(214.dp), contentAlignment = Alignment.Center) {
            GxCommandDial(
                value = if (pack == null) availableCount else pack.leads.size,
                label = "available",
                progress = if (pack == null) (availableCount / 30f).coerceIn(.04f, 1f) else (seconds / 60f).coerceIn(.04f, 1f),
            )
        }
        Row(
            Modifier
                .align(Alignment.CenterHorizontally)
                .clip(RoundedCornerShape(50))
                .background(GxSurface)
                .border(BorderStroke(1.dp, GxOutlineSoft), RoundedCornerShape(50))
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.CloudDone, null, tint = GxSuccess, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(7.dp))
            Text(if (pack == null) "Matched to your workspace" else "Reserved for your workspace", color = GxText, fontSize = 11.sp)
        }
        GxGlassSurface(radius = 22.dp, padding = 14.dp) {
            Text("NEXT LEAD PREVIEW", color = GxMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = .6.sp)
            if (preview == null) {
                Text("No leads are available right now.", color = GxText, fontWeight = FontWeight.SemiBold)
                Text("Refresh the workspace and try again when new enquiries arrive.", color = GxMuted, fontSize = 12.sp)
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(46.dp).clip(CircleShape).background(GxText.copy(alpha = .10f)), contentAlignment = Alignment.Center) {
                        Text(initials(preview.customerName), color = GxText, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(preview.customerName, color = GxText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(preview.serviceInterest.ifBlank { "Interested in a CRM conversation" }, color = GxMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    StatusPill(preview.priority.replace('_', ' '), if (preview.priority.equals("HIGH", true) || preview.priority.equals("URGENT", true)) GxAccent else GxMuted)
                }
                HorizontalDivider(color = GxOutlineSoft)
                LeadPreviewFact(Icons.Default.ChatBubbleOutline, "Source", preview.source.ifBlank { "Website enquiry" })
                LeadPreviewFact(Icons.Default.Schedule, "Created", formatDate(preview.createdAt))
            }
        }
        if (pack == null) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Pack size", color = GxMuted, fontSize = 11.sp, modifier = Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(3, 4, 5).forEach { value ->
                        FilterChip(size == value, { size = value }, { Text("$value", fontSize = 11.sp) })
                    }
                }
            }
            GxPrimaryActionRow(
                title = "Grab next lead",
                detail = if (availableCount > 0) "Reserve $size matched leads" else "No unassigned leads right now",
                icon = Icons.Default.PhoneCallback,
                enabled = !vm.busy && availableCount > 0,
                onClick = { vm.requestPack(size) },
            )
        } else {
            GxGlassSurface(accent = true, radius = 20.dp, padding = 14.dp) {
                Text("PACK RESERVED", color = GxAccent, fontSize = 10.sp, fontWeight = FontWeight.Black)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${seconds}s", color = GxText, fontSize = 28.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text("${pack.leads.size} leads ready", color = GxMuted, fontSize = 11.sp)
                }
                LinearProgressIndicator(progress = { (seconds / 60f).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth(), color = GxAccent, trackColor = GxMuted.copy(alpha = .16f))
                GxPrimaryActionRow(
                    title = if (seconds > 0) "Claim reserved leads" else "Request another pack",
                    detail = if (seconds > 0) "Add ${pack.leadPoolIds.size} leads to your queue" else "This reservation has expired",
                    icon = Icons.Default.CheckCircle,
                    enabled = !vm.busy,
                    onClick = { if (seconds > 0) vm.claimPack(done) else vm.clearPack() },
                )
            }
        }
        Text("Assignment is confirmed before the lead is added.", color = GxMuted, fontSize = 11.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
    }
}

@Composable
private fun LeadPreviewFact(icon: ImageVector, label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = GxText, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Text(label, color = GxMuted, fontSize = 11.sp, modifier = Modifier.weight(1f))
        Text(value, color = GxText, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

private val conversationStages = listOf(
    "NEW", "ASSIGNED", "CONTACTED", "INTERESTED", "WEBINAR_INVITED",
    "WEBINAR_ATTENDED", "FOLLOW_UP", "NEGOTIATION", "CLOSED_WON",
    "CLOSED_LOST", "NOT_REACHABLE", "RECYCLED"
)

@Composable private fun ChatScreen(vm: CrmViewModel, id: String, name: String, back: () -> Unit) {
    var body by rememberSaveable { mutableStateOf("") }
    var labelMenu by remember { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()
    val imeVisible = WindowInsets.ime.getBottom(LocalDensity.current) > 0
    val inboxItem = vm.inbox.firstOrNull { it.conversationId == id }
    LaunchedEffect(id) { vm.openChat(id) }
    DisposableEffect(id) {
        onDispose { vm.closeChat() }
    }
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
                            contentColor = Color.White,
                            disabledContainerColor = GxAccent.copy(alpha = .18f),
                            disabledContentColor = Color.White.copy(alpha = .40f),
                        ),
                        modifier = Modifier.size(48.dp),
                    ) { Icon(Icons.Default.Send, "Send", tint = Color.White, modifier = Modifier.size(19.dp)) }
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

@Composable private fun InboxConversationRow(item: InboxItem, onClick: () -> Unit, featured: Boolean = false) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = if (featured) 14.dp else 13.dp), verticalAlignment = Alignment.Top) {
        Surface(color = GxSurface2, shape = RoundedCornerShape(99.dp), border = BorderStroke(1.dp, GxMuted.copy(alpha = .14f)), modifier = Modifier.size(if (featured) 50.dp else 42.dp)) {
            Box(contentAlignment = Alignment.Center) { Text(initials(item.lead.customerName), color = GxAccent, fontWeight = FontWeight.Black, fontSize = 14.sp) }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(item.lead.customerName, fontWeight = FontWeight.Black, fontSize = if (featured) 16.sp else 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (featured) Text(item.lead.serviceInterest.ifBlank { "Assigned sales conversation" }, color = GxText.copy(alpha = .72f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(item.latestMessage.ifBlank { if (item.conversationId != null) "Open conversation" else "Conversation is not connected" }, color = GxMuted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (featured) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = GxAccent.copy(alpha = .10f), shape = RoundedCornerShape(99.dp), border = BorderStroke(1.dp, GxAccent.copy(alpha = .20f))) { Text("CRM", color = GxAccent, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)) }
                    Surface(color = GxMuted.copy(alpha = .08f), shape = RoundedCornerShape(99.dp)) { Text(item.lead.stage.replace('_', ' '), color = GxText.copy(alpha = .76f), fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)) }
                }
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(formatInboxTime(item.latestMessageAt), color = GxMuted, fontSize = 10.sp)
            if (featured && (item.lead.priority.equals("HIGH", true) || item.lead.priority.equals("URGENT", true))) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(GxAccent))
            }
            Icon(Icons.Default.ChevronRight, null, tint = GxMuted, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable private fun Page(
    vertical: Boolean = false,
    backdrop: GxBackdropKind = GxBackdropKind.NEUTRAL,
    reserveBottomBar: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    GxScreenBackdrop(backdrop) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(
                    start = 16.dp,
                    top = 10.dp,
                    end = 16.dp,
                    bottom = if (reserveBottomBar) 104.dp else 16.dp,
                ),
            verticalArrangement = Arrangement.spacedBy(13.dp),
            content = content,
        )
    }
}
@Composable private fun BrandHeader(title: String, subtitle: String, fullLogo: Boolean = false) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        if (fullLogo) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Image(
                    painter = painterResource(com.gigxomi.gxclosers.R.drawable.ic_ai_closer_logo),
                    contentDescription = null,
                    modifier = Modifier.size(44.dp),
                )
                Text(
                    "Closer",
                    color = GxText,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = (-1).sp,
                )
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(com.gigxomi.gxclosers.R.drawable.ic_ai_closer_logo),
                    contentDescription = "AI Closer",
                    modifier = Modifier.size(32.dp),
                )
                Spacer(Modifier.width(10.dp))
                Text("AI CLOSER", color = GxAccent, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.6.sp)
            }
        }
        Text(title, fontSize = 24.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.3).sp)
        Text(subtitle, color = GxMuted, fontSize = 12.sp)
    }
}
@Composable private fun HeaderWithBack(title: String, subtitle: String, back: () -> Unit) { Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) { IconButton(back) { Icon(Icons.Default.ArrowBack, "Back") }; Column(Modifier.weight(1f)) { Text(title, fontSize = 22.sp, fontWeight = FontWeight.Black); Text(subtitle, color = GxMuted, fontSize = 12.sp) } } }
@Composable private fun GxCard(accent: Boolean = false, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    GxGlassSurface(
        modifier = Modifier.fillMaxWidth(),
        radius = 22.dp,
        accent = accent,
        onClick = onClick,
        content = content,
    )
}
@Composable private fun QueueMetric(value: String, label: String, modifier: Modifier = Modifier, valueColor: Color = GxText) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier = modifier
            .clip(shape)
            .background(GxSurface)
            .border(BorderStroke(1.dp, GxOutlineSoft), shape),
        contentAlignment = Alignment.Center,
    ) {
        Column(Modifier.padding(horizontal = 8.dp, vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = valueColor, fontWeight = FontWeight.Black, fontSize = 18.sp)
            Text(label, color = GxMuted, fontSize = 10.sp)
        }
    }
}
@Composable private fun PrimaryButton(label: String, loading: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        colors = ButtonDefaults.buttonColors(
            containerColor = GxAccent,
            contentColor = Color.White,
            disabledContainerColor = GxAccent.copy(alpha = 0.35f),
            disabledContentColor = Color.White.copy(alpha = 0.5f),
        ),
        modifier = Modifier.fillMaxWidth().height(50.dp),
        shape = RoundedCornerShape(15.dp)
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Color.White)
        else Text(label, fontWeight = FontWeight.Black, color = Color.White)
    }
}
@Composable private fun SecondaryButton(label: String, loading: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    OutlinedButton(
        onClick,
        enabled = enabled && !loading,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = GxText),
        border = BorderStroke(1.dp, GxOutline),
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(15.dp),
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = GxAccent)
        else Text(label, fontWeight = FontWeight.Bold)
    }
}
@Composable private fun FeatureRow(icon: ImageVector, title: String, copy: String) { Row(verticalAlignment = Alignment.Top) { Icon(icon, null, tint = GxAccent); Spacer(Modifier.width(12.dp)); Column { Text(title, fontWeight = FontWeight.Black); Text(copy, color = GxMuted, fontSize = 12.sp) } } }
@Composable private fun Metric(value: String, label: String, modifier: Modifier) { Surface(color = GxSurface, shape = RoundedCornerShape(16.dp), modifier = modifier) { Column(Modifier.padding(14.dp)) { Text(value, fontSize = 25.sp, fontWeight = FontWeight.Black); Text(label, color = GxMuted, fontSize = 11.sp) } } }
@Composable private fun SetupIntroHero() {
    Surface(
        color = GxAccent.copy(alpha = .11f),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, GxAccent.copy(alpha = .22f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = GxAccent.copy(alpha = .18f), shape = RoundedCornerShape(14.dp)) {
                Icon(Icons.Default.AutoAwesome, "AI Closer", tint = GxAccent, modifier = Modifier.padding(12.dp).size(24.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("Ready for your first synced call?", color = GxText, fontWeight = FontWeight.Black, fontSize = 14.sp)
                Text("About 2 minutes · No overlay access", color = GxMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun SetupReferenceHeader(step: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(
                painter = painterResource(com.gigxomi.gxclosers.R.drawable.ic_ai_closer_logo),
                contentDescription = "AI Closer",
                modifier = Modifier.size(36.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text("Closer", color = GxText, fontSize = 23.sp, fontWeight = FontWeight.SemiBold)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                repeat(4) { index ->
                    Box(
                        modifier = Modifier
                            .width(if (index == step) 24.dp else 8.dp)
                            .height(5.dp)
                            .clip(RoundedCornerShape(99.dp))
                            .background(if (index == step) GxAccent else GxOutlineSoft),
                    )
                }
            }
            Text("${step + 1} of 4", color = GxMuted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun SetupWaveHero(icon: ImageVector, label: String) {
    val pulse by rememberInfiniteTransition(label = "setupWave").animateFloat(
        initialValue = .94f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Reverse),
        label = "setupWaveScale",
    )
    val waveSurface = GxSurface
    val waveAccent = GxAccent
    val waveOutline = GxOutlineSoft
    val waveMuted = GxMuted
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(184.dp),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(178.dp).graphicsLayer { scaleX = pulse; scaleY = pulse }) {
            drawCircle(color = waveSurface.copy(alpha = .18f))
            drawArc(
                color = waveAccent,
                startAngle = -90f,
                sweepAngle = 112f,
                useCenter = false,
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 7.dp.toPx()),
            )
            drawArc(
                color = waveOutline,
                startAngle = 25f,
                sweepAngle = 245f,
                useCenter = false,
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.dp.toPx()),
            )
            val center = Offset(size.width / 2f, size.height / 2f)
            val barHeights = listOf(22f, 40f, 30f, 62f, 36f, 78f, 32f, 54f, 28f, 44f, 22f)
            barHeights.forEachIndexed { index, height ->
                val x = center.x - 62.dp.toPx() + index * 12.dp.toPx()
                drawLine(
                    color = if (index == barHeights.lastIndex / 2) waveAccent else waveMuted.copy(alpha = .72f),
                    start = Offset(x, center.y - height.dp.toPx() / 2f),
                    end = Offset(x, center.y + height.dp.toPx() / 2f),
                    strokeWidth = 3.dp.toPx(),
                )
            }
        }
        Surface(
            color = GxSurface.copy(alpha = .90f),
            shape = CircleShape,
            border = BorderStroke(1.dp, GxOutlineSoft),
            shadowElevation = 8.dp,
            modifier = Modifier.size(108.dp),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Icon(icon, null, tint = GxAccent, modifier = Modifier.size(29.dp))
                Spacer(Modifier.height(4.dp))
                Text(label, color = GxText, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun SetupReferenceFeature(icon: ImageVector, title: String, copy: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            color = GxSurface2,
            shape = CircleShape,
            border = BorderStroke(1.dp, GxOutlineSoft),
            modifier = Modifier.size(48.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = GxText, modifier = Modifier.size(23.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = GxText, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(copy, color = GxMuted, fontSize = 12.sp, lineHeight = 16.sp)
        }
    }
}

@Composable private fun CertificationCheckRow(label: String, passed: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            if (passed) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            null,
            tint = if (passed) GxSuccess else GxMuted,
            modifier = Modifier.size(14.dp)
        )
        Spacer(Modifier.width(6.dp))
        Text(
            label,
            color = if (passed) GxText else GxMuted,
            fontSize = 11.sp,
            fontWeight = if (passed) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable fun SetupProgress(step: Int) {
    val labels = listOf("Access", "SIM", "Recording", "Verify")
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            labels.forEachIndexed { index, label ->
                val active = index <= step
                Surface(
                    color = if (active) GxAccent else GxSurface2,
                    shape = RoundedCornerShape(99.dp),
                    modifier = Modifier.weight(1f).height(5.dp),
                ) {}
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            labels.forEachIndexed { index, label ->
                Text(
                    "${index + 1}. $label",
                    color = if (index == step) GxAccent else GxMuted,
                    fontSize = 10.sp,
                    fontWeight = if (index == step) FontWeight.Black else FontWeight.Medium,
                )
            }
        }
    }
}

@Composable private fun SetupStatusRow(
    icon: ImageVector,
    title: String,
    detail: String,
    color: Color,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Surface(
        color = GxSurface2,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, GxOutlineSoft),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Surface(color = color.copy(alpha = .13f), shape = RoundedCornerShape(10.dp)) {
                    Icon(icon, null, tint = color, modifier = Modifier.padding(7.dp).size(18.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Text(detail, color = GxMuted, fontSize = 11.sp, lineHeight = 15.sp)
                }
                if (actionLabel == null) Icon(Icons.Default.CheckCircle, "Ready", tint = color, modifier = Modifier.size(19.dp))
            }
            if (actionLabel != null && onAction != null) {
                OutlinedButton(
                    onClick = onAction,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = GxText),
                    border = BorderStroke(1.dp, color.copy(alpha = .42f)),
                    modifier = Modifier.fillMaxWidth().height(42.dp),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(actionLabel, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable private fun StatusPill(label: String, color: androidx.compose.ui.graphics.Color) { Surface(color = color.copy(alpha = .12f), shape = RoundedCornerShape(99.dp), border = BorderStroke(1.dp, color.copy(alpha = .35f))) { Text(label, color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) } }
private fun leadStageLabel(stage: String): String = when {
    stage.contains("FOLLOW", true) -> "Follow-up"
    stage.contains("CONTACT", true) -> "Contacted"
    stage.contains("QUAL", true) -> "Qualified"
    else -> "New"
}
@Composable private fun leadStageColor(stage: String): androidx.compose.ui.graphics.Color = when {
    stage.contains("FOLLOW", true) -> GxAccent
    stage.contains("CONTACT", true) -> GxSuccess
    stage.contains("QUAL", true) -> Color(0xFF7D6CCB)
    else -> Color(0xFF4D7BAA)
}
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

private fun recordingStatusLabel(value: String): String = when (value) {
    "UPLOADED" -> "Ready to play"
    "UPLOADING", "LOCAL_PENDING" -> "Processing"
    "FAILED", "RECORDING_UNAVAILABLE" -> "Recording unavailable"
    "NONE" -> "No recording"
    else -> value.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }
}

@Composable
private fun AddContactDialog(
    busy: Boolean,
    onDismiss: () -> Unit,
    onAdd: (name: String, phone: String, email: String, notes: String) -> Unit
) {
    var name by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var localError by rememberSaveable { mutableStateOf<String?>(null) }

    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = GxSurface,
            border = BorderStroke(1.dp, GxAccent.copy(alpha = 0.35f)),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Add New Contact", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                        Text("Save lead directly into CRM pipeline", color = GxMuted, fontSize = 11.sp)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, "Close", tint = GxMuted)
                    }
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; localError = null },
                    label = { Text("Customer Full Name *") },
                    placeholder = { Text("e.g. Aarav Khanna") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it; localError = null },
                    label = { Text("Phone Number *") },
                    placeholder = { Text("e.g. 9811234901") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email (Optional)") },
                    placeholder = { Text("e.g. aarav@company.com") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Discussion Notes (Optional)") },
                    placeholder = { Text("e.g. Interested in CRM demo, requested call back") },
                    minLines = 3,
                    maxLines = 4,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                localError?.let { err ->
                    Text(err, color = GxDanger, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(Modifier.height(4.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        enabled = !busy,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).height(46.dp)
                    ) {
                        Text("Cancel", fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = {
                            if (name.trim().length < 2) {
                                localError = "Please enter customer's full name"
                                return@Button
                            }
                            if (phone.trim().replace(Regex("[^0-9]"), "").length < 7) {
                                localError = "Please enter a valid phone number (at least 7 digits)"
                                return@Button
                            }
                            onAdd(name.trim(), phone.trim(), email.trim(), notes.trim())
                        },
                        enabled = !busy,
                        colors = ButtonDefaults.buttonColors(containerColor = GxAccent, contentColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1.3f).height(46.dp)
                    ) {
                        if (busy) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Save Contact", fontWeight = FontWeight.Black, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}
