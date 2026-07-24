# Amy FX — Backtest Final Jujur Market Outlook & Mapping M1–H4 (2022–2025)

> **Status:** final untuk penyelesaian masalah 5, dengan batasan yang dinyatakan terbuka.  
> **Versi aplikasi tidak dinaikkan dan update tidak diterbitkan.**

## Kesimpulan utama

- **Market Outlook belum memiliki edge arah yang terbukti.** Akurasi arah murni pada close horizon adalah **35,30%** dari **25.223** proyeksi; baseline arah candle M15 sebelumnya mencapai **36,43%** pada sampel yang sama.
- Angka tracker **42,78%** bukan akurasi arah murni. Tracker produksi menghitung target yang tercapai lebih dahulu sebagai berhasil; karena itu metrik ini dipisahkan dari close-direction accuracy.
- Pada data **2025 out-of-sample**, akurasi arah murni Market Outlook adalah **37,03%**, masih di bawah baseline candle M15 sebelumnya **38,10%**.
- Mapping terbaik menurut horizon alaminya adalah **H4 44,22%**, diikuti **H1 43,13%**. Seluruh timeframe masih di bawah 50%.
- Keselarasan local trend dan HTF bias memperbaiki beberapa hasil, tetapi hasil terbaik tetap belum melewati 50%.
- OB/FVG dapat menghasilkan reaksi setelah disentuh, tetapi touch rate dan invalidasinya tidak mendukung penggunaan zona sebagai sinyal mandiri.

## Metodologi yang dikunci sebelum membaca hasil

- Dataset XAU/USD bulanan 2022–2025: M1, M5, M15, H1, H4, dan D1. M30 dibentuk ulang dari M15.
- Periode pemanasan Januari–Maret 2022; periode penilaian 1 April 2022–29 Desember 2025.
- 2022–2024 dilaporkan sebagai development period; **2025 dipisahkan sebagai out-of-sample** dan tidak dipakai mengubah ambang setelah hasil dilihat.
- Setiap snapshot memakai **299 candle closed**, sesuai produksi yang meminta 300 candle lalu membuang candle terbaru yang belum closed.
- Tidak ada look-ahead: candle hanya tersedia setelah `open time + interval <= waktu snapshot`; swing kanan tetap membutuhkan konfirmasi produksi.
- Market Outlook menjalankan fungsi produksi `buildMarketOutlooks` dan aturan tracker produksi. Field analisisnya berasal dari engine struktur, liquidity, previous-period level, HTF narrative, dan dealing range yang sama dengan aplikasi.
- News historis yang selaras tidak tersedia. Seluruh pengujian memakai `newsRisk = UNKNOWN`; hasil ini **tidak boleh disebut teruji terhadap news**.
- Confidence interval memakai Wilson 95%.

## Market Outlook

### Hasil keseluruhan

| Metrik | Hasil |
|---|---:|
| Proyeksi selesai | 25.223 |
| Tracker-defined success | 42,78% (CI 42,17–43,39) |
| **Akurasi arah murni pada close horizon** | **35,30% (CI 34,71–35,89)** |
| Baseline: arah candle M15 sebelumnya | 36,43% |
| Baseline: momentum H1 empat candle | 35,03% |
| Klaim bullish/bearish | 21.266 (84,31%) |
| Klaim range | 3.957 (15,69%) |
| Target tercapai lebih dahulu | 28,85% |
| Invalidasi lebih dahulu | 23,38% |
| Rata-rata skor yang tampil | 61,55/100 |

### Per horizon

| Horizon | Sampel | Tracker success | Arah murni | Target hit | Rata-rata skor |
|---|---:|---:|---:|---:|---:|
| 1–4 Jam | 20.499 | 43,13% | **35,36%** | 30,67% | 62,13 |
| Sesi Berjalan | 3.777 | 40,77% | **34,15%** | 20,60% | 59,68 |
| 24 Jam | 947 | 43,29% | **38,44%** | 22,28% | 56,44 |

### Per tahun

| Tahun | Sampel | Tracker success | Arah murni | Baseline M15 |
|---|---:|---:|---:|---:|
| 2022 | 5.327 | 42,03% | **34,77%** | 36,23% |
| 2023 | 6.316 | 40,66% | **33,28%** | 34,53% |
| 2024 | 7.107 | 42,41% | **35,91%** | 36,77% |
| 2025 | 6.473 | 45,88% | **37,03%** | 38,10% |

### Out-of-sample 2025

- Sampel: **6.473**
- Tracker-defined success: **45,88%**
- Akurasi arah murni: **37,03%** (CI 35,86–38,21)
- Baseline candle M15 sebelumnya: **38,10%**
- Baseline momentum H1 empat candle: **36,89%**
- Kesimpulan: kenaikan tracker tidak membuktikan edge arah; close-direction masih kalah tipis dari baseline M15.

### Kalibrasi skor yang tampil

| Skor tampil | Sampel | Rata-rata skor | Tracker success | Arah murni |
|---|---:|---:|---:|---:|
| 40–49 | 1.650 | 46,75 | 43,09% | 36,06% |
| 50–59 | 5.317 | 53,15 | 44,20% | 37,11% |
| 60–69 | 15.865 | 64,32 | 42,28% | 34,59% |
| 70–79 | 2.391 | 72,08 | 42,74% | 35,42% |

**Temuan kalibrasi:** bucket 70–79 tidak lebih akurat daripada bucket 40–49. Karena itu angka UI wajib disebut **Skor Skenario Rule-Based**, bukan probabilitas kemenangan.

