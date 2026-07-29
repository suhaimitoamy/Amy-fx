# Amy FX — Backtest Local Wick SL, Maksimum 1 Jam, Januari 2026

Tanggal penelitian: 29 Juli 2026  
Repository: `suhaimitoamy/Amy-fx`  
Branch: `personal/amyfx-private`  
Status: **penelitian/backtest saja; bukan perubahan logika produksi**

## Hipotesis yang diuji

- Rule satu posisi tetap dihapus; semua sinyal dapat berjalan independen.
- Batas lifecycle tetap maksimum **4 candle M15**.
- Satu-satunya perubahan adalah referensi Stop Loss:
  - FVG: wick candle tengah/displacement yang membentuk FVG.
  - IFVG: wick candle yang menembus FVG dan mengonversinya menjadi IFVG.
- Buffer tetap **0,10 ATR(14)**; TP1 tetap 1R, TP2 tetap 2R.
- Bila wick lokal sudah berada pada sisi yang salah terhadap next-open entry, setup ditolak, bukan diperlebar.

## Aliran trade

- Sinyal unik: **275**
- Trade dengan geometri SL lokal valid: **274**
- Dilewati — `IFVG:ATR_UNAVAILABLE`: **1**

## Perbandingan langsung

| Metrik | SL struktural | SL wick lokal | Perubahan |
|---|---:|---:|---:|
| Trade | 274 | 274 | +0 |
| SL | 31 | 77 | +46 |
| TP1/BE | 10 | 13 | +3 |
| TP2 | 9 | 28 | +19 |
| Time exit | 223 | 155 | -68 |
| TP2 win rate | 3,30% | 10,26% | +6,96 pp |
| Minimal TP1 | 13,92% | 26,37% | +12,45 pp |
| Full runner | +2,23R | +5,70R | +3,47R |
| Model 50/50 | +3,75R | -0,78R | -4,53R |
| Maximum drawdown | 13,36R | 20,41R | 7,06R |
| Max posisi bersamaan | 3 | 3 | +0 |
| Median durasi | 0,75 jam | 0,75 jam | 0,00 jam |

## Perubahan jarak SL

| Ukuran | SL struktural | SL wick lokal |
|---|---:|---:|
| Rata-rata | $45,52 | $22,00 |
| Median | $26,44 | $14,52 |
| Minimum | $2,56 | $2,56 |
| Maksimum | $434,10 | $270,42 |
| Kuartil 25% | $14,50 | $8,76 |
| Kuartil 75% | $48,74 | $23,20 |

## Berdasarkan trigger

| Trigger | Trade | SL | TP1/BE | TP2 | Time exit | Minimal TP1 | Full runner | Model 50/50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FVG | 143 | 45 | 5 | 9 | 83 | 23,24% | -6,07R | -8,58R |
| IFVG | 131 | 32 | 8 | 19 | 72 | 29,77% | +11,77R | +7,79R |

## Berdasarkan arah

| Arah | Trade | SL | TP1/BE | TP2 | Time exit | Minimal TP1 | Full runner | Model 50/50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BUY | 160 | 51 | 4 | 15 | 90 | 25,62% | +8,46R | +2,09R |
| SELL | 114 | 26 | 9 | 13 | 65 | 27,43% | -2,76R | -2,87R |

## Kesimpulan

Hipotesis **didukung** pada hasil R Januari.
SL median turun dari **$26,44** menjadi **$14,52**, tetapi hasil full runner berubah dari **+2,23R** menjadi **+5,70R**.
Jumlah TP2 berubah dari **9** menjadi **28**, sedangkan jumlah SL berubah dari **31** menjadi **77**.
Karena hanya satu bulan yang diuji, hasil ini belum boleh dijadikan aturan produksi dan Februari belum dijalankan.

Kode aplikasi, panel Rencana Eksekusi, branch `main`, package, signing, update channel, versi, release, APK, dan data pengguna tidak diubah.
