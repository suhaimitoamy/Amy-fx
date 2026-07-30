# Amy FX Preview — Backtest Rencana Eksekusi 2021–2022

Tanggal: 29 Juli 2026  
Repository: `suhaimitoamy/Amy-fx`  
Branch: `personal/amyfx-private`  
Cakupan UI: **Rencana Eksekusi saja**  
Simbol: **XAUUSD**

## Snapshot yang diuji

- Nama aplikasi: Amy FX Preview
- Package: `com.amyelitesuite.learningpreview`
- Version name pada source branch saat audit: `2.0.0-preview.173`
- Version code pada source branch saat audit: `940173`
- Blob `execution-plan-core.js`: `f6f811bf4e0270f0c5964cb8ba924c8cc76cd403`
- Blob replay historis pendamping: `1e296f8aeac6e4a5035dd3c94d20a911cf9fb47d`
- Update manifest: branch `personal/amyfx-private`

Tidak ada perubahan pada aplikasi, Mapping Engine, branch `main`, package produksi, signing produksi, update channel produksi, atau data pengguna.

## Metodologi

1. Mengambil 24 arsip bulanan XAUUSD untuk 2021–2022 dari folder Google Drive `Data backtest`.
2. Mengekstrak 144 CSV untuk M1, M5, M15, H1, H4, dan D1.
3. Menghapus overlap timestamp antar-file bulanan secara deterministik.
4. Memvalidasi urutan waktu, nilai OHLC, dan kesetaraan agregasi antartimeframe.
5. Mencocokkan jumlah candle M5/M15 dengan replay Mapping historis yang tersimpan di branch.
6. Menguji kontrak panel Rencana Eksekusi:
   - BUY/SELL hanya boleh muncul dari setup resmi lengkap dan aktif.
   - Ketika tidak ada setup resmi, keputusan wajib WAIT.
   - WAIT tidak boleh menampilkan Entry, SL, TP1, TP2, atau RR sebagai level executable.
   - Replay memakai state `CLOSED_CANDLE`, bukan membandingkan candle lama dengan waktu sekarang.
   - Panel tidak membaca future candle.

## Validasi data Google Drive

| TF | Bar mentah | Candle unik | Duplikat overlap dibuang | Awal | Akhir |
|---|---:|---:|---:|---|---|
| M1 | 708.074 | 707.954 | 120 | 2021-01-03T18:00:00 | 2022-12-30T16:57:00 |
| M5 | 141.638 | 141.614 | 24 | 2021-01-03T18:00:00 | 2022-12-30T16:55:00 |
| M15 | 47.213 | 47.205 | 8 | 2021-01-03T18:00:00 | 2022-12-30T16:45:00 |
| H1 | 11.805 | 11.805 | 0 | 2021-01-03T18:00:00 | 2022-12-30T16:00:00 |
| H4 | 3.187 | 3.187 | 0 | 2021-01-03T16:00:00 | 2022-12-30T16:00:00 |
| D1 | 620 | 620 | 0 | 2021-01-03T00:00:00 | 2022-12-30T00:00:00 |

Total:

- 24 ZIP
- 144 CSV
- 912.537 bar mentah
- 912.385 candle unik
- 152 overlap timestamp dibuang
- 0 null OHLC
- 0 bar dengan `high` tidak valid
- 0 bar dengan `low` tidak valid

Kesetaraan agregasi:

| Pemeriksaan | Bar cocok | Mismatch |
|---|---:|---:|
| M1 → M5 | 141.614 | 0 |
| M5 → M15 | 47.205 | 0 |
| M15 → H1 | 11.805 | 0 |
| H1 → H4 | 3.187 | 0 |
| H4 → D1 | 620 | 0 |

Selisih maksimum M1 → M5 hanya `0,005`, sesuai pembulatan harga M1; seluruh TF lain cocok tepat.

## Hasil replay Mapping yang menjadi input panel

| TF | Candle | Forecast event | Bar forecast aktif | Setup terkunci | Future leak |
|---|---:|---:|---:|---:|---:|
| M5 | 141.614 | 61 | 2.634 | **0** | 0 |
| M15 | 47.205 | 85 | 2.845 | **0** | 0 |

Funnel kumulatif berhenti pada gate `SESSION`:

| Gate | M5 | M15 |
|---|---:|---:|
| DATA | 2.634 | 2.845 |
| DIRECTION | 2.634 | 2.845 |
| OPPOSING LIQUIDITY SWEEP | 528 | 292 |
| DISPLACED MSS | 2 | 38 |
| HTF ALIGNMENT | 2 | 38 |
| EMA STACK | 2 | 17 |
| EMA DISTANCE | 2 | 17 |
| SESSION | **0** | **0** |
| SETUP | **0** | **0** |

## Backtest panel Rencana Eksekusi

### Seluruh candle M5 dan M15

| Keputusan panel | Jumlah |
|---|---:|
| BUY | **0** |
| SELL | **0** |
| WAIT | **188.819** |

### Saat Direction Forecast aktif

| Keputusan panel | Jumlah |
|---|---:|
| BUY | **0** |
| SELL | **0** |
| WAIT | **5.479** |

### Kebocoran level executable ketika WAIT

| Field | Kebocoran |
|---|---:|
| Entry | 0 |
| Stop Loss | 0 |
| TP1 | 0 |
| TP2 | 0 |
| RR | 0 |

### Freshness dan kausalitas

- False `DATA STALE` pada replay: **0**
- Future candle yang dibaca panel: **0**
- False BUY/SELL: **0**
- Level entry/SL/TP/RR yang dibuat tanpa setup resmi: **0**

## Putusan

**PASS untuk lapisan Rencana Eksekusi.**

Panel menerjemahkan hasil Mapping secara aman:

- ketika setup resmi belum ada, panel tetap `WAIT`;
- panel tidak mengarang Entry, SL, TP1, TP2, atau RR;
- candle historis dapat diperlakukan sebagai `CLOSED_CANDLE`, sehingga tidak salah dianggap stale hanya karena berasal dari 2021–2022;
- tidak ada future leak dari panel.

Namun, ini sekaligus menemukan blocker yang bukan berasal dari panel:

> Mapping Engine menghasilkan **0 setup terkunci** pada M5 dan M15 selama 2021–2022 karena funnel kumulatif menjadi nol pada gate `SESSION`.

Akibatnya, periode ini belum dapat mengukur win rate, profit factor, distribusi SL/TP, RR realized, atau expectancy Rencana Eksekusi. Panel lulus sebagai penerjemah keputusan, tetapi performa trading BUY/SELL belum dapat dinilai sampai Mapping menghasilkan setup historis yang valid.

## Batasan

Outcome `SL HIT`, `TP1 HIT / BE`, `TP2 HIT`, `TP1 / BE`, dan `EXPIRED` tidak muncul secara historis karena tidak ada setup terkunci. Status tersebut tetap hanya dapat divalidasi melalui regression fixture sampai terdapat setup historis nyata.
