from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "app/src/main/java/com/amyelitesuite/MainActivity.kt"
GRADLE = ROOT / "app/build.gradle.kts"

APP_ASSET_PREFIX = "https://appassets.androidplatform.net/assets/"
LEGACY_ASSET_PREFIX = "file:///android_asset/"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Patch anchor not found: {label}")
    return text.replace(old, new, 1)


main = MAIN.read_text(encoding="utf-8")

main = replace_once(
    main,
    "import android.webkit.WebResourceRequest\nimport android.webkit.ConsoleMessage",
    "import android.webkit.WebResourceRequest\nimport android.webkit.WebResourceResponse\nimport android.webkit.ConsoleMessage",
    "WebResourceResponse import",
)
main = replace_once(
    main,
    "import androidx.swiperefreshlayout.widget.SwipeRefreshLayout",
    "import androidx.swiperefreshlayout.widget.SwipeRefreshLayout\nimport androidx.webkit.WebViewAssetLoader",
    "WebViewAssetLoader import",
)
main = replace_once(
    main,
    "class MainActivity : Activity() {\n    private lateinit var webView: WebView",
    """private const val APP_ASSET_HOST = \"appassets.androidplatform.net\"
private const val APP_ASSET_PREFIX = \"https://appassets.androidplatform.net/assets/\"
private const val LEGACY_ASSET_PREFIX = \"file:///android_asset/\"
private const val HOME_URL = \"${APP_ASSET_PREFIX}index.html\"
private const val ERROR_URL = \"${APP_ASSET_PREFIX}error.html\"

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader""",
    "asset loader constants",
)
main = replace_once(
    main,
    "webSettings.allowFileAccess = true",
    "webSettings.allowFileAccess = false",
    "disable direct file access",
)
main = replace_once(
    main,
    """        webView.addJavascriptInterface(WebAppInterface(this), \"Android\")

        webView.webChromeClient""",
    """        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(APP_ASSET_HOST)
            .addPathHandler(\"/assets/\", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.addJavascriptInterface(WebAppInterface(this), \"Android\")

        webView.webChromeClient""",
    "initialize asset loader",
)

old_client = """        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val urlStr = request?.url?.toString() ?: return false
                if (urlStr.startsWith(\"file:///android_asset/\")) return false
                try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(urlStr))) } catch (e: Exception) {}
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefreshLayout.isRefreshing = false
                injectHomeButtonForLocalModule(url)
                applyAmyFxRoute(this@MainActivity.intent?.getStringExtra(\"amyfx_route\"))
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    swipeRefreshLayout.isRefreshing = false
                    view?.loadUrl(\"file:///android_asset/error.html\")
                }
            }
        }"""
new_client = """        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val uri = request?.url ?: return super.shouldInterceptRequest(view, request)
                return assetLoader.shouldInterceptRequest(uri)
                    ?: super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (isTrustedLocalUri(uri)) return false
                if (uri.scheme == \"https\" || uri.scheme == \"http\") {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}
                }
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefreshLayout.isRefreshing = false
                injectHomeButtonForLocalModule(url)
                applyAmyFxRoute(this@MainActivity.intent?.getStringExtra(\"amyfx_route\"))
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    swipeRefreshLayout.isRefreshing = false
                    view?.loadUrl(ERROR_URL)
                }
            }
        }"""
main = replace_once(main, old_client, new_client, "secure WebViewClient")

main = replace_once(
    main,
    """        val targetUrl = intent.getStringExtra(\"target_url\")
        if (targetUrl != null && targetUrl.startsWith(\"file:///android_asset/\")) {
            webView.loadUrl(targetUrl)
        } else {
            webView.loadUrl(\"file:///android_asset/index.html\")
        }""",
    """        val targetUrl = normalizeLocalUrl(intent.getStringExtra(\"target_url\")) ?: HOME_URL
        webView.loadUrl(targetUrl)""",
    "initial local URL",
)

main = main.replace("        manageFilesStatusText = statusText()\n", "", 1)
main = main.replace("        container.addView(manageFilesStatusText)\n", "", 1)

