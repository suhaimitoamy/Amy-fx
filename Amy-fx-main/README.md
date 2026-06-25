# Amy FX

Amy FX adalah aplikasi Android hybrid untuk analisis XAU/USD berbasis WebView lokal + native Kotlin.

Fokus aplikasi:

- Mapping market ICT/SMC.
- Pemantauan target BSL/SSL lewat background scanner.
- Notifikasi Android untuk level penting.
- Jurnal trading.
- Academy lokal.
- Library indikator Pine Script.
- Candle cache lokal memakai SQLite.

> Amy FX bukan aplikasi eksekusi order otomatis dan bukan nasihat keuangan.

---

## Status Saat Ini

Status repo: **stabilisasi production build tahap awal**.

Yang sudah masuk repo:

- Target Android SDK 35.
- Build debug APK via GitHub Actions.
- `BuildConfig` generation aktif.
- R8 / ProGuard release config tersedia.
- WebView bridge Android ↔ JavaScript.
- Scanner foreground service.
- Cooldown notifikasi target.
- Expiry target Mapping.
- Reconnect scanner bertahap.
- SQLite candle cache cleanup.
- Secure preferences untuk API key.
- Core logic awal Mapping ICT.
- Unit test dasar Mapping.
- Dokumentasi `docs/`.
- `update.json` untuk metadata update.

Yang belum dianggap selesai penuh:

- Release signing production dengan keystore asli.
- In-app update checker aktif di UI.
- Jurnal trading lengkap + statistik lanjutan.
- UI/UX final semua module.
- Integration test dan Espresso test lengkap.
- Store listing final untuk distribusi publik.

---

## Struktur Repo

```text
Amy-fx/
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── assets/
│       │   │   ├── index.html
│       │   │   ├── app.js
│       │   │   └── apps/
│       │   │       ├── mapping/
│       │   │       ├── journal/
│       │   │       ├── academy/
│       │   │       └── indikator/
│       │   └── java/com/amyelitesuite/
│       └── test/
├── docs/
├── scripts/
├── .github/workflows/
├── CHANGELOG.md
├── update.json
└── README.md
```

---

## Native Android Layer

File utama:

```text
app/src/main/java/com/amyelitesuite/
├── MainActivity.kt
├── ScannerService.kt
├── BootReceiver.kt
├── CandleStore.kt
├── SecurePrefs.kt
├── MappingLogicCore.kt
├── SupabaseCandleClient.kt
├── MarketDataSyncAgent.kt
└── UpdateChecker.kt
```

Tugas native layer:

- Host WebView lokal.
- JavaScript bridge `Android.*`.
- Foreground scanner service.
- Notification channel.
- Deep link ke Mapping.
- SQLite candle cache.
- Secure API key storage.
- File export/download.

---

## WebView / Assets Layer

Module lokal berada di:

```text
app/src/main/assets/apps/
├── mapping/
├── journal/
├── academy/
└── indikator/
```

Shared asset tambahan:

```text
app/src/main/assets/apps/shared/
├── amyfx-common.js
└── amyfx-design-system.css
```

---

## Alur Mapping dan Scanner

```text
Mapping
└── menghasilkan target BSL/SSL
    └── target dikirim ke Android bridge
        └── ScannerService memantau live price XAU/USD
            └── notifikasi muncul jika target tersentuh
                └── tap notifikasi membuka Mapping
```

Scanner native hanya memantau target. Logic analisa utama tetap berasal dari Mapping.

---

## Fitur Scanner

- Foreground service.
- WebSocket TwelveData.
- Target BSL/SSL dari Mapping.
- Cooldown alert per level.
- Target expire otomatis.
- Reconnect bertahap.
- Notification channel terpisah.
- Deep link ke Mapping.

---

## Candle Storage

Candle cache memakai SQLite.

```text
Database: amy_market_data.sqlite
Table: candles
Primary key: symbol + timeframe + open_time
```

Fitur:

- Insert / update candle.
- Query candle terbaru.
- Index query.
- Cleanup candle lama.
- Clear cache.
- Storage size check.

---

## Mapping Logic Core

File:

```text
app/src/main/java/com/amyelitesuite/MappingLogicCore.kt
```

Isi awal:

- Swing high / swing low.
- BOS / CHOCH.
- FVG.
- Order Block.
- Setup score breakdown.

Unit test:

```text
app/src/test/java/com/amyelitesuite/
```

---

## Build APK Lokal

```bash
chmod +x gradlew
./gradlew assembleDebug --no-configuration-cache --stacktrace
```

Output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Catatan Termux:

Build lokal hanya bisa berjalan jika Android SDK sudah tersedia dan `ANDROID_HOME` atau `local.properties` sudah benar.

---

## Build APK via GitHub Actions

Workflow utama:

```text
.github/workflows/build-apk.yml
.github/workflows/build.yml
.github/workflows/build-debug.yml
.github/workflows/build-release.yml
.github/workflows/lint-check.yml
```

Artifact debug:

```text
Amy-FX-debug-apk
Amy-FX-APK
```

Release build bersifat manual sampai keystore signing production disiapkan.

---

## Android Config

Current config:

```text
compileSdk = 35
targetSdk = 35
minSdk = 24
versionName = 1.2.0
versionCode = 12
```

Permission utama:

- `INTERNET`
- `ACCESS_NETWORK_STATE`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_DATA_SYNC`
- `POST_NOTIFICATIONS`
- `WAKE_LOCK`
- `RECEIVE_BOOT_COMPLETED`
- `VIBRATE`
- Media read permission sesuai versi Android.

`MANAGE_EXTERNAL_STORAGE` tidak digunakan sebagai permission utama production.

---

## Dokumentasi

```text
docs/ARCHITECTURE.md
docs/API_SETUP.md
docs/RELEASE_GUIDE.md
docs/QA_CHECKLIST.md
docs/PRODUCTION_ROADMAP_STATUS.md
docs/PRIVACY_POLICY.md
docs/TERMS_OF_USE.md
docs/STORE_LISTING_DRAFT.md
```

---

## Repo Hygiene

File sementara tidak boleh masuk ke main branch:

```text
/apply-*.sh
/*.patch
/patch_apk.py
/fix-note.txt
/*_FIX_NOTES.md
/.amyfx_backup*
```

Aturan ini dicatat di `.gitignore`.

---

## Catatan Distribusi

Jangan distribusikan sebagai APK production publik sebelum:

- Release signing aktif dengan keystore asli.
- QA checklist selesai.
- Privacy Policy dan Terms final.
- Build release signed berhasil.
