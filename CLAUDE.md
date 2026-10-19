# Amy FX Project Guidelines

## UI Design Guidelines (Dark Premium Fintech)

When developing or modifying UI components for the **Amy FX** project, strictly adhere to the following invariant rules to maintain a professional, high-end "Dark Premium Fintech" aesthetic:

1. **Theme & Vibe:** 
   - **Dark Premium Fintech**: Use very dark/pure black backgrounds (e.g., `#0a0a0a`).
   - Implement subtle glowing effects (`box-shadow` with low opacity) instead of flat colors.
   - Maintain a "modern terminal" nuance.

2. **Color Palette:**
   - **Gold** (`var(--gold)`): Used for accents, current price highlights, active badges, and network connection lines.
   - **Neon Red** (`var(--red)` / `#ff4c4c`): Strictly for Resistance, Ask Liquidity, BSL, or Sell signals. Must include a soft red glow.
   - **Neon Green** (`var(--green)` / `#00d97e`): Strictly for Support, Bid Liquidity, SSL, or Buy signals. Must include a soft green glow.

3. **Typography:**
   - **Numbers & Prices**: Must always use a `monospace` font (e.g., `Courier New`) to look like a professional Bloomberg terminal. Make them bold/thick.
   - **Labels**: Clean, small, uppercase sans-serif text.

4. **Component Architecture:**
   - Avoid plain vertical lists for data. Use data-rich dashboard components (e.g., Node Cards, Segmented Bars, Network Trees).
   - Ensure clear visual hierarchy (Current Price is always the glowing center/focus).

## Chart Gold vs Peta Harga & Invariant Proteksi (Pro 403)

1. **Paritas Card (100% Mirip Peta Harga):**
   - Card **Chart Gold** di Cockpit Mapping (`apps/mapping/index.html`) dan Card **Peta Harga** di Beranda (`index.html`) identik 100% dalam struktur kontainer glassmorphism (`.gold-price-panel`), kontrol timeframe [M15 | M5], heading, live price di kanan, feed candle, dan canvas chart 340px.
2. **Pembeda Utama:**
   - Di Chart Gold terdapat layer visualisasi indikator ICT teknikal lanjutan yang bersumber dari skrip [`AMY_ICT_NextGen.pine`](apps/indikator/files/AMY_ICT_NextGen.pine) (BSL/SSL, PDH/PDL, PWH/PWL, Asia High/Low, FVG/OB, BOS/MSS, Trend Invalidation).
3. **Protokol Pemulihan Error (Golden Rule):**
   - Jika Chart Gold mengalami error atau glitch visual saat pengembangan indikator, **AI DILARANG mengutak-atik struktur sembarangan dan WAJIB MENUNGGU PERINTAH LANGSUNG dari user untuk disamakan kembali dengan Peta Harga.**

## Active Forming Candle Live (TradingView Parity) (Pro 419)

1. **Lilin Terakhir Bergerak Live (`candlestickSeries.update`):**
   - Di kedua chart (Chart Gold Mapping dan Peta Harga Beranda), lilin aktif periode berjalan (*forming candle*) kini diperbarui secara *real-time* mengikuti setiap *tick* harga live (`amyfx:twelvedata-price` / `amyfx:live-price-display`).
   - Body lilin, jarum atas (High), dan jarum bawah (Low) bergerak dinamis tanpa menunggu 15 menit selesai.
2. **Integritas Analisis ICT Tetap Terkunci (*Zero Repainting*):**
   - Seluruh logika keputusan (FVG, 50% CE, BOS, MSS, dealing range, skoring konfluensi, checklist pre-trade) tetap dihitung 100% dari closed candles terkonfirmasi.
   - Weekend Anti-Spam: Tidak ada sintesis lilin saat penutupan pasar akhir pekan.

## Fast Dev Mode & Larangan Full npm test Otomatis (Pro 404)

1. **Dilarang Menjalankan Full npm test (148 Suites) Secara Rutin:**
   - Menjalankan 148 suite tes penuh setiap kali edit kecil memakan waktu 45-60 detik dan membuang puluhan ribu token konteks.
   - **Full `npm test` HANYA dijalankan jika pengguna secara eksplisit meminta** (misal: *"jalankan test"* atau sebelum rilis APK).
