package com.amyelitesuite

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (
            action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != "android.intent.action.QUICKBOOT_POWERON"
        ) return

        val prefs = context.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean(KEY_SCANNER_ENABLED, false)
        val upper = prefs.getString(KEY_BSL_TARGET, null)?.toDoubleOrNull() ?: 0.0
        val lower = prefs.getString(KEY_SSL_TARGET, null)?.toDoubleOrNull() ?: 0.0
        val updatedAt = prefs.getLong(KEY_TARGET_UPDATED_AT, 0L)
        val expired = updatedAt <= 0L || System.currentTimeMillis() - updatedAt > TARGET_MAX_AGE_MS

        if (!enabled || expired || (upper <= 0.0 && lower <= 0.0)) {
            prefs.edit().putBoolean(KEY_SCANNER_ENABLED, false).apply()
            Log.d("AmyFX", "BootReceiver skipped: no active M15 target")
            return
        }

        val serviceIntent = Intent(context, ScannerService::class.java).apply {
            if (upper > 0.0) putExtra("bsl", upper.toString())
            if (lower > 0.0) putExtra("ssl", lower.toString())
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.d("AmyFX", "Active M15 scanner restarted after boot/update")
        } catch (error: Exception) {
            Log.e("AmyFX", "Unable to restart M15 scanner", error)
        }
    }

    companion object {
        private const val KEY_SCANNER_ENABLED = "scanner_enabled"
        private const val KEY_BSL_TARGET = "scanner_bsl_target"
        private const val KEY_SSL_TARGET = "scanner_ssl_target"
        private const val KEY_TARGET_UPDATED_AT = "scanner_target_updated_at"
        private const val TARGET_MAX_AGE_MS = 24L * 60L * 60L * 1000L
    }
}
