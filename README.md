# Amy FX

Amy FX adalah aplikasi Android hybrid untuk pemetaan, pemantauan, dan perencanaan eksekusi market **XAU/USD**. Antarmuka utama berjalan melalui WebView lokal, sedangkan harga live, notifikasi, penyimpanan, Firebase Messaging, pembaruan aplikasi, dan layanan market ditangani oleh Kotlin native serta backend Amy FX.

> **Rilis produksi aktif:** `2.3.1`  
> **Version code:** `59`  
> **Tanggal rilis:** 4 Agustus 2026

[Download Amy FX 2.3.1](https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-latest/AmyFX-latest.apk)

## Status Produksi `2.3.1`

Amy FX `2.3.1` menyelaraskan engine dan runtime produksi secara **zero-drift** dengan basis stabil Amy FX Preview `2.0.0-preview.310`, setelah seluruh identitas Preview dinormalisasi kembali menjadi identitas produksi.

Rilis ini mencakup:

- Mapping closed-candle runtime v6;
- structural bias dan dependency refresh;
- Dashboard dan Analisis yang terpisah;
- Market Outlook dan Rencana Eksekusi;
- Amy FX Scalper Engine Pattern v3;
- Entry Watch, execution authority, decision bridge, dan lifecycle resmi;
- permanent Scalper setup history;
- harga live WebSocket yang tidak merender ulang Mapping;
- tampilan profesional dan render DOM stabil;
- Market Intelligence, Journal, Academy, dan Amy Mentor;
- package, URI, signing certificate, update channel, storage key, dan data pengguna produksi yang tetap dipertahankan.

Amy FX bukan robot trading dan tidak membuka, mengubah, atau menutup order broker secara otomatis.

## Identitas Produksi

| Properti | Nilai |
|---|---|
| Nama aplikasi | `Amy FX` |
| Application ID | `com.amyelitesuite` |
| URI scheme | `amyfx` |
| Version name | `2.3.1` |
| Version code | `59` |
| Minimum Android | Android 8.0 / API 26 |
| Target SDK | Android SDK 35 |
| Update manifest | `main/update.json` |
| Release tag | `amyfx-latest` |
| APK | `AmyFX-latest.apk` |
| Signing | Sertifikat produksi permanen |

Branch `main` merupakan sumber aplikasi dan rilis produksi. Branch `personal/amyfx-private` tetap menjadi ruang pengembangan Amy FX Preview dan bukan sumber package, APK, update channel, signing, atau data pengguna produksi.

## Hubungan dengan Amy FX Preview

Runtime yang telah stabil pada Amy FX Preview dapat dipromosikan secara terkontrol ke produksi. Kesetaraan berarti Mapping, engine, lifecycle, execution authority, dan tampilan utama menggunakan implementasi yang sama setelah identitasnya dinormalisasi.

Identitas platform tetap terpisah:

| Amy FX Produksi | Amy FX Preview |
|---|---|
| `com.amyelitesuite` | `com.amyelitesuite.learningpreview` |
| URI `amyfx` | URI `amyfxpreview` |
| `main/update.json` | `personal/amyfx-private/preview-update.json` |
| `AmyFX-latest.apk` | `AmyFX-Preview-latest.apk` |
| Signing produksi | Signing Preview |
| Data dan storage produksi | Data dan storage Preview |

Source Preview tidak boleh disalin ke produksi tanpa normalisasi identitas, audit scheduler, validasi backend, pengujian, dan verifikasi signer.

## Arsitektur Market Data

Amy FX memisahkan **harga live** dan **data candle analisis** agar harga tetap responsif tanpa membuat Mapping menghitung ulang pada setiap tick.

