package com.amyelitesuite

import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

object SessionClock {
    enum class Session { ASIA, LONDON, NEW_YORK, DEAD_ZONE }

    fun current(zoneId: ZoneId = ZoneId.of("Asia/Jakarta")): Session {
        val time = ZonedDateTime.now(zoneId).toLocalTime()
        return when {
            time.inRange("06:00", "12:00") -> Session.ASIA
            time.inRange("13:00", "17:00") -> Session.LONDON
            time.inRange("19:30", "23:00") -> Session.NEW_YORK
            else -> Session.DEAD_ZONE
        }
    }

    enum class MarketPowerMode { MARKET_OPEN, PRE_MARKET_WARMUP, DEEP_SLEEP }

    fun isGoldMarketOpen(now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("America/New_York"))): Boolean {
        val day = now.dayOfWeek
        val hour = now.hour + now.minute / 60.0
        if (day == java.time.DayOfWeek.SATURDAY) return false
        if (day == java.time.DayOfWeek.SUNDAY) return hour >= 17.0
        if (day == java.time.DayOfWeek.FRIDAY) return hour < 17.0
        if (hour >= 17.0 && hour < 18.0) return false
        return true
    }

    fun isPreMarketWarming(now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("America/New_York"))): Boolean {
        val day = now.dayOfWeek
        val hour = now.hour + now.minute / 60.0
        // Minggu jam 16:55 s.d. 17:00 NY (5 menit sebelum open Sydney/Gold)
        return day == java.time.DayOfWeek.SUNDAY && hour >= 16.9166 && hour < 17.0
    }

    fun getMarketPowerMode(now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("America/New_York"))): MarketPowerMode {
        if (isGoldMarketOpen(now)) return MarketPowerMode.MARKET_OPEN
        if (isPreMarketWarming(now)) return MarketPowerMode.PRE_MARKET_WARMUP
        return MarketPowerMode.DEEP_SLEEP
    }

    fun millisUntilPreMarketWakeup(now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("America/New_York"))): Long {
        var target = now.with(java.time.temporal.TemporalAdjusters.nextOrSame(java.time.DayOfWeek.SUNDAY))
            .withHour(16).withMinute(55).withSecond(0).withNano(0)
        if (target.isBefore(now)) {
            target = target.plusWeeks(1)
        }
        return java.time.Duration.between(now, target).toMillis().coerceAtLeast(0L)
    }

    private fun LocalTime.inRange(start: String, end: String): Boolean {
        val a = LocalTime.parse(start)
        val b = LocalTime.parse(end)
        return !isBefore(a) && isBefore(b)
    }
}
