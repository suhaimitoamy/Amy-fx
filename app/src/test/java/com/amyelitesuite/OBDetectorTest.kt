package com.amyelitesuite

import org.junit.Assert.assertTrue
import org.junit.Test

class OBDetectorTest {
    @Test fun detectsBullishOrderBlockBeforeBullishBreak() {
        val candles = listOf(
            c(1,10.0,10.4,9.7,10.2),
            c(2,10.2,10.3,9.8,9.9),
            c(3,9.9,11.8,9.9,11.6)
        )
        val event = MappingLogicCore.StructureEvent(2,3,10.4,MappingLogicCore.StructureEvent.Type.BOS,MappingLogicCore.StructureEvent.Direction.BULLISH)
        val ob = MappingLogicCore.detectOrderBlocks(candles, listOf(event))
        assertTrue(ob.any { it.type == MappingLogicCore.OrderBlock.Type.BULLISH })
    }

    private fun c(t:Long,o:Double,h:Double,l:Double,cl:Double)=MappingLogicCore.Candle(t,o,h,l,cl)
}