2. **Standar Pengujian Cepat (Fast Dev Verification):**
   - **Syntax check instan (0.05s):** `node --check <file-yang-diedit>`
   - **Targeted test (0.2s):** Jalankan hanya 1 file tes yang relevan secara spesifik jika diperlukan (contoh: `node --test tests/mapping-chart-axis-pro379.test.mjs`), bukan 148 file.
   - **Visual verification:** Validasi langsung lewat server preview browser `http://localhost:8080/`.

## Cockpit Mapping UI & Presentation (Pro 405)

1. **Kartu 1 (Amy Live Assistant):** Menampilkan sinyal Entry Assistant V3 (`BUY ENTRY`, `SELL ENTRY`, `PULLBACK SELL`, `PULLBACK BUY`, atau `STANDBY`), status Anti-Chase (`READY DI ZONA` vs `MISSED - JANGAN KEJAR`), dan Math Zone yang aktif.
2. **Kartu 2 (Chart Gold):** 100% paritas Peta Harga, visual garis Entry Assistant V3 (Entry cyan, SL merah, TP1 kuning, TP2 hijau).
3. **Kartu 3 (AMY BIAS DASHBOARD V2):** Tabel Matriks 16 Baris (1 header + 15 data baris) persis tabel Pine Script.
4. **Kartu 4 (AMY ENTRY ASSISTANT V3 PLAN):** Kartu aksi trading bersih dengan grid 4 kolom (ENTRY, SL, TP1, TP2), Anti-Chase pill, Pullback banner, alasan inti eksekusi, dan tombol "Tampilkan Level di Chart".
5. **Tab Analyze & Driver Tournament:** 6 Driver dan setups dipusatkan di accordion paling bawah Tab Analyze sebagai arsip/riset. Bebas ketergantungan library Supabase.

## Weekend Gap & Cold-Start Stitching (Pro 406)

1. **Weekend Gap Tolerant Bridging (`isWeekendGap` & `pair` & `contiguous`):**
   - Jeda penutupan akhir pekan (Jumat 17:00 NY s.d. Minggu 17:00 NY, selisih ~48 jam / 172800 detik) ditoleransi sebagai kontinuitas sah antara lilin penutupan Jumat dan pembukaan Minggu.
   - Lilin Jumat sore tetap dihitung sebagai riwayat struktur yang sah, memenuhi syarat $\ge 40$ bar M15 dan $\ge 30$ bar H1 sejak awal buka pasar hari Minggu.
2. **Fair Market Elapsed Time (`marketElapsedSeconds`):**
   - Usia data candle dihitung hanya selama jam pasar buka (waktu pasar tutup 48 jam akhir pekan tidak dihitung sebagai waktu kadaluarsa).
   - Menghilangkan status palsu `DATA TERLAMBAT` saat pembukaan pasar hari Minggu maupun selama libur akhir pekan.

## Penyelarasan Sesi Harian PDH/PDL New York 17:00 Close (Pro 407)

1. **Cutoff Sesi Harian Standar Gold (17:00 New York Close):**
   - Pengelompokan lilin intraday ke dalam hari perdagangan di `nextgen-indicators.js` diselaraskan dengan batas resmi pasar Gold / Forex internasional (17:00 NY Close / `America/New_York`), bukan 00:00 WITA.
   - Menghilangkan masalah di mana rekor tertinggi sesi New York (misal 4184) terdorong masuk ke keranjang hari ini di WITA dan menyebabkan PDH kemarin tertinggal di 4179.
2. **Preseden Level Otoritatif Server (D1):**
   - Nilai PDH/PDL harian otoritatif dari D1 yang disediakan server / konteks (`serverAmyLevels.pdh`, `liquidityLevels`, `context.pd`) diprioritaskan (`Math.max(serverPdh, localPdh)`), mencegah distorsi dari keterbatasan buffer 300 lilin intraday.

## M15 Otoritas Penuh & Konfirmasi Eksekusi Mandiri (Pro 408)

1. **M15 Direct Confirmation Authority:**
   - Candle M15 yang resmi close adalah otoritas konfirmasi penuh dan mandiri untuk memicu eksekusi tanpa terblokir menunggu M5 break struktur.
   - Kriteria konfirmasi mandiri M15:
     a) M15 Wick Rejection >= 1.2x body di POI atau likuiditas (SSL/BSL/Asia/PDH/PDL).
     b) M15 Displacement Break (BOS / MSS) searah bias dengan body tebal (`bullDisp` / `bearDisp`).
     c) M15 50% CE Bounce di Dealing Range yang sehat (Diskon untuk BUY, Premium untuk SELL).
