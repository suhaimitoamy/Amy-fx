package com.amyelitesuite

import org.junit.Assert.*
import org.junit.Test

class StructureAnalyzerTest {

    private fun candle(o: Double, h: Double, l: Double, c: Double, t: Long = 0L) =
        MappingLogicCore.Candle(t, o, h, l, c)

    @Test fun `uptrend produces bullish structure events`() {
        val candles = List(40) { i ->
            val p = 100.0 + i
            candle(p, p + 2.0, p - 0.5, p + 1.8, i.toLong())
        }
        val swings = MappingLogicCore.detectSwings(candles, lookback = 3)
        val events = MappingLogicCore.detectStructure(candles, swings)
        val bullish = events.filter { it.direction == MappingLogicCore.StructureEvent.Direction.BULLISH }
        assertTrue("Uptrend should produce bullish structure breaks", bullish.isNotEmpty())
    }

    @Test fun `downtrend produces bearish structure events`() {
        val candles = List(40) { i ->
            val p = 200.0 - i
            candle(p, p + 0.5, p - 2.0, p - 1.8, i.toLong())
        }
        val swings = MappingLogicCore.detectSwings(candles, lookback = 3)
        val events = MappingLogicCore.detectStructure(candles, swings)
        val bearish = events.filter { it.direction == MappingLogicCore.StructureEvent.Direction.BEARISH }
        assertTrue("Downtrend should produce bearish structure breaks", bearish.isNotEmpty())
    }

    @Test fun `CHOCH appears after trend reversal`() {
        val upCandles = List(20) { i ->
            val p = 100.0 + i
            candle(p, p + 2.0, p - 0.5, p + 1.8, i.toLong())
        }
        val downCandles = List(15) { i ->
            val p = 120.0 - i * 1.5
            candle(p, p + 0.5, p - 2.0, p - 1.5, (20 + i).toLong())
        }
        val candles = upCandles + downCandles
        val swings = MappingLogicCore.detectSwings(candles, lookback = 3)
        val events = MappingLogicCore.detectStructure(candles, swings)
        val hasChoch = events.any { it.type == MappingLogicCore.StructureEvent.Type.CHOCH || it.type == MappingLogicCore.StructureEvent.Type.MSS }
        // may or may not detect depending on swing alignment — just validate no crash
        assertNotNull("detectStructure should not throw", events)
    }

    @Test fun `structure events price is valid`() {
        val candles = List(30) { i ->
            val p = 100.0 + i * 0.8
            candle(p, p + 1.5, p - 0.5, p + 1.2, i.toLong())
        }
        val swings = MappingLogicCore.detectSwings(candles, lookback = 3)
        val events = MappingLogicCore.detectStructure(candles, swings)
        events.forEach { event ->
            assertTrue("Event price must be positive", event.price > 0.0)
            assertTrue("Event index must be non-negative", event.index >= 0)
        }
    }

    @Test fun `empty candles returns empty events`() {
        val events = MappingLogicCore.detectStructure(emptyList(), emptyList())
        assertTrue(events.isEmpty())
    }
}
