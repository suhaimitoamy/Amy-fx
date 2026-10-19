package com.amyelitesuite

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.os.SystemClock
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebChromeClient.FileChooserParams
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

private const val APP_ASSET_HOST = "appassets.androidplatform.net"
private const val APP_ASSET_PREFIX = "https://appassets.androidplatform.net/assets/"
private const val LEGACY_ASSET_PREFIX = "file:///android_asset/"
private const val HOME_URL = "${APP_ASSET_PREFIX}index.html"
private const val ERROR_URL = "${APP_ASSET_PREFIX}error.html"

private data class BackgroundVideoTransferSession(
    val id: String,
    val file: File,
    val outputStream: FileOutputStream,
    val expectedSize: Long,
    var nextChunkIndex: Int = 0,
    var writtenBytes: Long = 0L
)

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var nativeUpdater: NativeAppUpdater
    private lateinit var twelveDataPriceBridge: TwelveDataPriceBridge
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private var refreshPageUrl: String? = null
    private lateinit var rootLayout: FrameLayout
    private lateinit var permissionGate: LinearLayout
    private lateinit var batteryStatusText: TextView
    private lateinit var notificationStatusText: TextView
    private lateinit var scannerStatusText: TextView
    private lateinit var manageFilesStatusText: TextView
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 100
    private val NOTIFICATION_REQUEST_CODE = 2
    private val MANAGE_FILES_REQUEST_CODE = 3

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val matchParentParams = android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            android.view.ViewGroup.LayoutParams.MATCH_PARENT
        )

        createNotificationChannels()
        try {
            androidx.work.WorkManager.getInstance(this).enqueue(
                androidx.work.OneTimeWorkRequestBuilder<NewsSyncWorker>().build()
            )
        } catch (_: Exception) {}

        rootLayout = FrameLayout(this)
        rootLayout.layoutParams = matchParentParams

        swipeRefreshLayout = SwipeRefreshLayout(this)
        swipeRefreshLayout.layoutParams = matchParentParams

        webView = WebView(this)
        nativeUpdater = NativeAppUpdater(this, webView)
        twelveDataPriceBridge = TwelveDataPriceBridge(this, webView)
        webView.layoutParams = matchParentParams
        swipeRefreshLayout.addView(webView)
        rootLayout.addView(swipeRefreshLayout)

        permissionGate = buildPermissionGate()
        rootLayout.addView(permissionGate)

        setContentView(rootLayout)

        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.mediaPlaybackRequiresUserGesture = false
        webSettings.loadWithOverviewMode = true
        webSettings.useWideViewPort = true
        webSettings.cacheMode = if (BuildConfig.DEBUG) WebSettings.LOAD_NO_CACHE else WebSettings.LOAD_DEFAULT
        if (BuildConfig.DEBUG) webView.clearCache(true)
        webSettings.allowFileAccess = false
        webSettings.allowContentAccess = true
        webSettings.allowFileAccessFromFileURLs = false
        webSettings.allowUniversalAccessFromFileURLs = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(APP_ASSET_HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.addJavascriptInterface(WebAppInterface(this), "Android")
        webView.addJavascriptInterface(twelveDataPriceBridge, "AmyLivePrice")
        webView.addJavascriptInterface(AmyFxAiProviderRepairBridge(this), "AmyNativeAIRepair")
        webView.addJavascriptInterface(AmyFxAiBridge(this, webView), "AmyNativeAI")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (BuildConfig.DEBUG && consoleMessage != null) {
                    android.util.Log.d("AmyFX-WebView", "${consoleMessage.message()} @ ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}")
                }
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }

                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE)
                } catch (e: ActivityNotFoundException) {
                    fileUploadCallback = null
                    Toast.makeText(this@MainActivity, "Cannot Open File Chooser", Toast.LENGTH_LONG).show()
                    return false
                }
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
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
                if (uri.host == APP_ASSET_HOST) {
                    val path = uri.path ?: ""
                    if (path == "/index.html" || path == "/" || path.isEmpty()) {
                        view?.loadUrl(HOME_URL)
                        return true
                    }
                    val lessonRegex = Regex("^/assets/apps/academy/(bagian-[^/]+)/([^/]+)\\.html$")
                    val match = lessonRegex.find(path)
                    if (match != null && match.groupValues[2] != "index") {
                        val folder = match.groupValues[1]
                        val chapter = match.groupValues[2]
                        val rewritten = "${APP_ASSET_PREFIX}apps/academy/$folder/index.html#$chapter"
                        view?.loadUrl(rewritten)
                        return true
                    }
                    if (!path.startsWith("/assets/")) {
                        val correctedUrl = "$APP_ASSET_PREFIX${path.removePrefix("/")}"
                        view?.loadUrl(correctedUrl)
                        return true
                    }
                    if (request.isForMainFrame) updateRefreshPolicy(uri.toString())
                    return false
                }
                if (isTrustedLocalUri(uri)) {
                    if (request.isForMainFrame) updateRefreshPolicy(uri.toString())
                    return false
                }
                if (uri.scheme == "https" || uri.scheme == "http") {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}
                }
                return true
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                updateRefreshPolicy(url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefreshLayout.isRefreshing = false
                injectHomeButtonForLocalModule(url)
                applyAmyFxRoute(this@MainActivity.intent?.getStringExtra("amyfx_route"))
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    swipeRefreshLayout.isRefreshing = false
                    view?.loadUrl(ERROR_URL)
                }
            }
        }

        swipeRefreshLayout.setOnChildScrollUpCallback { _, _ ->
            // Native interception happens before DOM touch-action/preventDefault.
            isReplayRefreshBlocked() || webView.canScrollVertically(-1)
        }
        swipeRefreshLayout.setOnRefreshListener {
            if (isReplayRefreshBlocked()) {
                swipeRefreshLayout.isRefreshing = false
            } else {
                webView.reload()
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            if (url.startsWith("blob:")) {
                webView.evaluateJavascript("""
                    (function() {
                        try {
                            var targetUrl = '$url';
                            var anchor = document.querySelector('a[href="' + targetUrl + '"]');
                            var filename = (anchor && anchor.getAttribute('download')) || '';
                            fetch(targetUrl)
                                .then(function(res) { return res.blob(); })
                                .then(function(blob) {
                                    var ext = '';
                                    if (blob.type.indexOf('csv') !== -1) ext = '.csv';
                                    else if (blob.type.indexOf('json') !== -1) ext = '.json';
                                    else if (blob.type.indexOf('pdf') !== -1) ext = '.pdf';
                                    else if (blob.type.indexOf('zip') !== -1) ext = '.zip';
                                    else if (blob.type.indexOf('png') !== -1) ext = '.png';
                                    else if (blob.type.indexOf('jpeg') !== -1 || blob.type.indexOf('jpg') !== -1) ext = '.jpg';
                                    else ext = '.bin';

                                    if (!filename) {
                                        filename = 'Trading_Export_' + Date.now() + ext;
                                    } else if (filename.indexOf('.') === -1 && ext) {
                                        filename = filename + ext;
                                    }
                                    var reader = new FileReader();
                                    reader.readAsDataURL(blob);
                                    reader.onloadend = function() {
                                        Android.saveBlob(reader.result, filename);
                                    };
                                });
                        } catch (e) {}
                    })();
                """.trimIndent(), null)
                Toast.makeText(this, "Mengunduh file...", Toast.LENGTH_SHORT).show()
            } else if (url.startsWith("http")) {
                try {
                    val request = DownloadManager.Request(Uri.parse(url))
                    request.setMimeType(mimetype)
                    request.addRequestHeader("User-Agent", userAgent)
                    request.setDescription("Downloading file...")
                    request.setTitle("Amy FX Download")
                    request.allowScanningByMediaScanner()
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "Amy_Elite_Download_${System.currentTimeMillis()}")
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(request)
                    Toast.makeText(this, "Downloading File...", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show()
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 1)
            }
        }

        val targetUrl = normalizeLocalUrl(intent.getStringExtra("target_url")) ?: HOME_URL
        webView.loadUrl(targetUrl)

        updatePermissionGate()
        maybeRequestNotificationPermission()
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            webView.evaluateJavascript(
                "window.AmyBackgroundVideo?.handoffFromNativeLifecycle?.();",
                null
            )
            webView.onPause()
        }
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
            webView.post {
                webView.evaluateJavascript(
                    "window.AmyBackgroundVideo?.resumeFromNativeLifecycle?.();",
                    null
                )
            }
        }
        if (::nativeUpdater.isInitialized) nativeUpdater.resumePendingInstall()
        updatePermissionGate()
    }

    override fun onDestroy() {
        if (::twelveDataPriceBridge.isInitialized) twelveDataPriceBridge.close()
        if (::webView.isInitialized) {
            (webView.parent as? android.view.ViewGroup)?.removeView(webView)
            webView.stopLoading()
            webView.removeJavascriptInterface("Android")
            webView.removeJavascriptInterface("AmyLivePrice")
            webView.removeJavascriptInterface("AmyNativeAIRepair")
            webView.removeJavascriptInterface("AmyNativeAI")
            webView.destroy()
        }
        super.onDestroy()
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

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == NOTIFICATION_REQUEST_CODE) {
            updatePermissionGate()
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "amy_heads_up_v5",
                "Amy FX Heads-Up Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High priority trading signals"
                enableLights(true)
                lightColor = Color.GREEN
                enableVibration(true)
                val audioAttributes = android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                    .build()
                setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audioAttributes)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)

            val goldAudioAttributes = android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .build()
            val goldSoundUri = android.net.Uri.parse("android.resource://$packageName/${R.raw.amy_gold_chime}")
            val goldChannel = NotificationChannel(
                AmyFxApplication.GOLD_SIGNAL_CHANNEL_ID,
                "Amy FX Sinyal Emas A+",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi khusus sinyal Grade A+ dengan denting bel emas kristal"
                enableLights(true)
                lightColor = Color.rgb(255, 215, 0)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 80, 50, 80, 50, 120)
                setShowBadge(true)
                setSound(goldSoundUri, goldAudioAttributes)
            }
            nm.createNotificationChannel(goldChannel)
        }
    }

    private fun buildPermissionGate(): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.rgb(10, 10, 10))
            setPadding(dp(22), dp(22), dp(22), dp(22))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        val title = TextView(this).apply {
            text = "Amy FX Permission Center"
            setTextColor(Color.rgb(212, 175, 55))
            textSize = 22f
            gravity = Gravity.CENTER
        }

        val subtitle = TextView(this).apply {
            text = "Aktifkan izin wajib agar scanner dan notifikasi tetap hidup di background."
            setTextColor(Color.WHITE)
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, dp(20))
        }

        batteryStatusText = statusText()
        notificationStatusText = statusText()
        scannerStatusText = statusText()

        val batteryButton = goldButton("Buka Battery Optimization") {
            openBatteryOptimizationRequest()
        }

        val notificationButton = goldButton("Aktifkan Notifikasi") {
            requestNotificationPermission()
        }

        // manageFilesButton removed as MediaStore is used
        val appSettingsButton = darkButton("Buka Detail Aplikasi") {
            openAppSettings()
        }

        val recheckButton = darkButton("Cek Ulang Izin") {
            updatePermissionGate(true)
        }

        container.addView(title)
        container.addView(subtitle)
        container.addView(batteryStatusText)
        container.addView(notificationStatusText)
        container.addView(scannerStatusText)
        container.addView(batteryButton)
        container.addView(notificationButton)
        // container.addView(manageFilesButton)
        container.addView(appSettingsButton)
        container.addView(recheckButton)

        return container
    }

    private fun statusText(): TextView {
        return TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 15f
            setPadding(0, dp(6), 0, dp(6))
            gravity = Gravity.CENTER
        }
    }

    private fun goldButton(label: String, action: () -> Unit): Button {
        return Button(this).apply {
            text = label
            setTextColor(Color.BLACK)
            setBackgroundColor(Color.rgb(212, 175, 55))
            setOnClickListener { action() }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, dp(10), 0, 0) }
        }
    }

    private fun darkButton(label: String, action: () -> Unit): Button {
        return Button(this).apply {
            text = label
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(35, 35, 35))
            setOnClickListener { action() }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, dp(10), 0, 0) }
        }
    }

    private fun isReplayRefreshBlocked(): Boolean =
        ReplayRefreshPolicy.blocksPullToRefresh(refreshPageUrl) ||
            ReplayRefreshPolicy.blocksPullToRefresh(webView.url)

    private fun updateRefreshPolicy(url: String? = refreshPageUrl) {
        refreshPageUrl = url
        val enabled = !ReplayRefreshPolicy.blocksPullToRefresh(url)
        swipeRefreshLayout.isEnabled = enabled
        if (!enabled) swipeRefreshLayout.isRefreshing = false
    }

    private fun updatePermissionGate(forceToast: Boolean = false) {
        if (!::permissionGate.isInitialized) return

        val batteryOk = isBatteryOptimizationDisabled()
        val notificationOk = isNotificationPermissionGranted()

        batteryStatusText.text = if (batteryOk) "✅ Battery Optimization: Unrestricted" else "⚠️ Battery Optimization: belum Unrestricted"
        notificationStatusText.text = if (notificationOk) "✅ Notifikasi: aktif" else "⚠️ Notifikasi: belum aktif"
        scannerStatusText.text = if (notificationOk) "✅ Scanner: bisa jalan" else "⛔ Scanner: butuh izin notifikasi"

        // Izin background tidak boleh memblokir halaman Mapping atau modul lain.
        permissionGate.visibility = View.GONE
        updateRefreshPolicy()

        if (forceToast) {
            val message = if (notificationOk && batteryOk) {
                "Notifikasi dan background scanner siap."
            } else {
                "Aplikasi tetap bisa dipakai. Lengkapi izin hanya untuk notifikasi dan scanner background."
            }
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        }
    }

    private fun isNotificationPermissionGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= 33) {
            checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun isBatteryOptimizationDisabled(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(packageName)
    }

    private fun hasRequiredPermissions(): Boolean {
        return isNotificationPermissionGranted()
    }

    private fun isManageAllFilesGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            true
        }
    }

    private fun maybeRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !isNotificationPermissionGranted()) {
            requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"), NOTIFICATION_REQUEST_CODE)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !isNotificationPermissionGranted()) {
            requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"), NOTIFICATION_REQUEST_CODE)
        } else {
            updatePermissionGate(true)
        }
    }

    private fun openBatteryOptimizationRequest() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            updatePermissionGate(true)
            return
        }
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } catch (e: Exception) {
            openAppSettings()
        }
    }

    private fun openManageAllFilesAccess() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            updatePermissionGate(true)
            return
        }
        try {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } catch (e: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
            } catch (ex: Exception) {
                openAppSettings()
            }
        }
    }

    private fun openAppSettings() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Buka Settings > Apps > Amy FX", Toast.LENGTH_LONG).show()
        }
    }

    private fun openManageAllFilesSettingsInternal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            openAppSettings()
            return
        }
        try {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } catch (e: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
            } catch (ignored: Exception) {
                openAppSettings()
            }
        }
    }

    private fun isTrustedLocalUri(uri: Uri): Boolean {
        return uri.scheme == "https" &&
            uri.host == APP_ASSET_HOST &&
            (uri.path?.startsWith("/assets/") == true || uri.path == "/index.html" || uri.path == "/")
    }

    private fun normalizeLocalUrl(rawUrl: String?): String? {
        if (rawUrl.isNullOrBlank()) return null
        return when {
            rawUrl.startsWith(APP_ASSET_PREFIX) -> rawUrl
            rawUrl.startsWith(LEGACY_ASSET_PREFIX) ->
                APP_ASSET_PREFIX + rawUrl.removePrefix(LEGACY_ASSET_PREFIX)
            rawUrl.startsWith("/assets/") ->
                "https://${APP_ASSET_HOST}${rawUrl}"
            rawUrl.startsWith("assets/") ->
                "https://${APP_ASSET_HOST}/${rawUrl}"
            rawUrl.startsWith("/apps/") ->
                "${APP_ASSET_PREFIX}${rawUrl.removePrefix("/")}"
            rawUrl.startsWith("apps/") ->
                "${APP_ASSET_PREFIX}${rawUrl}"
            else -> null
        }
    }

    private fun injectHomeButtonForLocalModule(url: String?) {
        // Floating DOM back button is retired in favor of native header back buttons.
        return
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        normalizeLocalUrl(intent?.getStringExtra("target_url"))?.let { targetUrl ->
            if (webView.url != targetUrl) webView.loadUrl(targetUrl)
        }
        applyAmyFxRoute(intent?.getStringExtra("amyfx_route"))
    }

    private fun applyAmyFxRoute(route: String?) {
        val safeRoute = when (route) {
            "Dashboard", "Analyze", "Setups", "History", "Settings",
            "Mapping", "MarketIntel", "Academy", "Practice", "Journal" -> route
            else -> return
        }
        if (!::webView.isInitialized) return
        webView.post {
            webView.evaluateJavascript(
                "(function(){try{localStorage.setItem('amyfx.notification.route','$safeRoute');if(typeof setTab==='function')setTab('$safeRoute');}catch(e){}})();",
                null
            )
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return
            val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            fileUploadCallback?.onReceiveValue(result)
            fileUploadCallback = null
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    inner class WebAppInterface(private val mContext: Context) {
        private var backgroundVideoTransfer: BackgroundVideoTransferSession? = null

        @JavascriptInterface
        fun getScalperDeviceToken(): String = ScalperDeviceIdentity.token(mContext)

        @JavascriptInterface
        fun getElapsedRealtimeMs(): Long {
            return SystemClock.elapsedRealtime()
        }

        @JavascriptInterface
        fun goHome() {
            (mContext as Activity).runOnUiThread {
                this@MainActivity.webView.loadUrl(HOME_URL)
            }
        }

        @JavascriptInterface
        fun openManageFilesPermission() {
            (mContext as Activity).runOnUiThread {
                this@MainActivity.openManageAllFilesAccess()
            }
        }

        @JavascriptInterface
        fun showAppToast(message: String) {
            (mContext as Activity).runOnUiThread {
                Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun openPdfDocument(filePath: String?) {
            (mContext as Activity).runOnUiThread {
                try {
                    val rawPath = filePath?.trim()
                    if (rawPath.isNullOrEmpty()) {
                        Toast.makeText(mContext, "Jalur file PDF tidak valid", Toast.LENGTH_SHORT).show()
                        return@runOnUiThread
                    }
                    val initialFile = File(rawPath)
                    val file = if (initialFile.exists()) {
                        initialFile
                    } else {
                        val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        val inDownloads = File(downloads, rawPath)
                        if (inDownloads.exists()) inDownloads else initialFile
                    }
                    if (!file.exists()) {
                        Toast.makeText(mContext, "File PDF tidak ditemukan: ${file.name}", Toast.LENGTH_SHORT).show()
                        return@runOnUiThread
                    }
                    val uri = FileProvider.getUriForFile(
                        mContext,
                        "${mContext.packageName}.fileprovider",
                        file
                    )
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    val chooser = Intent.createChooser(intent, "Buka Dokumen PDF Amy FX")
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    mContext.startActivity(chooser)
                } catch (e: Exception) {
                    android.util.Log.e("AmyFX-MainActivity", "Gagal membuka PDF via Intent", e)
                    Toast.makeText(mContext, "Gagal membuka PDF: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun openPdf(filePath: String?) {
            openPdfDocument(filePath)
        }

        @JavascriptInterface
        fun setSystemUiTheme(theme: String?) {
            (mContext as Activity).runOnUiThread {
                val light = theme.equals("light", ignoreCase = true)
                window.statusBarColor = Color.parseColor(if (light) "#EEF4FA" else "#070B12")
                window.navigationBarColor = Color.parseColor(if (light) "#F7FAFD" else "#070B12")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    var flags = window.decorView.systemUiVisibility
                    flags = if (light) {
                        flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    } else {
                        flags and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        flags = if (light) {
                            flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                        } else {
                            flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
                        }
                    }
                    window.decorView.systemUiVisibility = flags
                }
            }
        }

        @JavascriptInterface
        fun startAppUpdate(downloadUrl: String?, versionName: String?, versionCode: Int) {
            nativeUpdater.start(downloadUrl.orEmpty(), versionName.orEmpty(), versionCode)
        }

        @JavascriptInterface
        fun startAppUpdate(downloadUrl: String?, versionName: String?, versionCode: Int, sha256: String?) {
            nativeUpdater.start(downloadUrl.orEmpty(), versionName.orEmpty(), versionCode, sha256)
        }

        @JavascriptInterface
        fun cancelAppUpdate() {
            nativeUpdater.cancel(deletePending = true)
        }

        @JavascriptInterface
        fun openManageAllFilesSettings() {
            (mContext as Activity).runOnUiThread {
                this@MainActivity.openManageAllFilesSettingsInternal()
            }
        }

        @JavascriptInterface
        fun triggerHaptic(pattern: Int) {
            try {
                val vibrator = mContext.getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(android.os.VibrationEffect.createOneShot(pattern.toLong(), android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(pattern.toLong())
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun triggerPatternHaptic(patternType: String?) {
            try {
                val vibrator = mContext.getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
                val pattern = when (patternType?.uppercase()?.trim()) {
                    "REJECTION", "FVG", "TOUCH" -> longArrayOf(0, 50, 40, 60)
                    "BREAK", "MSS", "BOS" -> longArrayOf(0, 100, 60, 150)
                    "TARGET", "TP", "SL", "GOLD_A_PLUS" -> longArrayOf(0, 80, 50, 80, 50, 120)
                    else -> longArrayOf(0, 40)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(android.os.VibrationEffect.createWaveform(pattern, -1))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(pattern, -1)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun playNotificationSound() {
            playNotificationSound("default")
        }

        @JavascriptInterface
        fun playNotificationSound(soundType: String?) {
            try {
                if (soundType == "gold" || soundType == "crystal" || soundType == "GOLD_A_PLUS") {
                    playNativeChime(soundType)
                    return
                }
                val notificationUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                val ringtone = RingtoneManager.getRingtone(mContext, notificationUri)
                ringtone?.play()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun playNativeChime(chimeType: String?) {
            try {
                val mp = android.media.MediaPlayer.create(mContext, R.raw.amy_gold_chime)
                if (mp != null) {
                    mp.setOnCompletionListener { it.release() }
                    mp.start()
                    return
                }
            } catch (e: Exception) {
                // Fallback
            }
            playGoldChime()
        }

        @JavascriptInterface
        fun playChime(soundType: String?) {
            playNativeChime(soundType)
        }

        @JavascriptInterface
        fun playGoldChime() {
            try {
                val mp = android.media.MediaPlayer.create(mContext, R.raw.amy_gold_chime)
                if (mp != null) {
                    mp.setOnCompletionListener { it.release() }
                    mp.start()
                    return
                }
            } catch (e: Exception) {
                // Fallback
            }
            try {
                val toneGen = android.media.ToneGenerator(android.media.AudioManager.STREAM_NOTIFICATION, 100)
                toneGen.startTone(android.media.ToneGenerator.TONE_PROP_BEEP2, 350)
            } catch (e: Exception) {
                try {
                    val notificationUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    val ringtone = RingtoneManager.getRingtone(mContext, notificationUri)
                    ringtone?.play()
                } catch (err: Exception) {
                    err.printStackTrace()
                }
            }
        }

        @JavascriptInterface
        fun startBackgroundScanner(apiKey: String?, bsl: String?, ssl: String?) {
            // ScannerService is a retired compatibility stub.
            // Redundant SharedPreferences writes and service launches removed to eliminate flash wear and CPU wakeups.
            try {
                SecurePrefs.remove(mContext, "api_key")
            } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun setSwipeRefreshEnabled(enabled: Boolean) {
            (mContext as Activity).runOnUiThread {
                this@MainActivity.swipeRefreshLayout.isEnabled = enabled
            }
        }

        @JavascriptInterface
        fun stopBackgroundScanner() {
            // Retired compatibility stub; no-op to eliminate redundant disk writes.
        }

        @JavascriptInterface
        @Synchronized
        fun beginBackgroundVideoTransfer(
            transferId: String,
            filename: String,
            mimeType: String,
            expectedSizeText: String,
            title: String
        ): Boolean {
            return try {
                abortBackgroundVideoTransferInternal()
                cleanupStaleBackgroundVideoCache()
                val safeTransferId = transferId.replace(Regex("[^A-Za-z0-9._-]"), "_").take(100)
                if (safeTransferId.isBlank()) return false
                val extension = File(filename).extension.lowercase().takeIf { it.matches(Regex("[a-z0-9]{1,8}")) } ?: "mp4"
                val directory = File(mContext.cacheDir, "background-video").apply { mkdirs() }
                val file = File(directory, "${UUID.randomUUID()}-$safeTransferId.$extension")
                val output = FileOutputStream(file, false)
                backgroundVideoTransfer = BackgroundVideoTransferSession(
                    id = transferId,
                    file = file,
                    outputStream = output,
                    expectedSize = expectedSizeText.toLongOrNull()?.coerceAtLeast(0L) ?: 0L
                )
                true
            } catch (error: Exception) {
                error.printStackTrace()
                abortBackgroundVideoTransferInternal()
                false
            }
        }

        @JavascriptInterface
        @Synchronized
        fun appendBackgroundVideoChunk(transferId: String, chunkIndex: Int, base64Chunk: String): Boolean {
            val session = backgroundVideoTransfer ?: return false
            if (session.id != transferId || chunkIndex != session.nextChunkIndex) return false
            return try {
                val bytes = Base64.decode(base64Chunk, Base64.NO_WRAP)
                session.outputStream.write(bytes)
                session.writtenBytes += bytes.size.toLong()
                session.nextChunkIndex += 1
                true
            } catch (error: Exception) {
                error.printStackTrace()
                abortBackgroundVideoTransferInternal()
                false
            }
        }

        @JavascriptInterface
        @Synchronized
        fun finishBackgroundVideoTransfer(transferId: String, expectedChunks: Int): String {
            val session = backgroundVideoTransfer ?: return ""
            if (session.id != transferId || session.nextChunkIndex != expectedChunks) {
                abortBackgroundVideoTransferInternal()
                return ""
            }
            return try {
                session.outputStream.flush()
                session.outputStream.fd.sync()
                session.outputStream.close()
                val sizeMatches = session.expectedSize <= 0L || session.expectedSize == session.writtenBytes
                val diskMatches = session.file.length() == session.writtenBytes
                backgroundVideoTransfer = null
                if (!sizeMatches || !diskMatches || session.writtenBytes <= 0L) {
                    session.file.delete()
                    ""
                } else {
                    session.file.absolutePath
                }
            } catch (error: Exception) {
                error.printStackTrace()
                abortBackgroundVideoTransferInternal()
                ""
            }
        }

        @JavascriptInterface
        @Synchronized
        fun abortBackgroundVideoTransfer(transferId: String) {
            if (backgroundVideoTransfer?.id == transferId) abortBackgroundVideoTransferInternal()
        }

        @Synchronized
        private fun abortBackgroundVideoTransferInternal() {
            val session = backgroundVideoTransfer
            backgroundVideoTransfer = null
            try { session?.outputStream?.close() } catch (_: Exception) {}
            try { session?.file?.delete() } catch (_: Exception) {}
        }

        private fun cleanupStaleBackgroundVideoCache() {
            val directory = File(mContext.cacheDir, "background-video")
            val cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L
            directory.listFiles()?.forEach { file ->
                if (file.isFile && file.lastModified() < cutoff) file.delete()
            }
        }

        @JavascriptInterface
        fun playBackgroundVideo(
            source: String,
            sourceKey: String,
            title: String,
            positionMsText: String,
            loop: Boolean,
            tempPath: String
        ): Boolean {
            val callerUrl = if (::webView.isInitialized) webView.url else null
            return playBackgroundVideoWithTarget(source, sourceKey, title, positionMsText, loop, tempPath, callerUrl)
        }

        @JavascriptInterface
        fun playBackgroundVideoWithTarget(
            source: String,
            sourceKey: String,
            title: String,
            positionMsText: String,
            loop: Boolean,
            tempPath: String,
            targetUrl: String?
        ): Boolean {
            if (source.isBlank()) return false
            return try {
                val resolvedTarget = targetUrl?.takeIf { it.isNotBlank() }
                    ?: (if (::webView.isInitialized) webView.url else null)
                    ?: BackgroundVideoPlaybackService.DEFAULT_TARGET_URL
                val intent = Intent(mContext, BackgroundVideoPlaybackService::class.java).apply {
                    action = BackgroundVideoPlaybackService.ACTION_PLAY
                    putExtra(BackgroundVideoPlaybackService.EXTRA_SOURCE, source)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_SOURCE_KEY, sourceKey)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_TITLE, title)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_POSITION_MS, positionMsText.toLongOrNull() ?: 0L)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_LOOP, loop)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_TEMP_PATH, tempPath)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_TARGET_URL, resolvedTarget)
                }
                ContextCompat.startForegroundService(mContext, intent)
                true
            } catch (error: Exception) {
                error.printStackTrace()
                false
            }
        }

        @JavascriptInterface
        fun pauseBackgroundVideo() {
            sendBackgroundVideoAction(BackgroundVideoPlaybackService.ACTION_PAUSE)
        }

        @JavascriptInterface
        fun resumeBackgroundVideo() {
            sendBackgroundVideoAction(BackgroundVideoPlaybackService.ACTION_RESUME)
        }

        @JavascriptInterface
        fun seekBackgroundVideo(positionMsText: String) {
            sendBackgroundVideoAction(
                BackgroundVideoPlaybackService.ACTION_SEEK,
                positionMsText.toLongOrNull()?.coerceAtLeast(0L) ?: 0L
            )
        }

        @JavascriptInterface
        fun setBackgroundVideoLoop(loop: Boolean) {
            try {
                val intent = Intent(mContext, BackgroundVideoPlaybackService::class.java).apply {
                    action = BackgroundVideoPlaybackService.ACTION_SET_LOOP
                    putExtra(BackgroundVideoPlaybackService.EXTRA_LOOP, loop)
                }
                mContext.startService(intent)
            } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun stopBackgroundVideo() {
            sendBackgroundVideoAction(BackgroundVideoPlaybackService.ACTION_STOP)
        }

        private fun sendBackgroundVideoAction(actionName: String, positionMs: Long? = null) {
            try {
                val intent = Intent(mContext, BackgroundVideoPlaybackService::class.java).apply {
                    action = actionName
                    if (positionMs != null) putExtra(BackgroundVideoPlaybackService.EXTRA_POSITION_MS, positionMs)
                }
                mContext.startService(intent)
            } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun getBackgroundVideoState(): String {
            val prefs = mContext.getSharedPreferences(BackgroundVideoPlaybackService.STATE_PREFS, Context.MODE_PRIVATE)
            return JSONObject()
                .put("active", prefs.getBoolean(BackgroundVideoPlaybackService.STATE_ACTIVE, false))
                .put("playing", prefs.getBoolean(BackgroundVideoPlaybackService.STATE_PLAYING, false))
                .put("positionMs", prefs.getLong(BackgroundVideoPlaybackService.STATE_POSITION_MS, 0L))
                .put("durationMs", prefs.getLong(BackgroundVideoPlaybackService.STATE_DURATION_MS, 0L))
                .put("sourceKey", prefs.getString(BackgroundVideoPlaybackService.STATE_SOURCE_KEY, ""))
                .put("title", prefs.getString(BackgroundVideoPlaybackService.STATE_TITLE, ""))
                .put("loop", prefs.getBoolean(BackgroundVideoPlaybackService.STATE_LOOP, true))
                .put("error", prefs.getString(BackgroundVideoPlaybackService.STATE_ERROR, ""))
                .put("updatedAt", prefs.getLong(BackgroundVideoPlaybackService.STATE_UPDATED_AT, 0L))
                .toString()
        }

        @JavascriptInterface
        fun getNativeCandles(symbol: String?, timeframe: String?, limit: String?): String {
            return try {
                val safeSymbol = if (symbol.isNullOrBlank() || symbol == "undefined") "XAU/USD" else symbol
                val safeTimeframe = if (timeframe.isNullOrBlank() || timeframe == "undefined") "M5" else timeframe
                val safeLimit = limit?.toIntOrNull()?.coerceIn(1, 1000) ?: 300
                val rows = CandleStore(mContext).getLatest(safeSymbol, safeTimeframe, safeLimit)
                val arr = JSONArray()
                rows.forEach { c ->
                    val obj = JSONObject()
                    obj.put("symbol", c.symbol)
                    obj.put("timeframe", c.timeframe)
                    obj.put("time", c.openTime)
                    obj.put("open_time", c.openTime)
                    obj.put("close_time", c.closeTime)
                    obj.put("open", c.open)
                    obj.put("high", c.high)
                    obj.put("low", c.low)
                    obj.put("close", c.close)
                    obj.put("tickCount", c.volumeTick)
                    obj.put("isClosed", c.isClosed)
                    arr.put(obj)
                }
                arr.toString()
            } catch (e: Exception) {
                "[]"
            }
        }

        @JavascriptInterface
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

        @JavascriptInterface
        fun showNotification(title: String, message: String) {
            showNotificationWithUrl(title, message, null)
        }

        @JavascriptInterface
        fun showNotificationWithUrl(title: String, message: String, url: String?) {
            try {
                val route = AmyFxNotificationGate.routeFor(title, message)
                val intent = Intent(mContext, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    val destination = this@MainActivity.normalizeLocalUrl(url)
                        ?: AmyFxNotificationGate.routeUrl(route)
                    val routedUrl = if (destination.contains("apps/mapping/index.html") && !destination.contains("#")) "$destination#$route" else destination
                    putExtra("target_url", routedUrl)
                    putExtra("amyfx_route", route)
                }
                val requestCode = System.currentTimeMillis().toInt()
                val pendingIntent = PendingIntent.getActivity(
                    mContext, requestCode, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Notification.Builder(mContext, "amy_heads_up_v5")
                } else {
                    @Suppress("DEPRECATION")
                    Notification.Builder(mContext)
                        .setPriority(Notification.PRIORITY_HIGH)
                }

                val notification = builder
                    .setSmallIcon(R.drawable.ic_stat_amy_fx)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(Notification.BigTextStyle().bigText(message))
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setCategory(Notification.CATEGORY_ALARM)
                    .setPriority(Notification.PRIORITY_MAX)
                    .setVisibility(Notification.VISIBILITY_PUBLIC)
                    .setDefaults(Notification.DEFAULT_ALL)
                    .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                    .setVibrate(longArrayOf(0, 500, 250, 500))
                    .build()

                val nm = mContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                val gateKey = "global|" + title + "|" + message
                if (AmyFxNotificationGate.shouldNotify(applicationContext, gateKey, System.currentTimeMillis())) {
                    nm.notify(AmyFxNotificationGate.stableId(gateKey, requestCode), notification)
                } // AMYFX_NOTIFY_NATIVE_FIX
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun recordLastStudiedLesson(title: String?, url: String?, section: String?) {
            try {
                val cleanTitle = title?.trim()?.takeIf { it.isNotBlank() } ?: return
                val cleanUrl = url?.trim()?.takeIf { it.isNotBlank() } ?: return
                val prefs = mContext.getSharedPreferences(LearningReminderWorker.PREFS, Context.MODE_PRIVATE)
                prefs.edit().apply {
                    putString(LearningReminderWorker.KEY_LAST_TITLE, cleanTitle)
                    putString(LearningReminderWorker.KEY_LAST_URL, cleanUrl)
                    putString(LearningReminderWorker.KEY_LAST_SECTION, section?.trim().orEmpty())
                    putLong(LearningReminderWorker.KEY_LAST_TIME, System.currentTimeMillis())
                }.apply()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun recordLastStudiedLesson(folderOrTitle: String?, titleOrUrl: String?) {
            try {
                if (folderOrTitle != null && titleOrUrl != null) {
                    if (folderOrTitle.contains("modul-") || folderOrTitle.contains("bagian-")) {
                        recordLastStudiedLesson(titleOrUrl, "", folderOrTitle)
                    } else {
                        recordLastStudiedLesson(folderOrTitle, titleOrUrl, "")
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun saveLearningReminderConfig(enabled: Boolean, timeOfDay: String?): Boolean {
            return try {
                val cleanTime = timeOfDay?.trim()?.takeIf { it.matches(Regex("^\\d{1,2}:\\d{2}$")) } ?: "20:00"
                val prefs = mContext.getSharedPreferences(LearningReminderWorker.PREFS, Context.MODE_PRIVATE)
                prefs.edit().apply {
                    putBoolean(LearningReminderWorker.KEY_ENABLED, enabled)
                    putString(LearningReminderWorker.KEY_TIME, cleanTime)
                }.apply()
                LearningReminderReceiver.schedule(mContext)
                LearningReminderWorker.reschedule(mContext)
                true
            } catch (e: Exception) {
                e.printStackTrace()
                false
            }
        }

        @JavascriptInterface
        fun getLearningReminderConfig(): String {
            return try {
                val prefs = mContext.getSharedPreferences(LearningReminderWorker.PREFS, Context.MODE_PRIVATE)
                val enabled = prefs.getBoolean(LearningReminderWorker.KEY_ENABLED, true)
                val time = prefs.getString(LearningReminderWorker.KEY_TIME, "20:00") ?: "20:00"
                val lastTitle = prefs.getString(LearningReminderWorker.KEY_LAST_TITLE, "") ?: ""
                val lastUrl = prefs.getString(LearningReminderWorker.KEY_LAST_URL, "") ?: ""
                val lastSection = prefs.getString(LearningReminderWorker.KEY_LAST_SECTION, "") ?: ""
                val lastTime = prefs.getLong(LearningReminderWorker.KEY_LAST_TIME, 0L)
                JSONObject().apply {
                    put("enabled", enabled)
                    put("time", time)
                    put("lastTitle", lastTitle)
                    put("lastUrl", lastUrl)
                    put("lastSection", lastSection)
                    put("lastTime", lastTime)
                }.toString()
            } catch (e: Exception) {
                "{}"
            }
        }

        @JavascriptInterface
        fun triggerLearningReminderNotification(): Boolean {
            return try {
                val prefs = mContext.getSharedPreferences(LearningReminderWorker.PREFS, Context.MODE_PRIVATE)
                val lastTitle = prefs.getString(LearningReminderWorker.KEY_LAST_TITLE, null)?.trim()
                    ?: LearningReminderWorker.DEFAULT_LESSON_TITLE
                val lastUrl = prefs.getString(LearningReminderWorker.KEY_LAST_URL, null)?.trim()
                    ?: LearningReminderWorker.DEFAULT_LESSON_URL

                val title = "📚 Waktunya Tingkatkan Skill Trading-mu!"
                val message = "Materi terakhir yang kamu pelajari: \"$lastTitle\". Yuk lanjutkan belajar sekarang!"

                showNotificationWithUrl(title, message, lastUrl)
                true
            } catch (e: Exception) {
                e.printStackTrace()
                false
            }
        }

        private var currentFileOutputStream: OutputStream? = null

        @JavascriptInterface
        fun startFile(filename: String) {
            try {
                val extension = File(filename).extension.lowercase()
                val mimeType = android.webkit.MimeTypeMap.getSingleton()
                    .getMimeTypeFromExtension(extension)
                    ?: "application/octet-stream"
                currentFileOutputStream = openDownloadOutputStream(filename, mimeType)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun appendFileChunk(base64Chunk: String) {
            try {
                val cleanBase64 = base64Chunk.replaceFirst("^data:.*?;base64,".toRegex(), "")
                val fileAsBytes = Base64.decode(cleanBase64, 0)
                currentFileOutputStream?.write(fileAsBytes)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun finishFile() {
            try {
                val os = currentFileOutputStream ?: throw IllegalStateException("Output stream belum siap")
                os.flush()
                os.close()
                currentFileOutputStream = null
                (mContext as Activity).runOnUiThread {
                    Toast.makeText(mContext, "File tersimpan di folder Download", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                (mContext as Activity).runOnUiThread {
                    Toast.makeText(mContext, "Gagal menyimpan file", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun abortFile() {
            try {
                currentFileOutputStream?.close()
            } catch (_: Exception) {
            } finally {
                currentFileOutputStream = null
            }
        }

        @JavascriptInterface
        fun saveBlob(base64Data: String, filename: String) {
            try {
                val cleanBase64 = base64Data.replaceFirst("^data:.*?;base64,".toRegex(), "")
                val fileAsBytes = Base64.decode(cleanBase64, 0)

                val mimeType = when {
                    filename.endsWith(".csv", ignoreCase = true) -> "text/csv"
                    filename.endsWith(".json", ignoreCase = true) -> "application/json"
                    filename.endsWith(".md", ignoreCase = true) -> "text/markdown"
                    filename.endsWith(".pdf", ignoreCase = true) -> "application/pdf"
                    filename.endsWith(".zip", ignoreCase = true) -> "application/zip"
                    filename.endsWith(".png", ignoreCase = true) -> "image/png"
                    filename.endsWith(".jpg", ignoreCase = true) || filename.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
                    else -> "application/octet-stream"
                }

                val os = openDownloadOutputStream(filename, mimeType) ?: throw IllegalStateException("Gagal membuat file")
                os.write(fileAsBytes)
                os.flush()
                os.close()

                (mContext as Activity).runOnUiThread {
                    Toast.makeText(mContext, "File tersimpan: $filename", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                (mContext as Activity).runOnUiThread {
                    Toast.makeText(mContext, "Gagal menyimpan file", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun saveObsidianMarkdown(filename: String, content: String): Boolean {
            return try {
                val cleanName = if (filename.endsWith(".md", ignoreCase = true)) filename else "$filename.md"
                val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val targetDir = File(downloads, "Obsidian/Catatan Pribadi/Trading Journal").apply { mkdirs() }
                val targetFile = File(targetDir, cleanName)
                targetFile.writeText(content, Charsets.UTF_8)
                (mContext as Activity).runOnUiThread {
                    Toast.makeText(mContext, "Disimpan ke Obsidian: $cleanName", Toast.LENGTH_LONG).show()
                }
                true
            } catch (e: Exception) {
                try {
                    val cleanName = if (filename.endsWith(".md", ignoreCase = true)) filename else "$filename.md"
                    val os = openDownloadOutputStream(cleanName, "text/markdown") ?: return false
                    os.write(content.toByteArray(Charsets.UTF_8))
                    os.flush()
                    os.close()
                    (mContext as Activity).runOnUiThread {
                        Toast.makeText(mContext, "Tersimpan di Download: $cleanName", Toast.LENGTH_LONG).show()
                    }
                    true
                } catch (err: Exception) {
                    false
                }
            }
        }

        @JavascriptInterface
        fun clearAppCache(): String {
            var freedBytes = 0L
            try {
                val updatesDir = File(mContext.cacheDir, "updates")
                if (updatesDir.exists()) {
                    updatesDir.walkBottomUp().forEach { file ->
                        if (file.isFile) {
                            freedBytes += file.length()
                            file.delete()
                        } else if (file != updatesDir) {
                            file.delete()
                        }
                    }
                }

                val videoDir = File(mContext.cacheDir, "background-video")
                if (videoDir.exists()) {
                    videoDir.walkBottomUp().forEach { file ->
                        if (file.isFile) {
                            freedBytes += file.length()
                            file.delete()
                        } else if (file != videoDir) {
                            file.delete()
                        }
                    }
                }

                mContext.cacheDir.listFiles()?.forEach { file ->
                    if (file.isFile && (file.name.endsWith(".part") || file.name.endsWith(".tmp") || file.name.startsWith("Trading_Report_"))) {
                        freedBytes += file.length()
                        file.delete()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            val freedMb = String.format(java.util.Locale.US, "%.1f", freedBytes / (1024.0 * 1024.0))
            (mContext as Activity).runOnUiThread {
                Toast.makeText(mContext, "Berhasil membebaskan $freedMb MB ruang penyimpanan!", Toast.LENGTH_LONG).show()
            }
            return freedMb
        }

        @android.annotation.SuppressLint("MissingPermission")
        @JavascriptInterface
        fun isBiometricAvailable(): Boolean {
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val biometricManager = mContext.getSystemService(android.hardware.biometrics.BiometricManager::class.java)
                    biometricManager?.canAuthenticate() == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val fingerprintManager = mContext.getSystemService(android.hardware.fingerprint.FingerprintManager::class.java)
                    fingerprintManager?.isHardwareDetected == true && fingerprintManager.hasEnrolledFingerprints()
                } else {
                    false
                }
            } catch (_: Throwable) {
                false
            }
        }

        @android.annotation.SuppressLint("MissingPermission")
        @JavascriptInterface
        fun authenticateBiometric(title: String, subtitle: String, callbackJs: String) {
            val act = mContext as? Activity ?: return
            act.runOnUiThread {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        val cancellationSignal = android.os.CancellationSignal()
                        val prompt = android.hardware.biometrics.BiometricPrompt.Builder(act)
                            .setTitle(title.ifBlank { "Buka Kunci Jurnal Amy FX" })
                            .setSubtitle(subtitle.ifBlank { "Sentuh sensor sidik jari atau gunakan pengenalan wajah" })
                            .setNegativeButton("Gunakan PIN", act.mainExecutor, { _, _ ->
                                webView.evaluateJavascript("$callbackJs(false, 'USE_PIN')", null)
                            })
                            .build()

                        prompt.authenticate(cancellationSignal, act.mainExecutor,
                            object : android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                                override fun onAuthenticationSucceeded(result: android.hardware.biometrics.BiometricPrompt.AuthenticationResult?) {
                                    super.onAuthenticationSucceeded(result)
                                    webView.evaluateJavascript("$callbackJs(true, null)", null)
                                }

                                override fun onAuthenticationError(errorCode: Int, errString: CharSequence?) {
                                    super.onAuthenticationError(errorCode, errString)
                                    val safeErr = errString?.toString()?.replace("'", "\\'") ?: "Error"
                                    webView.evaluateJavascript("$callbackJs(false, '$safeErr')", null)
                                }

                                override fun onAuthenticationFailed() {
                                    super.onAuthenticationFailed()
                                    webView.evaluateJavascript("if (typeof window.onBiometricFailed === 'function') window.onBiometricFailed();", null)
                                }
                            })
                    } else {
                        webView.evaluateJavascript("$callbackJs(false, 'BIOMETRIC_UNSUPPORTED')", null)
                    }
                } catch (e: Throwable) {
                    val safeErr = e.message?.replace("'", "\\'") ?: "Exception"
                    webView.evaluateJavascript("$callbackJs(false, '$safeErr')", null)
                }
            }
        }

        private fun openDownloadOutputStream(filename: String, mimeType: String): OutputStream? {
            val safeName = filename.replace(Regex("[\\/:*?\"<>|]"), "_").ifBlank { "Amy_FX_File_${System.currentTimeMillis()}" }
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.Downloads.IS_PENDING, 0)
                }
                val uri = mContext.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                uri?.let { mContext.contentResolver.openOutputStream(it) }
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                FileOutputStream(File(downloadsDir, safeName), false)
            }
        }
    }
}
