# Technical Decisions

## 2026-10-22 — Perbaikan Rilis Aktual Data Ekonomi (Jobless Claims 194K) & Reaktivitas Real-Time Kalender/Sentimen
1. **Latar Belakang & Gejala:**
   - Pengguna melaporkan bahwa rilis data ekonomi AS (Initial Jobless Claims pada 20:30 WITA) tidak memunculkan angka aktual `194K` di aplikasi Amy FX Pro, melainkan tetap menampilkan tanda strip (`—`) meski sudah lewat 20+ menit.
2. **Akar Masalah (Root Cause):**
   - **Keterbatasan Endpoint Statis Kalender:** Faireconomy (`ff_calendar_thisweek.json`) adalah data statis mingguan yang hanya memuat jadwal, forecast, dan previous. Angka aktual tidak pernah di-stream secara real-time dari Faireconomy.
   - **Defek Regex Parser Berita:** Di `apps/market-intel/app.js`, regex `extractActualForEvent()` hanya mencari label `(?:Aktual|Actual|Hasil|Rilis)`. Sedangkan bot berita live Telegram (`@SM_News_24h`) menggunakan label `•Current: 194K` (Inggris) atau `•Saat ini: 194K` (Indonesia). Karena kata `Current` dan `Saat ini` tidak terdaftar, parser gagal menangkap angka `194K` dan mengembalikan `null`.
   - **Ketidakterhubungan Tab Kalender & Sentimen:** Tab Kalender (`renderCalendar()`) sebelumnya sama sekali tidak memanggil fungsi ekstraksi aktual dari feed berita, sehingga kartu kalender selalu kosong dari angka rilis. Tab Sentimen juga tidak me-refresh dirinya saat data berita baru selesai diunduh di latar belakang.
3. **Solusi Teknis:**
   - **Penyempurnaan Regex Multi-Format:** Menambahkan `Current`, `Saat ini`, `Sebenarnya`, `Result` pada regex serta dukungan bullet point `•` dan simbol Unicode.
   - **Enrichment Sentral & Reaktif:** Membuat fungsi `enrichCalendarEventsWithNews()` yang otomatis memperkaya data kalender dan sentimen secara instan dari cache maupun saat feed berita baru tiba.
   - **Sinkronisasi Tab Latar Belakang:** Ketika `loadNews()` menerima breaking news baru, aplikasi langsung memicu enrichment kalender, re-render tampilan kalender, dan mengkalkulasi ulang sentimen makro (`loadSentiment(true)`) tanpa jeda.
4. **Verifikasi & Rilis:**
   - Diuji langsung terhadap feed berita riil id `61702`: Data klaim pengangguran 194K berhasil diekstraksi sempurna (`actual: 194K`, bias `BEARISH_PRESSURE`).
   - Bump versi Amy FX Pro ke `2.0.0-pro.424` (code `950424`), commit, push, dan workflow GitHub Actions Build and Release terpantau berjalan sukses.

## 2026-10-22 — Perbaikan Kritis Notifikasi Asisten Amy: Eliminasi Delay 45 Menit pada SSL/BSL Swept & Sanitasi Stale
1. **Latar Belakang & Gejala:**
   - Pengguna melaporkan notifikasi `💧 Asisten Amy: SSL Swept!` muncul 45 menit terlambat dari peristiwa sweep aslinya di pasar.
2. **Akar Masalah (Root Cause):**
   - **Umur Fresh Sweep Terlalu Panjang (8 Bar / 2 Jam):** Di `amy-ict.js`, `freshBars: 8` membuat `sweepStatus === 1` bertahan selama 8 candle M15 (120 menit). Logika notifikasi keliru menganggapnya sebagai event baru di setiap bar.
   - **Cache Key Mengikat Waktu Candle Berjalan, Bukan Waktu Sweep:** Di `DriverSetupSyncWorker.kt` dan `ict-presentation.js`, `cacheKey` dibuat dari `candleTime` (waktu bar M15 saat ini yang terus berganti tiap 15m), bukan `sweep.time`. Akibatnya setiap pergantian candle (menit 15, 30, 45) diperlakukan sebagai notifikasi baru.
   - **Toleransi Kadaluarsa Terlalu Longgar (1 Jam) & Doze Mode:** Batas `isStale` 3600 detik (1 jam) menyebabkan background worker Android atau aplikasi yang baru dibuka di menit ke-45 tetap menembakkan notifikasi basi.
   - **Harga Fallback Jadul:** Fallback hardcoded $2642.50 dan $2665.30 yang sudah usang di era harga $4080+.
3. **Solusi Teknis:**
   - **`ict-presentation.js`**: `detectLiquiditySweep()` kini mengembalikan `time` dan `index` asli dari bar sweep. `renderAssistant` memverifikasi kesegaran event (`nowSec - sweepInfo.time <= 900`). Kunci notifikasi mengikat `sweepInfo.time` dan toleransi stale dipangkas dari 3600s menjadi 900s (15 menit).
   - **`DriverSetupSyncWorker.kt`**: `SweepDetails` kini membawa `sweepTime`. Notifikasi sweep hanya diizinkan jika `sweepAge <= 900s`. Kunci SharedPreferences mengikat `sweepDetails.sweepTime`. Toleransi stale dipangkas ke 900s, dan fallback hardcoded $2642/$2665 diganti dengan harga dinamis `defaultLow`/`defaultHigh`/`currentPrice`.
4. **Verifikasi & Sinkronisasi:**
   - Targeted unit tests lolos 53/53.
   - Disinkronkan 100% ke repositori `Amy-fx`, `Amy-fx-pro`, dan `Amy-fX-pwa`.

## 2026-10-22 — Rombak Total Kurikulum Akademi Amy FX (Level 0 s.d. Level 6 Micro-Learning Tanpa Fluff)
1. **Latar Belakang & Kebutuhan:**
   - Format lama kurikulum Akademi terdiri dari 10 modul / 222 bab yang terfragmentasi (594 berkas), membuat pengguna overwhelmed dan kesulitan menentukan urutan belajar sekuensial.
   - Pengguna menginstruksikan agar ilmu-ilmu penting di arsip lama (seperti cara memilih FVG/OB yang bagus, Inducement, Silver Bullet, dll.) tidak dibuang begitu saja, melainkan dimasukkan dan dikembangkan sebagai sub-pelajaran lanjutan (`Pelajaran 05`, `06`, dst.) pada level yang sesuai.
   - Pengguna menegaskan standar penulisan trading profesional: Nol basa-basi/salam pembuka, nol istilah bocoran AI, nol emoji berlebihan, dan wajib konsisten mengusung format 4 kartu baku (Inti Konsep, Checklist Syarat, Diagram SVG/Tabel Komparasi, Aturan Main Eksekusi) + 1 Kuis Pemahaman Kilat.
2. **Arsitektur Kurikulum Baru (Total 42 Pelajaran):**
   - **Level 0 (Fondasi Nol Mutlak — 4 Pelajaran):** Logika berdagang awam, mekanisme untung Sell, analogi fisik lot/pip/leverage beras, risiko Margin Call (100% tanpa grafik sesuai Aturan 11 GEMINI.md).
   - **Level 1 (Membaca Arah Pasar — 7 Pelajaran):** Anatomi candlestick, 3 fase pasar, BOS vs MSS, Diskon vs Premium, Valid Swing High/Low, Internal vs External Structure, Equal Highs & Equal Lows (EQH/EQL).
   - **Level 2 (Senjata Utama & Filter ICT — 10 Pelajaran):** Master FVG, Inversion FVG, Kolam Likuiditas (BSL/SSL), Order Block, FVG Kuat vs Lemah, OB Valid vs Palsu, Kapan Memilih FVG vs OB, Inducement (IDM), POI Utama vs Sekunder, Breaker & Mitigation Block.
   - **Level 3 (Waktu & Sesi Emas — 6 Pelajaran):** Siklus 3 sesi dunia, Killzone XAU/USD, SOP News Lock, model Silver Bullet, Judas Swing London, Peta Likuiditas Pra-Sesi.
   - **Level 4 (Playbook Setup A+ — 6 Pelajaran):** Deep OTE 78.6% + FVG, Sweep MSS, SOP Eksekusi & RR 1:2+, Turtle Soup (Liquidity Raid), Inversion FVG + Breaker, SOP Partial TP & Breakeven.
   - **Level 5 (Pertahanan Modal & Emosi — 5 Pelajaran):** Aturan risiko 1% + kalkulator lot, SOP 2-peluru stop, manajemen drawdown portofolio, checklist 5-gerbang pra-entry, format standar jurnal evaluasi.
   - **Level 6 (Bedah Kasus Nyata XAU/USD — 4 Pelajaran):** Alur analisa top-down (Daily > H1 > M5), studi kasus Peluru Utama New York (+4R), studi kasus menghindari jebakan news (CPI/NFP), studi kasus reversal London ke New York.
3. **Infrastruktur Penunjang & Penyelarasan Gaya Bahasa (Tone Refinement):**
   - Mengeliminasi total bahasa kaku seperti buku teks/skripsi pada seluruh 22 materi baru (Level 1 s.d. Level 6) melalui 5 sub-agent tone refiners.
   - Menghadirkan kotak `<div class="ml-analogi">` di setiap materi (analogi gunung vs kerikil, ombak vs riak ember, toples gula EQH, diskon mal FVG, satpam asli vs gadungan OB, cacing kail pancing IDM, mobil balap F1 vs bus, sniper jam 10 malam Silver Bullet, gerak tipu bola Judas Swing, sup kura-kura Turtle Soup, palang tol patah IFVG, pedagang balik modal Partial TP, rem darurat jalan licin Drawdown, 5 gerbang tol pra-entry, rekaman CCTV atlet jurnal, dan helikopter vs pejalan kaki Top-Down).
   - Mesin micro-learning: `micro-learning.css` (mobile-first glassmorphism, responsive) & `micro-learning.js` (evaluasi kuis interaktif instan, feedback edukatif, auto-save status baca di localStorage).
   - Arsip lama (10 modul / 222 bab) tetap diawetkan dalam drawer tertutup (`<details>`) di bagian bawah beranda akademi untuk referensi mendalam tanpa mengintimidasi pemula.
4. **Verifikasi & Sinkronisasi:**
   - Audit otomatis 42 berkas HTML: 0 Error, 0 Warning.
   - Seluruh endpoint HTTP di port 8080 terverifikasi status 200 OK.
   - Disinkronkan penuh ke `/root/Amy-fx` dan `/root/Amy-fx-pro/`.

## 2026-10-21 — Eliminasi Total Modul Driver & Notifikasi Setup Driver (Preservasi Penuh Notifikasi ICT Liquidity & Structure)
1. **Latar Belakang & Keluhan Pengguna:**
   - Pengguna melaporkan bahwa notifikasi `⚡ Setup Driver:` terlalu spam dan hasil analisanya sering salah karena sifat model sinyal mekanikal yang kaku.
   - Instruksi pengguna eksplisit: Hapus total modul dan notifikasi driver, namun **JANGAN GANGGU** notifikasi struktur dan likuiditas esensial (SSL Sweep, BSL Sweep, Valid Break, POI, DOL, News Lock).
2. **Tindakan Teknis:**
   - **UI Cockpit Mapping (`apps/mapping/index.html`):** Menghapus kartu accordion `<details class="model-context driver-tournament-card">` (Arsip & Riset: 6 Driver Tournament) agar tampilan murni terfokus pada AMY ICT Context V4.
   - **Web Logic (`context-panel.js`):** Menghapus loop pengiriman notifikasi `window.Android.showNotificationWithUrl` dan registrasi auto plan driver pada `renderDriverSetups`.
   - **Android Background Worker (`DriverSetupSyncWorker.kt`):** Menetralkan `processActiveSetups` menjadi *early return* sehingga background worker tidak pernah lagi menembakkan notifikasi `⚡ Setup Driver:`.
   - **Preservasi Notifikasi ICT Asisten:** Seluruh fungsi pendeteksi likuiditas dan struktur di `processAssistantAlerts()` (`💧 SSL/BSL Swept`, `✓ Valid Break`, `🔥 Rejection`, `📍 Area POI`, `🎯 Target DOL`, `🛡️ News Lock`) tetap aktif 100% tanpa perubahan.
3. **Sinkronisasi & Verifikasi:**
   - Disinkronkan ke `/root/Amy-fx` dan `/root/Amy-fx-pro`.
   - Targeted unit tests lolos 28/28 (0 fail).
   - Server preview direstart via `amy-web restart`.

## 2026-10-19 — Upgrade Cockpit Mapping ke AMY ICT CONTEXT V4 (100% Pure Market Context Engine)
1. **Latar Belakang & Kebutuhan:**
   - Evaluasi backtest September menunjukkan strategi mekanikal sinyal kaku rawan terkena noise atau false break. User memutuskan mengubah fondasi Cockpit Mapping menjadi **AMY ICT CONTEXT V4** (100% Pure Market Context) sebagai kompas navigasi objektif tanpa repainting sinyal.
2. **Arsitektur Matriks 11-Baris & Fase Narasi:**
   - **Tabel Navigasi 11-Baris:**
     1. `MATRIKS 3-TIMEFRAME`: Status arah H1 (Major), M15 (Swing), M5 (Orderflow).
     2. `FASE NARASI MARKET`: Membedakan secara cerdas antara Ekspansi Searah, Manipulasi Likuiditas (Sweep BSL/SSL/Asia/PDHL), dan Koreksi Pullback masuk ke Demand/Supply.
     3. `DEALING RANGE & ZONA`: Lokasi persentase harga dalam dealing range (Discount <47.5%, Premium >52.5%, EQ 50%).
     4. `MAGNET ATAS (BSL/PDH)`: Jarak poin/dolar ke BSL M15 & PDH serta status sweep.
     5. `MAGNET BAWAH (SSL/PDL)`: Jarak poin/dolar ke SSL M15 & PDL serta status sweep.
     6. `SESI & ASIA RANGE`: Sesi aktif berjalan dan status sweep/break range Asia.
     7. `INDUCEMENT (IDM)`: Level internal swing M15 dan validasi apakah IDM sudah disapu sebelum POI.
     8. `ZONA SUPPLY (M15)`: Area unmitigated Bear OB & FVG serta deteksi saat harga di dalam supply.
     9. `ZONA DEMAND (M15)`: Area unmitigated Bull OB & FVG serta deteksi saat harga di dalam demand.
     10. `BATAS CHoCH (H1)`: Level invalidasi tren major H1.
     11. `PANDUAN KONTEKS`: Rekomendasi objektif kontekstual (misal: *"Harga di Demand/Discount — JANGAN SELL! Tunggu M5 CHoCH Bullish"*).
3. **Penyelarasan Live Assistant & Backward-Compatibility:**
   - `renderLiveAssistant`: Terintegrasi langsung dengan fase narasi V4 untuk menampilkan headline dan sub-message yang memandu trader saat standby.
   - `dashboardRows`: Fungsi legacy 15-baris tetap dipertahankan untuk menjamin backward-compatibility penuh dengan seluruh suite tes sebelumnya.
4. **Verifikasi & Status Tes:**
   - Syntax valid: `node --check app/src/main/assets/apps/mapping/js/ict-workspace/ict-presentation.js`.
   - Unit test targeted baru: `tests/mapping-context-v4-matrix.test.mjs` (4/4 lolos).
   - Seluruh targeted regression suites (56 tests) lolos 100%.

## 2026-10-19 — Implementasi Active Forming Candle Live (TradingView Parity) pada Chart Gold & Peta Harga Beranda
1. **Latar Belakang & Kebutuhan:**
   - Pengguna menanyakan mengapa chart sebelumnya hanya menampilkan candle tertutup sehingga terkesan "usang" hingga interval candle 15 menit selesai, berbeda dengan TradingView yang menampilkan candle aktif yang bergerak live.
2. **Arsitektur Pemisahan Visual vs Logika Keputusan:**
   - **Tampilan Visual Lilin (TradingView Parity):** Lilin aktif periode berjalan (*forming candle*) kini ditampilkan dan diperbarui secara *real-time* menggunakan `candlestickSeries.update()`. Nilai High, Low, dan Close berfluktuasi mulus setiap kali ada *tick* harga live (`amyfx:twelvedata-price` / `amyfx:live-price-display`).
   - **Integritas Otak Analisis ICT (Anti-Repainting & Anti-False-Alarm):** Seluruh kalkulasi FVG, 50% CE, BOS, MSS, dealing range, skoring konfluensi 8-lapis, checklist pre-trade, dan sinyal eksekusi tetap **100% terkunci pada candle tertutup terkonfirmasi** (`result.candles`). Tidak ada sinyal palsu atau repainting.
   - **Weekend Anti-Spam Guard:** Lilin aktif dilarang disintesis pada periode penutupan pasar akhir pekan (`isWeekendClosure`).
   - **Siklus Transisi Tertutup Graceful:** Ketika satu periode candle (misal M15) genap selesai, `loadCandles()` membawa candle tertutup resmi dari Twelve Data, `setData()` mengunci candle tersebut, dan lilin aktif baru dimulai dari penutupan candle tersebut.
