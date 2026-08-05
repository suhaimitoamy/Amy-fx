# Amy FX Preview — Personal Build

Amy FX Preview adalah aplikasi Android hybrid untuk pemetaan market **XAU/USD**, Rencana Eksekusi, Entry Watch, jurnal trading, market intelligence, dan materi belajar. Source Preview berada pada branch khusus dan terpisah dari Amy FX publik.

> **Release aktif:** `2.0.0-preview.315`  
> **Version code:** `940315`  
> **Tanggal rilis:** 5 Agustus 2026

[Download Amy FX Preview 2.0.0-preview.315](https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-blueprint-preview-2.0.0-preview.315/AmyFX-Preview-latest.apk)

## Status Release `.315`

Preview `.315` memperbaiki ketidakjujuran antara data candle, detector struktur, dan tampilan Mapping. Perbaikan ini tidak memaksa arah BUY/SELL; tujuannya memastikan UI menampilkan hasil engine dan kondisi sumber candle yang sebenarnya.

Perubahan utama `.315`:

- panel **Valid Break** membaca schema struktur modern (`concept`, `direction`, `level`, `status`) maupun schema legacy;
- BOS/MSS terkonfirmasi tidak lagi hilang hanya karena renderer mencari field lama;
- tulisan `Data belum cukup` hanya digunakan bila jumlah candle tertutup benar-benar kurang dari minimum;
- bila 300 candle tersedia tetapi analisis gagal, UI menampilkan `Analisis gagal meski 300 candle tersedia` beserta error sebenarnya;
- freshness memakai timestamp candle tertutup terbaru, bukan waktu fetch request;
- provider yang tertinggal ditampilkan sebagai `CANDLE TERTUNDA N BAR` dan tidak disamarkan menjadi `CANDLE TERTUTUP`;
- kegagalan refresh timeframe aktif ikut diteruskan sebagai warning;
- perubahan konteks `.314` tetap dipertahankan.

Direction Forecast, Mapping Accuracy V3, rumus Entry, Stop Loss, Take Profit, target struktural, lifecycle setup, Execution Authority, package, signer, dan data pengguna tidak diubah.

## Perubahan Konteks yang Dipertahankan dari `.314`

- kontrak bukti `RAW_OBSERVATION`, `VALIDATED_CONTEXT`, `VALIDATED_CLAIM`, dan `EXECUTION_AUTHORITY`;
- sesi London dan New York mengikuti timezone pasar serta perubahan BST/GMT dan EDT/EST secara otomatis, lalu ditampilkan dalam WITA;
- Previous Month High dan Previous Month Low sebagai external-liquidity context;
- Strong/Weak High-Low berdasarkan protected structure dan active liquidity;
- New York Midnight Open departure/retest sebagai konteks;
- audit freshness untuk mencegah zona yang sudah tersentuh atau termitigasi disebut fresh-at-snapshot;
- adaptive EQH/EQL per timeframe sebagai advisory experiment;
- alternatif origin Order Block dalam causal impulse leg sebagai advisory review.

Adaptive EQH/EQL dan alternatif origin Order Block **belum mengganti logika produksi**. Keduanya hanya mengeluarkan metadata eksperimen sampai memiliki validasi out-of-sample yang cukup.

## Aturan Otoritas

Urutan kelas bukti:

```text
RAW OBSERVATION
        ↓
VALIDATED CONTEXT
        ↓
VALIDATED CLAIM
        ↓
EXECUTION AUTHORITY
```

Ketentuan:

- FVG, Order Block, sweep, liquidity level, PMH/PML, Midnight Open, atau Strong/Weak High-Low tidak dapat membuka entry sendiri.
- Context tambahan tidak boleh mengubah arah Direction Forecast.
- BUY/SELL hanya berasal dari setup resmi yang sudah lolos seluruh gate dan diteruskan melalui `setupExecution`.
- Rencana Eksekusi, Entry Watch, scanner, dan notifikasi harus membaca authority yang sama.
- Data provider tertunda, forecast terminal, atau setup terminal tetap menghasilkan WAIT.

## Kebenaran Data Candle

Amy FX Preview membedakan tiga kondisi yang sebelumnya dapat tercampur:

1. **Data benar-benar kurang** — jumlah candle tertutup berada di bawah minimum.
2. **Analisis gagal** — candle cukup, tetapi engine menghasilkan exception; error ditampilkan apa adanya.
3. **Provider tertunda** — jumlah candle banyak, tetapi timestamp candle terakhir tertinggal dari candle tertutup yang seharusnya tersedia.

Jumlah `300/300` tidak lagi dianggap bukti bahwa data terbaru. Freshness ditentukan dari timestamp candle terakhir yang sudah close.

## Valid Break

Panel Valid Break membaca event struktur dari jalur berikut:

- `st.lastEvent`;
- `st.last`;
- `marketConcepts.structure.lastEvent`;
- `marketConcepts.structure.last`;
- `structureSnapshot.latestStructure`;
- `lastConfirmedBreak`.

