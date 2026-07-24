# Amy FX — Backtest M5 Reaction First 2024

> **Status:** iterasi baru setelah logika breakout/retest dan stop-order dinyatakan gagal.  
> **Periode:** XAU/USD Januari–Desember 2024.  
> **Signal:** seluruh keputusan setup memakai M5. M1 hanya dipakai untuk menyelesaikan urutan entry, SL, dan TP.

## Logika yang diuji

1. Cari **fresh FVG M5** yang diciptakan displacement valid.
2. Gunakan **first touch** saja; zona yang invalid atau kedaluwarsa dibuang.
3. Tunggu candle M5 close rejection kembali keluar dari FVG.
4. Entry pada **50% FVG** maksimal 5 candle M5 setelah konfirmasi.
5. SL berada di luar FVG + buffer 0,12 ATR.
6. Setup hanya dipakai bila jarak risiko **0,60–4,00 poin**.
7. Nearest strong liquidity harus menyediakan ruang minimal **2R**.
8. TP1 = **1,5R**, TP2 = **2R**.
9. Jika first touch sekaligus menyapu liquidity 5 candle, setup diberi **Grade A**.
10. Tidak ada posisi tumpang tindih. Jika SL dan TP tersentuh pada menit yang sama, SL dihitung lebih dahulu.

## Arus deteksi

| Tahap | Jumlah |
|---|---:|
| Fresh FVG berkualitas | 5366 |
| Mendapat first touch | 4194 |
| Mendapat rejection M5 | 2348 |
| Lolos batas risiko | 796 |
| Lolos ruang liquidity 2R | 354 |
| Pending entry tersentuh | 171 |
| **Entry final non-overlap** | **165** |

## Hasil keseluruhan

| Metrik | Hasil |
|---|---:|
| Entry | 165 |
| Buy / Sell | 81 / 84 |
| Grade A | 44 |
| **TP1 1,5R** | **89/165 = 53.94%** |
| **TP2 2R** | **70/165 = 42.42%** |
| SL sebelum TP1 | 76/165 = 46.06% |
| TP1 lalu kembali ke SL | 19/165 = 11.52% |
| SL langsung pada menit entry | 25/165 = 15.15% |
| Rata-rata / median risiko | 0.869 / 0.759 poin |
| Ekspektasi TP1 sebelum biaya | **0.348R/entry** |
| Ekspektasi TP2 sebelum biaya | **0.273R/entry** |

## Grade A — FVG + sweep liquidity

| Metrik | Hasil |
|---|---:|
| Entry | 44 |
| TP1 1,5R | 63.64% |
| TP2 2R | 50.00% |
| Ekspektasi TP2 | 0.500R/entry |

## Pemisahan pengembangan dan validasi

| Bagian | Entry | TP1 | TP2 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|
| Jan–Agu 2024 | 111 | 55.86% | 45.05% | 0.351R |
| Sep–Des 2024 | 54 | 50.00% | 37.04% | 0.111R |

## Stress biaya terhadap model TP2

| Biaya pulang-pergi | Ekspektasi setelah pengurang biaya |
|---|---:|
| 0.10 poin | 0.148R |
| 0.15 poin | 0.085R |
| 0.20 poin | 0.022R |
| 0.25 poin | -0.040R |
| 0.30 poin | -0.103R |

## Hasil bulanan

| Bulan | Entry | Buy | Sell | TP1 | TP2 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|---:|---:|
| 2024-01 | 6 | 3 | 3 | 83.33% | 66.67% | 1.000R |
| 2024-02 | 2 | 2 | 0 | 0.00% | 0.00% | -1.000R |
| 2024-03 | 9 | 4 | 5 | 44.44% | 44.44% | 0.333R |
| 2024-04 | 29 | 11 | 18 | 41.38% | 31.03% | -0.069R |
| 2024-05 | 19 | 13 | 6 | 57.89% | 47.37% | 0.421R |
| 2024-06 | 14 | 9 | 5 | 71.43% | 64.29% | 0.929R |
| 2024-07 | 17 | 7 | 10 | 58.82% | 41.18% | 0.235R |
| 2024-08 | 15 | 7 | 8 | 66.67% | 53.33% | 0.600R |
| 2024-09 | 7 | 4 | 3 | 57.14% | 42.86% | 0.286R |
| 2024-10 | 11 | 5 | 6 | 45.45% | 36.36% | 0.091R |
| 2024-11 | 18 | 6 | 12 | 61.11% | 44.44% | 0.333R |
| 2024-12 | 18 | 10 | 8 | 38.89% | 27.78% | -0.167R |

## Sepuluh contoh entry

| No. | Entry | Sisi | Grade | Harga entry | SL | TP1 | TP2 | Hasil |
|---:|---|---|---|---:|---:|---:|---:|---|
| 1 | 2024-01-02 07:35 UTC | SELL | B | 2068.08 | 2068.77 | 2067.05 | 2066.71 | TP2 |
| 2 | 2024-04-01 10:48 UTC | SELL | B | 2234.36 | 2235.68 | 2232.38 | 2231.72 | SL |
| 3 | 2024-04-17 13:17 UTC | SELL | B | 2372.55 | 2373.51 | 2371.12 | 2370.65 | TP2 |
| 4 | 2024-05-15 08:30 UTC | SELL | A | 2364.98 | 2365.68 | 2363.93 | 2363.58 | SL |
| 5 | 2024-06-17 04:08 UTC | SELL | B | 2318.48 | 2319.19 | 2317.41 | 2317.05 | SL |
| 6 | 2024-07-25 05:37 UTC | SELL | B | 2373.86 | 2374.62 | 2372.71 | 2372.33 | SL |
| 7 | 2024-08-29 04:55 UTC | SELL | B | 2517.41 | 2518.13 | 2516.34 | 2515.98 | TP2 |
| 8 | 2024-10-31 21:41 UTC | SELL | B | 2748.13 | 2748.94 | 2746.90 | 2746.49 | SL |
| 9 | 2024-11-28 22:54 UTC | BUY | B | 2657.39 | 2656.40 | 2658.88 | 2659.37 | TP2 |
| 10 | 2024-12-23 11:22 UTC | SELL | B | 2611.34 | 2612.06 | 2610.26 | 2609.91 | SL |

## Kesimpulan

Logika M5 Reaction First menghasilkan lebih sedikit entry daripada stop-order massal, tetapi kualitasnya lebih baik. Hasil mentah tetap positif pada bagian validasi Sep–Des 2024. Namun edge menjadi sangat tipis pada asumsi biaya sekitar 0,25 poin dan negatif di atasnya. Karena itu hasil ini **belum menjadi bukti final untuk live trading** dan masih perlu pengujian tahun lain serta biaya broker nyata.

## Audit

- M5: **71.133 candle**.
- M1: **355.592 candle**.
- SHA-256 raw records: `bb4f3407bcf7f0ef6a4cb96d479d04630791704c8a5128f727a5150dd198c1ec`.
