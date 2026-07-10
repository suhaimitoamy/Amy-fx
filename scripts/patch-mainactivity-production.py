from pathlib import Path

path = Path("app/src/main/java/com/amyelitesuite/MainActivity.kt")
if not path.exists():
    raise SystemExit("MainActivity.kt tidak ditemukan")

s = path.read_text(encoding="utf-8")
original = s

# Harden risky WebView file URL access.
s = s.replace("webSettings.allowFileAccessFromFileURLs = true", "webSettings.allowFileAccessFromFileURLs = false")
s = s.replace("webSettings.allowUniversalAccessFromFileURLs = true", "webSettings.allowUniversalAccessFromFileURLs = false")

# Add imports if missing.
imports = {
    "android.webkit.WebResourceError": "import android.webkit.WebResourceError\n",
    "android.webkit.WebResourceRequest": "import android.webkit.WebResourceRequest\n",
    "android.webkit.ConsoleMessage": "import android.webkit.ConsoleMessage\n",
    "android.content.res.Configuration": "import android.content.res.Configuration\n",
}
for key, line in imports.items():
    if key not in s:
        s = s.replace("import android.webkit.WebChromeClient\n", line + "import android.webkit.WebChromeClient\n")

# Add console logging handler into WebChromeClient.
needle = """        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser("""
if needle in s and "override fun onConsoleMessage(consoleMessage: ConsoleMessage?)" not in s:
    s = s.replace(
        needle,
        """        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (BuildConfig.DEBUG && consoleMessage != null) {
                    android.util.Log.d("AmyFX-WebView", "${consoleMessage.message()} @ ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}")
                }
                return true
            }

            override fun onShowFileChooser("""
    )

# Add onReceivedError into WebViewClient.
needle = """        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefreshLayout.isRefreshing = false
                injectHomeButtonForLocalModule(url)
            }
        }"""
replacement = """        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefreshLayout.isRefreshing = false
                injectHomeButtonForLocalModule(url)
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    swipeRefreshLayout.isRefreshing = false
                    view?.loadUrl("file:///android_asset/error.html")
                }
            }
        }"""
if needle in s and "onReceivedError(view: WebView?" not in s:
    s = s.replace(needle, replacement)

# Add lifecycle handlers before onRequestPermissionsResult.
needle = """    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {"""
lifecycle = """    override fun onPause() {
        if (::webView.isInitialized) webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
        updatePermissionGate()
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= TRIM_MEMORY_RUNNING_LOW && ::webView.isInitialized) {
            webView.clearCache(false)
        }
    }

    override fun onLowMemory() {
        if (::webView.isInitialized) webView.clearCache(false)
        super.onLowMemory()
    }

"""
# Replace old simple onResume block if present.
old_resume = """    override fun onResume() {
        super.onResume()
        updatePermissionGate()
    }

"""
if old_resume in s:
    s = s.replace(old_resume, "")
if needle in s and "override fun onTrimMemory(level: Int)" not in s:
    s = s.replace(needle, lifecycle + needle)

# Add bridge methods for cache and scanner health.
needle = """        @JavascriptInterface
        fun showNotification(title: String, message: String) {"""
bridge = """        @JavascriptInterface
        fun clearWebViewCache() {
            (mContext as Activity).runOnUiThread {
                this@MainActivity.webView.clearCache(true)
                Toast.makeText(mContext, "Cache WebView dibersihkan", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun getScannerHealth(): String {
            val prefs = mContext.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean("scanner_enabled", false)
            val targetAt = prefs.getLong("scanner_target_updated_at", 0L)
            val bsl = prefs.getString("scanner_bsl_target", "")
            val ssl = prefs.getString("scanner_ssl_target", "")
            return JSONObject()
                .put("enabled", enabled)
                .put("targetUpdatedAt", targetAt)
                .put("bsl", bsl)
                .put("ssl", ssl)
                .toString()
        }

"""
if needle in s and "fun clearWebViewCache()" not in s:
    s = s.replace(needle, bridge + needle)

if s != original:
    path.write_text(s, encoding="utf-8")
    print("MainActivity patched.")
else:
    print("MainActivity already patched or pattern not found.")
