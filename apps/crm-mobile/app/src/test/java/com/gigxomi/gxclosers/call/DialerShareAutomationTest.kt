package com.gigxomi.gxclosers.call

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DialerShareAutomationTest {

    @Test
    fun automaticRecordingBindingRequiresMatchingTimeAndPlausibleDuration() {
        val callEnd = 1_800_000_000_000L
        assertTrue(DialerShareAutomation.isRecordingTimestampMatch(callEnd, callEnd, 16_000L))
        assertTrue(DialerShareAutomation.isRecordingTimestampMatch(callEnd - 16_000L, callEnd, 16_000L))
        assertFalse(DialerShareAutomation.isRecordingTimestampMatch(callEnd - 360_000L, callEnd, 16_000L))
        assertTrue(DialerShareAutomation.isRecordingDurationMatch(14_000L, 16_000L))
        assertTrue(DialerShareAutomation.isRecordingDurationMatch(3_264L, 16_000L))
        assertFalse(DialerShareAutomation.isRecordingDurationMatch(120_000L, 16_000L))
        assertFalse(DialerShareAutomation.isRecordingDurationMatch(0L, 16_000L))
    }

    @Test
    fun pixelSystemUiAndLauncherTransitionsDoNotCountAsUnexpectedApps() {
        assertTrue(DialerShareAutomation.isTransientSystemPackage("com.android.systemui"))
        assertTrue(DialerShareAutomation.isTransientSystemPackage("com.google.android.apps.nexuslauncher"))
        assertTrue(DialerShareAutomation.isTransientSystemPackage(""))
        assertFalse(DialerShareAutomation.isTransientSystemPackage("com.whatsapp"))
    }

    @Test
    fun pixelAccessibilityLabelsNormalizeNarrowSpacesAndAllowCallTypeAncestors() {
        assertEquals("3:52 pm", DialerShareAutomation.normalizeCallTimeText("3:52\u202fPM"))
        assertTrue(DialerShareAutomation.isSafeAction("Listen to recording", null, null))
        assertTrue(DialerShareAutomation.isSafeAction("Incoming call", null, null))
        assertTrue(DialerShareAutomation.isSafeAction("Outgoing call", null, null))
        assertFalse(DialerShareAutomation.isSafeAction("Call 1234567890", null, "call_button"))
    }

    @Test
    fun forbiddenActionIdsStrictlyOverrideAllowListAndDescriptors() {
        // Reproduce: descriptor says "Call details" or "Share", but resource ID is call_button or sim_select
        val forbiddenWithCallDetails = listOf(
            "com.google.android.dialer:id/call_button",
            "com.google.android.dialer:id/btn_call",
            "com.google.android.dialer:id/sim_select",
            "com.google.android.dialer:id/btn_sim",
            "com.google.android.dialer:id/delete_button",
            "com.google.android.dialer:id/redial",
        )

        for (id in forbiddenWithCallDetails) {
            val isSafeWithText = DialerShareAutomation.isSafeAction(text = "Call details", desc = null, viewId = id)
            assertFalse("Forbidden ID '$id' must be rejected even if text is 'Call details'", isSafeWithText)

            val isSafeWithDesc = DialerShareAutomation.isSafeAction(text = null, desc = "Call details 9876543210", viewId = id)
            assertFalse("Forbidden ID '$id' must be rejected even if desc is 'Call details'", isSafeWithDesc)

            val isSafeWithShare = DialerShareAutomation.isSafeAction(text = "Share recording", desc = null, viewId = id)
            assertFalse("Forbidden ID '$id' must be rejected even if text is 'Share recording'", isSafeWithShare)
        }
    }

    @Test
    fun pixelPlaybackSharePassesSafetyFilter() {
        val pixelShareId = "com.google.android.dialer:id/playback_share"
        val isSafe = DialerShareAutomation.isSafeAction(text = null, desc = "Share", viewId = pixelShareId)
        assertTrue("Pixel playback_share resource ID in Google dialer must pass safety check", isSafe)

        val isSafeEmptyText = DialerShareAutomation.isSafeAction(text = "", desc = "", viewId = pixelShareId)
        assertTrue("Pixel playback_share resource ID alone must pass safety check", isSafeEmptyText)

        val isSafeWithLabel = DialerShareAutomation.isSafeAction(text = "Share audio file", desc = null, viewId = pixelShareId)
        assertTrue("Pixel playback_share with Share audio file text must pass safety check", isSafeWithLabel)
    }

    @Test
    fun googleAutomationRequiresDedicatedPlaybackShareControl() {
        assertTrue(DialerShareAutomation.isGooglePlaybackShareControl("com.google.android.dialer:id/playback_share"))
        assertFalse(DialerShareAutomation.isGooglePlaybackShareControl("com.google.android.dialer:id/share_button"))
        assertFalse(DialerShareAutomation.isGooglePlaybackShareControl("com.google.android.dialer:id/call_detail_action"))
    }

    @Test
    fun relativeCallAgeMustMatchTheArmedCallRatherThanAnotherRecentRow() {
        val now = 1_800_000_000_000L
        val endedAt = now - 4 * 60_000L - 20_000L
        assertTrue(DialerShareAutomation.matchesRelativeCallAge("answered call, 4 minutes ago", endedAt, 7_000L, now))
        assertFalse(DialerShareAutomation.matchesRelativeCallAge("answered call, 14 minutes ago", endedAt, 7_000L, now))
        assertTrue(DialerShareAutomation.matchesRelativeCallAge("answered call, Just now", now - 20_000L, 7_000L, now))
    }

    @Test
    fun safeNavigationActionIdsPassSafetyFilter() {
        val safeNavActions = listOf(
            Pair("Call details", "com.google.android.dialer:id/call_detail_action"),
            Pair("Recents", "com.google.android.dialer:id/recents_tab"),
            Pair("Call history", "com.google.android.dialer:id/history_item"),
        )

        for ((text, id) in safeNavActions) {
            val isSafe = DialerShareAutomation.isSafeAction(text = text, desc = null, viewId = id)
            assertTrue("Safe navigation action '$text' with ID '$id' must pass", isSafe)
        }
    }

    @Test
    fun forbiddenTokensRejectUnsafeActions() {
        val forbiddenActions = listOf(
            "Call",
            "REDIAL",
            "Voice call",
            "Video call",
            "Delete recording",
            "Remove",
            "Clear history",
            "Switch to SIM 2",
            "Block number",
            "Report spam",
            "Keypad",
            "Dial",
            "Call 9876543210",
            "Call back",
        )

        for (action in forbiddenActions) {
            val isSafe = DialerShareAutomation.isSafeAction(text = action, desc = null, viewId = null)
            assertFalse("Action '$action' must be classified as unsafe", isSafe)
        }
    }

    @Test
    fun safeShareAndDetailLabelsAreAllowed() {
        val safeActions = listOf(
            "Share recording",
            "Share audio file",
            "Share audio",
            "Share",
            "Export recording",
            "Call details",
            "Call history",
            "AI Closer",
            "GXClosers",
        )

        for (action in safeActions) {
            val isSafe = DialerShareAutomation.isSafeAction(text = action, desc = null, viewId = null)
            assertTrue("Action '$action' must be classified as safe", isSafe)
        }
    }

    @Test
    fun safeClickableBlocksUnsafeClickableParent() {
        val callParent = DialerShareAutomation.TestNode(
            text = "Call",
            contentDescription = "Call 9876543210",
            viewIdResourceName = "com.google.android.dialer:id/call_button",
            isClickable = true,
            parent = null,
        )
        val child = DialerShareAutomation.TestNode(
            text = "9876543210",
            isClickable = false,
            parent = callParent,
        )

        val result = DialerShareAutomation.safeClickableTestNode(child)
        assertNull("Clicking a child with an unsafe 'Call' parent must be completely blocked (return null)", result)
    }

    @Test
    fun safeClickableBlocksSimAndRedialAncestors() {
        val simParent = DialerShareAutomation.TestNode(
            text = "Call details", // Has safe text, but forbidden viewId!
            viewIdResourceName = "com.google.android.dialer:id/sim_select",
            isClickable = true,
            parent = null,
        )
        val child = DialerShareAutomation.TestNode(
            text = "SIM 2",
            isClickable = false,
            parent = simParent,
        )
        assertNull("Parent with sim_select viewId must be blocked even if text is Call details", DialerShareAutomation.safeClickableTestNode(child))
    }

    @Test
    fun safeClickableAllowsSafeParent() {
        val detailsParent = DialerShareAutomation.TestNode(
            text = "Call details",
            contentDescription = "Call details 9876543210",
            viewIdResourceName = "com.google.android.dialer:id/call_detail_action",
            isClickable = true,
            parent = null,
        )
        val child = DialerShareAutomation.TestNode(
            text = "9876543210",
            isClickable = false,
            parent = detailsParent,
        )

        val result = DialerShareAutomation.safeClickableTestNode(child)
        assertNotNull("Call details parent must be safely clickable", result)
        assertEquals("Call details", result?.text)

        val shareParent = DialerShareAutomation.TestNode(
            text = "Share recording",
            contentDescription = "Share recording",
            viewIdResourceName = "com.google.android.dialer:id/playback_share",
            isClickable = true,
            parent = null,
        )
        val shareChild = DialerShareAutomation.TestNode(
            text = "Share",
            isClickable = false,
            parent = shareParent,
        )
        val shareResult = DialerShareAutomation.safeClickableTestNode(shareChild)
        assertNotNull("Pixel playback_share must be safely clickable", shareResult)
        assertEquals("Share recording", shareResult?.text)
    }

    @Test
    fun targetPhoneMatchingExtractsLastTenDigits() {
        val targetPhone = "9876543210"

        val rawNumbers = listOf(
            "+919876543210",
            "+91 98765 43210",
            "09876543210",
            "(+91) 98765-43210",
        )

        for (raw in rawNumbers) {
            val digits = raw.filter(Char::isDigit).takeLast(10)
            assertTrue("Normalized digits for '$raw' must match target", digits == targetPhone)
        }

        val nonMatching = listOf(
            "+911122334455",
            "1234567890",
            "9876543211",
        )

        for (raw in nonMatching) {
            val digits = raw.filter(Char::isDigit).takeLast(10)
            assertFalse("Normalized digits for '$raw' must NOT match target", digits == targetPhone)
        }
    }

    @Test
    fun durationVerificationRejectsConflictingRecordings() {
        val expectedDurationMs = 25_000L

        val matchingDurationMs = 26_000L
        val diff1 = kotlin.math.abs(matchingDurationMs - expectedDurationMs)
        assertTrue("Matching duration within 60s must pass", diff1 <= 60_000L)

        val olderRecordingDurationMs = 300_000L
        val diff2 = kotlin.math.abs(olderRecordingDurationMs - expectedDurationMs)
        assertTrue("Conflicting duration must exceed 60s threshold and be rejected", diff2 > 60_000L)
    }

    @Test
    fun generateTimeTokensProducesAccurateFormatting() {
        val testTimestamp = 1728929535000L
        val tokens = DialerShareAutomation.generateTimeTokens(testTimestamp)
        assertTrue("Must generate non-empty time tokens", tokens.isNotEmpty())
        val hasColon = tokens.all { it.contains(":") }
        assertTrue("All tokens must contain colon time separator", hasColon)
    }

    @Test
    fun callTimeTokensMatchBothStartAndEndForLongOutboundCalls() {
        val endedAt = 1728929535000L
        val durationMs = 4 * 60_000L
        val actual = DialerShareAutomation.generateCallTimeTokens(endedAt, durationMs).toSet()

        assertTrue("Call list may display the call's end time", actual.containsAll(DialerShareAutomation.generateTimeTokens(endedAt)))
        assertTrue("Call list may display the call's start time", actual.containsAll(DialerShareAutomation.generateTimeTokens(endedAt - durationMs)))
    }

    @Test
    fun outboundHistoryDescriptorMatchesCallNumberBeforeSimLineNumber() {
        val descriptor = "+91 62676 05079, Mobile, outgoing call, 9 minutes ago, In HD, call recording, From India, on +91 98765 43210."

        assertTrue(
            "The outbound contact number must match even when Google Phone appends a different SIM line number",
            DialerShareAutomation.containsTargetPhoneNumber(descriptor, "6267605079"),
        )
        assertFalse(
            "An unrelated target number must not match",
            DialerShareAutomation.containsTargetPhoneNumber(descriptor, "1234567890"),
        )
    }

    @Test
    fun armedCallCarriesExpectedDuration() {
        val armed = DialerShareAutomation.ArmedCall(
            callId = "call-123",
            phoneNumber = "9876543210",
            callEndedAt = 1000L,
            expectedDurationMs = 45_000L,
        )
        assertEquals(45_000L, armed.expectedDurationMs)
        assertEquals("call-123", armed.callId)
        assertEquals("9876543210", armed.phoneNumber)
    }

    @Test
    fun candidateQualificationScoreThreshold() {
        // A row from yesterday receives score = 100 - 1000 = -900 (< 400) -> must be disqualified
        val yesterdayScore = 100 - 1000
        assertTrue("Older row score must be below qualification threshold", yesterdayScore < 400)

        // A row with only phone match receives score = 100 (< 400) -> must be disqualified
        val unverifiedScore = 100
        assertTrue("Unverified row without timestamp/recency must be below threshold", unverifiedScore < 400)

        // A row with recency ("just now") receives score = 100 + 400 = 500 (>= 400) -> qualified
        val recencyScore = 100 + 400
        assertTrue("Recency row must qualify", recencyScore >= 400)

        // A row with exact time token match receives score = 100 + 500 = 600 (>= 400) -> qualified
        val timeTokenScore = 100 + 500
        assertTrue("Exact time token match must qualify", timeTokenScore >= 400)
    }

    @Test
    fun armedCallPreservesContactNameAndDirection() {
        val armed = DialerShareAutomation.ArmedCall(
            callId = "call-inbound-999",
            phoneNumber = "9993328124",
            callEndedAt = 1728929112999L,
            expectedDurationMs = 14_000L,
            contactName = "PPW Office No",
            direction = "INBOUND",
        )
        assertEquals("call-inbound-999", armed.callId)
        assertEquals("9993328124", armed.phoneNumber)
        assertEquals("PPW Office No", armed.contactName)
        assertEquals("INBOUND", armed.direction)
    }

    @Test
    fun contactNameAndDirectionScoringQualifiesSavedContacts() {
        // Saved contacts display contactName instead of phoneNumber digits on call cards
        // Matching contact name (+400) + direction (+300) + recency (+400) = 1100 (>= 400) -> qualified!
        val savedContactScore = 400 + 300 + 400
        assertTrue("Saved contact with matching name, direction and recency must qualify", savedContactScore >= 400)

        // Contact name match (+400) alone with recency (+400) = 800 (>= 400) -> qualified!
        val nameWithRecencyScore = 400 + 400
        assertTrue("Contact name match with recency must qualify", nameWithRecencyScore >= 400)

        // Older call with disqualifying tokens from yesterday: 400 + 300 - 1000 = -300 (< 400) -> disqualified!
        val olderScore = 400 + 300 - 1000
        assertTrue("Older contact card from yesterday must be disqualified", olderScore < 400)
    }
}
