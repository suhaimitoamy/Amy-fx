# Amy FX Preview — Personal Build

Amy FX Preview adalah aplikasi Android hybrid untuk pemetaan market, pemantauan **XAU/USD**, Rencana Eksekusi, Entry Watch, jurnal trading, market intelligence, dan materi belajar. Antarmuka utama berjalan melalui WebView lokal, layanan native Android ditangani oleh Kotlin, sedangkan candle analisis, Scalper Engine, lifecycle setup, dan notifikasi memakai layanan backend yang terisolasi untuk Preview.

> **Release aktif:** `2.0.0-preview.297` · Version code `940297`

[Download Amy FX Preview 2.0.0-preview.297](https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-blueprint-preview-2.0.0-preview.297/AmyFX-Preview-latest.apk)

## Fungsi Branch

Repository ini memiliki dua branch permanen dengan tujuan berbeda:

| Branch | Fungsi |
|---|---|
| **`personal/amyfx-private`** | Sumber pengembangan, pengujian, build, release, dan update Amy FX Preview untuk penggunaan pribadi. |
| **`main`** | Sumber aplikasi Amy FX publik/produksi. |

Pengembangan Preview hanya dilakukan pada:

```text
personal/amyfx-private
```

Perubahan pada branch personal tidak boleh otomatis digabungkan, disalin, atau dipindahkan ke `main`.

## Identitas Amy FX Preview

| Properti | Nilai |
|---|---|
| Nama aplikasi | `Amy FX Preview` |
| Application ID | `com.amyelitesuite.learningpreview` |
| URI scheme | `amyfxpreview` |
| Version name | `2.0.0-preview.297` |
| Version code | `940297` |
| Minimum Android | Android 8.0 / API 26 |
| Target SDK | Android SDK 35 |
| Update channel | `personal/amyfx-private/preview-update.json` |
| Release tag | `amyfx-blueprint-preview-2.0.0-preview.297` |

Identitas package, URI, signing certificate, data aplikasi, dan update channel Preview harus tetap terpisah dari Amy FX publik.

## Kondisi Terbaru

Release `.297` memakai **Scalper Engine multidriver** sebagai otoritas eksekusi bersama untuk:

- **Rencana Eksekusi**;
- **Entry Watch**;
- arah BUY, SELL, atau WAIT;
- entry, Stop Loss, TP1, dan TP2;
- lifecycle setup;
- status data LIVE atau stale;
- alasan setup dan invalidasi;
- notifikasi perubahan lifecycle penting.

Mapping tetap menyimpan dan menampilkan konteks market. Scalper Engine tidak menghapus fungsi Mapping, Market Outlook, News, Journal, Academy, atau modul lain.

Amy FX Preview bukan robot trading dan tidak membuka, mengubah, atau menutup order broker secara otomatis.

## Otoritas Eksekusi

Scalper Engine hanya mengaktifkan rencana entry ketika seluruh kondisi berikut terpenuhi:

- setup berasal dari engine aktif `amyfx-preview-scalper-multidriver-v2.0`;
- setup bukan setup legacy;
- arah setup valid BUY atau SELL;
- status setup masih nonterminal;
- data berstatus `LIVE`;
- entry, Stop Loss, TP1, dan TP2 membentuk geometri yang valid;
- lifecycle sudah mencapai status yang mengizinkan entry.

Aplikasi menampilkan **WAIT** ketika:

- belum ada setup yang dipilih;
- setup masih menunggu trigger atau candle berikutnya;
- data Scalper Engine belum tersedia atau stale;
- geometri entry, Stop Loss, atau target tidak valid;
- setup sudah terminal, dibatalkan, atau tidak lagi dapat dieksekusi.

Status utama yang diterjemahkan ke antarmuka:

```text
WAITING_TRIGGER / WAITING_NEXT_OPEN / ENTRY_READY
        ↓
ACTIVE → ENTRY_TRIGGERED
        ↓
BE_ACTIVE → TP1 HIT / BE
        ↓
TP_HIT / SL_HIT / BE_HIT / TIME_EXIT / INVALIDATED / CANCELLED
```

## Arsitektur Utama

```text
Twelve Data WebSocket
        └── Harga live XAU/USD

Candle analisis
        ↓
Supabase market-candles
        ↓
Scalper Engine Multidriver
        ↓
Setup Lifecycle + State Store
        ↓
Scalper Execution Authority
        ├── Rencana Eksekusi
        ├── Entry Watch
        ├── Panel detail setup
        ├── Notifikasi
        └── Lifecycle history
```

Harga live pada layar memakai jalur WebSocket native. Jalur candle analisis dan lifecycle tetap dipisahkan agar penggunaan REST tidak dijadikan sumber tick layar secara terus-menerus.

