# Amy FX — Optimasi Model A IFVG dan Model B FVG, Januari 2026

Tanggal penelitian: 29 Juli 2026  
Repository: `suhaimitoamy/Amy-fx`  
Branch: `personal/amyfx-private`  
Status: **backtest penelitian Januari 2026 saja; bukan perubahan rule produksi**

## Definisi yang dikunci

- Bias HTF: H1 order flow kausal. Bias berubah ketika candle H1 yang sudah tutup menembus swing fractal-2 terkonfirmasi; sinyal M15 tidak membaca H1 yang masih berjalan.
- Premium/discount: midpoint zona dibandingkan equilibrium swing high/low M15 fractal-4 yang sudah terkonfirmasi saat sinyal.
- Displacement FVG: candle tengah searah, body minimal 1 ATR(14), body/range minimal 60%, dan close menembus swing fractal-4 terakhir.
- Entry tetap next-open M15; semua trade independen; urutan intrabar konservatif: stop aktif diperiksa lebih dahulu.
- Win rate adalah trade selesai dengan R positif, termasuk time exit yang masih profit.
- Kandidat seimbang dipilih dari rasio Net R / Max Drawdown, hanya varian positif dengan minimal 20 trade.

- Regression guardrail lulus: baseline IFVG lokal 1 jam, FVG lokal 1 jam, dan FVG struktural 16 candle mereproduksi hasil laporan Januari sebelumnya secara numerik.

## Experiment 1 — Model A: IFVG Scalper Engine

| HTF | Buffer | Exit | Trade | Win rate | Target hit | Net R | Max DD | TP | SL | BE | Time exit | Median SL | Average SL | R/DD |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| No HTF | 0.05 ATR | TARGET_1_5R_NO_BE | 131 | 49.62% | 19.08% | +6.30R | 8.52R | 25 | 36 | 0 | 70 | $12.34 | $23.21 | 0.74 |
| No HTF | 0.05 ATR | TARGET_2_0R_BE_AT_1R | 131 | 45.80% | 15.27% | +13.35R | 7.55R | 20 | 33 | 10 | 68 | $12.34 | $23.21 | 1.77 |
| No HTF | 0.05 ATR | TARGET_2_0R_NO_BE | 131 | 47.33% | 15.27% | +7.09R | 8.52R | 20 | 39 | 0 | 72 | $12.34 | $23.21 | 0.83 |
| No HTF | 0.10 ATR | TARGET_1_5R_NO_BE | 131 | 48.85% | 18.32% | +5.28R | 7.71R | 24 | 35 | 0 | 72 | $12.85 | $24.01 | 0.68 |
| No HTF | 0.10 ATR | TARGET_2_0R_BE_AT_1R | 131 | 45.80% | 14.50% | +11.77R | 6.71R | 19 | 32 | 8 | 72 | $12.85 | $24.01 | 1.75 |
| No HTF | 0.10 ATR | TARGET_2_0R_NO_BE | 131 | 47.33% | 14.50% | +6.89R | 7.71R | 19 | 37 | 0 | 75 | $12.85 | $24.01 | 0.89 |
| No HTF | 0.15 ATR | TARGET_1_5R_NO_BE | 131 | 48.85% | 16.79% | +3.62R | 9.77R | 22 | 35 | 0 | 74 | $13.34 | $24.81 | 0.37 |
| No HTF | 0.15 ATR | TARGET_2_0R_BE_AT_1R | 131 | 45.04% | 12.98% | +8.21R | 6.96R | 17 | 32 | 9 | 73 | $13.34 | $24.81 | 1.18 |
| No HTF | 0.15 ATR | TARGET_2_0R_NO_BE | 131 | 46.56% | 12.98% | +2.98R | 7.77R | 17 | 37 | 0 | 77 | $13.34 | $24.81 | 0.38 |
| With HTF | 0.05 ATR | TARGET_1_5R_NO_BE | 76 | 48.68% | 21.05% | +4.53R | 5.29R | 16 | 21 | 0 | 39 | $12.98 | $24.68 | 0.86 |
| With HTF | 0.05 ATR | TARGET_2_0R_BE_AT_1R | 76 | 46.05% | 17.11% | +8.79R | 4.99R | 13 | 20 | 4 | 39 | $12.98 | $24.68 | 1.76 |
| With HTF | 0.05 ATR | TARGET_2_0R_NO_BE | 76 | 47.37% | 17.11% | +6.82R | 4.99R | 13 | 22 | 0 | 41 | $12.98 | $24.68 | 1.36 |
| With HTF | 0.10 ATR | TARGET_1_5R_NO_BE | 76 | 48.68% | 21.05% | +5.22R | 4.46R | 16 | 20 | 0 | 40 | $13.46 | $25.54 | 1.17 |
| With HTF | 0.10 ATR | TARGET_2_0R_BE_AT_1R | 76 | 46.05% | 15.79% | +7.43R | 4.19R | 12 | 19 | 3 | 42 | $13.46 | $25.54 | 1.77 |
| With HTF | 0.10 ATR | TARGET_2_0R_NO_BE | 76 | 47.37% | 15.79% | +5.83R | 4.19R | 12 | 21 | 0 | 43 | $13.46 | $25.54 | 1.39 |
| With HTF | 0.15 ATR | TARGET_1_5R_NO_BE | 76 | 50.00% | 19.74% | +6.15R | 4.41R | 15 | 19 | 0 | 42 | $14.03 | $26.40 | 1.39 |
| With HTF | 0.15 ATR | TARGET_2_0R_BE_AT_1R | 76 | 44.74% | 13.16% | +3.95R | 4.88R | 10 | 19 | 4 | 43 | $14.03 | $26.40 | 0.81 |
| With HTF | 0.15 ATR | TARGET_2_0R_NO_BE | 76 | 46.05% | 13.16% | +2.01R | 5.88R | 10 | 21 | 0 | 45 | $14.03 | $26.40 | 0.34 |

