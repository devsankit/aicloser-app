package com.gigxomi.gxclosers.call

import android.telecom.Call
import android.telecom.CallScreeningService
import android.content.Intent
import android.os.Build

class GXCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        val lead = CallManager.lookup(this, number)
        getSharedPreferences(CallAudioRecorder.PREFS, MODE_PRIVATE).edit()
            .putString("phone", number)
            .putString("state", "RINGING")
            .putString("direction", "INBOUND")
            .putString("pendingInboundLeadId", lead?.id)
            .putLong("callStartedAt", System.currentTimeMillis())
            .apply()
        if (number.isNotBlank()) {
            LeadCallNotification.show(this, number)
            runCatching {
                val overlay = Intent(this, CallOverlayService::class.java)
                    .setAction(CallOverlayService.ACTION_SHOW)
                    .putExtra(CallOverlayService.EXTRA_PHONE, number)
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(overlay) else startService(overlay)
            }
        }
        respondToCall(details, CallResponse.Builder().setDisallowCall(false).setRejectCall(false).build())
    }
}
