package com.gigxomi.gxclosers.data

import org.junit.Assert.assertEquals
import org.junit.Test

class OfflineEventStoreRecoveryTest {

    @Test
    fun extractCallIdFromSharedRecordingFilename() {
        // Test various filename formats generated during attachment
        val filename1 = "shared-call_abc_123-1728950000000.m4a"
        val nameWithoutExt1 = filename1.substringBeforeLast(".")
        val callId1 = when {
            nameWithoutExt1.startsWith("shared-") -> {
                nameWithoutExt1.removePrefix("shared-").substringBeforeLast("-")
            }
            nameWithoutExt1.contains("-system-") -> nameWithoutExt1.substringBefore("-system-")
            nameWithoutExt1.contains("-shared-") -> nameWithoutExt1.substringBefore("-shared-")
            nameWithoutExt1.contains("-") -> nameWithoutExt1.substringBeforeLast("-")
            else -> ""
        }.removePrefix("shared-")

        assertEquals("call_abc_123", callId1)

        val filename2 = "shared-uuid_9988_77-1728950000000.mp3"
        val nameWithoutExt2 = filename2.substringBeforeLast(".")
        val callId2 = when {
            nameWithoutExt2.startsWith("shared-") -> {
                nameWithoutExt2.removePrefix("shared-").substringBeforeLast("-")
            }
            nameWithoutExt2.contains("-system-") -> nameWithoutExt2.substringBefore("-system-")
            nameWithoutExt2.contains("-shared-") -> nameWithoutExt2.substringBefore("-shared-")
            nameWithoutExt2.contains("-") -> nameWithoutExt2.substringBeforeLast("-")
            else -> ""
        }.removePrefix("shared-")

        assertEquals("uuid_9988_77", callId2)
    }

    @Test
    fun extractCallIdFromSystemRecordingFilename() {
        val filename = "call_xyz_456-system-1728950000000.m4a"
        val nameWithoutExt = filename.substringBeforeLast(".")
        val callId = when {
            nameWithoutExt.startsWith("shared-") -> {
                nameWithoutExt.removePrefix("shared-").substringBeforeLast("-")
            }
            nameWithoutExt.contains("-system-") -> nameWithoutExt.substringBefore("-system-")
            nameWithoutExt.contains("-shared-") -> nameWithoutExt.substringBefore("-shared-")
            nameWithoutExt.contains("-") -> nameWithoutExt.substringBeforeLast("-")
            else -> ""
        }.removePrefix("shared-")

        assertEquals("call_xyz_456", callId)
    }
}
