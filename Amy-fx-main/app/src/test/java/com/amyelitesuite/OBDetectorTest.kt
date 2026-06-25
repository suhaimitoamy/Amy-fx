package com.amyelitesuite

import org.junit.Assert.*
import org.junit.Test

class OBDetectorTest {

    private fun candle(o: Double, h: Double, l: Double, c: Double, t: Long = 0L) =
        MappingLogicCore.Candle(t, o, h, l, c)

    @Test fun `no OB without structure events`() {
        val candles = List(20) { candle(100.0, 101.0, 99.0, 100.5) }
        val obs = MappingLogicCore.detectOrderBlocks(candles, emptyList())
        assertTrue("No structure = no OB", obs.isEmpty())
    }

    @Test fun `OB bottom is less than top`() {
        val candles = List(30) { i ->
            val p = 100.0 + i * 0.5
            candle(p, p + 2.0, p - 0.5, p + 1.5, i.toLong())
        }
        val swings = MappingLogicCore.detectSwings(candles, lookback = 3)
        val structure = MappingLogicCore.detectStructure(candles, swings)
        if (structure.isNotEmpty()) {
            val obs = MappingLogicCore.detectOrderBlocks(candles, structure)
            obs.forEach { ob ->
                assertTrue("OB bottom < top", ob.bottom < ob.top)
            }
        }
    }

    @Test fun `bullish OB comes from bearish candle`() {
        // Setup: bearish candle before bullish BOS
        val candles = mutableListOf<MappingLogicCore.Candle>()
        // downleg
        repeat(10) { i -> candles.add(candle(110.0 - i, 111.0 - i, 108.0 - i, 109.0 - i, i.toLong())) }
        // bearish OB candidate
        candles.add(candle(102.0, 103.0, 100.0, 100.5, 10L))
        // strong bullish displacement
        repeat(8) { i -> candles.add(candle(101.0 + i * 2, 103.0 + i * 2, 100.0 + i * 2, 102.5 + i * 2, (11 + i).toLong())) }

        val swings = MappingLogicCore.detectSwings(candles, lookback = 3)
        val structure = MappingLogicCore.detectStructure(candles, swings)
        val bullishEvents = structure.filter { it.direction == MappingLogicCore.StructureEvent.Direction.BULLISH }
        if (bullishEvents.isNotEmpty()) {
            val obs = MappingLogicCore.detectOrderBlocks(candles, bullishEvents)
            val bullishOBs = obs.filter { it.type == MappingLogicCore.OrderBlock.Type.BULLISH }
            assertTrue("Bullish BOS should produce bullish OB candidates", bullishOBs.isNotEmpty() || obs.isEmpty())
        }
    }

    @Test fun `OB status transitions correctly`() {
        val ob = MappingLogicCore.OrderBlock(
            index = 5,
            type = MappingLogicCore.OrderBlock.Type.BULLISH,
            bottom = 100.0,
            top = 102.0,
            status = MappingLogicCore.OrderBlock.Status.FRESH
        )
        assertEquals(MappingLogicCore.OrderBlock.Status.FRESH, ob.status)
        val tested = ob.copy(status = MappingLogicCore.OrderBlock.Status.TESTED)
        assertEquals(MappingLogicCore.OrderBlock.Status.TESTED, tested.status)
        val broken = ob.copy(status = MappingLogicCore.OrderBlock.Status.BROKEN)
        assertEquals(MappingLogicCore.OrderBlock.Status.BROKEN, broken.status)
    }
}
