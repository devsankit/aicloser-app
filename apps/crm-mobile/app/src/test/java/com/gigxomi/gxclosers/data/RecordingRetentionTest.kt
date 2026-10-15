package com.gigxomi.gxclosers.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class RecordingRetentionTest {

    @Test
    fun productionPruneProtectsPendingAndUploadingRecordings() {
        val tempDir = File(System.getProperty("java.io.tmpdir"), "retention-prod-test-${System.currentTimeMillis()}").apply { mkdirs() }
        val crmDir = File(tempDir, "crm-recordings").apply { mkdirs() }
        val sharedDir = File(tempDir, "shared-recordings").apply { mkdirs() }

        try {
            val threeHoursAgo = System.currentTimeMillis() - (3 * 60 * 60 * 1000L)
            val justNow = System.currentTimeMillis()

            // 1. Pending file (3h old, must NOT be deleted)
            val pendingFile = File(crmDir, "pending.m4a").apply {
                writeText("pending audio")
                setLastModified(threeHoursAgo)
            }
            // 2. Uploading file (3h old, must NOT be deleted)
            val uploadingFile = File(crmDir, "uploading.m4a").apply {
                writeText("uploading audio")
                setLastModified(threeHoursAgo)
            }
            // 3. Recently uploaded file (must NOT be deleted due to grace period)
            val uploadedRecentFile = File(crmDir, "uploaded_recent.m4a").apply {
                writeText("recent uploaded audio")
                setLastModified(justNow)
            }
            // 4. Pending shared file in shared-recordings (must NOT be deleted)
            val sharedPendingFile = File(sharedDir, "shared_pending.m4a").apply {
                writeText("shared pending audio")
                setLastModified(threeHoursAgo)
            }

            // Create 11 old uploaded files in crm-recordings so total files > 10 and pruning triggers
            val oldUploadedFiles = (1..11).map { i ->
                File(crmDir, "uploaded_old_$i.m4a").apply {
                    writeText("old uploaded audio $i")
                    setLastModified(threeHoursAgo - i * 1000L)
                }
            }

            val queued = listOf(
                QueuedRecording(
                    clientUploadId = "pending-1",
                    callId = "call-1",
                    tenantId = null,
                    deviceId = "dev-1",
                    filePath = pendingFile.absolutePath,
                    sizeBytes = pendingFile.length(),
                    durationMs = 60000L,
                    status = "LOCAL_PENDING",
                    createdAt = threeHoursAgo,
                ),
                QueuedRecording(
                    clientUploadId = "uploading-1",
                    callId = "call-2",
                    tenantId = null,
                    deviceId = "dev-1",
                    filePath = uploadingFile.absolutePath,
                    sizeBytes = uploadingFile.length(),
                    durationMs = 60000L,
                    status = "UPLOADING",
                    createdAt = threeHoursAgo,
                ),
                QueuedRecording(
                    clientUploadId = "recent-1",
                    callId = "call-3",
                    tenantId = null,
                    deviceId = "dev-1",
                    filePath = uploadedRecentFile.absolutePath,
                    sizeBytes = uploadedRecentFile.length(),
                    durationMs = 60000L,
                    status = "UPLOADED",
                    createdAt = justNow,
                ),
            ) + oldUploadedFiles.mapIndexed { index, file ->
                QueuedRecording(
                    clientUploadId = "old-$index",
                    callId = "call-old-$index",
                    tenantId = null,
                    deviceId = "dev-1",
                    filePath = file.absolutePath,
                    sizeBytes = file.length(),
                    durationMs = 60000L,
                    status = "UPLOADED",
                    createdAt = threeHoursAgo,
                )
            }

            // Directly invoke the real production RecordingUploadWorker.pruneOldRecordings!
            RecordingUploadWorker.pruneOldRecordings(
                filesDir = tempDir,
                recordingsProvider = { queued },
                pendingSharedPathProvider = { sharedPendingFile.absolutePath },
                activeCallIdProvider = { null },
                nowMillis = justNow,
            )

            // Assert production behavior:
            // 1. Pending recording MUST exist on disk
            assertTrue("LOCAL_PENDING file must not be deleted by production prune", pendingFile.exists())
            // 2. Uploading recording MUST exist on disk
            assertTrue("UPLOADING file must not be deleted by production prune", uploadingFile.exists())
            // 3. Recently uploaded recording MUST exist on disk
            assertTrue("Recent uploaded file must not be deleted by production prune", uploadedRecentFile.exists())
            // 4. Pending shared file MUST exist on disk
            assertTrue("Pending shared file must not be deleted by production prune", sharedPendingFile.exists())

            // 5. Some old uploaded files must have been pruned to bring total count down towards 10
            val remainingOldFiles = oldUploadedFiles.filter { it.exists() }
            assertTrue("At least one old uploaded file must have been pruned", remainingOldFiles.size < oldUploadedFiles.size)
        } finally {
            tempDir.deleteRecursively()
        }
    }

    @Test
    fun productionPruneProtectsActiveCallRecording() {
        val tempDir = File(System.getProperty("java.io.tmpdir"), "retention-active-test-${System.currentTimeMillis()}").apply { mkdirs() }
        val crmDir = File(tempDir, "crm-recordings").apply { mkdirs() }

        try {
            val threeHoursAgo = System.currentTimeMillis() - (3 * 60 * 60 * 1000L)
            val justNow = System.currentTimeMillis()

            val activeCallFile = File(crmDir, "active_call.m4a").apply {
                writeText("active call audio")
                setLastModified(threeHoursAgo)
            }

            val oldUploadedFiles = (1..12).map { i ->
                File(crmDir, "uploaded_$i.m4a").apply {
                    writeText("old uploaded audio $i")
                    setLastModified(threeHoursAgo - i * 1000L)
                }
            }

            val queued = listOf(
                QueuedRecording(
                    clientUploadId = "active-1",
                    callId = "active-call-id",
                    tenantId = null,
                    deviceId = "dev-1",
                    filePath = activeCallFile.absolutePath,
                    sizeBytes = activeCallFile.length(),
                    durationMs = 120000L,
                    status = "RECORDING",
                    createdAt = threeHoursAgo,
                )
            ) + oldUploadedFiles.mapIndexed { index, file ->
                QueuedRecording(
                    clientUploadId = "old-$index",
                    callId = "call-old-$index",
                    tenantId = null,
                    deviceId = "dev-1",
                    filePath = file.absolutePath,
                    sizeBytes = file.length(),
                    durationMs = 60000L,
                    status = "UPLOADED",
                    createdAt = threeHoursAgo,
                )
            }

            // Execute production worker retention with activeCallId = "active-call-id"
            RecordingUploadWorker.pruneOldRecordings(
                filesDir = tempDir,
                recordingsProvider = { queued },
                pendingSharedPathProvider = { null },
                activeCallIdProvider = { "active-call-id" },
                nowMillis = justNow,
            )

            assertTrue("Active call file must not be deleted by production prune", activeCallFile.exists())
        } finally {
            tempDir.deleteRecursively()
        }
    }
}
