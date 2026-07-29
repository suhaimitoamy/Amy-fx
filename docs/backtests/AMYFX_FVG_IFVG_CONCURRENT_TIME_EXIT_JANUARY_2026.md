# Amy FX — Backtest Concurrent Entry dan Time Exit, Januari 2026

Tanggal penelitian: 29 Juli 2026  
Repository: `suhaimitoamy/Amy-fx`  
Branch: `personal/amyfx-private`  
Data: candle BID Dukascopy M15 Januari 2026 yang sudah lolos validasi sebelumnya  
Status: **penelitian/backtest saja; bukan perubahan logika produksi**

## Perubahan eksperimen

- Rule maksimum satu posisi aktif **dihapus**.
- Setiap sinyal deterministik yang terkonfirmasi dapat membuka trade baru walaupun trade lain masih aktif.
- FVG, IFVG, entry, SL struktural causal, ATR, buffer, TP1, TP2, dan konservatisme intrabar tidak diubah.
- Empat lifecycle dibandingkan: tanpa batas waktu, maksimum 4, 8, dan 16 candle M15 aktif.
- Pada varian waktu, setelah SL/TP diperiksa pada candle terakhir yang diperbolehkan, posisi ditutup pada harga close bila belum terminal.
- Tidak ada parameter yang dioptimalkan berdasarkan hasil Januari.

## Aliran sinyal

- Candle M15: **1.922**
- FVG terbentuk: **395**
- IFVG terbentuk: **349**
- Reaksi terkonfirmasi: **325**
- Sinyal unik: **275**
- Trade yang dapat dibuka pada setiap varian: **274**
- Sinyal yang tidak dapat entry karena tidak memiliki candle berikutnya: **1**

Baseline lama hanya membuka 27 dari 275 sinyal karena posisi yang lama memblokir entry berikutnya. Setelah rule itu dihapus, **274 sinyal** dapat diuji sebagai trade independen; satu sinyal terakhir tidak memiliki candle M15 berikutnya untuk entry.

## Perbandingan hasil utama

| Lifecycle | Trade | Selesai | SL | TP1/BE | TP2 | Time exit | Open | TP2 WR | Minimal TP1 | Full runner | Model 50/50 | Max DD | Max posisi bersamaan | Median durasi kalender | Maksimum durasi kalender |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Tanpa batas waktu | 274 | 265 | 129 | 57 | 79 | 0 | 9 | 29,81% | 51,32% | +29,00R | +18,00R | 38,00R | 13 | 4,25 jam | 167,50 jam |
| Maksimum 4 candle M15 | 274 | 273 | 31 | 10 | 9 | 223 | 1 | 3,30% | 13,92% | +2,23R | +3,75R | 13,36R | 3 | 0,75 jam | 1,75 jam |
| Maksimum 8 candle M15 | 274 | 272 | 53 | 17 | 15 | 187 | 2 | 5,51% | 23,53% | +0,40R | +2,14R | 21,20R | 4 | 1,75 jam | 50,75 jam |
| Maksimum 16 candle M15 | 274 | 270 | 76 | 28 | 31 | 135 | 4 | 11,48% | 30,74% | +7,58R | +6,30R | 19,26R | 5 | 3,75 jam | 52,75 jam |

Catatan: hasil varian tanpa batas waktu hanya menjumlahkan trade yang selesai untuk hasil utama. Nilai posisi terbuka akhir bulan tersedia di JSON sebagai mark-to-market. Drawdown dihitung berdasarkan urutan exit; pada candle exit yang sama, hasil buruk diurutkan lebih dahulu.

**Batas waktu adalah batas jumlah candle aktif, bukan jaminan durasi kalender.** Data memiliki jeda harian dan akhir pekan. Karena itu 4 candle dapat berlangsung sampai 1,75 jam kalender, sedangkan 8 dan 16 candle dapat melewati akhir pekan. Hal ini penting untuk tujuan scalping.

## Dibanding baseline satu posisi aktif

| Model | Trade | Full runner | Max DD | Median durasi kalender | Maksimum durasi kalender |
|---|---:|---:|---:|---:|---:|
| Baseline lama: satu posisi aktif | 27 | -5,00R | 13,00R | 6,25 jam | 167,50 jam |
| Tanpa batas waktu | 274 | +29,00R | 38,00R | 4,25 jam | 167,50 jam |
| Maksimum 4 candle M15 | 274 | +2,23R | 13,36R | 0,75 jam | 1,75 jam |
| Maksimum 8 candle M15 | 274 | +0,40R | 21,20R | 1,75 jam | 50,75 jam |
| Maksimum 16 candle M15 | 274 | +7,58R | 19,26R | 3,75 jam | 52,75 jam |

## Risiko concurrency

- **Tanpa batas waktu:** maksimum 13 posisi aktif bersamaan.
- **Maksimum 4 candle M15:** maksimum 3 posisi aktif bersamaan.
- **Maksimum 8 candle M15:** maksimum 4 posisi aktif bersamaan.
- **Maksimum 16 candle M15:** maksimum 5 posisi aktif bersamaan.

