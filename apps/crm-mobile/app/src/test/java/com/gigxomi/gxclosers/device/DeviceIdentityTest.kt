package com.gigxomi.gxclosers.device

import org.junit.Assert.assertEquals
import org.junit.Test

class DeviceIdentityTest {
    @Test
    fun redmiNineCodeIsShownAsFriendlyModel() {
        val identity = DeviceIdentity.from("Xiaomi", "Redmi", "M2004J19PI", product = "lancelot")

        assertEquals("Redmi", identity.manufacturerLabel)
        assertEquals("Redmi 9", identity.modelLabel)
        assertEquals("Redmi 9", identity.displayName)
    }

    @Test
    fun pixelKeepsReadableGoogleModel() {
        val identity = DeviceIdentity.from("Google", "google", "Pixel 9")

        assertEquals("Google Pixel 9", identity.displayName)
    }
}
