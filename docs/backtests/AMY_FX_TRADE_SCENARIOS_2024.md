# Amy FX — Backtest Saran Level RR Sehat 2024

> **Status:** final untuk iterasi RR 1:1,5 dan 1:2.  
> **Periode:** XAU/USD Januari–Desember 2024.  
> **Versi aplikasi dan jalur rilis tidak diubah.**

## Perubahan aturan

- Dua skenario OCO tetap tersedia: Buy dan Sell.
- Resistance/support memakai ekstrem **32 candle M15 tertutup** terakhir.
- Sisi dipilih setelah close M15 melewati level breakout dengan buffer **0,05 ATR**.
- Entry tidak dikejar pada candle breakout. Harga wajib **retest level entry maksimal 8 candle M15**.
- Stop Loss berada **1 ATR** di balik resistance/support asal.
- TP1 = **1,5R**.
- TP2 = **2R**.
- Setup berlaku **32 candle M15 / 8 jam**.
- Setelah trade selesai atau setup kedaluwarsa, setup baru langsung dipersenjatai. Tidak ada trade yang tumpang tindih.
- Tidak ada look-ahead. Pada konflik intrabar, termasuk candle retest, **stop dihitung lebih dahulu**.

## Arus setup

| Metrik | Hasil |
|---|---:|
| Setup dipersenjatai | 1008 |
| Breakout/breakdown terjadi | 764 |
| Tidak ada breakout | 244 |
| Breakout tanpa retest | 164 |
| **Entry valid** | **600** |
| Entry dari seluruh setup | 59.52% |
| Entry setelah breakout | 78.53% |

Dibanding iterasi lama yang menghasilkan 524 entry aktif, iterasi ini menghasilkan **600 entry**, bertambah **76 entry atau 14.50%** tanpa membuka dua posisi yang saling berlawanan secara bersamaan.

## Hasil keseluruhan

| Metrik | Hasil |
|---|---:|
| Entry | 600 |
| Buy | 373 |
| Sell | 227 |
| **TP1 1,5R tercapai** | **246/600 = 41.00%** |
| Wilson 95% CI TP1 | 37.13–44.98% |
| **TP2 2R tercapai** | **199/600 = 33.17%** |
| Wilson 95% CI TP2 | 29.52–37.03% |
| Stop sebelum TP1 | 322/600 = 53.67% |
| TP1 lalu stop sebelum TP2 | 29/600 = 4.83% |
| TP1 lalu expiry tanpa TP2/SL | 18/600 = 3.00% |
| Tidak menyentuh TP1 atau SL | 32/600 = 5.33% |
| Rata-rata jarak risiko | 2.96 poin |
| Median jarak risiko | 2.68 poin |
| Ekspektasi target TP1 sebelum biaya | **0.078R/entry** |
| Ekspektasi target TP2 sebelum biaya | **0.078R/entry** |

## Hasil per sisi

| Sisi | Entry | TP1 1,5R | TP2 2R | Ekspektasi TP1 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|---:|
| Buy | 373 | 40.75% | 33.78% | 0.083R | 0.105R |
| Sell | 227 | 41.41% | 32.16% | 0.070R | 0.035R |

## Konsistensi per bulan

| Bulan | Entry | Buy | Sell | TP1 1,5R | TP2 2R | Ekspektasi TP1 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2024-01 | 39 | 26 | 13 | 23.08% | 17.95% | -0.372R | -0.385R |
| 2024-02 | 47 | 28 | 19 | 46.81% | 44.68% | 0.191R | 0.362R |
| 2024-03 | 42 | 27 | 15 | 54.76% | 50.00% | 0.393R | 0.524R |
| 2024-04 | 44 | 27 | 17 | 52.27% | 40.91% | 0.375R | 0.364R |
| 2024-05 | 62 | 31 | 31 | 43.55% | 38.71% | 0.137R | 0.226R |
| 2024-06 | 48 | 29 | 19 | 37.50% | 31.25% | 0.042R | 0.063R |
| 2024-07 | 65 | 41 | 24 | 43.08% | 32.31% | 0.108R | 0.031R |
| 2024-08 | 48 | 26 | 22 | 33.33% | 29.17% | -0.083R | 0.000R |
| 2024-09 | 45 | 36 | 9 | 44.44% | 37.78% | 0.222R | 0.244R |
| 2024-10 | 62 | 44 | 18 | 30.65% | 24.19% | -0.153R | -0.161R |
| 2024-11 | 51 | 28 | 23 | 47.06% | 29.41% | 0.176R | -0.059R |
| 2024-12 | 47 | 30 | 17 | 36.17% | 23.40% | -0.074R | -0.213R |

