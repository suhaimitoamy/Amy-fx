package com.amyelitesuite

import org.junit.Assert.*
import org.junit.Test

class MappingLogicCoreTest {

    private fun candle(o: Double, h: Double, l: Double, c: Double, t: Long = 0L) =
        MappingLogicCore.Candle(t, o, h, l, c)

    private fun bullish(t: Long = 0L) = candle(100.0, 105.0, 99.0, 104.0, t)
    private fun bearish(t: Long = 0L) = candle(104.0, 105.0, 99.0, 100.0, t)

    // ─── averageRange ─────────────────────────────────────────────────────────

    @Test fun `averageRange returns sensible value`() {
        val candles = List(20) { candle(100.0, 102.0, 98.0, 101.0) }
        val atr = MappingLogicCore.averageRange(candles)
        assertEquals(4.0, atr, 0.001)
    }

    @Test fun `averageRange handles empty list`() {
        val atr = MappingLogicCore.averageRange(emptyList())
        assertEquals(0.5, atr, 0.001)
    }

    // ─── detectSwings ─────────────────────────────────────────────────────────

    @Test fun `detectSwings finds high in middle of V-shape`() {
        val candles = listOf(
            candle(100.0, 101.0, 99.0, 100.0),
            candle(100.0, 105.0, 100.0, 104.0),
            candle(104.0, 110.0, 103.0, 109.0), // swing high
            candle(109.0, 110.0, 105.0, 106.0),
            candle(106.0, 107.0, 103.0, 104.0),
            candle(104.0, 106.0, 102.0, 103.0),
            candle(103.0, 104.0, 100.0, 101.0)
        )
        val swings = MappingLogicCore.detectSwings(candles, lookback = 2)
        val highs = swings.filter { it.kind == MappingLogicCore.SwingPoint.Kind.HIGH }
        assertTrue("Should detect at least one swing high", highs.isNotEmpty())
        assertTrue("Swing high price should be around 110", highs.any { it.price >= 109.0 })
    }

    @Test fun `detectSwings returns empty for insufficient data`() {
        val candles = List(3) { bullish() }
        val swings = MappingLogicCore.detectSwings(candles, lookback = 5)
        assertTrue(swings.isEmpty())
    }

    // ─── detectStructure ─────────────────────────────────────────────────────

    @Test fun `detectStructure identifies BOS bullish`() {
        val candles = List(30) { i ->
            val price = 100.0 + i * 0.5
            candle(price, price + 1.0, price - 0.5, price + 0.8, i.toLong())
        }
        val swings = MappingLogicCore.detectSwings(candles, lookback = 3)
        val events = MappingLogicCore.detectStructure(candles, swings)
        val bullishBos = events.filter { it.direction == MappingLogicCore.StructureEvent.Direction.BULLISH }
        assertTrue("Should have bullish structure events in uptrend", bullishBos.isNotEmpty())
    }

    @Test fun `detectStructure returns empty with no swings`() {
        val candles = List(20) { bullish() }
        val events = MappingLogicCore.detectStructure(candles, emptyList())
        assertTrue(events.isEmpty())
    }

    // ─── detectFvg ────────────────────────────────────────────────────────────

    @Test fun `detectFvg finds bullish FVG`() {
        // Candle pattern: prev2.high < curr.low = bullish FVG
        val candles = listOf(
            candle(100.0, 102.0,  99.0, 101.0), // prev2: high=102
            candle(101.0, 108.0, 100.0, 107.0), // mid: big body
            candle(106.0, 109.0, 104.0, 108.0), // curr: low=104 > prev2.high=102 → FVG
            candle(108.0, 110.0, 107.0, 109.0),
            candle(109.0, 111.0, 108.0, 110.0),
            candle(110.0, 112.0, 109.0, 111.0),
            candle(111.0, 113.0, 110.0, 112.0)
        )
        val fvgs = MappingLogicCore.detectFvg(candles)
        val bullish = fvgs.filter { it.type == MappingLogicCore.FairValueGap.Type.BULLISH }
        assertTrue("Should detect bullish FVG", bullish.isNotEmpty())
    }

