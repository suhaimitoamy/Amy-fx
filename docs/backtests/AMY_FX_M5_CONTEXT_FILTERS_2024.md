# Amy FX — Eksperimen Filter Konteks M5 2024

> Tujuan: mencari penyebab setup FVG + rejection masih gagal dengan menguji filter satu per satu.  
> Data: 71.133 candle M5 dan 355.592 candle M1.  
> M1 hanya digunakan untuk urutan entry, SL, dan TP.

## Definisi filter

- **Grade A:** first touch FVG sekaligus menyapu high/low lokal 5 candle.
- **Clean Path:** tidak ada opposing FVG yang masih valid di antara entry dan TP2 ketika konfirmasi muncul.
- **Trend Aligned:** EMA20/EMA50 terpisah minimal 0,15 ATR dan slope EMA20 enam candle searah trade.
- **Sesi WITA:** Asia 06:00–14:00, London 14:00–18:00, New York 19:30–04:00.
- Setiap model diseleksi ulang secara non-overlap agar perbandingannya adil.

## Perbandingan utama

| Filter | Entry 2024 | TP1 | TP2 | Exp. TP2 | Entry Sep–Des | TP2 Sep–Des | Exp. Sep–Des |
|---|---:|---:|---:|---:|---:|---:|---:|
| BASELINE | 165 | 53.94% | 42.42% | 0.273R | 54 | 37.04% | 0.111R |
| GRADE_A_ONLY | 44 | 63.64% | 50.00% | 0.500R | 13 | 46.15% | 0.385R |
| CLEAN_PATH_ONLY | 147 | 53.74% | 41.50% | 0.245R | 43 | 37.21% | 0.116R |
| TREND_ALIGNED_ONLY | 63 | 50.79% | 41.27% | 0.238R | 28 | 32.14% | -0.036R |
| COUNTER_TREND_ONLY | 91 | 58.24% | 43.96% | 0.319R | 24 | 45.83% | 0.375R |
| ASIA_ONLY | 53 | 45.28% | 35.85% | 0.075R | 21 | 23.81% | -0.286R |
| LONDON_ONLY | 37 | 43.24% | 29.73% | -0.108R | 9 | 33.33% | 0.000R |
| NEW_YORK_ONLY | 36 | 66.67% | 58.33% | 0.750R | 9 | 55.56% | 0.667R |
| PRE_NEW_YORK_ONLY | 27 | 74.07% | 55.56% | 0.667R | 12 | 58.33% | 0.750R |
| POST_NEW_YORK_ONLY | 12 | 41.67% | 33.33% | 0.000R | 3 | 0.00% | -1.000R |
| NEW_YORK_OR_PRE_NY | 63 | 69.84% | 57.14% | 0.714R | 21 | 57.14% | 0.714R |

## Temuan utama

1. **Clean Path bukan masalah utama.** Hasilnya hampir sama dengan baseline: TP2 41,50% dan validasi 37,21%.
2. **Filter trend searah justru melemahkan setup.** Validasi Trend Aligned menjadi -0,036R, sedangkan Counter Trend tetap +0,375R. Ini menunjukkan setup FVG ini lebih berperan sebagai reaksi/reversal, bukan continuation murni.
3. **Waktu entry adalah pembeda terbesar.** Asia dan London lemah, sedangkan rentang 18:00–04:00 WITA (Pre-New York + New York) paling konsisten.
4. **Grade A tetap berguna**, tetapi hanya menghasilkan 44 entry. Memakainya sendirian terlalu memperkecil frekuensi.

## Kandidat praktis

Aturan yang paling seimbang pada data ini adalah menjalankan M5 Reaction First hanya pada **18:00–04:00 WITA**:

| Metrik | 2024 | Validasi Sep–Des |
|---|---:|---:|
| Entry | 63 | 21 |
| TP1 1,5R | 69,84% | 71,43% |
| TP2 2R | 57,14% | 57,14% |
| Ekspektasi TP2 | +0,714R | +0,714R |
| Risiko rata-rata | 0,938 poin | 0,951 poin |

Stress biaya model ini masih +0,480R pada biaya pulang-pergi 0,20 poin dan +0,362R pada biaya 0,30 poin.

## Hasil bulanan kandidat 18:00–04:00 WITA

| Bulan | Entry | TP1 | TP2 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|
| 2024-01 | 4 | 100,00% | 75,00% | +1,250R |
| 2024-02 | 1 | 0,00% | 0,00% | -1,000R |
| 2024-03 | 5 | 40,00% | 40,00% | +0,200R |
| 2024-04 | 10 | 60,00% | 40,00% | +0,200R |
| 2024-05 | 4 | 100,00% | 75,00% | +1,250R |
| 2024-06 | 7 | 85,71% | 85,71% | +1,571R |
| 2024-07 | 4 | 75,00% | 50,00% | +0,500R |
| 2024-08 | 7 | 57,14% | 57,14% | +0,714R |
| 2024-09 | 2 | 100,00% | 100,00% | +2,000R |
| 2024-10 | 5 | 60,00% | 40,00% | +0,200R |
| 2024-11 | 8 | 87,50% | 62,50% | +0,875R |
| 2024-12 | 6 | 50,00% | 50,00% | +0,500R |

## Keputusan eksperimen

- Penyebab terbesar turunnya WR adalah **setup dipakai sepanjang hari**, terutama saat Asia dan London, bukan karena FVG-nya terlambat disentuh.
- Kandidat 18:00–04:00 WITA lebih kuat daripada Grade A-only dan masih mempertahankan frekuensi yang masuk akal.
- Hasil ini masih berasal dari satu tahun dan beberapa filter yang dibandingkan. Karena risiko data-mining, filter sesi belum dijadikan logika aktif aplikasi sebelum diperiksa pada tahun lain atau disetujui sebagai eksperimen preview.
- Spread, slippage, komisi, news, dan eksekusi broker belum dimodelkan.

## Audit

- Kandidat sebelum seleksi non-overlap: **171**.
- SHA-256 kandidat: `e59a1e953ab227e71752fd1296ed61eb73ba63ee68784cd12fd68b361538c567`.