Jumlah entry bulanan berada pada rentang **39–65 entry**. Frekuensi entry relatif terjaga, tetapi hasil tidak merata: beberapa bulan masih negatif. Karena pengujian hanya memakai 2024, angka ini belum boleh dianggap edge final lintas rezim.

## Sepuluh contoh entry nyata

| No. | Entry | Sisi | Harga entry | Stop | TP1 | TP2 | Hasil |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | 2024-01-05 02:00 UTC | SELL | 2042.65 | 2044.02 | 2040.60 | 2039.92 | SL |
| 2 | 2024-02-20 07:15 UTC | BUY | 2027.06 | 2025.42 | 2029.51 | 2030.33 | TP2 |
| 3 | 2024-04-03 15:00 UTC | BUY | 2295.34 | 2289.59 | 2303.98 | 2306.86 | TP1 lalu expiry |
| 4 | 2024-05-15 00:00 UTC | BUY | 2359.63 | 2358.23 | 2361.73 | 2362.43 | SL |
| 5 | 2024-06-24 05:00 UTC | BUY | 2326.71 | 2323.99 | 2330.79 | 2332.15 | TP1 lalu SL |
| 6 | 2024-07-24 09:00 UTC | BUY | 2419.23 | 2416.79 | 2422.88 | 2424.10 | TP1 lalu SL |
| 7 | 2024-09-06 00:00 UTC | BUY | 2517.88 | 2516.80 | 2519.51 | 2520.05 | TP2 |
| 8 | 2024-10-10 15:30 UTC | BUY | 2629.81 | 2624.59 | 2637.63 | 2640.24 | TP1 lalu expiry |
| 9 | 2024-11-18 22:15 UTC | BUY | 2624.18 | 2621.42 | 2628.32 | 2629.70 | SL |
| 10 | 2024-12-31 10:15 UTC | BUY | 2617.72 | 2614.98 | 2621.83 | 2623.20 | TP2 |

## Kesimpulan

- Frekuensi entry tidak berkurang: **524 → 600**.
- RR sudah diperbaiki menjadi **TP1 1:1,5** dan **TP2 1:2**.
- Hit rate memang turun dibanding target lama yang terlalu dekat, tetapi ekspektasi matematis awal menjadi **positif 0.078R–0.078R per entry sebelum biaya**.
- Edge masih tipis dan tidak konsisten setiap bulan. Spread, slippage, komisi, news, serta eksekusi broker dapat menghapus keunggulan tersebut.

## Batasan

- Spread, slippage, komisi, dan perbedaan eksekusi broker belum dimodelkan.
- News historis tidak dimasukkan.
- Ini merupakan backtest in-sample pada 2024 dan belum divalidasi pada tahun lain.
- Ekspektasi TP1 menganggap posisi ditutup penuh di 1,5R. Ekspektasi TP2 menganggap posisi ditutup penuh di 2R; trade yang mencapai TP1 lalu kembali ke SL dihitung rugi untuk model TP2.

## Audit

- Jumlah candle M15: **23.713**.
- Rentang UTC: **2024-01-01T18:00:00.000Z — 2024-12-31T16:45:00.000Z**.
- SHA-256 raw records: `0b7f5010d3d7b1cec6be8768cf73481bf1f4ab1c0340b9ada6e1f7b77dc74c90`.
