package com.amyelitesuite

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

class UpdateChecker(private val context: Context) {
    private val client = OkHttpClient()

    suspend fun check(url: String, currentVersionCode: Int): UpdateInfo? = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val lastCheck = prefs.getLong("update_last_check_at", 0L)
        if (now - lastCheck < ONE_DAY_MS) return@withContext null

        prefs.edit().putLong("update_last_check_at", now).apply()

        runCatching {
            val request = Request.Builder().url(url).build()
            val body = client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                response.body?.string().orEmpty()
            }
            val json = JSONObject(body)
            val remoteCode = json.optInt("versionCode", 0)
            if (remoteCode <= currentVersionCode) return@withContext null
            UpdateInfo(
                version = json.optString("version"),
                versionCode = remoteCode,
                downloadUrl = json.optString("downloadUrl"),
                mandatory = json.optBoolean("mandatory", false),
                changelog = json.optJSONArray("changelog")?.let { arr ->
                    List(arr.length()) { index -> arr.optString(index) }
                }.orEmpty()
            )
        }.getOrNull()
    }

    data class UpdateInfo(
        val version: String,
        val versionCode: Int,
        val downloadUrl: String,
        val mandatory: Boolean,
        val changelog: List<String>
    )

    companion object {
        private const val ONE_DAY_MS = 24L * 60L * 60L * 1000L
    }
}
