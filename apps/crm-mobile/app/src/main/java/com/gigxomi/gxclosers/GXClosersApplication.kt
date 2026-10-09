package com.gigxomi.gxclosers

import android.app.Application
import com.gigxomi.gxclosers.data.RecordingUploadWorker
import com.gigxomi.gxclosers.data.CallbackReminderWorker

class GXClosersApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        RecordingUploadWorker.enqueue(this)
        CallbackReminderWorker.enqueue(this)
    }
}
