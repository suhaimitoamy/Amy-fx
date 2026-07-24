# Amy FX — Perbandingan Retest vs Buy Stop / Sell Stop 2024

> **Status:** final untuk eksperimen stop order 3–4 poin.  
> **Periode:** XAU/USD Januari–Desember 2024.  
> **Catatan:** frasa “3–4 point” diterapkan sebagai **jarak tetap Entry–Stop Loss 3 poin dan 4 poin**.  
> **Versi aplikasi dan jalur rilis tidak diubah.**

## Metodologi yang disamakan

- Level setup dihitung dari **32 candle M15 tertutup**.
- Buy dan Sell selalu dipersenjatai bersamaan sebagai **OCO**; sisi pertama yang aktif membatalkan sisi lawan.
- Buffer pending order: **0,05 ATR M15** di luar resistance/support.
- TP1 = **1,5R** dan TP2 = **2R**.
- Setup berlaku **32 candle M15 / 8 jam**.
- Setup baru dipersenjatai setelah trade selesai atau setup kedaluwarsa; tidak ada posisi tumpang tindih.
- Struktur dan level memakai M15, tetapi urutan trigger dan hasil diselesaikan memakai **355.592 candle M1**.
- Tidak ada look-ahead. Jika SL dan target tersentuh dalam candle M1 yang sama, **SL dihitung lebih dahulu**.
- Spread, slippage, komisi, news, dan perbedaan eksekusi broker belum dimodelkan.

## Model yang dibandingkan

1. **Breakout → Retest:** menunggu close M15 melewati level, lalu entry ketika harga kembali menyentuh level maksimal 8 candle M15.
2. **Stop Order 3 poin:** Buy Stop/Sell Stop aktif saat harga menyentuh pending order; SL tetap 3 poin.
3. **Stop Order 4 poin:** aturan sama, tetapi SL tetap 4 poin.

## Hasil keseluruhan

| Model | Entry | Buy | Sell | TP1 1,5R | TP2 2R | SL sebelum TP1 | SL langsung | Ekspektasi TP1 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Breakout → Retest | 605 | 376 | 229 | 38.18% | 31.57% | 55.87% | 1.82% | **+0.014R** | **+0.036R** |
| Buy Stop/Sell Stop · 3 poin | 1270 | 713 | 557 | 37.56% | 30.08% | 59.37% | 4.72% | **-0.030R** | **-0.050R** |
| Buy Stop/Sell Stop · 4 poin | 1049 | 577 | 472 | 37.37% | 29.08% | 55.20% | 2.86% | **+0.009R** | **-0.017R** |

## Dampak terhadap frekuensi entry

- Stop Order 3 poin menghasilkan **1270 entry**, bertambah **665 entry atau 109.92%** dibanding retest.
- Stop Order 4 poin menghasilkan **1049 entry**, bertambah **444 entry atau 73.39%** dibanding retest.
- Dua skenario memang menaikkan frekuensi karena momentum yang langsung berjalan tidak lagi menunggu retest.

## Namun kualitas entry menurun

- Model 3 poin mempunyai **60 SL langsung pada candle M1 pemicu** dan ekspektasi negatif untuk TP1 maupun TP2.
- Model 4 poin mengurangi SL langsung menjadi **30**, tetapi TP2 masih negatif **−0,017R per entry**.
- Retest hanya mempunyai **11 SL langsung** dan tetap menjadi model terbaik pada pengujian ini, walaupun edge-nya tipis: **+0,014R** untuk TP1 dan **+0,036R** untuk TP2 sebelum biaya.
- Karena biaya transaksi belum dihitung, ketiga hasil belum cukup kuat untuk dianggap edge produksi yang aman.

## Konsistensi bulanan — model TP2 2R

| Bulan | Retest Entry | Retest Exp. | Stop 3 Entry | Stop 3 Exp. | Stop 4 Entry | Stop 4 Exp. |
|---|---:|---:|---:|---:|---:|---:|
| 2024-01 | 39 | -0.385R | 71 | -0.042R | 63 | -0.111R |
| 2024-02 | 47 | 0.362R | 74 | -0.392R | 59 | -0.153R |
| 2024-03 | 41 | 0.341R | 84 | 0.214R | 73 | 0.233R |
| 2024-04 | 44 | 0.159R | 121 | 0.025R | 100 | -0.020R |
| 2024-05 | 62 | 0.226R | 108 | 0.120R | 90 | 0.156R |
| 2024-06 | 49 | 0.000R | 106 | -0.047R | 89 | 0.045R |
| 2024-07 | 65 | 0.031R | 122 | -0.033R | 101 | -0.050R |
| 2024-08 | 52 | -0.077R | 114 | -0.079R | 93 | 0.161R |
| 2024-09 | 45 | 0.156R | 113 | -0.142R | 93 | -0.258R |
| 2024-10 | 63 | -0.175R | 121 | -0.157R | 98 | -0.184R |
| 2024-11 | 52 | -0.019R | 126 | 0.040R | 103 | 0.068R |
| 2024-12 | 46 | -0.174R | 110 | -0.155R | 87 | -0.115R |

## Keputusan implementasi

**Buy Stop/Sell Stop tidak menggantikan model retest di aplikasi.** Stop order berhasil meningkatkan jumlah entry secara besar, tetapi tambahan entry didominasi kualitas momentum yang lebih rendah dan tidak memperbaiki ekspektasi. Model retest tetap aktif pada branch ini sampai ditemukan filter yang membuat stop order positif setelah biaya.

## Audit

- Candle M15: **23.713**.
- Candle M1: **355.592**.
- Rentang UTC: **2024-01-01T18:00:00.000Z — 2024-12-31T16:45:00.000Z**.
- Hash retest: `549fab8074b7818cf56ae56bf7ebedea6e1643f550effcacd7d4da0b89ee92d2`.
- Hash stop 3 poin: `82c344be8fe14b63e320f80caf5b122213c8605257c26439041dadd786c265b5`.
- Hash stop 4 poin: `7cdecb8646ac47d1402f05b970e9063ad7cc143bd3810df82b1e6cd3a089d61c`.
