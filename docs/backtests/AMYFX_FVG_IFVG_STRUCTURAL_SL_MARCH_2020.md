# Amy FX — M15 FVG/IFVG dengan SL Struktural, Maret 2020

Tanggal eksperimen: 29 Juli 2026  
Repository: `suhaimitoamy/Amy-fx`  
Branch: `personal/amyfx-private`  
Data: `XAUUSD_2020_03_March.zip` dari Google Drive  
Timeframe: M15

## Konfigurasi

Trigger entry tetap **FVG dan IFVG tanpa filter kualitas tambahan**.

- FVG: imbalance tiga candle; trigger ketika harga kembali menyentuh zona dan candle close menjauh melewati sisi luar zona sesuai arah.
- IFVG: FVG ditembus melalui sisi berlawanan, arahnya dibalik, lalu trigger pada retest terkonfirmasi.
- Entry: open candle M15 berikutnya.
- BUY SL: di bawah level terendah antara batas bawah zona dan swing low fractal 4-bar terakhir yang sudah terkonfirmasi secara causal.
- SELL SL: di atas level tertinggi antara batas atas zona dan swing high fractal 4-bar terakhir yang sudah terkonfirmasi secara causal.
- Buffer SL: 0,10 ATR(14).
- TP1: 1R, lalu SL dipindahkan ke break-even.
- TP2: 2R.
- Maksimal satu posisi M15 aktif.
- Jika SL dan target tersentuh pada candle yang sama, hasil buruk dihitung lebih dahulu.
- Tidak membaca future candle.

Tidak digunakan: Direction Forecast, sweep, MSS, HTF, EMA, session, dealing location, close location, OB, dan Breaker OB.

## Hasil utama

| Metrik | Hasil |
|---|---:|
| Candle M15 | 2.044 |
| Sinyal reaksi terkonfirmasi | 269 |
| Trade dibuka | 20 |
| Trade selesai | 19 |
| SL | 11 |
| TP1 lalu BE | 1 |
| TP2 | 7 |
| Masih terbuka akhir bulan | 1 |
| TP2 win rate | 36,84% |
| Mencapai minimal TP1 | 42,11% |
| Full runner | +3,0R |
| 50% TP1 + 50% runner | 0,0R |
| Maksimum drawdown | 4,0R |
| SL beruntun maksimum | 4 |

## Jarak harga dari entry

| Ukuran | SL | TP1 | TP2 |
|---|---:|---:|---:|
| Rata-rata | $26,31 | $26,31 | $52,62 |
| Median | $19,46 | $19,46 | $38,92 |
| Minimum SL | $4,96 |  |  |
| Maksimum SL | $84,84 |  |  |

Rentang tengah 50% trade memakai SL sekitar **$12,39–$33,84**. Median durasi posisi selesai adalah **14 jam**.

## Per trigger

| Trigger | Trade selesai | SL | TP1/BE | TP2 | TP2 win rate | Hasil |
|---|---:|---:|---:|---:|---:|---:|
| FVG | 9 | 4 | 1 | 4 | 44,44% | +4,0R |
| IFVG | 10 | 7 | 0 | 3 | 30,00% | -1,0R |

## Kontrol pada bulan yang sama

Untuk melihat pengaruh perubahan SL, trigger yang sama juga dihitung menggunakan SL lama 1 ATR:

| Model SL | Trade | TP2 | Full runner | Rata-rata SL |
|---|---:|---:|---:|---:|
| 1 ATR lama | 194 | 39 | -27,0R | $5,78 |
| Struktural + 0,10 ATR | 20 | 7 | +3,0R | $26,31 |

Perubahan SL menaikkan hasil full runner dari **-27,0R menjadi +3,0R**, tetapi membuat posisi jauh lebih lama dan jarak SL jauh lebih lebar.

## Kesimpulan

Maret 2020 menghasilkan **+3R** dengan SL struktural. FVG menghasilkan **+4R**, sedangkan IFVG **-1R**. Secara matematika hasilnya lebih baik daripada SL 1 ATR, tetapi rata-rata SL **$26,31** dan maksimum **$84,84** masih sangat besar untuk penggunaan lot tetap. Belum ada rule entry baru yang ditambahkan.

Kode aplikasi dan panel Rencana Eksekusi tidak diubah.
