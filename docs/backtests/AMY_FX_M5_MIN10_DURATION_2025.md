# Amy FX — Backtest SL Minimum 10 Poin, TP 10/20 Poin — 2025

> **Tujuan:** menguji kritik bahwa SL lama terlalu sempit dan jumlah poin terlalu kecil.  
> **Data:** 70.810 candle M5 dan 353.951 candle M1 XAU/USD sepanjang 2025.  
> **Status:** eksperimen backtest; belum diterapkan ke aplikasi.

## Aturan yang diuji

1. Entry tetap memakai fresh FVG M5 → first touch → rejection M5 → entry pada midpoint FVG.
2. Konfirmasi hanya pukul 18:00–03:59 WITA.
3. Filter lama risiko 0,60–4,00 poin dan filter liquidity 2R dihapus.
4. Jarak SL adalah maksimum antara invalidasi struktur dan **minimum 10 poin**.
5. TP1 tetap **10 poin** dan TP2 tetap **20 poin** dari entry.
6. M1 hanya menentukan urutan sentuhan Entry, SL, dan TP.
7. Jika SL dan TP tersentuh pada menit yang sama, SL dihitung terlebih dahulu.
8. Spread, slippage, komisi, dan news belum dimodelkan.

## Pengaruh lama posisi

Target 10–20 poin memerlukan waktu lebih lama daripada target kecil sebelumnya. Karena itu aturan yang sama diuji dengan empat batas waktu tanpa mengubah entry:

| Maksimal posisi | Entry | TP1 10 poin | TP2 20 poin | Kedaluwarsa | Net poin TP1 | Net poin TP2 |
|---|---:|---:|---:|---:|---:|---:|
| 2 jam | 299 | 21.07% | 7.69% | 63.55% | -150.00 | -400.00 |
| 6 jam | 258 | 36.82% | 20.54% | 32.95% | -90.00 | -140.00 |
| 12 jam | 252 | 47.62% | 28.17% | 15.48% | 0.00 | 0.00 |
| **24 jam** | **250** | **50.00%** | **34.40%** | **2.40%** | **10.00** | **140.00** |

## Hasil utama — batas posisi 24 jam

- Entry: **250** — Buy 134, Sell 116.
- TP1 10 poin: **125/250 = 50.00%**.
- TP2 20 poin: **86/250 = 34.40%**.
- SL sebelum TP1: 124/250 = 49.60%.
- TP1 lalu kembali ke SL: 34/250 = 13.60%.
- Kedaluwarsa tanpa keputusan penuh: 6/250 = 2.40%.
- Net apabila seluruh posisi ditutup di TP1: **+10.00 poin**.
- Net apabila seluruh posisi ditahan ke TP2: **+140.00 poin**.
- Rata-rata hasil model TP2: **+0.56 poin per entry sebelum biaya**.

Pada RR 1:2, titik impas teoretis adalah 33,33%. TP2 2025 mencapai 34.40%, hanya sekitar 1.07 poin persentase di atas titik impas. Jadi hasil positifnya **tipis**, bukan kemenangan besar.

Dengan perkiraan biaya rata-rata 0,20 poin per entry, net kasar berkurang sekitar 50 poin menjadi **+90 poin**. Pada biaya 0,30 poin per entry, net kasar menjadi sekitar **+65 poin**.

## Hasil bulanan — model TP2 20 poin, 24 jam

| Bulan | Entry | TP1 | TP2 | Net poin TP2 |
|---|---:|---:|---:|---:|
| 2025-01 | 12 | 75.00% | 41.67% | 60.00 |
| 2025-02 | 21 | 47.62% | 33.33% | 0.00 |
| 2025-03 | 18 | 50.00% | 27.78% | -30.00 |
| 2025-04 | 26 | 38.46% | 30.77% | -20.00 |
| 2025-05 | 27 | 40.74% | 22.22% | -90.00 |
| 2025-06 | 16 | 50.00% | 31.25% | 0.00 |
| 2025-07 | 18 | 55.56% | 38.89% | 30.00 |
| 2025-08 | 19 | 26.32% | 15.79% | -90.00 |
| 2025-09 | 24 | 54.17% | 37.50% | 30.00 |
| 2025-10 | 27 | 70.37% | 48.15% | 120.00 |
| 2025-11 | 20 | 55.00% | 50.00% | 100.00 |
| 2025-12 | 22 | 45.45% | 36.36% | 30.00 |

## Enam contoh nyata

| No. | Entry UTC | Sisi | Entry | SL | TP1 | TP2 | Hasil |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | 2025-01-02 11:03 UTC | BUY | 2650.31 | 2640.31 | 2660.31 | 2670.31 | TP1_THEN_SL |
| 2 | 2025-03-10 14:37 UTC | BUY | 2887.21 | 2877.21 | 2897.21 | 2907.21 | TP2 |
| 3 | 2025-04-27 20:06 UTC | SELL | 3309.40 | 3319.40 | 3299.40 | 3289.40 | TP2 |
| 4 | 2025-06-09 18:02 UTC | BUY | 3324.55 | 3314.55 | 3334.55 | 3344.55 | SL |
| 5 | 2025-08-08 13:11 UTC | BUY | 3396.11 | 3386.11 | 3406.11 | 3416.11 | SL |
| 6 | 2025-09-26 11:08 UTC | BUY | 3775.03 | 3765.03 | 3785.03 | 3795.03 | SL |

## Kesimpulan

SL minimum 10 poin berhasil menghilangkan SL langsung dan memberi ruang napas yang lebih realistis. Namun target 20 poin tidak cocok dibatasi hanya dua atau enam jam; hasil baru menjadi positif tipis ketika posisi diberi waktu sampai 24 jam.

Model ini lebih masuk akal dari sisi jumlah poin, tetapi **belum cukup kuat untuk dipasang ke aplikasi** karena:

- TP2 hanya sedikit di atas titik impas.
- Maret, April, Mei, dan Agustus tetap negatif.
- Hasil mudah terhapus oleh spread, slippage, atau news.
- Belum diuji pada 2024 dengan aturan yang sama.

## Audit

- SHA 2 jam: `cf6846a1518431264dd027a6bdd281d867b34aa964ddaea46ed57dea81576d17`.
- SHA 6 jam: `2a6d1dc09b8125af351055a81cfc38781881ea46ba628827c406c161a24f0fc2`.
- SHA 12 jam: `efb429591058ff8f7703114326a68c9c9ea28d2bd970f3389908edff8ef8152e`.
- SHA 24 jam: `f5e7b266f00a2d35bb55f03b2fe8a0a8ac42082fc92bd662a5d832222372b538`.
