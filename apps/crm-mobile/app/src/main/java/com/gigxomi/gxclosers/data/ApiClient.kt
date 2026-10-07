package com.gigxomi.gxclosers.data

import com.gigxomi.gxclosers.BuildConfig
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class ApiException(message: String, val status: Int) : Exception(message)

class ApiClient(private val sessionStore: SessionStore) {
    fun get(path: String) = request(path, "GET")
    fun post(path: String, body: JSONObject = JSONObject()) = request(path, "POST", body)

    private fun request(path: String, method: String, body: JSONObject? = null): JSONObject {
        val connection = URL(endpoint(path)).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.setRequestProperty("Accept", "application/json")
            sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val payload = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            if (status !in 200..299) throw ApiException(payload.optString("error", "Request failed ($status)"), status)
            return payload
        } finally { connection.disconnect() }
    }

    fun uploadRecording(callId: String, file: File, durationMs: Long): JSONObject {
        val boundary = "GXClosers-${UUID.randomUUID()}"
        val connection = URL(endpoint("/sales/mobile/call/recording-upload")).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            connection.outputStream.buffered().use { out ->
                fun field(name: String, value: String) { out.write("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n".toByteArray()) }
                field("callSessionId", callId)
                field("recordingDurationMs", durationMs.toString())
                out.write("--$boundary\r\nContent-Disposition: form-data; name=\"recording\"; filename=\"${file.name}\"\r\nContent-Type: audio/mp4\r\n\r\n".toByteArray())
                file.inputStream().use { it.copyTo(out) }
                out.write("\r\n--$boundary--\r\n".toByteArray())
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val payload = JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty())
            if (status !in 200..299) throw ApiException(payload.optString("error", "Recording upload failed"), status)
            return payload
        } finally { connection.disconnect() }
    }

    companion object {
        fun endpoint(path: String) = "${BuildConfig.GXCLOSERS_API_BASE.trimEnd('/')}/${path.trimStart('/')}"
    }
}
