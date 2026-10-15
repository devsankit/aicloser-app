package com.gigxomi.gxclosers.call

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CallLogSyncManagerTest {
    @Test
    fun shareRecoveryAcceptsOnlyFreshCompletedCalls() {
        val now = 1_800_000_000_000L
        assertTrue(CallLogSyncManager.isFreshCompletedCallForShareAutomation(now, now - 30_000L, 18L))
        assertFalse(CallLogSyncManager.isFreshCompletedCallForShareAutomation(now, now - 180_001L, 18L))
        assertFalse(CallLogSyncManager.isFreshCompletedCallForShareAutomation(now, now + 1L, 18L))
        assertFalse(CallLogSyncManager.isFreshCompletedCallForShareAutomation(now, now - 1_000L, 0L))
    }
}
