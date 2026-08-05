# Amy FX Preview — Personal Build

Amy FX Preview adalah aplikasi Android hybrid untuk pemetaan market **XAU/USD**, Rencana Eksekusi, Entry Watch, jurnal trading, market intelligence, dan materi belajar. Source Preview berada pada branch khusus dan terpisah dari Amy FX publik.

> **Release aktif:** `2.0.0-preview.314`  
> **Version code:** `940314`  
> **Tanggal rilis:** 5 Agustus 2026

[Download Amy FX Preview 2.0.0-preview.314](https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-blueprint-preview-2.0.0-preview.314/AmyFX-Preview-latest.apk)

## Status Release `.314`

Preview `.314` menambahkan konteks Mapping yang lebih lengkap tanpa memberikan otoritas entry kepada indikator mentah. Formula Direction Forecast, Mapping Accuracy V3, entry, Stop Loss, Take Profit, dan lifecycle setup tidak diubah.

Perubahan utama:

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
- Data stale, forecast terminal, atau setup terminal tetap menghasilkan WAIT.

## Sesi DST-Aware

Entry Map tidak lagi bergantung pada satu jam WITA tetap sepanjang tahun.

- London memakai `Europe/London` dan mengikuti GMT/BST.
- New York memakai `America/New_York` dan mengikuti EST/EDT.
- Jam yang ditampilkan kepada pengguna tetap dikonversi ke WITA.
- Mode sesi tiap timeframe tetap mengikuti profil Mapping yang sudah ada.

Perubahan ini memperbaiki jam gate sesi; tidak mengubah rumus sweep, MSS, dealing location, Entry, SL, TP, atau target struktural.

## Konteks Likuiditas Tambahan

### PMH/PML

Previous Month High dan Previous Month Low ditambahkan sebagai external liquidity. Level ini dipakai untuk konteks, terutama pada timeframe tinggi, bukan sebagai trigger entry langsung.

### Strong/Weak High-Low

- **Strong Low:** protected low bullish yang masih utuh.
- **Weak High:** BSL aktif yang menjadi liquidity context pada struktur bullish.
- **Strong High:** protected high bearish yang masih utuh.
- **Weak Low:** SSL aktif yang menjadi liquidity context pada struktur bearish.

Label ini menjelaskan level yang harus bertahan dan sisi likuiditas yang dapat dipantau. Label bukan jaminan target tercapai.

### Midnight Open

Midnight Open memakai kalender `America/New_York`. Engine mencatat:

- harga open pukul 00:00 New York;
- departure yang bersih dari level;
- status menunggu retest;
- retest yang sudah dikonfirmasi.

Midnight Open tetap hanya contextual confluence.

## Freshness Zona

Setiap FVG dan Order Block memiliki audit snapshot tambahan:

- `FRESH` hanya bila belum pernah disentuh atau dimitigasi sebelum snapshot;
- zona yang sedang diuji tidak boleh disebut fresh;
- zona dengan confirmed reaction tetap dipisahkan dari zona mentah;
- zona terminal atau accepted-broken tidak dapat dipromosikan kembali menjadi fresh.

Lifecycle zona produksi tetap menjadi sumber status utama.

## Eksperimen Advisory

### Adaptive EQH/EQL

Toleransi kandidat Equal High/Equal Low dapat menyesuaikan timeframe, tetapi outputnya ditandai:

```text
EXPERIMENTAL_ADVISORY
appliedToProduction: false
executionAuthority: false
```

### Dual-Origin Order Block Review

Order Block produksi tetap memakai origin yang sudah terkunci. Engine tambahan hanya membandingkan kandidat ekstrem dalam causal impulse leg dan tidak memindahkan batas OB produksi.

## Identitas Amy FX Preview

| Properti | Nilai |
|---|---|
| Nama aplikasi | `Amy FX Preview` |
| Branch | `personal/amyfx-private` |
| Application ID | `com.amyelitesuite.learningpreview` |
| URI scheme | `amyfxpreview` |
| Version name | `2.0.0-preview.314` |
| Version code | `940314` |
| Minimum Android | Android 8.0 / API 26 |
| Target SDK | Android SDK 35 |
| Update channel | `personal/amyfx-private/preview-update.json` |
| Release tag | `amyfx-blueprint-preview-2.0.0-preview.314` |
| APK | `AmyFX-Preview-latest.apk` |

Package, URI, signing certificate, update channel, dan data pengguna Preview tetap terpisah dari Amy FX publik.

## Arsitektur Market Data

```text
Twelve Data WebSocket
        └── Harga live di layar

Candle terakhir yang sudah close
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

## Validasi Release `.314`

Sebelum commit implementasi:

- test khusus sesi DST-aware lulus;
- test PMH/PML, Strong/Weak, adaptive EQH/EQL, dual-origin OB, dan evidence contract lulus;
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

Release `.314` hanya dikerjakan pada `personal/amyfx-private`. Branch `main`, package produksi, URI produksi, signing produksi, update channel produksi, APK produksi, dan data pengguna produksi tidak disentuh.

## Disclaimer

Amy FX Preview adalah alat bantu analisis dan pembelajaran. Aplikasi tidak menjamin profit, tidak membuktikan bahwa setiap konteks memiliki edge, dan tidak membuka, mengubah, atau menutup order broker secara otomatis. Validasi statistik tetap harus dipisahkan antara in-sample, out-of-sample, dan forward test.