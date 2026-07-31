# Amy FX

Amy FX adalah aplikasi Android hybrid untuk pemetaan, pemantauan, dan perencanaan eksekusi market **XAU/USD**. Antarmuka utama berjalan melalui WebView lokal, sedangkan background scanner, notifikasi, penyimpanan, Firebase Messaging, unduhan, serta pembaruan aplikasi ditangani oleh Kotlin native dan backend Supabase.

> **Versi produksi:** `2.1.0`  
> **Version code:** `54`  
> **Status:** rilis publik aktif

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

`main` merupakan sumber aplikasi dan rilis produksi. Fitur matang dari Amy FX Preview telah dikonsolidasikan ke produksi agar aplikasi, update channel, sinkronisasi candle, Mapping, dan Scalper Engine tidak berjalan melalui jalur ganda.

Branch `personal/amyfx-private` tetap menjadi riwayat pengembangan privat dan bukan sumber APK atau update channel produksi.

## Arsitektur Market Data

Amy FX memisahkan **harga live** dan **data candle analisis** agar harga tetap responsif tanpa menghabiskan kuota REST Twelve Data.

```text
Twelve Data WebSocket
        │
        └── Harga live XAU/USD di aplikasi

Twelve Data REST
        │
        └── Provider-only gateway Vercel
                 │
                 └── Central M1 Sync Supabase · setiap 3 menit
                          │
                          ├── M1 tersimpan
                          ├── M5 / M15 / M30 / H1 / H4 diagregasi
                          ├── D1 dibentuk dari H1 hasil central M1
                          └── W1 dibentuk dari D1
                                   │
                                   ├── Mapping
                                   ├── Scalper Engine
                                   ├── Entry Watch
                                   └── Rencana Eksekusi
```

Ketentuan utama:

- WebSocket Twelve Data hanya menangani harga live dan tidak diubah oleh sinkronisasi candle.
- REST Twelve Data hanya dipanggil oleh satu sinkronisasi M1 terpusat.
- Permintaan baca dari aplikasi tidak memicu request provider.
- Timeframe besar dibentuk dari data tersimpan tanpa REST terpisah per timeframe.
- Candle yang belum selesai tidak dipakai sebagai sumber keputusan.
- Saat provider gagal atau mengirim data lama, backend tidak menulis candle stale sebagai data baru.

## Jadwal Backend Produksi

| Proses | Jadwal | Fungsi |
|---|---:|---|
| `amyfx-market-central-sync` | Setiap 3 menit | Sinkronisasi REST M1 dan agregasi timeframe |
| `amyfx-scalper-engine-unified` | Setiap 1 menit | Evaluasi setup dan lifecycle dari candle Supabase |
| `amyfx-news-sync` | Setiap 2 menit | Sinkronisasi news dan notifikasi terkait |

Scalper Engine membaca Supabase secara read-only dan melaporkan `provider_requests: 0` pada setiap run.

## Mapping dan Otoritas Eksekusi

Mapping tetap menjadi sumber konteks market, termasuk:

- struktur dan perubahan struktur;
- likuiditas BSL/SSL;
- Fair Value Gap, Order Block, dan Breaker;
- bias HTF dan struktur lokal;
- regime dan kondisi market;
- dealing location;
- sesi WITA;
- konflik, invalidasi, serta alasan analisis.

Scalper Engine menjadi otoritas praktis untuk:

- driver setup;
- arah BUY atau SELL;
- status entry;
- entry price;
- Stop Loss;
- TP1 / break-even trigger;
- TP2;
- lifecycle setup;
- setup utama yang ditampilkan.

**Rencana Eksekusi**, **Entry Watch**, scanner, dan notifikasi membaca keputusan eksekusi yang sama sehingga tidak menghasilkan arahan yang saling bertentangan. Konteks asli Mapping tetap disimpan untuk penjelasan dan audit.

## Scalper Engine Multidriver

Engine aktif: `amyfx-preview-scalper-multidriver-v2.0`

Driver yang terdaftar:

1. FVG
2. CRT
3. Order Block
4. Breaker Block
5. Retest BOS
6. Trendline Break & Retest
7. EMA Pullback
8. False Breakout / Judas Swing
9. Range Expansion

Setup dari engine atau driver lama, termasuk **IFVG Legacy**, tidak dapat muncul kembali sebagai setup aktif. Riwayat terminal lama tetap disimpan untuk audit, tetapi endpoint aktif hanya memakai engine multidriver saat ini.