2. **Aktivasi Otomatis & Trigger Pendukung M5:**
   - Saat M15 close memenuhi salah satu kriteria di atas:
     - Status konfirmasi menjadi `CONFIRMED`.
     - Status eksekusi menjadi `READY` atau `READY TO REVIEW` (Grade A+).
     - Pemicu Entry Assistant V3 Plan aktif dan menghasilkan rencana eksekusi (Entry, SL, TP1, TP2, RR).
     - Peluru Utama A+ aktif tanpa harus terblokir menunggu M5 break.
   - M5 tetap diizinkan sebagai trigger pendukung jika mendahului, namun M15 close memiliki otoritas penuh.

## Overhaul Pemicu Entry Limit Driver Mapping & Dekopling M15 (Pro 408)

1. **Jendela Waktu Realistis & Likuiditas Valid:**
   - `entry_deadline` diperpanjang dari 15 menit (900s) menjadi 60–90 menit (`Math.max(3600, driver.hold)`), memberi ruang nafas bagi pasar Gold untuk retrace ke area limit.
   - Seleksi target likuiditas memilih level yang memiliki ruang bagi target (`validLiquidity || nearestLiquidity`), menghilangkan masalah demosi ke `WAITING_TARGET` akibat pivot minor 2-bar.
2. **Dekopling Penuh dari Ketergantungan M5 (Otoritas M15 Murni):**
   - Di `driver-model.js`, verifikasi kesegaran driver diperluas untuk menerima timestamp M15 (`context.source?.M15`) maupun M5.
   - Di `six-drivers.mjs` (keduanya `lib` dan `supabase`), lilin eksekusi fallback otomatis ke M15 (`M`) saat M5 tidak tersedia. Jendela konfirmasi retest diperluas menjadi 3600s (1 jam) agar retest M15 memiliki waktu cukup dan tidak kedaluwarsa prematur.
   - Di `market-context.mjs`, kesegaran konteks (`fresh`) berpusat pada kelengkapan H1 dan M15 tanpa membatalkan konteks jika lilin M5 terlambat.
   - Di antarmuka Mapping (`index.html`, `ict-presentation.js`, `context-panel.js`), seluruh salinan teks M5 yang tertinggal dibersihkan menjadi M15, menyelaraskan tampilan UI 100% dengan strategi trading pengguna.
3. **Pemicu Sentuhan Harga Real-Time (Touch Trigger):**
   - Di `api/scalper-setups.js`, sentuhan harga live ke level limit langsung mengaktifkan status ke `ACTIVE` (*"Harga menyentuh level limit · Posisi berjalan"*).
4. **Sinkronisasi Client Lifecycle Tracker:**
   - `trade-lifecycle-tracker.js` dinormalisasi untuk mengenali properti model driver (`direction`, `stopLoss`, `target`), dipasangkan listener `amyfx:driver-setups`, dan diaktifkan via `trackAssistantPlan(s)` di `context-panel.js`.

## Live Intrabar Touch Alerts (0s Delay) & Background Worker Sync (Pro 409)

1. **Akar Masalah Keterlambatan Notifikasi (BSL Sweep, Break, POI Test):**
   - **Closed-Candle Philosophy Delay (13–15 menit):** Sebelumnya, deteksi likuiditas sweep (`detectLiquiditySweep`) dan engine pasar hanya memeriksa lilin yang sudah tertutup (`is_closed: true`). Jika sweep terjadi pada menit ke-2 candle M15, sistem terpaksa menunggu lilin M15 selesai pada menit ke-15:00 (latensi built-in 13–15 menit).
   - **Background Worker Abortion:** `DriverSetupSyncWorker.kt` mewajibkan timestamp `M5` (`sourceObj?.optLong("M5", 0L)`), menyebabkan worker background Android batal diam-diam saat payload pasar beroperasi murni dengan otoritas M15.

