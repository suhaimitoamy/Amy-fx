package com.amyelitesuite

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class AmyFxApplication : android.app.Application() {
    override fun onCreate() {
        super.onCreate()

        createNewsNotificationChannel()

        // FCM adalah jalur utama untuk news push ketika aplikasi ditutup.
        // Registrasi otomatis diulang ketika versi aplikasi berubah.
        FcmDeviceRegistrar.registerCurrentToken(this)

        // WorkManager tetap menjadi fallback ringan jika push tertunda oleh perangkat.
        scheduleNewsFallback()
    }

    private fun createNewsNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            NEWS_CHANNEL_ID,
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

    private fun scheduleNewsFallback() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<NewsSyncWorker>(15, TimeUnit.MINUTES)
            .setInitialDelay(5, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            NewsSyncWorker.UNIQUE_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    companion object {
        const val NEWS_CHANNEL_ID = "amy_news_v2"
    }
}
