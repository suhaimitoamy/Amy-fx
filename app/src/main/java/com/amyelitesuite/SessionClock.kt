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

    fun isGoldMarketOpen(now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("America/New_York"))): Boolean {
        val day = now.dayOfWeek
        val hour = now.hour + now.minute / 60.0
        if (day == java.time.DayOfWeek.SATURDAY) return false
        if (day == java.time.DayOfWeek.SUNDAY) return hour >= 17.0
        if (day == java.time.DayOfWeek.FRIDAY) return hour < 17.0
        if (hour >= 17.0 && hour < 18.0) return false
        return true
    }

    private fun LocalTime.inRange(start: String, end: String): Boolean {
        val a = LocalTime.parse(start)
        val b = LocalTime.parse(end)
        return !isBefore(a) && isBefore(b)
    }
}