## Panel Preview

Panel detail Scalper Engine mempertahankan informasi berikut:

- setup aktif dan alternatif;
- driver/model setup;
- timeframe;
- arah BUY atau SELL;
- alasan pemilihan setup;
- entry;
- Stop Loss;
- TP1;
- TP2;
- status lifecycle;
- status data;
- validitas geometri;
- invalidasi atau alasan WAIT.

Rencana Eksekusi dan Entry Watch membaca otoritas yang sama sehingga keduanya tidak menghasilkan keputusan yang saling bertentangan.

## Academy dan Jurnal

Academy menyimpan:

- materi terakhir yang dibaca;
- heading terakhir;
- persentase bacaan;
- posisi scroll terakhir.

Journal tetap menjadi tempat penyimpanan catatan dan evaluasi trading pengguna. Fitur Academy dan Journal tidak dijadikan sumber sinyal trading.

## Struktur Repository

```text
app/src/main/assets/                         WebView assets utama
app/src/main/assets/apps/mapping/            Mapping, Rencana Eksekusi, Entry Watch
app/src/main/assets/apps/market-intel/       News, heatmap, dan market intelligence
app/src/main/assets/apps/journal/            Jurnal trading
app/src/main/assets/apps/academy/            Materi belajar dan reading history
app/src/main/java/                           Android native Kotlin, updater, FCM, WebSocket
supabase/functions/scalper-engine/           Engine, driver, candle, sinyal, lifecycle
supabase/functions/scalper-setups/           API setup Preview
supabase/functions/scalper-system-push/      Pengiriman notifikasi scalper
supabase/migrations/                         Schema dan scheduler backend
api/                                         Vercel serverless functions
lib/                                         Shared backend logic
tests/                                       Regression tests
.github/workflows/                            CI, signed build, dan release Preview
```

## Alur Build dan Release

Workflow Preview berada di:

```text
.github/workflows/amyfx-blueprint-preview-release.yml
```

Workflow hanya berjalan untuk branch `personal/amyfx-private` dan melakukan:

1. memastikan branch bukan `main`;
2. membaca version name dan version code dari source Preview;
3. memvalidasi hubungan suffix versi dengan version code;
4. menjalankan stabilisasi Blueprint Preview;
5. menjalankan seluruh regression test JavaScript;
6. menjalankan Android release unit test;
7. menjalankan Android lint;
8. membangun APK release bertanda tangan;
9. memverifikasi package, label, versi, dan signer;
10. membuat immutable prerelease GitHub;
11. mengunggah APK dan checksum SHA-256;
12. mengaktifkan `preview-update.json` hanya setelah APK berhasil diverifikasi.

Workflow tidak boleh mengaktifkan manifest versi baru sebelum APK signed berhasil dibuat dan lolos verifikasi.

## Status Verifikasi Release `.297`

Release `2.0.0-preview.297` telah lulus:

- 93 file regression JavaScript;
- Android release unit test;
- Android lint;
- signed APK build;
- package verification;
- version verification;
- application label verification;
- signing certificate verification;
- GitHub prerelease publication;
- update-channel activation.

Checksum APK:

```text
a45a9d7d70495167960c69120c298e84e904290b3b5ede6df7347f522bb2f769
```

## Update Channel

Manifest aktif:

```text
personal/amyfx-private/preview-update.json
```

Manifest saat ini menunjuk ke:

```text
Version name : 2.0.0-preview.297
Version code : 940297
Enabled      : true
Force update : false
```

Aplikasi versi `940295` atau lebih lama dapat mendeteksi `.297` sebagai pembaruan yang lebih baru melalui kanal Preview.

## Aturan Pengembangan

- Kerjakan hanya branch `personal/amyfx-private` untuk Amy FX Preview.
- Jangan menyentuh atau merge ke `main` tanpa instruksi khusus.
- Jangan mengubah package, URI scheme, signing certificate, data aplikasi, atau update channel Preview.
- Jangan mengaktifkan manifest sebelum signed APK lolos seluruh verifikasi.
- Jangan memakai candle yang belum close untuk keputusan analisis.
- Jangan memakai future candle pada replay atau pengujian historis.
- Data stale, setup terminal, atau geometri tidak valid harus menghasilkan WAIT.
- Modul baru tidak boleh merusak Mapping, News, Journal, Academy, atau fitur lain.
- Backtest tidak dijalankan otomatis oleh proses release.

## Disclaimer

Amy FX Preview bukan robot trading, Expert Advisor, atau penasihat keuangan. Aplikasi tidak membuka atau menutup order secara otomatis dan tidak menjamin hasil tertentu. Seluruh informasi merupakan alat bantu analisis dan simulasi. Keputusan serta risiko trading tetap berada pada pengguna.
