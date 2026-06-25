package com.amyelitesuite

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return

        val validActions = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.LOCKED_BOOT_COMPLETED",
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.intent.action.QUICKBOOT_POWERON"
        )

        if (action !in validActions) return

        val prefs = context.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
        val scannerEnabled = prefs.getBoolean("scanner_enabled", false)
        val apiKey = SecurePrefs.getString(context, "api_key", null)
            ?: prefs.getString("api_key", null)

        if (!scannerEnabled || apiKey.isNullOrBlank()) {
            Log.d("AmyFX-Boot", "Scanner not restarted: enabled=$scannerEnabled, hasKey=${!apiKey.isNullOrBlank()}")
            return
        }

        try {
            val serviceIntent = Intent(context, ScannerService::class.java).apply {
                putExtra("bsl", prefs.getString("scanner_bsl_target", ""))
                putExtra("ssl", prefs.getString("scanner_ssl_target", ""))
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.d("AmyFX-Boot", "Scanner restarted after: $action")
        } catch (e: Exception) {
            Log.e("AmyFX-Boot", "Failed to restart scanner: ${e.message}")
        }
    }
}
