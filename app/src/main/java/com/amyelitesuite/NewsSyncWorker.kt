package com.amyelitesuite

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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

class NewsSyncWorker(
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
                .url(NEWS_URL)
                .header("Accept", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext Result.retry()

                val payload = JSONObject(response.body?.string().orEmpty())
                val items = payload.optJSONArray("news") ?: return@withContext Result.success()
                if (items.length() == 0) return@withContext Result.success()

                var latestRelevant: JSONObject? = null
                var latestRelevantId = Long.MIN_VALUE
                var highestId = Long.MIN_VALUE

                for (index in 0 until items.length()) {
                    val item = items.optJSONObject(index) ?: continue
                    val numericId = item.optString("id").toLongOrNull() ?: 0L
                    if (numericId > highestId) highestId = numericId
                    if (isNewsRelevant(item)) {
                        if (latestRelevant == null || numericId > latestRelevantId) {
                            latestRelevant = item
                            latestRelevantId = numericId
                        }
                    }
                }

                val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val storedIdStr = prefs.getString(KEY_LAST_NEWS_ID, null)

                if (storedIdStr == null) {
                    val seedId = if (highestId > 0) highestId.toString() else "0"
                    prefs.edit().putString(KEY_LAST_NEWS_ID, seedId).apply()
                    return@withContext Result.success()
                }

                val storedId = storedIdStr.toLongOrNull() ?: 0L

                if (latestRelevant != null && latestRelevantId > storedId) {
                    val body = latestRelevant.optString("text").ifBlank {
                        latestRelevant.optString("textOriginal", "Berita baru XAU/USD tersedia.")
                    }.take(MAX_NEWS_BODY)
                    val impact = latestRelevant.optString("impact")
                    val title = if (impact.equals("high", ignoreCase = true)) {
                        "🚨 Breaking News Penting XAU/USD"
                    } else {
                        "📰 Breaking News XAU/USD"
                    }
                    showNewsNotification(title, body, latestRelevantId.toString())
                }

                if (highestId > storedId) {
                    prefs.edit().putString(KEY_LAST_NEWS_ID, highestId.toString()).apply()
                }
                Result.success()
            }
        } catch (error: Exception) {
            android.util.Log.w("AmyFX-NewsWorker", "News fallback check failed", error)
            Result.retry()
        }
    }

    private fun isNewsRelevant(item: JSONObject): Boolean {
        if (item.optBoolean("relevant", false)) return true
        val text = (item.optString("text") + " " + item.optString("textOriginal")).lowercase()
        val goldKeywords = listOf(
            "gold", "xau", "emas", "bullion", "fed", "fomc", "powell",
            "inflation", "cpi", "pce", "treasury", "yield", "dxy", "dollar",
            "dolar", "nfp", "payroll", "jobless", "claims", "war", "perang",
            "geopolit", "safe haven", "central bank", "bank sentral",
            "suku bunga", "rate cut", "rate hike", "iran", "israel", "middle east",
            "timur tengah", "oil", "minyak", "houthi", "russia", "rusia", "ukraine", "ukraina"
        )
        return goldKeywords.any { text.contains(it) }
    }

    private fun showNewsNotification(title: String, body: String, newsId: String) {
        if (!canPostNotifications()) return

        val gateKey = AmyFxNotificationGate.newsContentKey(body)
        if (!AmyFxNotificationGate.shouldNotify(applicationContext, gateKey, System.currentTimeMillis())) {
            return
        }

        createNewsChannel()
        val targetUrl =
            "https://appassets.androidplatform.net/assets/apps/market-intel/index.html#news=${Uri.encode(newsId)}"
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", targetUrl)
            putExtra("amyfx_route", "MarketIntel")
        }
        val requestCode = newsId.hashCode()
        val pendingIntent = PendingIntent.getActivity(
            applicationContext,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(applicationContext, AmyFxApplication.NEWS_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_amy_fx)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(AmyFxNotificationGate.stableId(gateKey, requestCode), notification)
    }

    private fun createNewsChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            AmyFxApplication.NEWS_CHANNEL_ID,
            "Amy FX Breaking News",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Breaking news XAU/USD yang tetap muncul saat Amy FX ditutup"
            enableVibration(true)
            enableLights(true)
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
        const val UNIQUE_WORK_NAME = "amy_fx_news_fallback"

        private const val NEWS_URL = "https://amy-fx.vercel.app/api/news"
        private const val PREFS = "amy_news_worker"
        private const val KEY_LAST_NEWS_ID = "last_news_id"
        private const val MAX_NEWS_BODY = 900
    }
}