```text
Twelve Data WebSocket
        └── Harga live XAU/USD di layar

Gateway dan penyimpanan candle Amy FX
        ↓
Candle tertutup lintas timeframe
        ↓
Mapping closed-candle runtime
        ↓
Market State dan Structural Bias
        ↓
Scalper Engine Pattern v3
        ↓
Setup Lifecycle + Execution Authority
        ├── Rencana Eksekusi
        ├── Entry Watch
        ├── Scanner
        ├── Riwayat setup
        └── Notifikasi
```

Ketentuan utama:

- Harga live WebSocket hanya memperbarui tampilan harga.
- Mapping memakai candle terakhir yang sudah close.
- Harga live tidak boleh menghitung atau merender ulang Mapping.
- Freshness menjadi proteksi internal, bukan hard gate yang mengosongkan analisis valid.
- Candle yang belum selesai tidak dipakai sebagai sumber keputusan.
- Data lama yang masih merupakan candle tertutup valid tetap dapat dianalisis.
- Provider failure tidak boleh mengganti hasil Mapping valid dengan layar kosong.
- Tidak ada polling, focus refresh, atau render berulang yang membuat layar meloncat.
- Replay historis tidak boleh memakai future candle.

## Mapping dan Market Context

Mapping menjadi sumber konteks market, termasuk:

- struktur dan perubahan struktur;
- likuiditas BSL/SSL;
- Fair Value Gap, Order Block, dan Breaker;
- bias HTF dan struktur lokal;
- regime dan kondisi market;
- dealing location;
- sesi WITA;
- konflik, invalidasi, serta alasan analisis.

Mapping tetap menampilkan analisis candle terakhir yang sudah close. Status freshness tidak boleh menghapus konteks valid dari layar.

## Rencana Eksekusi

Rencana Eksekusi menerjemahkan hasil Mapping dan setup resmi menjadi arahan praktis:

- BUY, SELL, atau WAIT;
- fokus arah;
- area pantauan dan area entry;
- trigger serta konfirmasi;
- Entry, Stop Loss, TP1, dan TP2;
- Risk–Reward;
- target struktural;
- invalidasi;
- lifecycle setup;
- alasan keputusan.

Rencana Eksekusi tidak membuat strategi atau engine baru. UI membaca authority resmi dan tidak menghitung ulang level eksekusi secara mandiri.

## Amy FX Scalper Engine

Engine aktif:

```text
amyfx-preview-scalper-pattern-v3.0
```

Nama teknis engine tetap dipertahankan sebagai kontrak internal agar snapshot backend, lifecycle, dan UI memakai authority yang sama. Identitas aplikasi tetap produksi.

Engine mendukung sepuluh driver:

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

Scalper Execution Authority hanya menerima setup Pattern v3 yang valid, bukan legacy, memiliki geometri Entry/SL/TP yang benar, memakai data yang dapat digunakan, dan belum terminal.

Aplikasi menampilkan **WAIT** ketika:

- belum ada setup resmi;
- setup masih menunggu area, trigger, candle close, atau pembukaan candle berikutnya;
- arah setup bertentangan dengan konteks Mapping;
- data setup belum tersedia atau stale;
- Entry, Stop Loss, TP1, atau TP2 tidak valid;
- setup sudah terminal, dibatalkan, atau kedaluwarsa.

## Lifecycle Setup

Lifecycle yang dapat diterjemahkan ke antarmuka meliputi:

```text
WAITING_TRIGGER
WAITING_NEXT_OPEN
ENTRY_READY
ACTIVE
ENTRY_TRIGGERED
TP1 HIT · SL TETAP
TP_HIT
SL_HIT
BE_HIT
TIME_EXIT
INVALIDATED
CANCELLED
```

Entry, Stop Loss, TP1, TP2, timestamp, dan status terminal dikunci oleh backend. Rencana Eksekusi dan Entry Watch membaca authority yang sama sehingga keduanya tidak menghasilkan keputusan yang saling bertentangan.

## News dan Notifikasi

Produksi mempertahankan **satu** scheduler news dan satu jalur system notification resmi. Promosi dari Preview tidak boleh mengaktifkan scheduler, cron, atau backend news kedua.

