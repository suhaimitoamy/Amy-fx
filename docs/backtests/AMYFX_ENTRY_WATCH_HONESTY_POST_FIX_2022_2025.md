# Uji Kejujuran Entry Watch Setelah Perbaikan — 2022–2025

## Status

- Branch: `feature/amyfx-v1.5-full-enhancements`
- Periode: 1 Januari 2022–31 Desember 2025
- Data 2026: **tidak digunakan**
- Tujuan: verifikasi kausalitas lifecycle; **bukan mencari win rate**.
- Sumber arah silang: M5, M15, dan H1.

## Putusan

**JUJUR SECARA LIFECYCLE.**

Perbaikan menutup enam kegagalan audit sebelumnya: hidden break, resurrection, orphan entry, entry tanpa fase pantau, repeat entry, dan level tanpa expiry.

## Hasil pemeriksaan silang

| Sumber arah | Level dipantau | Entry unik | Valid break | Break saat pause direkonsiliasi | Expired | Retired |
|---|---:|---:|---:|---:|---:|---:|
| M5 | 162 | 26 | 77 | 60 | 46 | 10 |
| M15 | 315 | 90 | 143 | 93 | 66 | 20 |
| H1 | 822 | 353 | 236 | 67 | 148 | 92 |

## Pelanggaran kejujuran setelah perbaikan

| Pemeriksaan | Hasil |
|---|---:|
| Entry tanpa fase PANTAU/armed | **0** |
| Trigger dimulai sebelum level tersedia | **0** |
| Level hidup kembali setelah hidden break | **0** |
| Entry dari level di luar detector | **0** |
| Entry berulang dari level yang sama | **0** |

## Aturan yang sekarang dikunci

1. Level baru hanya di-arm; candle yang sama tidak dapat langsung memicu entry.
2. Saat forecast pause, entry dihentikan tetapi semua source-close tetap direkonsiliasi.
3. Saat aplikasi/forecast aktif kembali, seluruh candle sejak evaluasi terakhir diputar ulang.
4. Level yang keluar dari detector menjadi `LEVEL_RETIRED`.
5. Satu level hanya boleh menghasilkan satu entry, lalu menjadi `ENTRY_SPENT`.
6. Level asli dan hasil konversi memiliki expiry eksplisit.
7. Candle trigger hanya sah bila open-nya sama dengan atau sesudah waktu level tersedia.

## Batas putusan

Putusan **jujur secara lifecycle** tidak berarti profitable dan tidak menyatakan win rate. SL/TP masih memakai parameter engineering dan harus diuji terpisah bila nantinya digunakan untuk pengelolaan posisi.
