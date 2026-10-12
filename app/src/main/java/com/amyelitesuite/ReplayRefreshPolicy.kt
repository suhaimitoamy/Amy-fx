package com.amyelitesuite

import java.net.URI

/** A replay workspace owns vertical swipes even when the WebView is at scrollY=0. */
internal object ReplayRefreshPolicy {
    private val BLOCKED_PATHS = setOf(
        "/assets/apps/academy/trading-practice/candle-replay.html",
        "/assets/apps/academy/trading-practice/chart-analysis.html",
        "/assets/apps/academy/trading-practice/guided-practice.html",
        "/assets/apps/academy/trading-practice/index.html",
        "/assets/apps/mapping/index.html",
        "/assets/apps/mapping/legacy-index.html"
    )

    fun blocksPullToRefresh(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val path = runCatching { URI(url).normalize().path }.getOrNull() ?: return false
        return BLOCKED_PATHS.contains(path) || path.contains("trading-practice")
    }
}
