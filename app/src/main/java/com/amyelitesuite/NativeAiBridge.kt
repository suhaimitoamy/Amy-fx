package com.amyelitesuite

import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * HTTPS-only transport for the local Amy FX WebView Assistant.
 * API keys stay in request memory and are never written by this bridge.
 */
class NativeAiBridge(private val webView: WebView) {
    private val executor = Executors.newFixedThreadPool(3)
    private val baseClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(35, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private val allowedHosts = setOf(
        "generativelanguage.googleapis.com",
        "openrouter.ai",
        "api.deepseek.com"
    )

    private val allowedHeaders = setOf(
        "accept",
        "authorization",
        "content-type",
        "http-referer",
        "x-title"
    )

    @JavascriptInterface
    fun request(rawRequest: String?) {
        val requestJson = try {
            JSONObject(rawRequest.orEmpty())
        } catch (_: Exception) {
            emit(JSONObject().put("id", "").put("ok", false).put("status", 0).put("error", "Format permintaan native tidak valid."))
            return
        }

        val requestId = requestJson.optString("id").take(160)
        executor.execute {
            val result = JSONObject().put("id", requestId)
            try {
                val url = requestJson.optString("url")
                val parsed = okhttp3.HttpUrl.parse(url)
                    ?: throw IllegalArgumentException("URL API tidak valid.")
                if (parsed.scheme() != "https" || parsed.host() !in allowedHosts) {
                    throw SecurityException("Host API tidak diizinkan.")
                }

                val method = requestJson.optString("method", "POST").uppercase(Locale.US)
                if (method !in setOf("GET", "POST")) {
                    throw IllegalArgumentException("Metode API tidak didukung.")
                }

                val builder = Request.Builder().url(parsed)
                val headers = requestJson.optJSONObject("headers") ?: JSONObject()
                val headerNames = headers.keys()
                while (headerNames.hasNext()) {
                    val name = headerNames.next()
                    if (name.lowercase(Locale.US) in allowedHeaders) {
                        val value = headers.optString(name).take(16_384)
                        if (value.isNotBlank()) builder.header(name, value)
                    }
                }

                val bodyText = requestJson.optString("body")
                val contentType = headers.optString("Content-Type", "application/json")
                    .toMediaTypeOrNull()
                val requestBody = if (method == "GET") null else bodyText.toRequestBody(contentType)
                builder.method(method, requestBody)

                val timeoutMs = requestJson.optLong("timeoutMs", 25_000L).coerceIn(5_000L, 70_000L)
                val client = baseClient.newBuilder()
                    .callTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                    .build()

                client.newCall(builder.build()).execute().use { response ->
                    val responseText = response.body()?.string().orEmpty().take(2_000_000)
                    result
                        .put("ok", response.isSuccessful)
                        .put("status", response.code())
                        .put("body", responseText)
                        .put("error", "")
                }
            } catch (error: Exception) {
                result
                    .put("ok", false)
                    .put("status", 0)
                    .put("body", "")
                    .put("error", error.message ?: "Koneksi native AI gagal.")
            }
            emit(result)
        }
    }

    private fun emit(payload: JSONObject) {
        val quotedPayload = JSONObject.quote(payload.toString())
        webView.post {
            webView.evaluateJavascript(
                "window.AmyNativeAITransport?.onResult($quotedPayload);",
                null
            )
        }
    }
}
