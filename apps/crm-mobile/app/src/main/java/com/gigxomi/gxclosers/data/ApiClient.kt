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

    fun uploadRecording(callId: String, clientUploadId: String, file: File, durationMs: Long): JSONObject {
        if (BuildConfig.AICLOSER_DEDICATED_API_BASE.isNotBlank()) return uploadRecordingToDedicatedApi(callId, clientUploadId, file, durationMs)
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
                field("clientUploadId", clientUploadId)
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

    private fun uploadRecordingToDedicatedApi(callId: String, clientUploadId: String, file: File, durationMs: Long): JSONObject {
        val base = BuildConfig.AICLOSER_DEDICATED_API_BASE.trimEnd('/')
        val init = requestAt(base, "/api/v1/recordings/init", "POST", JSONObject()
            .put("callId", callId).put("clientUploadId", clientUploadId).put("mimeType", "audio/mp4")
            .put("sizeBytes", file.length()).put("durationSeconds", durationMs / 1000))
        val data = init.getJSONObject("data")
        val upload = data.getJSONObject("upload")
        val uploadUrl = data.optString("uploadUrl", "")
        if (uploadUrl.isNotBlank()) {
            putBytes(uploadUrl, file)
        } else {
            putBytes("$base/api/v1/recordings/${upload.getString("id")}/content", file, authenticated = true, method = "POST")
        }
        return requestAt(base, "/api/v1/recordings/${upload.getString("id")}/complete", "POST", JSONObject().put("sizeBytes", file.length()))
    }

    private fun requestAt(base: String, path: String, method: String, body: JSONObject? = null): JSONObject {
        val connection = URL("${base.trimEnd('/')}/${path.trimStart('/')}").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method; connection.connectTimeout = 15_000; connection.readTimeout = 60_000
            connection.setRequestProperty("Accept", "application/json")
            sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val payload = JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty().ifBlank { "{}" })
            if (status !in 200..299) throw ApiException(payload.optString("error", "Request failed ($status)"), status)
            return payload
        } finally { connection.disconnect() }
    }

    private fun putBytes(url: String, file: File, authenticated: Boolean = false, method: String = "PUT") {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method; connection.connectTimeout = 15_000; connection.readTimeout = 60_000; connection.doOutput = true
            connection.setRequestProperty("Content-Type", "audio/mp4")
            if (authenticated) sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            file.inputStream().use { input -> connection.outputStream.use { output -> input.copyTo(output) } }
            if (connection.responseCode !in 200..299) throw ApiException("Recording bytes upload failed", connection.responseCode)
        } finally { connection.disconnect() }
    }

    companion object {
        fun endpoint(path: String) = "${BuildConfig.GXCLOSERS_API_BASE.trimEnd('/')}/${path.trimStart('/')}"
    }
}
