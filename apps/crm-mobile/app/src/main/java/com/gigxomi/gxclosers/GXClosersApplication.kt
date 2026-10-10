package com.gigxomi.gxclosers

import android.app.Application
import com.gigxomi.gxclosers.data.RecordingUploadWorker
import com.gigxomi.gxclosers.data.OfflineEventStore
import java.io.File
import com.gigxomi.gxclosers.call.CallAudioRecorder
import com.gigxomi.gxclosers.data.CallbackReminderWorker

class GXClosersApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        OfflineEventStore(this).reconcileRecordingFiles(File(filesDir, "crm-recordings"), CallAudioRecorder.currentCallId())
        RecordingUploadWorker.enqueue(this)
        CallbackReminderWorker.enqueue(this)
    }
}
