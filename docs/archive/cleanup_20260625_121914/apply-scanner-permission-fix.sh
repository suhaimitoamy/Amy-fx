#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
MAIN="app/src/main/java/com/amyelitesuite/MainActivity.kt"
SCANNER="app/src/main/java/com/amyelitesuite/ScannerService.kt"
GRADLE="app/build.gradle.kts"

python3 - <<'PY'
from pathlib import Path
import re

main = Path('app/src/main/java/com/amyelitesuite/MainActivity.kt')
s = main.read_text()

# Auto request Android 13+ notification permission because permission gate is hidden/non-blocking.
if 'maybeRequestNotificationPermission()' not in s:
    s = s.replace('''        updatePermissionGate()\n    }''', '''        updatePermissionGate()\n        maybeRequestNotificationPermission()\n    }''', 1)

# Make scanner start blocking only depend on POST_NOTIFICATIONS, not battery optimization.
s = re.sub(
    r'''    private fun hasRequiredPermissions\(\): Boolean \{\n        return isBatteryOptimizationDisabled\(\) && isNotificationPermissionGranted\(\)\n    \}\n''',
    '''    private fun hasRequiredPermissions(): Boolean {\n        // Scanner may run even if battery optimization or manage-all-files is not granted.\n        // The only hard gate for visible alerts is Android notification permission.\n        return isNotificationPermissionGranted()\n    }\n\n    private fun isManageAllFilesGranted(): Boolean {\n        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {\n            Environment.isExternalStorageManager()\n        } else {\n            true\n        }\n    }\n\n    private fun maybeRequestNotificationPermission() {\n        if (Build.VERSION.SDK_INT >= 33 && !isNotificationPermissionGranted()) {\n            requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"), NOTIFICATION_REQUEST_CODE)\n        }\n    }\n''',
    s,
    count=1,
)

# Add native manage-all-files opener if missing.
if 'private fun openManageAllFilesSettingsInternal()' not in s:
    s = s.replace('''    private fun openAppSettings() {\n        try {\n            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {\n                data = Uri.parse("package:$packageName")\n            }\n            startActivity(intent)\n        } catch (e: Exception) {\n            Toast.makeText(this, "Buka Settings > Apps > Amy FX", Toast.LENGTH_LONG).show()\n        }\n    }\n''', '''    private fun openAppSettings() {\n        try {\n            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {\n                data = Uri.parse("package:$packageName")\n            }\n            startActivity(intent)\n        } catch (e: Exception) {\n            Toast.makeText(this, "Buka Settings > Apps > Amy FX", Toast.LENGTH_LONG).show()\n        }\n    }\n\n    private fun openManageAllFilesSettingsInternal() {\n        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {\n            openAppSettings()\n            return\n        }\n        try {\n            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {\n                data = Uri.parse("package:$packageName")\n            }\n            startActivity(intent)\n        } catch (e: Exception) {\n            try {\n                startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))\n            } catch (ignored: Exception) {\n                openAppSettings()\n            }\n        }\n    }\n''', 1)

# Expose it to JS Mapping/Jurnal buttons.
if 'fun openManageAllFilesSettings()' not in s:
    s = s.replace('''        @JavascriptInterface\n        fun showAppToast(message: String) {\n            (mContext as Activity).runOnUiThread {\n                Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show()\n            }\n        }\n''', '''        @JavascriptInterface\n        fun showAppToast(message: String) {\n            (mContext as Activity).runOnUiThread {\n                Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show()\n            }\n        }\n\n        @JavascriptInterface\n        fun openManageAllFilesSettings() {\n            (mContext as Activity).runOnUiThread {\n                this@MainActivity.openManageAllFilesSettingsInternal()\n            }\n        }\n''', 1)

# Improve status copy so battery/manage-all-files are warnings, not blockers.
s = s.replace('''        scannerStatusText.text = if (ready) "✅ Scanner: siap jalan di background" else "⛔ Scanner: ditahan sampai izin lengkap"''', '''        scannerStatusText.text = if (notificationOk) "✅ Scanner: bisa jalan" else "⛔ Scanner: butuh izin notifikasi"''')

