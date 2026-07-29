# Amy FX Preview — Personal Build

Amy FX Preview adalah aplikasi Android hybrid untuk pemetaan dan pemantauan market **XAU/USD**. Antarmuka utama berjalan melalui WebView lokal, layanan native Android ditangani oleh Kotlin, sedangkan data market, engine sinyal, lifecycle setup, dan pengiriman notifikasi scalper berjalan melalui backend Supabase.

## Fungsi Branch

Repository ini memiliki dua branch permanen dengan tujuan berbeda:

| Branch | Fungsi |
|---|---|
| **`personal/amyfx-private`** | Sumber pengembangan, pengujian, build, dan update **Amy FX Preview** untuk penggunaan pribadi. |
| **`main`** | Sumber aplikasi **Amy FX** untuk penggunaan publik. |

Pengembangan aktif hanya dilakukan pada:

```text
personal/amyfx-private
```

Perubahan branch personal tidak boleh otomatis digabungkan, disalin, atau dipindahkan ke `main`.

## Identitas Amy FX Preview

- **Branch:** `personal/amyfx-private`
- **Nama aplikasi:** `Amy FX Preview`
- **Application ID:** `com.amyelitesuite.learningpreview`
- **URI scheme:** `amyfxpreview`
- **Versi aktif:** `2.0.0-preview.266`
- **Version code:** `940266`
- **Minimum Android:** Android 8.0 / API 26
- **Target SDK:** Android SDK 35
- **Update manifest:** `personal/amyfx-private/preview-update.json`

[Download Amy FX Preview](https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-blueprint-preview-2.0.0-preview.266/AmyFX-Preview-latest.apk)

## Kondisi Terbaru

Amy FX Preview sekarang memiliki **Scalper Engine Shadow Mode** yang berjalan terpisah dari Mapping, Direction Forecast, Entry Watch lama, jurnal pengguna, dan sistem breaking news.

Shadow Mode hanya melakukan simulasi dan pemantauan. Sistem belum membuka, mengubah, atau menutup order broker secara otomatis.

### Model Sinyal Aktif

#### IFVG Scalper Engine

- IFVG harus searah dengan H1 order flow yang sudah terkonfirmasi.
- Entry dikunci pada next-open setelah sinyal M15 terkonfirmasi.
- Stop Loss di luar wick candle inversion + `0.10 ATR`.
- Target utama `2R`.
- Breakeven diaktifkan setelah harga mencapai `1R`.
- Lifecycle maksimal empat candle M15.
- Jika belum TP, SL, atau BE setelah empat candle, setup ditutup sebagai `TIME_EXIT`.

#### FVG BUY High Quality

- Hanya menerima arah BUY.
- H1 harus bullish.
- Candle displacement minimal `1 ATR`.
- Body candle minimal 60% dari range.
- Close harus menghasilkan BOS/MSS.
- Stop Loss menggunakan wick lokal + `0.15 ATR`.
- Target `2R` dan lifecycle maksimal empat candle M15.

## Arsitektur Scalper Engine

```text
Market Data XAU/USD
        ↓
Supabase market-candles
        ↓
Scalper Engine
        ↓
Setup Lifecycle + State Store
        ├── Scalper Entry Watch
        ├── FCM Push Notification
        └── Lifecycle History
```

Backend membaca:

- **M1** untuk pemantauan harga, BE, TP, SL, dan time exit;
- **M15** untuk deteksi setup dan batas empat candle;
- **H1** untuk causal order-flow bias.

Scheduler Supabase menjalankan engine setiap satu menit. Setup dan event disimpan pada tabel khusus Preview dengan akses service-role dan tidak bergantung pada aplikasi Android tetap terbuka.

## Multi-Setup dan Proteksi Risiko

Rule satu posisi aktif sudah tidak digunakan.

- Semua sinyal valid tetap dipantau dan dicatat.
- Maksimum dua setup diberi rekomendasi `VALID` secara bersamaan.
- Setup tambahan tetap terlihat dengan status `RISK_LIMIT`.
- Setup searah dengan zona dan waktu berdekatan ditandai `DUPLICATE_CLUSTER`.
- Setiap setup memiliki entry, SL, TP, BE, timer, dan lifecycle sendiri.

