package com.amyelitesuite

object MappingLogicCore {
    data class Candle(
        val time: Long,
        val open: Double,
        val high: Double,
        val low: Double,
        val close: Double
    )

    data class SwingPoint(
        val index: Int,
        val time: Long,
        val price: Double,
        val kind: Kind,
        val strength: Strength
    ) {
        enum class Kind { HIGH, LOW }
        enum class Strength { MINOR, MAJOR }
    }

    data class StructureEvent(
        val index: Int,
        val time: Long,
        val price: Double,
        val type: Type,
        val direction: Direction
    ) {
        enum class Type { BOS, CHOCH, MSS }
        enum class Direction { BULLISH, BEARISH }
    }

    data class FairValueGap(
        val index: Int,
        val type: Type,
        val bottom: Double,
        val top: Double,
        val status: Status
    ) {
        enum class Type { BULLISH, BEARISH }
        enum class Status { FRESH, PARTIALLY_FILLED, MITIGATED }
    }

    data class OrderBlock(
        val index: Int,
        val type: Type,
        val bottom: Double,
        val top: Double,
        val status: Status
    ) {
        enum class Type { BULLISH, BEARISH }
        enum class Status { FRESH, TESTED, BROKEN }
    }

    data class ScoreInput(
        val htfBiasAligned: Boolean,
        val freshFvgInEntry: Boolean,
        val freshObInEntry: Boolean,
        val liquidityCleared: Boolean,
        val premiumDiscountAligned: Boolean,
        val confirmationCandle: Boolean,
        val rrAtLeastTwo: Boolean
    )

    data class ScoreResult(
        val total: Int,
        val breakdown: Map<String, Int>
    )

    fun detectSwings(candles: List<Candle>, lookback: Int = 5): List<SwingPoint> {
        if (candles.size < lookback * 2 + 1) return emptyList()
        val result = mutableListOf<SwingPoint>()
        for (i in lookback until candles.size - lookback) {
            val current = candles[i]
            var isHigh = true
            var isLow = true
            for (j in 1..lookback) {
                if (current.high <= candles[i - j].high || current.high <= candles[i + j].high) isHigh = false
                if (current.low >= candles[i - j].low || current.low >= candles[i + j].low) isLow = false
            }
            if (isHigh) result.add(SwingPoint(i, current.time, current.high, SwingPoint.Kind.HIGH, classifyStrength(candles, i)))
            if (isLow) result.add(SwingPoint(i, current.time, current.low, SwingPoint.Kind.LOW, classifyStrength(candles, i)))
        }
        return result
    }

    fun detectStructure(candles: List<Candle>, swings: List<SwingPoint>, displacementMultiplier: Double = 1.2): List<StructureEvent> {
        if (candles.size < 3 || swings.isEmpty()) return emptyList()
        val events = mutableListOf<StructureEvent>()
        var lastDirection: StructureEvent.Direction? = null
        val atr = averageRange(candles).coerceAtLeast(0.01)

        candles.forEachIndexed { index, candle ->
            val previousHigh = swings.lastOrNull { it.index < index && it.kind == SwingPoint.Kind.HIGH }
            val previousLow = swings.lastOrNull { it.index < index && it.kind == SwingPoint.Kind.LOW }
            val body = kotlin.math.abs(candle.close - candle.open)
            val hasDisplacement = body >= atr * displacementMultiplier

            if (previousHigh != null && candle.close > previousHigh.price && hasDisplacement) {
                val type = if (lastDirection == StructureEvent.Direction.BEARISH) StructureEvent.Type.CHOCH else StructureEvent.Type.BOS
                events.add(StructureEvent(index, candle.time, previousHigh.price, type, StructureEvent.Direction.BULLISH))
                lastDirection = StructureEvent.Direction.BULLISH
            }
            if (previousLow != null && candle.close < previousLow.price && hasDisplacement) {
                val type = if (lastDirection == StructureEvent.Direction.BULLISH) StructureEvent.Type.CHOCH else StructureEvent.Type.BOS
                events.add(StructureEvent(index, candle.time, previousLow.price, type, StructureEvent.Direction.BEARISH))
                lastDirection = StructureEvent.Direction.BEARISH
            }
        }
        return events
    }

