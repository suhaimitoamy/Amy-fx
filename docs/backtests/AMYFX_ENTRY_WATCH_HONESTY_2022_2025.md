# Uji Kejujuran Multi-Timeframe Entry Watch — 2022–2025

## Status

- Branch: `feature/amyfx-v1.5-full-enhancements`
- Source HEAD: `bcf6015fd3ab8679e469604ac65c59312edb072a`
- Periode: 1 Januari 2022–31 Desember 2025
- Warm-up: Desember 2021
- Data 2026: **tidak digunakan**
- Tujuan: membaca kejujuran dan kausalitas lifecycle; **bukan mencari win rate, profit, SL, atau TP terbaik**.
- Mode utama: Direction Forecast M15. M5 dan H1 dipakai sebagai pemeriksaan silang.

## Putusan akhir

**BELUM JUJUR UNTUK EKSEKUSI ENTRY LIVE.**

Arah BUY/SELL dan klasifikasi sweep-versus-break sudah konsisten. Kegagalan berada pada penyimpanan dan pemulihan lifecycle level: level dapat hidup kembali setelah break tersembunyi, tetap dipakai setelah keluar dari detector aktif, atau mengeluarkan entry berulang tanpa reset lifecycle.

## Hasil mode utama M15

| Pemeriksaan | Hasil |
|---|---:|
| Level watch baru | 115 |
| Entry trigger unik | 70 |
| Valid break | 47 |
| Break ketika forecast tidak aktif | 30 |
| Level hidup kembali setelah hidden break | **25** |
| Entry dari level yang sudah keluar detector | **13** |
| Entry tanpa fase pantau sebelumnya | **2** |
| Level yang menghasilkan entry berulang | **18** |
| Entry tambahan akibat pengulangan | **40** |

Usia level saat entry: median **7.492 jam**, P90 **61.275 jam**, maksimum **161.917 jam**.

## Pemeriksaan silang

| Sumber arah | Entry unik | Valid break | Hidden break | Hidup kembali | Orphan entry | Entry berulang tambahan |
|---|---:|---:|---:|---:|---:|---:|
| M5 | 9 | 29 | 19 | 9 | 0 | 3 |
| M15 | 70 | 47 | 30 | 25 | 13 | 40 |
| H1 | 11 | 12 | 9 | 5 | 2 | 5 |

H1 menemukan entry dari level berusia maksimum **1037.583 jam** atau sekitar **43.2 hari**. Ini bukan otomatis salah, tetapi tanpa expiry dan rekonsiliasi semua candle, level tersebut tidak aman dianggap masih valid.

## Putusan per komponen

| Komponen | Putusan | Bukti |
|---|---|---|
| Direction Forecast sebagai penentu arah | **JUJUR** | Seluruh entry tetap searah forecast aktif. |
| Sweep vs Valid Break | **JUJUR** | Close timeframe asal diperiksa lebih dahulu; wick lower timeframe tidak dapat mengalahkan source-close break. |
| PANTAU sebelum ENTRY | **GAGAL** | Mode M15 menghasilkan 2 entry pada evaluasi pertama level. |
| Rekonsiliasi saat forecast mati | **GAGAL** | 25 level M15-mode hidup kembali setelah pernah ditembus saat engine tidak mengevaluasi forecast. |
| Konsistensi dengan detector aktif | **GAGAL** | 13 entry M15-mode berasal dari level yang telah keluar dari detector aktif. |
| Satu lifecycle satu entry | **TIDAK STABIL** | 18 level memicu 40 entry tambahan pada sweep berikutnya tanpa reset eksplisit. |
| FVG→iFVG, OB→BB, liquidity→Valid Break | **JUJUR BERSYARAT** | Label berubah setelah source-close break, tetapi hasil konversi tidak memiliki expiry dan gap reconciliation lengkap. |
| Closed-candle / look-ahead | **JUJUR BERSYARAT** | Tidak ditemukan entry dari trigger yang mulai sebelum level tersedia dalam replay ini, tetapi guard waktunya belum ada di kode. |

## Akar masalah kode

1. Saat Direction Forecast tidak aktif, runtime menghentikan tampilan tetapi tidak menghapus atau menutup `previous` Entry Watch.
2. Ketika forecast aktif kembali, engine hanya menilai candle source terakhir. Break yang terjadi di antara dua periode forecast dapat terlewat.
3. Level yang sudah dipilih tetap terkunci meskipun detector FVG/OB/liquidity telah menghapusnya.
4. `ENTRY_TRIGGERED` dapat muncul ketika level baru dipilih pada evaluasi yang sama.
5. Setelah satu entry, level tidak memiliki aturan `ARMED → TRIGGERED → SPENT/RESET`, sehingga sweep lain dapat menghasilkan entry baru.
6. Level hasil konversi tidak memiliki expiry maupun pemeriksaan seluruh candle sejak break.

## Perbaikan wajib sebelum live

- Saat forecast menjadi WAIT/expired/invalidated, tandai watch aktif sebagai `FORECAST_PAUSED` dan simpan waktu evaluasi terakhir; jangan membiarkannya diam tanpa rekonsiliasi.
- Ketika forecast aktif kembali, replay seluruh source candle yang tertutup sejak `lastEvaluatedClose`; satu break saja harus membuat level terminal.
- Entry hanya boleh terjadi jika level sudah pernah berada pada `WATCHING_LEVEL` atau `LEVEL_TESTING` minimal satu candle trigger penuh.
- Sebelum entry, pastikan level masih terdapat dalam detector aktif atau memiliki lifecycle independen yang sah dan belum expired.
- Tambahkan status `ENTRY_SPENT`; entry kedua memerlukan reset/re-arm yang eksplisit.
- Tambahkan expiry dan invalidasi dua arah untuk iFVG, Breaker Block, serta Valid Break.
- Tambahkan aturan keras: waktu buka candle trigger harus sama dengan atau sesudah waktu close ketika level menjadi tersedia.

## Batas cakupan

Replay memakai FVG, Order Block, dan swing-liquidity sesuai aturan branch. Equal liquidity serta PDH/PDL/PWH/PWL tidak dimasukkan. Karena itu jumlah kegagalan di atas adalah **batas minimum**, bukan estimasi maksimum.