2. **Model Notifikasi 2-Tier Real-Time:**
   - **Tier 1 (Instant Intrabar Touch Alert · Latensi 0 Detik):**
     - Di `price-alert-manager.js`, diimplementasikan fungsi `checkIctIntrabarSweeps(current, prev)` yang berjalan di setiap tick harga real-time (`twelvedata-price`, `price-tick`, DOM MutationObserver, periodic safety interval).
     - Memantau level likuiditas dari konteks aktif (`window.AmyMarketContext` / `amyfx.market-context.v1`):
       - **BSL / PDH / Asia High / PWH / EQH**: Sentuhan/tembusan ke atas (`prev < level && current >= level`) -> `⚡ SWEEP INTRABAR: <LABEL> ($<LEVEL>)`.
       - **SSL / PDL / Asia Low / PWL / EQL**: Sentuhan/tembusan ke bawah (`prev > level && current <= level`) -> `⚡ SWEEP INTRABAR: <LABEL> ($<LEVEL>)`.
       - **Break Struktur / Invalidasi M15**: Tembusan level invalidasi (`prev > inv && current <= inv` untuk Bullish, atau sebaliknya untuk Bearish) -> `⚠️ BREAK STRUKTUR: XAU/USD Menembus $<LEVEL>`.
       - **Uji Zona POI**: Harga masuk ke rentang POI M15 (`low`–`high`) dari atas maupun bawah -> `🎯 UJI ZONA POI: XAU/USD Masuk ke <LABEL>`.
     - **Multi-Channel Dispatch:** Dikirim instan melalui jembatan native Android (`window.Android.showNotificationWithUrl`), Web Notification API, Web Audio API chime melodic, haptic vibration, dan top glassmorphism banner (`showIctBanner`).
     - **Anti-Jitter Cooldown:** Dilengkapi cooldown 5 menit (`ICT_COOLDOWN_MS = 300000`) per level key untuk mencegah getaran/notifikasi berulang akibat fluktuasi tick kecil di sekitar level.
     - **Weekend Anti-Spam:** Otomatis dibungkam saat pasar tutup (`isGoldMarketOpen() === false` atau `session === 'PASAR TUTUP'`).
   - **Tier 2 (Confirmed Closed Candle Reclaim):**
     - Analisis penutupan lilin M15 tetap berjalan normal setelah lilin resmi close untuk mengonfirmasi validitas displacement / MSS atau wick rejection.

3. **Perbaikan Background Worker (`DriverSetupSyncWorker.kt`):**
   - Timestamp pemeriksaan lilin kini membaca `M15` terlebih dahulu (`sourceObj?.optLong("M15", 0L)`), fallback ke `M5`.
   - Jendela kesegaran diperluas menjadi 3600 detik (1 jam) agar background worker tidak menghentikan notifikasi saat feed M5 tidak ada.

## Kebijakan Supabase Dikunci Total & Zero-Touch Invariant (Pro 410)

1. **Status Beku Supabase (Frozen State):**
   - Proyek Supabase (`amy-market-data` / `wliecyxzlwhmtftnfnps`) resmi dikunci dan dibiarkan dalam kondisi apa adanya (*frozen state*).
   - **DILARANG MENGHAPUS, MEROMBAK, MENAMBAH TABEL, ATAU MENDEPLOY ULANG APAPUN** ke Supabase.
2. **Kemandirian Penuh Amy FX Pro (Zero-Supabase Runtime):**
   - Aplikasi Amy FX Pro telah beroperasi 100% mandiri mengandalkan Vercel Serverless (`api/twelvedata`, `api/scalper-setups`, `api/news`, `api/calendar`), TwelveData WebSocket, dan mesin eksekusi offline lokal di HP tanpa library Supabase client.
   - Seluruh integrasi baru (termasuk library backtest candle) tidak boleh membebani Supabase.

## Cloud Library 8-Tahun (2019–2026) Multi-Timeframe (Pro 411)

1. **Penyimpanan Dataset Cloud di GitHub Releases:**
   - Seluruh dataset 8 tahun XAU/USD (2019–2026) multi-timeframe (M1, M5, M15, H1, H4, D1) di-host di GitHub Releases (`amyfx-market-dataset-8years`), memuat 8 arsip tahunan (~42 MB) dan 93 file bulanan (~400–600 KB per bulan).
