# Amy FX

Amy FX adalah aplikasi Android hybrid untuk pemetaan, pemantauan, dan perencanaan eksekusi market **XAU/USD**. Antarmuka utama berjalan melalui WebView lokal, sedangkan harga live, notifikasi, penyimpanan, Firebase Messaging, pembaruan aplikasi, dan layanan market ditangani oleh Kotlin native serta backend Amy FX.

> **Kandidat produksi:** `2.3.0`  
> **Version code:** `58`  
> **Tujuan rilis:** kesetaraan engine dan fitur dengan Amy FX Preview

## Identitas Produksi

- **Nama aplikasi:** Amy FX
- **Application ID:** `com.amyelitesuite`
- **URI scheme:** `amyfx`
- **Minimum Android:** Android 8.0 / API 26
- **Target SDK:** Android SDK 35
- **Update manifest:** `main/update.json`
- **Rolling APK:** `AmyFX-latest.apk`
- **Release tag:** `amyfx-latest`
- **Signing:** sertifikat produksi permanen yang kompatibel dengan instalasi Amy FX sebelumnya

`main` merupakan sumber aplikasi dan rilis produksi. Runtime yang telah matang pada `personal/amyfx-private` dipromosikan secara terkontrol ke produksi, sedangkan package, URI, signing, update channel, APK, serta data pengguna produksi tetap dipertahankan.

Branch `personal/amyfx-private` tetap menjadi ruang pengembangan Amy FX Preview dan bukan sumber APK atau update channel produksi.

## Kesetaraan Amy FX Preview

Amy FX 2.3.0 membawa runtime terbaru Amy FX Preview ke produksi, meliputi:

- Mapping closed-candle runtime v5;
- rekonsiliasi Market State BT7.1;
- structural bias independen;
- Mapping Accuracy V3;
- Market Outlook dan Rencana Eksekusi;
- Entry Watch dan lifecycle resmi;
- Amy FX Scalper Engine pattern v3.0;
- Scalper Execution Authority dan decision bridge;
- permanent Scalper setup history;
- tampilan profesional dan render DOM stabil;
- Market Intelligence, Academy, Journal, dan Amy Mentor terbaru;
- native live-price bridge serta integrasi backend terbaru.

Kesetaraan berarti engine, logika, lifecycle, dan tampilan utama menggunakan implementasi Preview yang sama. Identitas platform tetap berbeda: Amy FX produksi tidak memakai package, URI, update manifest, APK, atau storage key milik Preview.

## Arsitektur Market Data

Amy FX memisahkan **harga live** dan **data candle analisis** agar harga tetap responsif tanpa membuat Mapping menghitung ulang pada setiap tick.

```text
Twelve Data WebSocket
        │
        └── Harga live XAU/USD di aplikasi

Gateway dan penyimpanan candle Amy FX
        │
        ├── Candle tertutup lintas timeframe
        ├── Mapping dan Market State
        ├── Rencana Eksekusi dan Entry Watch
        └── Scalper Engine dan lifecycle
```

Ketentuan utama:

- Harga live WebSocket hanya memperbarui tampilan harga.
- Mapping memakai candle terakhir yang sudah close.
- Freshness menjadi proteksi internal, bukan hard gate yang mengosongkan analisis valid.
- Candle belum selesai tidak dipakai sebagai sumber keputusan.
- Data lama yang masih merupakan candle tertutup valid tetap dapat dianalisis.
- Provider failure tidak boleh mengganti hasil Mapping valid dengan layar kosong.
- Tidak ada polling, focus refresh, atau render berulang yang membuat layar meloncat.

## Mapping dan Otoritas Eksekusi

Mapping menjadi sumber konteks market, termasuk:

- struktur dan perubahan struktur;
- likuiditas BSL/SSL;
- Fair Value Gap, Order Block, dan Breaker;
- bias HTF dan struktur lokal;
- regime dan kondisi market;
- dealing location;
- sesi WITA;
- konflik, invalidasi, serta alasan analisis.

Market State BT7.1 merekonsiliasi struktur, bias, forecast, dan kondisi market tanpa memakai future candle. Rencana Eksekusi menerjemahkan hasil tersebut menjadi BUY, SELL, atau WAIT dengan entry, Stop Loss, TP1, TP2, RR, invalidasi, dan lifecycle yang berasal dari setup resmi.

## Amy FX Scalper Engine

Engine aktif: `amyfx-preview-scalper-pattern-v3.0`

Nama versi engine tetap dipertahankan sebagai kontrak teknis agar snapshot backend, lifecycle, dan UI menggunakan authority yang sama. Engine produksi mendukung sepuluh driver:

