package com.gigxomi.gxclosers.call

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

class GXCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        Log.i("GXCallScreening", "screened incoming number=$number")

        // 1. Dual-SIM check: If incoming call is on personal SIM, allow silently without CRM UI
        val accountId = details.accountHandle?.id
        if (!accountId.isNullOrBlank() && !CallManager.isWorkSim(this, accountId)) {
            Log.i("GXCallScreening", "Ignoring personal SIM call in CallScreening accountId=$accountId")
            respondToCall(details, CallResponse.Builder().setDisallowCall(false).setRejectCall(false).build())
            return
        }

        // 2. Multi-SIM privacy: if multi-SIM is configured and SIM is unknown, and caller is NOT a CRM lead,
        // do not pop up CRM UI over personal dialer.
        val sims = CallManager.availableSims(this)
        val isMultiSimConfigured = sims.size > 1 &&
            CallManager.simSelection(this) != CallManager.SIM_SELECTION_ASK &&
            CallManager.simSelection(this).isNotBlank()
        val lead = CallManager.lookup(this, number)

        if (isMultiSimConfigured && accountId.isNullOrBlank() && lead == null) {
            Log.i("GXCallScreening", "Unknown caller with undetermined SIM on dual-SIM device - not showing CRM overlay")
            respondToCall(details, CallResponse.Builder().setDisallowCall(false).setRejectCall(false).build())
            return
        }

        getSharedPreferences(CallAudioRecorder.PREFS, MODE_PRIVATE).edit()
            .putString("phone", number)
            .putString("state", "RINGING")
            .putString("direction", "INBOUND")
            .putLong("callStartedAt", System.currentTimeMillis())
            .apply()
        if (number.isNotBlank()) {
            LeadCallNotification.show(this, number)
            CallOverlayWindow.show(this, number)
        }
        respondToCall(details, CallResponse.Builder().setDisallowCall(false).setRejectCall(false).build())
    }
}