## Mapping M1–H4

Horizon alami dikunci sebagai M1=1 jam, M5=2 jam, M15=4 jam, M30=6 jam, H1=12 jam, dan H4=24 jam. `NEUTRAL` dihitung sebagai WAIT dan harus masuk laporan coverage.

| TF | Snapshot | Coverage arah | Akurasi arah | Saat aligned | Target hit | Baseline candle | Baseline momentum |
|---|---:|---:|---:|---:|---:|---:|---:|
| M1 | 5.416 | 100,00% | **32,66%** | 34,89% | 49,83% | 35,15% | 41,46% |
| M5 | 5.416 | 100,00% | **35,91%** | 37,89% | 40,60% | 36,81% | 39,25% |
| M15 | 5.416 | 100,00% | **41,30%** | 42,96% | 35,80% | 40,54% | 40,92% |
| M30 | 5.416 | 100,00% | **41,58%** | 43,30% | 33,15% | 42,39% | 43,19% |
| H1 | 5.416 | 100,00% | **43,13%** | 45,76% | 33,73% | 44,22% | 43,89% |
| H4 | 5.416 | 100,00% | **44,22%** | 46,12% | 32,95% | 41,83% | 41,67% |

### Mapping out-of-sample 2025

| TF | Akurasi arah | Saat aligned | Target hit | Baseline candle | Baseline momentum |
|---|---:|---:|---:|---:|---:|
| M1 | **36,09%** | 39,35% | 50,48% | 38,68% | 41,39% |
| M5 | **38,65%** | 39,76% | 41,74% | 39,04% | 40,27% |
| M15 | **42,70%** | 46,25% | 37,45% | 40,27% | 44,17% |
| M30 | **43,49%** | 46,29% | 35,11% | 41,31% | 44,59% |
| H1 | **44,20%** | 48,84% | 33,45% | 45,59% | 46,30% |
| H4 | **43,56%** | 46,84% | 29,62% | 42,65% | 41,38% |

## OB/FVG — sampel mingguan terstratifikasi

Setiap minggu memakai snapshot market pertama yang memiliki data lengkap. Zona dinilai bereaksi bila setelah touch harga bergerak **0,5 ATR** melewati sisi jauh zona searah sebelum close-based invalidation. Ini mengurangi penghitungan berulang zona yang sama, tetapi bukan pengujian setiap zona yang pernah terbentuk.

| TF/Zona | Minggu | Coverage tampil | Touch saat tampil | Reaksi setelah touch | Invalidasi setelah touch |
|---|---:|---:|---:|---:|---:|
| M1/FVG | 196 | 96,94% | 88,42% | **65,48%** | 34,52% |
| M1/OB | 196 | 91,84% | 54,44% | **54,08%** | 45,92% |
| M5/FVG | 196 | 97,96% | 78,65% | **60,26%** | 37,75% |
| M5/OB | 196 | 89,80% | 36,36% | **67,19%** | 31,25% |
| M15/FVG | 196 | 95,41% | 66,84% | **59,20%** | 40,00% |
| M15/OB | 196 | 89,80% | 34,66% | **59,02%** | 40,98% |
| M30/FVG | 196 | 91,84% | 62,22% | **54,46%** | 43,75% |
| M30/OB | 196 | 89,29% | 28,00% | **48,98%** | 48,98% |
| H1/FVG | 196 | 95,41% | 73,26% | **53,28%** | 44,53% |
| H1/OB | 196 | 92,86% | 37,36% | **54,41%** | 44,12% |
| H4/FVG | 196 | 98,47% | 50,26% | **50,52%** | 35,05% |
| H4/OB | 196 | 92,86% | 29,12% | **33,96%** | 60,38% |

## Keputusan implementasi yang jujur

1. Angka Market Outlook tetap diberi label **Skor Skenario Rule-Based**, bukan probabilitas menang atau akurasi.
2. Tracker success, close-direction accuracy, target hit, invalidasi, jumlah sampel, periode, dan versi rules engine harus dipisahkan.
3. Market Outlook dan Mapping tidak boleh menyatakan akurasi di atas 50% berdasarkan backtest ini.
4. OB/FVG hanya konteks lokasi/reaksi; bukan sinyal entry mandiri.
5. Saat data stale, seluruh klaim live harus ditahan dan UI menampilkan `DATA USANG`.
6. Hasil buruk tetap disimpan; tidak ada pemilihan hanya timeframe atau tahun terbaik.

## Batasan

- Tidak ada dataset news historis yang tersinkron.
- M30 direkonstruksi dari M15.
- Timestamp CSV ditafsirkan sebagai UTC; sesi dihitung dengan aturan produksi Asia/Jakarta.
- Spread, slippage, komisi, dan eksekusi broker tidak dimodelkan.
- Ini mengukur perilaku rules engine, bukan profitabilitas sistem trading.

## Audit

- Engine source saat pengujian: `fix/amyfx-five-issues-20260724@7f78631101db834481d92185b2791feac29600f6`
- SHA-256 ringkasan JSON lengkap: `b74651ee6310b6c0e519dc25bf8eb4adbc86b774ad6efcea6be1b3a17cd975fc`
- SHA-256 raw records lokal: `06a4a5d214f6697e51247985d807e6471471b0fdeafd48a8d9563fbefe4c1ac6`
- Tidak mengubah `versionName`, `versionCode`, `update.json`, APK, atau release channel.
