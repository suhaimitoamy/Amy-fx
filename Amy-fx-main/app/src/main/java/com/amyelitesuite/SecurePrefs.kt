package com.amyelitesuite

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object SecurePrefs {
    private const val FILE_NAME = "amyfx_secure_prefs"

    private fun prefs(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun putString(context: Context, key: String, value: String?) {
        prefs(context).edit().putString(key, value).apply()
    }

    fun getString(context: Context, key: String, fallback: String? = null): String? {
        return try {
            prefs(context).getString(key, fallback)
        } catch (_: Exception) {
            fallback
        }
    }

    fun remove(context: Context, key: String) {
        prefs(context).edit().remove(key).apply()
    }
}
