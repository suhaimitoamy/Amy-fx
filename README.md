# Amy FX Preview — Personal Build

Amy FX Preview adalah aplikasi Android hybrid untuk pemetaan market, pemantauan **XAU/USD**, Rencana Eksekusi, Entry Watch, jurnal trading, market intelligence, dan materi belajar. Antarmuka utama berjalan melalui WebView lokal, sedangkan layanan Android native, harga live, candle analisis, lifecycle setup, notifikasi, dan pembaruan aplikasi memakai jalur Preview yang terpisah dari Amy FX publik.

> **Release aktif:** `2.0.0-preview.313`  
> **Version code:** `940313`  
> **Tanggal rilis:** 5 Agustus 2026

[Download Amy FX Preview 2.0.0-preview.313](https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-blueprint-preview-2.0.0-preview.313/AmyFX-Preview-latest.apk)

## Status Release `.313`

Preview `.313` adalah **install-safe version wrapper** yang mengembalikan seluruh source dan perilaku aplikasi ke kondisi stabil Preview `.310`. Nomor `.313` dipakai agar APK dapat dipasang di atas `.312` tanpa uninstall dan tanpa menghapus data lokal.

Perubahan Trading Desk dari Preview `.311` dan `.312` telah dihapus. Mapping, harga live, closed-candle lifecycle, scanner, notifikasi, tampilan, serta perilaku aplikasi mengikuti basis stabil Preview `.310`.

Release ini mempertahankan:

- Professional Glassmorphism UI;
- tema Sistem, Terang, dan Gelap;
- Beranda dengan lima modul resmi tanpa duplikasi;
- Mapping closed-candle runtime v6;
- structural bias dan dependency refresh;
- Dashboard dan Analisis yang terpisah;
- Market Outlook dan Rencana Eksekusi;
- Amy FX Scalper Engine Pattern v3;
- Entry Watch, lifecycle, dan riwayat setup;
- harga live WebSocket yang tidak merender ulang Mapping;
- Market Intelligence, Journal, Academy, dan Amy Mentor;
- package, URI, signing certificate, update channel, dan data pengguna Preview.

Amy FX Preview bukan robot trading dan tidak membuka, mengubah, atau menutup order broker secara otomatis.

## Fungsi Branch

Repository ini memiliki dua branch permanen dengan tujuan berbeda:

| Branch | Fungsi |
|---|---|
| **`personal/amyfx-private`** | Sumber pengembangan, pengujian, build, release, dan update Amy FX Preview untuk penggunaan pribadi. |
| **`main`** | Sumber aplikasi Amy FX publik dan rilis produksi. |

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
| Version name | `2.0.0-preview.313` |
| Version code | `940313` |
| Minimum Android | Android 8.0 / API 26 |
| Target SDK | Android SDK 35 |
| Update channel | `personal/amyfx-private/preview-update.json` |
| Release tag | `amyfx-blueprint-preview-2.0.0-preview.313` |
| APK | `AmyFX-Preview-latest.apk` |

Identitas package, URI, signing certificate, data aplikasi, storage key, dan update channel Preview harus tetap terpisah dari Amy FX publik.

## Arsitektur Market Data

Amy FX Preview memisahkan harga live dari data candle analisis agar harga tetap responsif tanpa menghitung ulang Mapping pada setiap tick.

```text
Twelve Data WebSocket
        └── Harga live XAU/USD di layar

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
        ├── Panel detail setup
        ├── Scanner
        └── Notifikasi
```

Ketentuan utama:

- Harga live WebSocket hanya memperbarui tampilan harga.
- Mapping memakai candle terakhir yang sudah close.
- Harga live tidak boleh menghitung atau merender ulang Mapping.
- Freshness menjadi proteksi internal, bukan hard gate yang mengosongkan analisis valid.
- Candle yang belum selesai tidak dipakai sebagai sumber keputusan.
- Provider failure tidak boleh mengganti hasil Mapping valid dengan layar kosong.
- Tidak ada polling, focus refresh, atau render berulang yang membuat layar meloncat.
- Replay historis tidak boleh memakai future candle.

## Mapping dan Rencana Eksekusi

Mapping menyimpan konteks market, meliputi:

- struktur dan perubahan struktur;
- likuiditas BSL/SSL;
- Fair Value Gap, Order Block, dan Breaker;
- bias HTF dan struktur lokal;
- regime dan kondisi market;
- dealing location;
- sesi WITA;
- konflik, invalidasi, dan alasan analisis.

