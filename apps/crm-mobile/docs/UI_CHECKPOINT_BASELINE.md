# AI Closer Mobile UI Checkpoint & Approved Visual Baseline

**Document Version:** 1.0.0-APPROVED-BASELINE  
**Date of Snapshot:** 2026-10-14  
**Project Workspace:** D:\AIcloser\application\apps\crm-mobile  
**Reference-Only External Project:** D:\AIcloser\application\work\call-manager-1.0.26-analysis (Strictly read-only; no code merged from or built here)

---

## 1. Executive Summary & Strict UI Mandate

This checkpoint establishes the **permanent visual and interaction baseline** for the AI Closer Android mobile application (com.gigxomi.gxclosers). All existing screens, styling, typography, colors, headers, navigation components, modals, and dragging overlay behaviors documented herein are **approved and frozen**.

### Core Guardrails During Recording Engine Fixes:
1. **Zero UI Regressions:** Recording fixes (e.g. SharedRecordingStore, DialerShareAccessibilityService, RecordingUploadWorker, CrmViewModel) must NOT alter the visual structure, layout hierarchy, paddings, glassmorphism tokens, or animations of any existing screen.
2. **Navigation Footer Invariant:** The bottom navigation footer (GxBottomNav / GxAppFooter) is **strictly and intentionally hidden/omitted inside opened chats (composable(chat/{id}/{name}))** and during modal operations (modalBlocksFooter). This ensures keyboard-friendly conversational UX with direct imePadding() alignment.
3. **Overlay Invariant:** The Truecaller-style floating overlay window (CallOverlayWindow) must preserve its glassmorphic gradient, live call badge, 48x48dp minimum touch target close button, and real-time clamped screen-boundary drag physics.

---

## 2. Dated & Recoverable Backup Record

A full, dated snapshot of the working baseline has been archived and verified:

- **Primary Archive Directory:**  
  D:\AIcloser\application\apps\crm-mobile\backups\2026-10-14_ui_recording_baseline\

### Preserved Components:
| Asset / Path | Description | Verification Status |
| :--- | :--- | :--- |
| src_main\ | Full recursive clone of pp/src/main/ including all Kotlin source files, Java classes, AndroidManifest.xml, vector drawables, mipmaps, strings, colors, and themes. | ✅ Verified (Complete tree) |
| uild_config\ | Complete build setup: pp-build.gradle.kts, oot-build.gradle.kts, settings.gradle.kts, gradle.properties, and proguard-rules.pro. | ✅ Verified (5 files) |
| pks\app-debug-baseline-20261014.apk | Working compiled debug APK (Size: 24,038,472 bytes; timestamp 14/10/2026 21:52). | ✅ Verified (24.0 MB) |
| pks\app-release-baseline-20261014.apk | Working compiled release APK (Size: 3,754,968 bytes). | ✅ Verified (3.7 MB) |
| git-diff-uncommitted.patch | Unified patch capturing 100% of uncommitted working tree modifications (Size: 1,477,052 bytes). | ✅ Verified (1.47 MB patch) |

To restore the working baseline at any point in the future:
`ash
# 1. Apply working tree patch
git apply D:\AIcloser\application\apps\crm-mobile\backups\2026-10-14_ui_recording_baseline\git-diff-uncommitted.patch

# 2. Or replace source tree directly
Copy-Item -Recurse -Force D:\AIcloser\application\apps\crm-mobile\backups\2026-10-14_ui_recording_baseline\src_main\* D:\AIcloser\application\apps\crm-mobile\app\src\main"
`

---

## 3. Design System & Glassmorphism Token Architecture

### 3.1 Color Palette Tokens (Theme.kt, PremiumUi.kt)
- **Primary Brand Orange (GxAccent / BrandOrange / GxOrange):** #FF6B2F (Primary), #FE6420 (Accent)
- **Primary Background (DarkBackground / GxDarkBg):** #090B0D (Deep cinematic near-black)
- **Shell Dynamic Background:** #0D0E12 (Dark) / #F7F8FA (Light)
- **Card & Surface Backgrounds:**
 - DarkSurface: #202429
 - DarkSurfaceRaised: #2B3036
 - GxCardDark: #171A1E
