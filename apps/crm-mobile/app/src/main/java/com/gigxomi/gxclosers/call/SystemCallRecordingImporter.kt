package com.gigxomi.gxclosers.call

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import com.gigxomi.gxclosers.data.RecordingFolderStore
import java.io.File
import kotlin.math.abs

/**
 * Imports the recording created by the device's own dialer.
 *
 * The preferred source is the folder explicitly selected by the user through
 * ACTION_OPEN_DOCUMENT_TREE. This is the same boundary used by TeleCRM-style
 * integrations: the dialer owns recording, while this app only reads a folder
 * the user granted access to. MediaStore remains a compatibility fallback for
 * dialers that publish recordings there.
 */
object SystemCallRecordingImporter {
    data class ImportedRecording(
        val file: File,
        val sourceId: String,
        val durationMs: Long,
    )

    data class FolderCheck(
        val fileName: String,
        val durationMs: Long,
    )

    private data class Candidate(
        val sourceUri: Uri,
        val sourceId: String,
        val name: String,
        val mimeType: String,
        val size: Long,
        val modifiedAt: Long,
        val durationMs: Long,
        val pathHint: String,
        val score: Long,
        val sourceFile: File? = null,
    )

    fun importLatest(
        context: Context,
        callStartedAt: Long,
        callEndedAt: Long,
        expectedDurationSeconds: Long,
        phoneNumber: String?,
    ): ImportedRecording? {
        if (expectedDurationSeconds <= 0L) return null

        val expectedDurationMs = expectedDurationSeconds * 1000L
        val selectedFolderCandidate = findInSelectedFolder(
            context,
            callStartedAt,
            callEndedAt,
            expectedDurationMs,
            phoneNumber,
        )
        val candidate = selectedFolderCandidate
            ?: findInKnownDeviceFolders(callStartedAt, callEndedAt, expectedDurationMs, phoneNumber)
            ?: findInMediaStore(context, callStartedAt, callEndedAt, expectedDurationMs, phoneNumber)
            ?: return null

        val extension = extensionFor(candidate.name, candidate.mimeType)
        val directory = File(context.filesDir, "crm-recordings").apply { mkdirs() }
        val safeId = candidate.sourceId.hashCode().toUInt().toString(16)
        val destination = File(directory, "system-$safeId-${candidate.modifiedAt}$extension")
        if (!destination.exists() || destination.length() == 0L) {
            val copied = runCatching {
                if (candidate.sourceFile != null) {
                    candidate.sourceFile.inputStream().use { input ->
                        destination.outputStream().use { output -> input.copyTo(output) }
                    }
                } else {
                    context.contentResolver.openInputStream(candidate.sourceUri)?.use { input ->
                        destination.outputStream().use { output -> input.copyTo(output) }
                    } ?: 0L
                }
            }.getOrDefault(0L)
            if (copied <= 0L) {
                destination.delete()
                return null
            }
        }

        val actualDuration = duration(destination).takeIf { it > 0L } ?: candidate.durationMs
        return ImportedRecording(destination, candidate.sourceId, actualDuration)
    }

    /** Checks that the user-selected folder is readable and contains audio. */
    fun checkSelectedFolder(context: Context): FolderCheck? {
        val treeUri = RecordingFolderStore.getTreeUri(context) ?: return null
        val resolver = context.contentResolver
        val treeDocumentId = runCatching { DocumentsContract.getTreeDocumentId(treeUri) }.getOrNull() ?: return null
        val queue = ArrayDeque<Pair<Uri, Int>>()
        queue.add(DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, treeDocumentId) to 0)
        var latest: Triple<String, Long, Long>? = null
        var inspected = 0

