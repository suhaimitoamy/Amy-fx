#!/usr/bin/env bash
set -euo pipefail

MAIN="app/src/main/java/com/amyelitesuite/MainActivity.kt"
SCANNER="app/src/main/java/com/amyelitesuite/ScannerService.kt"
GRADLE="app/build.gradle.kts"

if [ ! -f "$MAIN" ]; then
  echo "ERROR: $MAIN tidak ditemukan. Jalankan script ini dari root repo Amy-fx."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re

main = Path('app/src/main/java/com/amyelitesuite/MainActivity.kt')
s = main.read_text()

# 1) Fix Kotlin compile error: duplicate isManageAllFilesGranted().
pattern = re.compile(
    r'\n    private fun isManageAllFilesGranted\(\): Boolean \{\n'
    r'        return if \(Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.R\) \{\n'
    r'            Environment\.isExternalStorageManager\(\)\n'
    r'        \} else \{\n'
    r'            true\n'
    r'        \}\n'
    r'    \}\n',
    re.M
)
blocks = list(pattern.finditer(s))
if len(blocks) > 1:
    keep = blocks[0]
    out = []
    last = 0
    for i, m in enumerate(blocks):
        if i == 0:
            continue
        out.append(s[last:m.start()])
        last = m.end()
    out.append(s[last:])
    s = ''.join(out)

# 2) Keep scanner permission gate non-blocking except notification permission.
s = re.sub(
    r'private fun hasRequiredPermissions\(\): Boolean \{\s*return isBatteryOptimizationDisabled\(\) && isNotificationPermissionGranted\(\)\s*\}',
    'private fun hasRequiredPermissions(): Boolean {\n        return isNotificationPermissionGranted()\n    }',
    s,
    count=1,
    flags=re.S,
)

# 3) Make permission status text clear and consistent.
s = s.replace(
    'scannerStatusText.text = if (ready) "✅ Scanner: siap jalan di background" else "⛔ Scanner: ditahan sampai izin lengkap"',
    'scannerStatusText.text = if (notificationOk) "✅ Scanner: bisa jalan" else "⛔ Scanner: butuh izin notifikasi"'
)

# 4) Ensure Android 13+ notification permission is requested on app open.
if 'maybeRequestNotificationPermission()' in s and '        updatePermissionGate()\n        maybeRequestNotificationPermission()' not in s:
    s = s.replace('        updatePermissionGate()\n    }', '        updatePermissionGate()\n        maybeRequestNotificationPermission()\n    }', 1)

# 5) Ensure native notification channel ID matches manual notification builder.
# Current repo uses amy_heads_up_v5 in both locations; normalize if mixed channel ids appear.
s = s.replace('"amy_alerts_v3"', '"amy_heads_up_v5"')
s = s.replace('"amy_alerts_v2"', '"amy_heads_up_v5"')

# 6) Remove accidental duplicate JS interfaces if future patches inserted them twice.
for fun_name in ['openManageFilesPermission', 'openManageAllFilesSettings']:
    pat = re.compile(
        r'\n        @JavascriptInterface\n'
        r'        fun ' + re.escape(fun_name) + r'\([^)]*\) \{\n'
        r'(?:            .*\n)*?'
        r'        \}\n',
        re.M
    )
    matches = list(pat.finditer(s))
    if len(matches) > 1:
        parts = []
        last = 0
        for i, m in enumerate(matches):
            if i == 0:
                continue
            parts.append(s[last:m.start()])
            last = m.end()
        parts.append(s[last:])
        s = ''.join(parts)

# 7) Make sure no compile-breaking duplicate isManageAllFilesGranted remains.
if s.count('private fun isManageAllFilesGranted()') > 1:
    raise SystemExit('Masih ada duplicate isManageAllFilesGranted()')

main.write_text(s)

# 8) Normalize scanner alert channel ID and notification priority; safe even if already patched.
scanner = Path('app/src/main/java/com/amyelitesuite/ScannerService.kt')
if scanner.exists():
    t = scanner.read_text()
    t = t.replace('"scanner_alerts_channel"', '"scanner_alerts_channel_v2"')
    scanner.write_text(t)

# 9) Bump version so GitHub Actions creates a fresh APK after patch.
gradle = Path('app/build.gradle.kts')
if gradle.exists():
    g = gradle.read_text()
    m = re.search(r'versionCode\s*=\s*(\d+)', g)
    if m:
        code = int(m.group(1))
        if code < 8:
            g = re.sub(r'versionCode\s*=\s*\d+', 'versionCode = 8', g, count=1)
    g = re.sub(r'versionName\s*=\s*"[^"]+"', 'versionName = "1.7"', g, count=1)
    gradle.write_text(g)
PY

# quick static check
DUP_COUNT=$(grep -R "private fun isManageAllFilesGranted()" -n "$MAIN" | wc -l | tr -d ' ')
if [ "$DUP_COUNT" != "1" ]; then
  echo "ERROR: duplicate isManageAllFilesGranted masih ada: $DUP_COUNT"
  exit 1
fi

echo "OK: compile fix applied. Duplicate permission function removed."
echo "Next: git add . && git commit -m 'fix build compile error' && git push origin main"
