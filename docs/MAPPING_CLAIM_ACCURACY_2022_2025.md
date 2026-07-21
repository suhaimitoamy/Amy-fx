# Amy FX Mapping — Claim Accuracy Backtest 2022–2025

## Purpose

This audit measures **feature accuracy**, not trade win rate. Each feature is judged only against the claim it displays to the user. TP, SL, expectancy, and reward:risk are separate trading-performance metrics and are not used to decide whether a mapping label is accurate.

The locked Pine Market State, Direction Forecast, Liquidity Draw, Asia High/Low, PDH/PDL, Midnight Open, OB/FVG revisit, and Protected High/Low rules were not retuned or rewritten.

## Dataset

- Symbol: XAU/USD
- Period: January 2022 through December 2025
- Monthly archives: 48
- Clean M15 candles: 91,562
- H1 candles: 22,905
- H4 candles: 6,368
- D1 candles: 1,244
- Duplicate M15 timestamps removed: 16
- 2026 data excluded

All production claims use information available at the observation candle. Future candles are used only to score whether the stated claim became true.

## Results

### Market Regime

Claim: the displayed regime matches an independent, price-only audit of the current M15 condition.

- Samples: 22,836
- Current-condition agreement: **19.74%**
- By year: 2022 19.60%, 2023 20.66%, 2024 19.79%, 2025 19.01%
- RANGING was the strongest individual label at 60.45% precision; the aggregate five-class classifier was not reliable enough for decision authority.

Decision: **Analyze-only experimental context**. It cannot override Market State or Direction Forecast.

### Market Shift

Claim: a warning is followed by a validated major structure flip within the next 12 M15 candles.

| Threshold | Precision | Recall | Median lead |
|---|---:|---:|---:|
| Risk ≥30 | **14.01%** | **62.21%** | 7 M15 candles |
| Risk ≥55 | 13.02% | 44.11% | 7 M15 candles |
| Risk ≥72 | 13.75% | 27.86% | 7 M15 candles |

Decision: **advisory only**. The warning may describe risk but cannot block a validated feature or force the Router into Transition.

### Strategy Router

Claim: the chosen strategy matches the following market behavior according to that strategy's own definition.

- Claims: 1,426
- Strategy-suitability accuracy: **48.53%**
- Trend Pullback: 45.47%
- Range Mean Reversion: 38.18%
- Sweep/MSS Reversal: 50.78%
- Breakout Continuation: no historical sample under the production gate
- Yearly: 48.66%, 42.36%, 49.75%, 51.61%

No simple parameter gate reached a stable 70% or higher on both 2022–2024 development and 2025 validation with meaningful coverage.

Decision: **Analyze-only experimental description**. It cannot create or replace the primary setup.

### Valid Break labels

Each label uses a separate claim:

| Label | Claim | Accuracy |
|---|---|---:|
| Valid Break | Level holds and extends at least 0.5 ATR before closing back through it | **67.51%** |
| Sweep Only | Reclaim is followed by at least a 0.4 ATR reversal reaction | **68.33%** |
| Failed Break | Failed level is followed by at least a 0.4 ATR reaction toward the failure side | **81.38%** |

Decision: labels remain available in Analyze with their individual accuracy. Only Failed Break crossed 80% under this audit.

### Entry Map

Claim: after Sweep → MSS, price reacts at least 0.5 ATR in the mapped direction within 16 M15 candles, with favorable excursion not smaller than adverse excursion.

- Setups: 85
- Directional-reaction accuracy: **48.24%**
- BUY: 42.55%
- SELL: 55.26%
- Yearly: 40.00%, 63.16%, 42.86%, 47.83%

Decision: Entry Map remains visible only as an **experimental Analyze record**. It cannot occupy the primary setup, signal, or Dashboard decision.

### Liquidity Context

Claim: between the active upper and lower liquidity targets, the nearest target becomes the first hit.

- Samples: 22,859
- First-hit coverage within 48 M15 candles: **82.97%**
- Nearest-liquidity first-hit accuracy: **79.55%**
- Nearest target reach rate: 69.66%
- Average first-hit time: 11.80 M15 candles
- HTF-aligned reach rate: 61.85%
- Forecast-aligned reach rate: 64.26%
- Yearly nearest first-hit accuracy: 79.84%, 78.94%, 79.12%, 80.22%

Decision: **Nearest Liquidity is the primary Dashboard objective**. It remains a destination claim, not BUY/SELL or entry timing.

## Locked Pine references preserved

These existing non-repaint Pine claims remain unchanged and are shown only as locked references until each rule has verified parity in the application:

| Feature | Claim accuracy |
|---|---:|
| Validated Target reach | 91.38% |
| Asia High/Low target ≤4 hours | 86.64% |
| PDH/PDL target ≤8 hours | 85.64% |
| Midnight Open retest ≤4 hours | 86.43% |
| Order Block revisit ≤4 hours | 83.91% |
| FVG revisit ≤4 hours | 82.37% |
| M5 Key Liquidity target ≤4 hours | 82.43% |
| Protected Low holds 1 hour | 93.47% |
| Protected High holds 1 hour | 91.86% |

Changing their locked thresholds would invalidate those measurements, so no retuning was performed.

## Final application authority

Dashboard contains only:

1. Validated Market State.
2. Validated Direction Forecast.
3. Nearest Liquidity.

Analyze contains the complete audit detail, claim definitions, individual accuracy, locked Pine references, raw diagnostics, Regime, Shift, Router, Valid Break labels, and experimental Entry Map.

Mapping Explanation, Setup Lifecycle, Session/Killzone, and the MTF table are tested for deterministic correctness and parity because they do not independently make a future-market claim.
