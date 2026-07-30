package com.amyelitesuite

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder

/**
 * Legacy local Mapping scanner is retired.
 * Backend push notifications are the only active notification source.
 *
 * The service remains as a safe compatibility stub so older WebView calls do
 * not crash. Every start clears stale targets and terminates immediately.
 */
class ScannerService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        clearLegacyScannerState()
        stopForeground(true)
        stopSelfResult(startId)
        return START_NOT_STICKY
    }

    override fun onCreate() {
        super.onCreate()
        clearLegacyScannerState()
    }

    private fun clearLegacyScannerState() {
        getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_BSL_TARGET)
            .remove(KEY_SSL_TARGET)
            .remove(KEY_TARGET_UPDATED_AT)
            .remove(KEY_UPPER_ARMED)
            .remove(KEY_LOWER_ARMED)
            .putBoolean(KEY_SCANNER_ENABLED, false)
            .apply()
    }

    companion object {
        const val ACTION_STOP_SCANNER = "com.amyelitesuite.action.STOP_SCANNER"

        private const val KEY_SCANNER_ENABLED = "scanner_enabled"
        private const val KEY_BSL_TARGET = "scanner_bsl_target"
        private const val KEY_SSL_TARGET = "scanner_ssl_target"
        private const val KEY_TARGET_UPDATED_AT = "scanner_target_updated_at"
        private const val KEY_UPPER_ARMED = "scanner_upper_armed"
        private const val KEY_LOWER_ARMED = "scanner_lower_armed"
    }
}
