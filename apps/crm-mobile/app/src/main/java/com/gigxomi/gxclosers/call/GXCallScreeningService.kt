package com.gigxomi.gxclosers.call

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

class GXCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        Log.i("GXCallScreening", "screened incoming number=$number")
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
            CallOverlayWindow.show(this, number)
        }
        respondToCall(details, CallResponse.Builder().setDisallowCall(false).setRejectCall(false).build())
    }
}