3. **File yang Dimodifikasi & Pengujian:**
   - [`chart-view.js`](file:///root/Amy-fx/app/src/main/assets/apps/mapping/js/ict-workspace/chart-view.js): Menambahkan state `lastResult` dan `activeBar`, metode `updateActiveCandle(price, timeMs)`, serta proteksi `isWeekendClosure`.
   - [`app.js`](file:///root/Amy-fx/app/src/main/assets/apps/mapping/js/ict-workspace/app.js): Mendengarkan event tick live (`amyfx:twelvedata-price`, `amyfx:live-price-display`) dan menyediakan browser SSE fallback (`https://amy-fx.vercel.app/api/live-price`).
   - [`home-price-chart.js`](file:///root/Amy-fx/app/src/main/assets/home-price-chart.js): Menambahkan pendengar tick live dan sinkronisasi `updateActiveCandle` untuk menjaga paritas 100% dengan Peta Harga Beranda.
   - [`tests/active-candle-stream.test.mjs`](file:///root/Amy-fx/tests/active-candle-stream.test.mjs): Unit test baru yang menguji pembentukan bar aktif, pelebaran High/Low, proteksi weekend, dan reset transisi candle tertutup (lolos 2/2).
   - Seluruh targeted regression suites (65 tests) lolos 100%.
   - Disinkronkan ke `/root/Amy-fx-pro/`.

## 2026-10-19 — Perbaikan Kritis Chart Blank (Autoscale Clamping & Sanitasi Era Data Gold $4175 vs $2643) & Rilis 2.0.0-amyfx.418
1. **Latar Belakang & Gejala:**
   - Seluruh candle di Card Peta Harga (Beranda) dan Chart Gold (Cockpit Mapping) tidak muncul sama sekali (blank/kosong) baik di Amy FX maupun Amy FX Pro.
2. **Akar Masalah (Root Cause):**
   - **Benturan Deviasi Era Harga:** File snapshot offline `lib/market-snapshot-offline.json` memuat data historis Gold lama di rentang $2643–$2675, sedangkan harga live pasar berada di sekitar $4175.
   - **Deadzone Autoscale Clamping:** Algoritma autoscale di `chart-view.js` membatasi rentang sumbu Y maksimal 70 poin dari titik tengah `(min + max) / 2 = 3415`. Hal ini menempatkan candle $2675 jauh di bawah layar dan candle $4175 jauh di atas layar, sehingga 0 candle berada di dalam viewport.
   - **Rejection Tanpa Fallback:** Pemanggilan `analyze()` di `home-price-chart.js` tidak terproteksi `try...catch` dan ketiadaan fallback `lenientCandles` memicu crash diam saat kalkulasi indikator ICT.
3. **Solusi Teknis:**
   - **`chart-view.js`**: `autoscaleInfoProvider` diperbaiki agar menjepit (*anchor*) sumbu Y ke harga penutupan candle aktif (`lastClosePrice`) dengan bantalan wajar jika terjadi outlier, memastikan candle aktif selalu berada tepat di tengah viewport.
   - **`home-price-chart.js`**: Menambahkan fungsi `lenientCandles()` dan membungkus `analyze()` dalam blok `try...catch` dengan fallback visual graceful.
   - **`market-candle-store.mjs`**: Menambahkan filter toleransi deviasi harga ($500) pada `mergeRows`, `writeLocalStore`, dan `readLocalStore` untuk menolak candle lama yang bocor.
   - **`market-snapshot-offline.json`**: Memperbarui data historis ke era riil Oktober 2026 ($4164–$4184) dari Twelve Data dan membersihkan cache korup.
4. **Sinkronisasi & Rilis:**
   - Logika disinkronkan 100% ke repositori `Amy-fx` dan `Amy-fx-pro`.
   - Versi di-bump ke `2.0.0-amyfx.418` (Code `950418`) dan APK berhasil di-build serta dipublikasikan via GitHub Actions.


## 2026-10-19 — Penuntasan Penuh Blueprint Pagi & Peluncuran Dasbor Analitik Performa Replay Offline IndexedDB (Item 2.2)
1. **Latar Belakang & Status Blueprint:**
   - Seluruh 119 item pada [`BLUEPRINT_PAGI.md`](file:///root/Amy-fx/BLUEPRINT_PAGI.md) telah selesai 100% dan lolos audit reviewer (Item 2.5 TTS dieksklusikan secara permanen atas instruksi pengguna).
   - Item terakhir yang dituntaskan dan diaudit: Item 2.2 (Dasbor Analitik Performa Latihan Replay di IndexedDB).
2. **Arsitektur Item 2.2 (Offline Practice Analytics):**
   - Object store `amy_practice_analytics` ditambahkan ke IndexedDB Practice (`DB_VERSION = 3`) di [`storage.js`](file:///root/Amy-fx/app/src/main/assets/apps/academy/trading-practice/assets/js/storage.js) dengan index `timestamp`, `setupType`, `session`, `winLoss`.
   - Modul [`practice-analytics.js`](file:///root/Amy-fx/app/src/main/assets/apps/academy/trading-practice/assets/js/practice-analytics.js) mandiri menghitung metrik Win Rate %, Expectancy R, Profit Factor, Max Drawdown, klasifikasi sesi otomatis (London, New York, Asia), dan breakdown arketipe setup ICT (FVG, Order Block, Liquidity Sweep, Structure Break).
   - Tampilan [`backtest-history.html`](file:///root/Amy-fx/app/src/main/assets/apps/academy/trading-practice/backtest-history.html) & [`backtest-history.js`](file:///root/Amy-fx/app/src/main/assets/apps/academy/trading-practice/assets/js/backtest-history.js) merender kartu analitik visual evaluasi diri trader secara live.
   - Teruji lolos 5/5 targeted unit tests di [`tests/replay-performance-stats.test.mjs`](file:///root/Amy-fx/tests/replay-performance-stats.test.mjs).

## 2026-10-17 — Perbaikan Notifikasi Alarm Belajar (Pencegahan Notifikasi Dini & Sinkronisasi AlarmManager)
1. **Latar Belakang & Gejala:**
   - Pengguna menyetel pengingat belajar harian pada jam 20:00 WITA ("Waktunya tingkatkan skill trading-mu").
   - Notifikasi tiba-tiba muncul di status bar ponsel pada jam 13:41 WITA (siang hari, 6 jam 19 menit lebih awal).
2. **Akar Masalah (Root Cause):**
   - Sebelumnya, penjadwalan hanya mengandalkan `WorkManager` dengan `PeriodicWorkRequest(24, TimeUnit.HOURS)` dan kebijakan `ExistingPeriodicWorkPolicy.UPDATE` di `LearningReminderWorker.schedule`.
   - Di Android, `WorkManager` dirancang untuk *deferrable background batch*, bukan jam weker/alarm presisi. Setiap kali aplikasi dibuka atau sistem Android melakukan maintenance, WorkManager mengevaluasi periodic work dan dapat langsung menjalankan `doWork()`.
   - `LearningReminderWorker.doWork()` sebelumnya sama sekali tidak memvalidasi jam berjalan terhadap jam target. Begitu `doWork()` terpanggil pada 13:41 WITA, notifikasi langsung ditembakkan tanpa validasi waktu.
3. **Solusi Berlapis (Multi-Layer Protection):**
   - **Layer 1 (Exact AlarmManager):** Dibuat [`LearningReminderReceiver`](file:///root/Amy-fx/app/src/main/java/com/amyelitesuite/LearningReminderReceiver.kt) (BroadcastReceiver) dengan `AlarmManager.setExactAndAllowWhileIdle` / `setAndAllowWhileIdle`. Ini menjamin ponsel bangun dan memicu alarm tepat di menit target tanpa terpengaruh Doze mode.
   - **Layer 2 (Strict Time Window Guard di Worker & Receiver):** Menambahkan filter toleransi ±15 menit (`diffMinutes <= 15`). Jika worker atau receiver terbangun di luar jendela waktu (seperti 13:41 alih-alih 20:00), eksekusi langsung dibatalkan (discard), di-reschedule, dan dilarang memunculkan notifikasi apapun.
   - **Layer 3 (Once-Per-Day Date Guard):** Menyimpan `KEY_LAST_NOTIFIED_DATE = YYYY-MM-DD` (WITA). Notifikasi hanya diizinkan muncul maksimal 1 kali per hari kalender WITA.
   - **Layer 4 (WorkManager Policy):** Mengubah kebijakan startup di `LearningReminderWorker.schedule` menjadi `ExistingPeriodicWorkPolicy.KEEP` agar WorkManager tidak me-reset interval atau menembak worker prematur saat aplikasi dibuka. Reschedule hanya dipanggil via `LearningReminderWorker.reschedule` ketika pengguna mengubah jam di profil.
   - **Layer 5 (Boot & Update Resilience):** Menghubungkan [`BootReceiver`](file:///root/Amy-fx/app/src/main/java/com/amyelitesuite/BootReceiver.kt) untuk memasang ulang alarm otomatis saat perangkat baru dinyalakan (`ACTION_BOOT_COMPLETED`).

## 2026-10-17 — Restrukturisasi Komprehensif Academy: 10 Modul Tematik Terpadu (Zero Information Loss) & Rilis 2.0.0-amyfx.415
1. **Latar Belakang & Permintaan Pengguna:**
   - Kurikulum asli Academy sebelumnya tersebar di 36 bagian dengan metode spiral (materi dasar diajarkan di awal, lalu diulang versi menengah dan advanced di belakang).
   - Pengguna meminta agar kurikulum dirombak menjadi **10 Modul Tematik Terpadu** dari nol sampai menjadi trader mandiri.
   - Syarat mutlak pengguna: **"tpi jangan ada yang di ringkas bisa"** (Zero Information Loss / Nol Ringkasan). Seluruh 222+ bab original dari ke-36 folder wajib dipertahankan utuh tanpa memotong penjelasan, angka, formula, atau diagram.
2. **Arsitektur 10 Modul Tematik Terpadu:**
   - **Modul 01:** Fondasi Trading, Setup Alat Kerja & Manajemen Risiko Awal (Bagian 01, 32, 12).
   - **Modul 02:** Membaca Chart & Market Structure: Dari Nol sampai Advanced (Bagian 02, 03, 06, 16, 24).
   - **Modul 03:** Liquidity & Inducement: Bahan Bakar & Jebakan Pasar Lengkap (Bagian 04, 05, 17, 18, 19, 20, 30).
   - **Modul 04:** Dealing Range, Premium/Discount & Optimal Trade Entry / OTE (Bagian 05, 23, 26, 31).
   - **Modul 05:** Ensiklopedia Lengkap PD Array: FVG, Order Block & Semua Block (Sub-Modul 5A FVG/IFVG/BPR, 5B OB/Breaker/Mitigation, 5C Hierarki & Unicorn).
   - **Modul 06:** Daily Bias, Top-Down Analysis, Siklus Makro (IPDA) & SMT (Bagian 03, 06, 07, 08, 22, 27, 31).
   - **Modul 07:** Waktu Trading, Sesi, Killzone & Macro Silver Bullet (Bagian 08, 21, 23, 25, 26, 30, 31).
   - **Modul 08:** Model Entry Utuh & Playbook Khusus XAUUSD / Gold (Bagian 09, 10, 11, 16, 25, 26, 30, 31, 33).
   - **Modul 09:** Alur Kerja Eksekusi, Filter No-Trade & Trade Management (Bagian 24, 27, 28, 29, 30).
   - **Modul 10:** Psikologi Total, Backtesting, SOP 1-Halaman & Trader Mandiri / Prop Firm (Bagian 13, 14, 15, 28, 29, 34, 35, 36).
3. **Implementasi & Zero Information Loss:**
   - Memulihkan seluruh 582 bab HTML individual dari ke-36 direktori `bagian-XX` sehingga setiap tautan bab merujuk ke konten teks lengkap tanpa peringkasan sedikit pun.
   - Menciptakan 10 hub direktori `modul-01/` s.d. `modul-10/` dengan UI glassmorphism profesional, breadcrumb, statistik SKS, estimasi waktu, rincian sub-modul, dan tautan langsung ke setiap bab pembahasan.
   - Memperbarui `index.html` dan `daftar-materi.html` dengan grid 10 modul tematik, sistem filter kategori, dan mempertahankan laci kompatibilitas arsip (`legacy-archive-drawer` untuk `bagian-15`) agar semua unit test parity tetap lolos 100%.
4. **Bump Versi Aplikasi:**
   - Ditingkatkan ke `2.0.0-amyfx.415` (versionCode `950415`) pada `app/build.gradle.kts`, `app/src/main/assets/app-version.js`, `app/src/main/assets/update-checker.js`, `update.json`, dan `tests/pro348-ui-polish.test.mjs`.
5. **Verifikasi:**
   - Script validasi CI dan seluruh test suites lolos 100% tanpa regresi.

## 2026-10-16 — Pemisahan Penuh Identitas Aplikasi Amy FX (Mandiri vs Amy FX Pro)
1. **Latar Belakang Masalah:**
   - APK yang diunduh dari repositori `Amy-fx` sebelumnya terpasang sebagai **"Amy FX Pro"** dan menimpa instalasi Amy FX Pro yang ada di ponsel Android pengguna.
   - Akar masalah: Meskipun repositori dipisah ke `Amy-fx`, file build (`app/build.gradle.kts`, `.github/workflows/build-apk.yml`, dan `app-version.js`) masih menggunakan konfigurasi lama:
     - `applicationId`: `com.amyelitesuite.learningpreview` (sama persis dengan Amy FX Pro).
     - `AMYFX_APP_LABEL`: `Amy FX Pro`.
     - `AMYFX_URI_SCHEME`: `amyfxpreview`.
     - Manifest update URL: masih mengarah ke repo `Amy-fx-pro`.
2. **Solusi & Pemisahan Mutlak:**
   - **Application ID Android:** Diubah menjadi `com.amyelitesuite` (terdaftar resmi di Firebase `google-services.json`), sehingga Android memperlakukannya sebagai **dua aplikasi yang 100% berbeda** dan dapat terpasang berdampingan di satu HP tanpa saling menimpa.
   - **App Label:** Diubah menjadi `"Amy FX"`.
   - **URI Scheme:** Diubah menjadi `amyfx`.
   - **Update Channel & Manifest:** Diubah ke `https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json`.
   - **Versi Rilis:** Ditetapkan ke `2.0.0-amyfx.414` (code `950414`).
   - **Artifact & Tag:** Diarahkan ke tag `amyfx-$version_name` dengan nama asset `AmyFX-latest.apk`.
   - **CI & Tests:** Workflow `build-apk.yml` serta seluruh regression suites (`production-release-identity`, `profile-version-update`, `stage5-hardening`, `personal-source-debug`, `pro348-ui-polish`, `six-issues-regression`, `native-updater`, `professional-glassmorphism-redesign`, `blueprint-preview-v1`, `expansion-range-reentry`) telah diselaraskan 100% dan lolos uji.

## 2026-10-13 — Pembentukan Skill Mentor Trading Privat 1-on-1, Twelve Data MCP Integration & Pedagogical Guardrails (Pro 426)
1. **Latar Belakang & Kebutuhan Pengguna:**
   - Pengguna membutuhkan bimbingan trading mandiri murni (teknikal ICT/SMC & fundamental makroekonomi) tanpa membahas koding, backtest teknis, atau aplikasi.
2. **Penciptaan Skill Global `mentor-trading-privat`:**
   - Berlokasi di `/root/.agents/skills/mentor-trading-privat/SKILL.md` (shared untuk Akun 1 & Akun 2).
   - Buku Pegangan Kurikulum: Vault Obsidian `/sdcard/Download/Obsidian/Amy_Trading_Academy_Vault/` (492 materi terstruktur).
   - Tracker Progres: Terhubung ke `/root/amy-market-data/learning_progress.json` & `progress_tracker.py`.
3. **Pemasangan Stdio Twelve Data MCP Server & Candle Builder Sync:**
   - Script Server: `/root/.agents/mcp-servers/twelvedata-server.mjs`.
   - Konfigurasi: `/root/.gemini/config/mcp_config.json`.
   - Kemampuan: Real-time price, live candles fetch dengan auto-save ke SQLite `/root/amy-market-data/xauusd_bot.sqlite`, serta engine deteksi ICT Market Structure (BSL, SSL, Sweeps, BOS, MSS/CHoCH, Active FVGs dengan 50% CE, dan Dealing Range Premium/Discount).
4. **Pedagogical Guardrails & Anti-Distraksi:**
   - *Chunking Method:* Menyampaikan materi bertahap 2-3 segmen logis per topik tanpa memangkas ilmu (Zero Information Loss).
   - *Anti-Halusinasi & Real-World Gold Rules:* Menolak Stop Loss mikro $1 di Gold; menerapkan SL struktural di balik sweep dan TP ke Draw on Liquidity nyata dengan RR >= 1:2.
   - *Cross-Semester Thematic Synthesis:* Membedah 1 konsep secara mendalam dengan merangkum seluruh catatan terkait dari Semester 1, 2, dan 3 dalam 8 Pilar Keahlian.
   - *True Level 0 Rule:* Dilarang menyodorkan chart atau jargon teknikal/institusional jika mulai dari nol; wajib dari logika manusia/pasar nyata.
   - *On-Context Discipline:* Dilarang melempar saran topik baru atau menu bercabang di akhir respons. Dicatat permanen di `/root/GEMINI.md` (Seksi 10 & 11) dan `RULES.md` (Pro 421).

## 2026-10-12 — Cockpit Mapping Professional Upgrade: Dual Entry Engine, Swing Stop Loss M5/M15 & Liquidity Targets
1. **Latar Belakang & Keluhan Pengguna:**
   - Aturan driver terlalu ketat: Terlalu banyak limit order menggantung (`WAITING_TRIGGER`) alih-alih eksekusi entry riil saat momentum kencang, menyebabkan setup terlewat.
   - Stop Loss terlalu sempit dan kaku ($0.1$ ATR / ~20 sen) tanpa berpatokan pada Protected Swing Low/High M5/M15, sehingga mudah tersapu noise/spread wicks XAU/USD. TP dipatok kaku 0.8R alih-alih mengejar external liquidity pools (BSL/SSL).
2. **Dual Entry Engine (Market Execution on Displacement vs OTE Limit on Retest):**
   - Mengintegrasikan `Dual Entry` pada Six Drivers (`six-drivers.mjs`, `api/scalper-setups.js`):
     - Jika konfirmasi displacement M5 terpicu (`isConfirmed`), status menjadi `ACTIVE` dengan `marketEntry` (harga close candle displacement) dan note: *Konfirmasi M5 close terpicu · Market Execution*.
     - Jika harga belum konfirmasi tapi menyentuh level limit (`isLimitTriggered`), posisi berjalan otomatis.
     - Jika sedang menunggu retrace, menyajikan rencana limit di zona OTE.
3. **Stop Loss Berbasis Swing M5/M15 Institusional:**
   - Stop loss buffer diperluas secara adaptif: `swingBuffer = Math.max(0.60, Math.min(1.50, event.atr * 0.25))` bersandar pada swing extreme pivots M5/M15.
4. **TP2 Likuiditas Riil & R:R Proporsional:**
   - TP1 mengunci target dasar model, TP2 mengejar target likuiditas eksternal nyata (BSL / SSL / PDH / PDL).
   - Menghitung `realRr` dinamis berdasarkan jarak ke likuiditas pool.
5. **Hardening Sweep Reclaim Fallback Logic:**
   - Memperbaiki bug di `sweep-acceptance.js` di mana level/close bernilai null sebelumnya mengembalikan `reclaimed = true`. Kini di-fallback ke `false` (`SWEEP_UNCONFIRMED`) agar tidak memunculkan false signal rejection saat data unconfirmed.
6. **Cockpit UI & Watch Card Hardening:**
   - Memperbarui `scalper-entry-watch-v1.js`, `scalper-panel.js`, dan `scalper-model.js` dengan label status akurat, detail dual entry, serta penyesuaian label TP1 & TP2 Likuiditas.
7. **Verifikasi:** 64 targeted unit tests PASS (4.3s) tanpa regresi. Disinkronkan ke upstream `Amy-fx-pro` dan `Amy-fX-pwa`.

## 2026-10-12 — Peralihan Fokus Penuh ke Amy FX sebagai Aplikasi Pribadi Pengguna
1. **Latar Belakang & Keputusan Pengguna:**
   - Pengguna menetapkan bahwa mulai saat ini fokus pengembangan harian, koding, fitur baru, dan rilis aplikasi beralih 100% ke repositori pribadi **`Amy-fx`** (`/root/Amy-fx` dan `/sdcard/Download/Amy-fx`).
   - `Amy-fx-pro` (`/root/Amy-fx-pro`) dipertahankan sebagai basis referensi / upstream template.
2. **Implementasi & Paritas:**
   - Seluruh kode dari Pro telah disalin 100% ke `Amy-fx` (Cockpit Mapping, Chart Gold ICT, Candle Replay multi-timeframe, 36 modul Academy, dan Vercel serverless).
   - Keystore penandatanganan rilis permanen (`AMYFX_PRO_KEYSTORE_BASE64`) telah dikonfigurasi pada repositori `suhaimitoamy/Amy-fx` dan build rilis APK (`Amy FX Pro 2.0.0-pro.413`) telah berhasil diterbitkan via GitHub Actions.
   - Server web lokal `tools/serve-local.mjs` di `Amy-fx` siap digunakan untuk pengujian cepat.

## 2026-10-12 — Neural Link Chat Auto-Healing, Timeout Shield & Complete Office Audit (Pro 425)

1. **Akar Masalah "Neural Link Chat Error / Tidak Ada Chat":**
   - **Penyebab Utama:** File `office_conversation_id.txt` sebelumnya menyimpan ID percakapan Antigravity (`75eec3f5-...`) yang mengalami network timeout pada stream gRPC Google server.
   - Karena tidak ada mekanisme pembersihan otomatis, setiap kali pengguna mengetik pesan baru, `server.mjs` memanggil `agy --conversation 75eec3f5-...` yang menggantung tanpa henti selama lebih dari 6.5 menit (387561 ms), lalu memuntahkan pesan error mentah `AGY_ERROR: {"short_error":"connection timed out"}`.
   - Akibatnya, chat freeze, input terkunci, dan pengguna melihat error tanpa balasan.

2. **Penyempurnaan Backend `server.mjs` (Zero-Stall & Auto-Heal):**
   - **Disk Validation:** Memverifikasi keberadaan folder percakapan di disk `/root/.gemini/antigravity-cli/brain/` sebelum mengoper flag `--conversation`. Jika tidak ada, ID otomatis di-reset ke sesi segar.
   - **Auto-Unlink Stale Sessions:** Jika child process `agy` keluar dengan `code !== 0` atau terdeteksi `network issue` / `timed out` / `grpc error`, file `office_conversation_id.txt` seketika di-unlink/dihapus agar prompt berikutnya langsung memulai sesi baru tanpa terjebak.
   - **Timeout Shield (120s):** Child process Antigravity diberi batas waktu maksimum 120 detik. Jika menggantung, proses otomatis di-kill secara graceful dan sesi di-reset mandiri.
   - **User-Friendly Error Sanitization:** Mengubah dump JSON gRPC mentah menjadi notifikasi ramah pemulihan jaringan.

3. **Penyempurnaan Frontend `public/app.js` & Riwayat Chat:**
   - **Multi-Agent Recovery Filter:** Memperbaiki bug di baris 1092 di mana loop recovery hanya mendeteksi balasan dari `prime` / `nova`. Kini mencakup seluruh armada (`swarm`, `laya`, `builder`, `coder`, `chronos`, `qa`, `recon`, `scribe`, `hermes`).
   - **Auto-Expand Chat Drawer:** Menghubungkan fungsi `toggleChatMinimize(false)` pada tombol aksi monitor (`btnMonChat` & `btnMonTask`) sehingga drawer chat otomatis terbuka penuh dan fokus ke input teks saat pengguna menekan tombol bicara/tugas.
   - **Pembersihan Log History:** Menghapus entri dump error gRPC lama dari `chat_history.json`.
   - **Verifikasi Fungsional:** Uji coba live via curl membuktikan stream SSE menerima delta teks huruf-per-huruf dalam 10 detik dan event `done` sukses tercatat.

## 2026-10-12 — Tactical Bird's Eye View Priority, Orbit Touch Normalization & Seamless Dual-Mode Exploration (Pro 424)

1. **Restorasi Mode Pantauan Atas (Bird's Eye / 3D Orbit) sebagai Mode Utama Default:**
   - **Keluhan Pengguna:** Mode First-Person terus-menerus membatasi keleluasaan memantau pergerakan seluruh bot dari atas seperti di versi awal.
   - **Solusi:**
     - Startup default 3D dikembalikan ke mode `ORBIT` (Pantauan Atas) pada koordinat kamera optimal `(0, 145, 230)` dengan target meja War Room tengah `(0, 8, 0)` dan sudut isometrik taktis ~33°.
     - Seluruh stasiun robot melingkar ($R=110$), animasi bot, dan mobilitas Sims terlihat leluasa 100% dari atas.

2. **Penyelarasan Touch Event & OrbitControls Normalization:**
   - **Akar Masalah Kontrol Layar Sentuh:** Event `touchstart` sebelumnya mencegat sentuhan di 65% area layar kanan untuk First-Person look-around bahkan saat berada di mode Orbit, sehingga OrbitControls di HP/tablet terblokir.
   - **Solusi:** `touchstart` look-around dibatasi ketat hanya aktif jika `camMode === 'FIRST_PERSON'`. Saat di mode `ORBIT`, OrbitControls memegang kendali penuh tanpa gangguan (1 jari putar 360°, 2 jari pinch zoom & pan).

3. **Dual-Mode Ergonomics (Pantauan Atas vs POV Jalan Kaki):**
   - **Tombol Toggle Cepat di Toolbar:**
     - `🦅 PANTAUAN ATAS` (default) ↔ `🚶 JALAN KAKI (POV)`.
     - Tombol `🦅 RESET ATAS` instan mengembalikan kamera ke sudut pandang bird's-eye view default.
     - Joystick analog virtual otomatis disembunyikan di mode Pantauan Atas (layar 100% bebas hambatan) dan otomatis muncul saat masuk ke POV Jalan Kaki.
   - **Inspeksi Bot Non-Intrusif (`inspectAgentFromAbove`):**
     - Mengklik bot/meja di mode Pantauan Atas tidak lagi memaksa kamera terkunci ke tanah; kamera meluncur halus dari atas ke stasiun robot (`Y = 36`) dengan OrbitControls tetap aktif dan Live Work Monitor HUD terbuka.

## 2026-10-12 — Zero-Obstruction Open Citadel, Station Proximity & Live Robot Work Monitoring (Pro 423)

1. **Zero-Obstruction & Open-Plan Walkway Citadel:**
   - **Keluhan Pengguna:** Gedung luar dan pohon-pohon menghalangi pemandangan & jalan, dan pengguna tidak bisa mendekat ke stasiun meja robot.
   - **Solusi:**
     - Mengosongkan 19 gedung pencakar langit luar (`buildCitySkyline`) dan seluruh pohon kristal / tiang jalan / kuil monolith Zonai.
     - Mengubah platform sektor kamar menjadi *open-plan walk-in* tanpa balustrade, pagar kaca samping, atau pylon penghalang.
     - Memperpendek radius orbit stasiun dari $R=210$ ke $R=110$ (dimensi lantai 48x44), sehingga stasiun robot berada di jarak ideal yang cepat dan leluasa dicapai.

2. **Live Robot Work Monitor HUD (`#agent-work-monitor`):**
   - **Deteksi Proximity Otomatis:** Saat avatar mendekati meja kerja robot ($dist < 26$), sistem otomatis memunculkan panel monitor kerja holografis di bagian atas layar dengan aksen warna neon sesuai robot.
   - **Data Pekerjaan Riil (Anti-Halusinasi):** Menampilkan tugas nyata sistem per robot (bukan klaim fiktif), kapasitas nalar (100% High Effort), dan telemetri pasar live ($XAU/USD).
   - **Integrasi Tombol Aksi:**
     - Tombol `💬 BICARA LANGSUNG`: Membuka drawer chat dan menyematkan target `@AGENT` di input chat.
     - Tombol `⚡ TUGASKAN KERJA`: Menyematkan template instruksi spesialis robot ke input chat.
     - Tombol `✕`: Menutup panel secara halus.
   - **Auto-Hide:** Saat avatar melangkah menjauh ($dist \ge 30$), panel monitor otomatis ditutup.

3. **Fast Teleport & Direct First-Person POV Face-to-Face (`walkToAgentWorkstation`):**
   - Dropdown `🚀 KUNJUNGI MEJA ROBOT...` memposisikan avatar langsung di depan meja robot ($14$ unit di depan stasiun), mengarahkan sudut pandang kamera (yaw) sejajar wajah robot, dan langsung membuka Live Work Monitor HUD.

## 2026-10-12 — First-Person POV Exploration & Physics Normalization (Pro 422)

1. **Eliminasi Avatar Karakter di Layar (Layar Plong 100%):**
   - **Keluhan Pengguna:** Model karakter mecha terlalu besar, memblokir separuh pandangan HP vertikal, dan orientasi third-person membuat navigasi membingungkan.
   - **Solusi:** Seluruh mesh avatar (`avatarGroup.visible = false`), badge sprite, dan ground ring disembunyikan total dari viewport kamera.
   - **First-Person POV:** Kamera diposisikan langsung pada ketinggian mata operator (`eyeY = mesh.position.y + 6.2 + eyeBob`), menghadirkan sensasi berjalan langsung di dalam kantor virtual secara imersif dan leluasa tanpa ada objek karakter yang menghalangi pandangan.

2. **Perbaikan Vektor Arah Gerak POV & Penyelarasan Look-Around:**
   - **Akar Masalah Kontrol Terbalik:** Sebelumnya `yaw` dievaluasi 0 saat mode bukan `ZELDA_RPG`, dan `touchmove`/`mousemove` mengabaikan mode `FIRST_PERSON`. Akibatnya, saat kamera menoleh, pergerakan joystick tidak mengikuti arah pandang dan terasa bergerak terbalik.
   - **Resolusi Matematis:**
     - Vektor maju di bidang horizontal XZ: `fwdX = -Math.sin(fpYaw)`, `fwdZ = -Math.cos(fpYaw)`.
     - Vektor kanan (strafe): `rightX = Math.cos(fpYaw)`, `rightZ = -Math.sin(fpYaw)`.
     - Dorong joystick ke ATAS selalu MAJU lurus ke mana pun mata kamera sedang memandang.
     - Dorong ke BAWAH selalu MUNDUR menjauhi pandangan.
     - Dorong ke KANAN/KIRI melakukan strafe kanan/kiri secara tegak lurus.
   - **Look-Around Luwes:**
     - Swipe di area bebas (kanan layar) memutar pandangan 360° secara mulus (`fpYaw` horizontal, `fpPitch` vertikal dikunci antara -1.18 s.d. +1.18 rad agar leher tidak terbalik).
     - Tombol `🎯 RESET POV` (`snapFocus`) langsung mengembalikan arah pandangan tegak lurus horizontal ke depan.

3. **Normalisasi Fisika Nyata (Snappy & Alami, Anti-Gravitasi Bulan):**
   - Lompatan disesuaikan ke standar manusiawi yang lincah: `jumpVelocity: 1.4`, `gravity: -0.16`, `fallGravity: -0.26`, `maxFallSpeed: -2.2`.
   - Menghilangkan efek melayang lama tanpa bobot di udara. Pendaratan ke lantai (Y = 6) terasa solid dan instan.
   - Trampolin Quantum Launch Pad melontarkan dengan impuls proporsional (`vy = 3.6`) dan mendarat mantap.
   - Halus footstep head-bobbing (`eyeBob`) saat melangkah di lantai.

## 2026-10-12 — Zelda Action RPG Camera System & Realistic Action Physics Overhaul (Pro 421)

1. **Resolusi Vektor Joystick Terbalik & Orientasi Kamera Sempurna:**
   - **Akar Masalah:** Sebelumnya kalkulasi `Math.atan2(moveX, moveZ)` memicu sudut 180° saat jempol digeser ke atas (`normY < 0`), sehingga karakter malah mundur mendekati kamera.
   - **Perbaikan Vektor 3D Standard Game Dev:**
     - `forwardInput = -moveZ` (ke atas = maju positif, ke bawah = mundur negatif).
     - `rightInput = moveX` (ke kanan = positif, ke kiri = negatif).
     - Transformasi arah ke dunia 3D: `worldDir = (camForward * forwardInput) + (camRight * rightInput)`.
     - Geser jempol ke ATAS kini 100% bergerak MAJU ke depan menjauhi kamera, ke BAWAH bergerak MUNDUR, ke KANAN ke kanan, dan ke KIRI ke kiri.

2. **Perombakan Sistem Fisika Nyata (Realistic Action Game Physics):**
   - **Snappy Jump & Dynamic Fall Multiplier:**
     - Menghapus efek melayang lambat tanpa bobot. Gravitasi dinaikkan secara proporsional (`gravity: -0.19`, dengan `fallGravity: -0.32` saat turun ke bawah).
     - Durasi lompatan menjadi akrobatik, snappy, dan memuaskan (~20 frame / 0.35 detik) dengan tinggi proporsional (~7 unit seimbang dengan tubuh mecha).
     - Kecepatan jatuh maksimum dibatasi (`maxFallSpeed: -2.2`) untuk mencegah tunneling.
   - **Hentakan Mendarat (Squash & Stretch Landing Recoil):**
     - Saat lepas landas: tubuh mengalami peregangan vertikal (*stretch* `scale.set(0.88, 1.25, 0.88)`).
     - Saat mendarat dari udara: tubuh mengalami kompresi elastis (*squash* `scale.set(1.22, 0.76, 1.22)`), memicu letupan debu/spark emas di lantai dan suara taktil landing, lalu kembali elastis ke normal via spring lerp.
   - **Footstep Bobbing & Inersia Badan:**
     - Saat berlari di lantai, tubuh berbobot menjejak lantai naik-turun (`mesh.position.y = 6 + Math.abs(Math.sin(walkCycle)) * 0.65`) dengan ayunan tangan ritmis dan badan condong ke depan (*pitch lean*).
   - **Solid Obstacle Colliders:**
     - Meja bundar War Room di tengah (R = 26) dan Kuil Kuno Monolith (R = 19) kini memiliki deteksi tabrakan fisik elastis, sehingga karakter tidak menembus objek seperti hantu.
   - **Perbaikan Launch Pad Springs:** Platform pelontar melontarkan karakter dengan impuls hidrolik tinggi (`vy = 4.6`) dan peregangan tubuh hidrolik.

2. **Ekspansi Dunia RPG Kaya (Rich Environment Population):**
   - **4 Kuil Kuno (Zonai Shrines / Ancient Monoliths):** Ditempatkan di 4 sudut diagonal (NW, NE, SW, SE) dengan pondasi heksagonal batu obsidian bertingkat 3, 4 pilar kristal spiral, inti energi berputar mengambang di udara, dan cincin runik vertikal.
   - **16 Pohon Kristal Neon (Bioluminescent Flora):** Pohon kristal low-poly 3-tier dengan pucuk kristal berpijar tersebar di ring taman dalam dan luar.
   - **10 Tiang Lampu Jalan Heksagonal:** Menerangi jalan setapak dan koridor sektor dengan tudung lentera cyan neon.
   - **4 Quantum Launch Pads (Trampolin Pelontar Vertikal):** Ditempatkan di 4 penjuru (Utara, Selatan, Timur, Barat). Ketika Amy menginjak platform ini, Amy langsung terlontar tinggi ke udara (`p.vy = 4.2`) dengan letupan spark plasma dan notifikasi HUD.
   - **8 Peti Suplai Interaktif (Loot Chests):** Peti baja cyberpunk yang terbuka otomatis saat didekati oleh Amy, memancarkan pilar sinar vertikal dan memberikan loot taktis (misal: *Algoritma ICT Deep OTE 78.6%*, *Blueprint Megastructure Titan*, dll.).
   - **War Room Central Holographic World Globe:** Bola dunia 360° wireframe berputar di atas meja War Room dengan titik-titik pusat trading dunia (New York, London, Tokyo, Sydney).
   - Seluruh geometri Three.js berpoligon rendah (low-poly) teroptimasi ARM64 sehingga FPS terkunci 60 FPS mulus di smartphone.

## 2026-10-12 — Resolusi Freeze Chat Kantor & Dukungan Penuh Kendali Mecha HP (Pro 420)

1. **Akar Masalah Freeze Chat Kantor Teridentifikasi:**
   - Proses child CLI Antigravity di background (`PID 10308`) berjalan terlalu lama mengeksekusi multi-tool search pada sesi nalar tinggi (`--effort high`), menyebabkan koneksi streaming SSE di browser smartphone terkatung-katung.
   - Proses macet telah dihentikan, dan file riwayat chat disinkronkan kembali dengan laporan eksekutif lengkap.

2. **Dukungan Penuh 100% Smartphone / Layar Sentuh HP (Mobile RPG Controls):**
   - Menghapus ketergantungan pada keyboard desktop (WASD / Panah / Spasi).
   - Mengaktifkan **Dual Mobile Control System**:
     1. **Analog Virtual Joystick 360°:** Ditempatkan di sudut kiri bawah dengan listener sentuh native (`touchstart`, `touchmove`, `touchend` di window) sehingga gerakan jempol bebas geser 360 derajat tanpa pernah putus.
     2. **Tap-To-Move (Ketuk Lantai):** Deteksi sentuhan jari pada lantai 3D Three.js memunculkan target suar berdenyut dan menggerakkan avatar Amy langsung ke titik yang disentuh.
     3. **Tombol Aksi Touchscreen:** `⚡ LOMPAT` (Jet Thruster vertical leap), `🚀 LARI` (Sprint toggle), dan `🎯 FOKUS` (Kamera memusat ke Amy).
   - Sintaks divalidasi 100% via `node --check`.

## 2026-10-12 — Aktivasi Dewan Citadel & Kolaboratif Dynamic Multi-Agent Swarm (Pro 419)

1. **Akar Masalah "Silo Tunggal Nova" Teridentifikasi & Dituntaskan:**
   - Ditemukan bahwa chat Neural Link sebelumnya selalu terkunci pada agen tunggal Nova (`targetId = 'prime'`) karena selector default mengisolasi instruksi ke Nova sendirian dengan prompt guard sempit.
   - Akibatnya, saat Operator Amy memberikan instruksi kompleks atau pertanyaan berbobot, agen spesialis lain (Laya, Forge, Titan, Chrono, Aegis, Scribe, Hermes) tidak ikut ter-trigger.

2. **Aktivasi Default "DEWAN CITADEL // Kolaboratif Tim":**
   - Mengubah selector frontend (`#chat-target-agent`) dan backend routing (`server.mjs`) agar secara default mengaktifkan mode kolaboratif penuh (`targetId = 'swarm'`).
   - Menerapkan protokol **⚡ LAYA (Swarm Router & Dispatcher)** sebagai pembuka respon: mengevaluasi tingkat kompleksitas instruksi (Level 0 Direct s.d. Level 5 Enterprise Swarm) sesuai panduan `laya-subagent-dispatcher`.
   - Mengorkestrasi respon lintas peran spesialis:
     - ⚡ **LAYA:** Triage kompleksitas & alokasi tugas.
     - 🤖 **NOVA:** Logika penalaran & strategi sentral.
     - 🔨 **FORGE:** Baris kode teknis & sintesis file (eksekusi tool nyata tanpa halusinasi).
     - 📐 **TITAN:** Arsitektur fisik 3D, blueprint menara bertingkat, dan tata ruang.
     - 🔬 **CHRONO:** Kuantitatif, data pasar live XAU/USD, dan pengujian formula OTE 78.6%.
     - 🛡️ **AEGIS:** Sentinel QA, terminal syntax check, dan audit stabilitas.
     - 📚 **SCRIBE:** Studio format dokumen & remaster PDF.
     - 🎙️ **HERMES:** Penutup resmi dengan Dossier Eksekutif ringkas untuk Operator Amy.

3. **Integrasi Visual & Simulasi 3D Real-Time:**
   - Menambahkan parser delta streaming di `public/app.js`: saat tag agen (misal `⚡ [LAYA]`, `🔨 [FORGE]`, dll.) terdeteksi dalam aliran teks SSE, robot 3D Three.js yang bersangkutan langsung menerima pulsa data neon, terbangun, dan melangkah ke meja War Room untuk berkolaborasi.
   - Styling dialogue box cyber-glassmorphism di `public/style.css` dengan aksen border warna neon unik per agen.
   - Validasi sintaks 100% via `node --check` dan reload aman zero-downtime via `pm2 reload amy-office`.

4. **Kapasitas Nalar Maksimal 100% (High Reasoning Effort & Eliminasi Gaya Kaku):**
   - Mengubah parameter agy CLI dari `--effort low` ke `--effort high` di `server.mjs`.
   - Mengeliminasi sandiwara template drama yang kaku dan memperbolehkan agen berpikir dalam (*deep Chain-of-Thought*), bernalar fleksibel, dan berkomunikasi lugas serta berbobot tinggi layaknya tim insinyur dan trader pro senior.

## 2026-10-12 — Integrasi Data Real-Time XAU/USD & Protokol Anti-Halusinasi Virtual Office (Pro 418)

1. **Akar Masalah Halusinasi Teridentifikasi & Dieliminasi:**
   - Ditemukan bahwa respons rapat War Room sebelumnya berhalusinasi mengarang angka fiktif ($2,880 – $2,915) karena dua faktor:
     - `public/office-simulation-3d.js` memiliki angka statis hardcoded ($2,948.50 pada grafik dan rentang $2,880 – $2,915 pada skrip dialog War Room).
     - `server.mjs` belum menyuntikkan data live market ke prompt reasoning saat user bertanya seputar trading/market/buy/sell/limit.
2. **Koneksi Langsung ke API Vercel Amy FX Pro:**
   - Menambahkan helper `fetchRealMarketContext()` di `server.mjs` yang mengambil feed langsung dari `https://amy-fx.vercel.app/api/scalper-setups` dan `api/twelvedata`.
   - Menginjeksi telemetri pasar nyata: Harga Terkini ($4,189.76 – $4,198.21), Dealing Range M15 (Low 4,184.15 s.d. High 4,200.09, EQ 4,192.12), Posisi Zona (Discount / Premium), M15 Structure (BULLISH MSS 4,196.70), Confluence Score (28/100 NO_SETUP), dan Status 6 Drivers (WAITING_STRUCTURE).
3. **Endpoint `/api/market-data` & Paritas Visual 3D Engine:**
   - Mengaktifkan REST endpoint `GET /api/market-data` di `server.mjs` dengan cache TTL 30 detik.
   - Mengupdate `public/office-simulation-3d.js` agar secara periodik mengambil data live dari `/api/market-data`, memperbarui canvas chart wall dengan harga nyata dan level FVG/OTE aktual, serta menyelaraskan dialog 10 robot di War Room 100% berbasis data nyata engine.
4. **Validasi & Zero-Touch PM2:**
   - Syntax diverifikasi via `node --check` dan service `amy-office` direload mulus via `pm2 reload amy-office`.
5. **Eliminasi Total Klaim Pekerjaan Palsu di Sims Autonomous Loop:**
   - Ditemukan bahwa siklus The Sims (`startSimsAutonomousLifeLoop`) memunculkan balon dialog palsu setiap 4.5 detik di atas kepala robot (misal Chrono mengaku sedang backtest 8 tahun, Forge mengaku sedang refactor shader Three.js, Scribe mengaku menerjemahkan PDF) padahal tidak ada tugas nyata yang sedang berjalan.
   - Seluruh teks klaim tugas fiktif diganti 100% dengan status ambient standby jujur ("Standby di stasiun kerja", "Rehat sejenak di lounge", "Menunggu instruksi").
   - Interval diperlambat dari 4.5s ke 12s agar tenang dan tidak spamming.
   - Penambahan `systemGuard` di `server.mjs`: Melarang AI mengklaim tugas/koding sudah selesai jika tool belum benar-benar dipanggil dan dieksekusi secara nyata.

## 2026-10-10 — Masterclass PDF Amy FX Academy Modul 02 [Membaca Chart & Anatomi Candlestick] (Pro 417)

1. **Penerbitan Masterclass Ebook Vertikal A4 Standar Institusional (24 Halaman):**
   - Mengompilasi materi 9 bab utuh dari Obsidian Vault (`bagian-02-membaca-chart/`) menjadi dokumen Ebook masterclass vertikal A4 publikasi resmi (24 Halaman, 645 KB).
   - Mempertahankan 100% gaya tutur mentor alami Amy FX (analogi pasar cabai, pedal gas mobil tol, pendaki gunung, bola karet kamar, boneka Rusia Matryoshka, tarik tambang).

2. **Diagram Teknikal HD 16:9 Dark Theme Murni (Bebas Ilustrasi Jadul):**
   - Menghapus ketergantungan pada ilustrasi 3D usang dan menggantikannya dengan 9 diagram teknikal HD 16:9 beresolusi tinggi bertema TradingView Dark (#0A0F18 / #111827):
     - Bab 01: Anatomi Chart (Sumbu Y Harga, Sumbu X Waktu, Jejak Transaksi).
     - Bab 02: Anatomi Candlestick OHLC & Prinsip Harga Close Sebagai Raja.
     - Bab 03: Dinamika Tarik Tambang Bullish vs Bearish & Sesi Istirahat Pullback.
     - Bab 04: Perbandingan Momentum Body (Gas) vs Wick Rejection (Rem).
     - Bab 05: Sifat Fractal & Multi-Timeframe (1 Candle H1 = 4 Candle M15).
     - Bab 06: Formasi 3-Candle Sah Swing High (Atap A) & Swing Low (Mangkok V).
     - Bab 07: Tiga Arah Trend (HH-HL Tangga Naik, LH-LL Tangga Turun, Sideways Ping-Pong).
     - Bab 08: Support & Resistance Role Reversal (RBS Retest Entry).
     - Bab 09: Siklus 4 Fase Market Structure (Akumulasi, Mark-Up, Distribusi, Mark-Down) & Konfirmasi BOS vs Alarm CHoCH (MSS).

3. **Tata Letak & Checklist Kelulusan Presisi:**
   - Halaman 1: Cover Masterclass berwibawa dengan preview chart Bab 02.
   - Halaman 2: Kata Pengantar Mentor & Silabus 9 Bab lengkap dalam 1 halaman rapi.
   - Halaman 3-23: Bab 01 s.d. Bab 09 dengan header bab independen dan diagram 16:9.
   - Halaman 24: Lembar Checklist Kelulusan 9 poin dengan kartu bergaris emas dan sertifikasi kelulusan menuju Modul 03.
   - Otomatis didistribusikan ke `/sdcard/Download/`, Telegram, Documents, dan `/root/`.


1. **Transformasi Materi Web Academy ke Format Masterclass Slide Persegi (810x810):**
   - Materi Modul 01 Amy FX Academy (`apps/academy/bagian-01-pemula-nol/index.html`) diterjemahkan dan ditransformasikan menjadi Masterclass Slide PDF 8 halaman dengan standar estetika identik dengan `ICT Entry Models [Bahasa Indonesia].pdf`.
   - Menghubungkan kurikulum web Amy FX Pro langsung dengan aset infografis institusional murni Michael J. Huddleston.

2. **Penerapan Standar "Zero-Patchwork" & Vector Polish:**
   - **Cover Slide:** Heading Navy (`#0A192F`), aksen Gold (`#C59B27`), badge kurikulum `MODUL 01 • 1 SKS`, dan ringkasan silabus terstruktur.
   - **Bab 01 s.d. 06:** Penjelasan mendalam tentang IPDA, Karakteristik Gold XAU/USD vs Forex/Indeks, Perhitungan Lot/Pip/Spread, Metrik Finansial (Balance, Equity, Margin, Free Margin) dengan Peringatan Hukum Besi Risiko 1-2%, Logika Penempatan Stop Loss & Take Profit, dan Membongkar Jebakan Indikator Retail.
   - **Grafik & Diagram Bersih:** Diagram SSL Liquidity Sweep, Penempatan SL Invalidation Point bersanding dengan Target Low-Hanging Fruit, serta Breaker Block (+BB/-BB) dan Fair Value Gap (BISI/SIBI) tanpa tambal sulam.
   - **Vector Checkmarks:** Halaman rangkuman akhir menggunakan vector checkmarks dinamis bersarang di dalam badge badge lingkaran hijau toska.
   - **Distribusi Otomatis:** Output disimpan langsung di `/sdcard/Download/Amy FX Academy - Modul 01 [Fondasi Pasar].pdf` dan disinkronkan ke Telegram, Documents, dan root.

## 2026-10-10 — Skill Global smart-pdf-remaster & Remaster Penuh Ebook ICT Entry Models (Pro 415)

1. **Akar Masalah Kegagalan Translasi PDF Lama (Tambal Sulam & Overflow):**
   - Percobaan awal translasi file PDF grafik/slide presentasi (`ICT Entry Models.pdf`) menggunakan metode in-place overlay langsung menempelkan teks terjemahan di atas file biner tanpa reflow.
   - Karena bahasa Indonesia lebih panjang 20–30%, teks saling menimpa (*overlap*), meluber keluar margin, memotong nomor langkah, dan teks diagram tengah (infografis langkah 1-5, anatomi Breaker Block, FVG BISI/SIBI) tertinggal dalam bahasa Inggris.

2. **Arsitektur Standar Remaster "Zero-Patchwork" & Pembuatan Skill Global:**
   - Diciptakan skill global resmi `/root/.agents/skills/smart-pdf-remaster/` yang menetapkan SOP remastering dokumen PDF grafis:
     - **Clean Canvas Clearing:** Tutupi area teks lama dengan poligon/kotak sewarna latar belakang asli (`rgb(1, 1, 1)`).
     - **Tipografi Berlapis & Reflow Manual:** Header tag ("1 dari 6"), Judul Utama (Bold 28–32pt), Paragraf terstruktur dengan `wrapText`, dan Infografis langkah dengan nomor transparan (*faint background numbers*) serta teks terpusat (*centered*).
     - **Preservasi Istilah Murni ICT:** Akronim institusional murni (`FVG`, `MSS`, `BOS`, `BSL`, `SSL`, `OTE`, `BB`, `BISI`, `SIBI`) dipertahankan secara utuh dan tepat.
     - **Multi-Lokasi Distribusi Otomatis:** Output langsung disalin ke `/sdcard/Download/`, `/sdcard/Download/Telegram/`, `/sdcard/Download/Documents/`, dan `/root/`.
     - **Verifikasi Visual Mutlak (QC):** Halaman kunci wajib di-render ke PNG via `pdftoppm` dan diverifikasi dengan `view_file` sebelum diserahkan.
   - Buku `ICT Entry Models [Bahasa Indonesia].pdf` berhasil diremaster penuh 32 halaman dengan tingkat keterbacaan sempurna tanpa cacat visual.


## 2026-10-10 — Overhaul Kurikulum Academy: Eliminasi Mitos Retail SMC & Penggabungan 3 Semester ke 12 Modul Master Terpadu (Pro 414)

1. **Akar Masalah Kurikulum Lama (Bloat & Konten Menyesatkan):**
   - Kurikulum sebelumnya membengkak hingga 36 pertemuan dan 492 sub-bab yang sarat pengulangan (*bloated*) dan desinkronisasi nama direktori (misal folder `bagian-17-fvg` berisi Liquidity Mapping).
   - Tersusupi konsep retail SMC palsu yang bertentangan dengan ajaran Michael J. Huddleston (ICT Murni):
     - Mitos mekanis *"IDM = pullback pertama wajib disapu sebelum BOS sah"*, yang menjebak trader melawan tren kuat.
     - Penyelundupan istilah *"CHoCH"*, memicu false break di timeframe mikro.
     - Mitos *"Bank mengalami floating loss di Order Block dan berusaha keluar di BE"*.
     - Pengacauan terminologi Consequent Encroachment (CE) pada Order Block (seharusnya Mean Threshold).
     - Penggunaan jam sesi statis WIB yang mengabaikan siklus Daylight Saving Time (DST) New York.
   - Kontradiksi internal di mana materi academy bertentangan dengan engine teknikal Amy FX Pro (`AMY_ICT_NextGen.pine`) yang mengevaluasi konfirmasi langsung dari displacement candle M15 tanpa syarat IDM.

2. **Solusi & Hasil Eksekusi Penyatuan Kurikulum:**
   - **Konsolidasi 12 Modul Master Terpadu:** Seluruh materi esensial dari Semester 1, 2, dan 3 dipadatkan dan disatukan menjadi 12 Modul Master komprehensif (Modul 01 s.d. 12) yang 100% patuh pada metodologi ICT murni dan paritas dengan Cockpit Mapping.
   - **Pembersihan Bersih (Zero-Bloat):** Lebih dari 41.000 baris materi usang dan repetitif dibersihkan.
   - **Seamless Forwarding:** Direktori `bagian-13` s.d. `bagian-36` diubah menjadi redirector cerdas yang mengalihkan pembaca ke Modul Master yang relevan, menjaga kompatibilitas bookmark dan pengujian otomatis tanpa broken link.
   - **Modern UI Redesign:** Antarmuka `index.html` dan `daftar-materi.html` diperbarui dengan visual Dark Premium Fintech, filter kategori dinamis, dan navigasi ramah mobile.
   - **Integritas Pengujian:** Seluruh 31 targeted test suites (`guided-academy`, `blueprint-preview-stabilization`, `market-learning-live-examples`, `preview-connectivity-final-v3`) lulus 100%.

## 2026-10-09 — Replay Multi-Timeframe Mulus & Penyelarasan Kursor Presisi (Pro 413)

1. **Akar Masalah Kursor Stuck & Persepsi Otomatis M1:**
   - Kursor lama dari timeframe sebelumnya (misal bar 80 M1) menyebabkan M15/M30 hanya memiliki sedikit lilin (5 bar di M15, 2 bar di M30), dan penekanan tombol `+1` hanya menyelesaikan sisa pecahan lilin yang sama tanpa memajukan chart ke lilin baru.
   - Label dropdown data bertuliskan `31.000 M1` membuat trader mengira sistem mengabaikan opsi timeframe yang dipilih.
   - Strip OHLC dan status bar menampilkan waktu kursor parsial M1 (`02:14 WITA`, `02:29 WITA`) alih-alih waktu lilin bucket (`02:00`, `02:15`).
2. **Solusi & Hasil Eksekusi:**
   - Diimplementasikan pelacak state `isDefaultInitial`: beralih timeframe dari posisi awal default langsung menginisialisasi 80 lilin penuh dari timeframe target (M5, M15, M30, H1, H4, D1). Jika posisi sudah dinavigasi, kursor dipertahankan secara presisi.
   - Label pack diubah menjadi `bar (M1–D1)` di `candle-replay.js`, `chart-analysis.js`, dan `data-provider.js`.
   - Strip OHLC menggunakan `current.time` (waktu pembukaan bucket), status bar menampilkan format `[TF] · Candle ...`, dan badge TF aktif disematkan di UI.
   - Fast-path `trustedSeries` pada fungsi agregasi biner mempercepat pemrosesan data historis hingga 10x lebih ringan (~5ms per langkah).
   - Seluruh targeted tests lulus 100% (20/20 di `trading-practice-replay.test.mjs` dan 4/4 di `pro348-ui-polish.test.mjs`).

## 2026-10-09 — Cloud Library 8-Tahun (2019–2026) Multi-Timeframe via GitHub Releases & Vercel Proxy (Pro 411)

1. **Akar Kebutuhan & Eliminasi Upload Manual:**
   - Trader sebelumnya harus membuka file picker HP dan mengunggah file ZIP/CSV secara manual setiap kali latihan/backtest di menu Trading Practice (`chart-analysis.html` & `candle-replay.html`).
   - Kapasitas database Supabase terbukti sempit dan terkunci jika diisi baris candle, sementara menaruh data candle di asset web/Git akan membengkakkan ukuran APK dan repository.

2. **Arsitektur Hybrid Zero-Bloat Cloud Library:**
   - **Hosting Penyimpanan:** Seluruh data 8 tahun (2019 s.d. September 2026) multi-timeframe (M1, M5, M15, H1, H4, D1) yang telah diaudit (`REPAIRED_AUDITED`) dipublikasikan ke **GitHub Releases** (`amyfx-market-dataset-8years`), memuat 8 arsip tahunan (~42 MB) dan 93 arsip bulanan (~400-600 KB per bulan).
   - **Streaming Proxy & CDN Caching:** Dibuat Vercel serverless function `api/candles.js` yang menyediakan header CORS `*`, manifest katalog dinamis, dan streaming unduhan per bulan (400–600 KB) dengan edge cache permanen (`s-maxage=31536000, immutable`).
   - **Local Fallback di Termux:** Server lokal `tools/serve-local.mjs` langsung membaca file lokal dari `/sdcard/Download/lab backtest/candles/monthly/` dalam 0.01 detik tanpa internet.
   - **Antarmuka Pengguna & Smart Cache:** Di `chart-analysis.html`, ditambahkan kontrol **Perpustakaan Cloud (2019–2026)** untuk memilih Tahun (8 tahun) dan Bulan. File yang diunduh langsung diekstrak oleh `data-provider.js` dan disimpan permanen di IndexedDB browser/PWA iPhone.
   - **Hasil & Integritas:** Ukuran APK Android bertambah 0 byte, ukuran repository Git bertambah 0 byte, dan pengujian regresi targeted (`trading-practice-chart-regression` & `trading-practice-replay`) lulus 100% (34/34 tests).

## 2026-10-09 — Kebijakan Zero-Touch Supabase & Penetapan Kemandirian Runtime Vercel/Lokal (Pro 410)

1. **Konteks & Audit Status Supabase:**
   - Proyek Supabase `amy-market-data` (`wliecyxzlwhmtftnfnps`) berada dalam status **RESTRICTED** (`exceed_egress_quota`) akibat aktivitas kueri historis data candle massal pada tabel lama `candles`.
   - Meskipun Supabase terkunci, audit komprehensif membuktikan aplikasi Amy FX Pro 100% normal dan berjalan lancar karena seluruh fitur inti (Chart Gold M15/M5, TwelveData WebSocket, Indikator ICT NextGen, Alarm Sentuh Intrabar 0s, Advisor Verdict, Kalender, Berita, dan Six Drivers) telah beroperasi murni di Vercel (`api/twelvedata`, `api/scalper-setups`, `api/news`, `api/calendar`) serta mesin JavaScript offline di HP.

2. **Keputusan Mutlak Zero-Touch Supabase (Kunci Permanen):**
   - **Dilarang Menghapus & Dilarang Merombak:** Proyek Supabase tidak dihapus dan dilarang diotak-atik atau dirombak sama sekali. Anggap Supabase dalam status terkunci permanen dan biarkan apa adanya (*frozen state*).
   - **Dilarang Menambah Beban/Deploy Baru:** Dilarang mendeploy fungsi baru, menambah migrasi SQL, atau menaruh dataset candle ke Supabase.
   - **Kemandirian Penuh (Zero-Supabase Dependency):** Seluruh arsitektur runtime masa depan, pengayaan data backtest, dan fitur baru diarahkan 100% menggunakan Vercel Serverless, static CDN, atau penyimpanan lokal tanpa melibatkan Supabase client.

## 2026-10-08 — Live Intrabar Touch Alerts (0s Latency) for Liquidity Sweeps, Breaks & POI Tests (Pro 409)

1. **Akar Masalah Keterlambatan Notifikasi (BSL Sweep, Break, POI Test):**
   - **Closed-Candle Latency (13–15 Menit):** Engine server dan deteksi likuiditas sweep sebelumnya mengandalkan lilin yang telah resmi ditutup (`is_closed: true`). Jika sweep BSL/SSL atau breakout terjadi di awal lilin M15 (misalnya menit ke-2), notifikasi baru terpicu setelah candle M15 selesai pada menit ke-15:00, menghasilkan jeda 13–15 menit yang merugikan aksi reaksi cepat sniper.
   - **Kegagalan Background Worker Android:** `DriverSetupSyncWorker.kt` mewajibkan `m5Time` (`sourceObj?.optLong("M5", 0L)`). Saat feed beralih ke M15 murni, background worker Android menganggap data kadaluwarsa/hilang dan batal diam-diam.

2. **Solusi & Implementasi 2-Tier Real-Time Model:**
   - **Tier 1 (Instant Intrabar Touch Alert · Latensi 0s):**
     - Dibuat fungsi `checkIctIntrabarSweeps(current, prev)` di `app/src/main/assets/apps/mapping/js/ict-workspace/price-alert-manager.js`.
     - Fungsi ini dievaluasi pada setiap tick harga live (`amyfx:twelvedata-price`, `amyfx:price-tick`, MutationObserver pada `#chart-price`, serta safety loop 2.5s).
     - Memeriksa level-level kritis aktif dari `window.AmyMarketContext` / `localStorage`:
       - **BSL / PDH / Asia High / PWH / EQH**: Tembusan ke atas (`prev < level && current >= level`) -> `⚡ SWEEP INTRABAR: <LABEL>`.
       - **SSL / PDL / Asia Low / PWL / EQL**: Tembusan ke bawah (`prev > level && current <= level`) -> `⚡ SWEEP INTRABAR: <LABEL>`.
       - **Break Struktur / Invalidasi M15**: Tembusan ke bawah pada bias Bullish atau tembusan ke atas pada bias Bearish -> `⚠️ BREAK STRUKTUR: XAU/USD Menembus $<LEVEL>`.
       - **Uji Zona POI**: Harga masuk ke rentang POI M15 (`low`–`high`) dari atas maupun bawah -> `🎯 UJI ZONA POI: XAU/USD Masuk ke <LABEL>`.
     - **Multi-Channel Instant Dispatch:** Notifikasi langsung dikirim via Android Native Bridge (`window.Android.showNotificationWithUrl`), Web Notification API, Web Audio API chime chime melodic, haptic vibration, dan top glassmorphism banner (`showIctBanner`).
     - **Anti-Jitter Cooldown:** Diterapkan cooldown 5 menit (`ICT_COOLDOWN_MS = 300000`) per level key agar tidak terjadi getaran/notifikasi berulang saat harga bolak-balik di sekitar level.
     - **Weekend Anti-Spam:** Otomatis dibungkam saat pasar tutup (`isGoldMarketOpen() === false` atau `session === 'PASAR TUTUP'`).
   - **Tier 2 (Confirmed Closed Candle Reclaim):**
     - Analisis candle tertutup M15 tetap berjalan normal setelah lilin resmi close untuk mengonfirmasi kelanjutan displacement / MSS atau wick rejection.
   - **Background Worker Android Sync:**
     - `DriverSetupSyncWorker.kt` diperbarui untuk membaca `M15` terlebih dahulu (`sourceObj?.optLong("M15", 0L)`), fallback ke `M5`, dan batas kedaluwarsa diperluas ke 3600s (1 jam).
   - Validasi sintaks `node --check` dan targeted unit tests (16/16 di `tests/price-alert-manager.test.mjs`, 8/8 di `tests/trade-lifecycle-tracker.test.mjs`, 21/21 di `tests/mapping-six-drivers-pro382.test.mjs`, 15/15 di API/audit) lulus 100%.

## 2026-10-08 — Driver Mapping Full M15 Authority Decoupling & Residual M5 Removal

1. **Akar Masalah Residual M5 & Disparitas Timeframe:**
   - **Konteks & Strategi Trading Nyata Pengguna:** Seluruh alur kerja Cockpit Mapping, Amy Bias Matrix V2, Laya Advisor Panel (187k lilin historis M15), Dealing Range 50% CE, dan grafik Gold utama beroperasi pada time frame **M15**.
   - **Warisan Kode M5 di Background yang Memblokir Trigger:**
     - `driver-model.js` menolak evaluasi driver (`return null`) jika `e.sourceTime !== context.source?.M5`.
     - `lib/scalper-engine/six-drivers.mjs` memaksa `sixConfirmation` pada lilin M5 dan memberi status `WAITING_M5_BREAK` saat zona disentuh, menuntut break displacement M5 dalam batas waktu sempit 30 menit (hanya 2 bar M15), sehingga setup kadaluwarsa (`EXPIRED`) sebelum lilin M5 terbentuk.
     - `market-context.mjs` mematikan kesegaran (`fresh = false`) jika lilin M5 tidak lengkap atau terlambat >15 menit.
     - `api/scalper-setups.js` jatuh ke cache basi jika endpoint data 5min TwelveData mengalami rate limit.
     - Salinan teks UI di antarmuka mapping masih menampilkan string warisan M5 (`Memeriksa aksi harga M15 / M5...`, `Entry Assistant · M5`, dll).

2. **Perbaikan & Sinkronisasi Otoritas M15 Murni:**
   - **Pilar 1 (Penyelarasan Driver Model & Source Time):** Di `driver-model.js`, `currentDriverEvaluation` disesuaikan agar menerima timestamp lilin M15 maupun M5 (`e.sourceTime === context.source?.M15 || e.sourceTime === context.source?.M5`), dan toleransi evaluasi diperpanjang hingga 2100s (35 menit) untuk ritme M15.
   - **Pilar 2 (Fallback Otoritas Eksekusi M15 pada Six Drivers):** Di `six-drivers.mjs` (keduanya `lib` dan `supabase`), `executionCandles` otomatis menggunakan `T` (jika tersedia ≥30 bar) atau `M` (M15). Jendela konfirmasi sentuhan diperluas ke 3600s (1 jam) agar retest M15 memiliki ruang bernapas yang cukup sebelum kedaluwarsa.
   - **Pilar 3 (Kemandirian Data Market Context):** Di `market-context.mjs`, parameter `fresh` tidak lagi mewajibkan M5 jika lilin M15 dan H1 lengkap dan segar. Di `api/scalper-setups.js`, kegagalan 5min TwelveData tidak lagi memicu fallback cache basi.
   - **Pilar 4 (Pembersihan Teks Antarmuka Mapping):** Seluruh label `M5` di antarmuka Mapping (`index.html`, `ict-presentation.js`, `context-panel.js`) dibersihkan menjadi `M15`, menyelaraskan 100% narasi antarmuka dengan strategi trading pengguna.
   - Seluruh 44 targeted tests (`mapping-six-drivers-pro382`, `trade-lifecycle-tracker`, `mapping-six-driver-api-pro382`, `mapping-pro374-audit-fixes`) lulus 100%.

## 2026-10-08 — Driver Mapping Entry Limit Trigger Overhaul (Realistic Tolerances, WAITING_M5_BREAK Retention, Touch Trigger & Client Lifecycle Sync)

1. **Akar Masalah Kegagalan Trigger Entry Limit:**
   - **Toleransi Deadline Terlalu Ketat:** `entry_deadline` sebelumnya di-hardcode hanya 15 menit (`nowSeconds + 900`). Dalam time frame M5 (3 bar lilin), retrace Gold ke zona limit hampir tidak pernah selesai dalam 15 menit sehingga seluruh order limit dibatalkan (`CANCELLED`).
   - **Filter Likuiditas Terlalu Restriktif:** Algoritma mengambil likuiditas terdekat (`nearestLiquidity`) di antara entry dan target. Adanya minor pivot kecil 2-bar M15 langsung menggagalkan `targetOk` dan mendemot status dari `CONFIRMED` ke `WAITING_TARGET`.
   - **Hilangnya Setup di API Saat Retest:** Di `api/scalper-setups.js`, filter hanya meloloskan `CONFIRMED` dan `ARMED`. Begitu harga menyentuh zona (touch), engine internal mengubah status menjadi `WAITING_M5_BREAK` sehingga kartu setup lenyap dari antarmuka aktif alih-alih aktif terpicu.
   - **Ketiadaan Evaluasi Sentuhan Harga (Touch Trigger):** API tidak memeriksa apakah harga candle saat ini telah mencapai level limit, dan `trade-lifecycle-tracker.js` di browser/HP tidak mendengarkan `amyfx:driver-setups` serta tidak menormalisasi properti `stopLoss` / `target` milik model driver.

2. **Perbaikan Terpadu (4 Pilar Eksekusi):**
   - **Pilar 1 (Deadline Realistis & Likuiditas Valid):** `entry_deadline` diperpanjang dari 900s menjadi `Math.max(3600, driver.hold)` (60–90 menit). Likuiditas target memilih level aktif yang mengakomodasi target (`validLiquidity || nearestLiquidity`) agar tidak terblokir oleh minor pivot 2-bar. Toleransi gap move dinaikkan ke `1.5 * ATR` di `six-driver-lifecycle.mjs`.
   - **Pilar 2 (Retensi WAITING_M5_BREAK di API):** Di `api/scalper-setups.js`, status `WAITING_M5_BREAK` dipertahankan dalam daftar `active` dengan catatan jelas (*"Retest zona tercapai · Menunggu break M5"*), mencegah setup menghilang saat harga menyentuh area.
   - **Pilar 3 (Touch Trigger Real-Time di API):** Di `api/scalper-setups.js`, jika harga candle saat ini (`m5` / `m15`) menyentuh level limit (`actualEntry`) tanpa menembus SL, status langsung bertransisi ke `ACTIVE` (*"Harga menyentuh level limit · Posisi berjalan"*).
   - **Pilar 4 (Integrasi Penuh Client Lifecycle Tracker):** Di `trade-lifecycle-tracker.js`, didukung normalisasi properti driver (`plan.direction`, `stopLoss`, `target`). Ditambahkan listener `amyfx:driver-setups` dan pemanggilan `trackAssistantPlan(s)` di `context-panel.js` sehingga saat harga tick live menyentuh entry limit, status lokal beralih ke `ACTIVE_RUNNING`, mengirim notifikasi Android trigger, haptic bergetar, dan tercatat otomatis di Win Rate Archive.


1. **Akar Masalah Driver Pasif & Zero Fill (2 Minggu Tanpa Eksekusi):**
   - 5 dari 6 driver di-hardcode sebagai order LIMIT pasif (`limit = true`) di titik tengah zona diskon (`(zone.low + zone.high)/2`).
   - Range Fibo di-set terlalu dalam (Deep OTE 75%–78.6%) sehingga dalam kondisi pasar Gold impulsif/trending 2 minggu terakhir, harga tidak pernah koreksi sedalam itu sebelum timeout kedaluwarsa 2 jam (`EXPIRED`).
   - AMY Entry Assistant V3 memiliki toleransi chase terlalu sempit (`maxChaseAtr: .35` / ~$0.70 di Gold), sehingga langsung dicap `MISSED` dan sinyal tidak terbit ke antarmuka.
   - Paradoks logika: konfirmasi M5 displacement sudah terjadi menjauh dari zona, tapi titik entry malah disuruh mundur ke belakang di tengah zona Fibo.

2. **Perbaikan & Sinkronisasi 3 Pilar:**
   - **Pilar 1 (Market Execution pada Konfirmasi M5):** Saat driver mencapai status `CONFIRMED` (retest + displacement M5 valid), level entry di `api/scalper-setups.js` otomatis menggunakan harga penutupan candle konfirmasi M5 (`confirmedEntry`), berstatus `ACTIVE` (bukan antre limit pasif `WAITING_TRIGGER`), dan dihitung target serta risk aktualnya.
   - **Pilar 2 (Fibo Sweet Spot ICT Realistis):** Rentang Fibonacci diperluas ke OTE Sweet Spot 61.8%–78.6% pada `HIGH_WINRATE_SNIPER_70`, dan 61.8%–75% pada `SWING_CHOCH_OTE` serta `MULTI_DRIVER_ENSEMBLE`. Disinkronkan secara konsisten di `lib/scalper-engine/six-drivers.mjs`, `supabase/functions/scalper-engine/six-drivers.mjs`, dan `app/src/main/assets/apps/mapping/js/engine/six-driver-definitions.js`.
   - **Pilar 3 (Prioritas & Toleransi Realistis AMY V3):** Toleransi di `amy-ict.mjs` diperlebar ke `maxChaseAtr: .75` (~$1.50-$2.00 breathing room di Gold), `zoneAtr: .35`, dan `retestAtr: .30`. Disinkronkan byte-identical di 3 file (`lib`, `supabase`, `assets/mapping`). Di `api/scalper-setups.js`, susunan kartu diurutkan secara tegas: AMY V3 (`priority: 1`), Confirmed Driver Market Execution (`priority: 2`), dan Armed Watchlist OTE Pullback (`priority: 3`).
   - Seluruh 66 unit test targeted (`mapping-six-drivers-pro382`, `mapping-six-driver-api-pro382`, `mapping-amy-ict-pro375`, `mapping-pro374-audit-fixes`) lulus 100% tanpa regresi.

## 2026-10-07 — PDH/PDL Alignment with New York 17:00 Close & Server Levels Precedence

1. **Akar Masalah Deviasi PDH (4179 vs 4184):**
   - Di `nextgen-indicators.js`, pengelompokan lilin intraday ke dalam hari kalender (`dayBuckets`) sebelumnya dipotong berdasarkan jam kalender lokal WITA murni (`00:00 WITA`).
   - Hal ini memotong sesi perdagangan New York menjadi 2 bagian: pergerakan harga emas sesi sore/malam New York (antara 12:00 NY hingga 17:00 NY, di mana rekor harian 4184 tercapai) terdorong masuk ke keranjang hari esok di WITA, meninggalkan keranjang kemarin dengan titik puncak hanya 4179.
   - Selain itu, `if (dayKeys.length >= 2)` dievaluasi lebih dulu, sehingga mengabaikan level PDH/PDL otoritatif harian dari D1 yang disediakan server (`serverLevels.pdh`).
2. **Solusi & Penyelarasan Standar Pasar Gold:**
   - Dibuat fungsi penentu sesi perdagangan `getTradingDayKey(timeSec)` berbasis **New York 17:00 Close (`America/New_York`)**: seluruh lilin dari pembukaan New York 17:00 hingga penutupan 17:00 hari berikutnya dikelompokkan ke dalam satu sesi perdagangan harian yang utuh.
   - Puncak sesi sore New York (4184) kini terserap sempurna ke dalam keranjang hari yang sama, menyelaraskan pembacaan lokal dengan grafik TradingView (`AMY_ICT_NextGen.pine`) dan MT5.
   - Diimplementasikan ekstraksi komprehensif level server/konteks (`serverAmyLevels`, `liquidityLevels` BSL/SSL, dan `context.pd`): jika level harian otoritatif D1 tersedia, sistem mengutamakan level tersebut (`Math.max(serverPdh, localPdh)`) agar tidak terdistorsi oleh keterbatasan buffer lilin intraday lokal.
   - Ditambahkan unit test di `tests/ict-workspace.test.mjs` untuk memvalidasi preseden level server dan pemotongan sesi New York 17:00 Close (18/18 tests pass).

## 2026-10-06 — Obsidian Vault Clean Parity & Sync with Amy FX Pro Academy

1. **Vault Sanitization & Legacy Archiving:**
   - Full byte-exact legacy backup created at `/root/backup_obsidian_vault_legacy.tar.gz` (111MB) and personal notes redundancy at `/root/preserved_user_notes/`.
   - Purged obsolete build scripts (`*.py`), stale drafts, and outdated `.smart-env` vector cache (59MB) from `/sdcard/Download/obsidian/Amy_Trading_Academy_Vault/`.
   - 100% preservation of user assets: `.obsidian/` configuration & themes, `Jurnal Harian/` (including `Catatan Pribadi/2026-09-25 - Refleksi Jujur dan Pelajaran Toxic Win.md`), `Daily-Brief/`, `Jurnal_Lama/`, and `images/`.
2. **Complete 3-Semester 36-Pertemuan Parity:**
   - Transformed entire Amy FX Pro Academy content from `app/src/main/assets/apps/academy/` into clean, native Obsidian Markdown notes.
   - 492 unique, formatted chapter notes with YAML frontmatter, aliases, Obsidian callouts (`> [!note]`, `> [!tip]`, `> [!warning]`), and bidirectional navigation (`← Sebelumnya | Daftar Bab | Selanjutnya →`).
   - 36 Pertemuan overview index notes with SKS, duration, and chapter checklists.
   - Master roadmaps regenerated: `00-KURIKULUM-MULAI-DARI-SINI.md` (full checklist) and `🗺️ Dashboard Utama.md` (MOC hub pinned on mobile).
   - 5 Glosarium notes updated and linked.
   - Verified 6,576 wikilinks with 100% chapter link integrity and zero broken internal references.

## 2026-10-04 — Cold-Start Weekend Gap Tolerance & Market Context Weekend Stitching

1. **Weekend Gap Tolerant Bridging (`isWeekendGap`, `pair`, & `contiguous`):**
   - Di `lib/scalper-engine/amy-ict.mjs`, `lib/scalper-engine/market-context.mjs`, `supabase/functions/scalper-engine/`, dan Android assets `amy-ict.js`, diimplementasikan fungsi `isWeekendGap(t1, t2)` untuk mendeteksi penutupan akhir pekan pasar Gold (Jumat 17:00 NY s.d. Minggu 17:00 NY / selisih ~48 jam / 172800 detik).
   - `pair(a, b)` dan `contiguous(rows)` kini mentolerir weekend gap sehingga lilin Jumat sore dan lilin awal Minggu tersambung secara sah (weekend-bridged).
   - Riwayat bar M15 ($\ge 40$) dan H1 ($\ge 30$) terpenuhi sejak menit-menit pertama pembukaan hari Minggu tanpa terputus.
2. **Fair Market Elapsed Time (`marketElapsedSeconds`):**
   - Freshness check untuk candle H1, M15, dan M5/M1 menggunakan `marketElapsedSeconds(from, to)` yang mengurangi durasi libur akhir pekan pasar tutup.
   - Menghilangkan anomali status `DATA TERLAMBAT` palsu saat market baru buka hari Minggu atau saat libur akhir pekan.
3. **Paritas & Sinkronisasi:**
   - Byte-for-byte paritas diverifikasi antara `lib/scalper-engine/amy-ict.mjs`, `supabase/functions/scalper-engine/amy-ict.mjs`, dan `app/src/main/assets/apps/mapping/js/ict-workspace/amy-ict.js`.
   - Validasi sintaks `node --check` dan 15 targeted tests di `tests/market-context-rebuild.test.mjs` lulus 100%.

## 2026-10-04 — Cockpit Mapping UI & Presentation Upgrade: Bias Dashboard V2 & Entry Assistant V3 Plan

1. **Paritas 100% Chart Gold Dijamin:**
   - Kontainer glassmorphism `.gold-price-panel`, heading, kontrol `[M15 | M5]`, tombol Perbarui, ⛶ Fullscreen, dan canvas 340px dengan vertical drag/pinch zoom harga kanan dipertahankan 100% tanpa perubahan struktur.
   - `chart-view.js` diperbarui untuk menggambar level rencana Entry Assistant V3: Entry (`#38bdf8`), SL merah (`#ef4444`), TP1 kuning (`#eab308`), TP2 hijau (`#22c55e`).
2. **Kartu 1: Amy Live Assistant:**
   - Diperbarui di `ict-presentation.js` untuk merefleksikan sinyal Entry Assistant V3: `BUY ENTRY`, `SELL ENTRY`, `PULLBACK SELL`, `PULLBACK BUY`, atau `STANDBY`.
   - Menampilkan status Anti-Chase (`READY DI ZONA` vs `MISSED - JANGAN KEJAR`) dan nama Math Zone yang aktif.
3. **Kartu 3: AMY BIAS DASHBOARD V2:**
   - Menggantikan kartu Context Hero & Execution lama dengan **Tabel Matriks 16 Baris** seperti tabel Pine Script (1 header row + 15 baris data): BIAS, STRUKTUR, PROTECTED, LIQUIDITY, SWEEP, SWEEP PRICE, DOL, DOL DETAIL, POI, POI PRICE, POI DETAIL, POSISI, RANGE, INVALID, ALASAN INTI.
4. **Kartu 4: AMY ENTRY ASSISTANT V3 PLAN:**
   - Menggantikan Setup Driver & Trading Plan lama dengan kartu aksi trading bersih:
     - Header nama sinyal dengan badge warna.
     - Status bar Anti-Chase (`READY DI ZONA` vs `MISSED`) & Math Zone.
     - Banner catatan khusus pullback jika sinyal merupakan pullback korektif.
     - Grid 4 Kolom: ENTRY, STOP LOSS, TP 1, TP 2 beserta metrik risiko & RR.
     - Alasan inti eksekusi multi-baris.
     - Tombol "Tampilkan Level di Chart" yang langsung menggambar garis acuan di canvas dan scroll ke chart.
5. **Tab Analyze & Driver Tournament:**
   - 6 Driver dipindahkan secara rapi ke accordion paling bawah di Tab Analyze sebagai arsip/riset.
   - Murni berjalan offline / lokal tanpa menggunakan library client Supabase.

## 2026-10-04 — Lab Backtest August 2026 Dukascopy Replacement & Full 2026 Parity

1. **Penggantian Data Agustus 2026 ke Standar Sah Dukascopy Bank BID UTC:**
   - Menghapus/mengkarantina dataset lama HistData Agustus 2026 (`DAT_MT_XAUUSD_M1_202608.zip`, `XAUUSD_2026_08_M15_HISTDATA.csv`, `XAUUSD_2026_08_M5_HISTDATA.csv`) ke `/sdcard/Download/arsip_lama_usang/`.
   - Mengunduh data resmi dari feed publik Dukascopy Bank BID UTC tanpa manipulasi / tanpa candle sintetis via `dukascopy-node` untuk seluruh timeframe: M1, M5, M15, H1, H4, D1.
   - Mengemas arsip `XAUUSD_2026_08_DUKASCOPY_BID_UTC_REPAIRED_AUDITED.zip` dengan file verifikasi `XAUUSD_2026_08_AUDIT.json` dan laporan audit `XAUUSD_2026_08_REPAIR_REPORT.txt`.
   - Meletakkan direct CSV M5 & M15 di `/sdcard/Download/lab backtest/candles/` persis identik dengan bulan September 2026.
2. **Paritas Arsitektur Dataset 2026 (Januari s.d. September 2026):**
   - Seluruh bulan di tahun 2026 (Januari – September) kini 100% homogen bersumber dari Dukascopy Bank BID UTC terverifikasi.
   - `engine.py` diperbarui untuk membaca bulan 8 dan 9 secara seragam melalui handler Dukascopy resmi.
   - Database fraktal M15 (`fractal_db_m15.npz`) dan laporan bulanan 8-tahun multi-driver (`calculate_monthly_report.py`) disinkronkan.

## 2026-10-04 — Pro404 Chart Gold Price Zoom, Weekend Filter & Fast Dev Mode

1. **Price Scale Vertical Zoom & Touch Drag Fix:**
   - In `apps/mapping/js/ict-workspace/app.js`, chart is initialized with `createPriceChart($('chart'), {touchAxes: true})` to enable `handleScroll.vertTouchDrag: true`.
   - In `chart-view.js`, `setFullscreen(enabled)` explicitly sets `handleScroll: { vertTouchDrag: true }` and `axisPressedMouseMove: { price: true }`, giving 100% full vertical price scale zoom capability on both mobile touch and desktop drag.
   - `.ict-overlay` explicitly retains `pointer-events: none` so price scale interaction is completely unblocked.
2. **Weekend Market Closed Anti-Spam Filter:**
   - Implemented `isWeekendClosure(timeSec)` to filter out synthetic flat 15m candles from Friday 17:00 NY to Sunday 17:00 NY.
   - Status text displays: `Pasar Tutup (Akhir Pekan) · Candle Terakhir [Jumat] WITA`. Polling is slowed during closure to save requests.
3. **Fast Dev Mode (Zero npm test Overhead):**
   - Banned automatic sequential execution of full 148 test suites for routine code edits. Replaced with `node --check` (0.05s) and 1-file targeted tests (0.2s) to save tokens and time. Full test suite reserved for explicit user command or final release.
4. **Cross-Account Shared Permanent Memory (Akun 1 & Akun 2):**
   - Created `/root/.gemini/antigravity-cli/rules/00-shared-cross-account-memory.md` symlinked to `/root/GEMINI.md` and `/root/Amy-fx-pro/GEMINI.md`.
   - Automatically loaded into context across both Antigravity accounts on every session start.

## 2026-10-04 — Pro403 Chart Gold Parity with Peta Harga & AMY ICT NextGen Engine

1. **100% Card Parity with Peta Harga:**
   - Replaced old outer toolbar with in-card glassmorphism container (`.gold-price-panel`) 100% matching Home Peta Harga (`.home-price-panel`).
2. **NextGen Indicators Engine (`nextgen-indicators.js`):**
   - Transpiled `AMY_ICT_NextGen.pine` to clean deterministic JavaScript: PDH/PDL, PWH/PWL, Asia Session (06:00-14:00 WITA), 4-bar swing BSL/SSL, BOS/MSS breaks, Trend Invalidation line, FVG + OB with 50% CE, and 80-bar PD EQ line.
3. **Golden Invariant:**
   - If Chart Gold experiences visual glitches, AI must wait for explicit user command before reverting to match Peta Harga.


- **Architecture & Hub Priority**:
  1. Kompas Fundamental (`panel-sentiment`) established as the central hub, primary priority, and default tab of Market Intel. Berita serves as supporting evidence and Kalender provides upcoming catalysts. All 3 tabs remain available and operational.
  2. Kompas explicitly answers: (1) Gold bias (`bullish`, `bearish`, `mixed`, or `insufficient`), (2) Analysis horizon (`Menjelang Rilis Katalis Sesi Ini`, `Sesi Berjalan (Pasca Rilis Data)`, etc.), (3) Top 3 dominant factors ranked with clear reasons, (4) Supporting vs opposing evidence columns (`col-support`, `col-oppose`) with clickable links to evidence (`openEvidenceNews(id)` and `openEvidenceCalendar()`), (5) Structured scenarios (main scenario, reinforcing conditions, invalidation criteria), (6) Next upcoming catalyst and countdown, and (7) Conditional trader focus bridging directly to technical PD Array / MSS confirmation in Mapping.
  3. Strict separation of fact, consensus, and post-release surprise in `analyzeMacroEvent` (evaluating Actual vs Forecast).
  4. Active Android source of truth strictly in `app/src/main/assets/apps/market-intel/`.
  5. 11 baseline bugs comprehensively resolved and verified with 143 passing regression test files.

## 2026-09-30 — Pro374 Mapping audit fixes

Pro374 keeps the six driver cards as reference models: only exact-ID TP/SL archive rows produce response-window statistics; general market context never claims individual strategy triggers. A+ requires explicit server eligibility, directional active liquidity, verified current-week calendar and favorable dealing-range location. No fallback TP is fabricated. Existing engine contract v1 remains compatible and exposes policyVersion mapping-audit-pro374.

## 2026-09-27 — Pro369 Top 1-5 Parallel Activation & Multi-Pair Research Roadmap (On-Hold)

- **Context & Bug Fix**:
  1. Ditemukan bug pengunci di `context-panel.js` (baris 47 & 50) di mana driver turnamen #2 sampai #5 dipaksa loop ke status `STANDBY`.
  2. Logika diperbaiki agar kelima driver mengevaluasi kondisi pasar secara independen & paralel (High-WR Sniper, Adaptive Smart Runner, Swing CHoCH OTE, Multi-Driver Ensemble, dan Conservative Shield).
  3. Versi resmi di-bump ke `2.0.0-pro.369` (code `950369`), 138 unit tes lulus 100%, dan rilis dipush ke repository.
- **Riset Backtrader & Target 3+ Setup/Hari**:
  1. Validasi 8 tahun (2019-2026) basket Top 1-5 di Backtrader mencatatkan $100 -> $26,179,699 (261,797x) dengan Pure WR 63.6% di timeframe M15 (~3.5 trade/minggu).
  2. Pengujian M5 single pair untuk mengejar >= 3 trade/hari membuktikan bahwa win rate anjlok ke 37%-43% akibat noise tinggi dan siklus harian Gold yang terbatas (1-2 wave/hari).
  3. Solusi ideal: Diversifikasi Multi-Pair (XAU/USD + EUR/USD + GBP/USD) yang hanya memakai ~192 request/hari dari 800 kuota gratis TwelveData.
  4. **Status Ide:** Atas instruksi user, ide multi-pair ini **DIARSIPKAN (ON HOLD / ZERO RISK)** di `/sdcard/Download/lab backtest/RESEARCH_ROADMAP_MULTIPAIR.md`. Sistem tetap fokus di single-pair XAU/USD tanpa menambah beban risiko.

## 2026-09-24 — Pro361 Economic Calendar Automation & Market Intel Overhaul

- **Context & Problem**:
  1. Status berita di Gold Mapping Cockpit sebelumnya berstatus statis `UNVERIFIED`, memaksa trader memeriksa berita eksternal secara manual untuk menghindari spread blowout/slippage.
  2. Tab Market Intel memiliki 3 tab (`Berita`, `Heatmap`, `Likuiditas`). Panel `Heatmap` & `Likuiditas` menampilkan BSL/SSL lama yang tumpang tindih dengan perhitungan presisi di tab Gold Mapping utama, sementara informasi fundamental penting (kalender rilis ekonomi & hitung mundur) tidak tersedia.
- **Decision & Architecture**:
  1. **Economic Calendar Feed**: Mengintegrasikan JSON feed gratis dari Forex Factory (Fair Economy Media: `https://nfs.faireconomy.media/ff_calendar_thisweek.json`) tanpa API key dan tanpa batasan kuota.
  2. **Automated News Lock Gate**:
     - Fungsi `evaluateEconomicCalendar(calendar, nowSeconds)` di `supabase/functions/scalper-engine/market-context.mjs` mengevaluasi rilis berita USD berdampak tinggi/medium.
     - Jika rilis berita High-Impact USD berada dalam rentang -15 menit hingga +30 menit dari waktu sekarang: status berubah ke `NEWS_LOCK`, dan eksekusi dikunci otomatis ke `NOT READY` dengan alasan proteksi akun.
     - Dalam rentang 30–120 menit: berstatus `UPCOMING` dengan peringatan waktu hitung mundur.
     - Jika tidak ada berita dekat: berstatus `SAFE` (kondisi scalping aman).
  3. **Market Intel Tab Redesign (Option A)**:
     - Mengeliminasi total panel `Heatmap` dan `Likuiditas` dari Market Intel.
     - Memfokuskan Market Intel 100% pada 2 tab inti: `Berita` (News stream) dan `Kalender` (Economic Calendar).
     - Menyediakan filter cepat (`Semua`, `High Impact 🔴`, `Medium 🟠`, `USD Only 🇺🇸`), pengelompokan tanggal, jam lokal WITA (`Asia/Makassar`), dan badge hitung mundur real-time.
  4. **Release**: Bump versi ke `2.0.0-pro.361` (code `950361`), deploy fungsi Supabase `scalper-engine` (`--no-verify-jwt`), commit, dan pantau CI build sampai APK terbit dan `update.json` teraktivasi.

## 2026-09-24 — Pro359 Gold Market Context M5 Confirmation Transition

- **Problem**: Konfirmasi M1 memiliki batas kesegaran 180 detik, sedangkan feed provider TwelveData/Supabase memperbarui candle secara batch setiap 3–5 menit. Hal ini menyebabkan `fresh: false` secara persisten dan dashboard menampilkan `WAIT · data belum siap / KONTEKS BELUM TERSEDIA`.
- **Decision**:
  1. Mengalihkan lower timeframe confirmation dari M1 ke M5 dengan batas kesegaran 900 detik (15 menit).
  2. Mempertahankan backward compatibility dengan menyediakan properti `context.m5` dan `context.m1` secara bersamaan di payload Supabase Edge Functions (`scalper-engine`, `scalper-setups`, `scalper-system-push`).
  3. Memperbarui UI Mapping Gold (`context-model.js`, `context-panel.js`, `index.html`) untuk menampilkan konfirmasi M5 dan alur bukti struktur H1 → M15 → M5.
  4. Bump versi ke `2.0.0-pro.359` (build `950359`), deploy fungsi Supabase dengan `--no-verify-jwt`, dan aktifkan rilis via CI workflow ke `update.json`.

## 2026-09-24 — Pro357 signer continuity

The installed Amy FX Pro lineage is the Pro signer used by the verified Pro350 release: alias `amyfxpro`, SHA-256 `97:E0:B1:B6:F6:A1:B3:98:59:00:69:7F:97:63:51:B6:09:BD:BC:ED:19:07:FE:EC:90:49:EC:8F:D7:B5:02:32`. The active Pro workflow must never prefer the retired Preview debug signer `47:C2:…:AD:C7` or accept an unpinned cache certificate. It reads `AMYFX_PRO_KEYSTORE_BASE64` when provisioned, otherwise uses the existing Pro cache as a temporary fallback, and fails closed on absence or mismatch. Legacy Learning Preview and 1.5.8 validation jobs are scoped away from unrelated Pro pull requests.

## 2026-09-20 — Pro351 Replay evidence repair and focused mobile UI

Pro351 reconstructs missing SL/TP candle evidence only for locked Replay terminal records when the matching historical pack is replayed, without regressing a terminal result during rewind. Replay deletion removes both IndexedDB and fallback copies. Academy reading-resume cards render only on the Academy/Belajar Trading home. Mapping Analyze keeps primary evidence visible while liquidity and model rules are collapsed and limited to the nearest useful levels. Source advances to 2.0.0-pro.351 / 950351; update.json remains on signed Pro350 until CI publishes and activates Pro351.

## 2026-09-20 — Pro350 Replay history

Pro350 keeps Replay history inside candle-replay.html and reads existing locked decision records without migration. Outcome writes are serialized and positions retain their original timeframe when the cursor advances in another timeframe. Save captures the clicked cursor and pauses playback. Newest updatedAt wins across IndexedDB/localStorage. Source 2.0.0-pro.350 / 950350; existing signed CI activates update.json only after publication.

## 2026-09-20 — Pro349 replay outcome evidence

Candle Replay keeps its existing deterministic decision identity and conservative same-candle rule. Trade fallback records are reconciled with IndexedDB reads, and terminal outcomes carry immutable candle evidence (SL/TP level, candle time, low/high, ambiguity) for display in local history. Source advances to 2.0.0-pro.349 / 950349; update.json remains on signed Pro348 until CI publishes and activates Pro349.

## 2026-09-19 — Pro348 UI-only consistency pass

Pro348 is limited to presentation: shared typography, spacing, surfaces, responsive layout, and light-theme contrast across Home, Mapping, Market Intel, Journal, and Academy. Mapping now carries the shared `amyfx-module--mapping` hook while retaining `amyfx-module--ict`; no engine, mapping, market-source, notification, or persistence logic is changed. Source advances to 2.0.0-pro.348 / 950348 while the manifest remains on signed Pro347 until CI activation.

## 2026-09-19 — Pro347 news privacy and theme customization

Market Intel retains its existing server-side news feed, but app-facing items are sanitized before rendering, caching, assistant sharing, and notification use. Telegram URLs, SM News 24 Jam branding, source fields, and outbound source links are not exposed in the app. The shared theme controller owns persisted custom background, surface, text, and accent colors while System/Light/Dark remain available. Source advances to 2.0.0-pro.347 / 950347; update.json remains on signed Pro346 until CI activation.

## 2026-09-17 — Pro345 preparation
Pro345 source 2.0.0-pro.345 /950345 includes bc96d0e8 position/menu fixes and 7fc4d1d7 direct-delete fix plus home light CSS. Amy authorized bump then push. Push fix/replay-gesture-menu only; no main merge or APK activation. Keep update.json at published344. No strategy/backend changes.

## 2026-09-17 — Pro344 replay fix
Pro344 local only: user authorized fixes/tests/version bump, no push/deploy. Shared drawing pointer-end cleanup releases queued candles while retaining multi-tap anchors; invalid endpoints use cancellation. Drawing menu close is shared with Chart Analysis. No replay aggregation/strategy changes.


## 2026-09-17 — Pro343 home chart

Pro343 adds a direct home candlestick chart using the same Mapping provider/model and extracted presentation helper. It is closed-candle data, not a live tick. Home M5/M15 refresh pauses off-page/hidden; late requests cannot repaint disposed charts. Local Discipline 2R work is excluded. Existing CI activates update.json only after signed publication.


## 2026-09-13 — Pro339 Client-side News Auto-Translation Architecture

- Client-side translation is authoritative in Market Intel when feeds return untranslated or placeholder English text.
- Translated news items are persisted in `localStorage` under `amy_news_tr_cache_v1` (bounded to 300 entries) so each news item is translated exactly once without consuming recurring bandwidth.
- Primary translation calls Google Translate web endpoint from user's residential/mobile IP; secondary falls back to MyMemory API.
- Source advances to `2.0.0-pro.339` / `950339`.

## 2026-09-09 — Pro333 Replay fullscreen layout contract

- The body-level workspace portal remains the Android WebView fullscreen fallback.
- In fullscreen, the replay layout must stretch its chart column; mobile drawing actions may wrap rather than widen the viewport.
- The object popover is constrained to the replay workspace edges so all labels and controls remain visible on narrow screens.
- Source advances to `2.0.0-pro.333` / `950333`; the published manifest stays on the verified prior release until CI publishes and activates Pro333.

## 2026-08-17

### Trading Practice TradingView-style Scale Synchronization Contract
- Lightweight Charts owns blank chart gestures even while Select/Edit is active; only painted drawing geometry and visible/invisible edit handles own drawing pointer input.
- Horizontal candle-width scaling explicitly enables pinch and pressed time-axis gestures. Drawings remain immutable in TIME + PRICE and are reprojected after visible logical/time range, pane size, wheel, pointer/touch, and price-scale transformations.
- Source and active update manifest are `2.0.0-pro.326` / `950326`; signed Android CI, identity, signer, release-asset, checksum, and published endpoint gates all pass.

### Trading Practice Mobile Drawing Interaction Contract
- A completed drawing is one-shot-created and then immediately selected in Select/Edit mode; blank chart space still pans/zooms, while the explicit Gesture Chart control exits drawing selection entirely.
- Painted SVG ownership is the primary selection source. Geometry remains a fallback, while transparent 28px strokes and 36px point targets provide reliable mobile touch without changing the visible drawing.
- Text, Note, and Price Note entry is a fixed body-level dialog so chart overflow and low anchor positions cannot hide the field or actions.
- The interaction repair first shipped in `.325`; current source and active manifest are `.326`, which preserves it and adds verified scale synchronization.

### Trading Practice Chart Continuity and Drawing Contract
- Chart Analysis Live uses the selected historical pack as its immutable base, then merges native closed context and WebSocket candles by timeframe timestamp without interpolation or duplicates.
- Replay decisions have a deterministic symbol/timeframe/cursor/source identity and are evaluated only from later candles. Drawings persist in TIME + PRICE coordinates.
- The chart-continuity baseline was signed and activated in `.324` after all release gates passed. Current source and active manifest are `.326`, which preserves that baseline and both verified drawing repairs.

## 2026-08-11

### Amy-SMC-D Canonical Mapping Contract
- This contract applies only to `personal/amyfx-private` and supersedes Mapping Accuracy V3, balanced-context, regime-router, cross-timeframe vote, and Scalper direction logic as directional Mapping authorities. Existing execution/lifecycle modules remain read-only consumers.
- The semantic source of truth is `Amy-SMC-D.pine` from `suhaimitoamy/Indikator-trading-view` main at Git blob `d6e6d7c979dd5a852bddd9661bef0480caa2eb35`, interpreted with `reports/AMY-SMC-D-CHEATSHEET.md`. C/C-LAB/B/B-LAB/A/A-LAB are not Mapping sources.
- Replay is sequential, deterministic, and closed-candle-only. Invalid, explicitly open, or explicitly synthetic candles are rejected; input is ordered/deduplicated without interpolation or gap filling. Live WebSocket price cannot enter or trigger replay.
- D owns HTF Swing, Swing/Internal Structure, Liquidity, Dealing Range, Pattern, Final Bias, Event History, Next Move, Sweep Continuation, Raw/Qualified Valid Break, Qualified CHoCH/BOS, and Raw/Qualified Pattern.
- M5 and M15 retain the D structural dealing range with pure-location 70/30 and 60/40 boundaries. H1 alone uses the previous 240 closed H1 highs/lows with pure-location 55/45 boundaries. Dealing Range is descriptive-only and excluded from Final Bias and every predictor.
- Qualified BOS stays empty on M5/M15/H1 per the baseline research `N=0`; no synthetic event is created to fill UI. Continuous context, fresh structural evidence, and predictive events are separate presentation classes, and historical confidence is never shown as a live probability.
- Original Z Target V1 is not directional scoring. M5 TGT2 segmented target/expiry from B and M15/H1 ATR trailing from B-LAB are excluded. Entry, SL, TP, RR, expectancy, and trade management are unchanged.

### Preview `.316` Update Activation Sequence
- Source identity advances from `2.0.0-preview.315` / `940315` to `2.0.0-preview.316` / `940316` while the active private manifest remains `.315` until the private release workflow verifies the signed APK.
- The workflow runs the full JavaScript suite, Android release unit tests, lint, signed build, package/version/label/signer checks, immutable release publication, and only then activates `preview-update.json` on `personal/amyfx-private`.
- Application ID `com.amyelitesuite.learningpreview`, label `Amy FX Preview`, URI `amyfxpreview`, permanent Preview signer, private update channel, and user data remain unchanged. No production identity or `main` workflow is changed.

## 2026-08-02

### Professional Glassmorphism Presentation Contract
- The app-facing product name is `Amy FX`. The permanent Android package label, application ID, URI scheme, release tag, and native update notification retain the private Preview identity for upgrade safety.
- Beranda contains exactly five existing modules: Mapping, Berita, Jurnal Trading, Tutorial Trading, and Indikator TradingView. No duplicate access block, fabricated membership, sample profile, or hardcoded collection item is allowed.
- Koleksi displays only data actually stored on the device; an empty device receives an explicit empty state. Profil reports actual local counts, connectivity, scanner state, data source, notification test, version/update state, and System/Light/Dark theme preference.
- Shared presentation primitives are owned by `amyfx-ui-tokens.css`, `amyfx-theme.css`, `amyfx-components.css`, `amyfx-theme-controller.js`, and `amyfx-loading.js`. Legacy Blueprint assets remain loaded for runtime contracts, with the new presentation layer applied last.
- Dark navy/graphite and light ice-blue themes use semantic BUY/SELL/WAIT colors and vector icons. Android status/navigation bars follow the resolved app theme.
- Loading is delayed 350 ms, uses an Amy monogram and indeterminate ring, and exposes timeout/retry without fabricated percentage progress.
- This redesign is presentation-only. Mapping authority, formulas, market data, scanner, lifecycle, notification ownership, and user data remain unchanged. No backtest is run for UI work.

### Preview `.299` Update Activation Sequence
- Source identity advances to `2.0.0-preview.299` / `940299` while the published manifest remains `.298` until the signed release workflow succeeds.
- The workflow builds, tests, signs, verifies, and publishes the APK before updating `preview-update.json` to `.299`.
- A device on `.298` receives the exact native notification title `Update Amy FX Preview Tersedia` before the in-app Amy FX update dialog.

## 2026-08-01

### Private Preview Scalper Pattern v3 Contract
- This contract applies only to `personal/amyfx-private` and supersedes the 2026-07-30 Scalper Shadow buffer/target/BE contract for new schema-v3 setups. Legacy schema-v2 lifecycle remains readable and unchanged.
- The user-approved source of truth is `Blueprint Update Scalper Engine BT6 + AMD`; `Amy FX Master Backtest` was inspected read-only for baseline context. No backtest, replay, threshold search, or historical rerun is part of this upgrade.
- Nine existing drivers pass their raw closed-candle candidates through BT6 gates. The four named repair drivers additionally pass BT6.1 overlays. AMD is the tenth independent M30/H1 driver; there is no cross-driver veto or minimum-driver requirement.
- Pattern features are calculated only at the selected closed signal candle. Configuration IDs are immutable: `BT6-2025-V1`, `BT6.1-2026-H1-V1`, and `AMD-2025-V1`; global, repair, and per-driver kill switches remain available.
- New schema-v3 lifecycle uses a 0.18 ATR structural buffer, or 0.20 when ATR14/current is at least 1.20 of the previous-50 median with at least 20 samples. TP1 is fixed at +10 points, TP2 at +20 points, Stop Loss never moves to breakeven, max hold is 24 hours, and an ambiguous M1 candle resolves SL first.
- AMD waits for a midpoint FVG limit fill and cancels if the manipulation extreme breaks before the fill; the shortest qualifying accumulation window owns the candidate.

### Preview Notification Ownership
- Preview news devices are excluded at the upstream legacy data-push owner and from local WorkManager fallback. The unchanged downstream public system route therefore receives no new Preview delivery pairs. One Preview-only FCM system-notification route owns delivery using canonical event keys, an atomic per-device ledger, retries, and a scheduler lease.
- A newer enabled `preview-update.json` version must invoke the native `Update Amy FX Preview Tersedia` notification before showing the in-app update dialog. The signed release must exist and pass identity/signer verification before the manifest is activated.

## 2026-07-31

### Private Preview Live-Price Ownership
- These rules apply only to `personal/amyfx-private`; the public `main` release identity and pipeline remain unchanged.
- XAU/USD display price is owned by one native Android Twelve Data WebSocket subscription. The WebView receives validated price/status events and never receives the API key.
- The WebSocket key comes from encrypted native preferences, with an optional private CI build value for first connection. It is never stored in repository source or WebView `localStorage`.
- Mapping candle history and analysis continue using the existing Vercel Twelve Data REST proxy. Live ticks may update price-facing UI/snapshots but do not replace closed-candle facts.
- Provider timestamps determine live-tick freshness. Network return, foreground resume, socket closure, and a stalled tick stream trigger bounded reconnects without REST live-price fallback.

## 2026-07-30

### Preview Mapping Stable-DOM Contract
- `#app` renders are state-signature gated. Equal Mapping state must not rebuild or republish the root view.
- Dashboard and Analyze use stable keys and canonical source order. Disclosure nodes retain their identity/open state, and presentation observers may not invent a different order.
- Background analysis and Scalper requests are single-flight/cancellable. A superseded result cannot write state, and background refresh cannot show a full-page loading placeholder or force scroll.
- Scalper Shadow owns exactly one permanent shell in each current Mapping view. No setup, stale data, or a transient backend error changes the shell’s existence or clears the last valid content.
- The Mapping header has one textual value only: `●`. Fresh/loading/stale/offline state is color/attribute metadata; obsolete header clocks remain hidden while the in-card WITA session clock remains available.

### Scalper Shadow Causal Stop and Lifecycle Contract
- These rules apply only to Scalper Shadow and do not alter Mapping Accuracy V3, Rencana Eksekusi, Causal Entry Watch, or legacy Mapping SL/TP.
- Signal structure and ATR are taken from fully closed setup-timeframe candles. The stop reference must already be below BUY entry or above SELL entry before an ATR buffer is applied.
- FVG/IFVG stops use their recorded structural invalidation wick/zone with a 0.20 closed-M15 ATR buffer and preserve a 2R target. A wrong-side reference is `INVALIDATED`; the buffer must not manufacture valid risk.
- “Next open” means the first live M1 open after database detection (with causal M15 fallback), never a historical open after the signal close.
- Activation is saved with `entry_locked`, entry timestamp, source timestamp, and lifecycle sequence. SL/BE/TP evaluation begins in a later engine run and only considers closed candles at or after entry.
- Setup ID is the identity boundary. Optimistic writes require the expected `updated_at` and status, and terminal states cannot regress because of a late API response.
- Validation for this change is syntax, deterministic fixtures, regression, Android gates, and manual device review. Backtesting remains explicitly out of scope.

## 2026-07-29

### Causal Entry Watch 2021–2022 Correctness Contract
- An eligible opposing sweep must be confirmed on a closed candle at or after Direction Forecast start; an MSS must be a later displaced closed-candle break.
- Dealing Location uses a confirmed paired structural leg built from consecutive opposite slow pivots. Consecutive same-kind pivots compress to the more structural extreme.
- Dealing Location's hard-gate reference is the sweep level. POI location, MSS-entry location, and MSS close strength remain separate diagnostics.
- BUY remains valid only at sweep position `<= 0.60`; SELL remains valid only at `>= 0.40`. These thresholds may not be tuned to create setups.
- Live analysis time defaults to the current clock. Replay time must be explicit or derive from the last closed candle; an open future candle cannot provide replay time.
- `entryMap.setup` is authoritative for terminal lifecycle state even when `activeSetup` is null. Terminal states must remain `SL HIT`, `TP1 HIT / BE`, `TP2 HIT`, `TP1 / BE`, or `EXPIRED`.
- Structural target diagnosis distinguishes no target, below 2R, above 8R, risk above 6 ATR, and valid 2R–8R without changing entry geometry or target thresholds.
- The 2021–2022 final validation remains at zero M5/M15 setups because `SESSION` is the next cumulative blocker. Session rules must not be loosened from this result.

### Rencana Eksekusi Read-Only Contract
- Rencana Eksekusi is a presentation consumer, not a strategy or analysis engine. Its setup priority is `setupExecution` → `entryMap.setup` → another authoritative runtime output only when the higher-priority source lacks that field.
- BUY/SELL is fail-closed and requires fresh Mapping data, an active aligned official direction, `entryWatch.entryAllowed === true`, a locked execution plan, the official closed-candle entry lifecycle (`ENTRY_ACTIVE` / `ENTRY CONFIRMED`, or the equivalent internal `ENTRY_TRIGGERED`), valid geometry, and official entry/SL/target levels.
- WAIT is mandatory for incomplete gates, official context conflict, stale/expired data, post-TP1 management, or terminal lifecycle. Non-executable and old levels remain hidden.
- Internal lifecycle names are never renamed or duplicated. UI labels only translate the existing Causal Entry Watch status.
- The feature does not read forming candles, call a market API, create polling, calculate indicators, recalculate RR, or mutate Mapping/Entry Watch objects. It refreshes from existing Mapping, Entry Watch, candle, and market-state events with a content fingerprint.
- Amy Bot receives the same structured `execution_plan` Context Envelope as the card and uses a deterministic read-only answer path before other market-answer paths. It may explain but cannot reverse the decision or create levels.
- In Analyze, Rencana Eksekusi is immediately followed by Penjelasan Mapping; dynamic Asia Liquidity is anchored after Penjelasan Mapping. This is presentation-only and does not change Asia session calculation or WITA timing.

## 2026-07-28

### Mapping Accuracy V3
- This section supersedes the 2026-07-11 decision that restricted actionable entries to M15.
- Causal Entry Map is supported on M1, M5, M15, M30, H1, H4, D1, and W1. Source and trigger are the selected timeframe; each profile has an explicit context, session, sweep-memory, and bar-expiry contract.
- The required causal order is active Direction Forecast → point-in-time context alignment → local EMA21/34/90 stack → opposing confirmed liquidity sweep → later displaced MSS → location/session filters → first still-available structural target at 2R–8R.
- M5 entry context follows the trusted indicator's default H4 bias. Every context gate uses only the latest context candle closed by the trigger close; later HTF candles cannot validate an earlier trigger.
- H1 entry close must remain within 2.00 ATR of EMA21.
- Entry is the closed MSS candle close, SL is beyond the protected swing plus 0.50 ATR, TP1 is 1R, and the runner moves to break-even toward the first structural target.
- H1 bearish forecast remains suppressed and must return `NO CLEAR DIRECTION`, matching the trusted reference.
- M1, M30, H4, D1, and W1 profiles are rule-based/manual-validation profiles and may not display a win-probability claim.
- `AMY_MAPPING_SINGLE_AUTHORITY_V3` is the read-only UI contract. Live price is provisional and cannot rewrite closed-candle facts or lifecycle.
- Weak structure close-crosses are candidates only. Confirmed breaks require ATR penetration, minimum body, and body/range quality.
- Liquidity first interaction is irreversible and distinguishes closed-through, unconfirmed sweep, and confirmed reaction.
- FVG/OB inversion requires accepted break (three closes plus continuation), retest, and inverse rejection.
- Previous-period liquidity is unavailable until its source period closes. W1 candle closure is anchored to Monday UTC.
- Validation for this change is regression/syntax/build plus user-performed manual chart validation; no backtest is run.

## 2026-07-11

### Mapping Production Logic
- Liquidity state is historical and irreversible within the loaded candle set: once a post-origin candle sweeps a level, that level cannot return to ACTIVE.
- Structure displacement uses point-in-time ATR from candles available before the breakout.
- Valid liquidity sweeps require both wick penetration and a close back inside the swept range.
- Minimum accepted setup RR is 1:2; lower RR is a fatal conflict and INVALID.
- HTF structure owns directional bias; Premium/Discount is an alignment filter, not a standalone direction signal.
- Silver Bullet takes precedence over the broader New York Killzone during 10:00–11:00 New York time.
- Actionable setup generation is restricted to M15 Precision Mode; other timeframes remain analysis context only.
- M15 Precision Mode secures TP1 at 1R, closes 90%, moves the 10% runner stop to break-even, and retains a main target of at least 2R.
- Native Background Scanner receives targets only from an active `M15_PRECISION` setup.

### Institutional Intelligence UI
- Market Intel and Mapping share a local `AmyFXIntel` snapshot/event layer.
- The shared layer is presentation-only and does not replace or modify the ICT rules engine.
- Market briefing remains deterministic and rule-based; it must not be presented as AI or an execution signal.
- Market Intel requests are cancellable per panel and pause while the WebView is hidden.

### Mapping Render Performance
- Live price ticks update targeted DOM nodes instead of fully rebuilding the Analyze view.
- Connection and scanner synchronization use explicit selectors; full-document scanning is not allowed in the recurring one-second task.

### Market Context Accuracy
- FVG quality must use ATR from the candle history available when the imbalance formed.
- Liquidity clustering and sweep penetration use ATR-scaled tolerance instead of fixed XAU price distances.
- An Order Block is only eligible when it precedes a confirmed displaced structure break; an accompanying imbalance improves quality.
- HTF dealing ranges are anchored to confirmed structural swings and may not be inferred from the nearest level around live price alone.
- Standalone BOS/CHOCH and displacement are context, not executable entry triggers.

### Notification Destinations
- News notifications carry the Telegram post ID in the URL and must open, expand, and focus that exact item.
- Telegram post ID is the authoritative newest-first ordering key; timestamp is secondary display metadata.
- Native notifications without an explicit URL resolve to an explicit local `index.html` destination based on their module.

## 2026-07-10

### Notification Ownership
- Automatic setup notifications from the Mapping WebView are disabled.
- Automatic target alerts are owned by the native `ScannerService` only.
- Mapping keeps the manual test notification action for debugging.

### API Separation
- Mapping candle history uses the existing Vercel `/api/twelvedata` proxy.
- Mapping live price and background scanning continue using TwelveData WebSocket directly because the Vercel functions are request-based, not persistent WebSocket relays.
- Market Intel continues using separate Vercel endpoints for News, Heatmap, and Liquidity.

### Android Asset Synchronization
- `apps/market-intel/` is synchronized into `app/src/main/assets/apps/market-intel/` so the APK receives the same three-tab implementation as the repo source.

### Mapping UI Density
- Analyze keeps the Decision card and Valid Break visible as the primary view.
- M1–H4 table, Mapping Notes, and active setup details are collapsible to reduce mobile information overload.

### Mockup UI Direction
- Main navigation follows the provided Amy FX mockup: Beranda, Proyek, Koleksi, and Profil.
- Home prioritizes a compact hero, quick module cards, and recent projects.
- Mapping Dashboard prioritizes price/bias, timeframe, setup focus, and session focus; detailed diagnostics remain in Analyze.

### Academy Access
- Academy access uses a local first-use code rather than a paid backend or hardcoded shared password.

### Admin Academy WebView Fix
- Admin Academy WebView error fixed by changing `admin/` link to `admin/index.html`.
- WebView Android via `file:///android_asset/...` does not auto-resolve folders to `index.html`.
- Fix applied in `app/src/main/assets/apps/academy/index.html` only — `MainActivity.kt` not touched.

### News Translation
- News translation uses Google Translate unofficial free endpoint (`translate.googleapis.com/translate_a/single?client=gtx`) with native `fetch`.
- Fallback: if translation fails, original English text is preserved.
- Original text stored in `textOriginal` field in API response.
- Translation happens server-side in `api/news.js`, not on frontend.

### News Click Behavior
- News item click should expand/collapse text in-app using CSS class toggle, not auto-redirect to Telegram.
- Source shown as label `Sumber: SM_News_24h` instead of Telegram link.

### Liquidity Tracker Architecture
- Liquidity tracker is a **separate endpoint** `api/liquidity.js` — independent from `api/heatmap.js`.
- Swing detection logic is copied (not imported) from heatmap to maintain independence.
- Tracks BSL (buy-side liquidity / swing highs) and SSL (sell-side liquidity / swing lows).
- Only shows levels that have NOT been swept.
- Sorted by distance from current price, limited to 15 nearest levels.

### Heatmap Preservation
- Heatmap logic (`computeHeatmap` in `api/heatmap.js`) must remain untouched.
- Any new liquidity-related features must be built as separate files/endpoints.

### Dependency Policy
- Project should avoid npm dependencies unless necessary.
- All serverless functions use native `fetch` — no axios, node-fetch, etc.

### Hermes Model Switch
- Hermes agent switched from DeepSeek to Gemini to save DeepSeek tokens.
- MOA (Mixture of Agents) disabled to reduce double API calls.
- Config: `/root/.hermes/config.yaml`

## 2026-08-16

### Academy Trading Practice
- Trading Practice is a local-first Academy track. Historical/imported datasets, drawings, manual trades, replay state, and guided results stay on the device through IndexedDB with a localStorage fallback.
- TradingView Lightweight Charts `4.2.3` is vendored under Academy assets with its license; Practice has no runtime CDN dependency.
- Replay owns one real source timestamp cursor across timeframe changes. Source candles are filtered at the cursor before aggregation, and only the resulting visible subset reaches the chart.
- The Practice live adapter consumes the existing `AmyLivePrice` / `amyfx:twelvedata-*` native WebSocket contract only. It does not call REST, poll, modify Mapping, or dispatch Mapping recomputation events.
- Manual trade outcomes are an educational forward-candle journal, not a strategy validator. A candle touching SL and TP is resolved SL-first and labeled ambiguous.
- The packaged UI sample is 4,320 repaired-audited XAUUSD M1 candles from the March 2009 monthly archive; it is explicitly labeled as sample data, not a backtest result.

### ICT Berbasis Backtest Learning Track
- Documents `00`–`08` from the Google Drive folder `Materi Ajar — ICT Berbasis Backtest` are bundled as a separate source-backed Academy track with their source document IDs and links.
- The track reuses Academy reading-history keys while assigning records to namespace `ict-backtest`; query-specific lesson paths prevent all nine lessons from collapsing into one history entry.
- Practice CTAs are exposed only where the available local data supports the exercise. SMT chart practice is omitted until synchronized DXY candles are available.

## 2026-09-05 — Professional Copy, Pro 327

- Remove the home promotional hero and Academy feature cards requested in the screenshots; keep existing module and lesson navigation.
- Mapping summary displays the existing direction without its Next Move label or internal source code. Final Bias and Dealing Range retain concise labels; calculations and data ownership are unchanged.
- Allow home menu titles to wrap rather than truncate.
- Source advances to `2.0.0-pro.327` / `950327`. Activate `update.json` only after the signed release and published APK verification succeed.


## 2026-09-05 — Pro328

Pro328: Preferences are per device/install, using a random native capability (or browser-local capability) and server-side SHA-256 scope. Defaults ON. Shared scans remain for legacy devices; scoped scans and push recipients cannot affect other devices. Existing active positions finish their lifecycle after toggling OFF. Discipline uses the existing detector/candidate contract with an isolated liquidity-target lifecycle wrapper. Published update.json advances only after signed APK and download checksum verification.


## 2026-09-06 — Pro329

User explicitly requests Pro329 without tests, backtests or additional verification. Scope is Candle Replay drawing interactions/fullscreen plus Indonesian news. Projection coordinates use visible candles only; replay source filtering is unchanged. New drawings store replay creation cursor so projections can extend into blank space while remaining hidden when rewinding before creation. No arbitrary object-count cap. Build329 skips verification/test steps; signing uses the existing cached key. The update manifest advances only after an actual APK publication.


## 2026-09-09 — Pro332

Pro332 uses a body-level replay workspace portal to escape the Academy container animation transform. Native fullscreen is optional outside Android; rejected requests preserve viewport fallback. Existing chart nodes, listeners and storage remain intact. Object controls move into a disclosure; shared component styles simplify all main modules. Source 2.0.0-pro.332 / 950332; update.json remains331 until the signed release workflow verifies and activates332.


Pro332 release completed: GitHub Actions run 34301702033 succeeded, including JavaScript regression, Android unit/lint/build, signing identity and published endpoint verification. Active public update.json is 2.0.0-pro.332 / 950332, enabled=true. Published APK SHA-256 62bd08b231bef85e768af95b50540ecfe3e0d6b3e71a77dbc670da18f4e297f1 matches the release asset digest. Earlier build/activation pending status is resolved. Actual device notification and WebView visual checks remain unobserved.


## 2026-09-09 — Pro334 server-owned live price

Pro334 moves provider WebSocket ownership to api/live-price.js on Vercel (Node22 native WebSocket), relaying validated ticks via SSE to the existing Android AmyLivePrice interface without dependencies or device keys. API key remains TWELVEDATA_API_KEY in Vercel only; APK build value is empty. Stream reconnects before the 60-second function limit. Mapping closed-candle authority is unchanged.



## 2026-09-09 — Pro335 replay navigation

Replay uses incremental series updates for an unchanged prefix; full replacements preserve the immediate logical viewport. Native pan/pinch suspends following; Ke cursor restores following without resetting zoom. Explicit Geser mode makes all drawing SVG pointer-transparent. Rectangle interiors pass through; borders and handles remain editable. Keep the existing signed release pipeline and activate update.json only after artifact verification.


## 2026-09-09 — Pro336 native replay refresh ownership

Disable native SwipeRefreshLayout for the exact Candle Replay route at main-frame navigation/start. The child-scroll callback and refresh listener also guard the active replay URL. Permission/resume updates reuse the route policy instead of unconditionally enabling refresh. Other pages retain normal pull-to-refresh. Source is 2.0.0-pro.336 / 950336; existing signed CI activates update.json only after APK verification.

## 2026-09-12 — Pro337 ICT Mapping replacement

User explicitly requested complete Mapping logic/UI/entry/analysis replacement. Public
Mapping now uses ICT-SWEEP-MSS-FVG-1, superseding Amy-SMC-D and earlier Mapping contracts
for this page. Symmetric H1 context + M5/M15 sweep/MSS/FVG limit model; numeric thresholds
are explicit unvalidated engineering choices. Legacy page archived, no legacy analysis
scripts loaded by new page. Scalper history/push remain separate, clearly labeled.
Source337; existing signed release gates must activate update.json only after publication.
Details and validation limitations: docs/ICT_MAPPING_V1.md.


## 2026-09-13 — Pro338 Academy

Guided Practice now owns 60 explicitly illustrative OHLC scenarios (20 per level); it never binds fixed answers to unrelated historical packs. Per-question candles/markers/levels are one contract. Fisher–Yates shuffles prioritize unseen IDs across sessions. First answers are immutable; mistakes link to existing Jalur 01 lessons. Remove Jalur 02 entry points from Academy cards and injected navigation. Source338 uses the established Amy-fx-pro main Pro release pipeline; old Amy-fx private-branch rules describe the separate original repository.


## 2026-09-13 — Pro340 local application assistant

Pro340 supersedes five-menu and legacy mentor runtime contracts: four main modules, one local assistant UI and public AmyFXOS.ask delegation with no provider fallback. Academy auth loader uses the same assistant. Read-only adapters consume versioned ICT Mapping snapshots, News feed snapshots, journal metadata (IndexedDB with labeled legacy fallback), Academy reading state and guided results. Candle timestamps and stale WAIT are mandatory; never label candle close as live tick. Knowledge index is extracted from 531 packaged lessons with source links. Source 2.0.0-pro.340 / 950340; manifest activation is owned by existing signed CI after release verification.


## 2026-09-13 — Pro341 startup, ICT Intel and bright glass

- Active Berita imports the same ICT engine, provider and snapshot adapter as Mapping; its legacy fetch router and heatmap renderer are no longer loaded. Backend and strategy rules are unchanged.
- Hero price is explicitly the closed-candle reference, not a live tick. Source candle age owns freshness. Heatmap groups exact unswept Mapping levels into bands spanning at most USD1; width means relative pivot count, never order volume.
- Four actual modules own home rendering. Shared frosted surfaces are brighter in both existing themes; Mapping chart follows theme changes.
- Source version is 2.0.0-pro.341 / 950341. Existing update manifest remains untouched until the signed release workflow verifies and activates341.


Pro341 release verified: PR #3 merged as 89f147daa947632da15a21da5bd5b7ee5e8a297f. Signed release workflow34788293012 and main lint34788292968 succeeded. All128 JS files, Android tests/lint/build, existing signer continuity and published endpoint gates passed. Active update.json is enabled at 2.0.0-pro.341 /950341; APK digest matches manifest SHA-256 8f59f72ecb22ed384c5c390ea20e9a1927cd3e17ad9910b9ee6b4fde80d7943c. Earlier Pro341 publication-pending notes are resolved. Browser/device appearance and native notification receipt remain unobserved. Internal validation was aligned from Node20 to the repository-required Node22 after its old runtime failed to import stripTypeScriptTypes. Legacy Learning Preview and1.5.8 PR checks lacked their old signing cache; Pro release used its existing signer and passed verification.


## 2026-09-14 — Pro342 Mapping restoration

Pro342 restores the deployed Supabase Scalper lifecycle as a read-only Mapping panel. Existing ICT chart/model/snapshot remain separate; user-selected server levels overlay the preserved chart. No backend strategies, thresholds or other application modules change. Source342 uses the existing signed release pipeline; update.json activates only after publication.

## 2026-09-24 — Pro357 Gold market context source

Pro357 source replaces new Scalper setup publication with closed-candle XAU/USD context from H1, M15 and M1. H1 is the intraday bias, M15 is the area/control warning, and M1 only confirms a scenario; missing or stale candles force a non-actionable state. Existing setup rows remain readable as historical records. Push uses context events and serves only APKs registered as Pro357 or newer; older APKs would route an unknown FCM data type as news. The published update manifest remains on the last signed APK until the existing build workflow verifies and activates Pro357. Production Edge Function deployment and main-branch release await approval after auto-review rejected live function replacement.


## 2026-09-19 — Pro346 scalper rebuild
User requested rebuilding active drivers with WR below50% and version bump for update notification. Global retained outcomes identify Discipline, AMD, Range Expansion and Retest BOS. Version STRUCTURAL-2026-09-V1 replaces only those detectors and routes new setups to isolated causal/risk-validated lifecycle; old setups and archived models remain unchanged. Source346; signed pipeline owns manifest activation. See docs/SCALPER_PRO346_REBUILD.md.


## 2026-09-30 — Pro375 unified AMY ICT Mapping

User explicitly authorized complete integration and signed release. Dashboard V2 M15 is the decision authority; closed M5 is the trigger, H1 additional context. Portable amy-ict.mjs is byte-synchronized to Android amy-ict.js. Chart, dashboard, scoring, narration and markers consume one server snapshot including its candle inputs. ICT base drawings remain separately labelled because their OB/FVG formulas differ from Dashboard V2. Preserve verified-calendar/news, directional target, geometry and A+ gates. Historical Pro374 tests remain a named archived baseline; dedicated Pro375 tests verify the current path. Scores are points, not probabilities.

Pro376 artifact identity is immutable after release. A backend-only final scenario-target serialization fix is deployed as Edge version24 and source-recorded with [skip ci]; no APK asset changed and all140 regression files were rerun successfully. This avoids republishing a different APK at versionCode950376.


## 2026-09-30 — Pro377 Mapping ringkas

User authorized a presentation-only simplification and version bump. Main Mapping shows market state, manual readiness/news, primary POI/CE/invalidation/target and chart. Full bias, narration, evidence, liquidity, conditions, alternatives and six reference models stay accessible in closed Detail accordions; opened driver/scenario details survive refresh. All46 display controls remain in four groups, stored preferences are preserved. Chart narration prioritizes risk warnings in two lines; repeated structural labels and overlapping text are suppressed without removing drawings or numerical logic. Canonical engine, backend, scoring, risk gates and notification policies are unchanged. Source2.0.0-pro.377/950377; signed CI owns manifest activation after publication. Local141 regression files and Chromium360/390 dark/light/menu/offline smoke passed; release verification pending.


Pro377 release verification completed: source dc1ff82e9f6bd0571bac754484654141212ebafc; signed Actions36701710390 and lint36701710388 succeeded. Public update.json is enabled at2.0.0-pro.377/950377. Downloaded32,667,949-byte APK SHA-2561998d6efe381114b230d393db90f0a675dc2b7b6263f10f12775941796e7ed76 matches manifest/checksum; all changed Mapping assets match APK and shared trading engine remains byte-identical to backend. Final141 regression files and Chromium360/390 dark/light/settings/driver-refresh/news-lock/offline smoke passed. Earlier Pro377 publication-pending note is resolved. Real Android update-notification receipt remains unobserved.


## 2026-09-30 — Pro378 Chart Gold fullscreen

Use the existing chart in a body-level viewport portal with native fullscreen enhancement outside Android; preserve chart instance, server snapshot and gestures. Same-document history handles Back without MainActivity changes. Restore page scroll and chart text sizes on exit; do not reset zoom.


Pro378 release verification completed: source7d9b2d608e4fe6dbb6addb7063dd039401282beb, signed Actions36704449764 and lint36704449726 succeeded. Public update.json enabled at2.0.0-pro.378/950378. Downloaded32,670,025-byte APK SHA-256516d95d6fd9bcfec15985dc6b8cc354e51480265d8ab0689936dce1947ce91bf matches manifest/checksum; all fullscreen assets match source and canonical trading engine remains byte-identical to backend. Final141 regression files and Chromium portrait/landscape360/390/844px, pinch/pan/zoom/scroll/Back/Escape/fallback/theme/refresh/offline checks passed. Earlier Pro378 release-pending note resolved. Actual Android device behavior and update notification receipt remain unobserved.


## 2026-09-30 — Pro379 TradingView axis gestures

Mapping enables vertTouchDrag/horzTouchDrag plus explicit price/time axis drag and double-tap reset. Home retains vertTouchDrag=false for page scrolling. Use the existing TradingView Lightweight Charts4.2.3 handlers rather than a second scaling implementation. Cache the applied rightBars preference so server refresh cannot override user pan; use measured price/time axis sizes for overlay bounds.


Pro379 release verification completed: source6b6d447ead4e60b1f12957e42f0c20f543241af7, signed Actions36707758513 and lint36707758575 succeeded. Public update.json enabled at2.0.0-pro.379/950379. Downloaded32,670,665-byte APK SHA-256ff37cbe0180131239ae56fa46bb9b1b07c28a62f323e79d295922b91d80136ae matches public manifest/checksum; eight affected/fullscreen assets match source and canonical trading engine remains byte-identical to backend. All142 regression files and Chromium touch price/time-axis scaling, double-tap/Auto harga reset, overlay alignment, refresh-preserved viewport and existing fullscreen/pinch/pan/Back/Escape/theme/offline checks passed. Earlier Pro379 release-pending notes resolved. Actual Android device gestures and update notification receipt remain unobserved.
 
 
## 2026-09-30 — Pro380 Academy Curriculum Restructure
 
Restructure Amy FX Academy from 665 fragmented HTML files into 3 Semesters and 36 Pertemuan (~1 Jam / SKS per Pertemuan) without losing any educational material. Consolidate 569 sub-chapters into 36 interactive master modules with desktop sidebar TOC, mobile drawer TOC, and verified navigation. Purge clone directories and stubs. Maintain zero broken links across 1,360 checked internal references. Release Pro380 (950380).


## 2026-09-30 — Six-driver logic audit before gate changes (local)

User prioritizes driver logic before scoring/gate changes. Source does not contain six independent detectors. Correct false Sniper attribution on generic Sweep/MSS/FVG; preserve its numerical plan and canonical engine. Six rule corrections are documented in docs/mapping/SIX_DRIVER_LOGIC_AUDIT.md as proposals, not invented implementations or profitability claims. No deployment or driver activation.


## 2026-09-30 — Pro382 six-driver evaluation

Pro382 mengaktifkan evaluasi enam driver nyata atas instruksi user. Kontrak operasional baru tercatat di docs/mapping/SIX_DRIVERS_PRO382.md; tidak mereplikasi artefak backtest eksternal. Skor bukan gate driver, H1 konteks, safety news/data/target tetap. Fib memakai limit setelah observasi; Rapid next-open. Satu model live/driver, arsip legacy dipertahankan, shared market plans difilter preferensi perangkat.


Pro382 release verification completed: source 11239e1de1b42d6677cbd074619c636507d762ab; signed Actions36792997261 and lint36792997230 succeeded. Public update.json enabled at2.0.0-pro.382/950382. Downloaded31,534,089-byte APK SHA25634f42b0f0e34995e7df9ff0a425e3e68b74ec59acfa531f08f0ea007d4b32b3f matches manifest/checksum; all11 changed assets match source.146 regression files pass. Production engine25/setup-reader11/preferences2 active; five engine files byte-identical to source and successful live run returns all6 driver evaluations. Browser360/390 light/dark, toggles, detail refresh, selected chart, offline and overflow checks pass. Replay240 M5 with synthetic calendar produced one Rapid candidate; not a profitability backtest. Earlier build/deployment-pending notes are resolved. Actual Android update receipt remains unobserved.


## 2026-10-07 — Perbaikan Backup & Pengurutan Kronologis Tab Catatan Pribadi

1. **Audit & Solusi Backup Tab Catatan (Personal Notes):**
   - Sebelumnya, fungsi `exportBackup()` hanya mengemas `items` dan `journals` ke dalam `data.json`, sehingga catatan pribadi (`state.personalNotes`) yang disimpan terpisah di `localStorage` tidak ikut ter-backup ke file ZIP.
   - Perbaikan: `exportBackup()` kini menyertakan `notes: state.personalNotes` ke dalam `data.json`. Pada `importBackup()`, ditambahkan logika pemulihan otomatis (`payload.notes || payload.personalNotes`), merge dengan data lokal, dan auto-render.
2. **Pengurutan Kronologis Berdasarkan Tanggal (Sort by Date):**
   - Sebelumnya, saat membuat catatan baru untuk tanggal masa lalu, kode memakai `unshift()` sehingga catatan lama langsung muncul di posisi teratas.
   - Perbaikan: Ditambahkan fungsi `sortNotes()` yang mengurutkan catatan berdasarkan input tanggal secara descending (`dateB.localeCompare(dateA)`). Catatan terbaru berada di paling atas, sedangkan catatan masa lalu/lama secara otomatis turun ke posisi paling bawah sesuai progres waktu trading pengguna.
3. **Paritas 1:1 Amy FX Pro & Amy FX PWA (iPhone):**
   - Perubahan disinkronkan secara identik ke `/root/Amy-fx-pro/app/src/main/assets/apps/journal/app.js` dan `/root/download/Amy-fX-pwa/assets/apps/journal/app-core.js`.


## 2026-10-07 — Perbaikan Interaksi Catatan (Toggle Expand & Edit Handler)

1. **Tombol "Baca Selengkapnya" (Toggle Collapse):**
   - Masalah: `handleNoteActions` memeriksa `const id = btn.dataset.id; if (!id) return;` sebelum memeriksa class `toggle-collapse-btn`, padahal tombol tersebut tidak memiliki `data-id`, sehingga fungsi keluar dini.
   - Solusi: Pindahkan pengecekan `toggle-collapse-btn` ke baris teratas sebelum validasi id, tambahkan `data-id` pada tombol, dan fallback traversal DOM via `.closest('.note-card')`.
2. **Tombol "Edit" (Edit Handler & Scrolling):**
   - Masalah: ID catatan dicocokkan dengan `===` tanpa konversi tipe string dan form berada di paling atas tanpa auto-scroll, sehingga pengguna di layar ponsel yang sedang scroll ke bawah tidak melihat form yang terbuka.
   - Solusi: Pastikan pencocokan string `String(n.id) === String(id)`, auto-scroll ke form via `scrollIntoView({ behavior: 'smooth', block: 'start' })`, fokus ke input judul, ubah label tombol submit menjadi "Perbarui Catatan", dan pastikan setiap catatan lama yang dimuat dari localStorage otomatis memiliki ID unik persisten.
## 2026-10-08 — M15 Otoritas Penuh & Konfirmasi Eksekusi Mandiri (Pro 408)

1. **M15 Direct Confirmation Authority:**
   - Logika konfirmasi dirombak agar candle M15 yang resmi close menjadi konfirmasi eksekusi sah dan mandiri (`m15Confirmation(d, levels)`), tanpa harus terblokir menunggu M5 break struktur.
   - Tiga kriteria konfirmasi mandiri M15:
     a) **M15 Wick Rejection >= 1.2x body di POI atau likuiditas**: Lower wick (BUY) atau upper wick (SELL) >= 1.2x body pada POI aktif atau level likuiditas utama (SSL, BSL, Asia Low/High, PDL/PDH).
     b) **M15 Displacement Break (BOS / MSS) searah bias**: Break struktur M15 searah bias dengan candle displacement ber-body tebal (`bullDisp` / `bearDisp` > 1.2x rata-rata 20 bar).
     c) **M15 50% CE Bounce di Dealing Range sehat**: Pengujian dan pemantulan dari level 50% CE (Equilibrium Dealing Range atau 50% CE POI) di zona Diskon untuk BUY atau zona Premium untuk SELL.
2. **Sinkronisasi Engine & State Execution:**
   - Di `entryAssistantV3`: Saat M15 close terkonfirmasi, `rawSignalType` langsung aktif (`1` untuk Buy, `-1` untuk Sell), `entryFresh` dijamin aktif, `status: 'READY'`, dan `plan` (Entry, SL, TP1, TP2, RR) langsung diterbitkan.
   - Di `buildMarketContext`:
     - Checklist `ok` konfirmasi eksekusi (`executionConfirmed = m15DirectConfirmed || alignedTrigger`) terpenuhi langsung oleh M15 close.
     - Checklist POI dan Sweep diperluas untuk mengakomodasi wick rejection di likuiditas dan CE bounce M15.
     - `confirmation.status` langsung menjadi `CONFIRMED`.
     - `execution.status` menjadi `READY` atau `READY TO REVIEW` (jika A+ memenuhi syarat skor dan DOL target).
     - Event `ENTRY_SIGNAL` atau `A_PLUS_READY` dipicu tanpa menunggu M5.
3. **Paritas & Verifikasi:**
   - Byte-identical parity terjaga 100% antara `app/src/main/assets/apps/mapping/js/ict-workspace/amy-ict.js`, `supabase/functions/scalper-engine/amy-ict.mjs`, dan `lib/scalper-engine/amy-ict.mjs`.
   - File `market-context.mjs` di `supabase/functions` dan `lib` disinkronkan identik.
   - Seluruh 34 unit test di `tests/mapping-amy-ict-pro375.test.mjs` lulus dengan 100% passing rate.

## 2026-10-09 — Perpustakaan Cloud di Candle Replay & Perbaikan Chart Kosong (Pro 412)

1. **Integrasi Panel Perpustakaan Cloud di Candle Replay (`candle-replay.html`):**
   - Menambahkan section `.cloud-library-panel` (Pilih Tahun 2019–2026, Pilih Bulan, Tombol ⚡ Pasang dari Cloud) langsung ke dalam aside Candle Replay.
   - Fungsi `initCloudLibrary()` mengunduh pack dari Cloud (Vercel proxy/GitHub dataset), menyimpannya ke IndexedDB, me-refresh dropdown pack, dan langsung berpindah ke pack yang baru dipasang via `changeSource(firstId)`.
2. **Akar Masalah Chart Replay Kosong & Solusinya:**
   - **Stale Replay State Gotcha:** Sebelumnya `storage.loadReplayState()` mengutamakan `saved.sourceId` lama (sample Maret 2009) daripada pack aktif yang baru diunduh di `provider.selectedSourceId()`. Kini pack aktif global selalu diprioritaskan.
   - **Out-of-Range Cursor Bounds:** Timestamp cursor lama dari dataset lain (misal 2009 vs 2025) sebelumnya menyebabkan `lowerBound` memilih bar index 0 sehingga chart hanya memuat 1 candle (tampak kosong). Kini `ReplayController.prototype.start` memverifikasi rentang timeline: jika timestamp di luar batas dataset, otomatis me-reset ke `Math.min(80, timeline.length - 1)` sehingga 80 candle awal langsung tampil penuh.
   - **Resilience Sample Loader:** `loadSample()` di `data-provider.js` dibungkus multi-fallback dan `listSources()` dibungkus per-sumber try/catch sehingga kegagalan fetch sample lokal/offline tidak memblokir pembacaan pack IndexedDB.
   - **Responsive Auto-Fit:** `chart.setCandles` memanggil `fitContent()` pada render pertama, serta `chart.resize()` dan listener `window.addEventListener('resize')` dipasang agar kanvas chart selalu fit ke dimensi kontainer.

## 2026-10-10 — Remaster Ebook Masterclass: Amy FX Academy Modul 01 [Fondasi Pasar]

1. **Format Publikasi & Tipografi Nyaman:**
   - Format 8-page slide 810x810 yang terlalu padat/kecil digantikan secara penuh oleh format Masterclass Ebook A4 Vertikal multi-halaman (24 Halaman).
   - Tipografi standar Helvetica/Helvetica-Bold ukuran 11.5pt dengan line-height 17.5pt untuk teks narasi, menghasilkan kenyamanan membaca optimal di layar ponsel dan tablet tanpa perlu pinch-zoom berlebihan.
2. **Integritas Materi Obsidian Vault 100% Murni:**
   - Seluruh teks penjelasan mentor alami dari `/sdcard/Download/obsidian/Amy_Trading_Academy_Vault/bagian-01-pemula-nol/` (9 file Markdown) dipulihkan seutuhnya.
   - Analogi orisinal (mengemudi mobil manual, modal peluru, beras sekarung vs lot, pedagang pasar tradisional vs pohon jati investor, gorengan, dsb.) dipertahankan tanpa peringkasan berlebih.
3. **Integrasi Infografis HD 16:9 & Diagram Teknis:**
   - 9 infografis resolusi tinggi 1200x675 (16:9) dari `/sdcard/Download/obsidian/Amy_Trading_Academy_Vault/images/` diintegrasikan di setiap bab pembuka.
   - Tambahan diagram teknis candlestick penempatan Stop Loss logis berbasis invalidation point tersemat di Bab 07.
4. **Struktur Halaman Bersih & Nir-Tumpang Tindih:**
   - Halaman 1: Cover mandiri berkelas institusional dengan 4 pilar kurikulum dan metadata penerbitan.
   - Halaman 2: Kata Pengantar Mentor & Daftar Isi lengkap 9 bab.
   - Halaman 3–23: Bab 01 s.d. Bab 09, masing-masing bab dimulai pada halaman baru dengan running header dan nomor halaman konsisten.
   - Halaman 24: Checklist Kelulusan Mandiri dengan 8 kartu evaluasi (vektor centang hijau dan teks wrap rapi) serta teaser Modul 02.
5. **Distribusi Otomatis & Verifikasi Visual:**
   - Ebook otomatis terdistribusi ke 4 lokasi:
     - `/sdcard/Download/Amy FX Academy - Modul 01 [Fondasi Pasar].pdf`
     - `/sdcard/Download/Documents/Amy FX Academy - Modul 01 [Fondasi Pasar].pdf`
     - `/sdcard/Download/Telegram/Amy FX Academy - Modul 01 [Fondasi Pasar].pdf`
     - `/root/Amy FX Academy - Modul 01 [Fondasi Pasar].pdf`
   - Verifikasi visual 100% via `pdftoppm` dan `view_file` pada halaman 1, 2, 3, 5, 6, dan 24 mengonfirmasi bebas glitch, bebas terpotong, dan tata letak elegan.

## [2026-10-21] Penghapusan Kartu Fractal Advisor & Laya AI dari Menu Backtest
- **Konteks:** Pengguna meminta penghapusan kartu *"Fractal Advisor & Laya AI"* (Pencocokan fraktal 187k candle & audit gerbang AI Laya) dari tab Backtest karena sudah tidak digunakan lagi.
- **Tindakan:**
  - Menghapus item `fractal-advisor` dari array `practiceItems` pada `app/src/main/assets/app.js` (baik di `/root/Amy-fx` maupun `/root/Amy-fx-pro`).
  - Halaman Backtest kini hanya menampilkan 4 modul latihan utama: Chart Analysis, Candle Replay, Guided Practice, dan Riwayat Backtest Lokal.
  - File aset di `apps/fractal-advisor/` dibiarkan utuh di penyimpanan tanpa dipanggil di antarmuka navigasi Backtest.

## [2026-10-21] Transformasi Modul Latihan Soal (60 Kasus Eksekusi Riil XAU/USD)
- **Konteks:** Modul lama berisi 60 soal teoretis sintetis kaku ($100-$260, 21 lilin buatan matematika) yang tidak relevan dengan live trading dan membuat pengguna bingung saat live execution.
- **Tindakan:**
  - Mengubah label modul menjadi *"Latihan Soal"* di seluruh menu, header, dan riwayat.
  - Membangun ulang 60 studi kasus menggunakan data pergerakan riil XAU/USD ($2620-$2660) dari sesi modern 2025 dengan 5 tema inti (12 kasus per tema):
    1. Filter Jebakan & Inducement (12 kasus)
    2. Eksekusi Killzone Sisi Kanan London & NY (12 kasus)
    3. Dealing Range & Disiplin NO TRADE (12 kasus)
    4. Penempatan SL Invalidation & Target TP Logis (12 kasus)
    5. Psikologi Eksekusi, Anti-FOMO & Anti-Revenge (12 kasus)
  - Pembagian kesulitan tetap 20 Mudah, 20 Sedang, 20 Advanced dengan integrasi link materi modul Academy terkait.
  - Tersinkronisasi penuh pada `/root/Amy-fx` dan `/root/Amy-fx-pro`.