Event modern dengan `status: CONFIRMED_BREAK` dan `valid: true` diterjemahkan sebagai valid BOS/MSS. Break candidate, liquidity sweep, failed break, dan confirmed break tetap dibedakan; renderer tidak boleh mengubah candidate menjadi confirmed break.

## Sesi DST-Aware

Entry Map tidak lagi bergantung pada satu jam WITA tetap sepanjang tahun.

- London memakai `Europe/London` dan mengikuti GMT/BST.
- New York memakai `America/New_York` dan mengikuti EST/EDT.
- Jam yang ditampilkan kepada pengguna tetap dikonversi ke WITA.
- Mode sesi tiap timeframe tetap mengikuti profil Mapping yang sudah ada.

Perubahan ini memperbaiki jam gate sesi; tidak mengubah rumus sweep, MSS, dealing location, Entry, SL, TP, atau target struktural.

## Konteks Likuiditas Tambahan

### PMH/PML

Previous Month High dan Previous Month Low digunakan sebagai external liquidity, terutama pada timeframe tinggi. Level tersebut bukan trigger entry langsung.

### Strong/Weak High-Low

- **Strong Low:** protected low bullish yang masih utuh.
- **Weak High:** BSL aktif yang menjadi liquidity context pada struktur bullish.
- **Strong High:** protected high bearish yang masih utuh.
- **Weak Low:** SSL aktif yang menjadi liquidity context pada struktur bearish.

Label menjelaskan struktur dan sisi likuiditas yang dapat dipantau, bukan jaminan target tercapai.

### Midnight Open

Midnight Open memakai kalender `America/New_York`. Engine mencatat harga open pukul 00:00 New York, departure, status menunggu retest, dan confirmed retest. Midnight Open tetap contextual confluence.

## Freshness Zona

- `FRESH` hanya bila zona belum pernah disentuh atau dimitigasi sebelum snapshot;
- zona yang sedang diuji tidak boleh disebut fresh;
- confirmed reaction dipisahkan dari zona mentah;
- zona terminal atau accepted-broken tidak dapat dipromosikan kembali menjadi fresh.

Lifecycle zona produksi tetap menjadi sumber status utama.

## Identitas Amy FX Preview

| Properti | Nilai |
|---|---|
| Nama aplikasi | `Amy FX Preview` |
| Branch | `personal/amyfx-private` |
| Application ID | `com.amyelitesuite.learningpreview` |
| URI scheme | `amyfxpreview` |
| Version name | `2.0.0-preview.315` |
| Version code | `940315` |
| Minimum Android | Android 8.0 / API 26 |
| Target SDK | Android SDK 35 |
| Update channel | `personal/amyfx-private/preview-update.json` |
| Release tag | `amyfx-blueprint-preview-2.0.0-preview.315` |
| APK | `AmyFX-Preview-latest.apk` |

Package, URI, signing certificate, update channel, dan data pengguna Preview tetap terpisah dari Amy FX publik.

## Arsitektur Market Data

```text
Twelve Data WebSocket
        └── Harga live di layar

Candle terakhir yang sudah close
        ↓
Timestamp/source freshness validation
        ↓
Mapping closed-candle runtime
        ↓
Structure + Liquidity + Context
        ↓
Direction Forecast
        ↓
Setup resmi
        ↓
Execution Authority
        ├── Rencana Eksekusi
        ├── Entry Watch
        ├── Scanner
        └── Notifikasi
```

Harga live hanya memperbarui tampilan harga dan tidak boleh menghitung atau merender ulang Mapping.

## Validasi Release `.315`

Sebelum rilis:

- test schema Valid Break modern dan legacy lulus;
- test 300 candle + analysis error lulus;
- test provider-delayed candle source lulus;
- test current closed-candle source lulus;
- seluruh regression JavaScript lulus;
- Android unit test lulus;
- Android lint lulus;
- debug build lulus.

Pipeline release resmi kemudian menjalankan ulang:

- Blueprint stabilization;
- seluruh regression JavaScript;
- Android release unit test;
- Android release lint;
- signed release build;
- verifikasi package, label, version code, version name, dan signer;
- publikasi APK serta checksum SHA-256;
- aktivasi `preview-update.json` setelah APK berhasil diverifikasi.

## Branch Boundary

```text
personal/amyfx-private  → Amy FX Preview
main                    → Amy FX publik
```

Release `.315` hanya dikerjakan pada `personal/amyfx-private`. Branch `main`, package produksi, URI produksi, signing produksi, update channel produksi, APK produksi, dan data pengguna produksi tidak disentuh.

## Disclaimer

Amy FX Preview adalah alat bantu analisis dan pembelajaran. Aplikasi tidak menjamin profit dan tidak membuktikan bahwa setiap konteks memiliki edge. Validasi statistik tetap harus dipisahkan antara in-sample, out-of-sample, dan forward test.
