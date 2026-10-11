package com.gigxomi.gxclosers.call

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.Manifest
import android.content.pm.PackageManager
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat
import com.gigxomi.gxclosers.data.SalesLead
import org.json.JSONObject

data class CachedLead(
    val id: String,
    val name: String,
    val phone: String,
    val stage: String,
    val notes: String,
    val source: String,
    val serviceInterest: String,
    val email: String,
    val lastTouchBy: String = "",
    val lastTouchSummary: String = "",
)

data class SimOption(
    val subscriptionId: String,
    val slotIndex: Int,
    val label: String,
    val phoneNumber: String?,
    val phoneAccountHandle: PhoneAccountHandle?,
)

object CallManager {
    const val SIM_SELECTION_ASK = "ASK"
    private const val SIM_PREFS = "gxclosers_preferences"
    private const val SIM_SELECTION_KEY = "simSelection"

    fun cacheLeads(context: Context, leads: List<SalesLead>) {
        val editor = context.getSharedPreferences("gxclosers_leads", Context.MODE_PRIVATE).edit().clear()
        leads.forEach { lead ->
            lead.customerPhone.filter(Char::isDigit).takeLast(10).takeIf(String::isNotBlank)?.let { key ->
                editor.putString(key, JSONObject()
                    .put("id", lead.id)
                    .put("name", lead.customerName)
                    .put("phone", lead.customerPhone)
                    .put("stage", lead.stage)
                    .put("notes", lead.notes)
                    .put("source", lead.source)
                    .put("serviceInterest", lead.serviceInterest)
                    .put("email", lead.customerEmail)
                    .put("lastTouchBy", lead.lastTouchBy)
                    .put("lastTouchSummary", lead.lastTouchSummary)
                    .toString())
            }
        }
        editor.apply()
    }

    fun lookup(context: Context, phone: String): CachedLead? {
        val key = phone.filter(Char::isDigit).takeLast(10)
        if (key.isBlank()) return null
        val raw = context.getSharedPreferences("gxclosers_leads", Context.MODE_PRIVATE).getString(key, null) ?: return null
        return runCatching {
            val json = JSONObject(raw)
            CachedLead(
                id = json.optString("id"),
                name = json.optString("name", "Unknown caller"),
                phone = json.optString("phone", phone),
                stage = json.optString("stage"),
                notes = json.optString("notes"),
                source = json.optString("source"),
                serviceInterest = json.optString("serviceInterest"),
                email = json.optString("email"),
                lastTouchBy = json.optString("lastTouchBy"),
                lastTouchSummary = json.optString("lastTouchSummary"),
            )
        }.getOrElse {
            val legacy = raw.split("\u001F")
            CachedLead(
                id = legacy.getOrNull(0).orEmpty(),
                name = legacy.getOrNull(1).orEmpty().ifBlank { "Unknown caller" },
                phone = phone,
                stage = legacy.getOrNull(2).orEmpty(),
                notes = legacy.getOrNull(3).orEmpty(),
                source = "",
                serviceInterest = "",
                email = "",
                lastTouchBy = "",
                lastTouchSummary = "",
            )
        }.takeIf { it.id.isNotBlank() }
    }

