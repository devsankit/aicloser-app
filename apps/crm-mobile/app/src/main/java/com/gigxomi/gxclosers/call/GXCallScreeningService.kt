package com.gigxomi.gxclosers.call

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

class GXCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        Log.i("GXCallScreening", "screened incoming number=$number")

        val lead = CallManager.lookup(this, number)
        val isLead = lead != null

        // 1. Dual-SIM check: If incoming call is on personal SIM and NOT a lead, allow silently without CRM UI
        val accountId = details.accountHandle?.id
        if (!isLead && !accountId.isNullOrBlank() && !CallManager.isWorkSim(this, accountId)) {
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

        if (isMultiSimConfigured && accountId.isNullOrBlank() && !isLead) {
            Log.i("GXCallScreening", "Unknown caller with undetermined SIM on dual-SIM device - not showing CRM overlay")
            respondToCall(details, CallResponse.Builder().setDisallowCall(false).setRejectCall(false).build())
            return
        }

        getSharedPreferences(CallAudioRecorder.PREFS, MODE_PRIVATE).edit()
            .putString("screenedIncomingPhone", number)
            .putLong("screenedIncomingAt", System.currentTimeMillis())
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
