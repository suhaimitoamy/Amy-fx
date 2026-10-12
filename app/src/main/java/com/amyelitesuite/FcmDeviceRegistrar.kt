package com.amyelitesuite

import android.content.Context
import android.provider.Settings
import com.google.firebase.messaging.FirebaseMessaging
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object FcmDeviceRegistrar {
    private const val ENDPOINT =
        "https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/device-register"
    private const val PREFS = "amy_fcm_registration"
    private const val KEY_TOKEN = "last_token"
    private const val KEY_APP_VERSION = "last_app_version"
    private const val KEY_REGISTERED_AT = "registered_at"
    private const val REFRESH_AFTER_MS = 24L * 60L * 60L * 1000L

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    fun registerCurrentToken(context: Context, force: Boolean = false) {
        val appContext = context.applicationContext
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) register(appContext, token, force)
            }
            .addOnFailureListener { error ->
                android.util.Log.w("AmyFX-FCM", "Unable to read FCM token", error)
            }
    }

    fun register(context: Context, token: String, force: Boolean = false) {
        if (token.isBlank()) return
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val previousToken = prefs.getString(KEY_TOKEN, null)
        val previousVersion = prefs.getString(KEY_APP_VERSION, null)
        val currentVersion = BuildConfig.VERSION_NAME
        val registeredAt = prefs.getLong(KEY_REGISTERED_AT, 0L)
        val registrationFresh = previousToken == token &&
            previousVersion == currentVersion &&
            System.currentTimeMillis() - registeredAt < REFRESH_AFTER_MS

        if (!force && registrationFresh) return

        Thread {
            try {
                val androidId = Settings.Secure.getString(
                    appContext.contentResolver,
                    Settings.Secure.ANDROID_ID
                ) ?: return@Thread

                // Package menjadi bagian identitas agar Amy FX publik dan Preview
                // tidak saling menimpa token FCM pada perangkat yang sama.
                val deviceId = "${BuildConfig.APPLICATION_ID}:$androidId"
                val payload = JSONObject().apply {
                    put("deviceId", deviceId)
                    put("fcmToken", token)
                    put("scalperToken", ScalperDeviceIdentity.token(appContext))
                    put("appVersion", currentVersion)
                    put("appPackage", BuildConfig.APPLICATION_ID)
                    put("enabled", true)
                }

                val request = Request.Builder()
                    .url(ENDPOINT)
                    .header("User-Agent", "AmyFX-Android/$currentVersion")
                    .post(
                        payload.toString()
                            .toRequestBody("application/json; charset=utf-8".toMediaType())
                    )
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        prefs.edit()
                            .putString(KEY_TOKEN, token)
                            .putString(KEY_APP_VERSION, currentVersion)
                            .putLong(KEY_REGISTERED_AT, System.currentTimeMillis())
                            .apply()
                    } else {
                        android.util.Log.w(
                            "AmyFX-FCM",
                            "Token registration failed: HTTP ${response.code}"
                        )
                    }
                }
            } catch (error: Exception) {
                android.util.Log.w("AmyFX-FCM", "Token registration error", error)
            }
        }.start()
    }
}