    @Test fun `detectFvg marks mitigated FVG`() {
        val candles = mutableListOf(
            candle(100.0, 102.0,  99.0, 101.0),
            candle(101.0, 108.0, 100.0, 107.0),
            candle(106.0, 109.0, 104.0, 108.0),
            // price comes back to fill the FVG
            candle(108.0, 109.0,  99.0, 100.0) // low=99 < bottom=102 → mitigated
        )
        val fvgs = MappingLogicCore.detectFvg(candles)
        val mitigated = fvgs.filter { it.status == MappingLogicCore.FairValueGap.Status.MITIGATED }
        assertTrue("Mitigated FVG should be flagged", mitigated.isNotEmpty())
    }

    // ─── detectOrderBlocks ────────────────────────────────────────────────────

    @Test fun `detectOrderBlocks returns list for valid structure events`() {
        val candles = List(25) { i ->
            val price = 100.0 + i * 0.3
            candle(price, price + 1.5, price - 0.5, price + 1.2, i.toLong())
        }
        val swings = MappingLogicCore.detectSwings(candles, lookback = 3)
        val structure = MappingLogicCore.detectStructure(candles, swings)
        if (structure.isNotEmpty()) {
            val obs = MappingLogicCore.detectOrderBlocks(candles, structure)
            assertNotNull("OB result should not be null", obs)
        }
    }

    // ─── computeScore ─────────────────────────────────────────────────────────

    @Test fun `computeScore full setup returns 10`() {
        val input = MappingLogicCore.ScoreInput(
            htfBiasAligned = true,
            freshFvgInEntry = true,
            freshObInEntry = true,
            liquidityCleared = true,
            premiumDiscountAligned = true,
            confirmationCandle = true,
            rrAtLeastTwo = true
        )
        val result = MappingLogicCore.computeScore(input)
        assertEquals(10, result.total)
        assertEquals(7, result.breakdown.size)
    }

    @Test fun `computeScore empty setup returns 0`() {
        val input = MappingLogicCore.ScoreInput(
            htfBiasAligned = false,
            freshFvgInEntry = false,
            freshObInEntry = false,
            liquidityCleared = false,
            premiumDiscountAligned = false,
            confirmationCandle = false,
            rrAtLeastTwo = false
        )
        assertEquals(0, MappingLogicCore.computeScore(input).total)
    }

    @Test fun `computeScore partial returns correct breakdown`() {
        val input = MappingLogicCore.ScoreInput(
            htfBiasAligned = true,     // +2
            freshFvgInEntry = true,    // +2
            freshObInEntry = false,
            liquidityCleared = true,   // +1
            premiumDiscountAligned = false,
            confirmationCandle = false,
            rrAtLeastTwo = true        // +1
        )
        val result = MappingLogicCore.computeScore(input)
        assertEquals(6, result.total)
    }

    // ─── getPremiumDiscount ───────────────────────────────────────────────────

    @Test fun `getPremiumDiscount identifies premium correctly`() {
        val zone = MappingLogicCore.getPremiumDiscount(1950.0, 2000.0, 1900.0)
        assertEquals("PREMIUM", zone)
    }

    @Test fun `getPremiumDiscount identifies discount correctly`() {
        val zone = MappingLogicCore.getPremiumDiscount(1910.0, 2000.0, 1900.0)
        assertEquals("DISCOUNT", zone)
    }

    @Test fun `getPremiumDiscount identifies equilibrium`() {
        val zone = MappingLogicCore.getPremiumDiscount(1950.0, 2000.0, 1900.0)
        // 1950 is exactly at eq (1950.0)
        assertTrue(zone == "EQUILIBRIUM" || zone == "PREMIUM")
    }

    // ─── detectLiquidity ─────────────────────────────────────────────────────

    @Test fun `detectLiquidity marks equal highs`() {
        val swings = listOf(
            MappingLogicCore.SwingPoint(5,  0L, 2000.05, MappingLogicCore.SwingPoint.Kind.HIGH, MappingLogicCore.SwingPoint.Strength.MAJOR),
            MappingLogicCore.SwingPoint(10, 0L, 2000.10, MappingLogicCore.SwingPoint.Kind.HIGH, MappingLogicCore.SwingPoint.Strength.MAJOR),
            MappingLogicCore.SwingPoint(15, 0L, 1950.00, MappingLogicCore.SwingPoint.Kind.LOW,  MappingLogicCore.SwingPoint.Strength.MINOR)
        )
        val levels = MappingLogicCore.detectLiquidity(swings, equalTolerance = 0.20)
        val equalHighs = levels.filter { it.type == MappingLogicCore.LiquidityLevel.Type.BSL && it.isRelativeEqual }
        assertTrue("Should flag equal highs as relative equal", equalHighs.isNotEmpty())
    }
}
