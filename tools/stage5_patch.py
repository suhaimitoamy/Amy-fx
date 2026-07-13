from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_NAME = "1.4.6"
VERSION_CODE = 29
SIGNING_SHA256 = "47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


# Version surfaces.
replace_once(
    "app/build.gradle.kts",
    'versionCode = (System.getenv("AMYFX_VERSION_CODE")?.toIntOrNull() ?: 28)\n        versionName = System.getenv("AMYFX_VERSION_NAME") ?: "1.4.5"',
    'versionCode = (System.getenv("AMYFX_VERSION_CODE")?.toIntOrNull() ?: 29)\n        versionName = System.getenv("AMYFX_VERSION_NAME") ?: "1.4.6"',
)
replace_once(
    "app/src/main/assets/app-version.js",
    "const VERSION = Object.freeze({ name: '1.4.5', code: 28 });",
    "const VERSION = Object.freeze({ name: '1.4.6', code: 29 });",
)
replace_once(
    "app/src/main/assets/update-checker.js",
    "const VERSION = window.AmyFXAppVersion || { name: '1.4.3', code: 26 };\n  const CURRENT_VERSION_CODE = Number(VERSION.code) || 26;\n  const CURRENT_VERSION_NAME = String(VERSION.name || '1.4.3');",
    "const VERSION = window.AmyFXAppVersion || { name: '1.4.6', code: 29 };\n  const CURRENT_VERSION_CODE = Number(VERSION.code) || 29;\n  const CURRENT_VERSION_NAME = String(VERSION.name || '1.4.6');",
)
replace_once(
    "README.md",
    "> **Versi:** `1.4.0`  \n> **Version code:** `23`",
    "> **Versi:** `1.4.6`  \n> **Version code:** `29`",
)

# Remove obsolete client-side TwelveData credential persistence. The app uses the server proxy.
replace_once(
    "app/src/main/assets/apps/mapping/js/main.js",
    "key: localStorage.getItem('twelve_api_key') || '',",
    "key: '',",
)
replace_once(
    "app/src/main/assets/apps/mapping/js/main.js",
    "function initApp() {\n  document.querySelectorAll('.nav button')",
    "function initApp() {\n  try { localStorage.removeItem('twelve_api_key'); } catch (_) {}\n\n  document.querySelectorAll('.nav button')",
)
replace_once(
    "app/src/main/assets/apps/mapping/js/bridge/android-bridge.js",
    "export function saveConnect() {\n  const input = document.getElementById('apiKey');\n  state.key = input?.value?.trim() || state.key || '';\n  if (state.key) localStorage.setItem('twelve_api_key', state.key);\n\n  state.bg = true;",
    "export function saveConnect() {\n  state.key = '';\n  try { localStorage.removeItem('twelve_api_key'); } catch (_) {}\n  const input = document.getElementById('apiKey');\n  if (input) input.value = '';\n\n  state.bg = true;",
)

# Native bridge no longer writes a proxy marker or API key to plain/encrypted preferences.
replace_once(
    "app/src/main/java/com/amyelitesuite/MainActivity.kt",
    '''                val prefs = mContext.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)\n                val cleanedApiKey = apiKey?.trim()\n                val storedApiKey = prefs.getString("api_key", null)\n                if (!cleanedApiKey.isNullOrBlank() && cleanedApiKey != "undefined" && cleanedApiKey != "null") {\n                    prefs.edit().putString("api_key", cleanedApiKey).putBoolean("scanner_enabled", true).apply()\n                    SecurePrefs.putString(mContext, "api_key", cleanedApiKey)\n                } else if (storedApiKey.isNullOrBlank() && SecurePrefs.getString(mContext, "api_key", null).isNullOrBlank()) {\n                    (mContext as Activity).runOnUiThread {\n                        Toast.makeText(mContext, "API key belum tersedia. Buka Mapping > Settings lalu Save & Connect dulu.", Toast.LENGTH_LONG).show()\n                    }\n                    return\n                } else {\n                    prefs.edit().putBoolean("scanner_enabled", true).apply()\n                }''',
    '''                val prefs = mContext.getSharedPreferences("AmyFXPrefs", Context.MODE_PRIVATE)\n                prefs.edit()\n                    .remove("api_key")\n                    .putBoolean("scanner_enabled", true)\n                    .apply()\n                SecurePrefs.remove(mContext, "api_key")''',
)
replace_once(
    "app/src/main/java/com/amyelitesuite/MainActivity.kt",
    '''                    val destination = url ?: AmyFxNotificationGate.routeUrl(route)\n                    val routedUrl = if (destination.contains("apps/mapping/index.html") && !destination.contains("#")) "$destination#$route" else destination''',
    '''                    val destination = this@MainActivity.normalizeLocalUrl(url)\n                        ?: AmyFxNotificationGate.routeUrl(route)\n                    val routedUrl = if (destination.contains("apps/mapping/index.html") && !destination.contains("#")) "$destination#$route" else destination''',
)
replace_once(
    "app/src/main/java/com/amyelitesuite/MainActivity.kt",
    ".setSmallIcon(android.R.drawable.ic_dialog_alert)",
    ".setSmallIcon(R.drawable.ic_stat_amy_fx)",
)

