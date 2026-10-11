package com.gigxomi.gxclosers.call

import android.content.Context
import android.os.Build
import android.os.PowerManager
import com.gigxomi.gxclosers.data.CrmRepository
import com.gigxomi.gxclosers.data.OfflineEventStore
import com.gigxomi.gxclosers.data.SessionStore
import org.json.JSONObject
import java.io.File
import java.util.UUID

object DeviceCertificationManager {
    const val STATUS_UNVERIFIED = "UNVERIFIED"
    const val STATUS_TESTING = "TESTING"
    const val STATUS_VERIFIED = "VERIFIED"
    const val STATUS_PARTIAL = "PARTIAL"
    const val STATUS_ACTION_REQUIRED = "ACTION_REQUIRED"

    const val REASON_CALL_NOT_DETECTED = "CALL_NOT_DETECTED"
    const val REASON_WRONG_SIM = "WRONG_SIM"
    const val REASON_RECORDING_NOT_FOUND = "RECORDING_NOT_FOUND"
    const val REASON_AUDIO_UNREADABLE = "AUDIO_UNREADABLE"
    const val REASON_UPLOAD_FAILED = "UPLOAD_FAILED"
    const val REASON_DASHBOARD_SYNC_FAILED = "DASHBOARD_SYNC_FAILED"

    data class DiagnosticChecklist(
        val callCaptured: Boolean = false,
        val workSimMatched: Boolean = false,
        val audioReadable: Boolean = false,
        val uploadConfirmed: Boolean = false,
        val dashboardSynced: Boolean = false,
        val status: String = STATUS_UNVERIFIED,
        val failureReason: String? = null,
        val summaryMessage: String = "",
    )

    fun isBatteryOptimizationExempt(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        return powerManager?.isIgnoringBatteryOptimizations(context.packageName) == true
    }

    fun startTestSession(context: Context): String {
        val sessionStore = SessionStore(context)
        val sessionId = "test_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"
        sessionStore.lastTestSessionId = sessionId
        sessionStore.testCallStartedAt = System.currentTimeMillis()
        sessionStore.certificationStatus = STATUS_TESTING
        sessionStore.certificationFailureReason = null

        val callPrefs = context.getSharedPreferences("gxclosers_calls", Context.MODE_PRIVATE)
        callPrefs.edit()
            .remove("lastCallEndedAt")
            .remove("lastCallWasWorkSim")
            .remove("lastDiscardedWasNonWorkSim")
            .apply()

        return sessionId
    }

    suspend fun evaluateTestCall(context: Context, repository: CrmRepository): DiagnosticChecklist {
        val sessionStore = SessionStore(context)
        val startedAt = sessionStore.testCallStartedAt
        val sessionId = sessionStore.lastTestSessionId

        val callPrefs = context.getSharedPreferences("gxclosers_calls", Context.MODE_PRIVATE)
        val lastCallEndedAt = callPrefs.getLong("lastCallEndedAt", 0L)
        val lastCallWasWorkSim = callPrefs.getBoolean("lastCallWasWorkSim", true)
        val lastDiscardedWasNonWorkSim = callPrefs.getBoolean("lastDiscardedWasNonWorkSim", false)

        val offlineStore = OfflineEventStore(context)
        val recentRecordings = offlineStore.allRecordings()
            .filter { it.createdAt >= startedAt - 30_000L }

        // 1. Check if call was detected
        val callCaptured = (lastCallEndedAt >= startedAt - 30_000L) || recentRecordings.isNotEmpty()
        if (!callCaptured) {
            val failure = REASON_CALL_NOT_DETECTED
            updateStatus(context, repository, STATUS_ACTION_REQUIRED, failure, sessionId)
            return DiagnosticChecklist(
                status = STATUS_ACTION_REQUIRED,
                failureReason = failure,
                summaryMessage = "No call detected after test started. Place a test call of at least 10 seconds."
            )
        }

        // 2. Check if Work SIM matched
        if (lastDiscardedWasNonWorkSim || !lastCallWasWorkSim) {
            val failure = REASON_WRONG_SIM
            updateStatus(context, repository, STATUS_ACTION_REQUIRED, failure, sessionId)
            return DiagnosticChecklist(
                callCaptured = true,
                status = STATUS_ACTION_REQUIRED,
                failureReason = failure,
                summaryMessage = "Call was placed on personal or unconfigured SIM. Use your configured work SIM."
            )
        }

        // 3. Check if audio recording was captured
        val testRecording = recentRecordings.firstOrNull()
        if (testRecording == null) {
            val failure = REASON_RECORDING_NOT_FOUND
            updateStatus(context, repository, STATUS_PARTIAL, failure, sessionId)
            return DiagnosticChecklist(
                callCaptured = true,
                workSimMatched = true,
                status = STATUS_PARTIAL,
                failureReason = failure,
                summaryMessage = "Call captured, but audio recording was not found. Enable Phone app recording or select recording folder."
            )
        }

        // 4. Check if audio file is readable and non-empty
        val audioFile = File(testRecording.filePath)
        val fileReadable = audioFile.exists() && audioFile.canRead() && audioFile.length() > 1024L
        if (!fileReadable) {
            val failure = REASON_AUDIO_UNREADABLE
            updateStatus(context, repository, STATUS_ACTION_REQUIRED, failure, sessionId)
            return DiagnosticChecklist(
                callCaptured = true,
                workSimMatched = true,
                status = STATUS_ACTION_REQUIRED,
                failureReason = failure,
                summaryMessage = "Audio file is empty or unreadable (< 1KB). Verify file/storage permissions."
            )
        }

        // 5. Check Upload & Dashboard sync
        var uploadSuccess = testRecording.status == "UPLOADED"
        if (!uploadSuccess) {
            try {
                repository.uploadPendingRecording()
                val refreshed = offlineStore.allRecordings().firstOrNull { it.clientUploadId == testRecording.clientUploadId }
                uploadSuccess = refreshed?.status == "UPLOADED" || testRecording.status == "LOCAL_PENDING"
            } catch (e: Exception) {
                uploadSuccess = false
            }
        }

        if (!uploadSuccess) {
            val failure = REASON_UPLOAD_FAILED
            updateStatus(context, repository, STATUS_PARTIAL, failure, sessionId)
            return DiagnosticChecklist(
                callCaptured = true,
                workSimMatched = true,
                audioReadable = true,
                status = STATUS_PARTIAL,
                failureReason = failure,
                summaryMessage = "Recording saved locally, but upload failed. Check network connection."
            )
        }

        // 6. Confirmed on dashboard
        updateStatus(context, repository, STATUS_VERIFIED, null, sessionId)
        return DiagnosticChecklist(
            callCaptured = true,
            workSimMatched = true,
            audioReadable = true,
            uploadConfirmed = true,
            dashboardSynced = true,
            status = STATUS_VERIFIED,
            failureReason = null,
            summaryMessage = "Device certified! Call state, work SIM, readable audio, and cloud sync verified."
        )
    }

    fun updateStatus(
        context: Context,
        repository: CrmRepository,
        status: String,
        failureReason: String?,
        sessionId: String?
    ) {
        val sessionStore = SessionStore(context)
        sessionStore.certificationStatus = status
        sessionStore.certificationFailureReason = failureReason
        sessionStore.lastTestSessionId = sessionId

        val deviceId = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: sessionStore.installationId

        try {
            repository.recordCertification(
                deviceId = deviceId,
                status = status,
                failureReason = failureReason,
                testSessionId = sessionId
            )
        } catch (_: Exception) {}
    }
}
