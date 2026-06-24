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
        val apiKey = prefs.getString("api_key", null)
        if (apiKey.isNullOrBlank()) {
            Log.d("AmyFX", "BootReceiver skipped: API key empty")
            return
        }

        val serviceIntent = Intent(context, ScannerService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.d("AmyFX", "BootReceiver restarted ScannerService")
        } catch (e: Exception) {
            Log.e("AmyFX", "BootReceiver failed: ${e.message}")
        }
    }
}
