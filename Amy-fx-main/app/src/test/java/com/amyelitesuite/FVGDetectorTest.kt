package com.amyelitesuite

import org.junit.Assert.*
import org.junit.Test

class FVGDetectorTest {

    private fun candle(o: Double, h: Double, l: Double, c: Double) =
        MappingLogicCore.Candle(0L, o, h, l, c)

    @Test fun `no FVG in flat market`() {
        val candles = List(20) { candle(100.0, 100.5, 99.5, 100.0) }
        val fvgs = MappingLogicCore.detectFvg(candles)
        assertTrue("Flat market should have no meaningful FVG", fvgs.isEmpty())
    }

    @Test fun `bearish FVG detected correctly`() {
        val candles = listOf(
            candle(110.0, 111.0, 108.0, 109.0), // prev2: low=108
            candle(109.0, 110.0, 101.0, 102.0), // mid: big bearish body
            candle(103.0,  106.0,  99.0, 100.0), // curr: high=106 < prev2.low=108 → bearish FVG
            candle(100.0, 101.0,  98.0, 99.0),
            candle(99.0,  100.0,  97.0, 98.0)
        )
        val fvgs = MappingLogicCore.detectFvg(candles)
        val bearish = fvgs.filter { it.type == MappingLogicCore.FairValueGap.Type.BEARISH }
        assertTrue("Should detect bearish FVG", bearish.isNotEmpty())
    }

    @Test fun `FVG status is FRESH when not touched`() {
        val candles = listOf(
            candle(100.0, 102.0, 99.0, 101.0),
            candle(101.0, 110.0, 100.0, 109.0), // big body
            candle(108.0, 112.0, 106.0, 111.0), // low=106 > prev2.high=102 → bullish FVG
            candle(111.0, 113.0, 110.0, 112.0), // price moves away, FVG not touched
            candle(112.0, 114.0, 111.0, 113.0)
        )
        val fvgs = MappingLogicCore.detectFvg(candles)
        val fresh = fvgs.filter { it.status == MappingLogicCore.FairValueGap.Status.FRESH }
        assertTrue("Untouched FVG should be FRESH", fresh.isNotEmpty())
    }

    @Test fun `empty candles returns empty FVG list`() {
        assertTrue(MappingLogicCore.detectFvg(emptyList()).isEmpty())
    }

    @Test fun `insufficient candles returns empty`() {
        val candles = listOf(
            candle(100.0, 102.0, 98.0, 101.0),
            candle(101.0, 103.0, 99.0, 102.0)
        )
        assertTrue(MappingLogicCore.detectFvg(candles).isEmpty())
    }
}
