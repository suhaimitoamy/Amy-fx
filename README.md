# Amy FX

Amy FX adalah aplikasi Android berbasis WebView lokal untuk analisis XAU/USD, mapping market, jurnal, academy, dan library indikator TradingView.

Aplikasi ini berfokus pada analisis, pemantauan market, pencatatan, dan penyimpanan tools dalam satu aplikasi Android.

## Status Project

Status saat ini: prototype Android trading suite.

Komponen utama:

- Dashboard utama Android berbasis WebView lokal.
- Module Mapping / AI Chart Analyzer untuk XAU/USD.
- Module Jurnal.
- Module Amy Trading Academy.
- Library indikator TradingView / Pine Script lokal.
- Background scanner native Android.
- WebSocket price scanner untuk XAU/USD.
- Notifikasi Android untuk target Mapping.
- Local candle storage memakai SQLite.
- Integrasi Supabase candle source.
- Build APK melalui Gradle dan GitHub Actions.

## Prinsip Arsitektur Analisa

Mapping adalah sumber utama analisa.

Scanner native tidak menjadi otak analisa utama. Scanner hanya menjadi pemantau background untuk target BSL / SSL yang dikirim dari Mapping.

```text
Mapping / AI Chart Analyzer
└── menghitung bias, score, BSL, SSL, OB, FVG, dan status
    └── mengirim target BSL / SSL ke Android
        └── ScannerService memantau live price XAU/USD
            └── notifikasi muncul saat target Mapping tersentuh
```

Dengan alur ini, dashboard Mapping dan alert background tidak berjalan dari dua engine analisa yang berbeda.

## Arsitektur Aplikasi

```text
Android Kotlin App
└── MainActivity
    └── WebView
        ├── app/src/main/assets/index.html
        ├── app/src/main/assets/app.js
        └── app/src/main/assets/apps/
            ├── mapping/
            ├── journal/
            ├── academy/
            └── indikator/
```

Bagian native Android:

```text
app/src/main/java/com/amyelitesuite/
├── MainActivity.kt
├── ScannerService.kt
├── BootReceiver.kt
├── CandleStore.kt
├── MarketDataSyncAgent.kt
└── SupabaseCandleClient.kt
```

## Module Lokal

```text
app/src/main/assets/apps/
├── mapping/      # Mapping market dan AI chart analyzer
├── journal/      # Jurnal
├── academy/      # Materi belajar
└── indikator/    # Library Pine Script / TradingView
```

## MainActivity

`MainActivity.kt` adalah wrapper utama Android.

Tugas utama:

- Membuka dashboard lokal dari `file:///android_asset/index.html`.
- Menjalankan WebView untuk semua module lokal.
- Menyediakan JavaScript bridge dengan nama `Android`.
- Mengatur file picker.
- Mengatur download file / blob dari WebView.
- Menampilkan permission center.
- Membuka permission settings Android.
- Menghubungkan WebView dengan native scanner.

JavaScript bridge menyediakan:

- `goHome()`
- `showAppToast()`
- `triggerHaptic()`
- `startBackgroundScanner()`
- `stopBackgroundScanner()`
- `getNativeCandles()`
- `showNotification()`
- `showNotificationWithUrl()`
- `saveBlob()`
- `startFile()` / `appendFileChunk()` / `finishFile()`

## Background Scanner

`ScannerService.kt` berjalan sebagai foreground service.

Tugas utama:

- Membaca API key dari `SharedPreferences`.
- Membaca target BSL dan SSL dari Mapping.
- Membuka WebSocket ke TwelveData.
- Subscribe live price `XAU/USD`.
- Mengecek apakah BSL / SSL dari Mapping sudah tersentuh.
- Mengirim notifikasi Android saat target tersentuh.
- Reconnect otomatis jika WebSocket mati.
- Watchdog jika tidak ada tick terlalu lama.

Scanner memakai:

```text
wss://ws.twelvedata.com/v1/quotes/price
```

Symbol utama:

```text
XAU/USD
```

## Logic Analisa Market

Logic analisa utama berada di module `mapping`.

Konsep yang dianalisa Mapping:

- Swing high / swing low
- BOS / CHOCH / MSS
- Fair Value Gap (FVG)
- Order Block (OB)
- Buy Side Liquidity (BSL)
- Sell Side Liquidity (SSL)
- Premium / Discount
- HTF bias
- Draw on Liquidity (DOL)
- Setup score

Scanner native tidak menghitung ulang bias, score, FVG, OB, atau struktur market. Scanner hanya mengikuti target dari Mapping.

## Candle Storage

Candle lokal disimpan memakai SQLite melalui `CandleStore.kt`.

```text
Database: amy_market_data.sqlite
Table: candles
Primary key: symbol + timeframe + open_time
```

Timeframe yang didukung:

```text
M1, M5, M15, M30, H1, H4, D1
```

## Supabase Candle Source

`SupabaseCandleClient.kt` dipakai sebagai sumber candle tambahan / fallback.

Endpoint:

```text
/rest/v1/candles
```

Filter utama:

- `symbol`
- `timeframe`
- `open_time`
- `limit`

## Mapping Module

Module Mapping berada di:

```text
app/src/main/assets/apps/mapping/
```

Fitur utama:

- Live price XAU/USD.
- Fetch candle dari TwelveData REST API.
- WebSocket live price.
- Multi-timeframe analysis.
- FVG detection.
- OB detection.
- BOS / CHOCH structure detection.
- BSL / SSL target.
- Premium / Discount zone.
- Setup score.
- History log.
- Terminal log.
- Background scanner toggle.
- Native notification test.

## Indikator Module

Module indikator berada di:

```text
app/src/main/assets/apps/indikator/
```

Daftar indikator:

```text
app/src/main/assets/apps/indikator/manifest.json
```

Fungsi utama:

- Menampilkan daftar Pine Script lokal.
- Membuka source code indikator lokal.
- Mencari indikator.
- Menyalin kode indikator.
- Menyimpan kode terpilih ke localStorage.

## Permission Android

Permission yang digunakan:

- `INTERNET`
- `ACCESS_NETWORK_STATE`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_DATA_SYNC`
- `POST_NOTIFICATIONS`
- `WAKE_LOCK`
- `RECEIVE_BOOT_COMPLETED`
- `VIBRATE`
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- `MANAGE_EXTERNAL_STORAGE`
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

## Auto Restart Scanner

`BootReceiver.kt` menjalankan ulang scanner setelah:

- HP reboot.
- Locked boot completed.
- App package replaced.
- Quick boot power on.

Scanner hanya dijalankan ulang jika:

- `scanner_enabled = true`
- API key tersedia di storage lokal.

## Build APK Lokal

```bash
chmod +x gradlew
./gradlew assembleDebug --no-configuration-cache --stacktrace
```

Output APK debug:

```text
app/build/outputs/apk/debug/
```

## Build APK via GitHub Actions

Workflow:

```text
.github/workflows/build-apk.yml
```

Trigger:

- Push ke branch `main`.
- Manual run melalui `workflow_dispatch`.

Artifact:

```text
Amy-FX-debug-apk
```

## Teknologi

- Kotlin
- Android SDK 34
- Android Gradle Plugin 8.2.0
- Kotlin Android Plugin 1.9.0
- WebView
- HTML / CSS / JavaScript
- OkHttp
- Kotlin Coroutines
- SQLite
- Supabase REST
- TwelveData REST API
- TwelveData WebSocket
- GitHub Actions

## Batasan Saat Ini

- Belum ada automated test.
- Belum ada unit test untuk logic market structure.
- Belum ada backtest engine di repo.
- App belum menggunakan release signing configuration.
