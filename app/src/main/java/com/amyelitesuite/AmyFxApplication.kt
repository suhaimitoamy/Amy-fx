package com.amyelitesuite

import android.app.NotificationChannel
import android.app.NotificationManager
import android.graphics.Color
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

        createNotificationChannels()

        // FCM adalah jalur utama untuk news dan sinyal shadow ketika aplikasi ditutup.
        // Registrasi otomatis diulang ketika versi aplikasi berubah.
        FcmDeviceRegistrar.registerCurrentToken(this)

        // WorkManager tetap khusus fallback news yang sudah ada. Scalper engine berjalan di backend.
        scheduleNewsFallback()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)

        val newsChannel = NotificationChannel(
            NEWS_CHANNEL_ID,
            "Amy FX Breaking News",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Breaking news XAU/USD yang tetap muncul saat Amy FX ditutup"
            enableVibration(true)
            enableLights(true)
            setShowBadge(true)
        }
        manager.createNotificationChannel(newsChannel)

        val scalperChannel = NotificationChannel(
            SCALPER_CHANNEL_ID,
            "Amy FX Scalper Signals",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Sinyal simulasi 10 driver BT6/BT6.1 + AMD dari Amy FX"
            enableVibration(true)
            enableLights(true)
            lightColor = Color.rgb(212, 175, 55)
            setShowBadge(true)
        }
        manager.createNotificationChannel(scalperChannel)
    }

    private fun scheduleNewsFallback() {
        val workManager = WorkManager.getInstance(this)
        if (BuildConfig.APPLICATION_ID == PREVIEW_APPLICATION_ID) {
            // Preview menerima news hanya dari jalur FCM server yang memakai canonical event key
            // dan atomic delivery ledger. Fallback lokal dinonaktifkan agar satu event tampil sekali.
            workManager.cancelUniqueWork(NewsSyncWorker.UNIQUE_WORK_NAME)
            return
        }
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<NewsSyncWorker>(15, TimeUnit.MINUTES)
            .setInitialDelay(5, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        workManager.enqueueUniquePeriodicWork(
            NewsSyncWorker.UNIQUE_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    companion object {
        const val NEWS_CHANNEL_ID = "amy_news_v2"
        const val SCALPER_CHANNEL_ID = "amy_scalper_v1"
        const val PREVIEW_APPLICATION_ID = "com.amyelitesuite"
    }
}
