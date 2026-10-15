package com.gigxomi.gxclosers.device

import android.os.Build

/** Human-readable device identity for the UI and device registry. */
data class DeviceIdentity(
    val manufacturerLabel: String,
    val modelLabel: String,
    val displayName: String,
) {
    companion object {
        fun current(): DeviceIdentity = from(Build.MANUFACTURER, Build.BRAND, Build.MODEL, Build.DEVICE, Build.PRODUCT)

        fun from(
            manufacturer: String,
            brand: String,
            model: String,
            device: String = "",
            product: String = "",
        ): DeviceIdentity {
            val rawManufacturer = manufacturer.trim()
            val rawModel = model.trim().ifBlank { "Android phone" }
            val search = listOf(rawManufacturer, brand, rawModel, device, product)
                .joinToString(" ").lowercase()
            val isXiaomi = search.contains("xiaomi") || search.contains("redmi") || search.contains("poco")
            val manufacturerLabel = when {
                isXiaomi && search.contains("poco") -> "POCO"
                isXiaomi && (search.contains("redmi") || search.contains("lancelot") || search.contains("m2004j19")) -> "Redmi"
                search.contains("google") || search.contains("pixel") -> "Google"
                search.contains("realme") -> "realme"
                search.contains("oppo") -> "OPPO"
                search.contains("vivo") -> "vivo"
                search.contains("samsung") -> "Samsung"
                search.contains("motorola") || search.contains("lenovo") -> "Motorola"
                rawManufacturer.isNotBlank() -> rawManufacturer.replaceFirstChar { it.uppercase() }
                else -> "Android"
            }
            val modelLabel = if (isXiaomi && (search.contains("lancelot") || search.contains("m2004j19"))) {
                "Redmi 9"
            } else {
                rawModel
            }
            val displayName = if (modelLabel == "Redmi 9" || modelLabel.startsWith(manufacturerLabel, ignoreCase = true)) {
                modelLabel
            } else {
                "$manufacturerLabel $modelLabel"
            }
            return DeviceIdentity(manufacturerLabel, modelLabel, displayName)
        }
    }
}
