# Amy FX — Backtest M15 FVG/IFVG dengan SL Struktural, Januari 2026

Tanggal penelitian: 29 Juli 2026  
Repository: `suhaimitoamy/Amy-fx`  
Branch: `personal/amyfx-private`  
Data: `XAUUSD_2026_01_January.zip` dari Google Drive  
Zona waktu seluruh timestamp: **UTC**  
Status: **penelitian/backtest saja; bukan logika produksi yang dinyatakan identik**

## Validasi data

| Pemeriksaan | Hasil |
|---|---|
| Isi ZIP | 6 file: M1, M5, M15, H1, H4, D1 |
| CRC ZIP | Lulus |
| SHA-256 ZIP | Cocok manifest |
| SHA-256 seluruh CSV | Cocok manifest |
| File M15 | `XAUUSD_M15_January_2026.csv` |
| Candle M15 | 1.922 |
| Awal–akhir | 2026-01-01 23:00:00 sampai 2026-01-30 21:45:00 UTC |
| Timestamp tidak berurutan | 0 |
| Duplikasi timestamp | 0 |
| Timestamp tidak sejajar M15 | 0 |
| OHLC tidak valid/non-finite | 0 |
| Mismatch agregasi M1 → M15 | 0 |
| Candle akhir belum selesai | 0 |
| Putusan data gate Januari | **PASS** |

Dari 1.922 bucket M15, 1.920 memiliki 15 bar M1 dan dua bucket memiliki 14 bar M1. Slot yang tidak tersedia adalah `2026-01-19 19:29:00` dan `2026-01-20 13:36:00` UTC. Manifest menyatakan bar bervolume nol dibuang; kedua bucket tetap merekonstruksi OHLC M15 secara identik, sehingga tidak diperlakukan sebagai candle M15 rusak.

Terdapat 20 loncatan timestamp lebih dari 15 menit pada jeda feed/market: 15 loncatan 1 jam 15 menit, empat loncatan 2 hari 1 jam 15 menit, dan satu loncatan 3 jam 45 menit. Urutan timestamp tetap monoton dan pola jeda juga berasal dari data M1, bukan bar M15 yang tertukar.

## Metodologi yang dikunci

- Timeframe hanya **M15**.
- Trigger hanya **FVG** dan **IFVG**, tanpa filter kualitas, arah, HTF, EMA, sesi, sweep, MSS, premium/discount, news, atau rule tambahan.
- ATR memakai Wilder ATR(14), dengan seed rata-rata 14 true range pertama.
- Fractal empat bar bersifat causal: swing baru tersedia setelah empat candle di sisi kanan sudah close.
- Jika beberapa zona bereaksi pada candle yang sama: IFVG diprioritaskan atas FVG, lalu zona terdekat ke close candle dipilih secara deterministik.
- Entry pada open M15 berikutnya; satu posisi aktif; konflik intrabar dinilai buruk lebih dahulu.
- Metodologi ini lebih dulu direplikasi pada Maret 2020 dan cocok persis dengan baseline lama sebelum Januari dihitung.

## Hasil utama

| Metrik | Hasil |
|---|---:|
| Jumlah candle | 1.922 |
| FVG terbentuk | 395 |
| IFVG terbentuk | 349 |
| Reaksi FVG terkonfirmasi | 187 |
| Reaksi IFVG terkonfirmasi | 138 |
| Total reaksi terkonfirmasi | 325 |
| Sinyal unik | 275 |
| Trade dibuka | 27 |
| Trade selesai | 26 |
| SL | 15 |
| TP1 lalu BE | 6 |
| TP2 | 5 |
| OPEN_AT_END | 1 |
| TP2 win rate | 19,23% |
| Mencapai minimal TP1 | 42,31% |
| Full runner | -5,0R |
| 50% TP1 + 50% runner | -4,5R |
| Maximum drawdown | 13,0R |
| SL beruntun maksimum | 10 |

Win rate dan persentase mencapai TP1 memakai **26 trade yang sudah selesai** sebagai denominator. Posisi `OPEN_AT_END` tidak dimasukkan ke hasil strategi atau drawdown; nilai mark-to-market-nya tetap dicatat di CSV.

## Berdasarkan trigger

| Trigger | Trade | Selesai | SL | TP1/BE | TP2 | Open | TP2 win rate | Mencapai TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FVG | 16 | 16 | 8 | 4 | 4 | 0 | 25,00% | 50,00% | +0,0R |
| IFVG | 11 | 10 | 7 | 2 | 1 | 1 | 10,00% | 30,00% | -5,0R |

## Berdasarkan arah

| Arah | Trade | Selesai | SL | TP1/BE | TP2 | Open | TP2 win rate | Mencapai TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BUY | 14 | 14 | 6 | 3 | 5 | 0 | 35,71% | 57,14% | +4,0R |
| SELL | 13 | 12 | 9 | 3 | 0 | 1 | 0,00% | 25,00% | -9,0R |

## Jarak harga Gold

Semua jarak di bawah adalah selisih harga Gold dalam dolar, bukan point atau pip.

| Ukuran | Hasil |
|---|---:|
| Rata-rata jarak SL | $61,29 |
| Median jarak SL | $31,83 |
| SL minimum | $2,56 |
| SL maksimum | $434,10 |
| Kuartil 25% | $17,89 |
| Kuartil 75% | $66,80 |
| Rata-rata jarak TP1 | $61,29 |
| Median jarak TP1 | $31,83 |
| Rata-rata jarak TP2 | $122,58 |
| Median jarak TP2 | $63,65 |

## Durasi posisi

| Ukuran | Hasil |
|---|---:|
| Rata-rata durasi | 23,31 jam |
| Median durasi | 6,25 jam |
| Durasi terlama | 167,50 jam |

Durasi dihitung berdasarkan selisih timestamp UTC aktual, sehingga akhir pekan atau jeda feed tetap tercermin dalam lama posisi.

## Artefak transaksi

Daftar lengkap 27 transaksi disimpan di `amyfx-fvg-ifvg-structural-sl-january-2026-trades.csv`. Hasil terstruktur dan seluruh parameter metodologi disimpan di `amyfx-fvg-ifvg-structural-sl-january-2026.json`.

## Kesimpulan sederhana

Januari 2026 menghasilkan **27 trade**, dengan **15 SL**, **6 TP1 lalu BE**, **5 TP2**, dan **1 posisi masih terbuka**. Model full runner menghasilkan **-5,0R**, sedangkan model 50% TP1 + 50% runner menghasilkan **-4,5R**.

FVG menghasilkan **+0,0R**, sedangkan IFVG menghasilkan **-5,0R**. Hasil Januari ini dicatat apa adanya; tidak ada parameter yang dioptimalkan dan tidak ada rule baru yang ditambahkan.

Backtest dihentikan pada Januari 2026. Februari 2026 belum dijalankan.

Kode aplikasi, panel Rencana Eksekusi, branch `main`, package, signing, update channel, versi, release, APK, dan data pengguna tidak diubah.
