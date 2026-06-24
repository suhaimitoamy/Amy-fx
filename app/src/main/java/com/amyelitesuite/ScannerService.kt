package com.amyelitesuite

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class ScannerService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var watchdogJob: Job? = null
    private lateinit var dataAgent: MarketDataSyncAgent
    private var apiKey: String? = null
    private var bslTarget: Double = 0.0
    private var sslTarget: Double = 0.0
    private var finalBias: String = "NEUTRAL"
    private var htfBias: String = "NEUTRAL"
    private var htfBiasScore: Int = 0
    private var htfBiasReason: String = "HTF menunggu data"
    private var marketPhase: String = "WAIT"
    private var setupScore: Int = 0
    private var setupGrade: String = "WAIT"

    private var m15BiasDir: Int = 0
    private var m15BiasText: String = "NO CLEAR BIAS"
    private var m15DirectionText: String = "BELUM JELAS"
    private var m15InvalidLevel: Double = 0.0
    private var m15ProtectedHigh: Double = 0.0
    private var m15ProtectedLow: Double = 0.0
    private var m15Bsl: Double = 0.0
    private var m15Ssl: Double = 0.0
    private var m15DolDir: Int = 0
    private var m15DolTarget: Double = 0.0
    private var m15PoiActive: Boolean = false
    private var m15Reason: String = "M15 belum jelas"

    private var hasAlertedBsl = false
    private var hasAlertedSsl = false
    private val lastAlertAt = mutableMapOf<String, Long>()
    @Volatile private var lastMarketAlertAt = 0L
    private var lastMarketAlertSignature = ""
    @Volatile private var lastTickAt = System.currentTimeMillis()
    @Volatile private var lastReconnectAt = 0L
    @Volatile private var lastHtfScanAt = 0L
    @Volatile private var foregroundStarted = false
    @Volatile private var lastForegroundUpdateAt = 0L
    private var lastForegroundSignature = ""

    private var recentHigh = 0.0
    private var recentLow = 0.0
    private var eq = 0.0
    private var activeFvg: Zone? = null
    private var discountOb: Zone? = null
    private var premiumOb: Zone? = null

    data class Zone(
        val type: String,
        val low: Double,
        val high: Double
    )

    data class FrameContext(
        val tf: String,
        val bias: String,
        val phase: String,
        val pd: String,
        val score: Int,
        val high: Double,
        val low: Double,
        val eq: Double
    )

    data class NativeEvent(
        val key: String,
        val title: String,
        val message: String
    )

    data class PivotSnapshot(
        val highs: List<Double>,
        val lows: List<Double>
    )

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP_SCANNER") {
            stopWebSocket()
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        createNotificationChannel()

        if (wakeLock == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "amyfx:scanner")
            wakeLock?.acquire(12 * 60 * 60 * 1000L)
        }

        if (!::dataAgent.isInitialized) {
            dataAgent = MarketDataSyncAgent(applicationContext, client)
        }

        val prefs = getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
        apiKey = prefs.getString("api_key", null)

        val passedBsl = intent?.getStringExtra("bsl")?.toDoubleOrNull() ?: 0.0
        val passedSsl = intent?.getStringExtra("ssl")?.toDoubleOrNull() ?: 0.0

        if (passedBsl > 0 && abs(passedBsl - bslTarget) > 0.01) {
            bslTarget = passedBsl
            hasAlertedBsl = false
        }
        if (passedSsl > 0 && abs(passedSsl - sslTarget) > 0.01) {
            sslTarget = passedSsl
            hasAlertedSsl = false
        }

        if (apiKey.isNullOrEmpty()) {
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        startForegroundServiceNotification()
        bootstrapContext()
        startWebSocket()
        startWatchdog()

        return START_STICKY
    }

    private fun bootstrapContext() {
        serviceScope.launch {
            try {
                val rows = dataAgent.bootstrap("XAU/USD", "M5", 300)
                if (rows.size >= 20) {
                    buildContext(rows, rows.last().close)
                    updateM15Dashboard(rows)
                    updateHtfBias(rows, rows.last().close, force = true)
                    updateSetupScore(rows.last().close)
                    startForegroundServiceNotification()
                }
            } catch (e: Exception) {
                Log.e("AmyFX", "Bootstrap context failed: ${e.message}")
            }
        }
    }

    private fun startForegroundServiceNotification() {
        val notificationIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val text = "M15:${contextShort()} | HTF:$htfBias | Score:$setupScore | $setupGrade"
        val big = "$text\nTarget: ${targetText()}\nInvalid: ${invalidText()}"
        val now = System.currentTimeMillis()
        val signature = "$text|${targetText()}|${invalidText()}"
        if (foregroundStarted && signature == lastForegroundSignature && now - lastForegroundUpdateAt < 60_000L) return
        foregroundStarted = true
        lastForegroundSignature = signature
        lastForegroundUpdateAt = now
        val notification: Notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, "scanner_channel")
                .setContentTitle("Amy FX Scanner Active")
                .setContentText(text)
                .setStyle(Notification.BigTextStyle().bigText(big))
                .setSmallIcon(R.drawable.ic_stat_amy_fx)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("Amy FX Scanner Active")
                .setContentText(text)
                .setStyle(Notification.BigTextStyle().bigText(big))
                .setSmallIcon(R.drawable.ic_stat_amy_fx)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(1, notification)
        }
    }

    private fun startWebSocket() {
        stopWebSocket()
        val request = Request.Builder()
            .url("wss://ws.twelvedata.com/v1/quotes/price?apikey=$apiKey")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("AmyFX", "WebSocket Connected")
                lastTickAt = System.currentTimeMillis()
                val subscribeMsg = """{"action": "subscribe", "params": {"symbols": "XAU/USD"}}"""
                webSocket.send(subscribeMsg)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    if (json.has("price")) {
                        lastTickAt = System.currentTimeMillis()
                        val currentPrice = json.getDouble("price")
                        val timestamp = json.optLong("timestamp", System.currentTimeMillis() / 1000)
                        checkTargets(currentPrice, timestamp)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("AmyFX", "WebSocket Error: ${t.message}")
                scheduleReconnect("failure")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("AmyFX", "WebSocket Closed: $reason")
                scheduleReconnect("closed")
            }
        })
    }

    private fun scheduleReconnect(reason: String) {
        val now = System.currentTimeMillis()
        if (now - lastReconnectAt < 5000L) return
        lastReconnectAt = now
        serviceScope.launch {
            delay(5000)
            Log.d("AmyFX", "Reconnecting WebSocket: $reason")
            startWebSocket()
        }
    }

    private fun startWatchdog() {
        if (watchdogJob?.isActive == true) return
        watchdogJob = serviceScope.launch {
            while (true) {
                delay(60_000L)
                val now = System.currentTimeMillis()
                val silentTooLong = now - lastTickAt > 120_000L
                if (silentTooLong) {
                    Log.w("AmyFX", "Watchdog restarting silent WebSocket")
                    sendDedupedAlert(
                        "WATCHDOG-${now / 600000L}",
                        contextTitle(),
                        marketReadMessage("Scanner watchdog", "WebSocket direstart otomatis")
                    )
                    startWebSocket()
                    lastTickAt = now
                }
            }
        }
    }

    private fun checkTargets(currentPrice: Double, timestamp: Long) {
        val rows = dataAgent.onTick("XAU/USD", "M5", currentPrice, timestamp)
        if (rows.size >= 20) {
            buildContext(rows, currentPrice)
            updateM15Dashboard(rows)
            updateHtfBias(rows, currentPrice)
            updateSetupScore(currentPrice)
            scanNativeEvents(rows, currentPrice).forEach { event ->
                sendDedupedAlert(event.key, event.title, event.message)
            }
            startForegroundServiceNotification()
        }

        val fvg = activeFvg
        val inFvg = fvg != null && currentPrice >= fvg.low && currentPrice <= fvg.high

        if (inFvg && fvg != null) {
            val q = poiQuality("FVG", fvg.type, currentPrice, fvg)
            sendDedupedAlert(
                "FVG-${fvg.type}-${fmt(fvg.low)}-${fmt(fvg.high)}",
                contextTitle(),
                marketReadMessage("${fvg.type} FVG touched", "Area ${fmt(fvg.low)} - ${fmt(fvg.high)}. Quality ${q.first} ${q.second}/100. OB ditahan karena FVG aktif.")
            )
            return
        }

        val ob = when {
            discountOb?.let { currentPrice >= it.low && currentPrice <= it.high } == true -> discountOb
            premiumOb?.let { currentPrice >= it.low && currentPrice <= it.high } == true -> premiumOb
            else -> null
        }

        if (ob != null) {
            val q = poiQuality("OB", ob.type, currentPrice, ob)
            sendDedupedAlert(
                "OB-${ob.type}-${fmt(ob.low)}-${fmt(ob.high)}",
                contextTitle(),
                marketReadMessage("${ob.type} OB touched", "Area ${fmt(ob.low)} - ${fmt(ob.high)}. Quality ${q.first} ${q.second}/100.")
            )
        }

        if (bslTarget > 0 && currentPrice >= bslTarget && !hasAlertedBsl) {
            hasAlertedBsl = true
            sendDedupedAlert(
                "BSL-${fmt(bslTarget)}",
                contextTitle(),
                marketReadMessage("BSL tertembus", "Target atas ${fmt(bslTarget)} sudah diambil.")
            )
        }

        if (sslTarget > 0 && currentPrice <= sslTarget && !hasAlertedSsl) {
            hasAlertedSsl = true
            sendDedupedAlert(
                "SSL-${fmt(sslTarget)}",
                contextTitle(),
                marketReadMessage("SSL tertembus", "Target bawah ${fmt(sslTarget)} sudah diambil.")
            )
        }
    }

    private fun scanNativeEvents(rows: List<CandleStore.Candle>, currentPrice: Double): List<NativeEvent> {
        val events = mutableListOf<NativeEvent>()
        if (rows.size < 20) return events

        val latest = rows.last()
        val a = max(atr(rows), 0.05)
        val body = abs(latest.close - latest.open)
        val br = bodyRatio(latest)
        val trend = inferTrend(rows)
        val phase = calcMarketPhase(rows, trend, a)
        marketPhase = phase

        if (body >= a * 1.5 && br >= 0.65) {
            val dir = if (latest.close > latest.open) "Bullish" else "Bearish"
            events.add(
                NativeEvent(
                    "DISPLACEMENT-$dir-${latest.openTime}",
                    contextTitle(),
                    marketReadMessage("$dir displacement M5", "Candle momentum kuat. Close ${fmt(latest.close)}.")
                )
            )
        }

        if (currentPrice > recentHigh) {
            val tag = if (trend == "bearish") "MSS" else "BOS"
            events.add(
                NativeEvent(
                    "STRUCT-$tag-BULL-${fmt(recentHigh)}",
                    contextTitle(),
                    marketReadMessage("$tag Bullish M5", "Resistance/BSL ${fmt(recentHigh)} dijebol.")
                )
            )
        }

        if (currentPrice < recentLow) {
            val tag = if (trend == "bullish") "MSS" else "BOS"
            events.add(
                NativeEvent(
                    "STRUCT-$tag-BEAR-${fmt(recentLow)}",
                    contextTitle(),
                    marketReadMessage("$tag Bearish M5", "Support/SSL ${fmt(recentLow)} dijebol.")
                )
            )
        }

        val pivots = pivotLevels(rows)
        val buySide = pivots.highs.filter { it > latest.close }.minOrNull() ?: rows.takeLast(60).maxOf { it.high }
        val sellSide = pivots.lows.filter { it < latest.close }.maxOrNull() ?: rows.takeLast(60).minOf { it.low }
        val tol = max(a * 0.10, 0.05)
        val range = max(latest.high - latest.low, 0.0001)
        val topWick = (latest.high - max(latest.open, latest.close)) / range
        val botWick = (min(latest.open, latest.close) - latest.low) / range

        if (latest.high > buySide + tol && latest.close < buySide && topWick >= 0.30) {
            events.add(
                NativeEvent(
                    "SWEEP-BSL-${latest.openTime}",
                    contextTitle(),
                    marketReadMessage("BSL swept", "Harga ambil likuiditas atas ${fmt(buySide)} lalu close kembali.")
                )
            )
        }

        if (latest.low < sellSide - tol && latest.close > sellSide && botWick >= 0.30) {
            events.add(
                NativeEvent(
                    "SWEEP-SSL-${latest.openTime}",
                    contextTitle(),
                    marketReadMessage("SSL swept", "Harga ambil likuiditas bawah ${fmt(sellSide)} lalu close kembali.")
                )
            )
        }

        if (setupScore >= 71) {
            events.add(
                NativeEvent(
                    "SETUP-STRONG-$setupGrade-${latest.openTime}",
                    contextTitle(),
                    marketReadMessage("Setup $setupGrade", "Setup score $setupScore/100.")
                )
            )
        }

        events.add(
            NativeEvent(
                "M15-${m15BiasDir}-${latest.openTime / 900L}",
                contextTitle(),
                marketReadMessage("M15 Bias ${contextShort()}", m15Reason)
            )
        )

        return events
    }

    private fun updateM15Dashboard(m5Rows: List<CandleStore.Candle>) {
        val rows = buildM15Rows(m5Rows).ifEmpty { dataAgent.latest("XAU/USD", "M15", 180) }
        if (rows.size < 25) return

        var lastPH = 0.0
        var lastPL = 0.0
        var biasDir = 0
        var mssDir = 0
        var lockedInvalid = 0.0
        var rangeHigh = 0.0
        var rangeLow = 0.0
        var lastSweepDir = 0
        var lastSweepIndex = -1
        var sweptPrice = 0.0
        var sweepExtreme = 0.0
        var bullFvgStatus = 0
        var bearFvgStatus = 0
        var bullObStatus = 0
        var bearObStatus = 0
        var bullFvgTop = 0.0
        var bullFvgBtm = 0.0
        var bearFvgTop = 0.0
        var bearFvgBtm = 0.0
        var bullObTop = 0.0
        var bullObBtm = 0.0
        var bearObTop = 0.0
        var bearObBtm = 0.0

        val swingLen = 3
        val freshBars = 8

        for (i in swingLen until rows.size) {
            val confirmIndex = i - swingLen
            if (confirmIndex >= swingLen && confirmIndex < rows.size - swingLen) {
                if (isPivotHigh(rows, confirmIndex, swingLen)) lastPH = rows[confirmIndex].high
                if (isPivotLow(rows, confirmIndex, swingLen)) lastPL = rows[confirmIndex].low
            }

            if (i < 4 || lastPH <= 0.0 || lastPL <= 0.0) continue

            val c = rows[i]
            val p = rows[i - 1]
            val bullMss = c.close > lastPH && p.close <= lastPH
            val bearMss = c.close < lastPL && p.close >= lastPL

            if (biasDir == 1 && lockedInvalid > 0.0 && c.close < lockedInvalid) {
                if (bearMss) {
                    biasDir = -1
                    mssDir = -1
                    lockedInvalid = lastPH
                    rangeHigh = lastPH
                    rangeLow = min(lastPL, c.low)
                } else {
                    biasDir = 0
                    mssDir = 0
                }
                lastSweepDir = 0
                lastSweepIndex = -1
                sweptPrice = 0.0
                sweepExtreme = 0.0
            } else if (biasDir == -1 && lockedInvalid > 0.0 && c.close > lockedInvalid) {
                if (bullMss) {
                    biasDir = 1
                    mssDir = 1
                    lockedInvalid = lastPL
                    rangeHigh = max(lastPH, c.high)
                    rangeLow = lastPL
                } else {
                    biasDir = 0
                    mssDir = 0
                }
                lastSweepDir = 0
                lastSweepIndex = -1
                sweptPrice = 0.0
                sweepExtreme = 0.0
            } else if (bullMss && biasDir != 1) {
                biasDir = 1
                mssDir = 1
                lockedInvalid = lastPL
                rangeHigh = max(lastPH, c.high)
                rangeLow = lastPL
                lastSweepDir = 0
                lastSweepIndex = -1
            } else if (bearMss && biasDir != -1) {
                biasDir = -1
                mssDir = -1
                lockedInvalid = lastPH
                rangeHigh = lastPH
                rangeLow = min(lastPL, c.low)
                lastSweepDir = 0
                lastSweepIndex = -1
            } else if (bullMss && biasDir == 1) {
                mssDir = 1
                rangeHigh = if (rangeHigh > 0.0) max(rangeHigh, c.high) else max(lastPH, c.high)
            } else if (bearMss && biasDir == -1) {
                mssDir = -1
                rangeLow = if (rangeLow > 0.0) min(rangeLow, c.low) else min(lastPL, c.low)
            }

            val bsl = lastPH
            val ssl = lastPL
            val bslSweep = c.high > bsl && c.close < bsl
            val sslSweep = c.low < ssl && c.close > ssl

            if (sslSweep && !bslSweep) {
                lastSweepDir = 1
                lastSweepIndex = i
                sweptPrice = ssl
                sweepExtreme = c.low
            }

            if (bslSweep && !sslSweep) {
                lastSweepDir = -1
                lastSweepIndex = i
                sweptPrice = bsl
                sweepExtreme = c.high
            }

            val sweepInvalid = (lastSweepDir == 1 && sweptPrice > 0.0 && c.close < sweptPrice) ||
                (lastSweepDir == -1 && sweptPrice > 0.0 && c.close > sweptPrice)
            if (sweepInvalid) {
                lastSweepDir = 0
                lastSweepIndex = -1
            }

            val bullFvgNew = i >= 3 && rows[i - 1].low > rows[i - 3].high
            val bearFvgNew = i >= 3 && rows[i - 1].high < rows[i - 3].low

            if (bullFvgNew) {
                bullFvgTop = rows[i - 1].low
                bullFvgBtm = rows[i - 3].high
                bullFvgStatus = 1
            }
            if (bearFvgNew) {
                bearFvgTop = rows[i - 3].low
                bearFvgBtm = rows[i - 1].high
                bearFvgStatus = 1
            }

            val body = abs(p.close - p.open)
            val meanBody = meanBody(rows, i, 20)
            val bullDisp = p.close > p.open && body > meanBody * 1.20 && p.close > rows[max(0, i - 3)].high
            val bearDisp = p.close < p.open && body > meanBody * 1.20 && p.close < rows[max(0, i - 3)].low

            if (bullDisp) {
                bullObTop = if (rows[i - 2].close < rows[i - 2].open) rows[i - 2].open else p.open
                bullObBtm = if (rows[i - 2].close < rows[i - 2].open) rows[i - 2].low else p.low
                bullObStatus = 1
            }
            if (bearDisp) {
                bearObTop = if (rows[i - 2].close > rows[i - 2].open) rows[i - 2].high else p.high
                bearObBtm = if (rows[i - 2].close > rows[i - 2].open) rows[i - 2].open else p.open
                bearObStatus = 1
            }

            val bullFvgActive = bullFvgStatus in 1..3
            val bearFvgActive = bearFvgStatus in 1..3
            val bullObActive = bullObStatus in 1..3
            val bearObActive = bearObStatus in 1..3
            val poiActive = when (biasDir) {
                1 -> bullFvgActive || bullObActive
                -1 -> bearFvgActive || bearObActive
                else -> false
            }

            m15PoiActive = poiActive
            m15ProtectedHigh = lastPH
            m15ProtectedLow = lastPL
            m15Bsl = bsl
            m15Ssl = ssl
            m15InvalidLevel = lockedInvalid
            val fresh = lastSweepIndex >= 0 && i - lastSweepIndex <= freshBars
            m15DolDir = if (fresh && lastSweepDir == 1 && bsl > 0.0) 1 else if (fresh && lastSweepDir == -1 && ssl > 0.0) -1 else 0
            m15DolTarget = if (m15DolDir == 1) bsl else if (m15DolDir == -1) ssl else 0.0
        }

        m15BiasDir = biasDir
        m15BiasText = when (biasDir) {
            1 -> "BUY CTX"
            -1 -> "SELL CTX"
            else -> "NO CLEAR BIAS"
        }
        m15DirectionText = when (biasDir) {
            1 -> "NAIK"
            -1 -> "TURUN"
            else -> "BELUM JELAS"
        }
        finalBias = when (biasDir) {
            1 -> "BULLISH"
            -1 -> "BEARISH"
            else -> "NEUTRAL"
        }
        if (m15Bsl > 0.0) bslTarget = m15Bsl
        if (m15Ssl > 0.0) sslTarget = m15Ssl
        m15Reason = buildM15Reason()
    }

    private fun buildM15Reason(): String {
        val base = when (m15BiasDir) {
            1 -> "M15 bullish"
            -1 -> "M15 bearish"
            else -> "M15 belum jelas"
        }
        val dol = when (m15DolDir) {
            1 -> "DOL menuju BSL"
            -1 -> "DOL menuju SSL"
            else -> "DOL belum jelas"
        }
        val poi = if (m15PoiActive) "POI aktif" else "POI belum aktif"
        val htf = if (htfBias == finalBias && htfBias != "NEUTRAL") "HTF searah" else "HTF belum kompak"
        return "$base, $dol, $poi, dan $htf."
    }

    private fun buildM15Rows(m5Rows: List<CandleStore.Candle>): List<CandleStore.Candle> {
        if (m5Rows.isEmpty()) return emptyList()
        val sorted = m5Rows.sortedBy { it.openTime }
        val grouped = sorted.groupBy { (it.openTime / 900L) * 900L }.toSortedMap()
        val out = mutableListOf<CandleStore.Candle>()
        grouped.forEach { (openTime, rows) ->
            if (rows.isEmpty()) return@forEach
            val first = rows.first()
            val high = rows.maxOf { it.high }
            val low = rows.minOf { it.low }
            val close = rows.last().close
            val volume = rows.sumOf { it.volumeTick }
            out.add(
                CandleStore.Candle(
                    symbol = first.symbol,
                    timeframe = "M15",
                    openTime = openTime,
                    closeTime = openTime + 900L,
                    open = first.open,
                    high = high,
                    low = low,
                    close = close,
                    volumeTick = volume,
                    isClosed = rows.last().isClosed
                )
            )
        }
        return out.takeLast(180)
    }

    private fun updateHtfBias(m5Rows: List<CandleStore.Candle>, price: Double, force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && now - lastHtfScanAt < 60_000L) return
        lastHtfScanAt = now

        val frames = mutableListOf<FrameContext>()
        val tfs = listOf("D1", "H4", "H1", "M15", "M5")
        for (tf in tfs) {
            val rows = when (tf) {
                "M5" -> m5Rows
                "M15" -> buildM15Rows(m5Rows).ifEmpty { dataAgent.latest("XAU/USD", "M15", 180) }
                else -> dataAgent.latest("XAU/USD", tf, 180)
            }
            if (rows.size >= 20) frames.add(analyzeFrame(tf, rows, price))
        }

        if (frames.isEmpty()) return

        val weights = mapOf("D1" to 5, "H4" to 4, "H1" to 3, "M15" to 2, "M5" to 1)
        var total = 0
        var weightSum = 0
        frames.forEach { frame ->
            val w = weights[frame.tf] ?: 1
            total += frame.score * w
            weightSum += w
        }

        val norm = total.toDouble() / max(weightSum, 1).toDouble()
        htfBiasScore = (norm * 100.0).toInt()
        htfBias = when {
            norm >= 0.35 -> "BULLISH"
            norm <= -0.35 -> "BEARISH"
            else -> "NEUTRAL"
        }
        htfBiasReason = frames.joinToString(" | ") { "${it.tf}:${it.bias}/${it.phase}/${it.pd}" }
        m15Reason = buildM15Reason()
    }

    private fun updateSetupScore(price: Double) {
        var score = 30
        if (m15BiasDir != 0) score += 20
        if (m15DolDir == m15BiasDir && m15DolDir != 0) score += 10
        if (m15PoiActive) score += 15
        if (htfBias == finalBias && htfBias != "NEUTRAL") score += 15
        if (htfBias != "NEUTRAL" && finalBias != "NEUTRAL" && htfBias != finalBias) score -= 15
        if ((finalBias == "BULLISH" && price < eq) || (finalBias == "BEARISH" && price > eq)) score += 10
        if (activeFvg != null) score -= 5
        val obActive = discountOb?.let { price >= it.low && price <= it.high } == true || premiumOb?.let { price >= it.low && price <= it.high } == true
        if (obActive) score += 10
        if (marketPhase == "EXPANSION") score += 8
        if (marketPhase == "RETRACEMENT") score += 5
        setupScore = score.coerceIn(0, 100)
        setupGrade = when {
            setupScore >= 71 -> "READY"
            else -> "WAIT"
        }
        m15Reason = buildM15Reason()
    }

    private fun analyzeFrame(tf: String, rows: List<CandleStore.Candle>, price: Double): FrameContext {
        val pivots = pivotLevels(rows)
        val highs = pivots.highs
        val lows = pivots.lows
        val recentH = if (highs.isNotEmpty()) highs.takeLast(3).maxOrNull() ?: rows.takeLast(60).maxOf { it.high } else rows.takeLast(60).maxOf { it.high }
        val recentL = if (lows.isNotEmpty()) lows.takeLast(3).minOrNull() ?: rows.takeLast(60).minOf { it.low } else rows.takeLast(60).minOf { it.low }
        val range = max(recentH - recentL, 0.01)
        val frameEq = recentL + range / 2.0
        val pd = when {
            price > frameEq + range * 0.08 -> "PREMIUM"
            price < frameEq - range * 0.08 -> "DISCOUNT"
            else -> "EQ"
        }
        val trend = inferTrend(rows)
        val bias = when (trend) {
            "bullish" -> "BULLISH"
            "bearish" -> "BEARISH"
            else -> "NEUTRAL"
        }
        val phase = calcMarketPhase(rows, trend, max(atr(rows), 0.05))
        val score = when (bias) {
            "BULLISH" -> 1
            "BEARISH" -> -1
            else -> 0
        }
        return FrameContext(tf, bias, phase, pd, score, recentH, recentL, frameEq)
    }

    private fun buildContext(rows: List<CandleStore.Candle>, price: Double) {
        val highs = mutableListOf<Double>()
        val lows = mutableListOf<Double>()

        for (i in 5 until rows.size - 5) {
            var isHigh = true
            var isLow = true
            for (j in 1..5) {
                if (rows[i].high <= rows[i - j].high || rows[i].high <= rows[i + j].high) isHigh = false
                if (rows[i].low >= rows[i - j].low || rows[i].low >= rows[i + j].low) isLow = false
            }
            if (isHigh) highs.add(rows[i].high)
            if (isLow) lows.add(rows[i].low)
        }

        if (highs.isEmpty() || lows.isEmpty()) return

        recentHigh = highs.takeLast(3).maxOrNull() ?: rows.takeLast(30).maxOf { it.high }
        recentLow = lows.takeLast(3).minOrNull() ?: rows.takeLast(30).minOf { it.low }
        val range = max(recentHigh - recentLow, 0.01)
        eq = recentLow + range / 2.0

        if (bslTarget <= 0) bslTarget = highs.filter { it > price }.minOrNull() ?: rows.takeLast(30).maxOf { it.high }
        if (sslTarget <= 0) sslTarget = lows.filter { it < price }.maxOrNull() ?: rows.takeLast(30).minOf { it.low }

        activeFvg = findNearestFvg(rows, price)
        discountOb = Zone("Discount", recentLow, recentLow + range * 0.2)
        premiumOb = Zone("Premium", recentHigh - range * 0.2, recentHigh)
        if (m15BiasDir == 0) finalBias = calculateFinalBias(price, activeFvg)
    }

    private fun findNearestFvg(rows: List<CandleStore.Candle>, price: Double): Zone? {
        for (i in rows.size - 3 downTo max(2, rows.size - 20)) {
            val c1 = rows[i - 2]
            val c3 = rows[i]
            if (c1.high < c3.low) {
                val zone = Zone("Bullish", c1.high, c3.low)
                if (price >= zone.low && price <= zone.high) return zone
            }
            if (c1.low > c3.high) {
                val zone = Zone("Bearish", c3.high, c1.low)
                if (price >= zone.low && price <= zone.high) return zone
            }
        }
        return null
    }

    private fun calculateFinalBias(price: Double, fvg: Zone?): String {
        var score = 0
        if (price > recentHigh) score += 2
        if (price < recentLow) score -= 2
        if (price < eq) score += 1
        if (price > eq) score -= 1
        if (fvg?.type == "Bullish") score += 1
        if (fvg?.type == "Bearish") score -= 1
        return when {
            score >= 2 -> "BULLISH"
            score <= -2 -> "BEARISH"
            else -> "NEUTRAL"
        }
    }

    private fun pivotLevels(rows: List<CandleStore.Candle>): PivotSnapshot {
        val highs = mutableListOf<Double>()
        val lows = mutableListOf<Double>()
        if (rows.size < 10) return PivotSnapshot(highs, lows)
        for (i in 3 until rows.size - 2) {
            if (isPivotHigh(rows, i, 3)) highs.add(rows[i].high)
            if (isPivotLow(rows, i, 3)) lows.add(rows[i].low)
        }
        return PivotSnapshot(highs, lows)
    }

    private fun isPivotHigh(rows: List<CandleStore.Candle>, index: Int, len: Int): Boolean {
        if (index - len < 0 || index + len >= rows.size) return false
        for (j in 1..len) {
            if (rows[index - j].high >= rows[index].high) return false
            if (rows[index + j].high >= rows[index].high) return false
        }
        return true
    }

    private fun isPivotLow(rows: List<CandleStore.Candle>, index: Int, len: Int): Boolean {
        if (index - len < 0 || index + len >= rows.size) return false
        for (j in 1..len) {
            if (rows[index - j].low <= rows[index].low) return false
            if (rows[index + j].low <= rows[index].low) return false
        }
        return true
    }

    private fun inferTrend(rows: List<CandleStore.Candle>): String {
        val pivots = pivotLevels(rows)
        val highs = pivots.highs
        val lows = pivots.lows
        val hh = highs.size >= 2 && highs[highs.size - 1] > highs[highs.size - 2]
        val hl = lows.size >= 2 && lows[lows.size - 1] > lows[lows.size - 2]
        val lh = highs.size >= 2 && highs[highs.size - 1] < highs[highs.size - 2]
        val ll = lows.size >= 2 && lows[lows.size - 1] < lows[lows.size - 2]
        return when {
            hh && hl -> "bullish"
            lh && ll -> "bearish"
            else -> "range"
        }
    }

    private fun calcMarketPhase(rows: List<CandleStore.Candle>, trend: String, a: Double): String {
        val latest = rows.lastOrNull() ?: return "WAIT"
        val body = abs(latest.close - latest.open)
        if (body >= a * 1.5 && bodyRatio(latest) >= 0.60) return "EXPANSION"
        val last = rows.takeLast(60)
        val hi = last.maxOf { it.high }
        val lo = last.minOf { it.low }
        val mid = lo + (hi - lo) / 2.0
        if (trend == "bullish" && latest.close < mid) return "RETRACEMENT"
        if (trend == "bearish" && latest.close > mid) return "RETRACEMENT"
        return if (trend == "range") "RANGE" else "CONTINUATION"
    }

    private fun atr(rows: List<CandleStore.Candle>): Double {
        val ranges = rows.takeLast(14).map { it.high - it.low }.filter { it > 0 }
        return if (ranges.isEmpty()) 0.50 else ranges.sum() / ranges.size
    }

    private fun meanBody(rows: List<CandleStore.Candle>, endIndex: Int, length: Int): Double {
        val start = max(0, endIndex - length)
        val bodies = rows.subList(start, endIndex).map { abs(it.close - it.open) }
        return if (bodies.isEmpty()) 0.0 else bodies.sum() / bodies.size
    }

    private fun bodyRatio(c: CandleStore.Candle): Double {
        val range = max(c.high - c.low, 0.0001)
        return abs(c.close - c.open) / range
    }

    private fun poiQuality(kind: String, type: String, price: Double, zone: Zone): Pair<String, Int> {
        var score = if (kind == "OB") 58 else 54
        val bullish = type.contains("Bullish", ignoreCase = true) || type.contains("Discount", ignoreCase = true)
        val bearish = type.contains("Bearish", ignoreCase = true) || type.contains("Premium", ignoreCase = true)
        if (bullish && finalBias == "BULLISH") score += 15
        if (bearish && finalBias == "BEARISH") score += 15
        if (bullish && price < eq) score += 12
        if (bearish && price > eq) score += 12
        if (kind == "OB" && activeFvg != null) score -= 18
        if (marketPhase == "RETRACEMENT") score += 8
        val mid = (zone.low + zone.high) / 2.0
        val width = max(zone.high - zone.low, 0.01)
        if (abs(price - mid) <= width * 2) score += 6
        score = score.coerceIn(0, 100)
        val grade = when {
            score >= 75 -> "KUAT"
            score >= 55 -> "SEDANG"
            else -> "LEMAH"
        }
        return Pair(grade, score)
    }

    private fun contextTitle(): String {
        return when (m15BiasDir) {
            1 -> "AMY FX — BUY CONTEXT"
            -1 -> "AMY FX — SELL CONTEXT"
            else -> "AMY FX — WAIT"
        }
    }

    private fun contextShort(): String {
        return when (m15BiasDir) {
            1 -> "BUY"
            -1 -> "SELL"
            else -> "WAIT"
        }
    }

    private fun targetText(): String {
        return when {
            m15DolTarget > 0.0 && m15DolDir == 1 -> "BSL ${fmt(m15DolTarget)}"
            m15DolTarget > 0.0 && m15DolDir == -1 -> "SSL ${fmt(m15DolTarget)}"
            m15BiasDir == 1 && m15Bsl > 0.0 -> "BSL ${fmt(m15Bsl)}"
            m15BiasDir == -1 && m15Ssl > 0.0 -> "SSL ${fmt(m15Ssl)}"
            bslTarget > 0.0 || sslTarget > 0.0 -> "BSL ${fmt(bslTarget)} | SSL ${fmt(sslTarget)}"
            else -> "Menunggu target"
        }
    }

    private fun invalidText(): String {
        return when {
            m15BiasDir == 1 && m15InvalidLevel > 0.0 -> "Close di bawah ${fmt(m15InvalidLevel)}"
            m15BiasDir == -1 && m15InvalidLevel > 0.0 -> "Close di atas ${fmt(m15InvalidLevel)}"
            else -> "Belum ada invalid utama"
        }
    }

    private fun directionSentence(): String {
        return when (m15BiasDir) {
            1 -> "Harga condong naik."
            -1 -> "Harga condong turun."
            else -> "Arah utama belum jelas."
        }
    }

    private fun marketReadMessage(event: String, detail: String): String {
        return """
${contextTitle()}

${directionSentence()}
Target: ${targetText()}

Status: $setupGrade
Score: $setupScore/100

Alasan:
$m15Reason

Event:
$event
$detail

Invalid:
${invalidText()}
        """.trimIndent()
    }

    private fun sendDedupedAlert(key: String, title: String, message: String) {
        val now = System.currentTimeMillis()
        val last = lastAlertAt[key] ?: 0L
        if (now - last < 10 * 60 * 1000L) return

        val signature = title + "|" + message.lineSequence().take(5).joinToString("|")
        if (signature == lastMarketAlertSignature && now - lastMarketAlertAt < 30 * 60 * 1000L) return
        if (now - lastMarketAlertAt < 90 * 1000L) return

        lastAlertAt[key] = now
        lastMarketAlertSignature = signature
        lastMarketAlertAt = now
        sendAlertNotification(title, message)
    }

    private fun sendAlertNotification(title: String, message: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, "scanner_channel")
                .setContentTitle(title)
                .setContentText(directionSentence())
                .setStyle(Notification.BigTextStyle().bigText(message))
                .setSmallIcon(R.drawable.ic_stat_amy_fx)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle(title)
                .setContentText(directionSentence())
                .setStyle(Notification.BigTextStyle().bigText(message))
                .setSmallIcon(R.drawable.ic_stat_amy_fx)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()
        }

        nm.notify(2, notification)
    }

    private fun stopWebSocket() {
        webSocket?.close(1000, "Service Stopped")
        webSocket = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                "scanner_channel",
                "Background Scanner",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Amy FX background scanner alerts"
                enableVibration(true)
                enableLights(true)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(serviceChannel)
        }
    }

    private fun fmt(value: Double): String {
        if (value <= 0.0) return "-"
        return String.format("%.2f", value)
    }

    override fun onDestroy() {
        stopWebSocket()
        serviceScope.cancel()
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        super.onDestroy()
    }
}