Rencana Eksekusi menerjemahkan hasil Mapping dan setup resmi menjadi:

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

UI tidak membuat strategi baru dan tidak menghitung level eksekusi secara mandiri.

## Amy FX Scalper Engine

Engine aktif:

```text
amyfx-preview-scalper-pattern-v3.0
```

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

Status yang dapat diterjemahkan ke antarmuka meliputi:

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

## Modul Utama

- **Beranda** — ringkasan kondisi aplikasi dan akses ke lima modul resmi.
- **Mapping** — konteks market, Market Outlook, Rencana Eksekusi, Entry Watch, dan Scalper Engine.
- **Market Intelligence** — news, heatmap, liquidity, dan informasi market.
- **Journal Trading** — catatan serta evaluasi trading pengguna.
- **Academy** — materi belajar dengan riwayat bacaan dan posisi terakhir.
- **Amy Mentor** — bantuan kontekstual berdasarkan modul yang sedang dibuka.

Academy dan Journal tidak dijadikan sumber sinyal trading.

## Struktur Repository

```text
app/src/main/assets/                         WebView assets utama
app/src/main/assets/apps/mapping/            Mapping, Rencana Eksekusi, Entry Watch
app/src/main/assets/apps/market-intel/       News, heatmap, dan market intelligence
app/src/main/assets/apps/journal/            Journal Trading
app/src/main/assets/apps/academy/            Materi dan reading history
app/src/main/java/                           Android native Kotlin, updater, FCM, WebSocket
supabase/functions/scalper-engine/           Engine, driver, candle, sinyal, lifecycle
supabase/functions/scalper-setups/           API setup Preview
supabase/functions/scalper-system-push/      Pengiriman notifikasi scalper
supabase/migrations/                         Schema dan scheduler backend
api/                                         Vercel serverless functions
lib/                                         Shared backend logic
tests/                                       Regression tests
.github/workflows/                            CI, signed build, dan release Preview
preview-update.json                          Manifest update Preview
```

## Build dan Release

Workflow Preview:

```text
.github/workflows/amyfx-blueprint-preview-release.yml
```

Kebutuhan utama:

- JDK 17
- Android SDK 35
- Node.js 22

Gerbang release meliputi:

1. memastikan target branch adalah `personal/amyfx-private` dan bukan `main`;
2. membaca version name dan version code dari source Preview;
3. memvalidasi hubungan suffix versi dengan version code;
4. menjalankan regression test JavaScript;
5. menjalankan Android release unit test;
6. menjalankan Android lint;
7. membangun APK release bertanda tangan;
8. memverifikasi package, label, versi, dan signer;
9. membuat prerelease GitHub;
10. mengunggah APK dan checksum SHA-256;
11. mengaktifkan `preview-update.json` setelah APK berhasil diverifikasi.

Manifest tidak boleh menunjuk versi baru sebelum APK signed yang cocok tersedia.

## Update Channel

Manifest aktif:

```text
personal/amyfx-private/preview-update.json
```

Status saat ini:

```text
Version name : 2.0.0-preview.313
Version code : 940313
Enabled      : true
Force update : false
```

Aplikasi dengan version code `940312` atau lebih lama dapat mendeteksi `.313` sebagai pembaruan melalui kanal Preview.

## Aturan Pengembangan

- Kerjakan hanya branch `personal/amyfx-private` untuk Amy FX Preview.
- Jangan menyentuh atau merge ke `main` tanpa instruksi khusus.
- Jangan mengubah package, URI scheme, signing certificate, storage key, data aplikasi, atau update channel Preview.
- Jangan mengaktifkan manifest sebelum signed APK lolos verifikasi.
- Jangan memakai candle yang belum close untuk keputusan analisis.
- Jangan memakai future candle pada replay atau pengujian historis.
- Data stale, setup terminal, atau geometri tidak valid harus menghasilkan WAIT.
- Harga live tidak boleh memicu kalkulasi Mapping.
- Modul baru tidak boleh merusak Mapping, Market Intelligence, Journal, Academy, atau fitur lain.
- Backtest tidak dijalankan otomatis oleh proses release.

## Disclaimer

Amy FX Preview bukan robot trading, Expert Advisor, atau penasihat keuangan. Aplikasi tidak membuka atau menutup order secara otomatis dan tidak menjamin hasil tertentu. Seluruh informasi merupakan alat bantu analisis dan pembelajaran. Keputusan serta risiko trading tetap berada pada pengguna.
