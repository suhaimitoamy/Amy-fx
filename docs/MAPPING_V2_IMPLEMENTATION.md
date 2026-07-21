# Amy FX Regime Router V3

Branch: `experiment/mapping-regime-engine-20260721`

## Tujuan

Amy FX harus menjawab **market sedang apa** sebelum memilih setup. Regime sekarang menjadi pengatur strategi M15, bukan sekadar label Market Outlook.

## Alur keputusan

```text
Closed candle M15 + HTF + data integrity
        ↓
Market Regime Engine V3
        ↓
Regime State Machine / persistence
        ↓
Strategy Router
        ↓
Hanya satu strategy engine aktif
        ↓
Setup M15 terpadu atau WAIT
```

## Market Regime Engine V3

Regime yang tersedia:

- `TRENDING`
- `RANGING`
- `MANIPULATION`
- `EXPANSION`
- `TRANSITION`

Fitur yang dibaca meliputi ATR ratio, ADX, EMA 9/21/34/90/200, directional efficiency, candle alternation, body/wick character, displacement, sweep, failed break, HTF disagreement, news risk, dan freshness data.

Market Health menampilkan:

- Trend Strength
- Trend Stability
- Transition Risk
- Manipulation Risk
- Range Score
- Expansion Score

Angka tersebut adalah **score karakter market**, bukan probabilitas kemenangan transaksi.

## Market Shift Detector

Status:

- `STABLE`
- `EARLY_WARNING`
- `TRANSITION_RISK`
- `SHIFT_CONFIRMED`

State machine membutuhkan persistence dua candle untuk pergantian biasa. Shift darurat dapat memindahkan sistem ke `TRANSITION / NO_TRADE` lebih cepat.

## Strategy Router

| Regime | Strategy engine aktif | Strategy lain |
|---|---|---|
| Trending | `TREND_PULLBACK` | Dinonaktifkan |
| Ranging | `RANGE_MEAN_REVERSION` | Dinonaktifkan |
| Manipulation | `SWEEP_MSS_REVERSAL` | Dinonaktifkan |
| Expansion | `BREAKOUT_CONTINUATION` | Dinonaktifkan |
| Transition | `NO_TRADE` | Semua dinonaktifkan |

Router sekarang benar-benar menentukan setup yang boleh masuk ke `result.bestSetup` dan `result.setups`. Setup lama tetap disimpan sebagai `unroutedBestSetup` dan `unroutedSetups` untuk audit.

## Empat strategy engine

### Trend Pullback

Mengambil cara berpikir Kronos dan GCX:

- EMA 21/34/90 dan EMA200 searah.
- ADX minimal 18.
- Pullback ke EMA21/34.
- RSI berada dalam band continuation.
- Timing EMA9/21 atau break candle momentum.
- Stop struktural dengan padding 0,20 ATR.
- Risk di luar 0,35–2,20 ATR ditolak.

### Range Mean Reversion

- Range 32 candle.
- Entry hanya di sisi luar range.
- ADX rendah.
- Wick rejection dan RSI reversal.
- OB/FVG searah dipakai sebagai supply/demand context.
- Close di luar range tidak boleh di-fade.

### Sweep MSS Reversal

- Sweep memory 12 candle M15.
- Sisi liquidity harus jelas.
- MSS/CHOCH reversal harus valid.
- Displacement dan reclaim diperiksa.
- Entry Map lama hanya dipakai bila arahnya sesuai regime Manipulation.

### Breakout Continuation

- Displacement close di luar range 20 candle.
- ATR expansion dan body quality.
- HTF harus selaras.
- Breakout harus bertahan atau memberi retest-continuation.
- Setup yang sudah terlalu jauh tidak boleh dikejar.

## Kontrak setup terpadu

Setup routed menggunakan:

- `executionMode: REGIME_ROUTED_M15`
- Quality score 0–100, bukan win probability.
- Minimum RR 1,5 untuk routed strategy.
- Integrity filter menerima `TREND PULLBACK`, `RANGE REVERSAL`, `EXPANSION BREAKOUT`, dan `SWEEP MSS REVERSAL`.

## Liquidity Context

Liquidity tidak lagi diubah menjadi prediksi BUY/SELL.

Tiga istilah dipisahkan:

- `Nearest Liquidity`
- `HTF-Aligned Liquidity`
- `Audited Destination` dari Liquidity Draw jika tersedia

BSL-first bukan BUY dan SSL-first bukan SELL.

## UI Preview

Halaman pertama menampilkan:

- Market personality aktif.
- Lima score regime.
- Market Health.
- Market Shift dan persistence state.
- Strategy Router dan engine yang dinonaktifkan.
- Setup dari strategy engine aktif bila seluruh rule terpenuhi.
- Liquidity Context netral.
- Mode Fokus dan Detail Teknis.

## Keselamatan

- `main` tidak diubah.
- Tidak ada eksekusi transaksi otomatis.
- Confidence dan quality tidak disebut win rate.
- Transition memblokir seluruh strategy engine.
- Legacy/Concept/Entry Map tetap tersedia untuk audit teknis, tetapi tidak lagi menjadi sumber setup utama ketika M15 memakai Regime Router.