old_gate = """    private fun updatePermissionGate(forceToast: Boolean = false) {
        if (!::permissionGate.isInitialized) return

        val batteryOk = isBatteryOptimizationDisabled()
        val notificationOk = isNotificationPermissionGranted()
        val manageFilesOk = isManageAllFilesGranted()
        val ready = batteryOk && notificationOk

        batteryStatusText.text = if (batteryOk) \"✅ Battery Optimization: Unrestricted\" else \"❌ Battery Optimization: belum Unrestricted\"
        notificationStatusText.text = if (notificationOk) \"✅ Notifikasi: aktif\" else \"❌ Notifikasi: belum aktif\"
        scannerStatusText.text = if (notificationOk) \"✅ Scanner: bisa jalan\" else \"⛔ Scanner: butuh izin notifikasi\"
        if (::manageFilesStatusText.isInitialized) {
            manageFilesStatusText.text = if (manageFilesOk) \"✅ Kelola Semua File: aktif\" else \"⚠️ Kelola Semua File: belum aktif\"
        }

        permissionGate.visibility = if (ready) View.GONE else View.VISIBLE
        swipeRefreshLayout.isEnabled = ready

        if (forceToast) {
            Toast.makeText(this, if (ready) \"Izin sudah lengkap.\" else \"Izin scanner belum lengkap, tetapi aplikasi tetap bisa dipakai.\", Toast.LENGTH_SHORT).show()
        }
    }"""
new_gate = """    private fun updatePermissionGate(forceToast: Boolean = false) {
        if (!::permissionGate.isInitialized) return

        val batteryOk = isBatteryOptimizationDisabled()
        val notificationOk = isNotificationPermissionGranted()

        batteryStatusText.text = if (batteryOk) \"✅ Battery Optimization: Unrestricted\" else \"⚠️ Battery Optimization: belum Unrestricted\"
        notificationStatusText.text = if (notificationOk) \"✅ Notifikasi: aktif\" else \"⚠️ Notifikasi: belum aktif\"
        scannerStatusText.text = if (notificationOk) \"✅ Scanner: bisa jalan\" else \"⛔ Scanner: butuh izin notifikasi\"

        // Izin background tidak boleh memblokir halaman Mapping atau modul lain.
        permissionGate.visibility = View.GONE
        swipeRefreshLayout.isEnabled = true

        if (forceToast) {
            val message = if (notificationOk && batteryOk) {
                \"Notifikasi dan background scanner siap.\"
            } else {
                \"Aplikasi tetap bisa dipakai. Lengkapi izin hanya untuk notifikasi dan scanner background.\"
            }
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        }
    }"""
main = replace_once(main, old_gate, new_gate, "non-blocking permission gate")

helper_anchor = """    private fun injectHomeButtonForLocalModule(url: String?) {"""
helper = """    private fun isTrustedLocalUri(uri: Uri): Boolean {
        return uri.scheme == \"https\" &&
            uri.host == APP_ASSET_HOST &&
            uri.path?.startsWith(\"/assets/\") == true
    }

    private fun normalizeLocalUrl(rawUrl: String?): String? {
        if (rawUrl.isNullOrBlank()) return null
        return when {
            rawUrl.startsWith(APP_ASSET_PREFIX) -> rawUrl
            rawUrl.startsWith(LEGACY_ASSET_PREFIX) ->
                APP_ASSET_PREFIX + rawUrl.removePrefix(LEGACY_ASSET_PREFIX)
            else -> null
        }
    }

    private fun injectHomeButtonForLocalModule(url: String?) {"""
main = replace_once(main, helper_anchor, helper, "local URL helpers")

main = replace_once(
    main,
    "location.href = 'file:///android_asset/index.html';",
    "location.href = '${APP_ASSET_PREFIX}index.html';",
    "injected home fallback",
)

old_new_intent = """        intent?.getStringExtra(\"target_url\")?.let {
            if (webView.url != it && it.startsWith(\"file:///android_asset/\")) {
                webView.loadUrl(it)
            }
        }"""
new_new_intent = """        normalizeLocalUrl(intent?.getStringExtra(\"target_url\"))?.let { targetUrl ->
            if (webView.url != targetUrl) webView.loadUrl(targetUrl)
        }"""
main = replace_once(main, old_new_intent, new_new_intent, "notification target URL")
main = replace_once(
    main,
    "this@MainActivity.webView.loadUrl(\"file:///android_asset/index.html\")",
    "this@MainActivity.webView.loadUrl(HOME_URL)",
    "native home URL",
)

MAIN.write_text(main, encoding="utf-8")

# Update every other Android source that still creates a legacy local-asset URL.
for source in (ROOT / "app/src/main/java").rglob("*"):
    if not source.is_file() or source == MAIN or source.suffix not in {".kt", ".java"}:
        continue
    content = source.read_text(encoding="utf-8")
    updated = content.replace(LEGACY_ASSET_PREFIX, APP_ASSET_PREFIX)
    if updated != content:
        source.write_text(updated, encoding="utf-8")

gradle = GRADLE.read_text(encoding="utf-8")
if 'androidx.webkit:webkit' not in gradle:
    gradle = replace_once(
        gradle,
        '    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")',
        '    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")\n    implementation("androidx.webkit:webkit:1.12.1")',
        "AndroidX WebKit dependency",
    )
GRADLE.write_text(gradle, encoding="utf-8")

print("Applied secure WebViewAssetLoader and non-blocking permission fixes.")