# Start scanner: request notification if missing, but do not block on battery optimization.
s = s.replace('''                if (!this@MainActivity.hasRequiredPermissions()) {\n                    (mContext as Activity).runOnUiThread {\n                        this@MainActivity.updatePermissionGate(true)\n                    }\n                    return\n                }\n''', '''                if (!this@MainActivity.hasRequiredPermissions()) {\n                    (mContext as Activity).runOnUiThread {\n                        this@MainActivity.maybeRequestNotificationPermission()\n                        Toast.makeText(mContext, "Aktifkan izin notifikasi agar alert mengambang muncul.", Toast.LENGTH_LONG).show()\n                    }\n                    return\n                }\n''')

# Force a fresh high-importance alert channel id for manual notifications.
s = s.replace('''"amy_alerts_v2"''', '''"amy_alerts_v3"''')

# Strengthen heads-up hints for manual notification builder.
s = s.replace('''                    .setAutoCancel(true)\n                    .setContentIntent(pendingIntent)\n                    .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))\n                    .setVibrate(longArrayOf(0, 500, 250, 500))\n                    .build()''', '''                    .setAutoCancel(true)\n                    .setContentIntent(pendingIntent)\n                    .setPriority(Notification.PRIORITY_HIGH)\n                    .setCategory(Notification.CATEGORY_ALARM)\n                    .setVisibility(Notification.VISIBILITY_PUBLIC)\n                    .setDefaults(Notification.DEFAULT_ALL)\n                    .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))\n                    .setVibrate(longArrayOf(0, 500, 250, 500))\n                    .build()''', 1)

main.write_text(s)

scanner = Path('app/src/main/java/com/amyelitesuite/ScannerService.kt')
s = scanner.read_text()
# Use fresh channel id so Android does not keep an old channel importance.
s = s.replace('''"scanner_alerts_channel"''', '''"scanner_alerts_channel_v2"''')
# Make scanner market alerts more likely to show heads-up.
s = s.replace('''                .setContentIntent(pendingIntent)\n                .setAutoCancel(true)\n                .build()''', '''                .setContentIntent(pendingIntent)\n                .setPriority(Notification.PRIORITY_HIGH)\n                .setCategory(Notification.CATEGORY_ALARM)\n                .setVisibility(Notification.VISIBILITY_PUBLIC)\n                .setDefaults(Notification.DEFAULT_ALL)\n                .setAutoCancel(true)\n                .build()''', 1)
s = s.replace('''                .setContentIntent(pendingIntent)\n                .setAutoCancel(true)\n                .build()''', '''                .setContentIntent(pendingIntent)\n                .setPriority(Notification.PRIORITY_HIGH)\n                .setCategory(Notification.CATEGORY_ALARM)\n                .setVisibility(Notification.VISIBILITY_PUBLIC)\n                .setDefaults(Notification.DEFAULT_ALL)\n                .setAutoCancel(true)\n                .build()''', 1)
# Channel settings for new scanner alert channel.
s = s.replace('''                description = "Amy FX scanner market alerts"\n                enableVibration(true)\n                enableLights(true)\n            }''', '''                description = "Amy FX scanner market alerts"\n                enableVibration(true)\n                enableLights(true)\n                val audioAttributes = android.media.AudioAttributes.Builder()\n                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)\n                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)\n                    .build()\n                setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION), audioAttributes)\n            }''', 1)
scanner.write_text(s)

# Bump versionCode/versionName.
gradle = Path('app/build.gradle.kts')
g = gradle.read_text()
m = re.search(r'versionCode\s*=\s*(\d+)', g)
if m:
    code = int(m.group(1))
    g = re.sub(r'versionCode\s*=\s*\d+', f'versionCode = {code + 1}', g, count=1)
vm = re.search(r'versionName\s*=\s*"([^"]+)"', g)
if vm:
    g = re.sub(r'versionName\s*=\s*"[^"]+"', 'versionName = "1.5"', g, count=1)
gradle.write_text(g)
PY

cat > SCANNER_PERMISSION_FIX_NOTES.md <<'EOF'
# Scanner Permission Fix

Perbaikan:
- Scanner tidak lagi diblokir oleh Battery Optimization / Manage All Files.
- Scanner hanya memblokir jika izin notifikasi Android belum aktif.
- Aplikasi otomatis meminta izin notifikasi Android 13+ saat dibuka.
- Native bridge `Android.openManageAllFilesSettings()` ditambahkan.
- Channel notifikasi manual diganti ke `amy_alerts_v3` agar importance lama tidak nyangkut.
- Channel alert scanner diganti ke `scanner_alerts_channel_v2` agar heads-up lebih mungkin muncul.
- Alert notification diberi priority high, category alarm, public visibility, defaults sound/vibrate.
EOF
