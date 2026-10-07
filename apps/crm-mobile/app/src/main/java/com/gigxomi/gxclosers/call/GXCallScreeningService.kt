package com.gigxomi.gxclosers.call

import android.telecom.Call
import android.telecom.CallScreeningService

class GXCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        val lead = getSharedPreferences("gxclosers_leads", MODE_PRIVATE).getString(number.filter(Char::isDigit).takeLast(10), null)?.split("\u001F")
        getSharedPreferences(CallAudioRecorder.PREFS, MODE_PRIVATE).edit().putString("phone", number).putString("state", "RINGING").putString("direction", "INBOUND").putString("pendingInboundLeadId", lead?.getOrNull(0)).putLong("callStartedAt", System.currentTimeMillis()).apply()
        if (number.isNotBlank()) LeadCallNotification.show(this, number)
        respondToCall(details, CallResponse.Builder().setDisallowCall(false).setRejectCall(false).build())
    }
}
