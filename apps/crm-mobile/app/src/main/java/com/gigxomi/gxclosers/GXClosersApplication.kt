package com.gigxomi.gxclosers

import android.app.Application
import com.gigxomi.gxclosers.data.RecordingUploadWorker
import com.gigxomi.gxclosers.data.OfflineEventStore
import java.io.File
import com.gigxomi.gxclosers.call.CallAudioRecorder
import com.gigxomi.gxclosers.call.DialerShareAutomation
import com.gigxomi.gxclosers.data.CallbackReminderWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class GXClosersApplication : Application() {
    private val startupMaintenanceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        // Process restarts resume active automation timers and dialer launch without losing state
        DialerShareAutomation.resumeIfNeeded(this)
        DialerShareAutomation.isMicrophoneFallbackEnabled(this)
        startupMaintenanceScope.launch {
            val activeCallId = CallAudioRecorder.currentCallId()
            OfflineEventStore(this@GXClosersApplication).reconcileRecordingFiles(
                File(filesDir, "crm-recordings"),
                activeCallId,
            )
            OfflineEventStore(this@GXClosersApplication).reconcileRecordingFiles(
                File(filesDir, "shared-recordings"),
                activeCallId,
            )
            DialerShareAutomation.repairUploadedRecordingStatuses(this@GXClosersApplication)
            // A previous failed upload may still have a long WorkManager backoff.
            // Replacing it at process start lets a newly foregrounded app retry
            // immediately instead of appearing stuck with a stale queue.
            RecordingUploadWorker.retryNow(this@GXClosersApplication)
            CallbackReminderWorker.enqueue(this@GXClosersApplication)
        }
    }
}