## Experiment 2 — Model B: FVG Standard Engine

| Filter | Lifecycle | Trade | Win rate | Target hit | Net R | Max DD | TP | SL | BE | Time exit | Median SL | Average SL | R/DD |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| NONE | SCALP_LOCAL_WICK_MAX_4 | 143 | 40.85% | 6.34% | -6.07R | 17.85R | 9 | 45 | 5 | 83 | $15.70 | $20.16 | -0.34 |
| NONE | DAY_STRUCTURAL_MAX_16 | 143 | 42.55% | 9.93% | -1.55R | 18.96R | 14 | 43 | 13 | 71 | $27.92 | $42.39 | -0.08 |
| PREMIUM_DISCOUNT | SCALP_LOCAL_WICK_MAX_4 | 69 | 36.76% | 5.88% | -5.84R | 8.91R | 4 | 23 | 3 | 38 | $14.93 | $21.59 | -0.66 |
| PREMIUM_DISCOUNT | DAY_STRUCTURAL_MAX_16 | 69 | 28.36% | 11.94% | -10.71R | 14.96R | 8 | 30 | 12 | 17 | $16.07 | $28.36 | -0.72 |
| HTF_DISPLACEMENT_BOS | SCALP_LOCAL_WICK_MAX_4 | 17 | 47.06% | 5.88% | +2.14R | 3.53R | 1 | 5 | 0 | 11 | $18.38 | $20.61 | 0.61 |
| HTF_DISPLACEMENT_BOS | DAY_STRUCTURAL_MAX_16 | 17 | 52.94% | 17.65% | +4.98R | 1.88R | 3 | 1 | 0 | 13 | $37.99 | $49.31 | 2.64 |
| ALL_FILTERS | SCALP_LOCAL_WICK_MAX_4 | 3 | 33.33% | 0.00% | -0.98R | 1.00R | 0 | 1 | 0 | 2 | $35.68 | $31.63 | -0.98 |
| ALL_FILTERS | DAY_STRUCTURAL_MAX_16 | 3 | 33.33% | 0.00% | -1.07R | 1.07R | 0 | 1 | 0 | 2 | $31.83 | $41.59 | -1.00 |

## Dampak HTF terhadap BUY dan SELL IFVG

