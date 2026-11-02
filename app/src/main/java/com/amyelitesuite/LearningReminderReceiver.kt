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
            val targetTimes = timeStr.split(",")
                .map { it.trim() }
                .filter { it.contains(":") }
                .mapNotNull { t ->
                    val p = t.split(":")
                    val h = p.getOrNull(0)?.toIntOrNull()
                    val m = p.getOrNull(1)?.toIntOrNull()
                    if (h != null && m != null && h in 0..23 && m in 0..59) Triple(h, m, t) else null
                }
                .ifEmpty { listOf(Triple(20, 0, "20:00")) }

            val nowWita = Calendar.getInstance(LearningReminderWorker.WITA_TIME_ZONE)
            val currentHour = nowWita.get(Calendar.HOUR_OF_DAY)
            val currentMinute = nowWita.get(Calendar.MINUTE)
            val currentMinutesOfDay = currentHour * 60 + currentMinute

            val intentSlotTime = intent?.getStringExtra("slot_time")?.trim()

            // Find matching slot target:
            // 1) Match exact slot passed in intent
            // 2) Or match slot within [-5m .. +120m] window (accommodating Doze/sleep batching delays)
            val matchedTarget = if (!intentSlotTime.isNullOrBlank()) {
                targetTimes.firstOrNull { it.third == intentSlotTime }
            } else null ?: targetTimes
                .filter { (th, tm, _) ->
                    val targetMinutesOfDay = th * 60 + tm
                    val diff = currentMinutesOfDay - targetMinutesOfDay
                    (diff >= -5 && diff <= 120) || (diff <= -1435)
                }
                .minByOrNull { (th, tm, _) ->
                    val targetMinutesOfDay = th * 60 + tm
                    Math.abs(currentMinutesOfDay - targetMinutesOfDay)
                }

            if (matchedTarget == null) {
                Log.w(
                    "AmyFX-ReminderReceiver",
                    "Spurious alarm trigger at %02d:%02d, expected one of [%s]. Rescheduling next slot.".format(
                        currentHour, currentMinute, timeStr
                    )
                )
                schedule(context)
                return
            }

            val slotTimeStr = matchedTarget.third
            val slotNotifiedKey = "${LearningReminderWorker.KEY_LAST_NOTIFIED_DATE}_$slotTimeStr"

            // Once-per-slot date guard (supports Pagi, Siang, Malam on the same day)
            val witaDateKey = String.format(
                Locale.US,
                "%04d-%02d-%02d_%s",
                nowWita.get(Calendar.YEAR),
                nowWita.get(Calendar.MONTH) + 1,
                nowWita.get(Calendar.DAY_OF_MONTH),
                slotTimeStr
            )
            val lastNotifiedSlot = prefs.getString(slotNotifiedKey, null)
            if (lastNotifiedSlot == witaDateKey) {
                Log.d("AmyFX-ReminderReceiver", "Already notified for slot $slotTimeStr today ($witaDateKey). Skipping.")
                schedule(context)
                return
            }

            val lastTitle = prefs.getString(LearningReminderWorker.KEY_LAST_TITLE, null)?.trim()
            val lastUrl = prefs.getString(LearningReminderWorker.KEY_LAST_URL, null)?.trim()

            val resolvedTitle = if (!lastTitle.isNullOrBlank()) lastTitle else LearningReminderWorker.DEFAULT_LESSON_TITLE
            val resolvedUrl = if (!lastUrl.isNullOrBlank()) lastUrl else LearningReminderWorker.DEFAULT_LESSON_URL

            val title = "📚 Waktunya Tingkatkan Skill Trading-mu!"
            val message = "Materi terakhir yang kamu pelajari: \"$resolvedTitle\". Yuk lanjutkan belajar sekarang! (Jadwal: $slotTimeStr)"

            showNotification(context, title, message, resolvedUrl, witaDateKey)
            prefs.edit()
                .putString(slotNotifiedKey, witaDateKey)
                .putString(LearningReminderWorker.KEY_LAST_NOTIFIED_DATE, witaDateKey)
                .apply()

            // Schedule next upcoming alarm
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
            val targetTimes = timeStr.split(",")
                .map { it.trim() }
                .filter { it.contains(":") }
                .mapNotNull { t ->
                    val p = t.split(":")
                    val h = p.getOrNull(0)?.toIntOrNull()
                    val m = p.getOrNull(1)?.toIntOrNull()
                    if (h != null && m != null && h in 0..23 && m in 0..59) Pair(h, m) else null
                }
                .ifEmpty { listOf(Pair(20, 0)) }

            val now = Calendar.getInstance(LearningReminderWorker.WITA_TIME_ZONE)
            val candidateTargets = targetTimes.map { (th, tm) ->
                val target = Calendar.getInstance(LearningReminderWorker.WITA_TIME_ZONE).apply {
                    set(Calendar.HOUR_OF_DAY, th)
                    set(Calendar.MINUTE, tm)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                if (target.before(now) || target.timeInMillis <= now.timeInMillis) {
                    target.add(Calendar.DAY_OF_YEAR, 1)
                }
                val slotStr = String.format(java.util.Locale.US, "%02d:%02d", th, tm)
                Pair(target, slotStr)
            }

            val nextEntry = candidateTargets.minByOrNull { it.first.timeInMillis } ?: return
            val nextTarget = nextEntry.first
            val nextSlotStr = nextEntry.second

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, LearningReminderReceiver::class.java).apply {
                action = ACTION_TRIGGER_REMINDER
                putExtra("slot_time", nextSlotStr)
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
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTarget.timeInMillis, pendingIntent)
                    } else {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTarget.timeInMillis, pendingIntent)
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTarget.timeInMillis, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, nextTarget.timeInMillis, pendingIntent)
                }
                Log.d("AmyFX-ReminderReceiver", "Alarm scheduled for %s at epoch %d".format(timeStr, nextTarget.timeInMillis))
            } catch (se: SecurityException) {
                Log.w("AmyFX-ReminderReceiver", "SecurityException scheduling exact alarm (Android 13/14+ permission revoked), falling back to inexact alarm", se)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTarget.timeInMillis, pendingIntent)
                    } else {
                        alarmManager.set(AlarmManager.RTC_WAKEUP, nextTarget.timeInMillis, pendingIntent)
                    }
                } catch (fallbackEx: Exception) {
                    Log.e("AmyFX-ReminderReceiver", "Failed to schedule inexact fallback alarm", fallbackEx)
                }
            } catch (e: Exception) {
                Log.w("AmyFX-ReminderReceiver", "Failed to schedule alarm, falling back", e)
                try {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, nextTarget.timeInMillis, pendingIntent)
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