2. **Streaming Proxy Vercel & Cache Lokal:**
   - Serverless endpoint `api/candles.js` melayani manifest katalog dan streaming arsip bulanan dengan header CORS `*` dan edge CDN cache.
   - Server Termux (`tools/serve-local.mjs`) menyediakan zero-latency local fallback langsung dari `/sdcard/Download/lab backtest/candles/monthly/`.
   - Modul `data-provider.js` dan UI `chart-analysis.html` mengizinkan unduh dan instalasi instan per tahun atau per bulan langsung ke IndexedDB tanpa perlu upload manual.

## Perpustakaan Cloud di Candle Replay & Perbaikan Chart Kosong (Pro 412)

1. **Integrasi Panel Perpustakaan Cloud di Candle Replay (`candle-replay.html`):**
   - Menambahkan section `.cloud-library-panel` (Pilih Tahun 2019–2026, Pilih Bulan, Tombol ⚡ Pasang dari Cloud) langsung ke dalam aside Candle Replay.
   - Fungsi `initCloudLibrary()` mengunduh pack dari Cloud (Vercel proxy/GitHub dataset), menyimpannya ke IndexedDB, me-refresh dropdown pack, dan langsung berpindah ke pack yang baru dipasang via `changeSource(firstId)`.
2. **Akar Masalah Chart Replay Kosong & Solusinya:**
   - **Stale Replay State Gotcha:** Sebelumnya `storage.loadReplayState()` mengutamakan `saved.sourceId` lama (sample Maret 2009) daripada pack aktif yang baru diunduh di `provider.selectedSourceId()`. Kini pack aktif global selalu diprioritaskan.
   - **Out-of-Range Cursor Bounds:** Timestamp cursor lama dari dataset lain (misal 2009 vs 2025) sebelumnya menyebabkan `lowerBound` memilih bar index 0 sehingga chart hanya memuat 1 candle (tampak kosong). Kini `ReplayController.prototype.start` memverifikasi rentang timeline: jika timestamp di luar batas dataset, otomatis me-reset ke `Math.min(80, timeline.length - 1)` sehingga 80 candle awal langsung tampil penuh.
   - **Resilience Sample Loader:** `loadSample()` di `data-provider.js` dibungkus multi-fallback dan `listSources()` dibungkus per-sumber try/catch sehingga kegagalan fetch sample lokal/offline tidak memblokir pembacaan pack IndexedDB.
   - **Responsive Auto-Fit:** `chart.setCandles` memanggil `fitContent()` pada render pertama, serta `chart.resize()` dan listener `window.addEventListener('resize')` dipasang agar kanvas chart selalu fit ke dimensi kontainer.

## Replay Multi-Timeframe Mulus (M1–D1) & Sinkronisasi Cursor Presisi (Pro 413)

1. **Akar Masalah Lilin Stuck / Seolah Otomatis M1:**
   - **Desinkronisasi Kursor Saat Pindah Timeframe:** Saat pengguna beralih dari M1 ke M15/M30/H1, kursor lama (misal bar 80 M1 = 80 menit) dipertahankan tanpa penyesuaian. Pada M15 hanya terbentuk 5–6 candle dan pada M30 hanya 2–3 candle, sehingga chart tampak hampir kosong. Ketika tombol `+1` atau `Putar` ditekan, langkah pertama hanya menyelesaikan pecahan lilin yang sama tanpa menambah jumlah lilin, menimbulkan kesan tombol macet atau hanya M1 yang jalan.
   - **Label Pack Mengunci Persepsi M1:** Dropdown data menampilkan label `31.000 M1` (karena format file fisik M1), membuat pengguna mengira pilihan timeframe diabaikan dan sistem "otomatis pakai M1".
   - **OHLC Strip Menampilkan Menit Ganjil M1:** Waktu candle di strip atas dan status bar mengambil `payload.cursor` (misal 02:14 WITA, 02:29 WITA), bukan waktu pembukaan bucket lilin (02:00 WITA, 02:15 WITA).
