# Amy FX — Backtest M5 Direct Entry 2024

> **Hipotesis:** win rate turun karena entry Reaction First terlalu lambat.  
> **Periode:** XAU/USD Januari–Desember 2024.  
> **Sinyal:** M5; M1 hanya menyelesaikan urutan entry, SL, dan TP.

## Tiga arti “langsung entry” yang diuji

1. **Market setelah FVG terbentuk:** masuk pada open M1 pertama setelah candle M5 pembentuk FVG ditutup.
2. **Proximal touch:** pending entry langsung dipasang pada sisi terdekat FVG; tidak menunggu rejection.
3. **Midpoint touch:** pending entry langsung dipasang pada 50% FVG; tidak menunggu rejection.

Filter displacement, risiko 0,60–4,00 poin, ruang liquidity minimal 2R, SL di luar FVG + 0,12 ATR, TP1 1,5R, dan TP2 2R tetap sama.

## Perbandingan hasil

| Model | Entry | TP1 1,5R | TP2 2R | Ekspektasi TP1 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|---:|
| Reaction First lama | 165 | 53,94% | 42,42% | 0,348R | 0,273R |
| Market setelah FVG | 740 | 35.68% | 27.70% | -0.091R | -0.127R |
| Direct proximal touch | 898 | 44.54% | 35.08% | 0.116R | 0.063R |
| Direct midpoint touch | 631 | 47.70% | 38.19% | 0.193R | 0.146R |

## Validasi Sep–Des 2024

| Model | Entry | TP1 | TP2 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|
| Market setelah FVG | 251 | 37.85% | 29.88% | -0.080R |
| Direct proximal touch | 338 | 46.75% | 37.87% | 0.139R |
| Direct midpoint touch | 242 | 45.45% | 36.78% | 0.103R |

## Kesimpulan

- Market entry langsung setelah FVG terbentuk gagal: frekuensi naik tetapi ekspektasi menjadi negatif.
- Masuk langsung saat harga kembali ke FVG tetap positif, tetapi win rate dan ekspektasi per entry lebih rendah daripada Reaction First.
- **Direct midpoint touch** adalah versi langsung terbaik: jauh lebih banyak entry daripada Reaction First dan masih positif sebelum biaya.
- Hipotesis bahwa keterlambatan entry adalah penyebab utama win rate rendah tidak terbukti. Konfirmasi rejection justru menyaring banyak false reaction.

Direct entry belum menggantikan logika aktif di aplikasi pada eksperimen ini. Spread, slippage, komisi, news, dan eksekusi broker belum dimodelkan.
