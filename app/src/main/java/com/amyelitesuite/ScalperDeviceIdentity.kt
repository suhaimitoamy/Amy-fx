package com.amyelitesuite

import android.content.Context
import java.security.SecureRandom

/** Per-install capability; never derive credentials from a public Android ID. */
object ScalperDeviceIdentity {
    @Synchronized
    fun token(context: Context): String {
        val prefs = context.applicationContext.getSharedPreferences("amy_scalper_identity", Context.MODE_PRIVATE)
        val stored = prefs.getString("token", null)
        if (stored != null && stored.matches(Regex("[a-f0-9]{64}"))) return stored
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val value = bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
        check(prefs.edit().putString("token", value).commit()) { "Device identity could not be saved" }
        return value
    }
}