2. **Solusi Komprehensif Pro 413:**
   - **State `isDefaultInitial` di Replay Engine:** Saat pengguna berada di posisi awal default, pergantian timeframe ke M5, M15, M30, H1, H4, atau D1 langsung memuat 80 candle utuh dari timeframe tujuan, menjamin chart selalu penuh konteks. Jika pengguna telah bernavigasi/melangkah, kursor waktu dipertahankan secara presisi.
   - **Label Pack Multi-Timeframe Ramah:** Mengubah format label dropdown dari `31.000 M1` menjadi `31.000 bar (M1–D1)` di `candle-replay.js`, `chart-analysis.js`, dan `data-provider.js`.
   - **Penyelarasan Waktu OHLC & Badge TF:** Strip OHLC kini menggunakan `current.time` (waktu pembukaan bucket, misal 02:00 WITA, 02:15 WITA), status bar menampilkan format eksplisit `[M15] · Candle ...`, dan badge TF aktif disematkan di strip info.
   - **Fast-Path Agregasi Biner:** Optimasi `trustedSeries` pada `aggregateCandles` dan `visibleCandles` menggunakan pencarian biner pada slice data yang sudah terurut, memangkas waktu pemrosesan dari ~450ms menjadi ~5ms per langkah untuk playback ultra-responsif di perangkat mobile.

## Kurikulum Master ICT Terpadu (12 Modul Murni) & Purifikasi Retail SMC (Pro 414)

1. **Purifikasi Konsep Retail SMC (Zero-Tolerance False Concepts):**
   - **Eliminasi Mitos IDM Mekanis:** Menghapus aturan buatan retail *"pullback 1 wajib di-sweep sebelum BOS sah"*. Struktur ICT murni ditentukan oleh Swing Fractal 3/5 lilin dan Displacement.
   - **Eliminasi Istilah CHoCH:** Seluruh penyebutan istilah retail CHoCH dibersihkan dan distandarkan menjadi MSS (Market Structure Shift) institusional.
   - **Eliminasi Mitos Antropomorfis Bank:** Menghapus narasi fiktif *"Bank floating rugi di OB dan mau keluar di BE"*, digantikan dengan mekanisme sejati *Repricing Efficiency IPDA*.
   - **Standardisasi Terminologi:** Titik tengah 50% bodi Order Block adalah *Mean Threshold (MT)*, sedangkan 50% FVG/Wick adalah *Consequent Encroachment (CE)*.
   - **Standar Waktu New York & DST:** Seluruh jam Killzone dan Macro berpatokan resmi pada New York Time (EST/EDT) dengan penjelasan pergeseran musiman Daylight Saving Time (DST).
2. **Penyatuan Kurikulum (Merge 3 Semester -> 12 Modul Master Terpadu):**
   - 3 Semester dengan 36 bagian (492 bab repetitif/bloated) disatukan menjadi **12 Modul Master Terpadu** yang padat, terstruktur, dan 100% selaras dengan skrip `AMY_ICT_NextGen.pine` serta Cockpit Mapping Amy FX Pro.
   - Folder `bagian-13` s.d. `bagian-36` dialihkan secara transparan ke modul master yang relevan tanpa merusak URL lama atau pengujian otomatis.
   - Antarmuka Beranda (`index.html`) dan Silabus (`daftar-materi.html`) menampilkan navigasi 12 Modul Master Dark Premium Fintech dengan filter kategori dinamis.

## Virtual Office Live Market Telemetry & Protokol Anti-Halusinasi (Pro 418)

1. **Eliminasi Angka Statis & Hardcoded:**
   - Semua angka harga mock lama ($2,880 – $2,948) di kanvas 3D dan skrip War Room telah dibersihkan total.
   - Frontend 3D secara periodik melakukan polling ke endpoint internal `/api/market-data` (port 8090).
2. **Koneksi Engine Real-Time Vercel:**
   - `server.mjs` terhubung langsung ke `https://amy-fx.vercel.app/api/scalper-setups` dan `api/twelvedata`.
   - Setiap query analisa pasar, buy/sell, atau order limit secara otomatis menyuntikkan telemetri nyata (Harga XAU/USD, Dealing Range M15, EQ, Struktur, Confluence Score, 6 Drivers state) ke dalam prompt dewan robot agar bebas halusinasi.

## Virtual Office First-Person POV Exploration & Physics Normalization (Pro 422)

1. **Karakter Tersembunyi & Layar Plong 100%:**
   - Seluruh mesh karakter mecha (`avatarGroup.visible = false`) disembunyikan agar layar HP plong dan tidak terhalang.
   - Kamera diposisikan pada level mata operator (`eyeY = mesh.position.y + 6.2 + eyeBob`) untuk eksplorasi First-Person POV sejati.
