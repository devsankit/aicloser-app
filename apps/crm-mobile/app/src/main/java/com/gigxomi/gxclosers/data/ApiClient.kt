package com.gigxomi.gxclosers.data

import com.gigxomi.gxclosers.BuildConfig
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.FileOutputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

open class ApiException(message: String, val status: Int, val errorCode: String? = null) : Exception(message)
class InvalidCredentialsException(message: String = "Invalid email/phone or password") : ApiException(message, 401, "InvalidCredentials")
class SessionRevokedException(message: String = "This client session is no longer active") : ApiException(message, 401, "SessionRevoked")
class ClientSlotOccupiedException(
    message: String = "Your mobile account is already active on another device.",
    val deviceName: String? = null,
    val lastActiveAt: String? = null
) : ApiException(message, 409, "ClientSlotOccupied")
class ForbiddenException(message: String = "Access denied. Insufficient permissions.") : ApiException(message, 403, "Forbidden")
class NotFoundException(message: String = "The requested resource was not found.") : ApiException(message, 404, "NotFound")
class ValidationException(message: String = "Validation error.") : ApiException(message, 422, "ValidationError")
class NetworkTimeoutException(message: String = "Connection timed out. Please check your internet connection.") : ApiException(message, 408, "NetworkTimeout")

open class ApiClient(protected val sessionStore: SessionStore) {
    open fun get(path: String): JSONObject = request(path, "GET")
    open fun post(path: String, body: JSONObject = JSONObject()): JSONObject = request(path, "POST", body)

