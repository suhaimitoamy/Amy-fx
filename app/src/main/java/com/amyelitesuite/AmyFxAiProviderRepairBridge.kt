package com.amyelitesuite

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Repairs provider metadata for secrets that were previously stored with the wrong provider.
 * The secret value never leaves native storage and is never returned to WebView.
 */
class AmyFxAiProviderRepairBridge(context: Context) {
    private val appContext = context.applicationContext
    private val metadata = appContext.getSharedPreferences(METADATA_PREFS, Context.MODE_PRIVATE)

    @JavascriptInterface
    fun repairProviders(): String {
        val rows = JSONArray()
        val editor = metadata.edit()
        var changed = false

        metadata.all.entries
            .filter { it.key.startsWith(META_PREFIX) }
            .sortedBy { it.key }
            .forEach { (metaKey, rawValue) ->
                val record = runCatching { JSONObject(rawValue as String) }.getOrElse { JSONObject() }
                val secretId = record.optString("id").ifBlank { metaKey.removePrefix(META_PREFIX) }
                val secret = SecurePrefs.getString(appContext, secretKey(secretId)).orEmpty()
                val inferred = inferProvider(secret)
                val current = normalizeProvider(record.optString("provider"))

                if (inferred != null && inferred != current) {
                    record.put("provider", inferred)
                    record.put("alias", repairedAlias(record.optString("alias"), inferred))
                    record.put("status", "ready")
                    record.put("last_error", "")
                    record.put("provider_repaired_at", System.currentTimeMillis())
                    editor.putString(metaKey, record.toString())
                    changed = true
                }

                record.put("id", secretId)
                rows.put(record)
            }

        if (changed) editor.commit()
        return rows.toString()
    }

    private fun inferProvider(secretValue: String): String? {
        val secret = secretValue.trim().removePrefix("Bearer ")
        return when {
            secret.startsWith("AIza") -> "gemini"
            secret.startsWith("sk-or-v1-", ignoreCase = true) -> "openrouter"
            secret.startsWith("sk-", ignoreCase = true) -> "deepseek"
            else -> null
        }
    }

    private fun normalizeProvider(value: String): String {
        return value.trim().lowercase(Locale.US)
            .replace("google", "gemini")
            .replace("open_router", "openrouter")
    }

    private fun repairedAlias(aliasValue: String, provider: String): String {
        val alias = aliasValue.trim()
        val automatic = alias.matches(Regex("^(GEMINI|OPENROUTER|DEEPSEEK)(?:\\s+(\\d+))?$", RegexOption.IGNORE_CASE))
        if (!automatic && alias.isNotBlank()) return alias
        val suffix = Regex("(\\d+)$").find(alias)?.groupValues?.getOrNull(1)
        return buildString {
            append(provider.uppercase(Locale.US))
            if (!suffix.isNullOrBlank()) append(' ').append(suffix)
        }
    }

    private fun secretKey(id: String) = "amyfx.ai.secret.$id"

    companion object {
        private const val METADATA_PREFS = "amyfx_ai_vault_meta_v1"
        private const val META_PREFIX = "secret.meta."
    }
}