# Harden the market proxy: environment-only key, method/interval validation and timeout.
write(
    "api/twelvedata.js",
    '''const ALLOWED_INTERVALS = new Set([\n  '1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week'\n]);\nconst MAX_OUTPUT_SIZE = 500;\nconst FETCH_TIMEOUT_MS = 12_000;\n\nfunction normalizeUtcDatetime(value) {\n  const text = String(value || '').trim();\n  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(text)) return `${text}T00:00:00Z`;\n  if (/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(text)) {\n    return `${text.replace(' ', 'T')}Z`;\n  }\n  return text;\n}\n\nfunction parseOutputSize(value) {\n  const parsed = Number.parseInt(String(value || ''), 10);\n  if (!Number.isFinite(parsed)) return 300;\n  return Math.min(Math.max(parsed, 1), MAX_OUTPUT_SIZE);\n}\n\nexport default async function handler(req, res) {\n  res.setHeader('Access-Control-Allow-Origin', '*');\n  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');\n  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');\n  res.setHeader('Vary', 'Origin');\n\n  if (req.method === 'OPTIONS') return res.status(204).end();\n  if (req.method !== 'GET') {\n    res.setHeader('Allow', 'GET, OPTIONS');\n    return res.status(405).json({ status: 'error', message: 'Method not allowed' });\n  }\n\n  const { symbol = 'XAU/USD', interval, outputsize = '300' } = req.query;\n  const targetKey = process.env.TWELVEDATA_API_KEY;\n\n  if (symbol !== 'XAU/USD') {\n    return res.status(403).json({ status: 'error', message: 'Hanya XAU/USD yang diizinkan' });\n  }\n  if (!ALLOWED_INTERVALS.has(interval)) {\n    return res.status(400).json({ status: 'error', message: 'Interval tidak didukung' });\n  }\n  if (!targetKey) {\n    return res.status(503).json({ status: 'error', message: 'Market service belum dikonfigurasi' });\n  }\n\n  const safeOutputSize = parseOutputSize(outputsize);\n  const controller = new AbortController();\n  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);\n\n  try {\n    const params = new URLSearchParams({\n      symbol,\n      interval,\n      outputsize: String(safeOutputSize),\n      timezone: 'UTC',\n      apikey: targetKey\n    });\n    const response = await fetch(`https://api.twelvedata.com/time_series?${params}`, {\n      signal: controller.signal,\n      headers: { Accept: 'application/json' }\n    });\n    if (!response.ok) {\n      return res.status(502).json({ status: 'error', message: `TwelveData HTTP ${response.status}` });\n    }\n\n    const data = await response.json();\n    if (data?.status === 'error') return res.status(502).json(data);\n\n    if (Array.isArray(data?.values)) {\n      data.values = data.values.map(item => ({\n        ...item,\n        datetime: normalizeUtcDatetime(item.datetime)\n      }));\n    }\n\n    const cacheSeconds = interval === '1min' ? 5 : 15;\n    res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`);\n    return res.status(200).json(data);\n  } catch (error) {\n    if (error?.name === 'AbortError') {\n      return res.status(504).json({ status: 'error', message: 'Market service timeout' });\n    }\n    return res.status(502).json({ status: 'error', message: 'Market service unavailable' });\n  } finally {\n    clearTimeout(timeout);\n  }\n}\n''',
)