    fun downloadRecording(callId: String, destination: File) {
        val connection = URL(endpoint("/sales/mobile/calls/$callId/recording")).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            connection.setRequestProperty("Accept", "audio/mp4,audio/*")
            sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            val status = connection.responseCode
            if (status !in 200..299) {
                val payload = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                val message = runCatching { JSONObject(payload).optString("error") }.getOrNull().orEmpty()
                throw ApiException(message.ifBlank { "Recording could not be loaded ($status)" }, status)
            }
            destination.parentFile?.mkdirs()
            connection.inputStream.use { input -> FileOutputStream(destination).use { output -> input.copyTo(output) } }
        } finally {
            connection.disconnect()
        }
    }

    fun importContacts(file: File): JSONObject {
        val boundary = "GXClosers-Import-${UUID.randomUUID()}"
        val connection = URL(endpoint("/sales/leads/import")).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            connection.setRequestProperty("Accept", "application/json")
            sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            connection.outputStream.buffered().use { out ->
                val safeName = file.name.replace("\"", "")
                out.write("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"$safeName\"\r\nContent-Type: ${contactMimeType(file)}\r\n\r\n".toByteArray(Charsets.UTF_8))
                file.inputStream().use { it.copyTo(out) }
                out.write("\r\n--$boundary--\r\n".toByteArray(Charsets.UTF_8))
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val payload = runCatching { JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty()) }.getOrElse { JSONObject() }
            if (status !in 200..299) throw parseHttpError("/sales/leads/import", status, payload)
            return payload
        } catch (e: SocketTimeoutException) {
            throw NetworkTimeoutException("Contact import timed out")
        } finally {
            connection.disconnect()
        }
    }

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
                throw parseHttpError(path, status, payload)
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
                out.write("--$boundary\r\nContent-Disposition: form-data; name=\"recording\"; filename=\"${file.name}\"\r\nContent-Type: ${recordingMimeType(file)}\r\n\r\n".toByteArray(Charsets.UTF_8))
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
        val mimeType = recordingMimeType(file)
        val init = requestAt(base, "/api/v1/recordings/init", "POST", JSONObject()
            .put("callId", callId).put("clientUploadId", clientUploadId).put("mimeType", mimeType)
            .put("sizeBytes", file.length()).put("durationSeconds", durationMs / 1000))
        val data = init.getJSONObject("data")
        val upload = data.getJSONObject("upload")
        val uploadUrl = data.optString("uploadUrl", "")
        if (uploadUrl.isNotBlank()) {
            putBytes(uploadUrl, file, contentType = mimeType)
        } else {
            putBytes("$base/api/v1/recordings/${upload.getString("id")}/content", file, authenticated = true, method = "POST", contentType = mimeType)
        }
        return requestAt(base, "/api/v1/recordings/${upload.getString("id")}/complete", "POST", JSONObject().put("sizeBytes", file.length()))
    }

    fun requestAt(base: String, path: String, method: String, body: JSONObject? = null): JSONObject {
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

    private fun putBytes(url: String, file: File, authenticated: Boolean = false, method: String = "PUT", contentType: String = recordingMimeType(file)) {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", contentType)
            if (authenticated) sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            file.inputStream().use { input -> connection.outputStream.use { output -> input.copyTo(output) } }
            if (connection.responseCode !in 200..299) throw ApiException("Recording bytes upload failed", connection.responseCode)
        } finally {
            connection.disconnect()
        }
    }

    private fun recordingMimeType(file: File): String = when (file.extension.lowercase()) {
        "m4a", "mp4" -> "audio/mp4"
        "aac" -> "audio/aac"
        "amr" -> "audio/amr"
        "3gp" -> "audio/3gpp"
        "wav" -> "audio/wav"
        "mp3" -> "audio/mpeg"
        "ogg", "oga" -> "audio/ogg"
        else -> "application/octet-stream"
    }

    private fun contactMimeType(file: File): String = when (file.extension.lowercase()) {
        "csv" -> "text/csv"
        "tsv" -> "text/tab-separated-values"
        "xls" -> "application/vnd.ms-excel"
        "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else -> "application/octet-stream"
    }

    fun openRealtimeStream(
        since: String? = null,
        lastEventId: String? = null,
        onEvent: (id: String?, type: String, data: JSONObject) -> Unit
    ): AutoCloseable {
        val running = AtomicBoolean(true)
        var currentLastEventId = lastEventId

        val thread = Thread({
            var backoffMs = 2_000L
            while (running.get()) {
                var connection: HttpURLConnection? = null
                try {
                    val query = if (!since.isNullOrBlank()) "?since=${java.net.URLEncoder.encode(since, "UTF-8")}" else ""
                    val url = URL(endpoint("/sales/realtime$query"))
                    connection = url.openConnection() as HttpURLConnection
                    connection.requestMethod = "GET"
                    connection.connectTimeout = 15_000
                    connection.readTimeout = 60_000
                    connection.setRequestProperty("Accept", "text/event-stream")
                    sessionStore.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
                    if (!currentLastEventId.isNullOrBlank()) {
                        connection.setRequestProperty("Last-Event-ID", currentLastEventId)
                    }

                    if (connection.responseCode !in 200..299) {
                        if (connection.responseCode == 401) {
                            running.set(false)
                            break
                        }
                        Thread.sleep(backoffMs)
                        backoffMs = (backoffMs * 2).coerceAtMost(30_000L)
                        continue
                    }

                    backoffMs = 2_000L
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
                                if (!currentId.isNullOrBlank()) {
                                    currentLastEventId = currentId
                                }
                            } else if (line.startsWith("event:")) {
                                currentEvent = line.substring(6).trim()
                            } else if (line.startsWith("data:")) {
                                if (dataBuffer.isNotEmpty()) dataBuffer.append('\n')
                                dataBuffer.append(line.substring(5).trim())
                            }
                        }
                    }
                } catch (_: InterruptedException) {
                    break
                } catch (_: Exception) {
                    // Closed or network dropped
                } finally {
                    runCatching { connection?.disconnect() }
                }

                if (running.get()) {
                    try {
                        Thread.sleep(backoffMs)
                        backoffMs = (backoffMs * 2).coerceAtMost(30_000L)
                    } catch (_: InterruptedException) {
                        break
                    }
                }
            }
        }, "RealtimeStreamThread")
        thread.isDaemon = true
        thread.start()

        return AutoCloseable {
            running.set(false)
            thread.interrupt()
        }
    }

    companion object {
        fun endpoint(path: String) = "${BuildConfig.GXCLOSERS_API_BASE.trimEnd('/')}/${path.trimStart('/')}"

        fun parseHttpError(path: String, status: Int, payload: JSONObject): ApiException {
            val errorCode = payload.optString("error", "").ifBlank { null }
            val errorMsg = payload.optString("message", payload.optString("error", "Request failed ($status)"))
            return when (status) {
                401 -> {
                    if (errorCode == "SessionRevoked" || errorMsg.contains("revoked", true)) {
                        SessionRevokedException(errorMsg)
                    } else if (path.contains("/login") || errorCode == "InvalidCredentials" || errorMsg.contains("credentials", true) || errorMsg.contains("password", true)) {
                        InvalidCredentialsException(errorMsg.ifBlank { "Invalid email/phone or password" })
                    } else {
                        // Non-login 401 means the stored mobile session can no longer
                        // authenticate. Treat it as a revoked/expired session so the UI can
                        // return to the login screen cleanly.
                        SessionRevokedException(errorMsg.ifBlank { "Your mobile session has expired. Please sign in again." })
                    }
                }
                409 -> {
                    // ClientSlotOccupiedException is strictly confined to login requests.
                    // Non-login endpoints must never throw ClientSlotOccupiedException or trigger takeover prompts.
                    if (path.contains("/login") && (errorCode == "ClientSlotOccupied" || errorMsg.contains("occupied", true) || errorMsg.contains("active on another device", true) || errorMsg.contains("already active", true))) {
                        val dataObj = payload.optJSONObject("data")
                        val devName = payload.optString("deviceName", dataObj?.optString("deviceName", "") ?: "").ifBlank { null }
                        val activeAt = payload.optString("lastActiveAt", dataObj?.optString("lastActiveAt", "") ?: "").ifBlank { null }
                        ClientSlotOccupiedException(
                            message = errorMsg.ifBlank { "Your mobile account is already active on another device." },
                            deviceName = devName,
                            lastActiveAt = activeAt
                        )
                    } else {
                        ApiException(errorMsg, 409, errorCode)
                    }
                }
                403 -> ForbiddenException(errorMsg)
                404 -> NotFoundException(errorMsg)
                422 -> ValidationException(errorMsg)
                400 -> ApiException(errorMsg, 400, errorCode)
                else -> ApiException(errorMsg, status, errorCode)
            }
        }
    }
}