| Varian | Arah | Trade | Win rate | Net R | Max DD | TP | SL | BE | Time exit |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A_IFVG__NO_HTF__BUF_0.10__TARGET_2_0R_BE_AT_1R | BUY | 61 | 54.10% | +6.70R | 6.56R | 8 | 18 | 1 | 34 |
| A_IFVG__NO_HTF__BUF_0.10__TARGET_2_0R_BE_AT_1R | SELL | 70 | 38.57% | +5.07R | 8.28R | 11 | 14 | 7 | 38 |
| A_IFVG__HTF__BUF_0.10__TARGET_2_0R_BE_AT_1R | BUY | 39 | 56.41% | +4.14R | 4.21R | 5 | 12 | 0 | 22 |
| A_IFVG__HTF__BUF_0.10__TARGET_2_0R_BE_AT_1R | SELL | 37 | 35.14% | +3.28R | 5.42R | 7 | 7 | 3 | 20 |

## Arah pada kandidat FVG terbaik

| Varian | Arah | Trade | Win rate | Net R | Max DD | TP | SL | BE | Time exit |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B_FVG__HTF_DISPLACEMENT_BOS__DAY_STRUCTURAL_MAX_16 | BUY | 15 | 60.00% | +6.17R | 1.06R | 3 | 1 | 0 | 11 |
| B_FVG__HTF_DISPLACEMENT_BOS__DAY_STRUCTURAL_MAX_16 | SELL | 2 | 0.00% | -1.19R | 1.19R | 0 | 0 | 0 | 2 |

## Pemenang dan trade-off

### Model A — R tertinggi

- Varian: `A_IFVG__NO_HTF__BUF_0.05__TARGET_2_0R_BE_AT_1R`
- Trade: **131**
- Win rate: **45.80%**
- Net result: **+13.35R**
- Max drawdown: **7.55R**
- R/DD: **1.77**

### Model A — keseimbangan terbaik

- Varian: `A_IFVG__HTF__BUF_0.10__TARGET_2_0R_BE_AT_1R`
- Trade: **76**
- Win rate: **46.05%**
- Net result: **+7.43R**
- Max drawdown: **4.19R**
- R/DD: **1.77**

### Model B — R tertinggi

- Varian: `B_FVG__HTF_DISPLACEMENT_BOS__DAY_STRUCTURAL_MAX_16`
- Trade: **17**
- Win rate: **52.94%**
- Net result: **+4.98R**
- Max drawdown: **1.88R**
- R/DD: **2.64**

### Seluruh grid — R tertinggi

- Varian: `A_IFVG__NO_HTF__BUF_0.05__TARGET_2_0R_BE_AT_1R`
- Trade: **131**
- Win rate: **45.80%**
- Net result: **+13.35R**
- Max drawdown: **7.55R**
- R/DD: **1.77**

### Seluruh grid — keseimbangan terbaik

- Varian: `A_IFVG__HTF__BUF_0.10__TARGET_2_0R_BE_AT_1R`
- Trade: **76**
- Win rate: **46.05%**
- Net result: **+7.43R**
- Max drawdown: **4.19R**
- R/DD: **1.77**

## Kesimpulan taktis dan SOP Januari

Kombinasi paling seimbang berdasarkan aturan pemilihan yang dikunci adalah `A_IFVG__HTF__BUF_0.10__TARGET_2_0R_BE_AT_1R` dengan **+7.43R**, drawdown **4.19R**, dan rasio R/DD **1.77**.

Kombinasi dengan laba absolut tertinggi adalah `A_IFVG__NO_HTF__BUF_0.05__TARGET_2_0R_BE_AT_1R` sebesar **+13.35R**, dengan drawdown **7.55R**. Laba tertinggi tidak otomatis menjadi SOP bila drawdown dan jumlah trade lebih buruk.

SOP ini adalah **SOP kandidat khusus hasil optimasi Januari**, bukan bukti generalisasi. Tidak ada Februari atau bulan lain yang digunakan, sesuai ruang lingkup.

## Artifacts

- `AMYFX_MODEL_A_IFVG_MODEL_B_FVG_OPTIMIZATION_JANUARY_2026.md`
- `amyfx-model-a-ifvg-model-b-fvg-optimization-january-2026.json`
- `amyfx-model-a-ifvg-grid-january-2026.csv`
- `amyfx-model-b-fvg-grid-january-2026.csv`
- `amyfx-model-ab-best-candidate-trades-january-2026.csv`

Kode aplikasi, panel Rencana Eksekusi, branch `main`, package, signing, update channel, versi, release, APK, dan data pengguna tidak diubah.