## Lifecycle Setup

Lifecycle utama yang ditangani backend mencakup:

```text
WAITING_NEXT_OPEN
        ↓
ACTIVE
        ├── BE_ACTIVE → BE_HIT
        ├── TP_HIT
        ├── SL_HIT
        ├── TIME_EXIT
        └── INVALIDATED
```

Entry, SL, target, dan timestamp dikunci oleh backend. UI tidak menghitung ulang level eksekusi secara mandiri.

## Fitur Utama 2.1.0

- Harga live XAU/USD melalui WebSocket Twelve Data.
- Sinkronisasi REST M1 terpusat dengan agregasi M5 sampai W1.
- Mapping market lintas timeframe dengan kontrak freshness yang konsisten.
- Rencana Eksekusi untuk menerjemahkan Mapping menjadi arahan praktis BUY, SELL, atau WAIT.
- Entry Watch dan lifecycle setup yang mengikuti Scalper Engine.
- Multidriver Scalper Engine dengan sembilan driver aktif.
- Market Intelligence untuk news, heatmap, dan liquidity.
- Amy Mentor dengan konteks Beranda, Mapping, Market Intelligence, Academy, dan Journal.
- Journal Trading dan materi pembelajaran dalam aplikasi.
- Academy menyimpan materi, heading, persentase, posisi scroll, dan riwayat baca terakhir.
- Tombol **Lanjutkan dari posisi terakhir** pada Academy.
- Update dalam aplikasi melalui `main/update.json`.

## Academy Reading History

Academy menyimpan progres belajar secara lokal, meliputi:

- materi terakhir dibuka;
- heading terakhir;
- persentase baca;
- posisi scroll;
- daftar riwayat materi;
- waktu terakhir dibaca.

Saat materi dibuka kembali, aplikasi dapat melanjutkan ke posisi terakhir tanpa mengubah isi materi.

## Struktur Repository

```text
app/src/main/assets/                   WebView assets
app/src/main/assets/apps/mapping/      Mapping, Entry Watch, Rencana Eksekusi
app/src/main/assets/apps/market-intel/ News, heatmap, dan liquidity
app/src/main/assets/apps/journal/      Journal Trading
app/src/main/assets/apps/academy/      Materi dan reading history
app/src/main/java/                     Android native Kotlin dan FCM
api/                                   Serverless provider-only gateway
lib/                                   Shared backend logic
supabase/functions/market-candles/     Central M1 sync dan candle reads
supabase/functions/scalper-engine/     Multidriver engine dan lifecycle
supabase/functions/scalper-setups/     Endpoint setup resmi
supabase/migrations/                   Database, cron, dan rollup timeframe
tests/                                 Regression tests
.github/workflows/                     CI, validasi, signing, dan release
update.json                            Manifest update produksi
```

## Build Lokal

Kebutuhan utama:

- JDK 17
- Android SDK 35
- Node.js 22

Jalankan pemeriksaan JavaScript:

```bash
npm test
```

Jalankan pemeriksaan Android:

```bash
./gradlew testReleaseUnitTest
./gradlew lintRelease
```

Build APK release membutuhkan konfigurasi signing dan secret yang disediakan melalui environment CI. Secret provider, service-role, signing key, dan kredensial push tidak disimpan di repository.

## Validasi dan Rilis Produksi

Setiap kandidat publik memeriksa:

- seluruh regression test JavaScript;
- Android release unit test;
- Android lint;
- build APK release signed;
- package `com.amyelitesuite`;
- label `Amy FX`;
- version name dan version code;
- APK Signature Scheme v1 dan v2;
- fingerprint signer produksi;
- sumber update `main/update.json`.

Urutan publikasi:

1. Build dan test selesai.
2. Identitas package, versi, dan signer diverifikasi.
3. APK diunggah sebagai `AmyFX-latest.apk`.
4. Release `amyfx-latest` diperbarui.
5. `update.json` baru diaktifkan.

Dengan urutan tersebut, aplikasi tidak menawarkan update sebelum APK yang cocok tersedia.

## Catatan Penggunaan

Amy FX adalah alat bantu analisis dan pembelajaran. Keputusan entry, ukuran risiko, serta eksekusi transaksi tetap menjadi tanggung jawab pengguna.
