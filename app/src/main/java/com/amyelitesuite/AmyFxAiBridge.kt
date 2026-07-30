package com.amyelitesuite

import android.content.Context
import android.os.SystemClock
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native AI gateway for Amy FX Preview.
 * Secrets remain in EncryptedSharedPreferences and are never returned to WebView.
 */
class AmyFxAiBridge(
    context: Context,
    private val webView: WebView
) {
    private val appContext = context.applicationContext
    private val metadata = appContext.getSharedPreferences("amyfx_ai_vault_meta_v1", Context.MODE_PRIVATE)
    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(35, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .callTimeout(45, TimeUnit.SECONDS)
        .build()
    private val calls = ConcurrentHashMap<String, Call>()
    private val lastRequests = ConcurrentHashMap<String, Long>()

    private val providers = setOf("gemini", "openrouter", "deepseek")
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    @JavascriptInterface
    fun storeSecret(secretId: String?, providerName: String?, aliasName: String?, secretValue: String?): Boolean {
        val id = sanitizeId(secretId) ?: return false
        val provider = normalizeProvider(providerName) ?: return false
        val secret = secretValue?.trim()?.removePrefix("Bearer ")?.takeIf { it.length in 12..4096 } ?: return false
        val alias = sanitizeLabel(aliasName).ifBlank { provider.uppercase(Locale.US) }
        return try {
            SecurePrefs.putString(appContext, secretKey(id), secret)
            val record = JSONObject()
                .put("id", id)
                .put("provider", provider)
                .put("alias", alias)
                .put("masked_tail", secret.takeLast(4))
                .put("status", "ready")
                .put("updated_at", System.currentTimeMillis())
            metadata.edit().putString(metaKey(id), record.toString()).commit()
        } catch (_: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun listSecrets(): String {
        val rows = JSONArray()
        metadata.all.entries
            .filter { it.key.startsWith(META_PREFIX) }
            .mapNotNull { (_, value) -> runCatching { JSONObject(value as String) }.getOrNull() }
            .sortedBy { it.optString("provider") + ":" + it.optString("alias") }
            .forEach { rows.put(it) }
        return rows.toString()
    }

    @JavascriptInterface
    fun deleteSecret(secretId: String?): Boolean {
        val id = sanitizeId(secretId) ?: return false
        return try {
            SecurePrefs.remove(appContext, secretKey(id))
            metadata.edit().remove(metaKey(id)).commit()
        } catch (_: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun send(
        requestIdValue: String?,
        secretIdValue: String?,
        providerName: String?,
        modelName: String?,
        promptValue: String?,
        jsonMode: Boolean
    ) {
        val requestId = sanitizeId(requestIdValue)
        val secretId = sanitizeId(secretIdValue)
        val provider = normalizeProvider(providerName)
        val model = sanitizeModel(modelName, provider)
        val prompt = promptValue?.takeIf { it.isNotBlank() && it.length <= MAX_PROMPT_CHARS }
        if (requestId == null || secretId == null || provider == null || model == null || prompt == null) {
            deliver(errorPayload(requestIdValue.orEmpty(), "invalid_request", "Permintaan AI tidak valid."))
            return
        }

        val now = SystemClock.elapsedRealtime()
        val last = lastRequests[secretId] ?: 0L
        if (now - last < MIN_REQUEST_INTERVAL_MS) {
            deliver(errorPayload(requestId, "rate_limited_local", "Tunggu sebentar sebelum mencoba key ini lagi."))
            return
        }
        lastRequests[secretId] = now

        val secret = SecurePrefs.getString(appContext, secretKey(secretId))
        if (secret.isNullOrBlank()) {
            updateStatus(secretId, "missing", "secret_missing")
            deliver(errorPayload(requestId, "secret_missing", "API key tidak tersedia di secure vault."))
            return
        }

        val prepared = runCatching { prepareRequest(provider, model, prompt, secret, jsonMode) }.getOrElse {
            deliver(errorPayload(requestId, "invalid_request", "Permintaan provider tidak dapat disiapkan."))
            return
        }
        val started = SystemClock.elapsedRealtime()
        val call = client.newCall(prepared)
        calls[requestId] = call
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, error: java.io.IOException) {
                calls.remove(requestId)
                val category = if (call.isCanceled()) "cancelled" else if (error.message?.contains("timeout", true) == true) "timeout" else "network_error"
                updateStatus(secretId, if (category == "cancelled") "ready" else "cooldown", category)
                deliver(errorPayload(requestId, category, safeMessage(category)))
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    calls.remove(requestId)
                    val latency = SystemClock.elapsedRealtime() - started
                    val body = response.body?.string().orEmpty().take(MAX_RESPONSE_CHARS)
                    if (!response.isSuccessful) {
                        val category = when (response.code) {
                            401, 403 -> "auth_failed"
                            429 -> "rate_limited"
                            in 500..599 -> "provider_unavailable"
                            else -> "provider_error"
                        }
                        updateStatus(secretId, if (category == "auth_failed") "auth_failed" else "cooldown", category)
                        deliver(errorPayload(requestId, category, safeMessage(category), response.code, latency))
                        return
                    }
                    val answer = extractText(provider, body)
                    if (answer.isBlank()) {
                        updateStatus(secretId, "cooldown", "empty_response")
                        deliver(errorPayload(requestId, "empty_response", "Provider mengirim respons kosong.", response.code, latency))
                        return
                    }
                    updateStatus(secretId, "ready", "")
                    deliver(JSONObject()
                        .put("requestId", requestId)
                        .put("ok", true)
                        .put("text", answer.take(MAX_RESPONSE_CHARS))
                        .put("latencyMs", latency)
                        .put("status", response.code)
                        .toString())
                }
            }
        })
    }

    @JavascriptInterface
    fun cancel(requestIdValue: String?) {
        sanitizeId(requestIdValue)?.let { calls.remove(it)?.cancel() }
    }

    private fun prepareRequest(provider: String, model: String, prompt: String, secret: String, jsonMode: Boolean): Request {
        return when (provider) {
            "gemini" -> {
                val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/${encodePath(model)}:generateContent?key=${encodeQuery(secret)}"
                val generation = JSONObject()
                    .put("temperature", 0.3)
                    .put("topP", 0.9)
                    .put("maxOutputTokens", 1800)
                if (jsonMode) generation.put("responseMimeType", "application/json")
                val payload = JSONObject()
                    .put("contents", JSONArray().put(JSONObject()
                        .put("role", "user")
                        .put("parts", JSONArray().put(JSONObject().put("text", prompt)))))
                    .put("generationConfig", generation)
                Request.Builder().url(endpoint).post(payload.toString().toRequestBody(jsonMediaType)).build()
            }
            "openrouter", "deepseek" -> {
                val endpoint = if (provider == "openrouter") {
                    "https://openrouter.ai/api/v1/chat/completions"
                } else {
                    "https://api.deepseek.com/chat/completions"
                }
                val payload = JSONObject()
                    .put("model", model)
                    .put("temperature", 0.3)
                    .put("max_tokens", 1800)
                    .put("messages", JSONArray()
                        .put(JSONObject().put("role", "system").put("content", "Amy FX Mentor menggunakan hanya konteks tervalidasi yang diberikan."))
                        .put(JSONObject().put("role", "user").put("content", prompt)))
                if (jsonMode) payload.put("response_format", JSONObject().put("type", "json_object"))
                val builder = Request.Builder()
                    .url(endpoint)
                    .header("Authorization", "Bearer $secret")
                    .header("Content-Type", "application/json")
                if (provider == "openrouter") {
                    builder.header("HTTP-Referer", "https://github.com/suhaimitoamy/Amy-fx")
                    builder.header("X-Title", "Amy FX Preview")
                }
                builder.post(payload.toString().toRequestBody(jsonMediaType)).build()
            }
            else -> error("Provider tidak diizinkan")
        }
    }

    private fun extractText(provider: String, body: String): String {
        return runCatching {
            val json = JSONObject(body)
            if (provider == "gemini") {
                val candidates = json.optJSONArray("candidates") ?: return@runCatching ""
                val parts = candidates.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts") ?: return@runCatching ""
                buildString {
                    for (index in 0 until parts.length()) {
                        val part = parts.optJSONObject(index)?.optString("text").orEmpty()
                        if (part.isNotBlank()) append(part).append('\n')
                    }
                }.trim()
            } else {
                json.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content").orEmpty().trim()
            }
        }.getOrDefault("")
    }

    private fun updateStatus(secretId: String, status: String, lastError: String) {
        val key = metaKey(secretId)
        val existing = runCatching { JSONObject(metadata.getString(key, "{}") ?: "{}") }.getOrDefault(JSONObject())
        existing.put("id", secretId)
            .put("status", status)
            .put("last_error", lastError)
            .put("last_used_at", System.currentTimeMillis())
        metadata.edit().putString(key, existing.toString()).apply()
    }

    private fun deliver(payload: String) {
        webView.post {
            val quoted = JSONObject.quote(payload)
            webView.evaluateJavascript("window.AmyFXOS?.__nativeAiResult($quoted);", null)
        }
    }

    private fun errorPayload(requestId: String, category: String, message: String, status: Int = 0, latency: Long = 0L): String {
        return JSONObject()
            .put("requestId", requestId)
            .put("ok", false)
            .put("category", category)
            .put("message", message)
            .put("status", status)
            .put("latencyMs", latency)
            .toString()
    }

    private fun safeMessage(category: String): String = when (category) {
        "auth_failed" -> "API key ditolak. Periksa key di Global AI Settings."
        "rate_limited", "rate_limited_local" -> "Batas penggunaan provider tercapai. Amy akan mencoba key berikutnya."
        "timeout" -> "Provider terlalu lama merespons."
        "provider_unavailable" -> "Provider sedang tidak tersedia."
        "cancelled" -> "Permintaan dibatalkan."
        else -> "Koneksi AI gagal tanpa membuka detail sensitif."
    }

    private fun sanitizeId(value: String?): String? {
        val clean = value?.trim()?.take(120) ?: return null
        return clean.takeIf { it.matches(Regex("[A-Za-z0-9._:-]+")) }
    }

    private fun sanitizeLabel(value: String?): String {
        return value.orEmpty().replace(Regex("[^A-Za-z0-9 ._-]"), "").trim().take(48)
    }

    private fun normalizeProvider(value: String?): String? {
        val provider = value.orEmpty().trim().lowercase(Locale.US)
            .replace("google", "gemini")
            .replace("open_router", "openrouter")
        return provider.takeIf { it in providers }
    }

    private fun sanitizeModel(value: String?, provider: String?): String? {
        if (provider == null) return null
        val fallback = when (provider) {
            "gemini" -> "gemini-2.0-flash"
            "openrouter" -> "google/gemini-2.0-flash-001"
            "deepseek" -> "deepseek-chat"
            else -> return null
        }
        val model = value.orEmpty().trim().ifBlank { fallback }.take(120)
        return model.takeIf { it.matches(Regex("[A-Za-z0-9._:/-]+")) }
    }

    private fun encodePath(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
    private fun encodeQuery(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name())
    private fun secretKey(id: String) = "amyfx.ai.secret.$id"
    private fun metaKey(id: String) = "$META_PREFIX$id"

    companion object {
        private const val META_PREFIX = "secret.meta."
        private const val MAX_PROMPT_CHARS = 120_000
        private const val MAX_RESPONSE_CHARS = 40_000
        private const val MIN_REQUEST_INTERVAL_MS = 800L
    }
}
