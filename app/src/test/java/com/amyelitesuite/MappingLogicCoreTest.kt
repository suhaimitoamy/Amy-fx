package com.amyelitesuite

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MappingLogicCoreTest {
    @Test
    fun setupScoreReturnsTenWhenAllCriteriaPass() {
        val result = MappingLogicCore.score(
            MappingLogicCore.ScoreInput(
                htfBiasAligned = true,
                freshFvgInEntry = true,
                freshObInEntry = true,
                liquidityCleared = true,
                premiumDiscountAligned = true,
                confirmationCandle = true,
                rrAtLeastTwo = true
            )
        )

        assertEquals(10, result.total)
    }

    @Test
    fun detectsBullishFvg() {
        val candles = listOf(
            candle(1, 10.0, 11.0, 9.0, 10.5),
            candle(2, 10.5, 13.0, 10.2, 12.8),
            candle(3, 12.0, 14.0, 11.5, 13.5)
        )

        val gaps = MappingLogicCore.detectFvg(candles, minimumSize = 0.1)

        assertEquals(1, gaps.size)
        assertEquals(MappingLogicCore.FairValueGap.Type.BULLISH, gaps.first().type)
    }

    @Test
    fun detectsSwingsWithLookbackOne() {
        val candles = listOf(
            candle(1, 1.0, 2.0, 0.5, 1.5),
            candle(2, 1.5, 5.0, 1.0, 4.0),
            candle(3, 4.0, 4.2, 0.8, 1.2)
        )

        val swings = MappingLogicCore.detectSwings(candles, lookback = 1)

        assertTrue(swings.any { it.kind == MappingLogicCore.SwingPoint.Kind.HIGH && it.index == 1 })
    }

    private fun candle(time: Long, open: Double, high: Double, low: Double, close: Double): MappingLogicCore.Candle {
        return MappingLogicCore.Candle(time, open, high, low, close)
    }
}
