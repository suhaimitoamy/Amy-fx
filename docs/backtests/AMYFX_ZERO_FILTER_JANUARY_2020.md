# Amy FX — Eksperimen Nol Filter, Januari 2020

Tanggal eksperimen: 29 Juli 2026  
Repository: `suhaimitoamy/Amy-fx`  
Branch sasaran: `personal/amyfx-private`  
Data: `XAUUSD_2020_01_January.zip` dari Google Drive  
Timeframe: M5 dan M15

## Definisi eksperimen

Semua **filter pemilihan setup** dinonaktifkan:

- Direction Forecast
- opposing liquidity sweep
- urutan sweep → displaced MSS
- HTF alignment
- EMA stack dan EMA distance
- session
- dealing location
- close location
- structural target
- expiry setup

Agar backtest tetap mempunyai BUY/SELL dan level keluar yang dapat dihitung, hanya mekanisme paling dasar berikut yang dipertahankan. Ini bukan filter kualitas:

- trigger: close menembus swing fractal 4-bar terakhir yang sudah terkonfirmasi secara causal;
- entry: open candle berikutnya;
- SL: 1 ATR(14) dari entry;
- TP1: 1R, kemudian SL dipindah ke break-even;
- TP2: 2R;
- maksimal satu posisi aktif per timeframe;
- bila SL dan target tersentuh pada candle yang sama, hasil buruk dihitung lebih dahulu;
- tidak membaca future candle.

Eksperimen berjalan terpisah. Kode aplikasi dan panel Rencana Eksekusi tidak diubah.

## Data Januari 2020

| TF | Candle | Awal | Akhir |
|---|---:|---|---|
| M5 | 6.024 | 1 Jan 2020 18:00 | 31 Jan 2020 16:55 |
| M15 | 2.008 | 1 Jan 2020 18:00 | 31 Jan 2020 16:45 |

## Hasil utama

| TF | Sinyal raw break | Trade | SL | TP1 / BE | TP2 | TP2 win rate | Mencapai TP1+ |
|---|---:|---:|---:|---:|---:|---:|---:|
| M5 | 325 | 311 | 160 | 72 | 79 | 25,40% | 48,55% |
| M15 | 105 | 101 | 52 | 23 | 26 | 25,74% | 48,51% |
| **Gabungan** | **430** | **412** | **212** | **95** | **105** | **25,49%** | **48,54%** |

Sebanyak 18 sinyal tidak dibuka karena masih ada posisi aktif pada timeframe yang sama.

## Hasil berdasarkan arah

| TF | Arah | Trade | SL | TP1 / BE | TP2 | TP2 win rate | Mencapai TP1+ |
|---|---|---:|---:|---:|---:|---:|---:|
| M5 | BUY | 171 | 84 | 43 | 44 | 25,73% | 50,88% |
| M5 | SELL | 140 | 76 | 29 | 35 | 25,00% | 45,71% |
| M15 | BUY | 53 | 25 | 11 | 17 | **32,08%** | **52,83%** |
| M15 | SELL | 48 | 27 | 12 | 9 | 18,75% | 43,75% |

## Hasil dalam R

Dua cara pencatatan ditampilkan agar tidak menyembunyikan asumsi pengelolaan posisi.

| TF | Full runner: TP2 +2R, BE 0R | 50% TP1 + 50% runner |
|---|---:|---:|
| M5 | -2,0R | -5,5R |
| M15 | 0,0R | -1,5R |
| **Gabungan** | **-2,0R** | **-7,0R** |

## Kesimpulan baseline

Tanpa filter kualitas, sistem menghasilkan **412 trade dalam satu bulan**, atau kira-kira 13 trade per hari kalender pada gabungan M5 dan M15. Hasilnya berada dekat titik impas tetapi sedikit negatif sebelum spread, slippage, dan komisi.

Temuan yang terlihat langsung dari baseline:

- M5 dan M15 mempunyai tingkat mencapai TP1 yang hampir sama, sekitar 48,5%;
- M15 menghasilkan jauh lebih sedikit trade daripada M5;
- performa BUY lebih baik daripada SELL pada Januari 2020;
- M15 BUY adalah kelompok terkuat, sedangkan M15 SELL adalah kelompok terlemah;
- belum ada filter yang ditambahkan. Hasil ini menjadi titik awal eksperimen berikutnya.
