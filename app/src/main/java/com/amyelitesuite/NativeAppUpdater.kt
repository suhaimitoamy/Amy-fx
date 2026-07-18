package com.amyelitesuite

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.WebView
import androidx.core.content.FileProvider
import java.io.File
import java.security.MessageDigest
import java.util.Locale
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject

class NativeAppUpdater(
    private val activity: Activity,
    private val webView: WebView
) {
    private val client = OkHttpClient.Builder()
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    @Volatile
    private var activeCall: Call? = null

    @Volatile
    private var pendingInstall: File? = null

    fun start(downloadUrl: String, expectedVersionName: String, expectedVersionCode: Int) {
        val safeUri = runCatching { Uri.parse(downloadUrl) }.getOrNull()
        if (!isAllowedDownloadUri(safeUri)) {
            emitError("Alamat update tidak diizinkan.")
            return
        }
        if (expectedVersionCode <= currentVersionCode()) {
            emitError("Versi update tidak lebih baru dari versi terpasang.")
            return
        }

        cancel(deletePending = true)
        val updateDir = File(activity.cacheDir, "updates").apply { mkdirs() }
        val partialFile = File(updateDir, "AmyFX-update.apk.part")
        val finalFile = File(updateDir, "AmyFX-update.apk")
        partialFile.delete()
        finalFile.delete()

        emitState("starting", "Menyiapkan unduhan Amy FX $expectedVersionName...")
        val request = Request.Builder()
            .url(downloadUrl)
            .header("Accept", "application/vnd.android.package-archive,application/octet-stream,*/*")
            .header("User-Agent", "AmyFX-Native-Updater/${BuildConfig.VERSION_NAME}")
            .build()
        val call = client.newCall(request)
        activeCall = call
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, error: java.io.IOException) {
                if (call.isCanceled()) {
                    emitState("cancelled", "Unduhan dibatalkan.")
                } else {
                    emitError("Unduhan gagal: ${error.message ?: "koneksi terputus"}")
                }
                partialFile.delete()
                if (activeCall === call) activeCall = null
            }

            override fun onResponse(call: Call, response: Response) {
                response.use { result ->
                    try {
                        if (!result.isSuccessful) error("Server mengembalikan HTTP ${result.code}")
                        val body = result.body ?: error("File update kosong")
                        val total = body.contentLength()
                        if (total in 0 until MIN_APK_BYTES) error("Ukuran APK tidak valid")

                        emitState("downloading", "Mengunduh pembaruan...")
                        body.byteStream().use { input ->
                            partialFile.outputStream().buffered().use { output ->
                                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                                var downloaded = 0L
                                var lastPercent = -1
                                while (true) {
                                    if (call.isCanceled()) error("CANCELLED")
                                    val count = input.read(buffer)
                                    if (count < 0) break
                                    output.write(buffer, 0, count)
                                    downloaded += count
                                    val percent = if (total > 0) ((downloaded * 100L) / total).toInt().coerceIn(0, 100) else -1
                                    if (percent != lastPercent) {
                                        lastPercent = percent
                                        emitProgress(percent, downloaded, total)
                                    }
                                }
                            }
                        }

                        if (partialFile.length() < MIN_APK_BYTES) error("APK yang diterima terlalu kecil")
                        if (!hasZipHeader(partialFile)) error("File yang diterima bukan APK")
                        if (!partialFile.renameTo(finalFile)) {
                            partialFile.copyTo(finalFile, overwrite = true)
                            partialFile.delete()
                        }

                        emitState("verifying", "Memverifikasi package, versi, dan tanda tangan...")
                        verifyApk(finalFile, expectedVersionName, expectedVersionCode)
                        pendingInstall = finalFile
                        emitProgress(100, finalFile.length(), finalFile.length())
                        requestInstallPermissionOrOpenInstaller()
                    } catch (error: Throwable) {
                        partialFile.delete()
                        finalFile.delete()
                        pendingInstall = null
                        if (error.message == "CANCELLED" || call.isCanceled()) {
                            emitState("cancelled", "Unduhan dibatalkan.")
                        } else {
                            emitError(error.message ?: "Pembaruan gagal diverifikasi.")
                        }
                    } finally {
                        if (activeCall === call) activeCall = null
                    }
                }
            }
        })
    }

    fun cancel(deletePending: Boolean = false) {
        activeCall?.cancel()
        activeCall = null
        if (deletePending) {
            pendingInstall?.delete()
            pendingInstall = null
            File(activity.cacheDir, "updates/AmyFX-update.apk.part").delete()
        }
    }

    fun resumePendingInstall() {
        val file = pendingInstall ?: return
        if (!file.exists()) {
            pendingInstall = null
            return
        }
        if (canInstallPackages()) openInstaller(file)
    }

    private fun requestInstallPermissionOrOpenInstaller() {
        val file = pendingInstall ?: return
        if (canInstallPackages()) {
            openInstaller(file)
            return
        }
        emitState("permission", "Izinkan Amy FX memasang pembaruan, lalu kembali ke aplikasi.")
        activity.runOnUiThread {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            runCatching { activity.startActivity(intent) }
                .onFailure { emitError("Buka Pengaturan > Instal aplikasi tidak dikenal > Amy FX.") }
        }
    }

    private fun canInstallPackages(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.packageManager.canRequestPackageInstalls()
    }

    private fun openInstaller(file: File) {
        emitState("ready", "Unduhan selesai. Membuka konfirmasi instalasi Android...")
        activity.runOnUiThread {
            try {
                val uri = FileProvider.getUriForFile(
                    activity,
                    "${activity.packageName}.fileprovider",
                    file
                )
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, APK_MIME)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
            } catch (error: Throwable) {
                emitError("Installer Android tidak dapat dibuka: ${error.message ?: "unknown error"}")
            }
        }
    }

    private fun verifyApk(file: File, expectedVersionName: String, expectedVersionCode: Int) {
        val archive = packageInfoForArchive(file)
            ?: error("Android tidak dapat membaca identitas APK")
        if (archive.packageName != activity.packageName) {
            error("Package APK tidak cocok: ${archive.packageName}")
        }
        val archiveVersionCode = versionCodeOf(archive)
        if (archiveVersionCode != expectedVersionCode.toLong()) {
            error("Version code APK $archiveVersionCode tidak sesuai metadata $expectedVersionCode")
        }
        if (!archive.versionName.isNullOrBlank() && expectedVersionName.isNotBlank() && archive.versionName != expectedVersionName) {
            error("Nama versi APK ${archive.versionName} tidak sesuai metadata $expectedVersionName")
        }
        if (archiveVersionCode <= currentVersionCode()) {
            error("APK bukan versi yang lebih baru")
        }

        val installedSigners = signerDigests(installedPackageInfo())
        val archiveSigners = signerDigests(archive)
        if (installedSigners.isEmpty()) {
            error("Sertifikat Amy FX terpasang tidak dapat dibaca")
        }
        if (archiveSigners.isEmpty()) {
            error("Sertifikat APK update tidak dapat dibaca")
        }
        if (installedSigners != archiveSigners) {
            error("Tanda tangan APK tidak cocok dengan Amy FX terpasang")
        }
    }

    @Suppress("DEPRECATION")
    private fun packageInfoForArchive(file: File): PackageInfo? {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        return activity.packageManager.getPackageArchiveInfo(file.absolutePath, flags)
    }

    @Suppress("DEPRECATION")
    private fun installedPackageInfo(): PackageInfo {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        return activity.packageManager.getPackageInfo(activity.packageName, flags)
    }

    @Suppress("DEPRECATION")
    private fun signerDigests(info: PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = info.signingInfo ?: return emptySet()
            // Compare the certificate that signs the current APK contents. Using
            // signingCertificateHistory for a downloaded archive produces false
            // negatives on some Android/OEM PackageManager implementations.
            signingInfo.apkContentsSigners
                .takeIf { it.isNotEmpty() }
                ?: signingInfo.signingCertificateHistory
        } else {
            info.signatures ?: emptyArray()
        }
        return signatures.map { signature -> sha256(signature.toByteArray()) }.toSet()
    }

    private fun sha256(bytes: ByteArray): String {
        return MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { byte -> "%02x".format(Locale.US, byte) }
    }

    @Suppress("DEPRECATION")
    private fun currentVersionCode(): Long {
        val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
        return versionCodeOf(info)
    }

    @Suppress("DEPRECATION")
    private fun versionCodeOf(info: PackageInfo): Long {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
    }

    private fun hasZipHeader(file: File): Boolean {
        if (file.length() < 4) return false
        return file.inputStream().use { input ->
            val header = ByteArray(4)
            input.read(header) == 4 && header[0] == 0x50.toByte() && header[1] == 0x4b.toByte()
        }
    }

    private fun isAllowedDownloadUri(uri: Uri?): Boolean {
        if (uri?.scheme != "https") return false
        val host = uri.host?.lowercase(Locale.US) ?: return false
        return host == "github.com" ||
            host.endsWith(".github.com") ||
            host == "githubusercontent.com" ||
            host.endsWith(".githubusercontent.com")
    }

    private fun emitProgress(percent: Int, downloaded: Long, total: Long) {
        emitJavascript("window.AmyFXUpdateNative?.onProgress?.($percent,$downloaded,$total)")
    }

    private fun emitState(state: String, message: String) {
        emitJavascript(
            "window.AmyFXUpdateNative?.onState?.(${JSONObject.quote(state)},${JSONObject.quote(message)})"
        )
    }

    private fun emitError(message: String) {
        emitJavascript("window.AmyFXUpdateNative?.onError?.(${JSONObject.quote(message)})")
    }

    private fun emitJavascript(script: String) {
        activity.runOnUiThread {
            if (!activity.isFinishing && !activity.isDestroyed) {
                webView.evaluateJavascript("(function(){try{$script}catch(e){console.log(e)}})();", null)
            }
        }
    }

    companion object {
        private const val APK_MIME = "application/vnd.android.package-archive"
        private const val MIN_APK_BYTES = 1_000_000L
    }
}
