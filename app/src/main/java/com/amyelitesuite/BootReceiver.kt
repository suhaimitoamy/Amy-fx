package com.amyelitesuite

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Keeps the retired local Mapping scanner disabled after boot or app update.
 * Backend push remains the only notification source.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (
            action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != "android.intent.action.QUICKBOOT_POWERON"
        ) return

        context.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_BSL_TARGET)
            .remove(KEY_SSL_TARGET)
            .remove(KEY_TARGET_UPDATED_AT)
            .remove(KEY_UPPER_ARMED)
            .remove(KEY_LOWER_ARMED)
            .putBoolean(KEY_SCANNER_ENABLED, false)
            .apply()

        Log.d("AmyFX", "Legacy local Mapping scanner remains disabled")
    }

    companion object {
        private const val KEY_SCANNER_ENABLED = "scanner_enabled"
        private const val KEY_BSL_TARGET = "scanner_bsl_target"
        private const val KEY_SSL_TARGET = "scanner_ssl_target"
        private const val KEY_TARGET_UPDATED_AT = "scanner_target_updated_at"
        private const val KEY_UPPER_ARMED = "scanner_upper_armed"
        private const val KEY_LOWER_ARMED = "scanner_lower_armed"
    }
}