Menghapus rule satu posisi membuat backtest menangkap semua sinyal, tetapi juga mengubah profil risiko. Jika setiap posisi mempertaruhkan 1R penuh secara independen, jumlah posisi bersamaan menunjukkan besarnya eksposur awal yang secara teoritis dapat menumpuk. Karena itu hasil R total tidak boleh dibaca tanpa melihat concurrency dan drawdown.

## Implikasi untuk scalping

- Varian 4 candle adalah yang paling dekat dengan tujuan scalping: median durasi kalender **0,75 jam**, maksimum **1,75 jam**, dan maksimum **3 posisi** bersamaan.
- Pada varian 4 candle, **223 dari 273 trade selesai karena time exit** dan hanya **9** mencapai TP2. Ini menunjukkan target berbasis SL struktural masih terlalu jauh untuk banyak setup scalping.
- Varian 16 candle menghasilkan R Januari lebih tinggi, tetapi durasi kalender maksimum mencapai **52,75 jam** karena posisi melewati akhir pekan; karakter ini belum sesuai scalping murni.

## Jarak SL seluruh sinyal

| Ukuran | Hasil |
|---|---:|
| Rata-rata SL | $45,52 |
| Median SL | $26,44 |
| SL minimum | $2,56 |
| SL maksimum | $434,10 |
| Kuartil 25% | $14,50 |
| Kuartil 75% | $48,74 |

## Berdasarkan trigger

### Tanpa batas waktu

| Trigger | Trade | SL | TP1/BE | TP2 | Time exit | Open | Minimal TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FVG | 143 | 73 | 26 | 42 | 0 | 2 | 48,23% | +11,00R |
| IFVG | 131 | 56 | 31 | 37 | 0 | 7 | 54,84% | +18,00R |

### Maksimum 4 candle M15

| Trigger | Trade | SL | TP1/BE | TP2 | Time exit | Open | Minimal TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FVG | 143 | 18 | 3 | 3 | 118 | 1 | 10,56% | -0,56R |
| IFVG | 131 | 13 | 7 | 6 | 105 | 0 | 17,56% | +2,79R |

### Maksimum 8 candle M15

| Trigger | Trade | SL | TP1/BE | TP2 | Time exit | Open | Minimal TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FVG | 143 | 30 | 7 | 6 | 99 | 1 | 20,42% | -3,52R |
| IFVG | 131 | 23 | 10 | 9 | 88 | 1 | 26,92% | +3,92R |

### Maksimum 16 candle M15

| Trigger | Trade | SL | TP1/BE | TP2 | Time exit | Open | Minimal TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FVG | 143 | 43 | 13 | 14 | 71 | 2 | 26,95% | -1,55R |
| IFVG | 131 | 33 | 15 | 17 | 64 | 2 | 34,88% | +9,14R |

## Berdasarkan arah

### Tanpa batas waktu

| Arah | Trade | SL | TP1/BE | TP2 | Time exit | Open | Minimal TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BUY | 160 | 74 | 24 | 61 | 0 | 1 | 53,46% | +48,00R |
| SELL | 114 | 55 | 33 | 18 | 0 | 8 | 48,11% | -19,00R |

### Maksimum 4 candle M15

| Arah | Trade | SL | TP1/BE | TP2 | Time exit | Open | Minimal TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BUY | 160 | 17 | 3 | 2 | 138 | 0 | 10,00% | +4,68R |
| SELL | 114 | 14 | 7 | 7 | 85 | 1 | 19,47% | -2,45R |

### Maksimum 8 candle M15

| Arah | Trade | SL | TP1/BE | TP2 | Time exit | Open | Minimal TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BUY | 160 | 30 | 6 | 6 | 118 | 0 | 20,00% | +6,75R |
| SELL | 114 | 23 | 11 | 9 | 69 | 2 | 28,57% | -6,34R |

### Maksimum 16 candle M15

| Arah | Trade | SL | TP1/BE | TP2 | Time exit | Open | Minimal TP1 | Full runner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BUY | 160 | 45 | 11 | 19 | 84 | 1 | 28,30% | +15,80R |
| SELL | 114 | 31 | 17 | 12 | 51 | 3 | 34,23% | -8,22R |

## Kesimpulan sederhana

Menghapus rule satu posisi meningkatkan jumlah trade dari **27 menjadi 274** pada bulan yang sama. Ini membuktikan bahwa baseline lama memang melewatkan sebagian besar sinyal, tetapi hasil baru juga menumpuk beberapa posisi secara bersamaan.

Di antara tiga batas candle yang telah ditentukan sebelum pengujian, hasil full runner Januari tertinggi terdapat pada **Maksimum 16 candle M15** sebesar **+7,58R**. Drawdown terkecil di antara varian waktu terdapat pada **Maksimum 4 candle M15** sebesar **13,36R**.

Untuk tujuan scalping, varian 4 candle adalah kandidat penelitian yang paling relevan, bukan karena R-nya paling tinggi, tetapi karena durasi dan concurrency paling terkendali. Hasil ini belum menetapkan lifecycle produksi. Februari belum dijalankan, dan pembatasan jarak SL belum diuji pada tahap ini.

Kode aplikasi, panel Rencana Eksekusi, branch `main`, package, signing, update channel, versi, release, APK, dan data pengguna tidak diubah.
