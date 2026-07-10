package com.amyelitesuite

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.json.JSONArray
import java.io.InputStreamReader

class SupabaseCandleClient(private val context: Context, private val client: OkHttpClient) {

    private val prefs = context.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
    private var overlay: JSONObject? = null

    init {
        try {
            val raw = loadAssetText(context, "config/endpoints.json")
            val root = JSONObject(raw)
            val endpoints = root.optJSONObject("endpoints")
            if (endpoints != null) {
                overlay = endpoints.optJSONObject("supabase")
            }
        } catch (_: Exception) {
            overlay = null
        }
    }

    fun isConfigured(): Boolean {
        return getUrl().isNotBlank() && getAnonKey().isNotBlank()
    }

    fun saveConfig(url: String, anonKey: String) {
        prefs.edit()
            .putString("supabase_url", url.trim().trimEnd('/'))
            .putString("supabase_anon_key", anonKey.trim())
            .apply()
    }

    fun fetchCandles(symbol: String, timeframe: String, limit: Int = 300, afterOpenTime: Long? = null): List<CandleStore.Candle> {
        if (!isConfigured()) return emptyList()

        val baseUrl = getUrl().trimEnd('/')
        val anonKey = getAnonKey()
        val symbolParam = symbol.replace("/", "%2F")
        val timeParam = timeframe
        val gapFilter = afterOpenTime?.let { "&open_time=gt.$it" } ?: ""
        val url = "$baseUrl/rest/v1/candles?symbol=eq.$symbolParam&timeframe=eq.$timeParam$gapFilter&order=open_time.asc&limit=$limit"

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Accept", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return emptyList()
            val body = response.body?.string() ?: return emptyList()
            val arr = JSONArray(body)
            val out = mutableListOf<CandleStore.Candle>()
            for (i in 0 until arr.length()) {
                val item = arr.getJSONObject(i)
                out.add(
                    CandleStore.Candle(
                        symbol = item.optString("symbol", symbol),
                        timeframe = item.optString("timeframe", timeframe),
                        openTime = item.optLong("open_time", 0L),
                        closeTime = item.optLong("close_time", 0L),
                        open = item.optDouble("open", 0.0),
                        high = item.optDouble("high", 0.0),
                        low = item.optDouble("low", 0.0),
                        close = item.optDouble("close", 0.0),
                        volumeTick = item.optLong("volume_tick", 0L),
                        isClosed = item.optBoolean("is_closed", true)
                    )
                )
            }
            return out.filter { it.openTime > 0 && it.high > 0 && it.low > 0 }
        }
    }

    private fun getUrl(): String {
        return prefs.getString("supabase_url", default("url")) ?: default("url")
    }

    private fun getAnonKey(): String {
        return prefs.getString("supabase_anon_key", default("anonKey")) ?: default("anonKey")
    }

    private fun default(key: String): String {
        return when (key) {
            "url" -> "https://wliecyxzlwhmtftnfnps.supabase.co"
            "anonKey" -> "eyJhbG...0p6k"
            else -> ""
        }
    }

    companion object {
        private const val ASSET_ENDPOINTS = "config/endpoints.json"
    }
}

fun loadAssetText(context: Context, path: String): String {
    return context.assets.open(path).use { input ->
        input.bufferedReader(Charsets.UTF_8).readText()
    }
}
