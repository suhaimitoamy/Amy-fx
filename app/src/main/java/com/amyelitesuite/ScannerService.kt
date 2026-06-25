package com.amyelitesuite

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.math.abs

class ScannerService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val client = OkHttpClient.Builder().pingInterval(30, TimeUnit.SECONDS).build()
    private var socket: WebSocket? = null
    private var reconnectJob: Job? = null
    private var watchdogJob: Job? = null
    private var apiKey: String? = null
    private var bslTarget = 0.0
    private var sslTarget = 0.0
    private var bslDone = false
    private var sslDone = false
    @Volatile private var lastTickAt = System.currentTimeMillis()
    @Volatile private var manualClose = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP_SCANNER") {
            getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
                .edit().putBoolean("scanner_enabled", false).apply()
            stopSocket()
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        createChannels()

        val prefs = getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
        apiKey = prefs.getString("api_key", null)
        prefs.edit().putBoolean("scanner_enabled", true).apply()

        val savedBsl = prefs.getString("scanner_bsl_target", null)?.toDoubleOrNull() ?: 0.0
        val savedSsl = prefs.getString("scanner_ssl_target", null)?.toDoubleOrNull() ?: 0.0
        val passedBsl = intent?.getStringExtra("bsl")?.toDoubleOrNull() ?: 0.0
        val passedSsl = intent?.getStringExtra("ssl")?.toDoubleOrNull() ?: 0.0
        val nextBsl = if (passedBsl > 0.0) passedBsl else savedBsl
        val nextSsl = if (passedSsl > 0.0) passedSsl else savedSsl

        if (nextBsl > 0.0 && abs(nextBsl - bslTarget) > 0.01) {
            bslTarget = nextBsl
            bslDone = false
        }
        if (nextSsl > 0.0 && abs(nextSsl - sslTarget) > 0.01) {
            sslTarget = nextSsl
            sslDone = false
        }

        if (passedBsl > 0.0 || passedSsl > 0.0) {
            prefs.edit()
                .putString("scanner_bsl_target", if (nextBsl > 0.0) nextBsl.toString() else "")
                .putString("scanner_ssl_target", if (nextSsl > 0.0) nextSsl.toString() else "")
                .apply()
        }

        if (apiKey.isNullOrBlank()) {
            prefs.edit().putBoolean("scanner_enabled", false).apply()
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        startStatusNotification()
        connectSocket()
        startWatchdog()
        return START_STICKY
    }

    private fun connectSocket() {
        stopSocket(suppressReconnect = false)
        manualClose = false
        val key = apiKey?.trim().orEmpty()
        if (key.isBlank()) return
        val url = "wss://ws.twelvedata.com/v1/quotes/price?" + "apikey=" + key
        val request = Request.Builder().url(url).build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                lastTickAt = System.currentTimeMillis()
                reconnectJob?.cancel()
                reconnectJob = null
                webSocket.send("""{"action":"subscribe","params":{"symbols":"XAU/USD"}}""")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    if (!json.has("price")) return
                    val price = json.getDouble("price")
                    lastTickAt = System.currentTimeMillis()
                    checkMappingTargets(price)
                } catch (_: Exception) {
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (socket !== webSocket || manualClose) return
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (socket !== webSocket || manualClose) return
                scheduleReconnect()
            }
        })
    }

    private fun checkMappingTargets(price: Double) {
        if (bslTarget > 0.0 && price >= bslTarget && !bslDone) {
            bslDone = true
            sendAlert("AMY FX - MAPPING TARGET", "BSL ${fmt(bslTarget)} sudah tersentuh. Scanner mengikuti target dari Mapping.")
        }
        if (sslTarget > 0.0 && price <= sslTarget && !sslDone) {
            sslDone = true
            sendAlert("AMY FX - MAPPING TARGET", "SSL ${fmt(sslTarget)} sudah tersentuh. Scanner mengikuti target dari Mapping.")
        }
        startStatusNotification()
    }

    private fun scheduleReconnect() {
        if (reconnectJob?.isActive == true) return
        reconnectJob = scope.launch {
            delay(15_000L)
            connectSocket()
        }
    }

    private fun startWatchdog() {
        if (watchdogJob?.isActive == true) return
        watchdogJob = scope.launch {
            while (true) {
                delay(60_000L)
                if (System.currentTimeMillis() - lastTickAt > 120_000L) {
                    connectSocket()
                    lastTickAt = System.currentTimeMillis()
                }
            }
        }
    }

    private fun startStatusNotification() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val text = "Scanner ikut Mapping | ${targetText()}"
        val body = "Amy FX Scanner aktif. Analisa tetap dari Mapping. Scanner hanya memantau target BSL/SSL yang dikirim Mapping.\n\n${targetText()}"
        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, "scanner_channel")
                .setContentTitle("Amy FX Scanner Active")
                .setContentText(text)
                .setStyle(Notification.BigTextStyle().bigText(body))
                .setSmallIcon(R.drawable.ic_stat_amy_fx)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("Amy FX Scanner Active")
                .setContentText(text)
                .setStyle(Notification.BigTextStyle().bigText(body))
                .setSmallIcon(R.drawable.ic_stat_amy_fx)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(1, notification)
        }
    }

    private fun sendAlert(title: String, message: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, "scanner_alerts_channel_v2")
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
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
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
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(2 + kotlin.math.abs(message.hashCode() % 100000), notification)
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                "scanner_channel",
                "Background Scanner",
                NotificationManager.IMPORTANCE_LOW
            )
            val alertChannel = NotificationChannel(
                "scanner_alerts_channel_v2",
                "Scanner Market Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableVibration(true)
                enableLights(true)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(serviceChannel)
            nm.createNotificationChannel(alertChannel)
        }
    }

    private fun stopSocket(suppressReconnect: Boolean = true) {
        if (suppressReconnect) {
            manualClose = true
            reconnectJob?.cancel()
            reconnectJob = null
        }
        val current = socket
        socket = null
        current?.close(1000, "Scanner stopped")
    }

    private fun targetText(): String {
        return when {
            bslTarget > 0.0 && sslTarget > 0.0 -> "BSL ${fmt(bslTarget)} | SSL ${fmt(sslTarget)}"
            bslTarget > 0.0 -> "BSL ${fmt(bslTarget)}"
            sslTarget > 0.0 -> "SSL ${fmt(sslTarget)}"
            else -> "Menunggu target Mapping"
        }
    }

    private fun fmt(value: Double): String {
        if (value <= 0.0) return "-"
        return String.format("%.2f", value)
    }

    override fun onDestroy() {
        stopSocket()
        scope.cancel()
        super.onDestroy()
    }
}
