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
        prefs.edit().putBoolean("scanner_enabled", true).apply()

        val serviceIntent = Intent(context, ScannerService::class.java).apply {
            prefs.getString("scanner_bsl_target", null)
                ?.takeIf { it.isNotBlank() }
                ?.let { putExtra("bsl", it) }
            prefs.getString("scanner_ssl_target", null)
                ?.takeIf { it.isNotBlank() }
                ?.let { putExtra("ssl", it) }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.d("AmyFX", "Automatic monitor restarted after boot/update")
        } catch (error: Exception) {
            Log.e("AmyFX", "Unable to restart automatic monitor", error)
        }
    }
}