## Panel Scalper Entry Watch

Kartu **Scalper Engine · Shadow Mode** muncul pada halaman Mapping setelah Rencana Eksekusi dan menampilkan:

- model IFVG atau FVG BUY High Quality;
- arah BUY/SELL;
- H1 bias;
- entry;
- Stop Loss;
- trigger BE 1R;
- target 2R;
- sisa candle;
- status lifecycle;
- setup aktif lainnya;
- status `VALID`, `RISK_LIMIT`, atau `DUPLICATE_CLUSTER`.

Panel membaca backend setiap 30 detik dan tidak mengganti hasil Mapping lama.

## Lifecycle Setup

```text
WAITING_NEXT_OPEN
→ ACTIVE
→ BE_ACTIVE
→ TP_HIT / SL_HIT / BE_HIT / TIME_EXIT
```

Status tambahan:

- `INVALIDATED`
- `CANCELLED`
- `RISK_LIMIT`
- `DUPLICATE_CLUSTER`

Proteksi live-only memastikan setup historis atau backfill tidak dikirim sebagai notifikasi baru.

## Notifikasi Preview

Sinyal scalper memakai kanal Android terpisah:

```text
Amy FX Scalper Signals
```

Notifikasi dikirim untuk:

- sinyal terkonfirmasi;
- entry siap;
- harga mencapai 1R;
- TP, SL, BE, atau time exit;
- perubahan lifecycle penting.

Semua notifikasi tetap diberi label **SIMULASI**. Ketika 1R tercapai, aplikasi hanya memberi instruksi untuk memindahkan SL broker secara manual ke harga entry.

Sistem breaking news tetap memakai kanal dan alur yang sudah ada.

## Backend dan Struktur Utama

```text
app/src/main/assets/                         WebView assets
app/src/main/assets/apps/mapping             Mapping, Rencana Eksekusi, Scalper Entry Watch
app/src/main/assets/apps/market-intel        News, heatmap, dan liquidity
app/src/main/assets/apps/journal             Jurnal Trading
app/src/main/assets/apps/academy             Materi belajar
app/src/main/java/                           Android native Kotlin dan FCM
supabase/functions/scalper-engine/           Engine sinyal dan lifecycle
supabase/functions/scalper-setups/           API tampilan setup Preview
supabase/functions/scalper-system-push/      Pengiriman FCM scalper
supabase/migrations/                         Schema dan scheduler backend
api/                                         Vercel serverless functions lain
lib/                                         Shared backend logic
tests/                                       Regression dan scalper engine tests
.github/workflows/                            CI dan build APK Preview
```

## Alur Build Preview

Workflow Preview berada di:

```text
.github/workflows/amyfx-blueprint-preview-release.yml
```

Workflow hanya berjalan untuk branch `personal/amyfx-private` dan melakukan:

1. validasi identitas branch personal;
2. stabilisasi source Preview;
3. regression test JavaScript;
4. pengujian scalper engine;
5. Android unit test dan lint;
6. build APK release bertanda tangan;
7. verifikasi package, label, versi, dan sertifikat signer;
8. publikasi release Amy FX Preview;
9. pembaruan `preview-update.json` pada branch personal.

Proses Preview tidak menggunakan atau mengubah branch `main`.

## Aturan Pengembangan

- Fokus pekerjaan berada di `personal/amyfx-private`.
- Jangan menyentuh atau merge ke `main` tanpa instruksi khusus.
- Jangan mengubah package, URI scheme, data aplikasi, signing certificate, atau update channel Preview.
- Modul baru harus dibuat terisolasi dan tidak boleh merusak Mapping, News, Journal, Academy, atau fitur lain.
- Engine live harus memakai candle yang sudah close dan tidak boleh memakai future candle.
- Setup historis tidak boleh dikirim sebagai notifikasi live.
- Shadow Mode harus tetap dipertahankan sampai hasil live dan lifecycle terbukti stabil.

## Disclaimer

Amy FX Preview bukan robot trading, Expert Advisor, atau penasihat keuangan. Aplikasi tidak membuka atau menutup order secara otomatis dan tidak menjamin hasil tertentu. Seluruh informasi merupakan alat bantu analisis dan simulasi; keputusan serta risiko tetap berada pada pengguna.