1. FVG
2. CRT
3. Order Block
4. Breaker Block
5. Retest BOS
6. Trendline Break & Retest
7. EMA Pullback
8. False Breakout / Judas Swing
9. Range Expansion
10. AMD

Scalper Entry Watch dapat menampilkan setup utama, setup aktif lain, alasan driver, timeframe, HTF bias, Entry, Stop Loss, TP1 +10, TP2 +20, dan riwayat setup permanen. Storage key produksi terpisah dari Preview.

Scalper Execution Authority hanya menerima setup current pattern-v3 yang valid dan tidak legacy. Mapping tetap menyediakan konteks arah; setup Scalper yang bertentangan dengan Mapping tetap WAIT.

## Lifecycle Setup

Lifecycle yang ditangani meliputi:

```text
WAITING_TRIGGER
WAITING_NEXT_OPEN
ENTRY_READY
ACTIVE
TP1 HIT · SL TETAP
TP_HIT
SL_HIT
BE_HIT
TIME_EXIT
INVALIDATED
CANCELLED
```

Entry, Stop Loss, TP1, TP2, timestamp, dan status terminal dikunci oleh backend. UI tidak menghitung ulang level eksekusi secara mandiri.

## News dan Notifikasi

Produksi mempertahankan **satu** scheduler news dan satu jalur system-notification resmi. Promosi Preview tidak mengaktifkan scheduler, cron, atau backend news kedua.

- `news-sync` menyinkronkan data news;
- `web-push-delivery` menangani Web Push;
- `news-system-push` menangani Firebase system notification;
- `scheduled-news-sync` mengorkestrasi ketiganya melalui satu jadwal produksi.

## Fitur Utama 2.3.0

- Harga live XAU/USD melalui WebSocket.
- Mapping lintas timeframe berbasis candle tertutup.
- Market State BT7.1 dan structural bias independen.
- Rencana Eksekusi BUY, SELL, atau WAIT.
- Entry Watch dan lifecycle setup resmi.
- Scalper Engine sepuluh driver termasuk AMD.
- Permanent Scalper setup history.
- Market Intelligence untuk news, heatmap, dan liquidity.
- Amy Mentor dengan konteks Beranda, Mapping, Market Intelligence, Academy, dan Journal.
- Journal Trading dan materi pembelajaran dalam aplikasi.
- Academy reading history serta lanjut dari posisi terakhir.
- Update dalam aplikasi melalui `main/update.json`.

## Struktur Repository

```text
app/src/main/assets/                   WebView assets
app/src/main/assets/apps/mapping/      Mapping, Entry Watch, Rencana Eksekusi, Scalper UI
app/src/main/assets/apps/market-intel/ News, heatmap, dan liquidity
app/src/main/assets/apps/journal/      Journal Trading
app/src/main/assets/apps/academy/      Materi dan reading history
app/src/main/java/                     Android native Kotlin, FCM, dan live-price bridge
api/                                   Serverless market gateway
lib/                                   Shared backend logic
supabase/functions/scalper-engine/     Pattern engine dan lifecycle
supabase/functions/scalper-setups/     Endpoint setup resmi
supabase/functions/news-system-push/   System notification produksi
supabase/migrations/                   Database dan konfigurasi engine
tests/                                 Regression tests
.github/workflows/                     CI, validasi, signing, dan release
update.json                            Manifest update produksi
```

## Build dan Validasi

Kebutuhan utama:

- JDK 17
- Android SDK 35
- Node.js 22

```bash
npm test
./gradlew testReleaseUnitTest
./gradlew lintRelease
```

Setiap kandidat publik memeriksa:

- seluruh regression test JavaScript;
- Android release unit test;
- Android lint;
- package `com.amyelitesuite`;
- label `Amy FX`;
- URI `amyfx`;
- version name dan version code;
- update channel `main/update.json`;
- tidak adanya identitas Preview pada runtime produksi;
- modul Mapping, Scalper, lifecycle, dan UI parity;
- build APK release signed dan fingerprint signer produksi sebelum publikasi.

Urutan publikasi:

1. Promotion parity dan seluruh test selesai.
2. Identitas package, versi, URI, dan signer diverifikasi.
3. APK signed diunggah sebagai `AmyFX-latest.apk`.
4. Release `amyfx-latest` diperbarui.
5. `update.json` baru diaktifkan.

Aplikasi tidak menawarkan pembaruan sebelum APK yang cocok tersedia.

## Catatan Penggunaan

Amy FX adalah alat bantu analisis dan pembelajaran. Keputusan entry, ukuran risiko, serta eksekusi transaksi tetap menjadi tanggung jawab pengguna.
