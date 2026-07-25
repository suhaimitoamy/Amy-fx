from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


def replace_all_checked(path: str, replacements: list[tuple[str, str]]) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"{path}: missing expected text {old!r}")
        text = text.replace(old, new)
    file.write_text(text, encoding="utf-8")


replace_once(
    "app/build.gradle.kts",
    'versionCode = (System.getenv("AMYFX_VERSION_CODE")?.toIntOrNull() ?: 47)\n        versionName = System.getenv("AMYFX_VERSION_NAME") ?: "1.5.6"',
    'versionCode = (System.getenv("AMYFX_VERSION_CODE")?.toIntOrNull() ?: 48)\n        versionName = System.getenv("AMYFX_VERSION_NAME") ?: "1.5.7"',
)
replace_once(
    "app/src/main/assets/app-version.js",
    "const VERSION = Object.freeze({ name: '1.5.6', code: 47 });",
    "const VERSION = Object.freeze({ name: '1.5.7', code: 48 });",
)

readme = Path("README.md")
readme_text = readme.read_text(encoding="utf-8")
readme_text = readme_text.replace("**Versi:** `1.5.6`", "**Versi:** `1.5.7`", 1)
readme_text = readme_text.replace("**Version code:** `47`", "**Version code:** `48`", 1)
marker = "## Update v1.5.6"
section = """## Update v1.5.7 — Video Otomatis & Background Playback

- Video Trading Library/Jurnal dapat diputar otomatis dan mengulang otomatis.
- Playback dilanjutkan oleh AndroidX Media3 ketika aplikasi masuk background atau layar dikunci.
- MediaSession menyediakan kontrol Play, Pause, Seek, dan Stop dari notifikasi/headset.
- Posisi video disinkronkan ketika pengguna kembali ke aplikasi tanpa suara ganda.
- Video IndexedDB dipindahkan ke cache privat Android bertahap 512 KB, bukan sebagai satu Base64 besar.
- Package, signing key permanen, data aplikasi, Backup/Restore, dan kanal update tetap dipertahankan.

"""
if marker not in readme_text:
    raise SystemExit("README release marker not found")
readme.write_text(readme_text.replace(marker, section + marker, 1), encoding="utf-8")

replace_all_checked("tests/production-release-identity.test.mjs", [
    ("Amy FX 1.5.6", "Amy FX 1.5.7"),
    (r"/\?: 47\)/", r"/\?: 48\)/"),
    (r'/\?: "1\.5\.6"/', r'/\?: "1\.5\.7"/'),
    (r"/name: '1\.5\.6', code: 47/", r"/name: '1\.5\.7', code: 48/"),
    (r'/AMYFX_VERSION_NAME: "1\.5\.6"/', r'/AMYFX_VERSION_NAME: "1\.5\.7"/'),
    (r'/AMYFX_VERSION_CODE: "47"/', r'/AMYFX_VERSION_CODE: "48"/'),
    (r"/latest_version_code': 47/", r"/latest_version_code': 48/"),
    (r"/latest_version_name': '1\.5\.6'/", r"/latest_version_name': '1\.5\.7'/"),
])

replace_all_checked("tests/profile-version-update-regression.test.mjs", [
    ("version 1.5.6", "version 1.5.7"),
    (r"/name: '1\.5\.6'/", r"/name: '1\.5\.7'/"),
    (r"/code: 47/", r"/code: 48/"),
])

replace_all_checked("tests/five-issues-regression.test.mjs", [
    ("Amy FX 1.5.6 release identity", "Amy FX 1.5.7 release identity"),
    (r"/\*\*Versi:\*\* `1\.5\.6`/", r"/\*\*Versi:\*\* `1\.5\.7`/"),
    (r"/\*\*Version code:\*\* `47`/", r"/\*\*Version code:\*\* `48`/"),
    ("source version is 1.5.5", "source version is 1.5.7"),
    (r"/name: '1\.5\.6', code: 47/", r"/name: '1\.5\.7', code: 48/"),
    ("[42, 43, 44, 45, 46, 47]", "[42, 43, 44, 45, 46, 47, 48]"),
    ("const expected = update.latest_version_code === 47\n    ? '1.5.6'", "const expected = update.latest_version_code === 48\n    ? '1.5.7'\n    : update.latest_version_code === 47\n      ? '1.5.6'"),
])

replace_all_checked("tests/stage5-hardening.test.mjs", [
    ("Amy FX 1.5.6 uses versionCode 47", "Amy FX 1.5.7 uses versionCode 48"),
    (r"/versionCode[^\n]*47/", r"/versionCode[^\n]*48/"),
    (r'/versionName[^\n]*"1\.5\.6"/', r'/versionName[^\n]*"1\.5\.7"/'),
    (r"/name: '1\.5\.6', code: 47/", r"/name: '1\.5\.7', code: 48/"),
    ("[40, 41, 42, 43, 44, 45, 46, 47]", "[40, 41, 42, 43, 44, 45, 46, 47, 48]"),
    ("const expected = metadata.latest_version_code === 47\n    ? '1.5.6'", "const expected = metadata.latest_version_code === 48\n    ? '1.5.7'\n    : metadata.latest_version_code === 47\n      ? '1.5.6'"),
    ("metadata.latest_version_code <= 47", "metadata.latest_version_code <= 48"),
    (r'/AMYFX_VERSION_NAME: "1\.5\.6"/', r'/AMYFX_VERSION_NAME: "1\.5\.7"/'),
    (r'/AMYFX_VERSION_CODE: "47"/', r'/AMYFX_VERSION_CODE: "48"/'),
    (r'/default: "1\.5\.6"/', r'/default: "1\.5\.7"/'),
    (r'/default: "47"/', r'/default: "48"/'),
])

output = Path("release-generated")
output.mkdir(exist_ok=True)
for filename in ("build-apk.yml", "build-release.yml", "stage5-apply.yml"):
    source_path = Path(".github/workflows") / filename
    text = source_path.read_text(encoding="utf-8")
    text = text.replace("1.5.6", "1.5.7")
    targeted = [
        ('AMYFX_VERSION_CODE: "47"', 'AMYFX_VERSION_CODE: "48"'),
        ('default: "47"', 'default: "48"'),
        ("latest_version_code': 47", "latest_version_code': 48"),
        ("'versionCode': 47", "'versionCode': 48"),
        ('latest_code" = "47"', 'latest_code" = "48"'),
        ('code 47', 'code 48'),
    ]
    for old, new in targeted:
        text = text.replace(old, new)
    (output / filename).write_text(text, encoding="utf-8")

for path in output.glob("*.yml"):
    text = path.read_text(encoding="utf-8")
    if "1.5.6" in text or 'AMYFX_VERSION_CODE: "47"' in text:
        raise SystemExit(f"Stale release identity remains in {path}")
