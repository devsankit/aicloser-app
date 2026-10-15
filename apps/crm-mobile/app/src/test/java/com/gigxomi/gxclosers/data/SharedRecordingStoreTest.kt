package com.gigxomi.gxclosers.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedRecordingStoreTest {
    @Test
    fun acceptsGenericPhoneShareWhenFilenameIsAudio() {
        assertTrue(SharedRecordingStore.looksLikeAudio("*/*;audio/x-m4a", "call-recording.m4a"))
        assertTrue(SharedRecordingStore.looksLikeAudio("application/octet-stream", "call-recording.mp3"))
    }

    @Test
    fun rejectsClearlyNonAudioShare() {
        assertFalse(SharedRecordingStore.looksLikeAudio("application/pdf", "call-notes.pdf"))
    }

    @Test
    fun extractsPhoneDigitsFromXiaomiDialer() {
        val phone = SharedRecordingStore.extractPhoneDigits("Call_9876543210_20261014153022.mp3")
        assertEquals("9876543210", phone)
    }

    @Test
    fun extractsPhoneDigitsFromSamsungDialer() {
        val phone = SharedRecordingStore.extractPhoneDigits("Call recording 9876543210_261014_143000.m4a")
        assertEquals("9876543210", phone)
    }

    @Test
    fun extractsPhoneDigitsWithInternationalPrefix() {
        val phone = SharedRecordingStore.extractPhoneDigits("+919876543210_call.m4a")
        assertEquals("9876543210", phone)
    }

    @Test
    fun extractsPhoneDigitsFromVivoOppoDialer() {
        val phone = SharedRecordingStore.extractPhoneDigits("Record_9876543210_20261014_143000.aac")
        assertEquals("9876543210", phone)
    }

    @Test
    fun returnsNullPhoneWhenNoDigits() {
        val phone = SharedRecordingStore.extractPhoneDigits("recording_voice.m4a")
        assertNull(phone)
    }

    @Test
    fun doesNotMistakeTimestampForPhoneNumber() {
        val phone = SharedRecordingStore.extractPhoneDigits("recording_20261014153022.m4a")
        assertNull(phone)
    }

    @Test
    fun extractsTimestampFromStandardFormats() {
        val tsFull = SharedRecordingStore.extractTimestamp("Call_9876543210_20261014_153022.mp3")
        assertNotNull(tsFull)

        val tsContinuous = SharedRecordingStore.extractTimestamp("Call_9876543210_20261014153022.mp3")
        assertNotNull(tsContinuous)

        val tsShort = SharedRecordingStore.extractTimestamp("Call recording 9876543210_261014_143000.m4a")
        assertNotNull(tsShort)

        val tsNone = SharedRecordingStore.extractTimestamp("Audio.m4a")
        assertNull(tsNone)
    }

    @Test
    fun equalDurationAloneCannotAutoAttachWithoutPhoneOrTimestamp() {
        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919876543210",
            candidateCallAt = 1000000L,
            candidateDurationMs = 60000L, // 60s call
            phoneFromFilename = null,     // Generic filename, no phone
            timestampFromFilename = null, // Generic filename, no timestamp
            audioDurationMs = 60000L,     // 60s audio (exact match)
            receivedAt = 1000000L + (120 * 1000L), // shared 2 minutes after call
        )
        // Duration match (+50) + prompt recency (+70) = 120
        // Must be strictly LESS than CONFIDENCE_THRESHOLD (300) to prevent false-positive auto-attach!
        assertTrue("Equal duration alone must not reach CONFIDENCE_THRESHOLD (300). Got score: $score",
            score < SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun rejectsMatchingPhoneWhenTimestampIsThreeHoursWrong() {
        val candidateCallTime = 1000000L
        val threeHoursLater = candidateCallTime + (3 * 60 * 60 * 1000L) // 3 hours difference

        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919876543210",
            candidateCallAt = candidateCallTime,
            candidateDurationMs = 60000L,
            phoneFromFilename = "9876543210",        // Phone matches
            timestampFromFilename = threeHoursLater, // But timestamp is 3 hours wrong!
            audioDurationMs = 60000L,
            receivedAt = threeHoursLater + 60000L,
        )
        // Hard conflict (> 15 min diff) must return -1000 and disqualify
        assertEquals(-1000L, score)
        assertTrue(score < SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun rejectsMatchingPhoneWhenCallOccurredThreeHoursAgoWithoutFilenameTimestamp() {
        val candidateCallTime = 1000000L
        val threeHoursLater = candidateCallTime + (3 * 60 * 60 * 1000L)

        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919876543210",
            candidateCallAt = candidateCallTime,
            candidateDurationMs = 60000L,
            phoneFromFilename = "9876543210",
            timestampFromFilename = null, // No timestamp in filename
            audioDurationMs = 60000L,
            receivedAt = threeHoursLater, // Shared 3 hours later
        )
        // Recording shared > 30m after call without filename timestamp must return hard conflict -1000L
        assertEquals(-1000L, score)
        assertTrue(score < SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun scoreCallGrantsHighConfidenceWhenPhoneAndTimestampMatch() {
        val callTime = 1000000L
        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919876543210",
            candidateCallAt = callTime,
            candidateDurationMs = 120000L,
            phoneFromFilename = "9876543210",
            timestampFromFilename = callTime + 2000L, // within 2 seconds
            audioDurationMs = 122000L,
            receivedAt = callTime + 180000L,
        )
        // Phone match (+200) + exact timestamp distance (+310) + duration match within 10s (+50) = 560
        assertTrue("Expected score >= 350 but got $score", score >= 350L)
        assertTrue(score >= SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun scoreCallRejectsCallThirtyThreeSecondsAwayWithConflict() {
        // Outbound call at 00:18:51 (duration 10s) vs Inbound recording at 00:19:24
        val outboundCallAt = 1792003731586L // 00:18:51.586
        val inboundRecordingTimestamp = 1792003764000L // 00:19:24.000 (32.4s later)

        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919993328124",
            candidateCallAt = outboundCallAt,
            candidateDurationMs = 10000L, // 10s call
            phoneFromFilename = null, // Pixel Google Phone recording has no phone in filename
            timestampFromFilename = inboundRecordingTimestamp,
            audioDurationMs = 17000L, // 17s inbound recording
            receivedAt = inboundRecordingTimestamp + 5000L,
        )
        // A call 33 seconds away must receive a conflict score (-1000L) to prevent cross-linking
        assertEquals(-1000L, score)
        assertTrue(score < SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun scoreCallAcceptsExactTimestampCallWithinFiveSeconds() {
        // Inbound call at 00:19:24.394 vs Inbound recording at 00:19:24.000 (diff = 394 ms)
        val inboundCallAt = 1792003764394L
        val inboundRecordingTimestamp = 1792003764000L

        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919993328124",
            candidateCallAt = inboundCallAt,
            candidateDurationMs = 17000L,
            phoneFromFilename = null,
            timestampFromFilename = inboundRecordingTimestamp,
            audioDurationMs = 17000L,
            receivedAt = inboundRecordingTimestamp + 5000L,
        )
        // 394ms diff gives distance bonus ~342L + duration bonus 50L = ~392L >= 300L (CONFIDENCE_THRESHOLD)
        assertTrue("Expected score >= 350 but got $score", score >= 350L)
        assertTrue(score >= SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun scoreCallGrantsHighConfidenceWhenPhoneMatchesAndCallJustEnded() {
        val callTime = 1000000L
        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919876543210",
            candidateCallAt = callTime,
            candidateDurationMs = 60000L,
            phoneFromFilename = "9876543210",
            timestampFromFilename = null, // No timestamp in filename
            audioDurationMs = 60000L,
            receivedAt = callTime + (120 * 1000L), // Shared 2 minutes after call ended
        )
        // Phone match (+200) + prompt recency within 5m (+70) + duration match within 10s (+50) = 320
        assertTrue("Expected score >= 300 but got $score", score >= 300L)
        assertTrue(score >= SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun scoreCallRejectsMismatchedPhone() {
        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+911122334455",
            candidateCallAt = 1000000L,
            candidateDurationMs = 120000L,
            phoneFromFilename = "9876543210", // Filename has different phone
            timestampFromFilename = 1000000L,
            audioDurationMs = 122000L,
            receivedAt = 1005000L,
        )
        // Explicit phone mismatch must disqualify (-1000)
        assertEquals(-1000L, score)
        assertTrue(score < SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun scoreCallDisqualifiesSevereDurationMismatch() {
        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919876543210",
            candidateCallAt = 1000000L,
            candidateDurationMs = 5000L,  // 5 second call
            phoneFromFilename = "9876543210",
            timestampFromFilename = 1000000L,
            audioDurationMs = 300000L,    // 5 minute audio (295s diff > 60s)
            receivedAt = 1010000L,
        )
        // Duration mismatch > 60s must return hard conflict (-1000)
        assertEquals(-1000L, score)
        assertTrue(score < SharedRecordingStore.CONFIDENCE_THRESHOLD)
    }

    @Test
    fun scoreCallRejectsShortUnrelatedAudioForLongerCall() {
        val score = SharedRecordingStore.scoreCall(
            candidatePhone = "+919876543210",
            candidateCallAt = 1_000_000L,
            candidateDurationMs = 16_000L,
            phoneFromFilename = "9876543210",
            timestampFromFilename = 1_000_000L,
            audioDurationMs = 3_264L,
            receivedAt = 1_001_000L,
        )
        assertEquals(-1000L, score)
    }

    @Test
    fun rejectsAmbiguousTieBetweenTwoCallsToSameNumber() {
        // Two calls to the same contact, close together with identical durations
        val candidateA = CrmCallCandidate(
            callId = "call-a",
            phoneNumber = "+919876543210",
            callAtMillis = 1000000L,
            durationSeconds = 60L,
        )
        val candidateB = CrmCallCandidate(
            callId = "call-b",
            phoneNumber = "+919876543210",
            callAtMillis = 1000000L + 30000L, // 30 seconds later
            durationSeconds = 60L,
        )

        // Filename has matching phone, no timestamp in filename, exact duration match
        // Both candidate A and B score 320!
        val scoreA = SharedRecordingStore.scoreCall(
            candidatePhone = candidateA.phoneNumber,
            candidateCallAt = candidateA.callAtMillis,
            candidateDurationMs = candidateA.durationSeconds * 1000L,
            phoneFromFilename = "9876543210",
            timestampFromFilename = null,
            audioDurationMs = 60000L,
            receivedAt = 1000000L + 60000L,
        )
        val scoreB = SharedRecordingStore.scoreCall(
            candidatePhone = candidateB.phoneNumber,
            candidateCallAt = candidateB.callAtMillis,
            candidateDurationMs = candidateB.durationSeconds * 1000L,
            phoneFromFilename = "9876543210",
            timestampFromFilename = null,
            audioDurationMs = 60000L,
            receivedAt = 1000000L + 60000L,
        )
        assertEquals(320L, scoreA)
        assertEquals(320L, scoreB)

        // Ambiguity check: selectBestCandidate must reject the tie and return null!
        val selected = SharedRecordingStore.selectBestCandidate(
            candidates = listOf(candidateA, candidateB),
            displayName = "Call_9876543210.mp3",
            durationMs = 60000L,
            receivedAt = 1000000L + 60000L,
        )
        assertNull("Tied candidates must be rejected as ambiguous to prevent wrong call attachment", selected)
    }

    @Test
    fun selectsUnambiguousCallWhenOneCandidateHasClearLead() {
        val callEnd = 1792061208000L
        val clearWinner = CrmCallCandidate(
            callId = "call-winner",
            phoneNumber = "+919876543210",
            callAtMillis = callEnd - 120_000L,
            durationSeconds = 120L,
        )
        val distantCandidate = CrmCallCandidate(
            callId = "call-distant",
            phoneNumber = "+919876543210",
            callAtMillis = callEnd - (2 * 60 * 60 * 1000L), // 2 hours earlier
            durationSeconds = 120L,
        )

        val selected = SharedRecordingStore.selectBestCandidate(
            candidates = listOf(clearWinner, distantCandidate),
            displayName = "Call_20261015_161648_9876543210.mp3",
            durationMs = 120000L,
            receivedAt = callEnd + 60000L, // 1 min after clear winner
        )
        assertNotNull(selected)
        assertEquals("call-winner", selected?.callId)
    }
}
