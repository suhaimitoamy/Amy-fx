package com.amyelitesuite

import org.junit.Assert.assertTrue
import org.junit.Test

class StructureAnalyzerTest {
    @Test fun structureBreakRequiresCloseAndDisplacement() {
        val candles = listOf(
            c(1,10.0,11.0,9.8,10.4),
            c(2,10.4,10.8,9.7,10.0),
            c(3,10.0,12.4,9.9,12.2)
        )
        val swings = listOf(MappingLogicCore.SwingPoint(0,1,11.0,MappingLogicCore.SwingPoint.Kind.HIGH,MappingLogicCore.SwingPoint.Strength.MINOR))
        val events = MappingLogicCore.detectStructure(candles, swings, displacementMultiplier = 0.5)
        assertTrue(events.any { it.direction == MappingLogicCore.StructureEvent.Direction.BULLISH })
    }

    private fun c(t:Long,o:Double,h:Double,l:Double,cl:Double)=MappingLogicCore.Candle(t,o,h,l,cl)
}
