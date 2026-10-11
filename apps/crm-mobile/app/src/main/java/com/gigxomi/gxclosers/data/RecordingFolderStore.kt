package com.gigxomi.gxclosers.data

import android.content.Context
import android.net.Uri

/** Persists the user-approved system dialer recording folder. */
object RecordingFolderStore {
    private const val PREFS = "gxclosers_preferences"
    private const val TREE_URI_KEY = "recordingTreeUri"

    fun getTreeUri(context: Context): Uri? = context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getString(TREE_URI_KEY, null)
        ?.let { runCatching { Uri.parse(it) }.getOrNull() }

    fun saveTreeUri(context: Context, uri: Uri) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(TREE_URI_KEY, uri.toString())
            .apply()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(TREE_URI_KEY)
            .apply()
    }
}