    fun detectFvg(candles: List<Candle>, minimumSize: Double = 0.0): List<FairValueGap> {
        if (candles.size < 3) return emptyList()
        val result = mutableListOf<FairValueGap>()
        for (i in 2 until candles.size) {
            val first = candles[i - 2]
            val third = candles[i]
            if (first.high < third.low) {
                val bottom = first.high
                val top = third.low
                if (top - bottom >= minimumSize) {
                    result.add(FairValueGap(i, FairValueGap.Type.BULLISH, bottom, top, fvgStatus(candles.drop(i + 1), bottom, top)))
                }
            }
            if (first.low > third.high) {
                val bottom = third.high
                val top = first.low
                if (top - bottom >= minimumSize) {
                    result.add(FairValueGap(i, FairValueGap.Type.BEARISH, bottom, top, fvgStatus(candles.drop(i + 1), bottom, top)))
                }
            }
        }
        return result
    }

    fun detectOrderBlocks(candles: List<Candle>, structures: List<StructureEvent>): List<OrderBlock> {
        val result = mutableListOf<OrderBlock>()
        structures.forEach { event ->
            val searchStart = (event.index - 12).coerceAtLeast(0)
            val leg = candles.subList(searchStart, event.index)
            if (event.direction == StructureEvent.Direction.BULLISH) {
                val offset = leg.indexOfLast { it.close < it.open }
                if (offset >= 0) {
                    val index = searchStart + offset
                    val candle = candles[index]
                    result.add(OrderBlock(index, OrderBlock.Type.BULLISH, candle.low, candle.high, obStatus(candles.drop(event.index + 1), candle.low, candle.high, OrderBlock.Type.BULLISH)))
                }
            } else {
                val offset = leg.indexOfLast { it.close > it.open }
                if (offset >= 0) {
                    val index = searchStart + offset
                    val candle = candles[index]
                    result.add(OrderBlock(index, OrderBlock.Type.BEARISH, candle.low, candle.high, obStatus(candles.drop(event.index + 1), candle.low, candle.high, OrderBlock.Type.BEARISH)))
                }
            }
        }
        return result
    }

    fun score(input: ScoreInput): ScoreResult {
        val breakdown = linkedMapOf(
            "HTF Bias aligned" to if (input.htfBiasAligned) 2 else 0,
            "Fresh FVG in entry" to if (input.freshFvgInEntry) 2 else 0,
            "Fresh OB in entry" to if (input.freshObInEntry) 2 else 0,
            "Liquidity cleared" to if (input.liquidityCleared) 1 else 0,
            "Premium/Discount aligned" to if (input.premiumDiscountAligned) 1 else 0,
            "Confirmation candle" to if (input.confirmationCandle) 1 else 0,
            "RR minimum 1:2" to if (input.rrAtLeastTwo) 1 else 0
        )
        return ScoreResult(breakdown.values.sum(), breakdown)
    }

    private fun classifyStrength(candles: List<Candle>, index: Int): SwingPoint.Strength {
        val range = candles[index].high - candles[index].low
        return if (range >= averageRange(candles) * 1.5) SwingPoint.Strength.MAJOR else SwingPoint.Strength.MINOR
    }

    private fun averageRange(candles: List<Candle>): Double {
        return candles.takeLast(14).map { it.high - it.low }.filter { it > 0.0 }.average().let { if (it.isNaN()) 0.0 else it }
    }

    private fun fvgStatus(future: List<Candle>, bottom: Double, top: Double): FairValueGap.Status {
        if (future.any { it.low <= bottom && it.high >= top }) return FairValueGap.Status.MITIGATED
        if (future.any { it.low <= top && it.high >= bottom }) return FairValueGap.Status.PARTIALLY_FILLED
        return FairValueGap.Status.FRESH
    }

    private fun obStatus(future: List<Candle>, bottom: Double, top: Double, type: OrderBlock.Type): OrderBlock.Status {
        val touched = future.any { it.low <= top && it.high >= bottom }
        val broken = when (type) {
            OrderBlock.Type.BULLISH -> future.any { it.close < bottom }
            OrderBlock.Type.BEARISH -> future.any { it.close > top }
        }
        return when {
            broken -> OrderBlock.Status.BROKEN
            touched -> OrderBlock.Status.TESTED
            else -> OrderBlock.Status.FRESH
        }
    }
}