    fun prepare(context: Context, callId: String, lead: SalesLead, sim: SimOption? = null) {
        context.getSharedPreferences(CallAudioRecorder.PREFS, Context.MODE_PRIVATE).edit()
            .putString("activeCallId", callId)
            .putString("activeLeadId", lead.id)
            .putString("activePhone", lead.customerPhone)
            .putString("activeSimSubscriptionId", sim?.subscriptionId)
            .putInt("activeSimSlotIndex", sim?.slotIndex ?: -1)
            .putString("activeSimLabel", sim?.label)
            .putString("direction", "OUTBOUND")
            .putBoolean("wasOffhook", false)
            .putLong("activeStartedAt", System.currentTimeMillis())
            .apply()
        LeadCallNotification.show(context, lead.customerPhone)
    }
    fun dial(context: Context, phone: String, sim: SimOption? = null) {
        val direct = Intent(Intent.ACTION_CALL, Uri.parse("tel:${Uri.encode(phone)}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        sim?.phoneAccountHandle?.let { direct.putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }
        runCatching { context.startActivity(direct) }.getOrElse { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    fun simSelection(context: Context): String = context
        .getSharedPreferences(SIM_PREFS, Context.MODE_PRIVATE)
        .getString(SIM_SELECTION_KEY, SIM_SELECTION_ASK)
        .orEmpty()
        .ifBlank { SIM_SELECTION_ASK }

    fun saveSimSelection(context: Context, selection: String) {
        context.getSharedPreferences(SIM_PREFS, Context.MODE_PRIVATE).edit()
            .putString(SIM_SELECTION_KEY, selection.ifBlank { SIM_SELECTION_ASK })
            .apply()
    }

    fun preferredSim(context: Context, sims: List<SimOption>): SimOption? {
        val selection = simSelection(context)
        if (selection == SIM_SELECTION_ASK) return null
        return sims.firstOrNull { it.subscriptionId == selection }
    }

    /**
     * Returns the active subscriptions together with the Telecom phone account
     * used to route an outgoing call. The account handle is what makes the
     * choice deterministic on dual-SIM devices; recording still follows the
     * active cellular call session.
     */
    fun availableSims(context: Context): List<SimOption> {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return emptyList()
        val subscriptions = runCatching {
            context.getSystemService(SubscriptionManager::class.java)?.activeSubscriptionInfoList.orEmpty()
        }.getOrElse { emptyList() }.sortedBy { it.simSlotIndex }
        if (subscriptions.isEmpty()) return emptyList()
        val telecom = context.getSystemService(TelecomManager::class.java)
        val accounts = runCatching { telecom?.callCapablePhoneAccounts.orEmpty() }.getOrElse { emptyList() }
        return subscriptions.mapIndexed { index, info ->
            val handle = accounts.firstOrNull { account -> account.id == info.subscriptionId.toString() }
                ?: accounts.getOrNull(index).takeIf { subscriptions.size == accounts.size }
            val carrier = info.carrierName?.toString()?.trim().orEmpty()
            val display = info.displayName?.toString()?.trim().orEmpty()
            val title = display.takeIf { it.isNotBlank() && !it.equals("SIM", ignoreCase = true) }
                ?: carrier.takeIf(String::isNotBlank)
                ?: "SIM ${info.simSlotIndex + 1}"
            SimOption(
                subscriptionId = info.subscriptionId.toString(),
                slotIndex = info.simSlotIndex,
                label = "$title · SIM ${info.simSlotIndex + 1}",
                phoneNumber = runCatching { info.number }.getOrNull()?.takeIf(String::isNotBlank),
                phoneAccountHandle = handle,
            )
        }
    }

    /**
     * Checks if a given call account identifier (from CallLog PHONE_ACCOUNT_ID,
     * PhoneAccountHandle ID, or Intent extra) matches the configured Work SIM.
     */
    fun isWorkSim(context: Context, rawAccountId: String?): Boolean {
        val sims = availableSims(context)
        if (sims.size <= 1) return true

        val configuredSimId = simSelection(context)
        if (configuredSimId == SIM_SELECTION_ASK || configuredSimId.isBlank()) return true

        val workSim = sims.firstOrNull { it.subscriptionId == configuredSimId } ?: return true
        if (rawAccountId.isNullOrBlank()) {
            // Personal privacy safety: unconfirmed SIM calls on configured dual-SIM devices must not sync.
            return false
        }
        val cleanAccount = rawAccountId.trim()

        // 1. Direct match with configured subscriptionId
        if (cleanAccount == workSim.subscriptionId) return true

        // 2. Match with configured phone account handle id
        workSim.phoneAccountHandle?.id?.let { handleId ->
            if (cleanAccount == handleId || cleanAccount.contains(handleId) || handleId.contains(cleanAccount)) return true
        }

        val otherSims = sims.filter { it.subscriptionId != configuredSimId }

        // 3. Reject first if it matches any other SIM's ID, handle, or exact 0-based slot
        for (other in otherSims) {
            if (cleanAccount == other.subscriptionId) return false
            other.phoneAccountHandle?.id?.let { handleId ->
                if (cleanAccount == handleId || cleanAccount.contains(handleId) || handleId.contains(cleanAccount)) return false
            }
            if (cleanAccount == other.slotIndex.toString()) return false
            if (cleanAccount.equals("SIM${other.slotIndex + 1}", ignoreCase = true)) return false
        }

        // 4. Match with work SIM exact slot (0-indexed) or label ("SIM 1")
        val workSlot0 = workSim.slotIndex.toString()
        if (cleanAccount == workSlot0 || cleanAccount.equals("SIM${workSim.slotIndex + 1}", ignoreCase = true)) {
            return true
        }

        // 5. Fallback 1-based slot index ONLY if no other SIM owns that slot index
        val workSlot1 = (workSim.slotIndex + 1).toString()
        if (cleanAccount == workSlot1 && otherSims.none { it.slotIndex.toString() == cleanAccount }) {
            return true
        }

        // 6. Check SubscriptionInfo directly for ICCID
        val subscriptions = runCatching {
            context.getSystemService(SubscriptionManager::class.java)?.activeSubscriptionInfoList.orEmpty()
        }.getOrElse { emptyList() }

        val workSub = subscriptions.firstOrNull { it.subscriptionId.toString() == configuredSimId }
        val otherSubs = subscriptions.filter { it.subscriptionId.toString() != configuredSimId }

        for (other in otherSubs) {
            val otherIccId = runCatching { other.iccId }.getOrNull()?.takeIf(String::isNotBlank)
            if (otherIccId != null && (cleanAccount == otherIccId || cleanAccount.contains(otherIccId) || otherIccId.contains(cleanAccount))) return false
        }

        val workIccId = runCatching { workSub?.iccId }.getOrNull()?.takeIf(String::isNotBlank)
        if (workIccId != null && (cleanAccount == workIccId || cleanAccount.contains(workIccId) || workIccId.contains(cleanAccount))) return true

        // 6. Substring match for subscriptionId
        if (otherSims.any { cleanAccount.contains(it.subscriptionId) }) return false
        if (cleanAccount.contains(workSim.subscriptionId)) return true

        // Strict default: if not verified as work SIM, reject
        return false
    }

    fun extractSubscriptionId(context: Context, intent: Intent): String? {
        if (intent.hasExtra(SubscriptionManager.EXTRA_SUBSCRIPTION_INDEX)) {
            val sub = intent.getIntExtra(SubscriptionManager.EXTRA_SUBSCRIPTION_INDEX, SubscriptionManager.INVALID_SUBSCRIPTION_ID)
            if (sub != SubscriptionManager.INVALID_SUBSCRIPTION_ID && sub >= 0) return sub.toString()
        }
        val subCandidateKeys = arrayOf("subscription", "subId", "sub_id", "subscription_id")
        for (key in subCandidateKeys) {
            val subExtra = intent.getIntExtra(key, -1).takeIf { it >= 0 }
            if (subExtra != null) return subExtra.toString()
            val strExtra = intent.getStringExtra(key)?.trim()?.takeIf(String::isNotBlank)
            if (strExtra != null) return strExtra
        }

        val slotCandidateKeys = arrayOf("slot", "simSlot", "sim_slot", "simId", "sim_id", "slot_id", "slotId")
        for (key in slotCandidateKeys) {
            val slot = intent.getIntExtra(key, -1).takeIf { it >= 0 }
            if (slot != null) {
                val sims = availableSims(context)
                sims.firstOrNull { it.slotIndex == slot }?.let { return it.subscriptionId }
            }
        }
        return null
    }
}
