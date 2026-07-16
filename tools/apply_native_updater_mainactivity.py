from pathlib import Path

path = Path("app/src/main/java/com/amyelitesuite/MainActivity.kt")
text = path.read_text(encoding="utf-8")

marker = "fun startAppUpdate(downloadUrl: String?, versionName: String?, versionCode: Int)"
if marker in text:
    print("Native updater bridge already applied.")
    raise SystemExit(0)

replacements = [
    (
        "    private lateinit var webView: WebView\n",
        "    private lateinit var webView: WebView\n    private lateinit var nativeUpdater: NativeAppUpdater\n",
    ),
    (
        "        webView = WebView(this)\n        webView.layoutParams = matchParentParams\n",
        "        webView = WebView(this)\n        nativeUpdater = NativeAppUpdater(this, webView)\n        webView.layoutParams = matchParentParams\n",
    ),
    (
        "        if (::webView.isInitialized) webView.onResume()\n        updatePermissionGate()\n",
        "        if (::webView.isInitialized) webView.onResume()\n        if (::nativeUpdater.isInitialized) nativeUpdater.resumePendingInstall()\n        updatePermissionGate()\n",
    ),
    (
        "        @JavascriptInterface\n        fun openManageAllFilesSettings() {\n",
        "        @JavascriptInterface\n"
        "        fun startAppUpdate(downloadUrl: String?, versionName: String?, versionCode: Int) {\n"
        "            nativeUpdater.start(downloadUrl.orEmpty(), versionName.orEmpty(), versionCode)\n"
        "        }\n\n"
        "        @JavascriptInterface\n"
        "        fun cancelAppUpdate() {\n"
        "            nativeUpdater.cancel(deletePending = true)\n"
        "        }\n\n"
        "        @JavascriptInterface\n"
        "        fun openManageAllFilesSettings() {\n",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match, got {count}: {old[:80]!r}")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("Native updater bridge applied to MainActivity.kt")
