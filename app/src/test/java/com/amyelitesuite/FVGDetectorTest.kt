package com.amyelitesuite

import org.junit.Assert.assertEquals
import org.junit.Test

class FVGDetectorTest {
    @Test fun bullishAndBearishFvgHaveStatus() {
        val candles = listOf(
            c(1,10.0,11.0,9.0,10.5),
            c(2,10.5,13.0,10.3,12.8),
            c(3,12.0,14.0,11.5,13.5),
            c(4,13.5,13.8,10.8,11.2)
        )
        val fvg = MappingLogicCore.detectFvg(candles, 0.1)
        assertEquals(MappingLogicCore.FairValueGap.Type.BULLISH, fvg.first().type)
    }

    private fun c(t:Long,o:Double,h:Double,l:Double,cl:Double)=MappingLogicCore.Candle(t,o,h,l,cl)
}
