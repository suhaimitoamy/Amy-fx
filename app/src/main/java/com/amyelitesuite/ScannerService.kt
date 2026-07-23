package com.amyelitesuite

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Scanner ringan yang hanya hidup saat Mapping menghasilkan area M15 valid.
 * News tidak dipolling di sini; notifikasi news diterima melalui Firebase Messaging.
 */
class ScannerService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private var marketJob: Job? = null
    private var setupUpper = 0.0
    private var setupLower = 0.0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_SCANNER) {
            prefs().edit().putBoolean(KEY_SCANNER_ENABLED, false).apply()
            stopMonitor()
            return START_NOT_STICKY
        }

        createChannels()
        loadTargets(intent)

        if (!hasActiveTarget() || targetsExpired()) {
            clearTargets()
            stopMonitor()
            return START_NOT_STICKY
        }

        prefs().edit().putBoolean(KEY_SCANNER_ENABLED, true).apply()
        startStatusNotification()
        ensureMarketMonitor()
        return START_STICKY
    }

    private fun ensureMarketMonitor() {
        if (marketJob?.isActive == true) return

        marketJob = scope.launch {
            var failures = 0
            while (isActive) {
                if (!hasActiveTarget() || targetsExpired()) {
                    clearTargets()
                    stopSelf()
                    break
                }

                try {
                    pollMarket()
                    failures = 0
                    delay(MARKET_POLL_MS)
                } catch (error: Exception) {
                    android.util.Log.w("AmyFX-Scanner", "Market polling failed", error)
                    failures += 1
                    delay(min(MAX_RETRY_MS, RETRY_STEP_MS * failures.coerceAtMost(6)))
                }
            }
        }
    }

    private fun pollMarket() {
        val request = Request.Builder()
            .url(MARKET_URL)
            .header("Accept", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("Market HTTP ${response.code}")

            val json = JSONObject(response.body?.string().orEmpty())
            if (json.optString("status") != "ok") {
                error(json.optString("message", "Market response error"))
            }

            val values = json.optJSONArray("values") ?: error("Market values missing")
            val latest = values.optJSONObject(0) ?: error("Latest market candle missing")
            val price = latest.optString("close").toDoubleOrNull()
                ?: latest.optDouble("close", Double.NaN)

            if (!price.isFinite() || price <= 0.0) error("Invalid market price")
            checkTargets(price)
        }
    }

    private fun loadTargets(intent: Intent?) {
        val savedUpper = prefs().getString(KEY_BSL_TARGET, null)?.toDoubleOrNull() ?: 0.0
        val savedLower = prefs().getString(KEY_SSL_TARGET, null)?.toDoubleOrNull() ?: 0.0

        val hasUpper = intent?.hasExtra("bsl") == true
        val hasLower = intent?.hasExtra("ssl") == true
        val passedUpper = intent?.getStringExtra("bsl")?.toDoubleOrNull() ?: 0.0
        val passedLower = intent?.getStringExtra("ssl")?.toDoubleOrNull() ?: 0.0

        val rawUpper = if (hasUpper) passedUpper else savedUpper
        val rawLower = if (hasLower) passedLower else savedLower
        val oldUpper = setupUpper
        val oldLower = setupLower

        if (rawUpper > 0.0 && rawLower > 0.0) {
            setupUpper = max(rawUpper, rawLower)
            setupLower = min(rawUpper, rawLower)
        } else {
            setupUpper = rawUpper.coerceAtLeast(0.0)
            setupLower = rawLower.coerceAtLeast(0.0)
        }

        val changed = abs(oldUpper - setupUpper) > PRICE_EPSILON ||
            abs(oldLower - setupLower) > PRICE_EPSILON

        if (changed || hasUpper || hasLower) {
            if (hasActiveTarget()) {
                prefs().edit()
                    .putString(KEY_BSL_TARGET, if (setupUpper > 0.0) setupUpper.toString() else "")
                    .putString(KEY_SSL_TARGET, if (setupLower > 0.0) setupLower.toString() else "")
                    .putLong(KEY_TARGET_UPDATED_AT, System.currentTimeMillis())
                    .putBoolean(KEY_UPPER_ARMED, true)
                    .putBoolean(KEY_LOWER_ARMED, true)
                    .putBoolean(KEY_SCANNER_ENABLED, true)
                    .apply()
            } else {
                clearTargets()
            }
        }
    }

    private fun checkTargets(price: Double) {
        if (targetsExpired()) {
            clearTargets()
            stopSelf()
            return
        }

        if (setupUpper > 0.0) {
            if (price < setupUpper - RESET_DISTANCE) {
                prefs().edit().putBoolean(KEY_UPPER_ARMED, true).apply()
            }
            if (price >= setupUpper && prefs().getBoolean(KEY_UPPER_ARMED, true)) {
                sendTargetAlert(
                    levelKey = "UPPER_${fmt(setupUpper)}",
                    title = "🎯 XAU/USD — Area SELL Tersentuh",
                    message = "Area ${fmt(setupUpper)} tersentuh pada harga ${fmt(price)}. Tap untuk membuka Mapping."
                )
                prefs().edit().putBoolean(KEY_UPPER_ARMED, false).apply()
            }
        }

        if (setupLower > 0.0) {
            if (price > setupLower + RESET_DISTANCE) {
                prefs().edit().putBoolean(KEY_LOWER_ARMED, true).apply()
            }
            if (price <= setupLower && prefs().getBoolean(KEY_LOWER_ARMED, true)) {
                sendTargetAlert(
                    levelKey = "LOWER_${fmt(setupLower)}",
                    title = "🎯 XAU/USD — Area BUY Tersentuh",
                    message = "Area ${fmt(setupLower)} tersentuh pada harga ${fmt(price)}. Tap untuk membuka Mapping."
                )
                prefs().edit().putBoolean(KEY_LOWER_ARMED, false).apply()
            }
        }
    }

    private fun sendTargetAlert(levelKey: String, title: String, message: String) {
        if (!canPostNotifications()) return

        val gateKey = "target|$levelKey"
        if (!AmyFxNotificationGate.shouldNotify(this, gateKey, System.currentTimeMillis())) return

        val pendingIntent = PendingIntent.getActivity(
            this,
            AmyFxNotificationGate.stableId(gateKey, TARGET_NOTIFICATION_BASE_ID),
            mappingIntent("Analyze"),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = Notification.Builder(this, CHANNEL_TARGET_ALERT)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(Notification.BigTextStyle().bigText(message))
            .setSmallIcon(R.drawable.ic_stat_amy_fx)
            .setContentIntent(pendingIntent)
            .setPriority(Notification.PRIORITY_HIGH)
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setDefaults(Notification.DEFAULT_ALL)
            .setAutoCancel(true)
            .build()

        notificationManager().notify(
            AmyFxNotificationGate.stableId(gateKey, TARGET_NOTIFICATION_BASE_ID),
            notification
        )
    }

    private fun startStatusNotification() {
        val pendingIntent = PendingIntent.getActivity(
            this,
            FOREGROUND_NOTIFICATION_ID,
            mappingIntent("Dashboard"),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = Notification.Builder(this, CHANNEL_SCANNER_FOREGROUND)
            .setContentTitle("Amy FX — Pemantau area M15")
            .setContentText(targetText())
            .setStyle(Notification.BigTextStyle().bigText(
                "Scanner hemat data aktif untuk ${targetText()} dan memeriksa harga setiap 5 menit saat aplikasi berada di latar belakang. News diterima terpisah melalui push notification."
            ))
            .setSmallIcon(R.drawable.ic_stat_amy_fx)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                FOREGROUND_NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(FOREGROUND_NOTIFICATION_ID, notification)
        }
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val serviceChannel = NotificationChannel(
            CHANNEL_SCANNER_FOREGROUND,
            "Amy FX Pemantau Area M15",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Aktif hanya saat ada area Mapping M15 yang perlu dipantau"
            setSound(null, null)
            enableVibration(false)
        }

        val targetChannel = NotificationChannel(
            CHANNEL_TARGET_ALERT,
            "Amy FX Target Alerts",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Peringatan saat harga menyentuh area Mapping"
            enableVibration(true)
            enableLights(true)
        }

        notificationManager().createNotificationChannels(listOf(serviceChannel, targetChannel))
    }

    private fun mappingIntent(route: String): Intent {
        val url = AmyFxNotificationGate.routeUrl(route)
        return Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", url)
            putExtra("amyfx_route", route)
        }
    }

    private fun hasActiveTarget(): Boolean = setupUpper > 0.0 || setupLower > 0.0

    private fun targetsExpired(): Boolean {
        if (!hasActiveTarget()) return true
        val updatedAt = prefs().getLong(KEY_TARGET_UPDATED_AT, 0L)
        return updatedAt <= 0L || System.currentTimeMillis() - updatedAt > TARGET_MAX_AGE_MS
    }

    private fun targetText(): String {
        return when {
            setupUpper > 0.0 && setupLower > 0.0 ->
                "area SELL ${fmt(setupUpper)} dan BUY ${fmt(setupLower)}"
            setupUpper > 0.0 -> "area SELL ${fmt(setupUpper)}"
            setupLower > 0.0 -> "area BUY ${fmt(setupLower)}"
            else -> "area M15 aktif"
        }
    }

    private fun clearTargets() {
        setupUpper = 0.0
        setupLower = 0.0
        prefs().edit()
            .remove(KEY_BSL_TARGET)
            .remove(KEY_SSL_TARGET)
            .remove(KEY_TARGET_UPDATED_AT)
            .putBoolean(KEY_UPPER_ARMED, true)
            .putBoolean(KEY_LOWER_ARMED, true)
            .putBoolean(KEY_SCANNER_ENABLED, false)
            .apply()
    }

    private fun stopMonitor() {
        marketJob?.cancel()
        marketJob = null
        stopForeground(true)
        stopSelf()
    }

    private fun canPostNotifications(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun prefs() = getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)

    private fun notificationManager() =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun fmt(value: Double) = String.format(Locale.US, "%.2f", value)

    override fun onDestroy() {
        marketJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val ACTION_STOP_SCANNER = "com.amyelitesuite.action.STOP_SCANNER"

        private const val MARKET_URL =
            "https://amy-fx.vercel.app/api/twelvedata?symbol=XAU/USD&interval=1min&outputsize=1"
        private const val MARKET_POLL_MS = 5L * 60L * 1000L
        private const val RETRY_STEP_MS = 60_000L
        private const val MAX_RETRY_MS = 5L * 60L * 1000L
        private const val TARGET_MAX_AGE_MS = 24L * 60L * 60L * 1000L
        private const val RESET_DISTANCE = 0.50
        private const val PRICE_EPSILON = 0.01

        private const val KEY_SCANNER_ENABLED = "scanner_enabled"
        private const val KEY_BSL_TARGET = "scanner_bsl_target"
        private const val KEY_SSL_TARGET = "scanner_ssl_target"
        private const val KEY_TARGET_UPDATED_AT = "scanner_target_updated_at"
        private const val KEY_UPPER_ARMED = "scanner_upper_armed"
        private const val KEY_LOWER_ARMED = "scanner_lower_armed"

        private const val CHANNEL_SCANNER_FOREGROUND = "amy_scanner_foreground_v4"
        private const val CHANNEL_TARGET_ALERT = "amy_target_alert_v4"
        private const val FOREGROUND_NOTIFICATION_ID = 9101
        private const val TARGET_NOTIFICATION_BASE_ID = 9200
    }
}
