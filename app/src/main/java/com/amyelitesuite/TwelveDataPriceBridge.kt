package com.amyelitesuite

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

/**
 * Owns the single Twelve Data WebSocket used by the private Preview app.
 *
 * The API key stays in encrypted native preferences (or BuildConfig supplied
 * by CI) and is never returned to WebView JavaScript. Mapping candles keep
 * using their existing REST/Supabase path; this bridge publishes price ticks
 * only.
 */
class TwelveDataPriceBridge(
    context: Context,
    private val webView: WebView
) {
    private val appContext = context.applicationContext
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    @Volatile
    private var socket: WebSocket? = null

    @Volatile
    private var socketGeneration = 0L

    @Volatile
    private var closed = false

    @JavascriptInterface
    fun hasApiKey(): Boolean = configuredApiKey().isNotBlank()

    @JavascriptInterface
    fun saveApiKey(rawApiKey: String?): Boolean {
        val apiKey = rawApiKey.orEmpty().trim()
        if (!isValidApiKey(apiKey)) {
            emitStatus("KEY_INVALID", "API key Twelve Data tidak valid.")
            return false
        }
        SecurePrefs.putString(appContext, PREF_WEBSOCKET_API_KEY, apiKey)
        disconnectInternal()
        return true
    }

    @JavascriptInterface
    fun connect(): Boolean {
        if (closed) return false
        val apiKey = configuredApiKey()
        if (apiKey.isBlank()) {
            emitStatus("KEY_REQUIRED", "API key Twelve Data diperlukan untuk harga WebSocket.")
            return false
        }

        val generation: Long
        synchronized(this) {
            if (socket != null) return true
            socketGeneration += 1L
            generation = socketGeneration
        }

        emitStatus("CONNECTING", "Menghubungkan harga live Twelve Data.")
        val encodedKey = URLEncoder.encode(apiKey, StandardCharsets.UTF_8.name())
        val request = Request.Builder()
            .url("$WEBSOCKET_URL?apikey=$encodedKey")
            .build()
        val created = client.newWebSocket(request, listener(generation))
        synchronized(this) {
            if (generation != socketGeneration || closed) {
                created.cancel()
                return false
            }
            socket = created
        }
        return true
    }

    @JavascriptInterface
    fun disconnect() {
        disconnectInternal()
    }

    fun close() {
        closed = true
        disconnectInternal()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }

    private fun listener(generation: Long) = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            if (!isCurrent(generation)) {
                webSocket.cancel()
                return
            }
            val subscribe = JSONObject()
                .put("action", "subscribe")
                .put("params", JSONObject().put("symbols", SYMBOL))
                .toString()
            if (!webSocket.send(subscribe)) {
                emitStatus("ERROR", "Langganan harga XAU/USD gagal dikirim.")
                webSocket.close(1011, "subscribe failed")
                return
            }
            emitStatus("CONNECTED", "WebSocket Twelve Data terhubung.")
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            if (!isCurrent(generation)) return
            val payload = try {
                JSONObject(text)
            } catch (_: Exception) {
                return
            }
            val event = payload.optString("event").lowercase()
            if (event == "subscribe-status") {
                val status = payload.optString("status").lowercase()
                if (status == "error") {
                    if (!releaseSocket(generation, webSocket)) return
                    emitStatus("KEY_REJECTED", safeMessage(payload.optString("message", "Langganan XAU/USD ditolak.")))
                    webSocket.close(1008, "subscription rejected")
                } else {
                    emitStatus("SUBSCRIBED", "Harga live XAU/USD aktif.")
                }
                return
            }
            if (event.isNotBlank() && event != "price") return

            val price = payload.optDouble("price", Double.NaN)
            if (!price.isFinite() || price <= 0.0) return
            val symbol = payload.optString("symbol", SYMBOL)
            if (symbol.isNotBlank() && symbol.replace("/", "").uppercase() != "XAUUSD") return

            val timestamp = payload.optLong("timestamp", 0L)
            val detail = JSONObject()
                .put("source", "TWELVE_DATA_WEBSOCKET")
                .put("symbol", SYMBOL)
                .put("price", price)
                .put("timestamp", timestamp)
            emitEvent(PRICE_EVENT, detail)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            if (!releaseSocket(generation, webSocket)) return
            emitStatus("CLOSED", safeMessage(reason.ifBlank { "WebSocket terputus." }))
        }

        override fun onFailure(webSocket: WebSocket, throwable: Throwable, response: Response?) {
            if (!releaseSocket(generation, webSocket)) return
            emitStatus("ERROR", safeMessage(throwable.message ?: "WebSocket gagal tersambung."))
        }
    }

    private fun configuredApiKey(): String {
        val stored = SecurePrefs.getString(appContext, PREF_WEBSOCKET_API_KEY, "").orEmpty().trim()
        if (stored.isNotBlank()) return stored
        val legacy = SecurePrefs.getString(appContext, LEGACY_API_KEY, "").orEmpty().trim()
        if (isValidApiKey(legacy)) {
            SecurePrefs.putString(appContext, PREF_WEBSOCKET_API_KEY, legacy)
            SecurePrefs.remove(appContext, LEGACY_API_KEY)
            return legacy
        }
        return BuildConfig.TWELVE_DATA_API_KEY.trim()
    }

    private fun isValidApiKey(apiKey: String): Boolean {
        if (apiKey.length !in 8..256) return false
        return apiKey.none { it.isWhitespace() || it.isISOControl() }
    }

    @Synchronized
    private fun isCurrent(generation: Long): Boolean {
        return !closed && generation == socketGeneration
    }

    @Synchronized
    private fun releaseSocket(generation: Long, webSocket: WebSocket): Boolean {
        if (generation != socketGeneration || socket !== webSocket) return false
        socket = null
        return true
    }

    @Synchronized
    private fun disconnectInternal() {
        socketGeneration += 1L
        val current = socket
        socket = null
        current?.close(1000, "client reconnect")
        current?.cancel()
    }

    private fun emitStatus(status: String, message: String) {
        emitEvent(
            STATUS_EVENT,
            JSONObject()
                .put("source", "TWELVE_DATA_WEBSOCKET")
                .put("status", status)
                .put("message", safeMessage(message))
        )
    }

    private fun emitEvent(eventName: String, detail: JSONObject) {
        val script = """
            (function(){
              window.dispatchEvent(new CustomEvent('$eventName', { detail: $detail }));
            })();
        """.trimIndent()
        webView.post {
            if (!closed) webView.evaluateJavascript(script, null)
        }
    }

    private fun safeMessage(raw: String): String {
        return raw
            .replace(Regex("(?i)apikey=[^&\\s]+"), "apikey=***")
            .replace(Regex("[\\r\\n]+"), " ")
            .trim()
            .take(240)
    }

    companion object {
        private const val WEBSOCKET_URL = "wss://ws.twelvedata.com/v1/quotes/price"
        private const val SYMBOL = "XAU/USD"
        private const val PREF_WEBSOCKET_API_KEY = "twelve_data_websocket_api_key"
        private const val LEGACY_API_KEY = "api_key"
        private const val PRICE_EVENT = "amyfx:twelvedata-price"
        private const val STATUS_EVENT = "amyfx:twelvedata-status"
    }
}