- `news-sync` menyinkronkan data news;
- `web-push-delivery` menangani Web Push;
- `news-system-push` menangani Firebase system notification;
- `scheduled-news-sync` mengorkestrasi jalur produksi melalui satu jadwal resmi.

## Modul Utama

- **Beranda** — ringkasan kondisi aplikasi dan akses modul utama.
- **Mapping** — konteks market, Market Outlook, Rencana Eksekusi, Entry Watch, dan Scalper Engine.
- **Market Intelligence** — news, heatmap, liquidity, dan informasi market.
- **Journal Trading** — catatan serta evaluasi trading pengguna.
- **Academy** — materi belajar dengan riwayat bacaan dan posisi terakhir.
- **Amy Mentor** — bantuan kontekstual berdasarkan modul yang sedang dibuka.

Academy dan Journal tidak dijadikan sumber sinyal trading.

## Struktur Repository

```text
app/src/main/assets/                   WebView assets
app/src/main/assets/apps/mapping/      Mapping, Entry Watch, Rencana Eksekusi, Scalper UI
app/src/main/assets/apps/market-intel/ News, heatmap, dan liquidity
app/src/main/assets/apps/journal/      Journal Trading
app/src/main/assets/apps/academy/      Materi dan reading history
app/src/main/java/                     Android native Kotlin, FCM, updater, live-price bridge
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

Setiap kandidat produksi harus memeriksa:

- seluruh regression test JavaScript;
- Android release unit test;
- Android lint;
- package `com.amyelitesuite`;
- label `Amy FX`;
- URI `amyfx`;
- version name dan version code;
- update channel `main/update.json`;
- tidak adanya identitas Preview pada runtime produksi;
- tidak adanya scheduler news duplikat;
- modul Mapping, Scalper, lifecycle, dan UI parity;
- build APK release signed dan fingerprint signer produksi.

Urutan publikasi:

1. Promotion parity dan seluruh test selesai.
2. Identitas package, versi, URI, scheduler, backend, dan signer diverifikasi.
3. APK signed diunggah sebagai `AmyFX-latest.apk`.
4. Release `amyfx-latest` diperbarui.
5. `update.json` baru diaktifkan.

Aplikasi tidak boleh menawarkan pembaruan sebelum APK signed yang cocok tersedia.

## Update Channel

Manifest aktif:

```text
main/update.json
```

Status saat ini:

```text
Version name : 2.3.1
Version code : 59
Enabled      : aktif melalui manifest produksi
Force update : false
```

Aplikasi dengan version code `58` atau lebih lama dapat mendeteksi `2.3.1` sebagai pembaruan melalui kanal produksi.

## Aturan Produksi

- `main` adalah satu-satunya sumber rilis Amy FX produksi.
- Jangan mengganti package, URI, signing certificate, storage key, data pengguna, atau update channel produksi.
- Jangan mengaktifkan manifest sebelum signed APK lolos verifikasi.
- Jangan memakai candle yang belum close untuk keputusan analisis.
- Jangan memakai future candle pada replay atau pengujian historis.
- Data stale, setup terminal, atau geometri tidak valid harus menghasilkan WAIT.
- Harga live tidak boleh memicu kalkulasi Mapping.
- Promosi Preview tidak boleh membuat scheduler atau backend produksi duplikat.
- Modul baru tidak boleh merusak Mapping, Market Intelligence, Journal, Academy, atau fitur lain.
- Backtest tidak dijalankan otomatis oleh proses release.

## Disclaimer

Amy FX bukan robot trading, Expert Advisor, atau penasihat keuangan. Aplikasi tidak membuka atau menutup order secara otomatis dan tidak menjamin hasil tertentu. Seluruh informasi merupakan alat bantu analisis dan pembelajaran. Keputusan serta risiko trading tetap berada pada pengguna.
