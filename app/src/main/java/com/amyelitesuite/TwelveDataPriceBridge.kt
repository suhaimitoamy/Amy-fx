package com.amyelitesuite

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject

/** Receives server-owned WebSocket ticks over Vercel SSE, without device credentials. */
class TwelveDataPriceBridge(
    @Suppress("UNUSED_PARAMETER") context: Context,
    private val webView: WebView
) {
    private val handler = Handler(Looper.getMainLooper())
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
    @Volatile private var call: Call? = null
    @Volatile private var generation = 0L
    @Volatile private var closed = false
    private var lastTimestamp = 0L
    private var reconnectAttempt = 0

    // Compatibility with existing WebView consumers: no local key is required.
    @JavascriptInterface
    fun hasApiKey(): Boolean = true

    @JavascriptInterface
    @Synchronized
    fun connect(): Boolean {
        if (closed) return false
        if (call != null) return true
        val currentGeneration = ++generation
        val request = Request.Builder().url(STREAM_URL)
            .header("Accept", "text/event-stream").header("Cache-Control", "no-cache").build()
        val current = client.newCall(request)
        call = current
        emitStatus("CONNECTING", "Menghubungkan harga live.")
        current.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                reconnect(currentGeneration, current)
            }
            override fun onResponse(call: Call, response: Response) {
                try {
                    response.use {
                        if (!it.isSuccessful || it.header("Content-Type")?.startsWith("text/event-stream") != true) {
                            emitStatus("ERROR", "Sumber harga server belum tersedia.", currentGeneration)
                            return@use
                        }
                        val source = it.body?.source() ?: return@use
                        while (isCurrent(currentGeneration) && !source.exhausted()) {
                            val line = source.readUtf8Line() ?: break
                            if (!line.startsWith("data: ")) continue
                            val payload = try { JSONObject(line.substring(6)) } catch (_: Exception) { continue }
                            if (payload.optString("event") != "price") continue
                            val price = payload.optDouble("price", Double.NaN)
                            val timestamp = payload.optLong("timestamp", 0)
                            val age = System.currentTimeMillis() - timestamp
                            if (!price.isFinite() || price <= 0 || timestamp <= 0 || age > 45000 || age < -60000) continue
                            synchronized(this@TwelveDataPriceBridge) {
                                if (isCurrent(currentGeneration) && timestamp >= lastTimestamp) {
                                    lastTimestamp = timestamp
                                    reconnectAttempt = 0
                                    emitEvent(PRICE_EVENT, payload, currentGeneration)
                                }
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Only a generic status is exposed; transport details are not credentials.
                } finally {
                    reconnect(currentGeneration, current)
                }
            }
        })
        return true
    }

    @Synchronized
    private fun reconnect(expected: Long, current: Call) {
        if (!isCurrent(expected) || call !== current) return
        call = null
        emitStatus("CLOSED", "Menyambungkan ulang harga live.", expected)
        val delay = minOf(2000L shl minOf(reconnectAttempt++, 4), 30000L)
        handler.postDelayed({ if (isCurrent(expected)) connect() }, delay)
    }

    private fun isCurrent(expected: Long): Boolean = !closed && generation == expected

    @JavascriptInterface
    @Synchronized
    fun disconnect() {
        generation++
        handler.removeCallbacksAndMessages(null)
        call?.cancel()
        call = null
    }

    fun close() {
        closed = true
        disconnect()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }

    private fun emitStatus(status: String, message: String, expected: Long = generation) {
        emitEvent(STATUS_EVENT, JSONObject().put("status", status).put("message", message), expected)
    }

    private fun emitEvent(eventName: String, detail: JSONObject, expected: Long) {
        val script = "window.dispatchEvent(new CustomEvent('$eventName', { detail: $detail }));"
        webView.post { if (isCurrent(expected)) webView.evaluateJavascript(script, null) }
    }

    companion object {
        private const val STREAM_URL = "https://amy-fx.vercel.app/api/live-price"
        private const val PRICE_EVENT = "amyfx:twelvedata-price"
        private const val STATUS_EVENT = "amyfx:twelvedata-status"
    }
}
