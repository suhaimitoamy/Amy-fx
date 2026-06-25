package com.amyelitesuite

import org.junit.Assert.assertEquals
import org.junit.Test

class SetupScoreTest {
    @Test fun partialScoreIsTransparent() {
        val score = MappingLogicCore.score(
            MappingLogicCore.ScoreInput(
                htfBiasAligned = true,
                freshFvgInEntry = false,
                freshObInEntry = true,
                liquidityCleared = true,
                premiumDiscountAligned = false,
                confirmationCandle = true,
                rrAtLeastTwo = true
            )
        )
        assertEquals(7, score.total)
        assertEquals(2, score.breakdown["HTF Bias aligned"])
        assertEquals(0, score.breakdown["Fresh FVG in entry"])
    }
}
