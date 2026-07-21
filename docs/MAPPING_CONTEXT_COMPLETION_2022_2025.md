# Amy FX Mapping Context — Completion Backtest 2022–2025

This document records the completion backtest for Mapping components that had not previously received full validation. It does not replace the locked Pine validations for Market State and Direction Forecast.

## Dataset

- Symbol: XAU/USD
- Period: January 2022 through December 2025
- M15 candles after cleaning: 91,562
- H1 candles: 22,905
- H4 candles: 6,368
- D1 candles: 1,244
- Monthly archives: 48
- Duplicate M15 timestamps removed: 16
- Data from 2026 was not used.

## Scope

The completion harness ports the production formulas and thresholds into a deterministic offline backtest. It evaluates:

1. Market Health score calibration.
2. Market Shift with concept inputs.
3. Strategy Router with Direction Forecast conflict protection.
4. Combined Liquidity Context.
5. Active Setup safety and authority.

The harness does not retune the locked Pine Market State or Direction Forecast rules.

## 1. Market Health

Samples: 22,834.

The six displayed scores did not show a stable predictive relationship with the evaluated future event:

| Diagnostic | Correlation | High-score event rate | Low-score event rate |
|---|---:|---:|---:|
| Trend Strength | -0.0009 | 14.13% | 16.49% |
| Trend Stability | -0.0056 | Not stable | Not stable |
| Transition Risk | -0.0342 | 12.85% | 15.96% |
| Manipulation Risk | -0.0017 | Not stable | Not stable |
| Range Probability | -0.0271 | Not stable | Not stable |
| Expansion Probability | -0.0326 | Not stable | Not stable |

Decision:

- Market Health stays in Analyze only.
- Values are raw engine diagnostics, not probability, accuracy, or win rate.
- Market Health must not change the validated Market State or Direction Forecast.

## 2. Market Shift with production concept inputs

A useful warning means a validated major structure flip occurs within the next 12 M15 candles.

| Threshold | Warnings | Precision | Recall | Median lead |
|---|---:|---:|---:|---:|
| Risk >= 30 | 5,419 | 14.01% | 62.21% | 7 M15 bars |
| Risk >= 55 | 4,692 | 13.02% | 44.11% | 7 M15 bars |
| Risk >= 72 | 2,901 | 13.75% | 27.86% | 7 M15 bars |

Decision:

- Market Shift is advisory context only.
- It may warn the user that market character is changing.
- It is not an automatic hard gate and cannot force the Router to transition.

## 3. Strategy Router after Direction Forecast protection

Production-like test results:

- Setups evaluated: 856
- TP2: 300
- SL: 522
- Expired: 34
- Resolved win rate: 36.50%
- Aggregate expectancy: -0.0023R
- Average raw quality score: 85.82

Yearly expectancy:

| Year | Expectancy |
|---|---:|
| 2022 | -0.0086R |
| 2023 | -0.2233R |
| 2024 | +0.0570R |
| 2025 | +0.1097R |

By strategy:

| Strategy | Setups | Expectancy |
|---|---:|---:|
| Trend Pullback | 399 | -0.0169R |
| Range Mean Reversion | 51 | 0.0000R |
| Sweep/MSS Reversal | 406 | +0.0117R |
| Breakout Continuation | 0 | Not evaluated |

Quality score calibration was not monotonic:

- Quality 70–79: -0.0163R
- Quality 80–89: +0.0993R
- Quality 90+: -0.0291R

The Direction Forecast conflict filter blocked no opposing candidate in this historical sample because active forecast episodes did not overlap an opposing Router candidate.

Decision:

- Strategy Router is watch-only context.
- Router quality is not win probability.
- Router cannot replace the existing Entry Map or create a live setup.
- A narrow positive parameter combination was rejected because it was negative in 2022 and 2023 and positive only in 2024 and 2025.

## 4. Combined Liquidity Context

The target universe combines local M15 liquidity with PDH, PDL, PWH, and PWL.

- Samples: 22,859
- First-hit coverage within 48 M15 bars: 82.97%
- Nearest-liquidity first-hit accuracy: 79.55%
- Nearest-liquidity reach rate: 69.66%
- Average first-hit time: 11.80 M15 bars
- HTF-aligned reach rate: 61.85%
- Forecast-aligned reach rate: 64.26%

Nearest first-hit accuracy by year:

| Year | Accuracy |
|---|---:|
| 2022 | 79.84% |
| 2023 | 78.94% |
| 2024 | 79.12% |
| 2025 | 80.22% |

Decision:

- Nearest Liquidity is the primary Dashboard objective.
- HTF-aligned and audited destinations remain Analyze details.
- A destination is not BUY/SELL and does not determine entry timing.

## 5. Active Setup authority

The exact M15 Entry Map lifecycle backtest produced 85 setups from 2022–2025:

- TP2: 7
- SL: 27
- TP1 then break-even: 31
- Expired: 20
- TP2 rate: 8.24%
- Protected outcome rate, TP2 or TP1/BE: 44.71%

Decision:

- Existing Entry Map output remains visible as WATCH SETUP.
- It cannot be presented as a validated live entry model.
- A setup that conflicts with an active validated Direction Forecast is withheld.

## Final UI contract

Dashboard is summary only:

- Validated Market State.
- Validated Direction Forecast.
- Nearest Liquidity objective.
- Regime context.
- Market Shift advisory.
- Strategy context status.

Analyze contains all technical detail:

- Validated rule details.
- Regime distributions.
- Raw Engine Diagnostics.
- Market Shift reasons.
- Router candidate and strategy engines.
- Nearest, HTF-aligned, and audited liquidity targets.

No completion-backtest component may override the locked Pine Market State or Direction Forecast.
