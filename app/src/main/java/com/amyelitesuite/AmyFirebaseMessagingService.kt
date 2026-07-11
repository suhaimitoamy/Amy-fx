package com.amyelitesuite

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class AmyFirebaseMessagingService : FirebaseMessagingService() {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        registerToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        val newsId = data["news_id"] ?: data["id"] ?: ""
        val title = message.notification?.title ?: data["title"] ?: "Breaking News XAU/USD"
        val body = message.notification?.body ?: data["body"] ?: data["text"] ?: "Berita baru telah tersedia."

        showNewsNotification(title, body, newsId)
    }

    private fun registerToken(token: String) {
        Thread {
            try {
                val deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                    ?: return@Thread
                val payload = JSONObject().apply {
                    put("deviceId", deviceId)
                    put("fcmToken", token)
                    put("appVersion", BuildConfig.VERSION_NAME)
                    put("enabled", true)
                }
                val request = Request.Builder()
                    .url("https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/device-register")
                    .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        android.util.Log.w("AmyFX-FCM", "Token registration failed: ${response.code}")
                    }
                }
            } catch (error: Exception) {
                android.util.Log.w("AmyFX-FCM", "Token registration error", error)
            }
        }.start()
    }

    private fun showNewsNotification(title: String, body: String, newsId: String) {
        val channelId = "amy_news_v1"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Amy FX Breaking News",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Breaking news yang relevan untuk XAU/USD"
                enableLights(true)
                lightColor = Color.YELLOW
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }

        val target = if (newsId.isNotBlank()) {
            "file:///android_asset/apps/market-intel/index.html#news=$newsId"
        } else {
            "file:///android_asset/apps/market-intel/index.html"
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", target)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            newsId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        manager.notify(if (newsId.isBlank()) System.currentTimeMillis().toInt() else newsId.hashCode(), notification)
    }
}
