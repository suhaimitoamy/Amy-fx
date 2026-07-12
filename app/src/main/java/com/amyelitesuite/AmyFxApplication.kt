package com.amyelitesuite

import android.app.Application
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class AmyFxApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // FCM adalah jalur utama untuk news push ketika aplikasi ditutup.
        FcmDeviceRegistrar.registerCurrentToken(this)

        // WorkManager menjadi fallback ringan. Android yang mengatur waktunya,
        // sehingga tidak perlu foreground service atau polling terus-menerus.
        scheduleNewsFallback()
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
}
