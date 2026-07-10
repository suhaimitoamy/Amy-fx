package com.amyelitesuite

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray

class SupabaseCandleClient(private val context: Context, private val client: OkHttpClient) {

    private val prefs = context.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
    private val defaultUrl = "https://wliecyxzlwhmtftnfnps.supabase.co"
    private val defaultAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaWVjeXh6bHdobXRmdG5mbnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDIyNjgsImV4cCI6MjA5NzgxODI2OH0.PSlhYSFR7_ZiVYLqDDgn6LnYoC_D7GdZybdyZ2i0p6k"

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

    private fun getUrl(): String = prefs.getString("supabase_url", defaultUrl) ?: defaultUrl
    private fun getAnonKey(): String = prefs.getString("supabase_anon_key", defaultAnonKey) ?: defaultAnonKey
}