- **Glassmorphic Fill:** Color(0xFF272B30).copy(alpha = 0.90f) (Dark mode frosted glass)
- **Glassmorphic Borders:**
 - Default: Color.White.copy(alpha = 0.09f)
 - Active / Highlight: GxAccent.copy(alpha = 0.34f) (#FF6B2F frosted border)
 - Card Border Token (GxCardBorder): Color(0x1FFFFFFF) (12% white stroke)
- **Text & Status Tokens:**
 - DarkText: #F7F5F1 (High-contrast soft ivory)
 - DarkMuted: #B6B3AE
 - GxMutedText: #8E95A2
 - GxGreen: #3CB64D (Success / Lead Won)
 - Error: #FF7A79 (Dark error fill)

### 3.2 Glassmorphic Card Container (GxGlassSurface)
`kotlin
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
 Modifier.fillMaxWidth().padding(padding),
 verticalArrangement = Arrangement.spacedBy(10.dp),
 content = content,
 )
 }
}
`

### 3.3 Dynamic Canvas Atmospheric Backdrops (GxScreenBackdrop)
Four distinct canvas atmosphere modes are supported:
1. **GxBackdropKind.TELEPHONY:** Dual radial glow centers with animated drift, concentric arc acoustic soundwave rings (sweepAngle = 252f), 15 vertical oscillating voice frequency bars, and conference speaker photographic backdrop with 6-stage gradient fade.
2. **GxBackdropKind.CRM:** Off-center radial glow (Offset(width * 0.86, height * 0.18)) with 7 horizontal architectural data grid lines.
3. **GxBackdropKind.COMMUNICATION:** Dual pill capsules representing conversational threads with subtle ambient drift.
4. **GxBackdropKind.NEUTRAL:** Subtle upper-right ambient gradient sphere for administrative and utility screens.

---

## 4. Header Architecture (GxPremiumHeader)

The standard screen header provides clear hierarchy, responsive notifications, and theme controls:
- **Brand Presentation:** Left-aligned 37dp ic_ai_closer_logo SVG with Closer typography in 23sp SemiBold ivory (GxText).
- **Interactive Controls:**
 - GxThemeToggle: 40dp circular surface with 1dp border, housing custom procedural canvas sun/moon morphing glyph.
 - Notification Bell: 44dp circular surface with 21dp Icons.Outlined.NotificationsNone icon and an animated 17dp accent pill badge (GxAccent) displaying unread counts up to 9+.
- **Typography Cascade:**
 - Greeting: 13sp medium muted text (GxMuted) e.g. Good morning, Closer
 - Headline: 24sp semi-bold (lineHeight = 29sp, letterSpacing = -0.5sp) providing concise context.

---

## 5. Navigation Footer Architecture & Intentionally Hidden Chat Rule

### 5.1 Component Structure (GxAppFooter / GxBottomNav)
- **Container Layout:** Centered floating pill surface occupying 92% screen width (widthIn(min = 300.dp, max = 560.dp)), height 78dp, 30dp corner radius, 12dp elevation shadow, and 1dp GxOutlineSoft border.
- **Active Tab Pill:** Rounded container with 24dp radius, filled with GxAccent.copy(alpha = 0.14f).
- **Icon Accent Chip:** 32dp circular badge with GxAccent.copy(alpha = 0.16f) background and 1dp GxAccent.copy(alpha = 0.42f) border.
- **Dynamic Tab Items:**
 1. Home (Icons.Default.Home)
 2. Leads (Icons.Default.Groups)
 3. Calls (Icons.Default.Phone)
 4. More (Icons.Default.MoreHoriz)

### 5.2 THE CHAT FOOTER VISIBILITY MANDATE
> [!IMPORTANT]
> **The navigation footer is INTENTIONALLY HIDDEN in opened chats.**
> 
> When a user enters any chat view (composable(chat/{id}/{name}) or LiveChatScreen), the bottom navigation footer is **completely absent from the composition tree**.
> 
> **Architectural Rationale:**
> 1. Chat input requires sticky keyboard attachment using Modifier.imePadding(). A persistent bottom navigation bar consumes 78dp-128dp of valuable screen height, causing unacceptable viewport cramping and soft-keyboard collisions.
> 2. MainScreen conditionally renders GxBottomNav only when:
> al footerVisible = !(activeTab == more && !showMoreSettings) && !modalBlocksFooter
> 3. composable(chat/{id}/{name}) is mounted as a standalone top-level route outside MainScreen, guaranteeing zero footer interference during messaging.
> 4. Modal overlays (e.g. stage selector, disposition sheets) set modalBlocksFooter = true to temporarily retract the footer, restoring it automatically on dismiss.

---

## 6. Chat Screen Layout (ReferenceChatScreen / LiveChatScreen)

- **Top Bar:** Back button (48dp touch target), contact initials avatar (40dp circle with 1.5dp border), contact title (16sp semi-bold), interactive stage dropdown badge (Follow-up, Discovery, Negotiation, Won, Lost), direct phone call action button, and overflow menu.
- **Chat Timeline:**
 - ReferenceChatDayDivider: Centered pill with subtle outline and 11sp muted timestamp.
 - ReferenceIncomingBubble: Frosted card Color(0xFF1E2228) with 18dp rounded corners (top-left 4dp sharp corner for speech bubble tail), white text, and timestamp.
 - ReferenceOutgoingBubble: Gradient/solid GxOrange (Color(0xFFFE6420)) with 18dp rounded corners (bottom-right 4dp sharp tail), white text, delivered double-check indicators, and read receipts.
- **Input Composition Bar:**
 - Responsive container with Modifier.imePadding() pinned to the bottom of the screen.
 - Media/Audio Attachment icon button.
 - Multi-line expanded text input field with placeholder Type a message....
 - Send action: Circular 44dp GxOrange FAB with paper-plane icon.

---

## 7. Caller Context Overlay Window (CallOverlayWindow.kt)

The Truecaller-style floating overlay window provides instant CRM intelligence during incoming and active phone calls.

### 7.1 Window & Container Specs
- **Window Type:** WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY (or AccessibilityService window token for zero-permission elevation on Android 12+).
- **Flags:** FLAG_NOT_FOCUSABLE or FLAG_NOT_TOUCH_MODAL, PixelFormat.TRANSLUCENT.
- **Dimensions:** Width minOf(dp(context, 344), displayWidth - dp(context, 24)), height WRAP_CONTENT, initial position y = dp(context, 88).
- **Card Background:** Vertical LinearLayout with gradient drawable Color.argb(246, 18, 28, 34) to Color.argb(232, 7, 12, 17), 22dp corner radius, 1dp border stroke Color.argb(92, 255, 255, 255), 18dp shadow elevation.

### 7.2 Overlay UI Elements & Close Button
1. **Kicker:** AI CLOSER • CALL CONTEXT in #FF6B2F, 10sp bold, letter spacing 0.08f.
2. **Header Row:**
 - Avatar: 44x44dp oval, background Color.argb(45, 255, 107, 47), 1dp border stroke Color.argb(150, 255, 107, 47), accent initials.
 - Identity: 18sp bold white contact name (single line, ellipsized), 12sp muted phone number.
 - Status Badge: LIVE badge with 99dp radius pill, background Color.argb(225, 255, 107, 47), 10sp bold white.
 - **Close Button (✕):**
 - Text: ✕
 - Content Description: Close caller information
 - Touch Target: **Minimum 48dp x 48dp** (minimumWidth = dp(context, 48), minimumHeight = dp(context, 48))
 - Size & Color: 27sp, Color.argb(220, 247, 251, 255)
 - Interaction: Immediate dismissal via setOnClickListener { remove() }.
3. **CRM Context Section:**
 - Matched lead: Stage and source uppercase badge, LAST NOTE kicker, 3-line truncated last note preview in soft white.
 - Unmatched lead: NEW LEAD • NO CRM MATCH alert in amber-orange with prompt to save caller details.
4. **Call to Action:**
 - Full-width button: Open AI Closer / Add caller to AI Closer
 - Background: Color.argb(232, 255, 107, 47) with 13dp corner radius.

### 7.3 Dragging Behavior & Touch Physics
- **Touch Listener:** oot.setOnTouchListener intercepts raw pointer events.
- **Action Down:** Records initial downX, downY, and window layout params startX, startY.
- **Action Move:**
 - Real-time delta: params.x = (startX + event.rawX - downX)
 - Real-time delta: params.y = (startY + event.rawY - downY)
 - **Horizontal Clamping:** Constrained within [-maxHorizontalOffset, maxHorizontalOffset] to keep the card on-screen.
 - **Vertical Clamping:** Clamped between 32dp (safe status bar clearance) and maxVerticalOffset (displayHeight - cardHeight - 32dp).
 - Calls windowManager.updateViewLayout(root, params) on every event for smooth 60fps tracking.
- **Action Up / Cancel:** Retains updated position in memory without bouncing.

---

## 8. Catalog of Approved Screens (19 Screens)

| # | Screen Key | Reference Composable | Core Visual & Functional Role |
| :--- | :--- | :--- | :--- |
| **01** | login | LoginScreen | Dark telephony conference speaker backdrop, centered glassmorphic card, floating input fields, brand logo, animated entrance. |
| **02** | setup | SetupScreen | Guided onboarding wizard with OEM profiles (Pixel, Xiaomi, Oppo, Vivo, Samsung, Motorola, Other) for folder & accessibility selection. |
| **06** | main/home | ReferenceHomeScreen / LiveHomeScreenAdapter | Daily closer dashboard: Target pace gauge, quick actions (Lead Grab, WhatsApp, Chats), performance metrics. |
| **07** | main/leads | ReferenceLeadsScreen / LiveLeadsScreenAdapter | Lead pipeline cards, stage filters, instant 1-tap WhatsApp launcher, and search. |
| **08** | main/calls | ReferenceCallsScreen / LiveCallsScreenAdapter | Chronological call ledger, recording attachment indicator, manual upload retry trigger, audio playback pill. |
| **09** | main/more | ReferenceMoreDrawer / LiveMoreDrawerAdapter | Slide-in drawer with navigation links to Academy, Payments, Settings, Theme Mode toggle, and Logout. |
| **10** | lead-grab | ReferenceGrabLeadsScreen / LiveGrabLeadsScreenAdapter | High-urgency speed-to-lead claim pool with pulsating urgency countdown timers. |
| **11** | lead/{id} | ReferenceLeadDetailScreen / LiveLeadDetailScreenAdapter | Complete prospect dossier: touch history, call recordings, notes ledger, quick WhatsApp/Phone dials. |
| **12** | disposition/{id} | ReferenceCompleteCallScreen / LiveCompleteCallScreenAdapter | Post-call outcome resolution sheet: Won/Lost/Callback status, notes, follow-up calendar scheduler. |
| **13** | inbox | ReferenceInboxScreen / LiveInboxScreen | Real-time multi-channel conversational inbox (WhatsApp + SMS) with unread count chips. |
| **14** | chat/{id}/{name}| ReferenceChatScreen / LiveChatScreen | **Direct 1-on-1 customer chat interface (Navigation footer intentionally hidden).** |
| **15** | edit-profile | ReferenceSettingsScreen / LiveSettingsScreen | Closer profile customization, notification preferences, diagnostic health status. |
| **16** | contact | ReferenceAddContactScreen / LiveAddContactScreen | New lead quick-entry form with phone validation, name, email, service package selector. |
| **17** | pipeline | ReferencePipelineScreen / LivePipelineScreen | Multi-column horizontal drag-and-drop Kanban pipeline board. |
| **18** | contacts | ReferenceContactsScreen / LiveContactsScreen | Alphabetized contact address book with quick call and message shortcuts. |
| **19** | payments | ReferencePaymentsScreen / LivePaymentsScreen | Commission tracking ledger, closed deal revenue breakdown, pending settlements. |
| **20** | lesson/{c}/{l} | LessonScreen | Academy video player and lesson transcript for closer sales training. |
| **21** | eference-pack | ReferenceScreenGallery | Developer QA review gallery comparing all reference designs against live adapters. |
| **22** | overlay | CallOverlayWindow | Draggable floating caller intelligence HUD during active cellular calls. |

---

## 9. Baseline Verification & Sign-off

- **Baseline Approved By:** Antigravity AI Engineering Agent & User Mandate
- **Verification Command:**
 `powershell
 # Compile check against baseline
 ./gradlew assembleDebug -Dorg.gradle.java.home=C:\Program Files\Android\Android Studio\jbr
 `
- **Rule of Engagement:** Any functional recording bug fix (file retention, upload queuing, caller matching) must leave all 19 screens and the overlay completely identical to this checkpoint.
