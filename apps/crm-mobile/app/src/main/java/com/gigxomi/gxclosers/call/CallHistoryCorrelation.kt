package com.gigxomi.gxclosers.call

/** Pure safeguards for correlating PHONE_STATE transitions with a real call-log row. */
internal object CallHistoryCorrelation {
    const val MAX_ACTIVE_SEQUENCE_AGE_MS = 12 * 60 * 60 * 1000L
    const val CALL_LOG_END_TOLERANCE_MS = 3 * 60 * 1000L
    const val CALL_LOG_RINGING_TOLERANCE_MS = 3 * 60 * 1000L

    fun hasFreshConnectedSequence(wasOffhook: Boolean, offhookAt: Long, endedAt: Long): Boolean =
        wasOffhook && offhookAt > 0L && endedAt >= offhookAt &&
            endedAt - offhookAt <= MAX_ACTIVE_SEQUENCE_AGE_MS

    fun matchesConnectedCallLogRow(
        rowStartedAt: Long,
        durationSeconds: Long,
        observedCallStartedAt: Long,
        observedOffhookAt: Long,
        observedIdleAt: Long,
        expectedPhone: String? = null,
        rowPhone: String? = null,
    ): Boolean {
        if (rowStartedAt <= 0L || durationSeconds <= 0L || observedCallStartedAt <= 0L || observedOffhookAt <= 0L || observedIdleAt < observedOffhookAt) return false
        if (observedIdleAt - observedOffhookAt > MAX_ACTIVE_SEQUENCE_AGE_MS) return false
        if (!phonesMatch(expectedPhone, rowPhone)) return false

        val rowEndedAt = rowStartedAt + durationSeconds * 1000L
        val connectedWindowStart = observedOffhookAt - CALL_LOG_RINGING_TOLERANCE_MS
        return rowStartedAt >= observedCallStartedAt - CALL_LOG_RINGING_TOLERANCE_MS &&
            rowStartedAt <= observedOffhookAt + CALL_LOG_END_TOLERANCE_MS &&
            rowEndedAt >= connectedWindowStart &&
            kotlin.math.abs(rowEndedAt - observedIdleAt) <= CALL_LOG_END_TOLERANCE_MS
    }

    fun matchesMissedCallLogRow(
        rowStartedAt: Long,
        observedCallStartedAt: Long,
        observedIdleAt: Long,
        expectedPhone: String?,
        rowPhone: String?,
    ): Boolean {
        if (rowStartedAt <= 0L || observedCallStartedAt <= 0L || observedIdleAt < observedCallStartedAt) return false
        if (observedIdleAt - observedCallStartedAt > MAX_ACTIVE_SEQUENCE_AGE_MS || !phonesMatch(expectedPhone, rowPhone)) return false
        return rowStartedAt >= observedCallStartedAt - 15_000L && rowStartedAt <= observedIdleAt + 15_000L
    }

    fun isActualAudioAvailable(fileExistsAndNonEmpty: Boolean, uploadJobExists: Boolean): Boolean =
        fileExistsAndNonEmpty || uploadJobExists

    private fun phonesMatch(expectedPhone: String?, rowPhone: String?): Boolean {
        val expectedDigits = expectedPhone.orEmpty().filter(Char::isDigit).takeLast(10)
        if (expectedDigits.isBlank()) return true
        val rowDigits = rowPhone.orEmpty().filter(Char::isDigit).takeLast(10)
        return rowDigits.isNotBlank() && expectedDigits == rowDigits
    }
}
