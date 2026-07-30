# Amy FX — Eksperimen Trigger OB / Breaker / FVG / IFVG, Februari 2020

Tanggal eksperimen: 29 Juli 2026  
Repository: `suhaimitoamy/Amy-fx`  
Branch sasaran: `personal/amyfx-private`  
Data: `XAUUSD_2020_02_February.zip` dari Google Drive  
Timeframe: M5 dan M15

## Definisi trigger eksperimen

Panel yang dilingkari diterjemahkan menjadi empat sumber trigger: **Order Block, Breaker OB, FVG, dan IFVG**. Tidak ada Direction Forecast, sweep, MSS, HTF, EMA, session, dealing location, close location, atau target struktural sebagai filter.

- **FVG:** imbalance tiga candle. Trigger baru muncul pada kunjungan berikutnya ketika candle masuk ke zona lalu close menjauh melewati sisi luar zona sesuai arah FVG.
- **IFVG:** FVG yang ditembus dengan close melewati sisi berlawanan, lalu arahnya dibalik. Trigger muncul pada retest terkonfirmasi berikutnya.
- **Order Block:** candle berlawanan terakhir, maksimal 12 bar sebelum close menembus swing fractal 4-bar yang sudah terkonfirmasi. Zona memakai sisi wick sampai open candle asal.
- **Breaker OB:** Order Block yang ditembus dengan close melewati invalidasi, lalu arahnya dibalik. Trigger muncul pada retest terkonfirmasi berikutnya.
- Jika beberapa zona bereaksi pada candle yang sama, prioritas: `Breaker → IFVG → OB → FVG`, kemudian zona terdekat.
- Entry pada open candle berikutnya.
- SL 1 ATR(14), TP1 1R lalu break-even, TP2 2R.
- Maksimal satu posisi aktif per timeframe.
- Konflik SL/TP satu candle dinilai secara konservatif: hasil buruk lebih dahulu.
- Tidak menggunakan future candle.

Kode aplikasi dan panel Rencana Eksekusi tidak diubah. Ini adalah eksperimen backtest terpisah.

## Data Februari 2020

| TF | Candle | Awal | Akhir | Sinyal reaksi | Trade dibuka |
|---|---:|---|---|---:|---:|
| M5 | 5.472 | 2020-02-02 18:00:00 | 2020-02-28 16:55:00 | 1.148 | 656 |
| M15 | 1.824 | 2020-02-02 18:00:00 | 2020-02-28 16:45:00 | 362 | 204 |

## Hasil utama

| TF | Trade selesai | SL | TP1 / BE | TP2 | Open akhir bulan | TP2 win rate | Mencapai TP1+ | Full runner R | 50% TP1 + runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| M5 | 656 | 341 | 161 | 154 | 0 | 23,48% | 48,02% | -33R | -29,5R |
| M15 | 203 | 97 | 56 | 50 | 1 | 24,63% | 52,22% | 3R | 6R |
| **Gabungan** | **859** | **438** | **217** | **204** | **1** | **23,75%** | **49,01%** | **-30R** | **-23,5R** |

## Hasil berdasarkan jenis trigger

| Trigger | Trade | SL | TP1 / BE | TP2 | TP2 win rate | Mencapai TP1+ | Full runner R |
|---|---:|---:|---:|---:|---:|---:|---:|
| FVG | 298 | 165 | 54 | 79 | 26,51% | 44,63% | -7R |
| IFVG | 357 | 167 | 108 | 82 | 22,97% | 53,22% | -3R |
| OB | 99 | 53 | 26 | 20 | 20,20% | 46,46% | -13R |
| BREAKER | 105 | 53 | 29 | 23 | 21,90% | 49,52% | -7R |

### Per timeframe

#### M5

| Trigger | Trade | SL | TP1 / BE | TP2 | TP2 win rate | Mencapai TP1+ | Full runner R |
|---|---:|---:|---:|---:|---:|---:|---:|
| FVG | 218 | 123 | 38 | 57 | 26,15% | 43,58% | -9R |
| OB | 73 | 40 | 19 | 14 | 19,18% | 45,21% | -12R |
| IFVG | 281 | 141 | 78 | 62 | 22,06% | 49,82% | -17R |
| BREAKER | 84 | 37 | 26 | 21 | 25,00% | 55,95% | 5R |

#### M15

| Trigger | Trade | SL | TP1 / BE | TP2 | TP2 win rate | Mencapai TP1+ | Full runner R |
|---|---:|---:|---:|---:|---:|---:|---:|
| OB | 26 | 13 | 7 | 6 | 23,08% | 50,00% | -1R |
| FVG | 80 | 42 | 16 | 22 | 27,50% | 47,50% | 2R |
| IFVG | 76 | 26 | 30 | 20 | 26,32% | 65,79% | 14R |
| BREAKER | 21 | 16 | 3 | 2 | 9,52% | 23,81% | -12R |

## Berdasarkan arah

| Arah | Trade | SL | TP1 / BE | TP2 | TP2 win rate | Mencapai TP1+ | Full runner R |
|---|---:|---:|---:|---:|---:|---:|---:|
| SELL | 423 | 214 | 103 | 106 | 25,06% | 49,41% | -2R |
| BUY | 436 | 224 | 114 | 98 | 22,48% | 48,62% | -28R |

## Kesimpulan baseline bulan kedua

- Trigger zona menghasilkan **860 trade**, dengan 859 trade selesai dan satu posisi masih terbuka pada akhir data.
- Gabungan M5 dan M15 menghasilkan **-30R** pada model full runner dan **-23,5R** pada model 50% TP1 + 50% runner, sebelum spread, slippage, dan komisi.
- **M15 positif:** +3R full runner atau +6R dengan partial TP1.
- **M5 negatif:** -33R full runner.
- Kelompok terkuat adalah **M15 IFVG**: 76 trade, 65,79% mencapai TP1+, dan +14R.
- Kelompok terlemah adalah **M15 Breaker OB**: 21 trade dan -12R.
- Secara gabungan, SELL (-2R) jauh lebih baik daripada BUY (-28R) pada Februari 2020.
- Belum ada filter kualitas tambahan. Hasil ini menunjukkan reaksi zona saja masih terlalu sering, terutama pada M5.

## Batasan

- Definisi di atas adalah aturan eksperimen yang dibuat dari panel zona pada screenshot, bukan perubahan pada engine produksi.
- Spread, slippage, komisi, news, dan pembatasan session belum dihitung.
- Hasil satu bulan belum cukup untuk menetapkan rule permanen; tujuan tahap ini hanya menyediakan baseline untuk pemilihan rule berikutnya.