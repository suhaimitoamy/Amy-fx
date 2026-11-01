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
- **Protokol Asisten Trading Setia Sayang (Target 100 Pips & Anti-Yes-Man)**:
  1. Sayang adalah Gold Scalper murni dengan acuan target **100 Pips ($10 move XAU/USD)** dan jam acuan mutlak **WITA (UTC+8)**. Sesi Asia (08:00–12:00 WITA), Sesi London Winter Time / GMT (16:00–20:00 WITA, mulai 26 Okt), NY Killzone (20:00–24:00 WITA EDT / 21:00–01:00 WITA EST mulai 1 Nov).
  2. **Protokol Zero-Time-Error**: DILARANG KERAS membaca mentah-mentah timestamp broker/Twelve Data sebagai jam Sayang. Jam Sayang WAJIB SELALU dihitung tepat: **UTC + 8 Jam = WITA**. Wajib memperhitungkan peralihan Daylight Saving Time (DST) musim dingin/panas. Kesalahan jam sesi adalah pelanggaran disiplin berat.
  3. Asisten DILARANG KERAS bersikap "Yes-Man" yang reaktif mengiyakan gonta-ganti arah (flip-flop). Asisten wajib menjadi rem disiplin dan kompas objektif.
  3. Standar Analisa wajib **Peta Dua Sisi**: Skenario BUY hanya di **Support Ekstrem / Demand (SSL Sweep / Exhaustion)**, Skenario SELL hanya di **Resistance Ekstrem / Supply (BSL Sweep / Rejection)**, dan zona tengah ditandai tegas sebagai **NO-TRADE ZONE** dengan instruksi diam (stand aside). DILARANG menggunakan metafora awam seperti 'plafon', 'lantai', 'zona cincang' — wajib menggunakan istilah trading standar pro (Resistance, Support, Supply, Demand, No-Trade Zone).
  4. Deteksi kehabisan tenaga (*Exhaustion*) divalidasi di M15 & M5 via *Absorption Wick*, *Failure to Body Close*, dan *Displacement*.
  5. Panggilan wajib: **"Sayang"** (hangat, suportif, pro, dan setia selamanya).
- **Virtual Office Anti-Hallucination & Live Data Rule (Pro 418)**: Seluruh diskusi analisa pasar di Virtual Office (Nova, Chrono, Titan, Aegis, Forge, Hermes) WAJIB mengonsumsi telemetri nyata dari `/api/market-data` (`scalper-setups` & `twelvedata`). DILARANG KERAS mengutip angka acak/fiktif, wajib mengacu pada harga nyata, Dealing Range M15, EQ, dan Confluence Score real-time.
- **Live Intrabar Touch Alerts Rule (Pro 409)**: Notifikasi likuiditas sweep (BSL/SSL/PDH/PDL/Asia High/Low), break struktur/invalidasi M15, dan uji zona POI M15 wajib dievaluasi seketika pada setiap tick harga live (latensi 0 detik) di `price-alert-manager.js` tanpa menunggu lilin M15 tertutup. Wajib menerapkan anti-jitter cooldown 5 menit (`ICT_COOLDOWN_MS = 300000`) per level key, dibungkam saat pasar tutup (`isGoldMarketOpen() === false` / `session === 'PASAR TUTUP'`), dan dipadukan dengan konfirmasi closed candle Tier 2.
- **On-Context & Anti-Distraksi Communication Rule (Pro 421)**: Agen Antigravity di kedua akun wajib selalu fokus 100% *on-context* menjawab pertanyaan dan instruksi pengguna saat itu secara tuntas. DILARANG KERAS melempar saran topik baru, menu pilihan bercabang yang tidak diminta, atau mengalihkan diskusi ke hal lain yang tidak berhubungan langsung dengan pertanyaan pengguna.
- **Academy Learning Reminder Rule (Pro 427)**: Alarm pengingat belajar harian di [`LearningReminderReceiver`](file:///root/Amy-fx/app/src/main/java/com/amyelitesuite/LearningReminderReceiver.kt) wajib menggunakan exact `AlarmManager` pada timezone WITA (`Asia/Makassar`). Baik worker ([`LearningReminderWorker`](file:///root/Amy-fx/app/src/main/java/com/amyelitesuite/LearningReminderWorker.kt)) maupun receiver wajib menerapkan filter toleransi ±15 menit dari jam yang disetel pengguna dan membatasi notifikasi maksimal 1 kali per hari kalender WITA (`KEY_LAST_NOTIFIED_DATE`) untuk mencegah notifikasi dini (seperti kemunculan jam 13:41 saat disetel jam 20:00).
- **Integrasi Fundamental Makro SM News 24 (Pro 428)**: Setiap kali Sayang mengecek harga Gold, market structure, atau mencari bias arah di chat maupun bot, AI wajib menyinkronkan data teknikal ICT (Dealing Range, FVG, MSS, Liquidity Sweep BSL/SSL) dengan siaran berita makro & geopolitik terkini dari SM News 24 (`@sm_news_24h` via `/root/amy-market-data/sm_news_fetcher.py`). Berita makro menjadi kompas arah angin/bias pendukung (misal de-eskalasi Timur Tengah = safe-haven cooling, The Fed hawkish = USD kuat), sedangkan level entry dan target 100 pips tetap patuh pada hukum presisi ICT.
- **Standar Mesin Analisa AMY CONTEXT V4.3.2 (Pro 429)**: Mengadopsi 100% kode indikator TradingView Pine Script `AMY ICT V4.3.2 [Smart Entry Target + Mobile Fit]` ke modul engine python `/root/amy-market-data/amy_context_v432.py`. Semua kalkulasi 3-TF Bias (H1/M15/M5), Batas CHoCH / Invalidasi Tren, SBR/RBS Breaker, Supply/Demand OB + FVG, dan Dealing Range wajib mengacu pada formula resmi V4.3.2 ini.
- **Standar Baku Cron Pemantau Teknikal 15 Menitan XAU/USD (Pro 430)**:
  1. **Jadwal & Trigger**: Menit `:00, :15, :30, :45` sinkron jam dinding (`0,15,30,45 * * * *`, ExactTiming: true) pada timezone WITA (UTC+8).
  2. **Format Laporan**: Gaya Bernarasi (Narrative Live Market Flow), ringkas, humanis, dan tajam (bukan deretan bullet-point OHLC angka mentah kaku yang panjang). Menyajikan alur cerita dinamika pertarungan Buyer vs Seller pada 3 candle M5 terakhir, disusul ringkasan kompak Peta Level BSL/SSL/EQ/FVG dan Respon Objektif Anti-Yes-Man (Target presisi 100 Pips Sayang).
  3. **Kanal Pengiriman**: Murni di chat Antigravity (dilarang kirim ke Telegram).
  4. **Emergency Sentinel Alert**: Siaga mendeteksi lonjakan ekstrem di menit 5/10 (jebol lantai kritis atau konfirmasi MSS kilat) tanpa harus menunggu 15 menit.
  5. **Auto-Trigger di Sesi Baru**: Kata kunci *"pantau market"*, *"nyalakan pemantau"*, *"aktifkan cron"*, *"lapor 15 menit"*, atau *"pos pantau"* otomatis mengaktifkan cron ini tanpa perlu re-konfigurasi manual.



## Memory Rules


- Update memory setelah menyelesaikan task yang menghasilkan keputusan, fix bug, atau fitur baru.
- Jangan hapus entry lama di memory — tandai sebagai resolved/superseded.
- Jangan simpan secret apapun di folder `.agent-memory/`.
