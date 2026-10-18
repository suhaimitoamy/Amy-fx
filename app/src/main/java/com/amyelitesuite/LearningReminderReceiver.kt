package com.amyelitesuite

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.Calendar
import java.util.Locale

/**
 * High-precision exact/idle daily alarm receiver for Amy FX Academy learning reminders.
 * Ensures notifications trigger at the exact user-configured WITA time (e.g. 20:00 WITA)
 * and never drift or fire early during maintenance cycles.
 */
class LearningReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        try {
            val prefs = context.getSharedPreferences(LearningReminderWorker.PREFS, Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean(LearningReminderWorker.KEY_ENABLED, true)
            if (!enabled) {
                cancel(context)
                return
            }

            val timeStr = prefs.getString(LearningReminderWorker.KEY_TIME, LearningReminderWorker.DEFAULT_TIME)
                ?: LearningReminderWorker.DEFAULT_TIME
            val parts = timeStr.split(":")
            val targetHour = parts.getOrNull(0)?.toIntOrNull() ?: 20
            val targetMinute = parts.getOrNull(1)?.toIntOrNull() ?: 0

            val nowWita = Calendar.getInstance(LearningReminderWorker.WITA_TIME_ZONE)
            val currentHour = nowWita.get(Calendar.HOUR_OF_DAY)
            val currentMinute = nowWita.get(Calendar.MINUTE)
            val currentMinutesOfDay = currentHour * 60 + currentMinute
            val targetMinutesOfDay = targetHour * 60 + targetMinute
            val diffMinutes = Math.abs(currentMinutesOfDay - targetMinutesOfDay)

            // Strict time-window guard: only notify if within 15 minutes of scheduled time
            if (diffMinutes > 15 && diffMinutes < (24 * 60 - 15)) {
                Log.w(
                    "AmyFX-ReminderReceiver",
                    "Spurious alarm trigger at %02d:%02d WITA, expected %s WITA (diff: %d min). Discarding.".format(
                        currentHour, currentMinute, timeStr, diffMinutes
                    )
                )
                schedule(context)
                return
            }

            // Once-per-day date guard
            val witaDateKey = String.format(
                Locale.US,
                "%04d-%02d-%02d",
                nowWita.get(Calendar.YEAR),
                nowWita.get(Calendar.MONTH) + 1,
                nowWita.get(Calendar.DAY_OF_MONTH)
            )
            val lastNotifiedDate = prefs.getString(LearningReminderWorker.KEY_LAST_NOTIFIED_DATE, null)
            if (lastNotifiedDate == witaDateKey) {
                Log.d("AmyFX-ReminderReceiver", "Already notified today ($witaDateKey). Skipping.")
                schedule(context)
                return
            }

            val lastTitle = prefs.getString(LearningReminderWorker.KEY_LAST_TITLE, null)?.trim()
            val lastUrl = prefs.getString(LearningReminderWorker.KEY_LAST_URL, null)?.trim()

            val resolvedTitle = if (!lastTitle.isNullOrBlank()) lastTitle else LearningReminderWorker.DEFAULT_LESSON_TITLE
            val resolvedUrl = if (!lastUrl.isNullOrBlank()) lastUrl else LearningReminderWorker.DEFAULT_LESSON_URL

            val title = "📚 Waktunya Tingkatkan Skill Trading-mu!"
            val message = "Materi terakhir yang kamu pelajari: \"$resolvedTitle\". Yuk lanjutkan belajar sekarang! (Jadwal: $timeStr WITA)"

            showNotification(context, title, message, resolvedUrl, witaDateKey)
            prefs.edit().putString(LearningReminderWorker.KEY_LAST_NOTIFIED_DATE, witaDateKey).apply()

            // Schedule next day's alarm
            schedule(context)
        } catch (e: Exception) {
            Log.w("AmyFX-ReminderReceiver", "Failed to process reminder alarm", e)
        }
    }

    private fun showNotification(
        context: Context,
        title: String,
        message: String,
        targetUrl: String,
        witaDateKey: String
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
        }

        val gateKey = "learning_reminder|$witaDateKey"
        if (!AmyFxNotificationGate.shouldNotify(context, gateKey, System.currentTimeMillis())) {
            return
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", targetUrl)
            putExtra("amyfx_route", "Academy")
        }
        val requestCode = ("learning_reminder").hashCode()
        val pendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, AmyFxApplication.LEARNING_REMINDER_CHANNEL_ID)
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

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(LearningReminderWorker.NOTIFICATION_ID, notification)
    }

    companion object {
        const val ACTION_TRIGGER_REMINDER = "com.amyelitesuite.action.TRIGGER_LEARNING_REMINDER"
        const val ALARM_REQUEST_CODE = 99219

        fun schedule(context: Context) {
            val prefs = context.getSharedPreferences(LearningReminderWorker.PREFS, Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean(LearningReminderWorker.KEY_ENABLED, true)
            if (!enabled) {
                cancel(context)
                return
            }

            val timeStr = prefs.getString(LearningReminderWorker.KEY_TIME, LearningReminderWorker.DEFAULT_TIME)
                ?: LearningReminderWorker.DEFAULT_TIME
            val parts = timeStr.split(":")
            val targetHour = parts.getOrNull(0)?.toIntOrNull() ?: 20
            val targetMinute = parts.getOrNull(1)?.toIntOrNull() ?: 0

            val now = Calendar.getInstance(LearningReminderWorker.WITA_TIME_ZONE)
            val target = Calendar.getInstance(LearningReminderWorker.WITA_TIME_ZONE).apply {
                set(Calendar.HOUR_OF_DAY, targetHour)
                set(Calendar.MINUTE, targetMinute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            if (target.before(now) || target.timeInMillis <= now.timeInMillis) {
                target.add(Calendar.DAY_OF_YEAR, 1)
            }

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, LearningReminderReceiver::class.java).apply {
                action = ACTION_TRIGGER_REMINDER
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                ALARM_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val canExact = try {
                        alarmManager.canScheduleExactAlarms()
                    } catch (_: SecurityException) {
                        false
                    }
                    if (canExact) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target.timeInMillis, pendingIntent)
                    } else {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target.timeInMillis, pendingIntent)
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target.timeInMillis, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, target.timeInMillis, pendingIntent)
                }
                Log.d("AmyFX-ReminderReceiver", "Alarm scheduled for %s WITA at epoch %d".format(timeStr, target.timeInMillis))
            } catch (se: SecurityException) {
                Log.w("AmyFX-ReminderReceiver", "SecurityException scheduling exact alarm (Android 13/14+ permission revoked), falling back to inexact alarm", se)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target.timeInMillis, pendingIntent)
                    } else {
                        alarmManager.set(AlarmManager.RTC_WAKEUP, target.timeInMillis, pendingIntent)
                    }
                } catch (fallbackEx: Exception) {
                    Log.e("AmyFX-ReminderReceiver", "Failed to schedule inexact fallback alarm", fallbackEx)
                }
            } catch (e: Exception) {
                Log.w("AmyFX-ReminderReceiver", "Failed to schedule alarm, falling back", e)
                try {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, target.timeInMillis, pendingIntent)
                } catch (_: Exception) {}
            }
        }

        fun cancel(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, LearningReminderReceiver::class.java).apply {
                action = ACTION_TRIGGER_REMINDER
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                ALARM_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
        }
    }
}
