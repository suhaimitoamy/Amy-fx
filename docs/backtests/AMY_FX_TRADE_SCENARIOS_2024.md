# Amy FX — Backtest Saran Level Dua Skenario 2024

> **Status:** final untuk pengecekan awal akurasi desain Saran Level.  
> **Periode:** XAU/USD Januari–Desember 2024.  
> **Versi aplikasi dan jalur rilis tidak diubah.**

## Aturan yang diuji

- Timeframe pemicu: **M15**.
- Resistance dan support: ekstrem **32 candle M15 tertutup** terakhir.
- Buy aktif setelah candle M15 close di atas resistance + **0,05 ATR**.
- Sell aktif setelah candle M15 close di bawah support − **0,05 ATR**.
- Skenario pertama yang aktif membatalkan sisi berlawanan.
- Fill memakai harga close candle pemicu.
- Stop struktural memakai padding **0,75 ATR**.
- TP1 = **0,5R** dan TP2 = **1,0R**.
- Masa berlaku: **32 candle M15 / 8 jam**.
- Snapshot tidak tumpang tindih dan memakai warm-up **299 candle tertutup**.
- Tidak ada look-ahead. Jika stop dan target tersentuh dalam candle yang sama, stop dihitung lebih dahulu.

## Hasil keseluruhan

| Metrik | Hasil |
|---|---:|
| Snapshot | 731 |
| Skenario aktif | 524 |
| Tingkat aktivasi | 71.68% |
| Buy aktif | 308 |
| Sell aktif | 216 |
| Tidak ada trigger | 207 |
| **TP1 tercapai sebelum stop** | **320 / 524 = 61.07%** |
| Wilson 95% CI TP1 | 56.83–65.15% |
| **TP2 tercapai sebelum stop** | **230 / 524 = 43.89%** |
| Wilson 95% CI TP2 | 39.70–48.17% |
| Stop sebelum TP1 | 192 / 524 = 36.64% |
| TP1 lalu stop sebelum TP2 | 63 / 524 = 12.02% |
| Tidak menyentuh TP1 maupun SL sampai expiry | 12 / 524 = 2.29% |
| TP1 tercapai lalu expiry tanpa TP2/SL | 27 / 524 = 5.15% |

## Hasil per bulan

| Bulan | Snapshot | Aktif | Aktivasi | TP1 | TP2 | Stop sebelum TP1 |
|---|---:|---:|---:|---:|---:|---:|
| 2024-01 | 54 | 36 | 66.67% | 66.67% | 44.44% | 33.33% |
| 2024-02 | 60 | 40 | 66.67% | 75.00% | 45.00% | 25.00% |
| 2024-03 | 58 | 37 | 63.79% | 59.46% | 51.35% | 37.84% |
| 2024-04 | 63 | 48 | 76.19% | 75.00% | 56.25% | 18.75% |
| 2024-05 | 65 | 47 | 72.31% | 53.19% | 40.43% | 44.68% |
| 2024-06 | 58 | 42 | 72.41% | 47.62% | 35.71% | 50.00% |
| 2024-07 | 66 | 49 | 74.24% | 61.22% | 48.98% | 36.73% |
| 2024-08 | 62 | 43 | 69.35% | 58.14% | 39.53% | 37.21% |
| 2024-09 | 61 | 42 | 68.85% | 64.29% | 47.62% | 30.95% |
| 2024-10 | 66 | 47 | 71.21% | 59.57% | 40.43% | 38.30% |
| 2024-11 | 59 | 46 | 77.97% | 56.52% | 32.61% | 43.48% |
| 2024-12 | 59 | 47 | 79.66% | 57.45% | 44.68% | 42.55% |

## Kesimpulan

Desain dua skenario kondisional lebih terukur daripada Outlook arah tunggal pada data 2024. Skenario tidak menebak sisi sebelum market memilih; sistem menunggu close M15 valid. Dengan definisi TP1 0,5R, tingkat keberhasilan awal adalah **61.07%**. Untuk TP2 1,0R, hasilnya **43.89%**.

## Batasan

- Spread, slippage, komisi, dan perbedaan eksekusi broker belum dimodelkan.
- News historis tidak dimasukkan.
- Pengujian ini memakai M15 saja dan mengevaluasi level kondisional, bukan profitabilitas akun.
- TP1 0,5R dan TP2 1,0R adalah aturan tetap yang dikunci sebelum hasil dibaca.

## Audit

- Jumlah candle M15: **23.713**.
- Rentang UTC: **2024-01-01T18:00:00.000Z — 2024-12-31T16:45:00.000Z**.
- SHA-256 raw records: `4fceba6250aa2eb2a375cfa4b777766a054926445abe584ecf48302aada5fc3f`.
