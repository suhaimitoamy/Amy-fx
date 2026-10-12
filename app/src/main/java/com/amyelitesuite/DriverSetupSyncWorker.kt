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
                    processAssistantAlerts(contextObj)
                }

                Result.success()
            }
        } catch (error: Exception) {
            android.util.Log.w("AmyFX-DriverWorker", "Driver setup sync failed", error)
            Result.retry()
        }
    }

    private fun processActiveSetups(active: org.json.JSONArray, contextObj: JSONObject?) {
        val session = contextObj?.optString("session", "").orEmpty().trim()
        if (session.equals("PASAR TUTUP", ignoreCase = true) || !AmyFxNotificationGate.isGoldMarketOpen(System.currentTimeMillis())) {
            android.util.Log.d("AmyFX-DriverWorker", "Market closed (session=$session), driver setups notification suppressed.")
            return
        }
        val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        for (i in 0 until active.length()) {
            val item = active.optJSONObject(i) ?: continue
            val id = item.optString("id").trim()
            if (id.isBlank()) continue

            val status = item.optString("status", "WAITING_TRIGGER")
            val cacheKey = "notified_${id}_${status}"
            if (prefs.contains(cacheKey)) continue

            val driverName = item.optString("driverName").ifBlank {
                item.optString("model", "Gold Driver")
            }
            val direction = item.optString("direction", "SELL")
            val entry = item.optDouble("entry", 0.0)
            val sl = item.optDouble("stopLoss", 0.0)
            val tp = item.optDouble("target", 0.0)

            val statusLabel = when (status) {
                "WAITING_TRIGGER" -> "Rencana Limit"
                "WAITING_NEXT_OPEN" -> "Menunggu Open"
                "ARMED" -> "Menunggu Retest"
                "CONFIRMED" -> "Terkonfirmasi"
                "ACTIVE" -> "Aktif"
                else -> status
            }

            val title = "⚡ Setup Driver: $driverName ($direction)"
            val body = if (entry > 0) {
                String.format("%s · Entry %.2f · SL %.2f · TP %.2f", statusLabel, entry, sl, tp)
            } else {
                "$statusLabel · Periksa chart untuk level acuan."
            }

            showDriverNotification(title, body, id)
            prefs.edit().putLong(cacheKey, System.currentTimeMillis()).apply()
        }
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

    private fun processAssistantAlerts(contextObj: JSONObject) {
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
        if (nowSec - candleTime > 3600L) {
            android.util.Log.d("AmyFX-DriverWorker", "Candle is stale (${nowSec - candleTime}s old), assistant alerts suppressed.")
            return
        }

        val dashboard = amy.optJSONObject("dashboard")
        val entry = amy.optJSONObject("entry")
        val news = contextObj.optJSONObject("news")

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

        if (newsStatus == "NEWS_LOCK") {
            badge = "NEWS_LOCK"
            notifTitle = "🛡️ Asisten Amy: NEWS LOCK Aktif"
            notifBody = news?.optString("note", "Pasar sangat liar dan rawan slippage. Jangan entry sebelum volatilitas stabil.").orEmpty()
            notify = true
        } else if (invalidStatus == 2) {
            badge = "SETUP_BATAL"
            notifTitle = "⚠ Asisten Amy: Setup Batal (Invalid)"
            val invalidLevel = dashboard?.optDouble("invalidLevel", 0.0) ?: 0.0
            val levelStr = if (invalidLevel > 0.0) String.format(java.util.Locale.US, "%.2f", invalidLevel) else ""
            notifBody = "Close M15 menembus batas pembatalan $levelStr. Tunggu pembentukan struktur baru."
            notify = true
        } else if (rejectBuy || rejectSell) {
            val isBuy = rejectBuy
            badge = if (isBuy) "REJECTION_BUY" else "REJECTION_SELL"
            val badgeLabel = if (isBuy) "REJECTION BUY" else "REJECTION SELL"
            notifTitle = "🔥 Asisten Amy: $badgeLabel"
            val primary = "🔥 Rejection Kuat di Area $poiKind"
            val sub = "Candle menolak ${if (isBuy) "bawah" else "atas"} dengan wick panjang. Konfirmasi ${if (isBuy) "BUY" else "SELL"}."
            notifBody = "$primary. $sub"
            notify = true
        } else if (importance == 4) {
            val isBull = biasDir == 1
            badge = if (isBull) "VALID_BREAK_UP" else "VALID_BREAK_DOWN"
            val badgeLabel = if (isBull) "VALID BREAK UP" else "VALID BREAK DOWN"
            notifTitle = "✓ Asisten Amy: $badgeLabel"
            val primary = "✓ Valid Break ${if (isBull) "Bullish" else "Bearish"} dengan Displacement"
            val sub = "Struktur M5 terkonfirmasi searah tren. Siapkan observasi entry."
            notifBody = "$primary. $sub"
            notify = true
        } else if (sweepDetails != null) {
            val levelStr = String.format(java.util.Locale.US, "%.2f", sweepDetails.level)
            val extremeStr = String.format(java.util.Locale.US, "%.2f", sweepDetails.extreme)
            val sweepBadge = sweepDetails.name.replace(" ", "_").uppercase(java.util.Locale.US)
            badge = "${sweepBadge}_SWEPT"
            notifTitle = "💧 Asisten Amy: ${sweepDetails.name} @ $levelStr Swept!"
            val primary = "💧 ${sweepDetails.name} @ $levelStr Swept!"
            val sub = "Tersapu hingga ekor $extremeStr. Pantau pembentukan rejection untuk potensi ${sweepDetails.side}."
            notifBody = "$primary $sub"
            notify = true
        } else if (inPoi) {
            badge = "DI_AREA_POI"
            notifTitle = "📍 Asisten Amy: Area POI Tersentuh"
            val primary = "📍 ${if (poiSide.isNotBlank()) "$poiSide " else ""}$poiKind Tersentuh"
            val low = poi?.optDouble("low", 0.0) ?: 0.0
            val high = poi?.optDouble("high", 0.0) ?: 0.0
            val rangeStr = if (high > 0.0 && low > 0.0) String.format(java.util.Locale.US, "(%.2f – %.2f)", high, low) else ""
            val sub = "Harga berada di zona kritis. Pantau pembentukan candle rejection atau break M5."
            notifBody = "$primary $rangeStr. $sub"
            notify = true
        } else if (dolStatus == 2) {
            badge = "TARGET_DOL"
            notifTitle = "🎯 Asisten Amy: Target DOL Tercapai"
            notifBody = "🎯 Target Likuiditas (DOL) Telah Tercapai. Hati-hati pembalikan arah, jangan kejar harga."
            notify = true
        }

        if (!notify || notifTitle.isBlank() || notifBody.isBlank()) return

        val cacheKey = "assistant_${badge}_${candleTime}"
        val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.contains(cacheKey)) return

        showDriverNotification(notifTitle, notifBody, cacheKey)
        prefs.edit().putLong(cacheKey, System.currentTimeMillis()).apply()
    }

    private data class SweepDetails(
        val name: String,
        val level: Double,
        val extreme: Double,
        val side: String
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

        // 1. Asia High / Asia Low sweep
        val asiaHigh = levels?.optDouble("asiaHigh", 0.0) ?: 0.0
        val asiaLow = levels?.optDouble("asiaLow", 0.0) ?: 0.0
        var liqAsiaHighSweptLevel = 0.0
        var liqAsiaLowSweptLevel = 0.0

        if (liquidity != null) {
            for (i in 0 until liquidity.length()) {
                val item = liquidity.optJSONObject(i) ?: continue
                val label = item.optString("label", "")
                val status = item.optString("status", "")
                if (status.equals("SWEPT", ignoreCase = true)) {
                    if (label.contains("asia high", ignoreCase = true)) {
                        liqAsiaHighSweptLevel = item.optDouble("level", 0.0)
                    } else if (label.contains("asia low", ignoreCase = true)) {
                        liqAsiaLowSweptLevel = item.optDouble("level", 0.0)
                    }
                }
            }
        }

        val textAsiaHigh = lines.any { it.contains("asia high", ignoreCase = true) && it.contains("swept", ignoreCase = true) }
        val textAsiaLow = lines.any { it.contains("asia low", ignoreCase = true) && it.contains("swept", ignoreCase = true) }

        if (liqAsiaHighSweptLevel > 0.0 || textAsiaHigh || (asiaHigh > 0.0 && cHigh > asiaHigh && cClose < asiaHigh)) {
            val lvl = if (liqAsiaHighSweptLevel > 0.0) liqAsiaHighSweptLevel else if (asiaHigh > 0.0) asiaHigh else cHigh
            val ext = if (cHigh > lvl) cHigh else lvl + 1.20
            return SweepDetails("Asia High", lvl, ext, "SELL")
        }
        if (liqAsiaLowSweptLevel > 0.0 || textAsiaLow || (asiaLow > 0.0 && cLow > 0.0 && cLow < asiaLow && cClose > asiaLow)) {
            val lvl = if (liqAsiaLowSweptLevel > 0.0) liqAsiaLowSweptLevel else if (asiaLow > 0.0) asiaLow else cLow
            val ext = if (cLow > 0.0 && cLow < lvl) cLow else lvl - 1.20
            return SweepDetails("Asia Low", lvl, ext, "BUY")
        }

        // 2. PDH / PDL sweep
        val pdh = levels?.optDouble("pdh", 0.0) ?: 0.0
        val pdl = levels?.optDouble("pdl", 0.0) ?: 0.0
        var liqPdhSweptLevel = 0.0
        var liqPdlSweptLevel = 0.0

        if (liquidity != null) {
            for (i in 0 until liquidity.length()) {
                val item = liquidity.optJSONObject(i) ?: continue
                val label = item.optString("label", "")
                val status = item.optString("status", "")
                if (status.equals("SWEPT", ignoreCase = true)) {
                    if (label.contains("pdh", ignoreCase = true) || label.contains("previous day high", ignoreCase = true)) {
                        liqPdhSweptLevel = item.optDouble("level", 0.0)
                    } else if (label.contains("pdl", ignoreCase = true) || label.contains("previous day low", ignoreCase = true)) {
                        liqPdlSweptLevel = item.optDouble("level", 0.0)
                    }
                }
            }
        }

        val textPdh = lines.any { it.contains("pdh", ignoreCase = true) && it.contains("swept", ignoreCase = true) }
        val textPdl = lines.any { it.contains("pdl", ignoreCase = true) && it.contains("swept", ignoreCase = true) }

        if (liqPdhSweptLevel > 0.0 || textPdh || (pdh > 0.0 && cHigh > pdh && cClose < pdh)) {
            val lvl = if (liqPdhSweptLevel > 0.0) liqPdhSweptLevel else if (pdh > 0.0) pdh else cHigh
            val ext = if (cHigh > lvl) cHigh else lvl + 1.20
            return SweepDetails("PDH", lvl, ext, "SELL")
        }
        if (liqPdlSweptLevel > 0.0 || textPdl || (pdl > 0.0 && cLow > 0.0 && cLow < pdl && cClose > pdl)) {
            val lvl = if (liqPdlSweptLevel > 0.0) liqPdlSweptLevel else if (pdl > 0.0) pdl else cLow
            val ext = if (cLow > 0.0 && cLow < lvl) cLow else lvl - 1.20
            return SweepDetails("PDL", lvl, ext, "BUY")
        }

        // 3. BSL / SSL sweep
        val sweepObj = dashboard?.optJSONObject("sweep")
        val dSweepPrice = sweepObj?.optDouble("price", 0.0) ?: 0.0
        val dSweepExtreme = sweepObj?.optDouble("extreme", 0.0) ?: 0.0
        val dSweepDir = sweepObj?.optInt("dir", 0) ?: (dashboard?.optInt("sweepDir", 0) ?: 0)
        val sweepStatus = dashboard?.optInt("sweepStatus", 0) ?: 0

        val trgSweepDir = trigger?.optInt("sweepDir", 0) ?: 0
        val trgSweptPrice = trigger?.optDouble("sweptPrice", 0.0) ?: 0.0
        val trgSweepExtreme = trigger?.optDouble("sweepExtreme", 0.0) ?: 0.0

        val bslLevel = dashboard?.optDouble("bsl", 0.0) ?: (levels?.optDouble("bsl", 0.0) ?: 0.0)
        val sslLevel = dashboard?.optDouble("ssl", 0.0) ?: (levels?.optDouble("ssl", 0.0) ?: 0.0)

        var liqBslSwept = false
        var liqSslSwept = false
        if (liquidity != null) {
            for (i in 0 until liquidity.length()) {
                val item = liquidity.optJSONObject(i) ?: continue
                val label = item.optString("label", "")
                val status = item.optString("status", "")
                if (status.equals("SWEPT", ignoreCase = true)) {
                    if (label.equals("BSL", ignoreCase = true)) liqBslSwept = true
                    if (label.equals("SSL", ignoreCase = true)) liqSslSwept = true
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

        if (hasSsl) {
            val lvl = if (dSweepDir == 1 && dSweepPrice > 0.0) dSweepPrice else if (trgSweepDir == 1 && trgSweptPrice > 0.0) trgSweptPrice else if (sslLevel > 0.0) sslLevel else if (cLow > 0.0) cLow else 2642.50
            val ext = if (dSweepDir == 1 && dSweepExtreme > 0.0) dSweepExtreme else if (trgSweepDir == 1 && trgSweepExtreme > 0.0) trgSweepExtreme else if (cLow > 0.0 && cLow < lvl) cLow else lvl - 1.70
            return SweepDetails("SSL", lvl, ext, "BUY")
        }

        if (hasBsl) {
            val lvl = if (dSweepDir == -1 && dSweepPrice > 0.0) dSweepPrice else if (trgSweepDir == -1 && trgSweptPrice > 0.0) trgSweptPrice else if (bslLevel > 0.0) bslLevel else if (cHigh > 0.0) cHigh else 2665.30
            val ext = if (dSweepDir == -1 && dSweepExtreme > 0.0) dSweepExtreme else if (trgSweepDir == -1 && trgSweepExtreme > 0.0) trgSweepExtreme else if (cHigh > lvl) cHigh else lvl + 1.70
            return SweepDetails("BSL", lvl, ext, "SELL")
        }

        // 4. Any line containing "swept"
        if (lines.any { it.contains("swept", ignoreCase = true) }) {
            val isSsl = lines.any { it.contains("ssl", ignoreCase = true) }
            val name = if (isSsl) "SSL" else "BSL"
            val lvl = if (isSsl) (if (sslLevel > 0.0) sslLevel else if (cLow > 0.0) cLow else 2642.50) else (if (bslLevel > 0.0) bslLevel else if (cHigh > 0.0) cHigh else 2665.30)
            val ext = if (isSsl) (if (cLow > 0.0 && cLow < lvl) cLow else lvl - 1.70) else (if (cHigh > lvl) cHigh else lvl + 1.70)
            return SweepDetails(name, lvl, ext, if (isSsl) "BUY" else "SELL")
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

        val notification = NotificationCompat.Builder(applicationContext, AmyFxApplication.MARKET_CONTEXT_CHANNEL_ID)
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
    }

    private fun canPostNotifications(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    companion object {
        const val UNIQUE_WORK_NAME = "amy_fx_driver_setup_sync"
        private const val SETUPS_URL = "https://amy-fx.vercel.app/api/scalper-setups?limit=10"
        private const val PREFS = "amy_driver_worker_prefs"
    }
}
