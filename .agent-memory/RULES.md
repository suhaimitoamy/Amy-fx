# Permanent Rules

## Universal Rules

- Do not refactor unless explicitly requested.
- Do not change working logic unless explicitly requested.
- Prefer additive changes — add new code, don't rewrite existing code.
- Do not add npm dependencies unless explicitly requested.
- Do not store secrets in files (API keys, tokens, passwords, credentials).
- Do not hardcode API keys.
- Keep serverless functions compatible with Vercel.
- Use native `fetch` when possible — no external HTTP libraries.
- For Android WebView assets, use explicit `index.html` path instead of folder-only links.
- Before editing, check related files first.
- After editing, summarize changed files.
- Do not delete existing files unless explicitly requested.
- Make the smallest safe change possible.

## Amy FX Specific Rules

- Jangan ubah logic heatmap lama (`computeHeatmap` di `api/heatmap.js`).
- Jangan ubah logic scraping Telegram (`extractPosts`, `filterGold` di `api/news.js`) kalau tidak diminta.
- Jangan ubah struktur Academy besar-besaran — materi tersebar di banyak folder `bagian-XX-*/`.
- Jangan sentuh `MainActivity.kt` kalau masalah cukup selesai di HTML/JS.
- File serverless baru harus **independen** — copy logic yang diperlukan, jangan import dari file lain.
- `API_BASE` di `apps/market-intel/app.js` hardcoded ke `https://amy-fx.vercel.app/api` — jangan ubah tanpa izin.
- Semua panel Market Intel (News, Heatmap, Liquidity) harus independen satu sama lain — error di satu panel tidak boleh mempengaruhi panel lain.
- **Candle Freshness Thresholds**: Jangan menetapkan batas kesegaran candle (freshness TTL) lebih ketat daripada latensi batch provider data. Feed Supabase `market-candles` memperbarui data setiap 3–5 menit; konfirmasi lower timeframe M5 menggunakan toleransi 900 detik (15 menit), bukan 180 detik M1.
- **Kebijakan Supabase Dikunci Total (Zero-Touch Supabase Invariant - Pro 410)**:
  1. Proyek Supabase (`amy-market-data` / `wliecyxzlwhmtftnfnps`) resmi dikunci dan dibiarkan dalam kondisi beku (*frozen state*).
  2. **DILARANG MENGHAPUS, MEROMBAK, MENAMBAH TABEL, ATAU MENDEPLOY ULANG APAPUN** ke Supabase.
  3. Amy FX Pro telah beroperasi 100% mandiri mengandalkan Vercel Serverless dan engine offline lokal HP tanpa Supabase client.
- **Sinkronisasi Versi Rilis & CI Monitoring**:
  1. Kenaikan versi APK wajib disinkronkan di 4 file: `app/build.gradle.kts`, `app/src/main/assets/app-version.js`, `app/src/main/assets/update-checker.js`, dan `tests/pro348-ui-polish.test.mjs`.
  2. Saat user meminta update aplikasi, agen **wajib memantau** GitHub Actions workflow (`build-apk.yml`) hingga selesai, memastikan release APK terbit, dan memverifikasi `update.json` pada branch `main` telah aktif terupdate.
- **Cockpit Mapping Invariant**: Paritas 100% Chart Gold (`.gold-price-panel`) wajib dipertahankan. Kartu 3 adalah Tabel Matriks 16 Baris Bias Dashboard V2, Kartu 4 adalah Amy Entry Assistant V3 Plan, dan 6 Driver dipusatkan di accordion arsip/riset Tab Analyze tanpa menggunakan Supabase client.
- **Weekend Gap & Cold-Start Rule**: Jeda akhir pekan (Jumat 17:00 NY s.d. Minggu 17:00 NY) wajib ditoleransi pada fungsi `isWeekendGap`, `pair`, dan `contiguous`. Freshness check `H1`, `M15`, `M5` wajib memperhitungkan jam pasar aktif via `marketElapsedSeconds` agar tidak mengunci status ke `DATA TERLAMBAT` saat pasar baru buka hari Minggu atau saat libur akhir pekan.
- **PDH/PDL NY Close Rule (Pro 407)**: Penentuan hari perdagangan untuk indikator visual PDH/PDL dan PWH/PWL di `nextgen-indicators.js` wajib menggunakan cutoff resmi sesi New York 17:00 Close (`America/New_York`) dan memprioritaskan level harian otoritatif D1 dari server/konteks (`serverAmyLevels.pdh`), dilarang memotong sesi di 00:00 WITA.
- **M15 Direct Confirmation Rule (Pro 408)**: Candle M15 yang resmi close adalah otoritas konfirmasi penuh dan mandiri (M15 Direct Confirmation) melalui salah satu dari 3 kriteria: (a) Wick Rejection >= 1.2x body di POI atau likuiditas (SSL/BSL/Asia/PDH/PDL), (b) Displacement Break (BOS/MSS) searah bias dengan body tebal, atau (c) 50% CE Bounce di Dealing Range yang sehat (Diskon untuk BUY, Premium untuk SELL). Saat terpenuhi, status langsung menjadi `CONFIRMED` / `READY ENTRY`, pemicu Entry Assistant V3 Plan aktif, dan Peluru Utama A+ aktif tanpa harus terblokir menunggu M5 break.
- **Driver Limit Entry Trigger Rule**: Pending limit order driver turnamen wajib mentoleransi jendela waktu wajar (deadline >= 3600s / 1–1.5 jam), mendukung otoritas lilin M15 secara mandiri tanpa memblokir eksekusi saat M5 tidak tersedia, mempertahankan status di API saat harga retest zona, mendeteksi touch trigger real-time saat harga menyentuh entry tanpa tembus SL, dan terhubung 100% ke client `Trade Lifecycle Tracker` dengan normalisasi properti `direction` / `stopLoss` / `target`.
- **Virtual Office Anti-Hallucination & Live Data Rule (Pro 418)**: Seluruh diskusi analisa pasar di Virtual Office (Nova, Chrono, Titan, Aegis, Forge, Hermes) WAJIB mengonsumsi telemetri nyata dari `/api/market-data` (`scalper-setups` & `twelvedata`). DILARANG KERAS mengutip angka acak/fiktif, wajib mengacu pada harga nyata, Dealing Range M15, EQ, dan Confluence Score real-time.
- **Live Intrabar Touch Alerts Rule (Pro 409)**: Notifikasi likuiditas sweep (BSL/SSL/PDH/PDL/Asia High/Low), break struktur/invalidasi M15, dan uji zona POI M15 wajib dievaluasi seketika pada setiap tick harga live (latensi 0 detik) di `price-alert-manager.js` tanpa menunggu lilin M15 tertutup. Wajib menerapkan anti-jitter cooldown 5 menit (`ICT_COOLDOWN_MS = 300000`) per level key, dibungkam saat pasar tutup (`isGoldMarketOpen() === false` / `session === 'PASAR TUTUP'`), dan dipadukan dengan konfirmasi closed candle Tier 2.

## Memory Rules


- Update memory setelah menyelesaikan task yang menghasilkan keputusan, fix bug, atau fitur baru.
- Jangan hapus entry lama di memory — tandai sebagai resolved/superseded.
- Jangan simpan secret apapun di folder `.agent-memory/`.
