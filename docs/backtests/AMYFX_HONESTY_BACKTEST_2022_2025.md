# Uji Kejujuran Amy FX — Backtest 2022–2025

## Status eksekusi

- Branch pengerjaan: `feature/amyfx-v1.5-full-enhancements`
- Source HEAD yang diuji: `d0f01742d08c86f8f836b8dd4fae47412aa5c45a`
- Periode hasil: 1 Januari 2022 sampai 31 Desember 2025
- Warm-up indikator: Desember 2021
- Instrumen: XAUUSD
- Data 2026: **tidak digunakan**
- Branch `main`: **tidak disentuh**
- Kanal Preview `experiment/heatmap-news-20260722`: **tidak disentuh**

## Putusan akhir

**Amy FX berstatus JUJUR BERSYARAT.**

| Komponen | Putusan | Bukti utama |
|---|---|---|
| Integritas candle / repaint | **LULUS** | Replay hanya memakai candle closed; pivot 4/4 dan 6/6 baru sah setelah bar kanan selesai; target dibekukan saat context terbit. |
| Market State | **JUJUR sebagai konteks, gagal sebagai prediksi** | Akurasi endpoint gabungan **50.43%** dari 5.406 sampel. |
| Direction Forecast | **Terkalibrasi untuk endpoint horizon historis** | M5 **64.96%** vs label 65; M15 **59.88%** vs label 60; H1 **65.53%** vs label 65. |
| Direction Forecast sebagai entry | **GAGAL** | First-hit ±1 ATR hanya **50.51%**; 89.90% forecast berakhir oleh break berlawanan sebelum horizon. |
| Liquidity Draw 97 | **LULUS sebagai destination context** | **88.03%** conservative, n=468; bukan bukti entry atau profitabilitas. |
| Entry Map | **GAGAL sebagai setup tervalidasi** | Branch sendiri menyimpan klaim reaksi **48,24%** untuk 2022–2025, tetapi setup eksperimental masih dapat diteruskan ke lifecycle dan copy “FOKUS BUY/SELL”. |
| Semantik confidence UI | **TIDAK LULUS** | Liquidity Draw masih menampilkan score sebagai `%`, padahal research lock mendefinisikannya sebagai score `/100`, bukan probabilitas. |

## Metode uji

1. Semua file bulanan 2022–2025 digabung secara kronologis dan dideduplikasi berdasarkan timestamp.
2. Desember 2021 hanya dipakai sebagai warm-up EMA, ATR, pivot, PDH/PDL, dan PWH/PWL.
3. Timestamp CSV diperlakukan sebagai waktu pembukaan candle UTC. Session filter kemudian dihitung dalam `Asia/Makassar`.
4. Candle terakhir yang masih berjalan tidak dipakai. H4 untuk replay Liquidity Draw hanya tersedia setelah candle H4 selesai.
5. Market State dan Direction Forecast dijalankan maju satu arah. Tidak ada nilai sesudah timestamp keputusan yang boleh masuk ke keputusan tersebut.
6. Liquidity Draw memakai M15/H1, threshold 97, cooldown non-overlap 72 jam per timeframe, serta target BSL dan SSL yang dibekukan ketika context diterbitkan.
7. Outcome Liquidity Draw dibaca dari M1 sesudah close candle context: target proyeksi lebih dahulu = benar; target lawan lebih dahulu = salah; keduanya pada M1 yang sama = ambigu; tidak ada sentuhan dalam 72 jam = unresolved.
8. Direction Forecast dinilai dengan dua cara: arah close pada horizon tetap bawaan engine, serta first-hit +1 ATR versus -1 ATR selama lifecycle aktif.
9. Market State dinilai sebagai arah close pada horizon profile dengan sampling non-overlap sesuai cooldown profile.

## Integritas data

| Timeframe | Jumlah candle 2022–2025 |
|---|---:|
| M1 | 1.372.863 |
| M5 | 274.665 |
| M15 | 91.562 |
| H1 | 22.905 |
| H4 | 6.368 |
| D1 | 1.244 |
| W1 hasil agregasi | 209 |

Pemeriksaan OHLC, urutan timestamp, dan duplikasi lulus. Provenance dataset belum diverifikasi terhadap satu broker tertentu; hasil ini menguji kejujuran logika terhadap dataset yang tersedia, bukan menjamin kesamaan feed setiap broker.

## Hasil Liquidity Draw 97

### Per timeframe

| TF | n | Benar | Salah | Unresolved | Akurasi conservative | Akurasi resolved |
|---|---:|---:|---:|---:|---:|---:|
| M15 | 295 | 263 | 27 | 5 | 89.15% | 90.69% |
| H1 | 173 | 149 | 13 | 11 | 86.13% | 91.98% |
| Gabungan | 468 | 412 | 40 | 16 | **88.03%** | **91.15%** |

### Per tahun, gabungan M15 + H1

| Tahun | n | Benar | Salah | Unresolved | Conservative |
|---|---:|---:|---:|---:|---:|
| 2022 | 110 | 97 | 11 | 2 | 88.18% |
| 2023 | 117 | 101 | 11 | 5 | 86.32% |
| 2024 | 120 | 109 | 7 | 4 | 90.83% |
| 2025 | 121 | 105 | 11 | 5 | 86.78% |

**Interpretasi:** Liquidity Draw stabil sebagai pertanyaan “BSL atau SSL mana yang disentuh lebih dahulu”. Hasil ini tidak membuktikan bahwa entry menuju destination tersebut memiliki RR, expectancy, atau profit factor yang layak.

