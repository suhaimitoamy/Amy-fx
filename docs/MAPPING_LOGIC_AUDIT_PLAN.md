# MAPPING LOGIC AUDIT PLAN — Amy FX

> **Dibuat:** 26 Juni 2026  
> **Versi Aplikasi:** v1.2.0 (versionCode 12)  
> **Module Target:** Mapping (`app/src/main/assets/apps/mapping/`)  
> **Status:** PLAN SAJA — Belum ada patch atau perubahan kode  

---

## Daftar Isi

1. [Tujuan Audit](#1-tujuan-audit)
2. [Scope Audit](#2-scope-audit)
3. [File yang Akan Dicek](#3-file-yang-akan-dicek)
4. [Fitur Mapping yang Harus Dipastikan Tetap Ada](#4-fitur-mapping-yang-harus-dipastikan-tetap-ada)
5. [Alur Data Mapping](#5-alur-data-mapping-dari-api-key--websocket--candle--analysis--setup--scanner--notification)
6. [Checklist Audit Dashboard](#6-checklist-audit-dashboard)
7. [Checklist Audit Analyze](#7-checklist-audit-analyze)
8. [Checklist Audit AMY FX Decision](#8-checklist-audit-amy-fx-decision)
9. [Checklist Audit Valid Break Info](#9-checklist-audit-valid-break-info)
10. [Checklist Audit Amy FX Mapping Explanation](#10-checklist-audit-amy-fx-mapping-explanation)
11. [Checklist Audit Setup Aktif](#11-checklist-audit-setup-aktif)
12. [Checklist Audit Save & Connect API](#12-checklist-audit-save--connect-api)
13. [Checklist Audit Live Price WebSocket](#13-checklist-audit-live-price-websocket)
14. [Checklist Audit Background Scanner ON/OFF](#14-checklist-audit-background-scanner-onoff)
15. [Checklist Audit Notification](#15-checklist-audit-notification)
16. [Checklist Audit Navigation Tab](#16-checklist-audit-navigation-tab)
17. [Checklist Audit Cache/localStorage](#17-checklist-audit-cachelocalstorage-agar-data-lama-tidak-tampil-sebagai-data-baru)
18. [Checklist Audit Build GitHub Actions](#18-checklist-audit-build-github-actions)
19. [Daftar Risiko Logika yang Harus Dicari](#19-daftar-risiko-logika-yang-harus-dicari)
20. [Format Laporan Hasil Audit Nanti](#20-format-laporan-hasil-audit-nanti)
21. [Aturan Patch Jika Nanti Ditemukan Bug](#21-aturan-patch-jika-nanti-ditemukan-bug)

---

## 1. Tujuan Audit

Audit ini bertujuan untuk:

- **Memverifikasi bahwa seluruh fitur module Mapping benar-benar berfungsi secara logika**, bukan hanya tampil di UI tanpa backend logic yang bekerja.
- **Menelusuri alur data end-to-end** dari input API key oleh user hingga notifikasi setup diterima di perangkat Android.
- **Mengidentifikasi potensi dead code**, logika yang tidak terhubung, atau fungsi yang hanya tampil di UI tapi tidak pernah dipanggil oleh native bridge.
- **Memastikan data yang ditampilkan di Dashboard adalah data real-time/fresh**, bukan data cache lama yang ditampilkan seolah-olah data baru.
- **Memastikan background scanner benar-benar memonitor target BSL/SSL** yang dikirim dari Mapping UI dan menghasilkan notifikasi yang bermakna.
- **Memverifikasi bahwa dual analysis engine** (JavaScript di `index.html` + Kotlin di `MappingLogicCore.kt`) konsisten atau setidaknya jelas mana yang dipakai di skenario apa.
- **Mendokumentasikan semua temuan** sebagai "hal yang perlu diverifikasi" tanpa langsung melakukan patch.

### Bukan Tujuan Audit Ini

- Memperbaiki bug (hanya mencatat).
- Refactor kode atau mengubah arsitektur.
- Menambah/menghapus fitur.
- Mengaudit style/format kode.
- Mengaudit Supabase/SQLite secara mendalam (hanya dicatat sebagai dependency).

---

## 2. Scope Audit

### Dalam Scope

| Area | Keterangan |
|------|-----------|
| Module Mapping UI | `index.html` (901 baris, 57KB) dan semua file JS pendukung |
| Native Bridge | Interface `window.Android` di `MainActivity.kt` ↔ JavaScript |
| Logika Analisis JS | Fungsi `analyze()`, `buildSetups()`, `detectStructure()`, dll di `index.html` |
| Logika Analisis Kotlin | `MappingLogicCore.kt` — `detectSwings()`, `detectStructure()`, `detectFvg()`, `detectOrderBlocks()`, `score()` |
| Background Scanner | `ScannerService.kt` — WebSocket price monitor, BSL/SSL target check, notifikasi |
| Notification Gate | `AmyFxNotificationGate.java` — throttling, deduplikasi, routing |
| Notification Guard JS | IIFE di `index.html` baris 793-897 dan `sw.js` baris 81-205 — rate limiting JS-side |
| Cache & Storage | `CandleStore.kt` (SQLite), `SecurePrefs.kt`, `localStorage` di JS, Service Worker cache |
| Data Pipeline | API Key → WebSocket → Candle → Analysis → Setup → Scanner Target → Notification |
| CI/CD | GitHub Actions workflow files (5 aktif + 1 disabled) |

### Luar Scope (Hanya Dicatat Sebagai Dependency)

| Area | Alasan |
|------|--------|
| Supabase backend | Pihak ketiga, hanya dicatat sebagai sumber data candle (fallback) |
| Twelve Data API | Pihak ketiga, hanya dicatat sebagai sumber WebSocket + REST candle |
| EncryptedSharedPreferences internal | Bagian AndroidX Security, bukan kode custom |
| ProGuard rules | Hanya relevan jika ditemukan crash di release build |
| Module lain (Journal, Academy, Indicator Library) | Bukan module Mapping |

---

## 3. File yang Akan Dicek

### File Utama (Prioritas 1 — Wajib Audit Detail)

| # | File | Ukuran | Fungsi Utama |
|---|------|--------|-------------|
| 1 | `app/src/main/assets/apps/mapping/index.html` | 57 KB (901 baris) | UI utama module Mapping (SPA), **semua logika analisis ICT di JavaScript**, 5 tab navigasi, WebSocket live price, notification guard |
| 2 | `app/src/main/java/com/amyelitesuite/MainActivity.kt` | 35 KB (853 baris) | WebView setup, `@JavascriptInterface` bridge `window.Android`, service control, notification sending, file download, permission gate |
| 3 | `app/src/main/java/com/amyelitesuite/ScannerService.kt` | 18 KB (460 baris) | Foreground service, WebSocket ke Twelve Data (XAU/USD only), BSL/SSL target monitoring, alert notification, watchdog, reconnect |
| 4 | `app/src/main/java/com/amyelitesuite/MappingLogicCore.kt` | 8.6 KB (203 baris) | Engine analisis Kotlin: swing detection, BOS/CHOCH, FVG, Order Block, setup scoring (skala 10) |
| 5 | `app/src/main/java/com/amyelitesuite/AmyFxNotificationGate.java` | 2.8 KB (68 baris) | Gate notifikasi: `shouldNotify()` cooldown 5 menit, `stableId()` untuk notification ID, `routeFor()` routing, `contentIntent()` deep link |

### File Pendukung (Prioritas 2 — Audit Keterhubungan)

| # | File | Ukuran | Fungsi |
|---|------|--------|--------|
| 6 | `app/src/main/java/com/amyelitesuite/CandleStore.kt` | 6 KB (173 baris) | SQLite cache candle data, upsert/batch, cleanup expired, retention policy |
| 7 | `app/src/main/java/com/amyelitesuite/SecurePrefs.kt` | 1.2 KB (41 baris) | Penyimpanan API key terenkripsi (AES256_GCM + AES256_SIV) |
| 8 | `app/src/main/java/com/amyelitesuite/MarketDataSyncAgent.kt` | 3.6 KB (110 baris) | Orchestrator sinkronisasi data: bootstrap, tick processing, gap filling |
| 9 | `app/src/main/java/com/amyelitesuite/SupabaseCandleClient.kt` | 3.2 KB (71 baris) | HTTP client fetch candle dari Supabase PostgREST |
| 10 | `app/src/main/java/com/amyelitesuite/MarketDataFallback.kt` | 735 B (28 baris) | Retry logic (exponential backoff) + cache accessor |
| 11 | `app/src/main/java/com/amyelitesuite/SessionClock.kt` | 784 B (26 baris) | Deteksi sesi trading (Asia/London/New York/Dead Zone) — timezone WIB (UTC+7) |
| 12 | `app/src/main/java/com/amyelitesuite/MemoryConstants.kt` | 160 B (7 baris) | Re-export `TRIM_MEMORY_RUNNING_LOW` — kemungkinan dead code |
| 13 | `app/src/main/java/com/amyelitesuite/BootReceiver.kt` | 1.8 KB | Auto-restart scanner setelah reboot/app update |

### File Aset JS Pendukung (Prioritas 3)

| # | File | Ukuran | Fungsi |
|---|------|--------|--------|
| 14 | `app/src/main/assets/apps/mapping/ict-output-cards.js` | 1.7 KB (35 baris) | Render kartu ICT output + "Copy to Jurnal" |
| 15 | `app/src/main/assets/apps/mapping/mtf-confluence.js` | 1.3 KB (28 baris) | Multi-timeframe confluence: `summarize()` (≥3 bullish→HTF BULLISH, ≥3 bearish→HTF BEARISH) |
| 16 | `app/src/main/assets/apps/mapping/sw.js` | 5.8 KB (207 baris) | Service Worker caching (cache-first, bypass `twelvedata.com`) + Notification Guard IIFE |

### File Build & CI (Prioritas 4)

| # | File | Fungsi |
|---|------|--------|
| 17 | `.github/workflows/build-apk.yml` | Primary debug build (push to main) |
| 18 | `.github/workflows/build-debug.yml` | Develop branch build |
| 19 | `.github/workflows/build-release.yml` | Release build (manual, dengan keystore signing) |
| 20 | `.github/workflows/build.yml` | General build (push/PR to main) |
| 21 | `.github/workflows/lint-check.yml` | Quality gate: lint + unit test + TODO check |
| 22 | `app/build.gradle.kts` | Build config: compileSdk 35, minSdk 24, targetSdk 35, deps |
| 23 | `AndroidManifest.xml` | 13 permissions, service/receiver declaration, deep link `amyfx://mapping` |

---

## 4. Fitur Mapping yang Harus Dipastikan Tetap Ada

Semua fitur berikut **wajib tetap ada dan berfungsi** setelah audit selesai. Audit hanya memverifikasi, tidak menghapus.

| # | Fitur | Tab/Lokasi di `index.html` | Fungsi Utama (Dari Kode) |
|---|-------|---------------------------|-------------------------|
| 1 | **Dashboard** | Tab Dashboard, fungsi `dashboard()` L109 | Hero card XAU/USD + harga + WIB time, Killzone panel (7 sesi ICT), tombol "⚡ Analisis Setup", Best Setup card, Market Concepts grid (Bias, Structure, OB, FVG, Liquidity) |
| 2 | **Analyze** | Tab Analyze, fungsi `analyzeView()` L327 | TF grid (M1-W1), AMY FX Decision, Valid Break Info, M1-H4 Mapping Table, AI Mapping Notes, Setup Aktif |
| 3 | **AMY FX Decision** | Analyze tab, fungsi `amyDecisionCard()` L234 | Direction (FOKUS BUY/SELL/TUNGGU), Active Bias, Confidence%, Status, Entry Area, Invalidation, Target, Reason |
| 4 | **Valid Break Info** | Analyze tab, fungsi `validBreakInfo()` L247 | Break level, candle close, live price, structure type (BOS/CHOCH), conclusion (VALID/FAILED/WARNING/BELUM VALID) |
| 5 | **Amy FX Mapping Explanation** | Analyze tab, fungsi `aiMappingExplanation()` L295 | Penjelasan naratif bahasa Indonesia: mapping state, entry area, liquidity, invalidation, target, kesimpulan |
| 6 | **Setup Aktif** | Analyze tab, L328-334 | Filter setup non-fatal via `analyzeActiveSetups()`, render via `setupCard()` — tipe, TF, status, direction, score, harga, entry, SL, TP1, TP2, reason |
| 7 | **History / Event Logs** | Tab History, fungsi `history()` L337 | Event logs (max 200 entries), download sebagai `amy-fx-logs.txt` |
| 8 | **Settings & API** | Tab Settings, fungsi `settings()` L338 | Input API key, Save & Connect, Background Scanner toggle, Test Notification |
| 9 | **Save & Connect API** | Settings tab, fungsi `saveConnect()` L368 | Simpan key ke `localStorage` (`twelve_api_key`), panggil `connect()`, kirim target ke native |
| 10 | **WebSocket live price** | Global, fungsi `connect()` L107 | `wss://ws.twelvedata.com/v1/quotes/price` — subscribe XAU/USD, debounced re-analysis tiap 15 detik |
| 11 | **Background Scanner ON/OFF** | Settings tab, fungsi `toggleBg()` L369 | Toggle `state.bg` → `localStorage` `bg_scanner` → `window.Android.startBackgroundScanner()` / `stopBackgroundScanner()` |
| 12 | **Notification** | Background, `notifyImportant()` L105 | Notifikasi jika setup score ≥ 70 + cooldown 5 menit per key. Via `Android.showNotificationWithUrl()` atau browser `Notification` |
| 13 | **Navigation tab** | Bottom nav, L77, L372 | 5 tab: Dashboard (▥), Analyze (〽), Setups (◎), History (◷), Settings (⚙) |

---

## 5. Alur Data Mapping dari API Key → WebSocket → Candle → Analysis → Setup → Scanner → Notification

### 5.1 Diagram Alur Data

Berikut alur data end-to-end yang harus diverifikasi saat audit. **PENTING:** Terdapat **dua engine analisis yang terpisah** — satu di JavaScript (`index.html`), satu di Kotlin (`MappingLogicCore.kt`). Keduanya memiliki implementasi sendiri-sendiri.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ALUR DATA MODULE MAPPING                            │
│           (Berdasarkan analisis kode aktual, bukan asumsi)                 │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────────────┐     ┌────────────────────────────┐
  │  USER    │────▶│ Settings Tab     │────▶│ saveConnect() [JS L368]    │
  │ input    │     │ (index.html)     │     │ 1. Baca #apiKey input      │
  │ API key  │     └──────────────────┘     │ 2. Simpan ke localStorage  │
  └──────────┘                              │    key: 'twelve_api_key'   │
                                            │ 3. Panggil connect()       │
                                            │ 4. Panggil                 │
                                            │    sendTargetsToNative()   │
                                            └────────┬──────────────┬────┘
                                                     │              │
                                                     ▼              ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                    DUA JALUR PARALEL                                   │
  ├────────────────────────────────┬───────────────────────────────────────┤
  │      JALUR A: LIVE PRICE      │      JALUR B: BACKGROUND SCANNER     │
  │      (WebSocket di JS)        │      (Foreground Service Kotlin)     │
  ├────────────────────────────────┼───────────────────────────────────────┤
  │                                │                                       │
  │ connect() [JS L107]            │ sendTargetsToNative() [JS L106]       │
  │   │                            │   → Android.startBackgroundScanner(   │
  │   ▼                            │       apiKey, upper, lower)           │
  │ WebSocket JS client            │         │                             │
  │ wss://ws.twelvedata.com        │         ▼                             │
  │ /v1/quotes/price?apikey=...    │ MainActivity.startBackgroundScanner() │
  │   │                            │   [Kotlin L609]                       │
  │   ▼                            │   1. Validasi permission              │
  │ onopen:                        │   2. Simpan API ke SecurePrefs +      │
  │   - state.conn='Connected'     │      SharedPreferences                │
  │   - subscribe XAU/USD          │   3. Simpan BSL/SSL ke prefs          │
  │   - runAnalysis() [PERTAMA]    │   4. startForegroundService()         │
  │   │                            │         │                             │
  │   ▼                            │         ▼                             │
  │ onmessage:                     │ ScannerService.onStartCommand()       │
  │   - Validasi price 1000-10000  │   [Kotlin L47]                       │
  │   - Update state.price         │   1. Load API key                     │
  │   - Save last_price ke LS      │   2. Load BSL/SSL targets             │
  │   - renderAnalyzeLive()        │   3. connectSocket() → WebSocket      │
  │   - Debounce 15s → runAnalysis │      ke wss://ws.twelvedata.com       │
  │         │                      │   4. startWatchdog() (cek 120s)       │
  │         ▼                      │   5. Return START_STICKY              │
  │ runAnalysis(tf) [JS L103]      │         │                             │
  │   │                            │         ▼                             │
  │   ├─ fetchTf() [REST API]     │ WebSocket onMessage:                  │
  │   │  GET 300 candle per TF     │   - Parse JSON, extract "price"      │
  │   │  dari Twelve Data REST     │   - Update lastPrice                  │
  │   │                            │   - checkTargets(price) ← INTI       │
  │   ├─ HTF bias: mini-analyze    │         │                             │
  │   │  M1-H4 (mapMini)          │         ▼                             │
  │   │                            │ checkTargets() [Kotlin L158]:         │
  │   ├─ analyze(candles,tf,htf)   │   - Cek target expiry (>24h → clear) │
  │   │  [JS L101] ← ENGINE JS    │   - BSL: price >= setupUpper          │
  │   │   ├─ swings()              │         AND armed? → ALERT           │
  │   │   ├─ detectStructure()     │   - SSL: price <= setupLower          │
  │   │   ├─ detectFvg()           │         AND armed? → ALERT           │
  │   │   ├─ detectOB()            │   - Re-arm jika price menjauh 0.50   │
  │   │   ├─ BSL/SSL calculation   │         │                             │
  │   │   ├─ Premium/Discount zone │         ▼                             │
  │   │   └─ buildSetups() → score │ maybeSendTargetAlert() [L196]:        │
  │   │                            │   - Cooldown 30 menit per level       │
  │   ├─ sendTargetsToNative()     │   - sendAlert() → NotifGate check    │
  │   │  → Update BSL/SSL scanner  │   - Android Notification (HIGH)       │
  │   │                            │   - Deep link → Analyze tab           │
  │   └─ notifyImportant() [L105]  │                                       │
  │      if score ≥ 70:            │                                       │
  │        → Android.showNotif()   │                                       │
  │        (cooldown 5 min)        │                                       │
  │         │                      │                                       │
  │         ▼                      │                                       │
  │ render() → Update semua UI     │ Watchdog (60s loop) [L225]:           │
  │   ├─ Dashboard                 │   Jika no tick > 120s → reconnect     │
  │   ├─ AMY FX Decision           │                                       │
  │   ├─ Valid Break Info          │ Reconnect backoff:                    │
  │   ├─ M1-H4 Table              │   15s → 30s → 60s → 120s → 300s →    │
  │   ├─ AI Mapping Notes          │   600s (cap)                          │
  │   └─ Setup Aktif               │                                       │
  └────────────────────────────────┴───────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────────────┐
  │            JALUR C: NATIVE CANDLE ACCESS (via Bridge)                  │
  ├────────────────────────────────────────────────────────────────────────┤
  │                                                                        │
  │ JS: window.Android.getNativeCandles(symbol, timeframe, limit)          │
  │       [Bridge call ke Kotlin]                                          │
  │         │                                                              │
  │         ▼                                                              │
  │ MainActivity.getNativeCandles() [Kotlin L667]                          │
  │   → CandleStore.getLatest(symbol, timeframe, limit)                   │
  │   → Return JSON array string                                          │
  │                                                                        │
  │ NOTE: Ini adalah akses READ-ONLY ke SQLite cache.                     │
  │ Candle data di SQLite berasal dari MarketDataSyncAgent                │
  │ yang fetch dari SupabaseCandleClient (fallback).                      │
  │                                                                        │
  │ PERLU DIVERIFIKASI: Apakah index.html menggunakan                     │
  │ getNativeCandles() atau fetchTf() (REST langsung)?                    │
  └────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Arsitektur Dual Engine — Hal KRITIS yang Perlu Diverifikasi

Dari analisis kode, ditemukan bahwa terdapat **dua engine analisis yang terpisah**:

| Engine | Lokasi | Fungsi Deteksi | Scoring | Dipakai Oleh |
|--------|--------|---------------|---------|-------------|
| **JS Engine** | `index.html` L94-101 | `swings()`, `detectStructure()`, `detectFvg()`, `detectOB()`, `buildSetups()`, `analyze()` | Skor 0-100 (READY≥70, WATCH≥55, WAIT<55) | UI langsung (runAnalysis di WebSocket callback) |
| **Kotlin Engine** | `MappingLogicCore.kt` | `detectSwings()`, `detectStructure()`, `detectFvg()`, `detectOrderBlocks()`, `score()` | Skor 0-10 (7 kriteria berbobot) | Bridge `getNativeCandles()` → kemungkinan TIDAK langsung dipanggil untuk analisis |

**Pertanyaan kritis:**
- [ ] Apakah `MappingLogicCore.kt` benar-benar dipanggil dari mana saja, atau hanya tersedia sebagai library?
- [ ] Apakah `index.html` punya bridge call ke `evaluateMapping()` / `evaluateMappingAsync()` yang tidak ditemukan di `MainActivity.kt`?
- [ ] Jika kedua engine berjalan independen, apakah hasilnya konsisten?
- [ ] Data class `MappingLogicCore.Candle` ≠ `CandleStore.Candle` — di mana konversi terjadi?

### 5.3 Titik Kritis yang Harus Diverifikasi di Setiap Tahap

| Tahap | Pertanyaan Audit | File Referensi |
|-------|-----------------|---------------|
| API Key save | Key disimpan ke `localStorage` (`twelve_api_key`). Di native: `SecurePrefs` + `SharedPreferences` (`AmyFXPrefs`, key `api_key`). Apakah konsisten? | `index.html` L368, `MainActivity.kt` L622-624 |
| WebSocket connect | JS WebSocket (`connect()` L107) dan ScannerService WebSocket (`connectSocket()` L117) — dua koneksi terpisah ke URL yang sama. Apakah keduanya subscribe XAU/USD? | `index.html` L107, `ScannerService.kt` L122 |
| Candle fetch | JS fetch 300 candle via REST API Twelve Data (`fetchTf()` L102). Native fetch via `SupabaseCandleClient` (Supabase). Sumber data berbeda! | `index.html` L102, `SupabaseCandleClient.kt` |
| Analysis JS | `analyze()` JS menjalankan full ICT analysis: swings, structure, FVG, OB, liquidity, setups. Scoring 0-100 | `index.html` L101 |
| Setup detection | 5 tipe setup: OB, FVG, Liquidity Sweep, Structure, Displacement Candle | `index.html` L100 (`buildSetups()`) |
| Target ke native | `sendTargetsToNative()` mengirim entry area (upper/lower) atau BSL/SSL ke native scanner | `index.html` L106 |
| Scanner monitoring | ScannerService HANYA membandingkan harga vs BSL/SSL target — BUKAN menjalankan analisis | `ScannerService.kt` L158 |
| Notification gate | Multi-layer: JS cooldown (5 min per key) → JS guard IIFE (rate limit per kind) → Native `AmyFxNotificationGate.shouldNotify()` (5 min cooldown) | Multiple files |
| UI update | `render()` dan `renderSoft()` di JS update semua kartu. `renderAnalyzeLive()` update spesifik | `index.html` L339-340 |

---

## 6. Checklist Audit Dashboard

### 6.1 Struktur UI Dashboard

- [ ] Verifikasi tab Dashboard (id `tab-dashboard` atau equivalent) terdaftar di navigasi bottom (L77) dan bisa diakses
- [ ] Verifikasi bahwa Dashboard adalah tab default saat aplikasi dibuka (cek `state.tab` initialization)
- [ ] Verifikasi fungsi `dashboard()` (L109) me-render semua elemen berikut:
  - [ ] Hero card: judul XAU/USD, waktu WIB (via `nowTime()`), harga gold (`state.price`), status koneksi
  - [ ] ICT Killzone panel (via `killzonePanel()` L87): 7 sesi (Asian, London Judas, London Open, NY Judas, NY Open, Silver Bullet, Swing)
  - [ ] Tombol "⚡ Analisis Setup" yang navigasi ke Analyze tab
  - [ ] Best Setup card (dari `state.result?.setups` array pertama) atau placeholder "Belum ada setup"
  - [ ] Market Concepts grid: Final Bias, Structure, OB, FVG, Liquidity, Best Setup

### 6.2 Data Loading Dashboard

- [ ] Verifikasi inisialisasi state saat page load:
  - [ ] `state.key` diambil dari `localStorage.getItem('twelve_api_key')`
  - [ ] `state.price` diambil dari `localStorage.getItem('last_price')` sebagai fallback
  - [ ] `state.logs`, `state.analyses`, `state.setups` di-restore dari localStorage
  - [ ] Snapshot state di-restore dari `amyfx.mapping.last.state` (SyncFix module L375+)
- [ ] Verifikasi bahwa data Dashboard saat pertama buka:
  - [ ] Jika ada snapshot cache → tampilkan cache data dengan indikator "CACHE"
  - [ ] Jika tidak ada cache → tampilkan state kosong yang informatif
- [ ] Verifikasi `autoConnectLivePrice()` dipanggil 600ms setelah page load (L372 setTimeout)
- [ ] Verifikasi bahwa setelah WebSocket connected dan `runAnalysis()` pertama selesai, semua kartu Dashboard diupdate dengan data fresh

### 6.3 Killzone Panel

- [ ] Verifikasi `sessions()` (L85) mengembalikan 7 sesi ICT dengan waktu WIB yang benar
- [ ] Verifikasi `curSession()` (L86) mengembalikan sesi yang sedang aktif, atau `{name:'Off-Session'}`
- [ ] Verifikasi killzone panel menunjukkan status active/inactive per sesi
- [ ] Verifikasi `timeRange()` (L84) menghitung UTC start/end dengan benar berdasarkan timezone

### 6.4 Hal yang Perlu Diverifikasi

- [ ] Apakah ada kondisi dimana Dashboard menampilkan data lama tanpa indikator "CACHE"?
- [ ] Apakah Market Concepts grid menampilkan `undefined` atau `null` jika `state.result` belum ada?
- [ ] Apakah tombol "⚡ Analisis Setup" langsung menjalankan analisis, atau hanya navigasi ke tab?
- [ ] Apakah `syncClock()` (interval 1 detik) mengupdate jam WIB di hero card?
- [ ] Apakah `renderSoft()` (L340) cukup untuk update harga tanpa full render?

---

## 7. Checklist Audit Analyze

### 7.1 Form Analisis

- [ ] Verifikasi tab Analyze bisa diakses dari navigasi
- [ ] Verifikasi `analyzeView()` (L327) me-render:
  - [ ] TF grid: 8 tombol (M1, M5, M15, M30, H1, H4, D1, W1)
  - [ ] Setiap tombol memiliki `onclick` yang memanggil `runAnalysis('M5')`, dll (L329)
  - [ ] TF yang sedang aktif ditandai secara visual
- [ ] Verifikasi TF selector menu ("⋮" button, L640) dan default TF setting:
  - [ ] `amyfx.selected.tf` di localStorage
  - [ ] `amyfx.default.tf` di localStorage

### 7.2 Proses Analisis (`runAnalysis()`)

- [ ] Verifikasi `runAnalysis(tf)` (L103) mengeksekusi langkah berikut:
  1. [ ] Fetch candle data via `fetchTf(tf)` (L102) — REST GET ke Twelve Data API, 300 candle
  2. [ ] Fetch semua TF di `tfGroup(tf)` (L98) — misalnya M5 → [M5, M15, H1, H4]
  3. [ ] Fetch scan group M1-H4 untuk mini-analysis
  4. [ ] Jalankan `analyze(candles, tf, htfBiases)` (L101) — engine analisis utama
  5. [ ] Simpan hasil ke `state.result`, `state.setups`, `state.analyses`
  6. [ ] Panggil `sendTargetsToNative()` (L106) — kirim BSL/SSL ke native scanner
  7. [ ] Panggil `notifyImportant(result)` (L105) — notifikasi jika score ≥ 70
  8. [ ] Panggil `render()` — update semua UI
- [ ] Verifikasi error handling jika `fetchTf()` gagal (network error)
- [ ] Verifikasi `state.candles[tf]` di-cache setelah fetch

### 7.3 Engine Analisis JavaScript (`analyze()`)

- [ ] Verifikasi `analyze(candles, tf, htfBiases)` (L101) menjalankan:
  - [ ] `swings(candles, left, right)` (L94) — default lookback 3 bars kiri/kanan
  - [ ] `detectStructure(candles, swings)` (L95) — BOS dan CHOCH detection
  - [ ] `detectFvg(candles)` (L96) — FVG detection, filter body size ≥ ATR*0.55, return last 8
  - [ ] `detectOB(candles, structure)` (L97) — Order Block: last opposite candle before structure break
  - [ ] Perhitungan: BSL, SSL, Equilibrium, Premium/Discount zone
  - [ ] Penggabungan TF bias + HTF biases → final bias
  - [ ] `buildSetups()` (L100) → 5 tipe setup, sorted by score descending
- [ ] Verifikasi return object dari `analyze()` memiliki field lengkap untuk semua kartu UI

### 7.4 Tampilan Hasil Analisis

- [ ] Verifikasi AMY FX Decision card di-render (detail di Section 8)
- [ ] Verifikasi Valid Break Info card di-render (detail di Section 9)
- [ ] Verifikasi M1-H4 Mapping Table di-render (detail di Section 10)
- [ ] Verifikasi AI Mapping Notes di-render (detail di Section 10)
- [ ] Verifikasi ICT Output Cards di-render via `ict-output-cards.js` → `AmyICTCards.render()`
- [ ] Verifikasi MTF Confluence di-render via `mtf-confluence.js` → `AmyMappingMTF.render()`
- [ ] Verifikasi loading state ditampilkan saat analisis berjalan
- [ ] Verifikasi error state ditampilkan jika analisis gagal

### 7.5 Debounced Re-analysis

- [ ] Verifikasi bahwa WebSocket `onmessage` (L107) menjalankan `runAnalysis()` secara debounced setiap 15 detik via `scanTimer`
- [ ] Verifikasi tidak ada race condition antara debounced re-analysis dan manual klik tombol TF
- [ ] Verifikasi bahwa `renderAnalyzeLive()` (L181) hanya re-render jika tab aktif adalah Analyze

### 7.6 Hal yang Perlu Diverifikasi

- [ ] Apakah `fetchTf()` menggunakan API key yang sama dengan WebSocket connection?
- [ ] Apakah `fetchTf()` rate-limited oleh Twelve Data? (Free plan: 8 requests/minute)
- [ ] Apakah scan semua TF (M1-H4 + tfGroup) dalam satu `runAnalysis()` bisa melebihi rate limit?
- [ ] Apakah analisis pada W1 dan D1 menghasilkan data bermakna (butuh candle historis)?
- [ ] Apakah `htfBiases` benar-benar diteruskan ke `analyze()` dan digunakan?

---

## 8. Checklist Audit AMY FX Decision

### 8.1 Logika Decision di JavaScript (`decisionData()`)

- [ ] Verifikasi fungsi `decisionData()` (L187) ada dan dipanggil oleh `amyDecisionCard()` (L234)
- [ ] Verifikasi `decisionData()` menghitung:
  - [ ] `direction` — berdasarkan setup terbaik dan structure bias
  - [ ] `confidence` — persentase (0-100%)
  - [ ] Adjustment: +8 jika bias aligned, -12 jika conflict
  - [ ] `status` — READY SETUP / WATCH SETUP / WAIT
  - [ ] `entry` — entry area
  - [ ] `invalidation` — level invalidasi
  - [ ] `target` — target level
  - [ ] `reason` — alasan keputusan

### 8.2 Logika Decision di Kotlin (`MappingLogicCore.kt`)

- [ ] Verifikasi apakah `MappingLogicCore.kt` punya fungsi `generateDecision()` — **dari analisis kode: TIDAK ADA fungsi ini**
- [ ] Verifikasi apakah `score()` function (skala 10, 7 kriteria) digunakan dari mana saja
- [ ] Verifikasi apakah Kotlin engine dipakai untuk decision, atau hanya JS engine yang aktif

### 8.3 Tampilan Decision di UI

- [ ] Verifikasi `amyDecisionCard()` (L234) menampilkan:
  - [ ] Direction label: `fmtDir()` (L112) → FOKUS BUY / FOKUS SELL / TUNGGU
  - [ ] Active Bias: BULLISH / BEARISH / MIXED / NEUTRAL (dari `activeBias()` L139)
  - [ ] Confidence persentase
  - [ ] Status: `fmtStatus()` (L116) → SETUP VALID / PANTAU SETUP / TUNGGU
  - [ ] Entry Area, Invalidation, Target, Reason
- [ ] Verifikasi warna/class CSS: `dirClass()` (L120) → 'buy' / 'sell' / 'wait'
- [ ] Verifikasi kartu berubah setiap kali analisis baru dijalankan

### 8.4 Hal yang Perlu Diverifikasi

- [ ] Apakah confidence adjustment (+8/-12) proporsional atau terlalu besar/kecil?
- [ ] Apakah `activeBias()` (L139) threshold: bull≥bear+2 → BULLISH, bear≥bull+2 → BEARISH, cukup akurat?
- [ ] Apakah ada edge case dimana confidence > 100% atau < 0%?
- [ ] Apakah `decisionData()` return `null`/`undefined` jika `state.result` belum ada?
- [ ] Apakah `entry`, `invalidation`, `target` menampilkan harga dalam format yang benar (2 desimal via `p2()`)?

---

## 9. Checklist Audit Valid Break Info

### 9.1 Logika Break Detection

- [ ] Verifikasi `validBreakInfo()` (L247) membaca dari `state.result`:
  - [ ] Break level (last BOS/CHOCH dari `detectStructure()`)
  - [ ] Candle close (candle yang melakukan break)
  - [ ] Live price (`state.price` atau `analyzeLivePrice()` L150)
  - [ ] Structure type: BOS atau CHOCH
- [ ] Verifikasi `detectStructure()` (L95) di JS:
  - [ ] BOS: break searah tren (continuation)
  - [ ] CHOCH: break melawan tren (reversal)
  - [ ] Memerlukan displacement (body > threshold)
- [ ] Verifikasi `detectStructure()` di `MappingLogicCore.kt`:
  - [ ] Displacement multiplier: 1.2× ATR (L95 Kotlin)
  - [ ] Deteksi BOS dan CHOCH — **MSS enum ada tapi tidak pernah dihasilkan** (potential dead code)

### 9.2 Logika Conclusion

- [ ] Verifikasi `validBreakInfo()` menentukan conclusion berdasarkan:
  - [ ] **VALID BREAK**: Harga sudah melampaui break level secara signifikan
  - [ ] **BREAK FAILED**: Harga kembali di bawah/atas break level (invalidasi)
  - [ ] **LIVE BREAK WARNING**: Harga sedang di area break level
  - [ ] **BELUM VALID**: Belum ada break terdeteksi
- [ ] Verifikasi setiap conclusion ditampilkan dengan warna/style yang berbeda

### 9.3 Tampilan Valid Break Info di UI

- [ ] Verifikasi kartu menampilkan:
  - [ ] Break level (harga numerik)
  - [ ] Candle close (harga penutupan candle break)
  - [ ] Live price (harga real-time)
  - [ ] Structure type label (BOS/CHOCH)
  - [ ] Conclusion badge
- [ ] Verifikasi kartu kosong/informatif jika tidak ada break terdeteksi

### 9.4 Hal yang Perlu Diverifikasi

- [ ] Apakah swing detection JS (lookback 3) berbeda dari Kotlin (lookback 5)? Ini bisa menghasilkan break yang berbeda
- [ ] Apakah break validation menggunakan close price atau high/low price?
- [ ] Apakah "LIVE BREAK WARNING" berkedip atau punya animasi untuk menarik perhatian?
- [ ] Apakah conclusion update otomatis saat harga berubah, atau hanya saat `render()`?
- [ ] Apakah `analyzeLivePrice()` (L150) bisa return `undefined`?

---

## 10. Checklist Audit Amy FX Mapping Explanation

### 10.1 AI Mapping Notes (`aiMappingExplanation()`)

- [ ] Verifikasi fungsi `aiMappingExplanation()` (L295) ada dan dipanggil dari `analyzeView()` (L327)
- [ ] Verifikasi explanation mencakup:
  - [ ] Current mapping state (trend direction)
  - [ ] Entry area (range harga)
  - [ ] Liquidity levels (BSL/SSL)
  - [ ] Invalidation level
  - [ ] Target level
  - [ ] Kesimpulan (apakah setup valid, pantau, atau tunggu)
  - [ ] Live setup state (dari `analyzeSetupLiveState()` L153)
- [ ] Verifikasi teks ditulis dalam bahasa Indonesia

### 10.2 M1-H4 Mapping Table (`m1h4MappingTable()`)

- [ ] Verifikasi fungsi `m1h4MappingTable()` (L277) me-render tabel HTML dengan kolom:
  - [ ] TF (timeframe)
  - [ ] Bias (BULLISH/BEARISH/NEUTRAL)
  - [ ] BSL (Buy-Side Liquidity level)
  - [ ] SSL (Sell-Side Liquidity level)
  - [ ] OB (Order Block ada/tidak)
  - [ ] FVG (Fair Value Gap ada/tidak)
  - [ ] Status
- [ ] Verifikasi data tabel berasal dari `m1h4List()` (L136) → `mapMini(tf)` (L124) per TF
- [ ] Verifikasi `mapMini(tf)` menggunakan cached candles dari `state.candles[tf]`

### 10.3 Hal yang Perlu Diverifikasi

- [ ] Apakah `aiMappingExplanation()` menghasilkan teks yang bervariasi berdasarkan kondisi, bukan template statis?
- [ ] Apakah teks explanation mengandung data spesifik (harga, level) dari analisis aktual?
- [ ] Apakah M1-H4 Table menampilkan data untuk semua 6 TF (M1, M5, M15, M30, H1, H4)?
- [ ] Apakah kolom tabel bisa menampilkan "N/A" atau "-" jika data belum tersedia?
- [ ] Apakah `mapMini(tf)` bisa crash jika `state.candles[tf]` belum diisi?

---

## 11. Checklist Audit Setup Aktif

### 11.1 Setup Detection di JavaScript (`buildSetups()`)

- [ ] Verifikasi `buildSetups(candles, tf, ctx)` (L100) mendeteksi 5 tipe setup:
  - [ ] **Order Block setup** — harga mendekati OB
  - [ ] **FVG setup** — harga mendekati FVG
  - [ ] **Liquidity Sweep setup** — harga menembus BSL/SSL
  - [ ] **Structure setup** — BOS/CHOCH baru terjadi
  - [ ] **Displacement Candle setup** — candle displacement kuat
- [ ] Verifikasi `setupObj()` (L99) membuat object setup dengan field:
  - [ ] `type`, `direction`, `tf`, `score` (0-100)
  - [ ] `entry`, `sl`, `tp1`, `tp2`, `reason`
  - [ ] `status`: READY (≥70), WATCH (≥55), WAIT (<55)
- [ ] Verifikasi setups di-sort by score descending

### 11.2 Setup Scoring

- [ ] Verifikasi scoring di JS `buildSetups()`:
  - [ ] Rentang skor: 0-100
  - [ ] Faktor yang mempengaruhi skor (verifikasi per tipe setup)
  - [ ] Apakah scoring mempertimbangkan HTF bias alignment?
- [ ] Bandingkan dengan scoring di `MappingLogicCore.score()` (Kotlin):
  - [ ] Rentang skor: 0-10
  - [ ] 7 kriteria: HTF Bias (2), Fresh FVG (2), Fresh OB (2), Liquidity (1), Premium/Discount (1), Confirmation (1), RR (1)
  - [ ] **Skala berbeda!** JS 0-100 vs Kotlin 0-10

### 11.3 Live Setup Validation

- [ ] Verifikasi `analyzeSetupLiveState(s)` (L153) mengecek:
  - [ ] Harga hit SL → `fatal: true` (INVALID)
  - [ ] Harga hit TP → status update
  - [ ] Harga di entry area → status "in entry"
  - [ ] Harga menunggu entry → status "waiting"
- [ ] Verifikasi `analyzeActiveSetups(list)` (L178) memfilter setup yang `fatal = true`
- [ ] Verifikasi filtered list digunakan untuk render Setup Aktif section

### 11.4 Penyimpanan Setup

- [ ] Verifikasi `save()` (L90) menyimpan `state.setups` ke `localStorage` key `amy_mapping_setups` (max 50 entries)
- [ ] Verifikasi setup di-load ulang saat page reload dari localStorage

### 11.5 Tampilan Setup Aktif di UI

- [ ] Verifikasi section Setup Aktif di Analyze tab (L328-334):
  - [ ] Menampilkan list setup dari `analyzeActiveSetups()`
  - [ ] Setiap setup di-render via `setupCard(s, i)` (L108)
  - [ ] `setupCard()` menampilkan: nomor, tipe, TF, status, direction badge, score, harga, entry area, SL, TP1, TP2, reason
- [ ] Verifikasi placeholder: "Belum ada setup aktif yang aman. Tunggu mapping baru."
- [ ] Verifikasi tab Setups (L336) menampilkan last 20 historical setups

### 11.6 Cached Setup DOM (SyncFix)

- [ ] Verifikasi SyncFix module menyimpan DOM Setup Aktif ke `amyfx.mapping.last.setup.dom` di localStorage
- [ ] Verifikasi cached DOM di-restore saat page load jika data fresh belum tersedia
- [ ] Verifikasi cached DOM menampilkan badge "CACHE" untuk menandai data lama

### 11.7 Hal yang Perlu Diverifikasi

- [ ] Apakah setup dari sesi trading sebelumnya (kemarin) masih tampil sebagai aktif?
- [ ] Apakah ada mekanisme expiry untuk setup (berdasarkan waktu)?
- [ ] Apakah live price validation (`analyzeSetupLiveState()`) mempertimbangkan spread/slippage?
- [ ] Apakah `state.setups` bisa menumpuk tanpa batas sebelum `save()` memotong ke 50?
- [ ] Apakah cached Setup DOM bisa menampilkan setup yang sudah INVALID sebagai AKTIF?

---

## 12. Checklist Audit Save & Connect API

### 12.1 Proses Save API Key

- [ ] Verifikasi di `index.html`: input field `#apiKey` ada di Settings tab (L338)
- [ ] Verifikasi tombol "🔑 Save & Connect" ada dan `onclick` memanggil `saveConnect()` (L368)
- [ ] Verifikasi `saveConnect()`:
  1. [ ] Baca value dari `#apiKey` input
  2. [ ] Simpan ke `localStorage` key `twelve_api_key`
  3. [ ] Panggil `connect()` — buat WebSocket connection
  4. [ ] Panggil `sendTargetsToNative()` — kirim target ke native scanner
- [ ] Verifikasi `connect()` (L107):
  - [ ] Baca key dari localStorage (bukan dari parameter)
  - [ ] Validasi key tidak kosong
  - [ ] Close WebSocket yang ada sebelumnya
  - [ ] Buat WebSocket baru ke `wss://ws.twelvedata.com/v1/quotes/price?apikey=KEY`

### 12.2 Proses Save API Key ke Native

- [ ] Verifikasi `startBackgroundScanner(apiKey, bsl, ssl)` (L609 `MainActivity.kt`):
  - [ ] Validasi key: trim, reject jika blank/"undefined"/"null"
  - [ ] Simpan ke `SharedPreferences("AmyFXPrefs")` key `api_key`
  - [ ] Simpan ke `SecurePrefs` key `api_key`
  - [ ] Set `scanner_enabled = true`
- [ ] Verifikasi key flow:
  - [ ] JS save ke `localStorage` key `twelve_api_key`
  - [ ] JS kirim ke native via `Android.startBackgroundScanner(apiKey, ...)`
  - [ ] Native save ke `SharedPreferences` key `api_key` dan `SecurePrefs` key `api_key`

### 12.3 Proses Load API Key

- [ ] Verifikasi saat `index.html` load:
  - [ ] `state.key = localStorage.getItem('twelve_api_key')`
  - [ ] Key ditampilkan di input field `#apiKey`
- [ ] Verifikasi `autoConnectLivePrice()` (L355):
  - [ ] Cek apakah key ada
  - [ ] Cek apakah WebSocket belum connected (`!wsLiveAlive()`)
  - [ ] Auto-connect jika key ada dan WS belum alive
- [ ] Verifikasi **TIDAK ada** `@JavascriptInterface` method `getApiKey()` di `MainActivity.kt` — key retrieval hanya via localStorage

### 12.4 Feedback ke User

- [ ] Verifikasi status "Connected" / "Cache" / "Offline" ditampilkan di UI (`syncHeader()`)
- [ ] Verifikasi info text: "API key disimpan lokal di HP"
- [ ] Verifikasi error handling jika key invalid (WebSocket gagal connect)

### 12.5 Hal yang Perlu Diverifikasi

- [ ] Apakah key di `localStorage` (`twelve_api_key`) dan di `SharedPreferences` (`api_key`) bisa out-of-sync? User ubah key di JS, tapi native scanner masih pakai key lama
- [ ] Apakah `sendTargetsToNative()` memicu save key baru ke native, atau hanya kirim target BSL/SSL?
- [ ] Apakah API key terekspose di logcat via `Log.d()`?
- [ ] Apakah ada flow untuk menghapus/mengganti API key?
- [ ] Apakah save key tanpa connect (tanpa klik Save & Connect) dimungkinkan?

---

## 13. Checklist Audit Live Price WebSocket

### 13.1 WebSocket di JavaScript (`connect()`)

- [ ] Verifikasi `connect()` (L107):
  - [ ] URL: `wss://ws.twelvedata.com/v1/quotes/price?apikey=KEY`
  - [ ] `onopen`: Set `state.conn='Connected'`, subscribe `XAU/USD`, log, trigger `runAnalysis()`
  - [ ] `onmessage`: Parse JSON, validasi price 1000-10000, update `state.price`, save `last_price` ke LS, save `last_ws_tick_at`, panggil `renderAnalyzeLive()`, debounce 15s → `runAnalysis()`
  - [ ] `onclose`: Set `state.conn='Offline'`, auto-reconnect setelah 8 detik
  - [ ] `onerror`: Log "WebSocket error"

### 13.2 WebSocket di ScannerService (`connectSocket()`)

- [ ] Verifikasi `connectSocket()` (L117 `ScannerService.kt`):
  - [ ] URL: `wss://ws.twelvedata.com/v1/quotes/price?apikey=KEY`
  - [ ] OkHttp WebSocket client dengan 30s ping interval
  - [ ] `onOpen`: Reset `lastTickAt`, reset `reconnectAttempt`, cancel `reconnectJob`, subscribe `XAU/USD`, send info notification
  - [ ] `onMessage`: Parse JSON, extract `price`, update `lastPrice`+`lastTickAt`, panggil `checkTargets(price)`
  - [ ] `onFailure`/`onClosed`: `scheduleReconnect()` dengan guard terhadap stale socket dan manual close

### 13.3 Dua WebSocket Paralel

- [ ] Verifikasi bahwa **dua WebSocket connection** berjalan bersamaan:
  - [ ] JS WebSocket (di browser WebView) — untuk live price UI dan trigger re-analysis
  - [ ] Native WebSocket (di ScannerService) — untuk BSL/SSL target monitoring
- [ ] Verifikasi keduanya subscribe ke `XAU/USD`
- [ ] Verifikasi Twelve Data API mengizinkan dua concurrent WebSocket connection dengan API key yang sama

### 13.4 Reconnection Logic

**JS Reconnect:**
- [ ] Verifikasi auto-reconnect setelah 8 detik pada `onclose`
- [ ] Verifikasi `livePriceWatchdog()` (L360): setiap 30 detik, cek apakah last tick > 60 detik lalu → force reconnect

**Native Reconnect:**
- [ ] Verifikasi `scheduleReconnect()` (L205 `ScannerService.kt`):
  - [ ] Exponential backoff: 15s → 30s → 60s → 120s → 300s → 600s (cap)
  - [ ] Pada attempt 6+, kirim info notification ke user
  - [ ] Guard: tidak schedule jika reconnect job sudah aktif
- [ ] Verifikasi watchdog (L225): setiap 60s, jika no tick > 120s → force reconnect

### 13.5 Update UI Live Price

- [ ] Verifikasi `renderSoft()` (L340) hanya update connection status dan price display (ringan)
- [ ] Verifikasi `renderAnalyzeLive()` (L181) re-render jika tab aktif Analyze, else `renderSoft()`
- [ ] Verifikasi format harga: `p2(price)` → 2 desimal

### 13.6 Hal yang Perlu Diverifikasi

- [ ] Apakah dua WebSocket connection menghabiskan 2x kuota API Twelve Data?
- [ ] Apakah JS reconnect (fixed 8s) bisa menyebabkan reconnect storm?
- [ ] Apakah ada mekanisme disconnect saat app di-pause/minimize? (Cek `visibilitychange` handler)
- [ ] Apakah `state.price` di JS dan `lastPrice` di Kotlin bisa sangat berbeda (karena timing)?
- [ ] Apakah validasi price 1000-10000 di JS terlalu ketat? (XAU/USD pernah > 2800)
- [ ] Apakah `last_ws_tick_at` di localStorage dipakai untuk menentukan data freshness?

---

## 14. Checklist Audit Background Scanner ON/OFF

### 14.1 Toggle Scanner di UI

- [ ] Verifikasi toggle button ada di Settings tab (L338)
- [ ] Verifikasi UI state: gold button "📡 Background Scanner ON" vs dim chip "📴 Background Scanner OFF"
- [ ] Verifikasi `toggleBg()` (L369):
  - [ ] Flip `state.bg`
  - [ ] Simpan ke `localStorage` key `bg_scanner` (true/false string)
  - [ ] Jika ON: panggil `sendTargetsToNative()` → `Android.startBackgroundScanner(key, upper, lower)`
  - [ ] Jika OFF: panggil `Android?.stopBackgroundScanner?.()`

### 14.2 Start Scanner (ON) — Native Side

- [ ] Verifikasi `startBackgroundScanner()` (L609 `MainActivity.kt`):
  - [ ] Cek permission `POST_NOTIFICATIONS` (L610)
  - [ ] Validasi API key (reject blank/"undefined"/"null")
  - [ ] Simpan key ke `SharedPreferences` + `SecurePrefs` (L622-624)
  - [ ] Clean dan simpan BSL/SSL targets ke SharedPreferences (L626-637)
  - [ ] Buat Intent dengan extras `bsl` dan `ssl`
  - [ ] Android O+: `startForegroundService(intent)`, else: `startService(intent)` (L641-647)
- [ ] Verifikasi `ScannerService.onStartCommand()` (L47):
  - [ ] Cek action `STOP_SCANNER` → stop self
  - [ ] Set `scanner_enabled = true`
  - [ ] Load API key dari `SecurePrefs` → fallback `SharedPreferences` → auto-migrate legacy key (L78-85)
  - [ ] Load BSL/SSL targets dari intent extras atau SharedPreferences
  - [ ] Create notification channels (3 channels: foreground, target alert, info)
  - [ ] `connectSocket()` → WebSocket connection
  - [ ] `startWatchdog()` → timer 60s
  - [ ] Return `START_STICKY`

### 14.3 Stop Scanner (OFF) — Native Side

- [ ] Verifikasi `stopBackgroundScanner()` (L654 `MainActivity.kt`):
  - [ ] Set `scanner_enabled = false` di SharedPreferences
  - [ ] Kirim intent dengan `action = "STOP_SCANNER"` ke ScannerService
- [ ] Verifikasi `ScannerService` handle `STOP_SCANNER` action (L47-53):
  - [ ] Set `scanner_enabled = false`
  - [ ] `stopSocket()` — close WebSocket
  - [ ] `stopForeground(true)` — hapus foreground notification
  - [ ] `stopSelf()` — terminate service
  - [ ] Return `START_NOT_STICKY`

### 14.4 Target Management

- [ ] Verifikasi `sendTargetsToNative()` (L106 `index.html`):
  - [ ] Mengirim entry area upper/lower ATAU BSL/SSL level
  - [ ] Panggil `Android.startBackgroundScanner(apiKey, upper, lower)`
  - [ ] **Setiap kali analisis baru selesai**, targets diupdate ke native
- [ ] Verifikasi target persistence di ScannerService:
  - [ ] `scanner_bsl_target`, `scanner_ssl_target` di SharedPreferences
  - [ ] `scanner_target_updated_at` — timestamp
  - [ ] Target expiry: 24 jam (`TARGET_EXPIRY_MS`) — setelah 24 jam, targets dihapus otomatis (L158)

### 14.5 Target Checking Logic (Inti Scanner)

- [ ] Verifikasi `checkTargets(price)` (L158 `ScannerService.kt`):
  - [ ] Cek target expiry (>24h → `clearTargets()`)
  - [ ] **BSL (upper)**: `price >= setupUpper AND KEY_UPPER_ARMED == true` → fire alert, disarm
  - [ ] **SSL (lower)**: `price <= setupLower AND KEY_LOWER_ARMED == true` → fire alert, disarm
  - [ ] **Re-arm BSL**: `price < setupUpper - RESET_DISTANCE (0.50)` → re-arm
  - [ ] **Re-arm SSL**: `price > setupLower + RESET_DISTANCE (0.50)` → re-arm
  - [ ] `PRICE_EPSILON = 0.01` untuk float comparison

### 14.6 Scanner Persistence

- [ ] Verifikasi `START_STICKY` memastikan Android restart service jika killed
- [ ] Verifikasi `BootReceiver.kt`:
  - [ ] Terdaftar di manifest untuk `BOOT_COMPLETED`, `LOCKED_BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `QUICKBOOT_POWERON`
  - [ ] Hanya start scanner jika `scanner_enabled == true` di SharedPreferences
- [ ] Verifikasi scanner state di-sync ke UI saat app dibuka:
  - [ ] `onResume` atau `onNewIntent` membaca state dan sync ke WebView

### 14.7 Foreground Notification (Persistent)

- [ ] Verifikasi `startStatusNotification()` (L239):
  - [ ] Channel: `amyfx_scanner_foreground` (LOW importance, silent)
  - [ ] Shows: XAU/USD live price + active target levels
  - [ ] Ongoing, not dismissible
  - [ ] PendingIntent → Dashboard route

### 14.8 Hal yang Perlu Diverifikasi

- [ ] Apakah `sendTargetsToNative()` di-panggil setiap `runAnalysis()` selesai? Jika ya, scanner target berubah setiap 15 detik — apakah ini intended?
- [ ] Apakah target BSL/SSL dari Mapping UI dan dari native scanner selalu sinkron?
- [ ] Apakah `RESET_DISTANCE = 0.50` (USD) terlalu kecil untuk volatilitas XAU/USD yang bisa bergerak $20-50 per hari?
- [ ] Apakah scanner membedakan target entry area vs BSL/SSL? Atau keduanya diperlakukan sama?
- [ ] Apakah service benar-benar berhenti saat user toggle OFF? (Verifikasi tidak ada ghost service)
- [ ] Apakah scanner berjalan saat market tutup (weekend)?
- [ ] Apakah `KEY_UPPER_ARMED` / `KEY_LOWER_ARMED` di-persist ke SharedPreferences?
- [ ] Apakah auto-stop API key null/blank (L65-70) benar bekerja jika `SecurePrefs` error?

---

## 15. Checklist Audit Notification

### 15.1 Notification Channels

- [ ] Verifikasi channels dibuat di `MainActivity.onCreate()`:
  - [ ] Channel: `amy_heads_up_v5`, Importance HIGH, vibration, LED green — untuk notifikasi dari UI bridge
- [ ] Verifikasi channels dibuat di `ScannerService`:
  - [ ] Channel: `amyfx_scanner_foreground`, Importance LOW — persistent status
  - [ ] Channel: `amyfx_target_alert`, Importance HIGH, vibration, LED — BSL/SSL alerts
  - [ ] Channel: `amyfx_info`, Importance DEFAULT — connection status

### 15.2 Multi-Layer Notification Filtering

Ada **4 layer** filtering notifikasi yang perlu diverifikasi:

#### Layer 1: JS Cooldown (`notifyImportant()` L105)
- [ ] Hanya fire jika best setup score ≥ 70
- [ ] Cooldown 5 menit per unique setup key (type+direction+rounded entry+rounded SL)
- [ ] Tracking via `state.notified` → persisted ke `amy_mapping_notified` localStorage

#### Layer 2: JS Notification Guard IIFE (`index.html` L793-897)
- [ ] Wraps `window.Notification` constructor
- [ ] Rate-limit per kind:
  - [ ] `scanner_connected` / `scanner_alive`: 10 menit
  - [ ] `setup_alert`: 2 menit
  - [ ] `bsl_ssl_touched`: 1 menit
  - [ ] Default: 90 detik
- [ ] Normalizes title/body (replace numbers → `#`) untuk dedup
- [ ] Tracking via `amyfx.notify.last.sent` localStorage (max 120 items)
- [ ] Wraps native bridge objects: `Android`, `AndroidBridge`, `AmyFX`, `AmyFx`, `Native`, `NotificationBridge`, `AppBridge`
- [ ] Re-wraps semua bridges setiap 1.5 detik

#### Layer 3: Service Worker Guard (`sw.js` L81-205)
- [ ] Cooldown 5 menit untuk notifikasi identik
- [ ] Resume mute 9 detik setelah kembali ke app
- [ ] Max tracking 80 keys
- [ ] Wraps same bridge objects

#### Layer 4: Native `AmyFxNotificationGate` (`AmyFxNotificationGate.java`)
- [ ] `shouldNotify(context, rawKey, createdAt)`:
  - [ ] Normalize key (strip numbers)
  - [ ] Stale check: signal > 2 menit → discard
  - [ ] Cooldown check: 5 menit per key (SharedPreferences)
- [ ] `stableId(rawKey, fallback)` → deterministic notification ID:
  - [ ] `scanner_connected` → 7101
  - [ ] `scanner_alive` → 7102
  - [ ] `liquidity` → 7103
  - [ ] `ssl`/`bsl` → 7104
  - [ ] Others → `hashCode % 500 + 7200`

### 15.3 Notification dari UI Bridge

- [ ] Verifikasi `showNotificationWithUrl()` (L724 `MainActivity.kt`):
  - [ ] `AmyFxNotificationGate.routeFor(title, message)` → routing ke tab
  - [ ] PendingIntent → `MainActivity` dengan `target_url` + `amyfx_route` extras
  - [ ] `FLAG_ACTIVITY_SINGLE_TOP | FLAG_ACTIVITY_CLEAR_TOP`
  - [ ] Channel: `amy_heads_up_v5`
  - [ ] Vibrate pattern: `[0, 500, 250, 500]`
  - [ ] `CATEGORY_ALARM`, `PRIORITY_MAX`, `VISIBILITY_PUBLIC`, auto-cancel
  - [ ] Gate key: `"webview|title|message"`
  - [ ] Dedup via `AmyFxNotificationGate.shouldNotify()`

### 15.4 Notification dari ScannerService

- [ ] Verifikasi `sendAlert()` (L280+ `ScannerService.kt`):
  - [ ] Channel: `amyfx_target_alert`
  - [ ] Gate check: `AmyFxNotificationGate.shouldNotify()`
  - [ ] PendingIntent → route `Analyze` (deep link ke mapping analysis)
  - [ ] High priority, vibration, auto-cancel
- [ ] Verifikasi `sendInfo()` (L320+ `ScannerService.kt`):
  - [ ] Channel: `amyfx_info`
  - [ ] Gate check: `AmyFxNotificationGate.shouldNotify()`
  - [ ] PendingIntent → route `Dashboard`

### 15.5 Alert Cooldown (ScannerService)

- [ ] Verifikasi `maybeSendTargetAlert()` (L196):
  - [ ] `ALERT_COOLDOWN_MS = 30 menit` per level key (misalnya `notify_cooldown_BSL_2650.00`)
  - [ ] Cek SharedPreferences untuk last-fired timestamp
  - [ ] Update timestamp setelah alert dikirim
- [ ] Verifikasi interaksi antara:
  - [ ] ScannerService cooldown (30 menit per level)
  - [ ] `AmyFxNotificationGate` cooldown (5 menit per normalized key)
  - [ ] Mana yang lebih ketat? (30 menit scanner > 5 menit gate)

### 15.6 Permission

- [ ] Verifikasi `POST_NOTIFICATIONS` diminta di Android 13+ (API 33):
  - [ ] `maybeRequestNotificationPermission()` di `MainActivity`
  - [ ] `hasRequiredPermissions()` di `startBackgroundScanner()`
- [ ] Verifikasi handling jika permission ditolak:
  - [ ] `startBackgroundScanner()` return early tanpa start service
  - [ ] Toast ditampilkan ke user

### 15.7 Deep Link / Route

- [ ] Verifikasi notification tap → `MainActivity` → `applyAmyFxRoute()` (L539):
  - [ ] Read `amyfx_route` dari intent extras
  - [ ] Whitelist valid routes: "Dashboard", "Analyze", "Setups", "History", "Settings"
  - [ ] Set `localStorage.setItem('amyfx.notification.route', route)` + `setTab(route)` di JS
- [ ] Verifikasi `routeFor()` di `AmyFxNotificationGate.java`:
  - [ ] "liquidity"/"ssl"/"bsl" → "Analyze"
  - [ ] "scanner" → "Dashboard"
  - [ ] Default → "Analyze"

### 15.8 Hal yang Perlu Diverifikasi

- [ ] Apakah 4 layer filtering bisa menyebabkan notifikasi penting TIDAK pernah sampai ke user? (Over-filtering)
- [ ] Apakah Layer 2 (JS Guard IIFE) dan Layer 3 (SW Guard) memiliki duplikasi kode? (Keduanya wrap bridges setiap 1.5 detik)
- [ ] Apakah `PendingIntent` menggunakan `FLAG_IMMUTABLE` di semua tempat? (Wajib Android 12+):
  - [ ] `contentIntent()` di `AmyFxNotificationGate.java` → handle API 23+ FLAG_IMMUTABLE ✓
  - [ ] `showNotificationWithUrl()` di `MainActivity.kt` → perlu verifikasi
  - [ ] Alert/Info di `ScannerService.kt` → perlu verifikasi
- [ ] Apakah notification ID statis (`7101`, `7104`, dll) menyebabkan overwrite?
- [ ] Apakah `stableId()` parameter `fallback` benar-benar unused (dead code)?
- [ ] Apakah `normalize(rawKey)` yang strip numbers bisa menyebabkan key collision? ("BUY EURUSD 1.2345" ≡ "BUY EURUSD 1.9999")
- [ ] Apakah resume mute 9 detik (Layer 3) menyebabkan notifikasi hilang saat user buka app?

---

## 16. Checklist Audit Navigation Tab

### 16.1 Struktur Tab

- [ ] Verifikasi bottom navigation (L77) memiliki 5 tab:
  - [ ] Dashboard (▥)
  - [ ] Analyze (〽)
  - [ ] Setups (◎)
  - [ ] History (◷)
  - [ ] Settings (⚙)
- [ ] Verifikasi masing-masing tab terhubung ke fungsi render yang benar:
  - [ ] Dashboard → `dashboard()` (L109)
  - [ ] Analyze → `analyzeView()` (L327)
  - [ ] Setups → `setupsView()` (L336)
  - [ ] History → `history()` (L337)
  - [ ] Settings → `settings()` (L338)

### 16.2 Fungsi Switching

- [ ] Verifikasi `setTab(t)` (L351):
  - [ ] Mengubah `state.tab` ke tab baru
  - [ ] Memanggil `render()` untuk full re-render
- [ ] Verifikasi click handler (L372):
  - [ ] Event listener pada `.nav button` elements
  - [ ] Membaca `b.dataset.tab` untuk menentukan tab target
- [ ] Verifikasi `render()` (L339):
  - [ ] Update active state visual pada nav buttons
  - [ ] Update connection status display
  - [ ] Swap main content berdasarkan `state.tab`

### 16.3 Deep Link Navigation

- [ ] Verifikasi `applyAmyFxRoute()` (L341):
  - [ ] Baca route dari: URL hash, query param, atau `localStorage` key `amyfx.notification.route`
  - [ ] Set tab sesuai route
  - [ ] Hapus route dari localStorage setelah diapply
- [ ] Verifikasi deep link `amyfx://mapping` di AndroidManifest:
  - [ ] Schema: `amyfx`, host: `mapping`

### 16.4 Home Button (Native → Hub)

- [ ] Verifikasi `injectHomeButtonForLocalModule()` (`MainActivity.kt` L489-513):
  - [ ] Jika URL mengandung `/apps/` → inject floating "← Amy FX" button
  - [ ] Klik button → `Android.goHome()` → load `file:///android_asset/index.html` (hub)
- [ ] Verifikasi `goHome()` `@JavascriptInterface` (L566):
  - [ ] Navigate WebView ke `file:///android_asset/index.html`

### 16.5 Hal yang Perlu Diverifikasi

- [ ] Apakah back button Android berinteraksi dengan tab navigation? (Cek `onBackPressed()` di `MainActivity`)
- [ ] Apakah state form di Analyze (TF terpilih) hilang saat pindah tab lalu kembali?
- [ ] Apakah pindah tab memicu `runAnalysis()` yang tidak perlu?
- [ ] Apakah "← Amy FX" home button bisa diakses dari Mapping module?
- [ ] Apakah `applyAmyFxRoute()` bisa menyebabkan infinite loop jika route invalid?
- [ ] Apakah TF selector state (`amyfx.selected.tf`) di-persist antar tab switch?

---

## 17. Checklist Audit Cache/localStorage Agar Data Lama Tidak Tampil Sebagai Data Baru

### 17.1 Inventarisasi localStorage di JavaScript

| # | Key | Format | Sumber | Max Items | Dipakai Oleh |
|---|-----|--------|--------|-----------|-------------|
| 1 | `twelve_api_key` | String | User input | 1 | `connect()`, `saveConnect()`, state init |
| 2 | `last_price` | String(number) | WebSocket onmessage | 1 | Fallback price display |
| 3 | `last_ws_tick_at` | String(number) | WebSocket onmessage | 1 | Staleness detection, watchdog |
| 4 | `amy_mapping_logs` | JSON array | `log()`, `save()` | 200 | History tab |
| 5 | `amy_mapping_analyses` | JSON array | `save()` | 80 | Analisis cache |
| 6 | `amy_mapping_setups` | JSON array | `save()` | 50 | Setup history |
| 7 | `bg_scanner` | String("true"/"false") | `toggleBg()` | 1 | Scanner state |
| 8 | `amy_mapping_notified` | JSON object | `notifyImportant()` | - | Notification cooldown tracker |
| 9 | `amyfx.selected.tf` | String | TF button click | 1 | Selected timeframe |
| 10 | `amyfx.default.tf` | String | TF menu setting | 1 | Default timeframe |
| 11 | `amyfx.mapping.last.state` | JSON | SyncFix snapshot | 1 | Full state restore |
| 12 | `amyfx.mapping.last.setup.dom` | HTML string | SyncFix saveSetupDom | 1 | Cached Setup Aktif card DOM |
| 13 | `amyfx.notify.last.sent` | JSON object | Notify guard | 120 | Rate-limit tracking |
| 14 | `amyfx.notification.route` | String | Notification click | 1 | Deep link route |
| 15 | `amy_journal_drafts` | JSON array | ICT card "Copy to Jurnal" | 50 | Jurnal draft (cross-module) |

### 17.2 Timestamp Freshness per Data

- [ ] Verifikasi `last_ws_tick_at` digunakan oleh `livePriceWatchdog()` (30s interval) untuk deteksi stale (>60s)
- [ ] Verifikasi `amyfx.mapping.last.state` memiliki timestamp untuk freshness check
- [ ] Verifikasi setiap entry di `amy_mapping_analyses` dan `amy_mapping_setups` memiliki timestamp
- [ ] Verifikasi `amy_mapping_notified` — kapan entries expired/dihapus?

### 17.3 CandleStore SQLite (Native)

- [ ] Verifikasi tabel `candles` di SQLite (`CandleStore.kt`):
  - [ ] Schema: symbol, timeframe, open_time, close_time, open, high, low, close, volume_tick, is_closed
  - [ ] Primary key: `(symbol, timeframe, open_time)`
  - [ ] Indices: `(symbol, timeframe, open_time)` dan `(timeframe, open_time)`
- [ ] Verifikasi retention policy (`cleanupExpiredCandles()`):
  - [ ] M1-M30: 90 hari
  - [ ] H1, H4, D1: 365 hari (1 tahun)
- [ ] Verifikasi `trim()` membatasi jumlah candle per pair/TF (minimum keep: 100)
- [ ] Verifikasi `getStorageSizeBytes()` tersedia untuk monitoring

### 17.4 JS Candle Cache (`state.candles`)

- [ ] Verifikasi `state.candles[tf]` diisi oleh `fetchTf()` (L102)
- [ ] Verifikasi apakah `state.candles` di-persist ke `amyfx.mapping.last.state`
- [ ] Verifikasi kapan `state.candles` dihapus/invalidated
- [ ] Verifikasi apakah `mapMini(tf)` (L124) bisa menggunakan candle lama dari `state.candles` tanpa re-fetch

### 17.5 Service Worker Cache (`sw.js`)

- [ ] Verifikasi cache name: `xauusd-ict-v2`
- [ ] Verifikasi caching strategy:
  - [ ] GET requests: cache-first
  - [ ] **Bypass cache untuk `twelvedata.com`** → data live selalu fresh ✓
- [ ] Verifikasi `activate` event menghapus cache lama (non-matching name)
- [ ] Verifikasi `skipWaiting()` dipanggil pada install

### 17.6 SharedPreferences (Native)

| # | Pref File | Key | Format | Dipakai Oleh |
|---|-----------|-----|--------|-------------|
| 1 | AmyFXPrefs | `api_key` | String | `startBackgroundScanner()`, ScannerService |
| 2 | AmyFXPrefs | `scanner_enabled` | Boolean | Scanner state |
| 3 | AmyFXPrefs | `scanner_bsl_target` | String(number) | BSL target |
| 4 | AmyFXPrefs | `scanner_ssl_target` | String(number) | SSL target |
| 5 | AmyFXPrefs | `scanner_target_updated_at` | Long | Target timestamp |
| 6 | SecurePrefs | `api_key` | Encrypted String | SecurePrefs via EncryptedSharedPreferences |
| 7 | (notification gate) | `notify_cooldown_*` | Long (timestamp) | Alert cooldown per level |

### 17.7 Risiko Data Lama Tampil Sebagai Data Baru

- [ ] **Risiko #1**: `amyfx.mapping.last.state` snapshot di-restore saat page load → semua kartu Dashboard/Analyze menampilkan data dari sesi terakhir. Apakah ada indikator "CACHE" di SEMUA kartu, atau hanya Setup Aktif?
- [ ] **Risiko #2**: `amy_mapping_setups` (max 50) berisi setup dari hari-hari sebelumnya → ditampilkan di Setups tab tanpa filter tanggal
- [ ] **Risiko #3**: `last_price` di localStorage → Dashboard hero card menampilkan harga lama sebelum WebSocket connect
- [ ] **Risiko #4**: `state.candles[tf]` berisi candle dari fetch sebelumnya → `mapMini(tf)` analisis data lama
- [ ] **Risiko #5**: SyncFix `restoreSetupDom()` restore cached HTML → Setup Aktif card menampilkan setup yang sudah INVALID
- [ ] **Risiko #6**: `amy_mapping_analyses` (max 80) — apakah analisis lama ditampilkan di tempat tertentu?
- [ ] **Risiko #7**: CandleStore SQLite retention 90-365 hari — sangat lama, tapi `fetchTf()` REST fetch fresh data. Masalah hanya jika `getNativeCandles()` dipakai untuk analisis

### 17.8 Hal yang Perlu Diverifikasi

- [ ] Apakah setiap data cached yang ditampilkan di UI ada label waktu "Terakhir diupdate: ..."?
- [ ] Apakah ada tombol "Force Refresh" / "Clear Cache" di UI?
- [ ] Apakah `clearWebViewCache()` (`@JavascriptInterface` L696) membersihkan localStorage juga?
- [ ] Apakah `amyfx.mapping.last.state` dihapus setelah data fresh tersedia?
- [ ] Apakah badge "CACHE" di Setup Aktif DOM cukup visible untuk user?

---

## 18. Checklist Audit Build GitHub Actions

### 18.1 Inventarisasi Workflow

| # | File | Trigger | Tipe Build | Artifact |
|---|------|---------|-----------|---------|
| 1 | `build-apk.yml` | Push main, manual | Debug + debug keystore | `Amy-FX-debug-apk` |
| 2 | `build-debug.yml` | Push develop, PR to develop/main, manual | Debug | `Amy-FX-debug-apk` |
| 3 | `build-release.yml` | Manual only | Release + signing | `Amy-FX-release-apk` |
| 4 | `build.yml` | Push main, PR to main, manual | Debug | `Amy-FX-APK` |
| 5 | `lint-check.yml` | PR to develop/main, manual | Lint + Test + TODO check | None |
| 6 | `bootstrap-amyfx.yml` | Manual only | **DISABLED** | None |

### 18.2 Build Environment

- [ ] Verifikasi semua workflow menggunakan:
  - [ ] `ubuntu-latest`
  - [ ] JDK 17 (Temurin distribution)
  - [ ] Android SDK 35 + build-tools 35.0.0
- [ ] Verifikasi `app/build.gradle.kts`:
  - [ ] `compileSdk = 35`, `targetSdk = 35`, `minSdk = 24`
  - [ ] `versionCode = 12`, `versionName = "1.2.0"` (overridable via env vars)

### 18.3 Quality Gates

- [ ] Verifikasi `lint-check.yml`:
  - [ ] `lintDebug` — Android lint
  - [ ] `testDebugUnitTest` — unit tests
  - [ ] `grep -RIn "TODO" app/src/main` — fail jika ada TODO di production code
- [ ] Verifikasi apakah quality gate wajib (required status check) sebelum merge

### 18.4 Release Build

- [ ] Verifikasi `build-release.yml`:
  - [ ] Keystore dari secret `AMYFX_KEYSTORE_BASE64` (base64 decoded)
  - [ ] 4 signing env vars
  - [ ] Version: `AMYFX_VERSION_NAME=1.2.0`, `AMYFX_VERSION_CODE=12`
  - [ ] `assembleRelease` (bukan `assembleDebug`)

### 18.5 ProGuard / R8

- [ ] Verifikasi release build config:
  - [ ] `isMinifyEnabled = true` ✓
  - [ ] `isShrinkResources = true` ✓
  - [ ] ProGuard rules: `proguard-android-optimize.txt` + custom `proguard-rules.pro`
- [ ] Verifikasi `proguard-rules.pro`:
  - [ ] Keep `@JavascriptInterface` methods
  - [ ] Keep `WebAppInterface` class
  - [ ] Keep OkHttp classes (jika diperlukan)
  - [ ] Keep data classes yang di-serialize ke JSON

### 18.6 Sinkronisasi Versi

- [ ] Verifikasi konsistensi version:
  - [ ] `app/build.gradle.kts`: versionCode 12, versionName 1.2.0
  - [ ] `build-release.yml`: `AMYFX_VERSION_CODE=12`, `AMYFX_VERSION_NAME=1.2.0`
  - [ ] `update.json`: versionCode 12, version "1.2.0"
  - [ ] `CHANGELOG.md`: Version 1.2.0

### 18.7 Hal yang Perlu Diverifikasi

- [ ] Apakah `build-apk.yml` dan `build.yml` redundan? (Keduanya build debug pada push ke main)
- [ ] Apakah debug keystore yang di-create di `build-apk.yml` konsisten antar build?
- [ ] Apakah `proguard-rules.pro` cukup lengkap untuk menjaga WebView bridge?
- [ ] Apakah unit test yang ada di `lint-check.yml` mencakup `MappingLogicCore.kt`?
- [ ] Apakah build workflow terakhir berhasil? (Cek status badge/Actions tab)
- [ ] Apakah `bootstrap-amyfx.yml` disabled benar tidak bisa dijalankan manual?

---

## 19. Daftar Risiko Logika yang Harus Dicari

Setiap risiko harus diverifikasi dengan bukti kode, bukan asumsi. Tulis sebagai "hal yang perlu diverifikasi", bukan bug confirmed.

### 19.1 Risiko Arsitektur Dual Engine

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-01 | **Dua engine analisis independen** — JS (`index.html` L94-101) dan Kotlin (`MappingLogicCore.kt`). Scoring berbeda (JS: 0-100, Kotlin: 0-10). Algoritma deteksi bisa menghasilkan hasil berbeda | Inkonsistensi analisis, user bingung | `index.html`, `MappingLogicCore.kt` |
| R-02 | **Dua tipe Candle data class** — `MappingLogicCore.Candle` ≠ `CandleStore.Candle`. Mapping/konversi diperlukan di integration point. Jika salah mapping, analisis Kotlin menghasilkan data salah | Data analisis rusak | `MappingLogicCore.kt`, `CandleStore.kt` |
| R-03 | **`MappingLogicCore.kt` mungkin tidak pernah dipanggil** — Tidak ada `evaluateMapping` di `MainActivity.kt` bridge. Apakah kode ini dead code? | Engine Kotlin sia-sia | `MappingLogicCore.kt`, `MainActivity.kt` |
| R-04 | **`StructureEvent.Type.MSS` di Kotlin tidak pernah dihasilkan** — Enum value ada tapi `detectStructure()` hanya produce BOS dan CHOCH | Dead code / incomplete feature | `MappingLogicCore.kt` |

### 19.2 Risiko Bridge JS ↔ Native

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-05 | Bridge interface registered sebagai `window.Android` (L105 `MainActivity.kt`) — JS memanggil `window.Android.*`. Verify semua call dari JS ada handler-nya di native | Silent failure jika method tidak ada | `index.html`, `MainActivity.kt` |
| R-06 | JS memanggil `Android.startBackgroundScanner(key, bsl, ssl)` — method ini menerima 3 parameter String. Verify tipe dan format parameter match | Parse error, wrong target | `index.html` L106, `MainActivity.kt` L609 |
| R-07 | `getNativeCandles()` return JSON array string — verify JS pernah call ini dan parse benar | Unused bridge method atau parse error | `MainActivity.kt` L667 |
| R-08 | `showNotificationWithUrl()` menerima 3 parameter tapi `showNotification()` hanya 2 — JS harus call yang benar | Notification tanpa deep link | `MainActivity.kt` L719-724 |

### 19.3 Risiko Logika Analisis

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-09 | JS swing detection lookback 3 bar vs Kotlin lookback 5 bar — swing point berbeda, structure break berbeda | Analisis inkonsisten | `index.html` L94, `MappingLogicCore.kt` |
| R-10 | JS FVG filter body size ≥ ATR×0.55 — jika ATR salah dihitung, FVG terlalu banyak/sedikit | False signals | `index.html` L96 |
| R-11 | FVG detection formula di JS vs Kotlin — verify identik: bullish = `candle[i-2].high < candle[i].low` | Sinyal berbeda per engine | `index.html` L96, `MappingLogicCore.kt` |
| R-12 | `buildSetups()` score 0-100 — verify scoring formula tidak selalu menghasilkan skor yang sama | Decision tidak bermakna | `index.html` L100 |
| R-13 | `detectStructure()` di Kotlin bisa emit BOS DAN CHOCH untuk candle yang sama — jika close breaks both prior high and low | Double/confusing events | `MappingLogicCore.kt` |

### 19.4 Risiko Scanner

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-14 | Scanner HANYA monitor BSL/SSL price level — tidak jalankan analisis ICT di background | Scanner "bodoh" — hanya price alert, bukan smart scanner | `ScannerService.kt` L158 |
| R-15 | Target diupdate setiap `runAnalysis()` (tiap ~15 detik) — BSL/SSL bisa berubah sangat sering | Scanner target "bergoyang", alert tidak stabil | `index.html` L106 |
| R-16 | `RESET_DISTANCE = 0.50` untuk XAU/USD — gold bergerak $20-50/hari, $0.50 sangat kecil = re-arm terlalu cepat → alert spam | Notification berlebihan | `ScannerService.kt` |
| R-17 | Target expiry 24 jam — jika user tidak buka app 24 jam, scanner berhenti memonitor | Scanner "diam-diam mati" tanpa notification ke user | `ScannerService.kt` L158 |
| R-18 | Scanner subscribe XAU/USD only — jika app support multi-pair di masa depan, scanner belum siap | Scope terbatas | `ScannerService.kt` L122 |
| R-19 | `START_STICKY` + `BootReceiver` → scanner restart tanpa user knowledge jika crash | Background process tanpa consent | `ScannerService.kt`, `BootReceiver.kt` |

### 19.5 Risiko Notification

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-20 | **4 layer filtering** bisa over-block — notifikasi penting tidak pernah sampai ke user | User miss trading opportunity | Multiple files |
| R-21 | Layer 2 (JS Guard IIFE) dan Layer 3 (SW Guard) keduanya wrap bridges setiap 1.5 detik — race condition? | Double-wrap atau timing conflict | `index.html` L793+, `sw.js` L81+ |
| R-22 | `normalize(rawKey)` strip numbers — "BUY at 2650" ≡ "BUY at 2700" → same key → cooldown block | Alert untuk level berbeda diblokir | `AmyFxNotificationGate.java` |
| R-23 | `stableId()` parameter `fallback` tidak pernah digunakan — misleading API | Dead parameter | `AmyFxNotificationGate.java` |
| R-24 | Notification channel `amy_heads_up_v5` vs `amyfx_target_alert` — user mungkin disable satu, alert dari source lain tetap muncul | Confusing notification control | `MainActivity.kt`, `ScannerService.kt` |
| R-25 | Resume mute 9 detik di SW Guard — jika user buka app karena notification, notifikasi berikutnya di-mute | Missed alert window | `sw.js` L81+ |

### 19.6 Risiko Cache & Data

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-26 | State snapshot (`amyfx.mapping.last.state`) di-restore tanpa timestamp check — data bisa dari hari/minggu lalu | User salah keputusan trading | `index.html` SyncFix |
| R-27 | Cached Setup DOM restore (`amyfx.mapping.last.setup.dom`) — setup yang sudah invalid tampil sebagai aktif | Misleading trade recommendation | `index.html` SyncFix |
| R-28 | `CandleStore.onUpgrade()` menggunakan `CREATE TABLE IF NOT EXISTS` — schema migration tidak akan alter existing tables | Crash/data loss jika schema berubah | `CandleStore.kt` |
| R-29 | `SecurePrefs.prefs()` create MasterKey + EncryptedSharedPreferences pada setiap call — expensive crypto operation | Performance bottleneck | `SecurePrefs.kt` |
| R-30 | `CandleStore` upsert single tidak call `cleanupExpiredCandles()` tapi `upsertAll()` iya — inconsistent cleanup | Data retention tidak konsisten | `CandleStore.kt` |

### 19.7 Risiko Keamanan (Catatan Saja — Luar Scope Utama)

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-31 | Supabase anon key hardcoded di source code sebagai default | Key terekspose di APK decompilation | `SupabaseCandleClient.kt` |
| R-32 | API key di URL WebSocket (plain text) | Key terekspose di network log | `index.html` L107, `ScannerService.kt` L122 |
| R-33 | Supabase config di plain SharedPreferences, bukan SecurePrefs | Inkonsistensi keamanan | `SupabaseCandleClient.kt` |
| R-34 | `android:usesCleartextTraffic="false"` di manifest — BAIK, tapi verify OkHttp juga enforce HTTPS | | `AndroidManifest.xml` |

### 19.8 Risiko SessionClock

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-35 | Session gaps: 12:00-13:00 (DEAD_ZONE), 17:00-19:30 (DEAD_ZONE) — London-NY overlap window hilang | Miss trading opportunity di overlap | `SessionClock.kt` |
| R-36 | Hardcoded WIB (UTC+7) timezone — user di timezone lain harus pass zone explicit | Usability issue | `SessionClock.kt` |
| R-37 | DST (Daylight Saving Time) tidak ditangani — sesi off 1 jam di musim tertentu | Session detection salah | `SessionClock.kt` |

### 19.9 Risiko Code Quality (Minor)

| # | Risiko | Dampak | File Terkait |
|---|--------|--------|-------------|
| R-38 | `MemoryConstants.kt` hanya re-export Android constant — dead code | Bloat | `MemoryConstants.kt` |
| R-39 | `HashMap` dan `Map` import unused di `AmyFxNotificationGate.java` | Warning | `AmyFxNotificationGate.java` |
| R-40 | `MarketDataFallback.kt` menggabungkan retry logic + cache access — dua concern berbeda | Maintainability | `MarketDataFallback.kt` |

---

## 20. Format Laporan Hasil Audit Nanti

Setelah audit selesai, laporan hasil harus dibuat dengan format berikut:

### Nama File

```
docs/MAPPING_LOGIC_AUDIT_REPORT.md
```

### Struktur Laporan

```markdown
# LAPORAN AUDIT MODULE MAPPING — Amy FX

## Ringkasan Eksekutif
- Tanggal audit: YYYY-MM-DD
- Versi aplikasi: v1.2.0 (versionCode 12)
- Total item yang diaudit: __
- Item PASS: __
- Item FAIL: __
- Item PERLU INVESTIGASI LANJUT: __
- Severity distribusi: Critical __, High __, Medium __, Low __

## Hasil per Checklist Section

### [Section 6: Dashboard]

| # | Item Audit | Status | Bukti Kode (File:Line) | Catatan |
|---|-----------|--------|------------------------|---------|
| 6.1.1 | Tab Dashboard terdaftar | ✅ PASS / ❌ FAIL / ⚠️ VERIFY | index.html:L77 | ... |

### [Section 7: Analyze]
(Lanjutkan untuk semua section 6-18)

## Temuan Bug / Masalah

### [BUG-001] Judul Bug
- **Severity**: Critical / High / Medium / Low
- **File**: path/to/file (link)
- **Baris**: #xxx-#xxx
- **Deskripsi**: Penjelasan masalah
- **Bukti Kode**:
  ```kotlin
  // kode yang bermasalah
  ```
- **Dampak**: Apa yang terjadi jika bug ini terjadi di produksi
- **Rekomendasi Patch**: Deskripsi solusi (TANPA kode patch)

## Temuan Risiko Logika yang Terkonfirmasi

### [RISK-R01] Dual Engine Inkonsistensi
- **Konfirmasi**: Ya / Tidak / Partial
- **Probabilitas**: High / Medium / Low
- **Dampak**: High / Medium / Low
- **Bukti**: (file:line + penjelasan)
- **Langkah Mitigasi**: ...

## Dependency Audit Notes
- Supabase: ...
- Twelve Data API: ...
- EncryptedSharedPreferences: ...
- OkHttp: ...

## Rekomendasi Prioritas

### P0 — Wajib Diperbaiki Segera (Critical)
1. ...

### P1 — Harus di Release Berikutnya (High)
1. ...

### P2 — Dijadwalkan (Medium)
1. ...

### P3 — Backlog (Low)
1. ...
```

### Aturan Penulisan Laporan

- Setiap temuan harus punya **bukti kode** (file + nomor baris + snippet)
- Tidak boleh menyimpulkan "bug" tanpa bukti — gunakan ⚠️ VERIFY jika belum pasti
- Status hanya salah satu dari: ✅ PASS, ❌ FAIL, ⚠️ VERIFY
- Severity harus konsisten:
  - **Critical**: Data loss, crash, security breach, fungsi utama tidak bekerja sama sekali
  - **High**: Fungsi penting gagal di kondisi tertentu, data salah ditampilkan ke user
  - **Medium**: Edge case, inkonsistensi minor, potensi masalah di masa depan
  - **Low**: Code quality, minor UX issue, documentation gap, dead code

---

## 21. Aturan Patch Jika Nanti Ditemukan Bug

### Prinsip Dasar

1. **Satu patch per bug** — jangan gabungkan multiple fix dalam satu patch
2. **Patch harus minimal** — hanya ubah baris yang perlu diubah
3. **Jangan refactor saat patching** — tujuannya memperbaiki bug, bukan mempercantik kode
4. **Setiap patch harus bisa di-revert** tanpa merusak fitur lain
5. **Jangan sentuh kode yang berfungsi** — jika tidak rusak, jangan "perbaiki"

### Workflow Patch

```
1. Identifikasi bug dari Laporan Audit
   → Harus punya BUG-ID dari laporan
         │
         ▼
2. Buat branch: fix/[BUG-ID]-deskripsi-singkat
   Contoh: fix/BUG-003-stale-cache-badge
         │
         ▼
3. Tulis patch HANYA untuk file yang teridentifikasi di laporan
   → Tidak boleh edit file lain yang tidak related
         │
         ▼
4. Test manual:
   - Fungsi yang dipatch bekerja benar
   - 13 fitur wajib tetap ada (lihat Section 4)
   - Regression: fitur lain tidak terganggu
   - Test di device fisik (notifikasi, foreground service)
         │
         ▼
5. Buat patch notes (bisa di PR description):
   - Bug ID
   - File yang diubah + baris
   - Before/after behavior
   - Cara test/reproduksi
         │
         ▼
6. Review oleh user/maintainer sebelum merge
         │
         ▼
7. Merge ke main → CI build → tag version baru
   → Update versionCode sinkron di:
     - app/build.gradle.kts
     - build-release.yml
     - update.json
```

### Aturan Patch Spesifik

| Aturan | Penjelasan |
|--------|-----------|
| **Jangan hapus fitur** | Semua 13 fitur Mapping di Section 4 wajib tetap ada |
| **Jangan tambah fitur baru** | Patch hanya untuk fix, bukan enhancement |
| **Jangan ubah bridge interface** | `window.Android.*` method name dan parameter tidak boleh berubah |
| **Jangan ubah localStorage key** | Key yang sudah dipakai user tidak boleh berubah → data hilang |
| **Jangan ubah notification channel ID** | User setting notifikasi per-channel bisa hilang |
| **Jangan ubah SharedPreferences key** | Scanner state dan target bisa hilang |
| **Jangan ubah versionCode tanpa koordinasi** | Harus sinkron di 3 tempat (build.gradle, workflow, update.json) |
| **Backup file sebelum patch** | Pattern `.bak` sudah ada di repo, gunakan jika perlu |
| **Test di device fisik** | Emulator tidak reliable untuk notifikasi, foreground service, WebSocket |
| **Jangan ubah scoring formula tanpa review** | Score 0-100 threshold (READY≥70, WATCH≥55) mempengaruhi decision |

### Prioritas Patch

Urutan prioritas patch jika ditemukan multiple bug:

1. **P0 — Harus segera**: Crash, data loss, security issue, fungsi utama mati
2. **P1 — Harus di release berikutnya**: Fungsi penting gagal di kondisi tertentu, data salah
3. **P2 — Dijadwalkan**: Edge case, minor logic error, inkonsistensi
4. **P3 — Backlog**: Code quality, dead code, optimization, documentation

### Format Commit Message

```
fix(mapping): [BUG-ID] Deskripsi singkat

- Apa yang diubah (file dan fungsi)
- Kenapa diubah (root cause dari laporan audit)
- Dampak perubahan (behavior before → after)
- Cara test

Refs: docs/MAPPING_LOGIC_AUDIT_REPORT.md#BUG-ID
```

---

## Lampiran A: Dependency Graph Module Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                    MAPPING MODULE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  index.html (SPA, 901 baris, 57KB)                          │
│    ├── JS Analysis Engine (L94-101)                         │
│    │     ├── swings()          [Lookback 3]                 │
│    │     ├── detectStructure() [BOS/CHOCH]                  │
│    │     ├── detectFvg()       [ATR*0.55 filter]            │
│    │     ├── detectOB()        [Last opposite candle]       │
│    │     ├── buildSetups()     [5 tipe, score 0-100]        │
│    │     └── analyze()         [Master analysis]            │
│    ├── WebSocket Client (L107)                              │
│    │     └── wss://ws.twelvedata.com (XAU/USD)             │
│    ├── Notification Guard IIFE (L793-897)                   │
│    ├── SyncFix Module (L375-786)                            │
│    ├── ict-output-cards.js (ICT card renderer)              │
│    ├── mtf-confluence.js (MTF confluence)                   │
│    └── sw.js (Service Worker + Notify Guard)                │
│         └── Cache: xauusd-ict-v2 (bypass twelvedata.com)   │
│                                                              │
│    ═══════════ window.Android Bridge ═══════════            │
│                       │                                      │
│    MainActivity.kt (853 baris, 35KB)                        │
│    ├── WebAppInterface (inner class, L564-851)              │
│    │     ├── startBackgroundScanner(key, bsl, ssl)          │
│    │     ├── stopBackgroundScanner()                        │
│    │     ├── getNativeCandles(symbol, tf, limit)            │
│    │     ├── showNotificationWithUrl(title, body, url)      │
│    │     ├── getScannerHealth()                             │
│    │     ├── clearWebViewCache()                            │
│    │     └── goHome(), showAppToast(), triggerHaptic()      │
│    ├── Notification Channel: amy_heads_up_v5 (HIGH)         │
│    ├── Permission Gate (POST_NOTIFICATIONS, battery)        │
│    └── Home Button injection (/apps/ pages)                 │
│         │                                                    │
│    ┌────┴────┐                                               │
│    │         │                                               │
│  ScannerService.kt              MappingLogicCore.kt         │
│  (460 baris, 18KB)              (203 baris, 8.6KB)          │
│  ├── OkHttp WebSocket           ├── detectSwings() [LB=5]  │
│  │   └── XAU/USD only          ├── detectStructure()       │
│  ├── checkTargets(price)        ├── detectFvg()             │
│  │   ├── BSL check              ├── detectOrderBlocks()     │
│  │   ├── SSL check              └── score() [0-10, 7 crit] │
│  │   └── Arm/Disarm             ┌──────────────────────┐    │
│  ├── Cooldown 30min per level   │ NOTE: Candle types   │    │
│  ├── Target expiry 24h          │ MLC.Candle ≠ CS.Candle│   │
│  ├── Watchdog 60s/120s          │ Conversion needed!   │    │
│  ├── Reconnect backoff          └──────────────────────┘    │
│  │   15s→30s→60s→120s→300s→600s                             │
│  ├── Channels:                                               │
│  │   ├── amyfx_scanner_foreground (LOW)                     │
│  │   ├── amyfx_target_alert (HIGH)                          │
│  │   └── amyfx_info (DEFAULT)                               │
│  └── Deep link → Analyze tab                                │
│         │                                                    │
│    Shared Dependencies:                                      │
│    ├── AmyFxNotificationGate.java (dedup, routing, stableId)│
│    ├── CandleStore.kt (SQLite, retention 90d/365d)          │
│    ├── SecurePrefs.kt (AES256 encrypted prefs)              │
│    ├── MarketDataSyncAgent.kt (bootstrap, tick, gap fill)   │
│    ├── SupabaseCandleClient.kt (PostgREST, anon key)        │
│    ├── MarketDataFallback.kt (retry + cache accessor)       │
│    ├── SessionClock.kt (WIB sessions, gaps exist)           │
│    └── BootReceiver.kt (auto-start if scanner_enabled)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Lampiran B: Ringkasan Fakta Teknis

| Property | Value |
|----------|-------|
| App Name | Amy FX |
| Package | `com.amyelitesuite` |
| Version | 1.2.0 (code 12) |
| Min SDK | 24 (Android 7.0) |
| Target/Compile SDK | 35 (Android 15) |
| JDK | 17 |
| AGP | 8.2.0 |
| Kotlin | 1.9.0 |
| Architecture | Hybrid (Kotlin native + WebView local assets) |
| Primary Module | Mapping (XAU/USD ICT analysis) |
| Trading Instrument | XAU/USD (Gold) only |
| Data Source REST | Twelve Data API (300 candles per TF) |
| Data Source WebSocket | Twelve Data WebSocket (live XAU/USD price) |
| Data Source Fallback | Supabase PostgREST (candle data) |
| Local DB | SQLite (`CandleStore`, retention 90d-365d) |
| Crypto | EncryptedSharedPreferences (AES256_GCM + AES256_SIV) |
| CI/CD | GitHub Actions (5 workflows + 1 disabled) |
| Foreground Service | ScannerService (dataSync type) |
| Boot Receiver | BootReceiver (4 intents) |
| Deep Link | `amyfx://mapping` |
| Notification Channels | 4 total (1 Activity + 3 ScannerService) |
| Notification Filtering | 4 layers (JS cooldown → JS guard → SW guard → Native gate) |
| Analysis Engine Count | 2 (JS in index.html + Kotlin in MappingLogicCore.kt) |

---

> **Catatan Akhir:**  
> Dokumen ini adalah **rencana audit saja**. Tidak ada kode yang diubah, dipatch, atau di-refactor.  
> Semua temuan selama penyusunan plan ini ditulis sebagai "hal yang perlu diverifikasi" (⚠️) di setiap section checklist dan sebagai risiko (R-xx) di Section 19.  
> Audit aktual akan dilakukan langkah demi langkah mengikuti checklist di dokumen ini.  
> Plan ini dibuat berdasarkan analisis menyeluruh terhadap seluruh source code yang terdaftar di Section 3.
