# Changelog

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