## Hasil Direction Forecast

| TF | Label historis di engine | n | Akurasi endpoint horizon | Invalidated sebelum horizon | First-hit ±1 ATR selama lifecycle |
|---|---:|---:|---:|---:|---:|
| M5 | 65 | 117 | 64.96% | 100.00% | 46.15% |
| M15 | 60 | 172 | 59.88% | 100.00% | 45.35% |
| H1 | 65 | 206 | 65.53% | 75.73% | 57.28% |
| Gabungan | tidak boleh dirata-ratakan sebagai satu confidence | 495 | 63.43% | 89.90% | **50.51%** |

### Endpoint horizon gabungan per tahun

| Tahun | n | Akurasi endpoint | First-hit ±1 ATR lifecycle |
|---|---:|---:|---:|
| 2022 | 115 | 59.13% | 45.22% |
| 2023 | 109 | 66.97% | 62.39% |
| 2024 | 139 | 62.59% | 43.17% |
| 2025 | 132 | 65.15% | 53.03% |

**Interpretasi:** angka 60/65 pada engine cocok dengan akurasi endpoint historis masing-masing timeframe. Namun angka itu tidak boleh dibaca sebagai peluang trade menang. Ketika diuji sebagai perlombaan +1 ATR versus -1 ATR selama sinyal aktif, hasil gabungan hanya 50.51%.

## Hasil Market State

| TF | n | Akurasi endpoint |
|---|---:|---:|
| M5 | 3.595 | 50.71% |
| M15 | 1.316 | 49.54% |
| H1 | 495 | 50.71% |
| Gabungan | 5.406 | **50.43%** |

| Tahun | n | Akurasi endpoint gabungan |
|---|---:|---:|
| 2022 | 1.391 | 49.96% |
| 2023 | 1.199 | 50.13% |
| 2024 | 1.418 | 50.63% |
| 2025 | 1.398 | 50.93% |

Market State tidak memiliki edge arah yang terbukti. Pemakaian saat ini sebagai context dan status `WAIT` adalah jujur. Mengubahnya menjadi BUY/SELL akan menyesatkan.

## Temuan ketidakjujuran tampilan

### 1. Entry Map eksperimental masih dapat terlihat tervalidasi

Current branch menempelkan label internal `EXPERIMENTAL CLAIM` dan mencatat akurasi 48,24%. Namun ketika forecast aktif dan searah, setup tersebut kembali dimasukkan sebagai `bestSetup`, diteruskan ke `buildSetupExecution`, lalu penjelasan dapat menampilkan “Setup searah dengan arah market tervalidasi” dan “FOKUS BUY/SELL”.

Ini mencampurkan dua tingkat bukti:

- arah forecast memiliki kalibrasi endpoint 60–65%;
- area Entry Map sendiri hanya memiliki klaim reaksi 48,24%.

Karena itu, Entry Map tidak jujur bila tampil sebagai setup aktif yang seolah ikut tervalidasi oleh Direction Forecast.

### 2. Liquidity Draw memakai simbol persen

Engine menghasilkan confidence score threshold 97. UI saat ini menulis `97%` dan “confidence minimum 97%”. Research lock menyatakan score tersebut bukan probabilitas 97%. Secara logika destination tetap kuat, tetapi copy UI melebihkan makna statistiknya.

### 3. Direction Forecast memakai persen tanpa qualifier yang terlihat

Source menyimpan `confidenceMeaning = DISPLAY_CONFIDENCE_FROM_VALIDATED_BACKTEST_NOT_LIVE_WIN_PROBABILITY`, tetapi status UI hanya menampilkan `60%` atau `65%`. Hasil backtest membenarkan angka historisnya, namun pengguna dapat salah membaca sebagai probabilitas trade live.

## Audit repaint dan look-ahead

- Input live membuang candle terakhir yang masih berjalan.
- Pivot fast dan slow baru dikonfirmasi setelah 4 atau 6 candle kanan tersedia; pivot tidak ditempel sebelum confirmation bar.
- Validated Direction Forecast memakai H4 yang ditutup dan tidak membaca H4 aktif.
- Range 80, EMA, ATR, momentum, break, dan market state hanya memakai candle sampai waktu keputusan.
- Replay Liquidity Draw memasok H4 closed-only, membekukan kedua target, signal close, dan ATR ketika context terbit.
- Tidak ada data 2026 yang dipakai.

**Verdict repaint:** tidak ditemukan look-ahead langsung pada jalur Validated Market Context yang diuji. Liquidity Draw tetap bergantung pada kontrak pemanggil agar array H4 hanya berisi candle closed; live `fetchTf` saat ini memenuhi kontrak tersebut.

## Batas audit

- Full detector Entry Map dari `ict-core.js` tidak direkonstruksi ulang dalam runner ini. Angka 48,24% adalah klaim audit yang sudah tertanam pada branch yang diuji dan diverifikasi keberadaannya di jalur runtime.
- Backtest tidak mengukur spread, slippage, komisi, ukuran lot, atau profitabilitas karena Liquidity Draw dan Direction Forecast bukan strategi entry lengkap.
- Akurasi endpoint bukan win rate trading.

## File hasil

- Ringkasan mesin: `docs/backtests/amyfx-honesty-2022-2025-summary.json`
- Laporan: `docs/backtests/AMYFX_HONESTY_BACKTEST_2022_2025.md`