2. **Kontrol Arah POV Intuitif:**
   - Vektor pergerakan dikunci ke arah pandang kamera (`fpYaw`): Joystick atas = MAJU lurus searah kamera, bawah = MUNDUR, kanan/kiri = STRAFE.
   - Swipe kanan layar memutar pandangan 360° secara luwes (Yaw & Pitch vertikal terbatasi).
3. **Fisika Snappy Realistis:**
   - Lompatan cepat dan manusiawi (`jumpVelocity: 1.4`, `gravity: -0.16`, `fallGravity: -0.26`, `maxFallSpeed: -2.2`) menghilangkan efek mengambang di bulan.
   - Trampolin Quantum Launch Pad melontarkan dengan ketinggian proporsional (`vy = 3.6`) dan mendarat mantap.

## Mentor Trading Privat 1-on-1, Twelve Data MCP & Pedagogical Guardrails (Pro 426)

1. **Skill Global `mentor-trading-privat`:**
   - Ditempatkan di `/root/.agents/skills/mentor-trading-privat/SKILL.md` (shared Akun 1 & Akun 2).
   - Menghubungkan kurikulum materi Obsidian (`Amy_Trading_Academy_Vault`) dengan engine pasar riil.
2. **Twelve Data MCP & Candle Builder Sync:**
   - Server MCP mandiri di `/root/.agents/mcp-servers/twelvedata-server.mjs`.
   - Konfigurasi di `/root/.gemini/config/mcp_config.json`.
   - Mengambil data live dan otomatis menyimpan ke SQLite `/root/amy-market-data/xauusd_bot.sqlite`.
   - Menyediakan tool analisis ICT lengkap: BSL, SSL, Sweeps, BOS, MSS/CHoCH, Active FVGs (CE 50%), dan Dealing Range.
3. **Pedagogical Guardrails & Anti-Distraksi:**
   - **Chunking Method:** Materi diajarkan per 2-3 segmen logis tanpa memangkas ilmu (Zero Information Loss).
   - **On-Context Discipline (Pro 421):** AI fokus 100% pada pertanyaan user tanpa melempar opsi atau saran cabang yang tidak diminta.
   - **True Level 0 Rule:** Dilarang menampilkan chart atau istilah teknikal jika mulai dari nol; wajib dari logika berdagang awam dan analogi fisik.
   - **Real-World Gold Rules:** Menolak SL mikro $1 di Gold; menerapkan SL struktural di balik sweep dan TP ke DOL nyata dengan RR >= 1:2.

## Academy Learning Reminder & Alarm Guardrails (Pro 427)

1. **Exact-Time Native Alarm (`AlarmManager`):**
   - Pengingat belajar harian di [`LearningReminderReceiver`](file:///root/Amy-fx/app/src/main/java/com/amyelitesuite/LearningReminderReceiver.kt) menggunakan `AlarmManager.setExactAndAllowWhileIdle` / `setAndAllowWhileIdle` pada timezone WITA (`Asia/Makassar`).
   - Mencegah pergeseran waktu akibat Doze mode Android atau optimasi baterai.
2. **Strict Time-Window Guard (±15 Menit):**
   - Baik di [`LearningReminderWorker`](file:///root/Amy-fx/app/src/main/java/com/amyelitesuite/LearningReminderWorker.kt) maupun [`LearningReminderReceiver`](file:///root/Amy-fx/app/src/main/java/com/amyelitesuite/LearningReminderReceiver.kt), notifikasi hanya diizinkan muncul jika waktu sekarang berada dalam rentang toleransi ±15 menit dari jam yang disetel pengguna (misal 20:00 WITA).
   - Menolak dan membuang (discard) eksekusi prematur (seperti 13:41 WITA saat WorkManager mengevaluasi periodic work saat app baru dibuka).
3. **Once-Per-Day Date Guard (`KEY_LAST_NOTIFIED_DATE`):**
   - Notifikasi hanya dapat dikirim maksimal 1 kali per hari kalender WITA (`YYYY-MM-DD`).
4. **Boot Resilience:**
   - [`BootReceiver`](file:///root/Amy-fx/app/src/main/java/com/amyelitesuite/BootReceiver.kt) secara otomatis mengaktifkan ulang alarm saat perangkat reboot (`ACTION_BOOT_COMPLETED`).
