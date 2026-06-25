package com.amyelitesuite

import org.junit.Assert.*
import org.junit.Test

class SetupScoreTest {

    @Test fun `max score is 10`() {
        val input = MappingLogicCore.ScoreInput(true, true, true, true, true, true, true)
        assertEquals(10, MappingLogicCore.computeScore(input).total)
    }

    @Test fun `min score is 0`() {
        val input = MappingLogicCore.ScoreInput(false, false, false, false, false, false, false)
        assertEquals(0, MappingLogicCore.computeScore(input).total)
    }

    @Test fun `htf bias worth 2 points`() {
        val withBias    = MappingLogicCore.computeScore(MappingLogicCore.ScoreInput(true, false, false, false, false, false, false))
        val withoutBias = MappingLogicCore.computeScore(MappingLogicCore.ScoreInput(false, false, false, false, false, false, false))
        assertEquals(2, withBias.total - withoutBias.total)
    }

    @Test fun `fvg and ob each worth 2 points`() {
        val fvgOnly = MappingLogicCore.computeScore(MappingLogicCore.ScoreInput(false, true, false, false, false, false, false))
        val obOnly  = MappingLogicCore.computeScore(MappingLogicCore.ScoreInput(false, false, true, false, false, false, false))
        assertEquals(2, fvgOnly.total)
        assertEquals(2, obOnly.total)
    }

    @Test fun `breakdown keys all present`() {
        val result = MappingLogicCore.computeScore(
            MappingLogicCore.ScoreInput(true, true, true, true, true, true, true)
        )
        val keys = result.breakdown.keys
        assertTrue(keys.any { it.contains("HTF") })
        assertTrue(keys.any { it.contains("FVG") })
        assertTrue(keys.any { it.contains("OB") })
        assertTrue(keys.any { it.contains("Liquidity") })
        assertTrue(keys.any { it.contains("RR") })
    }

    @Test fun `score with only singles totals correctly`() {
        val input = MappingLogicCore.ScoreInput(
            htfBiasAligned = false,
            freshFvgInEntry = false,
            freshObInEntry = false,
            liquidityCleared = true,   // +1
            premiumDiscountAligned = true, // +1
            confirmationCandle = true, // +1
            rrAtLeastTwo = true        // +1
        )
        assertEquals(4, MappingLogicCore.computeScore(input).total)
    }
}
