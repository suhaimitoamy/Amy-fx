package com.amyelitesuite

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

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
        var status: Status
    ) {
        enum class Type { BULLISH, BEARISH }
        enum class Status { FRESH, PARTIALLY_FILLED, MITIGATED }
    }

    data class OrderBlock(
        val index: Int,
        val type: Type,
        val bottom: Double,
        val top: Double,
        var status: Status
    ) {
        enum class Type { BULLISH, BEARISH }
        enum class Status { FRESH, TESTED, BROKEN }
    }

    data class LiquidityLevel(
        val price: Double,
        val type: Type,
        val isRelativeEqual: Boolean
    ) {
        enum class Type { BSL, SSL }
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

    // ─── Utility ─────────────────────────────────────────────────────────────

    fun averageRange(candles: List<Candle>, period: Int = 14): Double {
        val slice = candles.takeLast(period)
        if (slice.isEmpty()) return 0.5
        return slice.map { it.high - it.low }.filter { it > 0.0 }.average()
            .takeIf { it.isFinite() } ?: 0.5
    }

    private fun classifyStrength(candles: List<Candle>, index: Int): SwingPoint.Strength {
        val atr = averageRange(candles)
        val range = candles[index].high - candles[index].low
        return if (range >= atr * 1.5) SwingPoint.Strength.MAJOR else SwingPoint.Strength.MINOR
    }

    // ─── Swing Detection ─────────────────────────────────────────────────────

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
            if (isLow)  result.add(SwingPoint(i, current.time, current.low,  SwingPoint.Kind.LOW,  classifyStrength(candles, i)))
        }
        return result
    }

    // ─── Structure Detection ─────────────────────────────────────────────────

    /**
     * BOS = break of last swing HIGH (bullish) or LOW (bearish) confirmed by close.
     * CHOCH = first BOS against the prevailing trend = potential reversal.
     * MSS = CHOCH + displacement candle (body >= atr * displacementMultiplier).
     */
    fun detectStructure(
        candles: List<Candle>,
        swings: List<SwingPoint>,
        displacementMultiplier: Double = 1.2
    ): List<StructureEvent> {
        if (candles.size < 3 || swings.isEmpty()) return emptyList()
        val events = mutableListOf<StructureEvent>()
        var lastDirection: StructureEvent.Direction? = null
        val atr = averageRange(candles).coerceAtLeast(0.01)

        candles.forEachIndexed { index, candle ->
            val prevHigh = swings.lastOrNull { it.index < index && it.kind == SwingPoint.Kind.HIGH }
            val prevLow  = swings.lastOrNull { it.index < index && it.kind == SwingPoint.Kind.LOW }
            val body = abs(candle.close - candle.open)
            val hasDisplacement = body >= atr * displacementMultiplier

            if (prevHigh != null && candle.close > prevHigh.price) {
                val isChoch = lastDirection == StructureEvent.Direction.BEARISH
                val type = when {
                    isChoch && hasDisplacement -> StructureEvent.Type.MSS
                    isChoch -> StructureEvent.Type.CHOCH
                    else -> StructureEvent.Type.BOS
                }
                events.add(StructureEvent(index, candle.time, prevHigh.price, type, StructureEvent.Direction.BULLISH))
                lastDirection = StructureEvent.Direction.BULLISH
            }

            if (prevLow != null && candle.close < prevLow.price) {
                val isChoch = lastDirection == StructureEvent.Direction.BULLISH
                val type = when {
                    isChoch && hasDisplacement -> StructureEvent.Type.MSS
                    isChoch -> StructureEvent.Type.CHOCH
                    else -> StructureEvent.Type.BOS
                }
                events.add(StructureEvent(index, candle.time, prevLow.price, type, StructureEvent.Direction.BEARISH))
                lastDirection = StructureEvent.Direction.BEARISH
            }
        }
        return events
    }

    // ─── Fair Value Gap ───────────────────────────────────────────────────────

    /**
     * FVG: gap between candle[i-2].high and candle[i].low (bullish),
     * or candle[i-2].low and candle[i].high (bearish).
     * Requires body of middle candle >= atr * 0.5 (displacement confirmation).
     * Status updated lazily by updateFvgStatuses().
     */
    fun detectFvg(candles: List<Candle>, minBodyMultiplier: Double = 0.5): List<FairValueGap> {
        val atr = averageRange(candles)
        val result = mutableListOf<FairValueGap>()
        for (i in 2 until candles.size) {
            val prev2 = candles[i - 2]
            val mid   = candles[i - 1]
            val curr  = candles[i]
            val midBody = abs(mid.close - mid.open)
            if (midBody < atr * minBodyMultiplier) continue

            if (prev2.high < curr.low) {
                result.add(FairValueGap(i, FairValueGap.Type.BULLISH, prev2.high, curr.low, FairValueGap.Status.FRESH))
            }
            if (prev2.low > curr.high) {
                result.add(FairValueGap(i, FairValueGap.Type.BEARISH, curr.high, prev2.low, FairValueGap.Status.FRESH))
            }
        }
        return updateFvgStatuses(result, candles)
    }

    private fun updateFvgStatuses(fvgs: List<FairValueGap>, candles: List<Candle>): List<FairValueGap> {
        return fvgs.map { fvg ->
            val subsequentCandles = candles.drop(fvg.index + 1)
            val fullyMitigated = subsequentCandles.any { c ->
                if (fvg.type == FairValueGap.Type.BULLISH) c.low <= fvg.bottom
                else c.high >= fvg.top
            }
            val partiallyFilled = !fullyMitigated && subsequentCandles.any { c ->
                if (fvg.type == FairValueGap.Type.BULLISH) c.low < fvg.top
                else c.high > fvg.bottom
            }
            fvg.copy(
                status = when {
                    fullyMitigated -> FairValueGap.Status.MITIGATED
                    partiallyFilled -> FairValueGap.Status.PARTIALLY_FILLED
                    else -> FairValueGap.Status.FRESH
                }
            )
        }
    }

    // ─── Order Block ──────────────────────────────────────────────────────────

    /**
     * OB = the last opposing candle BEFORE a displacement that broke structure.
     * Bullish OB = last bearish candle before a bullish BOS/MSS.
     * Bearish OB = last bullish candle before a bearish BOS/MSS.
     */
    fun detectOrderBlocks(candles: List<Candle>, structureEvents: List<StructureEvent>): List<OrderBlock> {
        val result = mutableListOf<OrderBlock>()
        structureEvents.forEach { event ->
            val lookbackStart = max(0, event.index - 20)
            val leg = candles.subList(lookbackStart, event.index)

            when (event.direction) {
                StructureEvent.Direction.BULLISH -> {
                    val ob = leg.lastOrNull { it.close < it.open }
                    if (ob != null) {
                        val idx = candles.indexOf(ob)
                        result.add(OrderBlock(idx, OrderBlock.Type.BULLISH, ob.low, max(ob.open, ob.close), OrderBlock.Status.FRESH))
                    }
                }
                StructureEvent.Direction.BEARISH -> {
                    val ob = leg.lastOrNull { it.close > it.open }
                    if (ob != null) {
                        val idx = candles.indexOf(ob)
                        result.add(OrderBlock(idx, OrderBlock.Type.BEARISH, min(ob.open, ob.close), ob.high, OrderBlock.Status.FRESH))
                    }
                }
            }
        }
        return updateObStatuses(result, candles)
    }

    private fun updateObStatuses(obs: List<OrderBlock>, candles: List<Candle>): List<OrderBlock> {
        return obs.map { ob ->
            val subsequent = candles.drop(ob.index + 1)
            val broken = subsequent.any { c ->
                if (ob.type == OrderBlock.Type.BULLISH) c.close < ob.bottom
                else c.close > ob.top
            }
            val tested = !broken && subsequent.any { c ->
                c.low <= ob.top && c.high >= ob.bottom
            }
            ob.copy(
                status = when {
                    broken -> OrderBlock.Status.BROKEN
                    tested -> OrderBlock.Status.TESTED
                    else -> OrderBlock.Status.FRESH
                }
            )
        }
    }

    // ─── Liquidity ────────────────────────────────────────────────────────────

    fun detectLiquidity(swings: List<SwingPoint>, equalTolerance: Double = 0.15): List<LiquidityLevel> {
        val result = mutableListOf<LiquidityLevel>()
        val highs = swings.filter { it.kind == SwingPoint.Kind.HIGH }
        val lows  = swings.filter { it.kind == SwingPoint.Kind.LOW }

        highs.forEach { swing ->
            val isEqual = highs.any { other -> other !== swing && abs(other.price - swing.price) <= equalTolerance }
            result.add(LiquidityLevel(swing.price, LiquidityLevel.Type.BSL, isEqual))
        }
        lows.forEach { swing ->
            val isEqual = lows.any { other -> other !== swing && abs(other.price - swing.price) <= equalTolerance }
            result.add(LiquidityLevel(swing.price, LiquidityLevel.Type.SSL, isEqual))
        }
        return result.distinctBy { "%.2f".format(it.price) + it.type }
    }

    // ─── Premium / Discount ───────────────────────────────────────────────────

    fun getPremiumDiscount(price: Double, rangeHigh: Double, rangeLow: Double): String {
        if (rangeHigh <= rangeLow) return "RANGING"
        val eq = (rangeHigh + rangeLow) / 2.0
        return when {
            price > eq + (rangeHigh - rangeLow) * 0.05 -> "PREMIUM"
            price < eq - (rangeHigh - rangeLow) * 0.05 -> "DISCOUNT"
            else -> "EQUILIBRIUM"
        }
    }

    // ─── Setup Score ──────────────────────────────────────────────────────────

    /**
     * Transparent 10-point scoring breakdown.
     * Each criterion contributes a fixed weight; no magic numbers.
     */
    fun computeScore(input: ScoreInput): ScoreResult {
        val breakdown = linkedMapOf(
            "HTF Bias Aligned"        to if (input.htfBiasAligned) 2 else 0,
            "Fresh FVG in Entry"      to if (input.freshFvgInEntry) 2 else 0,
            "Fresh OB in Entry"       to if (input.freshObInEntry) 2 else 0,
            "Liquidity Cleared"       to if (input.liquidityCleared) 1 else 0,
            "Premium/Discount OK"     to if (input.premiumDiscountAligned) 1 else 0,
            "Confirmation Candle"     to if (input.confirmationCandle) 1 else 0,
            "RR >= 2"                 to if (input.rrAtLeastTwo) 1 else 0
        )
        return ScoreResult(breakdown.values.sum(), breakdown)
    }

    // ─── Session ──────────────────────────────────────────────────────────────

    fun currentSession(): String = SessionClock.current().name
}
