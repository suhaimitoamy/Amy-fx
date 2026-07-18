package com.amyfx.signcheck

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.text.method.ScrollingMovementMethod
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.security.MessageDigest
import java.util.Locale

class MainActivity : Activity() {
    private val targetPackage = "com.amyelitesuite"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val report = buildReport()
        val padding = (20 * resources.displayMetrics.density).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            setBackgroundColor(Color.rgb(245, 245, 245))
        }

        val title = TextView(this).apply {
            text = "Amy FX — Pemeriksa Aplikasi Terpasang"
            textSize = 21f
            setTextColor(Color.BLACK)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }

        val explanation = TextView(this).apply {
            text = "Alat ini hanya membaca identitas paket dan sertifikat Amy FX. Catatan dan data aplikasi tidak disentuh."
            textSize = 15f
            setTextColor(Color.DKGRAY)
            setPadding(0, padding / 2, 0, padding)
        }

        val result = TextView(this).apply {
            text = report
            textSize = 15f
            setTextColor(Color.BLACK)
            setTextIsSelectable(true)
            typeface = android.graphics.Typeface.MONOSPACE
            movementMethod = ScrollingMovementMethod()
            setPadding(padding / 2, padding / 2, padding / 2, padding / 2)
            setBackgroundColor(Color.WHITE)
        }

        val copyButton = Button(this).apply {
            text = "Salin Hasil"
            setOnClickListener {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Amy FX Sign Check", report))
                Toast.makeText(this@MainActivity, "Hasil disalin", Toast.LENGTH_SHORT).show()
            }
        }

        val closeButton = Button(this).apply {
            text = "Tutup"
            setOnClickListener { finish() }
        }

        val resultParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        )
        val buttonParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = padding / 2 }

        root.addView(title)
        root.addView(explanation)
        root.addView(result, resultParams)
        root.addView(copyButton, buttonParams)
        root.addView(closeButton, buttonParams)
        root.gravity = Gravity.CENTER_HORIZONTAL

        setContentView(root)
    }

    @Suppress("DEPRECATION")
    private fun buildReport(): String {
        return try {
            val packageInfo = installedPackageInfo(targetPackage)
            val appInfo = packageManager.getApplicationInfo(targetPackage, 0)
            val signers = signerDigests(packageInfo)
            val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.longVersionCode
            } else {
                packageInfo.versionCode.toLong()
            }
            val isDebuggable = appInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

            buildString {
                appendLine("PACKAGE: ${packageInfo.packageName}")
                appendLine("VERSION_NAME: ${packageInfo.versionName ?: "(kosong)"}")
                appendLine("VERSION_CODE_NATIVE: $versionCode")
                appendLine("DEBUGGABLE: $isDebuggable")
                appendLine("SOURCE_DIR: ${appInfo.sourceDir}")
                appendLine("SIGNER_COUNT: ${signers.size}")
                signers.forEachIndexed { index, digest ->
                    appendLine("SIGNER_${index + 1}_SHA256: $digest")
                }
            }.trim()
        } catch (error: PackageManager.NameNotFoundException) {
            "Amy FX dengan package $targetPackage tidak ditemukan."
        } catch (error: Throwable) {
            "Gagal membaca Amy FX: ${error.javaClass.simpleName}: ${error.message ?: "unknown"}"
        }
    }

    @Suppress("DEPRECATION")
    private fun installedPackageInfo(packageName: String): PackageInfo {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        return packageManager.getPackageInfo(packageName, flags)
    }

    @Suppress("DEPRECATION")
    private fun signerDigests(info: PackageInfo): List<String> {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = info.signingInfo ?: return emptyList()
            signingInfo.apkContentsSigners
                ?.takeIf { it.isNotEmpty() }
                ?: signingInfo.signingCertificateHistory
                ?: emptyArray()
        } else {
            info.signatures ?: emptyArray()
        }

        return signatures
            .map { signature -> sha256(signature.toByteArray()) }
            .distinct()
            .sorted()
    }

    private fun sha256(bytes: ByteArray): String {
        return MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString(":") { byte -> "%02X".format(Locale.US, byte) }
    }
}
