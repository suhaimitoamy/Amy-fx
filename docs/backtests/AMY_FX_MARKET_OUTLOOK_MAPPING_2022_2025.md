# Amy FX — Backtest Market Outlook dan Mapping M1–H4 (2022–2025)

## Metodologi

- Dataset: 48 arsip bulanan XAU/USD 2022–2025.
- Candle asli: M1, M5, M15, H1, H4, D1. M30 dan W1 dibentuk ulang.
- Warm-up Januari–Maret 2022; proyeksi dinilai 1 April 2022–30 Desember 2025 agar setiap horizon selesai.
- Market Outlook mengikuti tiga slot produksi: satu 1–4 jam per jam, satu per sesi, dan satu 24 jam per hari.
- Pengujian memakai port independen dari rules engine saat ini untuk menjalankan histori secara efisien; bukan eksekusi WebView/browser langsung.
- Target yang tersentuh sebelum invalidasi dinilai benar. Jika tidak ada target/invalidasi, arah close saat expiry dinilai menggunakan toleransi ATR produksi.
- Mapping M1–H4 diuji dari snapshot per jam.

## Market Outlook

Total proyeksi: **26,226**  
Akurasi arah keseluruhan: **42.19%**  
Target hit: **26.47%**  
Invalidasi: **19.07%**

| Horizon | Sampel | Akurasi arah | Target hit | Invalidasi | Skor model rata-rata |
|---|---:|---:|---:|---:|---:|
| 1–4 Jam | 21,395 | 42.67% | 28.00% | 21.59% | 63.23% |
| Sesi Berjalan | 3,864 | 38.51% | 18.32% | 7.66% | 61.53% |
| 24 Jam | 967 | 46.12% | 25.13% | 8.79% | 59.07% |

### Kalibrasi skor

| Angka tampil | Sampel | Akurasi aktual | Rata-rata angka tampil |
|---|---:|---:|---:|
| 40–49% | 2,243 | 44.05% | 47.92% |
| 50–59% | 4,472 | 44.39% | 54.46% |
| 60–69% | 18,083 | 41.62% | 65.85% |
| 70–79% | 1,428 | 39.50% | 74.08% |

## Mapping M1–H4

| TF | Sampel | Cakupan arah | Akurasi arah lokal | Akurasi bias HTF | Cakupan aligned | Akurasi aligned | Akurasi target likuiditas pertama |
|---|---:|---:|---:|---:|---:|---:|---:|
| M1 | 21,395 | 100.00% | 35.31% | 38.66% | 56.39% | 38.06% | 46.79% |
| M5 | 21,395 | 100.00% | 41.72% | 44.12% | 55.85% | 44.11% | 37.66% |
| M15 | 21,395 | 100.00% | 45.62% | 48.20% | 57.25% | 48.53% | 41.03% |
| M30 | 21,395 | 100.00% | 43.58% | 46.32% | 60.94% | 46.36% | 29.45% |
| H1 | 21,395 | 100.00% | 44.43% | 46.34% | 69.81% | 46.12% | 29.02% |
| H4 | 21,395 | 100.00% | 45.74% | 44.10% | 60.51% | 47.01% | 29.27% |

### Valid break

Dua kolom hasil tidak saling eksklusif: sebuah break dapat bergerak ≥0,5 ATR terlebih dahulu lalu kembali gagal sebelum horizon selesai. Karena tingkat gagal sangat tinggi, label valid break tidak boleh dipakai sendirian sebagai sinyal kelanjutan.

| TF | Event | Pernah lanjut ≥0,5 ATR | Kemudian gagal dalam horizon | Displacement |
|---|---:|---:|---:|---:|
| M1 | 21,245 | 94.83% | 68.80% | 70.05% |
| M5 | 12,686 | 94.40% | 88.99% | 66.46% |
| M15 | 4,798 | 95.02% | 96.25% | 64.40% |
| M30 | 2,439 | 94.01% | 96.27% | 65.48% |
| H1 | 1,210 | 96.45% | 97.44% | 64.71% |
| H4 | 377 | 93.90% | 99.73% | 72.41% |

### OB / FVG

| TF / Zona | Zona unik | Touch | Reaksi setelah touch | Invalidasi |
|---|---:|---:|---:|---:|
| H1 / FVG | 1,933 | 81.01% | 68.58% | 2.22% |
| H1 / OB | 771 | 59.40% | 32.97% | 11.41% |
| H4 / FVG | 535 | 79.81% | 71.90% | 2.06% |
| H4 / OB | 266 | 57.14% | 22.37% | 12.41% |
| M1 / FVG | 19,467 | 65.54% | 42.02% | 12.40% |
| M1 / OB | 16,829 | 44.48% | 43.26% | 11.78% |
| M15 / FVG | 5,720 | 78.88% | 50.62% | 3.41% |
| M15 / OB | 2,831 | 59.34% | 47.26% | 7.95% |
| M30 / FVG | 3,408 | 77.41% | 57.51% | 2.35% |
| M30 / OB | 1,528 | 50.20% | 43.29% | 6.35% |
| M5 / FVG | 11,331 | 68.05% | 46.50% | 4.71% |
| M5 / OB | 7,030 | 48.83% | 46.58% | 7.51% |

## Data stale / gap

| TF | Candle | Gap | Rasio gap | Gap maksimum |
|---|---:|---:|---:|---:|
| M1 | 1,372,863 | 1,893 | 0.138% | 74.0 jam |
| M5 | 274,665 | 1,590 | 0.579% | 74.1 jam |
| M15 | 91,562 | 1,581 | 1.727% | 74.2 jam |
| M30 | 45,785 | 1,581 | 3.453% | 74.5 jam |
| H1 | 22,905 | 1,579 | 6.894% | 75.0 jam |
| H4 | 6,368 | 212 | 3.330% | 76.0 jam |

## Temuan utama

- Skor skenario Market Outlook belum terkalibrasi sebagai probabilitas kemenangan. Bucket 70–79% hanya menghasilkan akurasi arah 39,50%.
- Akurasi arah tertinggi Market Outlook terdapat pada horizon 24 jam sebesar 46,12%; semuanya masih di bawah 50%.
- Mapping M15 aligned menjadi hasil arah terbaik di kelompok M1–H4, tetapi hanya 48,53%.
- Target likuiditas pertama paling konsisten pada M1 sebesar 46,79%, tetap belum cukup untuk disebut sinyal mandiri.
- FVG lebih konsisten disentuh kembali daripada OB, tetapi reaksi setelah sentuhan berbeda besar antar-timeframe.

## Kesimpulan implementasi

- Angka Market Outlook diubah labelnya menjadi **skor skenario rule-based**, bukan probabilitas kemenangan.
- Statistik historis ditempatkan dalam accordion tertutup agar tidak dibaca sebagai sinyal real-time.
- Ketika M15 stale, badge LIVE diganti menjadi M15 STALE.
- Backtest ini tidak menaikkan versionName, versionCode, atau mengaktifkan update aplikasi.
