# Amy FX

Amy FX adalah aplikasi Android berbasis WebView lokal untuk analisis trading XAU/USD, mapping market, jurnal trading, academy, dan library indikator TradingView.

Aplikasi ini bukan bot eksekusi order otomatis. Fokus utamanya adalah membantu proses analisis, pemantauan market, pencatatan, dan penyimpanan tools trading dalam satu aplikasi Android.

## Status Project

Status saat ini: prototype Android trading suite.

Komponen yang sudah tersedia:

- Dashboard utama Android berbasis WebView lokal.
- Module Mapping / AI Chart Analyzer untuk XAU/USD.
- Module Jurnal Trading.
- Module Amy Trading Academy.
- Library indikator TradingView / Pine Script lokal.
- Background scanner native Android.
- WebSocket price scanner untuk XAU/USD.
- Notifikasi native Android untuk target dan market alert.
- Local candle storage memakai SQLite.
- Integrasi Supabase candle source.
- Build APK melalui Gradle dan GitHub Actions.

## Arsitektur Aplikasi

Struktur utama aplikasi:

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

Module lokal berada di:

```text
app/src/main/assets/apps/
├── mapping/      # Mapping market dan AI chart analyzer
├── journal/      # Jurnal trading
├── academy/      # Materi belajar trading
└── indikator/    # Library Pine Script / TradingView
```

## MainActivity

`MainActivity.kt` berfungsi sebagai wrapper utama Android.

Tugas utamanya:

- Membuka dashboard lokal dari `file:///android_asset/index.html`.
- Menjalankan WebView untuk semua module lokal.
- Mengaktifkan JavaScript dan DOM storage.
- Menyediakan JavaScript bridge dengan nama `Android`.
- Mengatur file picker.
- Mengatur download file / blob dari WebView.
- Menampilkan permission center.
- Membuka permission settings Android.
- Menghubungkan WebView dengan native scanner.

JavaScript bridge menyediakan fungsi native seperti:

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

`ScannerService.kt` adalah service native Android yang berjalan di background sebagai foreground service.

Fungsi utama:

- Membaca API key dari `SharedPreferences`.
- Membaca target BSL dan SSL.
- Membuka WebSocket ke TwelveData.
- Subscribe live price `XAU/USD`.
- Menyimpan tick menjadi candle lokal.
- Mengecek target BSL / SSL.
- Membuat market alert.
- Menghitung M15 bias.
- Menghitung HTF bias.
- Menghitung setup score.
- Mengirim notifikasi native Android.
- Melakukan reconnect otomatis jika WebSocket mati.
- Menjalankan watchdog jika tidak ada tick terlalu lama.

Scanner memakai:

```text
wss://ws.twelvedata.com/v1/quotes/price
```

Symbol utama:

```text
XAU/USD
```

## Logic Analisa Market

Aplikasi memiliki dua engine analisa:

1. Engine JavaScript di module `mapping`.
2. Engine native Kotlin di `ScannerService`.

Konsep yang dianalisa:

- Swing high / swing low
- BOS / CHOCH / MSS
- Fair Value Gap (FVG)
- Order Block (OB)
- Buy Side Liquidity (BSL)
- Sell Side Liquidity (SSL)
- Premium / Discount
- M15 bias
- HTF bias
- Draw on Liquidity (DOL)
- Market phase
- Setup score

Output analisa utama:

- `BUY WATCH`
- `SELL WATCH`
- `WAIT`
- `READY`

## Candle Storage

Candle lokal disimpan memakai SQLite melalui `CandleStore.kt`.

Database:

```text
amy_market_data.sqlite
```

Tabel utama:

```text
candles
```

Primary key:

```text
symbol + timeframe + open_time
```

Timeframe yang didukung:

```text
M1, M5, M15, M30, H1, H4, D1
```

## Supabase Candle Source

`SupabaseCandleClient.kt` dipakai sebagai sumber candle tambahan / fallback.

Data diambil dari endpoint REST Supabase:

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
- ICT / SMC style market reading.
- FVG detection.
- OB detection.
- BOS / CHOCH structure detection.
- BSL / SSL target.
- Premium / Discount zone.
- Setup score.
- Signal watch.
- History log.
- Terminal log.
- Background scanner toggle.
- Native notification test.

## Indikator Module

Module indikator berada di:

```text
app/src/main/assets/apps/indikator/
```

Daftar indikator disimpan di:

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

Permission yang digunakan aplikasi:

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

Catatan:

- Permission notifikasi adalah hard gate utama agar alert bisa muncul.
- Battery optimization dan manage all files bersifat pendukung.
- Scanner tetap melakukan pengecekan permission sebelum dijalankan.

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

Jalankan:

```bash
chmod +x gradlew
./gradlew assembleDebug --no-configuration-cache --stacktrace
```

Output APK debug berada di:

```text
app/build/outputs/apk/debug/
```

## Build APK via GitHub Actions

Workflow tersedia di:

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

## Catatan Validasi

Logic analisa market di project ini masih rule-based.

Sebelum dipakai sebagai dasar keputusan trading real, hasil sinyal perlu divalidasi memakai:

- Backtest historis.
- Forward test.
- Perbandingan hasil sinyal vs market real.
- Evaluasi win, loss, RR, drawdown, dan false signal.

## Catatan Keamanan

Project memakai WebView lokal dengan JavaScript bridge ke native Android. Karena itu, perubahan pada file HTML/JS lokal harus dilakukan dengan hati-hati.

Hal yang perlu diperhatikan:

- Jangan memuat script eksternal yang tidak dipercaya.
- Jangan membagikan API key pribadi.
- Jangan menyimpan secret penting langsung di source.
- Jangan mengaktifkan scanner tanpa memahami izin background Android.

## Batasan Saat Ini

- Belum ada automated test.
- Belum ada unit test untuk logic market structure.
- Belum ada backtest engine di repo.
- Engine analisa JavaScript dan Kotlin masih terpisah.
- Signal belum membuktikan akurasi statistik.
- App belum menggunakan release signing configuration.

## Disclaimer

Amy FX adalah alat bantu analisis dan pemantauan market. Aplikasi ini tidak menjamin profit dan tidak melakukan eksekusi order otomatis.
