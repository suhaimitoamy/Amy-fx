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
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class AmyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        FcmDeviceRegistrar.register(this, token, force = true)
    }

    override fun onDeletedMessages() {
        super.onDeletedMessages()
        FcmDeviceRegistrar.registerCurrentToken(this, force = true)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        when (message.data["notification_type"]?.lowercase()) {
            "market_context" -> handleMarketContext(message)
            "scalper" -> return // The retired setup channel must never surface as a new idea.
            else -> handleNewsMessage(message)
        }
    }

    private fun handleMarketContext(message: RemoteMessage) {
        val data = message.data
        val eventKey = data["event_key"].orEmpty()
        if (eventKey.isBlank()) return
        val title = data["title"].orEmpty().ifBlank { "Konteks Gold · Amy FX Pro" }
        val body = data["body"].orEmpty().ifBlank { "Kondisi pasar Gold berubah. Buka Mapping untuk melihat konfirmasi M5 dan strukturnya." }
        val suppliedTarget = data["target_url"].orEmpty()
        val targetUrl = if (suppliedTarget.startsWith("https://appassets.androidplatform.net/assets/apps/mapping/"))
            suppliedTarget else "https://appassets.androidplatform.net/assets/apps/mapping/index.html#context"
        showNotification(
            channelId = AmyFxApplication.MARKET_CONTEXT_CHANNEL_ID,
            channelName = "Amy FX Market Context",
            channelDescription = "Perubahan struktur dan area penting Gold XAU/USD",
            title = title,
            body = body,
            gateKey = "market_context|$eventKey",
            requestSeed = eventKey,
            targetUrl = targetUrl,
            route = "Mapping",
            lightColor = Color.rgb(139, 185, 255),
            category = NotificationCompat.CATEGORY_MESSAGE
        )
    }

    private fun handleScalperMessage(message: RemoteMessage) {
        val data = message.data
        val setupId = data["setup_id"].orEmpty()
        val status = data["status"].orEmpty()
        val title = message.notification?.title ?: data["title"] ?: "[SIMULASI] Amy FX Scalper"
        val body = message.notification?.body ?: data["body"] ?: "Lifecycle sinyal scalping diperbarui."
        val suppliedTarget = data["target_url"].orEmpty()
        val targetUrl = when {
            suppliedTarget.startsWith("https://appassets.androidplatform.net/assets/apps/mapping/") -> suppliedTarget
            setupId.isNotBlank() -> "https://appassets.androidplatform.net/assets/apps/mapping/index.html#scalper=${Uri.encode(setupId)}"
            else -> "https://appassets.androidplatform.net/assets/apps/mapping/index.html#scalper"
        }
        showNotification(
            channelId = AmyFxApplication.SCALPER_CHANNEL_ID,
            channelName = "Amy FX Scalper Signals",
            channelDescription = "Sinyal simulasi 10 driver BT6/BT6.1 + AMD dari Amy FX Preview",
            title = title,
            body = body,
            gateKey = "scalper|$setupId|$status",
            requestSeed = "$setupId|$status",
            targetUrl = targetUrl,
            route = "Mapping",
            lightColor = Color.rgb(212, 175, 55),
            category = NotificationCompat.CATEGORY_ALARM
        )
    }

    private fun handleNewsMessage(message: RemoteMessage) {
        val data = message.data
        val newsId = data["news_id"] ?: data["id"] ?: ""
        val title = message.notification?.title ?: data["title"] ?: "Breaking News XAU/USD"
        val body = message.notification?.body ?: data["body"] ?: data["text"] ?: "Berita baru telah tersedia."
        val suppliedTarget = data["target_url"].orEmpty()
        val targetUrl = when {
            suppliedTarget.startsWith("https://appassets.androidplatform.net/assets/apps/market-intel/") -> suppliedTarget
            newsId.isNotBlank() -> "https://appassets.androidplatform.net/assets/apps/market-intel/index.html#news=${Uri.encode(newsId)}"
            else -> "https://appassets.androidplatform.net/assets/apps/market-intel/index.html"
        }
        showNotification(
            channelId = AmyFxApplication.NEWS_CHANNEL_ID,
            channelName = "Amy FX Breaking News",
            channelDescription = "Breaking news XAU/USD yang tetap muncul saat Amy FX ditutup",
            title = title,
            body = body,
            gateKey = AmyFxNotificationGate.newsContentKey(body),
            requestSeed = if (newsId.isBlank()) body else newsId,
            targetUrl = targetUrl,
            route = "MarketIntel",
            lightColor = Color.YELLOW,
            category = NotificationCompat.CATEGORY_MESSAGE
        )
    }

    private fun showNotification(
        channelId: String,
        channelName: String,
        channelDescription: String,
        title: String,
        body: String,
        gateKey: String,
        requestSeed: String,
        targetUrl: String,
        route: String,
        lightColor: Int,
        category: String
    ) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        if (!AmyFxNotificationGate.shouldNotify(applicationContext, gateKey, System.currentTimeMillis())) return

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH).apply {
                description = channelDescription
                enableLights(true)
                this.lightColor = lightColor
                enableVibration(true)
                setShowBadge(true)
            })
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", targetUrl)
            putExtra("amyfx_route", route)
            data = Uri.parse(targetUrl)
        }
        val requestCode = requestSeed.hashCode()
        val pendingIntent = PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_amy_fx)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(category)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        manager.notify(AmyFxNotificationGate.stableId(gateKey, requestCode), notification)
    }
}
