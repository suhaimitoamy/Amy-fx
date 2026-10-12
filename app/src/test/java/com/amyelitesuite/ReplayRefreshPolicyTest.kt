package com.amyelitesuite

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReplayRefreshPolicyTest {
    private val base = "https://appassets.androidplatform.net/assets/"
    private val replay = base + "apps/academy/trading-practice/candle-replay.html"

    @Test fun replayOwnsSwipesWithQueryFragmentAndNormalizedPath() {
        assertTrue(ReplayRefreshPolicy.blocksPullToRefresh(replay))
        assertTrue(ReplayRefreshPolicy.blocksPullToRefresh("$replay?timeframe=M5#fullscreen"))
        assertTrue(ReplayRefreshPolicy.blocksPullToRefresh(base + "apps/academy/trading-practice/./candle-replay.html"))
    }

    @Test fun leavingReplayRestoresNormalPageRefresh() {
        assertTrue(ReplayRefreshPolicy.blocksPullToRefresh(replay))
        assertFalse(ReplayRefreshPolicy.blocksPullToRefresh(base + "index.html"))
        assertFalse(ReplayRefreshPolicy.blocksPullToRefresh(base + "apps/academy/index.html"))
        assertFalse(ReplayRefreshPolicy.blocksPullToRefresh(base + "index.html?next=candle-replay.html"))
        assertFalse(ReplayRefreshPolicy.blocksPullToRefresh(base + "other/candle-replay.html"))
    }

    @Test fun missingOrMalformedUrlDoesNotCrashNavigation() {
        assertFalse(ReplayRefreshPolicy.blocksPullToRefresh(null))
        assertFalse(ReplayRefreshPolicy.blocksPullToRefresh(""))
        assertFalse(ReplayRefreshPolicy.blocksPullToRefresh("https://invalid host/"))
    }
}
