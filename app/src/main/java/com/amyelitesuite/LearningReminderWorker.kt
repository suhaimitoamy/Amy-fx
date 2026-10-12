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
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Calendar
import java.util.concurrent.TimeUnit

class LearningReminderWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean(KEY_ENABLED, true)
            if (!enabled) return@withContext Result.success()

            val lastTitle = prefs.getString(KEY_LAST_TITLE, null)?.trim()
            val lastUrl = prefs.getString(KEY_LAST_URL, null)?.trim()

            val resolvedTitle = if (!lastTitle.isNullOrBlank()) lastTitle else DEFAULT_LESSON_TITLE
            val resolvedUrl = if (!lastUrl.isNullOrBlank()) lastUrl else DEFAULT_LESSON_URL

            val title = "📚 Waktunya Tingkatkan Skill Trading-mu!"
            val message = "Materi terakhir yang kamu pelajari: \"$resolvedTitle\". Yuk lanjutkan belajar sekarang!"

            showNotification(title, message, resolvedUrl)
            Result.success()
        } catch (error: Exception) {
            android.util.Log.w("AmyFX-LearningWorker", "Learning reminder failed", error)
            Result.retry()
        }
    }

    private fun showNotification(title: String, message: String, targetUrl: String) {
        if (!canPostNotifications()) return

        val gateKey = "learning_reminder|" + (System.currentTimeMillis() / (1000 * 60 * 60 * 6))
        if (!AmyFxNotificationGate.shouldNotify(applicationContext, gateKey, System.currentTimeMillis())) {
            return
        }

        createLearningChannel()

        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", targetUrl)
            putExtra("amyfx_route", "Academy")
        }
        val requestCode = ("learning_reminder").hashCode()
        val pendingIntent = PendingIntent.getActivity(
            applicationContext,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(applicationContext, AmyFxApplication.LEARNING_REMINDER_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_amy_fx)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun canPostNotifications(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                applicationContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun createLearningChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            AmyFxApplication.LEARNING_REMINDER_CHANNEL_ID,
            "Amy FX Pengingat Belajar",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Pengingat harian materi ICT dan peningkatan skill trading"
            enableVibration(true)
            enableLights(true)
            lightColor = Color.rgb(56, 189, 248)
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val UNIQUE_WORK_NAME = "AmyFxLearningReminderWork"
        const val PREFS = "AmyLearningPrefs"
        const val KEY_ENABLED = "learning_reminder_enabled"
        const val KEY_TIME = "learning_reminder_time" // e.g. "20:00"
        const val KEY_LAST_TITLE = "last_studied_title"
        const val KEY_LAST_URL = "last_studied_url"
        const val KEY_LAST_SECTION = "last_studied_section"
        const val KEY_LAST_TIME = "last_studied_time"
        const val NOTIFICATION_ID = 88219

        const val DEFAULT_LESSON_TITLE = "Fondasi ICT & Market Structure Dasar"
        const val DEFAULT_LESSON_URL = "https://appassets.androidplatform.net/assets/apps/academy/index.html"
        const val DEFAULT_TIME = "20:00"

        fun schedule(context: Context) {
            val workManager = WorkManager.getInstance(context)
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean(KEY_ENABLED, true)

            if (!enabled) {
                workManager.cancelUniqueWork(UNIQUE_WORK_NAME)
                return
            }

            val timeStr = prefs.getString(KEY_TIME, DEFAULT_TIME) ?: DEFAULT_TIME
            val parts = timeStr.split(":")
            val targetHour = parts.getOrNull(0)?.toIntOrNull() ?: 20
            val targetMinute = parts.getOrNull(1)?.toIntOrNull() ?: 0

            val now = Calendar.getInstance()
            val target = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, targetHour)
                set(Calendar.MINUTE, targetMinute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            if (target.before(now) || target.timeInMillis <= now.timeInMillis) {
                target.add(Calendar.DAY_OF_YEAR, 1)
            }

            val initialDelayMs = (target.timeInMillis - now.timeInMillis).coerceAtLeast(0L)

            val request = PeriodicWorkRequestBuilder<LearningReminderWorker>(24, TimeUnit.HOURS)
                .setInitialDelay(initialDelayMs, TimeUnit.MILLISECONDS)
                .build()

            workManager.enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        }
    }
}
