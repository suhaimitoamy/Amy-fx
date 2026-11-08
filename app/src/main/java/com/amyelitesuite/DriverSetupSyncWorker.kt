package com.amyelitesuite

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class DriverSetupSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        if (!AmyFxNotificationGate.isGoldMarketOpen(System.currentTimeMillis()) || !SessionClock.isGoldMarketOpen()) {
            android.util.Log.d("AmyFX-DriverWorker", "Market closed (weekend/closure), skipping HTTP driver setup sync.")
            return@withContext Result.success()
        }
        try {
            val request = Request.Builder()
                .url(SETUPS_URL)
                .header("Accept", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext Result.retry()

                val payload = JSONObject(response.body?.string().orEmpty())
                if (!payload.optBoolean("ok", false)) return@withContext Result.success()

                val engine = payload.optJSONObject("engine")
                val result = engine?.optJSONObject("result")
                val contextObj = payload.optJSONObject("context") ?: result?.optJSONObject("context")

                val active = payload.optJSONArray("active")
                if (active != null && active.length() > 0) {
                    processActiveSetups(active, contextObj)
                }

                if (result != null) {
                    processMarketAlerts(result)
                }

                if (contextObj != null) {
                    processAssistantAlerts(contextObj, payload)
                }

                try {
                    scheduleNextCandleSync(applicationContext)
                } catch (_: Exception) {}

                Result.success()
            }
        } catch (error: Exception) {
            android.util.Log.w("AmyFX-DriverWorker", "Driver setup sync failed", error)
            Result.retry()
        }
    }

    private fun processActiveSetups(active: org.json.JSONArray, contextObj: JSONObject?) {
        // Dinonaktifkan permanen atas instruksi pengguna: setup driver mekanikal ditiadakan (anti-spam & anti-false-signal).
        // Seluruh notifikasi asli ICT Asisten (SSL/BSL Swept, Valid Break, POI, DOL, News) tetap aktif 100% di processAssistantAlerts.
        return
    }

    private fun processMarketAlerts(result: JSONObject) {
        val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val news = result.optJSONObject("news")
        if (news?.optString("status") == "NEWS_LOCK") {
            val newsKey = "news_lock_" + (news.optString("note").hashCode())
            if (!prefs.contains(newsKey)) {
                showDriverNotification(
                    "🛡️ Tahan Dulu: Pasar Lagi Liar",
                    news.optString("note", "Ada rilis berita USD berdampak tinggi. Menunda eksekusi."),
                    "news_lock"
                )
                prefs.edit().putLong(newsKey, System.currentTimeMillis()).apply()
            }
        }
    }

    private fun processAssistantAlerts(contextObj: JSONObject, payload: JSONObject? = null) {
        val session = contextObj.optString("session", "").trim()
        if (session.equals("PASAR TUTUP", ignoreCase = true) || !AmyFxNotificationGate.isGoldMarketOpen(System.currentTimeMillis())) {
            android.util.Log.d("AmyFX-DriverWorker", "Market closed (session=$session), assistant alerts suppressed.")
            return
        }

        val fresh = contextObj.optBoolean("fresh", true)
        if (!fresh) {
            android.util.Log.d("AmyFX-DriverWorker", "Context is not fresh, assistant alerts suppressed.")
            return
        }

        val amy = contextObj.optJSONObject("amy") ?: return
        val sourceObj = amy.optJSONObject("source") ?: contextObj.optJSONObject("source")
        val candleTime = sourceObj?.optLong("M15", 0L)?.takeIf { it > 0L }
            ?: sourceObj?.optLong("M5", 0L)
            ?: 0L
        if (candleTime <= 0L) return

        val nowSec = System.currentTimeMillis() / 1000
        // Freshness window diperlonggar menjadi 45 menit (2700s) agar tidak langsung di-drop jika Android WorkManager delay beberapa menit saat Doze Mode
        if (nowSec - candleTime > 2700L) {
            android.util.Log.d("AmyFX-DriverWorker", "Candle is stale (${nowSec - candleTime}s old), assistant alerts suppressed.")
            return
        }

        val dashboard = amy.optJSONObject("dashboard")
        val entry = amy.optJSONObject("entry")
        val news = contextObj.optJSONObject("news")
        val trigger = amy.optJSONObject("trigger")
        val candle = trigger?.optJSONObject("candle") ?: dashboard?.optJSONObject("candle") ?: amy.optJSONObject("candle")
        val currentPrice = contextObj.optDouble("price", 0.0).takeIf { it > 0.0 }
            ?: (candle?.optDouble("close", 0.0) ?: 0.0)
        val cHigh = candle?.optDouble("high", 0.0) ?: 0.0
        val cLow = candle?.optDouble("low", 0.0) ?: 0.0
        val curPriceStr = if (currentPrice > 0.0) String.format(java.util.Locale.US, "$%.2f", currentPrice) else ""

        val event = payload?.optJSONObject("event") ?: contextObj.optJSONObject("event")
        val assistant = amy.optJSONObject("assistant")
        val plan = amy.optJSONObject("plan") ?: assistant?.optJSONObject("plan") ?: contextObj.optJSONObject("plan")
        val execution = contextObj.optJSONObject("execution")
        val isAPlus = execution?.optBoolean("aPlusReady", false) == true ||
            event?.optString("key", "")?.contains("A_PLUS_READY") == true

        val entryText = entry?.optString("text").orEmpty()
        val lines = entryText.split("\n")
            .map { it.trim() }
            .filter { it.isNotBlank() }

        var notify = false
        var badge = ""
        var notifTitle = ""
        var notifBody = ""

        val newsStatus = news?.optString("status").orEmpty()
        val invalidStatus = dashboard?.optInt("invalidStatus", 0) ?: 0
        val rejectBuy = entry?.optBoolean("rejectBuy", false) ?: false
        val rejectSell = entry?.optBoolean("rejectSell", false) ?: false
        val importance = entry?.optInt("importance", 0) ?: 0
        val inPoi = entry?.optBoolean("inPoi", false) ?: false
        val dolStatus = dashboard?.optInt("dolStatus", 0) ?: 0
        val biasDir = dashboard?.optInt("biasDir", 0) ?: 0

        val poi = dashboard?.optJSONObject("poi")
        val poiKind = poi?.optString("kind", "POI")?.ifBlank { "POI" } ?: "POI"
        val poiSide = poi?.optString("side", "").orEmpty()

        val sweepDetails = resolveSweepDetails(amy, contextObj, lines)

        val m15Obj = contextObj.optJSONObject("m15")
        val m15Break = m15Obj?.optJSONObject("lastBreak")
        val lastBreakSec = m15Break?.optLong("time", 0L) ?: 0L
        val isBreakFresh = lastBreakSec <= 0L || (nowSec - lastBreakSec in 0L..900L)

        val formedAtStr = plan?.optString("formedAt", "").orEmpty()
        val planFormedSec = try {
            if (formedAtStr.isNotBlank()) java.time.Instant.parse(formedAtStr).epochSecond else 0L
        } catch (_: Exception) { 0L }
        val isPlanFresh = planFormedSec <= 0L || (nowSec - planFormedSec in 0L..900L)

        if (newsStatus == "NEWS_LOCK") {
            badge = "NEWS_LOCK"
            notifTitle = "🛡️ Asisten Amy: NEWS LOCK Aktif"
            notifBody = news?.optString("note", "Pasar sangat liar dan rawan slippage. Jangan entry sebelum volatilitas stabil.").orEmpty()
            notify = true
        } else if (isAPlus && isPlanFresh) {
            badge = "PELURU_UTAMA_A_PLUS"
            val sideStr = if (biasDir == 1) "BUY" else if (biasDir == -1) "SELL" else "ENTRY"
            val score = entry?.optInt("score", 85) ?: 85
            val grade = entry?.optString("grade", "STRONG").orEmpty()
            notifTitle = "👑 Asisten Amy: Peluru Utama Grade A+ Siap!"
            val low = poi?.optDouble("low", 0.0) ?: 0.0
            val high = poi?.optDouble("high", 0.0) ?: 0.0
            val areaStr = if (high > 0.0 && low > 0.0) String.format(java.util.Locale.US, "$%.2f – $%.2f", low, high) else "Zona M15"
            val dolTgt = dashboard?.optDouble("dolTarget", 0.0) ?: 0.0
            val dolStr = if (dolTgt > 0.0) String.format(java.util.Locale.US, " · DOL $%.2f", dolTgt) else ""
            notifBody = "👑 Grade A+ $sideStr Confluence $score/100 ($grade). Area $areaStr$dolStr. Target 100 Pips!"
            notify = true
        } else if ((assistant?.optString("status") == "READY" || execution?.optBoolean("entryReady", false) == true || event?.optString("key", "")?.contains("ENTRY_SIGNAL") == true) && plan != null && isPlanFresh) {
            val sigType = assistant?.optInt("signalType", 0) ?: 0
            val sigName = assistant?.optString("signalName", "ENTRY SIGNAL").orEmpty().ifBlank { "ENTRY SIGNAL" }
            val isBuy = sigType == 1 || sigType == 2 || (plan.optString("direction").equals("BUY", ignoreCase = true))
            val entryPrice = plan.optDouble("entry", 0.0)
            val slPrice = plan.optDouble("sl", 0.0).takeIf { it > 0.0 } ?: plan.optDouble("stopLoss", 0.0)
            val tp1Price = plan.optDouble("tp1", 0.0).takeIf { it > 0.0 } ?: plan.optDouble("target1", 0.0)
            val mathZone = assistant?.optString("mathZone", "").orEmpty()
            val zoneStr = if (mathZone.isNotBlank()) " · Zona $mathZone" else ""
            if (entryPrice > 0.0 && slPrice > 0.0 && tp1Price > 0.0) {
                // Anti-stale entry guard: cek jarak harga running saat ini ke level entry
                val priceDrift = if (currentPrice > 0.0) Math.abs(currentPrice - entryPrice) else 0.0
                if (priceDrift > 6.0) { // Lebih dari $6 (60 pips) -> harga sudah lari jauh, jangan broadcast sebagai entry ready!
                    android.util.Log.d("AmyFX-DriverWorker", "Entry price drifted ($priceDrift points away from current $currentPrice), skipping stale execution alert.")
                    return
                }

                badge = if (isBuy) "ENTRY_BUY_READY" else "ENTRY_SELL_READY"
                val icon = if (isBuy) "🟢" else "🔴"
                notifTitle = "$icon Asisten Amy: $sigName"
                val spreadNote = if (!isBuy) " (TP Ask +5 Pips)" else ""
                notifBody = String.format(
                    java.util.Locale.US,
                    "%s Entry: $%.2f | SL: $%.2f | TP1: $%.2f%s (+100 Pips)%s. Siapkan eksekusi!",
                    icon, entryPrice, slPrice, tp1Price, spreadNote, zoneStr
                )
                notify = true
            }
        } else if (invalidStatus == 2 && isBreakFresh) {
            badge = "SETUP_BATAL"
            notifTitle = "⚠️ Asisten Amy: Setup Batal (Invalid)"
            val invalidLevel = dashboard?.optDouble("invalidLevel", 0.0) ?: 0.0
            val levelStr = if (invalidLevel > 0.0) String.format(java.util.Locale.US, " $%.2f", invalidLevel) else ""
            notifBody = "Close M15 menembus batas pembatalan$levelStr. Jangan paksakan entry, tunggu struktur dealing range baru."
            notify = true
        } else if (rejectBuy || rejectSell) {
            val isBuy = rejectBuy
            badge = if (isBuy) "REJECTION_BUY" else "REJECTION_SELL"
            val badgeLabel = if (isBuy) "REJECTION BUY" else "REJECTION SELL"
            val low = poi?.optDouble("low", 0.0) ?: 0.0
            val high = poi?.optDouble("high", 0.0) ?: 0.0
            val poiRange = if (high > 0.0 && low > 0.0) String.format(java.util.Locale.US, " ($%.2f – $%.2f)", low, high) else ""
            val wickVal = if (isBuy) cLow else cHigh
            val wickStr = if (wickVal > 0.0) String.format(java.util.Locale.US, " @ $%.2f", wickVal) else ""
            notifTitle = "🔥 Asisten Amy: $badgeLabel"
            val primary = "🔥 Rejection Kuat di Area $poiKind$poiRange"
            val sub = "Candle menolak ${if (isBuy) "bawah" else "atas"} dengan wick panjang$wickStr. Konfirmasi ${if (isBuy) "BUY" else "SELL"} (Target 100 Pips)."
            notifBody = "$primary. $sub"
            notify = true
        } else if ((importance == 4 || (importance == 5 && lines.any { it.contains("break", ignoreCase = true) || it.contains("displacement", ignoreCase = true) })) && isBreakFresh) {
            val isBull = biasDir == 1
            val trgHigh = trigger?.optDouble("high", 0.0) ?: 0.0
            val trgLow = trigger?.optDouble("low", 0.0) ?: 0.0
            val m15Kind = m15Break?.optString("kind", "").orEmpty()
            val m15BreakLvl = m15Break?.optDouble("level", 0.0) ?: 0.0

            val brokenLevel = if (isBull) {
                if (trgHigh > 0.0) trgHigh else if (m15BreakLvl > 0.0) m15BreakLvl else (dashboard?.optDouble("protectedHigh", 0.0) ?: 0.0)
            } else {
                if (trgLow > 0.0) trgLow else if (m15BreakLvl > 0.0) m15BreakLvl else (dashboard?.optDouble("protectedLow", 0.0) ?: 0.0)
            }
            val brokenLevelStr = if (brokenLevel > 0.0) String.format(java.util.Locale.US, "$%.2f", brokenLevel) else "Struktur"
            val breakKind = if (m15Kind.isNotBlank()) m15Kind else if (isBull) "BOS Bullish" else "BOS Bearish"
            val dolTgt = dashboard?.optDouble("dolTarget", 0.0) ?: 0.0
            val dolStr = if (dolTgt > 0.0) String.format(java.util.Locale.US, " · Target DOL: $%.2f", dolTgt) else ""

            badge = if (isBull) "VALID_BREAK_UP" else "VALID_BREAK_DOWN"
            val badgeLabel = if (isBull) "VALID BREAK BULLISH ($breakKind)" else "VALID BREAK BEARISH ($breakKind)"
            notifTitle = "✓ Asisten Amy: $badgeLabel"
            val primary = "✓ Valid Break ${if (isBull) "Bullish" else "Bearish"} dengan Displacement: $breakKind @ $brokenLevelStr Ditembus!"
            val sub = "Struktur M5 terkonfirmasi searah tren$dolStr. Siapkan observasi entry."
            notifBody = "$primary $sub"
            notify = true
        } else if (sweepDetails != null) {
            val sweepAge = if (sweepDetails.sweepTime > 0L) (nowSec - sweepDetails.sweepTime) else 999999L
            val isFresh = sweepDetails.sweepTime > 0L && (sweepAge in 0L..900L)
            if (isFresh) {
                val levelStr = String.format(java.util.Locale.US, "%.2f", sweepDetails.level)
                val extremeStr = String.format(java.util.Locale.US, "%.2f", sweepDetails.extreme)
                val sweepPips = if (sweepDetails.extreme > 0.0 && sweepDetails.level > 0.0) Math.abs(sweepDetails.extreme - sweepDetails.level) * 10.0 else 0.0
                val pipsStr = if (sweepPips > 0.0) String.format(java.util.Locale.US, " (+%.1f Pips)", sweepPips) else ""
                val sweepBadge = sweepDetails.name.replace(" ", "_").uppercase(java.util.Locale.US)
                badge = "${sweepBadge}_SWEPT"
                notifTitle = "💧 Asisten Amy: ${sweepDetails.name} @ $levelStr Swept!$pipsStr"
                val primary = "💧 ${sweepDetails.name} @ $levelStr Swept!"
                val sub = "Tersapu hingga ekor $extremeStr$pipsStr. Pantau pembentukan rejection untuk potensi ${sweepDetails.side} (Target 100 Pips)."
                notifBody = "$primary $sub"
                notify = true
            }
        } else if (inPoi) {
            badge = "DI_AREA_POI"
            val low = poi?.optDouble("low", 0.0) ?: 0.0
            val high = poi?.optDouble("high", 0.0) ?: 0.0
            val rangeStr = if (high > 0.0 && low > 0.0) String.format(java.util.Locale.US, "(%.2f – %.2f)", high, low) else ""
            val curStr = if (curPriceStr.isNotBlank()) " @ $curPriceStr" else ""
            notifTitle = "📍 Asisten Amy: Area POI Tersentuh"
            val primary = "📍 ${if (poiSide.isNotBlank()) "$poiSide " else ""}$poiKind Tersentuh"
            val sub = "Harga berada di zona kritis$curStr. Pantau pembentukan candle rejection atau break M5 (Target 100 Pips)."
            notifBody = "$primary $rangeStr. $sub"
            notify = true
        } else if (dolStatus == 2) {
            val dolTarget = dashboard?.optDouble("dolTarget", 0.0) ?: 0.0
            val dolStr = if (dolTarget > 0.0) String.format(java.util.Locale.US, " ($%.2f)", dolTarget) else ""
            val curStr = if (curPriceStr.isNotBlank()) " @ $curPriceStr" else ""
            badge = "TARGET_DOL"
            notifTitle = "🎯 Asisten Amy: Target DOL Tercapai"
            notifBody = "🎯 Target Likuiditas (DOL)$dolStr Telah Tercapai$curStr. Hati-hati pembalikan arah, jangan kejar harga (Anti-Chase)."
            notify = true
        }

        if (!notify || notifTitle.isBlank() || notifBody.isBlank()) return

        val invLvl = dashboard?.optDouble("invalidLevel", 0.0) ?: 0.0
        val planEntry = plan?.optDouble("entry", 0.0) ?: 0.0
        val poiLow = poi?.optDouble("low", 0.0) ?: 0.0
        val dolTgt = dashboard?.optDouble("dolTarget", 0.0) ?: 0.0
        val eventIdentity = when {
            badge.endsWith("_SWEPT") && sweepDetails?.sweepTime != null && sweepDetails.sweepTime > 0L ->
                "${String.format(java.util.Locale.US, "%.2f", sweepDetails.level)}_${sweepDetails.sweepTime}"
            badge == "SETUP_BATAL" && invLvl > 0.0 ->
                "inv_${String.format(java.util.Locale.US, "%.2f", invLvl)}_${if (lastBreakSec > 0L) lastBreakSec else candleTime}"
            badge.startsWith("VALID_BREAK") ->
                "brk_${if (lastBreakSec > 0L) lastBreakSec else candleTime}"
            (badge.startsWith("ENTRY_") || badge == "PELURU_UTAMA_A_PLUS") && planEntry > 0.0 ->
                "plan_${String.format(java.util.Locale.US, "%.2f", planEntry)}_${if (planFormedSec > 0L) planFormedSec else candleTime}"
            badge == "DI_AREA_POI" && poiLow > 0.0 ->
                "poi_${String.format(java.util.Locale.US, "%.2f", poiLow)}"
            badge == "TARGET_DOL" && dolTgt > 0.0 ->
                "dol_${String.format(java.util.Locale.US, "%.2f", dolTgt)}"
            else -> "$candleTime"
        }
        val cacheKey = "assistant_${badge}_${eventIdentity}"
        val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.contains(cacheKey)) return

        showDriverNotification(notifTitle, notifBody, cacheKey)
        prefs.edit().putLong(cacheKey, System.currentTimeMillis()).apply()
    }

    private data class SweepDetails(
        val name: String,
        val level: Double,
        val extreme: Double,
        val side: String,
        val sweepTime: Long = 0L
    )

    private fun resolveSweepDetails(amy: JSONObject, contextObj: JSONObject, lines: List<String>): SweepDetails? {
        val dashboard = amy.optJSONObject("dashboard")
        val trigger = amy.optJSONObject("trigger")
        val levels = amy.optJSONObject("levels") ?: contextObj.optJSONObject("levels")
        val liquidity = contextObj.optJSONArray("liquidity")
        val candle = trigger?.optJSONObject("candle") ?: dashboard?.optJSONObject("candle") ?: amy.optJSONObject("candle")
        val cHigh = candle?.optDouble("high", 0.0) ?: 0.0
        val cLow = candle?.optDouble("low", 0.0) ?: 0.0
        val cClose = candle?.optDouble("close", 0.0) ?: 0.0
        val cTime = candle?.optLong("close_time", 0L)?.takeIf { it > 0L }
            ?: (candle?.optLong("open_time", 0L) ?: 0L)

        val currentPrice = contextObj.optDouble("price", 0.0).takeIf { it > 0.0 }
            ?: (candle?.optDouble("close", 0.0) ?: 0.0)
        val defaultLow = if (cLow > 0.0) cLow else currentPrice
        val defaultHigh = if (cHigh > 0.0) cHigh else currentPrice

        val sweepObj = dashboard?.optJSONObject("sweep")
        val dSweepPrice = sweepObj?.optDouble("price", 0.0) ?: 0.0
        val dSweepExtreme = sweepObj?.optDouble("extreme", 0.0) ?: 0.0
        val dSweepDir = sweepObj?.optInt("dir", 0) ?: (dashboard?.optInt("sweepDir", 0) ?: 0)
        val dSweepTime = sweepObj?.optLong("time", 0L) ?: 0L
        val sweepStatus = dashboard?.optInt("sweepStatus", 0) ?: 0

        val trgSweepDir = trigger?.optInt("sweepDir", 0) ?: 0
        val trgSweptPrice = trigger?.optDouble("sweptPrice", 0.0) ?: 0.0
        val trgSweepExtreme = trigger?.optDouble("sweepExtreme", 0.0) ?: 0.0
        val trgTime = trigger?.optLong("time", 0L) ?: 0L
        val activeSweepTime = when {
            sweepStatus == 1 && dSweepTime > 0L -> dSweepTime
            (trgSweepDir == 1 || trgSweepDir == -1) && trgTime > 0L -> trgTime
            else -> 0L
        }

        // 1. Asia High / Asia Low sweep
        val asiaHigh = levels?.optDouble("asiaHigh", 0.0) ?: 0.0
        val asiaLow = levels?.optDouble("asiaLow", 0.0) ?: 0.0
        var liqAsiaHighSweptLevel = 0.0
        var liqAsiaLowSweptLevel = 0.0
        var liqAsiaHighTime = 0L
        var liqAsiaLowTime = 0L

        if (liquidity != null) {
            for (i in 0 until liquidity.length()) {
                val item = liquidity.optJSONObject(i) ?: continue
                val label = item.optString("label", "")
                val status = item.optString("status", "")
                if (status.equals("SWEPT", ignoreCase = true)) {
                    if (label.contains("asia high", ignoreCase = true)) {
                        liqAsiaHighSweptLevel = item.optDouble("level", 0.0)
                        liqAsiaHighTime = item.optLong("sweptAt", 0L)
                    } else if (label.contains("asia low", ignoreCase = true)) {
                        liqAsiaLowSweptLevel = item.optDouble("level", 0.0)
                        liqAsiaLowTime = item.optLong("sweptAt", 0L)
                    }
                }
            }
        }

        val textAsiaHigh = lines.any { it.contains("asia high", ignoreCase = true) && it.contains("swept", ignoreCase = true) }
        val textAsiaLow = lines.any { it.contains("asia low", ignoreCase = true) && it.contains("swept", ignoreCase = true) }

        if (liqAsiaHighSweptLevel > 0.0 || textAsiaHigh || (asiaHigh > 0.0 && cHigh > asiaHigh && cClose < asiaHigh)) {
            val lvl = if (liqAsiaHighSweptLevel > 0.0) liqAsiaHighSweptLevel else if (asiaHigh > 0.0) asiaHigh else cHigh
            val ext = if (cHigh > lvl) cHigh else lvl + 1.20
            val isCurBar = asiaHigh > 0.0 && cHigh > asiaHigh && cClose < asiaHigh
            val t = if (activeSweepTime > 0L) activeSweepTime else if (isCurBar) cTime else liqAsiaHighTime
            return SweepDetails("Asia High", lvl, ext, "SELL", t)
        }
        if (liqAsiaLowSweptLevel > 0.0 || textAsiaLow || (asiaLow > 0.0 && cLow > 0.0 && cLow < asiaLow && cClose > asiaLow)) {
            val lvl = if (liqAsiaLowSweptLevel > 0.0) liqAsiaLowSweptLevel else if (asiaLow > 0.0) asiaLow else cLow
            val ext = if (cLow > 0.0 && cLow < lvl) cLow else lvl - 1.20
            val isCurBar = asiaLow > 0.0 && cLow > 0.0 && cLow < asiaLow && cClose > asiaLow
            val t = if (activeSweepTime > 0L) activeSweepTime else if (isCurBar) cTime else liqAsiaLowTime
            return SweepDetails("Asia Low", lvl, ext, "BUY", t)
        }

        // 2. PDH / PDL sweep
        val pdh = levels?.optDouble("pdh", 0.0) ?: 0.0
        val pdl = levels?.optDouble("pdl", 0.0) ?: 0.0
        var liqPdhSweptLevel = 0.0
        var liqPdlSweptLevel = 0.0
        var liqPdhTime = 0L
        var liqPdlTime = 0L

        if (liquidity != null) {
            for (i in 0 until liquidity.length()) {
                val item = liquidity.optJSONObject(i) ?: continue
                val label = item.optString("label", "")
                val status = item.optString("status", "")
                if (status.equals("SWEPT", ignoreCase = true)) {
                    if (label.contains("pdh", ignoreCase = true) || label.contains("previous day high", ignoreCase = true)) {
                        liqPdhSweptLevel = item.optDouble("level", 0.0)
                        liqPdhTime = item.optLong("sweptAt", 0L)
                    } else if (label.contains("pdl", ignoreCase = true) || label.contains("previous day low", ignoreCase = true)) {
                        liqPdlSweptLevel = item.optDouble("level", 0.0)
                        liqPdlTime = item.optLong("sweptAt", 0L)
                    }
                }
            }
        }

        val textPdh = lines.any { it.contains("pdh", ignoreCase = true) && it.contains("swept", ignoreCase = true) }
        val textPdl = lines.any { it.contains("pdl", ignoreCase = true) && it.contains("swept", ignoreCase = true) }

        if (liqPdhSweptLevel > 0.0 || textPdh || (pdh > 0.0 && cHigh > pdh && cClose < pdh)) {
            val lvl = if (liqPdhSweptLevel > 0.0) liqPdhSweptLevel else if (pdh > 0.0) pdh else cHigh
            val ext = if (cHigh > lvl) cHigh else lvl + 1.20
            val isCurBar = pdh > 0.0 && cHigh > pdh && cClose < pdh
            val t = if (activeSweepTime > 0L) activeSweepTime else if (isCurBar) cTime else liqPdhTime
            return SweepDetails("PDH", lvl, ext, "SELL", t)
        }
        if (liqPdlSweptLevel > 0.0 || textPdl || (pdl > 0.0 && cLow > 0.0 && cLow < pdl && cClose > pdl)) {
            val lvl = if (liqPdlSweptLevel > 0.0) liqPdlSweptLevel else if (pdl > 0.0) pdl else cLow
            val ext = if (cLow > 0.0 && cLow < lvl) cLow else lvl - 1.20
            val isCurBar = pdl > 0.0 && cLow > 0.0 && cLow < pdl && cClose > pdl
            val t = if (activeSweepTime > 0L) activeSweepTime else if (isCurBar) cTime else liqPdlTime
            return SweepDetails("PDL", lvl, ext, "BUY", t)
        }

        // 3. BSL / SSL sweep
        val bslLevel = dashboard?.optDouble("bsl", 0.0) ?: (levels?.optDouble("bsl", 0.0) ?: 0.0)
        val sslLevel = dashboard?.optDouble("ssl", 0.0) ?: (levels?.optDouble("ssl", 0.0) ?: 0.0)

        var liqBslSwept = false
        var liqSslSwept = false
        var liqBslTime = 0L
        var liqSslTime = 0L
        if (liquidity != null) {
            for (i in 0 until liquidity.length()) {
                val item = liquidity.optJSONObject(i) ?: continue
                val label = item.optString("label", "")
                val status = item.optString("status", "")
                if (status.equals("SWEPT", ignoreCase = true)) {
                    if (label.equals("BSL", ignoreCase = true)) {
                        liqBslSwept = true
                        liqBslTime = item.optLong("sweptAt", 0L)
                    }
                    if (label.equals("SSL", ignoreCase = true)) {
                        liqSslSwept = true
                        liqSslTime = item.optLong("sweptAt", 0L)
                    }
                }
            }
        }

        val hasSsl = (sweepStatus == 1 && dSweepDir == 1) ||
            (trgSweepDir == 1) ||
            lines.any { it.contains("ssl", ignoreCase = true) && it.contains("swept", ignoreCase = true) } ||
            liqSslSwept

        val hasBsl = (sweepStatus == 1 && dSweepDir == -1) ||
            (trgSweepDir == -1) ||
            lines.any { it.contains("bsl", ignoreCase = true) && it.contains("swept", ignoreCase = true) } ||
            liqBslSwept

        val sweepTimeSsl = if (dSweepDir == 1 && dSweepTime > 0L) dSweepTime else if (trgSweepDir == 1 && trgTime > 0L) trgTime else liqSslTime
        val sweepTimeBsl = if (dSweepDir == -1 && dSweepTime > 0L) dSweepTime else if (trgSweepDir == -1 && trgTime > 0L) trgTime else liqBslTime

        if (hasSsl) {
            val lvl = if (dSweepDir == 1 && dSweepPrice > 0.0) dSweepPrice else if (trgSweepDir == 1 && trgSweptPrice > 0.0) trgSweptPrice else if (sslLevel > 0.0) sslLevel else defaultLow
            val ext = if (dSweepDir == 1 && dSweepExtreme > 0.0) dSweepExtreme else if (trgSweepDir == 1 && trgSweepExtreme > 0.0) trgSweepExtreme else if (cLow > 0.0 && cLow < lvl) cLow else (if (lvl > 0.0) lvl - 1.70 else 0.0)
            return SweepDetails("SSL", lvl, ext, "BUY", sweepTimeSsl)
        }

        if (hasBsl) {
            val lvl = if (dSweepDir == -1 && dSweepPrice > 0.0) dSweepPrice else if (trgSweepDir == -1 && trgSweptPrice > 0.0) trgSweptPrice else if (bslLevel > 0.0) bslLevel else defaultHigh
            val ext = if (dSweepDir == -1 && dSweepExtreme > 0.0) dSweepExtreme else if (trgSweepDir == -1 && trgSweepExtreme > 0.0) trgSweepExtreme else if (cHigh > lvl) cHigh else (if (lvl > 0.0) lvl + 1.70 else 0.0)
            return SweepDetails("BSL", lvl, ext, "SELL", sweepTimeBsl)
        }

        // 4. Any line containing "swept"
        if (lines.any { it.contains("swept", ignoreCase = true) }) {
            val isSsl = lines.any { it.contains("ssl", ignoreCase = true) }
            val name = if (isSsl) "SSL" else "BSL"
            val lvl = if (isSsl) (if (sslLevel > 0.0) sslLevel else defaultLow) else (if (bslLevel > 0.0) bslLevel else defaultHigh)
            val ext = if (isSsl) (if (cLow > 0.0 && cLow < lvl) cLow else (if (lvl > 0.0) lvl - 1.70 else 0.0)) else (if (cHigh > lvl) cHigh else (if (lvl > 0.0) lvl + 1.70 else 0.0))
            val t = if (isSsl) sweepTimeSsl else sweepTimeBsl
            return SweepDetails(name, lvl, ext, if (isSsl) "BUY" else "SELL", t)
        }

        return null
    }

    private fun showDriverNotification(title: String, body: String, targetId: String) {
        if (!canPostNotifications()) return

        val gateKey = "driver_worker|$targetId|$title"
        if (!AmyFxNotificationGate.shouldNotify(applicationContext, gateKey, System.currentTimeMillis())) {
            return
        }
        AmyFxNotificationGate.markNotified(applicationContext, "global|$title|$body", System.currentTimeMillis())

        createMarketContextChannel()
        val targetUrl = "https://appassets.androidplatform.net/assets/apps/mapping/index.html#Dashboard"
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", targetUrl)
            putExtra("amyfx_route", "Mapping")
        }
        val requestCode = (targetId + title).hashCode()
        val pendingIntent = PendingIntent.getActivity(
            applicationContext,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val isAPlus = title.contains("A+", ignoreCase = true) ||
            body.contains("Grade A+", ignoreCase = true) ||
            body.contains("A+ Setup", ignoreCase = true) ||
            title.contains("Peluru Utama", ignoreCase = true) ||
            title.contains("ENTRY", ignoreCase = true)
        val channelId = if (isAPlus) AmyFxApplication.GOLD_SIGNAL_CHANNEL_ID else AmyFxApplication.MARKET_CONTEXT_CHANNEL_ID

        val notification = NotificationCompat.Builder(applicationContext, channelId)
            .setSmallIcon(R.drawable.ic_stat_amy_fx)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(AmyFxNotificationGate.stableId(gateKey, requestCode), notification)
    }

    private fun createMarketContextChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            AmyFxApplication.MARKET_CONTEXT_CHANNEL_ID,
            "Amy FX Market Context",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Perubahan struktur, area penting, dan setup driver Gold XAU/USD"
            enableVibration(true)
            enableLights(true)
            lightColor = Color.rgb(212, 175, 55)
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)

        try {
            val goldAudioAttributes = android.media.AudioAttributes.Builder()
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val goldSoundUri = android.net.Uri.parse("android.resource://${applicationContext.packageName}/${R.raw.amy_gold_chime}")
            val goldChannel = NotificationChannel(
                AmyFxApplication.GOLD_SIGNAL_CHANNEL_ID,
                "Amy FX Sinyal Emas A+",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi khusus sinyal Grade A+ dengan denting bel emas kristal"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 80, 50, 80, 50, 120)
                enableLights(true)
                lightColor = Color.rgb(255, 215, 0)
                setShowBadge(true)
                setSound(goldSoundUri, goldAudioAttributes)
            }
            manager.createNotificationChannel(goldChannel)
        } catch (_: Exception) {}
    }

    private fun canPostNotifications(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    companion object {
        const val UNIQUE_WORK_NAME = "amy_fx_driver_setup_sync"
        const val NEXT_CANDLE_WORK_NAME = "amy_fx_driver_next_candle"
        private const val SETUPS_URL = "https://amy-fx.vercel.app/api/scalper-setups?limit=10"
        private const val PREFS = "amy_driver_worker_prefs"

        /**
         * Menjadwalkan sinkronisasi persis 15 detik setelah setiap candle M15 selesai (:00, :15, :30, :45).
         * Mencegah keterlambatan 15-45 menit yang biasa disebabkan oleh interval PeriodicWork / Doze mode Android.
         */
        fun scheduleNextCandleSync(context: Context) {
            val nowMs = System.currentTimeMillis()
            val nowSec = nowMs / 1000
            // Boundary M15 terdekat (:00, :15, :30, :45) + 15 detik untuk memastikan feed Twelve Data sudah update
            val nextM15Sec = ((nowSec / 900) + 1) * 900 + 15
            val delayMs = Math.max(10_000L, (nextM15Sec * 1000) - nowMs)

            val request = OneTimeWorkRequestBuilder<DriverSetupSyncWorker>()
                .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                NEXT_CANDLE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
            android.util.Log.d("AmyFX-DriverWorker", "Scheduled next candle sync in ${delayMs / 1000}s (at epoch $nextM15Sec)")
        }
    }
}