# Version and signer pinning in CI.
for workflow in (".github/workflows/build-apk.yml", ".github/workflows/build-release.yml"):
    text = read(workflow)
    text = text.replace('AMYFX_VERSION_NAME: "1.4.5"', 'AMYFX_VERSION_NAME: "1.4.6"')
    text = text.replace('AMYFX_VERSION_CODE: "28"', 'AMYFX_VERSION_CODE: "29"')
    text = text.replace('default: "1.4.5"', 'default: "1.4.6"')
    text = text.replace('default: "28"', 'default: "29"')
    text = text.replace('description: "Version Name (e.g., 1.4.5)"', 'description: "Version Name (e.g., 1.4.6)"')
    marker = '      AMYFX_KEY_PASSWORD: android\n'
    if 'AMYFX_SIGNING_CERT_SHA256' not in text:
        if marker not in text:
            raise RuntimeError(f"Signing env marker missing in {workflow}")
        text = text.replace(marker, marker + f'      AMYFX_SIGNING_CERT_SHA256: "{SIGNING_SHA256}"\n', 1)
    old_verify = '          keytool -list -keystore "$AMYFX_KEYSTORE_PATH" -storepass android -alias androiddebugkey >/dev/null'
    new_verify = '''          actual_fingerprint="$(keytool -list -v -keystore "$AMYFX_KEYSTORE_PATH" -storepass "$AMYFX_KEYSTORE_PASSWORD" -alias "$AMYFX_KEY_ALIAS" | sed -n 's/^[[:space:]]*SHA256: //p' | head -n1)"\n          test -n "$actual_fingerprint"\n          if [ "$actual_fingerprint" != "$AMYFX_SIGNING_CERT_SHA256" ]; then\n            echo "Signing certificate berubah. Update tanpa uninstall akan gagal."\n            echo "Expected: $AMYFX_SIGNING_CERT_SHA256"\n            echo "Actual:   $actual_fingerprint"\n            exit 1\n          fi'''
    if old_verify not in text:
        raise RuntimeError(f"Signing verification marker missing in {workflow}")
    text = text.replace(old_verify, new_verify, 1)
    write(workflow, text)

# Serialize rolling releases and make metadata activation start from the latest main.
build_apk = read(".github/workflows/build-apk.yml")
if "concurrency:\n  group: amyfx-release-main" not in build_apk:
    build_apk = build_apk.replace(
        "permissions:\n  contents: write\n",
        "permissions:\n  contents: write\n\nconcurrency:\n  group: amyfx-release-main\n  cancel-in-progress: false\n",
        1,
    )
build_apk = build_apk.replace(
    '          git checkout -B release-metadata "$GITHUB_SHA"',
    '''          git fetch origin main\n          if ! git merge-base --is-ancestor "$GITHUB_SHA" origin/main; then\n            echo "Build commit tidak lagi berada di main; metadata tidak diaktifkan."\n            exit 1\n          fi\n          git checkout -B release-metadata origin/main''',
    1,
)
build_apk = build_apk.replace(
    '           version_code = int(os.environ["AMYFX_VERSION_CODE"])\n\n           data.update({',
    '           version_code = int(os.environ["AMYFX_VERSION_CODE"])\n           published_code = int(data.get("latest_version_code", data.get("versionCode", 0)) or 0)\n           if published_code > version_code:\n               print(f"Metadata {published_code} lebih baru daripada build {version_code}; tidak diturunkan.")\n               raise SystemExit(0)\n\n           data.update({',
    1,
)
build_apk = build_apk.replace(
    '             git push origin HEAD:main',
    '             git pull --rebase origin main\n             git push origin HEAD:main',
    1,
)
write(".github/workflows/build-apk.yml", build_apk)