        while (queue.isNotEmpty() && inspected < MAX_TREE_ENTRIES) {
            val (childrenUri, depth) = queue.removeFirst()
            if (depth > MAX_TREE_DEPTH) continue
            val cursor = runCatching {
                resolver.query(
                    childrenUri,
                    arrayOf(
                        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_MIME_TYPE,
                        DocumentsContract.Document.COLUMN_SIZE,
                        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
                    ),
                    null,
                    null,
                    null,
                )
            }.getOrNull() ?: continue

            cursor.use {
                val idIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                val nameIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                val mimeIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE)
                val sizeIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE)
                val modifiedIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
                while (it.moveToNext() && inspected++ < MAX_TREE_ENTRIES) {
                    val documentId = it.getString(idIndex).orEmpty()
                    val name = it.getString(nameIndex).orEmpty()
                    val mimeType = it.getString(mimeIndex).orEmpty()
                    if (documentId.isBlank()) continue
                    val documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
                    if (mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
                        queue.add(DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId) to (depth + 1))
                        continue
                    }
                    val size = it.getLong(sizeIndex).coerceAtLeast(0L)
                    if (size <= 0L || !isAudio(mimeType, name)) continue
                    val durationMs = duration(context, documentUri)
                    if (durationMs <= 0L) continue
                    // DocumentsProvider normally reports milliseconds, but a
                    // few OEM Files/Recorder providers return epoch seconds.
                    // Normalize before applying the exact call-session window
                    // so a valid new recording is not rejected as 1970-era.
                    val modifiedAt = normalizeModifiedAt(it.getLong(modifiedIndex))
                    val currentLatest = latest
                    if (currentLatest == null || modifiedAt >= currentLatest.second) latest = Triple(name, modifiedAt, durationMs)
                }
            }
        }
        return latest?.let { FolderCheck(it.first, it.third) }
    }

    private fun findInSelectedFolder(
        context: Context,
        callStartedAt: Long,
        callEndedAt: Long,
        expectedDurationMs: Long,
        phoneNumber: String?,
    ): Candidate? {
        val treeUri = RecordingFolderStore.getTreeUri(context) ?: return null
        val resolver = context.contentResolver
        val treeDocumentId = runCatching { DocumentsContract.getTreeDocumentId(treeUri) }.getOrNull() ?: return null
        val queue = ArrayDeque<Pair<Uri, Int>>()
        queue.add(DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, treeDocumentId) to 0)
        val candidates = mutableListOf<Candidate>()
        val phoneDigits = phoneNumber.orEmpty().filter(Char::isDigit).takeLast(10)
        var inspected = 0

        while (queue.isNotEmpty() && inspected < MAX_TREE_ENTRIES) {
            val (childrenUri, depth) = queue.removeFirst()
            if (depth > MAX_TREE_DEPTH) continue
            val cursor = runCatching {
                resolver.query(
                    childrenUri,
                    arrayOf(
                        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_MIME_TYPE,
                        DocumentsContract.Document.COLUMN_SIZE,
                        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
                    ),
                    null,
                    null,
                    null,
                )
            }.getOrNull() ?: continue

            cursor.use {
                val idIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                val nameIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                val mimeIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE)
                val sizeIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE)
                val modifiedIndex = it.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
                while (it.moveToNext() && inspected++ < MAX_TREE_ENTRIES) {
                    val documentId = it.getString(idIndex).orEmpty()
                    val name = it.getString(nameIndex).orEmpty()
                    val mimeType = it.getString(mimeIndex).orEmpty()
                    if (documentId.isBlank()) continue
                    val documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
                    if (mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
                        queue.add(DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId) to (depth + 1))
                        continue
                    }
                    val size = it.getLong(sizeIndex).coerceAtLeast(0L)
                    val modifiedAt = normalizeModifiedAt(it.getLong(modifiedIndex))
                    if (size <= 0L || !isAudio(mimeType, name)) continue
                    val durationMs = duration(context, documentUri)
                    if (durationMs <= 0L) continue
                    val score = score(name, "", phoneDigits, modifiedAt, callEndedAt, durationMs, expectedDurationMs)
                    // A missing provider timestamp is not safe for an exact
                    // call-session match: accepting it could select an older
                    // file from the same folder. Require a real modified time
                    // just like the MediaStore and known-folder paths.
                    val timeMatches = isWithinCallWindow(modifiedAt, callStartedAt, callEndedAt)
                    val durationDistance = abs(durationMs - expectedDurationMs)
                    val allowedDistance = maxOf(20_000L, expectedDurationMs / 2L)
                    if (timeMatches && durationDistance <= allowedDistance) {
                        candidates += Candidate(documentUri, documentUri.toString(), name, mimeType, size, modifiedAt, durationMs, "", score)
                    }
                }
            }
        }
        return candidates.maxByOrNull { it.score }
    }

    /**
     * Xiaomi MIUI call recordings are commonly written to this shared folder,
     * but some Recorder builds do not publish the file through MediaStore.
     * Read the known folder directly when shared-storage permission allows it.
     */
    private fun findInKnownDeviceFolders(
        callStartedAt: Long,
        callEndedAt: Long,
        expectedDurationMs: Long,
        phoneNumber: String?,
    ): Candidate? {
        val roots = listOf(
            // Xiaomi / POCO / Redmi
            File(Environment.getExternalStorageDirectory(), "MIUI/sound_recorder/call_rec"),
            File(Environment.getExternalStorageDirectory(), "MIUI/sound_recorder"),
            // Vivo / iQOO / Funtouch / OriginOS
            File(Environment.getExternalStorageDirectory(), "Record/Call"),
            File(Environment.getExternalStorageDirectory(), "Recordings/Call"),
            File(Environment.getExternalStorageDirectory(), "Record"),
            // Samsung One UI
            File(Environment.getExternalStorageDirectory(), "Recordings/Call"),
            File(Environment.getExternalStorageDirectory(), "Call"),
            // Oppo / Realme / OnePlus / ColorOS / OxygenOS
            File(Environment.getExternalStorageDirectory(), "Recordings/Phone"),
            File(Environment.getExternalStorageDirectory(), "Recordings"),
            // Transsion (Tecno / Infinix / Itel) & Generic
            File(Environment.getExternalStorageDirectory(), "Audio/Call"),
            File(Environment.getExternalStorageDirectory(), "VoiceRecorder/Call"),
            File(Environment.getExternalStorageDirectory(), "Recorder/Call"),
        ).distinctBy { it.absolutePath }
        val phoneDigits = phoneNumber.orEmpty().filter(Char::isDigit).takeLast(10)
        val candidates = mutableListOf<Candidate>()

        roots.forEach { root ->
            if (!root.isDirectory) return@forEach
            val files = runCatching {
                root.walkTopDown()
                    .maxDepth(MAX_KNOWN_FOLDER_DEPTH)
                    .filter { it.isFile && it.length() > 0L && isAudio("", it.name) }
                    .take(MAX_KNOWN_FOLDER_FILES)
                    .toList()
            }.getOrDefault(emptyList())
            files.forEach { file ->
                val modifiedAt = file.lastModified()
                if (!isWithinCallWindow(modifiedAt, callStartedAt, callEndedAt)) return@forEach
                val durationMs = duration(file)
                if (durationMs <= 0L) return@forEach
                val durationDistance = abs(durationMs - expectedDurationMs)
                val allowedDistance = maxOf(20_000L, expectedDurationMs / 2L)
                if (durationDistance > allowedDistance) return@forEach
                candidates += Candidate(
                    sourceUri = Uri.fromFile(file),
                    sourceId = file.absolutePath,
                    name = file.name,
                    mimeType = "audio/*",
                    size = file.length(),
                    modifiedAt = modifiedAt,
                    durationMs = durationMs,
                    pathHint = file.parent.orEmpty(),
                    score = score(file.name, file.parent.orEmpty(), phoneDigits, modifiedAt, callEndedAt, durationMs, expectedDurationMs) + 20L,
                    sourceFile = file,
                )
            }
        }
        return candidates.maxByOrNull { it.score }
    }

    private fun findInMediaStore(
        context: Context,
        callStartedAt: Long,
        callEndedAt: Long,
        expectedDurationMs: Long,
        phoneNumber: String?,
    ): Candidate? {
        if (!canReadSharedAudio(context)) return null
        val phoneDigits = phoneNumber.orEmpty().filter(Char::isDigit).takeLast(10)
        val projection = buildList {
            add(MediaStore.Audio.Media._ID)
            add(MediaStore.Audio.Media.DISPLAY_NAME)
            add(MediaStore.Audio.Media.MIME_TYPE)
            add(MediaStore.Audio.Media.SIZE)
            add(MediaStore.Audio.Media.DATE_ADDED)
            add(MediaStore.Audio.Media.DATE_MODIFIED)
            add(MediaStore.Audio.Media.DURATION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(MediaStore.Audio.Media.RELATIVE_PATH)
        }.toTypedArray()

        val candidates = mutableListOf<Candidate>()
        val cursor = runCatching {
            context.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                "${MediaStore.Audio.Media.DATE_MODIFIED} DESC",
            )
        }.getOrNull() ?: return null

        cursor.use {
            val idIndex = it.getColumnIndex(MediaStore.Audio.Media._ID)
            val nameIndex = it.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
            val mimeIndex = it.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE)
            val sizeIndex = it.getColumnIndex(MediaStore.Audio.Media.SIZE)
            val addedIndex = it.getColumnIndex(MediaStore.Audio.Media.DATE_ADDED)
            val modifiedIndex = it.getColumnIndex(MediaStore.Audio.Media.DATE_MODIFIED)
            val durationIndex = it.getColumnIndex(MediaStore.Audio.Media.DURATION)
            val pathIndex = it.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)
            var inspected = 0
            while (it.moveToNext() && inspected++ < MAX_MEDIASTORE_CANDIDATES) {
                val id = it.getLong(idIndex)
                val name = it.getString(nameIndex).orEmpty()
                val mimeType = it.getString(mimeIndex).orEmpty().ifBlank { "application/octet-stream" }
                val size = it.getLong(sizeIndex)
                val modifiedSeconds = it.getLong(modifiedIndex).takeIf { value -> value > 0L } ?: it.getLong(addedIndex)
                val modifiedAt = modifiedSeconds * 1000L
                val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
                val durationMs = it.getLong(durationIndex).takeIf { d -> d > 0L } ?: duration(context, uri)
                val relativePath = if (pathIndex >= 0) it.getString(pathIndex).orEmpty() else ""
                if (size <= 0L || durationMs <= 0L || !isWithinCallWindow(modifiedAt, callStartedAt, callEndedAt) || !isAudio(mimeType, name)) continue
                val durationDistance = abs(durationMs - expectedDurationMs)
                val allowedDistance = maxOf(20_000L, expectedDurationMs / 2L)
                if (durationDistance > allowedDistance) continue
                candidates += Candidate(
                    uri,
                    id.toString(),
                    name,
                    mimeType,
                    size,
                    modifiedAt,
                    durationMs,
                    relativePath,
                    score(name, relativePath, phoneDigits, modifiedAt, callEndedAt, durationMs, expectedDurationMs),
                )
            }
        }
        return candidates.maxByOrNull { it.score }
    }

    private fun score(
        name: String,
        pathHint: String,
        phoneDigits: String,
        modifiedAt: Long,
        callEndedAt: Long,
        durationMs: Long,
        expectedDurationMs: Long,
    ): Long {
        val haystack = "$name $pathHint".lowercase()
        val nameHint = if (haystack.contains("call") || haystack.contains("record")) 40L else 0L
        val phoneHint = if (phoneDigits.isNotBlank() && haystack.contains(phoneDigits)) 80L else 0L
        val timeDistance = abs(modifiedAt - callEndedAt).coerceAtMost(SEARCH_PADDING_MS)
        val durationDistance = abs(durationMs - expectedDurationMs)
        return nameHint + phoneHint + (SEARCH_PADDING_MS - timeDistance) / 100L - durationDistance / 100L
    }

    /**
     * A previous call's recording can have almost the same duration as a new
     * short call. It must never win merely because it is recent. Allow a small
     * clock/filesystem skew before the call starts, but require the file to be
     * written no earlier than this call's start and no later than the import
     * retry window after it ends.
     */
    private fun isWithinCallWindow(modifiedAt: Long, callStartedAt: Long, callEndedAt: Long): Boolean {
        if (modifiedAt <= 0L || callStartedAt <= 0L || callEndedAt <= 0L) return false
        val lowerBound = callStartedAt - START_TIME_TOLERANCE_MS
        val upperBound = callEndedAt + SEARCH_PADDING_MS
        return modifiedAt in lowerBound..upperBound
    }

    private fun normalizeModifiedAt(value: Long): Long {
        val safe = value.coerceAtLeast(0L)
        return if (safe in 1L until 100_000_000_000L) safe * 1000L else safe
    }

    private fun canReadSharedAudio(context: Context): Boolean = when {
        Build.VERSION.SDK_INT >= 30 && Environment.isExternalStorageManager() -> true
        Build.VERSION.SDK_INT >= 33 -> context.checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED
        Build.VERSION.SDK_INT >= 23 -> context.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        else -> true
    }

    private fun isAudio(mimeType: String, name: String): Boolean {
        if (mimeType.startsWith("audio/")) return true
        val lower = name.lowercase()
        return listOf(".m4a", ".mp4", ".aac", ".mp3", ".wav", ".amr", ".3gp", ".ogg", ".opus", ".webm").any(lower::endsWith)
    }

    private fun extensionFor(name: String, mimeType: String): String {
        val original = name.substringAfterLast('.', "").lowercase()
        if (original in setOf("m4a", "mp4", "aac", "mp3", "wav", "amr", "3gp", "ogg", "opus", "webm")) return ".${original}"
        return when (mimeType) {
            "audio/mpeg" -> ".mp3"
            "audio/wav", "audio/x-wav" -> ".wav"
            "audio/3gpp" -> ".3gp"
            "audio/ogg" -> ".ogg"
            "audio/opus" -> ".opus"
            "audio/webm" -> ".webm"
            else -> ".m4a"
        }
    }

    private fun duration(context: Context, uri: Uri): Long = runCatching {
        MediaMetadataRetriever().let { retriever ->
            try {
                retriever.setDataSource(context, uri)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            } finally {
                retriever.release()
            }
        }
    }.getOrDefault(0L)

    private fun duration(file: File): Long = runCatching {
        MediaMetadataRetriever().let { retriever ->
            try {
                retriever.setDataSource(file.absolutePath)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            } finally {
                retriever.release()
            }
        }
    }.getOrDefault(0L)

    private const val MAX_TREE_ENTRIES = 500
    private const val MAX_TREE_DEPTH = 4
    private const val MAX_KNOWN_FOLDER_DEPTH = 2
    private const val MAX_KNOWN_FOLDER_FILES = 250
    private const val MAX_MEDIASTORE_CANDIDATES = 250
    private const val SEARCH_PADDING_MS = 5 * 60 * 1000L
    private const val START_TIME_TOLERANCE_MS = 15_000L
}
