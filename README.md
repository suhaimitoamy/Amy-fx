# Amy FX

Amy FX adalah aplikasi Android hybrid untuk analisis XAU/USD berbasis WebView lokal dan native Kotlin.

Aplikasi ini berfungsi sebagai alat bantu analisis, mapping, pemantauan level, jurnal, academy, dan library indikator. Amy FX bukan aplikasi eksekusi order otomatis dan bukan nasihat keuangan.

---

## Status Repo

Status saat ini: **stabilisasi fitur Mapping dan background scanner**.

Yang sudah tersedia:

- Android hybrid WebView + Kotlin native layer.
- Module Mapping untuk analisis XAU/USD.
- Dashboard Mapping.
- Analyze Mapping.
- AMY FX Decision.
- Valid Break Info.
- Amy FX Mapping Explanation.
- Setup Aktif.
- History / Event Logs.
- Settings & API.
- Save & Connect Twelve Data API.
- WebSocket live price XAU/USD.
- Background Scanner ON/OFF.
- Native foreground service untuk scanner.
- Notifikasi Android untuk setup dan target level.
- Deep link / route notifikasi ke Mapping.
- Jurnal trading.
- Academy lokal.
- Library indikator Pine Script.
- Candle cache lokal SQLite.
- Secure preferences untuk API key native.
- GitHub Actions build debug APK.

Yang belum dianggap final production:

- Release signing dengan keystore production asli.
- QA lengkap semua module.
- Integration test dan Espresso test lengkap.
- UI/UX final semua module.
- Store listing final untuk distribusi publik.

---

## Fokus Utama Saat Ini: Mapping

Module utama berada di:

```text
app/src/main/assets/apps/mapping/index.html
```

Mapping bertugas membaca data XAU/USD, membuat mapping market, menampilkan bias, setup, level, dan mengirim target ke native scanner.

Fitur penting Mapping:

- Live price XAU/USD via WebSocket Twelve Data.
- Auto-connect live price saat halaman Mapping dibuka jika API key sudah tersimpan.
- Timeframe: M1, M5, M15, M30, H1, H4, D1, W1.
- Multi-timeframe mapping M1 sampai H4.
- Detection dasar:
  - Swing High / Swing Low.
  - BOS / CHOCH.
  - Fair Value Gap.
  - Order Block.
  - Liquidity Sweep.
  - Displacement Candle.
- AMY FX Decision:
  - Active Bias.
  - Direction.
  - Confidence.
  - Status.
  - Entry Area.
  - Invalidation.
  - Target.
  - Reason.
- Valid Break Info:
  - Break Level.
  - Candle Break Close.
  - Harga Live.
  - Structure.
  - Kesimpulan break.
- Amy FX Mapping Explanation.
- Setup Aktif.
- Riwayat Setup.
- Event Logs.
- Settings & API.

Catatan penting: Mapping hanya memberi analisis dan level. Mapping tidak membuka posisi trading.

---

## Alur Mapping

```text
User buka Mapping
└── API key dibaca dari localStorage
    └── WebSocket live price auto-connect
        └── data candle diambil dari Twelve Data REST API
            └── analisis timeframe berjalan
                └── AMY FX Decision + Setup Aktif dibuat
                    └── target setup dikirim ke Android bridge
                        └── Background Scanner memantau level
                            └── notifikasi muncul saat target tersentuh
```

---

## Background Scanner

File native utama:

```text
app/src/main/java/com/amyelitesuite/ScannerService.kt
```

Scanner berjalan sebagai foreground service Android.

Tugas scanner:

- Menyimpan status scanner ON/OFF.
- Membaca API key dari SecurePrefs / SharedPreferences.
- Membaca target dari Mapping.
- Membuka WebSocket Twelve Data untuk XAU/USD.
- Memantau target atas dan bawah.
- Mengirim notifikasi saat target tersentuh.
- Menjalankan reconnect bertahap jika koneksi putus.
- Menghapus target lama jika expired.

Scanner tidak melakukan analisis utama. Analisis utama tetap berasal dari Mapping.

---

## Notification Flow

File terkait:

```text
app/src/main/java/com/amyelitesuite/AmyFxNotificationGate.java
app/src/main/java/com/amyelitesuite/MainActivity.kt
app/src/main/java/com/amyelitesuite/ScannerService.kt
```

Fungsi notifikasi:

- Menampilkan alert setup dari WebView.
- Menampilkan alert BSL/SSL dari scanner.
- Menampilkan info koneksi scanner.
- Membatasi spam notifikasi dengan cooldown gate.
- Tap notifikasi target diarahkan ke Mapping tab Analyze.
- Tap status scanner diarahkan ke Mapping tab Dashboard.

---

## Native Android Layer

Folder utama:

```text
app/src/main/java/com/amyelitesuite/
```

File penting:

```text
MainActivity.kt
ScannerService.kt
BootReceiver.kt
CandleStore.kt
SecurePrefs.kt
AmyFxNotificationGate.java
MappingLogicCore.kt
SupabaseCandleClient.kt
MarketDataSyncAgent.kt
UpdateChecker.kt
```

Tugas native layer:

- Host WebView lokal.
- JavaScript bridge `Android.*`.
- Foreground scanner service.
- Notification channel.
- Deep link / route ke Mapping.
- SQLite candle cache.
- Secure API key storage.
- File export/download.

Catatan: Supabase, SQLite, dan native bridge tidak boleh diubah jika bug tidak berhubungan langsung.

---

## WebView / Assets Layer

Folder module lokal:

```text
app/src/main/assets/apps/
├── mapping/
├── journal/
├── academy/
└── indikator/
```

Home utama aplikasi:

```text
app/src/main/assets/index.html
app/src/main/assets/app.js
```

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

## Build APK Lokal

```bash
chmod +x ./gradlew
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
```

Artifact debug:

```text
Amy-FX-APK
Amy-FX-debug-apk
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

---

## QA Focus

Saat audit aplikasi, prioritas pengecekan:

1. Mapping berjalan sesuai fungsi, bukan sekadar tampil.
2. Harga live benar-benar bergerak setelah API key tersimpan.
3. AMY FX Decision tidak memberi arah yang bertentangan dengan data internal.
4. Valid Break Info memakai candle break yang benar.
5. Setup Aktif tidak menampilkan setup lama sebagai setup baru.
6. Background Scanner hanya ON jika user mengaktifkan.
7. Scanner menerima target entry area yang benar.
8. Notifikasi tidak spam.
9. Tap notifikasi masuk ke tab yang sesuai.
10. Navigation tab tetap lengkap: Dashboard, Analyze, Setup, History, Settings.
11. Tidak ada fitur yang hilang setelah patch.
12. Build GitHub Actions tetap sukses.

---

## Aturan Perubahan Kode

Jika melakukan patch:

- Jangan hapus fitur apa pun.
- Jangan rollback kecuali diminta.
- Jangan ubah struktur besar.
- Jangan refactor besar.
- Jangan tambah fitur baru tanpa alasan bug.
- Fokus hanya bug nyata.
- Jika fitur bermasalah, perbaiki fiturnya, bukan dihapus.
- Jangan sentuh Supabase / SQLite / native bridge jika bug tidak berhubungan langsung.

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