# New release notes are committed before publication; version fields remain at the last published APK until CI succeeds.
update_path = ROOT / "update.json"
update_data = json.loads(update_path.read_text(encoding="utf-8"))
notes = [
    "Menghapus penyimpanan API key lama dari WebView dan SharedPreferences karena Mapping kini memakai proxy Amy FX",
    "Memvalidasi metode, interval, ukuran data, timeout, dan credential server pada endpoint market",
    "Membatasi deep-link notifikasi ke halaman lokal Amy FX dan memakai ikon notifikasi resmi",
    "Mengunci fingerprint sertifikat APK agar pembaruan dapat dipasang tanpa menghapus aplikasi",
    "Menstabilkan aktivasi update agar selalu memakai main terbaru dan tidak bertabrakan dengan build lain"
]
update_data["release_notes"] = notes
update_data["changelog"] = notes
update_path.write_text(json.dumps(update_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Regression coverage for stage 5 invariants.
write(
    "tests/stage5-hardening.test.mjs",
    '''import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n\nconst read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');\n\ntest('Amy FX 1.4.6 uses versionCode 29 without changing applicationId', () => {\n  const gradle = read('app/build.gradle.kts');\n  const version = read('app/src/main/assets/app-version.js');\n  assert.match(gradle, /applicationId = "com\\.amyelitesuite"/);\n  assert.match(gradle, /versionCode[^\\n]*29/);\n  assert.match(gradle, /versionName[^\\n]*"1\\.4\\.6"/);\n  assert.match(version, /name: '1\\.4\\.6', code: 29/);\n});\n\ntest('last published metadata is not activated before the new APK exists', () => {\n  const metadata = JSON.parse(read('update.json'));\n  assert.equal(metadata.latest_version_code, 28);\n  assert.equal(metadata.latest_version_name, '1.4.5');\n  assert.ok(metadata.release_notes.some(note => note.includes('fingerprint sertifikat APK')));\n});\n\ntest('client no longer persists TwelveData credentials', () => {\n  const main = read('app/src/main/assets/apps/mapping/js/main.js');\n  const bridge = read('app/src/main/assets/apps/mapping/js/bridge/android-bridge.js');\n  const native = read('app/src/main/java/com/amyelitesuite/MainActivity.kt');\n  assert.doesNotMatch(main, /localStorage\\.getItem\\('twelve_api_key'\\)/);\n  assert.doesNotMatch(bridge, /localStorage\\.setItem\\('twelve_api_key'/);\n  assert.doesNotMatch(native, /putString\\("api_key"/);\n  assert.doesNotMatch(native, /SecurePrefs\\.putString\\(mContext, "api_key"/);\n  assert.match(native, /SecurePrefs\\.remove\\(mContext, "api_key"\\)/);\n});\n\ntest('market proxy accepts only validated server-side requests', () => {\n  const api = read('api/twelvedata.js');\n  assert.match(api, /process\\.env\\.TWELVEDATA_API_KEY/);\n  assert.doesNotMatch(api, /req\\.query[^\\n]*apikey/);\n  assert.match(api, /req\\.method !== 'GET'/);\n  assert.match(api, /ALLOWED_INTERVALS\\.has\\(interval\\)/);\n  assert.match(api, /new AbortController\\(\\)/);\n  assert.match(api, /Market service timeout/);\n});\n\ntest('native notifications only open trusted local routes', () => {\n  const native = read('app/src/main/java/com/amyelitesuite/MainActivity.kt');\n  assert.match(native, /normalizeLocalUrl\\(url\\)/);\n  assert.match(native, /setSmallIcon\\(R\\.drawable\\.ic_stat_amy_fx\\)/);\n});\n\ntest('release workflows pin the existing signing certificate', () => {\n  for (const path of ['.github/workflows/build-apk.yml', '.github/workflows/build-release.yml']) {\n    const workflow = read(path);\n    assert.match(workflow, /AMYFX_VERSION_NAME: "1\\.4\\.6"|default: "1\\.4\\.6"/);\n    assert.match(workflow, /AMYFX_VERSION_CODE: "29"|default: "29"/);\n    assert.match(workflow, /47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7/);\n  }\n});\n\ntest('Firebase Android client remains bound to the release applicationId', () => {\n  const firebase = JSON.parse(read('app/google-services.json'));\n  assert.equal(firebase.client[0].client_info.android_client_info.package_name, 'com.amyelitesuite');\n  assert.equal('private_key' in firebase, false);\n});\n''',
)

# The one-shot automation removes itself before committing the real change set.
for temporary in ("tools/stage5_patch.py", ".github/workflows/stage5-apply.yml"):
    path = ROOT / temporary
    if path.exists():
        path.unlink()
