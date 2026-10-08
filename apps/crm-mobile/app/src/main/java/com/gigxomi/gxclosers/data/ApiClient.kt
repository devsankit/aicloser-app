package com.gigxomi.gxclosers.data

import com.gigxomi.gxclosers.BuildConfig
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

open class ApiException(message: String, val status: Int, val errorCode: String? = null) : Exception(message)
class InvalidCredentialsException(message: String = "Invalid email/phone or password") : ApiException(message, 401, "InvalidCredentials")
class SessionRevokedException(message: String = "This client session is no longer active") : ApiException(message, 401, "SessionRevoked")
class ClientSlotOccupiedException(message: String = "Your mobile account is already active on another device.") : ApiException(message, 409, "ClientSlotOccupied")
class ForbiddenException(message: String = "Access denied. Insufficient permissions.") : ApiException(message, 403, "Forbidden")
class NotFoundException(message: String = "The requested resource was not found.") : ApiException(message, 404, "NotFound")
class ValidationException(message: String = "Validation error.") : ApiException(message, 422, "ValidationError")
class NetworkTimeoutException(message: String = "Connection timed out. Please check your internet connection.") : ApiException(message, 408, "NetworkTimeout")

class ApiClient(private val sessionStore: SessionStore) {
    fun get(path: String) = request(path, "GET")
    fun post(path: String, body: JSONObject = JSONObject()) = request(path, "POST", body)

    private fun request(path: String, method: String, body: JSONObject? = null): JSONObject {
        val url = URL(endpoint(path))
        val connection = url.openConnection() as HttpURLConnection
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
            if (status !in 200..299) {
                val errorCode = payload.optString("error", "").ifBlank { null }
                val errorMsg = payload.optString("message", payload.optString("error", "Request failed ($status)"))
                when (status) {
                    401 -> {
                        if (errorCode == "SessionRevoked" || errorMsg.contains("revoked", true)) {
                            throw SessionRevokedException(errorMsg)
                        }
                        if (errorCode == "InvalidCredentials" || errorMsg.contains("credentials", true) || errorMsg.contains("password", true)) {
                            throw InvalidCredentialsException(errorMsg)
                        }
                        throw ApiException(errorMsg, 401, errorCode)
                    }
                    409 -> {
                        if (errorCode == "ClientSlotOccupied" || errorMsg.contains("occupied", true) || errorMsg.contains("active on another device", true)) {
                            throw ClientSlotOccupiedException("Your mobile account is already active on another device.")
                        }
                        throw ApiException(errorMsg, 409, errorCode)
                    }
                    403 -> throw ForbiddenException(errorMsg)
                    404 -> throw NotFoundException(errorMsg)
                    422 -> throw ValidationException(errorMsg)
                    else -> throw ApiException(errorMsg, status, errorCode)
                }
            }
            return payload
        } catch (e: SocketTimeoutException) {
            throw NetworkTimeoutException()
        } finally {
            connection.disconnect()
        }
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
            connection.setRequestProperty("Accept", "application/json")
            sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            connection.outputStream.buffered().use { out ->
                fun field(name: String, value: String) {
                    out.write("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n".toByteArray(Charsets.UTF_8))
                }
                field("callSessionId", callId)
                field("clientUploadId", clientUploadId)
                field("recordingDurationMs", durationMs.toString())
                out.write("--$boundary\r\nContent-Disposition: form-data; name=\"recording\"; filename=\"${file.name}\"\r\nContent-Type: audio/mp4\r\n\r\n".toByteArray(Charsets.UTF_8))
                file.inputStream().use { it.copyTo(out) }
                out.write("\r\n--$boundary--\r\n".toByteArray(Charsets.UTF_8))
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val payload = runCatching { JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty()) }.getOrElse { JSONObject() }
            if (status !in 200..299) {
                val errorMsg = payload.optString("message", payload.optString("error", "Recording upload failed ($status)"))
                throw ApiException(errorMsg, status)
            }
            return payload
        } catch (e: SocketTimeoutException) {
            throw NetworkTimeoutException("Recording upload timed out")
        } finally {
            connection.disconnect()
        }
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
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            connection.setRequestProperty("Accept", "application/json")
            sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val payload = JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty().ifBlank { "{}" })
            if (status !in 200..299) throw ApiException(payload.optString("error", "Request failed ($status)"), status)
            return payload
        } finally {
            connection.disconnect()
        }
    }

    private fun putBytes(url: String, file: File, authenticated: Boolean = false, method: String = "PUT") {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "audio/mp4")
            if (authenticated) sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            file.inputStream().use { input -> connection.outputStream.use { output -> input.copyTo(output) } }
            if (connection.responseCode !in 200..299) throw ApiException("Recording bytes upload failed", connection.responseCode)
        } finally {
            connection.disconnect()
        }
    }

    fun openRealtimeStream(
        since: String? = null,
        lastEventId: String? = null,
        onEvent: (id: String?, type: String, data: JSONObject) -> Unit
    ): AutoCloseable {
        val running = AtomicBoolean(true)
        val query = if (!since.isNullOrBlank()) "?since=${java.net.URLEncoder.encode(since, "UTF-8")}" else ""
        val url = URL(endpoint("/sales/realtime$query"))
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.connectTimeout = 15_000
        connection.readTimeout = 60_000
        connection.setRequestProperty("Accept", "text/event-stream")
        sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
        if (!lastEventId.isNullOrBlank()) {
            connection.setRequestProperty("Last-Event-ID", lastEventId)
        }

        val thread = Thread({
            try {
                if (connection.responseCode !in 200..299) {
                    if (connection.responseCode == 401) {
                        throw SessionRevokedException()
                    }
                    return@Thread
                }
                BufferedReader(InputStreamReader(connection.inputStream, Charsets.UTF_8)).use { reader ->
                    var currentId: String? = null
                    var currentEvent: String? = null
                    val dataBuffer = StringBuilder()

                    while (running.get()) {
                        val line = reader.readLine() ?: break
                        if (line.isBlank()) {
                            if (dataBuffer.isNotEmpty()) {
                                val json = runCatching { JSONObject(dataBuffer.toString()) }.getOrElse { JSONObject() }
                                onEvent(currentId, currentEvent ?: "message", json)
                                dataBuffer.setLength(0)
                                currentEvent = null
                            }
                        } else if (line.startsWith("id:")) {
                            currentId = line.substring(3).trim()
                        } else if (line.startsWith("event:")) {
                            currentEvent = line.substring(6).trim()
                        } else if (line.startsWith("data:")) {
                            if (dataBuffer.isNotEmpty()) dataBuffer.append("\n")
                            dataBuffer.append(line.substring(5).trim())
                        }
                    }
                }
            } catch (_: Exception) {
                // Closed or network dropped
            } finally {
                connection.disconnect()
            }
        }, "RealtimeStreamThread")
        thread.isDaemon = true
        thread.start()

        return AutoCloseable {
            running.set(false)
            try { connection.disconnect() } catch (_: Exception) {}
        }
    }

    companion object {
        fun endpoint(path: String) = "${BuildConfig.GXCLOSERS_API_BASE.trimEnd('/')}/${path.trimStart('/')}"
    }
}
