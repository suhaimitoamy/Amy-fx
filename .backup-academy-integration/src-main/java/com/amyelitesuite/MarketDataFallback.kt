package com.amyelitesuite

import kotlinx.coroutines.delay

class MarketDataFallback(
    private val candleStore: CandleStore
) {
    suspend fun <T> withRateLimitRetry(
        attempts: Int = 3,
        block: suspend () -> T
    ): T? {
        var waitMs = 1_500L
        repeat(attempts) { attempt ->
            val result = runCatching { block() }
            if (result.isSuccess) return result.getOrNull()
            if (attempt < attempts - 1) {
                delay(waitMs)
                waitMs *= 2
            }
        }
        return null
    }

    fun cachedCandles(symbol: String, timeframe: String, limit: Int): List<CandleStore.Candle> {
        return candleStore.getLatest(symbol, timeframe, limit)
    }
}
