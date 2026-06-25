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

    private fun LocalTime.inRange(start: String, end: String): Boolean {
        val a = LocalTime.parse(start)
        val b = LocalTime.parse(end)
        return !isBefore(a) && isBefore(b)
    }
}
