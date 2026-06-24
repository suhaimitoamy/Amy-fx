package com.amyelitesuite

import android.content.Context
import okhttp3.OkHttpClient
import kotlin.math.max
import kotlin.math.min

class MarketDataSyncAgent(
    context: Context,
    client: OkHttpClient
) {
    private val store = CandleStore(context)
    private val supabase = SupabaseCandleClient(context, client)

    fun saveSupabaseConfig(url: String, anonKey: String) {
        supabase.saveConfig(url, anonKey)
    }

    fun bootstrap(symbol: String, timeframe: String, limit: Int = 300): List<CandleStore.Candle> {
        val local = store.getLatest(symbol, timeframe, limit)
        if (local.size >= 60) return local

        val cloud = supabase.fetchCandles(symbol, timeframe, limit)
        if (cloud.isNotEmpty()) {
            store.upsertAll(cloud)
            store.trim(symbol, timeframe, 3000)
            return store.getLatest(symbol, timeframe, limit)
        }

        return local
    }

    fun onTick(symbol: String, timeframe: String, price: Double, epochSeconds: Long): List<CandleStore.Candle> {
        if (price <= 0) return store.getLatest(symbol, timeframe, 300)

        val tfSeconds = tfToSeconds(timeframe)
        val openTime = (epochSeconds / tfSeconds) * tfSeconds
        val closeTime = openTime + tfSeconds
        val latest = store.getLatest(symbol, timeframe, 1).firstOrNull()

        val candle = if (latest != null && latest.openTime == openTime) {
            CandleStore.Candle(
                symbol = symbol,
                timeframe = timeframe,
                openTime = latest.openTime,
                closeTime = latest.closeTime,
                open = latest.open,
                high = max(latest.high, price),
                low = min(latest.low, price),
                close = price,
                volumeTick = latest.volumeTick + 1,
                isClosed = false
            )
        } else {
            latest?.let {
                if (!it.isClosed) store.upsert(it.copy(isClosed = true))
            }
            CandleStore.Candle(
                symbol = symbol,
                timeframe = timeframe,
                openTime = openTime,
                closeTime = closeTime,
                open = price,
                high = price,
                low = price,
                close = price,
                volumeTick = 1,
                isClosed = false
            )
        }

        store.upsert(candle)
        return fillGapIfNeeded(symbol, timeframe, 300)
    }

    fun latest(symbol: String, timeframe: String, limit: Int = 300): List<CandleStore.Candle> {
        return fillGapIfNeeded(symbol, timeframe, limit)
    }

    private fun fillGapIfNeeded(symbol: String, timeframe: String, limit: Int): List<CandleStore.Candle> {
        val local = store.getLatest(symbol, timeframe, limit)
        val lastOpen = local.lastOrNull()?.openTime ?: 0L
        val nowSec = System.currentTimeMillis() / 1000
        val tfSeconds = tfToSeconds(timeframe)

        if (lastOpen > 0 && nowSec - lastOpen <= tfSeconds * 3) return local

        val cloud = supabase.fetchCandles(symbol, timeframe, limit, if (lastOpen > 0) lastOpen else null)
        if (cloud.isNotEmpty()) {
            store.upsertAll(cloud)
            store.trim(symbol, timeframe, 3000)
        }

        return store.getLatest(symbol, timeframe, limit)
    }

    private fun tfToSeconds(timeframe: String): Long {
        return when (timeframe) {
            "M1" -> 60L
            "M5" -> 300L
            "M15" -> 900L
            "M30" -> 1800L
            "H1" -> 3600L
            "H4" -> 14400L
            "D1" -> 86400L
            else -> 300L
        }
    }
}
