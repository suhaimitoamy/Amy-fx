# Amy FX — Changelog

## [1.2.0] — 2026-06-25 (Current)

### 🔴 Fix Kritis
- **Notifikasi**: Tambah anti-spam cooldown 30 menit per level BSL/SSL
- **Notifikasi**: Pisah menjadi 3 channel terpisah (scanner foreground, target alert, info)
- **Deep link**: Tap notifikasi sekarang membuka Mapping langsung
- **Scanner**: Reconnect strategy bertahap (15s → 30s → 60s → 2m → 5m → 10m)
- **Scanner**: Watchdog heartbeat — scanner otomatis restart jika tidak responsif
- **Scanner**: Target BSL/SSL auto-expire setelah 24 jam
- **API Key**: Migrasi ke EncryptedSharedPreferences (AES256-GCM)
- **Build**: Release build dengan R8/ProGuard aktif (minify + shrink resources)
- **Build**: Release signing via GitHub Secrets (tidak ada keystore di repo)

### 🟡 Perbaikan Kualitas
- **MappingLogicCore**: Implementasi lengkap — FVG status (Fresh/Partially Filled/Mitigated), OB status (Fresh/Tested/Broken), MSS terpisah dari CHOCH
- **Setup Score**: Rework menjadi 10 poin dengan breakdown transparan per kriteria
- **Liquidity**: Deteksi equal highs/lows (relative equal) dengan toleransi konfigurabel
- **CandleStore**: Tambah index SQLite, batch upsert, auto-cleanup 90/365 hari, storage size API
- **Indikator**: Manifest baru dengan kategori, tags, timeframe, version per indikator
- **Indikator Library**: Search, filter kategori, favorit, copy feedback toast
- **Jurnal**: Statistik lengkap — win rate, avg RR, profit factor, equity curve, performa per setup & session
- **Jurnal AI**: Prompt terstruktur dengan konteks ringkas (bukan data mentah)
- **Update Checker**: Cek sekali per hari, dismissable per versi, tidak spam
- **AndroidManifest**: configChanges agar WebView tidak reload saat rotate, singleTop launchMode
- **BootReceiver**: Logging yang benar, validasi sebelum restart scanner
- **ProGuard**: Rules lengkap untuk semua kelas penting

### 🟢 Fitur Baru
- **Design System CSS**: Session badges, FVG/OB status chips, MTF confluence styles, score bar
- **Journal deep link**: `amyfx://journal` untuk buka jurnal dari notifikasi
- **CI/CD**: Workflow release otomatis dengan GitHub Release + update.json commit
- **CI/CD**: Lint workflow untuk setiap PR ke main/develop

### 🧹 Pembersihan
- Hapus semua file patch sementara dari root (`apply_*.py`, `amyfx_*_patch/`)
- Hapus file duplikat dan kosong di folder indikator
- Hapus FIX notes yang sudah tidak relevan dari root
- Konsolidasi semua history ke CHANGELOG.md ini

---

## [1.1.x] — 2026-06-24 (Archive)

File-file fix notes dari iterasi sebelumnya tersimpan di `docs/archive/`.

Perubahan utama yang sudah dilakukan:
- Fix kompilasi build.gradle.kts
- Tambah WebViewClient error handler → error.html
- Tambah permission gate UI
- Tambah injectHomeButtonForLocalModule
- Tambah ScannerService foreground notification
- Tambah SecurePrefs dasar
- Tambah SessionClock
- Tambah unit test skeleton
- Fix WebSocket reconnect logic
- Fix notifikasi channel priority
