# Changelog

## 2026-07-10 — Stability Pass

## 2026-07-11 — Mockup UI Pass

- Reworked the main shell toward the Amy FX black-and-gold mockup: Beranda, Proyek, Koleksi, and Profil.
- Added a compact home dashboard, quick module access, local collection history, and device profile status.
- Simplified Mapping Dashboard into price, bias, timeframe, setup focus, and active-session cards.
- Kept detailed Mapping diagnostics available under Analyze instead of showing every block at once.

- Disabled automatic Mapping setup notifications to prevent conflicts with native scanner alerts.
- Fixed candle cache retention using seconds instead of milliseconds.
- Excluded the latest still-forming REST candle from Mapping analysis.
- Aligned Mapping and native scanner target expiry to 24 hours.
- Fixed setup conflict handling in Decision confidence.
- Improved TwelveData provider error propagation.
- Excluded secondary Mapping diagnostics behind collapsible sections on mobile.
- Replaced the Academy auth stub with a device-local access code.
- Synchronized Market Intel Liquidity assets into the Android APK source.
- Restored the missing Kotlin MappingLogicCore source used by unit tests.

## 1.2.0 - 2026-06-25

### Android / Build

- Target SDK dinaikkan ke 35.
- Version name disiapkan ke 1.2.0.
- Release build mengaktifkan R8 minify dan resource shrink.
- Debug build dipisahkan dengan suffix `.debug`.

### Security

- Menambahkan `SecurePrefs.kt` untuk penyimpanan API key dengan encrypted preferences.
- Menambahkan ProGuard rules agar WebView bridge tetap aman saat R8 aktif.

### Scanner

- Menambahkan cooldown notifikasi 30 menit per level BSL/SSL.
- Menambahkan expiry target Mapping setelah 24 jam.
- Menambahkan reconnect bertahap.
- Memisahkan channel notifikasi foreground scanner, target alert, dan info.
- Tap notifikasi target membuka Mapping.

### Data

- Menambahkan index SQLite tambahan.
- Menambahkan cleanup candle cache berdasarkan umur data.
- Menambahkan fungsi clear cache dan cek ukuran storage.

### Mapping

- Menambahkan `MappingLogicCore.kt` untuk logic dasar swing, BOS/CHOCH, FVG, OB, dan setup score breakdown.
- Menambahkan unit test awal untuk score, FVG, dan swing detection.

### Docs

- Menambahkan dokumentasi arsitektur.
- Menambahkan dokumentasi setup API.
