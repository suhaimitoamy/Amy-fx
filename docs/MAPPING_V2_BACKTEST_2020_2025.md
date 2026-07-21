# Amy FX Mapping V2 — Backtest 2020–2025

Branch: `experiment/mapping-regime-engine-20260721`

## Dataset

- Symbol: XAU/USD
- Periode: Januari 2020–Desember 2025
- Timeframe utama: M15
- Candle M15: **138.750**
- Candle H1: **34.703**
- Candle H4: **9.555**
- Candle D1: **1.866**
- Data 2026 tidak digunakan.
- Semua keputusan dihitung dengan candle yang sudah tersedia pada saat pengamatan; candle masa depan hanya dipakai untuk penilaian hasil.

## Hasil Market Shift Detector

Definisi pergantian mayor pada pengujian: flip struktur pivot 4/4 yang kemudian menghasilkan pergerakan searah minimal 1,1 ATR dan lebih besar daripada adverse excursion.

| Metrik | Hasil |
|---|---:|
| Raw structure flips | 4.001 |
| Pergantian mayor tervalidasi | 1.676 |
| Pergantian yang didahului early warning | 1.369 |
| Recall early warning | **81,68%** |
| Rata-rata lead time | **7,37 candle M15** |
| Median lead time | **8 candle M15 / sekitar 2 jam** |
| Precision peringatan | **15,42%** |

Interpretasi: detector sering melihat pelemahan sebelum flip mayor, tetapi masih menghasilkan terlalu banyak peringatan yang tidak diikuti flip mayor dalam 12 candle berikutnya. Karena itu hasil ini layak sebagai **peringatan konteks**, tetapi belum layak menjadi pemblokir entry otomatis.

## Hasil Regime dan Directional Gate

Backtest horizon 16 candle M15 atau sekitar empat jam, sampling setiap empat candle.

| Metrik | Hasil |
|---|---:|
| Sampel | 34.649 |
| Exact five-class future-regime accuracy | **21,42%** |
| Raw directional accuracy | **49,91%** |
| Regime-gated directional accuracy | **50,27%** |
| Perubahan akurasi | **+0,36 poin persentase** |
| Coverage setelah gate | **16,03%** |

Exact future-regime prediction belum memberikan keunggulan yang cukup. Market Regime V2 harus diperlakukan sebagai klasifikasi kondisi saat ini, bukan ramalan arah empat jam.

## Keputusan Aktivasi

- Decision-first UI: **layak diaktifkan pada branch eksperimen**.
- Market Regime V2: **context-only**.
- Market Shift early warning: **context-only**.
- Strategy Router: menampilkan strategi yang sesuai regime, tetapi belum membuka model entry baru.
- Automatic entry blocking: **dinonaktifkan**.
- `main`: tidak disentuh.

## Batas Kelulusan Sebelum Menjadi Filter Entry

Fitur belum boleh menjadi hard gate sampai validasi berikutnya mencapai seluruh syarat:

1. Precision early warning meningkat tanpa menurunkan recall secara ekstrem.
2. Directional gate memberi peningkatan konsisten pada setiap tahun, bukan hanya agregat.
3. Regime strategy diuji per strategi: trend pullback, range reversal, sweep/MSS, dan breakout.
4. Hasil walk-forward serta out-of-sample tidak memburuk secara material.

## Menjalankan Ulang

```bash
node tools/backtest-shift-lag-v2.mjs /path/to/zips 2020 2025
node tools/backtest-market-regime-v2.mjs /path/to/zips 2020 2025
```

Folder data berisi ZIP bulanan dengan CSV M15, H1, H4, dan D1. File data tidak disimpan di repository.
