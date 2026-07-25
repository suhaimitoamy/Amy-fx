from pathlib import Path

main_path = Path("app/src/main/java/com/amyelitesuite/MainActivity.kt")
text = main_path.read_text(encoding="utf-8")

replacements = [
    (
        "import androidx.swiperefreshlayout.widget.SwipeRefreshLayout\nimport androidx.webkit.WebViewAssetLoader",
        "import androidx.core.content.ContextCompat\nimport androidx.swiperefreshlayout.widget.SwipeRefreshLayout\nimport androidx.webkit.WebViewAssetLoader"
    ),
    (
        "import java.io.OutputStream\nimport org.json.JSONArray",
        "import java.io.OutputStream\nimport java.util.UUID\nimport org.json.JSONArray"
    ),
    (
        "private const val ERROR_URL = \"${APP_ASSET_PREFIX}error.html\"\n\nclass MainActivity : Activity() {",
        '''private const val ERROR_URL = "${APP_ASSET_PREFIX}error.html"

private data class BackgroundVideoTransferSession(
    val id: String,
    val file: File,
    val outputStream: FileOutputStream,
    val expectedSize: Long,
    var nextChunkIndex: Int = 0,
    var writtenBytes: Long = 0L
)

class MainActivity : Activity() {'''
    ),
    (
        "webSettings.domStorageEnabled = true\n        webSettings.loadWithOverviewMode = true",
        "webSettings.domStorageEnabled = true\n        webSettings.mediaPlaybackRequiresUserGesture = false\n        webSettings.loadWithOverviewMode = true"
    ),
    (
        '''    override fun onPause() {
        if (::webView.isInitialized) webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
        if (::nativeUpdater.isInitialized) nativeUpdater.resumePendingInstall()
        updatePermissionGate()
    }''',
        '''    override fun onPause() {
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
    }'''
    ),
    (
        '''    inner class WebAppInterface(private val mContext: Context) {
        @JavascriptInterface
        fun getElapsedRealtimeMs(): Long {''',
        '''    inner class WebAppInterface(private val mContext: Context) {
        private var backgroundVideoTransfer: BackgroundVideoTransferSession? = null

        @JavascriptInterface
        fun getElapsedRealtimeMs(): Long {'''
    ),
    (
        '''        @JavascriptInterface
        fun getNativeCandles(symbol: String?, timeframe: String?, limit: String?): String {''',
        '''        @JavascriptInterface
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
            if (source.isBlank()) return false
            return try {
                val intent = Intent(mContext, BackgroundVideoPlaybackService::class.java).apply {
                    action = BackgroundVideoPlaybackService.ACTION_PLAY
                    putExtra(BackgroundVideoPlaybackService.EXTRA_SOURCE, source)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_SOURCE_KEY, sourceKey)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_TITLE, title)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_POSITION_MS, positionMsText.toLongOrNull() ?: 0L)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_LOOP, loop)
                    putExtra(BackgroundVideoPlaybackService.EXTRA_TEMP_PATH, tempPath)
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
        fun getNativeCandles(symbol: String?, timeframe: String?, limit: String?): String {'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"MainActivity patch pattern count={count}: {old[:120]!r}")
    text = text.replace(old, new)

main_path.write_text(text, encoding="utf-8")

index_path = Path("app/src/main/assets/apps/journal/index.html")
index = index_path.read_text(encoding="utf-8")
old_script = '    <script src="./app.js?v=20260725-restore1" defer></script>'
new_script = old_script + '\n    <script src="./background-video.js?v=20260725-bg1" defer></script>'
if index.count(old_script) != 1:
    raise SystemExit(f"index script pattern count={index.count(old_script)}")
index_path.write_text(index.replace(old_script, new_script), encoding="utf-8")
