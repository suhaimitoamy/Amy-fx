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
import android.provider.Settings
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File
import java.io.FileOutputStream
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var rootLayout: FrameLayout
    private lateinit var permissionGate: LinearLayout
    private lateinit var batteryStatusText: TextView
    private lateinit var notificationStatusText: TextView
    private lateinit var scannerStatusText: TextView
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 100
    private val NOTIFICATION_REQUEST_CODE = 2

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val matchParentParams = android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            android.view.ViewGroup.LayoutParams.MATCH_PARENT
        )

        createNotificationChannels()

        rootLayout = FrameLayout(this)
        rootLayout.layoutParams = matchParentParams

        swipeRefreshLayout = SwipeRefreshLayout(this)
        swipeRefreshLayout.layoutParams = matchParentParams

        webView = WebView(this)
        webView.layoutParams = matchParentParams
        swipeRefreshLayout.addView(webView)
        rootLayout.addView(swipeRefreshLayout)

        permissionGate = buildPermissionGate()
        rootLayout.addView(permissionGate)

        setContentView(rootLayout)

        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.loadWithOverviewMode = true
        webSettings.useWideViewPort = true
        webSettings.cacheMode = WebSettings.LOAD_DEFAULT
        webSettings.allowFileAccess = true

        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        webView.webChromeClient = object : WebChromeClient() {
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
            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefreshLayout.isRefreshing = false
            }
        }

        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            if (url.startsWith("blob:")) {
                webView.evaluateJavascript("""
                    fetch('$url')
                        .then(res => res.blob())
                        .then(blob => {
                            var reader = new FileReader();
                            reader.readAsDataURL(blob);
                            reader.onloadend = function() {
                                Android.saveBlob(reader.result, 'Trading_Report_${System.currentTimeMillis()}.pdf');
                            }
                        });
                """.trimIndent(), null)
                Toast.makeText(this, "Generating PDF...", Toast.LENGTH_SHORT).show()
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

        val targetUrl = intent.getStringExtra("target_url")
        if (targetUrl != null) {
            webView.loadUrl(targetUrl)
        } else {
            webView.loadUrl("file:///android_asset/index.html")
        }

        updatePermissionGate()
    }

    override fun onResume() {
        super.onResume()
        updatePermissionGate()
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
                "amy_alerts_v2",
                "Trading Alerts",
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

    private fun updatePermissionGate(forceToast: Boolean = false) {
        if (!::permissionGate.isInitialized) return

        val batteryOk = isBatteryOptimizationDisabled()
        val notificationOk = isNotificationPermissionGranted()
        val ready = batteryOk && notificationOk

        batteryStatusText.text = if (batteryOk) "✅ Battery Optimization: Unrestricted" else "❌ Battery Optimization: belum Unrestricted"
        notificationStatusText.text = if (notificationOk) "✅ Notifikasi: aktif" else "❌ Notifikasi: belum aktif"
        scannerStatusText.text = if (ready) "✅ Scanner: siap jalan di background" else "⛔ Scanner: ditahan sampai izin lengkap"

        permissionGate.visibility = if (ready) View.GONE else View.VISIBLE
        swipeRefreshLayout.isEnabled = ready

        if (forceToast) {
            Toast.makeText(this, if (ready) "Izin sudah lengkap." else "Masih ada izin yang belum aktif.", Toast.LENGTH_SHORT).show()
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
        return isBatteryOptimizationDisabled() && isNotificationPermissionGranted()
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
        intent?.getStringExtra("target_url")?.let {
            if (webView.url != it) {
                webView.loadUrl(it)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return
            val result = if (data == null || resultCode != Activity.RESULT_OK) null else arrayOf(data.data!!)
            fileUploadCallback?.onReceiveValue(result)
            fileUploadCallback = null
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    inner class WebAppInterface(private val mContext: Context) {
        @JavascriptInterface
        fun showAppToast(message: String) {
            (mContext as Activity).runOnUiThread {
                Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show()
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
        fun startBackgroundScanner(apiKey: String?, bsl: String?, ssl: String?) {
            try {
                if (!this@MainActivity.hasRequiredPermissions()) {
                    (mContext as Activity).runOnUiThread {
                        this@MainActivity.updatePermissionGate(true)
                    }
                    return
                }

                if (!apiKey.isNullOrEmpty() && apiKey != "undefined") {
                    val prefs = mContext.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)
                    prefs.edit().putString("api_key", apiKey).apply()
                }
                val intent = Intent(mContext, ScannerService::class.java).apply {
                    putExtra("bsl", bsl)
                    putExtra("ssl", ssl)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    mContext.startForegroundService(intent)
                } else {
                    mContext.startService(intent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun stopBackgroundScanner() {
            try {
                val intent = Intent(mContext, ScannerService::class.java)
                intent.action = "STOP_SCANNER"
                mContext.startService(intent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
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
        fun showNotification(title: String, message: String) {
            showNotificationWithUrl(title, message, null)
        }

        @JavascriptInterface
        fun showNotificationWithUrl(title: String, message: String, url: String?) {
            try {
                val intent = Intent(mContext, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    if (url != null) {
                        putExtra("target_url", url)
                    }
                }
                val requestCode = System.currentTimeMillis().toInt()
                val pendingIntent = PendingIntent.getActivity(
                    mContext, requestCode, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Notification.Builder(mContext, "amy_alerts_v2")
                } else {
                    @Suppress("DEPRECATION")
                    Notification.Builder(mContext)
                        .setPriority(Notification.PRIORITY_HIGH)
                }

                val notification = builder
                    .setSmallIcon(android.R.drawable.ic_dialog_alert)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(Notification.BigTextStyle().bigText(message))
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                    .setVibrate(longArrayOf(0, 500, 250, 500))
                    .build()

                val nm = mContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(System.currentTimeMillis().toInt(), notification)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        private var currentFileOutputStream: FileOutputStream? = null

        @JavascriptInterface
        fun startFile(filename: String) {
            try {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val file = File(downloadsDir, filename)
                currentFileOutputStream = FileOutputStream(file, false)
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
                currentFileOutputStream?.flush()
                currentFileOutputStream?.close()
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
        fun saveBlob(base64Data: String, filename: String) {
            try {
                val cleanBase64 = base64Data.replaceFirst("^data:.*?;base64,".toRegex(), "")
                val fileAsBytes = Base64.decode(cleanBase64, 0)

                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()

                val file = File(downloadsDir, filename)
                val os = FileOutputStream(file, false)
                os.write(fileAsBytes)
                os.flush()
                os.close()

                (mContext as Activity).runOnUiThread {
                    Toast.makeText(mContext, "File tersimpan di folder Download", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                (mContext as Activity).runOnUiThread {
                    Toast.makeText(mContext, "Gagal menyimpan file", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
