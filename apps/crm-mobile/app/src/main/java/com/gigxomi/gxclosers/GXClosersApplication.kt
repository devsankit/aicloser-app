package com.gigxomi.gxclosers

import android.app.Application
import com.gigxomi.gxclosers.data.RecordingUploadWorker
import com.gigxomi.gxclosers.data.OfflineEventStore
import java.io.File
import com.gigxomi.gxclosers.call.CallAudioRecorder
import com.gigxomi.gxclosers.call.DialerShareAutomation
import com.gigxomi.gxclosers.data.CallbackReminderWorker

class GXClosersApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        OfflineEventStore(this).reconcileRecordingFiles(File(filesDir, "crm-recordings"), CallAudioRecorder.currentCallId())
        DialerShareAutomation.repairUploadedRecordingStatuses(this)
        // A previous failed upload may still have a long WorkManager backoff.
        // Replacing it at process start lets a newly foregrounded app retry
        // immediately instead of appearing stuck with a stale queue.
        RecordingUploadWorker.retryNow(this)
        CallbackReminderWorker.enqueue(this)
    }
}
